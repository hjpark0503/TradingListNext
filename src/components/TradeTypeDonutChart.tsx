'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import type { Entry, Market } from '@/lib/types';
import { fmtUsd, fmtKrw } from '@/lib/utils';

ChartJS.register(ArcElement, Tooltip, Legend);

const PALETTE = [
  '#A8D8B9', '#B5CEFA', '#F7C59F', '#C3B1E1', '#FADADD',
  '#A2D2D2', '#FAE3A0', '#D4A5C9', '#A9C8A0', '#F2C4A0',
  '#B8D4E8', '#E8C3B5', '#C5DEB8', '#D4B8E0', '#F0D9A8',
];

interface Holding {
  stock: string;
  value: number;
  qty: number;
}

function calcHoldings(entries: Entry[]): Holding[] {
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
}

export function TradeTypeDonutChart({ entries, market, isDark, prices = {}, pricesFetched = false }: Props) {
  const [isNarrow, setIsNarrow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
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
    const base = calcHoldings(entries);
    if (!pricesFetched) return base;
    // 현재가가 조회된 경우 현재가 × 수량으로 재계산
    return base
      .map((h) => {
        const cp = prices[h.stock];
        return cp != null ? { ...h, value: cp.price * h.qty } : h;
      })
      .sort((a, b) => b.value - a.value);
  }, [entries, prices, pricesFetched]);

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

      // 1단계: 모든 레이블 정보 수집
      const items: LabelItem[] = [];
      meta.data.forEach((arc: any, i: number) => {
        if (!data[i] || data[i] <= 0) return;
        const { x, y, startAngle, endAngle, outerRadius } = arc.getProps(
          ['x', 'y', 'startAngle', 'endAngle', 'outerRadius'],
          true,
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
        const rawLabel = labels[i] as string;
        const label = rawLabel.length > 8 ? rawLabel.slice(0, 7) + '…' : rawLabel;

        items.push({ x1, y1, midX, x3, y: idealY, isRight, color: colors[i], text: `${label}  ${pct}%`, maxWidth });
      });

      // 2단계: 좌·우 각각 Y 겹침 해소 (위→아래 패스 후 아래→위 패스)
      const MIN_GAP = 13;
      for (const side of [true, false]) {
        const group = items.filter(l => l.isRight === side).sort((a, b) => a.y - b.y);
        for (let i = 1; i < group.length; i++) {
          if (group[i].y < group[i - 1].y + MIN_GAP)
            group[i].y = group[i - 1].y + MIN_GAP;
        }
        for (let i = group.length - 2; i >= 0; i--) {
          if (group[i].y > group[i + 1].y - MIN_GAP)
            group[i].y = group[i + 1].y - MIN_GAP;
        }
      }

      // 3단계: 렌더링
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

  if (holdings.length === 0) return (
    <div className="section" ref={containerRef}>
      <h2>보유 종목 비중</h2>
      <p className="chart-hint">평균단가 × 보유수량 기준</p>
      <div className="chart-wrap" style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--c-text-muted, #9ca3af)', fontSize: '0.875rem' }}>보유 종목이 없습니다.</span>
      </div>
    </div>
  );

  const grandTotal = holdings.reduce((s, h) => s + h.value, 0);
  const borderColor = isDark ? '#1A1D27' : '#ffffff';

  const chartData = {
    labels: holdings.map((h) => h.stock),
    datasets: [{
      data: holdings.map((h) => h.value),
      backgroundColor: holdings.map((_, i) => PALETTE[i % PALETTE.length]),
      borderColor,
      borderWidth: 2,
      hoverOffset: 8,
      qtys: holdings.map((h) => h.qty),
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '58%',
    layout: {
      padding: isNarrow
        ? { top: 36, bottom: 36, left: 80, right: 80 }
        : { top: 28, bottom: 28, left: 120, right: 120 },
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

  return (
    <div className="section" ref={containerRef}>
      <h2>보유 종목 비중</h2>
      <p className="chart-hint">
        {pricesFetched ? '현재가 × 보유수량 기준' : '평균단가 × 보유수량 기준'}
      </p>
      <div className="chart-wrap" style={{ height: 260 }}>
        <Doughnut data={chartData} options={options} plugins={[calloutPlugin]} />
      </div>
    </div>
  );
}
