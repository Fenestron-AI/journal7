# journal7 — Energy Accounting Service (Kotlin)

## Project Identity

- **Name**: journal7
- **Domain**: journal7.ru
- **Type**: Web service — energy accounting & billing automation
- **Language**: Kotlin (server) + TypeScript (frontend)
- **GitHub**: github.com/Fenestron-AI/journal7
- **Predecessor**: Omega v2.2.0 (PyQt5 desktop, decompiled, Python 3.14)

---

## Architecture

### Pattern: Modular Monolith + REST API

```
┌──────────────────────────────────────────┐
│  Frontend: React 19 + TypeScript          │
│  (Ant Design, Vite, Zustand, React Query) │
└──────────────┬───────────────────────────┘
               │ HTTPS (REST)
┌──────────────▼───────────────────────────┐
│  Backend: Ktor 3.x (Netty)               │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐ │
│  │ auth │ │ ref  │ │contract│calc   │   │ │
│  │      │ │erence│ │      │ulation │   │ │
│  └──────┘ └──────┘ └──────┘ └────────┘ │ │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐ │ │
│  │billing│report│integration│  app   │   │ │
│  └──────┘ └──────┘ └──────┘ └────────┘ │ │
│  Koin DI  │  Exposed SQL  │  HikariCP   │ │
└──────────────┬───────────────────────────┘
               │
┌──────────────▼───────────────────────────┐
│  PostgreSQL 16 + Redis 7 + MinIO          │
└──────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Kotlin 2.1.20 |
| HTTP Framework | Ktor 3.1.2 (Netty) |
| Database Access | Exposed 0.60.0 (Kotlin SQL DSL) |
| Connection Pool | HikariCP 6.2.1 |
| Migrations | Flyway 11.4.0 |
| DI | Koin 4.0.3 |
| Serialization | Kotlinx.serialization 1.8.0 |
| Configuration | Hoplite 2.7.5 |
| Auth | auth0 java-jwt 4.4.0, bcrypt (at.favre.lib) |
| Excel | Apache POI 5.4.0 |
| Object Storage | MinIO client 8.5.17 |
| Caching | Jedis 5.2.0 / Lettuce 6.5.0 |
| Testing | Kotest 6.0.0, Testcontainers 1.20.6, MockK 1.13.16 |
| Build | Gradle 8.11.1, Kotlin DSL, Version Catalog |

### Gradle Modules (9 total)

```
modules/
├── core/           # Shared kernel: Entity, Result<T,E>, DomainError, DomainEvent
├── auth/           # Authentication: JWT, RBAC, User CRUD, password hashing
├── reference/      # Reference data: counterparties, regions, tariffs, profiles
├── contract/       # Contracts: sale/purchase contracts, 6-level hierarchy tree
├── calculation/    # Calculation engine: CK1/CK3/CK4/FCK, recalculation
├── billing/        # Billing: invoices, UPD, acceptance acts
├── reporting/      # Reports: Excel generation, scheduled reports
├── integration/    # Integrations: 1C export, email, file import/export
└── app/            # Bootstrap: Application.kt, Ktor plugins, DI wiring, Flyway migrations
```

### Module Dependencies

```
app ──> all modules
auth ──> core
reference ──> core
contract ──> core, reference
calculation ──> core, contract, reference
billing ──> core, contract, calculation
reporting ──> core, billing, calculation
integration ──> core, reference
```

### Project Structure (each module)

```
modules/<name>/
├── build.gradle.kts
└── src/
    ├── main/kotlin/ru/journal7/<name>/
    │   ├── domain/          # Entities, value objects, repository interfaces
    │   ├── application/     # Use cases, services, ports
    │   ├── infrastructure/  # Repository impls, external service adapters
    │   └── api/             # Ktor routes, DTOs, request/response models
    └── test/kotlin/ru/journal7/<name>/
```

---

## Database Schema

### Schemas (Latin names)

| Schema | Tables |
|--------|--------|
| `settings` | users, user_profiles, firm_profiles |
| `directory` | counterparties, regions, guaranteeing_suppliers, calculation_groups, tariff_zones, power_profiles, responsible_persons, discount_formulas |
| `document` | sale_contracts, accounting_objects, delivery_points, sale_calculations, sale_invoices, acceptance_acts, sales_markups, nonreg_energy_prices, nonreg_power_prices, om_coefficients, closed_periods, consumer_premiums, agent_commissions, delivery_point_discounts |
| `constants` | software_version |

### Key Patterns
- UUID primary keys (gen_random_uuid())
- Soft delete (deleted + deleted_at)
- JSONB for dynamic data (metering points, devices, tariff arrays)
- Timestamps as BIGINT (epoch millis) for type compatibility
- Flyway migrations in `modules/app/src/main/resources/db/migration/`

### Hierarchical Data Tree
```
Counterparty → Contract → AccountingObject → DeliveryPoint → MeteringPoint → MeterDevice
```

---

## API Design

```
https://journal7.ru/api/v1/

# Auth
POST   /auth/login              # Login → JWT tokens
POST   /auth/refresh            # Refresh token
GET    /auth/me                 # Current user profile
POST   /auth/users              # Create user (admin)

# Reference data
GET    /reference/counterparties
POST   /reference/counterparties
PUT    /reference/counterparties/{id}
DELETE /reference/counterparties/{id}
# ... CRUD for all directories

# Contracts
GET    /contracts/sale
POST   /contracts/sale
GET    /contracts/sale/{id}/tree     # 6-level hierarchy
POST   /contracts/sale/{id}/objects   # Add accounting object
# ... nested endpoints for TP, TU, PU

# Calculations
POST   /calculations/sale           # Run calculation (async)
GET    /calculations/sale/{id}       # Result
POST   /calculations/sale/recalculate

# Billing
POST   /billing/invoices
GET    /billing/invoices/{id}
GET    /billing/invoices/{id}/export  # Excel
POST   /billing/acts
POST   /billing/upd

# Reports
GET    /reports/standard/{type}
POST   /reports/generate             # Async
GET    /reports/download/{taskId}    # Download .xlsx
```

---

## How This Solves Omega's Problems

| # | Omega v2.0 Problem | journal7 Solution |
|---|-------------------|-------------------|
| 1 | No connection pool | HikariCP (20 conn) |
| 2 | Raw SQL, no types | Exposed DSL (compile-time) |
| 3 | No tests | Kotest + Testcontainers |
| 4 | Desktop-only | Web SPA (React) |
| 5 | Monolithic (149 forms) | 9 Gradle modules by domain |
| 6 | No API | Ktor REST (OpenAPI auto-doc) |
| 7 | `exec()` for formulas | Kotlin Script Engine (TODO) |
| 8 | Decompiled code | Clean Kotlin from scratch |
| 9 | No migrations | Flyway versioned SQL |
| 10 | Russian table names | Latin tables (+ VIEW aliases TODO) |
| 11 | No config validation | Hoplite (.env → data class) |
| 12 | No dependency mgmt | Gradle Version Catalog + lockfile |
| 13 | Ad-hoc try/except | Result<T,E> + StatusPages plugin |
| 14 | Hardcoded .xlsx templates | MinIO templates + Apache POI |
| 15 | Passwords in INI | .env (dev) + Vault (prod TODO) |

---

## Development

### Prerequisites
- Java 21+
- Docker (for PostgreSQL, Redis, MinIO)

### Quick Start
```bash
# Start infrastructure
docker compose up -d

# Copy env config
cp .env.example .env

# Build & run
./gradlew :app:run
```

### Commands
```bash
./gradlew compileKotlin      # Compile all modules
./gradlew :app:run           # Run application
./gradlew test               # Run tests
./gradlew :app:build         # Build fat jar
```

---

## Deployment

- Docker Compose (dev)
- K8s (prod TODO)
- Nginx + Let's Encrypt for journal7.ru (TODO)

---

## UX Principles (Anti-Omega)

In Omega, to create a contract you had to: open counterparty form → save → open contract form → add object → save → open TP form → save → open TU form → save → open PU form → save. **10+ windows, 10+ explicit saves.** This is the exact pattern to avoid.

### journal7 UX Rules

1. **Single-page workflows** — one view, inline editing, auto-save. No modal chains.
2. **Data tables with inline CRUD** — add/edit/delete rows directly in the table. Use Ant Design's editable table pattern.
3. **Auto-save with debounce** — changes persist automatically 500ms after the last keystroke. Visual indicator: green checkmark when saved, red when error.
4. **Side sheet for details** — click a row → right panel slides in with full details, editable in-place. Never open a new page/window.
5. **Optimistic UI** — show the change immediately, roll back on server error. No loading spinners for simple operations.
6. **Bulk operations** — select multiple rows → one action. Never "do X then Y then Z".
7. **Real-time validation** — red border on invalid fields as you type, not after clicking "Save".
8. **Virtual scrolling** — for lists >100 items (power profile values with 720+ rows). Never load everything into DOM.

### Power Profile UX (specific)

- **Heatmap** — calendar-like grid (31 columns × 24 rows), color gradient (blue=low, red=high). Zoom: month → day → hour. Uses canvas/webgl for 720+ cells, not DOM.
- **Inline value editing** — click a cell in the heatmap → edit value → auto-save. No separate form.
- **Validation overlay** — red border on invalid cells, yellow on missing data. Click anomaly → see detailed reason.
- **Profile compare** — select 2 profiles → side-by-side diff view with delta heatmap.
- **Import** — drag & drop Excel file → server-side parse → show diff preview (added/changed/deleted) → confirm.

### API Design for UX

- **Graph-like responses** — include related entity names (not just IDs) to avoid N+1 requests
- **Cursor-based pagination** for infinite scroll lists
- **ETag/versioning** — detect conflicts on concurrent edits
- **Structured errors** — `{ code, message, field?, details? }` so the UI can point to the exact problem

---

## Current Status

- [x] Project skeleton (Gradle, modules, version catalog)
- [x] Core module (Entity, Result, DomainError, DomainEvent)
- [x] App module (Ktor, Hoplite, HikariCP, Flyway, plugins)
- [x] Docker Compose (PostgreSQL 16, Redis 7, MinIO)
- [x] Flyway migration V1 (complete schema)
- [x] Auth module (JWT, RBAC, password hashing, user CRUD)
- [x] Reference module (counterparties + power profiles with heatmap data)
- [x] Contract module (6-level hierarchy, tree endpoint, nested CRUD)
- [x] Calculation module (CK1/CK3/CK4 strategies, hourly results)
- [x] Billing module (invoices, acceptance acts, auto-generate from calc)
- [x] Reporting module (Excel export with Apache POI)
- [x] Integration module (file import, 1C export stub)
- [ ] Frontend (React + TypeScript)
- [ ] Tests
- [ ] CI/CD (GitHub Actions)
