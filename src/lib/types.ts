export interface TradeRow {
  date: string;
  name: string;
  type: '해외주식매수' | '해외주식매도';
  unitPrice: number;
  qty: number;
  settlement: number;
  balance: number;
}

export interface PLRow {
  sell: TradeRow;
  buyCost: number | null;
  pl: number | null;
  plPct: number | null;
  hasBuyData: boolean;
}

export interface PLTotals {
  totalPL: number;
  totalBuyCost: number;
  plPct: number | null;
  hasSomeData: boolean;
}

export interface BalanceSeries {
  labels: string[];
  data: number[];
  tradeCounts: number[];
}

export type Market = 'overseas' | 'domestic';

export type TradeType = 'buy' | 'sell' | 'deposit' | 'withdraw' | 'div';

export interface Entry {
  id: number;
  date: string;
  type: TradeType;
  market: Market;
  stock: string;
  detail: string;
  qty: number;
  price: number;
  fee: number;
  tax: number;
  amount: number;
  settlement: number;
}
