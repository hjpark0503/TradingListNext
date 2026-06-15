'use client';
import { useState } from 'react';
import { Entry, Market } from '@/lib/types';
import { calcPLByDate, calcPLByStock, calcRealizedPL } from '@/lib/calculations';
import { formatUsd } from '@/lib/utils';

interface Props {
  entries: Entry[];
  market: Market;
}

type Dir = 'asc' | 'desc';

function SortIcon({ active, dir }: { active: boolean; dir: Dir }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: active ? 1 : 0.3, flexShrink: 0 }}>
      {dir === 'desc' || !active
        ? <path d="M5 7L1.5 3h7L5 7z" fill="currentColor" />
        : <path d="M5 3l3.5 4h-7L5 3z" fill="currentColor" />
      }
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

export function RealizedPLPanel({ entries, market }: Props) {
  const [tab, setTab] = useState<'date' | 'stock'>('date');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dateSort, setDateSort] = useState<{ col: 'date' | 'pl'; dir: Dir }>({ col: 'date', dir: 'desc' });
  const [stockSort, setStockSort] = useState<{ col: 'stock' | 'pl'; dir: Dir }>({ col: 'pl', dir: 'desc' });

  const byDate = calcPLByDate(entries);
  const byStock = calcPLByStock(entries);
  const total = calcRealizedPL(entries);

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
    setDateSort((prev) =>
      prev.col === col
        ? { col, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { col, dir: 'desc' }
    );
    setExpanded(new Set());
  }

  function toggleStockSort(col: 'stock' | 'pl') {
    setStockSort((prev) =>
      prev.col === col
        ? { col, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { col, dir: 'desc' }
    );
    setExpanded(new Set());
  }

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function fmtAbs(n: number) {
    const abs = Math.abs(n);
    return market === 'domestic'
      ? `₩${Math.round(abs).toLocaleString('ko-KR')}`
      : `$${formatUsd(abs)}`;
  }

  function fmtPL(n: number) {
    return `${n >= 0 ? '+' : '−'}${fmtAbs(n)}`;
  }

  function plCls(n: number) {
    return n >= 0 ? 'pl-pos' : 'pl-neg';
  }

  function fmtRate(pl: number, buyCost: number) {
    if (buyCost === 0) return null;
    const r = (pl / buyCost) * 100;
    return `(${r >= 0 ? '+' : ''}${r.toFixed(2)}%)`;
  }

  return (
    <div className="rpl-panel">
      <div className="rpl-header">
        <span className="rpl-title">실현손익 내역</span>
        <div className="rpl-seg">
          {(['date', 'stock'] as const).map((t) => (
            <button
              key={t}
              className={`rpl-seg__btn${tab === t ? ' active' : ''}`}
              onClick={() => { setTab(t); setExpanded(new Set()); }}
            >
              {t === 'date' ? '일자별' : '종목별'}
            </button>
          ))}
        </div>
      </div>

      <div className="rpl-body">
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
                      <button
                        className={`rpl-parent${open ? ' open' : ''}`}
                        onClick={() => toggle(row.date)}
                      >
                        <span className="rpl-parent__left">
                          <span className="rpl-parent__key">{row.date}</span>
                          <span className="rpl-parent__sub">{row.details.length}종목</span>
                        </span>
                        {row.hasIncompleteData && row.totalPL === 0
                          ? <span className="rpl-parent__pl pl-na">⚠ 일부 누락</span>
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
                                ? (
                                  <span className="rpl-child__pl-wrap">
                                    <span className={`rpl-child__pl ${plCls(d.pl!)}`}>{fmtPL(d.pl!)}</span>
                                    {fmtRate(d.pl!, d.buyCost!) && (
                                      <span className={`rpl-rate rpl-rate--sm ${plCls(d.pl!)}`}>{fmtRate(d.pl!, d.buyCost!)}</span>
                                    )}
                                  </span>
                                )
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
                      <button
                        className={`rpl-parent${open ? ' open' : ''}`}
                        onClick={() => toggle(row.stock)}
                      >
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
                                ? (
                                  <span className="rpl-child__pl-wrap">
                                    <span className={`rpl-child__pl ${plCls(d.pl)}`}>{fmtPL(d.pl)}</span>
                                    {fmtRate(d.pl, d.buyCost!) && (
                                      <span className={`rpl-rate rpl-rate--sm ${plCls(d.pl)}`}>{fmtRate(d.pl, d.buyCost!)}</span>
                                    )}
                                  </span>
                                )
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

      {total.rows.length > 0 && (
        <div className={`rpl-footer ${total.totalPL >= 0 ? 'rpl-footer--pos' : 'rpl-footer--neg'}`}>
          <span className="rpl-footer__label">
            전체 실현손익
            {total.hasIncompleteData && <span className="rpl-footer__warn">⚠ 일부 누락</span>}
          </span>
          <span className={`rpl-footer__val ${plCls(total.totalPL)}`}>
            {fmtPL(total.totalPL)}
          </span>
        </div>
      )}
    </div>
  );
}
