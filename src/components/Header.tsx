'use client';

import { useRef } from 'react';
import { Market } from '@/lib/types';

interface HeaderProps {
  onExport: () => void;
  onImport: (file: File) => void;
  hasEntries: boolean;
  currentMarket: Market;
  onMarketChange: (m: Market) => void;
  isDark: boolean;
  onToggleDark: () => void;
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

export function Header({ onExport, onImport, hasEntries, currentMarket, onMarketChange, isDark, onToggleDark }: HeaderProps) {
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
        <h1>영차영차 주식 거래일지</h1>
        <span className="app-version">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
      </div>
      <div className="header-center">
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
      </div>
      <div className="header-right">
        <div className="header-actions">
          <button
            type="button"
            className="btn-dark-toggle"
            onClick={onToggleDark}
            aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
            title={isDark ? '라이트 모드' : '다크 모드'}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
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
