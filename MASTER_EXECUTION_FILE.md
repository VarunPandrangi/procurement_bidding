# MASTER EXECUTION FILE
## Procurement Competitive Enquiry & Bidding Platform
### Enterprise Agile SDLC · Multi-Model Execution Protocol 

---

> ⚠️ **CRITICAL USAGE INSTRUCTION**
>
> This is the **single, authoritative, copy-paste document** for all AI model sessions.
> Copy this **entire file** when prompting any model. Do not copy partial sections.
> Each model's prompt is embedded at the end of this document.
> Models must treat this file as the **sole source of truth**. No assumptions, no extensions, no deviations.

---

# TABLE OF CONTENTS

1. [Product Vision & Philosophy](#1-product-vision--philosophy)
2. [Business Requirements — Client Vision](#2-business-requirements--client-vision)
3. [Stakeholder & User Roles](#3-stakeholder--user-roles)
4. [System Context & Constraints](#4-system-context--constraints)
5. [User Requirements (UR)](#5-user-requirements-ur)
6. [Functional Requirements (FR)](#6-functional-requirements-fr)
7. [Non-Functional Requirements (NFR)](#7-non-functional-requirements-nfr)
8. [System Architecture](#8-system-architecture)
9. [Data Models & Schema Specification](#9-data-models--schema-specification)
10. [API Contract Specification](#10-api-contract-specification)
11. [Agile SDLC Plan — Sprint Breakdown](#11-agile-sdlc-plan--sprint-breakdown)
12. [Testing Strategy](#12-testing-strategy)
13. [Engineering Standards & Rules](#13-engineering-standards--rules)
14. [Definition of Done](#14-definition-of-done)
15. [Multi-Model Execution Protocol](#15-multi-model-execution-protocol)
16. [Model Prompts — Full Context](#16-model-prompts--full-context)

---

# 1. PRODUCT VISION & PHILOSOPHY

## 1.1 Product Name
**Procurement Competitive Enquiry & Bidding Platform**

## 1.2 Problem Statement
Traditional procurement enquiry processes are informal, unstructured, and audit-indefensible. Buyers collect quotes via email, prices are manually compared in spreadsheets, supplier identities are mutually known, and there is no controlled mechanism to drive competitive pricing behavior. This creates procurement leakage, compliance risk, and poor audit outcomes.

## 1.3 Solution Summary
A web-based platform that digitizes the full procurement price discovery lifecycle — from structured RFQ creation through anonymous competitive bidding to audit-ready award documentation — enforcing fairness, confidentiality, and governance at every step.

## 1.4 Core Philosophy

This platform is **not** a quotation collection tool.
This platform is a **controlled reverse-competition engine**.

The four pillars of the platform are:

| Pillar | Meaning |
|---|---|
| **Fair Competition** | Every supplier competes on equal terms, with identical information |
| **Supplier Anonymity** | No supplier can ever identify or infer a competitor's identity or price |
| **Buyer Control** | The buyer defines all commercial and bidding rules upfront and locks them |
| **Audit Defensibility** | Every action is immutably logged, hash-sealed, and exportable for external scrutiny |

## 1.5 Design Principles

- **Server-Side Authority**: All business rule enforcement happens on the server. The client is a display layer only.
- **Immutability First**: Audit logs, bid history, and sealed submissions are append-only and hash-verified.
- **Zero Information Leakage**: The system is architected so that competitor data leakage is structurally impossible, not just policy-constrained.
- **Commercial Lock Before Competition**: Once a supplier accepts an RFQ, commercial terms are frozen. Only price can change.
- **No Trust in Timestamps**: All time-sensitive operations use server-generated timestamps exclusively.

---

# 2. BUSINESS REQUIREMENTS — CLIENT VISION

> 📌 **Note to All AI Models**
>
> This section captures the verbatim intent of the client who commissioned this platform. The client is a **non-technical procurement professional**. They expressed these requirements in plain business language. Your job is to honour every line of their intent faithfully, even where they did not specify a technical implementation. Every Business Requirement (BR) in this section is traced to one or more Functional Requirements (FRs) in Section 6. No BR may be left unimplemented. If a BR appears ambiguous technically, resolve it conservatively — do not drop it or silently narrow its scope.

---

## 2.1 Why This Platform Exists — Client's Own Words

The client's stated purpose is to **"digitize and discipline the procurement enquiry and price discovery process."**

Their existing process (the problem they are escaping) involves collecting supplier quotes by email or phone, comparing them manually in spreadsheets, and making award decisions without a structured record. This creates:
- Price leakage (suppliers learn each other's prices through informal channels)
- No competitive pressure (suppliers can quote high without fear of comparison)
- Audit indefensibility (no immutable record of how an award decision was made)
- Inconsistency (different buyers in the same organization run enquiries differently)

The platform they want is not just a digital form — it is a **discipline engine** that enforces rules the client currently cannot enforce manually.

---

## 2.2 Business Requirements (BR)

Each BR is written as the client expressed it (business language), followed by the engineering interpretation and its FR traceability.

---

### BR-01 — Structured RFQ Creation

**Client's Statement:**
> "I want to send suppliers a proper, structured enquiry — not just an email. It should have the item details, quantities, specifications, and all my commercial conditions in one place. The supplier should see exactly what I need and on what terms."

**Engineering Interpretation:**
The system must provide a structured RFQ creation form that produces a complete, unambiguous enquiry document. This document must include a line-item table (item description, specification, UOM, quantity) and a full set of commercial terms (payment, freight, delivery, taxes, warranty, validity, packing, special conditions). All suppliers assigned to the RFQ must receive the **same** document — no variation per supplier.

**Traces to:** FR-02 (RFQ Creation), FR-03 (Commercial Lock), FR-04 (Supplier Acceptance)

---

### BR-02 — Competitive Bidding Without Price Disclosure

**Client's Statement:**
> "I want suppliers to compete on price, but I don't want them to know what the others are quoting. If they know each other's prices, they'll stop competing. I also don't want them to know how many others are bidding."

**Engineering Interpretation:**
The anonymity requirement is absolute and architectural — not a setting or a policy. Supplier-facing APIs must structurally return only: the supplier's own submitted prices, their rank color, and a proximity signal. No competitor price, no competitor identity, no competitor code, no total bidder count may ever reach a supplier through any channel (REST API, WebSocket, export). This is enforced by allowlist-based response serializers and validated by mandatory security tests.

**Traces to:** FR-01.6 (Supplier Code), FR-06.4 (Supplier Rank Display), FR-06.6 (No Price Disclosure), NFR-01.4, SEC-T01, SEC-T02

---

### BR-03 — Real-Time Rank Signals for Suppliers

**Client's Statement:**
> "When a supplier submits their price, they should know if they're winning or not — but without seeing the actual numbers. I want them to keep revising and competing. A green/yellow/red system is what I have in mind."

**Engineering Interpretation:**
After every bid submission by any supplier, the system must recalculate rankings and push updated rank signals to all connected suppliers within 3 seconds via WebSocket. The signal must convey competitive position (L1 = Green, L2 = Yellow, L3+ = Red) and proximity to the leader (Very Close / Close / Far). This creates continuous competitive pressure without disclosing prices. The psychological goal is to motivate the L2 and L3+ suppliers to revise downward.

**Traces to:** FR-06.1–FR-06.4, NFR-02.2

---

### BR-04 — Buyer Sees Full Rankings

**Client's Statement:**
> "As the buyer, I should be able to see who is offering what, ranked from lowest to highest. I also want to be able to weigh things like delivery time and payment terms — not just price — when deciding who to award to."

**Engineering Interpretation:**
The Buyer's ranking dashboard is the inverse of the Supplier's view — it shows full competitive information. The buyer sees: item-wise L1 rankings with supplier codes and prices, total RFQ rankings, and a weighted ranking that combines price, delivery, and payment scores. The buyer configures the weights per RFQ. The buyer chooses which ranking logic governs their award decision.

**Traces to:** FR-06.3 (Weighted Ranking), FR-06.5 (Buyer Ranking View)

---

### BR-05 — Commercial Terms Freeze After Acceptance

**Client's Statement:**
> "Once a supplier says yes to the RFQ, I should not be able to change the terms. I've had cases where the buyer tried to sneak in new conditions after the fact. That shouldn't be possible."

**Engineering Interpretation:**
The moment any supplier formally accepts an RFQ (including mandatory declarations), the system must lock all commercial terms and the item table structure at the database level. Any subsequent attempt by the buyer to modify these fields must be rejected with an HTTP 409 error. The locked state must be recorded in the audit log with a snapshot of the locked terms. The buyer UI must display a visible lock indicator.

**Traces to:** FR-03 (Commercial Lock), FR-04.1 (Accept Flow)

---

### BR-06 — Suppliers Can Revise Within Rules

**Client's Statement:**
> "I want suppliers to be able to revise their prices during the bidding window. But I don't want them revising 50 times or making tiny 0.01% changes just to game the system. I should be able to set the rules: how many times they can revise, by how much minimum, and how long they have to wait between revisions."

**Engineering Interpretation:**
The buyer configures three revision constraints per RFQ before publication: maximum revision count, minimum percentage change per revision (applied per line item), and a cooling-time interval between revisions. All three constraints are enforced server-side. Violations return specific HTTP 422 errors with machine-readable error codes and human-readable messages so the supplier UI can display a helpful explanation (e.g., "You must wait 4 more minutes before your next revision").

**Traces to:** FR-05.2 (Revision Engine — Rules A, B, C)

---

### BR-07 — Anti-Sniping: No Last-Second Surprises

**Client's Statement:**
> "I've seen suppliers wait until the last second to revise their price, so no one has time to respond. I want the system to automatically extend the deadline if someone revises too close to closing time."

**Engineering Interpretation:**
The system monitors the gap between any bid submission timestamp and the current `bid_close_at` time. If the gap is within the configured anti-snipe window (buyer-defined, e.g., last 10 minutes), the system automatically extends `bid_close_at` by the configured extension duration (e.g., 5 more minutes). This extension applies to all suppliers on that RFQ equally, is broadcast to all connected clients via WebSocket immediately, and is recorded in the immutable audit log.

**Traces to:** FR-05.3 (Anti-Sniping Extension), FR-07 (Bid Timing & Locking)

---

### BR-08 — Complete, Unalterable Audit Trail

**Client's Statement:**
> "Everything that happens on the platform needs to be recorded and I need to be able to show it to auditors. If a supplier revised their price, I need to know exactly when and by how much. If a bid was awarded, I need to know who decided and when. Nothing should be deletable."

**Engineering Interpretation:**
Every state-changing event on the platform produces an entry in an append-only audit log table. The database user that the application connects with must have INSERT-only permissions on this table — UPDATE and DELETE are denied at the database permission level, not just the application level. Each entry is hash-chained (each entry's hash includes the previous entry's hash), creating a tamper-evident chain. The full audit trail for any RFQ is exportable as part of the Excel/PDF output.

**Traces to:** FR-08 (Audit & Integrity), NFR-03.1, SEC-T12

---

### BR-09 — Risk Flags for Bad Situations

**Client's Statement:**
> "I want the system to automatically warn me if something looks wrong — like a price that's suspiciously low, a supplier who always bids at the last minute, or if one supplier is winning everything and I might be too dependent on them."

**Engineering Interpretation:**
The system runs a flag evaluation engine after each bid submission and on RFQ close. It checks five conditions (delivery deviation, payment deviation, abnormally low price, supplier dominance, excessive late revisions) against configurable thresholds stored in the system configuration table. Flags are visible only to the Buyer on a dedicated compliance panel. No flag is visible to any Supplier. Flags are informational — they do not block award actions but must be acknowledged.

**Traces to:** FR-10 (Compliance & Risk Flags)

---

### BR-10 — Supplier Reliability History

**Client's Statement:**
> "I want to track which suppliers are reliable over time. If a supplier always drops out after winning, or never responds to RFQs, I should know that before I invite them to the next one. But they shouldn't know what score I've given them."

**Engineering Interpretation:**
The system maintains a rolling credibility score per supplier, calculated from four behavioral dimensions: response discipline (how often they accept invitations), revision behavior (whether they game revision rules), win-to-dropout ratio (whether they honor awards they win), and post-award acceptance (whether they follow through after being awarded). The score is classified as Excellent, Stable, or Risky. It is visible to Buyers during supplier selection and to Admins. It is structurally hidden from supplier-facing API responses.

**Traces to:** FR-11 (Supplier Behaviour Memory)

---

### BR-11 — Negotiation Round for High-Value Items

**Client's Statement:**
> "Sometimes after the first round of bidding, I want to go back to the top 2 or 3 suppliers for a final negotiation round — same anonymous setup, same rules, just a second chance to get the best price before I award."

**Engineering Interpretation:**
After an RFQ closes, the Buyer can optionally convert it to a Negotiation Mode event. This creates a linked child negotiation where the Buyer selects the top N suppliers (by rank) to re-invite. The same anonymity rules, revision controls, and anti-sniping apply. The negotiation has its own audit trail linked to the parent RFQ ID. The purpose is to narrow a close competition down to a final best offer without revealing prices.

**Traces to:** FR-12 (Negotiation Mode)

---

### BR-12 — Award Simulation Before Committing

**Client's Statement:**
> "Before I finalize who gets the order, I want to be able to play with different scenarios — like giving supplier A all the items, or splitting certain items between supplier A and B — and see the total cost impact before I commit."

**Engineering Interpretation:**
The Buyer can run non-binding award simulations before finalizing. The simulation engine supports three modes: award all items to one supplier, award each item to a different supplier (item-wise split), and award category groups to different suppliers. Each simulation outputs: total procurement cost, estimated delivery outcome, number of unique suppliers involved (concentration risk), and delta vs the theoretical lowest-cost outcome. Running a simulation produces no final audit event — it is explicitly non-committing.

**Traces to:** FR-13 (Award Simulation)

---

### BR-13 — Downloadable Reports

**Client's Statement:**
> "At the end, I need a proper document I can download — in Excel and PDF — that shows everything: who was invited, who bid what, the final ranking, and who was awarded. This goes into our procurement records."

**Engineering Interpretation:**
Post-close and post-award, the Buyer can generate an Excel workbook (multiple sheets: RFQ cover, item comparison with all supplier prices now revealed, audit trail, supplier summary with credibility) and a formatted PDF version. Both documents must be suitable for filing in a procurement record system and presenting to auditors. The PDF must include a hash reference footer enabling integrity verification. Generation must complete within 10 seconds (Excel) and 15 seconds (PDF) for RFQs of up to 50 line items and 20 suppliers.

**Traces to:** FR-09 (Outputs & Reporting), NFR-02.3, NFR-02.4

---

### BR-14 — Management Visibility

**Client's Statement:**
> "My management wants to see how procurement is performing — things like how long RFQs take, how much we've saved vs the last price we paid, and how competitive our suppliers are. Ideally this comes out automatically."

**Engineering Interpretation:**
The system automatically generates management KPI metrics from completed RFQ data. Metrics include: average RFQ cycle time (publication to award), savings percentage versus a configurable reference price per item, supplier participation ratio (accepted vs invited), price convergence trend (how close bids got to each other across revisions), and supplier competitiveness index (frequency of L1 positions per supplier). These are displayed on an Admin/Buyer KPI dashboard with chart visualizations and date-range filtering.

**Traces to:** FR-07 (Management KPIs — in Phase 2 Sprint 7)

---

### BR-15 — System Must Be Governable

**Client's Statement:**
> "The admin of the system needs to be able to control everything — who can use it, what the default rules are, and if something goes wrong, be able to step in. But any override they do should also be recorded."

**Engineering Interpretation:**
The Admin role has platform-wide governance authority: managing all users, configuring system defaults (thresholds for flags, default revision limits, anti-snipe windows), and performing emergency overrides. Every override action requires a mandatory justification text of minimum 50 characters. All override actions are recorded in the immutable audit log with the admin's identity, the action taken, and the justification provided.

**Traces to:** FR-14 (Admin Governance), NFR-05 (Auditability)

---

## 2.3 Business Requirements Traceability Matrix

| BR | Business Requirement | Primary FR(s) | Sprint |
|---|---|---|---|
| BR-01 | Structured RFQ Creation | FR-02, FR-03, FR-04 | Sprint 2 |
| BR-02 | Competitive Bidding Without Price Disclosure | FR-01.6, FR-06.4, FR-06.6 | Sprints 1, 3 |
| BR-03 | Real-Time Rank Signals for Suppliers | FR-06.1–FR-06.4 | Sprint 3 |
| BR-04 | Buyer Sees Full Rankings | FR-06.3, FR-06.5 | Sprint 3 |
| BR-05 | Commercial Terms Freeze After Acceptance | FR-03, FR-04.1 | Sprint 2 |
| BR-06 | Suppliers Can Revise Within Rules | FR-05.2 | Sprint 3 |
| BR-07 | Anti-Sniping: No Last-Second Surprises | FR-05.3, FR-07 | Sprint 4 |
| BR-08 | Complete, Unalterable Audit Trail | FR-08, NFR-03.1 | Sprint 4 |
| BR-09 | Risk Flags for Bad Situations | FR-10 | Sprint 5 |
| BR-10 | Supplier Reliability History | FR-11 | Sprint 6 |
| BR-11 | Negotiation Round for High-Value Items | FR-12 | Sprint 8 |
| BR-12 | Award Simulation Before Committing | FR-13 | Sprint 9 |
| BR-13 | Downloadable Reports | FR-09 | Sprint 4 |
| BR-14 | Management Visibility | Sprint 7 KPIs | Sprint 7 |
| BR-15 | System Must Be Governable | FR-14 | Sprint 10 |

---

# 3. STAKEHOLDER & USER ROLES

## 3.1 Stakeholder Map

| Stakeholder | Interest | Interaction |
|---|---|---|
| Procurement Manager (Buyer) | Price discovery, competitive awards, compliance | Primary platform user |
| Supplier / Vendor | Winning business through fair competition | Bidding interface |
| Platform Admin | Governance, user management, system health | Admin panel |
| Audit / Compliance Team | Defensible records for every procurement decision | Read-only audit exports |
| Management | KPI visibility, savings tracking | Dashboard reports |

## 3.2 Role Definitions

### 3.2.1 Admin Role

The Admin has the highest privilege level and is responsible for platform governance, not procurement operations. Admin cannot conduct or interfere in a live RFQ bidding process.

**Capabilities:**
- Create, activate, deactivate, and manage all user accounts (Buyers and Suppliers)
- Assign and modify user roles
- Onboard new suppliers into the master supplier database
- Configure global system settings (revision rules defaults, timing defaults, anti-snipe windows)
- Access the full immutable audit log for all RFQs
- Perform emergency overrides with mandatory justification logging
- View all supplier credibility scores
- Access supplier unique codes

**Restrictions:**
- Cannot submit bids
- Cannot alter bid prices
- Cannot modify closed/awarded RFQs without audit trail

### 3.2.2 Buyer Role

The Buyer is the primary operational user. Each Buyer operates independently — their RFQs, supplier selections, and awards are isolated from other Buyers.

**Capabilities:**
- Create RFQs with full item tables and commercial terms
- Select suppliers from the master list for each RFQ
- Configure RFQ-specific bidding rules (revision count, cooling time, minimum change %)
- Define bid open and close timestamps
- View live supplier rankings (colors and proximity only — no prices)
- View item-wise L1, total RFQ rankings, and weighted score rankings
- Lock bids manually before the scheduled close time
- Run award simulation (split orders, item-wise allocation)
- Finalize and publish award decisions
- Download Excel and PDF reports
- View compliance and risk flags raised by the system

**Restrictions:**
- Cannot see supplier prices during an active bid (only rankings)
- Cannot see competitor supplier identities
- Cannot modify commercial terms after at least one supplier has accepted
- Cannot backdate or alter timestamps

### 3.2.3 Supplier Role

Suppliers operate in a strictly isolated, information-constrained environment. The platform is designed so that the structural impossibility of seeing competitor data is enforced at the API and data-access layer, not merely the UI.

**Capabilities:**
- Access RFQs assigned to them only (via secure login or time-bound tokenized link)
- View the full item table and commercial terms of their assigned RFQ
- Accept participation (with mandatory declaration acceptance)
- Decline participation (with mandatory reason text)
- Enter unit prices for each line item
- Revise prices within the configured revision rules
- View their own rank color (L1 Green / L2 Yellow / L3+ Red) and proximity signal (Very Close / Close / Far from L1)
- Download their own submitted quote for records

**Restrictions:**
- Cannot see any other supplier's name, code, price, rank position number, or any identifying information
- Cannot add or remove line items from the RFQ
- Cannot modify commercial terms
- Cannot submit after bid close
- Cannot see the total number of competitors

---

# 4. SYSTEM CONTEXT & CONSTRAINTS

## 4.1 Technology Stack

| Layer | Technology |
|---|---|
| **Backend Runtime** | Node.js (LTS) with TypeScript |
| **Backend Framework** | Express.js or NestJS (Opus to decide based on clean architecture principles) |
| **Database** | PostgreSQL (primary relational store) |
| **Caching / Pub-Sub** | Redis (real-time rank push, rate limiting, cooling time enforcement) |
| **Authentication** | JWT (access + refresh token pattern) with bcrypt password hashing |
| **File Exports** | ExcelJS (Excel), PDFKit or Puppeteer (PDF) |
| **Frontend** | React 18+ with TypeScript |
| **Frontend State** | React Query (server state) + Zustand (local state) |
| **Styling** | Tailwind CSS |
| **Real-time** | WebSockets (Socket.io) for live rank updates |
| **Testing — Backend** | Jest + Supertest |
| **Testing — Frontend** | Vitest + React Testing Library + Playwright (E2E) |
| **Containerization** | Docker + Docker Compose |
| **CI** | GitHub Actions |

## 4.2 Deployment Context
- Single-tenant initially (one organization per deployment)
- Horizontally scalable API layer
- PostgreSQL with connection pooling
- Redis for session/rate-limit/cooling-time state

## 4.3 Browser Support
- Chrome, Firefox, Edge (latest 2 versions)
- Mobile responsive (tablet and above for Buyer/Admin; mobile for Supplier view)

## 4.4 Regulatory & Compliance Context
- All bid data must be retained for a minimum of 7 years (configurable)
- Audit logs must be exportable in a format suitable for external legal/compliance review
- No-collusion and confidentiality declarations must be captured with timestamp and supplier code

---

# 5. USER REQUIREMENTS (UR)

User Requirements describe what users need to accomplish — written from the user's perspective, independent of implementation.

| ID | Role | Requirement |
|---|---|---|
| UR-01 | Admin | I need to create buyer and supplier accounts and assign them appropriate roles so that access is controlled from day one. |
| UR-02 | Admin | I need to onboard suppliers with unique identifiers so that each supplier can be tracked anonymously across RFQs. |
| UR-03 | Admin | I need to view a complete, immutable audit log of all system actions so that I can produce evidence for compliance reviews. |
| UR-04 | Admin | I need to perform emergency overrides with justification so that I can handle exceptional situations without bypassing the audit trail. |
| UR-05 | Buyer | I need to create a structured RFQ with a line-item table and commercial terms so that all suppliers receive identical, unambiguous information. |
| UR-06 | Buyer | I need to select which suppliers participate in each RFQ so that competition is curated and relevant. |
| UR-07 | Buyer | I need to define bidding rules (revision count, cooling time, minimum change %) per RFQ so that I can control the dynamics of competition. |
| UR-08 | Buyer | I need to see live rankings of suppliers during an active bid — without seeing their prices — so that I understand the competitive landscape without compromising fairness. |
| UR-09 | Buyer | I need the system to automatically flag risk conditions (abnormal prices, delivery deviations, late revisions) so that my award decision is well-informed. |
| UR-10 | Buyer | I need to simulate award scenarios (split orders, item-wise allocation) before finalizing so that I can model cost and risk trade-offs. |
| UR-11 | Buyer | I need to download a final Excel and PDF report after award so that I have audit-ready documentation. |
| UR-12 | Buyer | I need commercial terms to freeze once any supplier accepts the RFQ so that the competitive basis is never retroactively changed. |
| UR-13 | Buyer | I need an anti-sniping mechanism that auto-extends the bid window if a revision occurs near closing time so that late price manipulation is neutralized. |
| UR-14 | Supplier | I need to access my assigned RFQ via a secure link or login so that I can participate without needing a complex onboarding process. |
| UR-15 | Supplier | I need to formally accept or decline an RFQ (with reason for decline) so that my participation decision is recorded. |
| UR-16 | Supplier | I need to enter and revise my prices within the defined rules so that I can respond competitively to market signals. |
| UR-17 | Supplier | I need to see my rank color and proximity to L1 after each submission so that I know how competitive I am without seeing competitor prices. |
| UR-18 | Supplier | I need to receive a confirmation receipt after each price submission so that I have a record of my participation. |

---

# 6. FUNCTIONAL REQUIREMENTS (FR)

Functional requirements define precisely what the system must do. Each FR is atomic, testable, and traceable to a user requirement.

---

## FR-01: Authentication & Session Management

**Priority:** P0 (Must Have — Blocker for all other FRs)

### FR-01.1 — Secure Login
The system must authenticate users via email and password. Passwords must be hashed using bcrypt with a minimum cost factor of 12. The system must not store plaintext passwords at any point in the data lifecycle.

### FR-01.2 — JWT Token Issuance
Upon successful authentication, the system must issue a short-lived JWT access token (15-minute expiry) and a long-lived refresh token (7-day expiry, stored as an HttpOnly cookie). The access token payload must include: user ID, role, and token issue timestamp.

### FR-01.3 — Refresh Token Rotation
Upon access token expiry, the system must accept the refresh token and issue a new access token and rotate the refresh token. Refresh tokens must be stored server-side (Redis or DB) to enable revocation.

### FR-01.4 — Tokenized Supplier Link
The system must generate a time-bound, single-use-session tokenized URL for each supplier per RFQ. This link must: (a) grant access to that supplier's RFQ view only, (b) expire after a configurable duration, (c) be invalidated after first authenticated session establishment. The link must not expose the supplier's identity or the RFQ's other participants.

### FR-01.5 — Role-Based Access Control (RBAC)
Every API endpoint must enforce role-based authorization. The roles are: `ADMIN`, `BUYER`, `SUPPLIER`. Access control must be enforced server-side on every request. UI hiding of navigation items is supplementary only and not relied upon for security.

### FR-01.6 — Supplier Unique Code
Upon supplier account creation, the system must auto-generate a unique 5-character alphanumeric code for each supplier (e.g., `A3K7M`). This code is used as the supplier's anonymous identifier in all audit logs, rankings, and export documents. The code is visible to Admin and Buyer only, never to other suppliers.

### FR-01.7 — Session Invalidation
The system must support explicit logout that invalidates the refresh token server-side. On password change, all existing sessions for that user must be invalidated.

---

## FR-02: RFQ Creation

**Priority:** P0

### FR-02.1 — RFQ Number Generation
The system must auto-generate a unique RFQ number in the format `RFQ-YYYY-NNNN` where YYYY is the current year and NNNN is a zero-padded sequential integer scoped to that buyer and year. Example: `RFQ-2025-0001`. This number is immutable once generated.

### FR-02.2 — Item Requirement Table
Each RFQ must include an item table with the following fields per line item:

| Field | Type | Editable By |
|---|---|---|
| Sl. No | Auto-increment integer | System |
| Item Description | Text (required, max 500 chars) | Buyer |
| Specification | Rich text / long text (optional, max 2000 chars) | Buyer |
| UOM (Unit of Measure) | Text (required, max 50 chars) | Buyer |
| Quantity | Positive decimal (required) | Buyer |
| Unit Price | Positive decimal (required during bid) | Supplier |
| Total Price | Computed (Quantity × Unit Price) | System |

The buyer defines all fields except Unit Price and Total Price. Suppliers may only populate Unit Price. Suppliers cannot add, remove, or reorder rows. Total Price is always computed server-side.

### FR-02.3 — Commercial Terms
Each RFQ must include the following structured commercial terms, all defined by the buyer:

| Term | Type | Notes |
|---|---|---|
| Payment Terms | Text / Dropdown | e.g., "30 days net", "50% advance" |
| Freight Terms | Dropdown + Text | EXW, FOR, CIF, CIP, custom |
| Delivery Lead Time | Integer (days) + Text | Buyer-defined target |
| Taxes & Duties | Text | GST, customs, inclusions/exclusions |
| Warranty / Guarantee | Text | Duration and scope |
| Offer Validity | Integer (days) | Minimum days quote is valid |
| Packing & Forwarding | Text | Requirements |
| Special Conditions | Long text (optional) | Free-form buyer notes |

### FR-02.4 — Bidding Rule Configuration
The buyer must configure the following rules per RFQ before publication:

| Rule | Type | Constraint |
|---|---|---|
| Maximum revisions allowed | Integer | Min: 1, Max: configurable (default: 5) |
| Minimum % change per revision | Decimal (%) | Min: 0.01%, Max: 100% |
| Cooling time between revisions | Integer (minutes) | Min: 1 minute |
| Bid open timestamp | DateTime | Must be future at time of RFQ publication |
| Bid close timestamp | DateTime | Must be after bid open |
| Anti-snipe window | Integer (minutes) | Revisions within this window extend the close time |
| Anti-snipe extension | Integer (minutes) | Duration of each extension |

### FR-02.5 — Supplier Assignment
The buyer must select at least 2 suppliers from the master supplier list for each RFQ. The system records which suppliers are assigned with a timestamp. This list is locked after publication.

### FR-02.6 — RFQ States
An RFQ must progress through the following states in order. State transitions are server-enforced:

```
DRAFT → PUBLISHED → ACTIVE (bid open) → CLOSED → AWARDED
```

- `DRAFT`: Editable by buyer. Not visible to suppliers.
- `PUBLISHED`: Visible to assigned suppliers. Supplier can accept/decline. Buyer cannot change item table or commercial terms.
- `ACTIVE`: Bid window is open. Suppliers with accepted status can submit prices.
- `CLOSED`: Bid window has ended or buyer manually closed. All supplier edits disabled. Read-only.
- `AWARDED`: Buyer has finalized award. Generates output documents.

---

## FR-03: Commercial Lock

**Priority:** P0

### FR-03.1 — Lock Trigger
The moment the first supplier accepts an RFQ, the commercial terms (as defined in FR-02.3) and the item table structure (rows, descriptions, specifications, UOM, quantities) must be locked. No modifications are permitted after this point.

### FR-03.2 — Lock Enforcement
The lock must be enforced at the API layer. Any PUT or PATCH request to modify commercial terms or item table structure after the lock trigger must return HTTP 409 Conflict with a descriptive error message: `"Commercial terms are locked. One or more suppliers have accepted this RFQ."`

### FR-03.3 — Lock Audit Entry
The lock event must be recorded in the audit log with: RFQ ID, triggering supplier code, timestamp, and the snapshot of the locked commercial terms (stored as an immutable JSON blob).

---

## FR-04: Supplier Acceptance & Declarations

**Priority:** P0

### FR-04.1 — Accept Flow
When a supplier views a published RFQ, they must explicitly accept or decline participation. The accept action requires the supplier to check three mandatory declaration checkboxes:
1. "I have read and understood the RFQ terms and conditions."
2. "I confirm that I have not colluded with any other party regarding this quotation."
3. "I understand that all submitted prices are confidential and must not be disclosed to any third party."

All three declarations must be checked before the accept button activates.

### FR-04.2 — Decline Flow
If a supplier declines, they must provide a mandatory reason (minimum 20 characters, maximum 500 characters). Declined suppliers cannot later accept the same RFQ.

### FR-04.3 — Acceptance Record
Each acceptance is recorded in the audit log with: supplier code, RFQ ID, timestamp (server-generated), declaration checkboxes checked (stored as boolean flags), and the full declaration text at the time of acceptance (snapshotted, so future changes to declaration wording do not alter historical records).

---

## FR-05: Bidding Engine

**Priority:** P0

### FR-05.1 — Price Submission
During an active bid window, a supplier who has accepted the RFQ can submit unit prices for all line items simultaneously. Partial submission (only some items) is not permitted — all items must have a valid positive price to submit. The system calculates Total Price server-side.

### FR-05.2 — Revision Engine
After initial submission, suppliers may revise prices subject to all of the following rule checks (enforced server-side):

**Rule Check A — Revision Count:**
The system must track the number of revisions per supplier per RFQ. If `current_revision_count >= max_revisions_configured`, the revision must be rejected with HTTP 422 and message: `"Maximum revision limit reached. No further revisions permitted."`

**Rule Check B — Minimum Change:**
For each revised line item, the percentage change from the previous submitted price must meet or exceed the configured minimum. Calculate as: `|new_price - old_price| / old_price * 100`. If any line item fails this check, the entire revision is rejected with HTTP 422, identifying which items failed.

**Rule Check C — Cooling Time:**
The time elapsed since the supplier's last submission (initial or revision) must be greater than or equal to the configured cooling time in minutes. If not, reject with HTTP 422 and return the `seconds_remaining_until_next_revision_allowed` field in the response body.

### FR-05.3 — Anti-Sniping Extension
If a supplier submits or revises a price within the configured anti-snipe window (e.g., last 10 minutes before close), the system must automatically extend the bid close time by the configured anti-snipe extension (e.g., 5 minutes). This extension must:
- Apply to all suppliers for that RFQ (the new close time is the same for everyone)
- Be recorded in the audit log with: trigger supplier code, original close time, new close time, timestamp
- Be communicated to all connected clients via WebSocket event `rfq:deadline_extended`
- Stack: if another revision occurs in the new extended window, extend again

### FR-05.4 — Bid Window Enforcement
The system must reject any price submission where the server-side current timestamp is outside the `[bid_open_timestamp, bid_close_timestamp]` range. Client-side timestamps are ignored for this check.

---

## FR-06: Ranking Engine

**Priority:** P0

### FR-06.1 — Item-Level Ranking
After each price submission or revision, the system must recalculate per-item rankings across all accepted suppliers who have submitted prices. Ranking is by ascending unit price (L1 = lowest, L2 = second lowest, etc.). Ties are permitted: suppliers with equal prices receive the same rank.

### FR-06.2 — Total RFQ Ranking
The system must calculate total RFQ ranking by summing each supplier's total prices across all items. Ranking is by ascending total (L1 = lowest total cost supplier).

### FR-06.3 — Weighted Ranking
The system must support a buyer-configured weighted ranking formula combining:
- Price score (weight: buyer-configured %)
- Delivery lead time score (weight: buyer-configured %)
- Payment terms score (weight: buyer-configured %)

Weights must sum to 100%. Scoring within each dimension normalizes to 0–100 where the best-performing supplier in that dimension scores 100.

### FR-06.4 — Supplier Rank Display (Supplier View)
Each supplier sees their own ranking signal only. They must never receive their numeric rank position. The display logic:

| Rank Position | Color Signal | Label |
|---|---|---|
| L1 | 🟢 Green | "You are currently the most competitive." |
| L2 | 🟡 Yellow | "You are second most competitive." |
| L3 and below | 🔴 Red | "You are not among the top 2." |

**Proximity Signal** (shown below the color):
Calculate percentage gap between supplier's total price and the current L1 total price:
- Gap ≤ 2%: "Very Close to L1"
- Gap 2–10%: "Close to L1"
- Gap > 10%: "Far from L1"

The supplier must see updated ranking signals within 3 seconds of any submission event in the system (their own or triggered recalculation).

### FR-06.5 — Buyer Ranking View
The Buyer dashboard must display:
- **Item-wise ranking table**: Each item row shows L1 supplier code, L1 price, number of bidders
- **Total RFQ ranking table**: All suppliers sorted by total cost, showing supplier code, total price, rank
- **Weighted score ranking table**: All suppliers sorted by weighted score, showing supplier code, score breakdown

### FR-06.6 — No Price Disclosure to Supplier
The ranking calculation engine must return to the supplier API endpoint: rank color, proximity label, and their own submitted prices only. The API must never return competitor prices, competitor codes, or numeric rank position in the supplier-facing response.

---

## FR-07: Bid Timing & Locking

**Priority:** P0

### FR-07.1 — Server Timestamp Authority
All time-dependent operations (bid open, bid close, submission time, revision time, anti-snipe trigger) must use the server's UTC clock. The system must expose a `/api/time/now` endpoint that returns the current server UTC time, which the frontend uses to display countdowns and enforce UI-level restrictions (as a UX aid — not as the authoritative check).

### FR-07.2 — Manual Bid Lock
A Buyer can manually close an active RFQ before the scheduled close time. This action requires a confirmation dialog and is recorded in the audit log. Once manually closed, the RFQ state moves to `CLOSED`.

### FR-07.3 — Post-Close Immutability
Once an RFQ enters `CLOSED` state (manually or by schedule), all supplier price entry is disabled. Any POST/PUT request to submit or revise prices returns HTTP 409 with message: `"Bid window is closed. No further submissions are accepted."`

---

## FR-08: Audit & Integrity

**Priority:** P0

### FR-08.1 — Immutable Audit Log
The system must maintain an append-only audit log table. No record in this table may ever be updated or deleted — only inserted. The log must capture the following event types with their associated data:

| Event Type | Data Captured |
|---|---|
| `USER_CREATED` | User ID, role, created-by admin ID, timestamp |
| `RFQ_CREATED` | RFQ ID, buyer ID, item count, timestamp |
| `RFQ_PUBLISHED` | RFQ ID, supplier count assigned, timestamp |
| `SUPPLIER_ACCEPTED` | RFQ ID, supplier code, declaration flags, timestamp |
| `SUPPLIER_DECLINED` | RFQ ID, supplier code, reason text, timestamp |
| `BID_SUBMITTED` | RFQ ID, supplier code, revision number, item prices (array), total price, timestamp |
| `BID_REVISED` | RFQ ID, supplier code, revision number, changed items (old and new price per item), timestamp |
| `COMMERCIAL_LOCK` | RFQ ID, triggering supplier code, locked terms snapshot, timestamp |
| `DEADLINE_EXTENDED` | RFQ ID, trigger supplier code, old close time, new close time, extension reason, timestamp |
| `RFQ_CLOSED` | RFQ ID, close method (scheduled/manual), closed-by (system/buyer ID), timestamp |
| `AWARD_SIMULATED` | RFQ ID, buyer ID, simulation parameters, timestamp |
| `AWARD_FINALIZED` | RFQ ID, buyer ID, award decisions (supplier code + items awarded), timestamp |
| `ADMIN_OVERRIDE` | RFQ or User ID, admin ID, action taken, justification text, timestamp |

### FR-08.2 — Hash Sealing
Each bid submission (initial and revision) must be hash-sealed. The system must compute a SHA-256 hash of the canonical JSON representation of the bid record (supplier_code + rfq_id + revision_number + item_prices_array + server_timestamp). This hash is stored alongside the bid record and in the audit log. It must be verifiable: a future audit can recompute the hash from the stored data and confirm integrity.

### FR-08.3 — Confirmation Receipt
After every bid submission and revision, the system must return a confirmation receipt to the supplier. The receipt must include: RFQ number, supplier code, revision number, submission timestamp, hash of the submission. The supplier can download this receipt as a PDF.

---

## FR-09: Outputs & Reporting

**Priority:** P0

### FR-09.1 — Excel Export
Post-close or post-award, the buyer can generate an Excel export containing:
- Cover sheet: RFQ details, bid window, supplier count, award summary
- Item comparison sheet: All items with all supplier prices revealed (post-close only), rank per item, L1 for each item
- Audit trail sheet: Chronological list of all audit log events for this RFQ
- Supplier summary sheet: Supplier code, total bid, weighted score, rank, credibility classification

Export generation must complete within 10 seconds.

### FR-09.2 — PDF Export
A formatted PDF equivalent of the Excel export, suitable for filing and presentation. Must include the platform logo/header, RFQ number, and a footer with the hash verification reference.

### FR-09.3 — Individual Supplier Receipt Export
Each supplier can export a PDF of their own submitted prices at any point after submission. The receipt shows only their own prices and their rank color history.

---

## FR-10: Compliance & Risk Flags

**Priority:** P1

The system must automatically evaluate and flag risk conditions after each bid submission update. Flags are visible only to the Buyer on their dashboard.

| Flag ID | Condition | Trigger |
|---|---|---|
| FLAG-01 | Delivery deviation | Any accepted supplier's stated delivery > buyer's target delivery by configurable threshold (default 20%) |
| FLAG-02 | Payment deviation | Any accepted supplier's payment terms deviate from buyer's specified terms |
| FLAG-03 | Abnormally low price | Any item price from any supplier is < configurable threshold % of the average price across all suppliers for that item (default: 40% below average) |
| FLAG-04 | Supplier dominance | A single supplier holds L1 in more than X% of all items (default: 80%) — potential single-supplier dependency risk |
| FLAG-05 | Excessive late revisions | A supplier has submitted more than Y revisions in the final Z% of the bid window (default: 3 revisions in final 20% of window) |

Each flag must display: flag type, affected supplier code, affected item(s), and a brief recommendation text.

---

## FR-11: Supplier Behaviour Memory (Credibility Index)

**Priority:** P1

### FR-11.1 — Credibility Score Calculation
The system must maintain a rolling credibility score for each supplier across all their RFQ participation history. The score is calculated from four dimensions:

| Dimension | Metric | Weight |
|---|---|---|
| Response Discipline | % of assigned RFQs accepted (not declined without reason, not ignored) | 25% |
| Revision Behavior | Average revisions used vs max allowed; excessive last-minute revision frequency | 25% |
| Win vs Dropout Ratio | % of RFQs where supplier was awarded after being L1 vs L1 positions where they declined award | 25% |
| Post-Award Acceptance | % of awarded RFQs where supplier fulfilled the award without backing out | 25% |

### FR-11.2 — Credibility Classification
Based on the composite score:
- **Excellent**: Score ≥ 80
- **Stable**: Score 50–79
- **Risky**: Score < 50

### FR-11.3 — Visibility Rules
- The credibility score and classification are **never visible to the supplier themselves**.
- Visible to Buyer (during supplier selection and post-bid) and Admin.
- Influences buyer's shortlisting decisions for future RFQs (informational, not enforced).

---

## FR-12: Negotiation Mode

**Priority:** P2

### FR-12.1 — Mode Conversion
After an RFQ closes, the Buyer may optionally convert it to Negotiation Mode. This creates a child negotiation event linked to the original RFQ.

### FR-12.2 — Negotiation Setup
The Buyer configures:
- Top N suppliers to invite (selected by rank from the closed RFQ, minimum 2)
- New bid deadline
- New revision rules (optional — can inherit from original)

### FR-12.3 — Negotiation Execution
The invited suppliers are notified. The same anonymity rules apply. Suppliers submit revised prices. Rankings update in real-time with the same color/proximity signals.

### FR-12.4 — Negotiation Audit
The negotiation event has its own audit trail, linked to the parent RFQ ID.

---

## FR-13: Award Simulation

**Priority:** P2

### FR-13.1 — Simulation Engine
Before finalizing an award, the Buyer can run simulations. The engine must support:
- **Single award**: Award all items to one supplier (input: supplier code)
- **Split award (item-wise)**: Award each item to a different supplier (input: supplier code per item)
- **Split award (category-wise)**: Group items and award groups to different suppliers

### FR-13.2 — Simulation Output
For each simulation scenario, display:
- Total procurement cost
- Delivery impact (estimated total delivery time based on each awarded supplier's lead time)
- Number of unique suppliers involved (concentration risk indicator)
- Comparison to L1 total cost (savings/premium vs best case)

### FR-13.3 — Simulation Non-Binding
Simulations are informational only. Running a simulation does not commit to an award. The final award is a separate, explicit action.

---

## FR-14: Admin Governance

**Priority:** P0

### FR-14.1 — Master Data Control
Admin manages the supplier master list: name, contact email, unique code, category tags, active/inactive status.

### FR-14.2 — Override with Justification
Any admin override of a business rule or data state requires a mandatory justification text entry (minimum 50 characters). The override and justification are recorded in the immutable audit log.

### FR-14.3 — Emergency Bid Extension
Admin can extend the close time of an active RFQ (e.g., due to documented technical issues). This requires justification and is audit logged.

---

# 7. NON-FUNCTIONAL REQUIREMENTS (NFR)

---

## NFR-01: Security

| ID | Requirement |
|---|---|
| NFR-01.1 | Passwords must be hashed using bcrypt with cost factor ≥ 12. |
| NFR-01.2 | JWT access tokens must expire in 15 minutes. Refresh tokens in 7 days. |
| NFR-01.3 | All API endpoints must enforce RBAC. Unauthorized access returns HTTP 403, not 404 (to avoid information leakage about endpoint existence). |
| NFR-01.4 | Supplier-facing API responses must be validated to never include competitor price data, competitor codes, or numeric rank positions. This must be enforced in integration tests. |
| NFR-01.5 | Rate limiting must be applied to authentication endpoints: max 5 failed login attempts per IP per 15-minute window, then 15-minute lockout. |
| NFR-01.6 | Rate limiting on bid submission: max 10 submission requests per supplier per minute per RFQ. |
| NFR-01.7 | All API communication must be over HTTPS in production. HTTP must redirect to HTTPS. |
| NFR-01.8 | The application must set appropriate security headers: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`. |
| NFR-01.9 | Input validation must be performed server-side for all request parameters, headers, and body fields. Use a schema validation library (e.g., Zod or Joi). |
| NFR-01.10 | SQL injection prevention: all database queries must use parameterized queries or ORM-level query building. Raw string interpolation into SQL is prohibited. |
| NFR-01.11 | Sensitive environment variables (DB credentials, JWT secret, Redis password) must be loaded from environment variables or a secrets manager, never hardcoded. |

## NFR-02: Performance

| ID | Requirement |
|---|---|
| NFR-02.1 | API response time for all standard CRUD endpoints must be < 200ms at the 95th percentile under normal load. |
| NFR-02.2 | The ranking recalculation engine must complete and push updated ranks to connected clients within 3 seconds of a bid submission event. |
| NFR-02.3 | Excel export generation must complete within 10 seconds for RFQs with up to 50 line items and 20 suppliers. |
| NFR-02.4 | PDF export generation must complete within 15 seconds for the same volume. |
| NFR-02.5 | The `/api/time/now` endpoint must respond within 10ms. |

## NFR-03: Reliability & Data Integrity

| ID | Requirement |
|---|---|
| NFR-03.1 | Audit log records are append-only. The database schema must enforce this via a trigger or application-layer invariant that prevents UPDATE and DELETE on the audit log table. |
| NFR-03.2 | Bid submission must be transactional: price record insertion, audit log insertion, and hash computation must either all succeed or all fail atomically. |
| NFR-03.3 | The system must handle WebSocket disconnection gracefully: if a client reconnects, they must receive the current state without manual refresh. |
| NFR-03.4 | In the event of a Redis failure, the system must degrade gracefully: bid submission must still function (falling back to DB-level cooling time checks), and real-time rank updates may be delayed but must eventually be delivered. |

## NFR-04: Scalability

| ID | Requirement |
|---|---|
| NFR-04.1 | The API layer must be stateless (all state in DB or Redis) to support horizontal scaling. |
| NFR-04.2 | Buyer-level data isolation must be enforced: all queries must be scoped to the authenticated buyer's ID. No cross-buyer data access is possible at the query level. |
| NFR-04.3 | The system must support at least 50 concurrent active RFQs, each with up to 20 suppliers and 50 line items, without performance degradation below NFR-02 thresholds. |

## NFR-05: Auditability

| ID | Requirement |
|---|---|
| NFR-05.1 | Every state-changing operation (POST, PUT, PATCH, DELETE) must produce an audit log entry. Read operations (GET) are not logged unless they involve sensitive data access (e.g., post-close full price export). |
| NFR-05.2 | Audit log entries must be exportable as a CSV or JSON file for any given RFQ or date range. |
| NFR-05.3 | Hash verification must be computationally reproducible: given the stored bid data, any external auditor can recompute the SHA-256 hash and compare it to the stored hash. |

## NFR-06: Usability

| ID | Requirement |
|---|---|
| NFR-06.1 | All forms must show inline validation errors before submission. |
| NFR-06.2 | The bid countdown timer must be prominently visible on the supplier bidding page and update in real-time. |
| NFR-06.3 | Rank color signals must be visually accessible: color + text label (not color alone) to accommodate color-blind users. |
| NFR-06.4 | All tables with more than 10 rows must support pagination or virtual scrolling. |
| NFR-06.5 | All loading states must be indicated with a loading spinner or skeleton UI. Empty states must show descriptive empty-state messages. |

## NFR-07: Maintainability

| ID | Requirement |
|---|---|
| NFR-07.1 | Code must follow the project's established folder structure and naming conventions (defined in Section 8). |
| NFR-07.2 | No TODO comments or placeholder logic in production code. |
| NFR-07.3 | All business rule constants (minimum change %, default revision count, anti-snipe window) must be configurable via environment variables or the database config table — not hardcoded in logic. |
| NFR-07.4 | Every module must have an associated test file with minimum 80% line coverage. |

---

# 8. SYSTEM ARCHITECTURE

## 8.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│   React 18 + TypeScript + Tailwind + React Query + Zustand  │
│   Browser ←→ REST API + WebSocket                           │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / WSS
┌──────────────────────────▼──────────────────────────────────┐
│                        API LAYER                             │
│   Express / NestJS · TypeScript · JWT Auth · RBAC Middleware │
│   Input Validation (Zod) · Rate Limiting · Logger           │
└───────────┬──────────────────────────────┬──────────────────┘
            │                              │
┌───────────▼──────────┐  ┌───────────────▼──────────────────┐
│   PostgreSQL          │  │          Redis                    │
│   Primary Data Store  │  │   Sessions · Rate Limits ·        │
│   Audit Log           │  │   Cooling Time · Pub/Sub          │
│   Bid History         │  │   Real-time Rank Broadcast        │
│   User Data           │  └───────────────────────────────────┘
└──────────────────────┘
```

## 8.2 Backend Folder Structure

```
/src
  /config           # Environment config, constants, defaults
  /middleware        # Auth, RBAC, rate limiting, logging, error handler
  /modules
    /auth            # Login, refresh, logout, token management
    /users           # User CRUD, role management (Admin only)
    /suppliers       # Supplier master, code generation, credibility
    /rfq             # RFQ CRUD, state machine, commercial lock
    /bidding         # Price submission, revision engine, rules enforcement
    /ranking         # Ranking calculation, WebSocket broadcast
    /audit           # Audit log insertion, query, export
    /exports         # Excel/PDF generation
    /simulation      # Award simulation engine
    /negotiation     # Negotiation mode workflows
    /admin           # Admin-specific overrides, config
    /time            # Server timestamp service
  /shared
    /utils           # Hashing, token generation, formatting utilities
    /types           # TypeScript interfaces and enums
    /validators      # Zod schemas for all request bodies
  /database
    /migrations      # All DB migrations in order
    /seeds           # Test user and data seeds
  /tests
    /unit            # Jest unit tests per module
    /integration     # Supertest API integration tests
    /e2e             # Playwright end-to-end tests
  app.ts             # App initialization
  server.ts          # Server startup (separate from app for testability)
```

## 8.3 Frontend Folder Structure

```
/src
  /components
    /ui              # Reusable: Button, Input, Modal, Badge, Table, Spinner, etc.
    /layout          # AppShell, Sidebar, Navbar, RoleGuard
    /rfq             # RFQCreateForm, RFQItemTable, CommercialTermsForm, RFQCard
    /bidding         # BidEntryForm, RevisionTracker, CountdownTimer
    /ranking         # RankColorBadge, ProximitySignal, RankingTable
    /audit           # AuditLogViewer, AuditLogTable
    /supplier        # SupplierCard, CredibilityBadge
    /simulation      # AwardSimulator, ScenarioComparison
    /exports         # ExportButtons, ReceiptModal
  /pages
    /admin           # AdminDashboard, UserManagement, AuditPage
    /buyer           # BuyerDashboard, RFQListPage, RFQDetailPage, AwardPage
    /supplier        # SupplierDashboard, RFQViewPage, BidEntryPage
    /auth            # LoginPage, TokenLandingPage
  /hooks             # useRFQ, useBidding, useRanking, useWebSocket, useAuth
  /store             # Zustand stores (auth, notifications)
  /api               # Axios client, API function modules per feature
  /utils             # Date formatting, number formatting, hash display
  /types             # Shared TypeScript types
```

---

# 9. DATA MODELS & SCHEMA SPECIFICATION

All tables include `created_at` and `updated_at` timestamps managed by the ORM or DB triggers. All IDs are UUIDs unless stated otherwise.

## 9.1 Users Table
```sql
users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'BUYER', 'SUPPLIER') NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
)
```

## 9.2 Suppliers Table
```sql
suppliers (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  unique_code CHAR(5) UNIQUE NOT NULL,      -- system-generated, e.g., A3K7M
  category_tags TEXT[],
  credibility_score DECIMAL(5,2) DEFAULT 50.00,
  credibility_class ENUM('EXCELLENT', 'STABLE', 'RISKY') DEFAULT 'STABLE',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
)
```

## 9.3 RFQs Table
```sql
rfqs (
  id UUID PRIMARY KEY,
  rfq_number VARCHAR(20) UNIQUE NOT NULL,   -- e.g., RFQ-2025-0001
  buyer_id UUID REFERENCES users(id) NOT NULL,
  title VARCHAR(500) NOT NULL,
  status ENUM('DRAFT','PUBLISHED','ACTIVE','CLOSED','AWARDED') DEFAULT 'DRAFT',
  -- Bidding Rules
  max_revisions INTEGER NOT NULL DEFAULT 5,
  min_change_percent DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  cooling_time_minutes INTEGER NOT NULL DEFAULT 5,
  bid_open_at TIMESTAMPTZ,
  bid_close_at TIMESTAMPTZ,
  anti_snipe_window_minutes INTEGER NOT NULL DEFAULT 10,
  anti_snipe_extension_minutes INTEGER NOT NULL DEFAULT 5,
  -- Commercial Terms
  payment_terms TEXT,
  freight_terms TEXT,
  delivery_lead_time_days INTEGER,
  taxes_duties TEXT,
  warranty TEXT,
  offer_validity_days INTEGER,
  packing_forwarding TEXT,
  special_conditions TEXT,
  -- Commercial Lock
  commercial_locked_at TIMESTAMPTZ,
  commercial_locked_by_supplier_code CHAR(5),
  -- Weighted Ranking Config
  weight_price DECIMAL(5,2) DEFAULT 100.00,
  weight_delivery DECIMAL(5,2) DEFAULT 0.00,
  weight_payment DECIMAL(5,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
)
```

## 9.4 RFQ Items Table
```sql
rfq_items (
  id UUID PRIMARY KEY,
  rfq_id UUID REFERENCES rfqs(id) NOT NULL,
  sl_no INTEGER NOT NULL,
  description TEXT NOT NULL,
  specification TEXT,
  uom VARCHAR(50) NOT NULL,
  quantity DECIMAL(15,4) NOT NULL,
  UNIQUE(rfq_id, sl_no)
)
```

## 9.5 RFQ Supplier Assignments Table
```sql
rfq_suppliers (
  id UUID PRIMARY KEY,
  rfq_id UUID REFERENCES rfqs(id) NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  supplier_code CHAR(5) NOT NULL,
  access_token VARCHAR(512) UNIQUE,         -- tokenized link token
  access_token_expires_at TIMESTAMPTZ,
  status ENUM('PENDING','ACCEPTED','DECLINED') DEFAULT 'PENDING',
  decline_reason TEXT,
  accepted_at TIMESTAMPTZ,
  declaration_rfq_terms BOOLEAN DEFAULT false,
  declaration_no_collusion BOOLEAN DEFAULT false,
  declaration_confidentiality BOOLEAN DEFAULT false,
  UNIQUE(rfq_id, supplier_id)
)
```

## 9.6 Bids Table
```sql
bids (
  id UUID PRIMARY KEY,
  rfq_id UUID REFERENCES rfqs(id) NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  supplier_code CHAR(5) NOT NULL,
  revision_number INTEGER NOT NULL DEFAULT 0,   -- 0 = initial submission
  submitted_at TIMESTAMPTZ NOT NULL,            -- server-generated
  total_price DECIMAL(20,4) NOT NULL,
  submission_hash VARCHAR(64) NOT NULL,         -- SHA-256
  is_latest BOOLEAN NOT NULL DEFAULT true,      -- only one latest per supplier per RFQ
  UNIQUE(rfq_id, supplier_id, revision_number)
)
```

## 9.7 Bid Items Table
```sql
bid_items (
  id UUID PRIMARY KEY,
  bid_id UUID REFERENCES bids(id) NOT NULL,
  rfq_item_id UUID REFERENCES rfq_items(id) NOT NULL,
  unit_price DECIMAL(20,4) NOT NULL,
  total_price DECIMAL(20,4) NOT NULL            -- computed: unit_price × rfq_items.quantity
)
```

## 9.8 Audit Log Table
```sql
audit_log (
  id UUID PRIMARY KEY,
  rfq_id UUID REFERENCES rfqs(id),              -- nullable for non-RFQ events
  event_type VARCHAR(50) NOT NULL,
  actor_type ENUM('SYSTEM','ADMIN','BUYER','SUPPLIER') NOT NULL,
  actor_id UUID,                                -- user or supplier ID
  actor_code CHAR(5),                           -- supplier code if applicable
  event_data JSONB NOT NULL,                    -- full event payload
  event_hash VARCHAR(64) NOT NULL,              -- SHA-256 of event_data + previous hash (chain)
  created_at TIMESTAMPTZ NOT NULL               -- NO updated_at — append-only
  -- NO UPDATE or DELETE permissions granted on this table
)
```

## 9.9 System Config Table
```sql
system_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL
)
```

---

# 10. API CONTRACT SPECIFICATION

All responses follow the envelope pattern:
```json
{
  "success": true,
  "data": { },
  "meta": { "timestamp": "UTC ISO8601", "requestId": "uuid" }
}
```
Error responses:
```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Human-readable message", "details": [] },
  "meta": { "timestamp": "UTC ISO8601", "requestId": "uuid" }
}
```

## 10.1 Auth Endpoints
```
POST /api/auth/login               — Email + password login → access token + refresh cookie
POST /api/auth/refresh             — Rotate refresh token → new access token
POST /api/auth/logout              — Invalidate refresh token
GET  /api/auth/me                  — Get current user profile
GET  /api/time/now                 — Server UTC timestamp (public endpoint)
```

## 10.2 Admin Endpoints
```
GET    /api/admin/users            — List all users
POST   /api/admin/users            — Create user (buyer or supplier)
PATCH  /api/admin/users/:id        — Update user (role, active status)
GET    /api/admin/suppliers        — List supplier master
POST   /api/admin/suppliers        — Onboard supplier
GET    /api/admin/audit-log        — Query audit log (date range, RFQ ID, event type)
POST   /api/admin/overrides        — Submit override with justification
GET    /api/admin/config           — Get system config
PUT    /api/admin/config/:key      — Update system config value
```

## 10.3 Buyer Endpoints
```
GET    /api/buyer/rfqs             — List buyer's RFQs
POST   /api/buyer/rfqs             — Create new RFQ (DRAFT)
GET    /api/buyer/rfqs/:id         — Get RFQ detail
PUT    /api/buyer/rfqs/:id         — Update RFQ (DRAFT only)
POST   /api/buyer/rfqs/:id/publish — Publish RFQ (DRAFT → PUBLISHED)
POST   /api/buyer/rfqs/:id/close   — Manually close RFQ
GET    /api/buyer/rfqs/:id/rankings            — Live rankings (item, total, weighted)
GET    /api/buyer/rfqs/:id/flags               — Compliance risk flags
POST   /api/buyer/rfqs/:id/simulation          — Run award simulation
POST   /api/buyer/rfqs/:id/award               — Finalize award
GET    /api/buyer/rfqs/:id/export/excel        — Download Excel export
GET    /api/buyer/rfqs/:id/export/pdf          — Download PDF export
GET    /api/buyer/rfqs/:id/audit-log           — Get audit log for this RFQ
POST   /api/buyer/rfqs/:id/negotiation         — Convert to negotiation mode
```

## 10.4 Supplier Endpoints
```
GET    /api/supplier/rfqs                     — List supplier's assigned RFQs
GET    /api/supplier/rfqs/:id                 — Get RFQ detail (supplier view)
POST   /api/supplier/rfqs/:id/accept          — Accept RFQ + declarations
POST   /api/supplier/rfqs/:id/decline         — Decline RFQ + reason
POST   /api/supplier/rfqs/:id/bids            — Submit initial bid (all item prices)
PUT    /api/supplier/rfqs/:id/bids            — Revise bid
GET    /api/supplier/rfqs/:id/ranking         — Own rank color + proximity (NEVER competitor data)
GET    /api/supplier/rfqs/:id/receipt         — Download submission receipt PDF
GET    /api/supplier/rfqs/:id/bid-status      — Revision count remaining, cooling time remaining
```

## 10.5 WebSocket Events
```
CLIENT → SERVER:
  subscribe:rfq { rfqId }        — Subscribe to real-time updates for an RFQ

SERVER → CLIENT (Supplier Channel):
  ranking:updated { rfqId, rankColor, proximityLabel, ownTotalPrice }
  rfq:deadline_extended { rfqId, newCloseAt, reason }
  rfq:closed { rfqId }

SERVER → CLIENT (Buyer Channel):
  ranking:updated { rfqId, itemRankings[], totalRankings[], weightedRankings[] }
  flag:raised { rfqId, flagId, flagType, affectedSupplierCode, detail }
  rfq:deadline_extended { rfqId, newCloseAt, triggerSupplierCode }
  rfq:closed { rfqId }
```

---

# 11. AGILE SDLC PLAN — SPRINT BREAKDOWN

## Methodology: Scrum
- **Sprint Duration**: 2 weeks
- **Sprint Ceremonies**: Sprint Planning (Day 1), Daily Standups, Sprint Review (Final Day), Retrospective
- **Definition of Done per Story**: Code complete → Unit tests written → Code reviewed → Integration tests passing → QA verified → Deployed to staging

---

## PHASE 1: CORE COMPETITIVE RFQ ENGINE (Sprints 1–4)

### SPRINT 1 — Foundation, Auth & Access Control

**Sprint Goal**: A fully operational authentication system where Admin can create and manage users, and all three roles can log in securely with proper access control.

**User Stories:**

| Story ID | Story | Acceptance Criteria |
|---|---|---|
| S1-US01 | As a user, I can log in with email and password and receive a JWT access token | Token issued, bcrypt verified, refresh cookie set |
| S1-US02 | As a user, my access token expires in 15 minutes and I can silently refresh it | Refresh endpoint returns new token; old refresh token invalidated |
| S1-US03 | As a user, I can log out and my session is immediately invalidated | Refresh token removed from Redis; subsequent refresh attempts fail |
| S1-US04 | As an Admin, I can create Buyer and Supplier accounts with appropriate roles | Account created, password hashed, role assigned, audit log entry created |
| S1-US05 | As an Admin, I can deactivate a user account | User can no longer log in; existing sessions invalidated |
| S1-US06 | As a Supplier, I receive a unique 5-character alphanumeric code upon account creation | Code is unique across all suppliers; visible to Admin and Buyer only |
| S1-US07 | As a Supplier, I can access the platform via a tokenized RFQ link | Link is time-bound; grants scoped access; single session only |
| S1-US08 | As any user, I cannot access role-restricted API endpoints | 403 returned for unauthorized role; 401 for unauthenticated |
| S1-US09 | As a system, all actions are recorded in the immutable audit log | Audit log table exists; USER_CREATED event is logged |

**Technical Tasks:**
- Set up project repositories (backend, frontend)
- Configure TypeScript, ESLint, Prettier, Husky pre-commit hooks
- Set up PostgreSQL schema with migrations framework
- Implement `users`, `suppliers`, `audit_log` tables
- Implement JWT middleware (access + refresh token pattern)
- Implement RBAC middleware
- Implement bcrypt password hashing
- Implement supplier code generation algorithm (5-char unique alphanumeric)
- Implement tokenized link generation and validation
- Implement Redis session store for refresh tokens
- Implement rate limiting on auth endpoints
- Implement server timestamp service (`/api/time/now`)
- Build Admin user management UI (create, list, deactivate users)
- Build login page (shared for all roles)
- Build role-specific dashboard shell (empty, role-aware navigation)
- Unit tests: auth service, RBAC middleware, code generator
- Integration tests: all auth endpoints

---

### SPRINT 2 — RFQ Creation & Commercial Lock

**Sprint Goal**: Buyers can create complete, structured RFQs with item tables and commercial terms, assign suppliers, publish RFQs, and the commercial lock enforces itself when the first supplier accepts.

**User Stories:**

| Story ID | Story | Acceptance Criteria |
|---|---|---|
| S2-US01 | As a Buyer, I can create an RFQ in DRAFT state with a title and item table | RFQ created, RFQ number auto-generated, all item fields saved |
| S2-US02 | As a Buyer, I can add, edit, and remove item rows while in DRAFT | Items saved correctly; sl_no auto-assigned |
| S2-US03 | As a Buyer, I can enter all commercial terms for an RFQ | All commercial term fields persisted |
| S2-US04 | As a Buyer, I can configure bidding rules (revision count, cooling time, min change %, timing) | Rules saved and validated (constraints enforced) |
| S2-US05 | As a Buyer, I can assign suppliers from the master list to an RFQ | Assignment recorded; tokenized links generated per supplier |
| S2-US06 | As a Buyer, I can publish an RFQ, making it visible to assigned suppliers | RFQ status → PUBLISHED; suppliers notified |
| S2-US07 | As a Supplier, I can view my assigned RFQ including all items and commercial terms | Supplier sees full RFQ data; no other supplier's data visible |
| S2-US08 | As a Supplier, I can accept an RFQ after checking all three mandatory declarations | All three checkboxes required; acceptance recorded with timestamp |
| S2-US09 | As a Supplier, I can decline an RFQ with a mandatory reason | Decline recorded; reason captured; supplier cannot later accept |
| S2-US10 | As a system, commercial terms lock when the first supplier accepts | Lock timestamp and triggering supplier code recorded; subsequent buyer edits rejected with 409 |
| S2-US11 | As a Buyer, I cannot modify commercial terms or item rows after commercial lock | API returns 409; UI shows lock indicator |

**Technical Tasks:**
- Implement `rfqs`, `rfq_items`, `rfq_suppliers` table migrations
- Implement RFQ CRUD API with state machine enforcement
- Implement RFQ number generation (`RFQ-YYYY-NNNN`)
- Implement commercial lock logic in the accept endpoint
- Implement supplier assignment with tokenized link generation
- Implement RBAC scoping: buyer sees only their RFQs; supplier sees only assigned RFQs
- Build Buyer RFQ creation form (multi-step: items, commercial terms, bidding rules, suppliers)
- Build Buyer RFQ list page
- Build Supplier RFQ view page (read-only item table, commercial terms)
- Build Supplier accept/decline flow with declaration checkboxes
- Build commercial lock indicator in Buyer RFQ detail page
- Unit tests: RFQ state machine, commercial lock trigger, RFQ number generator
- Integration tests: all RFQ and supplier assignment endpoints

---

### SPRINT 3 — Bidding Engine & Ranking

**Sprint Goal**: Suppliers can submit and revise prices with all rules enforced server-side. Rankings update in real-time. Suppliers see color/proximity signals. Buyers see full ranking tables. No price leakage occurs.

**User Stories:**

| Story ID | Story | Acceptance Criteria |
|---|---|---|
| S3-US01 | As a Supplier, I can submit unit prices for all line items when the bid is active | All items required; total calculated server-side; bid recorded |
| S3-US02 | As a Supplier, I cannot submit a partial bid (only some items) | API rejects partial submissions with 422 |
| S3-US03 | As a Supplier, I can revise my prices within the configured revision rules | Revision accepted only if: count < max, change% ≥ min, cooling time elapsed |
| S3-US04 | As a Supplier, my revision is rejected with a clear explanation if any rule is violated | 422 returned with specific rule violation identified |
| S3-US05 | As a Supplier, after each submission, I see my rank color (Green/Yellow/Red) and proximity signal | Ranking signal updates within 3 seconds of any submission in the RFQ |
| S3-US06 | As a Supplier, I never see any competitor's price, name, or code in any API response | Verified by integration test scanning all supplier API responses |
| S3-US07 | As a Buyer, I see item-wise rankings (L1 price, L1 supplier code, bidder count) | Rankings update in real-time |
| S3-US08 | As a Buyer, I see total RFQ rankings (all suppliers sorted by total cost) | Accurate total ranking displayed |
| S3-US09 | As a Buyer, I see weighted score rankings with configurable dimension weights | Weighted score calculated correctly when configured |
| S3-US10 | As a system, all bid submissions are hash-sealed and recorded in the audit log | SHA-256 hash computed and stored; BID_SUBMITTED event logged |

**Technical Tasks:**
- Implement `bids`, `bid_items` table migrations
- Implement price submission endpoint with full rule enforcement (count, change%, cooling time, bid window)
- Implement server-side total price calculation
- Implement revision tracking (`is_latest` flag management)
- Implement cooling time tracking in Redis
- Implement SHA-256 hash computation for bid sealing
- Implement item-level ranking engine (ascending price sort with tie handling)
- Implement total RFQ ranking engine
- Implement weighted ranking engine
- Implement supplier rank response serializer (color, proximity, own prices ONLY — no competitor data)
- Implement WebSocket server (Socket.io) for real-time rank broadcasting
- Implement supplier and buyer WebSocket channels with proper authorization
- Build Supplier bid entry form (all items, unit price input, total preview)
- Build Supplier rank display component (color badge, proximity label, countdown to next revision)
- Build Buyer live rankings dashboard (item-wise table, total ranking table, weighted table)
- Build WebSocket client hook for real-time updates
- Unit tests: ranking engine (all edge cases: ties, single bidder, all same price), revision rule enforcement, hash computation, supplier response serializer (must assert no competitor data)
- Integration tests: bid submission, revision (each rule violation), ranking endpoints

---

### SPRINT 4 — Bid Locking, Audit System & Exports

**Sprint Goal**: Bids lock automatically and manually on schedule. Audit trail is complete and exportable. Award workflow is operational. Excel and PDF outputs are downloadable.

**User Stories:**

| Story ID | Story | Acceptance Criteria |
|---|---|---|
| S4-US01 | As a system, bids auto-close at the configured bid close time | No submissions accepted after close; RFQ status → CLOSED |
| S4-US02 | As a Buyer, I can manually close an active RFQ | RFQ status → CLOSED; audit entry created |
| S4-US03 | As a Supplier, I cannot submit or revise bids after the bid window closes | 409 returned; UI shows read-only state |
| S4-US04 | As a system, any revision within the anti-snipe window auto-extends the close time | Extension applied; all clients notified via WebSocket; audit entry created |
| S4-US05 | As a Buyer, I can view the full audit log for an RFQ | Chronological list of all events; each entry shows event type, actor, timestamp, data |
| S4-US06 | As a Supplier, I receive a downloadable confirmation receipt after each submission | PDF receipt with: RFQ number, supplier code, revision number, timestamp, hash |
| S4-US07 | As a Buyer, I can finalize an award decision (single or split) | Award recorded; RFQ status → AWARDED; AWARD_FINALIZED audit entry created |
| S4-US08 | As a Buyer, I can download an Excel report of the closed RFQ | Report contains all required sheets; generation < 10 seconds |
| S4-US09 | As a Buyer, I can download a PDF report of the closed RFQ | Report formatted correctly; generation < 15 seconds |
| S4-US10 | As a system, all audit log entries have SHA-256 hash chains | Each log entry hash includes previous hash (chain integrity) |

**Technical Tasks:**
- Implement scheduled job (cron) for automatic bid close at `bid_close_at`
- Implement manual close endpoint
- Implement anti-snipe extension logic (detect revision within window, extend close, broadcast via WebSocket, log)
- Implement post-close state enforcement on bid submission endpoint
- Implement complete audit log for all remaining event types
- Implement hash chaining in audit log (each entry's hash includes previous entry's hash)
- Implement confirmation receipt PDF generation (per supplier per submission)
- Implement award finalization endpoint (single and split award modes)
- Implement Excel export (ExcelJS: cover sheet, item comparison, audit trail, supplier summary)
- Implement PDF export (Puppeteer: formatted, with header and hash footer)
- Build Buyer award workflow UI (supplier selection, item allocation, confirmation)
- Build audit log viewer (filterable, paginated table)
- Build export download buttons and loading states
- Build supplier receipt download (per submission history)
- Unit tests: anti-snipe logic, hash chain verification, export content validation (item count, price accuracy, audit completeness)
- Integration tests: all close/award/export endpoints
- E2E test: complete RFQ lifecycle from creation to award to export

---

## PHASE 2: BUYER INTELLIGENCE (Sprints 5–7)

### SPRINT 5 — Compliance & Risk Flags

**Sprint Goal**: The system automatically identifies and surfaces risk conditions on the Buyer's dashboard, improving decision quality.

**User Stories:**

| Story ID | Story | Acceptance Criteria |
|---|---|---|
| S5-US01 | As a Buyer, I see a flag when a supplier's delivery time exceeds my target | FLAG-01 raised; affected supplier code displayed |
| S5-US02 | As a Buyer, I see a flag when a supplier's payment terms deviate from my specified terms | FLAG-02 raised |
| S5-US03 | As a Buyer, I see a flag when any item price is abnormally low | FLAG-03 raised; affected item and supplier identified |
| S5-US04 | As a Buyer, I see a flag when one supplier dominates the L1 position across most items | FLAG-04 raised with dominance % shown |
| S5-US05 | As a Buyer, I see a flag for excessive last-minute revisions by any supplier | FLAG-05 raised with revision count and timing |
| S5-US06 | Flags are only visible to the Buyer, never to any Supplier | Verified by integration test of supplier API responses |

**Technical Tasks:**
- Implement flag evaluation engine (runs after each bid update, configurable thresholds from system_config)
- Implement flag storage and retrieval API
- Implement flag display component on Buyer RFQ dashboard
- Unit tests: each flag condition (boundary values, threshold edge cases)
- Integration tests: flag API endpoints

---

### SPRINT 6 — Supplier Credibility System

**Sprint Goal**: The system tracks supplier behavior across all RFQs and provides buyers with credibility classifications to inform future shortlisting.

**User Stories:**

| Story ID | Story | Acceptance Criteria |
|---|---|---|
| S6-US01 | As a system, credibility scores update after every relevant RFQ event | Score recalculated after acceptance, bid, award, award fulfillment |
| S6-US02 | As a Buyer, I see credibility classification (Excellent/Stable/Risky) in supplier selection | Classification visible during RFQ supplier assignment |
| S6-US03 | As a Buyer, I see credibility classification in the closed RFQ supplier summary | Visible in rankings view and export |
| S6-US04 | As a Supplier, I never see my own or any other supplier's credibility score | Verified by supplier API test |

**Technical Tasks:**
- Implement credibility score calculation service (four dimensions, composite score, classification thresholds)
- Implement score update triggers (post-accept, post-bid-close, post-award, post-award-fulfillment)
- Implement supplier selection UI with credibility badge
- Implement credibility display in buyer ranking dashboard
- Unit tests: score calculation for all dimension combinations, classification thresholds
- Integration tests: score update triggers

---

### SPRINT 7 — Weighted Ranking & Management KPIs

**Sprint Goal**: Buyers can use weighted multi-dimension ranking for award decisions. Management can view platform-wide KPI dashboards.

**User Stories:**

| Story ID | Story | Acceptance Criteria |
|---|---|---|
| S7-US01 | As a Buyer, I can configure dimension weights (price, delivery, payment) for an RFQ | Weights configurable; must sum to 100% |
| S7-US02 | As a Buyer, I see weighted scores for all suppliers in the ranking view | Weighted score calculated correctly; score breakdown visible |
| S7-US03 | As a Buyer, I can select which ranking logic (price-only, weighted) governs my award simulation | Award simulation uses selected logic |
| S7-US04 | As an Admin, I can view platform KPIs (RFQ cycle time, savings, participation rate, etc.) | KPI dashboard shows accurate metrics |

**Technical Tasks:**
- Implement weighted score calculation in ranking engine (normalize per dimension, apply weights)
- Implement KPI calculation service (aggregate queries across all RFQs)
- Build weighted ranking configuration UI in RFQ creation form
- Build KPI dashboard (charts, metrics, date range filter)
- Unit tests: weighted score calculation, KPI accuracy with test data
- Integration tests: weighted ranking endpoint, KPI endpoint

---

## PHASE 3: ADVANCED PROCUREMENT (Sprints 8–10)

### SPRINT 8 — Negotiation Mode

**Sprint Goal**: Buyers can convert closed RFQs to negotiation mode, inviting top-ranked suppliers for a final anonymous price-only round.

**User Stories:**

| Story ID | Story | Acceptance Criteria |
|---|---|---|
| S8-US01 | As a Buyer, I can convert a closed RFQ to Negotiation Mode | Negotiation event created and linked to parent RFQ |
| S8-US02 | As a Buyer, I can select top N suppliers by rank to invite | Selected suppliers notified; others excluded |
| S8-US03 | As a Supplier, negotiation works identically to the original bidding (anonymity preserved) | Rank colors and proximity signals work; no competitor data visible |
| S8-US04 | As a system, the negotiation has its own audit trail linked to the parent RFQ | Audit entries have parent RFQ reference |

---

### SPRINT 9 — Award Simulation Engine

**Sprint Goal**: Buyers can model complex award scenarios before committing, with cost and risk analysis.

**User Stories:**

| Story ID | Story | Acceptance Criteria |
|---|---|---|
| S9-US01 | As a Buyer, I can simulate a single-supplier award and see cost and delivery impact | Simulation result shows total cost, delivery timeline, concentration indicator |
| S9-US02 | As a Buyer, I can simulate an item-wise split award | Simulation shows cost per supplier, total cost, supplier count |
| S9-US03 | As a Buyer, I can compare multiple simulation scenarios side by side | Comparison table shows cost delta vs best case |
| S9-US04 | Simulation does not commit the award | Running simulation creates no AWARD_FINALIZED log entry |

---

### SPRINT 10 — Governance Hardening & Production Readiness

**Sprint Goal**: The platform is production-hardened: admin governance is complete, performance optimized, security reviewed, and all edge cases resolved.

**User Stories:**

| Story ID | Story | Acceptance Criteria |
|---|---|---|
| S10-US01 | As an Admin, I can access and export the full platform audit log with filters | Date range, event type, RFQ ID filters work |
| S10-US02 | As an Admin, I can perform emergency overrides with mandatory justification | Override recorded in audit log with justification |
| S10-US03 | As an Admin, I can manage system configuration (thresholds, defaults) | Config changes take effect immediately; logged |
| S10-US04 | All API endpoints respond within NFR-02 thresholds under load | Load test confirms < 200ms at 95th percentile |
| S10-US05 | Security review passes (OWASP Top 10 checklist) | All critical and high findings remediated |

**Technical Tasks:**
- Admin governance UI (override panel, emergency controls, system config)
- Database index optimization (queries on rfq_id, supplier_id, created_at, status)
- N+1 query audit and fix (use eager loading / join queries)
- Redis caching for frequently-read ranking data
- OWASP Top 10 review and remediation
- Load testing (k6 or Artillery)
- Full end-to-end test suite run and fix
- Production Docker Compose configuration
- Environment-specific configuration review
- Documentation: API docs (Swagger/OpenAPI), README, deployment guide

---

# 12. TESTING STRATEGY

## 12.1 Testing Pyramid

```
        [ E2E Tests ]        ← Playwright, 20-30 critical flows
       [Integration Tests]   ← Supertest, every API endpoint
      [  Unit Tests      ]   ← Jest, every service/function
     [ Static Analysis  ]    ← TypeScript, ESLint, no-any rules
```

## 12.2 Unit Testing Standards

Every function/method with business logic must have unit tests. Minimum 80% line coverage. Tests must be co-located in `/tests/unit` and named `*.spec.ts`.

**Modules requiring 100% coverage (zero tolerance for missed cases):**

- Ranking engine (item rank, total rank, weighted rank, ties, single bidder, all-same-price)
- Revision rule enforcement (count, min change, cooling time — all boundaries)
- Anti-sniping extension logic
- Hash computation (bid hash, audit chain hash)
- Supplier response serializer (must assert absence of competitor data fields)
- Commercial lock trigger
- Credibility score calculator

## 12.3 Integration Testing Standards

All API endpoints must have integration tests using Supertest. Tests run against a real test PostgreSQL instance (seeded with test data). Redis must be mocked or a test instance used.

**Each endpoint test must cover:**
- Happy path (200/201/204)
- Authentication required (401 when no token)
- Unauthorized role (403 when wrong role)
- Validation errors (422 for invalid body)
- Business rule violations (409/422 with specific error codes)
- Not found (404)
- Edge cases specific to that endpoint

## 12.4 Security-Specific Tests (Mandatory)

These tests must exist and pass before any sprint is considered done:

| Test ID | Test Description | Expected Result |
|---|---|---|
| SEC-T01 | Supplier API — GET /api/supplier/rfqs/:id/ranking response | Response body contains NO fields: competitor_prices, competitor_codes, numeric_rank_position |
| SEC-T02 | Supplier API — GET /api/supplier/rfqs/:id response | Item table contains NO unit_price fields from other suppliers |
| SEC-T03 | Cross-supplier access — Supplier A tries to access Supplier B's RFQ | 403 returned |
| SEC-T04 | Cross-buyer access — Buyer A tries to access Buyer B's RFQ | 403 returned |
| SEC-T05 | Admin accesses supplier-facing ranking endpoint | 403 returned (Admin must not use supplier endpoints) |
| SEC-T06 | Bid submission after close time (server time manipulation test) | 409 returned regardless of client-side time |
| SEC-T07 | Revision after max_revisions reached | 422 with REVISION_LIMIT_REACHED code |
| SEC-T08 | Login brute force — 6th failed attempt within 15 minutes | 429 returned |
| SEC-T09 | JWT with tampered payload | 401 returned |
| SEC-T10 | Expired access token (use token > 15 minutes old) | 401 returned |
| SEC-T11 | Expired tokenized supplier link | 401 returned |
| SEC-T12 | Audit log — attempt DELETE on audit_log table via raw query | Operation fails (permission denied at DB level) |
| SEC-T13 | Commercial terms edit after lock | 409 returned |
| SEC-T14 | SQL injection attempt in item description field | Input sanitized; no SQL error; stored as literal text |
| SEC-T15 | XSS payload in text field | Payload stored as text; rendered escaped in frontend |

## 12.5 Edge Case Register

These edge cases must each have a corresponding test:

**Ranking Edge Cases:**
- All suppliers submit identical prices → All are L1 (tie), all see Green
- Only one supplier has submitted → That supplier is L1 (Green); no proximity signal (no L1 to compare against for others)
- A supplier revises upward → Their rank should worsen; verify recalculation
- Supplier revises to exactly L1 price → They tie for L1 (Green)
- All suppliers decline an RFQ → Buyer cannot activate bidding; appropriate state handling

**Revision Rule Edge Cases:**
- Minimum change exactly at the threshold (e.g., configured 1.00%) → Accepted
- Minimum change 0.01% below threshold → Rejected
- Cooling time exactly elapsed at the second of request → Accepted
- Revision submitted 1 second before cooling time completes → Rejected with seconds_remaining = 1
- Max revisions = 0 configured by buyer → No revisions allowed; only initial submission
- Supplier submits exact same prices as initial bid → Rejected (0% change, below any minimum threshold)

**Anti-Snipe Edge Cases:**
- Two suppliers both revise in the anti-snipe window simultaneously → Close time extended once (not twice); race condition handled
- Anti-snipe extension causes close time to move past system's max allowed → Extension capped at max; buyer notified
- Revision exactly at the anti-snipe window boundary (e.g., exactly 10 minutes before close) → Extension triggered (boundary is inclusive)

**Bid Lifecycle Edge Cases:**
- Buyer publishes RFQ then immediately unpublishes before any supplier accepts → RFQ can return to DRAFT (if no acceptances); item table and terms editable again
- All assigned suppliers decline → RFQ cannot be activated; Buyer notified; can reassign suppliers or cancel RFQ
- RFQ has 0 bids at close time → Buyer sees empty ranking; can still export (empty report); no award possible without bids
- Buyer closes RFQ while a supplier's revision is in-flight (submitted at the same millisecond as manual close) → Submission accepted only if submitted_at < closed_at (strict comparison using server timestamps)
- WebSocket client disconnects mid-bid and reconnects → Receives full current state on reconnect (no gaps in rank signal)

**Hash & Audit Edge Cases:**
- Hash verification: modify one character in a stored bid item price and attempt to verify hash → Verification fails; discrepancy detected
- Audit log hash chain: verify that tampering with an intermediate audit entry breaks the chain from that point onward → Chain verification utility detects the broken link

**Export Edge Cases:**
- RFQ with 50 line items and 20 suppliers → Export must complete within NFR time limit
- RFQ with 0 accepted suppliers → Export shows empty sections with explanatory notes (not empty/broken file)
- Special characters in item descriptions (e.g., `<>&"'`) → Exported correctly in Excel (text) and PDF (escaped)

**Access Control Edge Cases:**
- Supplier assigned to RFQ-A tries to access RFQ-B (also assigned to them but belonging to different buyer) → Allowed (they are assigned) — buyer isolation is a buyer-to-buyer concern, not supplier-to-RFQ concern; but verify no cross-buyer data bleeds
- Admin creates a Buyer then immediately deactivates their account → Deactivated buyer's existing sessions are invalidated; active RFQs remain intact but inaccessible until reactivation
- Tokenized link replayed after session established → Rejected; link is single-session-establishment only

## 12.6 E2E Test Scenarios (Playwright)

The following complete lifecycle E2E tests are mandatory:

**E2E-01 — Full Happy Path:**
1. Admin logs in → creates Buyer (buyer1) and 5 Suppliers (supplier1–5)
2. Buyer1 creates RFQ with 3 items, full commercial terms, bidding rules (3 revisions, 1% min, 5-min cooling, 30-min window, 5-min anti-snipe)
3. Buyer1 assigns all 5 suppliers → publishes RFQ
4. Supplier1, 2, 3 accept (with all declarations); Supplier4 declines (with reason); Supplier5 ignores
5. Commercial lock triggers after Supplier1 accepts → buyer1 attempts to edit commercial terms → sees rejection
6. Bid opens → Supplier1, 2, 3 each submit initial prices
7. Buyer1 views ranking dashboard → sees correct L1, L2, L3 assignments
8. Supplier1 (L2) revises prices within rules → sees rank color update
9. Supplier3 attempts to revise within cooling time → sees rejection with time remaining
10. Supplier1 makes revision in the anti-snipe window → bid deadline extends → all clients notified
11. Bid window closes (auto) → All supplier edits rejected
12. Buyer1 views full rankings (now with prices revealed in buyer view)
13. Buyer1 reviews compliance flags
14. Buyer1 runs award simulation (split and single scenarios)
15. Buyer1 finalizes award
16. Buyer1 downloads Excel and PDF reports
17. Admin views full audit log → verifies all events present

**E2E-02 — Security: Zero Competitor Data Leakage:**
1. Active RFQ with 3 bidding suppliers
2. For each supplier, capture all WebSocket messages and API responses
3. Assert: no response to any supplier contains another supplier's price, code, or rank position

**E2E-03 — Anti-Snipe Validation:**
1. RFQ with 2-minute window and 1-minute anti-snipe extension
2. Supplier submits revision in the last 60 seconds
3. Verify: close time extended by configured extension
4. Verify: WebSocket event received by all connected clients
5. Verify: audit log entry created for extension

**E2E-04 — Hash Integrity:**
1. Complete RFQ with 2 revisions from 1 supplier
2. Export audit log
3. For each bid entry, recompute SHA-256 from stored data
4. Assert: computed hash matches stored hash for all entries
5. Assert: audit chain hashes form an unbroken chain

---

# 13. ENGINEERING STANDARDS & RULES

## 13.1 Non-Negotiable Rules (Zero Exceptions)

1. **No competitor data exposure.** The supplier-facing API must structurally prevent competitor price or identity data from reaching the supplier. This is enforced by:
   - Server-side response serializers that whitelist allowed fields
   - Integration tests (SEC-T01, SEC-T02) that must pass on every build

2. **Server timestamps only.** Client-submitted timestamps for time-sensitive operations (bid submission time, close time) are ignored. The server always uses `new Date()` at the moment of processing.

3. **Audit log is append-only.** The `audit_log` table must have database-level permissions that deny UPDATE and DELETE to the application database user. Only INSERT is permitted. This is verified in tests (SEC-T12).

4. **Bid history is immutable.** Once a bid record is inserted, it is never modified. The `is_latest` flag on the bids table can be updated (it's a convenience flag), but the underlying bid price records are never altered.

5. **All business rules enforced server-side.** Client-side validation is for UX only. No business rule (revision count, min change, cooling time, bid window) is authoritative from the client.

6. **No placeholder code in production.** No `TODO`, `FIXME`, `console.log` for debugging, mock returns, hardcoded test data, or `if (process.env.NODE_ENV !== 'test') skip()` patterns that bypass logic.

7. **Security-first architecture.** Default deny on all endpoints. Authenticate first, authorize second, validate third, execute fourth.

## 13.2 Code Quality Standards

- **TypeScript strict mode** (`strict: true` in tsconfig). No use of `any` type without explicit justification in a comment.
- **Zod schema validation** for all request bodies, query parameters, and environment variables.
- **No unhandled promise rejections.** All async operations must have proper error handling.
- **Centralized error handling.** All errors propagate to a single Express error middleware that formats consistent error responses.
- **Structured logging.** Use a logging library (Winston or Pino). Log levels: ERROR, WARN, INFO, DEBUG. No `console.log` in production code.
- **Environment-based configuration.** All configuration values (ports, DB URLs, JWT secrets, threshold values) come from environment variables. Validated at startup via Zod.

## 13.3 Git & Branching Standards

- `main` → production-ready code only
- `develop` → integration branch for sprint work
- Feature branches: `feature/sprint-N-short-description`
- Bug fix branches: `fix/short-description`
- All merges to `develop` via Pull Request with at least one code review approval
- All merges to `main` via PR from `develop` only, with all CI checks passing

## 13.4 CI Pipeline (GitHub Actions)

Every push to any branch triggers:
1. TypeScript compilation (no errors)
2. ESLint (no errors, no warnings)
3. Unit tests (all pass, coverage ≥ 80%)
4. Integration tests (all pass)
5. Security tests (SEC-T01 through SEC-T15 all pass)

PRs to `main` additionally trigger:
6. E2E tests (E2E-01 through E2E-04)

---

# 14. DEFINITION OF DONE

## 14.1 Story-Level Definition of Done

A user story is DONE when ALL of the following are true:
- [ ] Code is complete and follows all engineering standards
- [ ] Unit tests written and passing (≥ 80% coverage for affected modules)
- [ ] Integration tests written and passing for all affected endpoints
- [ ] Security tests passing (all applicable SEC-T assertions)
- [ ] Code has been peer-reviewed via Pull Request
- [ ] No TypeScript errors, no ESLint warnings
- [ ] Deployed to staging environment
- [ ] Acceptance criteria manually verified on staging
- [ ] No TODO or placeholder code

## 14.2 Sprint-Level Definition of Done

A sprint is DONE when ALL stories in the sprint meet the story-level DoD AND:
- [ ] All sprint integration tests pass in CI
- [ ] Sprint demo conducted (Buyer, Supplier, Admin flows demonstrated)
- [ ] Sprint retrospective completed
- [ ] Develop branch is ahead of main with clean history

## 14.3 Project-Level Definition of Done

The project is DONE when ALL of the following are true. Partial completion is not done. Individual sprint completion is not done. The system must work end-to-end.

### Backend Completeness
- [ ] All FR-01 through FR-14 APIs implemented and tested
- [ ] All business rules enforced server-side with tests proving enforcement
- [ ] Ranking engine operational with all edge cases passing
- [ ] Anti-sniping logic operational and tested
- [ ] Audit logging complete for all defined event types
- [ ] Hash sealing and chain verification working
- [ ] Export generation (Excel + PDF) within NFR time limits

### Frontend Completeness
- [ ] Admin dashboard: user management, supplier management, audit log viewer, system config
- [ ] Buyer dashboard: RFQ list, RFQ creation (all steps), live ranking view, compliance flags, award simulation, award finalization, export downloads
- [ ] Supplier dashboard: assigned RFQ list, RFQ view, accept/decline flow, bid entry, rank signal display, receipt download
- [ ] Real-time WebSocket rank updates working in browser
- [ ] Responsive design (tablet and above for Buyer/Admin; mobile-capable for Supplier)
- [ ] All loading, empty, and error states handled

### Database Completeness
- [ ] All migrations written and tested (run cleanly from zero)
- [ ] All indexes created for performance-critical queries
- [ ] Audit log table has DB-level INSERT-only permissions enforced

### Integration & Auth
- [ ] End-to-end auth flow (login → token → refresh → logout) working
- [ ] Role-based access validated for all three roles across all endpoints
- [ ] Tokenized supplier link flow working (generate → access → session establishment)
- [ ] WebSocket authentication working (only authorized users subscribe to their channels)

### QA Validation
- [ ] E2E-01 (full happy path) passes
- [ ] E2E-02 (zero data leakage) passes
- [ ] E2E-03 (anti-snipe) passes
- [ ] E2E-04 (hash integrity) passes
- [ ] All SEC-T01 through SEC-T15 pass
- [ ] All edge cases in the Edge Case Register have passing tests

### Security
- [ ] OWASP Top 10 review completed; all critical/high findings resolved
- [ ] Dependency vulnerability scan (npm audit) — no critical vulnerabilities
- [ ] Rate limiting verified on auth and bid submission endpoints
- [ ] Security headers verified (CSP, X-Frame-Options, HSTS)

### Production Readiness
- [ ] Docker Compose configuration for local development
- [ ] Production Docker configuration (environment-based)
- [ ] All environment variables documented in `.env.example`
- [ ] API documentation (Swagger/OpenAPI) complete and accurate
- [ ] README with setup, development, and deployment instructions

---

# 15. MULTI-MODEL EXECUTION PROTOCOL

## 15.1 Model Responsibilities

| Model | Role | Allowed Scope |
|---|---|---|
| **Claude Opus 4.6** | PRIMARY SYSTEM BUILDER | Full backend, database, business logic, APIs, architecture, tests |
| **Gemini** | FRONTEND ENGINEER | React components, dashboards, forms, UI only |
| **GPT** | BUG FIX ENGINEER | Debugging, fixing bugs in existing code only |

## 15.2 Execution Order — NON-NEGOTIABLE

```
STEP 1: Claude Opus 4.6 builds the complete backend system
         ↓  (only when backend is complete and tested)
STEP 2: Gemini builds the frontend against the established API contracts
         ↓  (only when both backend and frontend are built)
STEP 3: GPT fixes bugs identified in integration/E2E testing
```

Never reverse or skip steps. Never use Gemini for backend changes. Never use GPT to add new features.

## 15.3 Hard Rules — All Models

- Models must **never exceed their assigned scope**
- No model may redesign the architecture defined in Section 8
- No model may add features not listed in FR-01 through FR-14
- No model may make assumptions about requirements — this document is the sole source of truth
- If a requirement is ambiguous, models must flag the ambiguity and propose the most conservative implementation, not resolve it silently
- No model may produce placeholder code, TODOs, or mocked logic and present it as complete

---

# 16. MODEL PROMPTS — FULL CONTEXT

---

## 🧠 PROMPT FOR CLAUDE OPUS 4.6 — PRIMARY BUILDER

---

**READ THIS ENTIRE PROMPT BEFORE WRITING A SINGLE LINE OF CODE.**

> ⚠️ **ENVIRONMENT — READ BEFORE CODING**
> Developer is on **Windows** using PowerShell.
> Use **cross-env** for all environment variables in npm scripts (not KEY=VALUE syntax).
> Docker is running with three containers:
> - PostgreSQL main database: `localhost:5432`
> - PostgreSQL test database: `localhost:5433` (separate container — integration tests use this)
> - Redis: `localhost:6379`
> Unit tests must have **zero** database/Redis dependency (mock everything).
> Integration tests connect to port **5433** (test DB), not 5432.
> Create `.env.test` with: `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/procurement_test` and `REDIS_URL=redis://localhost:6379/1`

You are the **Primary System Builder** for the Procurement Competitive Enquiry & Bidding Platform. You are responsible for building the complete, production-grade backend system. Every decision you make becomes the authoritative architecture that Gemini (frontend) and GPT (bug-fixing) will work against. You cannot be vague. You cannot leave anything incomplete.

### Your Mandate

You must build, in full, with no placeholders, no TODOs, and no mock logic:

**1. Database Layer**
Build all PostgreSQL migration files covering every table defined in Section 9 of this document. Migrations must be numbered and sequential. Each migration must be reversible (down migration included). The `audit_log` table must have a comment documenting that UPDATE and DELETE are denied at the database permission level — include the SQL statement to enforce this in the migration.

Specifically:
- `users` table with bcrypt password storage
- `suppliers` table with unique_code and credibility fields
- `rfqs` table with all bidding rule fields, commercial term fields, and state enum
- `rfq_items` table
- `rfq_suppliers` table with access_token, status enum, and declaration flags
- `bids` table with revision_number, is_latest, and submission_hash
- `bid_items` table
- `audit_log` table (append-only; include DB-level enforcement)
- `system_config` table

**2. Authentication & Session Module (FR-01)**
Implement complete JWT authentication with access tokens (15-minute expiry), refresh tokens (7-day expiry, HttpOnly cookie, Redis-backed, rotated on use), and explicit logout that invalidates server-side. Implement bcrypt with cost factor 12. Implement the refresh token rotation pattern — each use of a refresh token must issue a new refresh token and invalidate the old one. Implement tokenized supplier link generation: time-bound, single-session-establishment, scoped to one RFQ. Implement RBAC middleware that enforces `ADMIN`, `BUYER`, `SUPPLIER` roles on every endpoint. Implement the `/api/time/now` endpoint returning server UTC time.

**3. RFQ Module (FR-02, FR-03)**
Implement complete RFQ CRUD. Implement RFQ number generation (`RFQ-YYYY-NNNN`, sequential per buyer per year). Implement the RFQ state machine (`DRAFT → PUBLISHED → ACTIVE → CLOSED → AWARDED`) with server-side enforcement — no invalid state transitions permitted. Implement commercial lock: the moment any supplier accepts, all commercial term fields and item table structure become read-only at the API level (return 409 on any modification attempt). Store a snapshot of the locked commercial terms in the audit log.

**4. Supplier Acceptance Module (FR-04)**
Implement accept endpoint that requires all three declaration boolean flags to be `true` in the request body — reject with 422 if any are false. Record acceptance with server timestamp and declaration text snapshot. Implement decline endpoint requiring reason text (minimum 20 characters). Prevent a declined supplier from later accepting the same RFQ.

**5. Bidding Engine (FR-05)**
This is the core of the system. Implement the price submission endpoint with ALL of the following enforced server-side:

- **Rule A — Revision Count**: Track `revision_number` per supplier per RFQ. If `revision_number >= max_revisions`, reject with 422 and error code `REVISION_LIMIT_REACHED`.
- **Rule B — Minimum Change %**: For each line item in the revision, compute `|new - old| / old * 100`. If any item's change is below `min_change_percent`, reject with 422, error code `MIN_CHANGE_NOT_MET`, and return which item IDs failed.
- **Rule C — Cooling Time**: Store `last_submission_at` per supplier per RFQ in Redis. If `now - last_submission_at < cooling_time_minutes * 60`, reject with 422, error code `COOLING_TIME_ACTIVE`, and return `seconds_remaining`.
- **Bid Window**: If server `now` is before `bid_open_at` or after `bid_close_at`, reject with 409 and error code `BID_WINDOW_CLOSED`.
- **Post-Close**: If RFQ status is `CLOSED` or `AWARDED`, reject with 409.
- **Partial Submission**: All items must have a price in the request. Reject with 422 if any item is missing.
- **Hash Sealing**: Compute SHA-256 of canonical JSON: `{supplier_code, rfq_id, revision_number, items: [{rfq_item_id, unit_price}], submitted_at}`. Store hash on the bid record.

The entire bid transaction (insert bid record, insert bid_items, update audit_log, update Redis last_submission_at, set is_latest = false on previous bid) must be atomic within a database transaction.

**6. Anti-Sniping Module (FR-05.3)**
Implement anti-sniping detection: after a bid submission, check if `bid_close_at - now <= anti_snipe_window_minutes`. If yes: update `rfq.bid_close_at = rfq.bid_close_at + anti_snipe_extension_minutes`, insert `DEADLINE_EXTENDED` audit log entry, and publish a Redis Pub/Sub message `rfq:{rfq_id}:deadline_extended` with the new close time. The WebSocket server subscribes to this channel and broadcasts to all connected clients for that RFQ.

**7. Ranking Engine (FR-06)**
Implement a ranking service that runs after every bid submission. The service:
- Queries the latest bid for each supplier for the given RFQ
- Calculates item-level rankings (sort by unit_price ascending, assign L1/L2/L3+, handle ties)
- Calculates total RFQ ranking (sort by total_price ascending)
- Calculates weighted ranking when weights are configured (normalize per dimension to 0–100 scale, apply weights, sort by composite score descending)
- Computes proximity signal for each supplier: `(supplier_total - L1_total) / L1_total * 100`; Very Close ≤ 2%, Close ≤ 10%, Far > 10%

The supplier-facing response serializer is a critical security boundary. It must:
- Return ONLY: `rank_color` (GREEN/YELLOW/RED), `proximity_label` (VERY_CLOSE/CLOSE/FAR), and the supplier's own item prices
- NEVER return: competitor prices, competitor codes, numeric rank position, total number of bidders
- This must be enforced in the serializer function by explicitly constructing the response object with an allowlist of fields — never spread/copy the full ranking object

After calculation, publish ranking update to Redis Pub/Sub for WebSocket broadcast.

**8. WebSocket Module**
Implement Socket.io server. On connection, clients authenticate using their JWT (passed as a query parameter or in the handshake auth object). After authentication, clients can subscribe to a specific RFQ channel. The server enforces that:
- Suppliers can only subscribe to RFQs they are assigned to
- Buyers can only subscribe to their own RFQs
- On rank update (from Redis Pub/Sub): emit to supplier-channel with supplier-specific data; emit to buyer-channel with full ranking data
- On deadline extended: emit to all clients subscribed to that RFQ

**9. Audit Module (FR-08)**
Implement an audit service with methods for each event type defined in Section 6, FR-08.1. Each audit log entry must:
- Compute a hash that includes the previous entry's hash (chain integrity). For the first entry, use a known genesis hash value (e.g., SHA-256 of "GENESIS").
- Be inserted atomically with the triggering operation (same DB transaction where applicable)

Implement a hash chain verification utility that can verify the integrity of the entire audit log chain for a given RFQ.

**10. Risk & Compliance Flags (FR-10)**
Implement a flag evaluation service that runs after each bid submission and on RFQ close. Implement all five flags (FLAG-01 through FLAG-05) with configurable thresholds from `system_config`. Store flags in a `rfq_flags` table. Expose via the Buyer flags API endpoint.

**11. Export Module (FR-09)**
Implement Excel export using ExcelJS with four sheets: cover, item comparison (post-close, prices revealed), audit trail, supplier summary. Implement PDF export. Both must complete within NFR time limits. Implement supplier receipt PDF (per submission, with hash).

**12. Credibility System (FR-11)**
Implement the credibility score calculation service across four dimensions. Implement update triggers. Expose credibility classification via Buyer and Admin endpoints. Ensure supplier API responses never include credibility data.

**13. Award & Simulation Modules (FR-12, FR-13)**
Implement award simulation engine (single, item-wise split). Implement award finalization endpoint. Simulations must not create audit log entries of type AWARD_FINALIZED.

**14. All Tests**
For every module you build, co-deliver its test file. Unit tests for all business logic. Integration tests for all API endpoints (all HTTP status codes, all error conditions, all business rules). All security tests SEC-T01 through SEC-T15 must be present and passing. All edge cases in Section 12.5 must have tests.

### Output Format

Deliver code organized by the folder structure in Section 8.2. For each file you produce:
1. State the full file path
2. Provide the complete file content (no truncation, no "...rest of implementation")
3. State what tests cover this file

Work sprint-by-sprint: complete Sprint 1 fully (code + tests + migrations) before starting Sprint 2. Do not proceed to the next sprint until you have confirmed the current sprint's tests pass.

### Reminder: What You Must Not Do
- Do not produce placeholder functions (e.g., `// TODO: implement ranking`)
- Do not produce mock returns in place of real logic
- Do not leave any security test (SEC-T01 through SEC-T15) unanswered
- Do not make architectural decisions not specified here without explicitly flagging them for review
- Do not add features not in this document

---

## 🎨 PROMPT FOR GEMINI — FRONTEND ENGINEER

---

**READ THIS ENTIRE PROMPT BEFORE WRITING A SINGLE LINE OF CODE.**

> ⚠️ **ENVIRONMENT — READ BEFORE CODING**
> Developer is on **Windows** using PowerShell.
> Do NOT use bash syntax (no `&&` chaining, no `KEY=VALUE npm run`). Use **cross-env** for env vars in npm scripts.
> Backend is running at `http://localhost:3000`. Do not modify any backend files.
> Create `/frontend/.env` with: `VITE_API_URL=http://localhost:3000`
> Frontend dev server runs on: `http://localhost:5173`

You are the **Frontend Engineer** for the Procurement Competitive Enquiry & Bidding Platform. Your job is to build the complete React frontend that interfaces with the backend built by Claude Opus 4.6. You are building a production-grade UI — not a prototype. Every screen must be fully functional, properly handling loading states, error states, empty states, and real-time updates.

### Your Scope: Frontend Only

You MAY build:
- All React components and pages
- All UI/UX flows for Admin, Buyer, and Supplier roles
- Client-side form validation (supplementary to server-side validation)
- API integration using Axios (consuming the API contracts in Section 10)
- Real-time WebSocket integration using Socket.io-client
- State management with React Query (server state) and Zustand (auth/notifications)
- Styling with Tailwind CSS
- TypeScript types for all components and API responses
- Frontend unit tests with Vitest + React Testing Library
- E2E tests with Playwright

You MUST NOT:
- Modify any backend API endpoint behavior
- Add new API endpoints
- Change the database schema
- Add features not in FR-01 through FR-14
- Redesign the architecture
- Skip any page or component listed below

### Technology Stack
- React 18+ with TypeScript (strict mode)
- Vite as the build tool
- Tailwind CSS for styling
- React Query (TanStack Query v5) for server state
- Zustand for global UI state (auth state, notification stack)
- Axios for HTTP (with interceptors for token refresh and error handling)
- Socket.io-client for WebSocket
- React Router v6 for routing
- React Hook Form + Zod for form validation
- Recharts or Chart.js for KPI charts (Sprint 7)
- Vitest + React Testing Library for unit tests
- Playwright for E2E tests

### Component Architecture — Required Components

**Shared/UI Components (build these first — everything depends on them):**
- `Button` — variants: primary, secondary, danger, ghost; sizes: sm, md, lg; loading state (spinner inside)
- `Input` — label, error message, helper text, required indicator
- `Textarea` — same as Input
- `Select` — with search/filter capability for large lists
- `Modal` — with portal rendering, focus trap, Escape key close
- `Badge` — variants for status colors (used for RFQ status, credibility classification)
- `Table` — with sortable columns, pagination, empty state slot
- `Spinner` / `Skeleton` — for loading states
- `Toast` / `Notification` — for success/error/warning messages (global notification system via Zustand)
- `ConfirmDialog` — reusable confirmation modal
- `RoleGuard` — wrapper component that renders children only if the current user has the required role; otherwise redirects

**Layout Components:**
- `AppShell` — sidebar + main content area
- `Sidebar` — role-aware navigation links; shows only links relevant to the current user's role
- `Navbar` — top bar with user name, role badge, logout button

**Auth Pages:**
- `LoginPage` — email + password form, "Remember me" (optional), error handling for invalid credentials, rate limit messaging ("Too many attempts, try again in X minutes")
- `TokenLandingPage` — handles the tokenized supplier link; extracts token from URL, calls backend to establish session, redirects to supplier RFQ view

**Admin Pages & Components:**
- `AdminDashboard` — summary cards (total users, active RFQs, recent audit events)
- `UserManagement` page — table of all users with role, status; create user form (slide-over panel); deactivate/reactivate user
- `SupplierManagement` page — table of supplier master data; onboard new supplier form; view/edit supplier details; credibility badge visible
- `AuditLogPage` — filterable, paginated audit log table; filters: date range, event type, RFQ ID; export button; each row expandable to show full event_data JSON
- `SystemConfigPage` — list of system config keys with current values; inline edit; save with confirmation

**Buyer Pages & Components:**
- `BuyerDashboard` — summary cards (active RFQs, RFQs pending award, savings achieved); list of recent RFQs with status badges
- `RFQListPage` — paginated table of buyer's RFQs; status filter; search by RFQ number/title; "Create RFQ" button
- `RFQCreatePage` — multi-step form:
  - Step 1: Basic info (title) + Item Requirement Table (add/edit/remove rows while in DRAFT; required fields enforced)
  - Step 2: Commercial Terms (all fields from FR-02.3)
  - Step 3: Bidding Rules (all fields from FR-02.4 with constraint validation; date-time pickers for bid open/close)
  - Step 4: Supplier Assignment (searchable multi-select from master supplier list; shows credibility badge per supplier; min 2 required)
  - Step 5: Review & Publish (summary of all inputs; "Save Draft" and "Publish" buttons)
  - Progress indicator between steps; ability to go back and edit
- `RFQDetailPage` — hub page for a single RFQ:
  - Status indicator and state transition buttons (Publish, Close, Award)
  - Commercial lock indicator (visible banner when locked)
  - Tabs: Overview | Live Rankings | Compliance Flags | Audit Log | Exports
- `LiveRankingsDashboard` (tab within RFQDetailPage):
  - Item-wise ranking table (updates via WebSocket): item description, L1 supplier code, L1 price, bidder count
  - Total ranking table: supplier code, total price, rank
  - Weighted ranking table (when weights configured): supplier code, score, rank
  - Real-time update indicator (pulsing dot showing WebSocket connection status)
  - Countdown timer to bid close (using server timestamp from `/api/time/now`)
- `ComplianceFlagsPanel` (tab within RFQDetailPage):
  - List of active flags; each flag shows type, affected supplier code, affected items, recommendation
  - Flag severity color coding (warning, danger)
- `AwardSimulationPage` — simulation builder:
  - Select simulation type (single supplier, item-wise split)
  - For split: item-by-item supplier assignment dropdowns
  - Show simulation results: total cost, delivery impact, supplier count, delta vs L1 total
  - "Run Another Scenario" button; side-by-side scenario comparison table
- `AwardFinalizationPage` — confirm award decision; input for award notes; submit button with confirmation dialog

**Supplier Pages & Components:**
- `SupplierDashboard` — list of assigned RFQs with status (Pending Acceptance, Active, Closed, Awarded); credibility score must NOT appear here
- `RFQViewPage` (Supplier) — the supplier's view of an assigned RFQ:
  - RFQ details header (RFQ number, buyer title, bid window countdown)
  - If status is PENDING: Accept / Decline buttons with modal for declarations (accept) or reason input (decline)
  - If status is ACCEPTED and bid is ACTIVE: Bid entry form (see below)
  - If status is ACTIVE and bid submitted: Rank display + revision form
  - If bid is CLOSED: Read-only view of own submitted prices; download receipt button
- `DeclarationModal` — for accepting an RFQ; three checkboxes with full declaration text; all must be checked before confirm; scrollable if text is long
- `DeclineModal` — text area for reason (minimum 20 characters enforced); submit button
- `BidEntryForm` — table matching the RFQ item structure; Unit Price input per row; Total Price auto-calculated client-side (and verified server-side on submit); Submit button with confirmation dialog ("Are you sure you want to submit? This counts as revision 0 of N.")
- `RankDisplayWidget` — prominent display after bid submission:
  - Large color indicator (green/yellow/red with accessible text label)
  - Proximity label ("Very Close to L1", "Close to L1", "Far from L1")
  - "Your Submitted Prices" section (own prices only)
  - Revision status: "X revisions remaining. Next revision available in Y minutes." (live countdown for cooling time)
  - Revision form (identical to BidEntryForm but pre-populated with current prices; diff highlighting on changed items)
- `CountdownTimer` — displays time remaining to bid close; updates every second using server time offset; shows "Bid Closed" when expired; auto-refreshes bid form to read-only state
- `ReceiptModal` — shows submission details; download PDF button

### Real-Time Behavior Requirements

The frontend must handle WebSocket events without requiring a page refresh:
- On `ranking:updated`: update all ranking tables and the supplier's rank widget in-place, without losing scroll position
- On `rfq:deadline_extended`: update the countdown timer; show a toast notification: "Bid window has been extended. New close time: [datetime]"
- On `rfq:closed`: immediately set all bid entry forms to read-only; show "Bid Closed" state; toast notification
- On WebSocket disconnect: show a reconnecting indicator; on reconnect, fetch fresh state via REST API to resolve any missed events

### Accessibility Requirements

- All color-based signals (rank colors, flag severity) must include a text label — not color alone
- All interactive elements must be keyboard accessible (Tab key navigation, Enter/Space activation)
- All form inputs must have associated `<label>` elements
- ARIA attributes for custom interactive components (modals, dropdowns)

### Form Validation Rules (Client-Side)

Implement these validations in React Hook Form + Zod, mirroring server-side rules:
- Item description: required, max 500 characters
- Specification: max 2000 characters
- Quantity: required, positive number
- max_revisions: required, integer ≥ 1
- min_change_percent: required, 0.01–100
- cooling_time_minutes: required, integer ≥ 1
- bid_open_at: required, must be in the future
- bid_close_at: required, must be after bid_open_at
- Supplier count for assignment: minimum 2
- Decline reason: minimum 20 characters, maximum 500 characters
- Unit price: required (on bid submission), positive number, max 4 decimal places
- Weighted ranking weights: each 0–100, must sum to 100

### Axios Configuration

Create an Axios instance with:
- Base URL from environment variable
- Request interceptor: attach `Authorization: Bearer {accessToken}` header
- Response interceptor: on 401, attempt token refresh via `/api/auth/refresh`; if refresh succeeds, retry the original request; if refresh fails (e.g., expired refresh token), clear auth state and redirect to login
- Request/response logging in development mode

### Error Handling Standards

- API errors (4xx, 5xx) must display user-friendly messages via the toast notification system
- 422 validation errors from the server must map to inline field errors in the form (where field names match)
- 409 conflicts (commercial lock, bid window closed) must show a modal or prominent inline message explaining why the action failed
- Network errors (no response) must show a connectivity error notification
- Empty API responses must trigger descriptive empty state components, not blank screens

### Output Format

Deliver code organized by the folder structure in Section 8.3. For each component:
1. State the full file path
2. Provide the complete component implementation
3. Include associated Vitest unit test where applicable

Build components in dependency order: shared UI components first, then layout, then page components.

### Reminder: What You Must Not Do
- Do not modify API contracts from Section 10
- Do not add new API endpoints
- Do not add features not in this document
- Do not use inline styles — Tailwind only
- Do not leave any page in a placeholder state

---

## 🐞 PROMPT FOR GPT — BUG FIX ENGINEER

---

**READ THIS ENTIRE PROMPT BEFORE MAKING ANY CHANGES.**

You are the **Bug Fix Engineer** for the Procurement Competitive Enquiry & Bidding Platform. The backend has been built by Claude Opus 4.6 and the frontend by Gemini. Your role is strictly limited to fixing bugs in existing code. You are not here to improve features, refactor architecture, or add anything new.

### Your Scope: Bug Fixing Only

You MAY:
- Identify and explain the root cause of reported bugs
- Fix runtime errors (crashes, unhandled exceptions, type errors)
- Fix logic bugs (incorrect ranking calculation, wrong state transitions, incorrect hash computation)
- Fix performance bugs (N+1 queries, missing indexes, excessive re-renders)
- Fix security bugs (data leakage, missing authorization check, token handling issue)
- Make minimal, safe refactors of a small section of code to fix the bug (no broader refactoring)

You MUST NOT:
- Add any new feature, API endpoint, UI page, or component
- Redesign or reorganize the project architecture or folder structure
- Rewrite entire modules (even if you think you could write it better)
- Change business rules to different values or interpretations
- Add speculative improvements ("while I'm here, I'll also...")
- Modify the database schema unless the bug is specifically a schema error
- Change the technology stack

### Bug Fix Process

For every bug you address:

1. **Identify**: State the exact file path and line number(s) where the bug originates.
2. **Diagnose**: Explain the root cause in one to three sentences. Be specific — what condition causes the bug to occur? Under what inputs or timing?
3. **Impact**: State what the bug causes (incorrect behavior, error thrown, security risk, etc.) and which requirements from this document (FR-XX, NFR-XX, SEC-T-XX) are violated.
4. **Fix**: Provide the minimal diff/change to fix the bug. If the fix spans multiple files, list each file.
5. **Verify**: State which existing test(s) will now pass (or describe a new minimal test case that should be added to confirm the fix).
6. **Preserve**: Confirm that the fix does not alter any existing passing tests or expected behavior.

### Critical System Invariants You Must Never Break

No bug fix may violate these invariants, even if the reported bug seems to require it:

- **Invariant 1**: Supplier API responses must never contain competitor prices, competitor codes, or numeric rank positions.
- **Invariant 2**: Audit log records must never be modified or deleted.
- **Invariant 3**: Server timestamps must remain authoritative for all time-sensitive operations.
- **Invariant 4**: Bid records must remain immutable once inserted.
- **Invariant 5**: Commercial lock must remain enforced once triggered.
- **Invariant 6**: All three revision rules (count, min change, cooling time) must all still be enforced after any fix to the bidding engine.

If a reported bug, when fixed, would require violating any of the above invariants, you must flag this and propose an alternative fix that respects all invariants. Do not proceed with a fix that violates invariants without explicit escalation.

### Output Format for Each Bug Fix

```
## Bug Fix Report: [BUG-ID or short description]

**File(s):** [full path(s)]
**Line(s):** [line numbers]

**Root Cause:**
[One to three sentences explaining what is wrong and why]

**Impact:**
[What breaks, what FR/NFR/SEC-T is violated]

**Fix (diff format):**
- Before: [original code snippet]
+ After: [fixed code snippet]

**Verification:**
[Which test now passes, or new minimal test case]

**Invariants Checked:** All six invariants preserved ✓
```

---

# TEST USER ACCOUNTS (Mandatory for QA)

The following accounts must be created via the database seed (`/src/database/seeds/`):

```
Admin:
  Email: admin@platform.local
  Password: Admin@Secure123
  Role: ADMIN

Buyers:
  buyer1@platform.local  /  Buyer@Secure123  /  Role: BUYER
  buyer2@platform.local  /  Buyer@Secure123  /  Role: BUYER

Suppliers:
  supplier1@platform.local  /  Supplier@Secure1  /  Role: SUPPLIER  /  Code: auto-generated
  supplier2@platform.local  /  Supplier@Secure2  /  Role: SUPPLIER  /  Code: auto-generated
  supplier3@platform.local  /  Supplier@Secure3  /  Role: SUPPLIER  /  Code: auto-generated
  supplier4@platform.local  /  Supplier@Secure4  /  Role: SUPPLIER  /  Code: auto-generated
  supplier5@platform.local  /  Supplier@Secure5  /  Role: SUPPLIER  /  Code: auto-generated
```

Seeds must be idempotent (running twice does not create duplicates).

---

# APPENDIX: QUICK REFERENCE

## RFQ State Machine
```
DRAFT ──publish──▶ PUBLISHED ──bid_open_at reached──▶ ACTIVE ──bid_close_at or manual──▶ CLOSED ──award──▶ AWARDED
```

## Rank Color Logic (Supplier View)
```
L1 → GREEN  → "You are currently the most competitive."
L2 → YELLOW → "You are second most competitive."
L3+ → RED   → "You are not among the top 2."
```

## Proximity Signal
```
Gap ≤ 2%   → "Very Close to L1"
Gap 2–10%  → "Close to L1"
Gap > 10%  → "Far from L1"
Gap = N/A  (only 1 bidder, or you are L1) → no proximity signal shown
```

## Credibility Classification
```
Score ≥ 80 → EXCELLENT
Score 50–79 → STABLE
Score < 50  → RISKY
```

## Revision Rules (all must pass for revision to be accepted)
```
Rule A: current_revision_count < max_revisions
Rule B: |new_price - old_price| / old_price ≥ min_change_percent (for every item)
Rule C: now - last_submission_at ≥ cooling_time_minutes
```

## Anti-Snipe Logic
```
IF bid_close_at - now ≤ anti_snipe_window_minutes:
  bid_close_at = bid_close_at + anti_snipe_extension_minutes
  LOG: DEADLINE_EXTENDED
  BROADCAST: rfq:{rfq_id}:deadline_extended
```

---

*END OF MASTER EXECUTION FILE — v2.1*
*This document supersedes all previous versions. Do not use any prior version.*
*Section 2 (Business Requirements) added from client-provided specification. All BRs are fully traced to FRs.*