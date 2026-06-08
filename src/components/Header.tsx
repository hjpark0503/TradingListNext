'use client';

import { useRef } from 'react';
import { Market } from '@/lib/types';

interface HeaderProps {
  onExport: () => void;
  onImport: (file: File) => void;
  hasEntries: boolean;
  currentMarket: Market;
  onMarketChange: (m: Market) => void;
}

export function Header({ onExport, onImport, hasEntries, currentMarket, onMarketChange }: HeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      onImport(f);
      e.target.value = '';
    }
  };

  return (
    <div className="header">
      <div className="header-left">
        <h1>영차영차 주식 거래일지 </h1>
      </div>
      <div className="header-right">
        <div className="header-market">
          <div className="seg-ctrl">
            {(['domestic', 'overseas'] as Market[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`seg-btn${currentMarket === m ? ' active' : ''}`}
                onClick={() => onMarketChange(m)}
              >
                {m === 'domestic' ? '🇰🇷 국내' : '🌐 해외'}
              </button>
            ))}
          </div>
        </div>
        <div className="header-actions">
          <input
            type="file"
            ref={inputRef}
            accept=".xlsx,.xls"
            hidden
            aria-hidden
            onChange={handleChange}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => inputRef.current?.click()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span className="btn-text">불러오기</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!hasEntries}
            onClick={onExport}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span className="btn-text">내보내기</span>
          </button>
        </div>
      </div>
    </div>
  );
}
