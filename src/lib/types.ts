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
