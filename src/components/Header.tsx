'use client';

import { useRef } from 'react';

interface HeaderProps {
  headerSub: string;
  headerMeta: string;
  loading: boolean;
  loadingMessage: string;
  onFileSelect: (file: File) => void;
}

export function Header({ headerSub, headerMeta, loading, loadingMessage, onFileSelect }: HeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      onFileSelect(f);
      e.target.value = '';
    }
  };

  return (
    <div className="header">
      <div className="header-left">
        <div className="issuer-label">거래내역 대시보드</div>
        <h1>주식 거래내역 대시보드</h1>
        {headerSub && <div className="sub">{headerSub}</div>}
      </div>
      <div className="header-right">
        <div className="header-actions">
          <input
            type="file"
            ref={inputRef}
            accept="application/pdf,.pdf"
            hidden
            aria-hidden
            onChange={handleChange}
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            PDF 업로드
          </button>
          {loading && (
            <div className="pdf-loading">{loadingMessage || '데이터 분석 중...'}</div>
          )}
          {headerMeta && <div className="meta">{headerMeta}</div>}
        </div>
      </div>
    </div>
  );
}
