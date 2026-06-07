'use client';

import { useState, useCallback, useEffect } from 'react';
import { Market, Entry } from '@/lib/types';

export interface DashboardState {
  exchangeRate: number;
  activeTab: string;
  currentMarket: Market;
  entries: Entry[];
}

const INITIAL_STATE: DashboardState = {
  exchangeRate: 1350,
  activeTab: 'all',
  currentMarket: 'domestic',
  entries: [],
};

const LS_ENTRIES = 'tradinglist_entries';
const LS_RATE = 'tradinglist_exchangeRate';

export function useDashboard() {
  const [state, setState] = useState<DashboardState>(() => {
    try {
      const raw = localStorage.getItem(LS_ENTRIES);
      const rate = localStorage.getItem(LS_RATE);
      return {
        ...INITIAL_STATE,
        entries: raw ? (JSON.parse(raw) as Entry[]) : [],
        exchangeRate: rate ? Number(rate) : 1350,
      };
    } catch {
      return INITIAL_STATE;
    }
  });

  useEffect(() => {
    localStorage.setItem(LS_ENTRIES, JSON.stringify(state.entries));
  }, [state.entries]);

  useEffect(() => {
    localStorage.setItem(LS_RATE, String(state.exchangeRate));
  }, [state.exchangeRate]);

  const setExchangeRate = useCallback((rate: number) => {
    setState((prev) => ({ ...prev, exchangeRate: rate }));
  }, []);

  const switchTab = useCallback((tab: string) => {
    setState((prev) => ({ ...prev, activeTab: tab }));
  }, []);

  const switchMarket = useCallback((market: Market) => {
    setState((prev) => ({ ...prev, currentMarket: market }));
  }, []);

  const addEntry = useCallback((entry: Entry) => {
    setState((prev) => ({ ...prev, entries: [...prev.entries, entry], activeTab: entry.type }));
  }, []);

  const deleteEntry = useCallback((id: number) => {
    setState((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.id !== id) }));
  }, []);

  const updateEntry = useCallback((entry: Entry) => {
    setState((prev) => ({
      ...prev,
      entries: prev.entries.map((e) => (e.id === entry.id ? entry : e)),
    }));
  }, []);

  const loadEntries = useCallback((entries: Entry[]) => {
    setState((prev) => ({ ...prev, entries, activeTab: 'all' }));
  }, []);

  return {
    state,
    setExchangeRate,
    switchTab,
    switchMarket,
    addEntry,
    deleteEntry,
    updateEntry,
    loadEntries,
  };
}
