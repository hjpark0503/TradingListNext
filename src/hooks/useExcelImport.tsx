'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { importEntriesFromExcel } from '@/lib/excel';
import type { Entry } from '@/lib/types';

export function useExcelImport(
  entries: Entry[],
  loadEntries: (entries: Entry[]) => void,
  onImported?: () => void
) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const runImport = async (file: File): Promise<boolean> => {
    setImporting(true);
    try {
      const imported = await importEntriesFromExcel(file);
      loadEntries(imported);
      onImported?.();
      return true;
    } catch (e) {
      alert('엑셀 파일을 읽는 중 오류가 발생했습니다: ' + ((e as Error)?.message ?? String(e)));
      return false;
    } finally {
      setImporting(false);
    }
  };

  const handleImport = (file: File) => {
    // Nothing to lose yet, so skip the confirmation dialog.
    if (entries.length === 0) {
      runImport(file);
      return;
    }
    setPendingFile(file);
  };

  const cancelImport = () => {
    if (importing) return;
    setPendingFile(null);
  };

  const confirmImport = async () => {
    if (!pendingFile) return;
    if (await runImport(pendingFile)) setPendingFile(null);
  };

  const importConfirmModal =
    pendingFile &&
    createPortal(
      <div className="confirm-overlay" onClick={cancelImport}>
        <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
          <div className="confirm-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="confirm-title">기존 거래내역을 교체할까요?</p>
          <p className="confirm-desc">
            현재 <strong>{entries.length}건</strong>의 거래내역이 모두 삭제되고
            <br />
            불러온 엑셀 파일의 내용으로 교체됩니다.
            <br />이 작업은 되돌릴 수 없습니다.
          </p>
          <div className="confirm-actions">
            <button className="confirm-btn-cancel" onClick={cancelImport} disabled={importing}>
              취소
            </button>
            <button className="confirm-btn-delete" onClick={confirmImport} disabled={importing}>
              {importing ? '불러오는 중...' : '교체하기'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );

  return { handleImport, importConfirmModal };
}
