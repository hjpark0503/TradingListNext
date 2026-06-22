'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useDashboard } from '@/hooks/useDashboard';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Header } from './Header';
import { Market } from '@/lib/types';
import { exportEntriesToExcel, importEntriesFromExcel } from '@/lib/excel';
import { fmtUsd, fmtKrw } from '@/lib/utils';
import { calcRealizedPL } from '@/lib/calculations';
import { CapitalGainsTax } from './CapitalGainsTax';
import { RealizedPLPanel } from './RealizedPLPanel';

const CARDS = [
  { id: 'buy',      label: '매수',   valueColor: 'red' },
  { id: 'sell',     label: '매도',   valueColor: 'blue' },
  { id: 'deposit',  label: '입금',   valueColor: 'teal' },
  { id: 'withdraw', label: '출금',   valueColor: 'orange' },
  { id: 'div',      label: '배당금', valueColor: 'purple' },
];

function valueSize(val: string): string {
  const n = val.length;
  if (n <= 8)  return '1.3rem';
  if (n <= 11) return '1.25rem';
  if (n <= 14) return '1.0rem';
  return '0.875rem';
}

function valueSizeSm(_val: string): string {
  return '1.2rem';
}

export default function Dashboard() {
  const { state, setExchangeRate, switchMarket, loadEntries } = useDashboard();
  const { isDark, toggle: toggleDark } = useDarkMode();

  const { exchangeRate, currentMarket, entries } = state;
  const marketEntries = entries.filter((e) => e.market === currentMarket);
  const realizedPL = calcRealizedPL(marketEntries);

  const plPanelRef = useRef<HTMLDivElement>(null);
  const emptyImportRef = useRef<HTMLInputElement>(null);

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
  function cardTotal(id: string) {
    const filtered = marketEntries.filter((e) => e.type === id);
    const total = filtered.reduce((s, e) => s + e.settlement, 0);
    if (currentMarket === 'domestic') return fmtKrw(total);
    return fmtUsd(total);
  }

  function returnRateValue() {
    if (marketEntries.filter((e) => e.type === 'sell').length === 0) return '—';
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

      <div className="page-content">
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
              <Link href="/trades" className="btn-primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                거래 입력하기
              </Link>
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
          <div className="dashboard-area">
            <div className="summary-grid">
              <div
                className="card card-pl"
                style={{ cursor: 'pointer' }}
                onClick={() => plPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <div className="label">실현손익</div>
                <div className={`value ${plCardColor()}`} style={{ fontSize: valueSize(plCardValue()) }}>
                  {plCardValue()}
                  {returnRateValue() !== '—' && (
                    <span className="pl-rate-inline">({returnRateValue()})</span>
                  )}
                </div>
                {realizedPL.hasIncompleteData && (
                  <div className="note">⚠ 매수 데이터 부분 누락</div>
                )}
              </div>

              <div className="card card-stat card-principal">
                <div className="label">원금</div>
                <div className="value" style={{ fontSize: valueSize(principalValue()) }}>{principalValue()}</div>
              </div>

              <div className="summary-grid-spacer" style={{ gridColumn: 'span 1' }} aria-hidden="true" />

              {CARDS.map((card) => (
                <div key={card.id} className="card card-stat" data-tab={card.id}>
                  <div className="label">{card.label} {cardCount(card.id)}</div>
                  <div className={`value ${card.valueColor}`} style={{ fontSize: valueSizeSm(cardTotal(card.id)) }}>{cardTotal(card.id)}</div>
                </div>
              ))}
            </div>

            <div ref={plPanelRef}>
              <RealizedPLPanel entries={marketEntries} market={currentMarket} isDark={isDark} />
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
