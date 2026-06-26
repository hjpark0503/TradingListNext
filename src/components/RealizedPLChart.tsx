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
  type Plugin,
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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
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

// 분산이 큰 데이터에서 단일 이상치가 Y축 스케일을 장악하는 것을 방지.
// 정상 막대들이 보이도록 견고한 상한(cap)을 계산한다. 이상치가 없으면 null.
function robustCap(values: number[]): number | null {
  const v = values.map((x) => Math.abs(x)).filter((x) => x > 0).sort((a, b) => a - b);
  if (v.length < 3) return null;
  const median = v[Math.floor((v.length - 1) / 2)]; // 작은쪽 중앙값(이상치에 안정적)
  const fence = median * 5;                          // 중앙값의 5배 초과 = 이상치 후보
  const maxV = v[v.length - 1];
  if (maxV <= fence) return null;                    // 지배적 이상치 없음 → 일반 스케일
  if (maxV <= v[v.length - 2] * 2.5) return null;    // 2위와 비슷하면(다중 큰값) 클램프 안 함
  const within = v.filter((x) => x <= fence);
  const top = within.length ? within[within.length - 1] : median;
  return top * 1.2;                                  // 정상 최댓값에 약간의 여유
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

  // ── 이상치 스케일 보정 ──
  // 현재/직전 연도의 0이 아닌 월 손익을 모아 견고한 상한(cap)을 산출.
  // cap 초과 막대는 높이만 cap으로 잘리고, 라벨·툴팁은 실제 값을 표시한다.
  const cap = useMemo(() => {
    const vals = monthData.filter((m) => m.hasData).map((m) => m.pl);
    if (hasCompare && compareData) vals.push(...compareData.filter((m) => m.hasData).map((m) => m.pl));
    return robustCap(vals.filter((v) => v !== 0));
  }, [monthData, compareData, hasCompare]);
  const hasNeg = monthData.some((m) => m.hasData && m.pl < 0)
    || (!!compareData && compareData.some((m) => m.hasData && m.pl < 0));
  const clampV = (v: number) => (cap == null ? v : Math.max(-cap, Math.min(cap, v)));

  // ── 차트 색상 ──
  const PROFIT_COLOR = '#F04452';
  const LOSS_COLOR   = isDark ? '#4D94FF' : '#246CF9';
  const COMPARE_COLOR = isDark ? '#8B95A1' : '#B0B8C1';
  const textColor    = isDark ? '#A8B3C1' : '#4E5968';
  const gridColor    = isDark ? 'rgba(42,47,62,0.8)' : 'rgba(229,232,235,0.8)';
  const zeroColor    = isDark ? '#6B7686' : '#AEB6C0'; // 0원 기준선(다른 격자선보다 진하게)


  // 데이터(현재/직전 연도)가 있는 달만 카테고리로 사용 → 빈 달 없이 균등 간격 배치
  const activeIdx = monthData
    .map((_, i) => i)
    .filter((i) => monthData[i].hasData || compareData?.[i]?.hasData);
  const curData = activeIdx.map((i) => monthData[i]);
  const cmpData = compareData ? activeIdx.map((i) => compareData[i]) : null;
  const labels  = activeIdx.map((i) => MONTH_LABELS[i]);

  const chartData = {
    labels,
    datasets: [
      // 현재 연도 (색상: 수익 빨강 / 손실 파랑) — 박스 라벨 플러그인이 dataset 0 기준
      {
        label: currentYear,
        data: curData.map((m) => clampV(m.pl)),
        backgroundColor: curData.map((m) => (m.pl >= 0 ? PROFIT_COLOR : LOSS_COLOR)),
        borderRadius: 4,
        borderSkipped: false as const,
        maxBarThickness: 40,
        barPercentage: 0.7,
        categoryPercentage: 0.75,
        order: 1,
      },
      // 직전 연도 (회색) — '전체' 모드에서만
      ...(hasCompare && cmpData
        ? [{
            label: compareYear as string,
            data: cmpData.map((m) => clampV(m.pl)),
            backgroundColor: COMPARE_COLOR,
            borderRadius: 4,
            borderSkipped: false as const,
            maxBarThickness: 40,
            barPercentage: 0.7,
            categoryPercentage: 0.75,
            order: 2,
          }]
        : []),
    ],
  };

  function fmtAxis(n: number) {
    const abs  = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    // 인접 눈금이 같은 라벨로 반올림돼 중복 표시되는 것을 막기 위해
    // 단위 환산값이 10 미만이면 소수 한 자리까지 표시(예: 1.0K, 1.4K)
    const unit = (val: number, suffix: string) => {
      const s = val < 10 && val % 1 !== 0 ? val.toFixed(1) : val.toFixed(0);
      return `${sign}${suffix}`.replace('#', s);
    };
    if (market === 'domestic') {
      if (abs >= 100_000_000) return unit(abs / 100_000_000, '₩#억');
      if (abs >= 10_000)      return unit(abs / 10_000, '₩#만');
      return `${sign}₩${abs.toFixed(0)}`;
    }
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return unit(abs / 1_000, '$#K');
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
        callbacks: {
          label: (item: TooltipItem<'bar'>) => {
            // 막대 높이는 cap으로 잘릴 수 있으므로 툴팁은 실제 값을 표시
            const real = item.datasetIndex === 0
              ? curData[item.dataIndex]?.pl
              : cmpData?.[item.dataIndex]?.pl;
            return ` ${item.dataset.label}: ${fmtTooltip(real ?? (item.raw as number))}`;
          },
        },
        backgroundColor: isDark ? '#252836' : '#fff',
        titleColor:      isDark ? '#F0F4F8' : '#191F28',
        bodyColor:       isDark ? '#A8B3C1' : '#4E5968',
        borderColor:     isDark ? '#2A2F3E' : '#E5E8EB',
        borderWidth: 1, padding: 10, cornerRadius: 8,
      },
    },
    layout: { padding: { left: 4, right: 4, top: 6 } },
    scales: {
      x: {
        ticks: {
          color: textColor,
          font: { size: 11, family: 'Pretendard, sans-serif' },
        },
        grid: { display: false },
        border: { color: gridColor },
      },
      y: {
        ...(cap != null ? { max: cap, min: hasNeg ? -cap : 0 } : {}),
        afterBuildTicks(scale) {
          if (scale.ticks.length < 2) return;
          const step     = scale.ticks[1].value - scale.ticks[0].value;
          const firstVal = scale.ticks[0].value;
          // 라벨 박스 여유만큼만 위/아래로 살짝 확장 (과한 상단 공백 방지)
          const room = step * 0.5;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (scale as unknown as any).max = (cap != null ? cap : scale.ticks[scale.ticks.length - 1].value) + room;
          if (firstVal < 0 || (cap != null && hasNeg)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (scale as unknown as any).min = (cap != null ? -cap : firstVal) - room;
          }
        },
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

  // ── 막대 위 실현손익 박스 라벨 (투자 성과 추이 박스 스타일 참고) ──
  function fmtBarLabel(n: number) {
    const abs  = Math.abs(n);
    const sign = n < 0 ? '−' : '+';
    if (market === 'domestic') {
      if (abs >= 100_000_000) return `${sign}₩${(abs / 100_000_000).toFixed(1)}억`;
      if (abs >= 10_000)      return `${sign}₩${(abs / 10_000).toFixed(0)}만`;
      return `${sign}₩${abs.toFixed(0)}`;
    }
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }

  // ── 0원 기준선을 다른 격자선보다 진하게 ──
  const zeroLinePlugin: Plugin<'bar'> = {
    id: 'zeroLine',
    beforeDatasetsDraw(chart) {
      const y = chart.scales.y;
      if (!y || y.min > 0 || y.max < 0) return;
      const py = Math.round(y.getPixelForValue(0)) + 0.5; // 또렷한 1px 라인
      const { left, right } = chart.chartArea;
      const { ctx } = chart;
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = zeroColor;
      ctx.lineWidth = 1.5;
      ctx.moveTo(left, py);
      ctx.lineTo(right, py);
      ctx.stroke();
      ctx.restore();
    },
  };

  const barLabelPlugin: Plugin<'bar'> = {
    id: 'barPLLabel',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;

      const fSize = 10;
      const padX  = 6;
      const padY  = 3;
      const bh    = fSize + padY * 2;
      const GAP   = 6;
      const surfaceBg = isDark ? '#252836' : '#fff';

      // 데이터셋별 라벨 스펙: 0=현재 연도(수익/손실 색), 1=직전 연도(회색)
      // 데이터는 활성 달(activeIdx) 기준으로 재정렬된 배열을 사용
      const specs: { dsIdx: number; data: MonthData[]; colorFor: (v: number) => string }[] = [
        { dsIdx: 0, data: curData, colorFor: (v) => (v >= 0 ? PROFIT_COLOR : LOSS_COLOR) },
      ];
      if (hasCompare && cmpData) {
        specs.push({ dsIdx: 1, data: cmpData, colorFor: () => COMPARE_COLOR });
      }

      ctx.save();
      ctx.font = `700 ${fSize}px Pretendard, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 1) 라벨 박스 후보 수집 (실제 값 기준 라벨, 막대 기하는 화면 좌표)
      interface LabelItem {
        bx: number; by: number; bw: number;
        barX: number; barY: number; barW: number;
        color: string; label: string; up: boolean; clipped: boolean;
      }
      const items: LabelItem[] = [];
      for (const spec of specs) {
        const meta = chart.getDatasetMeta(spec.dsIdx);
        if (!meta?.data?.length) continue;
        meta.data.forEach((el, i) => {
          const m = spec.data[i];
          if (!m || !m.hasData || m.pl === 0) return;
          const v     = m.pl;
          const up    = v >= 0;
          const label = fmtBarLabel(v);
          const bw    = ctx.measureText(label).width + padX * 2;
          const bar   = el as unknown as { x: number; y: number; width: number };
          let by = up ? bar.y - GAP - bh : bar.y + GAP;
          by = Math.max(chartArea.top + 2, Math.min(by, chartArea.bottom - bh - 2));
          let bx = bar.x - bw / 2;
          bx = Math.max(chartArea.left, Math.min(bx, chartArea.right - bw));
          items.push({
            bx, by, bw, barX: bar.x, barY: bar.y, barW: bar.width ?? 20,
            color: spec.colorFor(v), label, up,
            clipped: cap != null && Math.abs(v) > cap + 0.5,
          });
        });
      }

      // 2) 충돌 회피: 좌→우로 배치하며 겹치면 0선에서 멀어지는 방향으로 세로 적재
      const overlap = (a: LabelItem, b: LabelItem) =>
        !(a.bx + a.bw < b.bx - 2 || a.bx > b.bx + b.bw + 2 ||
          a.by + bh < b.by - 2 || a.by > b.by + bh + 2);
      const placed: LabelItem[] = [];
      items.sort((a, b) => a.barX - b.barX);
      for (const it of items) {
        for (let guard = 0; guard < 8 && placed.some((p) => overlap(it, p)); guard++) {
          it.by += it.up ? -(bh + 3) : (bh + 3);
        }
        it.by = Math.max(chartArea.top + 2, Math.min(it.by, chartArea.bottom - bh - 2));
        placed.push(it);
      }

      // 3) 그리기: 커넥터 → 절단 표시 → 박스 → 텍스트
      for (const it of placed) {
        // 막대-박스 점선 커넥터
        ctx.beginPath();
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = it.color;
        ctx.lineWidth   = 1;
        ctx.moveTo(it.barX, it.barY);
        ctx.lineTo(it.barX, it.up ? it.by + bh : it.by);
        ctx.stroke();
        ctx.setLineDash([]);

        // cap으로 잘린 막대: 끝에 절단(break) 표시 — 물결 2줄(≈)
        if (it.clipped) {
          const halfW = Math.min(it.barW, 26) / 2;
          const x0 = it.barX - halfW;
          const width = halfW * 2;
          const amp = 1.4;        // 물결 진폭
          const gap = 2.4;        // 두 물결 사이 간격
          const yMid = it.barY + (it.up ? 5 : -5);
          // 막대를 가로질러 흰 띠로 끊긴 느낌 부여
          ctx.fillStyle = surfaceBg;
          ctx.fillRect(x0 - 1, yMid - gap - amp - 1, width + 2, (gap + amp + 1) * 2);
          // 평행한 물결선 2줄
          ctx.strokeStyle = it.color;
          ctx.lineWidth = 1.3;
          for (const baseY of [yMid - gap, yMid + gap]) {
            ctx.beginPath();
            const steps = 12;
            for (let k = 0; k <= steps; k++) {
              const px = x0 + (width * k) / steps;
              const py = baseY + amp * Math.sin((k / steps) * Math.PI * 2);
              if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();
          }
        }

        // 박스
        ctx.fillStyle   = surfaceBg;
        ctx.strokeStyle = it.color;
        ctx.lineWidth   = 1.2;
        roundRect(ctx, it.bx, it.by, it.bw, bh, 4);
        ctx.fill();
        ctx.stroke();

        // 텍스트
        ctx.fillStyle = it.color;
        ctx.fillText(it.label, it.bx + it.bw / 2, it.by + bh / 2 + 0.5);
      }

      ctx.restore();
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
        {showChart && (
          <div className="apl-year-legend">
            <span className="apl-year-legend__item">
              <span className="apl-year-legend__dot" style={{ background: PROFIT_COLOR }} />
              {currentYear}
            </span>
            {hasCompare && (
              <span className="apl-year-legend__item apl-year-legend__item--muted">
                <span className="apl-year-legend__dot" style={{ background: COMPARE_COLOR }} />
                {compareYear}
              </span>
            )}
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
              <Bar data={chartData} options={chartOptions} plugins={[zeroLinePlugin, barLabelPlugin]} />
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
