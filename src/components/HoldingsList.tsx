'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import type { Entry, Market } from '@/lib/types';

export type HoldingFilter = 'all' | 'stock' | 'etf';

const ETF_PREFIXES = [
  'KODEX', 'TIGER', 'KINDEX', 'HANARO', 'ARIRANG', 'KOSEF', 'KBSTAR', 'ACE',
  'TIMEFOLIO', 'PLUS', 'SOL', 'WON', 'KOACT', '1Q', 'FOCUS', '마이티', '히어로즈',
  'POWER', '파워', '마이다스', '트러스톤', 'SMART',
  // 해외 ETF 발행사 (이름에 "ETF"가 없는 경우가 많음, 예: "Invesco QQQ Trust, Series 1")
  'ISHARES', 'SPDR', 'VANGUARD', 'PROSHARES', 'INVESCO', 'DIREXION', 'GLOBAL X',
  'ARK', 'XTRACKERS', 'WISDOMTREE', 'SCHWAB', 'FIRST TRUST', 'VANECK', 'JPMORGAN',
  'SIMPLIFY', 'GRANITESHARES', 'AMPLIFY', 'ROUNDHILL', 'YIELDMAX', 'DEFIANCE',
  'FIDELITY', 'STATE STREET',
];

export function isETF(name: string): boolean {
  const upper = name.toUpperCase().trim();
  if (upper.includes('ETF')) return true;
  return ETF_PREFIXES.some((p) => upper.startsWith(p));
}

export interface Holding {
  stock: string;
  avgPrice: number;
  qty: number;
}

export function calcHoldings(entries: Entry[]): Holding[] {
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
  prices: Record<string, { price: number; changeRate: number } | null>;
  fetched: boolean;
  loading: boolean;
  onFetch: (holdings: { stock: string }[]) => void;
  filter?: HoldingFilter;
  bare?: boolean;
}

export function HoldingsList({ entries, market, prices, fetched, loading, onFetch, filter: filterProp, bare = false }: Props) {
  const [internalFilter, setInternalFilter] = useState<HoldingFilter>('all');
  const filter = filterProp ?? internalFilter;

  const holdings = useMemo(() => {
    const base = calcHoldings(entries);
    if (!fetched) return base;
    return [...base].sort((a, b) => {
      const aVal = (prices[a.stock]?.price ?? a.avgPrice) * a.qty;
      const bVal = (prices[b.stock]?.price ?? b.avgPrice) * b.qty;
      return bVal - aVal;
    });
  }, [entries, fetched, prices]);

  const stockCount = useMemo(() => holdings.filter((h) => !isETF(h.stock)).length, [holdings]);
  const etfCount   = useMemo(() => holdings.filter((h) =>  isETF(h.stock)).length, [holdings]);

  const filteredHoldings = useMemo(() => {
    if (filter === 'stock') return holdings.filter((h) => !isETF(h.stock));
    if (filter === 'etf')   return holdings.filter((h) =>  isETF(h.stock));
    return holdings;
  }, [holdings, filter]);

  const autoFetchedMarket = useRef<string | null>(null);
  useEffect(() => {
    if (autoFetchedMarket.current === market) return;
    if (holdings.length === 0) return;
    autoFetchedMarket.current = market;
    onFetch(holdings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, holdings.length]);

  const fmt = (n: number) =>
    market === 'domestic'
      ? `₩${Math.round(n).toLocaleString('ko-KR')}`
      : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fmtPL = (n: number) => {
    const abs = Math.abs(n);
    return n < 0 ? `-${fmt(abs)}` : fmt(abs);
  };

  const tableBody = (
    <div className="holdings-table-wrap">
      <table className="holdings-table">
        <thead>
          <tr>
            <th>No</th>
            <th>종목명</th>
            <th className="r">평균단가</th>
            <th className="r">현재가</th>
            <th className="r">평가손익</th>
          </tr>
        </thead>
        <tbody>
          {filteredHoldings.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                보유 종목이 없습니다.
              </td>
            </tr>
          ) : filteredHoldings.map((h, i) => {
            const cpData = prices[h.stock];
            const hasCp = fetched && cpData != null;
            const cp = cpData?.price ?? null;
            const changeRate = cpData?.changeRate ?? null;
            const unrealizedPL = hasCp ? (cp! - h.avgPrice) * h.qty : null;
            const costBasis = h.avgPrice * h.qty;
            const returnRate = hasCp && costBasis > 0 ? (unrealizedPL! / costBasis) * 100 : null;
            const plClass = unrealizedPL == null || unrealizedPL === 0 ? '' : unrealizedPL > 0 ? 'pl-pos' : 'pl-neg';

            return (
              <tr key={h.stock}>
                <td className="holdings-no">{i + 1}</td>
                <td className="holdings-stock">{h.stock}</td>
                <td className="r">
                  {fmt(h.avgPrice)}
                  <span className="holding-change holding-change--muted">{h.qty.toLocaleString('en-US')}주</span>
                </td>
                <td className="r">
                  {loading && !fetched
                    ? <><span className="skeleton-cell" /><span className="holding-change"> </span></>
                    : hasCp
                      ? <>{fmt(cp!)}<span className={`holding-change ${changeRate != null ? (changeRate > 0 ? 'pl-pos' : changeRate < 0 ? 'pl-neg' : '') : ''}`}>{changeRate != null ? `${changeRate > 0 ? '+' : ''}${changeRate.toFixed(2)}%` : ' '}</span></>
                      : <>{'—'}<span className="holding-change"> </span></>
                  }
                </td>
                <td className={`r ${plClass}`}>
                  {unrealizedPL == null ? '—' : `${unrealizedPL > 0 ? '+' : ''}${fmtPL(unrealizedPL)}`}
                  <span className={`holding-change ${plClass}`}>
                    {returnRate != null ? `${returnRate > 0 ? '+' : ''}${returnRate.toFixed(2)}%` : ' '}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (bare) return tableBody;

  const FILTERS: { key: HoldingFilter; label: string; count: number }[] = [
    { key: 'all',   label: '보유 종목 전체', count: holdings.length },
    { key: 'stock', label: '주식',           count: stockCount },
    { key: 'etf',   label: 'ETF',            count: etfCount },
  ];

  return (
    <div className="section holdings-list">
      <div className="tab-bar">
        {holdings.length > 0 && FILTERS.map(({ key, label, count }) => (
          <button
            key={key}
            className={`tab-btn${internalFilter === key ? ' active' : ''}`}
            onClick={() => setInternalFilter(key)}
          >
            {label}
            <span className="holdings-filter-count">{count}</span>
          </button>
        ))}
        <button
          className="btn-ghost holdings-refresh-btn"
          style={{ marginLeft: 'auto' }}
          onClick={() => onFetch(holdings)}
          disabled={loading}
          title={market === 'overseas' ? '티커 기준 현재가 조회' : '국내 종목은 코드 기준 조회 필요'}
        >
          {loading ? '조회 중…' : fetched ? '↻ 새로고침' : '현재가 조회'}
        </button>
      </div>
      {tableBody}
    </div>
  );
}
