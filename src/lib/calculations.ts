import { TradeRow, PLRow, PLTotals } from './types';

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

export function calcEstimatedTax(totalPLUsd: number, exchangeRate: number): number {
  if (totalPLUsd <= 0 || exchangeRate <= 0) return 0;
  const taxable = totalPLUsd - 2500000 / exchangeRate;
  return taxable > 0 ? taxable * 0.22 : 0;
}
