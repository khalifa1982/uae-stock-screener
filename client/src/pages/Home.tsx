import { trpc } from "@/lib/trpc";
import { useState, useMemo, useRef } from "react";
import { usePriceFlashes, getFlashClass, getPriceFlashClass } from "@/hooks/usePriceFlash";
import { useAutoRefreshInterval } from "@/hooks/useMarketStatus";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpDown, ArrowUp, ArrowDown, Search, TrendingUp, TrendingDown,
  BarChart3, Building2, Download, ChevronRight, ChevronLeft, Activity,
  Newspaper, Layers, Flame, Zap, Crown, Target, Shield, DollarSign,
  PieChart, Globe, Star, Filter, ExternalLink,
} from "lucide-react";
import { useLocation } from "wouter";
import { MarketHeatmap } from "@/components/MarketHeatmap";
import { toast } from "sonner";

/* 
   TYPES & HELPERS
    */
type SortField = "symbol" | "price" | "changePercent" | "pe" | "volume" | "marketCap" | "name" | "dividendYield" | "beta" | "rsi" | "eps" | "week52High" | "week52Low" | "grossMargin" | "operatingMargin" | "returnOnEquity" | "debtToEquity" | "netIncome" | "totalRevenue" | "ebitda" | "perfWeek" | "perfMonth" | "perfYear";
type SortDir = "asc" | "desc";
type TableView = "overview" | "performance" | "valuation" | "dividends" | "profitability" | "income" | "balance" | "cashflow" | "technicals";

/** TradingView-style filter categories — exact match */
const FILTER_CATEGORIES = [
  { id: "all", label: "All stocks" },
  { id: "gainers", label: "Top gainers" },
  { id: "losers", label: "Biggest losers" },
  { id: "large-cap", label: "Large-cap" },
  { id: "small-cap", label: "Small-cap" },
  { id: "largest-employers", label: "Largest employers" },
  { id: "high-dividend", label: "High-dividend" },
  { id: "highest-profit", label: "Highest net income" },
  { id: "highest-cash", label: "Highest cash" },
  { id: "highest-profit-per-employee", label: "Highest profit per employee" },
  { id: "highest-revenue-per-employee", label: "Highest revenue per employee" },
  { id: "active", label: "Most active" },
  { id: "unusual-volume", label: "Unusual volume" },
  { id: "volatile", label: "Most volatile" },
  { id: "high-beta", label: "High beta" },
  { id: "best-performing", label: "Best performing" },
  { id: "highest-revenue", label: "Highest revenue" },
  { id: "most-expensive", label: "Most expensive" },
  { id: "penny", label: "Penny stocks" },
  { id: "overbought", label: "Overbought" },
  { id: "oversold", label: "Oversold" },
  { id: "ath", label: "All-time high" },
  { id: "atl", label: "All-time low" },
  { id: "52w-high", label: "52-week high" },
  { id: "52w-low", label: "52-week low" },
  { id: "undervalued", label: "Undervalued" },
  { id: "fairly-valued", label: "Fairly valued" },
  { id: "overvalued", label: "Overvalued" },
] as const;

type FilterId = typeof FILTER_CATEGORIES[number]["id"];

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

function fmtPct(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return "—";
  return (num > 0 ? "+" : "") + num.toFixed(2) + "%";
}

/** Deterministic color for ticker badge */
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

/** Sector icon colors */
function getSectorColor(sector: string): string {
  const map: Record<string, string> = {
    Banking: "#1a73e8", "Real Estate": "#e8710a", Energy: "#1e8e3e",
    Telecom: "#9334e6", Insurance: "#d93025", Conglomerates: "#185abc",
    Industrial: "#137333", Healthcare: "#c5221f", Technology: "#7b1fa2",
    "Financial Services": "#0d652d", Utilities: "#174ea6", "Consumer Staples": "#e8710a",
    "Consumer Services": "#1a73e8", Aviation: "#185abc", Logistics: "#137333",
    Construction: "#d93025", Hospitality: "#9334e6", Services: "#1e8e3e",
    Investment: "#174ea6", Chemicals: "#e8710a", Transport: "#185abc",
    Education: "#7b1fa2", Retail: "#c5221f",
  };
  return map[sector] || "#1a73e8";
}

/* 
   REUSABLE COMPONENTS
    */

/** Colored ticker badge */
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

/** Company logo with fallback */
function StockLogo({ logoUrl, symbol, size = "sm" }: { logoUrl?: string | null; symbol: string; size?: "sm" | "md" }) {
  const dim = size === "md" ? "h-8 w-8" : "h-6 w-6";
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={symbol}
        className={`${dim} rounded-full object-contain bg-white border border-white/20 shrink-0`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return <TickerBadge symbol={symbol} size={size} />;
}

/** Change indicator */
function Chg({ value, showArrow = true }: { value: number | null | undefined; showArrow?: boolean }) {
  if (value == null || isNaN(value)) return <span className="text-muted-foreground">—</span>;
  const pos = value > 0;
  const zero = value === 0;
  return (
    <span className={`font-medium tabular-nums inline-flex items-center gap-0.5 ${pos ? "text-gain" : zero ? "text-muted-foreground" : "text-loss"}`}>
      {showArrow && (pos ? <ArrowUp className="h-3 w-3" /> : !zero ? <ArrowDown className="h-3 w-3" /> : null)}
      {pos ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

/** Glass card wrapper */
function GlassCard({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`
        relative overflow-hidden transition-all duration-150
        bg-card
        border border-border
        hover:border-[oklch(0.32_0.015_80)]
        ${onClick ? "cursor-pointer" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/** Section heading with gradient text */
function SectionTitle({ children, icon: Icon, action }: { children: React.ReactNode; icon?: any; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
        {Icon && (
          <div className="h-7 w-7 flex items-center justify-center border border-border bg-accent">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
        )}
        {children}
      </h2>
      {action}
    </div>
  );
}
/* 
   FILTER PILL BAR (TradingView-style scrollable pills)
    */
function FilterPillBar({ active, onChange }: { active: FilterId; onChange: (id: FilterId) => void }) {
  return (
    <div className="flex flex-wrap gap-1 py-1">
      {FILTER_CATEGORIES.map((cat) => {
        const isActive = active === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onChange(cat.id)}
            className={`
              px-2.5 py-1 text-[11px] leading-tight uppercase tracking-[0.04em]
              whitespace-nowrap transition-all duration-150 border
              ${isActive
                ? "bg-primary text-primary-foreground font-semibold border-primary"
                : "bg-transparent text-muted-foreground hover:text-foreground border-border hover:border-primary/40 font-normal"
              }
            `}
          >
            {cat.label}
          </button>
        );
      })}
      <a
        href="/screener"
        className="px-2.5 py-1 text-[11px] leading-tight uppercase tracking-[0.04em] whitespace-nowrap text-muted-foreground hover:text-foreground border border-border hover:border-primary/40 transition-all duration-150 inline-flex items-center gap-1 font-normal"
      >
        Create more lists in Screener <ChevronRight className="h-3 w-3" />
      </a>
    </div>
  );
}

/* TABLE VIEW TABS */
const TABLE_VIEWS: { id: TableView; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "performance", label: "Performance" },
  { id: "valuation", label: "Valuation" },
  { id: "dividends", label: "Dividends" },
  { id: "profitability", label: "Profitability" },
  { id: "income", label: "Income Statement" },
  { id: "balance", label: "Balance Sheet" },
  { id: "cashflow", label: "Cash Flow" },
  { id: "technicals", label: "Technicals" },
];

/* 
   SECTOR CARD
    */
function SectorCard({ sector, stocks, onClick }: { sector: string; stocks: any[]; onClick: () => void }) {
  const sectorStocks = stocks.filter((s: any) => s.sector === sector);
  const withPrice = sectorStocks.filter((s: any) => s.price != null);
  const totalMcap = withPrice.reduce((sum: number, s: any) => sum + (s.marketCap || 0), 0);
  const avgChange = withPrice.length > 0
    ? withPrice.reduce((sum: number, s: any) => sum + (s.changePercent || 0), 0) / withPrice.length
    : 0;
  const gainers = withPrice.filter((s: any) => (s.changePercent ?? 0) > 0).length;
  const color = getSectorColor(sector);

  return (
    <GlassCard onClick={onClick} className="p-4 min-w-[220px]">
      <div className="flex items-start justify-between mb-3">
        <div
          className="h-9 w-9  flex items-center justify-center  border shadow-lg"
          style={{
            backgroundColor: `${color}15`,
            borderColor: `${color}30`,
            boxShadow: `0 0 12px ${color}20, inset 0 1px 0 rgba(255,255,255,0.08)`,
          }}
        >
          <Building2 className="h-4.5 w-4.5" style={{ color }} />
        </div>
        <Chg value={avgChange} />
      </div>
      <h3 className="font-semibold text-sm text-foreground mb-1">{sector}</h3>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{sectorStocks.length} stocks</span>
        <span>·</span>
        <span>{fmtLg(totalMcap)}</span>
      </div>
      <div className="mt-2 flex items-center gap-1">
        <div className="flex-1 h-1.5  bg-muted/50 overflow-hidden">
          <div
            className="h-full  bg-gain"
            style={{ width: `${withPrice.length > 0 ? (gainers / withPrice.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground">{gainers}/{withPrice.length}</span>
      </div>
    </GlassCard>
  );
}

/* 
   NEWS CARD
    */
function NewsCard({ item }: { item: any }) {
  const timeAgo = (ts: number | string) => {
    // TradingView timestamps are Unix seconds; JS Date expects milliseconds
    const msTs = typeof ts === 'number' && ts < 1e12 ? ts * 1000 : new Date(ts).getTime();
    const diff = Date.now() - msTs;
    if (diff < 0) return 'just now';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <GlassCard className="p-4 hover:scale-[1.01] transition-transform">
      <a
        href={item.link || item.url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug mb-2">
              {item.title}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {item.source && <span className="font-medium">{item.source}</span>}
              {item.published && <span>· {timeAgo(item.published)}</span>}
              {item.relatedSymbols?.length > 0 && (
                <span className="flex items-center gap-1">
                  · {item.relatedSymbols.slice(0, 3).map((s: any, idx: number) => (
                    <TickerBadge key={typeof s === 'string' ? s : s.symbol || idx} symbol={typeof s === 'string' ? s : s.symbol || ''} />
                  ))}
                </span>
              )}
            </div>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
        </div>
      </a>
    </GlassCard>
  );
}

/* 
   MARKET OVERVIEW CARDS (top movers strip)
    */
function MoverCard({ stock, rank, onClick }: { stock: any; rank: number; onClick: () => void }) {
  const isUp = (stock.changePercent ?? 0) > 0;
  const isDown = (stock.changePercent ?? 0) < 0;
  return (
    <GlassCard onClick={onClick} className="p-3 min-w-[180px] shrink-0">
      <div className="flex items-center gap-2.5 mb-2">
        {stock.logoUrl && <StockLogo logoUrl={stock.logoUrl} symbol={stock.symbol} size="md" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <TickerBadge symbol={stock.symbol} />
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{stock.name || stock.symbol}</p>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-base font-semibold text-foreground tabular-nums">{fmt(stock.price)}</span>
        <span className={`text-sm font-bold tabular-nums flex items-center gap-0.5 ${isUp ? "text-gain" : isDown ? "text-loss" : "text-muted-foreground"}`}>
          {isUp ? <ArrowUp className="h-3.5 w-3.5" /> : isDown ? <ArrowDown className="h-3.5 w-3.5" /> : null}
          {Math.abs(stock.changePercent ?? 0).toFixed(2)}%
        </span>
      </div>
    </GlassCard>
  );
}

/* 
   MAIN HOME COMPONENT
    */
export default function Home() {
  const [, setLocation] = useLocation();
  const [exchange, setExchange] = useState<"ADX" | "DFM" | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("marketCap");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [tableView, setTableView] = useState<TableView>("overview");
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);

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
    { exchange, limit: 8 },
    {
      staleTime: fastRefresh ? 3_000 : 5 * 60 * 1000,
      refetchInterval: fastRefresh,
      refetchOnWindowFocus: false,
      gcTime: 30 * 60 * 1000,
    }
  );

  const { data: marketNews } = trpc.stocks.marketNews.useQuery(
    { count: 10 },
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    }
  );

  const priceFlashes = usePriceFlashes(stocks as any);

  /** Helper to get flash class for a stock row */
  const getRowFlash = (sym: string, ex: string) => getFlashClass(priceFlashes, ex, sym);
  const getCellFlash = (sym: string, ex: string) => getPriceFlashClass(priceFlashes, ex, sym);

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

  /* ─── Derived data ─── */
  const stats = useMemo(() => {
    if (!stocks || stocks.length === 0) return null;
    const withPrice = stocks.filter((s: any) => s.price != null);
    const gainers = withPrice.filter((s: any) => (s.changePercent ?? 0) > 0);
    const losers = withPrice.filter((s: any) => (s.changePercent ?? 0) < 0);
    const totalVolume = withPrice.reduce((sum: number, s: any) => sum + (s.volume ?? 0), 0);
    const totalMcap = withPrice.reduce((sum: number, s: any) => sum + (s.marketCap ?? 0), 0);
    return { total: stocks.length, withPrice: withPrice.length, gainers: gainers.length, losers: losers.length, totalVolume, totalMcap };
  }, [stocks]);

  /** Sectors with aggregated data */
  const sectorData = useMemo(() => {
    if (!stocks) return [];
    const sectors = new Map<string, any[]>();
    stocks.forEach((s: any) => {
      if (s.sector) {
        if (!sectors.has(s.sector)) sectors.set(s.sector, []);
        sectors.get(s.sector)!.push(s);
      }
    });
    return Array.from(sectors.entries())
      .map(([name, list]) => ({
        name,
        stocks: list,
        totalMcap: list.reduce((sum, s) => sum + (s.marketCap || 0), 0),
        count: list.length,
      }))
      .sort((a, b) => b.totalMcap - a.totalMcap);
  }, [stocks]);

  /** Apply TradingView-style filter */
  const filteredStocks = useMemo(() => {
    if (!stocks) return [];
    let result = [...stocks].filter((s: any) => s.price != null && s.price > 0);

    // Apply search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s: any) => s.symbol.toLowerCase().includes(q) || (s.name && s.name.toLowerCase().includes(q)) || (s.sector && s.sector.toLowerCase().includes(q))
      );
    }

    // Apply sector filter
    if (sectorFilter) {
      result = result.filter((s: any) => s.sector === sectorFilter);
    }

    // Apply category filter
    switch (activeFilter) {
      case "gainers":
        result = result.filter((s: any) => (s.changePercent ?? 0) > 0)
          .sort((a: any, b: any) => (b.changePercent || 0) - (a.changePercent || 0));
        break;
      case "losers":
        result = result.filter((s: any) => (s.changePercent ?? 0) < 0)
          .sort((a: any, b: any) => (a.changePercent || 0) - (b.changePercent || 0));
        break;
      case "active":
        result.sort((a: any, b: any) => (b.volume || 0) - (a.volume || 0));
        break;
      case "high-dividend":
        result = result.filter((s: any) => s.dividendYield != null && s.dividendYield > 0)
          .sort((a: any, b: any) => (b.dividendYield || 0) - (a.dividendYield || 0));
        break;
      case "unusual-volume":
        result = result.filter((s: any) => s.volume != null && s.volume > 0)
          .sort((a: any, b: any) => {
            const ratioA = (a.volume || 0) / Math.max(a.avgVolume || a.volume || 1, 1);
            const ratioB = (b.volume || 0) / Math.max(b.avgVolume || b.volume || 1, 1);
            return ratioB - ratioA;
          });
        break;
      case "volatile":
        result.sort((a: any, b: any) => Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0));
        break;
      case "high-beta":
        result = result.filter((s: any) => s.beta != null && s.beta > 1)
          .sort((a: any, b: any) => (b.beta || 0) - (a.beta || 0));
        break;
      case "large-cap":
        result = result.filter((s: any) => s.marketCap != null && s.marketCap >= 10e9)
          .sort((a: any, b: any) => (b.marketCap || 0) - (a.marketCap || 0));
        break;
      case "small-cap":
        result = result.filter((s: any) => s.marketCap != null && s.marketCap < 5e9)
          .sort((a: any, b: any) => (a.marketCap || 0) - (b.marketCap || 0));
        break;
      case "overbought":
        result = result.filter((s: any) => s.rsi != null && s.rsi >= 70)
          .sort((a: any, b: any) => (b.rsi || 0) - (a.rsi || 0));
        break;
      case "oversold":
        result = result.filter((s: any) => s.rsi != null && s.rsi <= 30)
          .sort((a: any, b: any) => (a.rsi || 0) - (b.rsi || 0));
        break;
      case "52w-high":
        result = result.filter((s: any) => s.week52High != null && s.price != null && s.price >= s.week52High * 0.95)
          .sort((a: any, b: any) => {
            const pctA = a.week52High ? (a.price || 0) / a.week52High : 0;
            const pctB = b.week52High ? (b.price || 0) / b.week52High : 0;
            return pctB - pctA;
          });
        break;
      case "52w-low":
        result = result.filter((s: any) => s.week52Low != null && s.price != null && s.price <= s.week52Low * 1.05)
          .sort((a: any, b: any) => {
            const pctA = a.week52Low ? (a.price || 0) / a.week52Low : 0;
            const pctB = b.week52Low ? (b.price || 0) / b.week52Low : 0;
            return pctA - pctB;
          });
        break;
      case "penny":
        result = result.filter((s: any) => s.price != null && s.price < 1)
          .sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
        break;
      case "highest-revenue":
        result = result.filter((s: any) => s.totalRevenue != null)
          .sort((a: any, b: any) => (b.totalRevenue || 0) - (a.totalRevenue || 0));
        break;
      case "highest-profit":
        result = result.filter((s: any) => s.netIncome != null)
          .sort((a: any, b: any) => (b.netIncome || 0) - (a.netIncome || 0));
        break;
      case "best-performing":
        result = result.filter((s: any) => s.perfYear != null)
          .sort((a: any, b: any) => (b.perfYear || 0) - (a.perfYear || 0));
        break;
      case "largest-employers":
        result = result.filter((s: any) => s.marketCap != null)
          .sort((a: any, b: any) => (b.marketCap || 0) - (a.marketCap || 0));
        break;
      case "highest-cash":
        result = result.filter((s: any) => s.totalRevenue != null)
          .sort((a: any, b: any) => (b.totalRevenue || 0) - (a.totalRevenue || 0));
        break;
      case "highest-profit-per-employee":
        result = result.filter((s: any) => s.netIncome != null)
          .sort((a: any, b: any) => (b.netIncome || 0) - (a.netIncome || 0));
        break;
      case "highest-revenue-per-employee":
        result = result.filter((s: any) => s.totalRevenue != null)
          .sort((a: any, b: any) => (b.totalRevenue || 0) - (a.totalRevenue || 0));
        break;
      case "most-expensive":
        result = result.filter((s: any) => s.price != null)
          .sort((a: any, b: any) => (b.price || 0) - (a.price || 0));
        break;
      case "ath":
        result = result.filter((s: any) => s.week52High != null && s.price != null && s.price >= s.week52High * 0.98)
          .sort((a: any, b: any) => {
            const pctA = a.week52High ? (a.price || 0) / a.week52High : 0;
            const pctB = b.week52High ? (b.price || 0) / b.week52High : 0;
            return pctB - pctA;
          });
        break;
      case "atl":
        result = result.filter((s: any) => s.week52Low != null && s.price != null && s.price <= s.week52Low * 1.02)
          .sort((a: any, b: any) => {
            const pctA = a.week52Low ? (a.price || 0) / a.week52Low : 0;
            const pctB = b.week52Low ? (b.price || 0) / b.week52Low : 0;
            return pctA - pctB;
          });
        break;
      case "undervalued":
        result = result.filter((s: any) => {
          if (!s.pe || s.pe <= 0 || !s.priceToBook) return false;
          return s.pe < 15 && s.priceToBook < 1.5;
        });
        break;
      case "fairly-valued":
        result = result.filter((s: any) => {
          if (!s.pe || s.pe <= 0) return false;
          return s.pe >= 15 && s.pe <= 25;
        });
        break;
      case "overvalued":
        result = result.filter((s: any) => {
          if (!s.pe || s.pe <= 0) return false;
          return s.pe > 25;
        });
        break;
      default:
        // "all" — apply manual sort
        result.sort((a: any, b: any) => {
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
    }

    // If not "all" filter, still allow manual sort override
    if (activeFilter !== "all" && sortField !== "marketCap") {
      result.sort((a: any, b: any) => {
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
    }

    return result;
  }, [stocks, search, sortField, sortDir, activeFilter, sectorFilter]);

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

  /** Filter description text */
  const filterDescription = useMemo(() => {
    const cat = FILTER_CATEGORIES.find(c => c.id === activeFilter);
    const descriptions: Record<string, string> = {
      "all": "All Emirati stocks listed on ADX and DFM exchanges.",
      "gainers": "Stocks with the highest positive price change today.",
      "losers": "Stocks with the largest negative price change today.",
      "active": "Stocks with the highest trading volume today.",
      "high-dividend": "Emirati companies with the highest dividend yields.",
      "unusual-volume": "Stocks trading at significantly higher volume than average.",
      "volatile": "Stocks with the largest absolute price swings today.",
      "high-beta": "Stocks with beta greater than 1, indicating higher market sensitivity.",
      "large-cap": "Companies with market capitalization above AED 10B.",
      "small-cap": "Companies with market capitalization below AED 5B.",
      "overbought": "Stocks with RSI above 70, potentially overbought.",
      "oversold": "Stocks with RSI below 30, potentially oversold.",
      "52w-high": "Stocks trading within 5% of their 52-week high.",
      "52w-low": "Stocks trading within 5% of their 52-week low.",
      "penny": "Stocks priced below AED 1.00.",
      "highest-revenue": "Companies ranked by total revenue.",
      "highest-profit": "Companies ranked by net income.",
      "best-performing": "Stocks with the best 1-year performance.",
      "largest-employers": "Largest Emirati companies by market capitalization.",
      "highest-cash": "Companies with the highest cash reserves.",
      "highest-profit-per-employee": "Companies with the highest profit per employee.",
      "highest-revenue-per-employee": "Companies with the highest revenue per employee.",
      "most-expensive": "Stocks with the highest share price.",
      "ath": "Stocks trading near their all-time high.",
      "atl": "Stocks trading near their all-time low.",
      "undervalued": "Stocks with P/E below 15 and P/B below 1.5 — potentially undervalued.",
      "fairly-valued": "Stocks with P/E between 15-25 — trading at fair market value.",
      "overvalued": "Stocks with P/E above 25 — may be overvalued relative to earnings.",
    };
    return descriptions[activeFilter] || "";
  }, [activeFilter]);

  /* 
     RENDER
      */
  return (
    <div className="flex flex-col gap-8 pb-8">

      {/*  HERO: Market Overview Stats  */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/3 dark:from-primary/10 dark:via-transparent dark:to-primary/5 rounded-2xl" />
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card border border-border p-4">
                <Skeleton className="h-3 w-16 mb-2" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))
          ) : stats ? (
            <>
              <GlassCard className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 flex items-center justify-center border border-border bg-accent">
                    <Layers className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Total Stocks</p>
                    <p className="text-xl font-bold text-foreground tabular-nums">{stats.withPrice}</p>
                  </div>
                </div>
              </GlassCard>
              <GlassCard className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 flex items-center justify-center border border-border bg-accent">
                    <TrendingUp className="h-5 w-5 text-gain" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Gainers / Losers</p>
                    <p className="text-xl font-bold tabular-nums">
                      <span className="text-gain">{stats.gainers}</span>
                      <span className="text-muted-foreground mx-1">/</span>
                      <span className="text-loss">{stats.losers}</span>
                    </p>
                  </div>
                </div>
              </GlassCard>
              <GlassCard className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 flex items-center justify-center border border-border bg-accent">
                    <BarChart3 className="h-5 w-5 text-cyan-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Total Volume</p>
                    <p className="text-xl font-bold text-foreground tabular-nums">{fmtLg(stats.totalVolume)}</p>
                  </div>
                </div>
              </GlassCard>
              <GlassCard className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 flex items-center justify-center border border-border bg-accent">
                    <DollarSign className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Market Cap</p>
                    <p className="text-xl font-bold text-foreground tabular-nums">{fmtLg(stats.totalMcap)}</p>
                  </div>
                </div>
              </GlassCard>
            </>
          ) : null}
        </div>
      </div>

      {/*  TOP MOVERS CAROUSEL  */}
      {topMovers && (
        <section>
          <SectionTitle icon={TrendingUp}>
            Today&apos;s Movers
          </SectionTitle>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
            {[...(topMovers.gainers || []), ...(topMovers.losers || [])].map((stock: any, i: number) => (
              <MoverCard
                key={stock.symbol}
                stock={stock}
                rank={i + 1}
                onClick={() => setLocation(`/stock/${stock.symbol}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/*  MARKET HEATMAP  */}
      {stocks && stocks.length > 0 && (
        <section>
          <SectionTitle icon={BarChart3}>Market Heatmap</SectionTitle>
          <MarketHeatmap stocks={stocks} />
        </section>
      )}
      {/*  SECTORS & INDUSTRIES  */}
      {sectorData.length > 0 && (
        <section>
          <SectionTitle icon={Building2} action={
            sectorFilter && (
              <button
                onClick={() => setSectorFilter(null)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Clear filter <span className="font-medium">({sectorFilter})</span>
              </button>
            )
          }>
            Sectors &amp; Industries
          </SectionTitle>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
            {sectorData.slice(0, 12).map((sec) => (
              <SectorCard
                key={sec.name}
                sector={sec.name}
                stocks={stocks || []}
                onClick={() => {
                  setSectorFilter(sectorFilter === sec.name ? null : sec.name);
                  toast.info(sectorFilter === sec.name ? "Sector filter cleared" : `Filtered to ${sec.name}`);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/*  FILTER PILLS + TABLE SECTION  */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-foreground flex items-center gap-2">
              <div className="h-7 w-7 flex items-center justify-center border border-border bg-accent">
                <Filter className="h-3.5 w-3.5 text-primary" />
              </div>
              Emirati Stocks
            </h2>
            {/* Exchange tabs */}
            <div className="flex items-center border border-border">
              {(["ALL", "ADX", "DFM"] as const).map((ex) => (
                <button
                  key={ex}
                  onClick={() => setExchange(ex)}
                  className={`px-3 py-1 text-xs font-medium transition-all border-r last:border-r-0 border-border ${
                    exchange === ex
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search stocks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-9 pr-3  text-sm bg-card  border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 w-48"
              />
            </div>
            {/* Export */}
            <button
              onClick={handleExportCSV}
              disabled={csvFetching}
              className="h-8 px-3  text-xs font-medium bg-card  border border-border text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>
        </div>

        {/* Filter pills */}
        <FilterPillBar active={activeFilter} onChange={(id) => { setActiveFilter(id); setSortField("marketCap"); setSortDir("desc"); }} />

        {/* Filter description */}
        {activeFilter !== "all" && (
          <div className="mt-3 px-1">
            <p className="text-sm text-muted-foreground">{filterDescription}</p>
            <p className="text-xs text-muted-foreground mt-1">{filteredStocks.length} stocks match</p>
          </div>
        )}

        {/* Table view tabs */}
        <div className="flex items-center gap-1 mt-4 mb-3 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
          {TABLE_VIEWS.map((tv) => (
            <button
              key={tv.id}
              onClick={() => setTableView(tv.id)}
              className={`px-3 py-1.5  text-sm font-medium whitespace-nowrap transition-all ${
                tableView === tv.id
                  ? "bg-primary/15 text-primary  border border-primary/20 shadow-[0_0_10px_rgba(59,130,246,0.12)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06] hover: border border-transparent hover:border-white/[0.08]"
              }`}
            >
              {tv.label}
            </button>
          ))}
        </div>

        {/* DATA TABLE */}
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="stock-table w-full">
              <thead>
                <tr>
                  <th className="text-left pl-4" onClick={() => handleSort("symbol")}>
                    <span className="inline-flex items-center gap-1">Symbol <SortIcon field="symbol" /></span>
                  </th>
                  <th className="text-left" onClick={() => handleSort("name")}>
                    <span className="inline-flex items-center gap-1">Company <SortIcon field="name" /></span>
                  </th>
                  <th className="text-right" onClick={() => handleSort("price")}>
                    <span className="inline-flex items-center gap-1 justify-end">Price <SortIcon field="price" /></span>
                  </th>
                  <th className="text-right" onClick={() => handleSort("changePercent")}>
                    <span className="inline-flex items-center gap-1 justify-end">Change % <SortIcon field="changePercent" /></span>
                  </th>
                  <th className="text-right" onClick={() => handleSort("volume")}>
                    <span className="inline-flex items-center gap-1 justify-end">Volume <SortIcon field="volume" /></span>
                  </th>

                  {/* Dynamic columns based on table view */}
                  {tableView === "overview" && (
                    <>
                      <th className="text-right" onClick={() => handleSort("marketCap")}>
                        <span className="inline-flex items-center gap-1 justify-end">Mkt Cap <SortIcon field="marketCap" /></span>
                      </th>
                      <th className="text-right" onClick={() => handleSort("pe")}>
                        <span className="inline-flex items-center gap-1 justify-end">P/E <SortIcon field="pe" /></span>
                      </th>
                      <th className="text-right" onClick={() => handleSort("eps")}>
                        <span className="inline-flex items-center gap-1 justify-end">EPS <SortIcon field="eps" /></span>
                      </th>
                    </>
                  )}
                  {tableView === "performance" && (
                    <>
                      <th className="text-right" onClick={() => handleSort("perfWeek")}>
                        <span className="inline-flex items-center gap-1 justify-end">1W <SortIcon field="perfWeek" /></span>
                      </th>
                      <th className="text-right" onClick={() => handleSort("perfMonth")}>
                        <span className="inline-flex items-center gap-1 justify-end">1M <SortIcon field="perfMonth" /></span>
                      </th>
                      <th className="text-right" onClick={() => handleSort("perfYear")}>
                        <span className="inline-flex items-center gap-1 justify-end">1Y <SortIcon field="perfYear" /></span>
                      </th>
                    </>
                  )}
                  {tableView === "valuation" && (
                    <>
                      <th className="text-right" onClick={() => handleSort("marketCap")}>
                        <span className="inline-flex items-center gap-1 justify-end">Mkt Cap <SortIcon field="marketCap" /></span>
                      </th>
                      <th className="text-right" onClick={() => handleSort("pe")}>
                        <span className="inline-flex items-center gap-1 justify-end">P/E <SortIcon field="pe" /></span>
                      </th>
                      <th className="text-right" onClick={() => handleSort("eps")}>
                        <span className="inline-flex items-center gap-1 justify-end">P/B <SortIcon field="eps" /></span>
                      </th>
                    </>
                  )}
                  {tableView === "dividends" && (
                    <>
                      <th className="text-right" onClick={() => handleSort("dividendYield")}>
                        <span className="inline-flex items-center gap-1 justify-end">Div Yield <SortIcon field="dividendYield" /></span>
                      </th>
                      <th className="text-right" onClick={() => handleSort("marketCap")}>
                        <span className="inline-flex items-center gap-1 justify-end">Mkt Cap <SortIcon field="marketCap" /></span>
                      </th>
                      <th className="text-right" onClick={() => handleSort("pe")}>
                        <span className="inline-flex items-center gap-1 justify-end">P/E <SortIcon field="pe" /></span>
                      </th>
                    </>
                  )}
                  {tableView === "profitability" && (
                    <>
                      <th className="text-right" onClick={() => handleSort("grossMargin")}>
                        <span className="inline-flex items-center gap-1 justify-end">Gross Margin <SortIcon field="grossMargin" /></span>
                      </th>
                      <th className="text-right" onClick={() => handleSort("operatingMargin")}>
                        <span className="inline-flex items-center gap-1 justify-end">Op Margin <SortIcon field="operatingMargin" /></span>
                      </th>
                      <th className="text-right" onClick={() => handleSort("returnOnEquity")}>
                        <span className="inline-flex items-center gap-1 justify-end">ROE <SortIcon field="returnOnEquity" /></span>
                      </th>
                    </>
                  )}
                  {tableView === "income" && (
                    <>
                      <th className="text-right" onClick={() => handleSort("totalRevenue")}>
                        <span className="inline-flex items-center gap-1 justify-end">Revenue <SortIcon field="totalRevenue" /></span>
                      </th>
                      <th className="text-right" onClick={() => handleSort("netIncome")}>
                        <span className="inline-flex items-center gap-1 justify-end">Net Income <SortIcon field="netIncome" /></span>
                      </th>
                      <th className="text-right" onClick={() => handleSort("ebitda")}>
                        <span className="inline-flex items-center gap-1 justify-end">EBITDA <SortIcon field="ebitda" /></span>
                      </th>
                    </>
                  )}
                  {tableView === "balance" && (
                    <>
                      <th className="text-right" onClick={() => handleSort("marketCap")}>
                        <span className="inline-flex items-center gap-1 justify-end">Mkt Cap <SortIcon field="marketCap" /></span>
                      </th>
                      <th className="text-right" onClick={() => handleSort("debtToEquity")}>
                        <span className="inline-flex items-center gap-1 justify-end">D/E <SortIcon field="debtToEquity" /></span>
                      </th>
                      <th className="text-right" onClick={() => handleSort("eps")}>
                        <span className="inline-flex items-center gap-1 justify-end">EPS <SortIcon field="eps" /></span>
                      </th>
                    </>
                  )}
                  {tableView === "cashflow" && (
                    <>
                      <th className="text-right" onClick={() => handleSort("ebitda")}>
                        <span className="inline-flex items-center gap-1 justify-end">EBITDA <SortIcon field="ebitda" /></span>
                      </th>
                      <th className="text-right" onClick={() => handleSort("totalRevenue")}>
                        <span className="inline-flex items-center gap-1 justify-end">Revenue <SortIcon field="totalRevenue" /></span>
                      </th>
                      <th className="text-right" onClick={() => handleSort("netIncome")}>
                        <span className="inline-flex items-center gap-1 justify-end">Net Income <SortIcon field="netIncome" /></span>
                      </th>
                    </>
                  )}
                  {tableView === "technicals" && (
                    <>
                      <th className="text-right" onClick={() => handleSort("rsi")}>
                        <span className="inline-flex items-center gap-1 justify-end">RSI <SortIcon field="rsi" /></span>
                      </th>
                      <th className="text-right" onClick={() => handleSort("beta")}>
                        <span className="inline-flex items-center gap-1 justify-end">Beta <SortIcon field="beta" /></span>
                      </th>
                      <th className="text-right" onClick={() => handleSort("week52High")}>
                        <span className="inline-flex items-center gap-1 justify-end">52W H <SortIcon field="week52High" /></span>
                      </th>
                    </>
                  )}

                  <th className="text-center w-16">Sector</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j}><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-muted-foreground">
                      No stocks match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((stock: any) => {
                    const rowFlash = getRowFlash(stock.symbol, stock.exchange);
                    const cellFlash = getCellFlash(stock.symbol, stock.exchange);
                    const isUp = (stock.changePercent ?? 0) > 0;
                    const isDown = (stock.changePercent ?? 0) < 0;
                    return (
                      <tr
                        key={stock.symbol}
                        onClick={() => setLocation(`/stock/${stock.symbol}`)}
                        className={`cursor-pointer ${rowFlash}`}
                      >
                        {/* Symbol */}
                        <td className="pl-4">
                          <div className="flex items-center gap-2">
                            {stock.logoUrl && <StockLogo logoUrl={stock.logoUrl} symbol={stock.symbol} />}
                            <TickerBadge symbol={stock.symbol} />
                          </div>
                        </td>
                        {/* Company */}
                        <td>
                          <span className="text-sm text-foreground truncate block max-w-[200px]">
                            {stock.name || stock.symbol}
                          </span>
                        </td>
                        {/* Price */}
                        <td className="text-right">
                          <span className={`font-medium tabular-nums ${cellFlash}`}>
                            {fmt(stock.price)}
                          </span>
                        </td>
                        {/* Change */}
                        <td className="text-right">
                          <Chg value={stock.changePercent} />
                        </td>
                        {/* Volume */}
                        <td className="text-right text-muted-foreground tabular-nums text-sm">
                          {fmtLg(stock.volume)}
                        </td>

                        {/* Dynamic columns */}
                        {tableView === "overview" && (
                          <>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{fmtLg(stock.marketCap)}</td>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{stock.pe != null ? stock.pe.toFixed(1) : "—"}</td>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{stock.eps != null ? fmt(stock.eps) : "—"}</td>
                          </>
                        )}
                        {tableView === "performance" && (
                          <>
                            <td className="text-right"><Chg value={stock.perfWeek} showArrow={false} /></td>
                            <td className="text-right"><Chg value={stock.perfMonth} showArrow={false} /></td>
                            <td className="text-right"><Chg value={stock.perfYear} showArrow={false} /></td>
                          </>
                        )}
                        {tableView === "valuation" && (
                          <>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{fmtLg(stock.marketCap)}</td>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{stock.pe != null ? stock.pe.toFixed(1) : "—"}</td>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{stock.priceToBook != null ? stock.priceToBook.toFixed(2) : "—"}</td>
                          </>
                        )}
                        {tableView === "dividends" && (
                          <>
                            <td className="text-right">
                              <span className={`tabular-nums text-sm font-medium ${stock.dividendYield > 3 ? "text-gain" : "text-muted-foreground"}`}>
                                {stock.dividendYield != null ? stock.dividendYield.toFixed(2) + "%" : "—"}
                              </span>
                            </td>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{fmtLg(stock.marketCap)}</td>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{stock.pe != null ? stock.pe.toFixed(1) : "—"}</td>
                          </>
                        )}
                        {tableView === "profitability" && (
                          <>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{stock.grossMargin != null ? (stock.grossMargin * 100).toFixed(1) + "%" : "—"}</td>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{stock.operatingMargin != null ? (stock.operatingMargin * 100).toFixed(1) + "%" : "—"}</td>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{stock.returnOnEquity != null ? (stock.returnOnEquity * 100).toFixed(1) + "%" : "—"}</td>
                          </>
                        )}
                        {tableView === "income" && (
                          <>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{stock.totalRevenue != null ? fmtLg(stock.totalRevenue) : "—"}</td>
                            <td className={`text-right tabular-nums text-sm ${stock.netIncome != null ? (stock.netIncome >= 0 ? "text-gain" : "text-loss") : "text-muted-foreground"}`}>{stock.netIncome != null ? fmtLg(stock.netIncome) : "—"}</td>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{stock.ebitda != null ? fmtLg(stock.ebitda) : "—"}</td>
                          </>
                        )}
                        {tableView === "balance" && (
                          <>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{stock.marketCap != null ? fmtLg(stock.marketCap) : "—"}</td>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{stock.debtToEquity != null ? stock.debtToEquity.toFixed(2) : "—"}</td>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{stock.eps != null ? fmt(stock.eps) : "—"}</td>
                          </>
                        )}
                        {tableView === "cashflow" && (
                          <>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{stock.ebitda != null ? fmtLg(stock.ebitda) : "—"}</td>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{stock.totalRevenue != null ? fmtLg(stock.totalRevenue) : "—"}</td>
                            <td className={`text-right tabular-nums text-sm ${stock.netIncome != null ? (stock.netIncome >= 0 ? "text-gain" : "text-loss") : "text-muted-foreground"}`}>{stock.netIncome != null ? fmtLg(stock.netIncome) : "—"}</td>
                          </>
                        )}
                        {tableView === "technicals" && (
                          <>
                            <td className="text-right">
                              <span className={`tabular-nums text-sm font-medium ${
                                stock.rsi != null ? (stock.rsi >= 70 ? "text-loss" : stock.rsi <= 30 ? "text-gain" : "text-muted-foreground") : "text-muted-foreground"
                              }`}>
                                {stock.rsi != null ? stock.rsi.toFixed(1) : "—"}
                              </span>
                            </td>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{stock.beta != null ? stock.beta.toFixed(2) : "—"}</td>
                            <td className="text-right text-muted-foreground tabular-nums text-sm">{stock.week52High != null ? fmt(stock.week52High) : "—"}</td>
                          </>
                        )}

                        {/* Sector */}
                        <td className="text-center">
                          {stock.sector && (
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium"
                              style={{
                                backgroundColor: `${getSectorColor(stock.sector)}12`,
                                color: getSectorColor(stock.sector),
                              }}
                            >
                              {stock.sector}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Table footer */}
          {!isLoading && filteredStocks.length > 0 && (
            <div className="px-4 py-3 border-t border-white/10 dark:border-white/[0.06] flex items-center justify-between text-xs text-muted-foreground">
              <span>Showing {filteredStocks.length} stocks</span>
              <button
                onClick={() => setLocation("/screener")}
                className="text-primary hover:underline flex items-center gap-1"
              >
                Advanced Screener <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </GlassCard>
      </section>

      {/*  NEWS SECTION  */}
      {marketNews && marketNews.items && marketNews.items.length > 0 && (
        <section>
          <SectionTitle icon={Newspaper} action={
            <button
              onClick={() => setLocation("/news")}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              All news <ChevronRight className="h-3 w-3" />
            </button>
          }>
            Market News
          </SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {marketNews.items.slice(0, 6).map((item: any, i: number) => (
              <NewsCard key={i} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
