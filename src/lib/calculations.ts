import { Entry } from './types';

export interface CapGainRow {
  stock: string;
  sellQty: number;
  sellProceedsUsd: number;
  buyCostUsd: number | null;
  plUsd: number | null;
  plKrw: number | null;
  hasBuyData: boolean;
}

export interface CapGainSummary {
  rows: CapGainRow[];
  totalPlKrw: number;
  deductionKrw: number;
  taxableKrw: number;
  estimatedTaxKrw: number;
  hasIncompleteData: boolean;
}

export function calcCapitalGains(
  entries: Entry[],
  year: number,
  exchangeRate: number
): CapGainSummary {
  const yearStr = String(year);
  const overseasEntries = entries.filter((e) => e.market === 'overseas');

  const allBuys = overseasEntries.filter((e) => e.type === 'buy' && e.qty > 0);
  const yearSells = overseasEntries.filter(
    (e) => e.type === 'sell' && e.date.startsWith(yearStr)
  );

  if (yearSells.length === 0) {
    return { rows: [], totalPlKrw: 0, deductionKrw: 2_500_000, taxableKrw: 0, estimatedTaxKrw: 0, hasIncompleteData: false };
  }

  const costAccum: Record<string, { totalCost: number; totalQty: number }> = {};
  for (const b of allBuys) {
    const key = b.stock.trim().toUpperCase();
    if (!costAccum[key]) costAccum[key] = { totalCost: 0, totalQty: 0 };
    costAccum[key].totalCost += b.settlement;
    costAccum[key].totalQty += b.qty;
  }
  const avgCostMap: Record<string, number> = {};
  for (const key in costAccum) {
    if (costAccum[key].totalQty > 0)
      avgCostMap[key] = costAccum[key].totalCost / costAccum[key].totalQty;
  }

  const sellAccum: Record<string, { qty: number; proceeds: number }> = {};
  for (const s of yearSells) {
    const key = s.stock.trim().toUpperCase();
    if (!sellAccum[key]) sellAccum[key] = { qty: 0, proceeds: 0 };
    sellAccum[key].qty += s.qty;
    sellAccum[key].proceeds += s.settlement;
  }

  const rows: CapGainRow[] = Object.entries(sellAccum).map(([stock, { qty, proceeds }]) => {
    const avgCost = avgCostMap[stock];
    if (avgCost !== undefined) {
      const buyCostUsd = avgCost * qty;
      const plUsd = proceeds - buyCostUsd;
      return { stock, sellQty: qty, sellProceedsUsd: proceeds, buyCostUsd, plUsd, plKrw: plUsd * exchangeRate, hasBuyData: true };
    }
    return { stock, sellQty: qty, sellProceedsUsd: proceeds, buyCostUsd: null, plUsd: null, plKrw: null, hasBuyData: false };
  });

  const hasIncompleteData = rows.some((r) => !r.hasBuyData);
  const totalPlKrw = rows
    .filter((r) => r.hasBuyData && r.plKrw !== null)
    .reduce((s, r) => s + r.plKrw!, 0);
  const deductionKrw = 2_500_000;
  const taxableKrw = Math.max(0, totalPlKrw - deductionKrw);

  return { rows, totalPlKrw, deductionKrw, taxableKrw, estimatedTaxKrw: taxableKrw * 0.22, hasIncompleteData };
}

export interface RealizedPLResult {
  totalPL: number;
  hasIncompleteData: boolean;
}

export function calcRealizedPL(entries: Entry[]): RealizedPLResult {
  const buys  = entries.filter((e) => e.type === 'buy'  && e.qty > 0);
  const sells = entries.filter((e) => e.type === 'sell' && e.qty > 0);

  if (sells.length === 0) return { totalPL: 0, hasIncompleteData: false };

  const costAccum: Record<string, { totalCost: number; totalQty: number }> = {};
  for (const b of buys) {
    const key = b.stock.trim().toUpperCase();
    if (!costAccum[key]) costAccum[key] = { totalCost: 0, totalQty: 0 };
    costAccum[key].totalCost += b.settlement;
    costAccum[key].totalQty  += b.qty;
  }

  let totalPL = 0;
  let hasIncompleteData = false;
  for (const s of sells) {
    const key   = s.stock.trim().toUpperCase();
    const accum = costAccum[key];
    if (accum && accum.totalQty > 0) {
      totalPL += s.settlement - (accum.totalCost / accum.totalQty) * s.qty;
    } else {
      hasIncompleteData = true;
    }
  }

  return { totalPL, hasIncompleteData };
}

export function calcEstimatedTax(totalPLUsd: number, exchangeRate: number): number {
  if (totalPLUsd <= 0 || exchangeRate <= 0) return 0;
  const taxable = totalPLUsd - 2500000 / exchangeRate;
  return taxable > 0 ? taxable * 0.22 : 0;
}
