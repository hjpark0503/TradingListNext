'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useExcelImport } from '@/hooks/useExcelImport';
import { Header } from './Header';
import { NoticeTicker } from './NoticeTicker';
import { TradeTypeDonutChart } from './TradeTypeDonutChart';
import { HoldingsList, calcHoldings, isETF, type HoldingFilter } from './HoldingsList';
import { exportEntriesToExcel } from '@/lib/excel';

function valueSize(val: string): string {
  const n = val.length;
  if (n <= 8)  return '1.3rem';
  if (n <= 11) return '1.25rem';
  if (n <= 14) return '1.0rem';
  return '0.875rem';
}

export default function PortfolioPage() {
  const { state, switchMarket, loadEntries } = useDashboard();
  const { isDark, toggle: toggleDark } = useDarkMode();

  const { currentMarket, entries } = state;
  const marketEntries = entries.filter((e) => e.market === currentMarket);

  const [filter, setFilter] = useState<HoldingFilter>('all');
  const [showDeposit, setShowDeposit] = useState(true);

  const fmt = (n: number) =>
    currentMarket === 'domestic'
      ? `₩${Math.round(n).toLocaleString('ko-KR')}`
      : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const depositBalance = useMemo(() => {
    return marketEntries.reduce((sum, e) => {
      if (e.type === 'deposit') return sum + e.amount;
      if (e.type === 'withdraw') return sum - e.amount;
      if (e.type === 'sell') return sum + e.settlement;
      if (e.type === 'buy') return sum - e.settlement;
      if (e.type === 'div') return sum + e.amount;
      return sum;
    }, 0);
  }, [marketEntries]);

  const allHoldings = useMemo(() => calcHoldings(marketEntries), [marketEntries]);
  const stockCount  = useMemo(() => allHoldings.filter((h) => !isETF(h.stock)).length, [allHoldings]);
  const etfCount    = useMemo(() => allHoldings.filter((h) =>  isETF(h.stock)).length, [allHoldings]);

  const [holdingPrices, setHoldingPrices] = useState<Record<string, { price: number; changeRate: number } | null>>({});
  const [pricesFetched, setPricesFetched] = useState(false);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const pricesLoadingRef = useRef(false);

  const stockValue = useMemo(() => {
    return allHoldings.reduce((sum, h) => {
      const cpData = holdingPrices[h.stock];
      const cp = pricesFetched && cpData != null ? cpData.price : h.avgPrice;
      return sum + cp * h.qty;
    }, 0);
  }, [allHoldings, holdingPrices, pricesFetched]);

  const stockCostBasis = useMemo(
    () => allHoldings.reduce((sum, h) => sum + h.avgPrice * h.qty, 0),
    [allHoldings]
  );
  const stockPL = stockValue - stockCostBasis;
  const stockReturnRate = pricesFetched && stockCostBasis > 0 ? (stockPL / stockCostBasis) * 100 : null;
  const stockPLClass = stockReturnRate == null || stockPL === 0 ? '' : stockPL > 0 ? 'pl-pos' : 'pl-neg';

  const totalAssets = depositBalance + stockValue;

  useEffect(() => {
    setHoldingPrices({});
    setPricesFetched(false);
    setPricesLoading(false);
    setLastFetchedAt(null);
    pricesLoadingRef.current = false;
    setFilter('all');
  }, [currentMarket]);

  const fetchHoldingPrices = useCallback(async (holdings: { stock: string }[]) => {
    if (pricesLoadingRef.current || holdings.length === 0) return;
    pricesLoadingRef.current = true;
    setPricesLoading(true);
    const results: Record<string, { price: number; changeRate: number } | null> = {};
    await Promise.all(
      holdings.map(async (h) => {
        try {
          const searchRes = await fetch(`/api/stocks?q=${encodeURIComponent(h.stock)}&market=${currentMarket}`);
          if (!searchRes.ok) { results[h.stock] = null; return; }
          const candidates: { name: string; code: string }[] = await searchRes.json();
          const match = candidates.find((s) => s.name === h.stock) ?? candidates[0];
          if (!match) { results[h.stock] = null; return; }
          const priceRes = await fetch(`/api/stocks/price?code=${encodeURIComponent(match.code)}&market=${currentMarket}`);
          if (priceRes.ok) {
            const data = await priceRes.json();
            results[h.stock] = typeof data.price === 'number'
              ? { price: data.price, changeRate: typeof data.changeRate === 'number' ? data.changeRate : 0 }
              : null;
          } else {
            results[h.stock] = null;
          }
        } catch {
          results[h.stock] = null;
        }
      })
    );
    setHoldingPrices(results);
    setPricesFetched(true);
    setLastFetchedAt(new Date());
    pricesLoadingRef.current = false;
    setPricesLoading(false);
  }, [currentMarket]);

  const handleExport = () => exportEntriesToExcel(entries);
  const { handleImport, importConfirmModal } = useExcelImport(entries, loadEntries);

  const FILTERS: { key: HoldingFilter; label: string; count: number }[] = [
    { key: 'all',   label: '보유 종목 전체', count: allHoldings.length },
    { key: 'stock', label: '주식',           count: stockCount },
    { key: 'etf',   label: 'ETF',            count: etfCount },
  ];

  return (
    <div>
      {importConfirmModal}
      <Header
        onExport={handleExport}
        onImport={handleImport}
        hasEntries={entries.length > 0}
        currentMarket={currentMarket}
        onMarketChange={(m) => switchMarket(m as 'domestic' | 'overseas')}
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
            <div className="portfolio-summary-cards">
              <div className="card card-stat">
                <div className="label">총 자산</div>
                <div className="value" style={{ fontSize: valueSize(fmt(totalAssets)) }}>{fmt(totalAssets)}</div>
              </div>
              <div className="card card-stat">
                <div className="label">주식 평가금액</div>
                <div className={`value ${stockPLClass}`} style={{ fontSize: valueSize(fmt(stockValue)) }}>
                  {fmt(stockValue)}
                  {stockReturnRate != null && (
                    <span className="pl-rate-inline">({stockReturnRate >= 0 ? '+' : ''}{stockReturnRate.toFixed(2)}%)</span>
                  )}
                </div>
              </div>
              <div className="card card-stat">
                <div className="label">현금</div>
                <div className="value" style={{ fontSize: valueSize(fmt(depositBalance)) }}>{fmt(depositBalance)}</div>
              </div>
            </div>

            <div className="section holdings-combined">
              <div className="tab-bar">
                {FILTERS.map(({ key, label, count }) => (
                  <button
                    key={key}
                    className={`tab-btn${filter === key ? ' active' : ''}`}
                    onClick={() => setFilter(key)}
                  >
                    {label}
                    <span className="holdings-filter-count">{count}</span>
                  </button>
                ))}
                <div className="holdings-section-actions">
                  {lastFetchedAt && (
                    <span className="holdings-fetch-time">
                      {lastFetchedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} 기준
                    </span>
                  )}
                  <button
                    className={`holdings-refresh-icon-btn${pricesLoading ? ' loading' : ''}`}
                    onClick={() => fetchHoldingPrices(allHoldings)}
                    disabled={pricesLoading}
                    title={currentMarket === 'overseas' ? '티커 기준 현재가 새로고침' : '국내 종목 현재가 새로고침'}
                    aria-label="현재가 새로고침"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="holdings-chart-section" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 20px 0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showDeposit}
                      onChange={() => setShowDeposit((v) => !v)}
                      style={{ width: 14, height: 14, accentColor: 'var(--brand)', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>현금</span>
                  </label>
                </div>
                <TradeTypeDonutChart
                  entries={marketEntries}
                  market={currentMarket}
                  isDark={isDark}
                  prices={holdingPrices}
                  pricesFetched={pricesFetched}
                  depositBalance={depositBalance}
                  showDeposit={showDeposit}
                  filter={filter}
                  bare
                />
              </div>

              <HoldingsList
                entries={marketEntries}
                market={currentMarket}
                prices={holdingPrices}
                fetched={pricesFetched}
                loading={pricesLoading}
                onFetch={fetchHoldingPrices}
                filter={filter}
                bare
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
