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

export interface PLByDateDetail {
  stock: string;
  qty: number;
  proceeds: number;
  buyCost: number | null;
  pl: number | null;
  hasBuyData: boolean;
}

export interface PLByDateRow {
  date: string;
  totalPL: number;
  hasIncompleteData: boolean;
  details: PLByDateDetail[];
}

export interface PLByStockDetail {
  date: string;
  qty: number;
  proceeds: number;
  buyCost: number | null;
  pl: number | null;
}

export interface PLByStockRow {
  stock: string;
  totalPL: number;
  hasIncompleteData: boolean;
  details: PLByStockDetail[];
}

function buildAvgCostMap(entries: Entry[]): Record<string, number> {
  const buys = entries.filter((e) => e.type === 'buy' && e.qty > 0);
  const accum: Record<string, { totalCost: number; totalQty: number }> = {};
  for (const b of buys) {
    const key = b.stock.trim().toUpperCase();
    if (!accum[key]) accum[key] = { totalCost: 0, totalQty: 0 };
    accum[key].totalCost += b.settlement;
    accum[key].totalQty += b.qty;
  }
  const map: Record<string, number> = {};
  for (const key in accum) {
    if (accum[key].totalQty > 0) map[key] = accum[key].totalCost / accum[key].totalQty;
  }
  return map;
}

export function calcPLByDate(entries: Entry[]): PLByDateRow[] {
  const sells = entries.filter((e) => e.type === 'sell' && e.qty > 0);
  if (sells.length === 0) return [];

  const avgCostMap = buildAvgCostMap(entries);

  const dateMap: Record<string, Record<string, { qty: number; proceeds: number; label: string }>> = {};
  for (const s of sells) {
    const date = s.date;
    const key = s.stock.trim().toUpperCase();
    if (!dateMap[date]) dateMap[date] = {};
    if (!dateMap[date][key]) dateMap[date][key] = { qty: 0, proceeds: 0, label: s.stock.trim() };
    dateMap[date][key].qty += s.qty;
    dateMap[date][key].proceeds += s.settlement;
  }

  return Object.entries(dateMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, stockMap]) => {
      const details: PLByDateDetail[] = [];
      let totalPL = 0;
      let hasIncompleteData = false;

      for (const [key, { qty, proceeds, label }] of Object.entries(stockMap)) {
        const avgCost = avgCostMap[key];
        if (avgCost !== undefined) {
          const buyCost = avgCost * qty;
          const pl = proceeds - buyCost;
          totalPL += pl;
          details.push({ stock: label, qty, proceeds, buyCost, pl, hasBuyData: true });
        } else {
          hasIncompleteData = true;
          details.push({ stock: label, qty, proceeds, buyCost: null, pl: null, hasBuyData: false });
        }
      }

      return { date, totalPL, hasIncompleteData, details };
    });
}

export function calcPLByStock(entries: Entry[]): PLByStockRow[] {
  const sells = entries.filter((e) => e.type === 'sell' && e.qty > 0);
  if (sells.length === 0) return [];

  const avgCostMap = buildAvgCostMap(entries);

  const stockMap: Record<string, { label: string; dateMap: Record<string, { qty: number; proceeds: number }> }> = {};
  for (const s of sells) {
    const key = s.stock.trim().toUpperCase();
    if (!stockMap[key]) stockMap[key] = { label: s.stock.trim(), dateMap: {} };
    if (!stockMap[key].dateMap[s.date]) stockMap[key].dateMap[s.date] = { qty: 0, proceeds: 0 };
    stockMap[key].dateMap[s.date].qty += s.qty;
    stockMap[key].dateMap[s.date].proceeds += s.settlement;
  }

  const rows: PLByStockRow[] = Object.entries(stockMap).map(([key, { label, dateMap }]) => {
    const avgCost = avgCostMap[key];
    let totalPL = 0;

    const details: PLByStockDetail[] = Object.entries(dateMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, { qty, proceeds }]) => {
        if (avgCost !== undefined) {
          const buyCost = avgCost * qty;
          const pl = proceeds - buyCost;
          totalPL += pl;
          return { date, qty, proceeds, buyCost, pl };
        }
        return { date, qty, proceeds, buyCost: null, pl: null };
      });

    return { stock: label, totalPL, hasIncompleteData: avgCost === undefined, details };
  });

  return rows.sort((a, b) => b.totalPL - a.totalPL);
}

export interface PLPeriodRow {
  label: string;
  pl: number;
  hasIncompleteData: boolean;
}

export function calcPLByYear(entries: Entry[]): PLPeriodRow[] {
  const byDate = calcPLByDate(entries);
  const map: Record<string, { pl: number; incomplete: boolean }> = {};
  for (const row of byDate) {
    const year = row.date.slice(0, 4);
    if (!map[year]) map[year] = { pl: 0, incomplete: false };
    map[year].pl += row.totalPL;
    if (row.hasIncompleteData) map[year].incomplete = true;
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, { pl, incomplete }]) => ({ label, pl, hasIncompleteData: incomplete }));
}

export function calcPLByMonth(entries: Entry[], year: string): PLPeriodRow[] {
  const byDate = calcPLByDate(entries);
  const map: Record<string, { pl: number; incomplete: boolean }> = {};
  for (const row of byDate) {
    if (!row.date.startsWith(year)) continue;
    const month = row.date.slice(0, 7);
    if (!map[month]) map[month] = { pl: 0, incomplete: false };
    map[month].pl += row.totalPL;
    if (row.hasIncompleteData) map[month].incomplete = true;
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, { pl, incomplete }]) => ({ label, pl, hasIncompleteData: incomplete }));
}

export function calcEstimatedTax(totalPLUsd: number, exchangeRate: number): number {
  if (totalPLUsd <= 0 || exchangeRate <= 0) return 0;
  const taxable = totalPLUsd - 2500000 / exchangeRate;
  return taxable > 0 ? taxable * 0.22 : 0;
}

export interface PrincipalPLPoint {
  date: string;
  principal: number;
  cumulativePL: number;
}

export function calcPrincipalAndPLOverTime(entries: Entry[]): PrincipalPLPoint[] {
  const avgCostMap = buildAvgCostMap(entries);

  const eventDates = new Set<string>();
  for (const e of entries) {
    if (e.type === 'deposit' || e.type === 'withdraw' || e.type === 'sell') {
      eventDates.add(e.date);
    }
  }

  const sortedDates = Array.from(eventDates).sort();
  if (sortedDates.length === 0) return [];

  let cumulativePrincipal = 0;
  let cumulativePL = 0;
  const result: PrincipalPLPoint[] = [];

  for (const date of sortedDates) {
    for (const e of entries.filter((e) => e.date === date)) {
      if (e.type === 'deposit') cumulativePrincipal += e.settlement;
      else if (e.type === 'withdraw') cumulativePrincipal -= e.settlement;
      else if (e.type === 'sell' && e.qty > 0) {
        const avgCost = avgCostMap[e.stock.trim().toUpperCase()];
        if (avgCost !== undefined) cumulativePL += e.settlement - avgCost * e.qty;
      }
    }
    result.push({ date, principal: cumulativePrincipal, cumulativePL });
  }

  return result;
}
