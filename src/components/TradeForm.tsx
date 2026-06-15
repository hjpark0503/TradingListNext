'use client';

import { useState } from 'react';
import { Entry, TradeType, Market } from '@/lib/types';
import { StockInput } from './StockInput';

interface TradeFormProps {
  market: Market;
  onMarketChange: (m: Market) => void;
  onAdd: (entry: Entry) => void;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function calcSettlement(type: TradeType, amt: number, fee: number, tax: number): number {
  if (type === 'buy')  return amt + fee + tax;
  if (type === 'sell') return amt - fee - tax;
  return amt;
}

function settlementLabel(type: TradeType): string {
  if (type === 'buy')  return '거래금액 + 수수료 + 세금';
  if (type === 'sell') return '거래금액 − 수수료 − 세금';
  return '거래금액 + 수수료 + 세금';
}

let toastTimeout: ReturnType<typeof setTimeout>;
function showToast(msg: string, kind: 'ok' | 'warn') {
  clearTimeout(toastTimeout);
  const existing = document.querySelectorAll('.toast');
  existing.forEach((el) => el.remove());
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  toastTimeout = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2500);
}

export function TradeForm({ market, onMarketChange, onAdd }: TradeFormProps) {
  const [date, setDate]     = useState(today);
  const [type, setType]     = useState<TradeType | ''>('buy');
  const [stock, setStock]   = useState('');
  const [detail, setDetail] = useState('');
  const [qty, setQty]       = useState('');
  const [price, setPrice]   = useState('');
  const [fee, setFee]       = useState('');
  const [tax, setTax]       = useState('');
  const [amount, setAmount] = useState('');

  const isTrade   = type === 'buy'  || type === 'sell';
  const isCash    = type === 'deposit' || type === 'withdraw';
  const isDiv     = type === 'div';
  const sym       = market === 'overseas' ? '$' : '₩';
  const cur       = market === 'overseas' ? 'USD' : 'KRW';

  function fmt(n: number) {
    if (market === 'domestic') return sym + Math.round(n).toLocaleString('ko-KR');
    return sym + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const qtyN    = parseFloat(qty)    || 0;
  const priceN  = parseFloat(price)  || 0;
  const feeN    = parseFloat(fee)    || 0;
  const taxN    = parseFloat(tax)    || 0;
  const amtN    = parseFloat(amount) || 0;

  let dispAmount = '—';
  let dispSettle = '—';
  let amtFormula = '수량 × 단가';
  let stlFormula = type ? settlementLabel(type as TradeType) : '매수: +수수료 +세금 / 매도: −수수료 −세금';

  if (isCash) {
    amtFormula = '직접 입력';
    stlFormula = '거래금액';
    if (amtN) { dispAmount = fmt(amtN); dispSettle = fmt(amtN); }
  } else if (isDiv) {
    amtFormula = '직접 입력';
    stlFormula = '거래금액 − 세금';
    if (amtN) dispAmount = fmt(amtN);
    if (amtN || taxN) dispSettle = fmt(amtN - taxN);
  } else if (isTrade) {
    const tradeAmt = qtyN * priceN;
    const tradeStl = calcSettlement(type as TradeType, tradeAmt, feeN, taxN);
    if (qtyN || priceN) dispAmount = fmt(tradeAmt);
    if (qtyN || priceN || feeN || taxN) dispSettle = fmt(tradeStl);
  }

  function handleTypeChange(t: TradeType) {
    // 타입 전환 시 관련 없는 필드 초기화
    if (t !== 'buy' && t !== 'sell') { setQty(''); setPrice(''); }
    if (t === 'deposit' || t === 'withdraw') { setFee(''); setTax(''); }
    else if (t === 'div') setFee('');
    if (t !== 'deposit' && t !== 'withdraw' && t !== 'div') setAmount('');
    setType(t);
  }

  function handleAdd() {
    if (!date)              { showToast('거래일을 입력해주세요.', 'warn'); return; }
    if (!type)              { showToast('거래유형을 선택해주세요.', 'warn'); return; }
    if ((isTrade || isDiv) && !stock.trim()) {
      showToast('종목명을 입력해주세요.', 'warn'); return;
    }

    let entryAmt: number, entryStl: number;
    let entryQty = qtyN, entryPrc = priceN, entryFee = feeN, entryTax = taxN;

    if (isCash) {
      if (!amtN) { showToast('거래금액을 입력해주세요.', 'warn'); return; }
      entryQty = 0; entryPrc = 0; entryFee = 0; entryTax = 0;
      entryAmt = amtN; entryStl = amtN;
    } else if (isDiv) {
      if (!amtN) { showToast('거래금액을 입력해주세요.', 'warn'); return; }
      entryQty = 0; entryPrc = 0; entryFee = 0;
      entryAmt = amtN; entryStl = amtN - entryTax;
    } else {
      entryAmt = entryQty * entryPrc;
      entryStl = calcSettlement(type as TradeType, entryAmt, entryFee, entryTax);
    }

    onAdd({
      id: Date.now(),
      date, type: type as TradeType, market,
      stock: stock.trim(), detail: detail.trim(),
      qty: entryQty, price: entryPrc, fee: entryFee, tax: entryTax,
      amount: entryAmt, settlement: entryStl,
    });
    showToast('내역이 추가되었습니다.', 'ok');
  }

  function handleReset(keepDate = false) {
    if (!keepDate) setDate(today());
    setStock(''); setDetail('');
    setQty(''); setPrice(''); setFee(''); setTax(''); setAmount('');
    setType('buy');
  }

  const TYPE_BTNS_ROW1: { id: TradeType; label: string }[] = [
    { id: 'buy', label: '매수' }, { id: 'sell', label: '매도' },
  ];
  const TYPE_BTNS_ROW2: { id: TradeType; label: string }[] = [
    { id: 'deposit', label: '입금' }, { id: 'withdraw', label: '출금' },
    { id: 'div', label: '배당금' },
  ];

  return (
    <aside className="form-aside">
      <div className="form-card">
        <div className="form-card-header">
          <span className="form-card-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            거래 직접 입력
          </span>
        </div>

        <div className="form-body">

          {/* 거래일 */}
          <div className="field">
            <label className="field-label" htmlFor="inp-date">거래일</label>
            <input type="date" id="inp-date" className="inp" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {/* 거래유형 */}
          <div className="field">
            <label className="field-label">거래유형</label>
            <div className="type-ctrl">
              <div className="type-ctrl-row">
                {TYPE_BTNS_ROW1.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`type-btn${type === b.id ? ' active' : ''}`}
                    data-type={b.id}
                    onClick={() => handleTypeChange(b.id)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <div className="type-ctrl-row">
                {TYPE_BTNS_ROW2.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`type-btn${type === b.id ? ' active' : ''}`}
                    data-type={b.id}
                    onClick={() => handleTypeChange(b.id)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 종류 (해외/국내) */}
          <div className="field">
            <label className="field-label">종류</label>
            <div className="seg-ctrl">
              {(['domestic', 'overseas'] as Market[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`seg-btn form-market-btn${market === m ? ' active' : ''}`}
                  data-mkt={m}
                  onClick={() => onMarketChange(m)}
                >
                  {m === 'domestic' ? '🇰🇷 국내' : '🌐 해외'}
                </button>
              ))}
            </div>
          </div>

          {/* 종목명 */}
          <div className="field" style={{ opacity: isCash ? 0.35 : 1 }}>
            <label className="field-label" htmlFor="inp-stock">종목명</label>
            <StockInput
              value={stock}
              onChange={setStock}
              market={market}
              disabled={isCash}
              placeholder={market === 'overseas' ? '예) Apple Inc / AAPL' : '예) 삼성전자'}
            />
          </div>

          {/* 상세내용 */}
          <div className="field">
            <label className="field-label" htmlFor="inp-detail">상세내용</label>
            <input type="text" id="inp-detail" className="inp" placeholder="메모 또는 참고사항"
              value={detail} onChange={(e) => setDetail(e.target.value)} />
          </div>

          <div className="field-divider" />

          {/* 거래금액 직접 입력 (입금/출금/배당금) */}
          {(isCash || isDiv) && (
            <div className="field">
              <label className="field-label" htmlFor="inp-amount">
                거래금액 <span className="currency-hint">{cur}</span>
              </label>
              <div className="inp-prefix-wrap">
                <span className="inp-prefix">{sym}</span>
                <input type="number" id="inp-amount" className="inp inp-num inp-prefixed"
                  placeholder="0.00" min={0} step="any"
                  value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </div>
          )}

          {/* 수량 + 단가 */}
          {isTrade && (
            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="inp-qty">수량</label>
                <input type="number" id="inp-qty" className="inp inp-num"
                  placeholder="0" min={0} step="any"
                  value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="inp-price">
                  단가 <span className="currency-hint">{cur}</span>
                </label>
                <div className="inp-prefix-wrap">
                  <span className="inp-prefix">{sym}</span>
                  <input type="number" id="inp-price" className="inp inp-num inp-prefixed"
                    placeholder="0.00" min={0} step="any"
                    value={price} onChange={(e) => setPrice(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* 수수료 + 세금 */}
          {!isCash && type && (
            <div className={`field-row${isDiv ? ' fee-tax--tax-only' : ''}`}>
              {isTrade && (
                <div className="field">
                  <label className="field-label" htmlFor="inp-fee">
                    수수료 <span className="currency-hint">{cur}</span>
                  </label>
                  <div className="inp-prefix-wrap">
                    <span className="inp-prefix">{sym}</span>
                    <input type="number" id="inp-fee" className="inp inp-num inp-prefixed"
                      placeholder="0.00" min={0} step="any"
                      value={fee} onChange={(e) => setFee(e.target.value)} />
                  </div>
                </div>
              )}
              {(isTrade || isDiv) && (
                <div className="field">
                  <label className="field-label" htmlFor="inp-tax">
                    세금 <span className="currency-hint">{cur}</span>
                  </label>
                  <div className="inp-prefix-wrap">
                    <span className="inp-prefix">{sym}</span>
                    <input type="number" id="inp-tax" className="inp inp-num inp-prefixed"
                      placeholder="0.00" min={0} step="any"
                      value={tax} onChange={(e) => setTax(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 자동계산 박스 */}
          {!isCash && (
            <div className="calc-box">
              {!isDiv && (
                <div className="calc-row">
                  <span className="calc-label">
                    거래금액
                    <span className="calc-formula">{amtFormula}</span>
                  </span>
                  <span className="calc-value">{dispAmount}</span>
                </div>
              )}
              <div className="calc-divider" />
              <div className="calc-row highlight">
                <span className="calc-label">
                  정산금액
                  <span className="calc-formula">{stlFormula}</span>
                </span>
                <span className="calc-value">{dispSettle}</span>
              </div>
            </div>
          )}

        </div>{/* /form-body */}

        <div className="form-footer">
          <button className="btn-ghost" onClick={() => handleReset()}>초기화</button>
          <button className="btn-primary" onClick={handleAdd}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            내역 추가
          </button>
        </div>
      </div>
    </aside>
  );
}
