'use client';
import { useMemo, useState } from 'react';
import type { Entry, Market } from '@/lib/types';
import { calcPLByDate } from '@/lib/calculations';
import { MonthlyBarChart, type MonthData } from './MonthlyBarChart';

type ChartTab = 'pl' | 'div';

const TABS: { id: ChartTab; label: string }[] = [
  { id: 'pl',  label: '실현손익' },
  { id: 'div', label: '배당수익' },
];

function calcMonthlyPL(entries: Entry[], year: string): MonthData[] {
  const byDate = calcPLByDate(entries);
  const months: MonthData[] = Array.from({ length: 12 }, () => ({ pl: 0, buyCost: 0, hasData: false }));
  for (const row of byDate) {
    if (!row.date.startsWith(year)) continue;
    const mi = parseInt(row.date.slice(5, 7), 10) - 1;
    months[mi].hasData = true;
    months[mi].pl += row.totalPL;
    for (const d of row.details) {
      if (d.hasBuyData && d.buyCost !== null) months[mi].buyCost += d.buyCost;
    }
  }
  return months;
}

function calcMonthlyDiv(entries: Entry[], year: string): MonthData[] {
  const months: MonthData[] = Array.from({ length: 12 }, () => ({ pl: 0, buyCost: 0, hasData: false }));
  for (const e of entries) {
    if (e.type !== 'div') continue;
    if (!e.date.startsWith(year)) continue;
    const mi = parseInt(e.date.slice(5, 7), 10) - 1;
    if (mi < 0 || mi > 11) continue;
    months[mi].hasData = true;
    months[mi].pl += e.settlement;
  }
  return months;
}

interface Props {
  entries: Entry[];
  market: Market;
  isDark: boolean;
  year?: string; // undefined = '전체' 모드 (직전 연도 비교 표시)
}

export function MonthlyChartPanel({ entries, market, isDark, year: externalYear }: Props) {
  const [chartTab, setChartTab] = useState<ChartTab>('pl');

  const PROFIT_COLOR  = '#F04452';
  const COMPARE_COLOR = isDark ? '#8B95A1' : '#B0B8C1';
  const incomeColor   = isDark ? '#FB923C' : '#F97316';

  // ── 실현손익 데이터 ──
  const plYears = useMemo(
    () => Array.from(new Set(entries.filter((e) => e.type === 'sell').map((e) => e.date.slice(0, 4)))).sort((a, b) => b.localeCompare(a)),
    [entries]
  );
  const currentPlYear  = externalYear ?? (plYears[0] ?? String(new Date().getFullYear()));
  const plMonthData    = useMemo(() => calcMonthlyPL(entries, currentPlYear), [entries, currentPlYear]);
  const plCompareYear  = !externalYear ? String(Number(currentPlYear) - 1) : null;
  const plCompareData  = useMemo(
    () => (plCompareYear ? calcMonthlyPL(entries, plCompareYear) : null),
    [entries, plCompareYear]
  );
  const hasPlCompare = !!plCompareData && plCompareData.some((m) => m.hasData);

  // ── 배당손익 데이터 ──
  const divYears = useMemo(
    () => Array.from(new Set(entries.filter((e) => e.type === 'div').map((e) => e.date.slice(0, 4)))).sort((a, b) => b.localeCompare(a)),
    [entries]
  );
  const currentDivYear = externalYear ?? (divYears[0] ?? String(new Date().getFullYear()));
  const divMonthData   = useMemo(() => calcMonthlyDiv(entries, currentDivYear), [entries, currentDivYear]);
  const divCompareYear = !externalYear ? String(Number(currentDivYear) - 1) : null;
  const divCompareData = useMemo(
    () => (divCompareYear ? calcMonthlyDiv(entries, divCompareYear) : null),
    [entries, divCompareYear]
  );
  const hasDivCompare = !!divCompareData && divCompareData.some((m) => m.hasData);

  // ── 헤더 범례 정보 (활성 탭 기준) ──
  const currentYear  = chartTab === 'pl' ? currentPlYear  : currentDivYear;
  const compareYear  = chartTab === 'pl' ? plCompareYear  : divCompareYear;
  const hasCompare   = chartTab === 'pl' ? hasPlCompare   : hasDivCompare;
  const legendColor  = chartTab === 'pl' ? PROFIT_COLOR   : incomeColor;

  return (
    <div className="apl-panel">
      <div className="apl-header">
        <span className="apl-title">월별 성과</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="rpl-seg">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`rpl-seg__btn${chartTab === t.id ? ' active' : ''}`}
                onClick={() => setChartTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chartTab === 'pl' ? (
        <MonthlyBarChart
          key="chart-pl"
          title="월별 실현손익"
          monthData={plMonthData}
          compareData={hasPlCompare ? plCompareData : null}
          currentLabel={currentPlYear}
          compareLabel={hasPlCompare ? plCompareYear : null}
          market={market}
          isDark={isDark}
          emptyText="매도 내역이 없습니다."
          colorMode="pl"
          bare
          showAllMonths
        />
      ) : (
        <MonthlyBarChart
          key="chart-div"
          title="월별 배당손익"
          monthData={divMonthData}
          compareData={hasDivCompare ? divCompareData : null}
          currentLabel={currentDivYear}
          compareLabel={hasDivCompare ? divCompareYear : null}
          market={market}
          isDark={isDark}
          emptyText="배당 내역이 없습니다."
          colorMode="income"
          incomeColor={incomeColor}
          bare
          showAllMonths
        />
      )}
    </div>
  );
}
