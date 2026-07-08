'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore';
import type { Market, Entry } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';

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

const DEFAULT_RATE = 1350;
const DEFAULT_MARKET: Market = 'domestic';

const LS_RATE = 'tradinglist_exchangeRate';
const LS_MARKET = 'tradinglist_currentMarket';
const LS_MIGRATED_PREFIX = 'tradinglist_migrated_';

const BATCH_LIMIT = 400;

async function commitInChunks(ops: Array<(batch: WriteBatch) => void>) {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
    await batch.commit();
  }
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { currentUser, loading: authLoading } = useAuth();

  const [exchangeRate, setExchangeRate] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_RATE;
    try {
      const rate = localStorage.getItem(LS_RATE);
      return rate ? Number(rate) : DEFAULT_RATE;
    } catch {
      return DEFAULT_RATE;
    }
  });
  const [activeTab, switchTab] = useState('all');
  const [currentMarket, switchMarket] = useState<Market>(() => {
    if (typeof window === 'undefined') return DEFAULT_MARKET;
    try {
      return (localStorage.getItem(LS_MARKET) as Market) ?? DEFAULT_MARKET;
    } catch {
      return DEFAULT_MARKET;
    }
  });

  // Guest (signed-out) entries: in-memory only for this tab/session. Lost on
  // refresh or reopen by design — only signed-in accounts persist to Firestore.
  const [guestEntries, setGuestEntries] = useState<Entry[]>([]);
  // Signed-in entries, backed by Firestore (users/{uid}/entries).
  const [firestoreEntries, setFirestoreEntries] = useState<Entry[]>([]);

  const entries = currentUser ? firestoreEntries : guestEntries;

  // Lets the migration effect below read the latest guest entries without
  // needing to depend on (and re-subscribe for) every guestEntries change.
  const guestEntriesRef = useRef(guestEntries);

  useEffect(() => {
    guestEntriesRef.current = guestEntries;
  }, [guestEntries]);

  useEffect(() => {
    localStorage.setItem(LS_RATE, String(exchangeRate));
  }, [exchangeRate]);

  useEffect(() => {
    localStorage.setItem(LS_MARKET, currentMarket);
  }, [currentMarket]);

  // Signed-in mode: migrate existing guest entries once per account, then
  // keep firestoreEntries subscribed to that account's Firestore data.
  useEffect(() => {
    if (authLoading || !currentUser) return;

    const uid = currentUser.uid;
    const col = collection(db, 'users', uid, 'entries');
    const migratedKey = `${LS_MIGRATED_PREFIX}${uid}`;

    (async () => {
      try {
        if (!localStorage.getItem(migratedKey)) {
          const snap = await getDocs(col);
          if (snap.empty && guestEntriesRef.current.length > 0) {
            await commitInChunks(
              guestEntriesRef.current.map((entry) => (batch) => batch.set(doc(col, String(entry.id)), entry))
            );
          }
          localStorage.setItem(migratedKey, 'true');
        }
        // Entries now live in Firestore for this account; drop the in-memory
        // guest copy so it doesn't linger while signed in.
        setGuestEntries([]);
      } catch (err) {
        console.error('Firestore 마이그레이션 실패', err);
      }
    })();

    const unsubscribe = onSnapshot(col, (snapshot) => {
      setFirestoreEntries(snapshot.docs.map((d) => d.data() as Entry));
    });

    return unsubscribe;
  }, [currentUser, authLoading]);

  const addEntry = useCallback(
    (entry: Entry) => {
      if (currentUser) {
        setDoc(doc(db, 'users', currentUser.uid, 'entries', String(entry.id)), entry).catch((err) =>
          console.error('거래 저장 실패', err)
        );
      } else {
        setGuestEntries((prev) => [...prev, entry]);
      }
      switchTab(entry.type);
    },
    [currentUser]
  );

  const deleteEntry = useCallback(
    (id: number) => {
      if (currentUser) {
        deleteDoc(doc(db, 'users', currentUser.uid, 'entries', String(id))).catch((err) =>
          console.error('거래 삭제 실패', err)
        );
      } else {
        setGuestEntries((prev) => prev.filter((e) => e.id !== id));
      }
    },
    [currentUser]
  );

  const deleteEntries = useCallback(
    (ids: number[]) => {
      if (currentUser) {
        const uid = currentUser.uid;
        commitInChunks(ids.map((id) => (batch) => batch.delete(doc(db, 'users', uid, 'entries', String(id))))).catch(
          (err) => console.error('거래 일괄 삭제 실패', err)
        );
      } else {
        const idSet = new Set(ids);
        setGuestEntries((prev) => prev.filter((e) => !idSet.has(e.id)));
      }
    },
    [currentUser]
  );

  const updateEntry = useCallback(
    (entry: Entry) => {
      if (currentUser) {
        setDoc(doc(db, 'users', currentUser.uid, 'entries', String(entry.id)), entry).catch((err) =>
          console.error('거래 수정 실패', err)
        );
      } else {
        setGuestEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));
      }
    },
    [currentUser]
  );

  const loadEntries = useCallback(
    (newEntries: Entry[]) => {
      if (currentUser) {
        const uid = currentUser.uid;
        (async () => {
          try {
            const col = collection(db, 'users', uid, 'entries');
            const existing = await getDocs(col);
            const deleteOps = existing.docs.map((d) => (batch: WriteBatch) => batch.delete(d.ref));
            const setOps = newEntries.map(
              (entry) => (batch: WriteBatch) => batch.set(doc(col, String(entry.id)), entry)
            );
            await commitInChunks([...deleteOps, ...setOps]);
          } catch (err) {
            console.error('거래 불러오기 동기화 실패', err);
          }
        })();
      } else {
        setGuestEntries(newEntries);
      }
      switchTab('all');
    },
    [currentUser]
  );

  const state: DashboardState = { exchangeRate, activeTab, currentMarket, entries };

  return (
    <DashboardContext.Provider
      value={{
        state,
        setExchangeRate,
        switchTab,
        switchMarket,
        addEntry,
        deleteEntry,
        deleteEntries,
        updateEntry,
        loadEntries,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}
