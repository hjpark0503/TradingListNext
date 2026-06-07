'use client';

import { useMemo, useState } from 'react';
import { Entry } from '@/lib/types';
import { calcCapitalGains } from '@/lib/calculations';
import { formatUsd } from '@/lib/utils';

interface Props {
  entries: Entry[];
  exchangeRate: number;
  setExchangeRate: (rate: number) => void;
}

const CURRENT_YEAR = new Date().getFullYear();

function fmtKrw(n: number) {
  return '₩' + Math.round(Math.abs(n)).toLocaleString('ko-KR');
}

function signedFmtKrw(n: number) {
  return (n < 0 ? '−' : '') + fmtKrw(n);
}

function signedFmtUsd(n: number) {
  return (n < 0 ? '−' : '') + '$' + formatUsd(Math.abs(n));
}

function plClass(n: number | null) {
  if (n === null) return '';
  return n > 0 ? 'cg-pos' : n < 0 ? 'cg-neg' : '';
}

export function CapitalGainsTax({ entries, exchangeRate, setExchangeRate }: Props) {
  const availableYears = useMemo(() => {
    const years = new Set<number>([CURRENT_YEAR]);
    entries
      .filter((e) => e.market === 'overseas' && e.type === 'sell')
      .forEach((e) => {
        const y = parseInt(e.date.slice(0, 4), 10);
        if (!isNaN(y)) years.add(y);
      });
    return Array.from(years).sort((a, b) => b - a);
  }, [entries]);

  const [year, setYear] = useState(CURRENT_YEAR);
  const [rateInput, setRateInput] = useState(String(exchangeRate));

  const summary = useMemo(
    () => calcCapitalGains(entries, year, exchangeRate),
    [entries, year, exchangeRate]
  );

  return (
    <div className="cap-gains">
      <div className="cap-gains__header">
        <span className="cap-gains__title">양도세 계산기</span>
        <div className="cap-gains__header-controls">
          <div className="cap-gains__rate-row">
            <span className="cap-gains__rate-label">환율</span>
            <span className="overseas-panel__sym">₩</span>
            <input
              type="number"
              className="rate-input"
              value={rateInput}
              min={100}
              max={9999}
              step={1}
              aria-label="환율 (원/USD)"
              onChange={(e) => { setRateInput(e.target.value); const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 100) setExchangeRate(v); }}
              onBlur={() => { const v = parseFloat(rateInput); if (isNaN(v) || v < 100) setRateInput(String(exchangeRate)); }}
            />
            <span className="overseas-panel__unit">/ USD</span>
          </div>
          <select
            className="cap-gains__year-sel inp"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>
      </div>

      {summary.rows.length === 0 ? (
        <div className="cap-gains__empty">{year}년 해외주식 매도 내역이 없습니다.</div>
      ) : (
        <>
          <div className="cap-gains__table-wrap">
            <table className="cap-gains__table">
              <thead>
                <tr>
                  <th>종목</th>
                  <th className="r">매도수량</th>
                  <th className="r">매도금액</th>
                  <th className="r">매수원가</th>
                  <th className="r">손익 (USD)</th>
                  <th className="r">손익 (KRW)</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => (
                  <tr key={row.stock}>
                    <td className="cap-gains__stock">{row.stock}</td>
                    <td className="r">{row.sellQty.toLocaleString('en-US')}</td>
                    <td className="r">${formatUsd(row.sellProceedsUsd)}</td>
                    <td className="r">
                      {row.hasBuyData
                        ? `$${formatUsd(row.buyCostUsd!)}`
                        : <span className="cap-gains__no-data">매수 없음</span>}
                    </td>
                    <td className={`r ${plClass(row.plUsd)}`}>
                      {row.plUsd !== null ? signedFmtUsd(row.plUsd) : '—'}
                    </td>
                    <td className={`r ${plClass(row.plKrw)}`}>
                      {row.plKrw !== null ? signedFmtKrw(row.plKrw) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {summary.hasIncompleteData && (
            <div className="cap-gains__warn">
              ⚠️ 매수 내역이 없는 종목은 세금 계산에서 제외됩니다.
            </div>
          )}

          <div className="cap-gains__summary">
            <div className="cap-gains__sum-row">
              <span className="cap-gains__sum-label">총 양도차익</span>
              <span className={`cap-gains__sum-val ${plClass(summary.totalPlKrw)}`}>
                {signedFmtKrw(summary.totalPlKrw)}
              </span>
            </div>
            <div className="cap-gains__sum-row">
              <span className="cap-gains__sum-label">기본공제</span>
              <span className="cap-gains__sum-val cap-gains__sum-deduct">−₩2,500,000</span>
            </div>
            <div className="cap-gains__sum-divider" />
            <div className="cap-gains__sum-row">
              <span className="cap-gains__sum-label">과세표준</span>
              <span className="cap-gains__sum-val">
                {summary.taxableKrw > 0 ? fmtKrw(summary.taxableKrw) : '해당없음'}
              </span>
            </div>
            <div className="cap-gains__sum-row cap-gains__sum-row--tax">
              <span className="cap-gains__sum-label cap-gains__tax-label">예상 양도세 (22%)</span>
              <span className={`cap-gains__sum-val ${summary.estimatedTaxKrw > 0 ? 'cg-tax' : ''}`}>
                {summary.estimatedTaxKrw > 0 ? fmtKrw(summary.estimatedTaxKrw) : '없음'}
              </span>
            </div>
          </div>

          <div className="cap-gains__note">
            * 가중평균법 기준 · 기본공제 ₩2,500,000 · 세율 22% (소득세 20% + 지방세 2%)
          </div>
        </>
      )}
    </div>
  );
}
