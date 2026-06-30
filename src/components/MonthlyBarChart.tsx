'use client';
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
import type { Market } from '@/lib/types';
import { fmtUsd, fmtKrw } from '@/lib/utils';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

export interface MonthData {
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

interface Props {
  title: string;
  monthData: MonthData[];              // 현재 연도 12개월
  compareData: MonthData[] | null;     // 직전 연도 12개월(없으면 null)
  currentLabel: string;                // 범례용 현재 연도
  compareLabel: string | null;         // 범례용 직전 연도
  market: Market;
  isDark: boolean;
  emptyText: string;
  // 'pl' = 수익 빨강/손실 파랑, 'income' = 단일색(배당 등)
  colorMode?: 'pl' | 'income';
  incomeColor?: string;
  bare?: boolean;        // true이면 apl-panel/apl-header 없이 차트 영역만 렌더
  showAllMonths?: boolean; // true이면 데이터 유무에 상관없이 1~12월 모두 표시
}

export function MonthlyBarChart({
  title, monthData, compareData, currentLabel, compareLabel,
  market, isDark, emptyText, colorMode = 'pl', incomeColor = '#F97316',
  bare = false, showAllMonths = false,
}: Props) {
  const hasCompare = !!compareData && compareData.some((m) => m.hasData);

  // ── 차트 색상 ──
  const PROFIT_COLOR = '#F04452';
  const LOSS_COLOR   = isDark ? '#4D94FF' : '#246CF9';
  const COMPARE_COLOR = isDark ? '#8B95A1' : '#B0B8C1';
  const textColor    = isDark ? '#A8B3C1' : '#4E5968';
  const gridColor    = isDark ? 'rgba(42,47,62,0.8)' : 'rgba(229,232,235,0.8)';
  const zeroColor    = isDark ? '#6B7686' : '#AEB6C0';
  const barColorFor = (v: number) => (colorMode === 'income' ? incomeColor : (v >= 0 ? PROFIT_COLOR : LOSS_COLOR));
  const legendColor = colorMode === 'income' ? incomeColor : PROFIT_COLOR;

  // showAllMonths: 1~12월 전부 표시 / 기본: 데이터 있는 달만
  const activeIdx = showAllMonths
    ? Array.from({ length: 12 }, (_, i) => i)
    : monthData.map((_, i) => i).filter((i) => monthData[i].hasData || compareData?.[i]?.hasData);
  const hasAnyData = monthData.some((m) => m.hasData) || (compareData?.some((m) => m.hasData) ?? false);
  const curMonths = activeIdx.map((i) => monthData[i]);
  const cmpMonths = compareData ? activeIdx.map((i) => compareData[i]) : null;

  // ── x축 맨 오른쪽에 연 누적 막대 추가 ──
  const sumPL = (arr: MonthData[]) => arr.reduce((s, m) => s + (m.hasData ? m.pl : 0), 0);
  const cumCur: MonthData = { pl: sumPL(curMonths), buyCost: 0, hasData: curMonths.some((m) => m.hasData) };
  const cumCmp: MonthData | null = cmpMonths
    ? { pl: sumPL(cmpMonths), buyCost: 0, hasData: cmpMonths.some((m) => m.hasData) }
    : null;

  const curData = [...curMonths, cumCur];
  const cmpData = cmpMonths ? [...cmpMonths, cumCmp!] : null;
  const labels  = [...activeIdx.map((i) => MONTH_LABELS[i]), '누적'];

  // ── 스케일 보정 ──
  // cap은 "월 막대"만으로 산출(누적은 합이라 크므로 이상치 판정에서 제외).
  // 누적 막대는 cap(없으면 월 최댓값)으로 클램프해 월별 막대 가독성을 유지하고,
  // 넘치면 절단 표시 + 라벨에 실제 값을 보여준다.
  const monthlyVals = curMonths.filter((m) => m.hasData).map((m) => m.pl)
    .concat(cmpMonths ? cmpMonths.filter((m) => m.hasData).map((m) => m.pl) : []);
  const cap = robustCap(monthlyVals.filter((v) => v !== 0));
  const monthlyAbsMax = monthlyVals.reduce((mx, v) => Math.max(mx, Math.abs(v)), 0);
  const clampMax = cap != null ? cap : (monthlyAbsMax > 0 ? monthlyAbsMax : null);
  const hasNeg = curData.some((m) => m.hasData && m.pl < 0)
    || (!!cmpData && cmpData.some((m) => m.hasData && m.pl < 0));
  const clampV = (v: number) => (clampMax == null ? v : Math.max(-clampMax, Math.min(clampMax, v)));

  const chartData = {
    labels,
    datasets: [
      {
        label: currentLabel,
        data: curData.map((m) => clampV(m.pl)),
        backgroundColor: curData.map((m) => barColorFor(m.pl)),
        borderRadius: 4,
        borderSkipped: false as const,
        maxBarThickness: 40,
        barPercentage: 0.7,
        categoryPercentage: 0.75,
        order: 1,
      },
      ...(hasCompare && cmpData
        ? [{
            label: compareLabel as string,
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
    layout: { padding: { left: 4, right: 4, top: 6, bottom: 28 } },
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
        ...(clampMax != null ? { max: clampMax, min: hasNeg ? -clampMax : 0 } : {}),
        afterBuildTicks(scale) {
          if (scale.ticks.length < 2) return;
          const step     = scale.ticks[1].value - scale.ticks[0].value;
          const firstVal = scale.ticks[0].value;
          const room = step * 0.5;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (scale as unknown as any).max = (clampMax != null ? clampMax : scale.ticks[scale.ticks.length - 1].value) + room;
          if (firstVal < 0 || (clampMax != null && hasNeg)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (scale as unknown as any).min = (clampMax != null ? -clampMax : firstVal) - room;
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

  function fmtBarLabel(n: number) {
    const abs  = Math.abs(n);
    // income 모드(배당)는 항상 양수이므로 + 기호 생략
    const sign = n < 0 ? '−' : (colorMode === 'income' ? '' : '+');
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
      const py = Math.round(y.getPixelForValue(0)) + 0.5;
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

  // ── 누적 막대 왼쪽 세로 점선 구분선 ──
  const cumDividerPlugin: Plugin<'bar'> = {
    id: 'cumDivider',
    beforeDatasetsDraw(chart) {
      const x = chart.scales.x;
      const n = labels.length;
      if (!x || n < 2) return;
      const px = Math.round((x.getPixelForValue(n - 2) + x.getPixelForValue(n - 1)) / 2) + 0.5;
      const { top, bottom } = chart.chartArea;
      const { ctx } = chart;
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = isDark ? 'rgba(168,179,193,0.45)' : 'rgba(120,130,145,0.4)';
      ctx.lineWidth = 1;
      ctx.moveTo(px, top);
      ctx.lineTo(px, bottom);
      ctx.stroke();
      ctx.restore();
    },
  };

  // ── 막대 위/아래 값 박스 라벨 ──
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

      // 현재 연도만 값 박스 라벨 표시 (직전 연도 회색 막대는 라벨 생략)
      const specs: { dsIdx: number; data: MonthData[]; colorFor: (v: number) => string }[] = [
        { dsIdx: 0, data: curData, colorFor: barColorFor },
      ];

      ctx.save();
      ctx.font = `700 ${fSize}px Pretendard, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      interface LabelItem {
        bx: number; by: number; bw: number;
        barX: number; barY: number;
        color: string; label: string; up: boolean;
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
          const bar   = el as unknown as { x: number; y: number };
          let by = up ? bar.y - GAP - bh : bar.y + GAP;
          by = Math.max(chartArea.top + 2, Math.min(by, chartArea.bottom - bh - 2));
          let bx = bar.x - bw / 2;
          bx = Math.max(chartArea.left, Math.min(bx, chartArea.right - bw));
          items.push({
            bx, by, bw, barX: bar.x, barY: bar.y,
            color: spec.colorFor(v), label, up,
          });
        });
      }

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

      for (const it of placed) {
        ctx.beginPath();
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = it.color;
        ctx.lineWidth   = 1;
        ctx.moveTo(it.barX, it.barY);
        ctx.lineTo(it.barX, it.up ? it.by + bh : it.by);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle   = surfaceBg;
        ctx.strokeStyle = it.color;
        ctx.lineWidth   = 1.2;
        roundRect(ctx, it.bx, it.by, it.bw, bh, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = it.color;
        ctx.fillText(it.label, it.bx + it.bw / 2, it.by + bh / 2 + 0.5);
      }

      ctx.restore();
    },
  };

  // ── 범례 (x축 아래 중앙) ──
  const legendItems: { label: string; color: string }[] = [
    { label: `${currentLabel}년`, color: legendColor },
    ...(hasCompare && compareLabel ? [{ label: `${compareLabel}년`, color: COMPARE_COLOR }] : []),
  ];
  const legendPlugin: Plugin<'bar'> = {
    id: 'barLegend',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const legFSize = 10;
      const dotSize  = 8;
      const dotGap   = 5;
      const itemGap  = 16;

      ctx.save();
      ctx.font = `600 ${legFSize}px Pretendard, sans-serif`;
      ctx.textBaseline = 'middle';

      const totalW = legendItems.reduce((s, it, i) =>
        s + dotSize + dotGap + ctx.measureText(it.label).width + (i < legendItems.length - 1 ? itemGap : 0), 0);

      let lx = (chart.width - totalW) / 2;
      const ly = chart.height - 10;

      for (const { label, color } of legendItems) {
        ctx.fillStyle = color;
        roundRect(ctx, lx, ly - dotSize / 2, dotSize, dotSize, 2);
        ctx.fill();
        lx += dotSize + dotGap;

        ctx.fillStyle = isDark ? '#A8B3C1' : '#6B7684';
        ctx.fillText(label, lx, ly);
        lx += ctx.measureText(label).width + itemGap;
      }

      ctx.restore();
    },
  };

  if (bare) {
    return !hasAnyData ? (
      <div className="panel-empty">{emptyText}</div>
    ) : (
      <div className="apl-chart-wrap">
        <Bar data={chartData} options={chartOptions} plugins={[zeroLinePlugin, cumDividerPlugin, barLabelPlugin, legendPlugin]} />
      </div>
    );
  }

  return (
    <div className="apl-panel">
      <div className="apl-header">
        <span className="apl-title">{title}</span>
        <div className="apl-year-legend">
          <span className="apl-year-legend__item">
            <span className="apl-year-legend__dot" style={{ background: legendColor }} />
            {currentLabel}
          </span>
          {hasCompare && compareLabel && (
            <span className="apl-year-legend__item apl-year-legend__item--muted">
              <span className="apl-year-legend__dot" style={{ background: COMPARE_COLOR }} />
              {compareLabel}
            </span>
          )}
        </div>
      </div>

      {activeIdx.length === 0 ? (
        <div className="panel-empty">{emptyText}</div>
      ) : (
        <div className="apl-chart-wrap">
          <Bar data={chartData} options={chartOptions} plugins={[zeroLinePlugin, cumDividerPlugin, barLabelPlugin, legendPlugin]} />
        </div>
      )}
    </div>
  );
}
