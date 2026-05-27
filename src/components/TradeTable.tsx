'use client';

import { TradeRow, PLRow } from '@/lib/types';
import { formatUsd } from '@/lib/utils';
import { calcTotalRealizedPL } from '@/lib/calculations';

interface TradeTableProps {
  rows: TradeRow[];
  plRows?: PLRow[];
  side: 'buy' | 'sell';
}

function TradeRowEl({ row, plData }: { row: TradeRow; plData?: PLRow }) {
  const isBuy = row.type.includes('매수');

  return (
    <tr>
      <td className="col-text date-c">{row.date}</td>
      <td className="col-text ticker">{row.name}</td>
      <td className="col-text">
        <span className={`badge ${isBuy ? 'badge-buy' : 'badge-sell'}`}>{row.type}</span>
      </td>
      <td className="r">{formatUsd(row.unitPrice)}</td>
      <td className="r">{row.qty}</td>
      <td className={`r ${isBuy ? 'red' : 'blue'}`}>${formatUsd(Math.abs(row.settlement))}</td>
      {!isBuy && plData && (
        plData.hasBuyData && plData.pl !== null ? (
          <td className={`r ${plData.pl >= 0 ? 'pl-pos' : 'pl-neg'}`}>
            {plData.pl >= 0 ? '+' : '-'}${formatUsd(Math.abs(plData.pl))}
            {plData.plPct !== null && (
              <span className="pl-pct">
                ({plData.pl >= 0 ? '+' : ''}{plData.plPct.toFixed(1)}%)
              </span>
            )}
          </td>
        ) : (
          <td className="r pl-na">—</td>
        )
      )}
      <td className="r">${formatUsd(row.balance)}</td>
    </tr>
  );
}

export function TradeTable({ rows, plRows, side }: TradeTableProps) {
  const isBuy = side === 'buy';
  const total = rows.reduce((s, r) => s + Math.abs(r.settlement), 0);
  const plTotals = plRows ? calcTotalRealizedPL(plRows) : null;

  return (
    <div className="table-wrap">
      <table className="trade-table">
        <thead>
          <tr>
            <th className="col-text">거래일</th>
            <th className="col-text">종목명</th>
            <th className="col-text">거래유형</th>
            <th className="r">단가 (USD)</th>
            <th className="r">수량</th>
            <th className="r">{isBuy ? '매수금액' : '매도금액'}</th>
            {!isBuy && <th className="r">실현손익</th>}
            <th className="r">예수금잔고</th>
          </tr>
        </thead>
        <tbody id={`tbody-${side}`}>
          {rows.map((row, i) => (
            <TradeRowEl key={`${row.date}-${row.name}-${i}`} row={row} plData={plRows?.[i]} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={isBuy ? 5 : 5} className="col-text" id={`tfoot-${side}-label`}>
              합계 ({rows.length}건)
            </td>
            <td className={`r ${isBuy ? 'red' : 'blue'}`} id={`tfoot-${side}-total`}>
              ${formatUsd(total)}
            </td>
            {!isBuy && (
              <td
                className={`r ${
                  plTotals?.hasSomeData
                    ? plTotals.totalPL >= 0
                      ? 'red'
                      : 'blue'
                    : 'pl-na'
                }`}
                id="tfoot-sell-pl"
              >
                {plTotals?.hasSomeData
                  ? `${plTotals.totalPL >= 0 ? '+' : ''}$${formatUsd(plTotals.totalPL)}`
                  : '—'}
              </td>
            )}
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
