'use client';

import { useState, useCallback } from 'react';
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

export function useDashboard() {
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);

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
    loadEntries,
  };
}
