import { NextRequest, NextResponse } from 'next/server';

interface StockResult {
  name: string;
  code: string;
  market: string;
}

interface DaumSuggestItem {
  symbolCode: string;
  koreanName: string;
  displayedCode: string;
}

interface DaumQuote {
  market?: string;
  name?: string;
}

interface YahooQuote {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchange: string;
  quoteType: string;
}

const DAUM_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Referer': 'https://finance.daum.net/',
  'Accept': 'application/json',
};

const US_EXCHANGES: Record<string, string> = {
  NMS: 'NASDAQ',
  NYQ: 'NYSE',
  PCX: 'NYSE',
  ASE: 'NYSE',
  NGM: 'NASDAQ',
  NCM: 'NASDAQ',
};

async function fetchMarket(symbolCode: string): Promise<string> {
  try {
    const res = await fetch(
      `https://finance.daum.net/api/quotes/${symbolCode}?fields=market`,
      { headers: DAUM_HEADERS }
    );
    if (!res.ok) return '';
    const d: DaumQuote = await res.json();
    return d.market ?? '';
  } catch {
    return '';
  }
}

async function searchDomestic(query: string): Promise<StockResult[]> {
  const res = await fetch(
    `https://finance.daum.net/api/search?q=${encodeURIComponent(query)}&limit=10`,
    { headers: DAUM_HEADERS }
  );
  if (!res.ok) return [];

  const data = await res.json();
  const items: DaumSuggestItem[] = data?.suggestItems ?? [];
  if (items.length === 0) return [];

  // Fetch market type (KOSPI/KOSDAQ) for each result in parallel
  const markets = await Promise.all(items.map((item) => fetchMarket(item.symbolCode)));

  return items.map((item, i) => ({
    name: item.koreanName,
    code: item.displayedCode,
    market: markets[i] || '',
  }));
}

async function searchOverseas(query: string): Promise<StockResult[]> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}` +
      `&lang=en-US&region=US&quotesCount=8&newsCount=0&listsCount=0`,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    }
  );
  if (!res.ok) return [];

  const data = await res.json();
  const quotes: YahooQuote[] = Array.isArray(data?.quotes) ? data.quotes : [];

  return quotes
    .filter(
      (q) => (q.quoteType === 'EQUITY' || q.quoteType === 'ETF') && q.exchange in US_EXCHANGES
    )
    .map((q) => ({
      name: q.shortname ?? q.longname ?? q.symbol,
      code: q.symbol,
      market: US_EXCHANGES[q.exchange],
    }));
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const market = req.nextUrl.searchParams.get('market') ?? 'domestic';

  if (!q.trim()) return NextResponse.json([]);

  try {
    const results =
      market === 'overseas' ? await searchOverseas(q) : await searchDomestic(q);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
