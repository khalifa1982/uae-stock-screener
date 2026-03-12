import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { SnowflakeChart } from "@/components/SnowflakeChart";
import { FairValueGauge } from "@/components/FairValueGauge";
import { AnalysisChecks } from "@/components/AnalysisChecks";
import { StockNewsTab } from "@/components/StockNewsTab";
import { StockForecastsTab } from "@/components/StockForecastsTab";
import { StockSeasonalsTab } from "@/components/StockSeasonalsTab";
import { StockFinancialsExtended } from "@/components/StockFinancialsExtended";
import { TechnicalAnalysisTab } from "@/components/TechnicalAnalysisTab";
import { OrderBook, PriceBook } from "@/components/OrderBook";
import { AdvancedChart } from "@/components/AdvancedChart";
import { AnalystConsensus } from "@/components/AnalystConsensus";
import { EarningsTranscripts } from "@/components/EarningsTranscripts";
import { useAutoRefreshInterval } from "@/hooks/useMarketStatus";
import { MarketStatusBadge } from "@/components/MarketStatusIndicator";
import { useRealtimePrice } from "@/hooks/useRealtimePrices";
import { RealtimeIndicator } from "@/components/RealtimeIndicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, ArrowUp, ArrowDown, TrendingUp, TrendingDown,
  Activity, BarChart3, Brain, Loader2, DollarSign, Target,
  Gauge, Building2, Users, Globe, FileText, PieChart,
  Calendar, Briefcase, BookOpen, ExternalLink, Layers,
  Shield, Zap, ArrowUpDown, Hash, CircleDot, Newspaper, BookOpenCheck,
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ALL_STOCKS } from "../../../shared/stockData";

// ─── Formatters ────────────────────────────────────────────────────
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

function formatPercent(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return "—";
  return (num * 100).toFixed(3) + "%";
}

function formatRawPercent(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return "—";
  return (num > 0 ? "+" : "") + num.toFixed(3) + "%";
}

// ─── Reusable Components ───────────────────────────────────────────
function MetricCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color?: string }) {
  return (
    <div className="flex items-center gap-1 p-3 rounded bg-secondary/30 border border-border/30 neon-card">
      <div className={`h-9 w-9 rounded flex items-center justify-center shrink-0 ${color || "bg-primary/10"}`}>
        <Icon className={`h-4 w-4 ${color ? "text-foreground" : "text-primary"}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        <p className="text-[11px] font-semibold font-mono truncate">{value}</p>
      </div>
    </div>
  );
}

function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 px-3 rounded-md hover:bg-muted/10">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-[11px] ${highlight ? "font-semibold text-foreground" : "text-foreground/80"}`}>{value}</span>
    </div>
  );
}

function RSIGauge({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const zone = value > 70 ? "Overbought" : value < 30 ? "Oversold" : "Neutral";
  const color = value > 70 ? "text-loss" : value < 30 ? "text-gain" : "text-foreground";
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">RSI (14)</span>
        <span className={`text-[11px] font-mono font-semibold ${color}`}>{value.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded-full bg-secondary/50 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${value > 70 ? "bg-[oklch(0.65_0.22_25)]" : value < 30 ? "bg-[oklch(0.72_0.17_155)]" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0 — Oversold</span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${color}`}>{zone}</Badge>
        <span>Overbought — 100</span>
      </div>
    </div>
  );
}

/** TradingView-style recommendation gauge: Strong Sell ← → Strong Buy */
function RecommendationGauge({ value, label }: { value: number | null | undefined; label: string }) {
  if (value == null) return null;
  // value ranges from -1 (strong sell) to +1 (strong buy)
  const pct = Math.min(100, Math.max(0, (value + 1) * 50));
  const text = value >= 0.5 ? "Strong Buy" : value >= 0.1 ? "Buy" : value > -0.1 ? "Neutral" : value > -0.5 ? "Sell" : "Strong Sell";
  const textColor = value >= 0.1 ? "text-gain" : value <= -0.1 ? "text-loss" : "text-foreground";
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-[11px] font-mono font-bold ${textColor}`}>{text}</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden flex">
        <div className="flex-1 bg-[oklch(0.65_0.22_25)]" />
        <div className="flex-1 bg-[oklch(0.65_0.22_25/60%)]" />
        <div className="flex-1 bg-muted" />
        <div className="flex-1 bg-[oklch(0.72_0.17_155/60%)]" />
        <div className="flex-1 bg-[oklch(0.72_0.17_155)]" />
      </div>
      <div className="relative h-4">
        <div className="absolute top-0 -translate-x-1/2 transition-all" style={{ left: `${pct}%` }}>
          <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[6px] border-l-transparent border-r-transparent border-b-foreground" />
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Strong Sell</span>
        <span className="font-mono">{value.toFixed(3)}</span>
        <span>Strong Buy</span>
      </div>
    </div>
  );
}

/** Moving Average row with buy/sell signal */
function MARow({ label, value, price }: { label: string; value: number | null | undefined; price: number | null | undefined }) {
  if (value == null) return null;
  const signal = price != null ? (price > value ? "Buy" : "Sell") : null;
  return (
    <div className="flex justify-between items-center py-1.5 px-2 rounded hover:bg-muted/10">
      <span className="text-xs text-muted-foreground w-20">{label}</span>
      <span className="font-mono text-xs">{formatNumber(value, 3)}</span>
      {signal && (
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${signal === "Buy" ? "text-gain border-gain/30" : "text-loss border-loss/30"}`}>
          {signal}
        </Badge>
      )}
    </div>
  );
}

/** Oscillator row with buy/sell/neutral signal */
function OscillatorRow({ label, value, signal }: { label: string; value: string; signal?: "Buy" | "Sell" | "Neutral" }) {
  return (
    <div className="flex justify-between items-center py-1.5 px-2 rounded hover:bg-muted/10">
      <span className="text-xs text-muted-foreground flex-1">{label}</span>
      <span className="font-mono text-xs w-24 text-right">{value}</span>
      {signal && (
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ml-2 w-16 justify-center ${signal === "Buy" ? "text-gain border-gain/30" : signal === "Sell" ? "text-loss border-loss/30" : "text-muted-foreground border-border/30"}`}>
          {signal}
        </Badge>
      )}
    </div>
  );
}

function FinancialTable({ title, data, icon: Icon }: { title: string; data: any[]; icon: any }) {
  if (!data || data.length === 0) return null;
  const keys = Object.keys(data[0]).filter(k => k !== "date" && k !== "endDate");
  const formatVal = (v: any) => {
    if (v == null) return "—";
    if (typeof v === "number") return formatLargeNumber(v);
    return String(v);
  };
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="text-left p-2 pl-4 font-medium text-muted-foreground sticky left-0 bg-card z-10">Metric</th>
                {data.map((row, i) => (
                  <th key={i} className="text-right p-2 pr-4 font-medium text-muted-foreground whitespace-nowrap">
                    {row.date || row.endDate || `Period ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map(key => (
                <tr key={key} className="border-b border-border/20 hover:bg-muted/10">
                  <td className="p-2 pl-4 text-muted-foreground capitalize sticky left-0 bg-card z-10 whitespace-nowrap">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </td>
                  {data.map((row, i) => (
                    <td key={i} className="p-2 pr-4 text-right font-mono whitespace-nowrap">{formatVal(row[key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

const chartRanges = [
  { value: "1d", label: "1D" },
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "2y", label: "2Y" },
];

// ─── Helper: Oscillator signal logic ───────────────────────────────
function getOscSignal(name: string, val: number | null | undefined, extra?: any): "Buy" | "Sell" | "Neutral" | undefined {
  if (val == null) return undefined;
  if (name === "RSI") return val < 30 ? "Buy" : val > 70 ? "Sell" : "Neutral";
  if (name === "Stoch %K") return val < 20 ? "Buy" : val > 80 ? "Sell" : "Neutral";
  if (name === "CCI") return val < -100 ? "Buy" : val > 100 ? "Sell" : "Neutral";
  if (name === "ADX") return val > 25 ? "Buy" : "Neutral";
  if (name === "AO") return val > 0 ? "Buy" : "Sell";
  if (name === "Momentum") return val > 0 ? "Buy" : "Sell";
  if (name === "MACD") {
    const sig = extra?.signal;
    if (sig != null) return val > sig ? "Buy" : "Sell";
    return val > 0 ? "Buy" : "Sell";
  }
  return "Neutral";
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function StockDetail() {
  const params = useParams<{ symbol: string }>();
  const [, setLocation] = useLocation();
  const symbol = params.symbol || "";
  const [chartRange, setChartRange] = useState<"1d" | "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y">("3mo");
  const [activeTab, setActiveTab] = useState("overview");

  const stockInfo = useMemo(() => ALL_STOCKS.find(s => s.symbol === symbol), [symbol]);
  const autoRefreshInterval = useAutoRefreshInterval();
  const exchange = stockInfo?.exchange || "DFM";
  const { price: realtimePrice, isConnected: wsConnected } = useRealtimePrice(symbol, exchange);

  const { data: detail, isLoading: detailLoading } = trpc.stocks.detail.useQuery(
    { symbol },
    { enabled: !!symbol, staleTime: autoRefreshInterval ? 3_000 : 300_000, refetchInterval: autoRefreshInterval ? 5_000 : undefined, gcTime: 1800_000, refetchOnWindowFocus: false }
  );

  const chartInterval = chartRange === "1d" ? "15min" : "1d";
  const { data: chartData, isLoading: chartLoading } = trpc.stocks.chart.useQuery(
    { symbol, range: chartRange, interval: chartInterval } as any,
    { enabled: !!symbol, staleTime: 300_000, gcTime: 1800_000, refetchOnWindowFocus: false }
  );

  const { data: profileData, isLoading: profileLoading } = trpc.stocks.profile.useQuery(
    { symbol },
    { enabled: !!symbol, staleTime: 600_000, gcTime: 3600_000, refetchOnWindowFocus: false }
  );

  const sentimentMutation = trpc.stocks.sentiment.useMutation();
  const aiAnalysisMutation = trpc.stocks.aiAnalysis.useMutation();

  const { data: snowflakeData, isLoading: snowflakeLoading } = trpc.stocks.snowflake.useQuery(
    { symbol },
    { enabled: !!symbol && activeTab === "analysis", staleTime: 600_000, gcTime: 3600_000, refetchOnWindowFocus: false }
  );

  const chartPoints = useMemo(() => {
    if (!chartData || !chartData.timestamps) return [];
    return chartData.timestamps.map((t: number, i: number) => {
      const d = new Date(t);
      const isoDate = d.toISOString().split("T")[0]; // "2026-03-12" for indicator matching
      const displayDate = chartRange === "1d"
        ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return {
        date: displayDate,
        isoDate,
        close: chartData.close[i],
        open: chartData.open?.[i] ?? chartData.close[i],
        volume: chartData.volume[i],
        high: chartData.high[i],
        low: chartData.low[i],
      };
    }).filter((p: any) => p.close != null);
  }, [chartData, chartRange]);

  const priceChange = detail?.price && detail?.previousClose
    ? ((detail.price - detail.previousClose) / detail.previousClose) * 100
    : detail?.changePercent;

  const profile = profileData?.profile;
  // Use real-time WebSocket price if available, otherwise fall back to API data
  const price = realtimePrice?.price ?? detail?.price ?? null;
  const liveVolume = realtimePrice?.dayVolume ?? detail?.volume ?? null;

  if (!stockInfo) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-1.5">
        <p className="text-muted-foreground">Stock not found</p>
        <Button variant="outline" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-1.5">
        <Button variant="ghost" size="sm" className="self-start gap-2 text-muted-foreground -ml-2" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1.5">
          <div className="flex items-start gap-1.5">
            {profile?.logo ? (
              <div className="h-14 w-14 rounded-md bg-white/10 border border-border/40 flex items-center justify-center overflow-hidden shrink-0">
                <img src={profile.logo} alt={stockInfo.name} className="h-10 w-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            ) : (
              <div className="h-14 w-14 rounded-md bg-muted/50 border border-border/40 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-muted-foreground">{symbol.slice(0, 2)}</span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-1 mb-1 flex-wrap">
                <h1 className="text-xs font-bold tracking-tight font-mono neon-text">{symbol}</h1>
                <Badge variant="outline" className={`text-xs font-mono ${stockInfo.exchange === "ADX" ? "border-primary/40 text-primary" : "border-chart-2/40 text-chart-2"}`}>
                  {stockInfo.exchange}
                </Badge>
                <Badge variant="secondary" className="text-xs">{stockInfo.sector}</Badge>
                {profile?.industry && <Badge variant="outline" className="text-xs text-muted-foreground">{profile.industry}</Badge>}
                <MarketStatusBadge />
                <RealtimeIndicator isConnected={wsConnected} />
              </div>
              <p className="text-muted-foreground text-[11px]">{stockInfo.name}</p>
              {profile?.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                  <Globe className="h-3 w-3" /> {profile.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
          {detail && (
            <div className="flex items-end gap-1">
              <span className="text-[11px] font-bold font-mono neon-text">{price != null ? formatNumber(price) : "—"}</span>
              <span className="text-[11px] text-muted-foreground mb-1">AED</span>
              {priceChange != null && (
                <span className={`flex items-center gap-1 text-[11px] font-semibold font-mono mb-0.5 ${priceChange > 0 ? "text-gain neon-text-gain" : priceChange < 0 ? "text-loss neon-text-loss" : "text-muted-foreground"}`}>
                  {priceChange > 0 ? <ArrowUp className="h-4 w-4" /> : priceChange < 0 ? <ArrowDown className="h-4 w-4" /> : null}
                  {priceChange > 0 ? "+" : ""}{priceChange.toFixed(3)}%
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50 flex-wrap">
          <TabsTrigger value="overview" className="text-xs gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="orderbook" className="text-xs gap-1.5"><BookOpenCheck className="h-3.5 w-3.5" /> Order Book</TabsTrigger>
          <TabsTrigger value="technicals" className="text-xs gap-1.5"><Activity className="h-3.5 w-3.5" /> Technicals</TabsTrigger>
          <TabsTrigger value="financials" className="text-xs gap-1.5"><FileText className="h-3.5 w-3.5" /> Financials</TabsTrigger>
          <TabsTrigger value="news" className="text-xs gap-1.5"><Newspaper className="h-3.5 w-3.5" /> News</TabsTrigger>
          <TabsTrigger value="forecasts" className="text-xs gap-1.5"><Target className="h-3.5 w-3.5" /> Forecasts</TabsTrigger>
          <TabsTrigger value="seasonals" className="text-xs gap-1.5"><Calendar className="h-3.5 w-3.5" /> Seasonals</TabsTrigger>
          <TabsTrigger value="profile" className="text-xs gap-1.5"><Building2 className="h-3.5 w-3.5" /> Profile</TabsTrigger>
          <TabsTrigger value="transcripts" className="text-xs gap-1.5"><FileText className="h-3.5 w-3.5" /> Transcripts</TabsTrigger>
          <TabsTrigger value="analysis" className="text-xs gap-1.5"><Brain className="h-3.5 w-3.5" /> AI Analysis</TabsTrigger>
        </TabsList>

        {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
        <TabsContent value="overview" className="space-y-2 mt-4">
          {/* Advanced Price Chart with Technical Overlays */}
          <AdvancedChart
            symbol={symbol}
            exchange={stockInfo?.exchange as "ADX" | "DFM" || "DFM"}
            chartData={chartPoints}
            chartRange={chartRange}
            onRangeChange={(r) => setChartRange(r as any)}
            chartLoading={chartLoading}
          />

          {/* Analyst Consensus + Key Metrics + Quick Technical */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            {/* Analyst Consensus Widget */}
            {profile && (profile.targetMeanPrice != null || profile.recommendationKey != null || profile.tvRecommendation != null) && (
              <div className="lg:col-span-3">
                <AnalystConsensus
                  recommendation={profile.tvRecommendation ?? (profile.recommendationMean != null ? ((5 - profile.recommendationMean) / 2 - 1) : null)}
                  totalAnalysts={profile.numberOfAnalystOpinions ?? null}
                  strongBuy={profile.recommendations?.[0]?.strongBuy ?? null}
                  buy={profile.recommendations?.[0]?.buy ?? null}
                  hold={profile.recommendations?.[0]?.hold ?? null}
                  sell={profile.recommendations?.[0]?.sell ?? null}
                  strongSell={profile.recommendations?.[0]?.strongSell ?? null}
                  targetLow={profile.targetLowPrice ?? null}
                  targetHigh={profile.targetHighPrice ?? null}
                  targetMean={profile.targetMeanPrice ?? profile.targetMedianPrice ?? null}
                  targetMedian={profile.targetMedianPrice ?? null}
                  currentPrice={price}
                  symbol={symbol}
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            <Card className="border-border/50 lg:col-span-2">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" /> Key Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {detailLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-16 rounded" />)}</div>
                ) : detail ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-1">
                    <MetricCard label="Open" value={formatNumber(detail.open)} icon={Target} />
                    <MetricCard label="Day High" value={formatNumber(detail.dayHigh)} icon={ArrowUp} />
                    <MetricCard label="Day Low" value={formatNumber(detail.dayLow)} icon={ArrowDown} />
                    <MetricCard label="Prev Close" value={formatNumber(detail.previousClose)} icon={DollarSign} />
                    <MetricCard label="Volume" value={formatLargeNumber(detail.volume)} icon={BarChart3} />
                    <MetricCard label="Avg Vol (10d)" value={formatLargeNumber(profile?.tvAvgVolume10d ?? detail.avgVolume)} icon={Activity} />
                    <MetricCard label="Market Cap" value={formatLargeNumber(detail.marketCap || profile?.marketCap)} icon={DollarSign} />
                    <MetricCard label="P/E Ratio" value={formatNumber(detail.pe || profile?.trailingPE, 1)} icon={Gauge} />
                    <MetricCard label="EPS" value={formatNumber(detail.eps || profile?.trailingEps)} icon={TrendingUp} />
                    <MetricCard label="52W High" value={formatNumber(detail.week52High || profile?.fiftyTwoWeekHigh)} icon={ArrowUp} />
                    <MetricCard label="52W Low" value={formatNumber(detail.week52Low || profile?.fiftyTwoWeekLow)} icon={ArrowDown} />
                    <MetricCard label="Div Yield" value={detail.dividendYield != null ? detail.dividendYield.toFixed(2) + "%" : profile?.tvDividendYield ? formatPercent(profile.tvDividendYield) : "—"} icon={DollarSign} />
                    <MetricCard label="Beta" value={formatNumber(profile?.tvBeta ?? detail.beta, 2)} icon={Activity} />
                    <MetricCard label="Shares Out" value={formatLargeNumber(profile?.tvSharesOutstanding ?? profile?.sharesOutstanding)} icon={Hash} />
                    <MetricCard label="EV" value={formatLargeNumber(profile?.tvEnterpriseValue)} icon={Layers} />
                    <MetricCard label="P/B Ratio" value={formatNumber(profile?.priceToBook, 2)} icon={BookOpen} />
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No data available</p>
                )}
              </CardContent>
            </Card>

            {/* Quick Technical Snapshot */}
            <Card className="border-border/50">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Technical Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {detailLoading ? (
                  <div className="space-y-1.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}</div>
                ) : detail ? (
                  <>
                    <RSIGauge value={detail.rsi} />
                    {profile?.tvRecommendation != null && (
                      <RecommendationGauge value={profile.tvRecommendation} label="Overall Rating" />
                    )}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-2 rounded bg-secondary/30">
                        <span className="text-xs text-muted-foreground">SMA 20</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium">{detail.sma20 != null ? formatNumber(detail.sma20, 3) : "—"}</span>
                          {detail.price != null && detail.sma20 != null && (
                            <span className={`text-[10px] font-medium ${detail.price > detail.sma20 ? "text-gain" : "text-loss"}`}>
                              {detail.price > detail.sma20 ? "Above" : "Below"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded bg-secondary/30">
                        <span className="text-xs text-muted-foreground">SMA 50</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium">{detail.sma50 != null ? formatNumber(detail.sma50, 3) : "—"}</span>
                          {detail.price != null && detail.sma50 != null && (
                            <span className={`text-[10px] font-medium ${detail.price > detail.sma50 ? "text-gain" : "text-loss"}`}>
                              {detail.price > detail.sma50 ? "Above" : "Below"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded bg-secondary/30">
                        <span className="text-xs text-muted-foreground">SMA 200</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium">{(detail as any).sma200 != null ? formatNumber((detail as any).sma200, 3) : (profile?.tvSMA200 != null ? formatNumber(profile.tvSMA200, 3) : "—")}</span>
                          {detail.price != null && ((detail as any).sma200 != null || profile?.tvSMA200 != null) && (
                            <span className={`text-[10px] font-medium ${detail.price > ((detail as any).sma200 ?? profile?.tvSMA200 ?? 0) ? "text-gain" : "text-loss"}`}>
                              {detail.price > ((detail as any).sma200 ?? profile?.tvSMA200 ?? 0) ? "Above" : "Below"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded bg-secondary/30">
                        <span className="text-xs text-muted-foreground">MACD</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium">{(detail as any).macdValue != null ? formatNumber((detail as any).macdValue, 4) : (profile?.tvMACD != null ? formatNumber(profile.tvMACD, 4) : "—")}</span>
                          {((detail as any).macdValue != null || profile?.tvMACD != null) && ((detail as any).macdSignal != null || profile?.tvMACDSignal != null) && (
                            <span className={`text-[10px] font-medium ${
                              ((detail as any).macdValue ?? profile?.tvMACD ?? 0) > ((detail as any).macdSignal ?? profile?.tvMACDSignal ?? 0) ? "text-gain" : "text-loss"
                            }`}>
                              {((detail as any).macdValue ?? profile?.tvMACD ?? 0) > ((detail as any).macdSignal ?? profile?.tvMACDSignal ?? 0) ? "Bullish" : "Bearish"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded bg-secondary/30">
                        <span className="text-xs text-muted-foreground">MACD Signal</span>
                        <span className="font-mono text-xs font-medium">{(detail as any).macdSignal != null ? formatNumber((detail as any).macdSignal, 4) : (profile?.tvMACDSignal != null ? formatNumber(profile.tvMACDSignal, 4) : "—")}</span>
                      </div>
                      {detail.price != null && detail.sma50 != null && (
                        <div className={`p-2.5 rounded border ${detail.price > detail.sma50 ? "border-[oklch(0.72_0.17_155/30%)] bg-[oklch(0.72_0.17_155/5%)]" : "border-[oklch(0.65_0.22_25/30%)] bg-[oklch(0.65_0.22_25/5%)]"}`}>
                          <div className="flex items-center gap-2">
                            {detail.price > detail.sma50 ? <TrendingUp className="h-3.5 w-3.5 text-gain" /> : <TrendingDown className="h-3.5 w-3.5 text-loss" />}
                            <span className={`text-xs font-medium ${detail.price > detail.sma50 ? "text-gain" : "text-loss"}`}>
                              Price ({formatNumber(detail.price, 3)}) is {detail.price > detail.sma50 ? "above" : "below"} SMA 50 ({formatNumber(detail.sma50, 3)})
                            </span>
                          </div>
                          {detail.sma20 != null && (
                            <div className="flex items-center gap-2 mt-1">
                              {detail.price > detail.sma20 ? <TrendingUp className="h-3.5 w-3.5 text-gain" /> : <TrendingDown className="h-3.5 w-3.5 text-loss" />}
                              <span className={`text-xs font-medium ${detail.price > detail.sma20 ? "text-gain" : "text-loss"}`}>
                                Price is {detail.price > detail.sma20 ? "above" : "below"} SMA 20 ({formatNumber(detail.sma20, 3)})
                              </span>
                            </div>
                          )}
                          {((detail as any).sma200 != null || profile?.tvSMA200 != null) && (
                            <div className="flex items-center gap-2 mt-1">
                              {detail.price! > ((detail as any).sma200 ?? profile?.tvSMA200 ?? 0) ? <TrendingUp className="h-3.5 w-3.5 text-gain" /> : <TrendingDown className="h-3.5 w-3.5 text-loss" />}
                              <span className={`text-xs font-medium ${detail.price! > ((detail as any).sma200 ?? profile?.tvSMA200 ?? 0) ? "text-gain" : "text-loss"}`}>
                                Price is {detail.price! > ((detail as any).sma200 ?? profile?.tvSMA200 ?? 0) ? "above" : "below"} SMA 200 ({formatNumber((detail as any).sma200 ?? profile?.tvSMA200, 3)})
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No data</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Performance & Volatility */}
          {profile && (profile.tvPerfWeek != null || profile.tvPerfMonth != null) && (
            <Card className="border-border/50">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Performance & Volatility
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-1">
                  {[
                    { label: "1 Week", val: profile.tvPerfWeek, perf: true },
                    { label: "1 Month", val: profile.tvPerfMonth, perf: true },
                    { label: "3 Months", val: profile.tvPerf3Month, perf: true },
                    { label: "6 Months", val: profile.tvPerf6Month, perf: true },
                    { label: "YTD", val: profile.tvPerfYTD, perf: true },
                    { label: "1 Year", val: profile.tvPerfYear, perf: true },
                    { label: "5 Year", val: profile.tvPerf5Year, perf: true },
                    { label: "All Time", val: profile.tvPerfAllTime, perf: true },
                    { label: "Vol (Day)", val: profile.tvVolatilityDay, perf: false },
                    { label: "Vol (Week)", val: profile.tvVolatilityWeek, perf: false },
                    { label: "Vol (Month)", val: profile.tvVolatilityMonth, perf: false },
                    { label: "ATR", val: profile.tvATR, perf: false },
                    { label: "Beta", val: profile.tvBeta, perf: false },
                  ].map(({ label, val, perf }) => (
                    <div key={label} className="p-3 rounded bg-secondary/30 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                      <p className={`text-[11px] font-bold font-mono ${
                        !perf ? "text-foreground" :
                        val != null && val > 0 ? "text-gain" : val != null && val < 0 ? "text-loss" : "text-muted-foreground"
                      }`}>
                        {val != null ? (perf ? formatRawPercent(val) : (label === "ATR" || label === "Beta" ? formatNumber(val, 2) : val.toFixed(2) + "%")) : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Key Statistics */}
          {profile && (
            <Card className="border-border/50">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-primary" /> Key Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                  {/* Valuation */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Valuation</h4>
                    <div className="space-y-0.5">
                      <DataRow label="Market Cap" value={formatLargeNumber(profile.marketCap)} highlight />
                      <DataRow label="Enterprise Value" value={formatLargeNumber(profile.tvEnterpriseValue ?? profile.enterpriseValue)} />
                      <DataRow label="Trailing P/E" value={formatNumber(profile.trailingPE, 1)} />
                      <DataRow label="Forward P/E" value={formatNumber(profile.forwardPE, 1)} />
                      <DataRow label="PEG Ratio" value={formatNumber(profile.pegRatio, 2)} />
                      <DataRow label="Price/Sales" value={formatNumber(profile.priceToSales, 2)} />
                      <DataRow label="Price/Book" value={formatNumber(profile.priceToBook, 2)} />
                      <DataRow label="Price/FCF" value={formatNumber(profile.tvPriceToFreeCashFlow, 2)} />
                      <DataRow label="EV/Revenue" value={formatNumber(profile.evToRevenue, 2)} />
                      <DataRow label="EV/EBITDA" value={formatNumber(profile.tvEVToEBITDA ?? profile.evToEbitda, 2)} />
                    </div>
                  </div>
                  {/* Profitability */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Profitability</h4>
                    <div className="space-y-0.5">
                      <DataRow label="Revenue" value={formatLargeNumber(profile.tvTotalRevenue ?? profile.totalRevenue)} highlight />
                      <DataRow label="Revenue Growth" value={formatPercent(profile.revenueGrowth)} />
                      <DataRow label="Gross Margin" value={formatPercent(profile.tvGrossMargin ?? profile.grossMargin)} />
                      <DataRow label="EBITDA Margin" value={formatPercent(profile.ebitdaMargin)} />
                      <DataRow label="Operating Margin" value={formatPercent(profile.tvOperatingMargin ?? profile.operatingMargin)} />
                      <DataRow label="Pre-Tax Margin" value={formatPercent(profile.tvPreTaxMargin)} />
                      <DataRow label="Net Margin" value={formatPercent(profile.tvNetMargin ?? profile.profitMargin)} />
                      <DataRow label="ROE" value={formatPercent(profile.tvROE ?? profile.returnOnEquity)} />
                      <DataRow label="ROA" value={formatPercent(profile.tvROA ?? profile.returnOnAssets)} />
                      <DataRow label="ROIC" value={formatPercent(profile.tvROIC)} />
                    </div>
                  </div>
                  {/* Financial Health */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Financial Health</h4>
                    <div className="space-y-0.5">
                      <DataRow label="Total Cash" value={formatLargeNumber(profile.totalCash)} highlight />
                      <DataRow label="Total Debt" value={formatLargeNumber(profile.tvTotalDebt ?? profile.totalDebt)} />
                      <DataRow label="Total Assets" value={formatLargeNumber(profile.tvTotalAssets)} />
                      <DataRow label="Total Liabilities" value={formatLargeNumber(profile.tvTotalLiabilities)} />
                      <DataRow label="Total Equity" value={formatLargeNumber(profile.tvTotalEquity)} />
                      <DataRow label="Debt/Equity" value={formatNumber(profile.tvDebtToEquity ?? profile.debtToEquity, 1)} />
                      <DataRow label="Current Ratio" value={formatNumber(profile.tvCurrentRatio ?? profile.currentRatio, 2)} />
                      <DataRow label="Quick Ratio" value={formatNumber(profile.tvQuickRatio ?? profile.quickRatio, 2)} />
                      <DataRow label="Book Value" value={formatNumber(profile.bookValue)} />
                    </div>
                  </div>
                  {/* Per Share & Trading */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Per Share & Trading</h4>
                    <div className="space-y-0.5">
                      <DataRow label="EPS (TTM)" value={formatNumber(profile.tvEPS ?? profile.trailingEps)} highlight />
                      <DataRow label="EPS Diluted" value={formatNumber(profile.tvEPSDiluted)} />
                      <DataRow label="EPS Forecast" value={formatNumber(profile.tvEPSForecast)} />
                      <DataRow label="Forward EPS" value={formatNumber(profile.forwardEps)} />
                      <DataRow label="Revenue/Share" value={formatNumber(profile.revenuePerShare)} />
                      <DataRow label="Free Cash Flow" value={formatLargeNumber(profile.tvFreeCashFlow ?? profile.freeCashflow)} />
                      <DataRow label="Op Cash Flow" value={formatLargeNumber(profile.operatingCashflow)} />
                      <DataRow label="EBITDA" value={formatLargeNumber(profile.tvEBITDA)} />
                      <DataRow label="Shares Out" value={formatLargeNumber(profile.tvSharesOutstanding ?? profile.sharesOutstanding)} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════════ TECHNICALS TAB ═══════════════ */}
        <TabsContent value="technicals" className="space-y-2 mt-4">
          {/* TwelveData Real Technical Analysis */}
          <TechnicalAnalysisTab
            symbol={symbol}
            exchange={stockInfo?.exchange as "ADX" | "DFM" || "DFM"}
            currentPrice={price ?? 0}
          />

          {/* Volume Analysis from TradingView */}
          {profile && (
            <Card className="border-border/50">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Volume Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
                  <div className="p-3 rounded bg-secondary/30 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Current</p>
                    <p className="text-[11px] font-bold font-mono">{formatLargeNumber(detail?.volume)}</p>
                  </div>
                  <div className="p-3 rounded bg-secondary/30 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg 10d</p>
                    <p className="text-[11px] font-bold font-mono">{formatLargeNumber(profile.tvAvgVolume10d)}</p>
                  </div>
                  <div className="p-3 rounded bg-secondary/30 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg 30d</p>
                    <p className="text-[11px] font-bold font-mono">{formatLargeNumber(profile.tvAvgVolume30d)}</p>
                  </div>
                  <div className="p-3 rounded bg-secondary/30 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg 90d</p>
                    <p className="text-[11px] font-bold font-mono">{formatLargeNumber(profile.tvAvgVolume90d)}</p>
                  </div>
                </div>
                {detail?.volume != null && profile.tvAvgVolume30d != null && profile.tvAvgVolume30d > 0 && (
                  <div className={`mt-3 p-2.5 rounded border ${detail.volume > profile.tvAvgVolume30d * 1.5 ? "border-primary/30 bg-primary/5" : "border-border/30 bg-secondary/10"}`}>
                    <p className="text-xs text-muted-foreground">
                      Volume is <span className="font-mono font-semibold text-foreground">{(detail.volume / profile.tvAvgVolume30d).toFixed(2)}x</span> the 30-day average
                      {detail.volume > profile.tvAvgVolume30d * 2 && <span className="text-primary ml-1">(Unusual activity)</span>}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════════ FINANCIALS TAB ═══════════════ */}
        <TabsContent value="financials" className="space-y-2 mt-4">
          {/* TradingView Extended Financials (always shown) */}
          <StockFinancialsExtended symbol={symbol} />

          {profileLoading ? (
            <div className="space-y-1.5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded" />)}</div>
          ) : profile ? (
            <>
              {/* Income / Balance / Cash Flow from Yahoo */}
              {profile.incomeStatement && profile.incomeStatement.length > 0 && (
                <FinancialTable title="Income Statement (Annual)" data={profile.incomeStatement} icon={FileText} />
              )}
              {profile.balanceSheet && profile.balanceSheet.length > 0 && (
                <FinancialTable title="Balance Sheet (Annual)" data={profile.balanceSheet} icon={BookOpen} />
              )}
              {profile.cashFlow && profile.cashFlow.length > 0 && (
                <FinancialTable title="Cash Flow Statement (Annual)" data={profile.cashFlow} icon={DollarSign} />
              )}
              {profile.earnings && profile.earnings.length > 0 && (
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[11px] font-semibold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" /> Earnings History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/40 bg-muted/20">
                            <th className="text-left p-2 pl-4 font-medium text-muted-foreground">Quarter</th>
                            <th className="text-right p-2 font-medium text-muted-foreground">EPS Actual</th>
                            <th className="text-right p-2 font-medium text-muted-foreground">EPS Estimate</th>
                            <th className="text-right p-2 pr-4 font-medium text-muted-foreground">Surprise</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.earnings.map((e: any, i: number) => (
                            <tr key={i} className="border-b border-border/20 hover:bg-muted/10">
                              <td className="p-2 pl-4 font-mono">{e.quarter || e.date || `Q${i + 1}`}</td>
                              <td className="p-2 text-right font-mono">{formatNumber(e.actual)}</td>
                              <td className="p-2 text-right font-mono">{formatNumber(e.estimate)}</td>
                              <td className={`p-2 pr-4 text-right font-mono font-medium ${e.surprise > 0 ? "text-gain" : e.surprise < 0 ? "text-loss" : ""}`}>
                                {e.surprise != null ? (e.surprise > 0 ? "+" : "") + formatNumber(e.surprise) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* TradingView Financial Summary (fallback when Yahoo has no statements) */}
              {(!profile.incomeStatement || profile.incomeStatement.length === 0) &&
               (!profile.balanceSheet || profile.balanceSheet.length === 0) &&
               (!profile.cashFlow || profile.cashFlow.length === 0) && (
                <>
                  {(profile.tvNetIncome != null || profile.tvEBITDA != null || profile.tvTotalAssets != null) ? (
                    <Card className="border-border/50">
                      <CardHeader className="pb-1">
                        <CardTitle className="text-xs font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" /> Financial Summary
                          <Badge variant="outline" className="text-[10px] ml-2">TradingView</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Income</h4>
                            <div className="space-y-1">
                              <DataRow label="Total Revenue" value={formatLargeNumber(profile.tvTotalRevenue ?? profile.totalRevenue)} highlight />
                              <DataRow label="Gross Profit" value={formatLargeNumber(profile.tvGrossProfit)} />
                              <DataRow label="EBITDA" value={formatLargeNumber(profile.tvEBITDA)} />
                              <DataRow label="Net Income" value={formatLargeNumber(profile.tvNetIncome)} />
                              <DataRow label="EPS" value={formatNumber(profile.tvEPS ?? profile.trailingEps)} />
                              <DataRow label="EPS Diluted" value={formatNumber(profile.tvEPSDiluted)} />
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Balance Sheet</h4>
                            <div className="space-y-1">
                              <DataRow label="Total Assets" value={formatLargeNumber(profile.tvTotalAssets)} highlight />
                              <DataRow label="Total Liabilities" value={formatLargeNumber(profile.tvTotalLiabilities)} />
                              <DataRow label="Total Equity" value={formatLargeNumber(profile.tvTotalEquity)} />
                              <DataRow label="Current Assets" value={formatLargeNumber(profile.tvTotalCurrentAssets)} />
                              <DataRow label="Total Debt" value={formatLargeNumber(profile.tvTotalDebt ?? profile.totalDebt)} />
                              <DataRow label="Debt/Equity" value={formatNumber(profile.tvDebtToEquity ?? profile.debtToEquity, 2)} />
                              <DataRow label="Current Ratio" value={formatNumber(profile.tvCurrentRatio ?? profile.currentRatio, 2)} />
                              <DataRow label="Quick Ratio" value={formatNumber(profile.tvQuickRatio ?? profile.quickRatio, 2)} />
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Margins & Returns</h4>
                            <div className="space-y-1">
                              <DataRow label="Gross Margin" value={formatPercent(profile.tvGrossMargin ?? profile.grossMargin)} />
                              <DataRow label="Operating Margin" value={formatPercent(profile.tvOperatingMargin ?? profile.operatingMargin)} />
                              <DataRow label="Pre-Tax Margin" value={formatPercent(profile.tvPreTaxMargin)} />
                              <DataRow label="Net Margin" value={formatPercent(profile.tvNetMargin ?? profile.profitMargin)} />
                              <DataRow label="ROE" value={formatPercent(profile.tvROE ?? profile.returnOnEquity)} />
                              <DataRow label="ROA" value={formatPercent(profile.tvROA ?? profile.returnOnAssets)} />
                              <DataRow label="ROIC" value={formatPercent(profile.tvROIC)} />
                              <DataRow label="Free Cash Flow" value={formatLargeNumber(profile.tvFreeCashFlow ?? profile.freeCashflow)} />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-border/50">
                      <CardContent className="py-12 text-center">
                        <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground">Financial statements are not available for this stock.</p>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {/* Dividends Section */}
              {(profile.dividendRate || profile.tvDividendYield || profile.tvDividendPerShare || profile.exDividendDate) && (
                <Card className="border-border/50">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" /> Dividend Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                      <div className="p-3 rounded bg-secondary/30">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Annual Rate</p>
                        <p className="text-[11px] font-bold font-mono">{profile.dividendRate ? formatNumber(profile.dividendRate) + " AED" : "—"}</p>
                      </div>
                      <div className="p-3 rounded bg-secondary/30">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Yield</p>
                        <p className="text-[11px] font-bold font-mono">{profile.tvDividendYield ? formatPercent(profile.tvDividendYield) : profile.dividendYield ? formatPercent(profile.dividendYield) : "—"}</p>
                      </div>
                      <div className="p-3 rounded bg-secondary/30">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Per Share</p>
                        <p className="text-[11px] font-bold font-mono">{profile.tvDividendPerShare ? formatNumber(profile.tvDividendPerShare) + " AED" : "—"}</p>
                      </div>
                      <div className="p-3 rounded bg-secondary/30">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Payout Ratio</p>
                        <p className="text-[11px] font-bold font-mono">{profile.payoutRatio ? formatPercent(profile.payoutRatio) : "—"}</p>
                      </div>
                    </div>
                    {profile.exDividendDate && (
                      <div className="mt-3 p-2.5 rounded bg-primary/5 border border-primary/20">
                        <p className="text-xs text-muted-foreground">Ex-Dividend Date: <span className="font-mono font-semibold text-foreground">{profile.exDividendDate}</span></p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Financial data is not available for this stock.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════════ ORDER BOOK TAB ═══════════════ */}
        <TabsContent value="orderbook" className="space-y-2 mt-4">
          {detail && (
            <>
              <PriceBook
                symbol={symbol}
                exchange={stockInfo?.exchange as "ADX" | "DFM" || "DFM"}
                price={detail.price}
                change={detail.changePercent}
                volume={detail.volume}
                high={detail.dayHigh}
                low={detail.dayLow}
              />
              <OrderBook
                symbol={symbol}
                exchange={stockInfo?.exchange as "ADX" | "DFM" || "DFM"}
                price={detail.price}
                change={detail.changePercent}
                volume={detail.volume}
                high={detail.dayHigh}
                low={detail.dayLow}
                open={detail.open}
                previousClose={detail.previousClose}
              />
            </>
          )}
        </TabsContent>

        {/* ═══════════════ NEWS TAB ═══════════════ */}
        <TabsContent value="news" className="space-y-2 mt-4">
          <StockNewsTab symbol={symbol} />
        </TabsContent>

        {/* ═══════════════ FORECASTS TAB ═══════════════ */}
        <TabsContent value="forecasts" className="space-y-2 mt-4">
          <StockForecastsTab symbol={symbol} currentPrice={price} />
        </TabsContent>

        {/* ═══════════════ SEASONALS TAB ═══════════════ */}
        <TabsContent value="seasonals" className="space-y-2 mt-4">
          <StockSeasonalsTab symbol={symbol} />
        </TabsContent>

        {/* ═══════════════ PROFILE TAB ═══════════════ */}
        <TabsContent value="profile" className="space-y-2 mt-4">
          {profileLoading ? (
            <div className="space-y-1.5"><Skeleton className="h-48 rounded" /><Skeleton className="h-32 rounded" /></div>
          ) : profile ? (
            <>
              {/* Quick Nav for Profile Sections */}
              <div className="flex items-center gap-1 flex-wrap p-1.5 bg-secondary/20 rounded-lg border border-border/30">
                {["About", "Financials", "Officers", "Analysts", "Holdings"].map(section => (
                  <Button
                    key={section}
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-[9px] text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      const el = document.getElementById(`profile-${section.toLowerCase()}`);
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    {section}
                  </Button>
                ))}
              </div>

              {/* Company Info */}
              <Card id="profile-about" className="border-border/50">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" /> About {stockInfo.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {profile.description && profile.description !== stockInfo.name && (
                    <>
                      <p className="text-[11px] text-foreground/80 leading-relaxed">{profile.description}</p>
                      <Separator className="my-4" />
                    </>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 text-[11px]">
                    {profile.sector && <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Sector</p><p className="font-medium">{profile.sector}</p></div>}
                    {profile.industry && <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Industry</p><p className="font-medium">{profile.industry}</p></div>}
                    {(profile.tvEmployees || profile.fullTimeEmployees) && <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Employees</p><p className="font-medium">{(profile.tvEmployees || profile.fullTimeEmployees)?.toLocaleString()}</p></div>}
                    {profile.country && <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Country</p><p className="font-medium">{profile.country}</p></div>}
                    {profile.city && <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">City</p><p className="font-medium">{profile.city}</p></div>}
                    {profile.phone && <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Phone</p><p className="font-medium">{profile.phone}</p></div>}
                    <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Exchange</p><p className="font-medium">{stockInfo.exchange}</p></div>
                    <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Symbol</p><p className="font-medium">{symbol}</p></div>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Snapshot */}
              <Card id="profile-financials" className="border-border/50">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" /> Financial Snapshot
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
                    {profile.marketCap && <div className="p-3 rounded bg-secondary/30"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Market Cap</p><p className="text-[11px] font-bold font-mono">{formatLargeNumber(profile.marketCap)}</p></div>}
                    {profile.trailingPE && <div className="p-3 rounded bg-secondary/30"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">P/E Ratio</p><p className="text-[11px] font-bold font-mono">{formatNumber(profile.trailingPE, 1)}</p></div>}
                    {profile.trailingEps && <div className="p-3 rounded bg-secondary/30"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">EPS</p><p className="text-[11px] font-bold font-mono">{formatNumber(profile.trailingEps)}</p></div>}
                    {(profile.dividendYield || profile.tvDividendYield) && <div className="p-3 rounded bg-secondary/30"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Div Yield</p><p className="text-[11px] font-bold font-mono">{formatPercent(profile.dividendYield || profile.tvDividendYield)}</p></div>}
                    {profile.returnOnEquity && <div className="p-3 rounded bg-secondary/30"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">ROE</p><p className="text-[11px] font-bold font-mono">{formatPercent(profile.returnOnEquity)}</p></div>}
                    {profile.debtToEquity && <div className="p-3 rounded bg-secondary/30"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Debt/Equity</p><p className="text-[11px] font-bold font-mono">{formatNumber(profile.debtToEquity, 2)}</p></div>}
                    {profile.currentRatio && <div className="p-3 rounded bg-secondary/30"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Current Ratio</p><p className="text-[11px] font-bold font-mono">{formatNumber(profile.currentRatio, 2)}</p></div>}
                    {profile.beta && <div className="p-3 rounded bg-secondary/30"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Beta</p><p className="text-[11px] font-bold font-mono">{formatNumber(profile.beta, 2)}</p></div>}
                  </div>
                  {/* Profitability Metrics */}
                  {(profile.tvGrossMargin != null || profile.tvOperatingMargin != null || profile.tvNetMargin != null) && (
                    <>
                      <Separator className="my-3" />
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Profitability</h4>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-1">
                        {profile.tvGrossMargin != null && <div className="p-2 rounded bg-secondary/20 text-center"><p className="text-[9px] text-muted-foreground">Gross Margin</p><p className="text-[11px] font-bold font-mono">{(profile.tvGrossMargin * 100).toFixed(1)}%</p></div>}
                        {profile.tvOperatingMargin != null && <div className="p-2 rounded bg-secondary/20 text-center"><p className="text-[9px] text-muted-foreground">Op. Margin</p><p className="text-[11px] font-bold font-mono">{(profile.tvOperatingMargin * 100).toFixed(1)}%</p></div>}
                        {profile.tvNetMargin != null && <div className="p-2 rounded bg-secondary/20 text-center"><p className="text-[9px] text-muted-foreground">Net Margin</p><p className="text-[11px] font-bold font-mono">{(profile.tvNetMargin * 100).toFixed(1)}%</p></div>}
                        {profile.tvROA != null && <div className="p-2 rounded bg-secondary/20 text-center"><p className="text-[9px] text-muted-foreground">ROA</p><p className="text-[11px] font-bold font-mono">{(profile.tvROA * 100).toFixed(1)}%</p></div>}
                        {profile.tvROE != null && <div className="p-2 rounded bg-secondary/20 text-center"><p className="text-[9px] text-muted-foreground">ROE</p><p className="text-[11px] font-bold font-mono">{(profile.tvROE * 100).toFixed(1)}%</p></div>}
                        {profile.tvROIC != null && <div className="p-2 rounded bg-secondary/20 text-center"><p className="text-[9px] text-muted-foreground">ROIC</p><p className="text-[11px] font-bold font-mono">{(profile.tvROIC * 100).toFixed(1)}%</p></div>}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Officers */}
              {profile.officers && profile.officers.length > 0 && (
                <Card id="profile-officers" className="border-border/50">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" /> Key Officers & Board
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                      {profile.officers.map((officer: any, i: number) => (
                        <div key={i} className="flex items-start gap-1 p-3 rounded bg-secondary/20 border border-border/20">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Briefcase className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold truncate">{officer.name}</p>
                            <p className="text-xs text-muted-foreground">{officer.title}</p>
                            {officer.age && <p className="text-[11px] text-muted-foreground mt-0.5">Age: {officer.age}</p>}
                            {officer.totalPay && <p className="text-[11px] text-muted-foreground">Compensation: {formatLargeNumber(officer.totalPay)}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Analyst Recommendations */}
              {profile.recommendations && profile.recommendations.length > 0 && (
                <Card id="profile-analysts" className="border-border/50">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" /> Analyst Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/40 bg-muted/20">
                            <th className="text-left p-2 pl-4 font-medium text-muted-foreground">Period</th>
                            <th className="text-center p-2 font-medium text-gain">Strong Buy</th>
                            <th className="text-center p-2 font-medium text-[oklch(0.72_0.17_155/80%)]">Buy</th>
                            <th className="text-center p-2 font-medium text-muted-foreground">Hold</th>
                            <th className="text-center p-2 font-medium text-[oklch(0.65_0.22_25/80%)]">Sell</th>
                            <th className="text-center p-2 pr-4 font-medium text-loss">Strong Sell</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.recommendations.slice(0, 4).map((rec: any, i: number) => (
                            <tr key={i} className="border-b border-border/20 hover:bg-muted/10">
                              <td className="p-2 pl-4 font-mono">{rec.period || `Period ${i + 1}`}</td>
                              <td className="p-2 text-center font-mono font-medium text-gain">{rec.strongBuy || 0}</td>
                              <td className="p-2 text-center font-mono">{rec.buy || 0}</td>
                              <td className="p-2 text-center font-mono">{rec.hold || 0}</td>
                              <td className="p-2 text-center font-mono">{rec.sell || 0}</td>
                              <td className="p-2 pr-4 text-center font-mono font-medium text-loss">{rec.strongSell || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {profile.targetMeanPrice && (
                      <div className="mt-4 p-3 rounded bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="text-muted-foreground">Analyst Target Price:</span>
                          <span className="font-mono font-bold text-primary">{formatNumber(profile.targetMeanPrice)} AED</span>
                          {profile.targetHighPrice && (
                            <span className="text-xs text-muted-foreground">(High: {formatNumber(profile.targetHighPrice)} / Low: {formatNumber(profile.targetLowPrice)})</span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Insider Holdings */}
              {profile.insiderHolders && profile.insiderHolders.length > 0 && (
                <Card id="profile-holdings" className="border-border/50">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" /> Insider Holdings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 mb-1">
                      {profile.heldPercentInsiders != null && (
                        <div className="p-3 rounded bg-secondary/30">
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Insiders</p>
                          <p className="text-[11px] font-bold font-mono">{formatPercent(profile.heldPercentInsiders)}</p>
                        </div>
                      )}
                      {profile.heldPercentInstitutions != null && (
                        <div className="p-3 rounded bg-secondary/30">
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Institutions</p>
                          <p className="text-[11px] font-bold font-mono">{formatPercent(profile.heldPercentInstitutions)}</p>
                        </div>
                      )}
                      {profile.floatShares != null && (
                        <div className="p-3 rounded bg-secondary/30">
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Float</p>
                          <p className="text-[11px] font-bold font-mono">{formatLargeNumber(profile.floatShares)}</p>
                        </div>
                      )}
                      {profile.shortRatio != null && (
                        <div className="p-3 rounded bg-secondary/30">
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Short Ratio</p>
                          <p className="text-[11px] font-bold font-mono">{formatNumber(profile.shortRatio, 2)}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {!profile.description && (!profile.officers || profile.officers.length === 0) && (
                <Card className="border-border/50">
                  <CardContent className="py-12 text-center">
                    <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Company profile data is not available for this stock.</p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Profile data is not available for this stock.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════════ TRANSCRIPTS TAB ═══════════════ */}
        <TabsContent value="transcripts" className="space-y-2 mt-4">
          <EarningsTranscripts symbol={symbol} companyName={stockInfo?.name} />
        </TabsContent>

        {/* ═══════════════ AI ANALYSIS TAB ═══════════════ */}
        <TabsContent value="analysis" className="space-y-2 mt-4">
          {/* Snowflake Score Overview */}
          {snowflakeLoading ? (
            <Card className="border-border/50">
              <CardContent className="py-12">
                <div className="flex flex-col items-center gap-1">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-[11px] text-muted-foreground">Computing Snowflake analysis...</span>
                </div>
              </CardContent>
            </Card>
          ) : snowflakeData ? (
            <>
              {/* Snowflake Score Card */}
              <Card className="border-border/50">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" /> Snowflake Score
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Comprehensive analysis across 5 dimensions, 30 checks total</p>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col lg:flex-row items-center gap-2">
                    {/* Snowflake Chart */}
                    <div className="flex flex-col items-center">
                      <SnowflakeChart
                        data={{
                          value: snowflakeData.snowflake.value.score,
                          future: snowflakeData.snowflake.future.score,
                          past: snowflakeData.snowflake.past.score,
                          health: snowflakeData.snowflake.health.score,
                          dividend: snowflakeData.snowflake.dividend.score,
                        }}
                        color={snowflakeData.snowflake.color}
                        size={260}
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[11px] font-bold font-mono" style={{ color: snowflakeData.snowflake.color }}>
                          {snowflakeData.snowflake.totalScore}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-medium">/30</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {snowflakeData.snowflake.totalScore >= 21 ? 'Excellent' : snowflakeData.snowflake.totalScore >= 16 ? 'Good' : snowflakeData.snowflake.totalScore >= 11 ? 'Average' : 'Below Average'}
                      </span>
                    </div>

                    {/* Score Summary Grid */}
                    <div className="flex-1 w-full">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {[
                          { cat: snowflakeData.snowflake.value, icon: '💎', desc: 'Is it trading at a fair price?' },
                          { cat: snowflakeData.snowflake.future, icon: '🚀', desc: 'Expected future growth' },
                          { cat: snowflakeData.snowflake.past, icon: '📊', desc: 'Historical performance track record' },
                          { cat: snowflakeData.snowflake.health, icon: '🛡️', desc: 'Financial stability & leverage' },
                          { cat: snowflakeData.snowflake.dividend, icon: '💰', desc: 'Dividend yield & sustainability' },
                        ].map(({ cat, icon, desc }) => (
                          <div key={cat.name} className="flex items-center gap-1 p-3 rounded bg-secondary/30 border border-border/30 neon-card">
                            <span className="text-[11px]">{icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold">{cat.name}</span>
                                <span className="text-[11px] font-bold font-mono">{cat.score}/{cat.maxScore}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground truncate">{desc}</p>
                              <div className="flex gap-0.5 mt-1">
                                {Array.from({ length: 6 }).map((_, i) => (
                                  <div
                                    key={i}
                                    className="h-1 flex-1 rounded-full"
                                    style={{
                                      background: i < cat.score ? snowflakeData.snowflake.color : 'var(--secondary)',
                                      opacity: i < cat.score ? 1 : 0.3,
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Fair Value Estimation */}
              <Card className="border-border/50">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" /> Fair Value Estimation
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Intrinsic value calculated using {snowflakeData.fairValue.method} model</p>
                </CardHeader>
                <CardContent>
                  <FairValueGauge
                    currentPrice={snowflakeData.fairValue.currentPrice}
                    fairValue={snowflakeData.fairValue.fairValue}
                    discount={snowflakeData.fairValue.discount}
                    method={snowflakeData.fairValue.method}
                  />
                  {snowflakeData.fairValue.details.freeCashFlow && (
                    <div className="mt-4 pt-1.5 border-t border-border/30">
                      <p className="text-xs text-muted-foreground mb-2">Model Parameters</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                        {[
                          { label: 'FCF', value: `AED ${(snowflakeData.fairValue.details.freeCashFlow / 1e9).toFixed(2)}B` },
                          { label: 'Growth Rate', value: `${snowflakeData.fairValue.details.growthRate}%` },
                          { label: 'Discount Rate', value: `${snowflakeData.fairValue.details.discountRate}%` },
                          { label: 'Terminal Growth', value: `${snowflakeData.fairValue.details.terminalGrowthRate}%` },
                        ].map(p => (
                          <div key={p.label} className="text-center p-2 rounded bg-secondary/30">
                            <div className="text-[10px] text-muted-foreground">{p.label}</div>
                            <div className="text-xs font-mono font-medium">{p.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Detailed Checks */}
              <Card className="border-border/50">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" /> Detailed Analysis Checks
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">30 individual checks across 5 categories (click to expand)</p>
                </CardHeader>
                <CardContent>
                  <AnalysisChecks
                    categories={[
                      snowflakeData.snowflake.value,
                      snowflakeData.snowflake.future,
                      snowflakeData.snowflake.past,
                      snowflakeData.snowflake.health,
                      snowflakeData.snowflake.dividend,
                    ]}
                  />
                </CardContent>
              </Card>

              {/* Peer Comparison */}
              {snowflakeData.peers && snowflakeData.peers.length > 0 && (
                <Card className="border-border/50">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" /> Peer Comparison
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Snowflake scores of top peers in the same sector</p>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="border-b border-border/30">
                            <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Company</th>
                            <th className="text-center py-2 px-1 text-xs font-medium text-muted-foreground">Total</th>
                            <th className="text-center py-2 px-1 text-xs font-medium text-muted-foreground">Value</th>
                            <th className="text-center py-2 px-1 text-xs font-medium text-muted-foreground">Future</th>
                            <th className="text-center py-2 px-1 text-xs font-medium text-muted-foreground">Past</th>
                            <th className="text-center py-2 px-1 text-xs font-medium text-muted-foreground">Health</th>
                            <th className="text-center py-2 px-1 text-xs font-medium text-muted-foreground">Dividend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Current stock row */}
                          <tr className="border-b border-border/20 bg-primary/5">
                            <td className="py-2 px-2 font-semibold text-xs">{stockInfo.name}</td>
                            <td className="py-2 px-1 text-center font-bold font-mono" style={{ color: snowflakeData.snowflake.color }}>{snowflakeData.snowflake.totalScore}</td>
                            <td className="py-2 px-1 text-center font-mono text-xs">{snowflakeData.snowflake.value.score}/6</td>
                            <td className="py-2 px-1 text-center font-mono text-xs">{snowflakeData.snowflake.future.score}/6</td>
                            <td className="py-2 px-1 text-center font-mono text-xs">{snowflakeData.snowflake.past.score}/6</td>
                            <td className="py-2 px-1 text-center font-mono text-xs">{snowflakeData.snowflake.health.score}/6</td>
                            <td className="py-2 px-1 text-center font-mono text-xs">{snowflakeData.snowflake.dividend.score}/6</td>
                          </tr>
                          {/* Peer rows */}
                          {snowflakeData.peers.map((peer: any) => (
                            <tr key={peer.ticker} className="border-b border-border/10 hover:bg-secondary/20">
                              <td className="py-2 px-2 text-xs truncate max-w-[140px]">{peer.name}</td>
                              <td className="py-2 px-1 text-center font-mono text-xs font-medium" style={{ color: peer.snowflake.color }}>{peer.snowflake.totalScore}</td>
                              <td className="py-2 px-1 text-center font-mono text-xs">{peer.snowflake.value.score}/6</td>
                              <td className="py-2 px-1 text-center font-mono text-xs">{peer.snowflake.future.score}/6</td>
                              <td className="py-2 px-1 text-center font-mono text-xs">{peer.snowflake.past.score}/6</td>
                              <td className="py-2 px-1 text-center font-mono text-xs">{peer.snowflake.health.score}/6</td>
                              <td className="py-2 px-1 text-center font-mono text-xs">{peer.snowflake.dividend.score}/6</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Market Averages */}
              {snowflakeData.marketAverages && (
                <Card className="border-border/50">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2">
                      <PieChart className="h-4 w-4 text-primary" /> Market Context
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                      {[
                        { label: 'Market Avg P/E', value: snowflakeData.marketAverages.pe?.toFixed(1) + 'x' },
                        { label: 'Sector Avg P/E', value: snowflakeData.marketAverages.industryPE ? snowflakeData.marketAverages.industryPE.toFixed(1) + 'x' : 'N/A' },
                        { label: 'Sector Avg P/B', value: snowflakeData.marketAverages.industryPB ? snowflakeData.marketAverages.industryPB.toFixed(2) + 'x' : 'N/A' },
                        { label: 'Avg Earnings Growth', value: snowflakeData.marketAverages.earningsGrowth?.toFixed(1) + '%' },
                        { label: 'Div Yield 25th %', value: (snowflakeData.marketAverages.dividendYield25 * 100).toFixed(2) + '%' },
                        { label: 'Div Yield 75th %', value: (snowflakeData.marketAverages.dividendYield75 * 100).toFixed(2) + '%' },
                      ].map(m => (
                        <div key={m.label} className="p-3 rounded bg-secondary/30 border border-border/30">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</div>
                          <div className="text-[11px] font-mono font-semibold mt-0.5">{m.value}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="border-border/50">
              <CardContent className="py-8">
                <p className="text-[11px] text-muted-foreground text-center">Unable to load Snowflake analysis. Please try again.</p>
              </CardContent>
            </Card>
          )}

          {/* AI Deep Analysis */}
          <Card className="border-border/50">
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" /> AI Deep Analysis
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Comprehensive AI-powered research report</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => aiAnalysisMutation.mutate({ symbol })}
                  disabled={aiAnalysisMutation.isPending}
                >
                  {aiAnalysisMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  Generate Report
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {aiAnalysisMutation.data && aiAnalysisMutation.data.summary !== "AI analysis temporarily unavailable. Please try again later." ? (
                <div className="space-y-1.5">
                  {/* Rating Badge */}
                  <div className="flex items-center gap-1">
                    <Badge
                      className={`text-[11px] px-3 py-1.5 ${
                        aiAnalysisMutation.data.rating?.includes('Buy')
                          ? 'bg-[oklch(0.72_0.17_155/15%)] text-gain border-[oklch(0.72_0.17_155/30%)]'
                          : aiAnalysisMutation.data.rating?.includes('Sell')
                          ? 'bg-[oklch(0.65_0.22_25/15%)] text-loss border-[oklch(0.65_0.22_25/30%)]'
                          : 'bg-secondary text-muted-foreground'
                      }`}
                      variant="outline"
                    >
                      {aiAnalysisMutation.data.rating}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Confidence: <span className="font-mono font-medium text-foreground">{aiAnalysisMutation.data.confidence}%</span>
                    </span>
                  </div>

                  {/* Summary */}
                  <div>
                    <h4 className="text-[11px] font-semibold mb-2">Executive Summary</h4>
                    <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-line">{aiAnalysisMutation.data.summary}</p>
                  </div>

                  {/* Rewards & Risks */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-semibold flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-gain" /> Key Rewards
                      </h4>
                      <ul className="space-y-1.5">
                        {aiAnalysisMutation.data.rewards?.map((r: string, i: number) => (
                          <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                            <span className="text-gain mt-0.5">+</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-semibold flex items-center gap-1.5">
                        <TrendingDown className="h-3.5 w-3.5 text-loss" /> Key Risks
                      </h4>
                      <ul className="space-y-1.5">
                        {aiAnalysisMutation.data.risks?.map((r: string, i: number) => (
                          <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                            <span className="text-loss mt-0.5">-</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Outlook */}
                  {aiAnalysisMutation.data.outlook && (
                    <div>
                      <h4 className="text-[11px] font-semibold mb-2">Forward Outlook</h4>
                      <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-line">{aiAnalysisMutation.data.outlook}</p>
                    </div>
                  )}
                </div>
              ) : aiAnalysisMutation.isPending ? (
                <div className="flex items-center gap-1 py-8">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span className="text-[11px] text-muted-foreground">Generating comprehensive analysis report...</span>
                </div>
              ) : aiAnalysisMutation.data?.summary === "AI analysis temporarily unavailable. Please try again later." ? (
                <p className="text-[11px] text-muted-foreground py-1.5">AI analysis temporarily unavailable. Please try again later.</p>
              ) : (
                <p className="text-[11px] text-muted-foreground py-1.5">
                  Click "Generate Report" to get a comprehensive AI-powered analysis including investment thesis, rewards, risks, and forward outlook.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Quick Sentiment (kept from original) */}
          <Card className="border-border/50">
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Quick Sentiment
                </CardTitle>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => sentimentMutation.mutate({ symbol, name: stockInfo.name })} disabled={sentimentMutation.isPending}>
                  {sentimentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
                  Check
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {sentimentMutation.data ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Badge className={`text-[11px] px-3 py-1 ${sentimentMutation.data.sentiment === "bullish" ? "bg-[oklch(0.72_0.17_155/15%)] text-gain border-[oklch(0.72_0.17_155/30%)]" : sentimentMutation.data.sentiment === "bearish" ? "bg-[oklch(0.65_0.22_25/15%)] text-loss border-[oklch(0.65_0.22_25/30%)]" : "bg-secondary text-muted-foreground"}`} variant="outline">
                      {sentimentMutation.data.sentiment === "bullish" ? <TrendingUp className="h-4 w-4 mr-1.5" /> : sentimentMutation.data.sentiment === "bearish" ? <TrendingDown className="h-4 w-4 mr-1.5" /> : null}
                      {sentimentMutation.data.sentiment.charAt(0).toUpperCase() + sentimentMutation.data.sentiment.slice(1)}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">Score: <span className="font-mono font-medium text-foreground">{sentimentMutation.data.score?.toFixed(2)}</span></span>
                  </div>
                  <p className="text-[11px] text-foreground/80 leading-relaxed">{sentimentMutation.data.summary}</p>
                </div>
              ) : sentimentMutation.isPending ? (
                <div className="flex items-center gap-1 py-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span className="text-[11px] text-muted-foreground">Checking sentiment...</span>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground py-1.5">
                  Quick AI sentiment check based on current market conditions.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
