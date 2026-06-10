'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Header } from './Header';
import { TradeForm } from './TradeForm';
import { EntryTable } from './EntryTable';
import { Market, TradeType } from '@/lib/types';
import { exportEntriesToExcel, importEntriesFromExcel } from '@/lib/excel';
import { formatUsd } from '@/lib/utils';
import { calcRealizedPL } from '@/lib/calculations';
import { CapitalGainsTax } from './CapitalGainsTax';
import { TradeTypeDonutChart } from './TradeTypeDonutChart';
import { HoldingsList } from './HoldingsList';

const CARDS = [
  { id: 'buy',      label: '매수',   valueColor: 'red' },
  { id: 'sell',     label: '매도',   valueColor: 'blue' },
  { id: 'deposit',  label: '입금',   valueColor: 'teal' },
  { id: 'withdraw', label: '출금',   valueColor: 'orange' },
  { id: 'div',      label: '배당금', valueColor: 'purple' },
];

const TABS = [
  { id: 'all',      label: '전체' },
  { id: 'buy',      label: '매수' },
  { id: 'sell',     label: '매도' },
  { id: 'deposit',  label: '입금' },
  { id: 'withdraw', label: '출금' },
  { id: 'div',      label: '배당금' },
];

const EMPTY_MSGS: Record<string, string> = {
  all: '아직 내역이 없습니다.',
  buy: '아직 매수 내역이 없습니다.',
  sell: '아직 매도 내역이 없습니다.',
  deposit: '아직 입금 내역이 없습니다.',
  withdraw: '아직 출금 내역이 없습니다.',
  div: '아직 배당금 내역이 없습니다.',
};

function valueSize(val: string): string | undefined {
  const n = val.length;
  if (n <= 8)  return undefined;   // CSS default 1.6rem
  if (n <= 11) return '1.25rem';
  if (n <= 14) return '1.0rem';
  return '0.875rem';
}

export default function Dashboard() {
  const { state, setExchangeRate, switchTab, switchMarket, addEntry, deleteEntry, updateEntry, loadEntries } = useDashboard();
  const { isDark, toggle: toggleDark } = useDarkMode();

  const { exchangeRate, activeTab, currentMarket, entries } = state;

  const marketEntries = entries.filter((e) => e.market === currentMarket);

  const realizedPL = calcRealizedPL(marketEntries);
  const [showPLDetail, setShowPLDetail] = useState(false);

  // 보유 종목 현재가 (HoldingsList ↔ TradeTypeDonutChart 공유)
  const [holdingPrices, setHoldingPrices] = useState<Record<string, number | null>>({});
  const [pricesFetched, setPricesFetched] = useState(false);
  const [pricesLoading, setPricesLoading] = useState(false);
  const pricesLoadingRef = useRef(false);

  useEffect(() => {
    setHoldingPrices({});
    setPricesFetched(false);
    setPricesLoading(false);
    pricesLoadingRef.current = false;
  }, [currentMarket]);

  // pricesLoading을 deps에서 제거해 함수가 안정적으로 유지되도록 ref로 guard
  const fetchHoldingPrices = useCallback(async (holdings: { stock: string }[]) => {
    if (pricesLoadingRef.current || holdings.length === 0) return;
    pricesLoadingRef.current = true;
    setPricesLoading(true);
    const results: Record<string, number | null> = {};
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
            results[h.stock] = typeof data.price === 'number' ? data.price : null;
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

  const hasPLData = realizedPL.rows.length > 0;

  function plCardValue() {
    if (marketEntries.filter((e) => e.type === 'sell').length === 0) return '—';
    const v = realizedPL.totalPL;
    if (currentMarket === 'domestic') return `₩${Math.round(v).toLocaleString('ko-KR')}`;
    return `$${formatUsd(v)}`;
  }
  function plCardColor() {
    if (marketEntries.filter((e) => e.type === 'sell').length === 0) return 'text-muted';
    return realizedPL.totalPL >= 0 ? 'pl-pos' : 'pl-neg';
  }

  function cardCount(id: string) {
    const n = marketEntries.filter((e) => e.type === id).length;
    return `${n}건`;
  }
  function cardNote(id: string) {
    const filtered = marketEntries.filter((e) => e.type === id);
    const total = filtered.reduce((s, e) => s + e.settlement, 0);
    if (currentMarket === 'domestic') return `총 ₩${Math.round(total).toLocaleString('ko-KR')}`;
    return `총 $${formatUsd(total)}`;
  }

  const handleExport = () => {
    exportEntriesToExcel(entries);
  };

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
        onMarketChange={(m) => switchMarket(m as Market)}
        isDark={isDark}
        onToggleDark={toggleDark}
      />

      <div className="main-layout">

        {/* ── 좌: 거래 직접 입력 폼 ── */}
        <TradeForm
          market={currentMarket}
          onMarketChange={(m) => switchMarket(m as Market)}
          onAdd={addEntry}
        />

        {/* ── 우: 대시보드 ── */}
        <div className="dashboard-area">

          {/* 실현손익 카드 + 내역 패널 + 서머리 카드 (5열 그리드) */}
          <div className="summary-grid">
            {/* 실현손익 카드 — 2열 차지 */}
            <div
              className={`card card-pl${hasPLData ? '' : ' card-stat'}${showPLDetail ? ' active' : ''}`}
              onClick={() => hasPLData && setShowPLDetail((v) => !v)}
              style={{ cursor: hasPLData ? 'pointer' : 'default' }}
            >
              <div className="label">실현손익</div>
              <div className={`value ${plCardColor()}`}>{plCardValue()}</div>
              <div className="note">
                {realizedPL.hasIncompleteData
                  ? '⚠ 매수 데이터 부분 누락'
                  : hasPLData
                  ? (showPLDetail ? '▲ 내역 접기' : '▼ 내역 보기')
                  : '가중평균 원가 기준'}
              </div>
            </div>
            {/* 나머지 3열 채우는 스페이서 (실현손익 아래 행에 서머리 카드가 오도록) */}
            <div className="summary-grid-spacer" style={{ gridColumn: 'span 3' }} aria-hidden="true" />

            {/* 실현손익 계산 내역 패널 — 전체 너비 */}
            {showPLDetail && hasPLData && (
              <div className="pl-detail-panel">
                <div className="pl-detail-header">
                  <span>실현손익 계산 내역</span>
                  <span className="pl-detail-hint">가중평균 원가 = 총 매수금액 ÷ 총 매수수량</span>
                </div>
                <div className="pl-detail-table-wrap">
                  <table className="pl-detail-table">
                    <thead>
                      <tr>
                        <th>종목</th>
                        <th className="r">매도수량</th>
                        <th className="r">가중평균 원가</th>
                        <th className="r">매수원가 합계</th>
                        <th className="r">매도금액</th>
                        <th className="r">실현손익</th>
                      </tr>
                    </thead>
                    <tbody>
                      {realizedPL.rows.map((row) => {
                        const fmt = (n: number) =>
                          currentMarket === 'domestic'
                            ? `₩${Math.round(n).toLocaleString('ko-KR')}`
                            : `$${formatUsd(n)}`;
                        return (
                          <tr key={row.stock}>
                            <td className="pl-detail-stock">{row.stock}</td>
                            <td className="r">{row.sellQty.toLocaleString('en-US')}</td>
                            {row.hasBuyData ? (
                              <>
                                <td className="r">{fmt(row.avgCostPerUnit)}</td>
                                <td className="r">{fmt(row.buyCost)}</td>
                                <td className="r">{fmt(row.sellProceeds)}</td>
                                <td className={`r ${row.pl >= 0 ? 'pl-pos' : 'pl-neg'}`}>
                                  {row.pl >= 0 ? '+' : '−'}{fmt(Math.abs(row.pl))}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="r pl-na">—</td>
                                <td className="r pl-na">—</td>
                                <td className="r">{fmt(row.sellProceeds)}</td>
                                <td className="r pl-na">매수 없음</td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5} className="r">합계</td>
                        <td className={`r ${realizedPL.totalPL >= 0 ? 'pl-pos' : 'pl-neg'}`}>
                          {realizedPL.totalPL >= 0 ? '+' : '−'}
                          {currentMarket === 'domestic'
                            ? `₩${Math.round(Math.abs(realizedPL.totalPL)).toLocaleString('ko-KR')}`
                            : `$${formatUsd(Math.abs(realizedPL.totalPL))}`}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* 서머리 카드 5개 */}
            {CARDS.map((card) => (
              <div
                key={card.id}
                className={`card${activeTab === card.id ? ' active' : ''}`}
                data-tab={card.id}
                onClick={() => switchTab(card.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="label">{card.label}</div>
                <div className={`value ${card.valueColor}`} style={{ fontSize: valueSize(cardCount(card.id)) }}>{cardCount(card.id)}</div>
                <div className="note">{cardNote(card.id)}</div>
              </div>
            ))}
          </div>

          {/* 보유 종목 비중 + 보유 종목 내역 */}
          <div className="holdings-row">
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

          {/* 탭 거래내역 */}
          <div className="section">
            <div className="tab-bar">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
                  data-tab={tab.id}
                  onClick={() => switchTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {TABS.map((tab) => (
              <div
                key={tab.id}
                className={`tab-panel${activeTab === tab.id ? ' active' : ''}`}
                id={`panel-${tab.id}`}
              >
                <EntryTable
                  entries={marketEntries}
                  panel={tab.id as TradeType | 'all'}
                  emptyMsg={EMPTY_MSGS[tab.id]}
                  onDelete={deleteEntry}
                  onUpdate={updateEntry}
                />
              </div>
            ))}
          </div>

          {/* 해외: 양도세 계산기 */}
          {currentMarket === 'overseas' && (
            <CapitalGainsTax entries={entries} exchangeRate={exchangeRate} setExchangeRate={setExchangeRate} />
          )}

        </div>
      </div>
    </div>
  );
}
