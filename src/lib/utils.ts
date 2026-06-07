export function parseNumberLoose(s: unknown): number {
  if (s == null) return NaN;
  const t = String(s).replace(/,/g, '').replace(/[^\d.\-+]/g, '').trim();
  if (t === '' || t === '-' || t === '+') return NaN;
  return parseFloat(t);
}

export function formatUsd(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const parts = abs.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-' : '') + parts.join('.');
}

export function normalizeDateStr(s: unknown): string {
  if (!s) return '';
  const m = String(s).trim().replace(/\./g, '-').replace(/\//g, '-');
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(m);
  if (p) return `${p[1]}-${p[2]}-${p[3]}`;
  return m;
}
