# ProcureX

**Enterprise Procurement Competitive Enquiry & Bidding Platform**

A real-time, multi-role procurement platform where buyers create competitive enquiries, suppliers submit sealed bids, and administrators oversee the entire process with full audit traceability. Built with security-first architecture, zero data leakage between competitors, and an immutable SHA-256 hash-chained audit log.

---

## Features

### Core Procurement Engine
- **RFQ lifecycle management** with state machine enforcement (DRAFT → PUBLISHED → ACTIVE → CLOSED → AWARDED)
- **Sequential RFQ numbering** (`RFQ-YYYY-NNNN`) with global uniqueness
- **Commercial lock** — first supplier acceptance freezes item table and commercial terms with 409 enforcement on edits
- **Multi-item enquiries** with buyer-defined description, specification, UOM, and quantity fields

### Real-Time Bidding
- **Live bid submission and revision** with three simultaneously-enforced rules: revision count limit, minimum percentage change per item, and cooling time between revisions
- **SHA-256 hash sealing** of every bid submission for tamper detection
- **WebSocket rank updates** — suppliers receive own-rank-only updates via per-supplier Socket.io rooms; buyers see full competitive landscape
- **Anti-sniping protection** — race-condition-safe deadline extension using PostgreSQL `SELECT FOR UPDATE` row locking
- **Proximity signals** — suppliers see distance from L1 (Very Close ≤2%, Close ≤10%, Far >10%) without revealing competitor prices

### Ranking & Analytics
- **Item-level and total ranking** with dense ranking and tie handling
- **Weighted ranking** — configurable price/delivery/payment weights that must sum to exactly 100
- **KPI dashboard** — cycle time, savings vs. reference prices, participation ratio, price convergence coefficient of variation, supplier competitiveness index
- **Supplier credibility scoring** — four-dimension composite score (response discipline, revision behavior, win rate, post-award fulfillment) with EXCELLENT/STABLE/RISKY classification

### Compliance & Risk
- **Five automated compliance flags** evaluated after every bid submission:
  - FLAG-01: Delivery deviation from RFQ target
  - FLAG-02: Payment terms mismatch
  - FLAG-03: Abnormally low price (below average threshold)
  - FLAG-04: Supplier dominance (L1 on excessive percentage of items)
  - FLAG-05: Late revisions in final window of bidding period
- **Configurable thresholds** stored in system config, not hardcoded

### Negotiation Mode
- **Post-close private second round** — buyer invites top-N suppliers from a closed RFQ to negotiate with new bidding rules
- Same bidding engine, anonymity rules, and audit requirements as the parent RFQ
- Separate WebSocket rooms, cooling time namespaces, and anti-snipe logic

### Award Simulation
- **Three simulation modes** — single supplier, item split (per-item allocation), and category split (grouped allocation)
- **Zero-write invariant** — simulations never create database records or audit entries
- **Theoretical minimum cost** calculation showing the best possible outcome across all bidders
- **Per-supplier breakdown** with subtotals and delta from L1

### Exports & Audit
- **Excel export** (4 sheets: Cover, Item Comparison, Audit Trail, Supplier Summary)
- **PDF export** with hash reference footer for chain-of-custody verification
- **Supplier confirmation receipt** — per-revision PDF with SHA-256 hash, timestamp, and supplier code
- **Immutable audit log** — append-only with DB-level INSERT-only permissions, SHA-256 hash chain from genesis, covering 15+ event types
- **Audit chain verification** — `verifyAuditChain(rfqId)` detects any tampering at the exact broken entry

### Security
- **Zero data leakage** — supplier API responses use allowlist serializers that construct response objects from scratch (never spread or copy)
- **Per-supplier WebSocket rooms** — competitors never share a channel
- **RBAC on every endpoint** — ADMIN, BUYER, SUPPLIER roles enforced at middleware level
- **17 security tests** (SEC-T01 through SEC-T15 plus negotiation-specific SEC-T01-NEG and SEC-T02-NEG)

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **Node.js 20** / **TypeScript 5.3** | Runtime and language |
| **Express 4.18** | HTTP framework |
| **PostgreSQL 15** | Primary relational database |
| **Redis 7** | Cooling time enforcement, refresh token store, Pub/Sub for real-time events |
| **Socket.io 4.8** | WebSocket server for live rank updates and deadline broadcasts |
| **Knex.js 3.1** | Query builder, migrations, seeds (parameterized queries — no SQL injection risk) |
| **Zod 3.22** | Request body and query parameter validation |
| **JWT** (jsonwebtoken 9.0) | Access tokens (15min) and refresh tokens (7d, HttpOnly cookie) |
| **bcryptjs** | Password hashing (cost factor 12) |
| **ExcelJS 4.4** | Multi-sheet Excel export generation |
| **PDFKit 0.17** | PDF export and supplier receipt generation |
| **node-cron 4.2** | Scheduled auto-close of expired bid windows |
| **Helmet 7.1** | Security headers (CSP, X-Frame-Options, HSTS) |
| **Winston 3.11** | Structured logging |
| **Swagger (swagger-jsdoc + swagger-ui-express)** | OpenAPI documentation |

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** / **TypeScript 5.2** | UI framework |
| **Vite 5.2** | Build tool and dev server |
| **Tailwind CSS 3.4** | Utility-first styling with custom design tokens |
| **TanStack Query 5.28** | Server state management and caching |
| **Zustand 4.5** | Client state management |
| **React Router 6.22** | Client-side routing with role-based guards |
| **React Hook Form 7.51** + **Zod** | Form handling with schema validation |
| **Socket.io Client 4.7** | Real-time WebSocket connection |
| **Recharts 3.7** | KPI trend charts |
| **Phosphor Icons** | Icon system |
| **Inter** + **JetBrains Mono** | Typography (UI text and monospace numbers/codes) |

### Infrastructure
| Technology | Purpose |
|---|---|
| **Docker Compose** | Local development (PostgreSQL, PostgreSQL test, Redis) |
| **Multi-stage Dockerfile** | Production build (node:20-alpine) |
| **Jest 29** + **Supertest** | Backend unit, integration, security, and E2E tests |
| **Vitest 1.4** + **Testing Library** | Frontend unit tests |
| **Playwright 1.42** | Frontend E2E tests |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│  (Vite · Tailwind · TanStack Query · Zustand · Socket.io)       │
│  Port 5173                                                      │
└──────────────────┬────────────────────────┬─────────────────────┘
                   │ HTTP (Axios)           │ WebSocket (Socket.io)
                   ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Express API Server                          │
│  Port 3000                                                      │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │   Auth   │ │   RFQ    │ │ Bidding  │ │   Negotiation    │   │
│  │  Module  │ │  Module  │ │  Module  │ │     Module       │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Ranking  │ │  Flags   │ │Credibil. │ │   Simulation     │   │
│  │  Module  │ │  Module  │ │  Module  │ │     Module       │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │  Audit   │ │  Export  │ │   KPI    │ │    Scheduler     │   │
│  │  Module  │ │  Module  │ │  Module  │ │     Module       │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │  Admin   │ │ Supplier │ │  Users   │ │  WebSocket GW    │   │
│  │  Module  │ │  Module  │ │  Module  │ │  (Socket.io)     │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│  ┌──────────┐                                                   │
│  │   Time   │  RBAC Middleware · JWT Auth · Rate Limiting       │
│  │  Module  │  Helmet · Zod Validation · Winston Logging        │
│  └──────────┘                                                   │
└──────────┬────────────────────────────────┬─────────────────────┘
           │                                │
           ▼                                ▼
┌─────────────────────┐        ┌─────────────────────┐
│   PostgreSQL 15     │        │      Redis 7        │
│   Port 5432         │        │      Port 6379      │
│                     │        │                     │
│  13 migrations      │        │  Cooling time TTLs  │
│  Append-only audit  │        │  Refresh tokens     │
│  INSERT-only perms  │        │  Pub/Sub channels   │
│  Hash chain         │        │  Rate limit store   │
└─────────────────────┘        └─────────────────────┘
```

---

## Project Structure

```
procurement-platform/
├── backend/
│   ├── src/
│   │   ├── config/           # Database, Redis, environment configuration
│   │   ├── middleware/        # auth, rbac, rateLimiter, errorHandler, validateBody
│   │   ├── modules/
│   │   │   ├── admin/         # Admin endpoints (users, suppliers, config, overrides)
│   │   │   ├── audit/         # Audit log service, hash chain, verification
│   │   │   ├── auth/          # Login, refresh, logout, token management
│   │   │   ├── bidding/       # Bid submission, revision, rule enforcement
│   │   │   ├── credibility/   # 4-dimension supplier scoring system
│   │   │   ├── export/        # Excel, PDF, supplier receipt generation
│   │   │   ├── flags/         # Compliance flag evaluation (FLAG-01 to FLAG-05)
│   │   │   ├── kpi/           # KPI calculations and dashboard endpoints
│   │   │   ├── negotiation/   # Post-close negotiation rounds
│   │   │   ├── ranking/       # Ranking engine, serializers, proximity
│   │   │   ├── rfq/           # RFQ CRUD, state machine, commercial lock
│   │   │   ├── scheduler/     # node-cron auto-close job
│   │   │   ├── simulation/    # Award simulation (3 modes, zero-write)
│   │   │   ├── suppliers/     # Supplier management, code generation
│   │   │   ├── time/          # Server UTC endpoint for clock sync
│   │   │   ├── users/         # User creation, deactivation
│   │   │   └── websocket/     # Socket.io gateway, Redis Pub/Sub, rooms
│   │   ├── shared/
│   │   │   ├── types/         # Enums, interfaces, TypeScript types
│   │   │   ├── utils/         # Hash utilities, helpers
│   │   │   └── validators/    # Zod schemas for all request bodies
│   │   ├── database/
│   │   │   ├── migrations/    # 13 sequential migration files
│   │   │   └── seeds/         # Test user and data seeds
│   │   ├── app.ts             # Express app configuration
│   │   └── server.ts          # Server entry point
│   ├── tests/
│   │   ├── unit/              # Pure function tests (no DB dependency)
│   │   ├── integration/       # API tests against test PostgreSQL
│   │   ├── security/          # SEC-T01 through SEC-T15
│   │   ├── e2e/               # E2E-01 through E2E-04
│   │   └── helpers/           # Test setup, database utilities, factories
│   ├── docker-compose.yml     # PostgreSQL + PostgreSQL test + Redis
│   ├── Dockerfile             # Multi-stage production build
│   ├── .env.example           # Environment variable template
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── api/               # Typed API client functions (axios)
│   │   ├── components/
│   │   │   ├── ui/            # Design system (Button, Input, Table, Modal, etc.)
│   │   │   ├── auth/          # RoleGuard, auth components
│   │   │   └── layout/        # AppShell, Sidebar, navigation
│   │   ├── pages/
│   │   │   ├── admin/         # Dashboard, Users, Suppliers, Audit, Config
│   │   │   ├── auth/          # LoginPage, TokenLandingPage
│   │   │   ├── buyer/         # Dashboard, RFQ List/Create/Detail, Simulation, Award, KPIs
│   │   │   └── supplier/      # Dashboard, RFQ View (5 states), Bid Form, Modals
│   │   ├── store/             # Zustand stores (auth, toast)
│   │   ├── hooks/             # Custom React hooks
│   │   ├── App.tsx            # Router, providers, role-based routing
│   │   └── main.tsx           # Entry point with font imports
│   ├── tests/
│   │   └── e2e/               # Playwright E2E tests
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── tsconfig.json
├── AGENT_INSTRUCTIONS.md      # Build guide and design system specification
├── MASTER_EXECUTION_FILE.md   # Functional requirements and system specification
├── PROGRESS.md                # Sprint-by-sprint build log
└── README.md                  # This file
```

---

## Prerequisites

- **Node.js 20+** — [Download](https://nodejs.org/)
- **Docker Desktop** — [Download](https://www.docker.com/products/docker-desktop/)
- **Git** — [Download](https://git-scm.com/)

Verify installations:

```powershell
node -v     # v20.x.x or higher
docker -v   # Docker version 24+ or higher
git -v      # git version 2.x
```

---

## Getting Started

### 1. Clone the repository

```powershell
git clone https://github.com/your-org/procurement-platform.git
cd procurement-platform
```

### 2. Start Docker containers

```powershell
cd backend
docker-compose up -d
```

Wait for all three containers to be healthy:

```
 ✔ Container procurement-postgres       Running
 ✔ Container procurement-postgres-test  Running
 ✔ Container procurement-redis          Running
```

### 3. Install backend dependencies

```powershell
cd backend
npm install
```

### 4. Configure environment

```powershell
copy .env.example .env
```

Edit `.env` and replace the placeholder secrets with secure random strings (minimum 32 characters each for `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `SUPPLIER_LINK_SECRET`).

### 5. Run database migrations

```powershell
npm run migrate
```

### 6. Seed test data

```powershell
npm run seed
```

### 7. Start the backend server

```powershell
npm run dev
```

The API server starts at `http://localhost:3000`. OpenAPI documentation is available at `http://localhost:3000/api/docs` in development mode.

### 8. Install and start the frontend

```powershell
cd ..\frontend
npm install
npm run dev
```

The frontend starts at `http://localhost:5173`.

### 9. Open the application

Navigate to `http://localhost:5173` in your browser. Log in with any of the test accounts listed below.

---

## Environment Variables

Create a `.env` file in the `backend/` directory. All variables are documented in `.env.example`:

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Environment mode (`development`, `test`, `production`) |
| `PORT` | `3000` | API server port |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/procurement_dev` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection string |
| `JWT_SECRET` | — | Access token signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | — | Refresh token signing secret (min 32 chars) |
| `JWT_ACCESS_EXPIRY_MINUTES` | `15` | Access token TTL in minutes |
| `JWT_REFRESH_EXPIRY_DAYS` | `7` | Refresh token TTL in days |
| `BCRYPT_ROUNDS` | `12` | bcrypt cost factor |
| `RATE_LIMIT_WINDOW_MINUTES` | `15` | Rate limit window duration |
| `RATE_LIMIT_MAX_ATTEMPTS` | `5` | Max login attempts per window per IP |
| `SUPPLIER_LINK_EXPIRY_HOURS` | `72` | Tokenized supplier link TTL |
| `SUPPLIER_LINK_SECRET` | — | Supplier link signing secret (min 32 chars) |
| `LOG_LEVEL` | `info` | Winston log level |

For integration tests, a `.env.test` file is also required:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/procurement_test
REDIS_URL=redis://localhost:6379/1
NODE_ENV=test
```

---

## Test Accounts

The database seed creates the following accounts for development and testing:

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@platform.local` | `Admin@Secure123` |
| **Buyer** | `buyer1@platform.local` | `Buyer@Secure123` |
| **Buyer** | `buyer2@platform.local` | `Buyer@Secure123` |
| **Supplier** | `supplier1@platform.local` | `Supplier@Secure1` |
| **Supplier** | `supplier2@platform.local` | `Supplier@Secure2` |
| **Supplier** | `supplier3@platform.local` | `Supplier@Secure3` |
| **Supplier** | `supplier4@platform.local` | `Supplier@Secure4` |
| **Supplier** | `supplier5@platform.local` | `Supplier@Secure5` |

Each supplier is auto-assigned a unique 5-character alphanumeric code on creation. Seeds are idempotent — running twice does not create duplicates.

---

## Running Tests

All test commands use `cross-env` for Windows PowerShell compatibility. Docker containers must be running for integration, security, and E2E tests.

```powershell
cd backend

# All tests (752 tests, 48 suites)
npm test

# Unit tests only (no Docker needed)
npm run test:unit

# Integration tests (requires Docker)
npm run test:integration

# Security tests (SEC-T01 through SEC-T15)
npm run test:security

# End-to-end tests
npm run test:e2e

# Test with coverage report
npm run test:coverage
```

### Test Categories

| Category | Count | Description |
|---|---|---|
| **Unit** | ~300+ | Pure function tests — ranking, hashing, credibility, flags, KPI, simulation, state machines, serializers |
| **Integration** | ~350+ | API endpoint tests against test PostgreSQL — full CRUD, RBAC, bidding flows, negotiation lifecycle |
| **Security** | 17 | SEC-T01 through SEC-T15 plus SEC-T01-NEG and SEC-T02-NEG for negotiation |
| **E2E** | 4 suites | E2E-01 full lifecycle (17 steps), E2E-02 zero data leakage, E2E-03 anti-snipe, E2E-04 hash integrity |

### Frontend Tests

```powershell
cd frontend

# Vitest unit tests
npm test

# Playwright E2E tests (requires both servers running)
npm run test:e2e
```

---

## Security Features

### Authentication & Authorization
- **JWT access tokens** (15-minute expiry) with **refresh token rotation** (7-day, HttpOnly cookie, Redis-backed)
- **bcrypt password hashing** with cost factor 12
- **RBAC middleware** on every endpoint — ADMIN, BUYER, SUPPLIER roles enforced
- **Rate limiting** — 5 login attempts per IP per 15 minutes, then HTTP 429
- **Tokenized supplier links** — time-bound, single-session, scoped to specific RFQ

### Data Isolation
- **Allowlist serializer** — supplier-facing API responses are constructed field-by-field from an explicit allowlist; never uses object spread, `Object.assign`, or property deletion
- **Per-supplier WebSocket rooms** — `rfq:{id}:supplier:{userId}` ensures competitors never share a channel
- **Query-level scoping** — buyer endpoints use `WHERE buyer_id = ?` (returns 404 for non-owned resources, not 403)
- **Zero competitor data leakage** — verified by recursive deep-scan E2E test (E2E-02) across all supplier-facing endpoints

### Audit Trail Integrity
- **Append-only audit log** with DB-level `REVOKE UPDATE, DELETE ON audit_log` enforcement
- **SHA-256 hash chain** — each entry hashes `canonicalStringify(event_data) + previous_entry_hash`
- **Genesis hash** — `SHA-256("GENESIS")` for the first entry in any chain
- **Canonical JSON serialization** — deterministic key ordering survives PostgreSQL JSONB round-trips
- **Chain verification** — `verifyAuditChain(rfqId)` returns `{ valid, brokenAtEntryId }` to detect any tampering

### HTTP Security Headers
- `Content-Security-Policy` via Helmet
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security`

### Security Test Coverage

| Test ID | Assertion |
|---|---|
| SEC-T01 | No competitor prices in supplier ranking response |
| SEC-T02 | No competitor data in supplier RFQ response |
| SEC-T03 | Cross-supplier access returns 403 |
| SEC-T04 | Cross-buyer access returns 404 |
| SEC-T05 | Admin cannot use supplier endpoints |
| SEC-T06 | Bid after close time rejected (409) |
| SEC-T07 | Revision after max revisions rejected (422) |
| SEC-T08 | Login brute force rate limited (429) |
| SEC-T09 | Tampered JWT payload rejected (401) |
| SEC-T10 | Expired access token rejected (401) |
| SEC-T11 | Expired tokenized link rejected (401) |
| SEC-T12 | Audit log DELETE rejected at DB permission level |
| SEC-T13 | Commercial terms edit after lock rejected (409) |
| SEC-T14 | SQL injection stored as literal text |
| SEC-T15 | XSS payload stored as text, rendered escaped |
| SEC-T01-NEG | No competitor prices in negotiation ranking |
| SEC-T02-NEG | No competitor data in negotiation detail |

---

## API Documentation

Interactive OpenAPI documentation is available at `http://localhost:3000/api/docs` when the backend is running in development mode.

### Endpoint Groups

**Authentication** (`/api/auth`)
```
POST   /api/auth/login          Login with email and password
POST   /api/auth/refresh         Rotate refresh token
POST   /api/auth/logout          Invalidate session
GET    /api/auth/me              Current user profile
```

**Buyer — RFQ Management** (`/api/buyer/rfqs`)
```
POST   /api/buyer/rfqs                     Create RFQ
GET    /api/buyer/rfqs                      List buyer's RFQs
GET    /api/buyer/rfqs/:id                  RFQ detail
PUT    /api/buyer/rfqs/:id                  Update RFQ (DRAFT only)
POST   /api/buyer/rfqs/:id/publish          Publish RFQ
POST   /api/buyer/rfqs/:id/suppliers        Assign suppliers
PATCH  /api/buyer/rfqs/:id/weights          Set ranking weights
POST   /api/buyer/rfqs/:id/close            Manual close
POST   /api/buyer/rfqs/:id/simulation       Run award simulation
POST   /api/buyer/rfqs/:id/award            Finalise award
GET    /api/buyer/rfqs/:id/rankings         Live rankings
GET    /api/buyer/rfqs/:id/flags            Compliance flags
GET    /api/buyer/rfqs/:id/audit-log        RFQ audit trail
GET    /api/buyer/rfqs/:id/export/excel     Excel export
GET    /api/buyer/rfqs/:id/export/pdf       PDF export
POST   /api/buyer/rfqs/:id/negotiation      Create negotiation round
```

**Buyer — Negotiations** (`/api/buyer/negotiations`)
```
GET    /api/buyer/negotiations/:id          Negotiation detail
GET    /api/buyer/negotiations/:id/rankings Full rankings
POST   /api/buyer/negotiations/:id/close    Close negotiation
POST   /api/buyer/negotiations/:id/award    Award negotiation
POST   /api/buyer/negotiations/:id/simulation  Negotiation simulation
```

**Buyer — KPIs** (`/api/buyer/kpis`)
```
GET    /api/buyer/kpis?from=DATE&to=DATE    Buyer-scoped KPI dashboard
```

**Supplier** (`/api/supplier`)
```
GET    /api/supplier/rfqs                   List assigned RFQs
GET    /api/supplier/rfqs/:id               RFQ detail (own data only)
POST   /api/supplier/rfqs/:id/accept        Accept with declarations
POST   /api/supplier/rfqs/:id/decline       Decline with reason
POST   /api/supplier/rfqs/:id/bids          Submit initial bid
PUT    /api/supplier/rfqs/:id/bids          Revise bid
GET    /api/supplier/rfqs/:id/ranking       Own rank and proximity
GET    /api/supplier/rfqs/:id/bid-status    Revision count, cooling time
GET    /api/supplier/rfqs/:id/receipt       Download confirmation receipt (PDF)
```

**Supplier — Negotiations** (`/api/supplier/negotiations`)
```
GET    /api/supplier/negotiations/:id           Negotiation detail
POST   /api/supplier/negotiations/:id/bids      Submit negotiation bid
PUT    /api/supplier/negotiations/:id/bids      Revise negotiation bid
GET    /api/supplier/negotiations/:id/ranking   Own negotiation rank
GET    /api/supplier/negotiations/:id/bid-status Bid status
```

**Admin** (`/api/admin`)
```
GET    /api/admin/users                     List all users
POST   /api/admin/users                     Create user
PATCH  /api/admin/users/:id                 Update user (activate/deactivate)
GET    /api/admin/suppliers                 List all suppliers with credibility
POST   /api/admin/suppliers                 Onboard new supplier
GET    /api/admin/audit-log                 Query audit log with filters
POST   /api/admin/overrides                 Admin override action
GET    /api/admin/config                    List system configuration
PUT    /api/admin/config/:key               Update config value
POST   /api/admin/rfqs/:id/fulfill          Mark award as fulfilled
POST   /api/admin/rfqs/:id/extend           Extend bid deadline
GET    /api/admin/kpis?from=DATE&to=DATE    System-wide KPIs
```

**Utility**
```
GET    /api/time/now                        Server UTC timestamp
GET    /api/health                          Health check
GET    /api/docs                            OpenAPI documentation (dev only)
```

---

## User Roles

### Admin
- Create and manage user accounts (Buyer and Supplier)
- Onboard new suppliers
- View system-wide audit log with filters
- Manage system configuration (flag thresholds, etc.)
- View system-wide KPIs and supplier competitiveness index
- Issue admin overrides with mandatory justification (min 50 chars)
- Extend bid deadlines with justification
- Mark awards as fulfilled (triggers credibility recalculation)

### Buyer
- Create, edit, and publish RFQs with items, commercial terms, and bidding rules
- Assign suppliers and generate tokenized access links
- Configure weighted ranking (price/delivery/payment)
- Monitor live rankings via WebSocket during active bid windows
- View compliance flags raised by the system
- Run award simulations (3 modes) without affecting data
- Finalise awards (irreversible, recorded in audit chain)
- Export results to Excel and PDF
- View procurement KPIs (cycle time, savings, participation, convergence)
- Create post-close negotiation rounds with selected suppliers

### Supplier
- Access platform via tokenized link or email/password login
- View assigned RFQ details, items, and commercial terms
- Accept participation (3 declarations required) or decline (20+ char reason required)
- Submit bids with per-item pricing
- Revise bids within enforced rules (revision limit, minimum change, cooling time)
- View own competitive position (rank color, proximity label) — never competitor data
- Download confirmation receipt PDFs with SHA-256 hash
- Participate in negotiation rounds when invited

---

## Build for Production

### Backend Docker Build

```powershell
cd backend
docker build -t procurement-backend .
docker run -p 3000:3000 --env-file .env procurement-backend
```

The Dockerfile uses a multi-stage build:
1. **Builder stage** — installs all dependencies, compiles TypeScript
2. **Production stage** — copies only compiled output and production dependencies, includes health check

```dockerfile
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
```

### Frontend Build

```powershell
cd frontend
npm run build
```

The built assets are output to `frontend/dist/` and can be served by any static file server or CDN. Configure `VITE_API_URL` in `frontend/.env` to point to the production API server.

### TypeScript Compilation

```powershell
# Backend type check (no emit)
cd backend
npm run typecheck

# Frontend type check + build
cd frontend
npm run build
```

---

## Contributing

1. **Fork** the repository
2. **Create a feature branch** from `main`
3. **Write tests** for any new functionality (unit tests for pure functions, integration tests for endpoints)
4. **Run the full test suite** before submitting:
   ```powershell
   cd backend
   docker-compose up -d
   npm test
   npm run test:security
   ```
5. **Submit a pull request** with a clear description of changes

### Code Standards
- TypeScript strict mode enabled
- ESLint + Prettier enforced via Husky pre-commit hooks
- All database queries use parameterized queries via Knex (no raw string interpolation)
- All request bodies validated with Zod schemas
- Supplier-facing API responses must use allowlist serializers (never spread)
- All destructive actions must create audit log entries

### System Invariants (never violate these)
1. Supplier API responses never contain competitor prices, codes, or rank positions
2. Audit log records are never modified or deleted
3. Server timestamps are authoritative for all time-sensitive operations
4. Bid records are immutable once inserted
5. Commercial lock is enforced once triggered — no bypass
6. All 3 revision rules (count + min change + cooling) are enforced simultaneously

---

## License

This project is proprietary software. All rights reserved.
