'use client';
import { useMemo, useState } from 'react';
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
import { Entry, Market } from '@/lib/types';
import {
  calcPLByDate,
  calcPLByStock,
  calcRealizedPL,
} from '@/lib/calculations';
import { formatUsd, fmtKrw } from '@/lib/utils';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

type Tab = 'date' | 'stock';
type Dir = 'asc' | 'desc';

interface Props {
  entries: Entry[];
  market: Market;
  isDark?: boolean;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'date',  label: '일자별' },
  { id: 'stock', label: '종목별' },
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dateSort,  setDateSort]  = useState<{ col: 'date'  | 'pl'; dir: Dir }>({ col: 'date',  dir: 'desc' });
  const [stockSort, setStockSort] = useState<{ col: 'stock' | 'pl'; dir: Dir }>({ col: 'pl',    dir: 'desc' });

  const byDate  = useMemo(() => calcPLByDate(entries),  [entries]);
  const byStock = useMemo(() => calcPLByStock(entries), [entries]);
  const total   = calcRealizedPL(entries);

  // 통계
  const winningStocks       = byStock.filter((r) => !r.hasIncompleteData && r.totalPL > 0).length;
  const totalStocksWithData = byStock.filter((r) => !r.hasIncompleteData).length;
  const winRate             = totalStocksWithData > 0 ? Math.round((winningStocks / totalStocksWithData) * 100) : null;
  const totalSellCount      = byDate.reduce((s, r) => s + r.details.length, 0);

  const chartRows = useMemo(() => {
    if (tab === 'date')
      return [...byDate].reverse().map((r) => ({ label: r.date, pl: r.totalPL, hasIncompleteData: r.hasIncompleteData }));
    return byStock.map((r) => ({ label: r.stock, pl: r.totalPL, hasIncompleteData: r.hasIncompleteData }));
  }, [tab, byDate, byStock]);

  function chartLabel(label: string) {
    if (tab === 'date') return label.slice(5);
    return label;
  }

  const chartValues = chartRows.map((r) => r.pl);

  const GAIN      = isDark ? '#4D94FF' : '#246CF9';
  const LOSS      = '#F04452';
  const textColor = isDark ? '#A8B3C1' : '#6B7684';
  const gridColor = isDark ? 'rgba(42,47,62,.7)' : 'rgba(229,232,235,.8)';

  function fmtAxisKrw(n: number) {
    const abs = Math.abs(n), sign = n < 0 ? '-' : '';
    if (abs >= 100_000_000) return `${sign}₩${(abs / 100_000_000).toFixed(0)}억`;
    if (abs >= 10_000)      return `${sign}₩${(abs / 10_000).toFixed(0)}만`;
    return `${sign}₩${abs.toFixed(0)}`;
  }
  function fmtAxisUsd(n: number) {
    const abs = Math.abs(n), sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }
  function fmtTooltip(v: number) {
    const abs = Math.abs(v), prefix = v >= 0 ? '+' : '−';
    if (market === 'domestic') return prefix + fmtKrw(abs).replace(/^-?₩/, '₩');
    const f = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${prefix}$${f}`;
  }

  const chartData = {
    labels: chartRows.map((r) => chartLabel(r.label)),
    datasets: [{
      label: '실현손익',
      data: chartValues,
      backgroundColor: chartValues.map((v) => v >= 0 ? LOSS : GAIN),
      borderRadius: 6,
      borderSkipped: false as const,
      maxBarThickness: 28,
      barPercentage: 0.5,
      categoryPercentage: 0.6,
    }],
  };

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
    layout: { padding: { left: 4, bottom: 2 } },
    scales: {
      x: {
        ticks: { color: textColor, font: { size: 11, family: 'Pretendard, sans-serif' }, maxRotation: 45 },
        grid: { display: false },
        border: { color: gridColor },
      },
      y: {
        ticks: {
          color: textColor,
          font: { size: 11, family: 'Pretendard, sans-serif' },
          callback: (v) => market === 'domestic' ? fmtAxisKrw(Number(v)) : fmtAxisUsd(Number(v)),
          maxTicksLimit: 5,
        },
        grid: { color: gridColor },
        border: { color: 'transparent' },
      },
    },
  };

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

      {!hasSells ? (
        <div className="panel-empty">매도 내역이 없습니다.</div>
      ) : (
        <>
          {/* ── 2열: 차트(좌) + 리스트(우) ── */}
          <div className="rpl-content">

            {/* 차트 열 */}
            <div className="rpl-chart-col">
              {chartValues.length > 0
                ? <div className="rpl-chart-canvas-wrap">
                    <Bar data={chartData} options={chartOptions} />
                  </div>
                : <div className="rpl-chart-empty">해당 연도 데이터 없음</div>
              }
            </div>

            {/* 리스트 열 */}
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
