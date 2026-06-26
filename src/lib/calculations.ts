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

// ─────────────────────────────────────────────────────────────────────────
// 매도별 실현손익 (시간순 이동평균)
//
// 종목마다 매수/매도를 날짜순(같은 날짜는 매수 먼저)으로 처리하며 보유 수량·원가를
// 누적한다. 각 매도는 "그 시점까지의 평균단가"만으로 손익을 계산하므로, 미래의 매수가
// 과거 매도의 원가에 섞이지 않는다. 모든 집계 함수가 이 결과를 공유한다.
// ─────────────────────────────────────────────────────────────────────────
export interface SellPL {
  pl: number;        // 실현손익
  buyCost: number;   // 소모된 원가 = 매도시점 평균단가 × 수량
  avgCost: number;   // 매도시점 평균단가(주당)
  hasBuyData: boolean;
}

function computeSellPLMap(entries: Entry[]): Map<Entry, SellPL> {
  const map = new Map<Entry, SellPL>();

  const groups: Record<string, Entry[]> = {};
  for (const e of entries) {
    if ((e.type === 'buy' || e.type === 'sell') && e.qty > 0) {
      const key = e.stock.trim().toUpperCase();
      (groups[key] ||= []).push(e);
    }
  }

  for (const key in groups) {
    const txns = groups[key].slice().sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      // 같은 날짜에서는 매수를 먼저 반영
      return (a.type === 'buy' ? 0 : 1) - (b.type === 'buy' ? 0 : 1);
    });

    let qty = 0;   // 보유 수량
    let cost = 0;  // 보유 원가 누계
    for (const t of txns) {
      if (t.type === 'buy') {
        qty += t.qty;
        cost += t.settlement;
      } else {
        if (qty > 0) {
          const avg = cost / qty;
          const buyCost = avg * t.qty;
          map.set(t, { pl: t.settlement - buyCost, buyCost, avgCost: avg, hasBuyData: true });
          // 이동평균법: 평균단가는 유지한 채 보유분만 차감
          const consume = Math.min(t.qty, qty);
          cost -= avg * consume;
          qty -= consume;
          if (qty < 1e-9) { qty = 0; cost = 0; }
        } else {
          // 매수 기록이 없는(또는 시점상 보유 0인) 매도
          map.set(t, { pl: 0, buyCost: 0, avgCost: 0, hasBuyData: false });
        }
      }
    }
  }

  return map;
}

export function calcCapitalGains(
  entries: Entry[],
  year: number,
  exchangeRate: number
): CapGainSummary {
  const yearStr = String(year);
  const overseasEntries = entries.filter((e) => e.market === 'overseas');
  const yearSells = overseasEntries.filter(
    (e) => e.type === 'sell' && e.qty > 0 && e.date.startsWith(yearStr)
  );

  if (yearSells.length === 0) {
    return { rows: [], totalPlKrw: 0, deductionKrw: 2_500_000, taxableKrw: 0, estimatedTaxKrw: 0, hasIncompleteData: false };
  }

  const plMap = computeSellPLMap(overseasEntries);

  const acc: Record<string, { label: string; qty: number; proceeds: number; buyCost: number; pl: number; hasBuyData: boolean }> = {};
  for (const s of yearSells) {
    const info = plMap.get(s);
    const key = s.stock.trim().toUpperCase();
    if (!acc[key]) acc[key] = { label: s.stock.trim(), qty: 0, proceeds: 0, buyCost: 0, pl: 0, hasBuyData: true };
    acc[key].qty += s.qty;
    acc[key].proceeds += s.settlement;
    if (info?.hasBuyData) { acc[key].buyCost += info.buyCost; acc[key].pl += info.pl; }
    else acc[key].hasBuyData = false;
  }

  const rows: CapGainRow[] = Object.values(acc).map((a) =>
    a.hasBuyData
      ? { stock: a.label, sellQty: a.qty, sellProceedsUsd: a.proceeds, buyCostUsd: a.buyCost, plUsd: a.pl, plKrw: a.pl * exchangeRate, hasBuyData: true }
      : { stock: a.label, sellQty: a.qty, sellProceedsUsd: a.proceeds, buyCostUsd: null, plUsd: null, plKrw: null, hasBuyData: false }
  );

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

export function calcRealizedPL(entries: Entry[], sellYear?: string): RealizedPLResult {
  // 원가(이동평균)는 항상 전체 이력으로 계산하고, 집계 대상 매도만 연도로 거른다.
  const sells = entries.filter((e) => e.type === 'sell' && e.qty > 0 && (!sellYear || e.date.startsWith(sellYear)));
  if (sells.length === 0) return { totalPL: 0, hasIncompleteData: false, rows: [] };

  const plMap = computeSellPLMap(entries);

  const acc: Record<string, { label: string; qty: number; proceeds: number; buyCost: number; pl: number; hasBuyData: boolean }> = {};
  for (const s of sells) {
    const info = plMap.get(s);
    const key = s.stock.trim().toUpperCase();
    if (!acc[key]) acc[key] = { label: s.stock.trim(), qty: 0, proceeds: 0, buyCost: 0, pl: 0, hasBuyData: true };
    acc[key].qty += s.qty;
    acc[key].proceeds += s.settlement;
    if (info?.hasBuyData) { acc[key].buyCost += info.buyCost; acc[key].pl += info.pl; }
    else acc[key].hasBuyData = false;
  }

  let totalPL = 0;
  let hasIncompleteData = false;
  const rows: RealizedPLRow[] = [];
  for (const key in acc) {
    const a = acc[key];
    if (a.hasBuyData) {
      totalPL += a.pl;
      rows.push({ stock: a.label, avgCostPerUnit: a.qty > 0 ? a.buyCost / a.qty : 0, sellQty: a.qty, sellProceeds: a.proceeds, buyCost: a.buyCost, pl: a.pl, hasBuyData: true });
    } else {
      hasIncompleteData = true;
      rows.push({ stock: a.label, avgCostPerUnit: 0, sellQty: a.qty, sellProceeds: a.proceeds, buyCost: 0, pl: 0, hasBuyData: false });
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

export function calcPLByDate(entries: Entry[], sellYear?: string): PLByDateRow[] {
  const sells = entries.filter((e) => e.type === 'sell' && e.qty > 0 && (!sellYear || e.date.startsWith(sellYear)));
  if (sells.length === 0) return [];

  const plMap = computeSellPLMap(entries);

  const dateMap: Record<string, Record<string, { qty: number; proceeds: number; pl: number; buyCost: number; hasBuyData: boolean; label: string }>> = {};
  for (const s of sells) {
    const info = plMap.get(s);
    const key = s.stock.trim().toUpperCase();
    if (!dateMap[s.date]) dateMap[s.date] = {};
    if (!dateMap[s.date][key]) dateMap[s.date][key] = { qty: 0, proceeds: 0, pl: 0, buyCost: 0, hasBuyData: true, label: s.stock.trim() };
    const g = dateMap[s.date][key];
    g.qty += s.qty;
    g.proceeds += s.settlement;
    if (info?.hasBuyData) { g.pl += info.pl; g.buyCost += info.buyCost; }
    else g.hasBuyData = false;
  }

  return Object.entries(dateMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, stockMap]) => {
      const details: PLByDateDetail[] = [];
      let totalPL = 0;
      let hasIncompleteData = false;

      for (const key in stockMap) {
        const g = stockMap[key];
        if (g.hasBuyData) {
          totalPL += g.pl;
          details.push({ stock: g.label, qty: g.qty, proceeds: g.proceeds, buyCost: g.buyCost, pl: g.pl, hasBuyData: true });
        } else {
          hasIncompleteData = true;
          details.push({ stock: g.label, qty: g.qty, proceeds: g.proceeds, buyCost: null, pl: null, hasBuyData: false });
        }
      }

      return { date, totalPL, hasIncompleteData, details };
    });
}

export function calcPLByStock(entries: Entry[], sellYear?: string): PLByStockRow[] {
  const sells = entries.filter((e) => e.type === 'sell' && e.qty > 0 && (!sellYear || e.date.startsWith(sellYear)));
  if (sells.length === 0) return [];

  const plMap = computeSellPLMap(entries);

  const stockMap: Record<string, { label: string; dateMap: Record<string, { qty: number; proceeds: number; pl: number; buyCost: number; hasBuyData: boolean }> }> = {};
  for (const s of sells) {
    const info = plMap.get(s);
    const key = s.stock.trim().toUpperCase();
    if (!stockMap[key]) stockMap[key] = { label: s.stock.trim(), dateMap: {} };
    if (!stockMap[key].dateMap[s.date]) stockMap[key].dateMap[s.date] = { qty: 0, proceeds: 0, pl: 0, buyCost: 0, hasBuyData: true };
    const g = stockMap[key].dateMap[s.date];
    g.qty += s.qty;
    g.proceeds += s.settlement;
    if (info?.hasBuyData) { g.pl += info.pl; g.buyCost += info.buyCost; }
    else g.hasBuyData = false;
  }

  const rows: PLByStockRow[] = Object.values(stockMap).map(({ label, dateMap }) => {
    let totalPL = 0;
    let hasIncompleteData = false;

    const details: PLByStockDetail[] = Object.entries(dateMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, g]) => {
        if (g.hasBuyData) {
          totalPL += g.pl;
          return { date, qty: g.qty, proceeds: g.proceeds, buyCost: g.buyCost, pl: g.pl };
        }
        hasIncompleteData = true;
        return { date, qty: g.qty, proceeds: g.proceeds, buyCost: null, pl: null };
      });

    return { stock: label, totalPL, hasIncompleteData, details };
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

export interface PeriodPLSummary {
  pl: number;
  buyCost: number;
  hasIncompleteData: boolean;
}
export interface MonthPLItem extends PeriodPLSummary { key: string }
export interface QuarterPLItem extends PeriodPLSummary { label: string; months: MonthPLItem[] }
export interface HalfPLItem extends PeriodPLSummary { label: string; quarters: QuarterPLItem[] }
export interface YearPLItem extends PeriodPLSummary { label: string; halves: HalfPLItem[] }

export function calcPLPeriodTable(entries: Entry[]): YearPLItem[] {
  if (entries.length === 0) return [];

  // Build P&L map keyed by "YYYY-MM" from sell transactions
  const byDate = calcPLByDate(entries);
  type Acc = { pl: number; buyCost: number; incomplete: boolean };
  const plMap = new Map<string, Acc>();
  for (const row of byDate) {
    const key = row.date.slice(0, 7);
    let pl = 0, buyCost = 0;
    for (const d of row.details) {
      if (d.hasBuyData) { pl += d.pl!; buyCost += d.buyCost!; }
    }
    const acc = plMap.get(key);
    if (acc) { acc.pl += pl; acc.buyCost += buyCost; if (row.hasIncompleteData) acc.incomplete = true; }
    else plMap.set(key, { pl, buyCost, incomplete: row.hasIncompleteData });
  }

  // All years that appear in any entry
  const years = Array.from(new Set(entries.map((e) => e.date?.slice(0, 4)).filter(Boolean)))
    .sort((a, b) => b.localeCompare(a));

  return years.map((yearLabel) => {
    const halves: HalfPLItem[] = ['상반기', '하반기'].map((halfLabel, hi) => {
      const quarters: QuarterPLItem[] = [1, 2].map((qIdx) => {
        const qNum = hi * 2 + qIdx;
        const qMonths = [1, 2, 3].map((offset) => (qNum - 1) * 3 + offset);
        const months: MonthPLItem[] = qMonths.map((mn) => {
          const key = `${yearLabel}-${String(mn).padStart(2, '0')}`;
          const acc = plMap.get(key);
          return { key, pl: acc?.pl ?? 0, buyCost: acc?.buyCost ?? 0, hasIncompleteData: acc?.incomplete ?? false };
        });
        return {
          label: `${qNum}분기`,
          pl: months.reduce((s, m) => s + m.pl, 0),
          buyCost: months.reduce((s, m) => s + m.buyCost, 0),
          hasIncompleteData: months.some((m) => m.hasIncompleteData),
          months,
        };
      });
      return {
        label: halfLabel,
        pl: quarters.reduce((s, q) => s + q.pl, 0),
        buyCost: quarters.reduce((s, q) => s + q.buyCost, 0),
        hasIncompleteData: quarters.some((q) => q.hasIncompleteData),
        quarters,
      };
    });
    return {
      label: yearLabel,
      pl: halves.reduce((s, h) => s + h.pl, 0),
      buyCost: halves.reduce((s, h) => s + h.buyCost, 0),
      hasIncompleteData: halves.some((h) => h.hasIncompleteData),
      halves,
    };
  });
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
  const plMap = computeSellPLMap(entries);

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
        const info = plMap.get(e);
        if (info?.hasBuyData) cumulativePL += info.pl;
      }
    }
    result.push({ date, principal: cumulativePrincipal, cumulativePL });
  }

  return result;
}
