'use client';

import { formatUsd } from '@/lib/utils';
import { TradeRow, PLTotals } from '@/lib/types';

interface BuyCardProps {
  buys: TradeRow[];
  onClick: () => void;
  isActive: boolean;
}

interface SellCardProps {
  sells: TradeRow[];
  onClick: () => void;
  isActive: boolean;
}

interface PLCardProps {
  plTotals: PLTotals;
}

interface TaxCardProps {
  taxUsd: number;
  exchangeRate: number;
}

export function BuyCard({ buys, onClick, isActive }: BuyCardProps) {
  const total = buys.reduce((s, r) => s + Math.abs(r.settlement), 0);
  return (
    <div
      className={`summary-card ${isActive ? 'active buy' : ''}`}
      onClick={onClick}
      data-tab="buy"
    >
      <div className="card-label">총 매수</div>
      <div className="card-value red">{buys.length}건</div>
      <div className="card-sub">총 ${formatUsd(total)}</div>
    </div>
  );
}

export function SellCard({ sells, onClick, isActive }: SellCardProps) {
  const total = sells.reduce((s, r) => s + Math.abs(r.settlement), 0);
  return (
    <div
      className={`summary-card ${isActive ? 'active sell' : ''}`}
      onClick={onClick}
      data-tab="sell"
    >
      <div className="card-label">총 매도</div>
      <div className="card-value blue">{sells.length}건</div>
      <div className="card-sub">총 ${formatUsd(total)}</div>
    </div>
  );
}

export function PLCard({ plTotals }: PLCardProps) {
  const { totalPL, plPct, hasSomeData } = plTotals;
  if (!hasSomeData) {
    return (
      <div className="summary-card">
        <div className="card-label">실현 손익</div>
        <div className="card-value">—</div>
        <div className="card-sub">데이터 로드 후 표시</div>
      </div>
    );
  }
  const isPos = totalPL >= 0;
  return (
    <div className="summary-card">
      <div className="card-label">실현 손익</div>
      <div className={`card-value ${isPos ? 'red' : 'blue'}`}>
        {isPos ? '+$' : '-$'}
        {formatUsd(Math.abs(totalPL))}
      </div>
      {plPct !== null && (
        <div className="card-sub">
          {isPos ? '+' : ''}
          {plPct.toFixed(2)}% 수익률
        </div>
      )}
    </div>
  );
}

export function TaxCard({ taxUsd, exchangeRate }: TaxCardProps) {
  return (
    <div className="summary-card">
      <div className="card-label">예상 양도세</div>
      <div className="card-value orange">${formatUsd(taxUsd)}</div>
      {taxUsd > 0 ? (
        <div className="card-sub">≈ ₩{Math.round(taxUsd * exchangeRate).toLocaleString()}</div>
      ) : (
        <div className="card-sub">과세 대상 이익 없음</div>
      )}
    </div>
  );
}
