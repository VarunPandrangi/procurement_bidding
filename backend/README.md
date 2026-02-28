# Procurement Platform — Backend API

Competitive Enquiry & Bidding Platform REST API built with Express.js, TypeScript, PostgreSQL, and Redis.

## Prerequisites

- **Node.js 20+**
- **Docker Desktop for Windows** (for PostgreSQL and Redis)

## Setup

```powershell
# 1. Copy environment config
copy .env.example .env
# Edit .env — replace JWT_SECRET and JWT_REFRESH_SECRET with random 32+ character strings

# 2. Start databases
docker-compose up -d

# 3. Install dependencies
npm install

# 4. Run database migrations
npm run migrate

# 5. Seed initial data (admin, buyers, suppliers)
npm run seed

# 6. Start development server
npm run dev
```

The API will be available at `http://localhost:3000`.
Swagger documentation (dev only): `http://localhost:3000/api/docs`

## Testing

```powershell
# Unit tests (no DB required)
npm run test:unit

# All tests (requires test DB running on port 5433)
npm test

# Security tests
npm run test:security

# E2E full lifecycle tests
npm run test:e2e

# Integration tests
npm run test:integration

# Coverage report
npm run test:coverage
```

## Production Build

```powershell
# TypeScript compilation
npm run build

# Start production server
npm start
```

## Docker Production Build

```powershell
# Build image
docker build -t procurement-backend .

# Run container
docker run -p 3000:3000 --env-file .env procurement-backend
```

## API Overview

| Group | Base Path | Auth |
|---|---|---|
| Auth | `/api/auth` | Public (login), Bearer (others) |
| Time | `/api/time` | Public |
| Admin | `/api/admin` | ADMIN role |
| Buyer RFQs | `/api/buyer/rfqs` | BUYER role |
| Buyer KPIs | `/api/buyer/kpis` | BUYER role |
| Buyer Negotiations | `/api/buyer/negotiations` | BUYER role |
| Supplier RFQs | `/api/supplier/rfqs` | SUPPLIER role |
| Supplier Negotiations | `/api/supplier/negotiations` | SUPPLIER role |

## npm Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with auto-reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Start production server |
| `npm test` | Run all tests |
| `npm run test:unit` | Unit tests only |
| `npm run test:integration` | Integration tests only |
| `npm run test:security` | Security tests (SEC-T01-T15) |
| `npm run test:e2e` | End-to-end lifecycle tests |
| `npm run migrate` | Run database migrations |
| `npm run seed` | Seed database with initial data |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
