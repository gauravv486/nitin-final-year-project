# CA-OS backend

FastAPI + PostgreSQL + scikit-learn. The API and the machine-learning features
for a chartered accountancy practice management system.

- **Frontend:** `../frontend` (Next.js 16) — wired to this API; see **Running both** below.
- **Spec:** `../docs/CA_OS_SPECIFICATION.md` — 16 modules.

---

## Current status

Honest, because a status table that lies is worse than none.

| Phase | What | State |
| --- | --- | --- |
| 0 | FastAPI app, config, 36-table schema, Alembic | **done** |
| 1 | Synthetic (narration → ledger) dataset | **done** — 11,972 rows, 41 classes |
| 2 | **Ledger classifier** | **done** — 97.9% acc, ECE 0.026, [details](app/ml/ledger/README.md) |
| 3 | **Invoice / document extraction** | **done** — real PDF text layer, 5 cross-checks |
| 4 | **GSTR-2B reconciliation** | **done** — 4-pass matcher, one-to-one, order-independent |
| 5 | **Risk & anomaly detection** | **done** — 7 unsupervised checks, evidence attached |
| 6 | **Case-law retrieval + NL query** | **done** — BM25 + dense, fused by RRF; 12 intents |
| 7 | **Drafting** (notice replies, letters, minutes) | **done** — grounded, labelled provider |
| — | **Auth** — register, login, token rotation, invites, audit | **done** |
| — | **All 16 modules** — endpoints, services, persistence | **done** |
| — | **Seed script** — runs the real pipeline, not fixtures | **done** |
| — | **Live database** — PostgreSQL 17.11, migration applied, seeded | **done** |
| — | **Frontend wired to the API** — all 18 pages, no demo data | **done** |
| — | OCR for scans (Tesseract) | optional, not installed |
| — | Local LLM (Ollama) — drafting falls back to templates | optional, not installed |

283 tests, lint clean, 95 paths / 110 operations. Phases 2, 4 and 5 all run
**without a database** — the algorithms are stateless, so you can exercise every
ML feature through `/api/docs` before PostgreSQL exists.

Everything is verified end to end against a real database, not just
unit-tested: login, `/me`, token rotation with replay detection, role-based row
visibility (a STAFF user sees 2 of the 5 clients an owner sees), the GSTIN check
digit rejecting a bad identifier at the API boundary, `PATCH` leaving
unmentioned fields alone, and every write path the UI performs. The migration
has also been round-tripped — `upgrade` → `downgrade base` → `upgrade` — which
is how the two defects noted in step 6 were found.

---

## Running both

Two terminals. The frontend expects the API on port 8000 and the API allows
`http://localhost:3000` by default (`CORS_ORIGINS` in `.env`).

```bash
# terminal 1 — API
cd backend
.venv/Scripts/activate            # Windows; `source .venv/bin/activate` elsewhere
uvicorn app.main:app --reload --port 8000

# terminal 2 — UI
cd frontend
npm install                        # first time only
npm run dev                        # http://localhost:3000
```

`frontend/.env.local` holds the one variable that matters:

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

Note the `/api/v1` — `lib/api.ts` appends paths like `/auth/login` straight to
it.

### Signing in

`python scripts/seed.py` creates one firm, six users and five clients. Every
seeded account uses the password `caos-dev-password`:

| Email | Role | Sees |
| --- | --- | --- |
| `owner@sharma.in` | Owner | all 5 clients |
| `partner@sharma.in` | Partner | all 5 clients |
| `manager@sharma.in` | Manager | all 5 clients |
| `staff@sharma.in` | Staff | only the 2 they manage |
| `article@sharma.in` | Article | only the 1 they manage |
| `accounts@aroratrading.in` | Client portal | that one client, and is refused firm-wide data |

Signing in as `staff@sharma.in` rather than the owner is the quickest way to
show that row visibility is enforced by the server and not by hiding menu items.

### How the frontend talks to the API

| Concern | Where | Note |
| --- | --- | --- |
| Base URL, bearer token, errors | `frontend/lib/api.ts` | A 401 triggers **one** shared refresh — refresh tokens are single-use and a replay revokes the whole family, so three components 401-ing at once must not fire three refreshes. |
| Session, login, logout | `frontend/lib/auth.tsx` | `AuthProvider` sits above both route groups; `(app)/layout.tsx` redirects to `/login` only once `status` leaves `loading`, so a hard refresh does not bounce a signed-in user. |
| Reads | `frontend/lib/use-api.ts` | `useApi(path)` — `path` may be `null` for "not ready", and responses are sequence-guarded so a slow first request cannot overwrite a fast second one. |
| Writes | `frontend/lib/use-api.ts` | `useAction()` — every mutating button goes through it, so a failed POST shows a message instead of doing nothing. |
| Loading / error / empty | `frontend/components/ui/async.tsx` | `<Async>`; error beats loading, and "empty" is only consulted once data has arrived. |
| Enum labels | `frontend/lib/enums.ts` | The API speaks `AMOUNT_MISMATCH`; the UI says "Amount differs". One place, so the dashboard and the worklist agree. |

Decimals arrive from FastAPI as JSON **strings** (`"81630.00"`). `num()` in
`lib/api.ts` is the only correct way to read a money field — `Number(x)` on the
raw value silently yields `NaN` for `null`.

### What this replaces

The previous `../fastapi-ai-backend` had no working ML. `transaction_ai.py` was
`if "ZOMATO" in merchant: confidence = 0.95`; `reconciliation.py` matched on
exact amount equality and called `amount > 50000` a risk score; the Qwen-14B
loader defaulted to a three-string mock and pointed at a `./models/qwen_lora`
directory that did not exist. The training notebook was the **unmodified
Unsloth sample** — it trains on maths and chat data and asks the model to solve
`(x + 2)² = 0`. Nothing in it mentions invoices, GST or ledgers.

None of that is reused.

---

### Why reconciliation is not machine learning

A deliberate decision, and the one most worth defending in a viva. A CA signs a
return on the reconciliation output and may have to justify it to the
department. *"The model scored this pairing 0.83"* is not a defence; *"GSTIN
equal, invoice number differs by one character, dates three days apart, amounts
within ₹1"* is. Every pairing is produced by a stated rule and carries that
reason in its `note`.

The matcher also separates two numbers the previous implementation conflated:

- **ITC at risk** — credit claimed in the books the portal does not support.
  A liability; reverse it or chase the supplier.
- **Unclaimed ITC** — credit the portal supports that the books never recorded.
  Money the client is owed.

Both are "mismatches" and the required action is opposite, so a single
mismatch total is not actionable.

## Hardware reality

This machine has **no NVIDIA GPU** (`nvidia-smi` is not present). `unsloth` and
`bitsandbytes` require CUDA at runtime, so a 4-bit Qwen-14B cannot train or run
here at all. That single fact drove the architecture:

- Every ML feature except case-law search and drafting is **classical ML on a
  CPU** — scikit-learn, trains in minutes, no GPU.
- Drafting uses **local Ollama** by default, with a hosted API behind the same
  interface. See [Language models](#language-models).
- Python 3.14 is fine: torch 2.14 ships 3.14 wheels, and so do transformers,
  scikit-learn and pgvector.

---

## Quick start

You can run the ML features **before** setting up PostgreSQL — the classifier
needs no database.

```bash
cd CompSphere-AI/backend

python -m venv .venv
.venv\Scripts\activate                       # Windows
# source .venv/bin/activate                  # macOS / Linux

pip install -r requirements.txt -r requirements-dev.txt
copy .env.example .env                       # cp on macOS / Linux

python scripts/generate_dataset.py --rows 12000
python scripts/train_ledger_classifier.py

uvicorn app.main:app --reload --port 8000
```

Open **http://localhost:8000/api/docs** and try `POST /api/v1/ledger/classify`:

```json
{
  "narration": "ACH D- TP ACH RELIANCE JIO INFOCOMM-9876543210",
  "amount": 1499,
  "direction": "DEBIT"
}
```

`/health` will say `degraded` with `database: ok=false` until you do the next
section. That is correct — the service reports which dependency is unhappy
rather than refusing to start.

---

## Connecting PostgreSQL

### 1. Install the server

Download the **PostgreSQL 17** Windows installer from
<https://www.enterprisedb.com/downloads/postgres-postgresql-downloads> and run
it.

**Do not use `winget install PostgreSQL.PostgreSQL.17`.** The manifest is fine
but EnterpriseDB serves `403 Forbidden` to winget's user-agent, and winget
reports it as `Download request status is not success` — which reads like a
network fault and is not one. The same URL returns `200` to a browser. Download
it in a browser, or fetch it directly:

```powershell
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
curl.exe -L -A $ua -o postgresql-17-x64.exe `
  https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64.exe
```

Check the signature before running it — it should report `Valid` and
`CN=EnterpriseDB Corporation`:

```powershell
Get-AuthenticodeSignature .\postgresql-17-x64.exe | Format-List Status, SignerCertificate
```

During setup:

- **Components:** keep *PostgreSQL Server*, *pgAdmin 4* and *Command Line
  Tools*. You can skip Stack Builder.
- **Password:** you are asked for a password for the `postgres` superuser.
  **Write it down** — you need it in step 3 and there is no recovery short of
  editing `pg_hba.conf`.
- **Port:** leave `5432`.
- **Locale:** leave the default.

### 2. Put `psql` on your PATH

The installer does not do this. Add the `bin` folder:

```powershell
# PowerShell, permanent for your user
$pg = "C:\Program Files\PostgreSQL\17\bin"
[Environment]::SetEnvironmentVariable(
  "Path", [Environment]::GetEnvironmentVariable("Path","User") + ";$pg", "User")
```

**Close and reopen your terminal**, then check:

```bash
psql --version
```

### 3. Create the database

```bash
psql -U postgres -c "CREATE DATABASE ca_os;"
```

It will prompt for the password from step 1. If you would rather not use the
superuser for the application (better practice), create a dedicated role:

```bash
psql -U postgres -c "CREATE ROLE ca_os_app WITH LOGIN PASSWORD 'pick-something';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ca_os TO ca_os_app;"
psql -U postgres -d ca_os -c "GRANT ALL ON SCHEMA public TO ca_os_app;"
```

### 4. pgvector — skip this

**Nothing in this project requires pgvector, and on Windows it is not worth
installing.** Leave `PGVECTOR_ENABLED=false` (the default) and go to step 5.

Why it is skippable: case-law search ranks passages with NumPy in the
application whichever way the flag is set - over a corpus of a few thousand
passages that costs single-digit milliseconds. The flag only decides the
column type: off, `case_law_chunks.embedding` is a plain `double precision[]`;
on, it is `vector(384)`, which makes a database-side ANN index possible once a
corpus is large enough to need one. `app/models/intelligence.py` chooses the
type from the flag, so the migration is correct either way.

Why it is awkward on Windows: the Windows PostgreSQL installer does not bundle
it, and **pgvector publishes no Windows binaries** — its GitHub repository has
no releases at all, only source tags. The official Windows route is to compile
it:

```powershell
# Needs Visual Studio Build Tools with the C++ workload (~2-7 GB).
# Run from "x64 Native Tools Command Prompt for VS" as Administrator.
set "PGROOT=C:\Program Files\PostgreSQL\17"
git clone --branch v0.8.1 https://github.com/pgvector/pgvector.git
cd pgvector
nmake /F Makefile.win
nmake /F Makefile.win install
```

Then `CREATE EXTENSION vector;`, set `PGVECTOR_ENABLED=true`, and regenerate
the migration — the column type changes, so an existing one will not match.

Any third-party guide offering a `pgvector-vX-windows-x64.zip` is linking to a
file the project does not publish. Do not run it.

The honest trade: switch the flag on when the corpus outgrows brute force,
which for this project it never will.

### 5. Point the app at it

Edit `.env`:

```ini
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/ca_os
```

Notes that save time:

- A plain `postgresql://` prefix is fine. `app/core/config.py` rewrites it to
  the psycopg 3 driver automatically, so a connection string copied from any
  hosting dashboard works unmodified.
- **If your password contains `@`, `:`, `/`, `#` or `?`**, percent-encode it, or
  the URL parses wrongly: `p@ss` → `p%40ss`. This is the single most common
  cause of "password authentication failed" when the password is correct.
- For a hosted database (Neon, Supabase, Railway) append `?sslmode=require`.

Also set a real JWT secret while you are in there, so logins survive a restart:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 6. Create the tables

```bash
python -m alembic revision --autogenerate -m "initial schema"
python -m alembic upgrade head
```

The first command inspects `app/models/` and writes a migration into
`alembic/versions/`. **Read it before applying** — autogenerate is good, not
infallible. The second applies it.

The committed migration carries two hand-written edits, both marked
`--- hand-written ---` in the file. **If you ever regenerate it, you have to
redo them.** Autogenerate does not get either case right:

1. **The `users` ↔ `clients` cycle.** A portal user points at a client, and a
   client points back at its manager, so neither table can be created first.
   `users.client_id` is marked `use_alter=True`, which is what lets Alembic sort
   the tables at all — without it the sort has no solution and it quietly falls
   back to *alphabetical* order, which fails on the first forward reference
   (`relation "firms" does not exist`). But `use_alter` is only honoured by
   `metadata.create_all()`, not by `op.create_table()`, so the constraint still
   renders inline and must be lifted into an `op.create_foreign_key` at the end
   of `upgrade()`, plus a matching `op.drop_constraint` at the *start* of
   `downgrade()`.

2. **Enum types are never dropped.** `sa.Enum(...)` inside `create_table`
   issues a `CREATE TYPE`, but `drop_table` does not issue the matching
   `DROP TYPE` and autogenerate does not emit one. The downgrade therefore
   *appears* to succeed while leaving 36 orphaned types behind, and the next
   `upgrade head` dies with `type "court_tier" already exists`. A loop of
   `DROP TYPE IF EXISTS` at the end of `downgrade()` fixes it.

Worth testing after any regeneration, because both failures are invisible until
you need the downgrade:

```bash
python -m alembic upgrade head
python -m alembic downgrade base
python -m alembic upgrade head      # must not fail
```

Verify:

```bash
psql -U postgres -d ca_os -c "\dt"
```

You should see 35 tables plus `alembic_version`.

### 7. Seed some data

```bash
python scripts/seed.py
```

Creates one firm, five users spanning the role range, five clients (the same
ones the frontend's demo data uses), the standard 62-account chart, the
statutory compliance calendar and ~200 unclassified bank transactions.

Sign in with `owner@sharma.in` / `caos-dev-password`, or any of the other four
addresses it prints. The transactions are left unclassified on purpose — POST
them to `/api/v1/ledger/classify-batch` to watch the classifier work.

### 8. Confirm

```bash
uvicorn app.main:app --reload --port 8000
curl http://localhost:8000/health
```

```json
{
  "status": "ok",
  "components": {
    "database":     { "ok": true, "detail": "PostgreSQL 17.x" },
    "ledger_model": { "ok": true, "detail": "ledger-clf-..." }
  }
}
```

### When it does not work

| Symptom | Cause and fix |
| --- | --- |
| `connection timeout expired` | Server not running. `services.msc` → start *postgresql-x64-17*. |
| `password authentication failed` | Wrong password, **or** a special character that needs percent-encoding (see step 5). |
| `database "ca_os" does not exist` | Step 3 was skipped or failed. |
| `psql: command not found` | PATH not set, or the terminal was not reopened (step 2). |
| `extension "vector" is not available` | `PGVECTOR_ENABLED=true` without pgvector compiled. Set it back to `false`; see step 4. |
| `permission denied for schema public` | On PG 15+, a non-superuser needs the explicit `GRANT ALL ON SCHEMA public` from step 3. |
| Alembic autogenerate writes an empty migration | `app/models/__init__.py` must import the model. Anything not reachable from there is invisible to autogenerate. |
| `relation "firms" does not exist` during `upgrade` | Regenerated migration missing hand-edit 1; see step 6. |
| `type "court_tier" already exists` | A previous `downgrade` left its enum types behind; see step 6. |
| `Could not find entrypoint console_scripts.ruff` | Stale `alembic.ini` post-write hook. It must be `ruff.type = exec`, not `console_scripts` — ruff ships a native binary with no entry point. |
| winget: `Download request status is not success` / `403` | EnterpriseDB blocks winget's user-agent. Not a network fault; see step 1. |

The connect timeout is set to 3 seconds in `app/core/database.py`, so a wrong
host fails fast instead of hanging on the Windows TCP timeout.

---

## Language models

Only the drafting features — notice replies, engagement letters, board minutes
— need a language model. Everything else is classical ML.

Default is **local Ollama**: free, offline, no API key, and client financial
data never leaves the machine, which matters for a DPDP story in a product
holding other people's tax records.

```bash
# https://ollama.com, then:
ollama pull qwen3:4b
```

```ini
LLM_PROVIDER=ollama
OLLAMA_MODEL=qwen3:4b
```

A hosted provider sits behind the same interface if you want better drafts and
accept the cost and the data leaving your machine:

```ini
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

`LLM_PROVIDER=stub` replies "not configured" rather than inventing a draft,
which is the right default for an unconfigured system in this domain.

---

## Layout

```
backend/
├── app/
│   ├── core/            config · database · security · roles
│   ├── models/          35 SQLAlchemy tables, grouped by domain
│   ├── ml/
│   │   └── ledger/      chart · narration parser · features · training · serving
│   ├── api/v1/          routers
│   ├── utils/           periods.py · identifiers.py
│   └── main.py
├── scripts/             generate_dataset.py · train_ledger_classifier.py
├── alembic/             migrations
├── artifacts/           trained models (gitignored, regenerate with scripts)
└── data/generated/      datasets (gitignored, regenerate with scripts)
```

Two modules carry more weight than their size suggests:

- **`app/utils/periods.py`** — the Indian financial year runs 1 April to 31
  March, so nearly every date question has a different answer from the calendar
  one. Q1 is April–June. Getting it wrong files a return against the wrong
  year, so it lives in one place with tests rather than being re-derived per
  feature.
- **`app/utils/identifiers.py`** — PAN/GSTIN/CIN/TAN formats, plus the GSTIN
  **checksum**. A transposed digit in a supplier GSTIN silently breaks
  reconciliation for that invoice for ever; the checksum catches most of them
  at entry.

## Conventions

- **Money is `Numeric(15, 2)`, never `Float`.** A rupee figure that has been
  through an IEEE double cannot be trusted in a reconciliation, and a
  reconciliation that cannot be trusted is the entire product.
- **`firm_id` is the tenant boundary.** Every table holding client data carries
  it, every query filters on it, and `authorise_client()` in `app/api/deps.py`
  checks it once per request rather than trusting each handler.
- **A model's opinion and a human's decision are separate columns.**
  `journal_entries` keeps `suggested_ledger_id` + `confidence` alongside
  `posted_ledger_id` + `reviewed_by_id` + `overridden`. Overwriting the
  prediction with the correction would destroy both the audit trail and the
  only real training data this project will ever accumulate.
- **`audit_logs` is append-only.** No update or delete path exists in the
  codebase.
- **Confidence is calibrated or it is not shown.** A threshold compared against
  an uncalibrated score is theatre.

## Commands

```bash
uvicorn app.main:app --reload            # dev server
pytest                                   # tests
ruff check app scripts                   # lint
ruff format app scripts                  # format

python -m alembic revision --autogenerate -m "..."
python -m alembic upgrade head
python -m alembic downgrade -1

python scripts/generate_dataset.py --rows 12000
python scripts/train_ledger_classifier.py --model auto
```
