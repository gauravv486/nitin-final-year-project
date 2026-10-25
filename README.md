# CA-OS

Practice operating system for Indian chartered accountancy firms. Reconciles
GSTR-2B against client books, extracts fields from uploaded documents, and
tracks statutory deadlines in one workspace.

## Status

| Part | State |
|---|---|
| Frontend (Next.js) | Built — all 16 modules, 21 routes, typechecks and builds clean |
| Backend (NestJS + PostgreSQL) | Not started |
| Data layer (Prisma) | Schema to be written |

The frontend runs on placeholder data in `frontend/lib/demo-data.ts`. Nothing is
persisted yet and authentication is not wired — the login screen says so on
screen rather than pretending otherwise.

## Layout

```
.
├── frontend/              Next.js 16 · React 19 · TypeScript · Tailwind v4
│   ├── app/
│   │   ├── tokens.css     Design tokens (single source of truth)
│   │   ├── globals.css    Tailwind mapping + base layer
│   │   ├── page.tsx       Landing page
│   │   ├── (auth)/        Login, register
│   │   └── (app)/         Dashboard, clients, documents, gst, compliance, copilot
│   ├── components/
│   │   ├── marketing/     Landing page sections
│   │   ├── app-shell/     Sidebar, topbar, status badges
│   │   └── ui/            Button, field, surface primitives
│   ├── lib/               utils, nav config, placeholder data
│   └── _legacy/           Previous build, kept for content reference only
├── docs/                  Specification, feature lists, old SQL schema
├── prisma/                Old 202-model schema — reference, to be replaced
├── nestjs-backend/        Prior backend attempt (MongoDB) — to be rebuilt
├── ca-ai-tool-backend-main/  Prior backend attempt (Express + MongoDB)
└── fastapi-ai-backend/    Prior backend attempt (FastAPI + Postgres)
```

## Running the frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run build        # production build
npx tsc --noEmit     # typecheck
```

## Scope

All sixteen modules have a working interface, grouped by the five product
layers from the specification:

| Layer | Modules |
|---|---|
| Practice | Dashboard · Clients · Onboarding · Documents · Bookkeeping · Collaboration |
| Compliance | GST & reconciliation · Income tax & AIS · Notices & litigation · Payroll · Secretarial (ROC) · Compliance calendar |
| Intelligence | Copilot · Risk & audit |
| Administration | Security & access · Reports & export · Settings |

Every sidebar entry leads to a real screen. Nothing is a stub.

## Design system

The visual system was extracted from a live reference and recorded in
`frontend/app/tokens.css`, which carries the full provenance stamp and the
deviation list. Summary:

- **Type** — Geist + Geist Mono, via `next/font`
- **Paper / ink** — `oklch(98.1% 0.0034 247.9)` / `oklch(20.8% 0.0329 260.3)`
- **Accent** — acid lime `oklch(84.6% 0.2353 132.1)`
- **Pastels** — lilac, mint, warm grey as block fills
- **Radius** — 999px pills, 30px cards, 40px panels
- **Contrast** — all 41 in-use text/surface pairs pass WCAG AA
- **Motion** — two primitives only, both with reduced-motion fallbacks

### The one rule for this palette

The lime is **a fill, never text**. Lime text on paper is 1.43:1.

- `--accent` fills a surface; text on it is `--accent-ink` (ink, 11.81:1)
- accent-coloured *text*, borders and focus rings use `--accent-deep` (5.38:1)
- the saturated pastels (mint, lilac, lime) carry only `--ink` or
  `--ink-secondary`; `--ink-muted` drops under 4.5:1 on them, so labels on a
  pastel fill use the `.label-on-tint` class

Add new values as named tokens in `tokens.css`; never inline a colour.

## Next step

Backend: NestJS + PostgreSQL + Prisma. Start with the ~18-model schema and get
login working end to end before adding a second feature.
