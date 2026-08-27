# Soline · מרכז שליטה ניהולי (Executive Dashboard)

Production-grade executive management dashboard for **Soline** — a professional
laser measurement & spatial surveying company (Leica equipment) serving kitchens,
stone fabrication, aluminum, glass, architects and construction.

Hebrew-first (full RTL), dark-mode default, mobile-first. Built to become the
primary operating system of Soline.

> **The dashboard runs on Soline's real data.** The two source files
> (`data/pnl.json`, `data/ops.json`) are loaded and aggregated at build time in
> `lib/data.ts`. Metrics with no source in those files (a few wellbeing /
> strategic figures) are seeded and clearly marked `SEEDED` in the code.

---

## Tech stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript** (strict)
- **Tailwind CSS 3** · shadcn/ui-style components (self-contained, no Radix)
- **Recharts** for interactive charts
- **Lucide React** icons
- **Zustand** (persisted) for settings state
- **React Hook Form** + **Zod** for settings forms
- **next-themes** for dark/light mode
- Full **RTL** (Hebrew) · responsive · accessible (ARIA)

---

## Requirements

- **Node.js 18.18+ or 20+** and npm.
  This machine did not have Node installed. Install it first:
  - Windows (winget): `winget install OpenJS.NodeJS.LTS`
  - or download from https://nodejs.org (LTS)

## Install

```bash
cd soline-dashboard
npm install
```

## Run locally

```bash
npm run dev
```

Then open http://localhost:3000 — it redirects to `/dashboard`.

## Build for production

```bash
npm run build
npm run start
```

---

## Routes

| Route                     | Module        | Highlights                                             |
| ------------------------- | ------------- | ------------------------------------------------------ |
| `/dashboard`              | סקירת מנכ״ל   | 10 KPI cards, trend charts, alerts, tasks              |
| `/dashboard/finance`      | פיננסים       | Revenue, profitability, expenses, cash flow, taxes     |
| `/dashboard/operations`   | תפעול         | Measurements, time, efficiency, quality, load heatmap  |
| `/dashboard/sales`        | מכירות        | Funnel, client segments, deal & client value           |
| `/dashboard/strategy`     | אסטרטגיה      | Growth, concentration risk, resilience scorecard       |
| `/dashboard/personal`     | אישי          | Time, money (owner draws), wellbeing                   |
| `/dashboard/settings`     | הגדרות        | Company, KPI targets, alert thresholds (persisted)     |

---

## Folder tree

```
soline-dashboard/
├── app/
│   ├── globals.css
│   ├── layout.tsx                # RTL + Heebo font + ThemeProvider
│   ├── page.tsx                  # → redirect to /dashboard
│   └── dashboard/
│       ├── layout.tsx            # sidebar + top nav + bottom nav
│       ├── loading.tsx           # skeletons
│       ├── page.tsx              # executive overview
│       ├── finance/page.tsx
│       ├── operations/page.tsx
│       ├── sales/page.tsx
│       ├── strategy/page.tsx
│       ├── personal/page.tsx
│       └── settings/page.tsx
├── components/
│   ├── ui/                       # card, button, badge, input, tabs, select…
│   ├── shell/                    # sidebar, top-nav, bottom-nav
│   ├── kpi-card.tsx  trend-badge.tsx  section-header.tsx
│   ├── dashboard-chart.tsx       # Recharts wrapper (area/line/bar/pie)
│   ├── value-display.tsx  stat-list.tsx  alert-item.tsx
│   ├── date-range-picker.tsx  export-menu.tsx  empty-state.tsx
│   ├── loading-card.tsx  tasks-panel.tsx
│   └── theme-provider.tsx  theme-toggle.tsx
├── lib/
│   ├── data.ts                   # ⭐ loads + aggregates the real JSON
│   ├── calculations.ts           # pure business formulas
│   ├── format.ts                 # ILS currency / % / duration / km
│   ├── nav.ts   utils.ts
├── store/
│   └── settings-store.ts         # Zustand (persisted to localStorage)
├── data/
│   ├── pnl.json                  # real P&L (Aug 2025 – Jul 2026)
│   └── ops.json                  # real ops/time log
├── public/screenshots/
├── tailwind.config.ts  tsconfig.json  next.config.mjs  postcss.config.mjs
└── package.json
```

---

## Calculations (`lib/calculations.ts`)

```
operatingMargin      = operatingProfit / revenue
revenuePerMeasurement = revenue / measurements
revenuePerWorkday    = revenue / workdays
avgDealSize          = revenue / dealsWon
runwayMonths         = cashBalance / avgMonthlyExpenses
firstPassRate        = successfulFirstPass / totalMeasurements
```

Currency formatted as ILS (`he-IL`), percentages and durations localized.

---

## Data model notes

- **Revenue / expenses / draws** — real, from `data/pnl.json`. Expenses are
  bucketed by Hebrew keyword into fuel / equipment / software / marketing /
  office / payroll / tax, and split capex vs opex.
- **Operations** — real, from `data/ops.json`: measurement time, travel time,
  km, deal value → averages and per-measurement economics.
- **Cash balance** — running cumulative of (revenue − opex − capex − draws) on a
  seeded opening position (`STARTING_CASH`).
- **`SEEDED`** — wellbeing metrics, AR/AP/DSO/DPO, error counts, funnel top and
  service-type split have no source in the files and are placeholders.

---

## Suggested future integrations

Built so these can be layered in without rearchitecting:

- **חשבשבת / QuickBooks** — replace `data/pnl.json` with a live ledger sync.
- **Pipedrive** — real sales funnel (leads → quotes → won) into the Sales module.
- **Google Calendar** — schedule → backlog days & today's tasks.
- **Google Maps API** — real drive time / km per measurement (currently logged).
- **Leica export files** — auto-ingest measurement metadata (time, points).
- **CSV import** — the `ExportMenu` already does CSV out; add an import counterpart.
- **PostgreSQL backend** — move `lib/data.ts` aggregation server-side + API routes.
- **Authentication** — gate `/dashboard` (NextAuth / Clerk) for multi-user.

---

## Notes on state & theming

- Settings persist to `localStorage` under `soline-settings` (Zustand `persist`).
- Dark mode is the default; toggle in the top bar (`next-themes`, `class` strategy).
- Tax rates in Settings drive the Finance tax estimates live.
```
