'use client';
import { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  type TooltipItem,
  type ChartOptions,
} from 'chart.js';
import type { Entry, Market } from '@/lib/types';
import { calcPLByDate, calcPLByStock, calcRealizedPL } from '@/lib/calculations';
import { formatUsd, fmtUsd, fmtKrw } from '@/lib/utils';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

type Tab = 'date' | 'stock';
type Dir = 'asc' | 'desc';

const TABS: { id: Tab; label: string }[] = [
  { id: 'date',  label: '일자' },
  { id: 'stock', label: '종목' },
];

interface MonthData {
  pl: number;
  buyCost: number;
  hasData: boolean;
}

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

  const [selectedYear, setSelectedYear] = useState<string>(
    () => years[0] ?? String(new Date().getFullYear())
  );
  const currentYear = externalYear ?? (years.includes(selectedYear) ? selectedYear : (years[0] ?? selectedYear));

  const showChart = view === 'chart' || view === 'all';
  const showList  = view === 'list'  || view === 'all';

  useEffect(() => {
    if (view === 'chart') onYearChange?.(currentYear);
  }, [currentYear, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthData = useMemo(() => calcMonthlyData(entries, currentYear), [entries, currentYear]);

  // ── 차트 색상 ──
  const PROFIT_COLOR = '#F04452';
  const LOSS_COLOR   = isDark ? '#4D94FF' : '#246CF9';
  const textColor    = isDark ? '#A8B3C1' : '#4E5968';
  const gridColor    = isDark ? 'rgba(42,47,62,0.8)' : 'rgba(229,232,235,0.8)';


  const values   = monthData.map((m) => m.pl);
  const chartData = {
    labels: MONTH_LABELS,
    datasets: [{
      label: '실현손익',
      data: values,
      backgroundColor: values.map((v) => (v >= 0 ? PROFIT_COLOR : LOSS_COLOR)),
      borderRadius: 4,
      borderSkipped: false as const,
      maxBarThickness: 40,
      barPercentage: 0.7,
      categoryPercentage: 0.75,
    }],
  };

  function fmtAxis(n: number) {
    const abs  = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (market === 'domestic') {
      if (abs >= 100_000_000) return `${sign}₩${(abs / 100_000_000).toFixed(0)}억`;
      if (abs >= 10_000)      return `${sign}₩${(abs / 10_000).toFixed(0)}만`;
      return `${sign}₩${abs.toFixed(0)}`;
    }
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }

  function fmtTooltip(v: number) {
    const abs    = Math.abs(v);
    const prefix = v >= 0 ? '+' : '−';
    return prefix + (market === 'domestic' ? fmtKrw(abs) : `$${fmtUsd(abs).replace(/^-?\$/, '')}`);
  }

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (item: TooltipItem<'bar'>) => ' ' + fmtTooltip(item.raw as number) },
        backgroundColor: isDark ? '#252836' : '#fff',
        titleColor:      isDark ? '#F0F4F8' : '#191F28',
        bodyColor:       isDark ? '#A8B3C1' : '#4E5968',
        borderColor:     isDark ? '#2A2F3E' : '#E5E8EB',
        borderWidth: 1, padding: 10, cornerRadius: 8,
      },
    },
    layout: { padding: { left: 4, right: 4 } },
    scales: {
      x: {
        ticks: { color: textColor, font: { size: 11, family: 'Pretendard, sans-serif' } },
        grid: { display: false },
        border: { color: gridColor },
      },
      y: {
        ticks: {
          color: textColor,
          font: { size: 11, family: 'Pretendard, sans-serif' },
          callback: (v) => fmtAxis(Number(v)),
          maxTicksLimit: 5,
        },
        grid: { color: gridColor },
        border: { color: 'transparent' },
      },
    },
  };

  // ── 실현손익 내역 ──
  const [tab,        setTab]        = useState<Tab>('date');
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());
  const [dateSort,   setDateSort]   = useState<{ col: 'date' | 'pl'; dir: Dir }>({ col: 'date', dir: 'desc' });
  const [stockSort,  setStockSort]  = useState<{ col: 'stock' | 'pl'; dir: Dir }>({ col: 'pl', dir: 'desc' });

  // 선택 연도의 매도만 포함 (매수는 평균단가 계산을 위해 전체 유지)
  const yearEntries = useMemo(
    () => entries.filter((e) => e.type !== 'sell' || e.date.startsWith(currentYear)),
    [entries, currentYear]
  );

  const byDate  = useMemo(() => calcPLByDate(yearEntries),   [yearEntries]);
  const byStock = useMemo(() => calcPLByStock(yearEntries),  [yearEntries]);
  const total   = useMemo(() => calcRealizedPL(yearEntries), [yearEntries]);

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
    <div className="apl-panel">
      {/* ── 헤더: 연도 탭 ── */}
      <div className="apl-header">
        <span className="apl-title">{view === 'list' ? '상세 실현손익' : '월별 실현손익'}</span>
        {showList && years.length > 0 && (
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
        {!externalYear && showChart && (
          <div className="apl-year-tabs">
            {years.map((y) => (
              <button
                key={y}
                className={`apl-year-btn${currentYear === y ? ' active' : ''}`}
                onClick={() => setSelectedYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </div>

      {years.length === 0 ? (
        <div className="panel-empty">매도 내역이 없습니다.</div>
      ) : (
        <>
          {/* ── 막대 차트 ── */}
          {showChart && (
            <div className="apl-chart-wrap">
              <Bar data={chartData} options={chartOptions} />
            </div>
          )}

          {/* ── 내역 리스트 ── */}
          {showList && (!hasSells ? (
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

              {/* ── 푸터 ── */}
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
          ))}
        </>
      )}
    </div>
  );
}
