'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Market } from '@/lib/types';

interface StockItem {
  name: string;
  code: string;
  market: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  market: Market;
  disabled?: boolean;
  placeholder?: string;
}

function marketBadgeClass(mkt: string): string {
  const m = mkt.toUpperCase();
  if (m === 'KOSPI' || m === '코스피') return 'stock-mkt-badge stock-mkt-badge--kospi';
  if (m === 'KOSDAQ' || m === '코스닥') return 'stock-mkt-badge stock-mkt-badge--kosdaq';
  if (m === 'NASDAQ') return 'stock-mkt-badge stock-mkt-badge--nasdaq';
  if (m === 'NYSE') return 'stock-mkt-badge stock-mkt-badge--nyse';
  return 'stock-mkt-badge';
}

export function StockInput({ value, onChange, market, disabled, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<StockItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setItems([]);
    setOpen(false);
  }, [market]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const search = useCallback(
    (q: string) => {
      clearTimeout(timerRef.current);
      if (!q.trim()) {
        setItems([]);
        setOpen(false);
        return;
      }
      timerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/stocks?q=${encodeURIComponent(q)}&market=${market}`
          );
          const data: StockItem[] = await res.json();
          setItems(data);
          setOpen(data.length > 0);
          setActiveIdx(-1);
        } catch {
          setItems([]);
          setOpen(false);
        }
      }, 280);
    },
    [market]
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
    search(e.target.value);
  }

  function handleSelect(item: StockItem) {
    onChange(item.name);
    setOpen(false);
    setItems([]);
    setActiveIdx(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(items[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="stock-input-wrap" ref={containerRef}>
      <input
        type="text"
        id="inp-stock"
        className="inp"
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => items.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {open && (
        <ul className="stock-dropdown" role="listbox">
          {items.map((item, i) => (
            <li
              key={`${item.code}-${i}`}
              role="option"
              aria-selected={i === activeIdx}
              className={`stock-dropdown__item${i === activeIdx ? ' active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(item);
              }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span className="stock-dropdown__name">{item.name}</span>
              <span className="stock-dropdown__code">{item.code}</span>
              <span className={marketBadgeClass(item.market)}>{item.market}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
