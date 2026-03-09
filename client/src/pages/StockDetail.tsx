import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useAutoRefreshInterval } from "@/hooks/useMarketStatus";
import { MarketStatusBadge } from "@/components/MarketStatusIndicator";
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
  Calendar, Briefcase, BookOpen, Download, ExternalLink,
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ALL_STOCKS } from "../../../shared/stockData";

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

function formatPercent(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return "—";
  return (num * 100).toFixed(2) + "%";
}

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color?: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/30">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${color || "bg-primary/10"}`}>
        <Icon className={`h-4 w-4 ${color ? "text-foreground" : "text-primary"}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold font-mono truncate">{value}</p>
      </div>
    </div>
  );
}

function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 px-3 rounded-md hover:bg-muted/10">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm ${highlight ? "font-semibold text-foreground" : "text-foreground/80"}`}>{value}</span>
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
        <span className={`text-sm font-mono font-semibold ${color}`}>{value.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded-full bg-secondary/50 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${value > 70 ? "bg-[oklch(0.65_0.22_25)]" : value < 30 ? "bg-[oklch(0.72_0.17_155)]" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0 — Oversold</span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${color}`}>{zone}</Badge>
        <span>Overbought — 100</span>
      </div>
    </div>
  );
}

const chartRanges = [
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "2y", label: "2Y" },
];

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
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
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
                    <td key={i} className="p-2 pr-4 text-right font-mono whitespace-nowrap">
                      {formatVal(row[key])}
                    </td>
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

export default function StockDetail() {
  const params = useParams<{ symbol: string }>();
  const [, setLocation] = useLocation();
  const symbol = params.symbol || "";
  const [chartRange, setChartRange] = useState<"1mo" | "3mo" | "6mo" | "1y" | "2y">("3mo");
  const [activeTab, setActiveTab] = useState("overview");

  const stockInfo = useMemo(() => ALL_STOCKS.find(s => s.symbol === symbol), [symbol]);

  const autoRefreshInterval = useAutoRefreshInterval();

  const { data: detail, isLoading: detailLoading } = trpc.stocks.detail.useQuery(
    { symbol },
    { enabled: !!symbol, staleTime: autoRefreshInterval ? 20 * 1000 : 5 * 60 * 1000, refetchInterval: autoRefreshInterval, gcTime: 30 * 60 * 1000, refetchOnWindowFocus: false }
  );

  const { data: chartData, isLoading: chartLoading } = trpc.stocks.chart.useQuery(
    { symbol, range: chartRange, interval: "1d" },
    { enabled: !!symbol, staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000, refetchOnWindowFocus: false }
  );

  const { data: profileData, isLoading: profileLoading } = trpc.stocks.profile.useQuery(
    { symbol },
    { enabled: !!symbol, staleTime: 10 * 60 * 1000, gcTime: 60 * 60 * 1000, refetchOnWindowFocus: false }
  );

  const sentimentMutation = trpc.stocks.sentiment.useMutation();

  const chartPoints = useMemo(() => {
    if (!chartData || !chartData.timestamps) return [];
    return chartData.timestamps.map((t: number, i: number) => ({
      date: new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      close: chartData.close[i],
      volume: chartData.volume[i],
      high: chartData.high[i],
      low: chartData.low[i],
    })).filter((p: any) => p.close != null);
  }, [chartData]);

  const priceChange = detail?.price && detail?.previousClose
    ? ((detail.price - detail.previousClose) / detail.previousClose) * 100
    : detail?.changePercent;

  const profile = profileData?.profile;

  if (!stockInfo) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-muted-foreground">Stock not found</p>
        <Button variant="outline" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="self-start gap-2 text-muted-foreground -ml-2" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Company Logo */}
            {profile?.logo ? (
              <div className="h-14 w-14 rounded-xl bg-white/10 border border-border/40 flex items-center justify-center overflow-hidden shrink-0">
                <img src={profile.logo} alt={stockInfo.name} className="h-10 w-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            ) : (
              <div className="h-14 w-14 rounded-xl bg-muted/50 border border-border/40 flex items-center justify-center shrink-0">
                <span className="text-lg font-bold text-muted-foreground">{symbol.slice(0, 2)}</span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight font-mono">{symbol}</h1>
                <Badge variant="outline" className={`text-xs font-mono ${stockInfo.exchange === "ADX" ? "border-primary/40 text-primary" : "border-chart-2/40 text-chart-2"}`}>
                  {stockInfo.exchange}
                </Badge>
                <Badge variant="secondary" className="text-xs">{stockInfo.sector}</Badge>
                {profile?.industry && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">{profile.industry}</Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">{stockInfo.name}</p>
              {profile?.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                  <Globe className="h-3 w-3" /> {profile.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
          {detail && (
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold font-mono">
                {detail.price != null ? formatNumber(detail.price) : "—"}
              </span>
              <span className="text-sm text-muted-foreground mb-1">AED</span>
              {priceChange != null && (
                <span className={`flex items-center gap-1 text-lg font-semibold font-mono mb-0.5 ${priceChange > 0 ? "text-gain" : priceChange < 0 ? "text-loss" : "text-muted-foreground"}`}>
                  {priceChange > 0 ? <ArrowUp className="h-4 w-4" /> : priceChange < 0 ? <ArrowDown className="h-4 w-4" /> : null}
                  {priceChange > 0 ? "+" : ""}{priceChange.toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="overview" className="text-xs gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="financials" className="text-xs gap-1.5"><FileText className="h-3.5 w-3.5" /> Financials</TabsTrigger>
          <TabsTrigger value="profile" className="text-xs gap-1.5"><Building2 className="h-3.5 w-3.5" /> Profile</TabsTrigger>
          <TabsTrigger value="analysis" className="text-xs gap-1.5"><Brain className="h-3.5 w-3.5" /> AI Analysis</TabsTrigger>
        </TabsList>

        {/* === OVERVIEW TAB === */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Price Chart */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Price Chart
                </CardTitle>
                <div className="flex gap-1">
                  {chartRanges.map(r => (
                    <Button
                      key={r.value}
                      variant={chartRange === r.value ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setChartRange(r.value as any)}
                    >
                      {r.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chartLoading ? (
                <Skeleton className="h-[300px] w-full rounded-lg" />
              ) : chartPoints.length > 0 ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartPoints} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.65 0.19 250)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="oklch(0.65 0.19 250)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.01 260)" />
                      <XAxis dataKey="date" tick={{ fill: "oklch(0.6 0.015 260)", fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: "oklch(0.6 0.015 260)", fontSize: 11 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v) => v.toFixed(2)} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "oklch(0.155 0.01 260)", border: "1px solid oklch(0.22 0.01 260)", borderRadius: "8px", fontSize: "12px", color: "oklch(0.93 0.005 260)" }}
                        formatter={(value: number) => [value?.toFixed(3) + " AED", "Close"]}
                      />
                      <Area type="monotone" dataKey="close" stroke="oklch(0.65 0.19 250)" strokeWidth={2} fill="url(#priceGradient)" dot={false} activeDot={{ r: 4, fill: "oklch(0.65 0.19 250)" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart data={chartPoints} margin={{ top: 0, right: 5, left: 5, bottom: 0 }}>
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ backgroundColor: "oklch(0.155 0.01 260)", border: "1px solid oklch(0.22 0.01 260)", borderRadius: "8px", fontSize: "12px", color: "oklch(0.93 0.005 260)" }}
                        formatter={(value: number) => [formatLargeNumber(value), "Volume"]}
                      />
                      <Bar dataKey="volume" fill="oklch(0.65 0.19 250 / 30%)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">No chart data available</div>
              )}
            </CardContent>
          </Card>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Key Metrics */}
            <Card className="border-border/50 lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" /> Key Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {detailLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
                  </div>
                ) : detail ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <MetricCard label="Open" value={formatNumber(detail.open)} icon={Target} />
                    <MetricCard label="Day High" value={formatNumber(detail.dayHigh)} icon={ArrowUp} />
                    <MetricCard label="Day Low" value={formatNumber(detail.dayLow)} icon={ArrowDown} />
                    <MetricCard label="Prev Close" value={formatNumber(detail.previousClose)} icon={DollarSign} />
                    <MetricCard label="Volume" value={formatLargeNumber(detail.volume)} icon={BarChart3} />
                    <MetricCard label="Avg Volume" value={formatLargeNumber(detail.avgVolume)} icon={Activity} />
                    <MetricCard label="Market Cap" value={formatLargeNumber(detail.marketCap || profile?.marketCap)} icon={DollarSign} />
                    <MetricCard label="P/E Ratio" value={formatNumber(detail.pe || profile?.trailingPE, 1)} icon={Gauge} />
                    <MetricCard label="EPS" value={formatNumber(detail.eps || profile?.trailingEps)} icon={TrendingUp} />
                    <MetricCard label="52W High" value={formatNumber(detail.week52High || profile?.fiftyTwoWeekHigh)} icon={ArrowUp} />
                    <MetricCard label="52W Low" value={formatNumber(detail.week52Low || profile?.fiftyTwoWeekLow)} icon={ArrowDown} />
                    <MetricCard label="Div Yield" value={detail.dividendYield != null ? detail.dividendYield.toFixed(2) + "%" : profile?.dividendYield ? formatPercent(profile.dividendYield) : "\u2014"} icon={DollarSign} />
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No data available</p>
                )}
              </CardContent>
            </Card>

            {/* Technical Indicators */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Technical Indicators
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {detailLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                  </div>
                ) : detail ? (
                  <>
                    <RSIGauge value={detail.rsi} />
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                        <span className="text-xs text-muted-foreground">SMA 20</span>
                        <span className="font-mono text-xs font-medium">{detail.sma20 != null ? formatNumber(detail.sma20, 3) : "\u2014"}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                        <span className="text-xs text-muted-foreground">SMA 50</span>
                        <span className="font-mono text-xs font-medium">{detail.sma50 != null ? formatNumber(detail.sma50, 3) : "\u2014"}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                        <span className="text-xs text-muted-foreground">EMA 20</span>
                        <span className="font-mono text-xs font-medium">{detail.ema12 != null ? formatNumber(detail.ema12, 3) : "\u2014"}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                        <span className="text-xs text-muted-foreground">EMA 50</span>
                        <span className="font-mono text-xs font-medium">{detail.ema26 != null ? formatNumber(detail.ema26, 3) : "\u2014"}</span>
                      </div>
                      {detail.price != null && detail.sma50 != null && (
                        <div className={`p-2.5 rounded-lg border ${detail.price > detail.sma50 ? "border-[oklch(0.72_0.17_155/30%)] bg-[oklch(0.72_0.17_155/5%)]" : "border-[oklch(0.65_0.22_25/30%)] bg-[oklch(0.65_0.22_25/5%)]"}`}>
                          <div className="flex items-center gap-2">
                            {detail.price > detail.sma50 ? <TrendingUp className="h-3.5 w-3.5 text-gain" /> : <TrendingDown className="h-3.5 w-3.5 text-loss" />}
                            <span className={`text-xs font-medium ${detail.price > detail.sma50 ? "text-gain" : "text-loss"}`}>
                              Price is {detail.price > detail.sma50 ? "above" : "below"} SMA 50
                            </span>
                          </div>
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

          {/* TradingView Technical Analysis Summary */}
          {profile && (profile.tvRecommendation != null || profile.tvMACD != null || profile.tvStochK != null) && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-primary" /> Technical Analysis Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Overall Recommendation */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recommendation</h4>
                    <div className="space-y-2">
                      {profile.tvRecommendation != null && (
                        <div className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                          <p className="text-[11px] text-muted-foreground mb-1">Overall</p>
                          <p className={`text-lg font-bold ${profile.tvRecommendation >= 0.1 ? "text-gain" : profile.tvRecommendation <= -0.1 ? "text-loss" : "text-foreground"}`}>
                            {profile.tvRecommendation >= 0.5 ? "Strong Buy" : profile.tvRecommendation >= 0.1 ? "Buy" : profile.tvRecommendation > -0.1 ? "Neutral" : profile.tvRecommendation > -0.5 ? "Sell" : "Strong Sell"}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">Score: {profile.tvRecommendation.toFixed(3)}</p>
                        </div>
                      )}
                      {profile.tvRecommendMA != null && (
                        <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/20">
                          <span className="text-xs text-muted-foreground">Moving Avg</span>
                          <span className={`font-mono text-xs font-medium ${profile.tvRecommendMA >= 0.1 ? "text-gain" : profile.tvRecommendMA <= -0.1 ? "text-loss" : ""}`}>
                            {profile.tvRecommendMA >= 0.5 ? "Strong Buy" : profile.tvRecommendMA >= 0.1 ? "Buy" : profile.tvRecommendMA > -0.1 ? "Neutral" : profile.tvRecommendMA > -0.5 ? "Sell" : "Strong Sell"}
                          </span>
                        </div>
                      )}
                      {profile.tvRecommendOther != null && (
                        <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/20">
                          <span className="text-xs text-muted-foreground">Oscillators</span>
                          <span className={`font-mono text-xs font-medium ${profile.tvRecommendOther >= 0.1 ? "text-gain" : profile.tvRecommendOther <= -0.1 ? "text-loss" : ""}`}>
                            {profile.tvRecommendOther >= 0.5 ? "Strong Buy" : profile.tvRecommendOther >= 0.1 ? "Buy" : profile.tvRecommendOther > -0.1 ? "Neutral" : profile.tvRecommendOther > -0.5 ? "Sell" : "Strong Sell"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Oscillators */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Oscillators</h4>
                    <div className="space-y-1.5">
                      <DataRow label="MACD" value={profile.tvMACD != null ? formatNumber(profile.tvMACD, 4) : "\u2014"} />
                      <DataRow label="MACD Signal" value={profile.tvMACDSignal != null ? formatNumber(profile.tvMACDSignal, 4) : "\u2014"} />
                      <DataRow label="Stochastic %K" value={profile.tvStochK != null ? formatNumber(profile.tvStochK, 2) : "\u2014"} />
                      <DataRow label="Stochastic %D" value={profile.tvStochD != null ? formatNumber(profile.tvStochD, 2) : "\u2014"} />
                      <DataRow label="CCI (20)" value={profile.tvCCI20 != null ? formatNumber(profile.tvCCI20, 2) : "\u2014"} />
                      <DataRow label="Momentum" value={profile.tvMomentum != null ? formatNumber(profile.tvMomentum, 4) : "\u2014"} />
                      <DataRow label="Awesome Osc." value={profile.tvAwesomeOscillator != null ? formatNumber(profile.tvAwesomeOscillator, 4) : "\u2014"} />
                    </div>
                  </div>
                  {/* Moving Averages & Bands */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Moving Averages</h4>
                    <div className="space-y-1.5">
                      <DataRow label="SMA 20" value={profile.tvSMA20 != null ? formatNumber(profile.tvSMA20, 3) : "\u2014"} />
                      <DataRow label="SMA 50" value={profile.tvSMA50 != null ? formatNumber(profile.tvSMA50, 3) : "\u2014"} />
                      <DataRow label="SMA 200" value={profile.tvSMA200 != null ? formatNumber(profile.tvSMA200, 3) : "\u2014"} highlight />
                      <DataRow label="EMA 20" value={profile.tvEMA20 != null ? formatNumber(profile.tvEMA20, 3) : "\u2014"} />
                      <DataRow label="EMA 50" value={profile.tvEMA50 != null ? formatNumber(profile.tvEMA50, 3) : "\u2014"} />
                      <DataRow label="EMA 200" value={profile.tvEMA200 != null ? formatNumber(profile.tvEMA200, 3) : "\u2014"} highlight />
                      <DataRow label="BB Upper" value={profile.tvBBUpper != null ? formatNumber(profile.tvBBUpper, 3) : "\u2014"} />
                      <DataRow label="BB Lower" value={profile.tvBBLower != null ? formatNumber(profile.tvBBLower, 3) : "\u2014"} />
                      <DataRow label="ADX" value={profile.tvADX != null ? formatNumber(profile.tvADX, 2) : "\u2014"} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Performance */}
          {profile && (profile.tvPerfWeek != null || profile.tvPerfMonth != null) && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Performance & Volatility
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                  {[
                    { label: "1 Week", val: profile.tvPerfWeek },
                    { label: "1 Month", val: profile.tvPerfMonth },
                    { label: "3 Months", val: profile.tvPerf3Month },
                    { label: "6 Months", val: profile.tvPerf6Month },
                    { label: "YTD", val: profile.tvPerfYTD },
                    { label: "1 Year", val: profile.tvPerfYear },
                    { label: "Vol (W)", val: profile.tvVolatilityWeek },
                    { label: "Vol (M)", val: profile.tvVolatilityMonth },
                  ].map(({ label, val }) => (
                    <div key={label} className="p-3 rounded-lg bg-secondary/30 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                      <p className={`text-sm font-bold font-mono ${
                        val != null && label.startsWith("Vol") ? "text-foreground" :
                        val != null && val > 0 ? "text-gain" : val != null && val < 0 ? "text-loss" : "text-muted-foreground"
                      }`}>
                        {val != null ? (label.startsWith("Vol") ? val.toFixed(2) + "%" : (val > 0 ? "+" : "") + val.toFixed(2) + "%") : "\u2014"}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Key Statistics from Profile */}
          {profile && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-primary" /> Key Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Valuation */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Valuation</h4>
                    <div className="space-y-0.5">
                      <DataRow label="Market Cap" value={formatLargeNumber(profile.marketCap)} highlight />
                      <DataRow label="Enterprise Value" value={formatLargeNumber(profile.enterpriseValue)} />
                      <DataRow label="Trailing P/E" value={formatNumber(profile.trailingPE, 1)} />
                      <DataRow label="Forward P/E" value={formatNumber(profile.forwardPE, 1)} />
                      <DataRow label="PEG Ratio" value={formatNumber(profile.pegRatio, 2)} />
                      <DataRow label="Price/Sales" value={formatNumber(profile.priceToSales, 2)} />
                      <DataRow label="Price/Book" value={formatNumber(profile.priceToBook, 2)} />
                      <DataRow label="EV/Revenue" value={formatNumber(profile.evToRevenue, 2)} />
                      <DataRow label="EV/EBITDA" value={formatNumber(profile.evToEbitda, 2)} />
                    </div>
                  </div>
                  {/* Profitability */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Profitability</h4>
                    <div className="space-y-0.5">
                      <DataRow label="Revenue" value={formatLargeNumber(profile.totalRevenue)} highlight />
                      <DataRow label="Revenue Growth" value={formatPercent(profile.revenueGrowth)} />
                      <DataRow label="Gross Margin" value={formatPercent(profile.grossMargin)} />
                      <DataRow label="EBITDA Margin" value={formatPercent(profile.ebitdaMargin)} />
                      <DataRow label="Operating Margin" value={formatPercent(profile.operatingMargin)} />
                      <DataRow label="Net Margin" value={formatPercent(profile.profitMargin)} />
                      <DataRow label="ROE" value={formatPercent(profile.returnOnEquity)} />
                      <DataRow label="ROA" value={formatPercent(profile.returnOnAssets)} />
                    </div>
                  </div>
                  {/* Financial Health */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Financial Health</h4>
                    <div className="space-y-0.5">
                      <DataRow label="Total Cash" value={formatLargeNumber(profile.totalCash)} highlight />
                      <DataRow label="Total Debt" value={formatLargeNumber(profile.totalDebt)} />
                      <DataRow label="Debt/Equity" value={formatNumber(profile.debtToEquity, 1)} />
                      <DataRow label="Current Ratio" value={formatNumber(profile.currentRatio, 2)} />
                      <DataRow label="Quick Ratio" value={formatNumber(profile.quickRatio, 2)} />
                      <DataRow label="Book Value" value={formatNumber(profile.bookValue)} />
                      <DataRow label="Free Cash Flow" value={formatLargeNumber(profile.freeCashflow)} />
                      <DataRow label="Op Cash Flow" value={formatLargeNumber(profile.operatingCashflow)} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* === FINANCIALS TAB === */}
        <TabsContent value="financials" className="space-y-6 mt-4">
          {profileLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
            </div>
          ) : profile ? (
            <>
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
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
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
              {(!profile.incomeStatement || profile.incomeStatement.length === 0) &&
               (!profile.balanceSheet || profile.balanceSheet.length === 0) &&
               (!profile.cashFlow || profile.cashFlow.length === 0) && (
                <>
                  {/* Show TradingView financial data as fallback */}
                  {(profile.tvNetIncome != null || profile.tvEBITDA != null || profile.tvTotalAssets != null) ? (
                    <Card className="border-border/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" /> Financial Summary
                          <Badge variant="outline" className="text-[10px] ml-2">TradingView</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Income</h4>
                            <div className="space-y-1">
                              <DataRow label="Total Revenue" value={formatLargeNumber(profile.totalRevenue)} highlight />
                              <DataRow label="Gross Profit" value={formatLargeNumber(profile.tvGrossProfit)} />
                              <DataRow label="EBITDA" value={formatLargeNumber(profile.tvEBITDA)} />
                              <DataRow label="Net Income" value={formatLargeNumber(profile.tvNetIncome)} />
                              <DataRow label="EPS" value={formatNumber(profile.trailingEps)} />
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Balance Sheet</h4>
                            <div className="space-y-1">
                              <DataRow label="Total Assets" value={formatLargeNumber(profile.tvTotalAssets)} highlight />
                              <DataRow label="Current Assets" value={formatLargeNumber(profile.tvTotalCurrentAssets)} />
                              <DataRow label="Total Debt" value={formatLargeNumber(profile.totalDebt)} />
                              <DataRow label="Debt/Equity" value={formatNumber(profile.debtToEquity, 2)} />
                              <DataRow label="Current Ratio" value={formatNumber(profile.currentRatio, 2)} />
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Margins</h4>
                            <div className="space-y-1">
                              <DataRow label="Gross Margin" value={profile.grossMargin != null ? formatPercent(profile.grossMargin) : "\u2014"} />
                              <DataRow label="Operating Margin" value={profile.operatingMargin != null ? formatPercent(profile.operatingMargin) : "\u2014"} />
                              <DataRow label="Pre-Tax Margin" value={profile.tvPreTaxMargin != null ? formatPercent(profile.tvPreTaxMargin) : "\u2014"} />
                              <DataRow label="Net Margin" value={profile.profitMargin != null ? formatPercent(profile.profitMargin) : "\u2014"} />
                              <DataRow label="Free Cash Flow" value={formatLargeNumber(profile.freeCashflow)} />
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

        {/* === PROFILE TAB === */}
        <TabsContent value="profile" className="space-y-6 mt-4">
          {profileLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-48 rounded-lg" />
              <Skeleton className="h-32 rounded-lg" />
            </div>
          ) : profile ? (
            <>
              {/* Company Description */}
              {profile.description && (
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" /> About {stockInfo.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground/80 leading-relaxed">{profile.description}</p>
                    <Separator className="my-4" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {profile.sector && (
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Sector</p>
                          <p className="font-medium">{profile.sector}</p>
                        </div>
                      )}
                      {profile.industry && (
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Industry</p>
                          <p className="font-medium">{profile.industry}</p>
                        </div>
                      )}
                      {profile.fullTimeEmployees && (
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Employees</p>
                          <p className="font-medium">{profile.fullTimeEmployees.toLocaleString()}</p>
                        </div>
                      )}
                      {profile.country && (
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Country</p>
                          <p className="font-medium">{profile.country}</p>
                        </div>
                      )}
                      {profile.city && (
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">City</p>
                          <p className="font-medium">{profile.city}</p>
                        </div>
                      )}
                      {profile.phone && (
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Phone</p>
                          <p className="font-medium">{profile.phone}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Board of Directors / Officers */}
              {profile.officers && profile.officers.length > 0 && (
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" /> Key Officers & Board
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {profile.officers.map((officer: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/20 border border-border/20">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Briefcase className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{officer.name}</p>
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
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
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
                      <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-4 text-sm">
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

              {/* Dividend Info */}
              {(profile.dividendRate || profile.dividendYield || profile.exDividendDate) && (
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" /> Dividend Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Annual Rate</p>
                        <p className="text-lg font-bold font-mono">{profile.dividendRate ? formatNumber(profile.dividendRate) + " AED" : "—"}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Yield</p>
                        <p className="text-lg font-bold font-mono">{profile.dividendYield ? formatPercent(profile.dividendYield) : "—"}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Ex-Dividend Date</p>
                        <p className="text-lg font-bold font-mono">{profile.exDividendDate || "—"}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Payout Ratio</p>
                        <p className="text-lg font-bold font-mono">{profile.payoutRatio ? formatPercent(profile.payoutRatio) : "—"}</p>
                      </div>
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
                {!stockInfo.yahooSymbol && (
                  <p className="text-xs text-muted-foreground mt-1">This stock is not tracked on Yahoo Finance.</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* === AI ANALYSIS TAB === */}
        <TabsContent value="analysis" className="space-y-6 mt-4">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" /> AI Sentiment Analysis
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => sentimentMutation.mutate({ symbol, name: stockInfo.name })}
                  disabled={sentimentMutation.isPending}
                >
                  {sentimentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  Analyze
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {sentimentMutation.data ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Badge
                      className={`text-sm px-3 py-1 ${
                        sentimentMutation.data.sentiment === "bullish"
                          ? "bg-[oklch(0.72_0.17_155/15%)] text-gain border-[oklch(0.72_0.17_155/30%)]"
                          : sentimentMutation.data.sentiment === "bearish"
                          ? "bg-[oklch(0.65_0.22_25/15%)] text-loss border-[oklch(0.65_0.22_25/30%)]"
                          : "bg-secondary text-muted-foreground"
                      }`}
                      variant="outline"
                    >
                      {sentimentMutation.data.sentiment === "bullish" ? <TrendingUp className="h-4 w-4 mr-1.5" /> : sentimentMutation.data.sentiment === "bearish" ? <TrendingDown className="h-4 w-4 mr-1.5" /> : null}
                      {sentimentMutation.data.sentiment.charAt(0).toUpperCase() + sentimentMutation.data.sentiment.slice(1)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Score: <span className="font-mono font-medium text-foreground">{sentimentMutation.data.score?.toFixed(2)}</span>
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{sentimentMutation.data.summary}</p>
                </div>
              ) : sentimentMutation.isPending ? (
                <div className="flex items-center gap-3 py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Analyzing market sentiment...</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4">
                  Click "Analyze" to get AI-powered sentiment analysis for this stock based on current market conditions and sector trends.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
