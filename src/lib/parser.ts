import { TradeRow } from './types';
import { parseNumberLoose, normalizeDateStr } from './utils';

function normalizeRawLines(lines: string[]): string[] {
  return lines.map((l) => l.replace(/\r/g, '').trim()).filter(Boolean);
}

const ROW_REGEX =
  /^(\d{4}[-./]\d{2}[-./]\d{2})\s+(.+?)\s+(?:해외증권\s+)?(해외주식매수|해외주식매도)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s*$/;

const ROW_REGEX_LOOSE =
  /(\d{4})[.\-/](\d{2})[.\-/](\d{2})\s+(.+?)\s+(?:해외\s*증권\s+)?(해외\s*주식\s*매[수도])\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)/;

function cleanName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+\[\S*\]\s+\d+\s+\[\S*\]\s+\d+\s*해외증권\s*$/, '')
    .replace(/\s*해외증권\s*$/, '')
    .replace(/\s*\[[a-z][^\]]*\]?/g, '')
    .replace(/\s+\[[가-힣][^\]]*(?:\]|$)/g, '')
    .replace(/\[[^\]]*[가-힣][^\]]*\]/g, '')
    .replace(/(\s+(?:[\d.,]+|[가-힣]+))+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeOcrText(s: string): string {
  return String(s)
    .replace(/ /g, ' ')
    .replace(/해\s*외\s*주\s*식\s*매\s*수/g, '해외주식매수')
    .replace(/해\s*외\s*주\s*식\s*매\s*도/g, '해외주식매도')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTradeType(raw: string): '해외주식매수' | '해외주식매도' | '' {
  const t = String(raw).replace(/\s+/g, '');
  if (/매도/.test(t)) return '해외주식매도';
  if (/매수/.test(t)) return '해외주식매수';
  return '';
}

function rowFromMatchGroups(
  dateRaw: string,
  name: string,
  typeRaw: string,
  u: string,
  q: string,
  settle: string,
  bal: string
): TradeRow | null {
  const type = normalizeTradeType(typeRaw);
  if (!type) return null;
  const date = normalizeDateStr(dateRaw);
  const row = {
    date,
    name: cleanName(name),
    type,
    unitPrice: parseNumberLoose(u),
    qty: parseNumberLoose(q),
    settlement: parseNumberLoose(settle),
    balance: parseNumberLoose(bal),
  } as TradeRow;
  if (
    !row.date ||
    !row.name ||
    isNaN(row.unitPrice) ||
    isNaN(row.qty) ||
    isNaN(row.settlement) ||
    isNaN(row.balance)
  ) {
    return null;
  }
  return row;
}

function mergeWrappedRows(lines: string[]): string[] {
  const expanded: string[] = [];
  for (const line of lines) {
    const parts = line.split(/(?=\d{4}[-./]\d{2}[-./]\d{2})/);
    for (const s of parts) {
      if (s.trim()) expanded.push(s.trim());
    }
  }

  const out: string[] = [];
  let buf = '';
  for (const line of expanded) {
    if (/^\d{4}[-./\s]?\d{2}[-./\s]?\d{2}\b/.test(line)) {
      if (buf) out.push(buf);
      buf = line;
    } else if (buf) {
      buf = buf + ' ' + line;
    } else {
      out.push(line);
    }
  }
  if (buf) out.push(buf);
  return out;
}

function tryParseSingleLine(line: string): TradeRow | null {
  const trimmed = line.trim();
  let m = ROW_REGEX.exec(trimmed);
  if (m) {
    return rowFromMatchGroups(m[1], m[2], m[3], m[4], m[5], m[6], m[7]);
  }
  m = ROW_REGEX_LOOSE.exec(trimmed);
  if (m) {
    return rowFromMatchGroups(
      `${m[1]}-${m[2]}-${m[3]}`,
      m[4],
      m[5],
      m[6],
      m[7],
      m[8],
      m[9]
    );
  }
  return null;
}

function parseFromBlob(blob: string): TradeRow[] {
  const text = normalizeOcrText(blob);
  const rows: TradeRow[] = [];
  const re = new RegExp(ROW_REGEX_LOOSE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const row = rowFromMatchGroups(
      `${m[1]}-${m[2]}-${m[3]}`,
      m[4],
      m[5],
      m[6],
      m[7],
      m[8],
      m[9]
    );
    if (row) rows.push(row);
  }
  return rows;
}

export function parseFromLines(logicalLines: string[]): TradeRow[] {
  const rows: TradeRow[] = [];
  const merged = mergeWrappedRows(normalizeRawLines(logicalLines));
  for (const line of merged) {
    const normalized = normalizeOcrText(line);
    const parsed = tryParseSingleLine(normalized);
    if (parsed) rows.push(parsed);
  }
  if (rows.length === 0) {
    return parseFromBlob(merged.join('\n'));
  }
  return rows;
}
