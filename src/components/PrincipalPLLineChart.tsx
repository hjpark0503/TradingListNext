'use client';
import { useMemo, useState, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
  type TooltipItem,
  type ChartOptions,
  type Plugin,
} from 'chart.js';
import type { Entry, Market } from '@/lib/types';
import { calcPrincipalAndPLOverTime, type PrincipalPLPoint } from '@/lib/calculations';
import { fmtUsd, fmtKrw } from '@/lib/utils';

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler);

type ViewMode = 'monthly' | 'daily';
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

interface LastFmtRef {
  evalLabel: string;
  evalColor: string;
  principalLabel: string;
  principalColor: string;
  dark: boolean;
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

function aggregateMonthly(points: PrincipalPLPoint[]): PrincipalPLPoint[] {
  const map = new Map<string, PrincipalPLPoint>();
  for (const p of points) {
    map.set(p.date.slice(0, 7), {
      date: p.date.slice(0, 7),
      principal: p.principal,
      cumulativePL: p.cumulativePL,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function filterByPeriod(points: PrincipalPLPoint[], period: Period): PrincipalPLPoint[] {
  if (period === 'all' || points.length === 0) return points;
  const lastDate = points[points.length - 1].date;
  const end = new Date(lastDate);
  const start = new Date(end);
  if (period === '3M') start.setMonth(start.getMonth() - 3);
  else if (period === '6M') start.setMonth(start.getMonth() - 6);
  else if (period === '1Y') start.setFullYear(start.getFullYear() - 1);
  const startStr = start.toISOString().slice(0, 10);
  return points.filter((p) => p.date >= startStr);
}

export function PrincipalPLLineChart({ entries, market, isDark = false }: Props) {
  const [view, setView]     = useState<ViewMode>('monthly');
  const [period, setPeriod] = useState<Period>('all');

  const allPoints  = useMemo(() => calcPrincipalAndPLOverTime(entries), [entries]);
  const basePoints = useMemo(
    () => (view === 'monthly' ? aggregateMonthly(allPoints) : allPoints),
    [view, allPoints]
  );
  const points = useMemo(() => filterByPeriod(basePoints, period), [basePoints, period]);

  // Ref holds the latest label info so the stable plugin can always read fresh values
  const lastFmtRef = useRef<LastFmtRef>({
    evalLabel: '', evalColor: '',
    principalLabel: '', principalColor: '',
    dark: false,
  });

  // Plugin is created once (stable ref) — reads data from lastFmtRef at draw time
  const lastValuePlugin = useMemo<Plugin<'line'>>(() => ({
    id: 'plLastValue',
    afterDraw(chart) {
      const { evalLabel, evalColor, principalLabel, principalColor: pColor, dark } = lastFmtRef.current;
      const { ctx, chartArea } = chart;
      if (!chartArea) return;

      const fSize  = 11;
      const padX   = 7;
      const padY   = 4;
      const bh     = fSize + padY * 2;
      const GAP    = 12; // 점과 라벨 사이 거리
      const BOX_GAP = 4; // 겹칠 때 두 박스 사이 간격

      ctx.font = `700 ${fSize}px Pretendard, sans-serif`;

      // 두 데이터셋의 마지막 점 수집
      const items: { dsIdx: number; label: string; color: string; x: number; y: number; bw: number; by: number }[] = [];
      for (const [dsIdx, label, color] of [
        [0, principalLabel, pColor],
        [1, evalLabel, evalColor],
      ] as [number, string, string][]) {
        if (!label) continue;
        const meta = chart.getDatasetMeta(dsIdx);
        if (!meta.data.length) continue;
        const el = meta.data[meta.data.length - 1] as unknown as { x: number; y: number };
        const bw = ctx.measureText(label).width + padX * 2;
        items.push({ dsIdx, label, color, x: el.x, y: el.y, bw, by: 0 });
      }

      // 기본 위치: 각 점에서 GAP만큼 위
      for (const item of items) {
        item.by = Math.max(chartArea.top + 4, item.y - bh - GAP);
      }

      // 겹침 보정: 두 박스가 겹치면 위쪽 박스를 더 올림
      if (items.length === 2) {
        const [a, b] = items[0].by <= items[1].by ? [items[0], items[1]] : [items[1], items[0]];
        if (a.by + bh + BOX_GAP > b.by) {
          a.by = Math.max(chartArea.top + 4, b.by - bh - BOX_GAP);
        }
      }

      // 각 항목 그리기
      for (const { x, y, label, color, bw, by } of items) {
        ctx.save();

        // 외곽 링 + 채운 점
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fillStyle = dark ? '#1A1D27' : '#fff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // 라벨 x 위치 (차트 영역 내 클램프)
        let bx = x - bw / 2;
        bx = Math.max(chartArea.left, Math.min(bx, chartArea.right - bw));

        // 점선 커넥터
        ctx.beginPath();
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.moveTo(x, y - 7);
        ctx.lineTo(x, by + bh);
        ctx.stroke();
        ctx.setLineDash([]);

        // 라벨 박스
        ctx.fillStyle = dark ? '#252836' : '#fff';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        roundRect(ctx, bx, by, bw, bh, 4);
        ctx.fill();
        ctx.stroke();

        // 텍스트
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, bx + bw / 2, by + bh / 2);

        ctx.restore();
      }
    },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (points.length === 0) return null;

  /* ── 색상 판단 ── */
  const lastPoint = points[points.length - 1];
  const isNeg     = lastPoint.cumulativePL < 0;

  /* ── 색상 ── */
  const principalColor = isDark ? '#8B95A1' : '#B0B8C1';
  const plColor        = isNeg ? '#F04452' : (isDark ? '#4ECDC4' : '#00B493');
  const textColor      = isDark ? '#A8B3C1' : '#6B7684';
  const gridColor      = isDark ? 'rgba(42,47,62,.7)' : 'rgba(229,232,235,.8)';

  /* ── 포맷 헬퍼 ── */
  function fmtAbs(v: number): string {
    const abs = Math.abs(v);
    return market === 'domestic' ? fmtKrw(abs) : fmtUsd(abs);
  }
  function fmtSigned(v: number): string {
    return `${v >= 0 ? '+' : '−'}${fmtAbs(v)}`;
  }
  function fmtAxis(n: number): string {
    const abs = Math.abs(n);
    const s   = n < 0 ? '-' : '';
    if (market === 'domestic') {
      if (abs >= 100_000_000) return `${s}₩${(abs / 100_000_000).toFixed(0)}억`;
      if (abs >= 10_000)      return `${s}₩${(abs / 10_000).toFixed(0)}만`;
      return `${s}₩${abs.toFixed(0)}`;
    }
    if (abs >= 1_000_000) return `${s}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `${s}$${(abs / 1_000).toFixed(0)}K`;
    return `${s}$${abs.toFixed(2)}`;
  }

  /* ── 데이터 ── */
  const principalData = points.map((p) => p.principal);
  const evalData      = points.map((p) => p.principal + p.cumulativePL);
  const dotRadius     = points.length > 24 ? 0 : 3;

  // Update ref synchronously so the plugin reads fresh values on the next draw
  lastFmtRef.current = {
    evalLabel:      fmtAbs(evalData[evalData.length - 1]),
    evalColor:      plColor,
    principalLabel: fmtAbs(principalData[principalData.length - 1]),
    principalColor: principalColor,
    dark:           isDark,
  };

  const labels = points.map((p) =>
    view === 'monthly'
      ? `${p.date.slice(2, 4)}.${parseInt(p.date.slice(5, 7))}`
      : p.date.slice(5)
  );

  const chartData = {
    labels,
    datasets: [
      {
        label: '원금',
        data: principalData,
        borderColor: principalColor,
        backgroundColor: isDark ? 'rgba(139,149,161,0.13)' : 'rgba(176,184,193,0.13)',
        borderWidth: 1.8,
        pointRadius: (ctx: { dataIndex: number }) =>
          ctx.dataIndex === principalData.length - 1 ? 0 : dotRadius,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.35,
        order: 2,
      },
      {
        label: '평가금액',
        data: evalData,
        borderColor: plColor,
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        // Plugin draws a custom dot for the last point; suppress chart.js's dot there
        pointRadius: (ctx: { dataIndex: number }) =>
          ctx.dataIndex === evalData.length - 1 ? 0 : dotRadius,
        pointHoverRadius: 5,
        fill: false,
        tension: 0.35,
        order: 1,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (item: TooltipItem<'line'>) => {
            const v = item.raw as number;
            if (item.datasetIndex === 0) {
              return ` 원금: ${fmtAbs(v)}`;
            }
            const idx     = item.dataIndex;
            const princ   = principalData[idx];
            const pl      = v - princ;
            const rate    = princ > 0 ? (pl / princ) * 100 : null;
            const rateStr = rate !== null
              ? ` (${rate >= 0 ? '+' : ''}${rate.toFixed(2)}%)`
              : '';
            return [
              ` 평가금액: ${fmtAbs(v)}`,
              ` 손  익: ${fmtSigned(pl)}${rateStr}`,
            ];
          },
        },
        backgroundColor: isDark ? '#252836' : '#fff',
        titleColor:      isDark ? '#F0F4F8' : '#191F28',
        bodyColor:       isDark ? '#A8B3C1' : '#4E5968',
        borderColor:     isDark ? '#2A2F3E' : '#E5E8EB',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        boxPadding: 4,
      },
    },
    layout: { padding: { left: 4, bottom: 2, right: 8 } },
    scales: {
      x: {
        ticks: {
          color: textColor,
          font: { size: 11, family: 'Pretendard, sans-serif' },
          maxRotation: 45,
          autoSkip: true,
          maxTicksLimit: 12,
        },
        grid:   { display: false },
        border: { color: gridColor },
      },
      y: {
        afterBuildTicks(scale) {
          if (scale.ticks.length < 2) return;
          const step = scale.ticks[1].value - scale.ticks[0].value;
          const lastVal = scale.ticks[scale.ticks.length - 1].value;
          scale.ticks.push({ value: lastVal + step, label: '' });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (scale as unknown as any).max = lastVal + step;
        },
        ticks: {
          color: textColor,
          font: { size: 11, family: 'Pretendard, sans-serif' },
          callback: (v) => fmtAxis(Number(v)),
          maxTicksLimit: 6,
        },
        grid:   { color: gridColor },
        border: { color: 'transparent' },
      },
    },
  };

  return (
    <div className="rpl-panel">
      <div className="rpl-header pl-chart-header">
        {/* 제목 + 레전드 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="rpl-title">투자 성과 추이</span>
          <div className="pl-line-legend">
            <span className="pl-line-dot" style={{ background: principalColor }} />
            <span className="pl-line-label">원금</span>
            <span className="pl-line-dot" style={{ background: plColor }} />
            <span className="pl-line-label">평가금액</span>
          </div>
        </div>

        {/* 컨트롤: 기간 + 일별/월별 */}
        <div className="pl-chart-header__controls">
          <div className="rpl-seg">
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                className={`rpl-seg__btn${period === key ? ' active' : ''}`}
                onClick={() => setPeriod(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="rpl-seg">
            {(['monthly', 'daily'] as const).map((v) => (
              <button
                key={v}
                className={`rpl-seg__btn${view === v ? ' active' : ''}`}
                onClick={() => setView(v)}
              >
                {v === 'monthly' ? '월' : '일'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pl-line-chart-wrap">
        <Line data={chartData} options={options} plugins={[lastValuePlugin]} />
      </div>
    </div>
  );
}
