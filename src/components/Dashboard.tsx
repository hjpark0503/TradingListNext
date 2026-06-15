'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDashboard } from '@/hooks/useDashboard';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Header } from './Header';
import { TradeForm } from './TradeForm';
import { EntryTable } from './EntryTable';
import { Market, TradeType } from '@/lib/types';
import { exportEntriesToExcel, importEntriesFromExcel } from '@/lib/excel';
import { fmtUsd, fmtKrw } from '@/lib/utils';
import { calcRealizedPL } from '@/lib/calculations';
import { CapitalGainsTax } from './CapitalGainsTax';
import { TradeTypeDonutChart } from './TradeTypeDonutChart';
import { HoldingsList } from './HoldingsList';
import { RealizedPLPanel } from './RealizedPLPanel';

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
  all: '내역이 없습니다.',
  buy: '매수 내역이 없습니다.',
  sell: '매도 내역이 없습니다.',
  deposit: '입금 내역이 없습니다.',
  withdraw: '출금 내역이 없습니다.',
  div: '배당금 내역이 없습니다.',
};

function valueSize(val: string): string | undefined {
  const n = val.length;
  if (n <= 8)  return undefined;   // CSS default 1.6rem
  if (n <= 11) return '1.25rem';
  if (n <= 14) return '1.0rem';
  return '0.875rem';
}

export default function Dashboard() {
  const { state, setExchangeRate, switchTab, switchMarket, addEntry, deleteEntry, deleteEntries, updateEntry, loadEntries } = useDashboard();
  const { isDark, toggle: toggleDark } = useDarkMode();

  const { exchangeRate, activeTab, currentMarket, entries } = state;

  const marketEntries = entries.filter((e) => e.market === currentMarket);

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function handleTrashClick() {
    if (!isSelectMode) {
      setIsSelectMode(true);
      setSelectedIds(new Set());
      return;
    }
    if (selectedIds.size > 0) {
      setShowDeleteConfirm(true);
      return;
    }
    setIsSelectMode(false);
  }

  function handleDeleteConfirm() {
    deleteEntries([...selectedIds]);
    setSelectedIds(new Set());
    setIsSelectMode(false);
    setShowDeleteConfirm(false);
  }

  function handleDeleteCancel() {
    setShowDeleteConfirm(false);
  }

  function handleToggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleToggleSelectAll(ids: number[]) {
    setSelectedIds(new Set(ids));
  }

  function handleMarketChange(m: Market) {
    switchMarket(m);
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }

  if (isSelectMode && marketEntries.length === 0) {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }

  const realizedPL = calcRealizedPL(marketEntries);

  // 보유 종목 현재가 (HoldingsList ↔ TradeTypeDonutChart 공유)
  const [holdingPrices, setHoldingPrices] = useState<Record<string, { price: number; changeRate: number } | null>>({});
  const [pricesFetched, setPricesFetched] = useState(false);
  const [pricesLoading, setPricesLoading] = useState(false);
  const pricesLoadingRef = useRef(false);
  const tradeListRef = useRef<HTMLDivElement>(null);
  const plPanelRef = useRef<HTMLDivElement>(null);

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

  const [showTradeForm, setShowTradeForm] = useState(false);

  function plCardValue() {
    if (marketEntries.filter((e) => e.type === 'sell').length === 0) return '—';
    const v = realizedPL.totalPL;
    if (currentMarket === 'domestic') return fmtKrw(v);
    return fmtUsd(v);
  }
  function plCardColor() {
    if (marketEntries.filter((e) => e.type === 'sell').length === 0) return 'text-muted';
    return realizedPL.totalPL >= 0 ? 'pl-pos' : 'pl-neg';
  }

  function principalValue() {
    const deposits = marketEntries.filter((e) => e.type === 'deposit').reduce((s, e) => s + e.settlement, 0);
    const withdrawals = marketEntries.filter((e) => e.type === 'withdraw').reduce((s, e) => s + e.settlement, 0);
    const principal = deposits - withdrawals;
    if (currentMarket === 'domestic') return fmtKrw(principal);
    return fmtUsd(principal);
  }

  function cardCount(id: string) {
    const n = marketEntries.filter((e) => e.type === id).length;
    return `${n}건`;
  }
  function cardNote(id: string) {
    const filtered = marketEntries.filter((e) => e.type === id);
    const total = filtered.reduce((s, e) => s + e.settlement, 0);
    if (currentMarket === 'domestic') return `총 ${fmtKrw(total)}`;
    return `총 ${fmtUsd(total)}`;
  }

  const handleExport = () => {
    exportEntriesToExcel(entries);
  };

  const handleImport = async (file: File) => {
    try {
      const imported = await importEntriesFromExcel(file);
      loadEntries(imported);
      setIsSelectMode(false);
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
    } catch (e) {
      alert('엑셀 파일을 읽는 중 오류가 발생했습니다: ' + ((e as Error)?.message ?? String(e)));
    }
  };

  const deleteConfirmModal = showDeleteConfirm ? createPortal(
    <div className="confirm-overlay" onClick={handleDeleteCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </div>
        <p className="confirm-title">정말 삭제하시겠습니까?</p>
        <p className="confirm-desc">
          선택한 <strong>{selectedIds.size}건</strong>의 거래내역이 삭제됩니다.<br />이 작업은 되돌릴 수 없습니다.
        </p>
        <div className="confirm-actions">
          <button className="confirm-btn-cancel" onClick={handleDeleteCancel}>취소</button>
          <button className="confirm-btn-delete" onClick={handleDeleteConfirm}>삭제</button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div>
      {deleteConfirmModal}
      <Header
        onExport={handleExport}
        onImport={handleImport}
        hasEntries={entries.length > 0}
        currentMarket={currentMarket}
        onMarketChange={(m) => handleMarketChange(m as Market)}
        isDark={isDark}
        onToggleDark={toggleDark}
      />

      <button
        className={`trade-form-fab${showTradeForm ? ' trade-form-fab--open' : ''}`}
        onClick={() => setShowTradeForm((v) => !v)}
        title={showTradeForm ? '직접 입력 닫기' : '거래 직접 입력'}
      >
        {showTradeForm
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        }
      </button>

      <div className={`main-layout${showTradeForm ? '' : ' main-layout--form-hidden'}`}>

        {/* ── 좌: 거래 직접 입력 폼 ── */}
        {showTradeForm && (
          <TradeForm
            market={currentMarket}
            onMarketChange={(m) => handleMarketChange(m as Market)}
            onAdd={addEntry}
          />
        )}

        {/* ── 우: 대시보드 ── */}
        <div className="dashboard-area">

          {/* 실현손익 카드 + 내역 패널 + 서머리 카드 (5열 그리드) */}
          <div className="summary-grid">
            {/* 실현손익 카드 — 2열 차지 */}
            <div
              className="card card-pl"
              style={{ cursor: 'pointer' }}
              onClick={() => plPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              <div className="label">실현손익</div>
              <div className={`value ${plCardColor()}`}>{plCardValue()}</div>
              <div className="note">
                {realizedPL.hasIncompleteData ? '⚠ 매수 데이터 부분 누락' : '가중평균 원가 기준'}
              </div>
            </div>
            {/* 원금 카드 — 2열 차지 */}
            <div className="card card-stat card-principal">
              <div className="label">원금</div>
              <div className="value" style={{ fontSize: valueSize(principalValue()) }}>{principalValue()}</div>
              <div className="note">입금 - 출금</div>
            </div>
            {/* 나머지 1열 채우는 스페이서 */}
            <div className="summary-grid-spacer" style={{ gridColumn: 'span 1' }} aria-hidden="true" />

            {/* 서머리 카드 5개 */}
            {CARDS.map((card) => (
              <div
                key={card.id}
                className={`card${activeTab === card.id ? ' active' : ''}`}
                data-tab={card.id}
                onClick={() => {
                  switchTab(card.id);
                  tradeListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
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

          {/* 실현손익 (연도별/월별/일자별/종목별) */}
          <div ref={plPanelRef}>
            <RealizedPLPanel entries={marketEntries} market={currentMarket} isDark={isDark} />
          </div>

          {/* 탭 거래내역 */}
          <div className="section" ref={tradeListRef}>
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
              {marketEntries.length > 0 && (
                <button
                  className={`trash-btn tab-bar__trash${isSelectMode ? (selectedIds.size > 0 ? ' trash-btn--delete' : ' trash-btn--active') : ''}`}
                  onClick={handleTrashClick}
                  title={isSelectMode ? (selectedIds.size > 0 ? `${selectedIds.size}건 삭제` : '선택 취소') : '항목 선택 삭제'}
                >
                  {isSelectMode && selectedIds.size > 0 && (
                    <span className="trash-btn__badge">{selectedIds.size}</span>
                  )}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              )}
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
                  isSelectMode={isSelectMode}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onToggleSelectAll={handleToggleSelectAll}
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
