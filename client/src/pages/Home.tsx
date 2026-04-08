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
  Flame,
  ChevronRight,
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

function Logo({ logoUrl, symbol }: { logoUrl?: string | null; symbol: string }) {
  if (logoUrl) {
    return (
      <div className="h-8 w-8 rounded-full bg-muted/50 border border-border flex items-center justify-center overflow-hidden shrink-0">
        <img src={logoUrl} alt="" className="h-5 w-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
    );
  }
  return (
    <div className="h-8 w-8 rounded-full bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0">
      <span className="text-[10px] font-bold text-primary/70">{symbol.slice(0, 2)}</span>
    </div>
  );
}

/** Google Finance-style stock card for top movers */
function StockCard({ stock, onClick }: { stock: any; onClick: () => void }) {
  const isUp = (stock.changePercent ?? 0) > 0;
  const isDown = (stock.changePercent ?? 0) < 0;
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-all hover:shadow-sm group"
    >
      <Logo logoUrl={stock.logoUrl} symbol={stock.symbol} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-foreground">{stock.symbol}</span>
          <span className="text-xs text-muted-foreground truncate">{stock.exchange}</span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{stock.name}</p>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold text-foreground tabular-nums">{fmt(stock.price)}</div>
        <div className={`text-xs font-medium tabular-nums ${isUp ? "text-gain" : isDown ? "text-loss" : "text-muted-foreground"}`}>
          {isUp ? "+" : ""}{(stock.changePercent ?? 0).toFixed(2)}%
        </div>
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
    { exchange, limit: 5 },
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
      {/* ─── Market Summary Stats ─── */}
      {stats && (
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Stocks</p>
              <p className="text-lg font-semibold text-foreground">{stats.total}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-gain/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-gain" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gainers</p>
              <p className="text-lg font-semibold text-gain">{stats.gainers}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-loss/10 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-loss" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Losers</p>
              <p className="text-lg font-semibold text-loss">{stats.losers}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Volume</p>
              <p className="text-lg font-semibold text-foreground">{fmtLg(stats.totalVolume)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Top Movers Cards (Google Finance style) ─── */}
      {topMovers && (topMovers.gainers.length > 0 || topMovers.losers.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Gainers */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gain" />
                <h2 className="text-sm font-semibold text-foreground">Top Gainers</h2>
              </div>
              <button
                onClick={() => { setSortField("changePercent"); setSortDir("desc"); }}
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                View all <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {topMovers.gainers.map((s: any) => (
                <StockCard key={s.symbol} stock={s} onClick={() => setLocation(`/stock/${s.symbol}`)} />
              ))}
            </div>
          </div>

          {/* Losers */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-loss" />
                <h2 className="text-sm font-semibold text-foreground">Top Losers</h2>
              </div>
              <button
                onClick={() => { setSortField("changePercent"); setSortDir("asc"); }}
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                View all <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {topMovers.losers.map((s: any) => (
                <StockCard key={s.symbol} stock={s} onClick={() => setLocation(`/stock/${s.symbol}`)} />
              ))}
            </div>
          </div>

          {/* Most Active */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-foreground">Most Active</h2>
              </div>
              <button
                onClick={() => { setSortField("volume"); setSortDir("desc"); }}
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                View all <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {topMovers.mostActive.map((s: any) => (
                <StockCard key={s.symbol} stock={s} onClick={() => setLocation(`/stock/${s.symbol}`)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Stock Table ─── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-foreground">All Stocks</h2>
            {/* Exchange filter pills */}
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
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-20" />
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
                          <div className="flex items-center gap-3">
                            <Logo logoUrl={stock.logoUrl} symbol={stock.symbol} />
                            <div>
                              <span className="font-semibold text-sm text-foreground">{stock.symbol}</span>
                              <span className="text-xs text-muted-foreground lg:hidden block truncate max-w-[140px]">{stock.name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="hidden lg:table-cell py-3">
                          <span className="text-sm text-foreground/80 truncate block max-w-[220px]">{stock.name}</span>
                          <span className="text-xs text-muted-foreground">{stock.sector}</span>
                        </td>
                        <td className="text-right py-3 pr-3">
                          {hasData ? (
                            <span className={`font-semibold text-sm tabular-nums ${getPriceFlashClass(priceFlashes, stock.exchange, stock.symbol)}`}>
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
                              : "bg-gain/10 text-gain"
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
