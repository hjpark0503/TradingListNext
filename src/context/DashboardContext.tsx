'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Market, Entry } from '@/lib/types';

export interface DashboardState {
  exchangeRate: number;
  activeTab: string;
  currentMarket: Market;
  entries: Entry[];
}

interface DashboardContextValue {
  state: DashboardState;
  setExchangeRate: (rate: number) => void;
  switchTab: (tab: string) => void;
  switchMarket: (market: Market) => void;
  addEntry: (entry: Entry) => void;
  deleteEntry: (id: number) => void;
  deleteEntries: (ids: number[]) => void;
  updateEntry: (entry: Entry) => void;
  loadEntries: (entries: Entry[]) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

const INITIAL_STATE: DashboardState = {
  exchangeRate: 1350,
  activeTab: 'all',
  currentMarket: 'domestic',
  entries: [],
};

const LS_ENTRIES = 'tradinglist_entries';
const LS_RATE = 'tradinglist_exchangeRate';
const LS_MARKET = 'tradinglist_currentMarket';

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DashboardState>(() => {
    if (typeof window === 'undefined') return INITIAL_STATE;
    try {
      const raw = localStorage.getItem(LS_ENTRIES);
      const rate = localStorage.getItem(LS_RATE);
      const market = localStorage.getItem(LS_MARKET);
      return {
        ...INITIAL_STATE,
        entries: raw ? (JSON.parse(raw) as Entry[]) : [],
        exchangeRate: rate ? Number(rate) : 1350,
        currentMarket: (market as Market) ?? 'domestic',
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

  useEffect(() => {
    localStorage.setItem(LS_MARKET, state.currentMarket);
  }, [state.currentMarket]);

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

  const deleteEntries = useCallback((ids: number[]) => {
    const idSet = new Set(ids);
    setState((prev) => ({ ...prev, entries: prev.entries.filter((e) => !idSet.has(e.id)) }));
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

  return (
    <DashboardContext.Provider value={{
      state,
      setExchangeRate,
      switchTab,
      switchMarket,
      addEntry,
      deleteEntry,
      deleteEntries,
      updateEntry,
      loadEntries,
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}
