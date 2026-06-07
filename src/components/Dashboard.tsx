'use client';

import { useDashboard } from '@/hooks/useDashboard';
import { Header } from './Header';
import { TradeForm } from './TradeForm';
import { EntryTable } from './EntryTable';
import { Market, TradeType } from '@/lib/types';
import { exportEntriesToExcel, importEntriesFromExcel } from '@/lib/excel';
import { formatUsd } from '@/lib/utils';
import { CapitalGainsTax } from './CapitalGainsTax';

const CARDS = [
  { id: 'buy',      label: '💳 매수',   valueColor: 'red' },
  { id: 'sell',     label: '💰 매도',   valueColor: 'blue' },
  { id: 'deposit',  label: '⬇️ 입금',   valueColor: 'teal' },
  { id: 'withdraw', label: '⬆️ 출금',   valueColor: 'orange' },
  { id: 'div',      label: '🎁 배당금', valueColor: 'green' },
];

const TABS = [
  { id: 'all',      label: '📋 전체' },
  { id: 'buy',      label: '💳 매수' },
  { id: 'sell',     label: '💰 매도' },
  { id: 'deposit',  label: '⬇️ 입금' },
  { id: 'withdraw', label: '⬆️ 출금' },
  { id: 'div',      label: '🎁 배당금' },
];

const EMPTY_MSGS: Record<string, string> = {
  all: '아직 내역이 없습니다.',
  buy: '아직 매수 내역이 없습니다.',
  sell: '아직 매도 내역이 없습니다.',
  deposit: '아직 입금 내역이 없습니다.',
  withdraw: '아직 출금 내역이 없습니다.',
  div: '아직 배당금 내역이 없습니다.',
};

export default function Dashboard() {
  const { state, setExchangeRate, switchTab, switchMarket, addEntry, deleteEntry, updateEntry, loadEntries } = useDashboard();

  const { exchangeRate, activeTab, currentMarket, entries } = state;

  const marketEntries = entries.filter((e) => e.market === currentMarket);

  function cardCount(id: string) {
    const n = marketEntries.filter((e) => e.type === id).length;
    return n ? `${n}건` : '—';
  }
  function cardNote(id: string) {
    const filtered = marketEntries.filter((e) => e.type === id);
    if (!filtered.length) return '—';
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
      <Header onExport={handleExport} onImport={handleImport} hasEntries={entries.length > 0} />

      <div className="main-layout">

        {/* ── 좌: 거래 직접 입력 폼 ── */}
        <TradeForm
          market={currentMarket}
          onMarketChange={(m) => switchMarket(m as Market)}
          onAdd={addEntry}
        />

        {/* ── 우: 대시보드 ── */}
        <div className="dashboard-area">

          {/* 국내/해외 마켓 토글 */}
          <div className="market-squeezer">
            <div className="seg-ctrl">
              {(['domestic', 'overseas'] as Market[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`seg-btn market-btn${currentMarket === m ? ' active' : ''}`}
                  data-market={m}
                  onClick={() => switchMarket(m)}
                >
                  {m === 'domestic' ? '🇰🇷 국내' : '🌐 해외'}
                </button>
              ))}
            </div>
          </div>

          {/* 해외: 환율 패널 */}
          {currentMarket === 'overseas' && (
            <div className="overseas-panel" id="overseas-panel">
              <div className="overseas-panel__main">
                <div className="overseas-panel__rate">
                  <span className="overseas-panel__title">💱 환율</span>
                  <div className="overseas-panel__rate-row">
                    <span className="overseas-panel__sym">₩</span>
                    <input
                      type="number" id="exchangeRateInput" className="rate-input"
                      value={exchangeRate} min={100} max={9999} step={1}
                      aria-label="환율 (원/USD)"
                      onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 100) setExchangeRate(v); }}
                    />
                    <span className="overseas-panel__unit">/ USD</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 서머리 카드 */}
          <div className="cards">
            {CARDS.map((card) => (
              <div
                key={card.id}
                className={`card${activeTab === card.id ? ' active' : ''}`}
                data-tab={card.id}
                onClick={() => switchTab(card.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="label">{card.label}</div>
                <div className={`value ${card.valueColor}`}>{cardCount(card.id)}</div>
                <div className="note">{cardNote(card.id)}</div>
              </div>
            ))}
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
            <CapitalGainsTax entries={entries} exchangeRate={exchangeRate} />
          )}

        </div>
      </div>
    </div>
  );
}
