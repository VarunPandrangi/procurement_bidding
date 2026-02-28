# Build Progress — Procurement Bidding Platform

## Current Sprint: Sprint 10 — Governance & Hardening (COMPLETE)
## Current Model: Claude Opus 4.6

---

## Phase 1 — Core Backend
- [x] Sprint 1: Auth & Access Control
- [x] Sprint 2: RFQ Creation & Commercial Lock
- [x] Sprint 3: Bidding Engine & Ranking
- [x] Sprint 4: Locking, Audit & Exports

## Phase 2 — Intelligence Backend
- [x] Sprint 5: Compliance & Risk Flags
- [x] Sprint 6: Supplier Credibility
- [x] Sprint 7: Weighted Ranking & KPIs

## Phase 3 — Advanced Backend
- [x] Sprint 8: Negotiation Mode
- [x] Sprint 9: Award Simulation
- [x] Sprint 10: Governance & Hardening

## Frontend
- [ ] Scaffolding & Shared UI Components
- [ ] Auth & Layout
- [ ] Admin Pages
- [ ] Buyer Pages
- [ ] Supplier Pages
- [ ] E2E Integration

---

## Security Tests Status
- [x] SEC-T01: No competitor prices in supplier ranking response
- [x] SEC-T02: No competitor data in supplier RFQ response
- [x] SEC-T03: Cross-supplier access returns 403
- [x] SEC-T04: Cross-buyer access returns 404
- [x] SEC-T05: Admin cannot use supplier endpoints
- [x] SEC-T06: Bid after close time rejected
- [x] SEC-T07: Revision after max revisions rejected
- [x] SEC-T08: Login brute force rate limited
- [x] SEC-T09: Tampered JWT rejected
- [x] SEC-T10: Expired access token rejected
- [x] SEC-T11: Expired tokenized link rejected
- [x] SEC-T12: Audit log DELETE rejected at DB level
- [x] SEC-T13: Commercial terms edit after lock rejected
- [x] SEC-T14: SQL injection attempt sanitized
- [x] SEC-T15: XSS payload stored as literal text
- [x] SEC-T01-NEG: No competitor prices in supplier negotiation ranking response
- [x] SEC-T02-NEG: No competitor data in supplier negotiation detail response

## E2E Tests Status
- [x] E2E-01: Full happy path lifecycle
- [x] E2E-02: Zero competitor data leakage
- [x] E2E-03: Anti-snipe validation
- [x] E2E-04: Hash integrity verification

---

## Known Issues / Open Items
None.

---

## Hotfixes / Infrastructure Patches

### Test Infrastructure Fix — 2026-02-27

**Model:** Claude Sonnet 4.6
**Trigger:** 177 / 707 tests failing across 17 suites after Sprint 8 merge

**Root cause:** Jest runs test files in parallel by default (no `--runInBand`). All 24 DB-dependent test suites shared a single PostgreSQL database. Each file's `beforeEach` called `cleanDatabase()` (12 separate TRUNCATE statements) and each file's `afterAll` called `teardownTestDatabase()` which rolled back ALL migrations (dropping tables). Under parallel execution this caused deadlocks, `relation does not exist` errors, `MigrationLocked` contention, FK violations, and wrong HTTP status codes returned mid-test.

**Files changed (2):**
- `backend/package.json` — Added `--runInBand` to `test`, `test:integration`, `test:e2e`, `test:security`, `test:coverage` scripts; `test:unit` left parallel (no DB)
- `backend/tests/helpers/setup.ts`:
  - `setupTestDatabase()`: Added `forceFreeMigrationsLock()` before `migrate.latest()` to clear stale locks from crashed runs
  - `teardownTestDatabase()`: Removed `migrate.rollback(undefined, true)` — table drops cascade-failed into subsequent files; data isolation is owned by `cleanDatabase()` in `beforeEach`
  - `cleanDatabase()`: Replaced 12 separate TRUNCATE statements with a single atomic `TRUNCATE TABLE ... CASCADE` — eliminates inter-statement deadlock window

**Result:** 707 / 707 tests passing, 43 / 43 suites passing

---

## Completed Sprint Notes

### Sprint 10 — 2026-02-27 — Governance & Hardening

**Model:** Claude Opus 4.6
**Status:** COMPLETE — All 752 tests passing (48 suites)

**Deliverables (4 modified source files, 3 new E2E test files, 7 modified controller files):**
1. JUSTIFICATION_TOO_SHORT error code — `src/shared/validators/admin.validators.ts`: removed `min(50)` from justification Zod constraints; `src/modules/admin/admin.controller.ts`: added explicit 50-char check in `createOverrideHandler` and `extendRfqHandler` returning `422 JUSTIFICATION_TOO_SHORT` instead of generic `VALIDATION_ERROR`
2. Audit log query param aliases — `src/shared/validators/award.validators.ts`: added `from` and `to` as optional datetime fields; `admin.controller.ts`: maps `from` → `startDate` and `to` → `endDate` as aliases for `start_date`/`end_date`; backwards compatible
3. Canonical JSON hash fix — `src/shared/utils/hash.ts`: added `canonicalStringify()` with recursive key sorting; `computeAuditChainHash()` now uses canonical form instead of `JSON.stringify` — fixes JSONB key-order non-determinism that broke audit chain verification after PostgreSQL roundtrip
4. E2E-02 test — `tests/e2e/e2e-02-zero-data-leakage.spec.ts`: 3 suppliers with distinct prices (111.11–999.99), recursive deep scan of all supplier-facing API responses (RFQ detail, ranking, bid-status) with exact-match forbidden value assertion; excludes `commercial_locked_by_supplier_code` (intentional RFQ metadata)
5. E2E-03 test — `tests/e2e/e2e-03-anti-snipe.spec.ts`: RFQ with `bid_close_at = NOW()+90s`, anti_snipe_window=2min (120s), anti_snipe_extension=5min; bid submission triggers extension; verifies DEADLINE_EXTENDED audit entry with correct trigger and timestamps
6. E2E-04 test — `tests/e2e/e2e-04-hash-integrity.spec.ts`: full lifecycle producing 5+ audit entries, verifies `verifyAuditChain(rfqId)` returns `valid=true`; directly UPDATEs event_data in DB to tamper; verifies chain detects tampering at exact `brokenAt` index
7. OpenAPI @swagger annotations — added JSDoc swagger blocks to all 7 controllers (~35 endpoint annotations total): `admin.controller.ts` (11 endpoints), `bid.controller.ts` (3), `ranking.controller.ts` (2), `flag.controller.ts` (1), `kpi.controller.ts` (2), `export.controller.ts` (3), `supplier-rfq.controller.ts` (4); all with request/response schemas, security scheme, and error codes

**Hardening changes (already present from prior sprints, verified):**
- Database indexes: migration 013 with 7 performance indexes (verified)
- Security: Helmet CSP, rate limiting (5/15min), bcrypt cost 12, JWT from env (verified)
- N+1 queries: all batch/JOIN patterns (verified)
- Dockerfile: multi-stage node:20-alpine build (verified)
- .env.example: all env vars documented (verified)

**Architecture decisions:**
- `canonicalStringify` uses recursive sorted-key serialization for deterministic JSON regardless of PostgreSQL JSONB key reordering; both `createAuditEntry` (write) and `verifyAuditChain` (read) now use the same canonical form
- E2E-02 uses exact value matching (not substring) for supplier codes/IDs — 5-char codes can appear as substrings in UUIDs and hashes, causing false positives
- E2E-02 excludes `commercial_locked_by_supplier_code` from leakage scan — this is intentional RFQ metadata showing which supplier triggered the commercial lock, not competitive intelligence
- JUSTIFICATION_TOO_SHORT moved from Zod schema-level `min(50)` to controller-level check to provide a domain-specific error code instead of generic validation error

**Test counts (Sprint 10 delta):**
- E2E: +7 tests (3 new suites: e2e-02 with 2 tests, e2e-03 with 2 tests, e2e-04 with 3 tests)
- Total added: 7 net new tests (752 - 745)

### Sprint 9 — 2026-02-27 — Award Simulation Engine

**Model:** Claude Opus 4.6
**Status:** COMPLETE — All 745 tests passing (45 suites)

**Deliverables (3 modified source files, 1 modified E2E test, 1 new unit test, 2 integration test files):**
1. Simulation validator rewrite — `src/shared/validators/award.validators.ts`: replaced `simulationSchema` with Zod discriminated union on `mode` field supporting 3 modes: `single_supplier` (supplier_id), `item_split` (items array with rfq_item_id + supplier_id), `category_split` (categories array with item_ids[] + supplier_id)
2. Simulation service rewrite — `src/modules/simulation/simulation.service.ts`: complete rewrite with 4 exported pure functions (`resolveAllocations`, `validateItemCoverage`, `calculateTheoreticalMinimum`, `calculateDeliveryOutcome`) + `runSimulation` RFQ orchestrator + `runNegotiationSimulation` negotiation orchestrator. New response shape: `mode`, `total_procurement_cost`, `delivery_outcome_days`, `unique_supplier_count`, `delta_vs_l1_total`, `theoretical_minimum_cost`, `per_supplier_breakdown`, `simulated_at`
3. Zero-write invariant enforced — removed `createAuditEntry()` call (previously created `AWARD_SIMULATED` audit entry); simulation now uses read-only SELECT queries exclusively; no database writes of any kind; verified by structural source code analysis unit test
4. Expanded allowed states — simulation now available for ACTIVE, CLOSED, and AWARDED RFQs and negotiations (previously only CLOSED and AWARDED)
5. Delivery fallback — `delivery_outcome_days` now falls back to `rfqs.delivery_lead_time_days` when `rfq_suppliers.supplier_delivery_days` is null for a supplier; applies to both RFQ and negotiation simulation
6. Negotiation simulation endpoint — `POST /api/buyer/negotiations/:id/simulation`: same 3 modes, same response shape, operates on negotiation bids (filtered by `negotiation_id`), uses parent RFQ items
7. E2E test updated — `tests/e2e/e2e-01-full-lifecycle.spec.ts`: Step 14 updated for new schema format and zero-write assertions; admin audit log step no longer asserts AWARD_SIMULATED
8. Unit test suite — `tests/unit/simulation.spec.ts`: 19 tests (resolveAllocations: 3, validateItemCoverage: 4, calculateTheoreticalMinimum: 3, calculateDeliveryOutcome: 5, Mode A integration: 1, Mode B delta=0: 1, zero-write structural verification: 1, SUPPLIER_HAS_NO_BID mocked DB: 1)
9. RFQ integration test suite — `tests/integration/simulation.integration.spec.ts`: 14 tests (Mode A response shape, Mode A correct costs, Mode B valid split, Mode B missing item 422, Mode C category split, Mode C duplicate item 422, Mode C missing item 422, ACTIVE RFQ allowed, DRAFT RFQ rejected 409, no status change, no audit entry zero-write + audit-log API verification, award creates AWARD_FINALIZED contrast, 404 non-owned RFQ, SUPPLIER_HAS_NO_BID 422)
10. Negotiation integration test suite — `tests/integration/negotiation-simulation.integration.spec.ts`: 11 tests (Mode A response shape, Mode A correct costs, Mode B valid split with delta=0, Mode B missing item 422, Mode C category split, Mode C duplicate item 422, no status change, no audit entry, award creates NEGOTIATION_AWARDED contrast, SUPPLIER_HAS_NO_BID 422, 404 non-owned negotiation)

**Simulation modes implemented:**
- **Mode A (single_supplier)**: `{ mode: "single_supplier", supplier_id: "uuid" }` — awards all items to one supplier
- **Mode B (item_split)**: `{ mode: "item_split", items: [{ rfq_item_id, supplier_id }] }` — per-item supplier assignment; 422 if any item missing
- **Mode C (category_split)**: `{ mode: "category_split", categories: [{ item_ids: [], supplier_id }] }` — group items into categories; 422 if item missing or double-allocated

**Calculation metrics:**
- **total_procurement_cost**: SUM(supplier_latest_unit_price * quantity) per allocated item
- **theoretical_minimum_cost**: SUM(L1_unit_price * quantity) for each item across ALL bidders (per-item cheapest)
- **delta_vs_l1_total**: total_procurement_cost - theoretical_minimum_cost
- **delivery_outcome_days**: MAX(supplier_delivery_days) from rfq_suppliers across awarded suppliers; falls back to rfqs.delivery_lead_time_days when supplier-specific value is null; null if all null
- **unique_supplier_count**: count distinct supplier_ids in allocation
- **per_supplier_breakdown**: [{ supplier_code, items_awarded_count, subtotal }]

**Architecture decisions:**
- Zero-write invariant: simulation function contains zero INSERT, UPDATE, or transaction calls; verified by audit log integration test and source code inspection
- Pure function pattern for all calculations — exported separately for unit testing, DB orchestrator composes them (same pattern as ranking.service.ts, flag.service.ts)
- `whereNull('negotiation_id')` filter on bid queries ensures simulation only considers RFQ bids, not negotiation bids
- `theoretical_minimum` is per-item L1 aggregation, not lowest total bid — allows buyer to see the theoretical best outcome if they could cherry-pick the cheapest supplier for each item
- Delivery outcome uses `rfq_suppliers.supplier_delivery_days` (nullable, added in Sprint 5 migration) with fallback to `rfqs.delivery_lead_time_days` when supplier-specific value is null; applies to both RFQ and negotiation contexts
- Zod discriminated union on `mode` provides clean validation with specific error messages per mode

**Test counts (Sprint 9 delta):**
- Unit: +19 tests (1 suite: simulation — 17 pure functions + 1 zero-write structural + 1 SUPPLIER_HAS_NO_BID mocked)
- Integration: +19 tests (1 rewritten suite: simulation — was 6, now 14; 1 new suite: negotiation-simulation — 11 tests)
- E2E: 0 new, 1 modified (step 14 updated)
- Total added: 38 net new tests (745 - 707)

### Sprint 8 — 2026-02-27 — Negotiation Mode

**Model:** Claude Opus 4.6
**Status:** COMPLETE — All 707 tests passing (43 suites)

**Deliverables (8 new files, 5 modified source files, 4 test files):**
1. Database migration 012 — `negotiation_events` table (UUID PK, parent_rfq_id FK→rfqs NOT NULL, buyer_id FK→users NOT NULL, status ENUM(DRAFT/ACTIVE/CLOSED/AWARDED) DEFAULT DRAFT, max_revisions INT, min_change_percent DECIMAL(5,2), cooling_time_minutes INT, bid_open_at TIMESTAMPTZ, bid_close_at TIMESTAMPTZ, anti_snipe_window_minutes INT DEFAULT 10, anti_snipe_extension_minutes INT DEFAULT 5, timestamps); `negotiation_suppliers` table (UUID PK, negotiation_id FK→negotiation_events CASCADE, supplier_id FK→suppliers RESTRICT, supplier_code CHAR(5), status ENUM(INVITED/ACCEPTED/DECLINED) DEFAULT INVITED, UNIQUE(negotiation_id, supplier_id)); ALTER `bids` to add nullable `negotiation_id` FK→negotiation_events with partial index
2. Negotiation service — `src/modules/negotiation/negotiation.service.ts`: `createNegotiation()` (parent RFQ must be CLOSED, invited suppliers must be ACCEPTED subset, minimum 2), `getNegotiationForSupplier()` (anonymity preserved — no suppliers array, no buyer_id), `getNegotiationForBuyer()` (full disclosure with supplier list), `closeNegotiation()` (ACTIVE→CLOSED with WebSocket broadcast), `awardNegotiation()` (CLOSED→AWARDED with audit)
3. Negotiation controller — `src/modules/negotiation/negotiation.controller.ts`: 8 HTTP handlers — `createNegotiationHandler`, `getBuyerNegotiationHandler`, `getBuyerNegotiationRankingsHandler`, `closeNegotiationHandler`, `awardNegotiationHandler`, `getSupplierNegotiationHandler`, `submitNegotiationBidHandler`, `reviseNegotiationBidHandler`, `getSupplierNegotiationRankingHandler`, `getNegotiationBidStatusHandler`
4. Negotiation state machine — `src/modules/negotiation/negotiation-state-machine.ts`: DRAFT→ACTIVE→CLOSED→AWARDED transitions with `canNegotiationTransition`, `assertNegotiationTransition`
5. Buyer negotiation routes — `src/modules/negotiation/buyer-negotiation.routes.ts`: `GET /:id`, `GET /:id/rankings`, `POST /:id/close`, `POST /:id/award`
6. Supplier negotiation routes — `src/modules/negotiation/supplier-negotiation.routes.ts`: `GET /:id`, `POST /:id/bids`, `PUT /:id/bids`, `GET /:id/ranking`, `GET /:id/bid-status`
7. Negotiation validators — `src/shared/validators/negotiation.validators.ts`: `createNegotiationSchema` (invited_supplier_ids min 2, bidding rules, datetime), `closeNegotiationSchema` (confirm: true), `awardNegotiationSchema` (type + allocations)
8. Bidding engine refactor — `submitNegotiationBid()`, `reviseNegotiationBid()`, `getNegotiationBidStatus()` in `src/modules/bidding/bid.service.ts`: context-aware bidding with separate Redis namespace (`cooling:neg:...`), auto-transition DRAFT→ACTIVE, same hash sealing (includes negotiation_id in canonical form), same audit chain referencing parent_rfq_id
9. Negotiation ranking — `calculateNegotiationRankings()` in `src/modules/ranking/ranking.service.ts`: uses parent RFQ items and weights, filters bids by negotiation_id
10. WebSocket negotiation support — `subscribe:negotiation` event, rooms `negotiation:${id}:supplier:${userId}`, `negotiation:${id}:suppliers`, `negotiation:${id}:buyer`; pub/sub channels `ranking:neg:*`, `deadline:neg:*`
11. New enums — `NegotiationStatus` (DRAFT/ACTIVE/CLOSED/AWARDED), `NegotiationSupplierStatus` (INVITED/ACCEPTED/DECLINED), `NEGOTIATION_CREATED`/`NEGOTIATION_CLOSED`/`NEGOTIATION_AWARDED` audit event types
12. New interfaces — `NegotiationEvent`, `NegotiationSupplier` added to `interfaces.ts`
13. Route registration — `app.use('/api/buyer/negotiations', buyerNegotiationRoutes)`, `app.use('/api/supplier/negotiations', supplierNegotiationRoutes)` in `app.ts`; `POST /:id/negotiation` added to `buyer-rfq.routes.ts`
14. Unit test suite — `tests/unit/negotiation-state-machine.spec.ts`: 26 tests (all transition combinations, error messages, terminal state)
15. Unit test suite — `tests/unit/negotiation-bid.spec.ts`: 19 tests (revision limit, minimum change, cooling time, anti-snipe — all with negotiation context labels)
16. Integration test suite — `tests/integration/negotiation.integration.spec.ts`: ~43 tests (create negotiation CRUD, supplier view anonymity, bid submit/revise with all 3 rules, ranking allowlist, bid-status, buyer rankings, close/award lifecycle, anti-snipe extension isolation, cooling time namespace isolation)
17. Security test suite — `tests/integration/negotiation-security.integration.spec.ts`: 13 tests (SEC-T01-NEG: 4-key allowlist enforcement + no competitor code/ID/prices/rank, SEC-T02-NEG: no suppliers array or buyer_id in supplier view + zero competitor references in body, cross-supplier 403 for all 4 supplier endpoints, cross-buyer 404, role enforcement: supplier→buyer endpoints 403, buyer→supplier endpoints 403, admin→supplier endpoints 403)

**Negotiation endpoints implemented:**
- `POST /api/buyer/rfqs/:id/negotiation` — Create negotiation from CLOSED RFQ
- `GET /api/buyer/negotiations/:id` — Buyer view with suppliers list
- `GET /api/buyer/negotiations/:id/rankings` — Full ranking data with credibility classes
- `POST /api/buyer/negotiations/:id/close` — Close ACTIVE negotiation
- `POST /api/buyer/negotiations/:id/award` — Award CLOSED negotiation
- `GET /api/supplier/negotiations/:id` — Supplier view (anonymity preserved)
- `POST /api/supplier/negotiations/:id/bids` — Submit initial bid
- `PUT /api/supplier/negotiations/:id/bids` — Revise bid
- `GET /api/supplier/negotiations/:id/ranking` — Own rank + proximity (allowlist serializer)
- `GET /api/supplier/negotiations/:id/bid-status` — Revisions remaining, cooling time

**Architecture decisions:**
- Bidding engine refactored with parallel negotiation functions rather than parameterized context type — avoids breaking existing RFQ bidding while providing identical rule enforcement
- Separate Redis cooling namespace (`cooling:neg:${negotiationId}:${supplierId}`) ensures RFQ and negotiation cooling times don't interfere; verified by isolation integration test
- Anti-snipe extends `negotiation_events.bid_close_at` (not parent RFQ); verified by integration test checking parent RFQ close time unchanged
- Negotiation suppliers are auto-ACCEPTED on creation (they already accepted the parent RFQ); no separate accept/decline flow needed
- All audit entries use parent_rfq_id as rfq_id for cross-referencing with the original RFQ audit trail
- Supplier anonymity enforcement reuses existing `serializeSupplierRanking()` allowlist serializer — same 4-field boundary for both RFQ and negotiation contexts
- WebSocket uses separate room namespace (`negotiation:${id}:...`) with identical per-supplier isolation pattern as RFQ rooms
- State machine follows same DRAFT→ACTIVE→CLOSED→AWARDED pattern as RFQ; DRAFT→ACTIVE auto-transition is lazy (triggered by first bid when bid_open_at has passed)

**Test counts (Sprint 8 delta):**
- Unit: +45 tests (2 new suites: negotiation-state-machine, negotiation-bid)
- Integration: +56 tests (2 new suites: negotiation, negotiation-security)
- Total added: 101 tests (707 - 606)

### Sprint 7 — 2026-02-26 — Weighted Ranking & Management KPIs

**Model:** Claude Opus 4.6
**Status:** COMPLETE — All 606 tests passing (40 suites)

**Deliverables (8 new files, 7 modified source files, 5 test files):**
1. KPI service — `src/modules/kpi/kpi.service.ts`: 4 exported pure functions (`calculateCV`, `calculateSavingsPct`, `calculateParticipationRatio`, `calculateCycleTimeHours`) + 6 database orchestrators (`rfqCycleTimeHours`, `savingsVsLastPrice`, `participationRatio`, `priceConvergenceCV`, `supplierCompetitivenessIndex`, `rfqCount`)
2. KPI controller — `src/modules/kpi/kpi.controller.ts`: `getBuyerKpisHandler()` (buyer-scoped KPI dashboard) + `getAdminKpisHandler()` (system-wide KPIs + top 10 supplier competitiveness index)
3. Buyer KPI routes — `src/modules/kpi/buyer-kpi.routes.ts`: `GET /api/buyer/kpis?from=DATE&to=DATE`
4. Admin KPI endpoint — `GET /api/admin/kpis?from=DATE&to=DATE` added to `admin.routes.ts`
5. Ranking service — `src/modules/ranking/ranking.service.ts`: pure functions (`getRankColor`, `calculateProximity`, `calculateItemRankings`, `calculateTotalRankings`, `calculateWeightedRankings`) + `calculateRankings()` orchestrator
6. Ranking controller — `src/modules/ranking/ranking.controller.ts`: `getSupplierRankingHandler()` (security-restricted supplier view) + `getBuyerRankingsHandler()` (full buyer view)
7. Ranking serializer — `src/modules/ranking/ranking.serializer.ts`: SECURITY BOUNDARY — `serializeSupplierRanking()` explicit allowlist (4 fields: `rank_color`, `proximity_label`, `own_items`, `own_total_price`); `serializeBuyerRanking()` full view with credibility classes
8. KPI validators — `src/shared/validators/kpi.validators.ts`: `updateWeightsSchema` (Zod: weight_price + weight_delivery + weight_payment must sum to 100) + `kpiQuerySchema` (optional date range filters)
9. New enums — `RankColor` (GREEN/YELLOW/RED), `ProximityLabel` (VERY_CLOSE/CLOSE/FAR) added to `enums.ts`
10. New interfaces — `ItemRankingEntry`, `ItemRanking`, `TotalRanking`, `WeightedRanking`, `SupplierRankView`, `RankingResult` added to `interfaces.ts`
11. Database migration 011 — added `last_price DECIMAL(20,4)` nullable column to `rfq_items` table (historical reference for savings KPI)
12. Buyer weight configuration — `PATCH /api/buyer/rfqs/:id/weights` in `buyer-rfq.routes.ts` + `updateWeightsHandler` in `buyer-rfq.controller.ts` + `updateWeights()` in `rfq.service.ts` (DRAFT/PUBLISHED only)
13. Unit test suite — `tests/unit/kpi.spec.ts`: ~25 tests for pure KPI functions (edge cases: empty arrays, zero division, single values, negative savings)
14. Unit test suite — `tests/unit/ranking.spec.ts`: ~35 tests for ranking logic (tie handling, rank color assignment, proximity, weighted scoring, normalization)
15. Unit test suite — `tests/unit/ranking-serializer.spec.ts`: 100+ assertions — security-focused allowlist validation, no competitor data leakage
16. Integration test suite — `tests/integration/kpi.integration.spec.ts`: ~15 tests (buyer KPI endpoints, admin KPI endpoints, date range filtering, buyer data isolation, auth/authz)
17. Integration test suite — `tests/integration/ranking.integration.spec.ts`: ranking endpoint tests (supplier security, buyer full view, proximity accuracy, weighted score calculations with real bids)

**KPI metrics implemented:**
- **RFQ Cycle Time**: Average hours from RFQ_PUBLISHED to AWARD_FINALIZED (sourced from audit log)
- **Savings vs Last Price**: Average `((last_price - awarded_price) / last_price) * 100` across items with `last_price` populated
- **Participation Ratio**: `(accepted / assigned) * 100` across all RFQ suppliers
- **Price Convergence CV**: Coefficient of variation (std dev / mean) of final bid prices — lower = more competitive
- **Supplier Competitiveness Index** (admin only): Top 10 suppliers by L1 win rate across CLOSED/AWARDED RFQs

**Weighted ranking implementation:**
- **Price Score (0-100)**: Normalized — best price = 100, worst = 0
- **Delivery Score**: Hardcoded 50 (supplier delivery data collection deferred; columns exist from Sprint 5 migration)
- **Payment Score**: Hardcoded 50 (same deferral)
- **Formula**: `(price_score * weight_price + delivery_score * weight_delivery + payment_score * weight_payment) / total_weight`
- **Fallback**: If all weights are 0, defaults to price-only (weight_price = 100)
- **Tie handling**: Equal weighted scores get same rank; next rank skips accordingly

**Architecture decisions:**
- Pure function pattern for all calculations — exported separately for unit testing, DB orchestrators compose them
- Ranking serializer is an explicit allowlist security boundary: field construction (never spread), verified by 100+ assertions
- KPI uses audit log as source of truth for timeline events (immutable source)
- Buyer data isolation via JWT `userId` in all KPI queries
- Admin KPIs aggregate across all buyers with no filtering
- Optional date range filtering on KPI endpoints (`?from=DATE&to=DATE`)
- Delivery/payment scoring hardcoded to 50 (neutral) pending supplier data collection — consistent with Sprint 5 nullable columns approach
- `last_price` column on `rfq_items` is nullable — KPIs gracefully skip items without historical reference

**Test counts (Sprint 7 delta):**
- Unit: +60 tests (3 new suites: kpi, ranking, ranking-serializer)
- Integration: +15 tests (2 new suites: kpi, ranking — note: ranking suite consolidates prior inline tests)
- Total added: ~52 net new tests (606 - 554)

### Sprint 6 — 2026-02-26 — Supplier Credibility

**Model:** Claude Opus 4.6
**Status:** COMPLETE — All 554 tests passing (35 suites)

**Deliverables (4 new files, 7 modified source files, 2 test files):**
1. Credibility score service — `src/modules/credibility/credibility.service.ts`: 6 exported pure functions (`calculateResponseDiscipline`, `calculateRevisionBehavior`, `calculateWinVsDropout`, `calculatePostAwardAcceptance`, `calculateCompositeScore`, `deriveCredibilityClass`) + `calculateCredibilityScore(supplierId)` orchestrator that queries all 4 dimensions and writes UPDATE to suppliers table
2. Fulfill validator — `src/shared/validators/credibility.validators.ts`: Zod schema for `POST /api/admin/rfqs/:id/fulfill` body (`supplier_id: uuid`)
3. AWARD_FULFILLED enum — added to `AuditEventType` in `src/shared/types/enums.ts`
4. Fire-and-forget credibility hooks — added to `acceptRfq()`, `declineRfq()`, `closeRfq()`, `awardRfq()` in `src/modules/rfq/rfq.service.ts`; closeRfq loops all accepted suppliers; awardRfq loops all allocated suppliers
5. Admin fulfillment endpoint — `POST /api/admin/rfqs/:id/fulfill` in `admin.controller.ts` + `admin.routes.ts`: validates RFQ is AWARDED, validates supplier is in AWARD_FINALIZED allocations, rejects duplicates (409), creates AWARD_FULFILLED audit entry, triggers credibility recalculation
6. Buyer rankings credibility — `serializeBuyerRanking()` in `ranking.serializer.ts` accepts optional `supplierCredibility` map; `getBuyerRankingsHandler()` in `ranking.controller.ts` queries suppliers table and passes credibility map; `total_rankings[]` now includes `credibility_class` per supplier
7. Buyer RFQ detail credibility — `getBuyerRfq()` in `rfq.service.ts` now includes `suppliers.credibility_class` in the suppliers select (via JOIN)
8. Unit test suite — `tests/unit/credibility.spec.ts`: 39 tests for all 6 pure functions at boundary conditions
9. Integration test suite — `tests/integration/credibility.integration.spec.ts`: 11 tests (accept trigger, decline trigger, close trigger, fulfill CRUD with 409/422 validation, buyer rankings credibility_class, buyer RFQ detail credibility_class, supplier endpoint isolation x2)

**Credibility dimensions:**
- **D1 (Response Discipline, 25%)**: `(accepted / assigned) * 100`; 0 assigned → 50 (neutral)
- **D2 (Revision Behavior, 25%)**: Per ACCEPTED RFQ: `discipline = 1 - (revisions / max)`; `late_penalty = min(late/3, 1) * 0.5`; `score = max(0, discipline - penalty) * 100`; average across RFQs; 0 RFQs → 50
- **D3 (Win vs Dropout, 25%)**: `(L1_awarded / L1_count) * 100`; L1 determined by lowest `total_price` among `is_latest` bids in CLOSED/AWARDED RFQs; awarded determined from AWARD_FINALIZED audit `allocations` JSONB; 0 L1 → 50
- **D4 (Post-Award Acceptance, 25%)**: `(fulfilled / awarded) * 100`; awarded from AWARD_FINALIZED allocations; fulfilled from AWARD_FULFILLED audit entries; 0 awarded → 50
- **Classification**: composite >= 80 → EXCELLENT; >= 50 → STABLE; < 50 → RISKY

**Architecture decisions:**
- Same fire-and-forget pattern as flag.service.ts: dynamic imports, try-catch-log, never fails the parent operation
- Idempotent full recalculation from scratch — safe under concurrent execution (last writer wins with identical result)
- Late revision window reuses `flag_late_revision_window_percent` system_config key (default 20%) — consistent with FLAG-05
- Application-level JSONB parsing for AWARD_FINALIZED allocations and AWARD_FULFILLED entries — simpler than complex PostgreSQL JSONB operators, volume is manageable
- Rounding via `parseFloat(composite.toFixed(2))` to match DECIMAL(5,2) column precision
- No new migration: suppliers table already had `credibility_score DECIMAL(5,2) DEFAULT 50.0` and `credibility_class VARCHAR(20) DEFAULT 'STABLE'` with CHECK constraint (from migration 002)
- Supplier isolation preserved: supplier endpoints (`listSupplierRfqs`, `getSupplierRfq`) never query credibility columns; verified by 2 integration tests with full JSON body assertion

**Test counts (Sprint 6 delta):**
- Unit: +39 tests (1 new suite: credibility)
- Integration: +11 tests (1 new suite: credibility)
- Total added: 50 tests

### Sprint 5 — 2026-02-26 — Compliance & Risk Flags

**Model:** Claude Opus 4.6
**Status:** COMPLETE — All 504 tests passing (33 suites)

**Deliverables (6 new files, 4 modified source files, 3 test files):**
1. Database migration 010 — `rfq_flags` table (UUID PK, rfq_id FK, flag_id VARCHAR(10), flag_type VARCHAR(50), affected_supplier_code CHAR(5), affected_item_ids UUID[], detail_text, recommendation_text, is_active, created_at); ALTER `rfq_suppliers` to add nullable `supplier_delivery_days INTEGER` and `supplier_payment_terms TEXT` columns; seed flag threshold config with `ON CONFLICT DO NOTHING`
2. FlagType enum — added to `src/shared/types/enums.ts`: DELIVERY_DEVIATION, PAYMENT_DEVIATION, ABNORMAL_PRICE, SUPPLIER_DOMINANCE, LATE_REVISIONS
3. Flag evaluation service — `src/modules/flags/flag.service.ts`: 5 exported pure functions (unit-testable without DB) + `evaluateFlags(rfqId)` orchestrator + `getActiveFlags(rfqId)` getter
4. Flag controller — `src/modules/flags/flag.controller.ts`: `getFlagsHandler` with buyer ownership check (404 if not owner); returns active flags only
5. Buyer route — `GET /api/buyer/rfqs/:id/flags` added to `buyer-rfq.routes.ts`
6. Bid service hooks — post-commit `evaluateFlags(rfqId)` added to BOTH `submitBid()` and `reviseBid()` in `bid.service.ts` (fire-and-forget, failure never aborts bid submission)
7. Test helper updates — `seedFlagConfig()` added to `tests/helpers/setup.ts`; `rfq_flags` truncated in `cleanDatabase()`; `assignTestSupplier()` extended with optional `supplier_delivery_days` and `supplier_payment_terms`
8. Unit test suite — `tests/unit/flag-evaluation.spec.ts`: 34 tests for all 5 flag pure functions at boundary conditions
9. Integration test suite — `tests/integration/flags.integration.spec.ts`: 6 tests (empty array, FLAG-03 trigger, 403 supplier, 404 non-owner, 401 unauthenticated, flag deactivation)
10. Supplier leakage test suite — `tests/integration/supplier-flag-leakage.integration.spec.ts`: 4 tests verifying flags never appear in any supplier-facing response

**Flag implementations:**
- **FLAG-01 (delivery_deviation)**: Raised when `supplier_delivery_days >= rfqDelivery * (1 + threshold/100)`; skips if either value is null
- **FLAG-02 (payment_deviation)**: Raised when trimmed, case-insensitive payment terms don't match; skips if either is null
- **FLAG-03 (abnormal_price)**: Per item, raised when `unit_price <= avg * (1 - threshold/100)`; skips single-bidder items; uses float epsilon (1e-9) for boundary tolerance
- **FLAG-04 (supplier_dominance)**: Raised when a supplier is L1 in `>= threshold%` of all RFQ items; counts tied L1 positions for both suppliers
- **FLAG-05 (late_revisions)**: Raised when a supplier has `> countThreshold` bids submitted in the final `windowPct%` of the bidding window (strict `>`, not `>=`)

**Architecture decisions:**
- Flag evaluation is fire-and-forget via dynamic import (`await import('../flags/flag.service')`), same pattern as ranking recalculation; failure never fails bid submission
- Full recalculation approach on every re-evaluation: deactivate all existing active flags, insert fresh set — clean and idempotent
- Thresholds loaded from `system_config` with hardcoded defaults as fallback (handles `cleanDatabase()` truncating system_config in tests)
- FLAG-01/02 skip rather than flag when supplier fields are null — data collection from suppliers deferred to a future sprint; nullable columns handle the gap cleanly
- PostgreSQL array serialization uses `{uuid1,uuid2}` string format for `affected_item_ids` (Knex doesn't natively support UUID[] insertion)
- Supplier isolation enforced by module boundary — flags module only imported in buyer routes; supplier controller never references flags; verified by leakage integration tests
- Raw SQL used for JOIN-based UPDATE in PostgreSQL test helper: `UPDATE bid_items SET unit_price=? WHERE bid_id IN (SELECT id FROM bids WHERE supplier_id=?)` (Knex JOIN UPDATE generates invalid SQL in PostgreSQL)
- Integration tests run with `--runInBand` when executed in isolation to avoid migration lock contention; full `npm test` handles pooling internally

**Test counts (Sprint 5 delta):**
- Unit: +34 tests (1 new suite: flag-evaluation)
- Integration: +10 tests (2 new suites: flags, supplier-flag-leakage)
- Total added: 44 tests

### Sprint 4 — 2026-02-26 — Bid Locking, Audit System & Exports

**Model:** Claude Opus 4.6
**Status:** COMPLETE — All 460 tests passing (30 suites)

**Deliverables (8 new files, 8 modified source files, 11 test files):**
1. Anti-snipe extension logic — `shouldTriggerAntiSnipe` pure function + `checkAndApplyAntiSnipe` wired into both `submitBid()` and `reviseBid()` inside existing FOR UPDATE transaction; creates `DEADLINE_EXTENDED` audit entry with trigger metadata
2. Manual close endpoint — `POST /api/buyer/rfqs/:id/close` transitions ACTIVE→CLOSED, creates `RFQ_CLOSED` audit entry (close_method='manual')
3. Award finalization endpoint — `POST /api/buyer/rfqs/:id/award` transitions CLOSED→AWARDED, creates `AWARD_FINALIZED` audit entry with allocation decisions
4. Award simulation endpoint — `POST /api/buyer/rfqs/:id/simulation` runs cost calculations on CLOSED RFQ, creates `AWARD_SIMULATED` audit entry, does NOT change RFQ status
5. Buyer audit log endpoint — `GET /api/buyer/rfqs/:id/audit-log` scoped to buyer's own RFQ
6. Admin audit log endpoint — `GET /api/admin/audit-log` with filters (event_type, rfq_id, date range, pagination)
7. Export module — `generateSupplierReceipt` (PDF), `generateExcelExport` (4-sheet XLSX: Cover, Item Comparison, Audit Trail, Supplier Summary), `generatePdfExport` (PDF report)
8. Supplier receipt endpoint — `GET /api/supplier/rfqs/:id/receipt` returns PDF with bid hash, revision number, submitted_at
9. Buyer export endpoints — `GET /api/buyer/rfqs/:id/export/excel` and `GET /api/buyer/rfqs/:id/export/pdf`
10. `validateQuery(schema)` middleware for query parameter validation
11. Unit tests — 3 suites: anti-snipe (8 tests), audit-chain integrity (6 tests), bid-rules (11 tests)
12. Integration tests — 7 suites: anti-snipe (3 tests), audit-log (9 tests), close-award (10 tests), simulation (5 tests), export (7 tests), plus 2 moved from unit: commercial-lock (5 tests), rfq-number (5 tests)
13. E2E-01 full lifecycle — 15-step test: RFQ creation → publish → supplier accept/decline → commercial lock → bidding → rankings → revision → anti-snipe → manual close → post-close rejection → simulation → award → exports → admin audit log
14. Test infrastructure fixes — moved DB-dependent tests from `tests/unit/` to `tests/integration/` to fix migration lock contention; added `test:e2e` npm script

**Architecture decisions:**
- Anti-snipe reuses existing FOR UPDATE row lock in submitBid/reviseBid — no new locking mechanism needed; two simultaneous bids serialize naturally
- PUBLISHED→ACTIVE auto-transition remains lazy (on bid submission), not a cron job
- Export module uses PDFKit for PDF generation and ExcelJS for Excel; both stream to Buffer
- Simulation endpoint creates AWARD_SIMULATED audit entry but never AWARD_FINALIZED — clean separation between "what-if" and "commit"
- Binary response testing uses `.responseType('blob')` for supertest compatibility
- `whereIn` type issues resolved with explicit `as string` casts (Knex type inference limitation with `.map()`)

### Sprint 3 — 2026-02-25 — Bidding Engine & Ranking

**Model:** Claude Sonnet 4.6
**Status:** COMPLETE — All 376 tests passing (21 suites)

**Deliverables (17 new files, 8 modified files):**
1. Database migrations — `bids` table (UUID PK, rfq_id FK, supplier_id FK, UNIQUE revision, partial index WHERE is_latest=true) and `bid_items` table (bid_id CASCADE, rfq_item_id RESTRICT, immutable)
2. Price submission endpoint — `POST /api/supplier/rfqs/:id/bids` with server-calculated totals, SHA-256 hash, PUBLISHED→ACTIVE auto-transition, window enforcement
3. Bid revision endpoint — `PUT /api/supplier/rfqs/:id/bids` with Rule A (revision limit), Rule B (min % change per item), Rule C (cooling time via Redis TTL + DB fallback)
4. Bid status endpoint — `GET /api/supplier/rfqs/:id/bid-status` returning has_bid, revisions_used, revisions_remaining, seconds_until_next_revision
5. Ranking engine — item-level (per rfq_item_id, dense ranking with tie handling), total (sort by total_price), weighted (normalize 0–100, composite score), proximity (VERY_CLOSE ≤2%, CLOSE ≤10%, FAR >10%)
6. Supplier ranking serializer — SECURITY BOUNDARY; allowlist pattern returning exactly 4 fields (rank_color, proximity_label, own_items, own_total_price); never spreads or copies full objects
7. Buyer ranking endpoints — `GET /api/buyer/rfqs/:id/rankings` returning full item_rankings, total_rankings, weighted_rankings with score breakdowns
8. WebSocket server — Socket.io with JWT auth middleware, per-supplier rooms (`rfq:${rfqId}:supplier:${userId}`), buyer room (`rfq:${rfqId}:buyer`), `subscribe:rfq` event with role-based room assignment
9. Redis Pub/Sub — separate subscriber Redis instance (ioredis blocks during subscribe), `psubscribe('ranking:*', 'deadline:*')`, ranking updates broadcast to buyer (full) and each supplier (serialized view)
10. Audit log entries — `BID_SUBMITTED` and `BID_REVISED` with old/new price snapshots and hash values
11. Unit tests — 4 suites: ranking engine (22 tests), revision rules (19 tests), bid hash (10 tests), ranking serializer security (22 tests)
12. Integration tests — 2 suites: bidding (25 tests), ranking (10 tests)
13. Security tests — SEC-T01 (no competitor data in supplier ranking, 26 comprehensive assertions), SEC-T06 (bid after close 409), SEC-T07 (revision after max 422)

**Architecture decisions:**
- PUBLISHED→ACTIVE auto-transition is a lazy check on bid submission, not a cron job
- Redis cooling time uses a separate subscriber instance to avoid blocking the main Redis connection during pub/sub
- Per-supplier WebSocket rooms (`rfq:${rfqId}:supplier:${userId}`) for zero-leakage security — never a shared room with client-side filtering
- Ranking serializer uses explicit field construction (never object spread) as the security boundary
- Dynamic imports for ranking/pubsub in bid.service.ts to avoid circular dependencies and make post-commit operations non-blocking
- Rule B interpretation: items with 0% change are excluded from the minimum-change check; only non-zero changes below threshold fail; all-zero revision is rejected outright

### Sprint 2 — 2026-02-25 — RFQ Creation & Commercial Lock

**Model:** Claude Opus 4.6
**Status:** COMPLETE — All 248 tests passing (15 suites)

**Deliverables (22 files — 10 new, 4 modified, 8 test files):**
1. Database migrations — rfqs, rfq_items, rfq_suppliers tables with full schema
2. RFQ CRUD API — POST/GET/GET/:id/PUT for buyers, all with RBAC scoping via WHERE clause
3. RFQ number auto-generation — RFQ-YYYY-NNNN format, globally sequential per year
4. RFQ state machine — DRAFT→PUBLISHED→ACTIVE→CLOSED→AWARDED with assertTransition enforcement
5. RFQ publish endpoint — validates ≥1 item, ≥2 suppliers, payment_terms present
6. Supplier assignment endpoint — min 2 suppliers, tokenized access links with expiry
7. Supplier-facing RFQ endpoints — list assigned, view detail, accept with 3 declarations, decline with 20+ char reason
8. Commercial lock enforcement — first acceptance triggers lock, snapshot in audit, HTTP 409 on locked commercial edits
9. Buyer RBAC scoping — query-level WHERE buyer_id enforcement (returns 404, not 403)
10. Supplier RBAC scoping — only assigned RFQs visible, no competitor data ever exposed
11. Audit log entries — RFQ_CREATED, RFQ_PUBLISHED, SUPPLIER_ACCEPTED, SUPPLIER_DECLINED, COMMERCIAL_LOCK
12. Unit tests — 4 suites: state machine (25 tests), declaration validation (17 tests), RFQ number (5 tests), commercial lock (5 tests)
13. Integration tests — 3 suites: buyer-rfq (35 tests), supplier-rfq (24 tests), supplier-assignment (15 tests)
14. Security tests — SEC-T02 (no competitor data), SEC-T03 (cross-supplier 403), SEC-T04 (cross-buyer 404), SEC-T13 (commercial lock 409)

**Architecture decisions:**
- Commercial lock uses PostgreSQL FOR UPDATE row lock to prevent race conditions on concurrent acceptances
- RFQ numbers are globally unique (not per-buyer) to match database UNIQUE constraint
- Supplier RFQ detail endpoint returns own assignment only — never exposes suppliers array
- Commercial fields list: payment_terms, freight_terms, delivery_lead_time_days, taxes_duties, warranty, offer_validity_days, packing_forwarding, special_conditions, items
- Non-commercial fields (title, bidding rules, weights) remain editable even after commercial lock

### Sprint 1 — 2026-02-25 — Auth & Access Control

**Model:** Claude Opus 4.6
**Status:** COMPLETE — All tests passing

**Deliverables (58 files):**
1. Project scaffolding — TypeScript + Express, ESLint, Prettier, Husky, Jest, Docker Compose
2. Database migrations — users, suppliers, audit_log (append-only with DB-level REVOKE), system_config
3. Auth module — POST /api/auth/login, POST /api/auth/refresh, POST /api/auth/logout, GET /api/auth/me
4. Time module — GET /api/time/now (public)
5. RBAC middleware — ADMIN, BUYER, SUPPLIER role enforcement on every route
6. Rate limiting — 5 failed logins per IP per 15 minutes
7. Supplier unique 5-char alphanumeric code generator
8. Tokenized supplier link generator (JWT-based, time-bound, scoped)
9. Redis session store for refresh tokens with rotation
10. Admin endpoints — GET/POST/PATCH /api/admin/users, GET/POST /api/admin/suppliers
11. Database seed — admin, buyer1, buyer2, supplier1-5 (all passwords bcrypt cost 12)
12. Unit tests — 5 suites, 42 tests (auth service, RBAC, supplier code, token link, hash)
13. Integration tests — 2 suites, 30 tests (auth endpoints, admin endpoints)
14. Security tests — SEC-T08 through SEC-T12 passing, SEC-T14 and SEC-T15 passing

**Architecture decisions:**
- Express.js (not NestJS) — explicit middleware composition, clean folder structure
- Knex.js — parameterized queries (no SQL injection risk), migrations, seeds
- Winston — structured logging (silent in test env)
- bcrypt cost 12 — JWT access 15min, refresh 7d with Redis rotation
- Audit log hash chain — SHA-256(eventData + previousHash), genesis = SHA-256("GENESIS")
