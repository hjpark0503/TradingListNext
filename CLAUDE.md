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
- `entries: Entry[]` — all trade records (persisted only via Excel export/import)
- `currentMarket: 'domestic' | 'overseas'` — which market tab is active
- `activeTab` — which entry-type tab is shown in the table
- `exchangeRate` — USD→KRW rate used by the capital gains calculator

### Data model

`src/lib/types.ts` defines two families:

- **`Entry`** — the canonical record used throughout the app. Has `market` (`domestic`/`overseas`), `type` (`buy`/`sell`/`deposit`/`withdraw`/`div`), amounts in the currency of that market.
- **`TradeRow`** — legacy shape used by `parser.ts` / `calculations.ts` for the older PDF-parsing flow; still referenced by `BalanceChart` and `TradeTable`.

### Key libraries

| File | Role |
|---|---|
| `src/lib/calculations.ts` | Weighted-average cost P&L (`calcRealizedPLRows`), capital-gains tax summary (`calcCapitalGains`) — 22% rate, ₩2.5M basic deduction |
| `src/lib/excel.ts` | XLSX import/export (primary persistence mechanism) |
| `src/lib/parser.ts` | Regex-based parser that turns raw text lines (from copy-paste or OCR) into `TradeRow[]` |
| `src/lib/extractor.ts` | PDF text extraction via `pdfjs-dist`; falls back to Tesseract.js OCR for image-only PDFs |
| `src/lib/utils.ts` | `formatUsd`, `parseNumberLoose`, `normalizeDateStr`, balance aggregation helpers |

### Components

`Dashboard` composes everything. The main layout is left (`TradeForm` — manual entry) and right (market toggle, exchange-rate input, summary cards, `EntryTable` with tabs, and `CapitalGainsTax` for overseas).

`CapitalGainsTax` calls `calcCapitalGains` from `calculations.ts` and renders a per-stock breakdown plus tax summary for a selected year.

### Styling

Global styles are split between `src/app/globals.css` (Tailwind base) and `src/app/trading.css` (custom CSS classes used throughout components). Tailwind v4 is configured via `postcss.config.mjs`.
