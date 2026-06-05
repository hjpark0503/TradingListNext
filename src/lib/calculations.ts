import { Entry, TradeRow, PLRow, PLTotals } from './types';

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

export function calcWeightedAvgCosts(buys: TradeRow[]): Record<string, number> {
  const map: Record<string, { totalCost: number; totalQty: number }> = {};
  for (const b of buys) {
    const key = b.name.trim();
    if (!map[key]) map[key] = { totalCost: 0, totalQty: 0 };
    map[key].totalCost += Math.abs(b.settlement);
    map[key].totalQty += b.qty;
  }
  const result: Record<string, number> = {};
  for (const name in map) {
    if (map[name].totalQty > 0) result[name] = map[name].totalCost / map[name].totalQty;
  }
  return result;
}

export function calcRealizedPLRows(buys: TradeRow[], sells: TradeRow[]): PLRow[] {
  const avgCosts = calcWeightedAvgCosts(buys);
  return sells.map((s) => {
    const key = s.name.trim();
    if (avgCosts[key] !== undefined) {
      const buyCost = avgCosts[key] * s.qty;
      const pl = Math.abs(s.settlement) - buyCost;
      const plPct = buyCost > 0 ? (pl / buyCost) * 100 : null;
      return { sell: s, buyCost, pl, plPct, hasBuyData: true };
    }
    return { sell: s, buyCost: null, pl: null, plPct: null, hasBuyData: false };
  });
}

export function calcTotalRealizedPL(plRows: PLRow[]): PLTotals {
  let totalPL = 0;
  let totalBuyCost = 0;
  let hasSomeData = false;

  for (const row of plRows) {
    if (row.hasBuyData && row.pl !== null && row.buyCost !== null) {
      totalPL += row.pl;
      totalBuyCost += row.buyCost;
      hasSomeData = true;
    }
  }

  return {
    totalPL,
    totalBuyCost,
    plPct: totalBuyCost > 0 ? (totalPL / totalBuyCost) * 100 : null,
    hasSomeData,
  };
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

  // 전체 매수 이력으로 주식별 가중평균 단가 계산
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

  // 해당 연도 매도 내역 종목별 합산
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

export function calcEstimatedTax(totalPLUsd: number, exchangeRate: number): number {
  if (totalPLUsd <= 0 || exchangeRate <= 0) return 0;
  const taxable = totalPLUsd - 2500000 / exchangeRate;
  return taxable > 0 ? taxable * 0.22 : 0;
}
