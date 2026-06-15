'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Entry, TradeType, Market } from '@/lib/types';
import { StockInput } from './StockInput';
import { fmtUsd, fmtKrw } from '@/lib/utils';

const TYPE_LABEL: Record<TradeType, string> = {
  buy: '매수', sell: '매도', deposit: '입금', withdraw: '출금', div: '배당금',
};
const TYPE_CLASS: Record<TradeType, string> = {
  buy: 'badge-buy', sell: 'badge-sell', deposit: 'badge-in', withdraw: 'badge-out', div: 'badge-div',
};
const TYPE_BTNS_ROW1: { id: TradeType; label: string }[] = [
  { id: 'buy', label: '매수' }, { id: 'sell', label: '매도' },
];
const TYPE_BTNS_ROW2: { id: TradeType; label: string }[] = [
  { id: 'deposit', label: '입금' }, { id: 'withdraw', label: '출금' }, { id: 'div', label: '배당금' },
];

function calcSettlement(type: TradeType, amt: number, fee: number, tax: number): number {
  if (type === 'buy')  return amt + fee + tax;
  if (type === 'sell') return amt - fee - tax;
  return amt;
}

function fmtNum(n: number | undefined, mkt: Market): string {
  if (n === undefined || isNaN(n)) return '—';
  return mkt === 'domestic' ? fmtKrw(n) : fmtUsd(n);
}

function fmtVal(n: number, mkt: Market): string {
  return mkt === 'domestic' ? fmtKrw(n) : fmtUsd(n);
}

interface DraftState {
  date: string; type: TradeType; market: Market;
  stock: string; detail: string;
  qty: string; price: string; fee: string; tax: string; amount: string;
}

function entryToDraft(e: Entry): DraftState {
  return {
    date: e.date, type: e.type, market: e.market,
    stock: e.stock, detail: e.detail,
    qty:    e.qty    ? String(e.qty)    : '',
    price:  e.price  ? String(e.price)  : '',
    fee:    e.fee    ? String(e.fee)    : '',
    tax:    e.tax    ? String(e.tax)    : '',
    amount: e.amount ? String(e.amount) : '',
  };
}

interface EntryTableProps {
  entries: Entry[];
  panel: TradeType | 'all';
  emptyMsg: string;
  onDelete: (id: number) => void;
  onUpdate: (entry: Entry) => void;
  isSelectMode: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: (ids: number[]) => void;
}

export function EntryTable({ entries, panel, emptyMsg, onDelete, onUpdate, isSelectMode, selectedIds, onToggleSelect, onToggleSelectAll }: EntryTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft]         = useState<DraftState | null>(null);

  const list = panel === 'all'
    ? [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    : entries.filter((e) => e.type === panel);

  const sumAmount     = list.reduce((s, e) => s + e.amount, 0);
  const sumFee        = list.reduce((s, e) => s + e.fee, 0);
  const sumTax        = list.reduce((s, e) => s + e.tax, 0);
  const sumSettlement = list.reduce((s, e) => s + e.settlement, 0);
  const mkt: Market   = list[0]?.market ?? 'domestic';

  const typeSums = panel === 'all'
    ? (['buy', 'sell', 'deposit', 'withdraw', 'div'] as TradeType[]).flatMap((type) => {
        const sub = list.filter((e) => e.type === type);
        if (sub.length === 0) return [];
        return [{
          type,
          count:      sub.length,
          amount:     sub.reduce((s, e) => s + e.amount, 0),
          fee:        sub.reduce((s, e) => s + e.fee, 0),
          tax:        sub.reduce((s, e) => s + e.tax, 0),
          settlement: sub.reduce((s, e) => s + e.settlement, 0),
        }];
      })
    : [];

  const allSelected  = list.length > 0 && list.every((e) => selectedIds.has(e.id));
  const someInPanel  = list.some((e) => selectedIds.has(e.id));

  function handleSelectAll() {
    if (allSelected) {
      onToggleSelectAll([]);
    } else {
      onToggleSelectAll(list.map((e) => e.id));
    }
  }

  // Modal derived state
  const d       = draft;
  const isTrade = d?.type === 'buy' || d?.type === 'sell';
  const isCash  = d?.type === 'deposit' || d?.type === 'withdraw';
  const isDiv   = d?.type === 'div';
  const sym     = d?.market === 'overseas' ? '$' : '₩';
  const cur     = d?.market === 'overseas' ? 'USD' : 'KRW';

  let modalSettle = '—';
  if (d) {
    const qtyN = parseFloat(d.qty) || 0, priceN = parseFloat(d.price) || 0;
    const feeN = parseFloat(d.fee) || 0, taxN   = parseFloat(d.tax)   || 0;
    const amtN = parseFloat(d.amount) || 0;
    if (isCash && amtN)          modalSettle = fmtVal(amtN, d.market);
    else if (isDiv)              modalSettle = fmtVal(amtN - taxN, d.market);
    else if (isTrade)            modalSettle = fmtVal(calcSettlement(d.type, qtyN * priceN, feeN, taxN), d.market);
  }

  function openEdit(e: Entry) {
    setEditingId(e.id);
    setDraft(entryToDraft(e));
  }

  function closeEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function handleTypeChange(newType: TradeType) {
    if (!draft) return;
    const u: Partial<DraftState> = { type: newType };
    if (newType !== 'buy' && newType !== 'sell')             { u.qty = ''; u.price = ''; }
    if (newType === 'deposit' || newType === 'withdraw')     { u.fee = ''; u.tax = ''; }
    else if (newType === 'div')                              { u.fee = ''; }
    if (newType !== 'deposit' && newType !== 'withdraw' && newType !== 'div') u.amount = '';
    setDraft({ ...draft, ...u });
  }

  function handleSave() {
    if (!draft || editingId === null) return;
    const dd = draft;
    const isT = dd.type === 'buy' || dd.type === 'sell';
    const isC = dd.type === 'deposit' || dd.type === 'withdraw';
    const isDv = dd.type === 'div';
    const qtyN = parseFloat(dd.qty) || 0, priceN = parseFloat(dd.price) || 0;
    const feeN = parseFloat(dd.fee) || 0, taxN   = parseFloat(dd.tax)   || 0;
    const amtN = parseFloat(dd.amount) || 0;
    let entryAmt: number, entryStl: number;
    let entryQty = qtyN, entryPrc = priceN, entryFee = feeN, entryTax = taxN;
    if (isC) {
      entryQty = 0; entryPrc = 0; entryFee = 0; entryTax = 0;
      entryAmt = amtN; entryStl = amtN;
    } else if (isDv) {
      entryQty = 0; entryPrc = 0; entryFee = 0;
      entryAmt = amtN; entryStl = amtN - entryTax;
    } else {
      entryAmt = entryQty * entryPrc;
      entryStl = calcSettlement(dd.type, entryAmt, entryFee, entryTax);
    }
    onUpdate({
      id: editingId,
      date: dd.date, type: dd.type, market: dd.market,
      stock: dd.stock.trim(), detail: dd.detail.trim(),
      qty: entryQty, price: entryPrc, fee: entryFee, tax: entryTax,
      amount: entryAmt, settlement: entryStl,
    });
    closeEdit();
  }

  const modal = d && editingId !== null ? createPortal(
    <div className="modal-overlay" onClick={closeEdit}>
      <div className="modal-card" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">거래 수정</span>
          <button className="btn-close" aria-label="닫기" onClick={closeEdit}>×</button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label className="field-label">거래일</label>
            <input type="date" className="inp" value={d.date}
              onChange={(e) => setDraft({ ...d, date: e.target.value })} />
          </div>

          <div className="field">
            <label className="field-label">거래유형</label>
            <div className="type-ctrl">
              <div className="type-ctrl-row">
                {TYPE_BTNS_ROW1.map((b) => (
                  <button key={b.id} type="button"
                    className={`type-btn${d.type === b.id ? ' active' : ''}`}
                    onClick={() => handleTypeChange(b.id)}>
                    {b.label}
                  </button>
                ))}
              </div>
              <div className="type-ctrl-row">
                {TYPE_BTNS_ROW2.map((b) => (
                  <button key={b.id} type="button"
                    className={`type-btn${d.type === b.id ? ' active' : ''}`}
                    onClick={() => handleTypeChange(b.id)}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="field">
            <label className="field-label">종류</label>
            <div className="seg-ctrl">
              {(['domestic', 'overseas'] as Market[]).map((m) => (
                <button key={m} type="button"
                  className={`seg-btn${d.market === m ? ' active' : ''}`}
                  onClick={() => setDraft({ ...d, market: m })}>
                  {m === 'domestic' ? '🇰🇷 국내' : '🌐 해외'}
                </button>
              ))}
            </div>
          </div>

          <div className="field" style={{ opacity: isCash ? 0.35 : 1 }}>
            <label className="field-label">종목명</label>
            <StockInput
              value={d.stock}
              onChange={(v) => setDraft({ ...d, stock: v })}
              market={d.market}
              disabled={isCash}
              placeholder={d.market === 'overseas' ? '예) Apple Inc / AAPL' : '예) 삼성전자'}
            />
          </div>

          <div className="field">
            <label className="field-label">상세내용</label>
            <input type="text" className="inp" placeholder="메모 또는 참고사항"
              value={d.detail}
              onChange={(e) => setDraft({ ...d, detail: e.target.value })} />
          </div>

          <div className="field-divider" />

          {(isCash || isDiv) && (
            <div className="field">
              <label className="field-label">거래금액 <span className="currency-hint">{cur}</span></label>
              <div className="inp-prefix-wrap">
                <span className="inp-prefix">{sym}</span>
                <input type="number" className="inp inp-num inp-prefixed"
                  placeholder="0.00" min={0} step="any" value={d.amount}
                  onChange={(e) => setDraft({ ...d, amount: e.target.value })} />
              </div>
            </div>
          )}

          {isTrade && (
            <div className="field-row">
              <div className="field">
                <label className="field-label">수량</label>
                <input type="number" className="inp inp-num"
                  placeholder="0" min={0} step="any" value={d.qty}
                  onChange={(e) => setDraft({ ...d, qty: e.target.value })} />
              </div>
              <div className="field">
                <label className="field-label">단가 <span className="currency-hint">{cur}</span></label>
                <div className="inp-prefix-wrap">
                  <span className="inp-prefix">{sym}</span>
                  <input type="number" className="inp inp-num inp-prefixed"
                    placeholder="0.00" min={0} step="any" value={d.price}
                    onChange={(e) => setDraft({ ...d, price: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {isTrade && (
            <div className="field-row">
              <div className="field">
                <label className="field-label">수수료 <span className="currency-hint">{cur}</span></label>
                <div className="inp-prefix-wrap">
                  <span className="inp-prefix">{sym}</span>
                  <input type="number" className="inp inp-num inp-prefixed"
                    placeholder="0.00" min={0} step="any" value={d.fee}
                    onChange={(e) => setDraft({ ...d, fee: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label className="field-label">세금 <span className="currency-hint">{cur}</span></label>
                <div className="inp-prefix-wrap">
                  <span className="inp-prefix">{sym}</span>
                  <input type="number" className="inp inp-num inp-prefixed"
                    placeholder="0.00" min={0} step="any" value={d.tax}
                    onChange={(e) => setDraft({ ...d, tax: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {isDiv && (
            <div className="field">
              <label className="field-label">세금 <span className="currency-hint">{cur}</span></label>
              <div className="inp-prefix-wrap">
                <span className="inp-prefix">{sym}</span>
                <input type="number" className="inp inp-num inp-prefixed"
                  placeholder="0.00" min={0} step="any" value={d.tax}
                  onChange={(e) => setDraft({ ...d, tax: e.target.value })} />
              </div>
            </div>
          )}

          <div className="calc-box">
            <div className="calc-row highlight">
              <span className="calc-label">
                정산금액
                <span className="calc-formula">자동 계산</span>
              </span>
              <span className="calc-value">{modalSettle}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-danger" onClick={() => { onDelete(editingId); closeEdit(); }}>삭제</button>
          <div className="modal-footer-right">
            <button className="btn-ghost" onClick={closeEdit}>취소</button>
            <button className="btn-primary" onClick={handleSave}>저장</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {list.length === 0 ? (
        <div className="panel-empty">{emptyMsg}</div>
      ) : (
        <div className="table-wrap">
            <table className="trade-table">
              <thead>
                <tr>
                  <th>거래일</th>
                  <th>종목명</th>
                  <th>거래유형</th>
                  <th className="r">단가</th>
                  <th className="r">수량</th>
                  <th className="r">거래금액</th>
                  <th className="r">수수료</th>
                  <th className="r">세금</th>
                  <th className="r">정산금액</th>
                  {isSelectMode && (
                    <th className="col-check">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someInPanel && !allSelected; }}
                        onChange={handleSelectAll}
                      />
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className={`entry-row entry-row--clickable${selectedIds.has(e.id) ? ' entry-row--selected' : ''}`} onClick={() => openEdit(e)}>
                    <td className="col-text date-cell">{e.date}</td>
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
                    {isSelectMode && (
                      <td className="col-check" onClick={(ev) => ev.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(e.id)} onChange={() => onToggleSelect(e.id)} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {panel !== 'all' && (
                <tfoot>
                  <tr>
                    <td colSpan={5}>합계 ({list.length}건)</td>
                    <td className="r">{fmtNum(sumAmount, mkt)}</td>
                    <td className="r">{fmtNum(sumFee, mkt)}</td>
                    <td className="r">{fmtNum(sumTax, mkt)}</td>
                    <td className="r">{fmtNum(sumSettlement, mkt)}</td>
                    {isSelectMode && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
      )}

      {typeSums.length > 0 && (
        <div className="type-summary-section">
          <ul className="type-summary-list">
            {typeSums.map((ts) => (
              <li key={ts.type} className="type-summary-item">
                <div className="type-summary-item__left">
                  <span className={`badge ${TYPE_CLASS[ts.type]}`}>{TYPE_LABEL[ts.type]}</span>
                  <span className="type-summary-count">{ts.count}건</span>
                </div>
                <span className="type-summary-settle">{fmtNum(ts.settlement, mkt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {modal}
    </>
  );
}
