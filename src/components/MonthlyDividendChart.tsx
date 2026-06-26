'use client';
import { useMemo } from 'react';
import type { Entry, Market } from '@/lib/types';
import { MonthlyBarChart, type MonthData } from './MonthlyBarChart';

function calcMonthlyDividend(entries: Entry[], year: string): MonthData[] {
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
  year?: string; // '전체' 모드면 undefined (직전 연도 비교 표시)
}

export function MonthlyDividendChart({ entries, market, isDark, year: externalYear }: Props) {
  const years = useMemo(
    () =>
      Array.from(
        new Set(entries.filter((e) => e.type === 'div').map((e) => e.date.slice(0, 4)))
      ).sort((a, b) => b.localeCompare(a)),
    [entries]
  );

  const currentYear = externalYear ?? (years[0] ?? String(new Date().getFullYear()));
  const monthData = useMemo(() => calcMonthlyDividend(entries, currentYear), [entries, currentYear]);

  // '전체' 모드(특정 연도 미선택)에서는 직전년도 막대를 회색으로 함께 표시
  const compareYear = !externalYear ? String(Number(currentYear) - 1) : null;
  const compareData = useMemo(
    () => (compareYear ? calcMonthlyDividend(entries, compareYear) : null),
    [entries, compareYear]
  );
  const hasCompare = !!compareData && compareData.some((m) => m.hasData);

  const incomeColor = isDark ? '#FB923C' : '#F97316'; // 배당 오렌지(--div-color)

  return (
    <MonthlyBarChart
      title="월별 배당수익"
      monthData={monthData}
      compareData={hasCompare ? compareData : null}
      currentLabel={currentYear}
      compareLabel={hasCompare ? compareYear : null}
      market={market}
      isDark={isDark}
      emptyText="배당 내역이 없습니다."
      colorMode="income"
      incomeColor={incomeColor}
    />
  );
}
