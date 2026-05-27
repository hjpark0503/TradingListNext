'use client';

import { useDashboard } from '@/hooks/useDashboard';
import { Header } from './Header';
import { TradeForm } from './TradeForm';
import { TradeTable } from './TradeTable';
import { EntryTable } from './EntryTable';
import { BalanceChart } from './BalanceChart';
import { formatUsd } from '@/lib/utils';
import { Market, TradeType } from '@/lib/types';

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
  const { state, handlePdfFile, setExchangeRate, switchTab, switchMarket, addEntry, deleteEntry } = useDashboard();

  const {
    buys, sells, plRows, plTotals,
    exchangeRate, estimatedTax,
    activeTab, currentMarket,
    loading, loadingMessage,
    headerSub, headerMeta,
    entries,
  } = state;

  const allRows = [...buys, ...sells];

  // 카드 수치: 직접 입력 entries 기준
  function cardCount(id: string) {
    const n = entries.filter((e) => e.type === id).length;
    return n ? `${n}건` : '—';
  }
  function cardNote(id: string) {
    const filtered = entries.filter((e) => e.type === id);
    if (!filtered.length) return '—';
    const total = filtered.reduce((s, e) => s + e.settlement, 0);
    const mkt = filtered[0].market;
    if (mkt === 'domestic') return `총 ₩${Math.round(total).toLocaleString('ko-KR')}`;
    return `총 $${formatUsd(total)}`;
  }

  return (
    <div>
      <Header
        headerSub={headerSub}
        headerMeta={headerMeta}
        loading={loading}
        loadingMessage={loadingMessage}
        onFileSelect={handlePdfFile}
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

          {/* 해외: 환율 + 예상 양도세 패널 */}
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
                <div className="overseas-panel__divider" aria-hidden />
                <div className="overseas-panel__etax">
                  <span className="overseas-panel__title">💸 예상 양도세</span>
                  <div className="overseas-panel__value orange" id="card-etax-value">
                    {estimatedTax > 0 ? `$${formatUsd(estimatedTax)}` : '$0.00'}
                  </div>
                  <div className="overseas-panel__note" id="card-etax-note">
                    {estimatedTax > 0
                      ? `≈ ₩${Math.round(estimatedTax * exchangeRate).toLocaleString()}`
                      : '기본공제 ₩250만 적용'}
                  </div>
                </div>
              </div>
              <p className="overseas-panel__hint">양도소득세 계산 기준 (기본공제 250만원, 세율 22%)</p>
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

            {/* 실현 손익 카드 (PDF 데이터 기준) */}
            <div className="card card-stat" id="card-pl">
              <div className="label">📈 실현 손익</div>
              <div
                className={`value${plTotals.hasSomeData ? ` ${plTotals.totalPL >= 0 ? 'red' : 'blue'}` : ''}`}
                id="card-pl-value"
              >
                {plTotals.hasSomeData
                  ? `${plTotals.totalPL >= 0 ? '+$' : '-$'}${formatUsd(Math.abs(plTotals.totalPL))}`
                  : '—'}
              </div>
              <div className="note" id="card-pl-note">
                {plTotals.hasSomeData && plTotals.plPct !== null
                  ? `${plTotals.plPct >= 0 ? '+' : ''}${plTotals.plPct.toFixed(2)}% 수익률`
                  : '데이터 로드 후 표시'}
              </div>
            </div>
          </div>

          {/* 잔고 흐름 차트 (PDF 데이터 기준) */}
          <div className="section chart-section">
            <h2>💰 잔고 흐름</h2>
            <p className="chart-hint" id="chartLineHint">
              {allRows.length > 0
                ? `${new Set(allRows.map((r) => r.date)).size}개 거래일 기준 일별 말잔 예수금입니다.`
                : '거래일 기준 일별 말잔 잔고가 표시됩니다.'}
            </p>
            <div className="chart-wrap chart-wrap--tall">
              <BalanceChart rows={allRows} />
            </div>
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
                {/* 매수/매도 탭은 PDF 파싱 결과도 함께 표시 */}
                {tab.id === 'buy' && buys.length > 0 ? (
                  <TradeTable rows={buys} side="buy" />
                ) : tab.id === 'sell' && sells.length > 0 ? (
                  <TradeTable rows={sells} plRows={plRows} side="sell" />
                ) : (
                  <EntryTable
                    entries={entries}
                    panel={tab.id as TradeType | 'all'}
                    emptyMsg={EMPTY_MSGS[tab.id]}
                    onDelete={deleteEntry}
                  />
                )}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
