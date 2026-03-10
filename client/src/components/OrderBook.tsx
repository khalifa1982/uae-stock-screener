/**
 * Order Book / Market Depth Component
 * 
 * Fetches REAL bid/ask data from DFM API for DFM stocks.
 * For ADX stocks, derives order book from TradingView technical levels.
 * Supports sorting by price, orders, and quantity.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowUp, ArrowDown, Activity, ArrowUpDown, Wifi, WifiOff, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";

type SortField = 'price' | 'quantity' | 'orders';
type SortDir = 'asc' | 'desc';

function formatPrice(p: number): string {
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(3);
  return p.toFixed(4);
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return v.toLocaleString();
}

function formatValue(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2) + "B";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return v.toFixed(0);
}

interface OrderBookProps {
  symbol: string;
  exchange: "ADX" | "DFM";
  price: number | null;
  change: number | null;
  volume: number | null;
}

export function OrderBook({ symbol, exchange, price, change, volume }: OrderBookProps) {
  const [bidSort, setBidSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'price', dir: 'desc' });
  const [askSort, setAskSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'price', dir: 'asc' });

  const { data: orderBook, isLoading, error } = trpc.stocks.orderBook.useQuery(
    { symbol, exchange },
    { refetchInterval: 30_000, staleTime: 15_000 }
  );

  const sortedBids = useMemo(() => {
    if (!orderBook?.bids) return [];
    const sorted = [...orderBook.bids];
    sorted.sort((a, b) => {
      const val = bidSort.field === 'price' ? a.price - b.price
        : bidSort.field === 'quantity' ? a.quantity - b.quantity
        : a.orders - b.orders;
      return bidSort.dir === 'asc' ? val : -val;
    });
    return sorted;
  }, [orderBook?.bids, bidSort]);

  const sortedAsks = useMemo(() => {
    if (!orderBook?.asks) return [];
    const sorted = [...orderBook.asks];
    sorted.sort((a, b) => {
      const val = askSort.field === 'price' ? a.price - b.price
        : askSort.field === 'quantity' ? a.quantity - b.quantity
        : a.orders - b.orders;
      return askSort.dir === 'asc' ? val : -val;
    });
    return sorted;
  }, [orderBook?.asks, askSort]);

  function toggleSort(side: 'bid' | 'ask', field: SortField) {
    if (side === 'bid') {
      setBidSort(prev => ({
        field,
        dir: prev.field === field ? (prev.dir === 'asc' ? 'desc' : 'asc') : (field === 'price' ? 'desc' : 'desc')
      }));
    } else {
      setAskSort(prev => ({
        field,
        dir: prev.field === field ? (prev.dir === 'asc' ? 'desc' : 'asc') : (field === 'price' ? 'asc' : 'desc')
      }));
    }
  }

  if (!price) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center">
          <BookOpen className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Order book data unavailable</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-secondary/50 rounded w-1/3 mx-auto" />
            <div className="h-32 bg-secondary/30 rounded" />
            <div className="h-4 bg-secondary/50 rounded w-1/2 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !orderBook) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center">
          <WifiOff className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load order book</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{error?.message}</p>
        </CardContent>
      </Card>
    );
  }

  const totalBidVol = orderBook.bids.reduce((s, b) => s + b.quantity, 0);
  const totalAskVol = orderBook.asks.reduce((s, a) => s + a.quantity, 0);
  const buyPressure = totalBidVol + totalAskVol > 0 ? (totalBidVol / (totalBidVol + totalAskVol)) * 100 : 50;
  const maxVol = Math.max(
    ...orderBook.bids.map(b => b.quantity),
    ...orderBook.asks.map(a => a.quantity),
    1
  );

  const SortHeader = ({ side, field, label, align }: { side: 'bid' | 'ask'; field: SortField; label: string; align: string }) => {
    const current = side === 'bid' ? bidSort : askSort;
    const isActive = current.field === field;
    return (
      <button
        onClick={() => toggleSort(side, field)}
        className={`${align} text-[10px] uppercase tracking-wider flex items-center gap-0.5 hover:text-foreground transition-colors ${isActive ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
      >
        {label}
        {isActive && (
          current.dir === 'asc' ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />
        )}
        {!isActive && <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" /> Order Book
              <Badge variant={orderBook.dataSource === 'live' ? 'default' : 'secondary'} className="text-[9px] ml-1">
                {orderBook.dataSource === 'live' ? (
                  <><Wifi className="h-2.5 w-2.5 mr-0.5" /> LIVE DFM</>
                ) : (
                  <><WifiOff className="h-2.5 w-2.5 mr-0.5" /> Derived</>
                )}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px] font-mono">
                Spread: {formatPrice(orderBook.spread)} ({orderBook.spreadPercent.toFixed(2)}%)
              </Badge>
              {orderBook.totalTrades > 0 && (
                <Badge variant="outline" className="text-[10px] font-mono">
                  Trades: {orderBook.totalTrades.toLocaleString()}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gain/5 border border-gain/20 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Best Bid</p>
              <p className="text-sm font-mono font-bold text-gain">{orderBook.bidPrice > 0 ? formatPrice(orderBook.bidPrice) : '—'}</p>
              <p className="text-[10px] font-mono text-gain/70">{orderBook.bidVolume > 0 ? formatVolume(orderBook.bidVolume) + ' shares' : 'No bids'}</p>
            </div>
            <div className="bg-loss/5 border border-loss/20 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Best Ask</p>
              <p className="text-sm font-mono font-bold text-loss">{orderBook.askPrice > 0 ? formatPrice(orderBook.askPrice) : '—'}</p>
              <p className="text-[10px] font-mono text-loss/70">{orderBook.askVolume > 0 ? formatVolume(orderBook.askVolume) + ' shares' : 'No asks'}</p>
            </div>
            <div className="bg-secondary/30 border border-border/30 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">VWAP</p>
              <p className="text-sm font-mono font-bold">{formatPrice(orderBook.vwap)}</p>
              <p className="text-[10px] font-mono text-muted-foreground">{orderBook.vwap > orderBook.lastPrice ? '↑ Above' : '↓ Below'} Last</p>
            </div>
            <div className="bg-secondary/30 border border-border/30 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Value Traded</p>
              <p className="text-sm font-mono font-bold">{orderBook.totalValue > 0 ? formatValue(orderBook.totalValue) : '—'}</p>
              <p className="text-[10px] font-mono text-muted-foreground">AED</p>
            </div>
          </div>

          {/* Buy/Sell Pressure Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-gain font-medium flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Buy Pressure {buyPressure.toFixed(1)}%
              </span>
              <span className="text-loss font-medium flex items-center gap-1">
                Sell Pressure {(100 - buyPressure).toFixed(1)}% <TrendingDown className="h-3 w-3" />
              </span>
            </div>
            <div className="h-3 rounded-full bg-secondary/50 overflow-hidden flex shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-gain/80 to-gain/50 transition-all duration-700"
                style={{ width: `${buyPressure}%` }}
              />
              <div
                className="h-full bg-gradient-to-l from-loss/80 to-loss/50 transition-all duration-700"
                style={{ width: `${100 - buyPressure}%` }}
              />
            </div>
          </div>

          {/* Order Book Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            {/* Bids (Buy Orders) */}
            <div className="border border-gain/10 rounded-lg overflow-hidden">
              <div className="bg-gain/5 px-3 py-2 border-b border-gain/10">
                <span className="text-xs font-semibold text-gain flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> BUY ORDERS (Bids)
                </span>
              </div>
              <div className="grid grid-cols-4 text-[10px] px-3 py-1.5 border-b border-border/20 bg-secondary/10">
                <SortHeader side="bid" field="price" label="Price" align="" />
                <SortHeader side="bid" field="quantity" label="Qty" align="text-center" />
                <SortHeader side="bid" field="orders" label="Orders" align="text-center" />
                <span className="text-right text-[10px] text-muted-foreground uppercase tracking-wider">Total</span>
              </div>
              {sortedBids.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">No bid orders</div>
              ) : (
                sortedBids.map((level, i) => (
                  <div key={i} className="relative grid grid-cols-4 text-[11px] font-mono px-3 py-1.5 hover:bg-gain/5 transition-colors border-b border-border/5 last:border-0">
                    <div
                      className="absolute inset-0 bg-gain/6 transition-all duration-300"
                      style={{ width: `${Math.min((level.quantity / maxVol) * 100, 100)}%`, right: 0, left: 'auto' }}
                    />
                    <span className="relative text-gain font-medium">{formatPrice(level.price)}</span>
                    <span className="relative text-center">{formatVolume(level.quantity)}</span>
                    <span className="relative text-center text-muted-foreground">{level.orders.toLocaleString()}</span>
                    <span className="relative text-right text-muted-foreground">{formatVolume(level.total)}</span>
                    {level.source === 'live' && (
                      <span className="absolute top-1/2 -translate-y-1/2 left-0.5 w-1 h-1 rounded-full bg-gain animate-pulse" />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Asks (Sell Orders) */}
            <div className="border border-loss/10 rounded-lg overflow-hidden">
              <div className="bg-loss/5 px-3 py-2 border-b border-loss/10">
                <span className="text-xs font-semibold text-loss flex items-center gap-1.5">
                  <TrendingDown className="h-3.5 w-3.5" /> SELL ORDERS (Asks)
                </span>
              </div>
              <div className="grid grid-cols-4 text-[10px] px-3 py-1.5 border-b border-border/20 bg-secondary/10">
                <SortHeader side="ask" field="price" label="Price" align="" />
                <SortHeader side="ask" field="quantity" label="Qty" align="text-center" />
                <SortHeader side="ask" field="orders" label="Orders" align="text-center" />
                <span className="text-right text-[10px] text-muted-foreground uppercase tracking-wider">Total</span>
              </div>
              {sortedAsks.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">No ask orders</div>
              ) : (
                sortedAsks.map((level, i) => (
                  <div key={i} className="relative grid grid-cols-4 text-[11px] font-mono px-3 py-1.5 hover:bg-loss/5 transition-colors border-b border-border/5 last:border-0">
                    <div
                      className="absolute inset-0 bg-loss/6 transition-all duration-300"
                      style={{ width: `${Math.min((level.quantity / maxVol) * 100, 100)}%` }}
                    />
                    <span className="relative text-loss font-medium">{formatPrice(level.price)}</span>
                    <span className="relative text-center">{formatVolume(level.quantity)}</span>
                    <span className="relative text-center text-muted-foreground">{level.orders.toLocaleString()}</span>
                    <span className="relative text-right text-muted-foreground">{formatVolume(level.total)}</span>
                    {level.source === 'live' && (
                      <span className="absolute top-1/2 -translate-y-1/2 left-0.5 w-1 h-1 rounded-full bg-loss animate-pulse" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-border/30">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Bid Vol</p>
              <p className="text-xs font-mono font-medium text-gain">{formatVolume(totalBidVol)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Ask Vol</p>
              <p className="text-xs font-mono font-medium text-loss">{formatVolume(totalAskVol)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Day Volume</p>
              <p className="text-xs font-mono font-medium">{formatVolume(orderBook.totalVolume)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Day Range</p>
              <p className="text-xs font-mono font-medium">{formatPrice(orderBook.dayLow)} - {formatPrice(orderBook.dayHigh)}</p>
            </div>
            <div className="text-center col-span-2 sm:col-span-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Last Trade</p>
              <p className="text-xs font-mono font-medium">
                {orderBook.lastTradeTime
                  ? new Date(orderBook.lastTradeTime).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : '—'}
              </p>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground/60 text-center italic">
            {orderBook.dataSource === 'live'
              ? 'Live data from Dubai Financial Market (DFM). Best bid/ask from official API. Support/resistance levels derived from technical analysis.'
              : 'Order book derived from TradingView technical levels. Real-time Level 2 data not available for this exchange.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Compact price book showing best bid/ask with real data
 */
export function PriceBook({ symbol, exchange, price, change, volume, high, low }: {
  symbol: string;
  exchange: "ADX" | "DFM";
  price: number | null;
  change: number | null;
  volume: number | null;
  high: number | null;
  low: number | null;
}) {
  const { data: orderBook } = trpc.stocks.orderBook.useQuery(
    { symbol, exchange },
    { refetchInterval: 30_000, staleTime: 15_000, enabled: !!price }
  );

  if (!price) return null;

  const isPositive = (change || 0) > 0;
  const bidPrice = orderBook?.bidPrice ?? 0;
  const askPrice = orderBook?.askPrice ?? 0;

  return (
    <div className="flex items-center gap-3 sm:gap-4 p-3 rounded-lg bg-secondary/20 border border-border/30 flex-wrap">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <span className="text-xs text-muted-foreground font-medium">Price Book</span>
        {orderBook?.dataSource === 'live' && (
          <span className="w-1.5 h-1.5 rounded-full bg-gain animate-pulse" />
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono flex-wrap">
        <div>
          <span className="text-muted-foreground mr-1">Bid:</span>
          <span className="text-gain font-medium">{bidPrice > 0 ? formatPrice(bidPrice) : '—'}</span>
        </div>
        <div>
          <span className="text-muted-foreground mr-1">Ask:</span>
          <span className="text-loss font-medium">{askPrice > 0 ? formatPrice(askPrice) : '—'}</span>
        </div>
        <div>
          <span className="text-muted-foreground mr-1">Last:</span>
          <span className={`font-medium ${isPositive ? "text-gain" : "text-loss"}`}>
            {formatPrice(price)}
          </span>
        </div>
        {orderBook?.vwap ? (
          <div>
            <span className="text-muted-foreground mr-1">VWAP:</span>
            <span className="font-medium">{formatPrice(orderBook.vwap)}</span>
          </div>
        ) : null}
        {high && low && (
          <div className="hidden sm:block">
            <span className="text-muted-foreground mr-1">Range:</span>
            <span>{formatPrice(low)} - {formatPrice(high)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
