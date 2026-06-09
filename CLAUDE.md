# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Type-check and build for production
npm run lint     # Run ESLint
```

There are no tests in this project.

## Architecture

Single-page Next.js app (`src/app/page.tsx`) that loads `Dashboard` dynamically with `ssr: false`. All state lives in the client — there is no backend, database, or API.

### State management

`useDashboard` (`src/hooks/useDashboard.ts`) is the single source of truth. It holds:
- `entries: Entry[]` — all trade records, persisted to `localStorage` (`tradinglist_entries`) and optionally exported/imported via Excel
- `currentMarket: 'domestic' | 'overseas'` — which market tab is active
- `activeTab` — which entry-type tab is shown in the table (also highlights the matching summary card)
- `exchangeRate` — USD→KRW rate, persisted to `localStorage` (`tradinglist_exchangeRate`)

### Data model

`src/lib/types.ts` defines three types:

- **`Market`** — `'overseas' | 'domestic'`
- **`TradeType`** — `'buy' | 'sell' | 'deposit' | 'withdraw' | 'div'`
- **`Entry`** — the single canonical record used throughout the app. Has `market`, `type`, `qty`, `price`, `fee`, `tax`, `amount`, `settlement`.

Settlement is derived: buy = `amount + fee + tax`; sell = `amount - fee - tax`; deposit/withdraw/div = `amount`.

### Key libraries

| File | Role |
|---|---|
| `src/lib/calculations.ts` | `calcRealizedPL` — weighted-average cost P&L for a set of entries; `calcCapitalGains` — overseas capital-gains tax summary (22% rate, ₩2.5M basic deduction); `calcEstimatedTax` — quick tax estimate from a USD P&L total |
| `src/lib/excel.ts` | XLSX import (`importEntriesFromExcel`) / export (`exportEntriesToExcel`); Korean column headers; detects market from `통화` column (`USD` → overseas) |
| `src/lib/utils.ts` | `formatUsd`, `parseNumberLoose`, `normalizeDateStr` |

### Components

`Dashboard` composes everything. Layout: left panel (`TradeForm` — manual entry), right panel (summary cards, `TradeTypeDonutChart`, `EntryTable` with tabs, `CapitalGainsTax` for overseas market only).

`EntryTable` renders the trade table and opens an inline edit modal via `createPortal` on row click.

`CapitalGainsTax` calls `calcCapitalGains` and renders a per-stock breakdown plus tax summary for a selected year.

`TradeTypeDonutChart` uses `chart.js` / `react-chartjs-2` to visualise settlement totals by trade type.

### Styling

Global styles are split between `src/app/globals.css` (Tailwind base) and `src/app/trading.css` (custom CSS classes used throughout components). Tailwind v4 is configured via `postcss.config.mjs`.
