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

  const sellAccum: Record<string, { qty: number; proceeds: number; label: string }> = {};
  for (const s of yearSells) {
    const key = s.stock.trim().toUpperCase();
    if (!sellAccum[key]) sellAccum[key] = { qty: 0, proceeds: 0, label: s.stock.trim() };
    sellAccum[key].qty += s.qty;
    sellAccum[key].proceeds += s.settlement;
  }

  const rows: CapGainRow[] = Object.entries(sellAccum).map(([key, { qty, proceeds, label }]) => {
    const avgCost = avgCostMap[key];
    if (avgCost !== undefined) {
      const buyCostUsd = avgCost * qty;
      const plUsd = proceeds - buyCostUsd;
      return { stock: label, sellQty: qty, sellProceedsUsd: proceeds, buyCostUsd, plUsd, plKrw: plUsd * exchangeRate, hasBuyData: true };
    }
    return { stock: label, sellQty: qty, sellProceedsUsd: proceeds, buyCostUsd: null, plUsd: null, plKrw: null, hasBuyData: false };
  });

  const hasIncompleteData = rows.some((r) => !r.hasBuyData);
  const totalPlKrw = rows
    .filter((r) => r.hasBuyData && r.plKrw !== null)
    .reduce((s, r) => s + r.plKrw!, 0);
  const deductionKrw = 2_500_000;
  const taxableKrw = Math.max(0, totalPlKrw - deductionKrw);

  return { rows, totalPlKrw, deductionKrw, taxableKrw, estimatedTaxKrw: taxableKrw * 0.22, hasIncompleteData };
}

export interface RealizedPLRow {
  stock: string;
  avgCostPerUnit: number;
  sellQty: number;
  sellProceeds: number;
  buyCost: number;
  pl: number;
  hasBuyData: boolean;
}

export interface RealizedPLResult {
  totalPL: number;
  hasIncompleteData: boolean;
  rows: RealizedPLRow[];
}

export function calcRealizedPL(entries: Entry[]): RealizedPLResult {
  const buys  = entries.filter((e) => e.type === 'buy'  && e.qty > 0);
  const sells = entries.filter((e) => e.type === 'sell' && e.qty > 0);

  if (sells.length === 0) return { totalPL: 0, hasIncompleteData: false, rows: [] };

  const costAccum: Record<string, { totalCost: number; totalQty: number }> = {};
  for (const b of buys) {
    const key = b.stock.trim().toUpperCase();
    if (!costAccum[key]) costAccum[key] = { totalCost: 0, totalQty: 0 };
    costAccum[key].totalCost += b.settlement;
    costAccum[key].totalQty  += b.qty;
  }

  const sellAccum: Record<string, { qty: number; proceeds: number; label: string }> = {};
  for (const s of sells) {
    const key = s.stock.trim().toUpperCase();
    if (!sellAccum[key]) sellAccum[key] = { qty: 0, proceeds: 0, label: s.stock.trim() };
    sellAccum[key].qty      += s.qty;
    sellAccum[key].proceeds += s.settlement;
  }

  let totalPL = 0;
  let hasIncompleteData = false;
  const rows: RealizedPLRow[] = [];

  for (const [key, { qty, proceeds, label }] of Object.entries(sellAccum)) {
    const accum = costAccum[key];
    if (accum && accum.totalQty > 0) {
      const avgCostPerUnit = accum.totalCost / accum.totalQty;
      const buyCost = avgCostPerUnit * qty;
      const pl = proceeds - buyCost;
      totalPL += pl;
      rows.push({ stock: label, avgCostPerUnit, sellQty: qty, sellProceeds: proceeds, buyCost, pl, hasBuyData: true });
    } else {
      hasIncompleteData = true;
      rows.push({ stock: label, avgCostPerUnit: 0, sellQty: qty, sellProceeds: proceeds, buyCost: 0, pl: 0, hasBuyData: false });
    }
  }

  return { totalPL, hasIncompleteData, rows };
}

export function calcEstimatedTax(totalPLUsd: number, exchangeRate: number): number {
  if (totalPLUsd <= 0 || exchangeRate <= 0) return 0;
  const taxable = totalPLUsd - 2500000 / exchangeRate;
  return taxable > 0 ? taxable * 0.22 : 0;
}
