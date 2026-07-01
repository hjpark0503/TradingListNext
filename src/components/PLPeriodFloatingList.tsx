'use client';
import { useMemo, useState } from 'react';
import { Entry, Market } from '@/lib/types';
import { calcPLPeriodTable, calcDividendPeriodTable } from '@/lib/calculations';
import { formatUsd } from '@/lib/utils';

interface Props {
  entries: Entry[];
  market: Market;
  selectedYear?: string;
  metric?: 'realized' | 'dividend';
}

function hasData(item: { pl: number; buyCost: number; hasIncompleteData: boolean }) {
  return item.pl !== 0 || item.buyCost !== 0 || item.hasIncompleteData;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="rpl-chevron"
      width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', flexShrink: 0 }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function PLPeriodFloatingList({ entries, market, selectedYear, metric = 'realized' }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const title     = metric === 'dividend' ? '배당수익 요약' : '실현손익 요약';
  const emptyText = metric === 'dividend' ? '배당 내역이 없습니다.' : '매도 내역이 없습니다.';
  const plLabel   = metric === 'dividend' ? '배당금' : '실현손익';
  const data = useMemo(() => {
    const all = metric === 'dividend' ? calcDividendPeriodTable(entries) : calcPLPeriodTable(entries);
    if (!selectedYear || selectedYear === '전체') return all;
    return all.filter((y) => y.label === selectedYear);
  }, [entries, selectedYear, metric]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function fmtPL(n: number): string {
    const prefix = n >= 0 ? '+' : '−';
    const abs = Math.abs(n);
    if (market === 'domestic') return `${prefix}₩${Math.round(abs).toLocaleString('ko-KR')}`;
    return `${prefix}$${formatUsd(abs)}`;
  }

  function fmtRate(pl: number, buyCost: number): string {
    if (buyCost === 0) return '';
    const r = (pl / buyCost) * 100;
    return `${r >= 0 ? '+' : ''}${r.toFixed(1)}%`;
  }

  function plCls(n: number) {
    if (metric === 'dividend') return 'pl-div';
    return n >= 0 ? 'pl-pos' : 'pl-neg';
  }

  const hasSells = data.some((y) => hasData(y));

  return (
    <div className={`rpl-panel plfl-panel${metric === 'dividend' ? ' plfl-panel--dividend' : ''}`}>
      <div className="rpl-header">
        <span className="rpl-title">{title}</span>
      </div>

      {!hasSells ? (
        <div className="panel-empty">{emptyText}</div>
      ) : (
        <div className="rpl-list-col">
          <div className="rpl-col-header">
            <span className="rpl-col-label">기간</span>
            <span className="rpl-col-label rpl-col-label--right">{plLabel}</span>
          </div>
          {data.map((year) => {
            const yHasData  = hasData(year);
            const yExpanded = expanded.has(year.label);
            return (
              <div key={year.label} className="rpl-group">

                {/* ── 연도 행 ── */}
                <button
                  className={`rpl-parent${yExpanded ? ' open' : ''}${!yHasData ? ' plfl-row-disabled' : ''}`}
                  onClick={() => yHasData && toggle(year.label)}
                  disabled={!yHasData}
                >
                  <span className="rpl-parent__left">
                    <span className="rpl-parent__key">{year.label}년</span>
                    {year.hasIncompleteData && <span className="rpl-parent__sub">⚠ 누락</span>}
                  </span>
                  {yHasData ? (
                    <span className="rpl-parent__pl-wrap">
                      <span className={`rpl-parent__pl ${plCls(year.pl)}`}>{fmtPL(year.pl)}</span>
                      {year.buyCost !== 0 && (
                        <span className={`rpl-rate ${plCls(year.pl)}`}>({fmtRate(year.pl, year.buyCost)})</span>
                      )}
                    </span>
                  ) : (
                    <span className="rpl-parent__pl pl-na">−</span>
                  )}
                  {yHasData && <ChevronIcon open={yExpanded} />}
                </button>

                {yHasData && yExpanded && (
                  <div className="rpl-children plfl-level1">
                    {year.halves.map((half) => {
                      const hKey      = `${year.label}-${half.label}`;
                      const hHasData  = hasData(half);
                      const hExpanded = expanded.has(hKey);
                      return (
                        <div key={hKey}>

                          {/* ── 반기 행 ── */}
                          <button
                            className={`plfl-sub${hExpanded ? ' open' : ''}${!hHasData ? ' plfl-row-disabled' : ''}`}
                            onClick={() => hHasData && toggle(hKey)}
                            disabled={!hHasData}
                          >
                            <span className="plfl-sub__label">{half.label}</span>
                            {hHasData ? (
                              <span className="rpl-parent__pl-wrap">
                                <span className={`plfl-sub__pl ${plCls(half.pl)}`}>{fmtPL(half.pl)}</span>
                                {half.buyCost !== 0 && (
                                  <span className={`rpl-rate ${plCls(half.pl)}`}>({fmtRate(half.pl, half.buyCost)})</span>
                                )}
                              </span>
                            ) : (
                              <span className="plfl-sub__empty">−</span>
                            )}
                            {hHasData && <ChevronIcon open={hExpanded} />}
                          </button>

                          {hHasData && hExpanded && (
                            <div className="plfl-level2">
                              {half.quarters.map((quarter) => {
                                const qKey      = `${hKey}-${quarter.label}`;
                                const qHasData  = hasData(quarter);
                                const qExpanded = expanded.has(qKey);
                                return (
                                  <div key={qKey}>

                                    {/* ── 분기 행 ── */}
                                    <button
                                      className={`plfl-sub plfl-sub--quarter${qExpanded ? ' open' : ''}${!qHasData ? ' plfl-row-disabled' : ''}`}
                                      onClick={() => qHasData && toggle(qKey)}
                                      disabled={!qHasData}
                                    >
                                      <span className="plfl-sub__label">{quarter.label}</span>
                                      {qHasData ? (
                                        <span className="rpl-parent__pl-wrap">
                                          <span className={`plfl-sub__pl ${plCls(quarter.pl)}`}>{fmtPL(quarter.pl)}</span>
                                          {quarter.buyCost !== 0 && (
                                            <span className={`rpl-rate ${plCls(quarter.pl)}`}>({fmtRate(quarter.pl, quarter.buyCost)})</span>
                                          )}
                                        </span>
                                      ) : (
                                        <span className="plfl-sub__empty">−</span>
                                      )}
                                      {qHasData && <ChevronIcon open={qExpanded} />}
                                    </button>

                                    {qHasData && qExpanded && (
                                      <div className="plfl-level3">
                                        {quarter.months.map((month) => {
                                          const monthNum = parseInt(month.key.slice(5, 7), 10);
                                          const mHasData = hasData(month);
                                          return (
                                            <div
                                              key={month.key}
                                              className={`plfl-leaf${!mHasData ? ' plfl-row-disabled' : ''}`}
                                            >
                                              <span className="plfl-leaf__label">{monthNum}월</span>
                                              {mHasData ? (
                                                <span className="rpl-parent__pl-wrap">
                                                  <span className={`plfl-leaf__pl ${plCls(month.pl)}`}>{fmtPL(month.pl)}</span>
                                                  {month.buyCost !== 0 && (
                                                    <span className={`rpl-rate ${plCls(month.pl)}`}>({fmtRate(month.pl, month.buyCost)})</span>
                                                  )}
                                                </span>
                                              ) : (
                                                <span className="plfl-leaf__empty">−</span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
