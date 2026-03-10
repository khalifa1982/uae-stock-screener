import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
  RotateCcw,
  Search,
  SlidersHorizontal,
  TrendingUp,
  Activity,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";
import { SECTORS } from "../../../shared/stockData";

type SortField = "symbol" | "price" | "changePercent" | "pe" | "volume" | "marketCap" | "rsi";
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

interface Filters {
  exchange: "ADX" | "DFM" | "ALL";
  sector: string;
  minPE: string;
  maxPE: string;
  minPrice: string;
  maxPrice: string;
  minMarketCap: string;
  maxMarketCap: string;
  minVolume: string;
  minRSI: string;
  maxRSI: string;
  aboveSMA50: boolean;
  goldenCross: boolean;
  highVolume: boolean;
}

const defaultFilters: Filters = {
  exchange: "ALL",
  sector: "all",
  minPE: "",
  maxPE: "",
  minPrice: "",
  maxPrice: "",
  minMarketCap: "",
  maxMarketCap: "",
  minVolume: "",
  minRSI: "",
  maxRSI: "",
  aboveSMA50: false,
  goldenCross: false,
  highVolume: false,
};

export default function Screener() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sortField, setSortField] = useState<SortField>("marketCap");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showFilters, setShowFilters] = useState(true);

  const screenInput = useMemo(() => {
    const input: any = {
      exchange: filters.exchange,
    };
    if (filters.sector && filters.sector !== "all") input.sector = filters.sector;
    if (filters.minPE) input.minPE = parseFloat(filters.minPE);
    if (filters.maxPE) input.maxPE = parseFloat(filters.maxPE);
    if (filters.minPrice) input.minPrice = parseFloat(filters.minPrice);
    if (filters.maxPrice) input.maxPrice = parseFloat(filters.maxPrice);
    if (filters.minMarketCap) input.minMarketCap = parseFloat(filters.minMarketCap) * 1e9;
    if (filters.maxMarketCap) input.maxMarketCap = parseFloat(filters.maxMarketCap) * 1e9;
    if (filters.minVolume) input.minVolume = parseFloat(filters.minVolume);
    if (filters.minRSI) input.minRSI = parseFloat(filters.minRSI);
    if (filters.maxRSI) input.maxRSI = parseFloat(filters.maxRSI);
    if (filters.aboveSMA50) input.aboveSMA50 = true;
    if (filters.goldenCross) input.goldenCross = true;
    if (filters.highVolume) input.highVolume = true;
    return input;
  }, [filters]);

  const { data: results, isLoading } = trpc.stocks.screen.useQuery(screenInput, {
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const sortedResults = useMemo(() => {
    if (!results) return [];
    const sorted = [...results];
    sorted.sort((a, b) => {
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
    return sorted;
  }, [results, sortField, sortDir]);

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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.exchange !== "ALL") count++;
    if (filters.sector && filters.sector !== "all") count++;
    if (filters.minPE) count++;
    if (filters.maxPE) count++;
    if (filters.minPrice) count++;
    if (filters.maxPrice) count++;
    if (filters.minMarketCap) count++;
    if (filters.maxMarketCap) count++;
    if (filters.minVolume) count++;
    if (filters.minRSI) count++;
    if (filters.maxRSI) count++;
    if (filters.aboveSMA50) count++;
    if (filters.goldenCross) count++;
    if (filters.highVolume) count++;
    return count;
  }, [filters]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <SlidersHorizontal className="h-6 w-6 text-primary" />
            Stock Screener
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Filter UAE stocks using institutional-grade criteria
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters(defaultFilters)}
            className="gap-2 text-muted-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Exchange */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-medium">Exchange</Label>
                <Select value={filters.exchange} onValueChange={(v) => setFilters(f => ({ ...f, exchange: v as any }))}>
                  <SelectTrigger className="h-9 bg-secondary/30 border-border/50 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Markets</SelectItem>
                    <SelectItem value="ADX">ADX — Abu Dhabi</SelectItem>
                    <SelectItem value="DFM">DFM — Dubai</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sector */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-medium">Sector</Label>
                <Select value={filters.sector || "all"} onValueChange={(v) => setFilters(f => ({ ...f, sector: v }))}>
                  <SelectTrigger className="h-9 bg-secondary/30 border-border/50 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sectors</SelectItem>
                    {SECTORS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* P/E Range */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-medium">P/E Ratio Range</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.minPE}
                    onChange={e => setFilters(f => ({ ...f, minPE: e.target.value }))}
                    className="h-9 bg-secondary/30 border-border/50 text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.maxPE}
                    onChange={e => setFilters(f => ({ ...f, maxPE: e.target.value }))}
                    className="h-9 bg-secondary/30 border-border/50 text-sm"
                  />
                </div>
              </div>

              {/* Price Range */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-medium">Price Range (AED)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.minPrice}
                    onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))}
                    className="h-9 bg-secondary/30 border-border/50 text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.maxPrice}
                    onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))}
                    className="h-9 bg-secondary/30 border-border/50 text-sm"
                  />
                </div>
              </div>

              {/* Market Cap */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-medium">Market Cap (Billions AED)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.minMarketCap}
                    onChange={e => setFilters(f => ({ ...f, minMarketCap: e.target.value }))}
                    className="h-9 bg-secondary/30 border-border/50 text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.maxMarketCap}
                    onChange={e => setFilters(f => ({ ...f, maxMarketCap: e.target.value }))}
                    className="h-9 bg-secondary/30 border-border/50 text-sm"
                  />
                </div>
              </div>

              {/* Min Volume */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-medium">Min Volume</Label>
                <Input
                  type="number"
                  placeholder="e.g. 100000"
                  value={filters.minVolume}
                  onChange={e => setFilters(f => ({ ...f, minVolume: e.target.value }))}
                  className="h-9 bg-secondary/30 border-border/50 text-sm"
                />
              </div>

              {/* RSI Range */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-medium">RSI Range (14-day)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.minRSI}
                    onChange={e => setFilters(f => ({ ...f, minRSI: e.target.value }))}
                    className="h-9 bg-secondary/30 border-border/50 text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.maxRSI}
                    onChange={e => setFilters(f => ({ ...f, maxRSI: e.target.value }))}
                    className="h-9 bg-secondary/30 border-border/50 text-sm"
                  />
                </div>
              </div>

              {/* Technical Switches */}
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground font-medium">Technical Signals</Label>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs flex items-center gap-1.5">
                      <TrendingUp className="h-3 w-3 text-gain" /> Above SMA 50
                    </span>
                    <Switch
                      checked={filters.aboveSMA50}
                      onCheckedChange={v => setFilters(f => ({ ...f, aboveSMA50: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs flex items-center gap-1.5">
                      <Zap className="h-3 w-3 text-chart-4" /> Golden Cross
                    </span>
                    <Switch
                      checked={filters.goldenCross}
                      onCheckedChange={v => setFilters(f => ({ ...f, goldenCross: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs flex items-center gap-1.5">
                      <Activity className="h-3 w-3 text-primary" /> High Volume (1.5x)
                    </span>
                    <Switch
                      checked={filters.highVolume}
                      onCheckedChange={v => setFilters(f => ({ ...f, highVolume: v }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Screening Results
              {results && (
                <span className="text-muted-foreground font-normal ml-2 text-sm">
                  ({sortedResults.length} stocks)
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-48 flex-1" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      <button onClick={() => handleSort("symbol")} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                        Symbol <SortIcon field="symbol" />
                      </button>
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground">
                      <button onClick={() => handleSort("price")} className="flex items-center gap-1.5 justify-end hover:text-foreground transition-colors">
                        Price <SortIcon field="price" />
                      </button>
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground">
                      <button onClick={() => handleSort("changePercent")} className="flex items-center gap-1.5 justify-end hover:text-foreground transition-colors">
                        Change % <SortIcon field="changePercent" />
                      </button>
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell">
                      <button onClick={() => handleSort("pe")} className="flex items-center gap-1.5 justify-end hover:text-foreground transition-colors">
                        P/E <SortIcon field="pe" />
                      </button>
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell">
                      <button onClick={() => handleSort("rsi")} className="flex items-center gap-1.5 justify-end hover:text-foreground transition-colors">
                        RSI <SortIcon field="rsi" />
                      </button>
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground hidden lg:table-cell">
                      <button onClick={() => handleSort("volume")} className="flex items-center gap-1.5 justify-end hover:text-foreground transition-colors">
                        Volume <SortIcon field="volume" />
                      </button>
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground hidden lg:table-cell">
                      <button onClick={() => handleSort("marketCap")} className="flex items-center gap-1.5 justify-end hover:text-foreground transition-colors">
                        Mkt Cap <SortIcon field="marketCap" />
                      </button>
                    </th>
                    <th className="text-center p-3 font-medium text-muted-foreground hidden sm:table-cell">
                      Exchange
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center p-8 text-muted-foreground">
                        No stocks match your screening criteria. Try adjusting the filters.
                      </td>
                    </tr>
                  ) : (
                    sortedResults.map((stock) => (
                      <tr
                        key={`${stock.exchange}-${stock.symbol}`}
                        className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => setLocation(`/stock/${stock.symbol}`)}
                      >
                        <td className="p-3">
                          <span className="font-mono font-semibold">{stock.symbol}</span>
                          <span className="text-xs text-muted-foreground block mt-0.5 truncate max-w-[180px]">
                            {stock.name}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-medium">
                          {stock.price != null ? formatNumber(stock.price) : "—"}
                        </td>
                        <td className="p-3 text-right">
                          {stock.changePercent != null ? (
                            <span className={`font-mono text-sm font-medium ${stock.changePercent > 0 ? "text-gain" : stock.changePercent < 0 ? "text-loss" : "text-muted-foreground"}`}>
                              {stock.changePercent > 0 ? "+" : ""}{stock.changePercent.toFixed(3)}%
                            </span>
                          ) : "—"}
                        </td>
                        <td className="p-3 text-right hidden md:table-cell font-mono text-sm">
                          {stock.pe != null ? formatNumber(stock.pe, 1) : "—"}
                        </td>
                        <td className="p-3 text-right hidden md:table-cell">
                          {stock.rsi != null ? (
                            <span className={`font-mono text-sm ${stock.rsi > 70 ? "text-loss" : stock.rsi < 30 ? "text-gain" : "text-foreground"}`}>
                              {stock.rsi.toFixed(1)}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="p-3 text-right hidden lg:table-cell font-mono text-sm">
                          {formatLargeNumber(stock.volume)}
                        </td>
                        <td className="p-3 text-right hidden lg:table-cell font-mono text-sm">
                          {formatLargeNumber(stock.marketCap)}
                        </td>
                        <td className="p-3 text-center hidden sm:table-cell">
                          <Badge variant="outline" className={`text-xs font-mono ${stock.exchange === "ADX" ? "border-primary/40 text-primary" : "border-chart-2/40 text-chart-2"}`}>
                            {stock.exchange}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
