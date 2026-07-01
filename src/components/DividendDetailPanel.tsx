'use client';
import { useMemo, useState } from 'react';
import type { Entry, Market } from '@/lib/types';
import { calcDivByDate, calcDivByStock } from '@/lib/calculations';
import { formatUsd } from '@/lib/utils';

type Tab = 'date' | 'stock';
type Dir = 'asc' | 'desc';

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

interface Props {
  entries: Entry[];
  market: Market;
  year?: string;
}

export function DividendDetailPanel({ entries, market, year }: Props) {
  const [tab,       setTab]       = useState<Tab>('date');
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set());
  const [dateSort,  setDateSort]  = useState<{ col: 'date'  | 'div'; dir: Dir }>({ col: 'date',  dir: 'desc' });
  const [stockSort, setStockSort] = useState<{ col: 'stock' | 'div'; dir: Dir }>({ col: 'div',   dir: 'desc' });

  const byDate  = useMemo(() => calcDivByDate(entries, year),  [entries, year]);
  const byStock = useMemo(() => calcDivByStock(entries, year), [entries, year]);

  const sortedByDate = [...byDate].sort((a, b) => {
    const mul = dateSort.dir === 'asc' ? 1 : -1;
    if (dateSort.col === 'date') return a.date < b.date ? -mul : a.date > b.date ? mul : 0;
    return (a.total - b.total) * mul;
  });
  const sortedByStock = [...byStock].sort((a, b) => {
    const mul = stockSort.dir === 'asc' ? 1 : -1;
    if (stockSort.col === 'stock') return a.stock.localeCompare(b.stock, 'ko') * mul;
    return (a.total - b.total) * mul;
  });

  function toggleDateSort(col: 'date' | 'div') {
    setDateSort((p) => p.col === col ? { col, dir: p.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' });
    setExpanded(new Set());
  }
  function toggleStockSort(col: 'stock' | 'div') {
    setStockSort((p) => p.col === col ? { col, dir: p.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' });
    setExpanded(new Set());
  }
  function toggle(key: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  function fmtAmt(n: number) {
    return market === 'domestic'
      ? `+₩${Math.round(n).toLocaleString('ko-KR')}`
      : `+$${formatUsd(n)}`;
  }

  const hasDivs = byDate.length > 0;

  return (
    <div className="apl-panel apl-panel--dividend">
      <div className="apl-header">
        <span className="apl-title">배당수익 내역</span>
        {byDate.length > 0 && (
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
        )}
      </div>

      {!hasDivs ? (
        <div className="panel-empty">배당 내역이 없습니다.</div>
      ) : (
        <div className="rpl-list-col">
          {tab === 'date' ? (
            <>
              <div className="rpl-col-header">
                <button className={`rpl-col-btn${dateSort.col === 'date' ? ' active' : ''}`} onClick={() => toggleDateSort('date')}>
                  일자 <SortIcon active={dateSort.col === 'date'} dir={dateSort.dir} />
                </button>
                <button className={`rpl-col-btn rpl-col-btn--right${dateSort.col === 'div' ? ' active' : ''}`} onClick={() => toggleDateSort('div')}>
                  배당금 <SortIcon active={dateSort.col === 'div'} dir={dateSort.dir} />
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
                      <span className="rpl-parent__pl pl-div">{fmtAmt(row.total)}</span>
                      <ChevronIcon open={open} />
                    </button>
                    {open && (
                      <div className="rpl-children">
                        {row.details.map((d, i) => (
                          <div key={`${d.stock}-${i}`} className="rpl-child">
                            <span className="rpl-child__key">{d.stock}</span>
                            <span className="rpl-child__pl-wrap">
                              <span className="rpl-child__pl pl-div">{fmtAmt(d.amount)}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div className="rpl-col-header">
                <button className={`rpl-col-btn${stockSort.col === 'stock' ? ' active' : ''}`} onClick={() => toggleStockSort('stock')}>
                  종목 <SortIcon active={stockSort.col === 'stock'} dir={stockSort.dir} />
                </button>
                <button className={`rpl-col-btn rpl-col-btn--right${stockSort.col === 'div' ? ' active' : ''}`} onClick={() => toggleStockSort('div')}>
                  배당금 <SortIcon active={stockSort.col === 'div'} dir={stockSort.dir} />
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
                      <span className="rpl-parent__pl pl-div">{fmtAmt(row.total)}</span>
                      <ChevronIcon open={open} />
                    </button>
                    {open && (
                      <div className="rpl-children">
                        {row.details.map((d, i) => (
                          <div key={`${d.date}-${i}`} className="rpl-child">
                            <span className="rpl-child__key rpl-child__key--date">{d.date}</span>
                            <span className="rpl-child__pl-wrap">
                              <span className="rpl-child__pl pl-div">{fmtAmt(d.amount)}</span>
                            </span>
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
      )}
    </div>
  );
}
