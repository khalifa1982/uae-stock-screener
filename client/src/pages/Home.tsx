import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { usePriceFlashes, getFlashClass, getPriceFlashClass } from "@/hooks/usePriceFlash";
import { useAutoRefreshInterval } from "@/hooks/useMarketStatus";
import { MarketStatusBadge } from "@/components/MarketStatusIndicator";
import { RealtimeIndicator } from "@/components/RealtimeIndicator";
import { useRealtimePrices } from "@/hooks/useRealtimePrices";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Building2,
  Info,
  Download,
  Flame,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type SortField = "symbol" | "price" | "changePercent" | "pe" | "volume" | "marketCap" | "name";
type SortDir = "asc" | "desc";

function formatNumber(num: number | null | undefined, decimals = 3): string {
  if (num == null || isNaN(num)) return "—";
  return num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatLargeNumber(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return "—";
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return num.toLocaleString();
}

function ChangeDisplay({ value }: { value: number | null | undefined }) {
  if (value == null || isNaN(value)) return <span className="text-muted-foreground text-xs">—</span>;
  const isPositive = value > 0;
  const isZero = value === 0;
  return (
    <span className={`flex items-center gap-0.5 font-mono text-sm font-semibold ${isPositive ? "text-gain neon-text-gain" : isZero ? "text-muted-foreground" : "text-loss neon-text-loss"}`}>
      {isPositive ? <ArrowUp className="h-3 w-3" /> : !isZero ? <ArrowDown className="h-3 w-3" /> : null}
      {isPositive ? "+" : ""}{value.toFixed(3)}%
    </span>
  );
}

function StockLogo({ logoUrl, symbol, size = "sm" }: { logoUrl?: string | null; symbol: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const imgDim = size === "sm" ? "h-4.5 w-4.5" : "h-6 w-6";
  if (logoUrl) {
    return (
      <div className={`${dim} rounded-lg bg-white/8 border border-white/10 flex items-center justify-center overflow-hidden shrink-0`}>
        <img src={logoUrl} alt="" className={`${imgDim} object-contain`} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
    );
  }
  return (
    <div className={`${dim} rounded-lg bg-gradient-to-br from-primary/10 to-neon-purple/5 border border-primary/10 flex items-center justify-center shrink-0`}>
      <span className="text-[9px] font-bold text-primary/70">{symbol.slice(0, 2)}</span>
    </div>
  );
}

function MoverRow({ stock, onClick }: { stock: any; onClick: () => void }) {
  return (
    <div
      className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl hover:bg-white/[0.03] cursor-pointer transition-all group"
      onClick={onClick}
    >
      <StockLogo logoUrl={stock.logoUrl} symbol={stock.symbol} />
      <div className="min-w-0 flex-1 overflow-hidden">
        <span className="font-mono text-[13px] font-semibold text-foreground/90 group-hover:text-foreground transition-colors">{stock.symbol}</span>
        <p className="text-[10px] text-muted-foreground/60 truncate leading-tight">{stock.name}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-right">
        <span className="font-mono text-[13px] tabular-nums text-foreground/80">{formatNumber(stock.price)}</span>
        <ChangeDisplay value={stock.changePercent} />
      </div>
    </div>
  );
}

function StockTableSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 border-b border-border/20">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-48 flex-1" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [exchange, setExchange] = useState<"ADX" | "DFM" | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("marketCap");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const autoRefreshInterval = useAutoRefreshInterval();
  // WebSocket connection for real-time indicator (subscribe to a few key stocks)
  const wsSymbols = useMemo(() => ["EMAAR", "ETISALAT", "FAB"], []);
  const wsExchanges = useMemo(() => ["DFM", "ADX", "ADX"], []);
  const { isConnected: wsConnected } = useRealtimePrices(wsSymbols, wsExchanges);

  // 5-second refresh during market hours for exchange-like experience
  const fastRefresh = autoRefreshInterval ? 5_000 : undefined;

  const { data: stocks, isLoading, refetch, isFetching } = trpc.stocks.fetchAll.useQuery(
    { exchange },
    { 
      staleTime: fastRefresh ? 3_000 : 5 * 60 * 1000,
      refetchInterval: fastRefresh,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      gcTime: 30 * 60 * 1000,
    }
  );

  const { data: topMovers } = trpc.stocks.topMovers.useQuery(
    { exchange, limit: 5 },
    {
      staleTime: fastRefresh ? 3_000 : 5 * 60 * 1000,
      refetchInterval: fastRefresh,
      refetchOnWindowFocus: false,
      gcTime: 30 * 60 * 1000,
    }
  );

  // Track price changes for flash effects (exchange-style)
  const priceFlashes = usePriceFlashes(stocks as any);

  const { data: csvData, refetch: fetchCSV, isFetching: csvFetching } = trpc.stocks.exportCSV.useQuery(
    { exchange },
    { enabled: false }
  );

  const handleExportCSV = async () => {
    try {
      const result = await fetchCSV();
      if (result.data) {
        const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.data.filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("CSV exported successfully");
      }
    } catch {
      toast.error("Failed to export CSV");
    }
  };

  const filteredStocks = useMemo(() => {
    if (!stocks) return [];
    let result = [...stocks];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        s => s.symbol.toLowerCase().includes(q) || (s.name && s.name.toLowerCase().includes(q)) || (s.sector && s.sector.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      const aHasPrice = a.price != null;
      const bHasPrice = b.price != null;
      if (aHasPrice && !bHasPrice) return -1;
      if (!aHasPrice && bHasPrice) return 1;

      let aVal: any = (a as any)[sortField];
      let bVal: any = (b as any)[sortField];
      if (aVal == null) aVal = sortDir === "asc" ? Infinity : -Infinity;
      if (bVal == null) bVal = sortDir === "asc" ? Infinity : -Infinity;
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [stocks, search, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 opacity-30 group-hover:opacity-60 transition-opacity" />;
    return sortDir === "asc" 
      ? <ArrowUp className="h-3.5 w-3.5 text-primary drop-shadow-[0_0_4px_var(--primary)]" /> 
      : <ArrowDown className="h-3.5 w-3.5 text-primary drop-shadow-[0_0_4px_var(--primary)]" />;
  };

  const stats = useMemo(() => {
    if (!stocks || stocks.length === 0) return null;
    const withPrice = stocks.filter(s => s.price != null);
    const gainers = withPrice.filter(s => (s.changePercent ?? 0) > 0);
    const losers = withPrice.filter(s => (s.changePercent ?? 0) < 0);
    const totalMarketCap = withPrice.reduce((sum, s) => sum + (s.marketCap ?? 0), 0);
    const totalVolume = withPrice.reduce((sum, s) => sum + (s.volume ?? 0), 0);
    return {
      total: stocks.length,
      withPrice: withPrice.length,
      gainers: gainers.length,
      losers: losers.length,
      totalMarketCap,
      totalVolume,
    };
  }, [stocks]);

  const adxStocksWithoutData = stocks ? stocks.filter(s => s.exchange === "ADX" && s.price == null).length : 0;
  const totalADXStocks = stocks ? stocks.filter(s => s.exchange === "ADX").length : 0;
  const showADXNotice = totalADXStocks > 0 && adxStocksWithoutData > totalADXStocks * 0.5;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Market Dashboard</h1>
            <MarketStatusBadge />
            <RealtimeIndicator isConnected={wsConnected} />
          </div>
          <p className="text-muted-foreground/70 text-sm mt-1.5">
            uae.market — ADX & DFM Exchanges
            {autoRefreshInterval && (
              <span className="ml-2 text-xs text-primary/80 font-medium">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse mr-1 align-middle" />
                Live — refreshing every {autoRefreshInterval / 1000}s
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button
            onClick={handleExportCSV}
            disabled={csvFetching || isLoading}
            className="btn-premium gap-2"
          >
            <Download className={`h-3.5 w-3.5 ${csvFetching ? "animate-pulse" : ""}`} />
            <span className="text-xs">Export CSV</span>
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-premium btn-premium-primary gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span className="text-xs">{isFetching ? "Loading..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* ─── Stats Cards ─── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="gradient-border-card p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-[0.12em]">Stocks</p>
                <p className="text-2xl font-bold font-mono text-foreground tracking-tight">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="gradient-border-card p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-neon-green/15 to-neon-green/5 flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5 text-gain" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-[0.12em]">Gainers</p>
                <p className="text-2xl font-bold font-mono text-gain tracking-tight">{stats.gainers}</p>
              </div>
            </div>
          </div>
          <div className="gradient-border-card p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-neon-red/15 to-neon-red/5 flex items-center justify-center shrink-0">
                <TrendingDown className="h-5 w-5 text-loss" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-[0.12em]">Losers</p>
                <p className="text-2xl font-bold font-mono text-loss tracking-tight">{stats.losers}</p>
              </div>
            </div>
          </div>
          <div className="gradient-border-card p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-neon-purple/15 to-neon-purple/5 flex items-center justify-center shrink-0">
                <BarChart3 className="h-5 w-5 text-neon-purple" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-[0.12em]">Total Volume</p>
                <p className="text-2xl font-bold font-mono text-foreground tracking-tight">{formatLargeNumber(stats.totalVolume)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Top Movers ─── */}
      {topMovers && (topMovers.gainers.length > 0 || topMovers.losers.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border/30 bg-card/40 backdrop-blur-sm neon-card overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-neon-green/15 to-neon-green/5 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-gain" />
                </div>
                <span>Top Gainers</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-1.5 pb-3">
              {topMovers.gainers.length > 0 ? (
                <div className="space-y-0">
                  {topMovers.gainers.map((s: any) => (
                    <MoverRow key={s.symbol} stock={s} onClick={() => setLocation(`/stock/${s.symbol}`)} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No data</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/30 bg-card/40 backdrop-blur-sm neon-card overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-neon-red/15 to-neon-red/5 flex items-center justify-center">
                  <TrendingDown className="h-3.5 w-3.5 text-loss" />
                </div>
                <span>Top Losers</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-1.5 pb-3">
              {topMovers.losers.length > 0 ? (
                <div className="space-y-0">
                  {topMovers.losers.map((s: any) => (
                    <MoverRow key={s.symbol} stock={s} onClick={() => setLocation(`/stock/${s.symbol}`)} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No data</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/30 bg-card/40 backdrop-blur-sm neon-card overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-neon-gold/15 to-neon-gold/5 flex items-center justify-center">
                  <Flame className="h-3.5 w-3.5 text-neon-gold" />
                </div>
                <span>Most Active</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-1.5 pb-3">
              {topMovers.mostActive.length > 0 ? (
                <div className="space-y-0">
                  {topMovers.mostActive.map((s: any) => (
                    <div
                      key={s.symbol}
                      className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl hover:bg-white/[0.03] cursor-pointer transition-all group"
                      onClick={() => setLocation(`/stock/${s.symbol}`)}
                    >
                      <StockLogo logoUrl={s.logoUrl} symbol={s.symbol} />
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <span className="font-mono text-[13px] font-semibold text-foreground/90">{s.symbol}</span>
                        <p className="text-[10px] text-muted-foreground/60 truncate leading-tight">{s.name}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatLargeNumber(s.volume)}</span>
                        <ChangeDisplay value={s.changePercent} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No data</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ADX Notice */}
      {showADXNotice && !isLoading && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-primary/15 bg-primary/[0.03] text-sm backdrop-blur-sm">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-foreground/70 text-[13px]">
              Some <strong className="text-foreground/90">ADX stocks</strong> may have limited data. Data is sourced from TradingView Scanner API.
            </p>
          </div>
        </div>
      )}

      {/* ─── Stock Table ─── */}
      <Card className="border-border/30 bg-card/30 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={exchange} onValueChange={(v) => setExchange(v as any)}>
              <TabsList className="bg-secondary/40 border border-border/20">
                <TabsTrigger value="ALL" className="text-xs px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">All Markets</TabsTrigger>
                <TabsTrigger value="DFM" className="text-xs px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  DFM
                  <span className="ml-1.5 text-[10px] text-muted-foreground/50">(68)</span>
                </TabsTrigger>
                <TabsTrigger value="ADX" className="text-xs px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  ADX
                  <span className="ml-1.5 text-[10px] text-muted-foreground/50">(102)</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <Input
                placeholder="Search by symbol, name, or sector..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-secondary/20 border-border/30 h-9 text-sm placeholder:text-muted-foreground/40"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <StockTableSkeleton />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th className="text-left">
                      <button onClick={() => handleSort("symbol")} className="group flex items-center gap-1.5 hover:text-foreground transition-colors">
                        Symbol <SortIcon field="symbol" />
                      </button>
                    </th>
                    <th className="text-left hidden lg:table-cell">
                      <button onClick={() => handleSort("name")} className="group flex items-center gap-1.5 hover:text-foreground transition-colors">
                        Company <SortIcon field="name" />
                      </button>
                    </th>
                    <th className="text-right">
                      <button onClick={() => handleSort("price")} className="group flex items-center gap-1.5 justify-end hover:text-foreground transition-colors">
                        Price (AED) <SortIcon field="price" />
                      </button>
                    </th>
                    <th className="text-right">
                      <button onClick={() => handleSort("changePercent")} className="group flex items-center gap-1.5 justify-end hover:text-foreground transition-colors">
                        Chg% <SortIcon field="changePercent" />
                      </button>
                    </th>
                    <th className="text-right hidden md:table-cell">
                      <button onClick={() => handleSort("pe")} className="group flex items-center gap-1.5 justify-end hover:text-foreground transition-colors">
                        P/E <SortIcon field="pe" />
                      </button>
                    </th>
                    <th className="text-right hidden md:table-cell">
                      <button onClick={() => handleSort("volume")} className="group flex items-center gap-1.5 justify-end hover:text-foreground transition-colors">
                        Volume <SortIcon field="volume" />
                      </button>
                    </th>
                    <th className="text-right hidden lg:table-cell">
                      <button onClick={() => handleSort("marketCap")} className="group flex items-center gap-1.5 justify-end hover:text-foreground transition-colors">
                        Mkt Cap <SortIcon field="marketCap" />
                      </button>
                    </th>
                    <th className="text-center hidden sm:table-cell">
                      Exch
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center p-12 text-muted-foreground/60">
                        {search ? "No stocks match your search." : "No data available. Click Refresh to load."}
                      </td>
                    </tr>
                  ) : (
                    filteredStocks.map((stock) => {
                      const hasData = stock.price != null;
                      return (
                        <tr
                          key={`${stock.exchange}-${stock.symbol}`}
                          className={`cursor-pointer transition-colors ${hasData ? "" : "opacity-50"} ${getFlashClass(priceFlashes, stock.exchange, stock.symbol)}`}
                          onClick={() => setLocation(`/stock/${stock.symbol}`)}
                        >
                          <td>
                            <div className="flex items-center gap-2.5">
                              <StockLogo logoUrl={stock.logoUrl} symbol={stock.symbol} />
                              <div>
                                <span className="font-mono font-semibold text-[13px] text-foreground/90">{stock.symbol}</span>
                                <span className="text-[11px] text-muted-foreground/50 lg:hidden block mt-0.5 truncate max-w-[160px]">
                                  {stock.name}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="hidden lg:table-cell">
                            <span className="text-[13px] text-foreground/70 truncate block max-w-[240px]">{stock.name}</span>
                            <span className="text-[11px] text-muted-foreground/40">{stock.sector}</span>
                          </td>
                          <td className="text-right">
                            {hasData ? (
                              <>
                                <span className={`font-mono font-medium text-[13px] ${getPriceFlashClass(priceFlashes, stock.exchange, stock.symbol)}`}>{formatNumber(stock.price)}</span>
                                <span className="text-[10px] text-muted-foreground/40 ml-1">AED</span>
                              </>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/40 italic">No data</span>
                            )}
                          </td>
                          <td className="text-right">
                            {hasData ? <ChangeDisplay value={stock.changePercent} /> : <span className="text-xs text-muted-foreground/40">—</span>}
                          </td>
                          <td className="text-right hidden md:table-cell">
                            <span className="font-mono text-[13px] text-foreground/70">{hasData && stock.pe != null ? formatNumber(stock.pe, 1) : "—"}</span>
                          </td>
                          <td className="text-right hidden md:table-cell">
                            <span className="font-mono text-[13px] text-foreground/70">{hasData ? formatLargeNumber(stock.volume) : "—"}</span>
                          </td>
                          <td className="text-right hidden lg:table-cell">
                            <span className="font-mono text-[13px] text-foreground/70">{hasData ? formatLargeNumber(stock.marketCap) : "—"}</span>
                          </td>
                          <td className="text-center hidden sm:table-cell">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border ${stock.exchange === "ADX" ? "border-primary/20 text-primary/80 bg-primary/[0.05]" : "border-neon-green/20 text-neon-green/80 bg-neon-green/[0.05]"}`}>
                              {stock.exchange}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              {filteredStocks.length > 0 && (
                <div className="p-3 text-[11px] text-muted-foreground/50 border-t border-border/20 flex items-center justify-between">
                  <span>
                    Showing {filteredStocks.length} of {stocks?.length ?? 0} stocks
                    {search && ` matching "${search}"`}
                  </span>
                  <span>
                    {stats?.withPrice ?? 0} with live data
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Footer ─── */}
      <footer className="mt-16 border-t border-border/20 rounded-xl overflow-hidden">
        <div className="py-10 px-6 bg-card/20 backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-neon-purple/10 flex items-center justify-center border border-primary/15">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <span className="font-bold text-lg tracking-tight">uae.market</span>
              </div>
              <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
                Real-time market intelligence for Abu Dhabi Securities Exchange (ADX) and Dubai Financial Market (DFM). 
                Visit us at <a href="https://www.uae.market" className="text-primary/80 hover:text-primary hover:underline transition-colors">www.uae.market</a>
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-[11px] uppercase tracking-[0.12em] text-muted-foreground/50">Markets Covered</h4>
              <div className="space-y-1.5 text-[13px] text-muted-foreground/50">
                <p>Abu Dhabi Securities Exchange (ADX)</p>
                <p>Dubai Financial Market (DFM)</p>
                <p>170+ Listed Securities</p>
                <p>All Sectors & Industries</p>
              </div>
            </div>
          </div>

          <div className="border-t border-border/15 mt-8 pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground/40">
                  Developed and designed by
                </span>
                <a 
                  href="https://www.aboood.ai" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/8 to-neon-purple/5 border border-primary/15 hover:border-primary/30 transition-all group"
                >
                  <span className="font-bold text-sm bg-gradient-to-r from-primary to-neon-purple bg-clip-text text-transparent">
                    Aboood.AI
                  </span>
                  <svg className="w-3 h-3 text-muted-foreground/40 group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
              <p className="text-[10px] text-muted-foreground/30 text-center md:text-right leading-relaxed max-w-md">
                Brain AI — The first independent Arab AI system. Born in the UAE with 16 parallel neural engines.
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground/25 text-center mt-4">
              Disclaimer: This platform is for informational purposes only. Not financial advice.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
