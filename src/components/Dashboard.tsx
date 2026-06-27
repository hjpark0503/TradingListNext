'use client';

import { useRef, useMemo, useState } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Header } from './Header';
import { Market } from '@/lib/types';
import { exportEntriesToExcel, importEntriesFromExcel } from '@/lib/excel';
import { fmtUsd, fmtKrw, formatUsd } from '@/lib/utils';
import { calcRealizedPL, calcPLByYear } from '@/lib/calculations';
import { CapitalGainsTax } from './CapitalGainsTax';
import { RealizedPLChart } from './RealizedPLChart';
import { MonthlyDividendChart } from './MonthlyDividendChart';
import { PrincipalPLLineChart } from './PrincipalPLLineChart';
import { NoticeTicker } from './NoticeTicker';
import { PLPeriodTable } from './PLPeriodTable';

function valueSize(val: string): string {
  const n = val.length;
  if (n <= 8)  return '1.3rem';
  if (n <= 11) return '1.25rem';
  if (n <= 14) return '1.0rem';
  return '0.875rem';
}

export default function Dashboard() {
  const { state, setExchangeRate, switchMarket, loadEntries } = useDashboard();
  const { isDark, toggle: toggleDark } = useDarkMode();

  const { exchangeRate, currentMarket, entries } = state;
  const marketEntries = entries.filter((e) => e.market === currentMarket);

  const [selectedYear, setSelectedYear] = useState<string>('전체');
  const years = ['전체', ...Array.from(
    new Set(marketEntries.map((e) => e.date?.slice(0, 4)).filter(Boolean))
  ).sort((a, b) => Number(b) - Number(a))];
  const filteredEntries = selectedYear === '전체'
    ? marketEntries
    : marketEntries.filter((e) => e.date?.startsWith(selectedYear));

  // 원가는 전체 이력으로 계산하고 집계만 선택 연도로 거름 (월별 차트·기간별 표와 일치)
  const realizedPL = calcRealizedPL(marketEntries, selectedYear === '전체' ? undefined : selectedYear);
  // '전체' 탭에서 보여줄 연도별 실현손익 (최신 연도 우선)
  const plByYear = calcPLByYear(marketEntries).slice().sort((a, b) => b.label.localeCompare(a.label));
  // '전체' 탭 연도별 원금(순입출금 = 입금 − 출금), 모든 거래 연도 포함(없으면 0)
  const principalByYear = years
    .filter((y) => y !== '전체')
    .map((y) => ({
      label: y,
      val: marketEntries
        .filter((e) => (e.type === 'deposit' || e.type === 'withdraw') && e.date?.startsWith(y))
        .reduce((s, e) => s + (e.type === 'deposit' ? e.settlement : -e.settlement), 0),
    }));
  // 배당금 합계(선택 연도) + '전체' 탭 연도별 내역
  const dividendTotal = filteredEntries.filter((e) => e.type === 'div').reduce((s, e) => s + e.settlement, 0);
  const dividendByYear = years
    .filter((y) => y !== '전체')
    .map((y) => ({
      label: y,
      val: marketEntries
        .filter((e) => e.type === 'div' && e.date?.startsWith(y))
        .reduce((s, e) => s + e.settlement, 0),
    }));

  const plPanelRef = useRef<HTMLDivElement>(null);

  const plChartYears = useMemo(() =>
    Array.from(new Set(marketEntries.filter((e) => e.type === 'sell').map((e) => e.date?.slice(0, 4)).filter(Boolean))).sort((a, b) => b.localeCompare(a)),
    [marketEntries]
  );
  const [plYear, setPlYear] = useState<string | undefined>(undefined);
  const resolvedPlYear = plYear ?? plChartYears[0];

  function handleMarketChange(m: Market) {
    switchMarket(m);
    setSelectedYear('전체');
  }

  const handleExport = () => exportEntriesToExcel(entries);

  const handleImport = async (file: File) => {
    try {
      const imported = await importEntriesFromExcel(file);
      loadEntries(imported);
    } catch (e) {
      alert('엑셀 파일을 읽는 중 오류가 발생했습니다: ' + ((e as Error)?.message ?? String(e)));
    }
  };

  function plCardValue() {
    if (filteredEntries.filter((e) => e.type === 'sell').length === 0) return '—';
    const v = realizedPL.totalPL;
    if (currentMarket === 'domestic') return fmtKrw(v);
    return fmtUsd(v);
  }
  function plCardColor() {
    if (filteredEntries.filter((e) => e.type === 'sell').length === 0) return 'text-muted';
    return realizedPL.totalPL >= 0 ? 'pl-pos' : 'pl-neg';
  }
  // 부호(+/-)를 붙인 금액 포맷 (연도별 내역용). 0은 부호 없이 표시.
  function fmtSignedPL(v: number) {
    const sign = v > 0 ? '+' : v < 0 ? '-' : '';
    const body = currentMarket === 'domestic'
      ? `₩${Math.round(Math.abs(v)).toLocaleString('ko-KR')}`
      : `$${formatUsd(Math.abs(v))}`;
    return `${sign}${body}`;
  }

  function principalValue() {
    const deposits = filteredEntries.filter((e) => e.type === 'deposit').reduce((s, e) => s + e.settlement, 0);
    const withdrawals = filteredEntries.filter((e) => e.type === 'withdraw').reduce((s, e) => s + e.settlement, 0);
    const principal = deposits - withdrawals;
    if (currentMarket === 'domestic') return fmtKrw(principal);
    return fmtUsd(principal);
  }

  function dividendValue() {
    return currentMarket === 'domestic' ? fmtKrw(dividendTotal) : fmtUsd(dividendTotal);
  }

  function returnRateValue() {
    if (filteredEntries.filter((e) => e.type === 'sell').length === 0) return '—';
    if (realizedPL.hasIncompleteData) return '—';
    const totalBuyCost = realizedPL.rows.reduce((s, r) => s + r.buyCost, 0);
    if (totalBuyCost === 0) return '—';
    const rate = (realizedPL.totalPL / totalBuyCost) * 100;
    return `${rate >= 0 ? '+' : ''}${rate.toFixed(2)}%`;
  }

  return (
    <div>
      <Header
        onExport={handleExport}
        onImport={handleImport}
        hasEntries={entries.length > 0}
        currentMarket={currentMarket}
        onMarketChange={(m) => handleMarketChange(m as Market)}
        isDark={isDark}
        onToggleDark={toggleDark}
      />
      <NoticeTicker />

      <div className="page-content">
        {marketEntries.length === 0 && (
          <div className="empty-state">
            <svg className="empty-state__icon" width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
              <rect width="56" height="56" rx="16" fill="var(--bg-input)" />
              <rect x="14" y="32" width="6" height="10" rx="2" fill="var(--text-muted)" opacity=".4" />
              <rect x="24" y="24" width="6" height="18" rx="2" fill="var(--text-muted)" opacity=".65" />
              <rect x="34" y="28" width="6" height="14" rx="2" fill="var(--text-muted)" opacity=".4" />
              <line x1="12" y1="43" x2="44" y2="43" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" opacity=".5" />
            </svg>
            <p className="empty-state__title">아직 거래 내역이 없어요</p>
            <p className="empty-state__desc">거래내역 탭에서 첫 거래를 기록해보세요</p>
          </div>
        )}

        {marketEntries.length > 0 && (
          <div className="dashboard-area">
            <div className="year-filter">
              {years.map((y) => (
                <button
                  key={y}
                  className={`year-filter__btn${selectedYear === y ? ' active' : ''}`}
                  onClick={() => setSelectedYear(y)}
                >
                  {y}
                </button>
              ))}
            </div>

            <div className="summary-grid summary-grid--stats">
              <div
                className="card card-pl"
                style={{ cursor: 'pointer', gridColumn: 'span 1' }}
                onClick={() => plPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <div className="label">{selectedYear === '전체' ? '총 실현손익' : '실현손익'}</div>
                <div className={`value ${plCardColor()}`} style={{ fontSize: valueSize(plCardValue()) }}>
                  {plCardValue()}
                  {returnRateValue() !== '—' && (
                    <span className="pl-rate-inline">({returnRateValue()})</span>
                  )}
                </div>
                {selectedYear === '전체' && plByYear.length > 0 && (
                  <div className="pl-year-breakdown">
                    {plByYear.map((r) => (
                      <div className="pl-year-row" key={r.label}>
                        <span className="pl-year-row__label">{r.label}년</span>
                        <span className={`pl-year-row__val ${r.pl >= 0 ? 'pl-pos' : 'pl-neg'}`}>
                          {fmtSignedPL(r.pl)}
                          {r.hasIncompleteData && <span className="pl-year-row__warn"> ⚠</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {realizedPL.hasIncompleteData && (
                  <div className="note">⚠ 매수 데이터 부분 누락</div>
                )}
              </div>

              <div className="card card-stat card-div" style={{ gridColumn: 'span 1' }}>
                <div className="label">{selectedYear === '전체' ? '총 배당금' : '배당금'}</div>
                <div className="value" style={{ fontSize: valueSize(dividendValue()) }}>{dividendValue()}</div>
                {selectedYear === '전체' && dividendByYear.length > 0 && (
                  <div className="pl-year-breakdown">
                    {dividendByYear.map((r) => (
                      <div className="pl-year-row" key={r.label}>
                        <span className="pl-year-row__label">{r.label}년</span>
                        <span className="pl-year-row__val">{fmtSignedPL(r.val)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card card-stat card-principal" style={{ gridColumn: 'span 1' }}>
                <div className="label">{selectedYear === '전체' ? '총 원금' : '원금'}</div>
                <div className="value" style={{ fontSize: valueSize(principalValue()) }}>{principalValue()}</div>
                {selectedYear === '전체' && principalByYear.length > 0 && (
                  <div className="pl-year-breakdown">
                    {principalByYear.map((r) => (
                      <div className="pl-year-row" key={r.label}>
                        <span className="pl-year-row__label">{r.label}년</span>
                        <span className="pl-year-row__val">{fmtSignedPL(r.val)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 투자 성과 추이 — 전체 너비로 상단 배치 */}
            <PrincipalPLLineChart key={`${currentMarket}-${selectedYear}`} entries={filteredEntries} market={currentMarket} isDark={isDark} />

            <div className="pl-top-row">
              <RealizedPLChart
                key={`chart-${currentMarket}-${selectedYear}`}
                entries={marketEntries}
                market={currentMarket}
                isDark={isDark}
                year={selectedYear === '전체' ? undefined : selectedYear}
                view="chart"
                onYearChange={setPlYear}
              />
              <MonthlyDividendChart
                key={`div-${currentMarket}-${selectedYear}`}
                entries={marketEntries}
                market={currentMarket}
                isDark={isDark}
                year={selectedYear === '전체' ? undefined : selectedYear}
              />
            </div>

            <div className="pl-charts-row" ref={plPanelRef}>
              <PLPeriodTable entries={marketEntries} market={currentMarket} />
              <RealizedPLChart
                key={`list-${currentMarket}`}
                entries={marketEntries}
                market={currentMarket}
                isDark={isDark}
                year={selectedYear === '전체' ? resolvedPlYear : selectedYear}
                view="list"
              />
            </div>

            {currentMarket === 'overseas' && (
              <CapitalGainsTax entries={entries} exchangeRate={exchangeRate} setExchangeRate={setExchangeRate} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
