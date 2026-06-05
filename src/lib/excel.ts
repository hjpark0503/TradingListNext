import * as XLSX from 'xlsx';
import { Entry, TradeType, Market } from './types';

const TYPE_LABEL: Record<string, string> = {
  buy: '매수', sell: '매도', deposit: '입금', withdraw: '출금', div: '배당금',
};

const LABEL_TO_TYPE: Record<string, TradeType> = {
  '매수': 'buy', '매도': 'sell', '입금': 'deposit', '출금': 'withdraw', '배당금': 'div',
};

let _idCounter = Date.now();

export async function importEntriesFromExcel(file: File): Promise<Entry[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  return rows.map((row) => {
    const market: Market = String(row['통화'] ?? '') === 'USD' ? 'overseas' : 'domestic';
    const type: TradeType = LABEL_TO_TYPE[String(row['거래유형'] ?? '')] ?? 'buy';
    return {
      id: ++_idCounter,
      date: String(row['거래일'] ?? ''),
      type,
      market,
      stock: String(row['종목명'] ?? ''),
      detail: String(row['상세'] ?? ''),
      price: Number(row['단가'] ?? 0),
      qty: Number(row['수량'] ?? 0),
      amount: Number(row['거래금액'] ?? 0),
      fee: Number(row['수수료'] ?? 0),
      tax: Number(row['세금'] ?? 0),
      settlement: Number(row['정산금액'] ?? 0),
    };
  });
}

export function exportEntriesToExcel(entries: Entry[]) {
  const sorted = [...entries].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );

  const rows = sorted.map((e) => ({
    '거래일': e.date,
    '시장': e.market === 'domestic' ? '국내' : '해외',
    '종목명': e.stock || '',
    '거래유형': TYPE_LABEL[e.type] || e.type,
    '상세': e.detail || '',
    '단가': e.price || 0,
    '수량': e.qty || 0,
    '거래금액': e.amount,
    '수수료': e.fee,
    '세금': e.tax,
    '정산금액': e.settlement,
    '통화': e.market === 'domestic' ? 'KRW' : 'USD',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  const colWidths = [
    { wch: 12 }, { wch: 6 }, { wch: 16 }, { wch: 8 }, { wch: 16 },
    { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
    { wch: 14 }, { wch: 6 },
  ];
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '거래내역');

  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(wb, `거래내역_${stamp}.xlsx`);
}
