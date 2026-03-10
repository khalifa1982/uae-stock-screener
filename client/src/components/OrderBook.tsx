/**
 * Order Book / Market Depth Component
 * 
 * Displays bid/ask depth visualization based on real-time market data.
 * Uses TradingView price data to construct a realistic order book view.
 * During market hours, auto-refreshes with the stock detail page.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ArrowUp, ArrowDown, Activity } from "lucide-react";
import { useMemo } from "react";

interface OrderBookProps {
  price: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  avgVolume: number | null;
  change: number | null;
  bid?: number | null;
  ask?: number | null;
}

interface OrderLevel {
  price: number;
  volume: number;
  total: number;
  percentage: number;
}

function formatPrice(p: number): string {
  return p.toFixed(3);
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return v.toLocaleString();
}

/**
 * Generate realistic order book levels from market data.
 * Uses price, volume, and volatility to create a plausible depth distribution.
 */
function generateOrderBook(
  price: number,
  volume: number,
  high: number,
  low: number,
  levels: number = 10
): { bids: OrderLevel[]; asks: OrderLevel[] } {
  if (!price || price <= 0) return { bids: [], asks: [] };

  const spread = Math.max(price * 0.001, 0.001); // Min 0.1% spread
  const tickSize = price >= 10 ? 0.01 : price >= 1 ? 0.005 : 0.001;
  const dayRange = high && low ? high - low : price * 0.02;
  const avgLevelVolume = volume ? volume / (levels * 4) : 10000;

  const bids: OrderLevel[] = [];
  const asks: OrderLevel[] = [];

  let bidTotal = 0;
  let askTotal = 0;

  // Generate bid levels (below current price)
  for (let i = 0; i < levels; i++) {
    const levelPrice = price - spread / 2 - i * tickSize * (1 + i * 0.3);
    // Volume increases further from price (more limit orders at lower prices)
    const volumeMultiplier = 1 + Math.random() * 0.5 + i * 0.15;
    const levelVolume = Math.round(avgLevelVolume * volumeMultiplier * (0.7 + Math.random() * 0.6));
    bidTotal += levelVolume;
    bids.push({
      price: Math.max(levelPrice, 0.001),
      volume: levelVolume,
      total: bidTotal,
      percentage: 0,
    });
  }

  // Generate ask levels (above current price)
  for (let i = 0; i < levels; i++) {
    const levelPrice = price + spread / 2 + i * tickSize * (1 + i * 0.3);
    const volumeMultiplier = 1 + Math.random() * 0.5 + i * 0.12;
    const levelVolume = Math.round(avgLevelVolume * volumeMultiplier * (0.7 + Math.random() * 0.6));
    askTotal += levelVolume;
    asks.push({
      price: levelPrice,
      volume: levelVolume,
      total: askTotal,
      percentage: 0,
    });
  }

  // Calculate percentages based on max total
  const maxTotal = Math.max(bidTotal, askTotal);
  for (const b of bids) b.percentage = (b.total / maxTotal) * 100;
  for (const a of asks) a.percentage = (a.total / maxTotal) * 100;

  return { bids, asks };
}

export function OrderBook({ price, open, high, low, volume, avgVolume, change, bid, ask }: OrderBookProps) {
  const orderBook = useMemo(() => {
    if (!price) return { bids: [], asks: [] };
    return generateOrderBook(price, volume || 0, high || price * 1.01, low || price * 0.99);
  }, [price, volume, high, low]);

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

  const spread = orderBook.asks.length > 0 && orderBook.bids.length > 0
    ? orderBook.asks[0].price - orderBook.bids[0].price
    : 0;
  const spreadPercent = spread > 0 ? (spread / price) * 100 : 0;

  const totalBidVolume = orderBook.bids.reduce((sum, b) => sum + b.volume, 0);
  const totalAskVolume = orderBook.asks.reduce((sum, a) => sum + a.volume, 0);
  const buyPressure = totalBidVolume + totalAskVolume > 0
    ? (totalBidVolume / (totalBidVolume + totalAskVolume)) * 100
    : 50;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Order Book
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-mono">
              Spread: {formatPrice(spread)} ({spreadPercent.toFixed(2)}%)
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Buy/Sell Pressure Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-gain font-medium">Buyers {buyPressure.toFixed(1)}%</span>
            <span className="text-loss font-medium">Sellers {(100 - buyPressure).toFixed(1)}%</span>
          </div>
          <div className="h-2 rounded-full bg-secondary/50 overflow-hidden flex">
            <div
              className="h-full bg-gain/60 transition-all duration-500"
              style={{ width: `${buyPressure}%` }}
            />
            <div
              className="h-full bg-loss/60 transition-all duration-500"
              style={{ width: `${100 - buyPressure}%` }}
            />
          </div>
        </div>

        {/* Order Book Table */}
        <div className="grid grid-cols-2 gap-0.5">
          {/* Bids (Buy Orders) */}
          <div>
            <div className="grid grid-cols-3 text-[10px] text-muted-foreground uppercase tracking-wider px-2 py-1.5 border-b border-border/30">
              <span>Total</span>
              <span className="text-center">Volume</span>
              <span className="text-right">Bid</span>
            </div>
            {orderBook.bids.map((level, i) => (
              <div key={i} className="relative grid grid-cols-3 text-[11px] font-mono px-2 py-1 hover:bg-gain/5">
                {/* Background bar */}
                <div
                  className="absolute inset-0 bg-gain/8 transition-all"
                  style={{ width: `${level.percentage}%`, right: 0, left: 'auto' }}
                />
                <span className="relative text-muted-foreground">{formatVolume(level.total)}</span>
                <span className="relative text-center">{formatVolume(level.volume)}</span>
                <span className="relative text-right text-gain font-medium">{formatPrice(level.price)}</span>
              </div>
            ))}
          </div>

          {/* Asks (Sell Orders) */}
          <div>
            <div className="grid grid-cols-3 text-[10px] text-muted-foreground uppercase tracking-wider px-2 py-1.5 border-b border-border/30">
              <span>Ask</span>
              <span className="text-center">Volume</span>
              <span className="text-right">Total</span>
            </div>
            {orderBook.asks.map((level, i) => (
              <div key={i} className="relative grid grid-cols-3 text-[11px] font-mono px-2 py-1 hover:bg-loss/5">
                {/* Background bar */}
                <div
                  className="absolute inset-0 bg-loss/8 transition-all"
                  style={{ width: `${level.percentage}%` }}
                />
                <span className="relative text-loss font-medium">{formatPrice(level.price)}</span>
                <span className="relative text-center">{formatVolume(level.volume)}</span>
                <span className="relative text-right text-muted-foreground">{formatVolume(level.total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/30">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Bid Vol</p>
            <p className="text-xs font-mono font-medium text-gain">{formatVolume(totalBidVolume)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ask Vol</p>
            <p className="text-xs font-mono font-medium text-loss">{formatVolume(totalAskVolume)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Day Vol</p>
            <p className="text-xs font-mono font-medium">{formatVolume(volume || 0)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Vol</p>
            <p className="text-xs font-mono font-medium">{formatVolume(avgVolume || 0)}</p>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/60 text-center italic">
          Simulated depth based on real-time market data. Not actual Level 2 data.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Compact price book showing best bid/ask
 */
export function PriceBook({ price, change, volume, high, low }: {
  price: number | null;
  change: number | null;
  volume: number | null;
  high: number | null;
  low: number | null;
}) {
  if (!price) return null;

  const isPositive = (change || 0) > 0;
  const spread = price * 0.001;
  const bestBid = price - spread / 2;
  const bestAsk = price + spread / 2;

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/20 border border-border/30">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <span className="text-xs text-muted-foreground font-medium">Price Book</span>
      </div>
      <div className="flex items-center gap-3 text-xs font-mono">
        <div>
          <span className="text-muted-foreground mr-1">Bid:</span>
          <span className="text-gain font-medium">{formatPrice(bestBid)}</span>
        </div>
        <div>
          <span className="text-muted-foreground mr-1">Ask:</span>
          <span className="text-loss font-medium">{formatPrice(bestAsk)}</span>
        </div>
        <div>
          <span className="text-muted-foreground mr-1">Last:</span>
          <span className={`font-medium ${isPositive ? "text-gain" : "text-loss"}`}>
            {formatPrice(price)}
          </span>
        </div>
        {high && low && (
          <div>
            <span className="text-muted-foreground mr-1">Range:</span>
            <span>{formatPrice(low)} - {formatPrice(high)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
