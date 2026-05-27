'use client';

import { useEffect, useRef } from 'react';
import { TradeRow } from '@/lib/types';
import { aggregateBalanceByDate, formatUsd } from '@/lib/utils';

interface BalanceChartProps {
  rows: TradeRow[];
}

export function BalanceChart({ rows }: BalanceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<import('chart.js').Chart | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!canvasRef.current) return;
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      if (cancelled) return;

      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }

      const series = aggregateBalanceByDate(rows);
      const { labels, data, tradeCounts } = series;

      if (labels.length === 0) return;

      chartRef.current = new Chart(canvasRef.current.getContext('2d')!, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: '예수금잔고 (USD)',
              data,
              borderColor: '#1e3a6e',
              backgroundColor: 'rgba(30, 58, 110, 0.06)',
              tension: 0.25,
              fill: true,
              pointRadius: 5,
              pointBackgroundColor: '#1e3a6e',
              pointBorderColor: '#fff',
              pointBorderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => (items[0]?.label ?? ''),
                label: (ctx) => {
                  const n = tradeCounts[ctx.dataIndex] || 0;
                  return [
                    `말잔 USD ${formatUsd(ctx.parsed.y)}`,
                    n > 0 ? `당일 거래 ${n}건` : '',
                  ].filter(Boolean);
                },
              },
            },
          },
          scales: {
            x: {
              ticks: {
                maxRotation: 45,
                minRotation: 35,
                autoSkip: true,
                maxTicksLimit: 16,
                font: { size: 10 },
              },
              grid: { display: false },
            },
            y: {
              ticks: { callback: (val) => formatUsd(Number(val)) },
              grid: { color: '#f0f3fa' },
            },
          },
        },
      });
    }

    init();
    return () => {
      cancelled = true;
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [rows]);

  return (
    <div className="chart-container" style={{ position: 'relative', height: 300 }}>
      <canvas ref={canvasRef} id="chartBalanceFlow" />
    </div>
  );
}
