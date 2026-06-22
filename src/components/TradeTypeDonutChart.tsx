'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import type { Entry, Market } from '@/lib/types';
import { fmtUsd, fmtKrw } from '@/lib/utils';
import { type HoldingFilter, isETF } from './HoldingsList';

ChartJS.register(ArcElement, Tooltip, Legend);

const PALETTE = [
  '#A8D8B9', '#B5CEFA', '#F7C59F', '#C3B1E1', '#FADADD',
  '#A2D2D2', '#FAE3A0', '#D4A5C9', '#A9C8A0', '#F2C4A0',
  '#B8D4E8', '#E8C3B5', '#C5DEB8', '#D4B8E0', '#F0D9A8',
];

const DEPOSIT_COLOR = '#CBD5E1';

interface Holding {
  stock: string;
  value: number;
  qty: number;
}

function calcChartHoldings(entries: Entry[]): Holding[] {
  const map: Record<string, { buySettlement: number; buyQty: number; sellQty: number }> = {};
  for (const e of entries) {
    if (e.type !== 'buy' && e.type !== 'sell') continue;
    if (!e.stock || e.qty <= 0) continue;
    const key = e.stock.trim();
    if (!map[key]) map[key] = { buySettlement: 0, buyQty: 0, sellQty: 0 };
    if (e.type === 'buy') {
      map[key].buySettlement += e.settlement;
      map[key].buyQty += e.qty;
    } else {
      map[key].sellQty += e.qty;
    }
  }
  return Object.entries(map)
    .flatMap(([stock, { buySettlement, buyQty, sellQty }]) => {
      const remainQty = buyQty - sellQty;
      if (remainQty <= 0 || buyQty <= 0) return [];
      return [{ stock, value: (buySettlement / buyQty) * remainQty, qty: remainQty }];
    })
    .sort((a, b) => b.value - a.value);
}

interface Props {
  entries: Entry[];
  market: Market;
  isDark: boolean;
  prices?: Record<string, { price: number; changeRate: number } | null>;
  pricesFetched?: boolean;
  depositBalance?: number;
  showDeposit?: boolean;
  filter?: HoldingFilter;
  bare?: boolean;
}

export function TradeTypeDonutChart({
  entries, market, isDark,
  prices = {}, pricesFetched = false,
  depositBalance = 0,
  showDeposit = true,
  filter = 'all',
  bare = false,
}: Props) {
  const [isNarrow, setIsNarrow] = useState(false);
  const [internalShowDeposit, setInternalShowDeposit] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveShowDeposit = bare ? showDeposit : internalShowDeposit;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setIsNarrow(entry.contentRect.width < 480);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const holdings = useMemo(() => {
    const base = calcChartHoldings(entries);
    const filtered = filter === 'stock'
      ? base.filter((h) => !isETF(h.stock))
      : filter === 'etf'
      ? base.filter((h) => isETF(h.stock))
      : base;
    if (!pricesFetched) return filtered;
    return filtered
      .map((h) => {
        const cp = prices[h.stock];
        return cp != null ? { ...h, value: cp.price * h.qty } : h;
      })
      .sort((a, b) => b.value - a.value);
  }, [entries, prices, pricesFetched, filter]);

  const calloutPlugin = useMemo(() => ({
    id: 'calloutLabels',
    afterDraw(chart: any) {
      const ctx = chart.ctx as CanvasRenderingContext2D;
      const meta = chart.getDatasetMeta(0);
      const data = chart.data.datasets[0].data as number[];
      const labels = chart.data.labels as string[];
      const colors = chart.data.datasets[0].backgroundColor as string[];
      const total = data.reduce((a: number, b: number) => a + b, 0);
      const chartWidth: number = chart.width;

      ctx.save();

      type LabelItem = {
        x1: number; y1: number; midX: number; x3: number;
        y: number; isRight: boolean; color: string; text: string; maxWidth: number;
      };

      const items: LabelItem[] = [];
      meta.data.forEach((arc: any, i: number) => {
        if (!data[i] || data[i] <= 0) return;
        const { x, y, startAngle, endAngle, outerRadius } = arc.getProps(
          ['x', 'y', 'startAngle', 'endAngle', 'outerRadius'], true,
        );
        const span = endAngle - startAngle;
        if (span < 0.15) return;

        const mid = startAngle + span / 2;
        const cos = Math.cos(mid);
        const sin = Math.sin(mid);
        const isRight = cos >= 0;

        const x1 = x + cos * (outerRadius + 4);
        const y1 = y + sin * (outerRadius + 4);
        const midX = x + cos * (outerRadius + 18);
        const idealY = y + sin * (outerRadius + 18);
        const x3 = midX + (isRight ? 14 : -14);
        const textX = x3 + (isRight ? 4 : -4);
        const maxWidth = isRight ? chartWidth - textX - 2 : textX - 2;

        const pct = ((data[i] / total) * 100).toFixed(1);
        const label = labels[i] as string;

        items.push({ x1, y1, midX, x3, y: idealY, isRight, color: colors[i], text: `${label}  ${pct}%`, maxWidth });
      });

      const MIN_GAP = 13;
      for (const side of [true, false]) {
        const group = items.filter(l => l.isRight === side).sort((a, b) => a.y - b.y);
        for (let i = 1; i < group.length; i++) {
          if (group[i].y < group[i - 1].y + MIN_GAP) group[i].y = group[i - 1].y + MIN_GAP;
        }
        for (let i = group.length - 2; i >= 0; i--) {
          if (group[i].y > group[i + 1].y - MIN_GAP) group[i].y = group[i + 1].y - MIN_GAP;
        }
      }

      items.forEach(({ x1, y1, midX, x3, y, isRight, color, text, maxWidth }) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(midX, y);
        ctx.lineTo(x3, y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = '600 10px Pretendard, sans-serif';
        ctx.fillStyle = isDark ? '#E2E8F0' : '#374151';
        ctx.textAlign = isRight ? 'left' : 'right';
        ctx.textBaseline = 'middle';
        const textX = x3 + (isRight ? 4 : -4);
        ctx.fillText(text, textX, y, Math.max(maxWidth, 10));
      });

      ctx.restore();
    },
  }), [isDark]);

  const showDepositSegment = effectiveShowDeposit && depositBalance > 0;

  const chartLabels = showDepositSegment
    ? [...holdings.map((h) => h.stock), '현금']
    : holdings.map((h) => h.stock);
  const chartValues = showDepositSegment
    ? [...holdings.map((h) => h.value), depositBalance]
    : holdings.map((h) => h.value);
  const chartColors = showDepositSegment
    ? [...holdings.map((_, i) => PALETTE[i % PALETTE.length]), DEPOSIT_COLOR]
    : holdings.map((_, i) => PALETTE[i % PALETTE.length]);

  const grandTotal = chartValues.reduce((s, v) => s + v, 0);
  const borderColor = isDark ? '#1A1D27' : '#ffffff';

  const chartData = {
    labels: chartLabels,
    datasets: [{
      data: chartValues,
      backgroundColor: chartColors,
      borderColor,
      borderWidth: 2,
      hoverOffset: 8,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '58%',
    layout: {
      padding: isNarrow
        ? { top: 8, bottom: 36, left: 100, right: 100 }
        : { top: 4, bottom: 28, left: 160, right: 160 },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items: any[]) => items[0]?.label ?? '',
          label: (ctx: any) => {
            const val = ctx.parsed as number;
            const formatted = market === 'domestic' ? fmtKrw(val) : fmtUsd(val);
            const pct = grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(1) : '0.0';
            return ` ${formatted}  (${pct}%)`;
          },
        },
      },
    },
  };

  const isEmpty = holdings.length === 0 && !showDepositSegment;

  if (bare) {
    return (
      <div ref={containerRef} className="holdings-chart-bare">
        {isEmpty ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>보유 종목이 없습니다.</span>
          </div>
        ) : (
          <Doughnut data={chartData} options={options} plugins={[calloutPlugin]} />
        )}
      </div>
    );
  }

  if (isEmpty) return (
    <div className="section" ref={containerRef}>
      <div className="holdings-header">
        <div>
          <h2 style={{ padding: 0 }}>보유 종목 비중</h2>
          <p className="chart-hint" style={{ padding: '4px 0 0' }}>평균단가 × 보유수량 기준</p>
        </div>
      </div>
      <div className="chart-wrap" style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>보유 종목이 없습니다.</span>
      </div>
    </div>
  );

  return (
    <div className="section" ref={containerRef}>
      <div className="holdings-header">
        <div>
          <h2 style={{ padding: 0 }}>보유 종목 비중</h2>
          <p className="chart-hint" style={{ padding: '4px 0 0' }}>
            {pricesFetched ? '현재가 × 보유수량 기준' : '평균단가 × 보유수량 기준'}
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={internalShowDeposit}
            onChange={() => setInternalShowDeposit((v) => !v)}
            style={{ width: 14, height: 14, accentColor: 'var(--brand)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>현금</span>
        </label>
      </div>
      <div className="chart-wrap" style={{ height: 420 }}>
        <Doughnut data={chartData} options={options} plugins={[calloutPlugin]} />
      </div>
    </div>
  );
}
