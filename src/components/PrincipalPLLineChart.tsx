'use client';
import { useMemo, useRef } from 'react';
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

interface Props {
  entries: Entry[];
  market: Market;
  isDark?: boolean;
}

interface LastFmtRef {
  principalLabel: string;
  principalColor: string;
  plLabel: string;
  plColor: string;
  divLabel: string;
  divColor: string;
  totalLabel: string;
  totalColor: string;
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
      cumulativeDiv: p.cumulativeDiv,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}


export function PrincipalPLLineChart({ entries, market, isDark = false }: Props) {
  const allPoints = useMemo(() => calcPrincipalAndPLOverTime(entries), [entries]);
  const points    = useMemo(() => aggregateMonthly(allPoints), [allPoints]);

  // Ref holds the latest label info so the stable plugin can always read fresh values
  const lastFmtRef = useRef<LastFmtRef>({
    principalLabel: '', principalColor: '',
    plLabel: '', plColor: '',
    divLabel: '', divColor: '',
    totalLabel: '', totalColor: '',
    dark: false,
  });

  // Plugin is created once (stable ref) — reads data from lastFmtRef at draw time
  const lastValuePlugin = useMemo<Plugin<'line'>>(() => ({
    id: 'plLastValue',
    afterDraw(chart) {
      const {
        principalLabel, principalColor: pColor,
        plLabel, plColor: rplColor,
        divLabel, divColor,
        totalLabel, totalColor,
        dark,
      } = lastFmtRef.current;
      const { ctx, chartArea } = chart;
      if (!chartArea) return;

      // ── 범례 (x축 아래 중앙) ──
      const legItems = [
        { label: '원금',     color: pColor    },
        { label: '실현손익', color: rplColor  },
        { label: '배당금',   color: divColor  },
        { label: '전체',     color: totalColor },
      ];
      const legFSize  = 10;
      const dotSize   = 8;
      const dotGap    = 5;
      const itemGap   = 16;

      ctx.save();
      ctx.font = `600 ${legFSize}px Pretendard, sans-serif`;
      ctx.textBaseline = 'middle';

      const totalW = legItems.reduce((s, it, i) =>
        s + dotSize + dotGap + ctx.measureText(it.label).width + (i < legItems.length - 1 ? itemGap : 0), 0);

      let lx = (chart.width - totalW) / 2;
      const ly = chart.height - 10;

      for (const { label, color } of legItems) {
        ctx.fillStyle = color;
        roundRect(ctx, lx, ly - dotSize / 2, dotSize, dotSize, 2);
        ctx.fill();
        lx += dotSize + dotGap;

        ctx.fillStyle = dark ? '#A8B3C1' : '#6B7684';
        ctx.fillText(label, lx, ly);
        lx += ctx.measureText(label).width + itemGap;
      }

      ctx.restore();

      const fSize  = 11;
      const padX   = 7;
      const padY   = 4;
      const bh     = fSize + padY * 2;
      const GAP    = 26; // 점과 라벨 사이 거리
      const BOX_GAP = 4; // 박스끼리 겹칠 때 최소 간격

      ctx.font = `700 ${fSize}px Pretendard, sans-serif`;

      // 4개 데이터셋 모두의 마지막 점에 라벨 표시
      const items: { dsIdx: number; label: string; color: string; x: number; y: number; bw: number; by: number }[] = [];
      for (const [dsIdx, label, color] of [
        [0, principalLabel, pColor],
        [1, plLabel, rplColor],
        [2, divLabel, divColor],
        [3, totalLabel, totalColor],
      ] as [number, string, string][]) {
        if (!label) continue;
        const meta = chart.getDatasetMeta(dsIdx);
        if (!meta.data.length) continue;
        const el = meta.data[meta.data.length - 1] as unknown as { x: number; y: number };
        const bw = ctx.measureText(label).width + padX * 2;
        items.push({ dsIdx, label, color, x: el.x, y: el.y, bw, by: 0 });
      }

      // 기본 위치: 각 점 옆(오른쪽)에 세로 중앙 정렬
      for (const item of items) {
        item.by = Math.min(
          Math.max(chartArea.top + 4, item.y - bh / 2),
          chartArea.bottom - bh - 4
        );
      }

      // 겹침 보정: y 기준 정렬 후 위에서 아래로 최소 간격 확보, 넘치면 아래에서 위로 재보정
      items.sort((a, b) => a.by - b.by);
      for (let i = 1; i < items.length; i++) {
        const prev = items[i - 1];
        const cur  = items[i];
        if (cur.by < prev.by + bh + BOX_GAP) {
          cur.by = prev.by + bh + BOX_GAP;
        }
      }
      const maxBy = chartArea.bottom - 4 - bh;
      if (items.length && items[items.length - 1].by > maxBy) {
        items[items.length - 1].by = maxBy;
        for (let i = items.length - 2; i >= 0; i--) {
          const next = items[i + 1];
          if (items[i].by > next.by - bh - BOX_GAP) {
            items[i].by = next.by - bh - BOX_GAP;
          }
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

        // 라벨 x 위치 (점 오른쪽, 캔버스 폭 안에서 클램프)
        const bx = Math.min(x + GAP, chart.width - bw - 4);

        // 점선 커넥터
        ctx.beginPath();
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.moveTo(x + 7, y);
        ctx.lineTo(bx, by + bh / 2);
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
  const isTotalNeg = lastPoint.principal + lastPoint.cumulativePL + lastPoint.cumulativeDiv < 0;

  /* ── 색상 ── */
  const principalColor = isDark ? '#8B95A1' : '#B0B8C1';
  const plColor        = isDark ? '#A78BFA' : '#8B5CF6';
  const divColor       = isDark ? '#FB923C' : '#F97316';
  const totalColor     = isTotalNeg ? '#F04452' : (isDark ? '#4ECDC4' : '#00B493');
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
  const plData        = points.map((p) => p.cumulativePL);
  const divData       = points.map((p) => p.cumulativeDiv);
  const totalData     = points.map((p) => p.principal + p.cumulativePL + p.cumulativeDiv);
  const dotRadius     = points.length > 24 ? 0 : 3;

  // Update ref synchronously so the plugin reads fresh values on the next draw
  lastFmtRef.current = {
    principalLabel: fmtAbs(principalData[principalData.length - 1]),
    principalColor: principalColor,
    plLabel:        fmtAbs(plData[plData.length - 1]),
    plColor:        plColor,
    divLabel:       fmtAbs(divData[divData.length - 1]),
    divColor:       divColor,
    totalLabel:     fmtAbs(totalData[totalData.length - 1]),
    totalColor:     totalColor,
    dark:           isDark,
  };

  const labels = points.map(
    (p) => `${p.date.slice(2, 4)}.${parseInt(p.date.slice(5, 7))}`
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
        order: 4,
      },
      {
        label: '실현손익',
        data: plData,
        borderColor: plColor,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: (ctx: { dataIndex: number }) =>
          ctx.dataIndex === plData.length - 1 ? 0 : dotRadius,
        pointHoverRadius: 5,
        fill: false,
        tension: 0.35,
        order: 3,
      },
      {
        label: '배당금',
        data: divData,
        borderColor: divColor,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: (ctx: { dataIndex: number }) =>
          ctx.dataIndex === divData.length - 1 ? 0 : dotRadius,
        pointHoverRadius: 5,
        fill: false,
        tension: 0.35,
        order: 2,
      },
      {
        label: '전체',
        data: totalData,
        borderColor: totalColor,
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        // Plugin draws a custom dot for the last point; suppress chart.js's dot there
        pointRadius: (ctx: { dataIndex: number }) =>
          ctx.dataIndex === totalData.length - 1 ? 0 : dotRadius,
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
            if (item.datasetIndex === 1) {
              return ` 실현손익: ${fmtSigned(v)}`;
            }
            if (item.datasetIndex === 2) {
              return ` 배당금: ${fmtSigned(v)}`;
            }
            return ` 전체: ${fmtAbs(v)}`;
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
    layout: { padding: { left: 4, bottom: 28, right: 110 } },
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
        <span className="rpl-title">투자 성과 추이</span>
      </div>

      <div className="pl-line-chart-wrap">
        <Line data={chartData} options={options} plugins={[lastValuePlugin]} />
      </div>
    </div>
  );
}
