import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { usePriceFlashes, getFlashClass, getPriceFlashClass } from "@/hooks/usePriceFlash";
import { useAutoRefreshInterval } from "@/hooks/useMarketStatus";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Building2,
  Download,
  ChevronRight,
  Activity,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type SortField = "symbol" | "price" | "changePercent" | "pe" | "volume" | "marketCap" | "name";
type SortDir = "asc" | "desc";

function fmt(num: number | null | undefined, d?: number): string {
  if (num == null || isNaN(num)) return "—";
  if (d === undefined) {
    const rounded = Math.round(num * 1000) / 1000;
    const third = Math.round((rounded * 1000) % 10);
    d = third !== 0 ? 3 : 2;
  }
  return num.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtLg(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return "—";
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return num.toLocaleString();
}

/** Deterministic color for ticker badge based on symbol hash */
function getTickerColor(symbol: string): string {
  const colors = [
    "#1a73e8", "#1e8e3e", "#e8710a", "#d93025", "#9334e6",
    "#185abc", "#137333", "#b31412", "#7b1fa2", "#0d652d",
    "#174ea6", "#c5221f",
  ];
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = ((hash << 5) - hash) + symbol.charCodeAt(i);
    hash = hash & hash;
  }
  return colors[Math.abs(hash) % colors.length];
}

/** Google Finance-style colored ticker badge */
function TickerBadge({ symbol, size = "sm" }: { symbol: string; size?: "sm" | "md" }) {
  const color = getTickerColor(symbol);
  const sizeClass = size === "md" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[10px]";
  const display = symbol.length > 7 ? symbol.slice(0, 7) : symbol;
  return (
    <span
      style={{ backgroundColor: color }}
      className={`text-white font-bold rounded ${sizeClass} inline-flex items-center shrink-0 leading-none tracking-wide`}
    >
      {display}
    </span>
  );
}

/** Company logo with fallback to ticker badge */
function StockLogo({ logoUrl, symbol, size = "sm" }: { logoUrl?: string | null; symbol: string; size?: "sm" | "md" }) {
  const dim = size === "md" ? "h-8 w-8" : "h-6 w-6";
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={symbol}
        className={`${dim} rounded-full object-contain bg-white border border-border/30 shrink-0`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
        }}
      />
    );
  }
  return <TickerBadge symbol={symbol} size={size} />;
}

function Chg({ value }: { value: number | null | undefined }) {
  if (value == null || isNaN(value)) return <span className="text-muted-foreground">—</span>;
  const pos = value > 0;
  const zero = value === 0;
  return (
    <span className={`font-medium tabular-nums ${pos ? "text-gain" : zero ? "text-muted-foreground" : "text-loss"}`}>
      {pos ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

/** Google Finance-style "You may be interested in" row */
function InterestRow({ stock, onClick }: { stock: any; onClick: () => void }) {
  const isUp = (stock.changePercent ?? 0) > 0;
  const isDown = (stock.changePercent ?? 0) < 0;
  const change = stock.changePercent ?? 0;
  const priceChange = stock.price && stock.previousClose ? stock.price - stock.previousClose : null;
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 py-3 px-2 border-b border-border/40 hover:bg-accent/40 cursor-pointer transition-colors"
    >
      <div className="relative shrink-0">
        <StockLogo logoUrl={stock.logoUrl} symbol={stock.symbol} size="md" />
        <span className="hidden"><TickerBadge symbol={stock.symbol} size="md" /></span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <TickerBadge symbol={stock.symbol} />
          <p className="text-sm text-foreground truncate">{stock.name || stock.symbol}</p>
        </div>
      </div>
      <div className="text-right shrink-0 flex items-center gap-3">
        <span className="text-sm font-medium text-foreground tabular-nums">{fmt(stock.price)}</span>
        {priceChange != null && (
          <span className={`text-xs tabular-nums ${isUp ? "text-gain" : isDown ? "text-loss" : "text-muted-foreground"}`}>
            {isUp ? "+" : ""}{fmt(priceChange)}
          </span>
        )}
        <span className={`text-xs font-medium tabular-nums flex items-center gap-0.5 min-w-[65px] justify-end ${isUp ? "text-gain" : isDown ? "text-loss" : "text-muted-foreground"}`}>
          {isUp ? <ArrowUp className="h-3 w-3" /> : isDown ? <ArrowDown className="h-3 w-3" /> : null}
          {Math.abs(change).toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

/** Google Finance-style Market Trends stock row */
function TrendRow({ stock, onClick }: { stock: any; onClick: () => void }) {
  const isUp = (stock.changePercent ?? 0) > 0;
  const isDown = (stock.changePercent ?? 0) < 0;
  const change = stock.changePercent ?? 0;
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 py-3 px-2 border-b border-border/40 hover:bg-accent/40 cursor-pointer transition-colors"
    >
      <div className="relative shrink-0">
        <StockLogo logoUrl={stock.logoUrl} symbol={stock.symbol} size="md" />
        <span className="hidden"><TickerBadge symbol={stock.symbol} size="md" /></span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <TickerBadge symbol={stock.symbol} />
          <p className="text-sm text-foreground truncate">{stock.name || stock.symbol}</p>
        </div>
      </div>
      <div className="text-right shrink-0 flex items-center gap-4">
        <span className="text-sm font-medium text-foreground tabular-nums">{fmt(stock.price)}</span>
        <span className={`text-xs font-medium tabular-nums flex items-center gap-0.5 min-w-[60px] justify-end ${isUp ? "text-gain" : isDown ? "text-loss" : "text-muted-foreground"}`}>
          {isUp ? <ArrowUp className="h-3 w-3" /> : isDown ? <ArrowDown className="h-3 w-3" /> : null}
          {Math.abs(change).toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

/** Google Finance-style horizontal scrollable card */
function DiscoverCard({ stock, onClick }: { stock: any; onClick: () => void }) {
  const isUp = (stock.changePercent ?? 0) > 0;
  const isDown = (stock.changePercent ?? 0) < 0;
  const change = stock.changePercent ?? 0;
  return (
    <div
      onClick={onClick}
      className="flex flex-col gap-2 p-3 rounded-lg border border-border hover:shadow-md cursor-pointer transition-all min-w-[155px] max-w-[170px] shrink-0 bg-card"
    >
      <div className="flex items-center gap-2">
        <StockLogo logoUrl={stock.logoUrl} symbol={stock.symbol} />
        <TickerBadge symbol={stock.symbol} />
      </div>
      <p className="text-xs text-foreground truncate leading-tight">{stock.name || stock.symbol}</p>
      <div className="flex items-center justify-between mt-auto">
        <span className="text-sm font-medium text-foreground tabular-nums">{fmt(stock.price)}</span>
        <span className={`text-xs font-medium tabular-nums flex items-center gap-0.5 ${isUp ? "text-gain" : isDown ? "text-loss" : "text-muted-foreground"}`}>
          {isUp ? <ArrowUp className="h-3 w-3" /> : isDown ? <ArrowDown className="h-3 w-3" /> : null}
          {Math.abs(change).toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [exchange, setExchange] = useState<"ADX" | "DFM" | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("marketCap");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [trendTab, setTrendTab] = useState<"active" | "gainers" | "losers">("active");

  const autoRefreshInterval = useAutoRefreshInterval();
  const fastRefresh = autoRefreshInterval || undefined;

  const { data: stocks, isLoading } = trpc.stocks.fetchAll.useQuery(
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
    { exchange, limit: 6 },
    {
      staleTime: fastRefresh ? 3_000 : 5 * 60 * 1000,
      refetchInterval: fastRefresh,
      refetchOnWindowFocus: false,
      gcTime: 30 * 60 * 1000,
    }
  );

  const priceFlashes = usePriceFlashes(stocks as any);

  const { refetch: fetchCSV, isFetching: csvFetching } = trpc.stocks.exportCSV.useQuery(
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
        toast.success("CSV exported");
      }
    } catch {
      toast.error("Export failed");
    }
  };

  // "You may be interested in" — top movers by absolute change
  const interestStocks = useMemo(() => {
    if (!stocks) return [];
    const withPrice = stocks.filter((s: any) => s.price != null && s.price > 0);
    return [...withPrice]
      .sort((a: any, b: any) => Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0))
      .slice(0, 6);
  }, [stocks]);

  // Market trends data
  const trendStocks = useMemo(() => {
    if (!topMovers) return [];
    if (trendTab === "gainers") return topMovers.gainers || [];
    if (trendTab === "losers") return topMovers.losers || [];
    return topMovers.mostActive || [];
  }, [topMovers, trendTab]);

  // "Discover more" — horizontal carousel of interesting stocks
  const discoverStocks = useMemo(() => {
    if (!stocks) return [];
    const withPrice = stocks.filter((s: any) => s.price != null && s.price > 0 && s.marketCap);
    return [...withPrice]
      .sort((a: any, b: any) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 14);
  }, [stocks]);

  // Most followed (highest market cap)
  const mostFollowed = useMemo(() => {
    if (!stocks) return [];
    const withPrice = stocks.filter((s: any) => s.price != null && s.price > 0 && s.marketCap);
    return [...withPrice]
      .sort((a: any, b: any) => (b.marketCap || 0) - (a.marketCap || 0))
      .slice(0, 6);
  }, [stocks]);

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
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 text-primary" />
      : <ArrowDown className="h-3 w-3 text-primary" />;
  };

  const stats = useMemo(() => {
    if (!stocks || stocks.length === 0) return null;
    const withPrice = stocks.filter(s => s.price != null);
    const gainers = withPrice.filter(s => (s.changePercent ?? 0) > 0);
    const losers = withPrice.filter(s => (s.changePercent ?? 0) < 0);
    const totalVolume = withPrice.reduce((sum, s) => sum + (s.volume ?? 0), 0);
    return { total: stocks.length, withPrice: withPrice.length, gainers: gainers.length, losers: losers.length, totalVolume };
  }, [stocks]);

  return (
    <div className="flex flex-col gap-6">
      {/* ═══ TWO-COLUMN LAYOUT (Google Finance style) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* ─── LEFT COLUMN: Main Content ─── */}
        <div className="flex flex-col gap-8 min-w-0">
          {/* "You may be interested in" section */}
          {interestStocks.length > 0 && (
            <section>
              <h2 className="text-base font-normal text-foreground mb-3 flex items-center gap-2">
                You may be interested in
              </h2>
              <div className="flex flex-col">
                {interestStocks.map((s: any) => (
                  <InterestRow key={s.symbol} stock={s} onClick={() => setLocation(`/stock/${s.symbol}`)} />
                ))}
              </div>
            </section>
          )}

          {/* Discover more — horizontal scrollable cards */}
          {discoverStocks.length > 0 && (
            <section>
              <h2 className="text-base font-normal text-foreground mb-3">Discover more</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
                {discoverStocks.map((s: any) => (
                  <DiscoverCard key={s.symbol} stock={s} onClick={() => setLocation(`/stock/${s.symbol}`)} />
                ))}
              </div>
            </section>
          )}

          {/* ─── Market Trends (Most Active / Gainers / Losers) ─── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-normal text-foreground">Market trends</h2>
              <button
                onClick={() => {
                  if (trendTab === "active") { setSortField("volume"); setSortDir("desc"); }
                  else if (trendTab === "gainers") { setSortField("changePercent"); setSortDir("desc"); }
                  else { setSortField("changePercent"); setSortDir("asc"); }
                }}
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                More <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            {/* Tabs */}
            <div className="flex items-center gap-1 mb-3">
              <button
                onClick={() => setTrendTab("active")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  trendTab === "active" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <Activity className="h-3.5 w-3.5" /> Most active
              </button>
              <button
                onClick={() => setTrendTab("gainers")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  trendTab === "gainers" ? "bg-[#1e8e3e]/10 text-[#1e8e3e]" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" /> Gainers
              </button>
              <button
                onClick={() => setTrendTab("losers")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  trendTab === "losers" ? "bg-[#d93025]/10 text-[#d93025]" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <TrendingDown className="h-3.5 w-3.5" /> Losers
              </button>
            </div>
            <div className="flex flex-col">
              {trendStocks.map((s: any) => (
                <TrendRow key={s.symbol} stock={s} onClick={() => setLocation(`/stock/${s.symbol}`)} />
              ))}
              {trendStocks.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No data available</p>
              )}
            </div>
          </section>
        </div>

        {/* ─── RIGHT COLUMN: Sidebar ─── */}
        <div className="flex flex-col gap-5">
          {/* Market Summary Card */}
          {stats && (
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Market summary</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                    <p className="text-sm font-semibold text-foreground">{stats.total}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-[#1e8e3e]/10 flex items-center justify-center">
                    <TrendingUp className="h-3.5 w-3.5 text-[#1e8e3e]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Gainers</p>
                    <p className="text-sm font-semibold text-[#1e8e3e]">{stats.gainers}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-[#d93025]/10 flex items-center justify-center">
                    <TrendingDown className="h-3.5 w-3.5 text-[#d93025]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Losers</p>
                    <p className="text-sm font-semibold text-[#d93025]">{stats.losers}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Volume</p>
                    <p className="text-sm font-semibold text-foreground">{fmtLg(stats.totalVolume)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top by market cap */}
          {mostFollowed.length > 0 && (
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Top by market cap</h3>
              <div className="flex flex-col">
                {mostFollowed.map((s: any) => {
                  const isUp = (s.changePercent ?? 0) > 0;
                  const isDown = (s.changePercent ?? 0) < 0;
                  return (
                    <div
                      key={s.symbol}
                      onClick={() => setLocation(`/stock/${s.symbol}`)}
                      className="flex items-center gap-2.5 py-2.5 border-b border-border/30 last:border-0 hover:bg-accent/40 cursor-pointer transition-colors -mx-1 px-1 rounded"
                    >
                      <StockLogo logoUrl={s.logoUrl} symbol={s.symbol} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <TickerBadge symbol={s.symbol} />
                          <p className="text-xs text-foreground truncate">{s.name}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{fmtLg(s.marketCap)}</p>
                      </div>
                      <span className={`text-xs font-medium tabular-nums flex items-center gap-0.5 ${isUp ? "text-[#1e8e3e]" : isDown ? "text-[#d93025]" : "text-muted-foreground"}`}>
                        {isUp ? <ArrowUp className="h-3 w-3" /> : isDown ? <ArrowDown className="h-3 w-3" /> : null}
                        {Math.abs(s.changePercent ?? 0).toFixed(2)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ ALL STOCKS TABLE ═══ */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Table Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-4 border-b border-border gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-medium text-foreground">All stocks</h2>
            <div className="flex items-center gap-1 ml-1">
              {(["ALL", "DFM", "ADX"] as const).map((ex) => (
                <button
                  key={ex}
                  onClick={() => setExchange(ex)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    exchange === ex
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  {ex === "ALL" ? "All" : ex}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search stocks..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9 pl-9 pr-3 w-52 text-sm bg-background border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <button
              onClick={handleExportCSV}
              disabled={csvFetching || isLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border border-border hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              <Download className={`h-3.5 w-3.5 ${csvFetching ? "animate-pulse" : ""}`} />
              Export
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-auto">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="flex gap-4 items-center">
                  <Skeleton className="h-5 w-14 rounded" />
                  <Skeleton className="h-4 w-40 flex-1" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left pl-5 py-3 text-xs font-medium text-muted-foreground">
                    <button onClick={() => handleSort("symbol")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Symbol <SortIcon field="symbol" />
                    </button>
                  </th>
                  <th className="text-left py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">
                    <button onClick={() => handleSort("name")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Company <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="text-right py-3 text-xs font-medium text-muted-foreground pr-3">
                    <button onClick={() => handleSort("price")} className="flex items-center gap-1 justify-end hover:text-foreground transition-colors">
                      Price <SortIcon field="price" />
                    </button>
                  </th>
                  <th className="text-right py-3 text-xs font-medium text-muted-foreground pr-3">
                    <button onClick={() => handleSort("changePercent")} className="flex items-center gap-1 justify-end hover:text-foreground transition-colors">
                      Change <SortIcon field="changePercent" />
                    </button>
                  </th>
                  <th className="text-right py-3 text-xs font-medium text-muted-foreground pr-3 hidden md:table-cell">
                    <button onClick={() => handleSort("pe")} className="flex items-center gap-1 justify-end hover:text-foreground transition-colors">
                      P/E <SortIcon field="pe" />
                    </button>
                  </th>
                  <th className="text-right py-3 text-xs font-medium text-muted-foreground pr-3 hidden md:table-cell">
                    <button onClick={() => handleSort("volume")} className="flex items-center gap-1 justify-end hover:text-foreground transition-colors">
                      Volume <SortIcon field="volume" />
                    </button>
                  </th>
                  <th className="text-right py-3 text-xs font-medium text-muted-foreground pr-3 hidden lg:table-cell">
                    <button onClick={() => handleSort("marketCap")} className="flex items-center gap-1 justify-end hover:text-foreground transition-colors">
                      Market Cap <SortIcon field="marketCap" />
                    </button>
                  </th>
                  <th className="text-center py-3 text-xs font-medium text-muted-foreground pr-5 hidden sm:table-cell w-16">
                    Exchange
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                      {search ? `No stocks match "${search}"` : "No data available."}
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((stock) => {
                    const hasData = stock.price != null;
                    return (
                      <tr
                        key={`${stock.exchange}-${stock.symbol}`}
                        className={`border-b border-border/50 hover:bg-accent/30 cursor-pointer transition-colors ${hasData ? "" : "opacity-40"} ${getFlashClass(priceFlashes, stock.exchange, stock.symbol)}`}
                        onClick={() => setLocation(`/stock/${stock.symbol}`)}
                      >
                        <td className="pl-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <StockLogo logoUrl={stock.logoUrl} symbol={stock.symbol} />
                            <TickerBadge symbol={stock.symbol} />
                            <div>
                              <span className="text-sm text-foreground lg:hidden block truncate max-w-[140px]">{stock.name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="hidden lg:table-cell py-3">
                          <span className="text-sm text-foreground/80 truncate block max-w-[220px]">{stock.name}</span>
                          <span className="text-xs text-muted-foreground">{stock.sector}</span>
                        </td>
                        <td className="text-right py-3 pr-3">
                          {hasData ? (
                            <span className={`font-medium text-sm tabular-nums ${getPriceFlashClass(priceFlashes, stock.exchange, stock.symbol)}`}>
                              {fmt(stock.price)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="text-right py-3 pr-3">
                          {hasData ? <Chg value={stock.changePercent} /> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="text-right py-3 pr-3 hidden md:table-cell">
                          <span className="text-sm text-foreground/70 tabular-nums">{hasData && stock.pe != null ? fmt(stock.pe, 1) : "—"}</span>
                        </td>
                        <td className="text-right py-3 pr-3 hidden md:table-cell">
                          <span className="text-sm text-foreground/70 tabular-nums">{hasData ? fmtLg(stock.volume) : "—"}</span>
                        </td>
                        <td className="text-right py-3 pr-3 hidden lg:table-cell">
                          <span className="text-sm text-foreground/70 tabular-nums">{hasData ? fmtLg(stock.marketCap) : "—"}</span>
                        </td>
                        <td className="text-center py-3 pr-5 hidden sm:table-cell">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            stock.exchange === "ADX"
                              ? "bg-primary/10 text-primary"
                              : "bg-[#1e8e3e]/10 text-[#1e8e3e]"
                          }`}>
                            {stock.exchange}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Table Footer */}
        {filteredStocks.length > 0 && (
          <div className="px-5 py-3 text-xs text-muted-foreground border-t border-border flex items-center justify-between">
            <span>
              Showing {filteredStocks.length} of {stocks?.length ?? 0} stocks
              {search && ` matching "${search}"`}
            </span>
            <span>{stats?.withPrice ?? 0} with live prices</span>
          </div>
        )}
      </div>
    </div>
  );
}
