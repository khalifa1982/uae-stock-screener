import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Grid3X3, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

function getHeatColor(change: number | null): string {
  if (change == null) return "bg-zinc-800/50";
  if (change >= 5) return "bg-emerald-600/80";
  if (change >= 3) return "bg-emerald-600/60";
  if (change >= 1) return "bg-emerald-600/40";
  if (change >= 0.1) return "bg-emerald-600/25";
  if (change > -0.1) return "bg-zinc-700/50";
  if (change > -1) return "bg-red-600/25";
  if (change > -3) return "bg-red-600/40";
  if (change > -5) return "bg-red-600/60";
  return "bg-red-600/80";
}

function getTextColor(change: number | null): string {
  if (change == null) return "text-zinc-500";
  if (change >= 0.1) return "text-emerald-100";
  if (change > -0.1) return "text-zinc-300";
  return "text-red-100";
}

function formatMarketCap(n: number | null): string {
  if (n == null) return "";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  return `${(n / 1e3).toFixed(0)}K`;
}

interface StockData {
  symbol: string;
  name?: string | null;
  sector?: string | null;
  exchange: string;
  price?: number | null | undefined;
  changePercent?: number | null | undefined;
  marketCap?: number | null | undefined;
  volume?: number | null | undefined;
}

export default function Heatmap() {
  const [exchange, setExchange] = useState<"ALL" | "DFM" | "ADX">("DFM");
  const [sortBy, setSortBy] = useState<"marketCap" | "change" | "volume">("marketCap");

  const { data: allStocks, isLoading, refetch } = trpc.stocks.fetchAll.useQuery(
    { exchange },
    { refetchInterval: 5 * 60 * 1000 }
  );

  const stocksWithData = useMemo(() => {
    if (!allStocks) return [];
    return (allStocks as StockData[]).filter(s => s.price != null);
  }, [allStocks]);

  const sectorGroups = useMemo(() => {
    const groups = new Map<string, StockData[]>();
    for (const stock of stocksWithData) {
      const sector = stock.sector || "Other";
      if (!groups.has(sector)) groups.set(sector, []);
      groups.get(sector)!.push(stock);
    }
    // Sort stocks within each sector
    for (const [, stocks] of Array.from(groups.entries())) {
      stocks.sort((a: StockData, b: StockData) => {
        if (sortBy === "marketCap") return (b.marketCap || 0) - (a.marketCap || 0);
        if (sortBy === "change") return Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0);
        return (b.volume || 0) - (a.volume || 0);
      });
    }
    // Sort sectors by total market cap
    return Array.from(groups.entries()).sort((a, b) => {
      const aTotal = a[1].reduce((sum, s) => sum + (s.marketCap || 0), 0);
      const bTotal = b[1].reduce((sum, s) => sum + (s.marketCap || 0), 0);
      return bTotal - aTotal;
    });
  }, [stocksWithData, sortBy]);

  const marketSummary = useMemo(() => {
    const gainers = stocksWithData.filter(s => (s.changePercent || 0) > 0).length;
    const losers = stocksWithData.filter(s => (s.changePercent || 0) < 0).length;
    const unchanged = stocksWithData.length - gainers - losers;
    const avgChange = stocksWithData.length > 0
      ? stocksWithData.reduce((sum, s) => sum + (s.changePercent || 0), 0) / stocksWithData.length
      : 0;
    return { gainers, losers, unchanged, avgChange, total: stocksWithData.length };
  }, [stocksWithData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Market Heatmap</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visual overview of stock performance by sector
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold">{marketSummary.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-emerald-400">Gainers</p>
            <p className="text-lg font-bold text-emerald-400">{marketSummary.gainers}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-red-400">Losers</p>
            <p className="text-lg font-bold text-red-400">{marketSummary.losers}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-zinc-400">Unchanged</p>
            <p className="text-lg font-bold text-zinc-400">{marketSummary.unchanged}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Avg Change</p>
            <p className={`text-lg font-bold ${marketSummary.avgChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {marketSummary.avgChange >= 0 ? "+" : ""}{marketSummary.avgChange.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={exchange} onValueChange={(v) => setExchange(v as any)}>
          <TabsList className="bg-background/50">
            <TabsTrigger value="DFM" className="text-xs">DFM</TabsTrigger>
            <TabsTrigger value="ADX" className="text-xs">ADX</TabsTrigger>
            <TabsTrigger value="ALL" className="text-xs">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          Size by:
          <Button variant={sortBy === "marketCap" ? "secondary" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setSortBy("marketCap")}>
            Market Cap
          </Button>
          <Button variant={sortBy === "volume" ? "secondary" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setSortBy("volume")}>
            Volume
          </Button>
          <Button variant={sortBy === "change" ? "secondary" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setSortBy("change")}>
            Change
          </Button>
        </div>
      </div>

      {/* Color Legend */}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <span>-5%+</span>
        <div className="h-3 w-6 rounded bg-red-600/80" />
        <div className="h-3 w-6 rounded bg-red-600/60" />
        <div className="h-3 w-6 rounded bg-red-600/40" />
        <div className="h-3 w-6 rounded bg-red-600/25" />
        <div className="h-3 w-6 rounded bg-zinc-700/50" />
        <div className="h-3 w-6 rounded bg-emerald-600/25" />
        <div className="h-3 w-6 rounded bg-emerald-600/40" />
        <div className="h-3 w-6 rounded bg-emerald-600/60" />
        <div className="h-3 w-6 rounded bg-emerald-600/80" />
        <span>+5%+</span>
      </div>

      {/* Heatmap Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-zinc-800/30 animate-pulse" />
          ))}
        </div>
      ) : stocksWithData.length === 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Grid3X3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No stock data available for this exchange</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try refreshing or switching to DFM exchange
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sectorGroups.map(([sector, stocks]) => (
            <div key={sector}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold">{sector}</h3>
                <Badge variant="outline" className="text-[10px]">{stocks.length}</Badge>
                <span className={`text-xs font-mono ${
                  stocks.reduce((s, st) => s + (st.changePercent || 0), 0) / stocks.length >= 0
                    ? "text-emerald-400" : "text-red-400"
                }`}>
                  {(() => {
                    const avg = stocks.reduce((s, st) => s + (st.changePercent || 0), 0) / stocks.length;
                    return `${avg >= 0 ? "+" : ""}${avg.toFixed(2)}%`;
                  })()}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {stocks.map(stock => (
                  <Link key={stock.symbol} href={`/stock/${stock.symbol}`}>
                    <div
                      className={`${getHeatColor(stock.changePercent ?? null)} ${getTextColor(stock.changePercent ?? null)} rounded-lg p-3 cursor-pointer hover:ring-1 hover:ring-white/20 transition-all group relative overflow-hidden`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">{stock.symbol}</p>
                          <p className="text-[10px] opacity-70 truncate">{stock.name}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-end justify-between">
                        <p className="text-sm font-mono font-bold">
                          {stock.price?.toFixed(2) || "—"}
                        </p>
                        <div className="flex items-center gap-0.5">
                          {(stock.changePercent || 0) >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span className="text-xs font-mono font-bold">
                            {stock.changePercent != null
                              ? `${stock.changePercent >= 0 ? "+" : ""}${stock.changePercent.toFixed(2)}%`
                              : "—"}
                          </span>
                        </div>
                      </div>
                        {stock.marketCap ? (
                        <p className="text-[9px] opacity-50 mt-1">
                          MCap: {formatMarketCap(stock.marketCap ?? null)}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
