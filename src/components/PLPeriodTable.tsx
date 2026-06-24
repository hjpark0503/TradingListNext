'use client';
import { useMemo, useState } from 'react';
import { Entry, Market } from '@/lib/types';
import { calcPLPeriodTable } from '@/lib/calculations';
import { formatUsd } from '@/lib/utils';

interface Props {
  entries: Entry[];
  market: Market;
}

export function PLPeriodTable({ entries, market }: Props) {
  const data = useMemo(() => calcPLPeriodTable(entries), [entries]);
  const years = useMemo(() => data.map((y) => y.label), [data]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const activeYear = selectedYear && years.includes(selectedYear) ? selectedYear : (years[0] ?? '');
  const yearData = useMemo(() => data.find((y) => y.label === activeYear), [data, activeYear]);

  function fmtPL(n: number): string {
    const prefix = n >= 0 ? '+' : '−';
    const abs = Math.abs(n);
    if (market === 'domestic') return `${prefix}₩${Math.round(abs).toLocaleString('ko-KR')}`;
    return `${prefix}$${formatUsd(abs)}`;
  }

  function fmtRate(pl: number, buyCost: number): string {
    if (buyCost === 0) return '';
    const rate = (pl / buyCost) * 100;
    const prefix = rate >= 0 ? '+' : '−';
    return `(${prefix}${Math.abs(rate).toFixed(1)}%)`;
  }

  function plCls(n: number) { return n >= 0 ? 'pl-pos' : 'pl-neg'; }

  if (data.length === 0) return null;
  if (!yearData) return null;

  const yearHasData = yearData.pl !== 0 || yearData.buyCost !== 0 || yearData.hasIncompleteData;

  return (
    <div className="plt-wrap">
      <div className="plt-title">
        <span>기간별 실현손익</span>
        <div className="plt-year-btns">
          {years.map((y) => (
            <button
              key={y}
              className={`plt-year-btn${activeYear === y ? ' active' : ''}`}
              onClick={() => setSelectedYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="plt-tree">
        <div className="plt-row plt-row--year">
          <span className="plt-row__label">
            {yearData.label}
            {yearData.hasIncompleteData && <span className="plt-warn">⚠</span>}
          </span>
          <span className={`plt-row__pl ${plCls(yearData.pl)}`}>
            {yearHasData ? fmtPL(yearData.pl) : '−'}
            {yearData.buyCost !== 0 && (
              <span className="plt-row__rate">{fmtRate(yearData.pl, yearData.buyCost)}</span>
            )}
          </span>
        </div>

        {yearData.halves.map((half) => {
          const halfHasData = half.pl !== 0 || half.buyCost !== 0 || half.hasIncompleteData;
          return (
            <div key={half.label}>
              <div className="plt-row plt-row--half">
                <span className={`plt-row__label${halfHasData ? '' : ' plt-row__label--empty'}`}>
                  {half.label}
                  {half.hasIncompleteData && <span className="plt-warn">⚠</span>}
                </span>
                {halfHasData ? (
                  <span className={`plt-row__pl ${plCls(half.pl)}`}>
                    {fmtPL(half.pl)}
                    {half.buyCost !== 0 && (
                      <span className="plt-row__rate">{fmtRate(half.pl, half.buyCost)}</span>
                    )}
                  </span>
                ) : (
                  <span className="plt-row__empty">−</span>
                )}
              </div>

              {half.quarters.map((quarter) => {
                const qHasData = quarter.pl !== 0 || quarter.buyCost !== 0 || quarter.hasIncompleteData;
                return (
                  <div key={quarter.label}>
                    <div className="plt-row plt-row--quarter">
                      <span className={`plt-row__label${qHasData ? '' : ' plt-row__label--empty'}`}>
                        {quarter.label}
                        {quarter.hasIncompleteData && <span className="plt-warn">⚠</span>}
                      </span>
                      {qHasData ? (
                        <span className={`plt-row__pl ${plCls(quarter.pl)}`}>
                          {fmtPL(quarter.pl)}
                          {quarter.buyCost !== 0 && (
                            <span className="plt-row__rate">{fmtRate(quarter.pl, quarter.buyCost)}</span>
                          )}
                        </span>
                      ) : (
                        <span className="plt-row__empty">−</span>
                      )}
                    </div>

                    {quarter.months.map((month) => {
                      const monthNum = parseInt(month.key.slice(5, 7), 10);
                      const monthHasData = month.pl !== 0 || month.buyCost !== 0 || month.hasIncompleteData;
                      return (
                        <div key={month.key} className="plt-row plt-row--month">
                          <span className={`plt-row__label${monthHasData ? '' : ' plt-row__label--empty'}`}>
                            {monthNum}월
                            {month.hasIncompleteData && <span className="plt-warn">⚠</span>}
                          </span>
                          {monthHasData ? (
                            <span className={`plt-row__pl ${plCls(month.pl)}`}>
                              {fmtPL(month.pl)}
                              {month.buyCost !== 0 && (
                                <span className="plt-row__rate">{fmtRate(month.pl, month.buyCost)}</span>
                              )}
                            </span>
                          ) : (
                            <span className="plt-row__empty">−</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
