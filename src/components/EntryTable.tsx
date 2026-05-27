'use client';

import { Entry, TradeType, Market } from '@/lib/types';

const TYPE_LABEL: Record<TradeType, string> = {
  buy: '매수', sell: '매도', deposit: '입금', withdraw: '출금', div: '배당금',
};
const TYPE_CLASS: Record<TradeType, string> = {
  buy: 'badge-buy', sell: 'badge-sell', deposit: 'badge-in', withdraw: 'badge-out', div: 'badge-div',
};

function fmtNum(n: number | undefined, mkt: Market): string {
  if (n === undefined || isNaN(n)) return '—';
  if (mkt === 'domestic') return '₩' + Math.round(n).toLocaleString('ko-KR');
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface EntryTableProps {
  entries: Entry[];
  panel: TradeType | 'all';
  emptyMsg: string;
  onDelete: (id: number) => void;
}

export function EntryTable({ entries, panel, emptyMsg, onDelete }: EntryTableProps) {
  const list = panel === 'all'
    ? [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    : entries.filter((e) => e.type === panel);

  const sumAmount     = list.reduce((s, e) => s + e.amount, 0);
  const sumFee        = list.reduce((s, e) => s + e.fee, 0);
  const sumTax        = list.reduce((s, e) => s + e.tax, 0);
  const sumSettlement = list.reduce((s, e) => s + e.settlement, 0);
  const mkt: Market   = list[0]?.market ?? 'domestic';

  if (list.length === 0) {
    return <div className="panel-empty">{emptyMsg}</div>;
  }

  return (
    <div className="table-wrap">
      <table className="trade-table">
        <thead>
          <tr>
            <th>거래일</th>
            <th>종류</th>
            <th>종목명</th>
            <th>거래유형</th>
            <th className="r">단가</th>
            <th className="r">수량</th>
            <th className="r">거래금액</th>
            <th className="r">수수료</th>
            <th className="r">세금</th>
            <th className="r">정산금액</th>
            <th className="c">삭제</th>
          </tr>
        </thead>
        <tbody>
          {list.map((e) => (
            <tr key={e.id} className="entry-row">
              <td className="col-text date-cell">{e.date}</td>
              <td className="col-text">
                <span className={`mkt-badge mkt-${e.market}`}>{e.market === 'overseas' ? '해외' : '국내'}</span>
              </td>
              <td className="col-text stock-cell">{e.stock || '—'}</td>
              <td className="col-text">
                <span className={`badge ${TYPE_CLASS[e.type]}`}>{TYPE_LABEL[e.type]}</span>
              </td>
              <td className="r">{e.price ? fmtNum(e.price, e.market) : '—'}</td>
              <td className="r">{e.qty ? e.qty.toLocaleString() : '—'}</td>
              <td className="r">{fmtNum(e.amount, e.market)}</td>
              <td className="r fee-cell">{fmtNum(e.fee, e.market)}</td>
              <td className="r tax-cell">{fmtNum(e.tax, e.market)}</td>
              <td className="r settle-cell">{fmtNum(e.settlement, e.market)}</td>
              <td className="c">
                <button className="btn-del" aria-label="삭제" onClick={() => onDelete(e.id)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6}>합계 ({list.length}건)</td>
            <td className="r">{fmtNum(sumAmount, mkt)}</td>
            <td className="r">{fmtNum(sumFee, mkt)}</td>
            <td className="r">{fmtNum(sumTax, mkt)}</td>
            <td className="r">{fmtNum(sumSettlement, mkt)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
