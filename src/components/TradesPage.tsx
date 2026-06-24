'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDashboard } from '@/hooks/useDashboard';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Header } from './Header';
import { NoticeTicker } from './NoticeTicker';
import { TradeForm } from './TradeForm';
import { EntryTable } from './EntryTable';
import { Market, TradeType } from '@/lib/types';
import { exportEntriesToExcel, importEntriesFromExcel } from '@/lib/excel';
import { fmtUsd, fmtKrw } from '@/lib/utils';

const TRADE_CARDS = [
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

export default function TradesPage() {
  const { state, switchTab, switchMarket, addEntry, deleteEntry, deleteEntries, updateEntry, loadEntries } = useDashboard();
  const { isDark, toggle: toggleDark } = useDarkMode();

  const { activeTab, currentMarket, entries } = state;
  const marketEntries = entries.filter((e) => e.market === currentMarket);

  const [selectedYear, setSelectedYear] = useState<string>('전체');

  const years = ['전체', ...Array.from(
    new Set(marketEntries.map((e) => e.date?.slice(0, 4)).filter(Boolean))
  ).sort((a, b) => Number(b) - Number(a))];

  const filteredEntries = selectedYear === '전체'
    ? marketEntries
    : marketEntries.filter((e) => e.date?.startsWith(selectedYear));

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTradeForm, setShowTradeForm] = useState(false);

  const emptyImportRef = useRef<HTMLInputElement>(null);

  function handleEnterSelect() {
    setIsSelectMode(true);
    setSelectedIds(new Set());
  }

  function handleCancelSelect() {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }

  function handleDeleteClick() {
    if (selectedIds.size > 0) setShowDeleteConfirm(true);
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
    setSelectedYear('전체');
  }

  if (isSelectMode && marketEntries.length === 0) {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }

  function cardCount(id: string) {
    return `${filteredEntries.filter((e) => e.type === id).length}건`;
  }
  function cardTotal(id: string) {
    const total = filteredEntries.filter((e) => e.type === id).reduce((s, e) => s + e.settlement, 0);
    return currentMarket === 'domestic' ? fmtKrw(total) : fmtUsd(total);
  }

  const handleExport = () => exportEntriesToExcel(entries);

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
      <NoticeTicker />

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

      <div className={`trades-layout${showTradeForm ? ' trades-layout--with-form' : ''}`}>
        {showTradeForm && (
          <div className="form-aside">
            <TradeForm market={currentMarket} onAdd={addEntry} />
          </div>
        )}

        <div className="trades-main dashboard-area">
          <input
            type="file"
            ref={emptyImportRef}
            accept=".xlsx,.xls"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleImport(f); e.target.value = ''; } }}
          />

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
              <p className="empty-state__desc">첫 거래를 기록하고 수익을 추적해보세요</p>
              <div className="empty-state__actions">
                {!showTradeForm && (
                  <button className="btn-primary" onClick={() => setShowTradeForm(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                    직접 입력하기
                  </button>
                )}
                <button className="btn-secondary" onClick={() => emptyImportRef.current?.click()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  엑셀 불러오기
                </button>
              </div>
            </div>
          )}

          {marketEntries.length > 0 && (
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
          )}

          {marketEntries.length > 0 && (
            <div className="summary-grid">
              {TRADE_CARDS.map((card) => (
                <div key={card.id} className="card card-stat" data-tab={card.id}>
                  <div className="label">{card.label} {cardCount(card.id)}</div>
                  <div className={`value ${card.valueColor}`} style={{ fontSize: '1.2rem' }}>
                    {cardTotal(card.id)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {marketEntries.length > 0 && (
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
                <div className="tab-bar__actions">
                  {!isSelectMode ? (
                    <button className="select-btn" onClick={handleEnterSelect}>선택</button>
                  ) : (
                    <>
                      <button className="select-cancel-btn" onClick={handleCancelSelect}>취소</button>
                      <button
                        className={`trash-btn${selectedIds.size > 0 ? ' trash-btn--delete' : ' trash-btn--inactive'}`}
                        onClick={handleDeleteClick}
                        disabled={selectedIds.size === 0}
                        title={selectedIds.size > 0 ? `${selectedIds.size}건 삭제` : '항목을 선택하세요'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                        {selectedIds.size > 0 ? `${selectedIds.size}건 삭제` : '삭제'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {TABS.map((tab) => (
                <div
                  key={tab.id}
                  className={`tab-panel${activeTab === tab.id ? ' active' : ''}`}
                  id={`panel-${tab.id}`}
                >
                  <EntryTable
                    entries={filteredEntries}
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
          )}
        </div>
      </div>
    </div>
  );

}
