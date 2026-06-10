'use client';

import { useMemo, useEffect, useRef } from 'react';
import type { Entry, Market } from '@/lib/types';

interface Holding {
  stock: string;
  avgPrice: number;
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
      return [{ stock, avgPrice: buySettlement / buyQty, qty: remainQty }];
    })
    .sort((a, b) => b.avgPrice * b.qty - a.avgPrice * a.qty);
}

interface Props {
  entries: Entry[];
  market: Market;
  prices: Record<string, number | null>;
  fetched: boolean;
  loading: boolean;
  onFetch: (holdings: { stock: string }[]) => void;
}

export function HoldingsList({ entries, market, prices, fetched, loading, onFetch }: Props) {
  const holdings = useMemo(() => calcHoldings(entries), [entries]);

  // 마켓 전환·초기 로드 시 자동 현재가 조회
  const autoFetchedMarket = useRef<string | null>(null);
  useEffect(() => {
    if (autoFetchedMarket.current === market) return;
    if (holdings.length === 0) return;
    autoFetchedMarket.current = market;
    onFetch(holdings);
    // onFetch는 market 변경 시에만 바뀌는 안정적 콜백이므로 deps 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, holdings.length]);

  if (holdings.length === 0) return null;

  const fmt = (n: number) =>
    market === 'domestic'
      ? `₩${Math.round(n).toLocaleString('ko-KR')}`
      : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fmtPL = (n: number) => {
    const abs = Math.abs(n);
    return n < 0 ? `-${fmt(abs)}` : fmt(abs);
  };

  return (
    <div className="section holdings-list">
      <div className="holdings-header">
        <h2>보유 종목 내역</h2>
        <button
          className="btn-ghost holdings-refresh-btn"
          onClick={() => onFetch(holdings)}
          disabled={loading}
          title={market === 'overseas' ? '티커 기준 현재가 조회' : '국내 종목은 코드 기준 조회 필요'}
        >
          {loading ? '조회 중…' : fetched ? '↻ 새로고침' : '현재가 조회'}
        </button>
      </div>
      <div className="holdings-table-wrap">
        <table className="holdings-table">
          <thead>
            <tr>
              <th>No</th>
              <th>종목명</th>
              <th className="r">현재가</th>
              <th className="r">평가손익</th>
              <th className="r">손익률</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h, i) => {
              const cp = prices[h.stock];
              const hasCp = fetched && cp != null;
              // 평가손익 = (현재가 - 매입단가) × 보유수량
              const unrealizedPL = hasCp ? (cp - h.avgPrice) * h.qty : null;
              // 손익률(%) = 평가손익 ÷ 매입금액 × 100
              const costBasis = h.avgPrice * h.qty;
              const returnRate = hasCp && costBasis > 0
                ? (unrealizedPL! / costBasis) * 100
                : null;
              const plClass = unrealizedPL == null
                ? ''
                : unrealizedPL >= 0 ? 'pl-pos' : 'pl-neg';

              return (
                <tr key={h.stock}>
                  <td className="holdings-no">{i + 1}</td>
                  <td className="holdings-stock">{h.stock}</td>
                  <td className="r">
                    {hasCp ? fmt(cp) : '—'}
                  </td>
                  <td className={`r ${plClass}`}>
                    {unrealizedPL == null ? '—' : fmtPL(unrealizedPL)}
                  </td>
                  <td className={`r ${plClass}`}>
                    {returnRate == null ? '—' : `${returnRate.toFixed(2)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
