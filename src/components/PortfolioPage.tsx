'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Header } from './Header';
import { TradeTypeDonutChart } from './TradeTypeDonutChart';
import { HoldingsList } from './HoldingsList';
import { Market } from '@/lib/types';
import { exportEntriesToExcel, importEntriesFromExcel } from '@/lib/excel';

export default function PortfolioPage() {
  const { state, switchMarket, loadEntries } = useDashboard();
  const { isDark, toggle: toggleDark } = useDarkMode();

  const { currentMarket, entries } = state;
  const marketEntries = entries.filter((e) => e.market === currentMarket);

  const [holdingPrices, setHoldingPrices] = useState<Record<string, { price: number; changeRate: number } | null>>({});
  const [pricesFetched, setPricesFetched] = useState(false);
  const [pricesLoading, setPricesLoading] = useState(false);
  const pricesLoadingRef = useRef(false);

  useEffect(() => {
    setHoldingPrices({});
    setPricesFetched(false);
    setPricesLoading(false);
    pricesLoadingRef.current = false;
  }, [currentMarket]);

  const fetchHoldingPrices = useCallback(async (holdings: { stock: string }[]) => {
    if (pricesLoadingRef.current || holdings.length === 0) return;
    pricesLoadingRef.current = true;
    setPricesLoading(true);
    const results: Record<string, { price: number; changeRate: number } | null> = {};
    await Promise.all(
      holdings.map(async (h) => {
        try {
          const searchRes = await fetch(
            `/api/stocks?q=${encodeURIComponent(h.stock)}&market=${currentMarket}`
          );
          if (!searchRes.ok) { results[h.stock] = null; return; }
          const candidates: { name: string; code: string }[] = await searchRes.json();
          const match = candidates.find((s) => s.name === h.stock) ?? candidates[0];
          if (!match) { results[h.stock] = null; return; }
          const priceRes = await fetch(
            `/api/stocks/price?code=${encodeURIComponent(match.code)}&market=${currentMarket}`
          );
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
    pricesLoadingRef.current = false;
    setPricesLoading(false);
  }, [currentMarket]);

  function handleMarketChange(m: Market) {
    switchMarket(m);
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
            <p className="empty-state__desc">거래내역 탭에서 매수 거래를 입력하면 보유 종목이 표시됩니다</p>
          </div>
        )}

        {marketEntries.length > 0 && (
          <div className="dashboard-area">
            <div className="holdings-col">
              <TradeTypeDonutChart
                entries={marketEntries}
                market={currentMarket}
                isDark={isDark}
                prices={holdingPrices}
                pricesFetched={pricesFetched}
              />
              <HoldingsList
                entries={marketEntries}
                market={currentMarket}
                prices={holdingPrices}
                fetched={pricesFetched}
                loading={pricesLoading}
                onFetch={fetchHoldingPrices}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
