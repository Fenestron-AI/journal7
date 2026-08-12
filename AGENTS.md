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

> **Поля форм (черновик):** см. `docs/fields-prospective.md` — возможный состав полей на основе материалов PromSE + форм Omega. Решение по составу не принято.

### Backend modules: 10/10 ✅
- [x] Core, Auth, Reference, Contract, Calculation, Billing, Reporting, Integration, AI, App

### Frontend: ✅
- [x] React 19 + Ant Design + Zustand + React Query (7+ pages)

---

## Session 2026-08-09: Runtime Notes

### Startup (one command)
```bash
./start.sh
```
This script handles Docker, waits for DB, and starts backend + frontend + worker in background.
Logs: `/tmp/backend.log`, `/tmp/frontend.log`, `/tmp/ai-worker.log`.

### Restart individual services (DO NOT USE pkill -f "journal7" — kills all!)
```bash
# Backend only:
nohup bash -c './gradlew :app:run' &>/tmp/backend.log & disown

# Frontend only:
nohup bash -c 'cd frontend && npx vite --host 0.0.0.0 --port 5173' &>/tmp/frontend.log & disown

### AI Worker (must use setsid to survive bash tool timeouts)
```bash
# Kill any existing worker on port 8000:
fuser -k 8000/tcp

# Start with setsid (CRITICAL: nohup & alone gets killed on bash timeout):
setsid bash -c 'cd /home/fenestron/Developer/journal7/ai-worker && exec env PYTHONPATH=src ./venv/bin/python3 -m uvicorn src.main:app --host 0.0.0.0 --port 8000' </dev/null &>/tmp/ai-worker.log & disown; exit 0
```

### Key findings 2026-08-10
- **Downloader**: saves files with original names from URL (e.g., `reg114-091109.pdf`), not mangled doc_number
- **Validator**: runs continuously in lifespan — 5s when active (MISSING/DOWNLOADING), 30s when idle. Catches deleted files
- **Sync button**: green checkmark + «Синхронизировано» when idle, arrows spin when active, pause icon when paused
- **Flyway**: V1 migration has `'admin'` role (lowercase) — DB fixed manually to `'ADMIN'`. Do NOT change V1 SQL (checksum mismatch)
- **docker-compose**: image changed from `postgres:16-alpine` to `pgvector/pgvector:pg16` for pgvector extension

### AI / Legal Knowledge Base
- [x] pgvector 0.6.0 extension in PostgreSQL
- [x] Yandex Cloud: IAM token configured (folder `b1g188ctm6pfq3pf3lfk`)
- [x] Sync with so-ups.ru: 77 docs parsed, 71 MISSING, 6 ARCHIVED
- [x] Embeddings tested (256-dim Yandex, works with IAM token, 429 on bulk)
- [ ] Downloads incomplete: 62 local files (old generic names), need cleanup
- [ ] Q&A agent: code ready, needs docs ACTIVE with embeddings

### Flyway migrations
- V1: init schema
- V2: power profile values  
- V3: ai schema (documents, chunks, notifications)
- V4: canonical so-ups.ru seed (74 docs) — now superseded by V5 live sync
- V5: sync model (sources, original_filename, file_size, source_url, archive)

### Next session

1. Завершить синк утверждённого каталога: досинхронизировать НПСР Регламенты ОРЭМ (доступен без VPN, worker с verify=False)
2. Дополнить недостающие документы (354-ПП, 261-ФЗ, ГК, КоАП) — через ручной URL, pravo.gov.ru под VPN или другие доступные источники
3. Скачать файлы утверждённых документов (через download в UI)
4. Индексация (обучение агента) — локально на GPU, с OCR формул (p2t serve)
5. UI: колонка «Категория», раскрытие строки с полным названием, панель diff + подтверждение

---

## Session 2026-08-11: Runtime Notes

### Formula OCR (pix2text)

Local dev-only server for training (Docker later for hosting):

```bash
# Start pix2text OCR server (GPU, separate venv):
setsid bash -c 'cd /tmp/opencode && exec ./p2t-venv/bin/p2t serve --device gpu --host 0.0.0.0 --port 8001 --enable-formula --disable-table' </dev/null &>/tmp/p2t.log & disown

# Check:
curl -o /dev/null -w "%{http_code}" http://localhost:8001/docs
```

Worker connects via `formula_ocr_url` in `.env` (default `http://localhost:8001`).

### Formula extraction in DOCX/RTF (`ai-worker/src/docx_math.py`)

- **oMath** (нативные уравнения Word) → LaTeX напрямую из XML, без OCR
- **WMF/EMF-картинки** (MathType и legacy-формулы) → LibreOffice (`soffice`) → PNG → p2t
- **RTF**: `{\pict\wmetafile8}` блоки → hex → WMF → soffice → p2t
- Требует установленный `soffice` на машине с воркером. Если p2t/soffice недоступны — формулы пропускаются, пайплайн не падает

### Archive
1. Удалить старые файлы из data/legal-docs/current/ (имена типа 100.pdf)
2. Запустить worker → авто-докачка 71 MISSING документов с оригинальными именами
3. Обработать ключевые документы (442, 1178, 861, 35-ФЗ) — кнопка ▶ в UI
4. Протестировать AI-чат с цитированием норм

---

## MCP Servers & VPN

If an MCP server is unreachable (connection refused, timeout, DNS failure, or any transport error):
1. Tell the user to **enable VPN** and then retry the MCP call.
2. Do NOT silently skip the MCP call or proceed without it — always prompt the user first.
