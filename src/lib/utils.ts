import { TradeRow, BalanceSeries } from './types';

export function parseNumberLoose(s: unknown): number {
  if (s == null) return NaN;
  const t = String(s).replace(/,/g, '').replace(/[^\d.\-+]/g, '').trim();
  if (t === '' || t === '-' || t === '+') return NaN;
  return parseFloat(t);
}

export function formatUsd(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const parts = abs.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-' : '') + parts.join('.');
}

export function normalizeDateStr(s: unknown): string {
  if (!s) return '';
  const m = String(s).trim().replace(/\./g, '-').replace(/\//g, '-');
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(m);
  if (p) return `${p[1]}-${p[2]}-${p[3]}`;
  return m;
}

export function sortRowsByDateStable(rows: TradeRow[]): TradeRow[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      if (a.r.date !== b.r.date) return a.r.date < b.r.date ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.r);
}

export function aggregateBalanceByDate(rows: TradeRow[]): BalanceSeries {
  const sorted = sortRowsByDateStable(rows);
  const labels: string[] = [];
  const data: number[] = [];
  const tradeCounts: number[] = [];
  const lastByDate: Record<string, { balance: number; count: number }> = {};

  for (const r of sorted) {
    if (!lastByDate[r.date]) {
      lastByDate[r.date] = { balance: r.balance, count: 0 };
      labels.push(r.date);
    }
    lastByDate[r.date].balance = r.balance;
    lastByDate[r.date].count += 1;
  }

  for (const label of labels) {
    data.push(lastByDate[label].balance);
    tradeCounts.push(lastByDate[label].count);
  }

  return { labels, data, tradeCounts };
}
