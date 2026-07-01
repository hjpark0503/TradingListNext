'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Entry, Market } from '@/lib/types';
import { calcPLByDate, calcPLByStock } from '@/lib/calculations';
import { formatUsd } from '@/lib/utils';
import { MonthlyBarChart, type MonthData } from './MonthlyBarChart';

type Tab = 'date' | 'stock';
type Dir = 'asc' | 'desc';

const TABS: { id: Tab; label: string }[] = [
  { id: 'date',  label: '일자' },
  { id: 'stock', label: '종목' },
];

function calcMonthlyData(entries: Entry[], year: string): MonthData[] {
  const byDate = calcPLByDate(entries);
  const months: MonthData[] = Array.from({ length: 12 }, () => ({ pl: 0, buyCost: 0, hasData: false }));
  for (const row of byDate) {
    if (!row.date.startsWith(year)) continue;
    const mi = parseInt(row.date.slice(5, 7), 10) - 1;
    months[mi].hasData = true;
    months[mi].pl += row.totalPL;
    for (const d of row.details) {
      if (d.hasBuyData && d.buyCost !== null) months[mi].buyCost += d.buyCost;
    }
  }
  return months;
}

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
  isDark: boolean;
  year?: string;
  view?: 'chart' | 'list' | 'all';
  onYearChange?: (year: string) => void;
}

export function RealizedPLChart({ entries, market, isDark, year: externalYear, view = 'all', onYearChange }: Props) {
  // ── 연도 선택 ──
  const years = useMemo(
    () =>
      Array.from(
        new Set(entries.filter((e) => e.type === 'sell').map((e) => e.date.slice(0, 4)))
      ).sort((a, b) => b.localeCompare(a)),
    [entries]
  );

  const currentYear = externalYear ?? (years[0] ?? String(new Date().getFullYear()));

  const showChart = view === 'chart' || view === 'all';
  const showList  = view === 'list'  || view === 'all';

  useEffect(() => {
    if (view === 'chart') onYearChange?.(currentYear);
  }, [currentYear, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthData = useMemo(() => calcMonthlyData(entries, currentYear), [entries, currentYear]);

  // ── '전체' 모드(특정 연도 미선택)에서는 직전년도 막대를 회색으로 함께 표시 ──
  const compareYear = !externalYear && showChart ? String(Number(currentYear) - 1) : null;
  const compareData = useMemo(
    () => (compareYear ? calcMonthlyData(entries, compareYear) : null),
    [entries, compareYear]
  );
  const hasCompare = !!compareData && compareData.some((m) => m.hasData);

  // ── 실현손익 내역 ──
  const [tab,        setTab]        = useState<Tab>('date');
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());
  const [dateSort,   setDateSort]   = useState<{ col: 'date' | 'pl'; dir: Dir }>({ col: 'date', dir: 'desc' });
  const [stockSort,  setStockSort]  = useState<{ col: 'stock' | 'pl'; dir: Dir }>({ col: 'pl', dir: 'desc' });

  // 원가(이동평균)는 전체 이력으로 계산하고, 표시는 선택 연도 매도만 거른다.
  const byDate  = useMemo(() => calcPLByDate(entries, currentYear),   [entries, currentYear]);
  const byStock = useMemo(() => calcPLByStock(entries, currentYear),  [entries, currentYear]);

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
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  function fmtAbs(n: number) {
    const abs = Math.abs(n);
    return market === 'domestic'
      ? `₩${Math.round(abs).toLocaleString('ko-KR')}`
      : `$${formatUsd(abs)}`;
  }
  function fmtPL(n: number)  { return `${n >= 0 ? '+' : '−'}${fmtAbs(n)}`; }
  function plCls(n: number)  { return n >= 0 ? 'pl-pos' : 'pl-neg'; }
  function fmtRate(pl: number, buyCost: number) {
    if (buyCost === 0) return null;
    const r = (pl / buyCost) * 100;
    return `${r >= 0 ? '+' : ''}${r.toFixed(2)}%`;
  }

  const hasSells = byDate.length > 0;

  return (
    <>
      {/* ── 월별 실현손익 막대 차트 ── */}
      {showChart && (
        <MonthlyBarChart
          title="월별 실현손익"
          monthData={monthData}
          compareData={hasCompare ? compareData : null}
          currentLabel={currentYear}
          compareLabel={hasCompare ? compareYear : null}
          market={market}
          isDark={isDark}
          emptyText="매도 내역이 없습니다."
          colorMode="pl"
        />
      )}

      {/* ── 상세 실현손익 리스트 ── */}
      {showList && (
        <div className="apl-panel">
          <div className="apl-header">
            <span className="apl-title">상세 내역</span>
            {years.length > 0 && (
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

          {years.length === 0 || !hasSells ? (
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
            </>
          )}
        </div>
      )}
    </>
  );
}
