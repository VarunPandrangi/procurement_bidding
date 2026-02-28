# AGENT INSTRUCTIONS
## Procurement Competitive Enquiry & Bidding Platform
### Complete Build Guide · All Sprints · Windows PowerShell · Docker
### v3.0 — Chrome DevTools Testing Plan Included

---

> **PLACE THIS FILE:** Put `AGENT_INSTRUCTIONS.md` and `MASTER_EXECUTION_FILE.md` in your project root:
> ```
> procurement-platform/
> ├── AGENT_INSTRUCTIONS.md       ← this file
> ├── MASTER_EXECUTION_FILE.md    ← functional requirements & specs
> ├── PROGRESS.md                 ← your running build log
> ├── backend/
> └── frontend/
> ```
> When you type `@AGENT_INSTRUCTIONS.md` in your agent, it reads this file.
> When you type `@MASTER_EXECUTION_FILE.md`, it reads the spec.
> Always reference both in every prompt.

---

# TABLE OF CONTENTS

| Section | Content |
|---|---|
| [CURRENT STATUS](#current-status) | Where you are right now |
| [ENVIRONMENT SETUP](#environment-setup) | Docker, PowerShell, ports |
| [PART 1 — Phase 1 Backend](#part-1--phase-1-backend-sprints-14) | Sprints 1–4 (COMPLETE) |
| [PART 2 — Phase 2 Backend](#part-2--phase-2-backend-sprints-57) | Sprints 5–7 (COMPLETE) |
| [PART 3 — Phase 3 Backend](#part-3--phase-3-backend-sprints-810) | Sprints 8–10 (Sprint 8 IN PROGRESS) |
| [PART 4 — Frontend](#part-4--frontend) | Design System + 6 build prompts · Claude Opus 4.6 |
| [PART 5 — Chrome DevTools Testing](#part-5--chrome-devtools-mcp-testing-plan) | Post-build QA testing |
| [PART 6 — Bug Fix Library](#part-6--bug-fix-library) | Pre-written fixes for known problems |
| [PART 7 — Progress Tracking](#part-7--progress-tracking) | PROGRESS.md template |

---

# CURRENT STATUS

```
╔══════════════════════════════════════════════════════╗
║  YOU ARE HERE:  SPRINT 8 — Negotiation Mode          ║
║  Phase 3 Backend · Model: Claude Opus 4.6            ║
╚══════════════════════════════════════════════════════╝

Sprint 1   ✅ COMPLETE — Auth, RBAC, supplier codes, tokenized links
Sprint 2   ✅ COMPLETE — RFQ creation, commercial lock, supplier assignment
Sprint 3   ✅ COMPLETE — Bidding engine, ranking, WebSocket real-time
Sprint 4   ✅ COMPLETE — Auto-close, anti-sniping, audit hash chain, exports
Sprint 5   ✅ COMPLETE — Compliance flags (FLAG-01 to FLAG-05)
Sprint 6   ✅ COMPLETE — Supplier credibility scoring system
Sprint 7   ✅ COMPLETE — Weighted ranking, KPI dashboard
Sprint 8   🔄 IN PROGRESS — Negotiation mode
Sprint 9   ⏳ NEXT — Award simulation engine (full modes)
Sprint 10  ⏳ UPCOMING — Governance hardening + production readiness
Frontend   ⏳ AFTER SPRINT 10 — Full React UI with Apple design system
Testing    ⏳ AFTER FRONTEND — Chrome DevTools MCP QA plan
```

---

# ENVIRONMENT SETUP

## Your Environment (do not change)
```
OS: Windows
Shell: PowerShell
Project root: C:\Users\pandr\procurement-platform\
Backend: C:\Users\pandr\procurement-platform\backend\
Frontend: C:\Users\pandr\procurement-platform\frontend\

Docker containers (all must be Running before integration tests):
  procurement-postgres      → localhost:5432  (main database)
  procurement-postgres-test → localhost:5433  (test database — integration tests use this)
  procurement-redis         → localhost:6379  (Redis)
```

## Start Docker (do this every session)
```powershell
cd C:\Users\pandr\procurement-platform\backend
docker-compose up -d
```

Expected output:
```
✔ Container procurement-redis         Running
✔ Container procurement-postgres-test Running
✔ Container procurement-postgres      Running
```

## Windows PowerShell Rules (never break these)
```
✅ DO:   cross-env NODE_ENV=test jest
✅ DO:   npm run test:unit
❌ DON'T: NODE_ENV=test npm run test   (bash syntax, fails on Windows)
❌ DON'T: export NODE_ENV=test          (bash syntax)
```

## Test Commands
```powershell
# Unit tests only (no Docker needed)
npm run test:unit

# Integration tests (Docker must be running first)
npm run test:integration

# Security tests
npm run test:security

# E2E tests
npm run test:e2e

# Everything
npm test
```

## If ECONNREFUSED during tests
1. Start Docker Desktop from taskbar
2. Run `docker-compose up -d`
3. Wait 10 seconds
4. Retry tests

---

# PART 1 — PHASE 1 BACKEND (SPRINTS 1–4)
## Model: Claude Opus 4.6
## Status: ALL COMPLETE ✅

---

## SPRINT 1 — COMPLETE ✅
**Auth, RBAC, Supplier Codes, Tokenized Links**

What was built:
- JWT authentication (access 15min + refresh 7-day, HttpOnly cookie, Redis-backed)
- Refresh token rotation — each use invalidates old token, issues new
- bcrypt password hashing, cost factor 12
- RBAC middleware enforcing ADMIN / BUYER / SUPPLIER on every endpoint
- Supplier unique 5-character alphanumeric code (auto-generated on account creation)
- Time-bound, single-session tokenized RFQ link for suppliers
- Rate limiting on auth: 5 attempts per 15 min per IP, then 429
- `/api/time/now` endpoint returning server UTC (used by frontend for clock sync)
- `users`, `suppliers`, `audit_log` migrations
- All SEC-T08, SEC-T09, SEC-T10, SEC-T11 tests

---

## SPRINT 2 — COMPLETE ✅
**RFQ Creation, Commercial Lock, Supplier Assignment**

What was built:
- RFQ CRUD with state machine: DRAFT → PUBLISHED → ACTIVE → CLOSED → AWARDED
- RFQ number generation: `RFQ-YYYY-NNNN` (sequential per buyer per year)
- Item table with buyer-defined fields (description, spec, UOM, qty)
- Commercial terms (8 structured fields)
- Bidding rules per RFQ (max_revisions, min_change_percent, cooling_time, timestamps, anti-snipe)
- Commercial lock: first acceptance freezes item table + commercial terms → 409 on any further edit
- Lock event recorded in audit log with snapshot of locked terms
- Supplier assignment with tokenized link generation per supplier per RFQ
- `rfqs`, `rfq_items`, `rfq_suppliers` migrations
- SEC-T13 test (commercial lock enforcement)

---

## SPRINT 3 — COMPLETE ✅
**Bidding Engine, Ranking, Real-Time WebSocket**

What was built:
- Bid submission endpoint with ALL rule enforcement server-side:
  - Rule A: revision count < max_revisions
  - Rule B: |new-old|/old ≥ min_change_percent per item
  - Rule C: cooling time elapsed (stored in Redis per supplier per RFQ)
  - Bid window enforcement (not before bid_open_at, not after bid_close_at)
  - All items required in one submission (no partial bids)
- SHA-256 hash sealing of each bid submission
- Item-level ranking engine (L1/L2/L3+ with tie handling)
- Total RFQ ranking engine
- Weighted ranking engine (when weights configured)
- Proximity signal per supplier: Very Close ≤2% / Close ≤10% / Far >10% from L1
- Supplier response ALLOWLIST serializer — structurally prevents any competitor data
- Socket.io server: suppliers subscribe to RFQ rooms, receive rank updates for themselves only
- Buyer WebSocket channel: full ranking data with supplier codes
- `bids`, `bid_items` migrations
- SEC-T01, SEC-T02, SEC-T03, SEC-T04, SEC-T05 tests

---

## SPRINT 4 — COMPLETE ✅
**Bid Locking, Audit Hash Chain, Excel/PDF Exports**

What was built:
- node-cron scheduler: auto-closes RFQs at `bid_close_at`, broadcasts `rfq:closed`
- Manual close endpoint: `POST /api/buyer/rfqs/:id/close`
- Anti-sniping with SELECT FOR UPDATE: race condition safe, extends once even if two suppliers submit simultaneously
- Anti-snipe broadcasts via Redis Pub/Sub → WebSocket `rfq:deadline_extended`
- Complete audit log with all event types (USER_CREATED through AWARD_FULFILLED)
- SHA-256 hash chain: each entry includes previous entry's hash
- Genesis hash: `SHA-256("GENESIS")` for first entry
- `verifyAuditChain(rfqId)` utility function
- Supplier confirmation receipt PDF (PDFKit)
- Award simulation endpoint: pure calculation, zero DB writes, zero audit entries
- Award finalization endpoint: sets AWARDED status, records AWARD_FINALIZED
- Excel export (4 sheets: Cover, Item Comparison, Audit Trail, Supplier Summary)
- PDF export with page footer containing final audit chain hash
- SEC-T06, SEC-T07, SEC-T12 tests, E2E-01 full lifecycle

---

## SPRINT 4 PROMPT — For Reference
*Sprint 4 is complete. This prompt is kept for reference only.*

```
Read @MASTER_EXECUTION_FILE.md and @PROGRESS.md before writing any code.

You are the PRIMARY SYSTEM BUILDER defined in Section 16 of the master file.
Sprints 1, 2, and 3 are complete. We are now building Sprint 4.

ENVIRONMENT: Windows, Docker running.
PostgreSQL main: localhost:5432, test: localhost:5433, Redis: localhost:6379.
Use cross-env in npm scripts. Integration tests use port 5433.
Unit tests have zero DB dependency.
A .env.test must exist with:
  DATABASE_URL=postgresql://postgres:postgres@localhost:5433/procurement_test
  REDIS_URL=redis://localhost:6379/1
  NODE_ENV=test

Sprint 4 scope: Section 11 "SPRINT 4" in master file. FR: Section 6 FR-07, FR-08, FR-09.

Deliver:

1. Automatic bid close scheduler (node-cron):
   Check every minute for RFQs where bid_close_at < NOW() and status = ACTIVE.
   For each: set status = CLOSED, record RFQ_CLOSED (close_method: scheduled),
   broadcast rfq:closed WebSocket event.

2. Manual close: POST /api/buyer/rfqs/:id/close
   Buyer-owned RFQ only. Must be ACTIVE. Sets CLOSED, audit entry, WebSocket broadcast.

3. Anti-sniping (race-condition safe):
   After every bid: if (bid_close_at - now) <= anti_snipe_window_minutes:
   Use SELECT FOR UPDATE on rfq row. Re-read inside transaction.
   Extend bid_close_at += anti_snipe_extension_minutes.
   Record DEADLINE_EXTENDED. Publish Redis rfq:{id}:events { type: DEADLINE_EXTENDED, new_close_at }.
   WebSocket gateway subscribes and emits rfq:deadline_extended to all clients.

4. Complete audit log — all FR-08.1 event types from Section 6.
   Hash chain: SHA-256(JSON.stringify(event_data) + previous_entry_hash).
   First entry: previous_hash = SHA-256("GENESIS").
   Implement verifyAuditChain(rfqId): Promise<{ valid: boolean, brokenAtEntryId: string|null }>

5. Supplier receipt PDF (PDFKit):
   GET /api/supplier/rfqs/:id/receipt?revision=N
   Contains: platform name, RFQ number, supplier code (own), revision number, UTC timestamp, SHA-256 hash.

6. Simulation: POST /api/buyer/rfqs/:id/simulation
   Mode: single_supplier or item_split. Zero DB writes. Zero audit entries.
   Returns: total_procurement_cost, delivery_outcome_days, unique_supplier_count,
   delta_vs_l1_total, per_supplier_breakdown.

7. Award: POST /api/buyer/rfqs/:id/award
   RFQ must be CLOSED. Sets AWARDED. Records AWARD_FINALIZED. Irreversible.

8. Excel export (ExcelJS): GET /api/buyer/rfqs/:id/export/excel
   4 sheets: Cover, Item Comparison (prices revealed post-close), Audit Trail, Supplier Summary.

9. PDF export: GET /api/buyer/rfqs/:id/export/pdf
   Same content. Footer: Hash Reference: [final audit chain hash].

10. Audit log query endpoints:
    GET /api/buyer/rfqs/:id/audit-log?page=1&limit=50
    GET /api/admin/audit-log?rfq_id=&event_type=&from=&to=&page=&limit=

Unit tests (zero DB): anti-snipe boundary conditions, hash chain generation and verification,
Excel buffer structure, simulation zero-write assertion.

Integration tests (Docker port 5433): manual close → submission rejected, anti-snipe extension
confirmed in DB, audit DELETE rejected (SEC-T12), simulation then award workflow, Excel export
Content-Type header, supplier receipt PDF Content-Type.

npm scripts (Windows-compatible with cross-env):
"test": "jest"
"test:unit": "cross-env NODE_ENV=test jest --testPathPattern=unit"
"test:integration": "cross-env NODE_ENV=test jest --testPathPattern=integration"
"test:security": "cross-env NODE_ENV=test jest --testPathPattern=security"
"test:e2e": "cross-env NODE_ENV=test jest --testPathPattern=e2e"

When done: "Sprint 4 complete. Unit: X/X. Integration: X/X. E2E-01: pass/fail."
```

---

# PART 2 — PHASE 2 BACKEND (SPRINTS 5–7)
## Model: Claude Sonnet 4.6
## Status: ALL COMPLETE ✅

---

## SPRINT 5 — COMPLETE ✅
**Compliance & Risk Flags**

What was built:
- `rfq_flags` table migration
- Flag evaluation service (runs after every bid submission):
  - FLAG-01: Delivery deviation > threshold% from RFQ target
  - FLAG-02: Payment terms mismatch
  - FLAG-03: Abnormally low price (< average × (1 - threshold%))
  - FLAG-04: Supplier dominance (L1 on > threshold% of items)
  - FLAG-05: Late revisions (more than N revisions in final X% of bid window)
- Thresholds read from system_config table, not hardcoded
- `GET /api/buyer/rfqs/:id/flags` — buyer only
- Flags completely absent from all supplier-facing endpoints
- Integration test confirming supplier cannot access or see flags

---

## SPRINT 6 — COMPLETE ✅
**Supplier Credibility System**

What was built:
- 4-dimension credibility scoring (all equal weight 25%):
  - Dimension 1: Response Discipline — accepted/assigned ratio
  - Dimension 2: Revision Behavior — efficient vs. chaotic revision patterns
  - Dimension 3: Win vs. Dropout — L1 holds converted to awards
  - Dimension 4: Post-Award Acceptance — AWARD_FULFILLED / AWARD_FINALIZED
- Composite score → EXCELLENT (≥80) / STABLE (50–79) / RISKY (<50)
- Recalculated after: accept, decline, RFQ close, award finalization
- Admin fulfillment endpoint: `POST /api/admin/rfqs/:id/fulfill`
- Credibility visible to Buyer (supplier selection, rankings) and Admin
- Never visible in supplier-facing endpoints

---

## SPRINT 7 — COMPLETE ✅
**Weighted Ranking & Management KPIs**

What was built:
- Weight configuration: `PATCH /api/buyer/rfqs/:id/weights`
  - All three must be 0–100, must sum to exactly 100
  - Locked after ACTIVE state (409 if attempted)
- `last_price` per item (optional reference for savings calculation)
- KPI service with 5 metrics: cycle time, savings vs last price,
  participation ratio, price convergence CV, supplier competitiveness index
- `GET /api/buyer/kpis?from=DATE&to=DATE` (buyer-scoped)
- `GET /api/admin/kpis?from=DATE&to=DATE` (all buyers + supplier competitiveness)

---

## SPRINT 5 PROMPT — For Reference

```
Read @MASTER_EXECUTION_FILE.md and @PROGRESS.md before writing any code.
PRIMARY SYSTEM BUILDER — Section 16. Phase 1 complete. Building Sprint 5.

ENVIRONMENT: Windows, Docker running.
PostgreSQL main: localhost:5432, test: localhost:5433, Redis: localhost:6379.
cross-env in npm scripts. Integration tests use port 5433. Unit tests zero DB dependency.

Sprint 5 scope: Section 11 "SPRINT 5". FR: Section 6 FR-10.

Deliver:

1. Migration: rfq_flags table
   id UUID PK, rfq_id UUID FK NOT NULL, flag_id VARCHAR(10) NOT NULL,
   flag_type VARCHAR(50) NOT NULL, affected_supplier_code CHAR(5),
   affected_item_ids UUID[], detail_text TEXT NOT NULL,
   recommendation_text TEXT NOT NULL, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ.

2. Seed system_config keys (if not present):
   flag_delivery_deviation_pct = 20
   flag_abnormal_price_pct = 40
   flag_dominance_pct = 80
   flag_late_revision_count = 3
   flag_late_revision_window_pct = 20

3. Flag evaluation service (runs after every bid submission — async, non-blocking):
   FLAG-01 Delivery: supplier_delivery > rfq_target * (1 + threshold/100)
   FLAG-02 Payment: case-insensitive mismatch between supplier and RFQ payment terms
   FLAG-03 Abnormal Price: per item, if price < avg * (1 - threshold/100)
   FLAG-04 Dominance: supplier L1 on > threshold% of items
   FLAG-05 Late Revisions: revisions in final (threshold_pct)% of window > flag_late_revision_count
   After evaluation: set is_active=false on old flags, insert new active flags.

4. GET /api/buyer/rfqs/:id/flags — buyer only, returns is_active=true flags only.

5. Flags must never appear in any supplier endpoint.
   Integration test: trigger FLAG-03 → call GET /api/supplier/rfqs/:id and /ranking →
   assert neither response contains any flag-related key.

6. Unit tests (pure functions):
   Each flag: exactly at threshold boundary → raised.
   Each flag: one unit below boundary → not raised.
   FLAG-03: single bidder → no flag (no meaningful average).
   FLAG-04: two suppliers at 50% each, threshold=80% → no flag.

7. Integration tests (Docker port 5433):
   Empty flags endpoint → []. Submit bid triggering FLAG-03 → flag appears.
   Supplier GET /api/buyer/rfqs/:id/flags → 403.

When done: "Sprint 5 complete. Unit: X/X. Integration: X/X."
```

---

## SPRINT 6 PROMPT — For Reference

```
Read @MASTER_EXECUTION_FILE.md and @PROGRESS.md before writing any code.
PRIMARY SYSTEM BUILDER — Section 16. Sprint 5 complete. Building Sprint 6.

ENVIRONMENT: Windows, Docker running.
PostgreSQL main: localhost:5432, test: localhost:5433, Redis: localhost:6379.

Sprint 6 scope: Section 11 "SPRINT 6". FR: Section 6 FR-11.

Deliver:

1. Verify suppliers table has credibility_score DECIMAL(5,2) and
   credibility_class ENUM('EXCELLENT','STABLE','RISKY'). Add migration if missing.

2. calculateCredibilityScore(supplierId) service:
   D1 Response Discipline (25%): accepted/assigned * 100. Zero assigned = 50.
   D2 Revision Behavior (25%): per RFQ (1 - revisions_used/max_revisions) - late_penalty.
     late_penalty = min(late_revisions/3, 1) * 0.5. Average across RFQs. No RFQs = 50.
   D3 Win vs Dropout (25%): l1_awarded / l1_count * 100. No L1s = 50.
   D4 Post-Award (25%): fulfilled / awarded * 100. No awards = 50.
   composite = (D1+D2+D3+D4)/4.
   class = ≥80 EXCELLENT, ≥50 STABLE, <50 RISKY.
   UPDATE suppliers SET credibility_score, credibility_class.

3. Trigger recalculation after: accept, decline, RFQ→CLOSED (all accepted suppliers), award.

4. POST /api/admin/rfqs/:id/fulfill → AWARD_FULFILLED audit entry + recalculate.

5. Add credibility_class to: buyer rankings response, admin suppliers list, buyer supplier selection.
   Never in any supplier endpoint.
   Integration test: GET /api/supplier/rfqs and /rfqs/:id → assert no credibility field.

6. Unit tests: all scores 100 → EXCELLENT. All 50 → STABLE. All 0 → RISKY.
   Boundary: exactly 80.0 → EXCELLENT. 79.9 → STABLE. 50.0 → STABLE. 49.9 → RISKY.
   zero_assigned: D1 = 50 (neutral).

7. Integration tests (Docker port 5433):
   Create supplier → accept RFQ → verify credibility_score updated in DB.
   Decline → score reflects lower response discipline.

When done: "Sprint 6 complete. Unit: X/X. Integration: X/X."
```

---

## SPRINT 7 PROMPT — For Reference

```
Read @MASTER_EXECUTION_FILE.md and @PROGRESS.md before writing any code.
PRIMARY SYSTEM BUILDER — Section 16. Sprint 6 complete. Building Sprint 7.

ENVIRONMENT: Windows, Docker running.
PostgreSQL main: localhost:5432, test: localhost:5433, Redis: localhost:6379.

Sprint 7 scope: Section 11 "SPRINT 7". FR: Section 6 FR-11 weighted ranking, FR-07 KPIs.

Deliver:

1. PATCH /api/buyer/rfqs/:id/weights
   Body: { weight_price, weight_delivery, weight_payment } all 0–100, must sum to 100.
   422 WEIGHTS_MUST_SUM_TO_100 if not. 409 if RFQ status is ACTIVE or beyond.
   Ranking engine uses these weights (default weight_price=100 when all zero).

2. last_price DECIMAL(20,4) NULL added to rfq_items (migration).

3. KPI service:
   cycle_time_hours: AVG(EPOCH(award_at - published_at)/3600) from audit_log timestamps.
   savings_pct: AVG((reference_total - awarded_total)/reference_total*100) per RFQ with last_price.
   participation_ratio: AVG(accepted/assigned*100) per RFQ.
   price_convergence_cv: AVG(std_dev/mean*100) per RFQ with ≥2 bidders.
   supplier_competitiveness: (l1_count/bid_count*100) per supplier, top 10.

4. GET /api/buyer/kpis?from=DATE&to=DATE → buyer-scoped metrics.
   GET /api/admin/kpis?from=DATE&to=DATE → all buyers + supplier_competitiveness array.

5. Unit tests: weight {40,40,20} valid. {40,40,21} → error. savings math. CV math.
6. Integration tests: weight sum != 100 → 422. KPI shape correct. Buyer isolation.

When done: "Sprint 7 complete. Phase 2 backend complete. Unit: X/X. Integration: X/X."
```

---

# PART 3 — PHASE 3 BACKEND (SPRINTS 8–10)
## Model: Opus 4.6 (Sprints 8–9) / Sonnet 4.6 (Sprint 10)
## Status: Sprint 8 IN PROGRESS 🔄

---

## SPRINT 8 PROMPT — Negotiation Mode
## 🔄 YOU ARE HERE

**Before pasting this prompt:**
```powershell
docker-compose up -d
# Confirm all 3 containers are Running
```

**Model: Claude Opus 4.6**
**Open Agent / Composer mode. Copy everything inside this block:**

```
Read @MASTER_EXECUTION_FILE.md and @PROGRESS.md before writing any code.

You are the PRIMARY SYSTEM BUILDER defined in Section 16 of the master file.
Phases 1 and 2 are complete (Sprints 1–7). Building Sprint 8: Negotiation Mode.

ENVIRONMENT: Windows, Docker running.
PostgreSQL main: localhost:5432, test: localhost:5433, Redis: localhost:6379.
Use cross-env in all npm scripts. Integration tests connect to port 5433.
Unit tests must have zero DB or Redis dependency — mock everything.

Sprint 8 scope: Section 11 "SPRINT 8" in master file. FR: Section 6 FR-12.

WHAT NEGOTIATION MODE IS:
After an RFQ closes, the buyer may optionally invite a subset of the original
suppliers (top N by rank) to a private second round with new rules.
The same bidding engine, anonymity rules, and audit requirements apply.
Negotiation events are children of their parent RFQ and reference it in all audit entries.

Deliver:

1. MIGRATIONS:

   negotiation_events table:
   id UUID PK DEFAULT gen_random_uuid(),
   parent_rfq_id UUID REFERENCES rfqs(id) NOT NULL,
   buyer_id UUID REFERENCES users(id) NOT NULL,
   status ENUM('DRAFT','ACTIVE','CLOSED','AWARDED') DEFAULT 'DRAFT',
   max_revisions INT NOT NULL,
   min_change_percent DECIMAL(5,2) NOT NULL,
   cooling_time_minutes INT NOT NULL,
   bid_open_at TIMESTAMPTZ,
   bid_close_at TIMESTAMPTZ,
   anti_snipe_window_minutes INT DEFAULT 10,
   anti_snipe_extension_minutes INT DEFAULT 5,
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()

   negotiation_suppliers table:
   id UUID PK DEFAULT gen_random_uuid(),
   negotiation_id UUID REFERENCES negotiation_events(id) NOT NULL,
   supplier_id UUID REFERENCES users(id) NOT NULL,
   supplier_code CHAR(5) NOT NULL,
   status ENUM('INVITED','ACCEPTED','DECLINED') DEFAULT 'INVITED',
   UNIQUE(negotiation_id, supplier_id)

   Add to bids table (migration):
   negotiation_id UUID REFERENCES negotiation_events(id) NULL
   (nullable — existing bids without negotiation_id are RFQ bids)

2. NEGOTIATION CREATION ENDPOINT:
   POST /api/buyer/rfqs/:id/negotiation
   Authorization: BUYER who owns the RFQ.
   Parent RFQ must be in CLOSED status — 409 INVALID_STATE otherwise.
   Body: {
     invited_supplier_ids: string[],  // min 2, must be subset of RFQ accepted suppliers
     bid_open_at: ISO string,
     bid_close_at: ISO string,
     max_revisions: integer,
     min_change_percent: decimal,
     cooling_time_minutes: integer,
     anti_snipe_window_minutes: integer,
     anti_snipe_extension_minutes: integer
   }
   Validation: invited_supplier_ids must all exist in rfq_suppliers with status ACCEPTED.
   Creates negotiation_event (DRAFT status) + negotiation_suppliers rows.
   Records NEGOTIATION_CREATED audit entry with parent_rfq_id and invited supplier codes.
   Returns: created negotiation object.

3. BIDDING ENGINE REFACTOR:
   The bidding engine (submission, revision, ranking, anti-snipe, hash, audit)
   currently operates in rfq context. Refactor to be context-agnostic:
   Accept { contextType: "rfq" | "negotiation", contextId: string } in all service methods.
   For contextType "negotiation": read rules from negotiation_events table, not rfqs.
   All rules (revision count, min change, cooling, window, anti-snipe) apply identically.
   Hash sealing uses the same algorithm with negotiation_id in place of rfq_id in the payload.
   All negotiation audit entries include parent_rfq_id in their event_data.
   CRITICAL: This refactor must not break any existing Sprint 1–7 tests.
   Run npm test after refactoring before adding new endpoints.

4. SUPPLIER NEGOTIATION ENDPOINTS:
   All follow same anonymity rules as RFQ endpoints — supplier serializer must never leak
   competitor data. Supplier code in all responses is own code only.

   GET /api/supplier/negotiations/:id
   Returns: negotiation details, own supplier status, items from parent RFQ (read-only),
   bid_open_at, bid_close_at, revision rules.

   POST /api/supplier/negotiations/:id/bids
   Initial bid submission. Same rules as RFQ bidding. Status must be ACTIVE.
   Supplier must be in negotiation_suppliers with status ACCEPTED.

   PUT /api/supplier/negotiations/:id/bids
   Revision. All three revision rules enforced via refactored bidding engine.

   GET /api/supplier/negotiations/:id/ranking
   Returns: own rank_color, proximity_label, own_prices only.
   NEVER competitor data. Use allowlist serializer.

   GET /api/supplier/negotiations/:id/bid-status
   Returns: revision_number, revisions_remaining, last_submission_at,
   cooling_seconds_remaining (0 if not in cooling).

5. BUYER NEGOTIATION ENDPOINTS:

   GET /api/buyer/negotiations/:id
   Returns: full negotiation detail, all invited suppliers with status badges,
   current rankings (full — with supplier codes and prices).

   GET /api/buyer/negotiations/:id/rankings
   Returns: item-wise rankings, total rankings, weighted rankings (if weights set).
   Includes supplier codes and prices (buyer sees all).

   POST /api/buyer/negotiations/:id/close
   Manual close. Status must be ACTIVE. Sets CLOSED. Audit entry. WebSocket broadcast.

   POST /api/buyer/negotiations/:id/award
   Same shape as RFQ award endpoint. Sets AWARDED. Records NEGOTIATION_AWARDED audit entry
   referencing parent_rfq_id.

6. WEBSOCKET:
   Reuse existing Socket.io infrastructure.
   Subscribe event: { type: "negotiation", id: negotiation_id }
   Rank update events emitted per supplier (same isolation as RFQ channels).
   Deadline extension broadcast: negotiation:deadline_extended with new close time.

7. AUTO-CLOSE SCHEDULER:
   Extend the existing node-cron job to also check negotiation_events
   where bid_close_at < NOW() and status = ACTIVE.

8. UNIT TESTS (zero DB/Redis — mock everything):
   Bidding engine refactor: existing RFQ bid tests must still pass after refactor.
   Negotiation context: same test cases but with contextType = "negotiation".
   Negotiation creation validation: invited_supplier_ids not subset of accepted → 422.
   invited_supplier_ids count < 2 → 422.
   Parent RFQ not CLOSED → 409.
   Anti-snipe boundary tests for negotiation context.

9. INTEGRATION TESTS (Docker port 5433):
   Full negotiation flow: close RFQ → create negotiation → accept → submit bid →
   verify ranking → manual close → award.
   SEC-T01 equivalent for negotiations: supplier GET /ranking → assert no competitor data.
   SEC-T02 equivalent: supplier GET /negotiations/:id → assert no competitor prices in items.
   Cross-supplier: Supplier A tries GET /api/supplier/negotiations/[Supplier B's id] → 403.
   Buyer cannot GET /api/supplier/negotiations/:id → 403.

Do not start Sprint 9.
When done: "Sprint 8 complete. Unit: X/X. Integration: X/X.
Existing tests still passing: X/X. Ready for Sprint 9."
```

---

### After Sprint 8 — Verify Before Moving On
```powershell
docker-compose up -d
npm test          # ALL tests including existing Sprints 1-7
npm run test:security
```

Update PROGRESS.md. Then paste in Agent:
```
Sprint 8 complete. All tests passing including all pre-existing tests.
Proceed to Sprint 9 as defined in Section 11 of @MASTER_EXECUTION_FILE.md.
```

---

## SPRINT 9 PROMPT — Award Simulation Engine (Full)
## ⏳ NEXT AFTER SPRINT 8

**Model: Claude Opus 4.6**

```
Read @MASTER_EXECUTION_FILE.md and @PROGRESS.md before writing any code.

PRIMARY SYSTEM BUILDER — Section 16. Sprint 8 complete. Building Sprint 9.

ENVIRONMENT: Windows, Docker running.
PostgreSQL main: localhost:5432, test: localhost:5433, Redis: localhost:6379.

Sprint 9 scope: Section 11 "SPRINT 9". FR: Section 6 FR-13.

CONTEXT: A simulation endpoint was scaffolded in Sprint 4 supporting
single_supplier and item_split modes. Expand it to full FR-13 spec,
add category_split mode, and ensure all invariants are enforced.

Deliver:

1. EXPAND POST /api/buyer/rfqs/:id/simulation to support all 3 modes:

   Mode A — single_supplier:
   Body: { mode: "single_supplier", supplier_id: "uuid" }
   Awards all items to one supplier at their latest submitted unit prices.

   Mode B — item_split:
   Body: { mode: "item_split",
           items: [{ rfq_item_id: "uuid", supplier_id: "uuid" }] }
   Every rfq_item_id must be covered exactly once.
   422 ITEMS_NOT_FULLY_COVERED if any item missing.
   422 ITEM_DUPLICATE_ALLOCATION if any item appears more than once.

   Mode C — category_split:
   Body: { mode: "category_split",
           categories: [{ item_ids: ["uuid"], supplier_id: "uuid" }] }
   All items across all categories must be covered exactly once.
   422 if any item missing or appears in two categories.

   Calculations for all modes:
   total_procurement_cost = SUM(supplier_latest_unit_price * rfq_item.quantity)
   delivery_outcome_days = MAX(bid_items delivery from supplier profile or
     rfq commercial terms if supplier has not specified separately)
   unique_supplier_count = count(distinct supplier_ids in allocation)
   theoretical_minimum = SUM(L1_unit_price * quantity) per item (best possible cost)
   delta_vs_l1_total = total_procurement_cost - theoretical_minimum
   per_supplier_breakdown = [{ supplier_code, items_awarded: int, subtotal: decimal }]
   simulated_at = server UTC timestamp

   Response: {
     mode, total_procurement_cost, delivery_outcome_days,
     unique_supplier_count, delta_vs_l1_total, theoretical_minimum_cost,
     per_supplier_breakdown, simulated_at
   }

2. ZERO-WRITE INVARIANT — non-negotiable:
   The simulation endpoint must never write any database record.
   Must never create an audit log entry.
   Must never change any status field.
   Available for RFQ statuses: ACTIVE, CLOSED, AWARDED (buyers may re-simulate post-award).
   Any supplier_id provided must be one that has submitted a bid for this RFQ.
   422 SUPPLIER_HAS_NO_BID if supplier has not bid.

3. ADD POST /api/buyer/negotiations/:id/simulation
   Same interface and logic, operating on negotiation context.
   Uses negotiation supplier bids, not RFQ bids.

4. UNIT TESTS (pure calculation, mock all DB reads):
   Mode A: 3 items, 2 suppliers → correct total cost.
   Mode B: valid split → correct per-supplier subtotals.
   Mode B: delta = 0 when every item awarded to its L1 supplier.
   Mode B: missing item → 422 ITEMS_NOT_FULLY_COVERED.
   Mode C: item in two categories → 422 ITEM_DUPLICATE_ALLOCATION.
   Zero-write test: spy on all DB insert/update calls → assert count = 0 after simulation.
   Supplier no bid: 422 SUPPLIER_HAS_NO_BID.

5. INTEGRATION TESTS (Docker port 5433):
   Run simulation → verify response shape matches contract.
   After simulation: GET /api/buyer/rfqs/:id/audit-log →
     assert NO AWARD_FINALIZED entry exists.
   Run POST /award → verify AWARD_FINALIZED now exists.
   Mode B with missing item → 422.
   Mode C with duplicate item → 422.

Do not start Sprint 10.
When done: "Sprint 9 complete. Unit: X/X. Integration: X/X."
```

---

### After Sprint 9
```powershell
docker-compose up -d
npm test
```

Update PROGRESS.md, then paste in Agent:
```
Sprint 9 complete. All tests passing.
Proceed to Sprint 10 as defined in Section 11 of @MASTER_EXECUTION_FILE.md.
```

---

## SPRINT 10 PROMPT — Governance Hardening & Production Readiness
## ⏳ AFTER SPRINT 9

**Model: Claude Sonnet 4.6**

```
Read @MASTER_EXECUTION_FILE.md and @PROGRESS.md before writing any code.

PRIMARY SYSTEM BUILDER — Section 16. This is the FINAL backend sprint.
Sprint 9 complete. Harden, secure, document. No new features.

ENVIRONMENT: Windows, Docker running.
PostgreSQL main: localhost:5432, test: localhost:5433, Redis: localhost:6379.

Sprint 10 scope: Section 11 "SPRINT 10" in master file.

Deliver:

1. MISSING ADMIN ENDPOINTS (complete any gaps):
   GET /api/admin/audit-log?rfq_id=&event_type=&from=&to=&page=&limit=
   POST /api/admin/overrides
     Body: { entity_type, entity_id, action, justification (min 50 chars) }
     422 JUSTIFICATION_TOO_SHORT if < 50 chars.
     Records ADMIN_OVERRIDE audit entry.
   GET /api/admin/config → list all system_config key/value/description rows
   PUT /api/admin/config/:key → update value, records CONFIG_CHANGED audit entry
   POST /api/admin/rfqs/:id/extend
     Body: { minutes: integer, justification: string (min 50 chars) }
     Extends bid_close_at, records ADMIN_OVERRIDE + DEADLINE_EXTENDED.
     Broadcasts rfq:deadline_extended via WebSocket.

2. DATABASE INDEXES (write a single migration):
   CREATE INDEX IF NOT EXISTS idx_audit_log_rfq_id ON audit_log(rfq_id);
   CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
   CREATE INDEX IF NOT EXISTS idx_bids_rfq_supplier ON bids(rfq_id, supplier_id);
   CREATE INDEX IF NOT EXISTS idx_bids_is_latest ON bids(rfq_id, is_latest);
   CREATE INDEX IF NOT EXISTS idx_rfqs_buyer_status ON rfqs(buyer_id, status);
   CREATE INDEX IF NOT EXISTS idx_rfq_suppliers_lookup ON rfq_suppliers(rfq_id, supplier_id);
   CREATE INDEX IF NOT EXISTS idx_negotiation_suppliers ON negotiation_suppliers(negotiation_id, supplier_id);

3. N+1 QUERY FIXES:
   Review and fix any loops with per-row DB queries in:
   GET /api/buyer/rfqs (must fetch all RFQs in one query with JOINs)
   GET /api/buyer/rfqs/:id/rankings (fetch all bids in one query)
   GET /api/admin/suppliers (one query with credibility)
   GET /api/admin/users (one query)
   Use EXPLAIN ANALYZE in development to confirm no sequential scans on large tables.

4. SECURITY HARDENING:
   Install: npm install helmet
   Add app.use(helmet()) before all routes.
   Verifies: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options set.
   Verify: rate limiting active on POST /api/auth/login (5/15min/IP).
   Verify: bcrypt rounds = 12.
   Verify: JWT_SECRET loaded from env, not hardcoded.
   Grep: grep -r "secret\|password\|key" src/ --include="*.ts" | grep -v ".spec.ts" | grep -v "process.env"
   Fix any hardcoded secrets found.

5. RUN ALL SECURITY TESTS — fix every failure:
   npm run test:security
   All SEC-T01 through SEC-T15 must PASS before proceeding.
   Do not mark this sprint complete until all 15 pass.

6. RUN E2E TESTS:
   E2E-02 Zero Data Leakage: 3 suppliers bid → recursively scan all supplier API responses
     → assert no competitor price, code, or numeric rank position in any response body.
   E2E-03 Anti-Snipe (time-compressed): bid_close_at = NOW()+90s, window=120s →
     submit bid → assert bid_close_at extended → DEADLINE_EXTENDED in audit log.
   E2E-04 Hash Integrity: complete lifecycle → verifyAuditChain → assert valid=true →
     directly UPDATE one event_data in test DB → verifyAuditChain → assert valid=false.

7. OPENAPI DOCUMENTATION:
   Install: npm install swagger-jsdoc swagger-ui-express @types/swagger-jsdoc @types/swagger-ui-express
   Add JSDoc @swagger annotations to every controller method.
   Mount swagger UI at GET /api/docs (development only — not in production).
   Document all request bodies, response schemas, and error codes.

8. FINAL npm scripts in package.json (verify all Windows-compatible):
   "test": "cross-env NODE_ENV=test jest",
   "test:unit": "cross-env NODE_ENV=test jest --testPathPattern=unit",
   "test:integration": "cross-env NODE_ENV=test jest --testPathPattern=integration",
   "test:security": "cross-env NODE_ENV=test jest --testPathPattern=security",
   "test:e2e": "cross-env NODE_ENV=test jest --testPathPattern=e2e",
   "build": "tsc",
   "start": "node dist/server.js",
   "dev": "ts-node-dev --respawn src/server.ts"

9. PRODUCTION DOCKERFILE /backend/Dockerfile (multi-stage):
   FROM node:20-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build

   FROM node:20-alpine AS production
   WORKDIR /app
   ENV NODE_ENV=production
   COPY package*.json ./
   RUN npm ci --omit=dev
   COPY --from=builder /app/dist ./dist
   EXPOSE 3000
   HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/api/health || exit 1
   CMD ["node", "dist/server.js"]

10. /backend/.env.example (complete template):
    NODE_ENV=development
    PORT=3000
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/procurement
    DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5433/procurement_test
    REDIS_URL=redis://localhost:6379/0
    REDIS_URL_TEST=redis://localhost:6379/1
    JWT_SECRET=replace-with-at-least-32-character-random-string
    JWT_REFRESH_SECRET=replace-with-different-32-character-random-string
    ACCESS_TOKEN_EXPIRY=15m
    REFRESH_TOKEN_EXPIRY=7d
    BCRYPT_ROUNDS=12
    RATE_LIMIT_WINDOW_MS=900000
    RATE_LIMIT_MAX_REQUESTS=5
    CORS_ORIGIN=http://localhost:5173

11. /backend/README.md (PowerShell setup guide):
    Prerequisites: Node.js 20+, Docker Desktop for Windows
    Setup: copy .env.example .env → edit → docker-compose up -d → npm install → npm run migrate → npm run seed → npm run dev
    Testing: npm run test:unit | npm test | npm run test:security
    Production: docker build -t procurement-backend . → docker run -p 3000:3000 procurement-backend

When done: "Sprint 10 complete. Backend is production-ready.
SEC-T: 15/15 passing. E2E-02: pass. E2E-03: pass. E2E-04: pass.
All tests total: X/X passing."
```

---

### After Sprint 10 — Backend Complete ✅
```powershell
docker-compose up -d
npm test              # Full suite — must be all green
npm run test:security # All 15 SEC-T must pass
npm run test:e2e      # E2E-02, 03, 04 must pass
```

Update PROGRESS.md:
```
BACKEND COMPLETE ✅
Phase 1: Sprints 1–4 — done
Phase 2: Sprints 5–7 — done
Phase 3: Sprints 8–10 — done
SEC-T: 15/15 passing
E2E-02 Zero Data Leakage: passing
E2E-03 Anti-Snipe: passing
E2E-04 Hash Integrity: passing
→ Now starting: FRONTEND
```

---

# PART 4 — FRONTEND
## Model: Claude Opus 4.6
## Prerequisite: Sprint 10 backend complete · all tests green · dev server running

---

## WHY OPUS 4.6 FOR FRONTEND

Claude Opus 4.6 built the entire backend. It knows every endpoint shape, every error code,
every response structure. It will make fewer integration mistakes than any other model.
It also follows complex design specifications with higher fidelity than Gemini.
Use Opus 4.6 for all 6 frontend prompts.

---

## HOW TO SET UP FOR FRONTEND WORK

Open **three** terminals before starting. Keep all three open the entire time.

```powershell
# Terminal 1 — Docker (must be running)
cd C:\Users\pandr\procurement-platform\backend
docker-compose up -d

# Terminal 2 — Backend dev server (must stay running)
cd C:\Users\pandr\procurement-platform\backend
npm run dev
# Must show: Server running on http://localhost:3000

# Terminal 3 — Frontend work (all frontend commands here)
cd C:\Users\pandr\procurement-platform\frontend
```

**Open a completely new Agent session.** Do not continue the backend session.

---

# THE CREATIVE STANDARD

> Read this before reading a single design token. This is the most important section.

## What "Visual Masterpiece" Means

This application will be used by procurement professionals — buyers who manage
millions in spend, suppliers competing for contracts, admins overseeing the platform.
These are serious people doing serious work. The UI must match that gravity.

The goal is not to look "modern" or "clean" in the way AI-generated UIs look modern
and clean — which is to say: generic, interchangeable, forgettable. That is the failure
mode we are explicitly avoiding.

The goal is to build something that makes a procurement professional stop and think:
*"This feels different. This feels considered. This feels like it was built for me."*

**The benchmark:** Open Linear.app, Vercel's dashboard, Stripe's dashboard, and
Notion side by side. Our application must belong in that group — not because it
copies them, but because it radiates the same level of intentionality.

## The Anti-Patterns — What to Never Do

These are the signs of a generic AI-built frontend. Every one of these is forbidden:

```
✗ Gradient hero sections with overlapping blobs
✗ Cards with icons on the left and text on the right, every single card identical
✗ Blue primary buttons that are exactly the same as every Bootstrap app
✗ Tables with no visual hierarchy — just flat rows of equal-weight text
✗ Forms that are a vertical stack of full-width inputs with no layout thinking
✗ Empty states that are just "No data found." in small grey text
✗ Loading states that are a centered spinner on a blank white background
✗ Modals that look like browser alert() dialogs
✗ Navigation that is just a list of links with no visual grouping
✗ Status badges that are just colored dots
✗ Error messages that say "Something went wrong"
✗ Dashboard "KPI cards" that are four identical grey rectangles
✗ Sidebar nav items with zero hover states or active state distinction
✗ Typography that uses one font size for everything below the heading
✗ Spacing that was clearly done with margin: 16px everywhere
```

## What to Do Instead — The Creative Principles

**Typography creates hierarchy.** On any given screen, there should be a clear typographic
hierarchy: one dominant element (the most important number or heading), secondary elements
(labels, counts), and tertiary elements (metadata, timestamps). The user's eye should know
exactly where to look first without thinking about it.

**Density is intentional.** Professional tools are denser than consumer apps. A buyer
looking at ranking data needs to see all suppliers at once, not paginated into oblivion.
Tables should be information-dense but not claustrophobic. The space around elements
signals their importance — tight groupings are related, white space separates concerns.

**Color communicates, not decorates.** Color in this application has specific semantic
meaning: blue for action, green for L1/success, yellow for L2/warning, red for L3+/error.
Color used outside of these meanings is noise. There should be no decorative color.

**Microinteractions make it feel alive.** When a supplier submits a bid and their
RankDisplayWidget transitions from red to green — that moment should feel significant.
The color transition over 400ms, the "Updated" badge fading in, the proximity label
changing — these details are what separate a product from a prototype.

**Every state is designed.** Not just the happy path. The loading state, the empty state,
the error state, the partial state (some data loaded, some loading) — all of these are
designed intentionally. A screen that hasn't fully loaded should still look designed.

**Context is always visible.** The user should never wonder "where am I?" or "what is
this page for?" Page titles are clear. Breadcrumbs exist when hierarchy is deep.
The sidebar active state is obvious. The RFQ number is always visible on RFQ pages.

---

## USABILITY ENGINEERING PRINCIPLES (Applied to Every Screen)

These are not optional. Every screen must be evaluated against each of these.

**1. Visibility of System Status**
The user always knows what is happening.
- WebSocket: pulsing green dot "Live" or amber "Reconnecting"
- Loading: skeleton matching the exact shape of content
- Bid window: countdown timer always visible on bid pages
- Form submission: button shows spinner, becomes disabled
- Background operations: toast notifications for async results

**2. Match Between System and Real World**
Language is plain. Labels reflect how procurement professionals actually talk.
- "Enquiry" not "RFQ object" — but RFQ number is shown (it's their reference)
- "Bid closes in" not "bid_close_at"
- "Most competitive" not "L1 rank position"
- "Cooling period" not "cooling_time_active"
- "Finalise award" not "POST /api/buyer/rfqs/:id/award"

**3. User Control and Freedom**
Destructive actions are always reversible until the final confirmation.
- Multi-step forms have Back buttons
- Drafts can be saved and returned to
- Simulations can be run multiple times
- Only award finalization is truly irreversible — and it says so, explicitly

**4. Consistency and Standards**
Every button in the application behaves the same way.
Every modal has the same structure.
Every table has the same row height, same header style, same empty state pattern.
Once a user learns one part of the app, the rest is immediately familiar.

**5. Error Prevention**
Prevent mistakes before they happen.
- Validate in real-time (bid window dates: close must be after open)
- Disable submit until form is valid
- Show weight sum live as user types (red if not 100, green if exactly 100)
- Confirm before every destructive action
- Show consequences in confirmation dialogs ("This cannot be undone")

**6. Recognition Over Recall**
Never make the user remember something from a previous screen.
- RFQ detail page shows the RFQ number in the header, always
- Award page shows the simulation results (don't make them go back)
- Revision form is pre-populated with current prices
- Commercial terms are visible on the same page as the bid form

**7. Flexibility and Efficiency**
The interface works for both first-time users and power users.
- First-time: clear labels, tooltips on complex fields (anti-snipe window, weighted ranking)
- Power user: keyboard shortcuts work (Escape closes modals, Tab moves between form fields)
- Mobile user (suppliers): every critical action reachable with one thumb

**8. Aesthetic and Minimalist Design**
Every element on screen earns its place.
If removing an element wouldn't hurt usability: remove it.
No decorative dividers. No redundant labels. No duplicate information.

**9. Help Users Recognize, Diagnose, and Recover from Errors**
Error messages say:
- What went wrong (specific, not generic)
- Why it happened (if helpful)
- What to do next (actionable)

Never: "An error occurred." Always: "Bid cannot be revised — cooling period active for 4 more minutes."

**10. Proportional Feedback**
Small actions get small feedback (toast notification).
Medium actions get medium feedback (inline state change + toast).
Large, irreversible actions get large feedback (full modal confirmation, then success state).

---

## DESIGN TOKENS — EXACT VALUES (DO NOT DEVIATE)

### Color System

```css
/* ── Page Backgrounds ── */
--color-page:        #F5F5F7   /* Apple's signature grey — entire app background */
--color-surface:     #FFFFFF   /* Cards, panels, modals, sidebar */
--color-surface-2:   #FAFAFA   /* Nested card backgrounds, input backgrounds */
--color-overlay:     rgba(0, 0, 0, 0.45)  /* Modal backdrop */
--color-overlay-blur: backdrop-filter: blur(8px)

/* ── Text ── */
--color-text-1:      #1D1D1F   /* Primary — headings, key labels */
--color-text-2:      #48484A   /* Secondary — body, descriptions */
--color-text-3:      #6E6E73   /* Tertiary — metadata, subtitles */
--color-text-4:      #AEAEB2   /* Quaternary — disabled, placeholders */
--color-text-inverse:#FFFFFF   /* On dark/colored backgrounds */

/* ── Borders & Dividers ── */
--color-border-1:    #E5E5EA   /* Default — cards, dividers */
--color-border-2:    #D2D2D7   /* Input borders, stronger dividers */
--color-border-3:    #AEAEB2   /* Focus adjacent, selected borders */

/* ── Brand Interactive ── */
--color-blue:        #0071E3   /* Primary CTA — Apple blue */
--color-blue-dark:   #0060C7   /* Button active / pressed */
--color-blue-hover:  #0077ED   /* Button hover */
--color-blue-tint:   #E8F1FB   /* Blue tint bg — active nav, selected */
--color-blue-tint-2: #C6DCFA   /* Stronger blue tint — focus rings */

/* ── Semantic Rank Colors ── */
--color-green:       #1A9E3F   /* L1 rank — GREEN */
--color-green-bg:    #E6F4EA
--color-green-bold:  #145F26   /* Text on green-bg */

--color-yellow:      #B45309   /* L2 rank — YELLOW/AMBER */
--color-yellow-bg:   #FEF3C7
--color-yellow-bold: #92400E

--color-red:         #C0392B   /* L3+ rank — RED */
--color-red-bg:      #FDECEA
--color-red-bold:    #7F1D1D

/* ── Supporting Semantic ── */
--color-purple:      #7C3AED   /* AWARDED status */
--color-purple-bg:   #EDE9FE

--color-orange:      #D97706   /* Critical flags */
--color-orange-bg:   #FFF7ED

/* ── Neutral Scale ── */
--color-grey-50:     #FAFAFA
--color-grey-100:    #F5F5F7
--color-grey-200:    #E5E5EA
--color-grey-300:    #D2D2D7
--color-grey-400:    #AEAEB2
--color-grey-500:    #8E8E93
--color-grey-600:    #6E6E73
--color-grey-700:    #48484A
--color-grey-800:    #3A3A3C
--color-grey-900:    #1D1D1F
```

### Typography

```
Primary font: 'Inter' — npm install @fontsource/inter
Mono font: 'JetBrains Mono' — npm install @fontsource/jetbrains-mono
  (use for: RFQ numbers, supplier codes, hashes, prices, timestamps)

Import in main.tsx:
  import '@fontsource/inter/400.css'
  import '@fontsource/inter/500.css'
  import '@fontsource/inter/600.css'
  import '@fontsource/inter/700.css'
  import '@fontsource/jetbrains-mono/400.css'
  import '@fontsource/jetbrains-mono/500.css'

TYPOGRAPHIC SCALE:
  size-xs:   11px / line-height 1.4 / weight 400  — timestamps, metadata tags
  size-sm:   13px / line-height 1.5 / weight 400  — secondary labels, table cells
  size-base: 15px / line-height 1.6 / weight 400  — body text, descriptions
  size-md:   17px / line-height 1.5 / weight 500  — form labels, card titles
  size-lg:   20px / line-height 1.4 / weight 600  — section headings
  size-xl:   24px / line-height 1.3 / weight 700  — page headings
  size-2xl:  30px / line-height 1.2 / weight 700  — KPI numbers, hero metrics
  size-3xl:  38px / line-height 1.1 / weight 700  — login headline

Letter spacing:
  Headings ≥ 20px: letter-spacing -0.025em
  Body: letter-spacing 0
  Uppercase labels (badges, table headers): letter-spacing 0.06em
  Monospace numbers: letter-spacing -0.02em (tighter — cleaner number columns)
```

### Spacing System

```
Base unit: 4px (--space-1)
Full scale:
  --space-1:  4px
  --space-2:  8px
  --space-3:  12px
  --space-4:  16px
  --space-5:  20px
  --space-6:  24px
  --space-8:  32px
  --space-10: 40px
  --space-12: 48px
  --space-16: 64px

Application rules:
  Page horizontal padding:  40px desktop / 20px mobile
  Page vertical padding:    32px top, 40px bottom
  Page max content width:   1200px (centered)
  Card internal padding:    24px
  Card gap (grid):          16px
  Section gap:              32px
  Form field gap:           20px
  Inline element gap:       8px
  Sidebar width:            256px
  Sidebar nav item height:  40px
  Input/select height:      40px (sm: 34px, lg: 48px)
  Button height:            36px (sm: 30px, lg: 44px)
  Table row height:         52px (generous — professional, not cramped)
  Modal padding:            32px
```

### Shape & Elevation

```
Border radius:
  --radius-sm:   6px   — small badges, chips
  --radius-md:   8px   — inputs, buttons
  --radius-lg:  12px   — cards
  --radius-xl:  16px   — modals, large panels
  --radius-2xl: 20px   — drawers, sheets
  --radius-full: 999px — pills, avatars

Shadows (layered — realistic depth):
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.05)
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.05)
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04)
  --shadow-xl: 0 20px 25px rgba(0,0,0,0.10), 0 10px 10px rgba(0,0,0,0.04)
  --shadow-modal: 0 25px 50px rgba(0,0,0,0.20), 0 12px 20px rgba(0,0,0,0.10)

Focus ring (accessibility — always visible on keyboard focus):
  box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #0071E3
  (white inner ring + blue outer ring — works on any background)

Card border: always 1px solid #E5E5EA (even with shadow — the border grounds the card)
```

### Motion

```
Easing functions:
  --ease-out:      cubic-bezier(0.16, 1, 0.3, 1)    — most UI transitions
  --ease-in-out:   cubic-bezier(0.45, 0, 0.55, 1)   — modals, deliberate
  --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1) — microinteractions (slight overshoot)

Durations:
  --duration-fast:    100ms  — hover color changes
  --duration-base:    160ms  — button states, border changes
  --duration-medium:  220ms  — show/hide, slide
  --duration-slow:    300ms  — drawers, large panels
  --duration-modal:   250ms  — modal enter/exit

Specific animations:
  Button hover:     background-color 160ms ease-out
  Button press:     transform scale(0.97) 80ms ease-out
  Input focus:      border-color + box-shadow 160ms ease-out
  Card hover lift:  transform translateY(-2px) + shadow increase, 200ms ease-out
  Modal enter:      opacity 0→1 + scale 0.95→1, 250ms ease-out
  Modal exit:       opacity 1→0 + scale 1→0.95, 200ms ease-in
  Drawer enter:     translateX(100%)→0, 300ms cubic-bezier(0.16,1,0.3,1)
  Skeleton shimmer: background-position 200% → -200%, 1.8s linear infinite
  Rank color change: background-color 400ms ease-in-out (the most important animation)
  Toast enter:      translateX(100%)→0 + opacity 0→1, 300ms ease-out
  Toast exit:       translateX(100%) + opacity 0, 200ms ease-in

Page transitions: NONE. Instant. Professional tools don't animate between pages.
```

---

## ICON SYSTEM

```
Library: Phosphor Icons — the only icon library allowed
Install: npm install @phosphor-icons/react

Why Phosphor: consistent optical sizing, proper stroke weights,
covers every use case in this app, looks intentional not decorative.

Import pattern:
  import { ArrowRight, Buildings, ChartBar } from '@phosphor-icons/react'

Usage rules:
  weight="regular"  — default, most UI contexts
  weight="bold"     — emphasis, important actions
  weight="duotone"  — empty state illustrations ONLY (40px+ sizes)
  weight="fill"     — active nav icons, selected states

Sizes:
  12px — inline with xs text (timestamps, metadata)
  16px — inline with body text
  20px — standalone action icons, nav items
  24px — page-level action buttons
  40px — empty state illustrations
  48px — large feature icons (login page branding area)

NEVER:
  ✗ Emojis as icons
  ✗ Heroicons
  ✗ Lucide icons
  ✗ Inline SVG shapes built by hand
  ✗ Font Awesome
  ✗ Unicode symbols as icons (→ ✓ ✗)

Every icon: aria-hidden="true" if decorative.
             aria-label="[description]" if it carries meaning without text.
```

---

## COMPONENT DNA — HOW EVERY COMPONENT FEELS

### Buttons — The Interaction Baseline

Every button in the app must feel the same. If you click a primary button
in the login page and a primary button in the award flow, the physical feeling
should be identical: a slight scale-down on press, instant color feedback on hover.

```
PRIMARY BUTTON:
  Default:  bg #0071E3, text white, radius 8px
  Hover:    bg #0077ED (transition 160ms)
  Active:   transform scale(0.97) (transition 80ms)
  Loading:  16px white spinner left of label, bg #0071E3 (stays same color), cursor wait
  Disabled: opacity 0.38, cursor not-allowed, no hover effects
  Focus:    focus ring (double ring — white + blue)

SECONDARY BUTTON:
  Default:  bg white, text #1D1D1F, border 1px solid #D2D2D7
  Hover:    bg #F5F5F7, border #AEAEB2
  Active:   scale(0.97)

DANGER BUTTON:
  Default:  bg white, text #C0392B, border 1px solid #C0392B
  Hover:    bg #FDECEA
  Use for: destructive actions only — decline, deactivate, close early

GHOST BUTTON:
  Default:  no bg, no border, text #0071E3
  Hover:    bg #E8F1FB
  Use for: tertiary actions, cancel links, less important navigation

ICON-ONLY BUTTON:
  Square (equal width/height), border-radius 8px
  Must have tooltip (title attr) and aria-label
  Same hover/active as its variant (ghost is most common for icon-only)
```

### Inputs — Where Precision Matters

Procurement data entry is precise. Prices to 4 decimal places. Dates and times.
Percentages. The inputs must support precision without friction.

```
STANDARD INPUT:
  Default:  40px height, border 1px solid #D2D2D7, radius 8px, bg white
            padding: 0 12px, font Inter 15px, color #1D1D1F
  Hover:    border #AEAEB2 (subtle affordance that field is interactive)
  Focus:    border #0071E3, focus ring (transition 160ms)
  Filled:   border #D2D2D7 (same as default — filled state not distinguished by border)
  Error:    border #C0392B, focus ring with red instead of blue
  Disabled: bg #F5F5F7, color #AEAEB2, cursor not-allowed, border #E5E5EA
  Read-only: bg #F5F5F7, color #48484A, border #E5E5EA, cursor default

LABEL (above every input):
  font Inter 13px 500 weight, color #1D1D1F, margin-bottom 6px, display block
  Required asterisk: color #C0392B, margin-left 3px, aria-hidden="true"

HELPER TEXT (below input, no error):
  font Inter 12px, color #6E6E73, margin-top 4px

ERROR TEXT (below input, on error):
  font Inter 12px, color #C0392B, margin-top 4px
  Prepend with WarningCircle icon (12px) for emphasis

NUMERIC INPUTS:
  Use JetBrains Mono for the value (monospace numbers align in columns)
  text-align: right (numbers read right-to-left for magnitude comparison)
  Remove browser spinner arrows: -moz-appearance: textfield, ::-webkit-inner-spin-button none

PRICE INPUTS specifically:
  Prefix slot for currency symbol (£ or $ — left side, inside border)
  4 decimal places shown when focused, 2 when blurred
```

### Cards — The Building Block of Every Page

Every piece of content lives in a card. Cards float on the grey page background.
The shadow + border combination creates genuine depth without theatrics.

```
DEFAULT CARD:
  bg white, border 1px solid #E5E5EA, border-radius 12px
  padding 24px, box-shadow: --shadow-sm
  No hover effect (static cards)

INTERACTIVE CARD (clickable):
  Same as default
  Hover: translateY(-2px), box-shadow: --shadow-md, border-color #D2D2D7
  Transition: all 200ms ease-out
  Cursor: pointer
  Active: translateY(0), box-shadow: --shadow-sm (springs back)

STAT CARD (dashboard metrics):
  Same structure, but internal layout:
  Top row: metric label (13px 500 #6E6E73) + icon (20px, right-aligned, same color)
  Middle: metric value (30px 700 #1D1D1F, JetBrains Mono)
  Bottom: context (13px, #6E6E73) — "vs last month" / "last 30 days"
  Optional trend: small arrow icon + % change (green if positive, red if negative)
  The number is the hero. Everything else is context.

SECTION CARD (wrapping a section of content):
  Same as default card, but no internal padding on the table part:
  Use section header with padding 16px 24px, border-bottom #E5E5EA
  Table or list content goes edge-to-edge (no card padding on sides)
  This is important: tables look better when they go to the card edge.
```

### Tables — Where Procurement Professionals Spend Their Time

Tables are the most important element in this application. Buyers live in tables.
They need to scan, sort, and compare. Every table decision is intentional.

```
TABLE STRUCTURE:
  Wrapper: white card (section card style — table goes edge to edge)
  No outer border on table itself

TABLE HEADER ROW:
  bg #F5F5F7, border-bottom 2px solid #E5E5EA (slightly thicker — creates separation)
  Height: 40px
  Cell padding: 0 20px
  Font: Inter 11px 600 uppercase, color #6E6E73, letter-spacing 0.07em
  Sortable: CaretUp/CaretDown icons (16px, Phosphor) — active sort icon is blue
  Non-sortable columns: no icon

TABLE DATA ROWS:
  Height: 52px (generous — scannable, not cramped)
  Cell padding: 0 20px
  Font: Inter 14px 400, color #1D1D1F
  Border-bottom: 1px solid #F5F5F7 (very subtle — rows visible but not divided)
  Hover: bg #FAFAFA (extremely subtle — just enough to show row)
  Last row: no border-bottom

NUMERIC COLUMNS:
  JetBrains Mono 13px, text-align right
  Column header also right-aligned
  Negative values: color #C0392B

MONOSPACE COLUMNS (codes, hashes, RFQ numbers):
  JetBrains Mono 13px, color #48484A
  Optional: pill bg (bg #F5F5F7, padding 2px 8px, radius 4px)

ACTION COLUMN:
  Always rightmost, min-width 100px
  Contains icon buttons (ghost, 32px square)
  Or kebab menu (DotsThreeVertical icon)

PAGINATION:
  Below table, padding 12px 20px, border-top 1px solid #E5E5EA
  Left: "Showing X–Y of Z results" (13px #6E6E73)
  Right: prev/next buttons (secondary sm)
  No page number inputs — just prev/next with count

EMPTY STATE (inside table):
  Center of table body area, min-height 200px, flex center
  Icon: 40px duotone Phosphor, color #D2D2D7
  Heading: 15px 500 #3A3A3C
  Sub: 13px #6E6E73, max-width 280px, text-center
  CTA if applicable: primary sm button

SKELETON ROWS:
  5 skeleton rows, each 52px height
  Cells: grey pills matching approximate content width
  Shimmer animation running
```

### Status Badges — The Visual Language of State

Badges are the quickest signal the user gets. They must be instantly readable.
Every badge in the app uses this exact system — no exceptions.

```
STRUCTURE:
  display: inline-flex, align-items: center, gap: 6px
  padding: 3px 10px, border-radius: 999px
  font: Inter 11px 600, text-transform uppercase, letter-spacing 0.07em

  Optional leading dot (4px circle, same color as text):
    Use for statuses that are active/ongoing (ACTIVE, LIVE, IN PROGRESS)
    Animate dot with pulse for ACTIVE status only

RFQ STATUS:
  DRAFT:     bg #F5F5F7,   text #48484A,  dot: no
  PUBLISHED: bg #E8F1FB,   text #0060C7,  dot: no
  ACTIVE:    bg #E6F4EA,   text #145F26,  dot: yes (animated pulse)
  CLOSED:    bg #F5F5F7,   text #3A3A3C,  dot: no
  AWARDED:   bg #EDE9FE,   text #6D28D9,  dot: no

PARTICIPATION:
  PENDING:   bg #FEF3C7,   text #92400E,  dot: no
  ACCEPTED:  bg #E6F4EA,   text #145F26,  dot: no
  DECLINED:  bg #FDECEA,   text #7F1D1D,  dot: no
  INVITED:   bg #E8F1FB,   text #0060C7,  dot: no

CREDIBILITY:
  EXCELLENT: bg #E6F4EA,   text #145F26
  STABLE:    bg #FEF3C7,   text #92400E
  RISKY:     bg #FDECEA,   text #7F1D1D

USER STATUS:
  ACTIVE:    bg #E6F4EA,   text #145F26
  INACTIVE:  bg #F5F5F7,   text #6E6E73

FLAG SEVERITY:
  WARNING:   bg #FFF7ED,   text #C2410C
  CRITICAL:  bg #FDECEA,   text #7F1D1D
```

### The RankDisplayWidget — The Most Important Component in the App

This is where suppliers learn their competitive position. It must communicate
clearly, immediately, and emotionally. A supplier who is L1 should feel
confident. A supplier who is L3 should feel urgency. The design must create
that emotional response while remaining professional.

```
LAYOUT:
  Full width of its container
  Border-radius: 12px
  Height: minimum 128px
  No box shadow (the color IS the elevation)
  Border: none

TWO-ZONE ARCHITECTURE:

  LEFT ZONE (62% width, the primary message):
    Background: solid semantic color (--color-green / --color-yellow-bg / --color-red-bg)
    Note: use the full saturated color for green, tinted backgrounds for others:
      GREEN state:  bg #1A9E3F (dark green bg), text white
      YELLOW state: bg #FEF3C7 (warm yellow bg), text #92400E (dark amber)
      RED state:    bg #FDECEA (soft red bg), text #7F1D1D (dark red)
    
    Content (vertically centered, padding 24px):
      Status icon: 28px, Phosphor, weight="duotone"
        GREEN:  Trophy (gold tint) — or Star
        YELLOW: ArrowUp — suggestion of possibility
        RED:    ArrowDown — urgency without panic
      Icon color: same as text
      
      Primary text: "You are the most competitive" (20px 700, 1.2 line-height)
      Secondary text: "L1 · Best price across all items" (13px 400, 70% opacity)
      
      Both lines of text always — never color alone.

  RIGHT ZONE (38% width, the context):
    Background: white with very subtle left border (2px solid, 20% opacity of zone color)
    Padding: 20px 24px
    Content (top to bottom):
    
      Proximity label (when not L1):
        Small label: "DISTANCE FROM L1" (10px uppercase #6E6E73)
        Value: "Very close · within 2%" (15px 600, colored to match zone)
      
      Revisions remaining:
        Label: "REVISIONS LEFT" (10px uppercase #6E6E73)
        Value: "4 of 5" with mini progress dots (5 dots, filled blue for remaining)
        If 1 remaining: value color turns amber with WarningCircle icon
        If 0 remaining: "No revisions remaining" in red, form hidden
      
      Cooling countdown (only during cooling):
        Label: "NEXT REVISION IN" (10px uppercase #6E6E73, red)
        Value: "04:32" (24px JetBrains Mono, color #C0392B, weight 600)
        Counting down live every second

ANIMATION:
  When rank changes (WebSocket ranking:updated):
    LEFT ZONE: background-color transitions over 400ms ease-in-out
    RIGHT ZONE: border-color transitions over 400ms ease-in-out
    Both text lines: opacity 0→1 over 300ms (slight fade-in to draw attention)
    "Updated" badge: appears top-right corner, fades in 200ms, waits 1.5s, fades out 300ms
      Badge: 10px "UPDATED" uppercase, bg rgba(255,255,255,0.9), radius 4px, padding 2px 6px

ACCESSIBILITY:
  aria-live="polite" on the entire widget
  When rank changes: the primary text updates (screen reader announces it)
  Color + text + icon — three independent signals, never just one
```

### Countdown Timer — The Clock Everyone Watches

On live RFQ pages, the countdown timer is the most watched element.
It creates urgency. It must be precise and visible.

```
CONTAINER:
  White card, radius 8px, padding 12px 20px
  Display: inline-flex, align-items: center, gap: 12px
  Border: 1px solid #E5E5EA

TIME DISPLAY:
  Font: JetBrains Mono 28px 500 weight
  Letter-spacing: -0.02em
  Format: HH:MM:SS

STATES:
  Normal (> 5 min):   color #1D1D1F, border #E5E5EA, bg white
  Warning (< 5 min):  color #B45309, border #FEF3C7, bg #FFFBEB
    Pulse animation: opacity 1→0.7→1, 2s loop
  Critical (< 60s):   color #C0392B, border #FDECEA, bg #FFF5F5
    Pulse animation: opacity 1→0.5→1, 1s loop (faster)
    Font weight: 700 (bolder as urgency increases)
  Expired:            "Bid Closed" text, color #6E6E73, bg #F5F5F7, border #E5E5EA

LEFT OF TIMER (optional context icon):
  Clock icon (Phosphor, 20px) — same color as the time display
```

---

## SIDEBAR — THE NAVIGATION FOUNDATION

```
Width: 256px (slightly wider than before — more breathing room)
Background: white
Right border: 1px solid #E5E5EA
Full height: fixed, 100vh, overflow-y: auto (if many nav items)
z-index: above content, below modals

TOP SECTION — Brand (height 64px):
  Padding: 0 20px
  App wordmark: "ProcureX" — Inter 700 18px #1D1D1F
  A small geometric mark left of the wordmark:
    3 stacked horizontal bars of decreasing width (like a bid ladder visualization)
    Colors: bar 1 (full width) #0071E3, bar 2 (80%) #0071E3 at 60%, bar 3 (60%) #0071E3 at 30%
    This is the app icon — it's a visual metaphor for competitive bidding
    Build it as pure CSS (3 divs), not an SVG

NAVIGATION SECTION:
  Padding: 8px 0
  
  Section labels (if multiple groups):
    Font: Inter 10px 600 uppercase, color #AEAEB2, letter-spacing 0.10em
    Padding: 20px 20px 6px 20px
    First label has padding-top: 12px
  
  Nav items:
    Margin: 2px 8px (horizontal margin creates indented appearance)
    Padding: 0 12px
    Height: 40px
    Border-radius: 8px
    Display: flex, align-items: center, gap: 10px
    Font: Inter 14px 500, color #48484A
    Icon: 20px, Phosphor, weight="regular", color same as text
    Transition: background-color 120ms ease-out, color 120ms ease-out
    
    Hover: bg #F5F5F7, color #1D1D1F, icon color #1D1D1F
    Active: bg #E8F1FB, color #0071E3, icon color #0071E3, icon weight="fill"
    Active gets a left accent bar: before pseudo-element, 3px wide, height 20px,
      bg #0071E3, border-radius 0 2px 2px 0, position absolute left-0

BOTTOM SECTION — User Profile:
  Border-top: 1px solid #E5E5EA
  Padding: 12px 16px
  Margin-top: auto
  Display: flex, align-items: center, gap: 10px
  
  Avatar:
    32px circle, bg #0071E3
    User initials: Inter 13px 700 white (first letter of first + last name)
    If company has a color: use that color for admin/buyer avatars
  
  Text area (flex-1):
    Name: Inter 13px 600, color #1D1D1F, no overflow
    Role: Badge component (sm size)
  
  Logout button:
    Ghost icon-only button, SignOut icon (Phosphor 20px), color #6E6E73
    Hover: color #C0392B (logout turning red on hover is a satisfying microinteraction)

MOBILE BEHAVIOR:
  Sidebar hidden behind hamburger (List icon from Phosphor, 24px)
  Hamburger in top-left of AppShell, always visible on mobile
  When open: sidebar slides in from left (300ms ease-out)
  Backdrop overlay covers content (rgba(0,0,0,0.3))
  Clicking backdrop closes sidebar
```

---

## SKELETON LOADING SYSTEM

This is non-negotiable. No page shows a blank white area or a centered spinner
while loading. Every loading state shows a skeleton that matches the shape of
the content it will replace.

```
SHIMMER ANIMATION:
  background: linear-gradient(
    90deg,
    #E5E5EA 0%,
    #F5F5F7 50%,
    #E5E5EA 100%
  )
  background-size: 200% 100%
  animation: shimmer 1.8s ease-in-out infinite
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

SKELETON RULES:
  Border-radius matches the real element's border-radius
  Height matches the real element's height
  Width approximates the real element's width (can vary slightly for realism)
  Color: #E5E5EA base, #F5F5F7 highlight (from shimmer)

SKELETON PATTERNS:
  Stat card: skeleton circle (48px) top-right + skeleton text (3 lines, varying widths)
  Table row: 5 rows at 52px, cells matching column widths
  Text block: 3–4 lines, last line 60% width (paragraphs end short)
  Badge: pill-shaped skeleton, 60px wide
  RFQ card: full card skeleton with title block + footer block

Skeleton Component API:
  <Skeleton width={200} height={20} borderRadius={4} />
  <Skeleton.Text lines={3} lastLineWidth="60%" />
  <Skeleton.Card />  — full card skeleton
  <Skeleton.Table rows={5} cols={6} />  — table skeleton
```

---

## TOAST NOTIFICATION SYSTEM

```
POSITION: fixed bottom-right, margin 24px, z-index 9999
STACK: newest at bottom, max 4 visible, older ones animate out upward

INDIVIDUAL TOAST:
  Width: 340px
  Background: white
  Border-radius: 12px
  Box-shadow: --shadow-xl (prominent — toasts need to be noticed)
  Border-left: 4px solid (semantic color)
  Overflow: hidden

  Layout (internal):
    Padding: 14px 16px
    Left: semantic icon (20px Phosphor, filled)
    Middle (flex-1): title (14px 600 #1D1D1F) + optional message (13px #6E6E73 below)
    Right: X close button (ghost, 20px, #AEAEB2)
    Bottom: thin progress bar (semantic color, depletes over duration)

  Types:
    success: border #1A9E3F, icon CheckCircle (filled, green), progress bar green
    error:   border #C0392B, icon XCircle (filled, red), progress bar red
    warning: border #B45309, icon WarningCircle (filled, amber), progress bar amber
    info:    border #0071E3, icon Info (filled, blue), progress bar blue

  Auto-dismiss: success 4s, error 6s, warning 7s, info: requires manual close
  Progress bar depletes over dismiss duration (visual timer)

  Enter: slide in from right + opacity 0→1, 300ms ease-out
  Exit: slide out to right + opacity 0, 200ms ease-in
  When older toasts exit: remaining stack slides down smoothly
```

---

## EMPTY STATE DESIGN LIBRARY

Every empty state must feel designed, not like an afterthought.

```
STANDARD EMPTY STATE:
  Centered in its container (flex column center, min-height 240px)
  Illustration: Phosphor icon, 48px, weight="duotone", color #D2D2D7
  Heading: Inter 16px 600, color #3A3A3C, margin-top 16px
  Body: Inter 14px 400, color #6E6E73, max-width 280px, text-center, margin-top 6px
  CTA (when appropriate): primary or secondary button, margin-top 20px

SPECIFIC INSTANCES:
  RFQ list (buyer, no RFQs):
    Icon: ClipboardText duotone
    Heading: "No enquiries yet"
    Body: "Create your first enquiry to start inviting suppliers and collecting competitive bids."
    CTA: "Create Enquiry" (primary)

  Live rankings (no bids yet):
    Icon: ChartBar duotone
    Heading: "Awaiting bids"
    Body: "Rankings will appear here as suppliers submit their prices."
    No CTA

  Compliance flags (no flags):
    Icon: ShieldCheck duotone, color #D2D2D7 (but slightly greenish tint — #B8D4B8)
    Heading: "All clear"
    Body: "No compliance concerns have been raised for this enquiry."
    No CTA (positive state — don't invite action)

  Supplier dashboard (no RFQs assigned):
    Icon: Package duotone
    Heading: "No enquiries assigned"
    Body: "You will receive an access link when a buyer invites you to participate."
    No CTA

  Audit log (no entries):
    Icon: ClipboardText duotone
    Heading: "No audit events"
    Body: "Activity on this enquiry will be recorded here."
    No CTA

  Search results (no matches):
    Icon: MagnifyingGlass duotone
    Heading: "No results found"
    Body: "Try adjusting your search term or clearing the filters."
    CTA: "Clear filters" (secondary sm)
```

---

# FRONTEND PROMPTS — USE THESE WITH CLAUDE OPUS 4.6

> **One session per prompt.** Each prompt builds on the previous.
> After each prompt: verify the output builds and runs before moving on.
> If Opus gets stuck or produces something wrong: use Part 6 Bug Fix template.

---

## ▶ PROMPT 1 — PROJECT SCAFFOLD, DESIGN SYSTEM & SHARED COMPONENTS

**New Agent session — Claude Opus 4.6**
**Open Agent / Composer mode**

```
Read @MASTER_EXECUTION_FILE.md and @AGENT_INSTRUCTIONS.md fully before writing a
single line of code. Internalize the entire Part 4 of @AGENT_INSTRUCTIONS.md —
the Creative Standard, the Anti-Patterns list, all 10 Usability Engineering Principles,
every design token, and every component specification.

You are Claude Opus 4.6. You built the entire backend (Sprints 1–10) in previous sessions.
You now know every API endpoint, every error code, every response shape.
You are building the React frontend that connects to that backend.
Do not modify any backend file.

ENVIRONMENT:
  Windows / PowerShell — no bash syntax, no && chaining
  Backend running at http://localhost:3000
  Frontend will run at http://localhost:5173

DESIGN IDENTITY:
You are building a visual masterpiece for procurement professionals.
This must not look like a generic AI-built app. Read the Anti-Patterns list
in @AGENT_INSTRUCTIONS.md Part 4 and avoid every single one of them.
The Creative Standard section tells you what this should feel like instead.
The result must belong alongside Linear, Vercel, and Stripe in terms of design quality.

FONTS:
  npm install @fontsource/inter @fontsource/jetbrains-mono
  Import all weights (400, 500, 600, 700) for Inter and (400, 500) for JetBrains Mono
  in main.tsx

ICONS: Phosphor Icons only
  npm install @phosphor-icons/react
  Every icon: aria-hidden="true" if decorative, aria-label if it carries meaning

TECH STACK — install exactly:
  vite (via create-vite, react-ts template)
  react@18, react-dom@18
  typescript (strict: true in tsconfig)
  tailwindcss@3, autoprefixer, postcss
  react-router-dom@6
  @tanstack/react-query@5
  zustand@4
  axios
  socket.io-client
  react-hook-form@7
  zod@3
  @phosphor-icons/react
  @fontsource/inter
  @fontsource/jetbrains-mono
  vitest, @vitest/ui, @testing-library/react, @testing-library/user-event, jsdom
  @playwright/test

TAILWIND CONFIG — extend theme with ALL design tokens from @AGENT_INSTRUCTIONS.md:
  Extend colors: map every --color-* token as a Tailwind color
  Extend fontFamily: sans (Inter stack), mono (JetBrains Mono stack)
  Extend borderRadius: match --radius-* tokens
  Extend boxShadow: match --shadow-* tokens
  Extend fontSize: match typographic scale
  Extend spacing: match --space-* tokens

GLOBAL CSS (index.css):
  @import '@fontsource/inter/400.css'; (and 500, 600, 700)
  @import '@fontsource/jetbrains-mono/400.css'; (and 500)
  body { font-family: 'Inter', -apple-system, sans-serif; background: #F5F5F7; }
  * { box-sizing: border-box; }
  ::selection { background: #C6DCFA; }
  :focus-visible { outline: none; box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #0071E3; }

  Define CSS custom properties for all design tokens (--color-*, --radius-*, etc.)
  so they can be used in arbitrary CSS when Tailwind classes don't cover a case.

/frontend/.env:
  VITE_API_URL=http://localhost:3000

FOLDER STRUCTURE — use Section 8.3 from @MASTER_EXECUTION_FILE.md exactly.

─────────────────────────────────────────
BUILD THESE SHARED COMPONENTS
Each one must implement its specification from @AGENT_INSTRUCTIONS.md exactly.
Each one must have a Vitest unit test.
─────────────────────────────────────────

BUILD: Button (/src/components/ui/Button.tsx)
Implement the full Button specification from @AGENT_INSTRUCTIONS.md Component DNA section.
All variants: primary, secondary, danger, ghost
All sizes: sm (30px), md (36px default), lg (44px)
All states: default, hover, active (scale 0.97), loading (spinner + disabled), disabled
Loading state: CircleNotch icon (Phosphor) spinning, pointer-events none
The loading button must be the same width as the non-loading button (no layout shift)
All transitions exactly as specified in motion tokens
Full TypeScript — extends React.ButtonHTMLAttributes<HTMLButtonElement>
Vitest test: renders all variants, click fires, disabled prevents click, loading shows spinner

BUILD: Input (/src/components/ui/Input.tsx)
Full specification from Component DNA section.
Controlled component with value + onChange + optional onBlur
All states: default, hover, focus, error, disabled, read-only
Numeric variant: JetBrains Mono, text-align right, no browser spinners
Currency variant: left-side prefix slot for £ symbol
Label, helper text, error text, required asterisk — all in component
Full TypeScript — extends React.InputHTMLAttributes<HTMLInputElement>
Vitest test: renders, label shows, error shows, disabled blocks input

BUILD: Textarea (/src/components/ui/Textarea.tsx)
Same as Input but: min-height 88px, resize vertical only
Character counter prop (optional): shows "N/MAX" below right-aligned
Vitest test: renders, character counter updates

BUILD: Select (/src/components/ui/Select.tsx)
Custom select (not native <select>) — fully styled to match Input
Trigger button: same visual appearance as Input
Dropdown: white bg, radius 12px, shadow-xl, max-height 320px, scroll
Search input at top: only when options.length > 8
Options: 40px height, 14px, hover #FAFAFA, selected #E8F1FB text #0071E3, checkmark right
Empty search state: "No results" centered with MagnifyingGlass icon
Opens downward, flips upward if insufficient viewport space below
Keyboard: Up/Down navigates, Enter selects, Escape closes, Type-ahead search
Fully accessible: role="listbox", aria-selected, aria-expanded
Vitest test: opens on click, option selection fires onChange, keyboard navigation works

BUILD: Modal (/src/components/ui/Modal.tsx)
createPortal to document.body
Full specification from Component DNA section
Backdrop: rgba(0,0,0,0.45), backdrop-filter blur(8px)
Container: white, radius 16px, shadow-modal, padding 32px
Sizes: sm (480px), md (640px), lg (800px), xl (960px) via size prop
Header: title (xl 700) + optional description + X close button top-right
Footer: slot for buttons, border-top, right-aligned
Enter animation: scale 0.95→1 + opacity 0→1, 250ms --ease-out
Exit animation: scale 0.95 + opacity 0, 180ms ease-in
Focus trap (Tab cycles inside modal)
Escape key calls onClose
aria-modal, aria-labelledby, role="dialog"
Vitest test: renders children, close button fires onClose, Escape fires onClose

BUILD: Badge (/src/components/ui/Badge.tsx)
Full specification from Component DNA section — ALL badge variants
variant prop accepts all status strings defined in @AGENT_INSTRUCTIONS.md
Animated pulse dot for ACTIVE status
Fully typed variant union
Vitest test: renders all variants, ACTIVE has pulse dot

BUILD: Table (/src/components/ui/Table.tsx)
Full specification — section card style (table goes edge to edge)
Column definition: { key, header, render?, sortable?, align?, width? }
Sort state: controlled externally (onSort callback)
Row hover: #FAFAFA
Skeleton slot: when loading prop is true, shows Skeleton.Table
Empty state slot: ReactNode prop
Pagination: controlled (page, pageSize, total, onPageChange)
Mobile: horizontal scroll wrapper
Vitest test: renders columns and rows, sort callback fires, empty state shows

BUILD: Skeleton (/src/components/ui/Skeleton.tsx)
Shimmer animation exactly as specified
Components: Skeleton (base), Skeleton.Text, Skeleton.Card, Skeleton.Table
All use same shimmer animation
Vitest test: renders with correct dimensions

BUILD: Spinner (/src/components/ui/Spinner.tsx)
Circular CSS animation
Sizes: sm (16px), md (24px), lg (32px), xl (48px)
Color: inherits from currentColor (so it works on any background)
Vitest test: renders at each size

BUILD: Toast system (/src/components/ui/Toast.tsx + /src/store/toast.store.ts)
Full specification from Toast section in @AGENT_INSTRUCTIONS.md
Zustand store: addToast, removeToast, toasts array
Toast types: success, error, warning, info
Progress bar depletes over auto-dismiss duration
ToastContainer mounted in App.tsx root
Hook: useToast() → { toast } where toast.success('msg'), toast.error('msg', 'detail')
Vitest test: addToast adds, removeToast removes, auto-dismiss fires

BUILD: ConfirmDialog (/src/components/ui/ConfirmDialog.tsx)
Uses Modal (sm size)
Props: isOpen, title, message, detail?, confirmLabel, confirmVariant, onConfirm, onCancel
onConfirm is async — shows spinner in confirm button during execution
Cancel always available
Never auto-closes until onConfirm settles (success or error)
On error from onConfirm: show error state in dialog (don't close)
Vitest test: renders, confirm fires onConfirm, cancel fires onCancel

BUILD: RoleGuard (/src/components/auth/RoleGuard.tsx)
Reads from Zustand auth store
Not authenticated → redirect to /login (saves intended URL in location state)
Wrong role → redirect to correct home for their role
Correct role → renders children

BUILD: Avatar (/src/components/ui/Avatar.tsx)
32px circle (sm), 40px (md), 48px (lg)
Shows user initials (first letter of first + last name)
Background color: derive from user role or pass explicitly
Falls back to generic person icon if no name
Vitest test: renders initials correctly

When ALL components are complete and all tests pass:
"Prompt 1 complete. Design system implemented. X/X unit tests passing.
All components match @AGENT_INSTRUCTIONS.md specifications.
Ready for Prompt 2."
```

---

## ▶ PROMPT 2 — AUTH, ROUTING & APPLICATION SHELL

**Continue in same session or start fresh (Opus 4.6)**

```
Read @MASTER_EXECUTION_FILE.md and @AGENT_INSTRUCTIONS.md.
Shared UI components from Prompt 1 are complete and passing tests.

You are building the auth layer, application shell, sidebar, and login page.
The design must be exceptional. Read the Sidebar specification and Creative Standard
in @AGENT_INSTRUCTIONS.md Part 4 before writing any component.

DESIGN INTENTION FOR THIS PROMPT:
The login page is the first thing every user sees. It sets the tone for the entire
product. It must feel premium — not a login form thrown on a white background.
The sidebar is permanent — it is the frame through which users experience the whole app.
Every pixel of it must be intentional.

─────────────────────────────────────────
1. ZUSTAND AUTH STORE /src/store/auth.store.ts
─────────────────────────────────────────
State: {
  user: {
    id: string
    email: string
    role: 'ADMIN' | 'BUYER' | 'SUPPLIER'
    company_name?: string
    first_name?: string
    last_name?: string
  } | null
  accessToken: string | null
  isAuthenticated: boolean
}
Actions:
  login(user, token) — sets both
  logout() — calls POST /api/auth/logout (fire and forget), then clears state
  setAccessToken(token) — used only by silent refresh interceptor

No localStorage. No sessionStorage. Session-only in memory.
The refresh token lives in the HttpOnly cookie the backend already set.

─────────────────────────────────────────
2. AXIOS INSTANCE /src/api/axios.ts
─────────────────────────────────────────
baseURL: import.meta.env.VITE_API_URL
withCredentials: true
timeout: 15000

Request interceptor:
  Attach "Authorization: Bearer {accessToken}" from auth store if present

Response interceptor:
  On 401 AND request URL does NOT include /api/auth/refresh:
    Pause all in-flight requests using a pending promise queue
    Call POST /api/auth/refresh
    If 200: call setAccessToken(newToken), retry all queued requests
    If 401 from refresh: call logout(), navigate to /login, reject queue
  On any other error: let it propagate (caller handles it)

Dev only: log [METHOD] URL → STATUS in console (not in production build)
Wrap in useEffect-safe singleton (don't create a new axios instance on every render)

─────────────────────────────────────────
3. API CLIENT LAYER /src/api/
─────────────────────────────────────────
Create typed API functions (not raw axios calls in components):
  /src/api/auth.api.ts — login, logout, refresh
  /src/api/rfq.api.ts — buyer RFQ endpoints
  /src/api/supplier.api.ts — supplier endpoints
  /src/api/admin.api.ts — admin endpoints
  /src/api/user.api.ts — user management

Each function returns typed response. Define TypeScript interfaces for all API shapes.
Base these on the actual backend response shapes you know from building the backend.

─────────────────────────────────────────
4. APPLICATION SHELL /src/components/layout/
─────────────────────────────────────────
AppShell.tsx:
  Layout: fixed sidebar (256px) + main content area (flex-1, margin-left 256px)
  Main area: bg #F5F5F7, min-height 100vh, overflow-y auto
  Mobile (< 768px): no left margin, sidebar hidden (hamburger opens it)

Sidebar.tsx:
  Implement the full Sidebar specification from @AGENT_INSTRUCTIONS.md Part 4.
  The geometric app mark (3 bars of decreasing width in CSS — pure CSS, no SVG)
  Role-aware navigation — read Section 8.3 of @MASTER_EXECUTION_FILE.md for routes
  Active state detection using useLocation() from React Router
  Section labels grouping related nav items
  Bottom user profile section with logout
  Mobile: slide-in drawer with backdrop

Topbar.tsx (thin top bar inside main content area):
  NOT a navbar — this is minimal. Height 0 (hidden) on most pages.
  Only shown on pages that need a breadcrumb or secondary action.
  Page title and breadcrumb are in the page itself, not in a persistent topbar.
  (This is more professional than a persistent topbar — Linear does this.)

─────────────────────────────────────────
5. LOGIN PAGE /src/pages/auth/LoginPage.tsx
─────────────────────────────────────────
Full viewport height. Background: #F5F5F7.
Flex column: centered both axes.

THE CARD (the only element on the page):
  bg white, border-radius 20px (more rounded than standard cards — feels premium)
  padding 48px (generous)
  width 420px, max-width calc(100vw - 40px)
  box-shadow: --shadow-xl (prominent — this card is the only thing on the page)
  border: 1px solid #E5E5EA

  TOP SECTION (brand):
    Center-aligned
    The geometric mark (same as sidebar but 36px tall) + "ProcureX" (Inter 700 22px)
    Both on one line, gap 10px, color #1D1D1F
    margin-bottom: 32px
    A thin horizontal line (1px #E5E5EA) below brand, margin-bottom 28px

  HEADING:
    "Welcome back" — Inter 34px 700, color #1D1D1F, letter-spacing -0.025em
    margin-bottom 6px

  SUBHEADING:
    "Sign in to your account" — Inter 15px 400, color #6E6E73
    margin-bottom 32px

  FORM:
    Email Input (label: "Email address", type email, autocomplete email)
    Password Input (label: "Password", type password, autocomplete current-password)
      Show/hide toggle: Eye / EyeSlash icon (Phosphor, 20px) inside right side of input
      Toggle should never submit the form
    margin-bottom between fields: 20px
    Sign In button: full width, primary lg, "Sign in", margin-top 28px

  ERROR STATE (appears between form and button, animated slide-down):
    Not a toast — inline in the card
    bg #FDECEA, border 1px solid #FECACA, border-radius 8px, padding 12px 16px
    Left: WarningCircle icon (20px, #C0392B)
    Right: error message (14px #7F1D1D)
    Invalid credentials: "Incorrect email or password"
    Rate limited (429): "Too many attempts — please wait X minutes"
    Server error (5xx): "Something went wrong on our end — please try again"
    Animates in: height 0→auto + opacity 0→1, 200ms

  After login: redirect to role home
    ADMIN → /admin
    BUYER → /buyer
    SUPPLIER → /supplier

  No registration link. No forgot password. No social login.
  This is a closed enterprise platform.

─────────────────────────────────────────
6. TOKEN LANDING PAGE /src/pages/auth/TokenLandingPage.tsx
─────────────────────────────────────────
Route: /access/:token

Full viewport, centered, bg #F5F5F7.
Shows: geometric app mark (36px) + "ProcureX" (22px 700) at top
       Spinner (48px, blue) below brand
       "Verifying your access link..." (15px #6E6E73) below spinner

On mount: POST the token to exchange for session
On success: redirect to /supplier/rfqs
On failure:
  Replace spinner with XCircle icon (48px, #C0392B)
  "This link is no longer valid" (18px 600 #1D1D1F)
  "Access links expire after one use. Contact your buyer to request a new invitation." (14px #6E6E73)
  No retry button (by design — the link is consumed)

─────────────────────────────────────────
7. APP ROUTING /src/App.tsx
─────────────────────────────────────────
Wrap entire app in:
  QueryClientProvider (TanStack Query)
  Router (React Router)
  ToastContainer (from Toast store)

Routes:
  /login → LoginPage (public)
  /access/:token → TokenLandingPage (public)
  /admin/* → RoleGuard(ADMIN) → AppShell → admin routes
  /buyer/* → RoleGuard(BUYER) → AppShell → buyer routes
  /supplier/* → RoleGuard(SUPPLIER) → AppShell → supplier routes
  / → redirect by role if authenticated, else → /login
  * → 404 page

404 Page:
  Centered on #F5F5F7 background
  MagnifyingGlass icon (64px, duotone, #D2D2D7)
  "Page not found" (24px 700 #1D1D1F)
  "The page you're looking for doesn't exist or you don't have access to it." (15px #6E6E73)
  "Back to Dashboard" button (primary)

When done: "Prompt 2 complete. Auth, routing, and application shell built.
Login page matches design spec. Sidebar implemented with all role variants.
Ready for Prompt 3."
```

---

## ▶ PROMPT 3 — ADMIN PAGES

**Continue in same session or start fresh (Opus 4.6)**

```
Read @MASTER_EXECUTION_FILE.md and @AGENT_INSTRUCTIONS.md.
Auth and shell from Prompt 2 are complete.

You are building all Admin pages. Admin is a power user — they see everything.
Design for density and control. Admins want data, not hand-holding.
All pages in /src/pages/admin/

DESIGN INTENTION:
Admin pages are about oversight. The dashboard must show the health of the platform
at a glance. Tables must be information-dense but scannable. The audit log must feel
like a professional tool — not a basic list. System config must feel precise and careful.

ALL ADMIN PAGES FOLLOW THESE RULES:
  bg #F5F5F7 page background, white cards floating on it
  Skeleton loading (not spinner) for all data fetches
  Descriptive empty states per the library in @AGENT_INSTRUCTIONS.md
  All API calls: use the typed API client from /src/api/admin.api.ts
  All data fetching: TanStack Query (useQuery, useMutation)
  All errors: toast.error() with the server error message
  All 403: redirect to correct role home

─────────────────────────────────────────
ADMIN DASHBOARD /admin
─────────────────────────────────────────
Page layout:
  Page heading: "Platform Overview" (24px 700)
  Sub: current date in full (e.g., "Friday, 27 February 2026"), 13px #6E6E73
  margin-bottom 28px

STAT CARDS ROW (4 cards, CSS grid 4 columns, gap 16px):
Each card: Stat Card style from @AGENT_INSTRUCTIONS.md Component DNA
  Card 1: "Total Users" | Users icon (Phosphor) | count from GET /api/admin/users
  Card 2: "Active Enquiries" | ChartBar | count of RFQs with ACTIVE status
  Card 3: "Registered Suppliers" | Buildings | active supplier count
  Card 4: "Events Today" | ClipboardText | today's audit log entry count
  Each: large metric number in JetBrains Mono 30px 700

TWO-COLUMN LAYOUT BELOW (gap 20px):
  LEFT (flex-1): "Recent Activity" section card
    Latest 10 audit log entries (GET /api/admin/audit-log?limit=10&sort=desc)
    Table: Timestamp (mono xs) | Event (Badge) | Actor (sm) | Summary (sm, truncated 50 chars)
    "View all" link top-right of section header → /admin/audit

  RIGHT (380px fixed): Two stacked cards
    Card A: "Enquiry Status Breakdown"
      Visual breakdown by status — horizontal bar chart using CSS (no Recharts needed)
      Each status: colored bar + status name + count
      Heights proportional to count
    
    Card B: "Quick Actions"
      List of action links with icons:
      → Create User (UserPlus icon)
      → Onboard Supplier (Buildings icon)
      → View Audit Log (ClipboardText icon)
      → System Configuration (Gear icon)
      Each: 40px row, hover #FAFAFA, right arrow icon

─────────────────────────────────────────
USER MANAGEMENT /admin/users
─────────────────────────────────────────
Page heading: "User Management" + "Create User" button (primary, UserPlus icon, right)

FILTER BAR (white card, horizontal, margin-bottom 16px):
  [Search Input (MagnifyingGlass icon, placeholder "Search by email or name")]
  [Role Select: All Roles / Admin / Buyer / Supplier]
  [Status Select: All / Active / Inactive]
  Three items in a row, gap 12px

USER TABLE (section card style — table goes edge to edge):
  Columns:
    USER: avatar (Avatar component, 32px) + column layout (email 500weight / name sm #6E6E73)
    ROLE: Badge
    STATUS: Badge (ACTIVE/INACTIVE)
    JOINED: 13px #6E6E73 (formatted: "12 Jan 2025")
    CODE: JetBrains Mono pill (only for SUPPLIER role — empty dash for others)
    ACTIONS: kebab menu icon button (DotsThreeVertical)

  Kebab menu actions (context-aware):
    ACTIVE user: "Deactivate" (WarningCircle icon, red text)
    INACTIVE user: "Reactivate" (CheckCircle icon, green text)

  Deactivate: ConfirmDialog
    Title: "Deactivate [email]?"
    Message: "This user will be immediately signed out and unable to log in."
    Detail: "Their data and history will be preserved."
    Confirm: "Deactivate user" (danger variant)

Skeleton: 5 rows matching column structure
Empty: "No users match your filters" with search adjustment suggestion

CREATE USER SLIDE-OVER (from right, 400px wide):
  Overlay the main content with a backdrop
  Slide in from right: translateX(100%)→0, 300ms ease-out
  Header (border-bottom): "New User" (17px 600) + X close button
  Scrollable content area:
    Email (Input, required)
    Password (Input type password, required)
      Strength indicator below: 4 segments, fill color based on strength
        Weak: 1 red segment, "Weak"
        Fair: 2 amber segments, "Fair"  
        Good: 3 blue segments, "Good"
        Strong: 4 green segments, "Strong"
    Role (Select, required): Admin / Buyer / Supplier
    
    Conditional on SUPPLIER role:
      Company Name (Input, required)
      Contact Name (Input)
    
  Footer (border-top, padding 16px 24px):
    Cancel (secondary) + Create User (primary, loading during mutation)
  
  On 422: map field errors to specific Input components (no generic toast)
  On success: close panel, invalidate users query, toast.success("User created")

─────────────────────────────────────────
SUPPLIER MANAGEMENT /admin/suppliers
─────────────────────────────────────────
Page heading: "Supplier Directory" + "Onboard Supplier" button (primary, right)

SUPPLIER TABLE (section card):
  Columns:
    COMPANY: Buildings icon (16px, #6E6E73) + company name (14px 500) on same row
    CODE: JetBrains Mono pill (unique supplier code)
    CATEGORIES: tag chips (max 3 visible + "+N more" chip if more)
      Tag chip: bg #F5F5F7, border #E5E5EA, 11px, radius 999px, padding 2px 8px
    CREDIBILITY: Badge (EXCELLENT/STABLE/RISKY)
    STATUS: Badge (ACTIVE/INACTIVE)
    ACTIONS: Eye icon (view detail) + DotsThreeVertical (more)

  Row click → opens DETAIL DRAWER on right (500px wide)
  
  DETAIL DRAWER:
    Header: company name (20px 700) + credibility Badge, X close
    Sections (with section labels):
    
    "Contact Information":
      Name, email in a clean two-row layout
    
    "Supplier Code":
      Large JetBrains Mono display (24px) in a grey pill
      CopySimple icon button beside it (copies to clipboard, shows "Copied!" tooltip)
    
    "Credibility Breakdown":
      Four dimension bars — horizontal progress bars
      Each: dimension label (13px) + score (JetBrains Mono 13px right-aligned) + bar
      Bar: bg #E5E5EA, fill color (green if ≥70, amber if ≥40, red if <40)
      Height: 6px, radius 999px
      Dimensions: Response Discipline, Revision Behavior, Win Rate, Fulfillment
    
    "Recent Participation":
      Mini table: RFQ Number (mono) | Status (Badge) | Outcome
      Last 5 RFQs this supplier was assigned to

ONBOARD SUPPLIER SLIDE-OVER (same pattern as Create User):
  Fields: Company Name (required), Contact Name (required), Contact Email (required)
  Category Tags: tag input — type a category name and press Enter to add chip
    Chips are removable with X. No limit.
  On success: toast.success("Supplier onboarded — access link sent to their email")

─────────────────────────────────────────
AUDIT LOG /admin/audit
─────────────────────────────────────────
Page heading: "Audit Log" + Export button (secondary, DownloadSimple icon, right)

FILTER BAR (white card, 2-row layout for breathing room):
  Row 1: Date From (date) + Date To (date) + Event Type (Select, searchable)
  Row 2: RFQ ID (Input, placeholder "RFQ number or ID") + Apply Filters (secondary)
  "Clear" link to reset all filters

AUDIT TABLE (section card):
  Columns:
    TIMESTAMP: JetBrains Mono 11px #6E6E73, format "27 Feb 2026 · 14:32:05"
    EVENT: Badge (event type)
    ACTOR: role pill + code in mono (e.g., "BUYER · BYR01")
    RFQ: JetBrains Mono #0071E3, clickable link to buyer RFQ detail
    SUMMARY: 14px #48484A, truncated to 80 chars with "..." + expand on hover

  EXPANDABLE ROWS:
    Click anywhere on row → row expands below it (smooth height animation)
    Expanded area: dark-themed JSON viewer
      bg #1E1E2E (deep dark — not pure black, easier on eyes)
      Font: JetBrains Mono 12px
      JSON syntax highlighting:
        Keys: #79B8FF (cool blue)
        String values: #9ECE6A (soft green)
        Numbers: #FF9E64 (warm orange)
        Booleans/null: #BB9AF7 (purple)
      Formatted with 2-space indent, max-height 300px with scroll

  Expandable rows feel premium. This is a differentiator — most audit logs don't do this.

Export: currently visible/filtered page of audit log as JSON download

─────────────────────────────────────────
SYSTEM CONFIG /admin/config
─────────────────────────────────────────
Page heading: "System Configuration"

IMPORTANT NOTICE (amber banner, full width, margin-bottom 24px):
  WarningCircle icon (20px) + "Changes take effect immediately and apply to all active enquiries."
  bg #FFFBEB, border 1px solid #FDE68A, border-left 4px solid #F59E0B, radius 8px, padding 14px 16px

CONFIG TABLE (section card):
  Columns:
    KEY: JetBrains Mono 13px, color #48484A
    DESCRIPTION: 14px #6E6E73 (plain English explanation of what the key does)
    VALUE: JetBrains Mono 14px 500 #1D1D1F
    LAST UPDATED: 13px #AEAEB2
    UPDATED BY: 13px #6E6E73 (user email or "System")
    EDIT: PencilSimple icon button (ghost, 32px)

  INLINE EDIT MODE (when pencil clicked):
    The VALUE cell transforms: text becomes an Input (same width as the cell)
    Two icon buttons appear: CheckCircle (save, green) + X (cancel, grey)
    Other rows are dimmed slightly (focus attention on edited row)
    
    Save → ConfirmDialog:
      Title: "Update configuration?"
      Message: "Changing [key] from '[old_value]' to '[new_value]'"
      Detail: "This affects [description in plain English]."
      Confirm: "Save change" (primary)

When done: "Prompt 3 complete. All Admin pages built.
Dashboard, User Management, Supplier Directory, Audit Log, System Config.
All match design specifications. Ready for Prompt 4."
```

---

## ▶ PROMPT 4 — BUYER PAGES

**Continue in same session or start fresh (Opus 4.6)**

```
Read @MASTER_EXECUTION_FILE.md and @AGENT_INSTRUCTIONS.md.
Admin pages from Prompt 3 are complete.

You are building all Buyer pages. Buyers are the primary users — they run every
RFQ, evaluate rankings, and make award decisions. These pages handle significant
financial decisions. The design must convey precision, control, and clarity.

All pages in /src/pages/buyer/

DESIGN INTENTION:
Buyers see this application the most. Every page must reduce cognitive load.
The RFQ creation wizard must feel like a guided, confident process — not a form.
The detail page must give buyers everything they need without navigation.
The live rankings tab must feel like a trading floor — real-time, urgent, clear.

─────────────────────────────────────────
BUYER DASHBOARD /buyer
─────────────────────────────────────────
Page heading: personalized greeting
  Time-based: "Good morning" / "Good afternoon" / "Good evening"
  Full name from auth store: "Good morning, Arjun"
  Below heading: "Here's what needs your attention" — 15px #6E6E73

KPI STAT CARDS (4 cards, CSS grid):
  "Active Enquiries" — count, ChartBar icon, blue
  "Pending Award" — count of CLOSED+not AWARDED, Gavel icon, amber
  "Enquiries This Month" — total, CalendarBlank icon, grey
  "Avg Savings" — from KPI API, TrendDown icon, green if positive ("--" if no data)

RECENT ENQUIRIES SECTION:
  Section heading: "Recent Enquiries" (20px 600) + "View all" link (→ /buyer/rfqs)
  
  RFQ CARDS (not a table — cards feel more human for a dashboard):
  Each card: Interactive Card style (hover lifts), clickable → RFQ detail
  Card layout:
    Top row: RFQ Number (JetBrains Mono 11px #6E6E73) + Status Badge (right-aligned)
    Title: 17px 600 #1D1D1F, margin-top 6px
    Row 3: [Buildings icon + "N suppliers"] [Clock icon + bid close context]
      Bid close context:
        If ACTIVE and bid_close_at > now: "Closes [relative — 'in 2 hours']" + CountdownTimer (sm)
        If ACTIVE and bid_close_at <= now: "Closing..." (amber)
        If PUBLISHED: "Opens [date]"
        If CLOSED or AWARDED: "Closed [relative — '3 days ago']"
    Bottom: thin progress bar showing RFQ state position (DRAFT→AWARDED), color-coded

  Show 5 most recent RFQs. Empty state as specified.

─────────────────────────────────────────
RFQ LIST PAGE /buyer/rfqs
─────────────────────────────────────────
Page heading: "Enquiries" + "New Enquiry" button (primary, Plus icon)

STATUS FILTER TABS (not a Select dropdown — tabs are faster for filtering):
  Horizontal tab row: All | Draft | Published | Active | Closed | Awarded
  Active tab: blue underline + blue text (14px 500)
  Inactive tab: grey text, hover darker grey
  Each tab shows count badge (small blue pill with number)

SEARCH BAR below tabs: full-width Input with MagnifyingGlass icon, "Search enquiries..."

RFQ TABLE (section card):
  Columns:
    ENQUIRY: RFQ number (JetBrains Mono sm, clickable) + Title below (13px #6E6E73)
      (Two-line cell — number acts as ID, title as context)
    STATUS: Badge
    SUPPLIERS: count as "N invited" (13px) + mini avatar stack (up to 3 initials, overlapping)
    BID CLOSES: CountdownTimer (compact, inline) if ACTIVE, else date string
    CREATED: 13px #AEAEB2 (relative: "3 days ago")
    ACTIONS: ArrowSquareOut icon (view), DownloadSimple (export, if CLOSED/AWARDED)

  Row click → /buyer/rfqs/:id

─────────────────────────────────────────
RFQ CREATE PAGE /buyer/rfqs/new — 5-STEP WIZARD
─────────────────────────────────────────
This is the most complex buyer page. Design it with care.
The buyer is about to commit to a procurement process — the flow must feel confident.

OUTER LAYOUT:
  Full width inside AppShell (sidebar still visible)
  bg #F5F5F7, padding 32px 40px

STEP PROGRESS INDICATOR (sticky top, white bg, border-bottom, z-10):
  5 step nodes connected by a progress line
  Node: 32px circle
    Upcoming: bg #E5E5EA, text #6E6E73, number inside
    Current: bg #0071E3, text white, number inside, slight shadow
    Complete: bg #1A9E3F, text white, checkmark icon (Check, Phosphor)
  Connecting line: 2px, bg #E5E5EA, fills with green as steps complete
  Label below each node: step name in 12px
  Progress indicator scrolls away only on very small screens — sticky preferred

─── STEP 1: Items ───
White card, full width.
Card header: "What are you procuring?" (17px 600) + "(Step 1 of 5)" (13px #6E6E73)

ITEM TABLE:
  Header: Sl.No | Item Description * | Specification | UOM * | Qty * | Unit Price | Total
  
  Each row:
    Sl.No: auto, JetBrains Mono 13px, grey, width 48px
    Description: flex-1, Input (no border in table context — just underline on focus)
      Use inline table input style: no card border, just bottom border on focus
    Specification: 200px, Textarea (1 row, expandable), optional
    UOM: 80px, Input (Unit of Measure — kg, pcs, lot, etc.)
    Qty: 80px, numeric Input, right-align, JetBrains Mono
    Unit Price: 120px, "Supplier fills" placeholder, greyed, read-only
    Total: 100px, "Auto" placeholder, greyed, read-only
    Delete: Trash icon button (ghost danger, 32px), hidden on last row

  INLINE TABLE INPUT STYLE:
    bg: transparent, border: none, border-bottom: 1px solid transparent
    Focus: border-bottom 1px solid #0071E3
    This keeps the table feeling like a table, not a form

  ADD ROW: full-width row at bottom of table
    bg #FAFAFA, dashed border-top, height 44px
    Center: Plus icon (16px #6E6E73) + "Add item" text (13px #6E6E73)
    Click: adds new row with empty inputs, focuses description of new row

  FOOTER (below card):
    Left: "[N] item(s) added" (13px #6E6E73)
    Right: "Continue" button (primary, disabled + tooltip if 0 valid items)

─── STEP 2: Commercial Terms ───
Card header: "Commercial Terms" + step label

TWO-COLUMN FORM GRID (50/50, gap 24px):
  Left: Payment Terms | Freight Terms | Delivery Lead Time | Taxes & Duties
  Right: Warranty | Offer Validity | Packing & Forwarding | Special Conditions (textarea)
  
  Freight Terms: Select + "Other" → reveals text input below (conditional field pattern)
  Delivery Lead Time: number input + "days" suffix label inline

LAST PRICE SECTION (collapsible, default closed):
  Toggle: ChevronDown/Up icon + "Reference prices (optional)" label + info tooltip
  When open: slide-down animation (200ms)
  Content: compact table — Item description | Last Purchase Price
  Small note: "Used to calculate savings % in KPI analytics. Not shown to suppliers."

Navigation: "Back" (secondary) | "Continue" (primary)

─── STEP 3: Bidding Rules ───
Card header: "Bidding Rules"

TWO SECTION CARDS side by side (50/50 on desktop, stacked on mobile):

  LEFT CARD: "Revision Controls"
    Max Revisions: number Input, min 1, max 10
      Info tooltip: "Number of times each supplier can revise their bid after initial submission"
    Minimum Change %: number Input, 0.01–100, step 0.01
      Info tooltip: "Each revision must change at least this % from their previous bid"
    Cooling Time: number Input in minutes
      Info tooltip: "Suppliers must wait this many minutes between revisions"
    
    Info tooltip pattern: Info icon (Phosphor, 16px, #AEAEB2) beside label
      Hover: small popover (white card, shadow-md, 200px, 13px, below-right)
      Contains plain English explanation of the rule

  RIGHT CARD: "Bid Timing"
    Bid Opens: datetime-local input (styled — the native datetime-local is ugly)
      Style: same as Input, use a custom date picker if needed or heavily style native
      Must be: in the future
    Bid Closes: datetime-local, must be after Bid Opens
      Live validation: if closes ≤ opens, red error "Close time must be after open time"
    Anti-Snipe Window: number Input in minutes
      Info tooltip: "If a bid is submitted within this many minutes of closing, the window extends"
    Anti-Snipe Extension: number Input in minutes

WEIGHTED RANKING (full-width card below):
  Toggle switch: off by default
  Label: "Weighted Ranking" + "Rank suppliers on more than just price" (13px #6E6E73)
  
  When ON (animate open with slide-down):
    Three number inputs in a row: Price % | Delivery % | Payment %
    Live sum indicator: large display of "Total: X%"
      X% = 100: green background, CheckCircle icon, "Weights balanced"
      X% ≠ 100: red background, WarningCircle icon, "Must total exactly 100%"
    The sum display is the most important element here — make it prominent
    Cannot proceed to Step 4 until weights sum to 100 (if toggle is on)

─── STEP 4: Suppliers ───
Card header: "Invite Suppliers" + "[N] selected" (sm, #6E6E73, right)

SEARCH: Input at top of card, filters list in real-time

SUPPLIER LIST (scrollable, max-height 400px, inside card):
  Each row (40px height, hover #FAFAFA):
    Checkbox (custom-styled, blue) | Buildings icon + Company name (14px 500) |
    Code (JetBrains Mono sm, grey pill) | Credibility Badge | [right] Select/Deselect
  
  Checkboxes are the primary selection mechanism
  Clicking anywhere on the row toggles the checkbox

SELECTED SUPPLIERS AREA (below list, always visible):
  Label: "Selected suppliers:" (13px #6E6E73)
  Chips: each selected supplier as a chip
    bg #E8F1FB, border #C6DCFA, radius 999px, padding 4px 12px
    Company name (13px 500 #0060C7) + X button to remove
    Credibility badge inside chip
  
  If < 2 selected: red message below chips "Minimum 2 suppliers required to publish"
  Counter: "[N] suppliers selected" updates live

─── STEP 5: Review & Publish ───
Card header: "Review Before Publishing"

READ-ONLY SUMMARY in sections (each section collapsible):
  "Items ([N] items)": compact read-only table
  "Commercial Terms": two-column grid of all entered values
  "Bidding Rules": formatted summary (not raw field values — say "Up to 5 revisions" not "5")
  "Suppliers ([N] invited)": chips of all selected suppliers

FOOTER (sticky bottom on this step):
  "Save as Draft" (secondary) | "Publish Enquiry" (primary)
  
  "Save as Draft": 
    POST /api/buyer/rfqs with DRAFT status
    Redirect → /buyer/rfqs/:id, toast.success("Draft saved")
  
  "Publish Enquiry":
    ConfirmDialog:
      Title: "Publish this enquiry?"
      Message: "This will notify [N] suppliers and open the bid window on [formatted date]."
      Detail: "Commercial terms will lock once the first supplier accepts."
      Confirm: "Publish" (primary)
    On confirm: POST to create then PUT to publish
    Redirect → /buyer/rfqs/:id, toast.success("Enquiry published — suppliers will be notified")

─────────────────────────────────────────
RFQ DETAIL PAGE /buyer/rfqs/:id
─────────────────────────────────────────
This is the most visited page in the entire application. Buyers return here
repeatedly throughout the lifecycle of an RFQ. Every piece of information
must be immediately accessible.

HEADER CARD (white, shadow-sm):
  Top row: RFQ Number (JetBrains Mono 13px #6E6E73) + [action buttons]
  Main: Title (24px 700 #1D1D1F)
  
  STATUS TIMELINE (below title):
    5 circles (DRAFT → PUBLISHED → ACTIVE → CLOSED → AWARDED)
    Connected by a horizontal line
    Past stages: filled green circle + checkmark
    Current stage: blue filled + stage name highlighted
    Future stages: grey empty circles + grey labels
    This is the single most important navigation element on the page
    It tells buyers exactly where they are in the process at a glance
  
  Commercial Lock Banner (conditional — only when locked):
    Full width, inside header card, below timeline
    bg #FFFBEB, border-left 4px solid #F59E0B, border-radius 4px, padding 12px 16px
    LockSimple icon (Phosphor, 20px, #D97706) + 
    "Commercial terms locked — [supplier code] accepted on [date and time]"
    (13px #92400E)
  
  Action buttons (top-right of header):
    These are the primary controls. They change based on RFQ status:
    DRAFT:      [Edit] [Publish]
    PUBLISHED:  [Close Early]
    ACTIVE:     [Close Early] + [countdown sm]
    CLOSED:     [Run Simulation] [Finalise Award] [⬇ Excel] [⬇ PDF]
    AWARDED:    [⬇ Excel] [⬇ PDF]

STICKY TABS (below header card, position sticky top-0 z-10, white bg):
  Overview | Live Rankings | Compliance Flags (if flags: amber badge with count) | Audit Log
  Tab style: 15px 500, active tab: blue underline 2px + blue text
  Border-bottom on tab row: 1px #E5E5EA

────── OVERVIEW TAB ──────
Two-column layout (60 / 40, gap 20px):

  LEFT COLUMN:
    "Items" section card (table edge-to-edge):
      Read-only version of the items table
      Shows all buyer-set fields: Sl.No, Description, Specification, UOM, Qty
      Unit Price column: "Supplier fills" in italic #AEAEB2 if no bids yet
      After close: shows L1 price per item per supplier (full comparison grid)

  RIGHT COLUMN:
    "Commercial Terms" card: two-column grid of all term key-value pairs
    "Bidding Rules" card: rule summary in plain English
      "Suppliers can revise up to 5 times"
      "Each revision must change prices by at least 2%"
      "5-minute cooling time between revisions"
      "Anti-snipe: bids in final 10 minutes extend window by 5 minutes"
    
  BELOW (full width):
    "Assigned Suppliers" section card (table edge-to-edge):
      Columns: Company | Code (mono) | Status (Badge) | Credibility | Accepted At | Notes
      Empty state: "Suppliers will appear here as they respond to invitations"

────── LIVE RANKINGS TAB ──────
This tab is the command center during an active RFQ.
It must feel real-time and responsive.

TOP BAR (sticky, inside tab):
  Left: WebSocket status indicator
    Connected: pulsing green dot (8px, animated) + "Live" (12px 500 #1A9E3F)
    Disconnected: amber dot + "Reconnecting..." (12px #B45309)
    Both with fade transition between states
  
  Right: CountdownTimer component (full spec in @AGENT_INSTRUCTIONS.md)

THREE DATA SECTIONS (vertically stacked, each in section card):

  "Item Rankings" card:
    For each RFQ item: which supplier is L1, what is L1 price
    Columns: Sl.No | Description | L1 Supplier (mono code) | L1 Price (mono) | Bidders
    When ranking:updated event arrives: affected rows highlight briefly (yellow flash → normal)
    Empty (no bids yet): empty state as specified

  "Total Rankings" card:
    Overall ranking by total bid value
    Columns: RANK | SUPPLIER (mono code) | TOTAL BID (mono, right-align) | vs L1 (delta)
    Rank column: #1 row has subtle green left border, #2 amber, others none
    Delta: "+£2,340 (+4.2%)" in red, "—" for L1
    Live updates via WebSocket

  "Weighted Rankings" card (only visible when weights configured):
    Columns: RANK | SUPPLIER | SCORE | Price | Delivery | Payment
    Score: primary number (JetBrains Mono 14px 600)
    Component weights: mini horizontal bars (Price %, Delivery %, Payment %)

  Anti-snipe toast: when rfq:deadline_extended received:
    toast.warning("Bid window extended · New close: [formatted datetime]")

────── COMPLIANCE FLAGS TAB ──────
Empty state: ShieldCheck icon (duotone, 48px, slightly green-tinted #B8D4B8)
"All clear" heading, "No compliance concerns identified" body — positive, reassuring

When flags exist:
  Section header: "Active Flags ([N])" — only shows active flags
  
  Each flag card (white, border-left 4px):
    WARNING flags: border-left #D97706, bg white
    CRITICAL flags: border-left #C0392B, bg #FDECEA (very subtle red tint)
    
    Card interior:
      Top row: flag_id (JetBrains Mono sm grey) + flag_type badge + timestamp (xs right)
      "Affected supplier: [code]" or "Affects item: [description]" (13px #6E6E73)
      Recommendation: italic 14px #48484A, margin-top 8px

────── AUDIT LOG TAB ──────
Same design as Admin audit log but scoped to this RFQ.
Download button downloads this RFQ's audit trail only.

─────────────────────────────────────────
AWARD SIMULATION PAGE /buyer/rfqs/:id/simulate
─────────────────────────────────────────
Page heading: "Award Simulation" with back arrow (← Enquiry [RFQ number])

TWO-PANEL LAYOUT:
  LEFT PANEL (380px, white card, padding 24px):
    "Build Scenario" (17px 600)
    
    MODE SELECTOR (segmented control — 3 options):
      [Single Supplier] [Item Split] [Category Split]
      Active: bg #0071E3, text white, radius 6px
      Inactive: bg transparent, text #3A3A3C
      Container: bg #F5F5F7, border 1px solid #E5E5EA, radius 8px, padding 4px
    
    Single Supplier mode:
      Select: searchable supplier dropdown with code + credibility badge per option
    
    Item Split mode:
      One Select per RFQ item
      Item name as label above each select
      Shows supplier options with prices ("£12.50/unit — [code]")
    
    Category Split mode:
      "Add Category Group" button (secondary, Plus icon)
      Each group: text input for group name + item checkboxes + supplier select
      Drag-to-rearrange items optional (nice to have)
      "All items must be allocated" validation indicator
    
    "Run Simulation" button (primary, full width, PlayCircle icon)
    Loading state in button during API call (stays the same width)

  RIGHT PANEL (flex-1):
    Before first run:
      Empty state: Flask icon (Phosphor, 48px, duotone, #D2D2D7)
      "Build a scenario on the left and run simulation to see results"
      No CTA (the instruction is the CTA)
    
    RESULTS CARD (after run, white card):
      "Scenario Results" (17px 600) + mode badge (right, small)
      
      METRICS ROW (4 mini stat areas, border between each):
        Total Cost: JetBrains Mono 26px 700 + currency symbol
        vs Best: delta from theoretical minimum (green if 0, red if positive)
        Delivery: "[N] days max"
        Suppliers: "[N] unique"
      
      BREAKDOWN TABLE:
        Supplier Code (mono) | Items (count) | Subtotal (mono, right)
        Light grey header, same table style
      
      "Save Scenario" button (secondary, BookmarkSimple icon)
    
    SAVED SCENARIOS COMPARISON (when 2+ saved):
      Horizontal comparison table:
        Row headers: metric names (Total Cost, Delivery, Suppliers)
        Column headers: scenario labels (S1, S2, S3...)
        Values: aligned, monospace numbers
        Lowest total cost column: subtle green column bg highlight
      "Clear scenarios" link (small, red ghost, below)

  PROCEED BUTTON (full width, below both panels):
    "Proceed to Award Finalisation" (primary lg)
    Only active when a scenario has been run

─────────────────────────────────────────
AWARD FINALIZATION PAGE /buyer/rfqs/:id/award
─────────────────────────────────────────
This page handles a decision worth potentially millions of pounds.
The design must communicate gravitas and precision.

Page heading: "Finalise Award"
Breadcrumb: ← [RFQ number and title]

IRREVERSIBILITY BANNER (full width, amber, prominent):
  bg #FFF7ED, border-left 4px solid #F59E0B, border 1px solid #FDE68A
  radius 8px, padding 16px 20px
  WarningCircle icon (24px, #D97706) + 
  Title: "This decision is permanent" (15px 600 #92400E)
  Body: "Once confirmed, this award cannot be modified or reversed.
  The decision will be permanently recorded in the immutable audit trail." (13px #92400E)

ALLOCATION SUMMARY CARD:
  "Award Allocation" (17px 600)
  Derived from simulation or manual if no simulation run
  Shows who gets what — per supplier, per item group
  
  SUMMARY TABLE:
    Supplier Code (mono) | Company | Items Awarded | Total Value (mono)
    Total row at bottom: "Total Procurement Cost" (700) | full total (mono 700)

NOTES FIELD:
  Textarea: "Award justification (optional)"
  Helper: "These notes will be recorded in the audit trail alongside the award decision."
  max 1000 chars, character counter

CONFIRM BUTTON (danger primary, full width, Gavel icon):
  "Confirm and Finalise Award"
  
  ConfirmDialog:
    Title: "Confirm award finalisation"
    Message (precise): "[Supplier company] will be awarded [item count] items totalling [amount]."
    Detail: "This action cannot be undone. All parties will be notified."
    Confirm label: "Yes, finalise award" (danger)
    Loading state during the POST request

After award: redirect to /buyer/rfqs/:id, toast.success("Award finalised and recorded")

─────────────────────────────────────────
KPI DASHBOARD /buyer/kpis
─────────────────────────────────────────
Page heading: "Procurement Analytics"

DATE RANGE SELECTOR (white card, horizontal):
  "From" date input + "To" date input + "Apply" button (secondary)
  Quick presets as text links: "Last 30 days" | "Last 90 days" | "This year"
  Default: last 90 days

KPI CARDS (4, CSS grid):
  Cycle Time: "[N] hours avg" (JetBrains Mono 28px 700) + trend arrow
  Savings %: "[N]%" + TrendDown icon + "vs reference prices"
  Participation: "[N]%" + Users icon + "of invited suppliers accepted"
  Price Convergence: "[N] CV" + explanation tooltip (lower = more competitive)

TREND CHART (Recharts, white card):
  LineChart: cycle time per RFQ over time period
  X axis: RFQ dates
  Y axis: hours
  Line: #0071E3, strokeWidth 2, dots on hover
  Grid: subtle #F5F5F7 horizontal lines only
  Tooltip: white card, shadow-md, shows RFQ number + cycle time

PER-RFQ TABLE:
  Columns: RFQ Number (mono, link) | Date | Cycle Time | Savings % | Participation | CV
  Clickable rows → RFQ detail

When done: "Prompt 4 complete. All Buyer pages built — Dashboard, RFQ List,
RFQ Create (5-step wizard), RFQ Detail (4 tabs), Simulation, Award, KPIs.
All match design specifications. Ready for Prompt 5."
```

---

## ▶ PROMPT 5 — SUPPLIER PAGES

**Continue in same session or start fresh (Opus 4.6)**

```
Read @MASTER_EXECUTION_FILE.md and @AGENT_INSTRUCTIONS.md.
Buyer pages from Prompt 4 are complete.

You are building all Supplier pages. Suppliers are often on mobile devices.
They are checking their competitive position in real-time during an active bid.
The design must work perfectly at 375px. The RankDisplayWidget is their most
important screen element. Every decision must serve mobile-first usability.

All pages in /src/pages/supplier/

CRITICAL RULES FOR ALL SUPPLIER PAGES:
  1. NEVER render: credibility_score, credibility_class, or any score field
     Even if the API returns it — whitelist what you render
  2. NEVER render: competitor supplier codes, competitor prices, or rank numbers
  3. NEVER render: total_bidders, bidder_count, or any competitor quantity
  4. Mobile-first. Test every component at 375px width mentally as you build it
  5. Touch targets: minimum 44px × 44px for all interactive elements on mobile

DESIGN INTENTION:
Suppliers feel urgency. They don't know if they're winning or losing
until the RankDisplayWidget tells them. The UI must reduce the time from
"page opens" to "I know my position" to under 2 seconds.
The most competitive suppliers will be watching the bid page live.
It must feel like a real-time, alive experience — not a static form.

─────────────────────────────────────────
SUPPLIER DASHBOARD /supplier
─────────────────────────────────────────
Page heading: "My Enquiries"

RFQ CARDS (not table — cards are better on mobile and more scannable):

Each card: white, shadow-sm, border #E5E5EA, radius 12px, padding 0
  (no card padding — internal sections have their own padding)

Card structure:
  TOP SECTION (padding 16px 20px):
    Row: RFQ Number (JetBrains Mono 11px #6E6E73) + Participation Badge (right-aligned)
    Title: 16px 600 #1D1D1F, margin-top 4px
    Buyer context: 13px #6E6E73 (company name if available)
  
  DIVIDER: 1px #F5F5F7
  
  MIDDLE SECTION (padding 12px 20px, bg #FAFAFA):
    Two rows of context data:
      Row A: Status badge + bid window status
      Row B: Clock icon + time context:
        ACTIVE window open: "Bid window open · closes [relative]" (green text)
        ACTIVE window not open: "Opens [formatted date]" (#6E6E73)
        PUBLISHED: "Awaiting bid window" (#6E6E73)
        CLOSED: "Closed [relative ago]" (#AEAEB2)
  
  BOTTOM SECTION — CTA (padding 12px 20px):
    Full-width button based on state:
      PENDING:                 "Review & Respond" (primary)
      ACCEPTED + window open:  "Bid Now" (primary, with ArrowRight icon)
        The "Bid Now" button has a subtle animated border glow (pulsing blue glow)
        This communicates urgency without shouting
      ACCEPTED + window not open: "View Details" (secondary)
      CLOSED:                  "Download Receipt" (secondary, DownloadSimple icon)
      DECLINED:                "Declined" (ghost, disabled-looking, no action)

Mobile: cards are full-width, stacked, scroll vertically — perfect on phone

─────────────────────────────────────────
RFQ VIEW PAGE /supplier/rfqs/:id
─────────────────────────────────────────
This page has 5 distinct states. The visual design changes significantly
between states. Get each state exactly right.

STICKY TOP BAR (white, border-bottom, shadow-xs, height 56px):
  Left: Back arrow (ArrowLeft, Phosphor, ghost button) + RFQ Number (mono 13px #6E6E73)
  Center: Title (truncated on mobile, 15px 500 #1D1D1F)
  Right: CountdownTimer (compact — show only MM:SS when < 60 min, otherwise "HH:MM")
  Mobile: top bar collapses to 2 rows

CONNECTION STATUS INDICATOR (small, top-right of page, below top bar):
  Connected: 8px pulsing green dot + "Live" (11px #1A9E3F)
  Disconnected: 8px amber dot + "Reconnecting" (11px #B45309)

─── STATE 1: PENDING (not yet accepted or declined) ───

ENQUIRY DETAILS CARD:
  "Enquiry Details" section header
  Items table (read-only, compact):
    Sl.No | Description | Specification (truncated, expandable) | UOM | Quantity
    Unit Price column header: "You will fill this"
    Total header: "Auto"
  Commercial terms: clean two-column list of key-value pairs (13px)
  Bidding rules summary: plain English version

STICKY BOTTOM ACTION BAR (fixed bottom, white, border-top, shadow-xl):
  Height: 72px, padding 0 20px
  Left: "Please decide your participation" (13px #6E6E73, hidden on mobile)
  Right: [Decline] (secondary danger, 44px height) + [Review & Accept] (primary, 44px)
  Both buttons full-width on mobile (stacked vertically at 375px)

─── STATE 2: ACCEPTED, BID WINDOW NOT OPEN ───
Same enquiry details card.
Replace sticky action bar with an info banner:
  CalendarBlank icon (Phosphor, 20px, #0071E3)
  "Bidding opens on [full formatted date and local time]" (15px #1D1D1F)
  bg #E8F1FB, border 1px solid #C6DCFA, radius 8px, padding 14px 20px
  Positioned at top of page content (below sticky top bar)

─── STATE 3: ACCEPTED, BID WINDOW OPEN, NO BID SUBMITTED ───
Animate a banner at top:
  bg gradient: linear-gradient(135deg, #0071E3 0%, #005EC7 100%)
  text white, padding 16px 20px
  Row: Lightning icon (24px white) + "Bidding is live" (17px 700 white)
  Sub: "Submit your prices now · window closes [relative]" (13px white 80%)
  The gradient + icon makes this feel urgent but controlled

BID ENTRY FORM CARD (white, shadow-md — slightly more prominent than usual):
  "Your Price Submission" (17px 600)
  Sub: "Initial submission — you will have [N] revisions after this" (13px #6E6E73)

  BID TABLE:
    Headers: Sl.No | Description | UOM | Qty | Your Price | Total
    
    Each row:
      Description: read-only (14px, no border)
      UOM + Qty: read-only, grey, JetBrains Mono
      Your Price: Input (numeric, JetBrains Mono, right-align, 4 decimal places)
        Currency prefix: "£" inside left edge of input
        Placeholder: "0.0000"
        Highlight on focus: input bg #F8FBFF (very subtle blue tint)
      Total: auto-calculated, JetBrains Mono, right-align, read-only, bg transparent

    GRAND TOTAL ROW:
      Spans full width, border-top 2px solid #1D1D1F, padding-top 12px
      Left: "Grand Total" (14px 600)
      Right: calculated total in JetBrains Mono 20px 700

    Mobile: Price input column is 120px. Description truncates. Grand total is full-width.

  SUBMIT BUTTON: full-width, primary lg, "Submit Bid" + ArrowRight icon
    ConfirmDialog on click:
      Title: "Submit your bid?"
      Message: "Grand total: [formatted amount]"
      Detail: "After submitting, you will have [N] revisions available."
      Confirm: "Submit bid" (primary)

─── STATE 4: BID SUBMITTED, WINDOW ACTIVE ───
Three stacked sections:

SECTION A: RankDisplayWidget (full specification from @AGENT_INSTRUCTIONS.md)
  Implement every detail: two-zone layout, semantic colors, animations,
  aria-live, the revision progress dots, the cooling countdown in right zone.
  This is the most important component. Do not shortcut it.

SECTION B: "Revise Your Prices" card
  Header row: "Revise Your Prices" (17px 600) + "Revision [N] of [max]" (sm #6E6E73, right)
  
  Same table layout as bid entry, but:
    Pre-populated with current submitted prices
    Changed cells: on value change, cell bg transitions to #FFFDE7 (very light yellow)
    Below changed input: "Was: £[previous value]" in 11px JetBrains Mono #6E6E73
    Unchanged cells: normal appearance
  
  COOLING PERIOD OVERLAY (when cooling_time_active):
    Overlays the table with:
    bg: rgba(250, 250, 250, 0.92) — frosted glass effect
    Center content:
      Clock icon (40px, duotone, #6E6E73)
      "Next revision available in" (14px 500 #48484A)
      Countdown: JetBrains Mono 32px 700 #C0392B, counting down MM:SS
      Sub: "Cooling period between revisions" (12px #6E6E73)
    
    The table is visible but frozen underneath (partial blur: backdrop-filter blur(2px))
    This communicates "almost ready" rather than "blocked"
  
  SUBMIT REVISION BUTTON: full-width primary "Submit Revision"
    Disabled (visually only, shows why) during cooling period
    
    On MIN_CHANGE_NOT_MET (422):
      Failing rows: border-right 3px solid #C0392B, bg #FFF5F5
      Below input: WarningCircle icon + "Change ≥ [X]% required" (11px #C0392B)
      toast.error("Minimum change requirement not met")
    
    On COOLING_TIME_ACTIVE (422):
      Start/update cooling countdown
      Do NOT submit — just start the timer

SECTION C: Submission History card
  "Submission History" (17px 600)
  
  VERTICAL TIMELINE (left-side dots):
    Each submission entry:
      Left: vertical line + dot (8px circle)
        Latest: bg #0071E3 (blue dot)
        Previous: bg #D2D2D7 (grey dot)
      Content (right of line, padding-left 20px):
        "Initial Submission" or "Revision [N]" (14px 600 #1D1D1F)
        Timestamp (12px JetBrains Mono #6E6E73)
        Total: JetBrains Mono 15px 500 #1D1D1F
        Hash: first 8 chars, JetBrains Mono 11px, grey pill, with ShieldCheck icon (Phosphor)
        "Download Receipt" link (DownloadSimple icon, 14px #0071E3)
          → GET /api/supplier/rfqs/:id/receipt?revision=N → opens PDF in new tab

─── STATE 5: CLOSED ───
  Full-width closed banner:
    bg #F5F5F7, border 1px solid #E5E5EA, radius 8px, padding 16px 20px
    LockSimple icon (20px, #6E6E73) + "This enquiry has closed" (15px 600 #3A3A3C)
    Sub: "No further bids are accepted. Download your confirmation receipts below." (13px #6E6E73)
  
  Final submitted prices (read-only table, same layout, inputs replaced with text)
  Submission History (same as State 4 Section C)

─────────────────────────────────────────
DECLARATION MODAL (DeclarationModal.tsx)
─────────────────────────────────────────
Opened when supplier clicks "Review & Accept"
Modal size: md (640px)

Title: "Accept Participation"
Subtitle: "Read and confirm each declaration to proceed." (14px #6E6E73)

THREE DECLARATION CARDS (each as a distinct card inside modal):
  Card: white bg, border 1px solid #E5E5EA, radius 10px, padding 16px
  Layout: checkbox left (aligned to top of text) + content right

  Custom checkbox:
    24px × 24px (larger than default — touch-friendly on mobile)
    Unchecked: border 2px solid #D2D2D7, radius 6px, bg white
    Checked: bg #0071E3, border #0071E3, white checkmark inside
    Transition: all 150ms ease-out (the check animation should feel satisfying)

  Declaration content:
    Title: 14px 600 #1D1D1F (e.g., "Terms & Conditions")
    Body: 13px 400 #48484A, line-height 1.6 (full legal text from FR-04.1)

  Cards gap: 10px between cards

PROGRESS TRACKER (below cards):
  Horizontal: 3 step dots, filled when that declaration checked
  Alongside: "[N] of 3 confirmed" (13px #6E6E73)
  When all 3: "[3] of 3 confirmed" turns green with CheckCircle icon

CONFIRM BUTTON:
  Disabled (opacity 0.38, not-allowed): "Confirm all declarations to continue"
  All 3 checked: primary, full width, "Accept Participation"
    Animate from disabled → enabled: not just opacity change
    Scale pulse animation on the button (0.98→1.02→1, 300ms) when it becomes active
    This moment should feel like a reward for completing all checks
  
  Loading state during POST request
  On success: close modal, page transitions to State 2 or 3

Cancel: text link below button, grey, small: "Cancel" (no button style — less prominent)

─────────────────────────────────────────
DECLINE MODAL (DeclineModal.tsx)
─────────────────────────────────────────
Modal size: sm (480px)

Title: "Decline Participation"
Subtitle: "Your reason will be recorded with your response." (14px #6E6E73)

Reason Textarea:
  min-height: 100px, full width
  label: "Reason for declining" (required)
  max 500 characters
  
  CHARACTER COUNTER (below right):
    < 20 chars: "[N]/500 · Please enter at least 20 characters" (12px amber)
    ≥ 20 chars: "[N]/500" (12px #6E6E73)
    Smooth color transition at the 20-char threshold

DECLINE BUTTON: full width, danger primary
  Disabled until ≥ 20 chars
  "Decline Enquiry"
  
After decline: modal closes, page shows permanent declined state:
  A banner (full width, red bg tint) permanently replaces the action bar
  "You have declined to participate in this enquiry" (14px #7F1D1D)
  The reason they entered is shown: "Reason: [their text]" (13px #AEAEB2)

─────────────────────────────────────────
WEBSOCKET INTEGRATION ON RFQViewPage
─────────────────────────────────────────
Connect on mount:
  const socket = io(import.meta.env.VITE_API_URL, {
    auth: { token: accessToken },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10
  })

On connect: socket.emit('subscribe:rfq', { rfqId: id })

Handle events:
  'ranking:updated':
    Update RankDisplayWidget state
    The zone colors animate (400ms transition — critical to implement)
    "Updated" flash badge appears for 1.5s

  'rfq:deadline_extended':
    Update CountdownTimer target time
    Show "+[N]m extended" flash badge on timer for 3s
    toast.warning(`Bid window extended · New close: [formatted time]`)

  'rfq:closed':
    Set page state to STATE 5
    Toast.info("Bid window has closed for this enquiry")
    Immediately disable all form inputs (don't wait for page refresh)

Connection monitoring:
  socket.on('connect', () => setConnected(true))
  socket.on('disconnect', () => setConnected(false))
  On reconnect: GET /api/supplier/rfqs/:id to reload state
    (in case events were missed during disconnection)

Cleanup: socket.disconnect() on component unmount

─────────────────────────────────────────
MOBILE REQUIREMENTS — VERIFY ALL OF THESE
─────────────────────────────────────────
At 375px viewport width:
  ✓ No horizontal scroll on any page (document.body.scrollWidth ≤ 375)
  ✓ All buttons ≥ 44px height (touch target minimum)
  ✓ Bid price inputs: large enough to tap and type on a phone keyboard
  ✓ Grand total visible above the submit button without scrolling (if possible)
  ✓ RankDisplayWidget: full width, readable without zooming
  ✓ CountdownTimer: visible in the sticky top bar
  ✓ Submission history: readable and receipts downloadable
  ✓ Declaration modal: scrollable if declarations too long for screen
  ✓ Bottom action bar: buttons full-width stacked on mobile
  ✓ Tables: horizontal scroll with sticky first column

When done: "Prompt 5 complete. All Supplier pages built — Dashboard, RFQ View
(5 states), Declaration Modal, Decline Modal, WebSocket integration.
Mobile-optimised. RankDisplayWidget fully implemented per spec.
Ready for Prompt 6."
```

---

## ▶ PROMPT 6 — INTEGRATION VERIFICATION, E2E TESTS & LAUNCH

**Continue in same session or start fresh (Opus 4.6)**

```
Read @MASTER_EXECUTION_FILE.md and @AGENT_INSTRUCTIONS.md.
All pages from Prompts 1–5 are complete. This is the final frontend prompt.
Verify everything, write E2E tests, and confirm the product is ready.

─────────────────────────────────────────
STEP 1: DESIGN QUALITY AUDIT
─────────────────────────────────────────
Go through every page and verify these. Fix anything that fails.

VISUAL CHECKS:
  □ Page background is exactly #F5F5F7 everywhere (check body background)
  □ All cards: bg white, border 1px solid #E5E5EA, radius 12px, shadow-sm
  □ All text uses Inter (check font-family in computed styles)
  □ Numbers in tables, prices, codes use JetBrains Mono
  □ Zero emojis anywhere in the application
  □ All icons are from @phosphor-icons/react
  □ Sidebar: 256px wide, white, border-right #E5E5EA
  □ Status badges: match exact colors from design tokens in @AGENT_INSTRUCTIONS.md
  □ Login page: centered card, #F5F5F7 background, no other elements
  □ RankDisplayWidget: two-zone layout (62/38), correct colors, aria-live
  □ CountdownTimer: JetBrains Mono, correct state colors, pulse animations
  □ All empty states: icon + heading + body text (no blank areas)
  □ All loading states: skeleton (not spinner) for page-level content
  □ Button focus: double ring visible (white inner + blue outer)
  □ Input focus: blue border + blue glow ring

ANTI-PATTERN CHECKS (none of these should exist):
  □ No gradient hero sections
  □ No centered spinners on blank white page backgrounds
  □ No generic grey "An error occurred" toasts
  □ No inputs without labels
  □ No tables without empty states
  □ No status badges that are just colored dots without text

USABILITY CHECKS:
  □ Every form field has a label
  □ Every required field has a visible indicator
  □ Every destructive action has a confirmation dialog
  □ Every irreversible action says it's irreversible in the confirmation
  □ The WebSocket status is always visible on bid-related pages
  □ The countdown timer is always visible on active RFQ pages (buyer and supplier)
  □ All 422 validation errors appear next to the field that caused them
  □ All 409 errors appear as Modal dialogs (not toasts)
  □ All network errors appear as toasts with specific messages (not "Something went wrong")

─────────────────────────────────────────
STEP 2: API INTEGRATION VERIFICATION
─────────────────────────────────────────
Verify each of these works end-to-end with the real backend:

Auth flow:
  □ Login → JWT stored in memory, HttpOnly cookie set
  □ Token refresh works silently (try letting access token expire)
  □ Logout clears state and redirects to login
  □ Token landing page exchanges token and redirects supplier

Buyer flows:
  □ Create RFQ (all 5 steps) → published successfully
  □ RFQ detail loads all 4 tabs with real data
  □ Live rankings tab WebSocket connects and updates
  □ Award simulation runs and returns results
  □ Award finalization changes status to AWARDED
  □ Excel download initiates
  □ PDF download initiates

Supplier flows:
  □ Dashboard shows assigned RFQs
  □ Accept with 3 declarations checked → accepted status
  □ Decline with reason → declined status
  □ Bid submission → prices accepted, ranking returned
  □ RankDisplayWidget shows correct color from ranking response
  □ Revision form pre-populated with current prices
  □ Receipt download initiates

Admin flows:
  □ Dashboard loads stat counts
  □ Create user → user appears in table
  □ Deactivate user → status changes
  □ Onboard supplier → supplier appears in directory
  □ Audit log loads with filters
  □ Config inline edit saves

─────────────────────────────────────────
STEP 3: RUN VITEST UNIT TESTS
─────────────────────────────────────────
cd frontend
npm test

Fix any failing tests before proceeding.
All shared UI components should have tests passing from Prompt 1.
Report: X/X passing.

─────────────────────────────────────────
STEP 4: PLAYWRIGHT E2E TESTS
─────────────────────────────────────────
playwright.config.ts:
  baseURL: 'http://localhost:5173'
  use: {
    viewport: { width: 1440, height: 900 },
    headless: false,  // watch first run
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }

E2E-01 FULL LIFECYCLE /tests/e2e/lifecycle.spec.ts:
  Use seeded accounts from MASTER_EXECUTION_FILE.md seed section.
  
  1. Admin (admin@platform.local) logs in → dashboard loads, stat cards visible
  2. Admin → Users → seeded buyer and supplier accounts visible in table
  3. Buyer1 logs in → dashboard shows greeting
  4. Buyer1 → New Enquiry → completes all 5 steps with valid data → publishes
     (use a bid_open_at in the past or NOW to test immediately)
  5. Supplier1 logs in → RFQ visible on dashboard card
  6. Supplier1 opens RFQ → DeclarationModal → all 3 checked → accepts
     Assert: page transitions to State 2 or 3
  7. Supplier2 logs in (second page context) → accepts
  8. Supplier3 declines with valid reason (≥ 20 chars)
  9. Supplier1 → BidEntryForm visible → fills prices → submits
     Assert: ConfirmDialog appears → confirm
  10. Assert: RankDisplayWidget shows GREEN for Supplier1
      Assert: rank message text contains "most competitive" (text, not just color)
  11. Supplier2 submits higher prices
      Assert: Supplier2 sees YELLOW or RED rank
      Assert: Buyer1 Live Rankings tab shows both suppliers
  12. Buyer1 manually closes RFQ
  13. Buyer1 → Export Excel → assert download triggered (response 200)
  14. Buyer1 → Simulation → single supplier → run → proceed to award
  15. Buyer1 → Award Finalization → confirms → assert AWARDED badge in header
  16. Supplier1 → Submission History → Download Receipt → assert PDF triggered

E2E-02 ZERO DATA LEAKAGE /tests/e2e/security.spec.ts:
  Setup: 3 suppliers with different bid amounts.
  Use page.route() to intercept all /api/supplier/* responses.
  
  For each intercepted response:
    Parse body as JSON
    Recursively scan all keys and values
    Forbidden keys: competitor, other_supplier, all_prices, rival
    Forbidden patterns: any key named rank_position, total_bidders, bidder_count
    Forbidden values: exact numeric rank integers (1, 2, 3) under rank-related keys
  
  Assert: test passes if no forbidden data found
  Assert: fail immediately if any forbidden data found, log exact key path

E2E-03 MOBILE SMOKE /tests/e2e/mobile.spec.ts:
  use: { viewport: { width: 375, height: 812 } }
  
  Supplier1 logs in → dashboard loads
  Assert: document.body.scrollWidth ≤ 375 (no horizontal overflow)
  Opens an active RFQ → bid form visible
  Assert: all buttons have clientHeight ≥ 44
  Submits bid → RankDisplayWidget visible
  Assert: RankDisplayWidget clientWidth ≥ 350 (full width on mobile)
  Assert: rank text visible (not clipped)

─────────────────────────────────────────
STEP 5: FINAL CONFIRMATION
─────────────────────────────────────────
When all tests pass, run:
  npm run build (inside frontend folder)
  Confirm: build succeeds with zero TypeScript errors
  Confirm: dist/ folder contains the built assets

Then confirm the final running state:
  Backend: npm run dev → running on :3000
  Frontend: npm run dev → running on :5173
  Open browser → http://localhost:5173
  Login works for all 3 roles
  WebSocket connects on bid-related pages

Final report:
"Frontend complete and production-ready.

Design: Matches Apple HIG standards. Visual masterpiece achieved.
All design tokens implemented. Zero anti-patterns present.

Tests:
  Vitest unit: X/X passing
  Playwright E2E-01 lifecycle: PASS
  Playwright E2E-02 security: PASS
  Playwright E2E-03 mobile: PASS
  TypeScript build: PASS

Application is ready for Chrome DevTools QA testing (Part 5 of @AGENT_INSTRUCTIONS.md)."
```

---
---

# PART 5 — CHROME DEVTOOLS MCP TESTING PLAN
## Model: Claude Sonnet 4.6 or Opus 4.6
## When: After frontend E2E tests pass
## Prerequisite: Both backend and frontend servers must be running

---

## WHY CHROME DEVTOOLS MCP TESTING

Unit tests and integration tests verify backend logic.
Playwright E2E tests verify user flows.
Chrome DevTools testing goes deeper — it verifies:

- **Performance**: actual page load times, render blocking, bundle size
- **Console health**: zero console errors in production flows
- **Network**: API call correctness, response times, no failed requests
- **Visual correctness**: layout, scrolling, responsiveness
- **Accessibility**: ARIA, focus management, keyboard navigation
- **Security headers**: correct HTTP headers on every response
- **WebSocket**: real-time connection stability, message integrity

The output is a structured **QA_REPORT.md** file that becomes your fix list.

---

## HOW TO USE CHROME DEVTOOLS MCP

Before running any test prompt, verify the MCP is connected:
1. Open your agent (Cursor/Windsurf) with Chrome DevTools MCP enabled
2. Both servers must be running:
   - Backend: `http://localhost:3000`
   - Frontend: `http://localhost:5173`
3. Open Chrome and navigate to `http://localhost:5173`
4. Open DevTools (F12) and confirm the MCP connection

The agent can now control Chrome DevTools programmatically.
All test results will be written to `/QA_REPORT.md` in your project root.

---

## ▶ TEST SESSION 1 — PERFORMANCE AUDIT

**Model: Claude Sonnet 4.6**
**Paste this prompt into Agent:**

```
Read @MASTER_EXECUTION_FILE.md and @AGENT_INSTRUCTIONS.md.
You are a QA engineer running Chrome DevTools performance tests.

Use the Chrome DevTools MCP to run the following tests. For each test:
1. Navigate to the URL
2. Run the specified DevTools command
3. Record the result
4. Write results to /QA_REPORT.md

AUTHENTICATION: First, log in as buyer1@platform.local / Buyer@Secure123 to establish a session.

TEST P-01 — Login Page Load Performance:
Navigate to http://localhost:5173/login
Run Lighthouse performance audit (mobile preset)
Record: Performance score, FCP (First Contentful Paint), LCP (Largest Contentful Paint),
TBT (Total Blocking Time), CLS (Cumulative Layout Shift), TTI (Time to Interactive)
PASS criteria: Performance score ≥ 80, FCP < 1.5s, LCP < 2.5s, CLS < 0.1
Screenshot the Lighthouse report summary.

TEST P-02 — Buyer Dashboard Load Performance:
Login as buyer1, navigate to http://localhost:5173/buyer
Wait for all API calls to complete (network idle)
Record: Time to first meaningful paint, number of network requests, total transfer size
Run Performance panel: record 3 seconds, check for long tasks > 50ms
PASS criteria: Dashboard visible in < 2s, no long tasks > 200ms

TEST P-03 — RFQ Detail Page with Live Rankings:
Navigate to an active RFQ detail page (create one if needed)
Record: Time to WebSocket connection established
Record: Time from page load to first ranking data displayed
Run Network panel filter: check all XHR/Fetch requests complete with 200
Check: no requests pending after 3 seconds
PASS criteria: WebSocket connected < 2s, rankings visible < 3s

TEST P-04 — Bundle Size Audit:
Navigate to http://localhost:5173
In Network panel, filter by JS files
Record: main bundle size, largest chunk size, total JS transferred
Run: Application panel → check for any large assets (images, fonts)
PASS criteria: Total JS < 500KB (gzipped), no single chunk > 200KB (gzipped)

TEST P-05 — Supplier Bid Page Load:
Login as supplier1@platform.local / Supplier@Secure1
Navigate to an active RFQ bid page
Record: Time to BidEntryForm interactive (user can type in price inputs)
Measure: Input latency (type rapidly in a price input, measure lag)
PASS criteria: Form interactive < 2s, no input lag

Write all results to /QA_REPORT.md under section "## Performance Audit Results"
with PASS/FAIL for each test and specific values recorded.
```

---

## ▶ TEST SESSION 2 — CONSOLE & NETWORK HEALTH

**Model: Claude Sonnet 4.6**
**Paste this prompt into Agent:**

```
Read @MASTER_EXECUTION_FILE.md and @AGENT_INSTRUCTIONS.md.
You are a QA engineer running Chrome DevTools console and network health tests.

GOAL: Find every console error, warning, and network failure across all key pages.
Use Chrome DevTools MCP to inspect console and network panel.

For each test below:
- Clear console before navigating
- Navigate to the URL
- Perform the specified interactions
- Record ALL console messages (errors, warnings, any unexpected logs)
- Record any failed network requests (4xx, 5xx, or cancelled)
- Append results to /QA_REPORT.md under "## Console & Network Health"

TEST C-01 — Login Flow Console Health:
Clear console. Navigate to /login.
Check: zero console errors on page load.
Type invalid credentials → submit. Check: zero console errors, error displayed in UI.
Type valid buyer1 credentials → submit. Check: zero console errors during redirect.
Record any console.error or unhandled promise rejection.
PASS: zero console errors throughout.

TEST C-02 — Buyer Dashboard Network Audit:
After login, navigate to /buyer.
Open Network panel. Record:
  All API calls made (URL, method, status code, response time)
  Any requests with status 4xx or 5xx → FAIL
  Any requests taking > 500ms → NOTE
  Any duplicate requests (same URL called twice unnecessarily) → NOTE
Check: no preflight CORS errors in console.
PASS: all requests 2xx, zero console errors, zero CORS issues.

TEST C-03 — RFQ Creation Full Flow:
Navigate to /buyer/rfqs/new.
Complete all 5 steps with valid data.
Record ALL console output during:
  Step navigation (step 1→2→3→4→5)
  Form submission (POST /api/buyer/rfqs)
  Redirect to RFQ detail page
Check: no React key warnings, no prop type errors, no undefined errors.
PASS: zero console errors through entire flow.

TEST C-04 — WebSocket Connection Health:
Navigate to a live RFQ detail page (status ACTIVE).
In Console, run: performance.getEntriesByType('resource').filter(r => r.name.includes('socket'))
Verify WebSocket connection established (should see 101 Switching Protocols in Network).
Wait 30 seconds. Check: no WebSocket error events in console.
Simulate server reconnection: turn off and on backend server briefly (or mock it).
Check: reconnection happens, no unhandled errors thrown.
PASS: WebSocket connected, stable, reconnects gracefully.

TEST C-05 — Supplier Bid Submission Network:
Login as supplier1. Navigate to active RFQ.
Submit a bid. Record:
  POST /api/supplier/rfqs/:id/bids — status, response time
  Subsequent GET for ranking — status
  WebSocket message received (ranking:updated) — visible in network WS frames
Check: no race conditions (ranking update arrives after bid response).
PASS: correct sequence, all 2xx, ranking update received.

TEST C-06 — API Error Handling (Forced Errors):
In Network panel, block POST /api/buyer/rfqs/:id/close (use DevTools request blocking).
Click "Close Early" on a buyer RFQ.
Check: error appears in UI as Modal (not blank screen, not console crash).
Unblock. Try again with no block.
Check: success flow works.
PASS: UI handles network errors gracefully with no console exceptions.

Write all results with specific URLs, response codes, response times, and console messages.
Mark each PASS or FAIL with specific failure detail.
```

---

## ▶ TEST SESSION 3 — VISUAL & RESPONSIVE TESTING

**Model: Claude Sonnet 4.6**
**Paste this prompt into Agent:**

```
Read @MASTER_EXECUTION_FILE.md and @AGENT_INSTRUCTIONS.md.
You are a QA engineer running Chrome DevTools visual and responsive design tests.

For each test: use Chrome DevTools Device Emulation to set the viewport,
then inspect the page, take a screenshot, and verify the design.
Append all results to /QA_REPORT.md under "## Visual & Responsive Testing".

DESIGN REFERENCE: All measurements and colors from @AGENT_INSTRUCTIONS.md Part 4 Design Tokens.

TEST V-01 — Design Token Verification (Desktop 1440px):
Set viewport: 1440 × 900.
Navigate to each main page. For each page run in Console:
  getComputedStyle(document.body).backgroundColor → should be rgb(245, 245, 247)
  getComputedStyle(document.querySelector('.card-class')).backgroundColor → rgb(255,255,255)
Record: any pages where background is NOT the correct off-white.
PASS: all pages have correct #F5F5F7 background.

TEST V-02 — Sidebar Dimensions:
Desktop 1440px. Navigate to /buyer.
In Console: document.querySelector('[data-sidebar]').offsetWidth → should be 240
Check: sidebar right border is 1px solid #E5E5EA
Check: nav items are 40px height
Check: sidebar is white, not grey
PASS: sidebar exactly 240px, correct styling.

TEST V-03 — Badge Color Accuracy:
Navigate to a page with multiple status badges (RFQ list is best).
For each badge type, in Console:
  getComputedStyle(element).backgroundColor and color
Verify against exact values in @AGENT_INSTRUCTIONS.md Status Badges section.
Spot check: ACTIVE badge should be bg rgb(232,245,233) text rgb(40,167,69)
PASS: all badges match design tokens exactly.

TEST V-04 — Mobile Supplier Experience (375px):
Set viewport: 375 × 812 (iPhone SE/14 mini equivalent).
Login as supplier1. Navigate to an active RFQ.
Check:
  document.body.scrollWidth should be ≤ 375 (no horizontal overflow)
  All buttons visible and not clipped
  BidEntryForm: price inputs visible, tappable
  CountdownTimer: visible and readable
  RankDisplayWidget: full width, text not truncated
  Sidebar: not visible (collapsed to hamburger)
Take screenshot at each check.
PASS: no horizontal overflow, all elements accessible.

TEST V-05 — Mobile Buyer RFQ Creation (375px):
Viewport: 375px. Login as buyer1. Navigate to /buyer/rfqs/new.
Step through all 5 wizard steps.
Check at each step: no horizontal overflow, buttons tappable, inputs full width.
Step 4 (suppliers): supplier list scrollable, select works.
PASS: entire flow usable at 375px.

TEST V-06 — Tablet View (768px):
Viewport: 768 × 1024.
Navigate to: login, buyer dashboard, RFQ detail page, supplier RFQ view.
Check: sidebar visible (if configured for tablet), content properly laid out.
Take screenshot at each page.
PASS: content readable, no layout breaks.

TEST V-07 — Empty State Visual Check:
On RFQ list with no RFQs (use a fresh buyer account):
  Check: empty state icon visible (40px), heading text present, subtext present
  Check: icon color is approximately #D2D2D7 (light grey)
On compliance flags tab with no flags:
  Check: green checkmark icon, "All clear" text
On supplier dashboard with no assignments:
  Check: descriptive empty state with guidance text
PASS: all empty states have icon + heading + subtext, no blank areas.

TEST V-08 — Loading State Visual:
Throttle network to "Slow 3G" in DevTools.
Navigate to RFQ list page.
Check: skeleton loading appears (NOT a blank area, NOT a spinner for the table).
Check: skeleton has shimmer animation.
Unthrottle. Verify skeleton replaced by actual content.
PASS: skeleton visible during load, no blank flash.

For each test, take a screenshot and note whether it PASSES or FAILS.
Write detailed results to /QA_REPORT.md.
```

---

## ▶ TEST SESSION 4 — SECURITY & HEADERS AUDIT

**Model: Claude Opus 4.6**
**Paste this prompt into Agent:**

```
Read @MASTER_EXECUTION_FILE.md and @AGENT_INSTRUCTIONS.md.
You are a QA security engineer running Chrome DevTools security audits.

Use Chrome DevTools MCP to inspect security headers, storage, and data isolation.
Append all results to /QA_REPORT.md under "## Security Audit".

TEST S-01 — HTTP Security Headers:
Navigate to http://localhost:3000/api/health (or any API endpoint).
In Network panel, click the request and inspect Response Headers.
Verify presence of (added by helmet middleware from Sprint 10):
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY or SAMEORIGIN
  X-XSS-Protection (or CSP header)
  Strict-Transport-Security (may not apply to localhost — note this)
  Content-Security-Policy (if configured)
Record: exact header values or their absence.
PASS: all critical headers present.

TEST S-02 — Auth Token Storage:
Login as buyer1.
In Application panel → Local Storage → check http://localhost:5173
Assert: NO access token stored in localStorage
Assert: NO refresh token visible in localStorage
In Cookies → check: HttpOnly cookie should be set for refresh token
  (it won't be readable via JS but should appear in DevTools Application panel)
PASS: access token not in localStorage, HttpOnly cookie set.

TEST S-03 — Supplier Data Isolation (Live Test):
Open two browser tabs (or incognito):
  Tab 1: Login as supplier1
  Tab 2: Login as supplier2
Both navigate to the same active RFQ.
In Tab 1 (supplier1), open Network panel.
supplier1 submits a bid.
Inspect all responses to /api/supplier/* in Tab 1:
  In Console: run JSON.parse on each response body
  Look for supplier2's name, code, or prices
  Look for any field named: competitor, other_supplier, rank_position, total_bidders
Assert: none found.
In Tab 2 (supplier2), same inspection.
PASS: neither supplier can see the other's data in any API response.

TEST S-04 — RBAC Enforcement (Browser Test):
Login as supplier1.
In Console, attempt: fetch('/api/buyer/rfqs', {headers: {Authorization: 'Bearer ' + localStorage.getItem('...')}})
Or use Network tab to manually send a request to a buyer endpoint.
Assert: response is 403 Forbidden.
Login as buyer1.
Attempt to access /api/admin/users in Console fetch.
Assert: 403.
PASS: all cross-role attempts return 403.

TEST S-05 — WebSocket Message Inspection:
Login as supplier1. Navigate to active RFQ.
In Network panel, filter by WS (WebSocket).
Click the WebSocket connection. View "Messages" tab.
Inspect all incoming messages from server to supplier1.
Assert: no message contains competitor prices or competitor codes.
Look for "ranking:updated" messages — assert they only contain own rank_color and proximity_label.
PASS: WebSocket messages contain no competitor data.

TEST S-06 — Session Expiry:
Login as buyer1.
In Application panel → Cookies → delete the refresh token cookie.
Wait 15 minutes (or manually set JWT to expired state if possible in dev mode).
Make an API call (navigate to a page that loads data).
Assert: user is redirected to /login.
Assert: no sensitive data visible after logout.
PASS: session expires and redirects correctly.

TEST S-07 — XSS Resistance:
Login as buyer1. Create a new RFQ.
In item description field, enter: <script>alert('XSS')</script>
Submit. Navigate to RFQ detail page.
Assert: no alert dialog appears.
In Console: inspect the rendered HTML — the script tag should be rendered as text, not executed.
PASS: XSS payload stored as literal text, not executed.

Write all results to /QA_REPORT.md with PASS/FAIL and exact evidence.
```

---

## ▶ TEST SESSION 5 — ACCESSIBILITY AUDIT

**Model: Claude Sonnet 4.6**
**Paste this prompt into Agent:**

```
Read @MASTER_EXECUTION_FILE.md and @AGENT_INSTRUCTIONS.md.
You are a QA accessibility engineer running Chrome DevTools accessibility audits.

Use Chrome DevTools MCP. Append results to /QA_REPORT.md under "## Accessibility Audit".

TEST A-01 — Lighthouse Accessibility Audit:
Navigate to /login. Run Lighthouse audit → Accessibility category.
Record: overall score. List all flagged issues.
Navigate to /buyer/rfqs (RFQ list). Run Lighthouse Accessibility.
Navigate to a supplier RFQ view. Run Lighthouse Accessibility.
PASS criteria: score ≥ 90 on all pages.

TEST A-02 — Keyboard Navigation:
Navigate to /login. Press Tab.
Verify: focus moves to email input first, then password, then button.
Verify: focus ring is visible (should be blue glow matching design tokens).
Press Enter on Sign In → same as clicking.
Navigate to /buyer/rfqs. Tab through: verify all interactive elements (buttons, links, table rows) reachable.
Press Escape when a Modal is open → modal closes.
PASS: all interactive elements keyboard accessible, visible focus ring.

TEST A-03 — ARIA Attributes:
In Console on a page with a Modal open:
  document.querySelector('[role="dialog"]') → should exist
  document.querySelector('[aria-modal="true"]') → should exist
  document.querySelector('[aria-labelledby]') → should match modal title id
On RankDisplayWidget:
  element.getAttribute('aria-live') → should be "polite"
On form inputs:
  label elements should be associated via htmlFor / id pairs
PASS: all ARIA attributes correctly set.

TEST A-04 — Color Contrast (Critical):
In Elements panel, select each of these text/bg combinations and run:
  Chrome Accessibility panel → inspect contrast ratio
  Body text (#1D1D1F on #FFFFFF): ratio should be > 18:1 (AAA)
  Secondary text (#6E6E73 on #FFFFFF): ratio should be > 4.5:1 (AA)
  Badge text on badge bg (ACTIVE green): verify ≥ 4.5:1
  Error text (#D32F2F on white): verify ≥ 4.5:1
  Button text (white on #0071E3): verify ≥ 4.5:1
PASS: all combinations ≥ 4.5:1 (AA standard minimum).

TEST A-05 — Rank Signal Accessibility (Critical):
Navigate to supplier RFQ view with a submitted bid.
Inspect RankDisplayWidget:
  The color block must have a text label (not just a colored block)
  Screen reader test: use DevTools Accessibility tree panel
    → the widget should announce "You are currently the most competitive" or equivalent
  aria-live="polite" must be set so rank changes are announced
PASS: rank communicated via text + color, aria-live set.

TEST A-06 — Form Error Accessibility:
Submit a form with validation errors (e.g., empty required fields).
Inspect error messages:
  Each error message element should have role="alert" or be associated with its input via aria-describedby
  Error messages should be readable by DevTools Accessibility tree
PASS: form errors programmatically associated with inputs.

Record all issues found with: page, element, specific failure, suggested fix.
Write detailed results to /QA_REPORT.md.
```

---

## ▶ TEST SESSION 6 — REAL-TIME FEATURE STRESS TEST

**Model: Claude Opus 4.6**
**Paste this prompt into Agent:**

```
Read @MASTER_EXECUTION_FILE.md and @AGENT_INSTRUCTIONS.md.
You are a QA engineer stress-testing real-time features using Chrome DevTools.

Setup required before running:
- One buyer account: buyer1@platform.local
- Three supplier accounts: supplier1, supplier2, supplier3
- An active RFQ with a bid window that is currently open
- All three suppliers have accepted the RFQ

Open THREE Chrome windows (or use incognito for isolation):
  Window 1: buyer1 — on the Live Rankings tab of the active RFQ
  Window 2: supplier1 — on their RFQ bid view
  Window 3: supplier2 — on their RFQ bid view

Append all results to /QA_REPORT.md under "## Real-Time Feature Stress Test".

TEST R-01 — Simultaneous Bid Submission:
In Window 2 (supplier1): submit a bid with prices.
IMMEDIATELY (within 1 second): in Window 3 (supplier2): submit a bid with different prices.
This tests the anti-snipe race condition (if close to deadline) and ranking update.

In Window 1 (buyer): verify:
  Ranking table updates to show both suppliers within 3 seconds
  No duplicate entries in ranking table
  No page error or blank area

In Window 2 (supplier1): verify:
  RankDisplayWidget shows correct color (GREEN if their total is lower)
  Widget updated without page refresh

In Window 3 (supplier2): verify:
  RankDisplayWidget shows correct color
  Different color from supplier1 if prices differ

Record: time from submission to rank update visible in buyer window (should be < 3s).
PASS: ranks update correctly for all three views, no race condition visible.

TEST R-02 — Anti-Snipe WebSocket Broadcast:
Create (or find) a test RFQ with bid_close_at within the next 5 minutes and
anti_snipe_window_minutes >= 5 (so next submission will trigger extension).
Window 1 (buyer) on Live Rankings tab — note current countdown.
Window 2 (supplier1) — submit a revision.
In Window 1: verify countdown timer updated to new (extended) close time.
Toast appears: "Bid window extended — new close: [time]"
In Window 2: verify same toast appears.
Record: time from submission to timer update (should be < 3s).
PASS: anti-snipe extension broadcast to all connected clients within 3s.

TEST R-03 — Manual Close Broadcast:
Window 1 (buyer): click "Close Early" → confirm.
Window 2 (supplier1): verify:
  "Bid Closed" banner appears without page refresh
  BidEntryForm / RevisionForm becomes read-only
  Toast: "Bid window has closed"
Window 3 (supplier2): same verification.
Record: time from buyer close action to supplier UI update (should be < 3s).
PASS: close event propagates to all supplier views in real-time.

TEST R-04 — WebSocket Reconnection:
Window 2 (supplier1) is on active RFQ.
In DevTools Network panel → WS connection → right-click → close.
Observe: reconnecting badge appears in UI.
After 3 seconds: verify WebSocket reconnects automatically.
Have buyer submit an update (or any server event).
Verify: supplier1 receives the event after reconnection.
PASS: reconnection happens within 5s, events resume delivery.

TEST R-05 — Cooling Time UI:
Supplier1 submits a bid (revision 1 if initial already submitted).
Immediately attempt revision again.
Verify:
  API returns COOLING_TIME_ACTIVE with seconds_remaining
  RevisionForm shows cooling overlay with live countdown
  Countdown counts down in real-time (MM:SS ticking)
  After countdown reaches zero: overlay disappears, form is interactive again
Record: countdown accuracy (compare to actual server cooling time).
PASS: cooling overlay appears, countdown accurate, form unlocks at correct time.

Write all test results with timing measurements and pass/fail status.
Note any visual glitches or race conditions observed.
```

---

## ▶ GENERATE QA REPORT

**Run this prompt LAST — after all 6 test sessions:**

```
Read @QA_REPORT.md in full.
You are a senior QA lead reviewing the test results from all 6 test sessions.

Compile a final QA_REPORT.md with this structure:

# QA REPORT — Procurement Bidding Platform
Date: [today]
Backend: http://localhost:3000
Frontend: http://localhost:5173
Tester: Claude [model]

## EXECUTIVE SUMMARY
Overall status: PASS / FAIL / PARTIAL
Tests run: X total
Tests passed: X
Tests failed: X
Critical failures: X (failures that block production deployment)
Non-critical issues: X (cosmetic or minor)

## CRITICAL FAILURES (Fix immediately — blocks deployment)
For each:
### CF-[N]: [Short title]
**Test:** [which test ID]
**Severity:** CRITICAL
**Description:** [what is wrong]
**Evidence:** [console error / screenshot path / network log]
**Root cause hypothesis:** [likely cause]
**Fix guidance:**
  File to check: [most likely file path]
  What to look for: [specific thing to check]
  Suggested fix: [concrete suggestion]

## NON-CRITICAL ISSUES (Fix before release)
Same format, severity: HIGH / MEDIUM / LOW

## PASSED TESTS (All confirmed working)
List of all test IDs that passed with brief note.

## PERFORMANCE BENCHMARKS
Table: Page | Load Time | Score | Status

## SECURITY CHECKLIST
All SEC-T tests verified: list each with PASS/FAIL.
Header audit: list headers found and any missing.

## ACCESSIBILITY SCORE
Page-by-page Lighthouse accessibility scores.

## RECOMMENDED FIX ORDER
Prioritised numbered list of all issues to fix, most critical first.

## HOW TO RETEST AFTER FIXES
For each fix: which test(s) to rerun to verify the fix.
```

---

# PART 6 — BUG FIX LIBRARY
## Model: GPT-5.3-Codex (use ONLY for bug fixes — never for new features)
## Or: Claude Sonnet 4.6 if GPT is unavailable

---

## BUG FIX PROTOCOL

Every bug fix must follow this exact process:
```
1. IDENTIFY:  exact file path and line number(s)
2. DIAGNOSE:  root cause in 1–3 sentences
3. IMPACT:    which FR / NFR / SEC-T is violated
4. FIX:       minimal diff — no extra changes
5. VERIFY:    which specific test now passes
6. PRESERVE:  confirm all 6 system invariants intact
```

**The 6 System Invariants (NEVER violate these):**
```
1. Supplier API responses never contain competitor prices, codes, or rank positions
2. Audit log records never modified or deleted
3. Server timestamps authoritative for all time-sensitive operations
4. Bid records immutable once inserted
5. Commercial lock enforced once triggered — no bypass
6. All 3 revision rules (count + min change + cooling) all enforced simultaneously
```

---

## BUG FIX PROMPT TEMPLATE

**Fill in the [brackets] then paste into Agent:**

```
Read @MASTER_EXECUTION_FILE.md and @AGENT_INSTRUCTIONS.md.
You are a Bug Fix Engineer. Follow the Bug Fix Protocol from Part 6 of @AGENT_INSTRUCTIONS.md.

ENVIRONMENT: Windows PowerShell. Docker running. Node.js backend at localhost:3000.

FAILING TEST OR ERROR:
[Paste exact error output or test failure here — the complete message, not a summary]

FILE(S) INVOLVED:
@[full file path — e.g., backend/src/modules/ranking/ranking.service.ts]

EXPECTED BEHAVIOR:
[1–2 sentences describing what should happen]

ACTUAL BEHAVIOR:
[1–2 sentences describing what is actually happening]

CONTEXT:
Sprint: [which sprint built this]
Related FR: [e.g., FR-06.4]
Related SEC-T: [if applicable, e.g., SEC-T01]

Instructions:
1. Read the file(s) referenced above
2. Identify the exact line where the bug originates
3. Diagnose the root cause
4. Write the minimal fix (only change what is broken)
5. Do not add features, refactor architecture, or change test logic
6. Confirm all 6 system invariants from Part 6 of @AGENT_INSTRUCTIONS.md are preserved
```

---

## PRE-WRITTEN FIXES FOR KNOWN PROBLEMS

### FIX-01: ECONNREFUSED during integration tests

```
Read @MASTER_EXECUTION_FILE.md. Bug fix protocol: Part 6 of @AGENT_INSTRUCTIONS.md.

Error: ECONNREFUSED 127.0.0.1:5432 or :5433 or :6379

Diagnose in order:
1. Is Docker running? Run: docker-compose up -d. Wait 10s. Retry.
2. Does /backend/.env.test exist? Must contain:
   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/procurement_test
   REDIS_URL=redis://localhost:6379/1
   NODE_ENV=test
3. Does jest.setup.ts (or jest.config.ts) load .env.test?
   Add: require('dotenv').config({ path: '.env.test' })
4. Is the test container named procurement-postgres-test on port 5433?
   Check docker-compose.yml. Add if missing.
5. Does the procurement_test database exist inside that container?
   Add to jest globalSetup: CREATE DATABASE IF NOT EXISTS procurement_test;

Fix only the environment configuration. Do not change test logic.
```

### FIX-02: PowerShell npm script fails

```
Read @MASTER_EXECUTION_FILE.md. Bug fix protocol: Part 6 of @AGENT_INSTRUCTIONS.md.

Error: npm scripts fail in PowerShell with KEY=VALUE syntax.

Root cause: PowerShell doesn't support bash env var syntax (NODE_ENV=test npm run script).

Fix: Install cross-env (npm install cross-env --save-dev).
Update ALL npm scripts in package.json to use:
  "test:unit": "cross-env NODE_ENV=test jest --testPathPattern=unit"
  (replace any KEY=VALUE prefix with cross-env KEY=VALUE)

Do not change any test logic. Only fix package.json scripts.
```

### FIX-03: Competitor data leaking to supplier (CRITICAL — SEC-T01 / SEC-T02)

```
Read @MASTER_EXECUTION_FILE.md. Bug fix protocol: Part 6 of @AGENT_INSTRUCTIONS.md.

CRITICAL: System Invariant 1 is violated.
Bug: Supplier endpoint returns competitor prices, codes, or rank positions.
Failing tests: SEC-T01 and/or SEC-T02

Files to check:
@backend/src/modules/ranking/ranking.serializer.ts
@backend/src/modules/ranking/ranking.controller.ts

The supplier-facing response MUST use an ALLOWLIST — explicitly construct the object:
{
  rank_color: "GREEN" | "YELLOW" | "RED",
  proximity_label: "VERY_CLOSE" | "CLOSE" | "FAR",
  own_prices: [{ rfq_item_id: string, unit_price: number, total_price: number }]
}

NEVER use: ...spread, Object.assign, or copy of the full ranking object.
NEVER delete fields from a copy — always construct from scratch.
This is a structural fix, not a policy fix.

Do not proceed with any other work until SEC-T01 and SEC-T02 pass.
```

### FIX-04: Rank colors incorrect

```
Read @MASTER_EXECUTION_FILE.md. Bug fix protocol: Part 6 of @AGENT_INSTRUCTIONS.md.

Bug: Supplier rank color signals incorrect.
File: @backend/src/modules/ranking/ranking.service.ts

Correct behavior (FR-06.4):
  L1 (lowest total price, or tied for lowest) = GREEN
  L2 (second lowest, or tied for second) = YELLOW
  L3 and below = RED
  Ties: all suppliers with equal prices share the same rank level
  Supplier with no bid: no rank color (omit from ranking)

Proximity (% gap from L1 total):
  ≤ 2%: VERY_CLOSE
  > 2% and ≤ 10%: CLOSE
  > 10%: FAR
  Supplier IS L1, or only 1 bidder: no proximity signal

Fix only the rank assignment and proximity calculation logic.
Do not touch any other module.
```

### FIX-05: WebSocket ranking updates not received

```
Read @MASTER_EXECUTION_FILE.md. Bug fix protocol: Part 6 of @AGENT_INSTRUCTIONS.md.

Bug: Clients do not receive ranking:updated event after bid submission.
Files to check in order:
@backend/src/modules/bidding/bidding.service.ts
@backend/src/modules/ranking/ranking.service.ts
@backend/src/websocket/websocket.gateway.ts

Diagnose each step:
1. After bid saved: does bidding service call ranking service?
2. After ranking calculated: does ranking service publish to Redis?
   Check: redisClient.publish(rfq:${rfqId}:rankings, JSON.stringify(data))
3. Does WebSocket gateway subscribe to Redis?
   Check: subscriber.subscribe(rfq:*:rankings)
4. Does gateway emit to correct rooms?
   Check: io.to(rfq:${rfqId}:supplier:${supplierId}).emit('ranking:updated', supplierPayload)
   Check: io.to(rfq:${rfqId}:buyer).emit('ranking:updated', fullPayload)
5. Does client subscribe to correct room on connect?
   Check: socket.emit('subscribe:rfq', { rfqId })

Fix only the broken step in the chain.
```

### FIX-06: Audit hash chain fails verification

```
Read @MASTER_EXECUTION_FILE.md. Bug fix protocol: Part 6 of @AGENT_INSTRUCTIONS.md.

Bug: verifyAuditChain returns { valid: false } when it should return true.
File: @backend/src/modules/audit/audit.service.ts

Correct hash algorithm (FR-08.2):
  Genesis: previous_hash = crypto.createHash('sha256').update('GENESIS').digest('hex')
  Each entry: hash = crypto.createHash('sha256')
    .update(JSON.stringify(event_data, Object.keys(event_data).sort()) + previous_entry_hash)
    .digest('hex')

NOTE: JSON.stringify must use sorted keys to be deterministic.
  Correct: JSON.stringify(obj, Object.keys(obj).sort())
  Wrong: JSON.stringify(obj) — key order not guaranteed across Node versions

NOTE: Concatenation order — event_data string FIRST, then previous_hash.
  Correct: stringify(event_data) + previous_hash
  Wrong:   previous_hash + stringify(event_data)

NOTE: Entries must be fetched in ORDER BY created_at ASC for chain to be correct.

Fix only the hash computation. Do not change what triggers the audit entry.
```

### FIX-07: Anti-snipe triggers twice on simultaneous submissions

```
Read @MASTER_EXECUTION_FILE.md. Bug fix protocol: Part 6 of @AGENT_INSTRUCTIONS.md.

Bug: When two suppliers submit simultaneously near deadline, bid_close_at is
extended twice instead of once.
File: @backend/src/modules/bidding/bidding.service.ts

Root cause: race condition — both transactions read bid_close_at before either extends it.

Fix: Use SELECT FOR UPDATE on the rfq row inside the extension transaction.
After locking the row, re-read bid_close_at inside the transaction.
Only extend if: (bid_close_at - now) is STILL within the anti_snipe_window.
If already extended (bid_close_at is already beyond window): do nothing for second call.

Transaction structure:
  BEGIN
  SELECT * FROM rfqs WHERE id = $1 FOR UPDATE  ← locks the row
  IF (bid_close_at - NOW()) <= anti_snipe_window:
    UPDATE rfqs SET bid_close_at = bid_close_at + interval '$n minutes'
    INSERT INTO audit_log (DEADLINE_EXTENDED event)
  COMMIT

The SELECT FOR UPDATE ensures only one transaction extends at a time.

Test: E2E-03 anti-snipe test must pass after this fix.
```

---

# PART 7 — PROGRESS TRACKING

**Copy this into your PROGRESS.md and keep it updated throughout the build.**

```markdown
# Build Progress — Procurement Bidding Platform
Last updated: [date and time]
Current status: [what you're working on right now]

## Environment
OS: Windows / PowerShell
Node.js: [run: node -v]
Docker: Running ✅
PostgreSQL main: localhost:5432
PostgreSQL test: localhost:5433
Redis: localhost:6379
Backend URL: http://localhost:3000
Frontend URL: http://localhost:5173

---

## PHASE 1 — Core Backend
- [x] Sprint 1 — Auth, RBAC, supplier codes, tokenized links
- [x] Sprint 2 — RFQ creation, commercial lock, supplier assignment
- [x] Sprint 3 — Bidding engine, ranking, WebSocket
- [x] Sprint 4 — Bid locking, audit hash chain, exports, award

## PHASE 2 — Intelligence Backend
- [x] Sprint 5 — Compliance flags (FLAG-01 to FLAG-05)
- [x] Sprint 6 — Supplier credibility system
- [x] Sprint 7 — Weighted ranking, KPI dashboard

## PHASE 3 — Advanced Backend
- [~] Sprint 8 — Negotiation mode  ← IN PROGRESS
- [ ] Sprint 9 — Award simulation (full modes)
- [ ] Sprint 10 — Governance hardening + production readiness

## FRONTEND
- [ ] Prompt 1 — Setup, design system, shared UI components
- [ ] Prompt 2 — Auth store, Axios, sidebar, layout, login page
- [ ] Prompt 3 — Admin pages (dashboard, users, suppliers, audit, config)
- [ ] Prompt 4 — Buyer pages (dashboard, RFQ list, create, detail, award, KPIs)
- [ ] Prompt 5 — Supplier pages (dashboard, RFQ view, bid form, rank widget)
- [ ] Prompt 6 — E2E tests and final wiring

## CHROME DEVTOOLS QA
- [ ] Session 1 — Performance audit
- [ ] Session 2 — Console & network health
- [ ] Session 3 — Visual & responsive testing
- [ ] Session 4 — Security & headers audit
- [ ] Session 5 — Accessibility audit
- [ ] Session 6 — Real-time feature stress test
- [ ] QA Report — Compiled

---

## SECURITY TESTS (all must pass before Sprint 10 is done)
- [ ] SEC-T01 — No competitor prices in supplier ranking response
- [ ] SEC-T02 — No competitor data in supplier RFQ response
- [ ] SEC-T03 — Cross-supplier access returns 403
- [ ] SEC-T04 — Cross-buyer access returns 403
- [ ] SEC-T05 — Admin cannot use supplier endpoints
- [ ] SEC-T06 — Bid after close time rejected with 409
- [ ] SEC-T07 — Revision after max revisions → 422 REVISION_LIMIT_REACHED
- [ ] SEC-T08 — Login brute force → 429 after 5 attempts
- [ ] SEC-T09 — JWT tampered payload → 401
- [ ] SEC-T10 — Expired access token → 401
- [ ] SEC-T11 — Expired tokenized link → 401
- [ ] SEC-T12 — Audit log DELETE rejected at DB permission level
- [ ] SEC-T13 — Commercial terms edit after lock → 409
- [ ] SEC-T14 — SQL injection in text field → stored as literal text
- [ ] SEC-T15 — XSS payload → stored as text, rendered escaped

## E2E TESTS
- [ ] E2E-01 — Full happy path (17-step lifecycle)
- [ ] E2E-02 — Zero competitor data leakage
- [ ] E2E-03 — Anti-snipe time-compressed validation
- [ ] E2E-04 — Hash chain integrity verification

---

## Sprint Notes
Sprint 1 — COMPLETE
Sprint 2 — COMPLETE
Sprint 3 — COMPLETE
Sprint 4 — COMPLETE
Sprint 5 — COMPLETE
Sprint 6 — COMPLETE
Sprint 7 — COMPLETE
Sprint 8 — IN PROGRESS
[add notes here as you go]

## Known Issues
[list active issues here, remove when resolved]

## Decisions Made
[log any architectural decisions or deviations from the master file here]
```

---

# QUICK REFERENCE

| Situation | Where to go |
|---|---|
| Docker won't start or ECONNREFUSED | Environment Setup section (top of this file) |
| Sprint 1 prompt (reference) | Part 1 — Sprint 1 |
| Sprint 2 prompt (reference) | Part 1 — Sprint 2 |
| Sprint 3 prompt (reference) | Part 1 — Sprint 3 |
| Sprint 4 prompt (reference) | Part 1 — Sprint 4 |
| Sprint 5 prompt (reference) | Part 2 — Sprint 5 |
| Sprint 6 prompt (reference) | Part 2 — Sprint 6 |
| Sprint 7 prompt (reference) | Part 2 — Sprint 7 |
| **Sprint 8 — CURRENT** | **Part 3 — Sprint 8** |
| Sprint 9 prompt | Part 3 — Sprint 9 |
| Sprint 10 prompt | Part 3 — Sprint 10 |
| Start frontend | Part 4 — Prompt 1 (Setup & Design System) |
| Auth + layout | Part 4 — Prompt 2 |
| Admin pages | Part 4 — Prompt 3 |
| Buyer pages | Part 4 — Prompt 4 |
| Supplier pages | Part 4 — Prompt 5 |
| Final wiring + E2E | Part 4 — Prompt 6 |
| Performance testing | Part 5 — Session 1 |
| Console/network testing | Part 5 — Session 2 |
| Visual/responsive testing | Part 5 — Session 3 |
| Security header testing | Part 5 — Session 4 |
| Accessibility testing | Part 5 — Session 5 |
| Real-time stress testing | Part 5 — Session 6 |
| Generate QA report | Part 5 — Generate QA Report |
| Something is broken | Part 6 — Bug Fix Template |
| ECONNREFUSED | Part 6 — FIX-01 |
| PowerShell script fails | Part 6 — FIX-02 |
| Competitor data leaking 🚨 | Part 6 — FIX-03 |
| Rank colors wrong | Part 6 — FIX-04 |
| WebSocket updates missing | Part 6 — FIX-05 |
| Hash chain broken | Part 6 — FIX-06 |
| Anti-snipe triggers twice | Part 6 — FIX-07 |
| Update build status | Part 7 — PROGRESS.md template |

---

*END OF AGENT INSTRUCTIONS v3.0*
*Place at project root alongside MASTER_EXECUTION_FILE.md and PROGRESS.md*
*Last updated: Sprint 8 in progress*
