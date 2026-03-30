import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { usePriceFlashes, getFlashClass, getPriceFlashClass } from "@/hooks/usePriceFlash";
import { useAutoRefreshInterval } from "@/hooks/useMarketStatus";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type SortField = "symbol" | "price" | "changePercent" | "pe" | "volume" | "marketCap" | "name";
type SortDir = "asc" | "desc";

function fmt(num: number | null | undefined, d?: number): string {
  if (num == null || isNaN(num)) return "—";
  // Smart decimals: if 3rd decimal is non-zero, show 3; otherwise show 2
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
    <span className={`font-mono font-semibold ${pos ? "text-gain" : zero ? "text-muted-foreground" : "text-loss"}`}>
      {pos ? "+" : ""}{value.toFixed(3)}%
    </span>
  );
}

function Logo({ logoUrl, symbol }: { logoUrl?: string | null; symbol: string }) {
  if (logoUrl) {
    return (
      <div className="h-5 w-5 rounded bg-white/8 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
        <img src={logoUrl} alt="" className="h-3.5 w-3.5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
    );
  }
  return (
    <div className="h-5 w-5 rounded bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0">
      <span className="text-[7px] font-bold text-primary/70">{symbol.slice(0, 2)}</span>
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
    if (sortField !== field) return <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-2.5 w-2.5 text-primary" />
      : <ArrowDown className="h-2.5 w-2.5 text-primary" />;
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
    <div className="flex flex-col gap-1.5 p-1.5 h-full">
      {/* ─── Stats Bar ─── */}
      {stats && (
        <div className="flex items-center gap-3 px-2 py-1 text-[10px] font-mono border-b border-border/30">
          <div className="flex items-center gap-1">
            <Building2 className="h-3 w-3 text-primary" />
            <span className="text-muted-foreground uppercase tracking-wider">Stocks</span>
            <span className="font-bold text-foreground">{stats.total}</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-gain" />
            <span className="text-muted-foreground uppercase tracking-wider">Gainers</span>
            <span className="font-bold text-gain">{stats.gainers}</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-loss" />
            <span className="text-muted-foreground uppercase tracking-wider">Losers</span>
            <span className="font-bold text-loss">{stats.losers}</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3 text-neon-purple" />
            <span className="text-muted-foreground uppercase tracking-wider">Volume</span>
            <span className="font-bold text-foreground">{fmtLg(stats.totalVolume)}</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={handleExportCSV}
            disabled={csvFetching || isLoading}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border border-border/40 hover:border-primary/40 hover:text-primary transition-colors text-muted-foreground"
          >
            <Download className={`h-2.5 w-2.5 ${csvFetching ? "animate-pulse" : ""}`} />
            CSV
          </button>
        </div>
      )}

      {/* ─── Top Movers Row ─── */}
      {topMovers && (topMovers.gainers.length > 0 || topMovers.losers.length > 0) && (
        <div className="grid grid-cols-3 gap-1.5">
          {/* Gainers */}
          <div className="terminal-panel">
            <div className="terminal-panel-header">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-gain" />
                <span>Top Gainers</span>
              </div>
            </div>
            <div className="divide-y divide-border/20">
              {topMovers.gainers.map((s: any) => (
                <div
                  key={s.symbol}
                  className="flex items-center gap-1.5 px-2 py-1 hover:bg-accent/50 cursor-pointer transition-colors text-[11px]"
                  onClick={() => setLocation(`/stock/${s.symbol}`)}
                >
                  <Logo logoUrl={s.logoUrl} symbol={s.symbol} />
                  <span className="font-mono font-semibold text-foreground">{s.symbol}</span>
                  <span className="flex-1 truncate text-muted-foreground text-[9px]">{s.name}</span>
                  <span className="font-mono text-foreground/80">{fmt(s.price)}</span>
                  <Chg value={s.changePercent} />
                </div>
              ))}
            </div>
          </div>

          {/* Losers */}
          <div className="terminal-panel">
            <div className="terminal-panel-header">
              <div className="flex items-center gap-1.5">
                <TrendingDown className="h-3 w-3 text-loss" />
                <span>Top Losers</span>
              </div>
            </div>
            <div className="divide-y divide-border/20">
              {topMovers.losers.map((s: any) => (
                <div
                  key={s.symbol}
                  className="flex items-center gap-1.5 px-2 py-1 hover:bg-accent/50 cursor-pointer transition-colors text-[11px]"
                  onClick={() => setLocation(`/stock/${s.symbol}`)}
                >
                  <Logo logoUrl={s.logoUrl} symbol={s.symbol} />
                  <span className="font-mono font-semibold text-foreground">{s.symbol}</span>
                  <span className="flex-1 truncate text-muted-foreground text-[9px]">{s.name}</span>
                  <span className="font-mono text-foreground/80">{fmt(s.price)}</span>
                  <Chg value={s.changePercent} />
                </div>
              ))}
            </div>
          </div>

          {/* Most Active */}
          <div className="terminal-panel">
            <div className="terminal-panel-header">
              <div className="flex items-center gap-1.5">
                <Flame className="h-3 w-3 text-neon-gold" />
                <span>Most Active</span>
              </div>
            </div>
            <div className="divide-y divide-border/20">
              {topMovers.mostActive.map((s: any) => (
                <div
                  key={s.symbol}
                  className="flex items-center gap-1.5 px-2 py-1 hover:bg-accent/50 cursor-pointer transition-colors text-[11px]"
                  onClick={() => setLocation(`/stock/${s.symbol}`)}
                >
                  <Logo logoUrl={s.logoUrl} symbol={s.symbol} />
                  <span className="font-mono font-semibold text-foreground">{s.symbol}</span>
                  <span className="flex-1 truncate text-muted-foreground text-[9px]">{s.name}</span>
                  <span className="font-mono text-foreground/80">{fmt(s.price)}</span>
                  <Chg value={s.changePercent} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Stock Table ─── */}
      <div className="terminal-panel flex-1 flex flex-col overflow-hidden">
        <div className="terminal-panel-header">
          <div className="flex items-center gap-2">
            <span>All Stocks</span>
            {/* Exchange filter tabs */}
            <div className="flex items-center gap-0.5 ml-2">
              {(["ALL", "DFM", "ADX"] as const).map((ex) => (
                <button
                  key={ex}
                  onClick={() => setExchange(ex)}
                  className={`px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider transition-colors ${
                    exchange === ex
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                >
                  {ex === "ALL" ? "All" : ex}
                  {ex !== "ALL" && <span className="ml-1 opacity-60">({ex === "DFM" ? 68 : 102})</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-5 pl-5 pr-2 w-40 text-[10px] bg-background/50 border border-border/40 rounded focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-2 space-y-1">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-32 flex-1" />
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 w-14" />
                </div>
              ))}
            </div>
          ) : (
            <table className="dense-table">
              <thead>
                <tr>
                  <th className="text-left pl-2">
                    <button onClick={() => handleSort("symbol")} className="flex items-center gap-1 hover:text-foreground">
                      Symbol <SortIcon field="symbol" />
                    </button>
                  </th>
                  <th className="text-left hidden lg:table-cell">
                    <button onClick={() => handleSort("name")} className="flex items-center gap-1 hover:text-foreground">
                      Company <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="text-right">
                    <button onClick={() => handleSort("price")} className="flex items-center gap-1 justify-end hover:text-foreground">
                      Price <SortIcon field="price" />
                    </button>
                  </th>
                  <th className="text-right">
                    <button onClick={() => handleSort("changePercent")} className="flex items-center gap-1 justify-end hover:text-foreground">
                      Chg% <SortIcon field="changePercent" />
                    </button>
                  </th>
                  <th className="text-right hidden md:table-cell">
                    <button onClick={() => handleSort("pe")} className="flex items-center gap-1 justify-end hover:text-foreground">
                      P/E <SortIcon field="pe" />
                    </button>
                  </th>
                  <th className="text-right hidden md:table-cell">
                    <button onClick={() => handleSort("volume")} className="flex items-center gap-1 justify-end hover:text-foreground">
                      Vol <SortIcon field="volume" />
                    </button>
                  </th>
                  <th className="text-right hidden lg:table-cell">
                    <button onClick={() => handleSort("marketCap")} className="flex items-center gap-1 justify-end hover:text-foreground">
                      MCap <SortIcon field="marketCap" />
                    </button>
                  </th>
                  <th className="text-center hidden sm:table-cell w-12">Exch</th>
                </tr>
              </thead>
              <tbody>
                {filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-muted-foreground text-[11px]">
                      {search ? "No stocks match your search." : "No data available."}
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((stock) => {
                    const hasData = stock.price != null;
                    return (
                      <tr
                        key={`${stock.exchange}-${stock.symbol}`}
                        className={`cursor-pointer ${hasData ? "" : "opacity-40"} ${getFlashClass(priceFlashes, stock.exchange, stock.symbol)}`}
                        onClick={() => setLocation(`/stock/${stock.symbol}`)}
                      >
                        <td className="pl-2">
                          <div className="flex items-center gap-1.5">
                            <Logo logoUrl={stock.logoUrl} symbol={stock.symbol} />
                            <div>
                              <span className="font-mono font-semibold text-foreground">{stock.symbol}</span>
                              <span className="text-[9px] text-muted-foreground lg:hidden block truncate max-w-[120px]">{stock.name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="hidden lg:table-cell">
                          <span className="text-foreground/70 truncate block max-w-[200px]">{stock.name}</span>
                          <span className="text-[9px] text-muted-foreground">{stock.sector}</span>
                        </td>
                        <td className="text-right">
                          {hasData ? (
                            <span className={`font-mono font-medium ${getPriceFlashClass(priceFlashes, stock.exchange, stock.symbol)}`}>
                              {fmt(stock.price)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </td>
                        <td className="text-right">
                          {hasData ? <Chg value={stock.changePercent} /> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="text-right hidden md:table-cell">
                          <span className="font-mono text-foreground/70">{hasData && stock.pe != null ? fmt(stock.pe, 1) : "—"}</span>
                        </td>
                        <td className="text-right hidden md:table-cell">
                          <span className="font-mono text-foreground/70">{hasData ? fmtLg(stock.volume) : "—"}</span>
                        </td>
                        <td className="text-right hidden lg:table-cell">
                          <span className="font-mono text-foreground/70">{hasData ? fmtLg(stock.marketCap) : "—"}</span>
                        </td>
                        <td className="text-center hidden sm:table-cell">
                          <span className={`text-[8px] font-bold uppercase ${stock.exchange === "ADX" ? "text-primary" : "text-gain"}`}>
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

        {filteredStocks.length > 0 && (
          <div className="px-2 py-1 text-[9px] text-muted-foreground border-t border-border/20 flex items-center justify-between font-mono">
            <span>
              {filteredStocks.length} / {stocks?.length ?? 0} stocks
              {search && ` matching "${search}"`}
            </span>
            <span>{stats?.withPrice ?? 0} live</span>
          </div>
        )}
      </div>
    </div>
  );
}
