'use client';
import { useMemo, useState } from 'react';
import { Entry, Market } from '@/lib/types';
import {
  calcPLByDate,
  calcPLByStock,
  calcRealizedPL,
} from '@/lib/calculations';
import { formatUsd } from '@/lib/utils';

type Tab    = 'date' | 'stock';
type Dir    = 'asc' | 'desc';
type Period = '3M' | '6M' | '1Y' | 'all';

const PERIODS: { key: Period; label: string }[] = [
  { key: '3M',  label: '3M' },
  { key: '6M',  label: '6M' },
  { key: '1Y',  label: '1Y' },
  { key: 'all', label: '전체' },
];

interface Props {
  entries: Entry[];
  market: Market;
  isDark?: boolean;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'date',  label: '일자' },
  { id: 'stock', label: '종목' },
];

function SortIcon({ active, dir }: { active: boolean; dir: Dir }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: active ? 1 : 0.3, flexShrink: 0 }}>
      {dir === 'desc' || !active
        ? <path d="M5 7L1.5 3h7L5 7z" fill="currentColor" />
        : <path d="M5 3l3.5 4h-7L5 3z" fill="currentColor" />}
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="rpl-chevron"
      width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}


export function RealizedPLPanel({ entries, market, isDark = false }: Props) {
  const [tab, setTab]       = useState<Tab>('date');
  const [period, setPeriod] = useState<Period>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dateSort,  setDateSort]  = useState<{ col: 'date'  | 'pl'; dir: Dir }>({ col: 'date',  dir: 'desc' });
  const [stockSort, setStockSort] = useState<{ col: 'stock' | 'pl'; dir: Dir }>({ col: 'pl',    dir: 'desc' });

  // 기간 필터: 매수는 전체 유지(평균단가 보존), 매도만 기간 내로 제한
  const filteredEntries = useMemo(() => {
    if (period === 'all') return entries;
    const sells = entries.filter((e) => e.type === 'sell');
    if (sells.length === 0) return entries;
    const latestDate = sells.reduce((m, e) => (e.date > m ? e.date : m), sells[0].date);
    const end   = new Date(latestDate);
    const start = new Date(end);
    if (period === '3M') start.setMonth(start.getMonth() - 3);
    else if (period === '6M') start.setMonth(start.getMonth() - 6);
    else if (period === '1Y') start.setFullYear(start.getFullYear() - 1);
    const startStr = start.toISOString().slice(0, 10);
    return entries.filter((e) => e.type !== 'sell' || e.date >= startStr);
  }, [entries, period]);

  const byDate  = useMemo(() => calcPLByDate(filteredEntries),  [filteredEntries]);
  const byStock = useMemo(() => calcPLByStock(filteredEntries), [filteredEntries]);
  const total   = useMemo(() => calcRealizedPL(filteredEntries), [filteredEntries]);

  // 통계
  const winningStocks       = byStock.filter((r) => !r.hasIncompleteData && r.totalPL > 0).length;
  const totalStocksWithData = byStock.filter((r) => !r.hasIncompleteData).length;
  const winRate             = totalStocksWithData > 0 ? Math.round((winningStocks / totalStocksWithData) * 100) : null;
  const totalSellCount      = byDate.reduce((s, r) => s + r.details.length, 0);

  const sortedByDate = [...byDate].sort((a, b) => {
    const mul = dateSort.dir === 'asc' ? 1 : -1;
    if (dateSort.col === 'date') return a.date < b.date ? -mul : a.date > b.date ? mul : 0;
    return (a.totalPL - b.totalPL) * mul;
  });
  const sortedByStock = [...byStock].sort((a, b) => {
    const mul = stockSort.dir === 'asc' ? 1 : -1;
    if (stockSort.col === 'stock') return a.stock.localeCompare(b.stock, 'ko') * mul;
    return (a.totalPL - b.totalPL) * mul;
  });

  function toggleDateSort(col: 'date' | 'pl') {
    setDateSort((p) => p.col === col ? { col, dir: p.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' });
    setExpanded(new Set());
  }
  function toggleStockSort(col: 'stock' | 'pl') {
    setStockSort((p) => p.col === col ? { col, dir: p.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' });
    setExpanded(new Set());
  }
  function toggle(key: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  function fmtAbs(n: number) {
    const abs = Math.abs(n);
    return market === 'domestic'
      ? `₩${Math.round(abs).toLocaleString('ko-KR')}`
      : `$${formatUsd(abs)}`;
  }
  function fmtPL(n: number) { return `${n >= 0 ? '+' : '−'}${fmtAbs(n)}`; }
  function plCls(n: number)  { return n >= 0 ? 'pl-pos' : 'pl-neg'; }
  function fmtRate(pl: number, buyCost: number) {
    if (buyCost === 0) return null;
    const r = (pl / buyCost) * 100;
    return `${r >= 0 ? '+' : ''}${r.toFixed(2)}%`;
  }
  const hasSells = byDate.length > 0 || byStock.length > 0;

  return (
    <div className="rpl-panel">

      {/* ── 헤더 ── */}
      <div className="rpl-header">
        <span className="rpl-title">실현손익 내역</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <div className="rpl-seg">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                className={`rpl-seg__btn${period === p.key ? ' active' : ''}`}
                onClick={() => { setPeriod(p.key); setExpanded(new Set()); }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="rpl-seg">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`rpl-seg__btn${tab === t.id ? ' active' : ''}`}
                onClick={() => { setTab(t.id); setExpanded(new Set()); }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasSells ? (
        <div className="panel-empty">매도 내역이 없습니다.</div>
      ) : (
        <>
          <div className="rpl-list-col">
              {tab === 'date' ? (
                byDate.length === 0
                  ? <div className="panel-empty">매도 내역이 없습니다.</div>
                  : <>
                      <div className="rpl-col-header">
                        <button className={`rpl-col-btn${dateSort.col === 'date' ? ' active' : ''}`} onClick={() => toggleDateSort('date')}>
                          일자 <SortIcon active={dateSort.col === 'date'} dir={dateSort.dir} />
                        </button>
                        <button className={`rpl-col-btn rpl-col-btn--right${dateSort.col === 'pl' ? ' active' : ''}`} onClick={() => toggleDateSort('pl')}>
                          실현손익 <SortIcon active={dateSort.col === 'pl'} dir={dateSort.dir} />
                        </button>
                      </div>
                      {sortedByDate.map((row) => {
                        const open = expanded.has(row.date);
                        return (
                          <div key={row.date} className="rpl-group">
                            <button className={`rpl-parent${open ? ' open' : ''}`} onClick={() => toggle(row.date)}>
                              <span className="rpl-parent__left">
                                <span className="rpl-parent__key">{row.date}</span>
                                <span className="rpl-parent__sub">{row.details.length}종목</span>
                              </span>
                              {row.hasIncompleteData && row.totalPL === 0
                                ? <span className="rpl-parent__pl pl-na">⚠ 누락</span>
                                : <span className={`rpl-parent__pl ${plCls(row.totalPL)}`}>{fmtPL(row.totalPL)}</span>
                              }
                              <ChevronIcon open={open} />
                            </button>
                            {open && (
                              <div className="rpl-children">
                                {row.details.map((d, i) => (
                                  <div key={`${d.stock}-${i}`} className="rpl-child">
                                    <span className="rpl-child__key">{d.stock}</span>
                                    <span className="rpl-child__qty">{d.qty.toLocaleString()}주</span>
                                    {d.hasBuyData
                                      ? <span className="rpl-child__pl-wrap">
                                          <span className={`rpl-child__pl ${plCls(d.pl!)}`}>{fmtPL(d.pl!)}</span>
                                          {fmtRate(d.pl!, d.buyCost!) && (
                                            <span className={`rpl-rate rpl-rate--sm ${plCls(d.pl!)}`}>({fmtRate(d.pl!, d.buyCost!)})</span>
                                          )}
                                        </span>
                                      : <span className="rpl-child__pl pl-na">매수 없음</span>
                                    }
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>

              ) : (
                byStock.length === 0
                  ? <div className="panel-empty">매도 내역이 없습니다.</div>
                  : <>
                      <div className="rpl-col-header">
                        <button className={`rpl-col-btn${stockSort.col === 'stock' ? ' active' : ''}`} onClick={() => toggleStockSort('stock')}>
                          종목 <SortIcon active={stockSort.col === 'stock'} dir={stockSort.dir} />
                        </button>
                        <button className={`rpl-col-btn rpl-col-btn--right${stockSort.col === 'pl' ? ' active' : ''}`} onClick={() => toggleStockSort('pl')}>
                          실현손익 <SortIcon active={stockSort.col === 'pl'} dir={stockSort.dir} />
                        </button>
                      </div>
                      {sortedByStock.map((row) => {
                        const open = expanded.has(row.stock);
                        return (
                          <div key={row.stock} className="rpl-group">
                            <button className={`rpl-parent${open ? ' open' : ''}`} onClick={() => toggle(row.stock)}>
                              <span className="rpl-parent__left">
                                <span className="rpl-parent__key rpl-parent__key--stock">{row.stock}</span>
                                <span className="rpl-parent__sub">{row.details.length}건</span>
                              </span>
                              {row.hasIncompleteData
                                ? <span className="rpl-parent__pl pl-na">⚠ 매수 없음</span>
                                : <span className={`rpl-parent__pl ${plCls(row.totalPL)}`}>{fmtPL(row.totalPL)}</span>
                              }
                              <ChevronIcon open={open} />
                            </button>
                            {open && (
                              <div className="rpl-children">
                                {row.details.map((d, i) => (
                                  <div key={`${d.date}-${i}`} className="rpl-child">
                                    <span className="rpl-child__key rpl-child__key--date">{d.date}</span>
                                    <span className="rpl-child__qty">{d.qty.toLocaleString()}주</span>
                                    {d.pl !== null
                                      ? <span className="rpl-child__pl-wrap">
                                          <span className={`rpl-child__pl ${plCls(d.pl)}`}>{fmtPL(d.pl)}</span>
                                          {fmtRate(d.pl, d.buyCost!) && (
                                            <span className={`rpl-rate rpl-rate--sm ${plCls(d.pl)}`}>({fmtRate(d.pl, d.buyCost!)})</span>
                                          )}
                                        </span>
                                      : <span className="rpl-child__pl pl-na">매수 없음</span>
                                    }
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
              )}
          </div>

          {/* ── 푸터: KPI + 통계 ── */}
          <div className="rpl-footer">
            <div className="rpl-footer__pl-wrap">
              <span className={`rpl-footer__pl ${plCls(total.totalPL)}`}>{fmtPL(total.totalPL)}</span>
              <span className="rpl-footer__pl-label">총 실현손익</span>
            </div>
            <div className="rpl-footer__stats">
              <div className="rpl-footer__stat">
                <span className="rpl-footer__stat-label">매도</span>
                <span className="rpl-footer__stat-val">{totalSellCount}건</span>
              </div>
              {winRate !== null && (
                <>
                  <span className="rpl-footer__sep" />
                  <div className="rpl-footer__stat">
                    <span className="rpl-footer__stat-label">수익 종목</span>
                    <span className="rpl-footer__stat-val">{winningStocks}/{totalStocksWithData}</span>
                  </div>
                  <span className="rpl-footer__sep" />
                  <div className="rpl-footer__stat">
                    <span className="rpl-footer__stat-label">승률</span>
                    <span className={`rpl-footer__stat-val${winRate >= 50 ? ' rpl-footer__stat-val--pos' : ' rpl-footer__stat-val--neg'}`}>
                      {winRate}%
                    </span>
                  </div>
                </>
              )}
              {total.hasIncompleteData && (
                <span className="rpl-kpi__warn" style={{ marginLeft: 'auto' }}>⚠ 일부 누락</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
