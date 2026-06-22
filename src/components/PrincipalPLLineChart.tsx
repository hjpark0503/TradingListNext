'use client';
import { useMemo, useState } from 'react';
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

function aggregateMonthly(points: PrincipalPLPoint[]): PrincipalPLPoint[] {
  const map = new Map<string, PrincipalPLPoint>();
  for (const p of points) {
    map.set(p.date.slice(0, 7), { date: p.date.slice(0, 7), principal: p.principal, cumulativePL: p.cumulativePL });
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function PrincipalPLLineChart({ entries, market, isDark = false }: Props) {
  const [view, setView] = useState<'monthly' | 'daily'>('monthly');

  const allPoints = useMemo(() => calcPrincipalAndPLOverTime(entries), [entries]);
  const points = useMemo(
    () => (view === 'monthly' ? aggregateMonthly(allPoints) : allPoints),
    [view, allPoints]
  );

  if (points.length === 0) return null;

  const labels = points.map((p) =>
    view === 'monthly'
      ? `${p.date.slice(2, 4)}.${parseInt(p.date.slice(5, 7))}`
      : p.date.slice(5)
  );

  const principalData = points.map((p) => p.principal);
  const plData = points.map((p) => p.principal + p.cumulativePL);

  const principalColor = isDark ? '#8B95A1' : '#B0B8C1';
  const plColor = isDark ? '#4ECDC4' : '#00B493';
  const textColor = isDark ? '#A8B3C1' : '#6B7684';
  const gridColor = isDark ? 'rgba(42,47,62,.7)' : 'rgba(229,232,235,.8)';

  function fmtAxis(n: number) {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (market === 'domestic') {
      if (abs >= 100_000_000) return `${sign}₩${(abs / 100_000_000).toFixed(0)}억`;
      if (abs >= 10_000) return `${sign}₩${(abs / 10_000).toFixed(0)}만`;
      return `${sign}₩${abs.toFixed(0)}`;
    }
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }

  function fmtTooltip(v: number) {
    const abs = Math.abs(v);
    const prefix = v < 0 ? '−' : '';
    if (market === 'domestic') return `${prefix}${fmtKrw(abs)}`;
    return `${prefix}$${fmtUsd(abs)}`;
  }

  const dotRadius = points.length > 24 ? 0 : 3;

  const chartData = {
    labels,
    datasets: [
      {
        label: '원금',
        data: principalData,
        borderColor: principalColor,
        backgroundColor: isDark ? 'rgba(139,149,161,0.10)' : 'rgba(176,184,193,0.12)',
        borderWidth: 2,
        pointRadius: dotRadius,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.3,
      },
      {
        label: '실현손익+원금',
        data: plData,
        borderColor: plColor,
        backgroundColor: isDark ? 'rgba(78,205,196,0.10)' : 'rgba(0,180,147,0.08)',
        borderWidth: 2,
        pointRadius: dotRadius,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.3,
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
          label: (item: TooltipItem<'line'>) =>
            ` ${item.dataset.label}: ${fmtTooltip(item.raw as number)}`,
        },
        backgroundColor: isDark ? '#252836' : '#fff',
        titleColor: isDark ? '#F0F4F8' : '#191F28',
        bodyColor: isDark ? '#A8B3C1' : '#4E5968',
        borderColor: isDark ? '#2A2F3E' : '#E5E8EB',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
      },
    },
    layout: { padding: { left: 4, bottom: 2 } },
    scales: {
      x: {
        ticks: {
          color: textColor,
          font: { size: 11, family: 'Pretendard, sans-serif' },
          maxRotation: 45,
          autoSkip: true,
          maxTicksLimit: 12,
        },
        grid: { display: false },
        border: { color: gridColor },
      },
      y: {
        min: 0,
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

  return (
    <div className="rpl-panel">
      <div className="rpl-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="rpl-title">투자 성과 추이</span>
          <div className="pl-line-legend">
            <span className="pl-line-dot" style={{ background: principalColor }} />
            <span className="pl-line-label">원금</span>
            <span className="pl-line-dot" style={{ background: plColor }} />
            <span className="pl-line-label">실현손익+원금</span>
          </div>
        </div>
        <div className="rpl-seg">
          {(['monthly', 'daily'] as const).map((v) => (
            <button
              key={v}
              className={`rpl-seg__btn${view === v ? ' active' : ''}`}
              onClick={() => setView(v)}
            >
              {v === 'monthly' ? '월별' : '일별'}
            </button>
          ))}
        </div>
      </div>
      <div className="pl-line-chart-wrap">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
