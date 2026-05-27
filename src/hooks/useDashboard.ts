'use client';

import { useState, useCallback } from 'react';
import { TradeRow, PLRow, PLTotals, Market, Entry } from '@/lib/types';
import { calcRealizedPLRows, calcTotalRealizedPL, calcEstimatedTax } from '@/lib/calculations';
import { parseFromLines } from '@/lib/parser';
import { extractLogicalLinesFromPdf, isLikelyImageOnlyPdf, extractLogicalLinesViaOcr } from '@/lib/extractor';

export interface DashboardState {
  buys: TradeRow[];
  sells: TradeRow[];
  plRows: PLRow[];
  plTotals: PLTotals;
  exchangeRate: number;
  estimatedTax: number;
  activeTab: string;
  currentMarket: Market;
  loading: boolean;
  loadingMessage: string;
  headerMeta: string;
  headerSub: string;
  entries: Entry[];
}

const INITIAL_STATE: DashboardState = {
  buys: [],
  sells: [],
  plRows: [],
  plTotals: { totalPL: 0, totalBuyCost: 0, plPct: null, hasSomeData: false },
  exchangeRate: 1350,
  estimatedTax: 0,
  activeTab: 'all',
  currentMarket: 'domestic',
  loading: false,
  loadingMessage: '',
  headerMeta: '',
  headerSub: '',
  entries: [],
};

export function useDashboard() {
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);
  const [tradesByMarket, setTradesByMarket] = useState<Record<Market, { buys: TradeRow[]; sells: TradeRow[] }>>({
    overseas: { buys: [], sells: [] },
    domestic: { buys: [], sells: [] },
  });

  const updateFromTrades = useCallback((buys: TradeRow[], sells: TradeRow[], exchangeRate?: number) => {
    setState((prev) => {
      const rate = exchangeRate ?? prev.exchangeRate;
      const plRows = calcRealizedPLRows(buys, sells);
      const plTotals = calcTotalRealizedPL(plRows);
      const estimatedTax = calcEstimatedTax(plTotals.totalPL, rate);
      return { ...prev, buys, sells, plRows, plTotals, estimatedTax, exchangeRate: rate };
    });
  }, []);

  const handlePdfFile = useCallback(
    async (file: File) => {
      if (!file || !/\.pdf$/i.test(file.name)) {
        alert('PDF 파일만 업로드할 수 있습니다.');
        return;
      }
      setState((prev) => ({ ...prev, loading: true, loadingMessage: 'PDF 읽는 중…' }));
      try {
        const buf = await file.arrayBuffer();
        const bufForOcr = buf.slice(0);
        let lines = await extractLogicalLinesFromPdf(buf);
        let extractMode = 'text';
        let trades = parseFromLines(lines);

        if (
          trades.length === 0 &&
          (isLikelyImageOnlyPdf(lines) || !lines.some((l) => /해외주식매[수도]/.test(l)))
        ) {
          setState((prev) => ({ ...prev, loadingMessage: '스캔 PDF 감지 — OCR 준비 중… (1~2분 소요)' }));
          lines = await extractLogicalLinesViaOcr(bufForOcr, (msg) => {
            setState((prev) => ({ ...prev, loadingMessage: msg }));
          });
          extractMode = 'ocr';
          trades = parseFromLines(lines);
        }

        const buys  = trades.filter((t) => t.type === '해외주식매수');
        const sells = trades.filter((t) => t.type === '해외주식매도');

        if (trades.length === 0) {
          alert(
            extractMode === 'ocr'
              ? 'OCR 후에도 거래 행을 찾지 못했습니다. PDF 해상도·표 형식을 확인하거나, 텍스트 포함 PDF로 다시 발급해 보세요.'
              : '거래 행을 찾지 못했습니다. 신한투자증권 해외주식 매수·매도 형식이 다르거나, 스캔 PDF일 수 있습니다.'
          );
        }

        setState((prev) => {
          const rate = prev.exchangeRate;
          const plRows = calcRealizedPLRows(buys, sells);
          const plTotals = calcTotalRealizedPL(plRows);
          const estimatedTax = calcEstimatedTax(plTotals.totalPL, rate);
          const dates = trades.map((t) => t.date).filter(Boolean).sort();
          const headerSub = dates.length > 0 ? `📅 ${dates[0]} ~ ${dates[dates.length - 1]} · 해외주식 전체` : '';
          const now = new Date();
          const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const modeLabel = extractMode === 'ocr' ? 'OCR(이미지 PDF)' : '텍스트';
          const headerMeta = `파일: ${file.name} | 분석 시각: ${today} | 추출 방식: ${modeLabel} | 추출된 매매 행: ${trades.length}건`;
          return { ...prev, buys, sells, plRows, plTotals, estimatedTax, loading: false, loadingMessage: '', headerSub, headerMeta };
        });

        setTradesByMarket((prev) => ({
          ...prev,
          [state.currentMarket]: { buys, sells },
        }));
      } catch (e) {
        console.error(e);
        alert('PDF 분석 중 오류가 발생했습니다: ' + ((e as Error)?.message ?? String(e)));
        setState((prev) => ({ ...prev, loading: false, loadingMessage: '' }));
      }
    },
    [state.currentMarket]
  );

  const setExchangeRate = useCallback((rate: number) => {
    setState((prev) => {
      const estimatedTax = calcEstimatedTax(prev.plTotals.totalPL, rate);
      return { ...prev, exchangeRate: rate, estimatedTax };
    });
  }, []);

  const switchTab = useCallback((tab: string) => {
    setState((prev) => ({ ...prev, activeTab: tab }));
  }, []);

  const switchMarket = useCallback(
    (market: Market) => {
      setState((prev) => ({ ...prev, currentMarket: market }));
      const d = tradesByMarket[market];
      if (d.buys.length || d.sells.length) updateFromTrades(d.buys, d.sells);
    },
    [tradesByMarket, updateFromTrades]
  );

  const addEntry = useCallback((entry: Entry) => {
    setState((prev) => ({ ...prev, entries: [...prev.entries, entry], activeTab: entry.type }));
  }, []);

  const deleteEntry = useCallback((id: number) => {
    setState((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.id !== id) }));
  }, []);

  return {
    state,
    handlePdfFile,
    setExchangeRate,
    switchTab,
    switchMarket,
    addEntry,
    deleteEntry,
  };
}
