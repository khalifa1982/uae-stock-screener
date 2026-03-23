/**
 * Exchange-Style Order Book Component
 * 
 * 4 tabs matching professional trading platforms:
 * 1. Summary - Key metrics, best bid/ask, volume, day stats
 * 2. Price Spectrum - Visual bid/ask with REAL data only (Level 1)
 * 3. MBP (Market by Price) - Real order book data (Level 1 only)
 * 4. Time & Sales - Recent trade history (estimated from day data)
 * 
 * IMPORTANT: Shows ONLY real data from DFM API.
 * No synthetic/fabricated order book levels.
 * DFM provides Level 1 (best bid/ask) only.
 * ADX has no public order book API.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen, ArrowUp, ArrowDown, Activity,
  Wifi, WifiOff, TrendingUp, TrendingDown, BarChart3,
  Clock, Layers, LayoutGrid, Zap, Info, AlertTriangle,
} from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";

// ─── Formatters ────────────────────────────────────────────────────

function fmtPrice(p: number): string {
  return p.toFixed(3);
}

function fmtVol(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return v.toLocaleString();
}

function fmtValue(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2) + "B";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return v.toFixed(0);
}

function fmtTime(t: string | null): string {
  if (!t) return "—";
  try {
    const d = new Date(t);
    return d.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  } catch { return "—"; }
}

// ─── Types ─────────────────────────────────────────────────────────

interface OrderBookProps {
  symbol: string;
  exchange: "ADX" | "DFM";
  price: number | null;
  change: number | null;
  volume: number | null;
  high?: number | null;
  low?: number | null;
  open?: number | null;
  previousClose?: number | null;
  totalTrades?: number | null;
  turnover?: number | null;
}

// ─── Flash Hook ────────────────────────────────────────────────────

function useFlash(value: number | undefined) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (value !== undefined && prev.current !== undefined && value !== prev.current) {
      setFlash(value > prev.current ? "up" : "down");
      const t = setTimeout(() => setFlash(null), 800);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);
  return flash;
}

// ─── No Data Placeholder ──────────────────────────────────────────

function NoDepthData({ message, icon: Icon = Info }: { message: string; icon?: typeof Info }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/40 mb-3" />
      <p className="text-xs text-muted-foreground font-medium mb-1">No Depth Data Available</p>
      <p className="text-[10px] text-muted-foreground/60 max-w-[280px] leading-relaxed">{message}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ORDER BOOK COMPONENT
// ═══════════════════════════════════════════════════════════════════

export function OrderBook({ symbol, exchange, price, change, volume, high, low, open, previousClose, totalTrades, turnover }: OrderBookProps) {
  const { data: orderBook, isLoading, error } = trpc.stocks.orderBook.useQuery(
    { symbol, exchange },
    { refetchInterval: 5_000, staleTime: 3_000 }
  );

  const priceFlash = useFlash(orderBook?.lastPrice);
  const bidFlash = useFlash(orderBook?.bidPrice);
  const askFlash = useFlash(orderBook?.askPrice);

  const hasBids = (orderBook?.bids?.length ?? 0) > 0;
  const hasAsks = (orderBook?.asks?.length ?? 0) > 0;
  const hasAnyDepth = hasBids || hasAsks;

  const totalBidVol = orderBook?.bids?.reduce((s: number, b: any) => s + b.quantity, 0) ?? 0;
  const totalAskVol = orderBook?.asks?.reduce((s: number, a: any) => s + a.quantity, 0) ?? 0;
  const buyPressure = totalBidVol + totalAskVol > 0 ? (totalBidVol / (totalBidVol + totalAskVol)) * 100 : 50;

  // Generate estimated time & sales from day data
  const timeSales = useMemo(() => {
    if (!orderBook) return [];
    const trades: { time: string; quantity: number; price: number; direction: "up" | "down" | "neutral"; value: number }[] = [];
    const lastP = orderBook.lastPrice;
    const prevC = orderBook.previousClose;
    const dayOpen = open ?? previousClose ?? lastP;
    const dayH = high ?? lastP;
    const dayL = low ?? lastP;
    const totalVol = orderBook.totalVolume || (volume ?? 100000);
    const totalTrd = orderBook.totalTrades || Math.max(50, Math.round(totalVol / 5000));

    // Seeded random for deterministic results per symbol
    let seed = 0;
    for (let i = 0; i < symbol.length; i++) seed = ((seed << 5) - seed + symbol.charCodeAt(i)) | 0;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    const marketOpenMin = 10 * 60;
    const marketCloseMin = 15 * 60;
    const tradingMinutes = marketCloseMin - marketOpenMin;

    const numTrades = Math.min(totalTrd, 500);
    const priceRange = dayH - dayL;
    const tickSize = lastP >= 10 ? 0.05 : lastP >= 1 ? 0.01 : 0.001;

    let currentPrice = dayOpen;
    const priceStep = (lastP - dayOpen) / Math.max(numTrades, 1);

    for (let i = 0; i < numTrades; i++) {
      const progress = i / numTrades;
      let minuteOffset: number;
      if (progress < 0.3) {
        minuteOffset = Math.floor((progress / 0.3) * 60);
      } else if (progress < 0.7) {
        minuteOffset = 60 + Math.floor(((progress - 0.3) / 0.4) * 180);
      } else {
        minuteOffset = 240 + Math.floor(((progress - 0.7) / 0.3) * 60);
      }

      minuteOffset = Math.min(tradingMinutes - 1, Math.max(0, minuteOffset + Math.floor(rand() * 3 - 1)));
      const totalMin = marketOpenMin + minuteOffset;
      const hours = Math.floor(totalMin / 60);
      const mins = totalMin % 60;
      const secs = Math.floor(rand() * 60);
      const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

      currentPrice += priceStep + (rand() - 0.5) * priceRange * 0.02;
      currentPrice = Math.max(dayL, Math.min(dayH, currentPrice));
      const tradePrice = Math.round(currentPrice / tickSize) * tickSize;

      const volMultiplier = (progress < 0.15 || progress > 0.85) ? 2.5 : 1;
      const baseQty = Math.round((totalVol / numTrades) * volMultiplier * (0.3 + rand() * 1.4));
      const qty = Math.max(100, baseQty);

      trades.push({
        time: timeStr,
        quantity: qty,
        price: Math.max(tickSize, tradePrice),
        direction: tradePrice > prevC ? "up" : tradePrice < prevC ? "down" : "neutral",
        value: qty * tradePrice,
      });
    }

    trades.sort((a, b) => b.time.localeCompare(a.time));
    return trades;
  }, [orderBook, symbol, open, previousClose, high, low, volume]);

  // ─── Loading / Error States ──────────────────────────────────────

  if (!price) {
    return (
      <Card className="glass-card">
        <CardContent className="py-8 text-center">
          <BookOpen className="h-4 w-4 text-muted-foreground mx-auto mb-2" />
          <p className="text-[11px] text-muted-foreground">Order book data unavailable</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="py-8 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-secondary/50 rounded w-1/3 mx-auto" />
            <div className="h-40 bg-secondary/30 rounded" />
            <div className="h-4 bg-secondary/50 rounded w-1/2 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !orderBook) {
    return (
      <Card className="glass-card">
        <CardContent className="py-8 text-center">
          <WifiOff className="h-4 w-4 text-muted-foreground mx-auto mb-2" />
          <p className="text-[11px] text-muted-foreground">Failed to load order book</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{error?.message}</p>
        </CardContent>
      </Card>
    );
  }

  // ─── Flash class helper ──────────────────────────────────────────
  const flashClass = (f: "up" | "down" | null) =>
    f === "up" ? "flash-green" : f === "down" ? "flash-red" : "";

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-[11px] font-semibold">Order Book — {symbol}</span>
          <Badge variant={orderBook.dataSource === "live" ? "default" : "secondary"} className="text-[9px]">
            {orderBook.dataSource === "live" ? <><Wifi className="h-2.5 w-2.5 mr-0.5" /> LIVE</> : <><WifiOff className="h-2.5 w-2.5 mr-0.5" /> Delayed</>}
          </Badge>
          {orderBook.dataSource === "live" && (
            <Badge variant="outline" className="text-[9px] border-primary/30 text-primary/70">
              Level 1
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Zap className="h-3 w-3" /> Refreshing every 5s
        </div>
      </div>

      {/* ═══ 4-Tab Layout ═══ */}
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-secondary/30 h-9">
          <TabsTrigger value="summary" className="text-[11px] gap-1 data-[state=active]:bg-primary/10">
            <LayoutGrid className="h-3 w-3" /> Summary
          </TabsTrigger>
          <TabsTrigger value="spectrum" className="text-[11px] gap-1 data-[state=active]:bg-primary/10">
            <BarChart3 className="h-3 w-3" /> Price Spectrum
          </TabsTrigger>
          <TabsTrigger value="mbp" className="text-[11px] gap-1 data-[state=active]:bg-primary/10">
            <Layers className="h-3 w-3" /> MBP
          </TabsTrigger>
          <TabsTrigger value="timesales" className="text-[11px] gap-1 data-[state=active]:bg-primary/10">
            <Clock className="h-3 w-3" /> Time & Sales
          </TabsTrigger>
        </TabsList>

        {/* ═══════════ TAB 1: SUMMARY ═══════════ */}
        <TabsContent value="summary" className="mt-3 space-y-1.5">
          <Card className="glass-card">
            <CardContent className="pt-4 space-y-1.5">
              {/* Price Header */}
              <div className="flex items-center justify-between flex-wrap gap-1">
                <div>
                  <div className={`text-xs font-mono font-bold tracking-tight ${flashClass(priceFlash)} ${(change ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
                    {fmtPrice(orderBook.lastPrice)}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[11px] font-mono font-medium ${(change ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
                      {(change ?? 0) >= 0 ? "+" : ""}{orderBook.change?.toFixed(3) ?? "0.000"}
                    </span>
                    <span className={`text-[11px] font-mono ${(change ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
                      ({(change ?? 0) >= 0 ? "+" : ""}{orderBook.changePercent?.toFixed(3) ?? "0.000"}%)
                    </span>
                  </div>
                </div>
                <div className="text-right text-xs font-mono space-y-0.5">
                  <div><span className="text-muted-foreground">Trades: </span><span className="font-medium">{orderBook.totalTrades.toLocaleString()}</span></div>
                  <div><span className="text-muted-foreground">Last: </span><span className="font-medium">{fmtTime(orderBook.lastTradeTime)}</span></div>
                </div>
              </div>

              {/* Key Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="stat-cell">
                  <span className="stat-label">Best Bid</span>
                  <span className={`stat-value ${orderBook.bidPrice > 0 ? "text-gain" : "text-muted-foreground"} ${flashClass(bidFlash)}`}>
                    {orderBook.bidPrice > 0 ? (
                      <>{fmtPrice(orderBook.bidPrice)} <span className="text-[10px] opacity-70">({fmtVol(orderBook.bidVolume)})</span></>
                    ) : (
                      <span className="text-[11px]">No bids</span>
                    )}
                  </span>
                </div>
                <div className="stat-cell">
                  <span className="stat-label">Best Offer</span>
                  <span className={`stat-value ${orderBook.askPrice > 0 ? "text-loss" : "text-muted-foreground"} ${flashClass(askFlash)}`}>
                    {orderBook.askPrice > 0 ? (
                      <>{fmtPrice(orderBook.askPrice)} <span className="text-[10px] opacity-70">({fmtVol(orderBook.askVolume)})</span></>
                    ) : (
                      <span className="text-[11px]">No offers</span>
                    )}
                  </span>
                </div>
                <div className="stat-cell">
                  <span className="stat-label">Volume</span>
                  <span className="stat-value">{fmtVol(orderBook.totalVolume)}</span>
                </div>
                <div className="stat-cell">
                  <span className="stat-label">Turnover</span>
                  <span className="stat-value">{orderBook.totalValue > 0 ? fmtValue(orderBook.totalValue) : "—"}</span>
                </div>
              </div>

              {/* Second Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="stat-cell">
                  <span className="stat-label">Prev Close</span>
                  <span className="stat-value">{fmtPrice(orderBook.previousClose)}</span>
                </div>
                <div className="stat-cell">
                  <span className="stat-label">Open</span>
                  <span className="stat-value">{open ? fmtPrice(open) : "—"}</span>
                </div>
                <div className="stat-cell">
                  <span className="stat-label">High</span>
                  <span className="stat-value">{fmtPrice(orderBook.dayHigh)}</span>
                </div>
                <div className="stat-cell">
                  <span className="stat-label">Low</span>
                  <span className="stat-value">{fmtPrice(orderBook.dayLow)}</span>
                </div>
              </div>

              {/* Third Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="stat-cell">
                  <span className="stat-label">VWAP</span>
                  <span className="stat-value">{fmtPrice(orderBook.vwap)}</span>
                </div>
                <div className="stat-cell">
                  <span className="stat-label">Spread</span>
                  <span className="stat-value">
                    {orderBook.bidPrice > 0 && orderBook.askPrice > 0 ? (
                      <>{fmtPrice(orderBook.spread)} <span className="text-[10px] opacity-70">({orderBook.spreadPercent.toFixed(2)}%)</span></>
                    ) : "—"}
                  </span>
                </div>
                <div className="stat-cell">
                  <span className="stat-label">52W High</span>
                  <span className="stat-value">{orderBook.high52Week > 0 ? fmtPrice(orderBook.high52Week) : "—"}</span>
                </div>
                <div className="stat-cell">
                  <span className="stat-label">52W Low</span>
                  <span className="stat-value">{orderBook.low52Week > 0 ? fmtPrice(orderBook.low52Week) : "—"}</span>
                </div>
              </div>

              {/* Buy/Sell Pressure — only show if we have real bid AND ask data */}
              {hasBids && hasAsks ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gain font-medium flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Buy {buyPressure.toFixed(1)}%
                    </span>
                    <span className="text-loss font-medium flex items-center gap-1">
                      Sell {(100 - buyPressure).toFixed(1)}% <TrendingDown className="h-3 w-3" />
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-secondary/50 overflow-hidden flex">
                    <div className="h-full bg-gain/70 transition-all duration-500" style={{ width: `${buyPressure}%` }} />
                    <div className="h-full bg-loss/70 transition-all duration-500" style={{ width: `${100 - buyPressure}%` }} />
                  </div>
                  <p className="text-[9px] text-muted-foreground/50 text-center">Based on Level 1 best bid/ask volume</p>
                </div>
              ) : (
                <div className="pt-1 text-center">
                  <p className="text-[10px] text-muted-foreground/60 italic">
                    {!hasBids && !hasAsks ? "No bid/ask data available" :
                     !hasBids ? "No bids in market — sell pressure only" :
                     "No offers in market — buy pressure only"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ TAB 2: PRICE SPECTRUM ═══════════ */}
        <TabsContent value="spectrum" className="mt-3">
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                {symbol} Price Spectrum
                <Badge variant="outline" className="text-[8px] ml-auto border-amber-500/30 text-amber-500/70">
                  Level 1 Only
                </Badge>
              </div>

              {hasAnyDepth ? (
                <div className="space-y-0">
                  {/* Ask level (top, red) — only real data */}
                  {orderBook.asks?.map((level: any, i: number) => {
                    const maxVol = Math.max(
                      ...(orderBook.bids?.map((b: any) => b.quantity) ?? [0]),
                      ...(orderBook.asks?.map((a: any) => a.quantity) ?? [0]),
                      1
                    );
                    return (
                      <div key={`ask-${i}`} className="grid grid-cols-[1fr_70px_1fr] items-center h-10 group hover:bg-loss/5 transition-colors">
                        <div />
                        <div className="text-center text-xs font-mono font-medium text-loss">{fmtPrice(level.price)}</div>
                        <div className="flex items-center h-full">
                          <div
                            className="h-7 bg-loss/30 border-r-2 border-loss/70 transition-all duration-300 flex items-center px-2 rounded-r"
                            style={{ width: `${Math.min((level.quantity / maxVol) * 100, 100)}%`, minWidth: '80px' }}
                          >
                            <span className="text-[11px] font-mono text-loss whitespace-nowrap font-medium">
                              {fmtVol(level.quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Separator: Last Price */}
                  <div className="grid grid-cols-[1fr_70px_1fr] items-center h-10 bg-primary/5 border-y border-primary/20 my-1">
                    <div className="text-right pr-2 text-[10px] text-muted-foreground">Last Price</div>
                    <div className={`text-center text-sm font-mono font-bold ${flashClass(priceFlash)}`}>{fmtPrice(orderBook.lastPrice)}</div>
                    <div />
                  </div>

                  {/* Bid level (bottom, green) — only real data */}
                  {orderBook.bids?.map((level: any, i: number) => {
                    const maxVol = Math.max(
                      ...(orderBook.bids?.map((b: any) => b.quantity) ?? [0]),
                      ...(orderBook.asks?.map((a: any) => a.quantity) ?? [0]),
                      1
                    );
                    return (
                      <div key={`bid-${i}`} className="grid grid-cols-[1fr_70px_1fr] items-center h-10 group hover:bg-gain/5 transition-colors">
                        <div className="flex items-center justify-end h-full">
                          <div
                            className="h-7 bg-gain/30 border-l-2 border-gain/70 transition-all duration-300 flex items-center justify-end px-2 rounded-l"
                            style={{ width: `${Math.min((level.quantity / maxVol) * 100, 100)}%`, minWidth: '80px' }}
                          >
                            <span className="text-[11px] font-mono text-gain whitespace-nowrap font-medium">
                              {fmtVol(level.quantity)}
                            </span>
                          </div>
                        </div>
                        <div className="text-center text-xs font-mono font-medium text-gain">{fmtPrice(level.price)}</div>
                        <div />
                      </div>
                    );
                  })}

                  {/* Empty side indicators */}
                  {!hasAsks && (
                    <div className="text-center py-3 text-[11px] text-muted-foreground/60 border-b border-border/20">
                      <AlertTriangle className="h-3 w-3 inline mr-1 text-amber-500/60" />
                      No offers in market
                    </div>
                  )}
                  {!hasBids && (
                    <div className="text-center py-3 text-[11px] text-muted-foreground/60 border-t border-border/20">
                      <AlertTriangle className="h-3 w-3 inline mr-1 text-amber-500/60" />
                      No bids in market
                    </div>
                  )}
                </div>
              ) : exchange === "DFM" ? (
                <NoDepthData
                  message="No bid or ask orders currently in the market for this stock. This can happen outside trading hours or for illiquid stocks."
                  icon={AlertTriangle}
                />
              ) : (
                <NoDepthData
                  message="ADX does not provide a public order book API. Only price data from TradingView is available."
                />
              )}

              {/* Limit bounds info */}
              <div className="mt-3 pt-2 border-t border-border/20 flex justify-between text-[10px] text-muted-foreground/60">
                <span>Limit Down: {fmtPrice(orderBook.limitDown)}</span>
                <span>Limit Up: {fmtPrice(orderBook.limitUp)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ TAB 3: MBP (Market by Price) ═══════════ */}
        <TabsContent value="mbp" className="mt-3">
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                MBP — {symbol}
                <Badge variant="outline" className="text-[8px] ml-auto border-amber-500/30 text-amber-500/70">
                  Level 1 Only
                </Badge>
              </div>

              {hasAnyDepth ? (
                <>
                  {/* MBP Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] font-mono">
                      <thead>
                        <tr className="border-b border-border/30">
                          <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">Orders</th>
                          <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Size</th>
                          <th className="text-right py-1.5 px-2 text-gain font-semibold">Bid</th>
                          <th className="w-px bg-border/30" />
                          <th className="text-left py-1.5 px-2 text-loss font-semibold">Offer</th>
                          <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">Size</th>
                          <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Orders</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: Math.max(orderBook.bids?.length ?? 0, orderBook.asks?.length ?? 0, 1) }).map((_, i) => {
                          const bid = orderBook.bids?.[i];
                          const ask = orderBook.asks?.[i];
                          return (
                            <tr key={i} className="border-b border-border/10 hover:bg-secondary/20 transition-colors">
                              <td className="py-2 px-2 text-muted-foreground">{bid ? `~${bid.orders}` : ""}</td>
                              <td className="py-2 px-2 text-right text-gain font-medium">{bid ? fmtVol(bid.quantity) : ""}</td>
                              <td className="py-2 px-2 text-right text-gain font-semibold text-sm">{bid ? fmtPrice(bid.price) : <span className="text-muted-foreground/40 text-[10px]">—</span>}</td>
                              <td className="w-px bg-border/30" />
                              <td className="py-2 px-2 text-loss font-semibold text-sm">{ask ? fmtPrice(ask.price) : <span className="text-muted-foreground/40 text-[10px]">—</span>}</td>
                              <td className="py-2 px-2 text-loss font-medium">{ask ? fmtVol(ask.quantity) : ""}</td>
                              <td className="py-2 px-2 text-right text-muted-foreground">{ask ? `~${ask.orders}` : ""}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals Row */}
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/30 text-xs font-mono">
                    <div>
                      <span className="text-muted-foreground">Total Bids </span>
                      <span className="text-gain font-bold">{hasBids ? fmtVol(totalBidVol) : "0"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Offers </span>
                      <span className="text-loss font-bold">{hasAsks ? fmtVol(totalAskVol) : "0"}</span>
                    </div>
                  </div>
                </>
              ) : exchange === "DFM" ? (
                <NoDepthData
                  message="No bid or ask orders currently in the market. The DFM public API provides Level 1 data only (best bid/ask). Full depth (Level 2) requires a paid market data subscription."
                  icon={AlertTriangle}
                />
              ) : (
                <NoDepthData
                  message="ADX does not provide a public order book API. Market depth data is not available for this exchange."
                />
              )}

              {/* Data source note */}
              <div className="mt-3 pt-2 border-t border-border/20">
                <p className="text-[9px] text-muted-foreground/50 text-center flex items-center justify-center gap-1">
                  <Info className="h-2.5 w-2.5" />
                  {exchange === "DFM"
                    ? "Showing real Level 1 data from DFM API. Only best bid/ask available from public API."
                    : "No order book data available for ADX stocks."}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ TAB 4: TIME & SALES ═══════════ */}
        <TabsContent value="timesales" className="mt-3">
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Time and Sales — {symbol}
                <Badge variant="outline" className="text-[8px] ml-auto border-amber-500/30 text-amber-500/70">
                  Estimated
                </Badge>
              </div>

              {/* Disclaimer */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-md px-3 py-2 mb-3">
                <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>
                    These trades are <strong>estimated</strong> from daily volume and price data, not real tick-by-tick data.
                    Actual trade times, quantities, and prices may differ. Real time & sales requires a paid market data feed.
                  </span>
                </p>
              </div>

              {/* Trade summary bar */}
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] text-muted-foreground">
                  ~{timeSales.length} est. trades · 10:00 AM – 3:00 PM UAE
                </span>
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="text-gain">▲ {timeSales.filter(t => t.direction === "up").length}</span>
                  <span className="text-loss">▼ {timeSales.filter(t => t.direction === "down").length}</span>
                  <span className="text-muted-foreground">— {timeSales.filter(t => t.direction === "neutral").length}</span>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-[11px] font-mono">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border/30">
                      <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">Time</th>
                      <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Qty</th>
                      <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Price</th>
                      <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Value</th>
                      <th className="text-center py-1.5 px-2 text-muted-foreground font-medium">Dir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeSales.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted-foreground">No trades today</td>
                      </tr>
                    ) : (
                      timeSales.map((trade, i) => (
                        <tr key={i} className={`border-b border-border/10 hover:bg-secondary/20 transition-colors ${trade.direction === "up" ? "bg-gain/3" : trade.direction === "down" ? "bg-loss/3" : ""}`}>
                          <td className="py-1 px-2 text-muted-foreground">{trade.time}</td>
                          <td className="py-1 px-2 text-right font-medium">{trade.quantity.toLocaleString()}</td>
                          <td className={`py-1 px-2 text-right font-medium ${trade.direction === "up" ? "text-gain" : trade.direction === "down" ? "text-loss" : ""}`}>{fmtPrice(trade.price)}</td>
                          <td className="py-1 px-2 text-right text-muted-foreground">{fmtValue(trade.value)}</td>
                          <td className="py-1 px-2 text-center">
                            {trade.direction === "up" ? (
                              <ArrowUp className="h-3 w-3 text-gain inline" />
                            ) : trade.direction === "down" ? (
                              <ArrowDown className="h-3 w-3 text-loss inline" />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Data source note */}
      <p className="text-[10px] text-muted-foreground/60 text-center italic">
        {orderBook.dataSource === "live"
          ? "Live Level 1 data from Dubai Financial Market (DFM). Best bid/ask only — full depth requires paid subscription."
          : "Price data from TradingView. Order book data not available for this exchange."}
      </p>
    </div>
  );
}

/**
 * Compact price book for the stock detail header
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
    { refetchInterval: 5_000, staleTime: 3_000, enabled: !!price }
  );

  if (!price) return null;

  const isPositive = (change || 0) > 0;
  const bidPrice = orderBook?.bidPrice ?? 0;
  const askPrice = orderBook?.askPrice ?? 0;

  return (
    <div className="flex items-center gap-1 sm:gap-1.5 p-3 rounded bg-secondary/20 border border-border/30 flex-wrap">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <span className="text-xs text-muted-foreground font-medium">Price Book</span>
        {orderBook?.dataSource === "live" && (
          <span className="w-1.5 h-1.5 rounded-full bg-gain animate-pulse" />
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-1 text-xs font-mono flex-wrap">
        <div>
          <span className="text-muted-foreground mr-1">Bid:</span>
          <span className="text-gain font-medium">{bidPrice > 0 ? fmtPrice(bidPrice) : "—"}</span>
        </div>
        <div>
          <span className="text-muted-foreground mr-1">Ask:</span>
          <span className="text-loss font-medium">{askPrice > 0 ? fmtPrice(askPrice) : "—"}</span>
        </div>
        <div>
          <span className="text-muted-foreground mr-1">Last:</span>
          <span className={`font-medium ${isPositive ? "text-gain" : "text-loss"}`}>{fmtPrice(price)}</span>
        </div>
        {orderBook?.vwap ? (
          <div>
            <span className="text-muted-foreground mr-1">VWAP:</span>
            <span className="font-medium">{fmtPrice(orderBook.vwap)}</span>
          </div>
        ) : null}
        {high && low && (
          <div className="hidden sm:block">
            <span className="text-muted-foreground mr-1">Range:</span>
            <span>{fmtPrice(low)} — {fmtPrice(high)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
