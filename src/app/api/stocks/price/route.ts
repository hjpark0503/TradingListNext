import { NextRequest, NextResponse } from 'next/server';

interface PriceResult {
  price: number;
  currency: 'KRW' | 'USD';
}

const DAUM_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Referer': 'https://finance.daum.net/',
  'Accept': 'application/json',
};

async function fetchDomesticPrice(code: string): Promise<PriceResult | null> {
  // Daum Finance symbolCode = 'A' + 6자리 코드
  const symbolCode = 'A' + code.padStart(6, '0');
  const res = await fetch(
    `https://finance.daum.net/api/quotes/${symbolCode}?fields=tradePrice`,
    { headers: DAUM_HEADERS }
  );
  if (!res.ok) return null;

  const data = await res.json();
  const price = data?.tradePrice;
  if (typeof price !== 'number') return null;

  return { price, currency: 'KRW' };
}

async function fetchOverseasPrice(symbol: string): Promise<PriceResult | null> {
  // NASDAQ 공식 API (인증 불필요, 지연 시세)
  const res = await fetch(
    `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol.toUpperCase())}/info?assetclass=stocks`,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
    }
  );
  if (!res.ok) return null;

  const data = await res.json();
  const raw = data?.data?.primaryData?.lastSalePrice as string | undefined;
  if (!raw) return null;

  // "$290.55" → 290.55
  const price = parseFloat(raw.replace(/[^0-9.]/g, ''));
  if (isNaN(price)) return null;

  return { price, currency: 'USD' };
}

// GET /api/stocks/price?code=005930&market=domestic
// GET /api/stocks/price?code=AAPL&market=overseas
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') ?? '';
  const market = req.nextUrl.searchParams.get('market') ?? 'domestic';

  if (!code.trim()) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 });
  }

  try {
    const result =
      market === 'overseas'
        ? await fetchOverseasPrice(code)
        : await fetchDomesticPrice(code);

    if (!result) {
      return NextResponse.json({ error: 'price not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 });
  }
}
