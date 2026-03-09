import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useAutoRefreshInterval } from "@/hooks/useMarketStatus";
import { MarketStatusBadge } from "@/components/MarketStatusIndicator";
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
  DollarSign,
  Info,
  Download,
  Flame,
  Activity,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type SortField = "symbol" | "price" | "changePercent" | "pe" | "volume" | "marketCap" | "name";
type SortDir = "asc" | "desc";

function formatNumber(num: number | null | undefined, decimals = 2): string {
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
    <span className={`flex items-center gap-0.5 font-mono text-sm font-medium ${isPositive ? "text-gain" : isZero ? "text-muted-foreground" : "text-loss"}`}>
      {isPositive ? <ArrowUp className="h-3 w-3" /> : !isZero ? <ArrowDown className="h-3 w-3" /> : null}
      {isPositive ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function StockLogo({ logoUrl, symbol, size = "sm" }: { logoUrl?: string | null; symbol: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const imgDim = size === "sm" ? "h-4 w-4" : "h-5.5 w-5.5";
  if (logoUrl) {
    return (
      <div className={`${dim} rounded-md bg-white/10 border border-border/30 flex items-center justify-center overflow-hidden shrink-0`}>
        <img src={logoUrl} alt="" className={`${imgDim} object-contain`} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
    );
  }
  return (
    <div className={`${dim} rounded-md bg-muted/50 border border-border/30 flex items-center justify-center shrink-0`}>
      <span className="text-[9px] font-bold text-muted-foreground">{symbol.slice(0, 2)}</span>
    </div>
  );
}

function MoverRow({ stock, onClick }: { stock: any; onClick: () => void }) {
  return (
    <div
      className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/20 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <StockLogo logoUrl={stock.logoUrl} symbol={stock.symbol} />
      <div className="min-w-0 flex-1 overflow-hidden">
        <span className="font-mono text-sm font-semibold">{stock.symbol}</span>
        <p className="text-[11px] text-muted-foreground truncate leading-tight">{stock.name}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 text-right">
        <span className="font-mono text-xs tabular-nums">{stock.price != null ? formatNumber(stock.price) : "—"}</span>
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

  const { data: stocks, isLoading, refetch, isFetching } = trpc.stocks.fetchAll.useQuery(
    { exchange },
    { 
      staleTime: autoRefreshInterval ? 20 * 1000 : 5 * 60 * 1000,
      refetchInterval: autoRefreshInterval,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      gcTime: 30 * 60 * 1000,
    }
  );

  const { data: topMovers } = trpc.stocks.topMovers.useQuery(
    { exchange, limit: 5 },
    {
      staleTime: autoRefreshInterval ? 20 * 1000 : 5 * 60 * 1000,
      refetchInterval: autoRefreshInterval,
      refetchOnWindowFocus: false,
      gcTime: 30 * 60 * 1000,
    }
  );

  const { data: csvData, refetch: fetchCSV, isFetching: csvFetching } = trpc.stocks.exportCSV.useQuery(
    { exchange },
    { enabled: false } // Only fetch on demand
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
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />;
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

  // Only show notice if most ADX stocks have no data
  const adxStocksWithoutData = stocks ? stocks.filter(s => s.exchange === "ADX" && s.price == null).length : 0;
  const totalADXStocks = stocks ? stocks.filter(s => s.exchange === "ADX").length : 0;
  const showADXNotice = totalADXStocks > 0 && adxStocksWithoutData > totalADXStocks * 0.5;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Market Dashboard</h1>
            <MarketStatusBadge />
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            UAE Stock Market — ADX & DFM Exchanges
            {autoRefreshInterval && (
              <span className="ml-2 text-xs text-primary/70">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse mr-1 align-middle" />
                Live — refreshing every {autoRefreshInterval / 1000}s
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={csvFetching || isLoading}
            className="gap-2"
          >
            <Download className={`h-4 w-4 ${csvFetching ? "animate-pulse" : ""}`} />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Stocks</p>
                  <p className="text-xl font-bold font-mono">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[oklch(0.72_0.17_155/10%)] flex items-center justify-center shrink-0">
                  <TrendingUp className="h-5 w-5 text-gain" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Gainers</p>
                  <p className="text-xl font-bold font-mono text-gain">{stats.gainers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[oklch(0.65_0.22_25/10%)] flex items-center justify-center shrink-0">
                  <TrendingDown className="h-5 w-5 text-loss" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Losers</p>
                  <p className="text-xl font-bold font-mono text-loss">{stats.losers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Total Volume</p>
                  <p className="text-xl font-bold font-mono">{formatLargeNumber(stats.totalVolume)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Movers */}
      {topMovers && (topMovers.gainers.length > 0 || topMovers.losers.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Top Gainers */}
          <Card className="border-border/40 bg-card/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-[oklch(0.72_0.17_155/15%)] flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-gain" />
                </div>
                Top Gainers
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {topMovers.gainers.length > 0 ? (
                <div className="space-y-0.5">
                  {topMovers.gainers.map((s: any) => (
                    <MoverRow key={s.symbol} stock={s} onClick={() => setLocation(`/stock/${s.symbol}`)} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No data</p>
              )}
            </CardContent>
          </Card>

          {/* Top Losers */}
          <Card className="border-border/40 bg-card/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-[oklch(0.65_0.22_25/15%)] flex items-center justify-center">
                  <TrendingDown className="h-3.5 w-3.5 text-loss" />
                </div>
                Top Losers
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {topMovers.losers.length > 0 ? (
                <div className="space-y-0.5">
                  {topMovers.losers.map((s: any) => (
                    <MoverRow key={s.symbol} stock={s} onClick={() => setLocation(`/stock/${s.symbol}`)} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No data</p>
              )}
            </CardContent>
          </Card>

          {/* Most Active */}
          <Card className="border-border/40 bg-card/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-[oklch(0.75_0.15_60/15%)] flex items-center justify-center">
                  <Flame className="h-3.5 w-3.5 text-[oklch(0.75_0.15_60)]" />
                </div>
                Most Active
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {topMovers.mostActive.length > 0 ? (
                <div className="space-y-0.5">
                  {topMovers.mostActive.map((s: any) => (
                    <div
                      key={s.symbol}
                      className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => setLocation(`/stock/${s.symbol}`)}
                    >
                      <StockLogo logoUrl={s.logoUrl} symbol={s.symbol} />
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <span className="font-mono text-sm font-semibold">{s.symbol}</span>
                        <p className="text-[11px] text-muted-foreground truncate leading-tight">{s.name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-right">
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
        <div className="flex items-start gap-3 p-3.5 rounded-lg border border-primary/20 bg-primary/5 text-sm">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-foreground/80">
              Some <strong className="text-foreground">ADX stocks</strong> may have limited data. Data is sourced from TradingView Scanner API. Stocks with no trading activity may show incomplete information.
            </p>
          </div>
        </div>
      )}

      {/* Exchange Tabs + Search */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={exchange} onValueChange={(v) => setExchange(v as any)}>
              <TabsList className="bg-secondary/50">
                <TabsTrigger value="ALL" className="text-xs px-4">All Markets</TabsTrigger>
                <TabsTrigger value="DFM" className="text-xs px-4">
                  DFM
                  <span className="ml-1.5 text-[10px] text-muted-foreground">(68)</span>
                </TabsTrigger>
                <TabsTrigger value="ADX" className="text-xs px-4">
                  ADX
                  <span className="ml-1.5 text-[10px] text-muted-foreground">(102)</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by symbol, name, or sector..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-secondary/30 border-border/40 h-9 text-sm"
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20">
                    <th className="text-left p-3 font-medium text-muted-foreground text-xs">
                      <button onClick={() => handleSort("symbol")} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                        Symbol <SortIcon field="symbol" />
                      </button>
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">
                      <button onClick={() => handleSort("name")} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                        Company <SortIcon field="name" />
                      </button>
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground text-xs">
                      <button onClick={() => handleSort("price")} className="flex items-center gap-1.5 justify-end hover:text-foreground transition-colors">
                        Price <SortIcon field="price" />
                      </button>
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground text-xs">
                      <button onClick={() => handleSort("changePercent")} className="flex items-center gap-1.5 justify-end hover:text-foreground transition-colors">
                        Change <SortIcon field="changePercent" />
                      </button>
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">
                      <button onClick={() => handleSort("pe")} className="flex items-center gap-1.5 justify-end hover:text-foreground transition-colors">
                        P/E <SortIcon field="pe" />
                      </button>
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">
                      <button onClick={() => handleSort("volume")} className="flex items-center gap-1.5 justify-end hover:text-foreground transition-colors">
                        Volume <SortIcon field="volume" />
                      </button>
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">
                      <button onClick={() => handleSort("marketCap")} className="flex items-center gap-1.5 justify-end hover:text-foreground transition-colors">
                        Market Cap <SortIcon field="marketCap" />
                      </button>
                    </th>
                    <th className="text-center p-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">
                      Exchange
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center p-12 text-muted-foreground">
                        {search ? "No stocks match your search." : "No data available. Click Refresh to load."}
                      </td>
                    </tr>
                  ) : (
                    filteredStocks.map((stock) => {
                      const hasData = stock.price != null;
                      return (
                        <tr
                          key={`${stock.exchange}-${stock.symbol}`}
                          className={`border-b border-border/20 transition-colors cursor-pointer ${hasData ? "hover:bg-muted/20" : "hover:bg-muted/10 opacity-60"}`}
                          onClick={() => setLocation(`/stock/${stock.symbol}`)}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              {stock.logoUrl ? (
                                <div className="h-7 w-7 rounded-md bg-white/10 border border-border/30 flex items-center justify-center overflow-hidden shrink-0">
                                  <img src={stock.logoUrl} alt="" className="h-5 w-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                </div>
                              ) : (
                                <div className="h-7 w-7 rounded-md bg-muted/50 border border-border/30 flex items-center justify-center shrink-0">
                                  <span className="text-[10px] font-bold text-muted-foreground">{stock.symbol.slice(0, 2)}</span>
                                </div>
                              )}
                              <div>
                                <span className="font-mono font-semibold text-foreground">{stock.symbol}</span>
                                <span className="text-xs text-muted-foreground lg:hidden block mt-0.5 truncate max-w-[180px]">
                                  {stock.name}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 hidden lg:table-cell">
                            <span className="text-sm text-foreground/80 truncate block max-w-[260px]">{stock.name}</span>
                            <span className="text-xs text-muted-foreground">{stock.sector}</span>
                          </td>
                          <td className="p-3 text-right">
                            {hasData ? (
                              <>
                                <span className="font-mono font-medium">{formatNumber(stock.price)}</span>
                                <span className="text-[11px] text-muted-foreground ml-1">AED</span>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">No data</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {hasData ? <ChangeDisplay value={stock.changePercent} /> : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="p-3 text-right hidden md:table-cell">
                            <span className="font-mono text-sm">{hasData && stock.pe != null ? formatNumber(stock.pe, 1) : "—"}</span>
                          </td>
                          <td className="p-3 text-right hidden md:table-cell">
                            <span className="font-mono text-sm">{hasData ? formatLargeNumber(stock.volume) : "—"}</span>
                          </td>
                          <td className="p-3 text-right hidden lg:table-cell">
                            <span className="font-mono text-sm">{hasData ? formatLargeNumber(stock.marketCap) : "—"}</span>
                          </td>
                          <td className="p-3 text-center hidden sm:table-cell">
                            <Badge variant="outline" className={`text-[10px] font-mono ${stock.exchange === "ADX" ? "border-primary/30 text-primary" : "border-chart-2/30 text-chart-2"}`}>
                              {stock.exchange}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              {filteredStocks.length > 0 && (
                <div className="p-3 text-xs text-muted-foreground border-t border-border/30 flex items-center justify-between">
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
    </div>
  );
}
