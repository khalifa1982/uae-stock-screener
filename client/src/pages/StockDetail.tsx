import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Brain,
  Loader2,
  DollarSign,
  Target,
  Gauge,
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
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

function RSIGauge({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const zone = value > 70 ? "Overbought" : value < 30 ? "Oversold" : "Neutral";
  const color = value > 70 ? "text-loss" : value < 30 ? "text-gain" : "text-foreground";
  const bgColor = value > 70 ? "bg-loss" : value < 30 ? "bg-gain" : "bg-primary/10";
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

export default function StockDetail() {
  const params = useParams<{ symbol: string }>();
  const [, setLocation] = useLocation();
  const symbol = params.symbol || "";
  const [chartRange, setChartRange] = useState<"1mo" | "3mo" | "6mo" | "1y" | "2y">("3mo");

  const stockInfo = useMemo(() => ALL_STOCKS.find(s => s.symbol === symbol), [symbol]);

  const { data: detail, isLoading: detailLoading } = trpc.stocks.detail.useQuery(
    { symbol },
    { enabled: !!symbol, staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000, refetchOnWindowFocus: false }
  );

  const { data: chartData, isLoading: chartLoading } = trpc.stocks.chart.useQuery(
    { symbol, range: chartRange, interval: "1d" },
    { enabled: !!symbol, staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000, refetchOnWindowFocus: false }
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
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight font-mono">{symbol}</h1>
              <Badge variant="outline" className={`text-xs font-mono ${stockInfo.exchange === "ADX" ? "border-primary/40 text-primary" : "border-chart-2/40 text-chart-2"}`}>
                {stockInfo.exchange}
              </Badge>
              <Badge variant="secondary" className="text-xs">{stockInfo.sector}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">{stockInfo.name}</p>
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
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "oklch(0.6 0.015 260)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "oklch(0.6 0.015 260)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => v.toFixed(2)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.155 0.01 260)",
                      border: "1px solid oklch(0.22 0.01 260)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "oklch(0.93 0.005 260)",
                    }}
                    formatter={(value: number) => [value?.toFixed(3) + " AED", "Close"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke="oklch(0.65 0.19 250)"
                    strokeWidth={2}
                    fill="url(#priceGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: "oklch(0.65 0.19 250)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>

              {/* Volume Chart */}
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={chartPoints} margin={{ top: 0, right: 5, left: 5, bottom: 0 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.155 0.01 260)",
                      border: "1px solid oklch(0.22 0.01 260)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "oklch(0.93 0.005 260)",
                    }}
                    formatter={(value: number) => [formatLargeNumber(value), "Volume"]}
                  />
                  <Bar dataKey="volume" fill="oklch(0.65 0.19 250 / 30%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No chart data available
            </div>
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
                <MetricCard label="Market Cap" value={formatLargeNumber(detail.marketCap)} icon={DollarSign} />
                <MetricCard label="P/E Ratio" value={formatNumber(detail.pe, 1)} icon={Gauge} />
                <MetricCard label="EPS" value={formatNumber(detail.eps)} icon={TrendingUp} />
                <MetricCard label="52W High" value={formatNumber(detail.week52High)} icon={ArrowUp} />
                <MetricCard label="52W Low" value={formatNumber(detail.week52Low)} icon={ArrowDown} />
                <MetricCard label="Div Yield" value={detail.dividendYield != null ? (detail.dividendYield * 100).toFixed(2) + "%" : "—"} icon={DollarSign} />
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

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-secondary/30">
                    <span className="text-xs text-muted-foreground">SMA 20</span>
                    <span className="font-mono text-sm font-medium">{detail.sma20 != null ? formatNumber(detail.sma20, 3) : "—"}</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-secondary/30">
                    <span className="text-xs text-muted-foreground">SMA 50</span>
                    <span className="font-mono text-sm font-medium">{detail.sma50 != null ? formatNumber(detail.sma50, 3) : "—"}</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-secondary/30">
                    <span className="text-xs text-muted-foreground">EMA 12</span>
                    <span className="font-mono text-sm font-medium">{detail.ema12 != null ? formatNumber(detail.ema12, 3) : "—"}</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-secondary/30">
                    <span className="text-xs text-muted-foreground">EMA 26</span>
                    <span className="font-mono text-sm font-medium">{detail.ema26 != null ? formatNumber(detail.ema26, 3) : "—"}</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-secondary/30">
                    <span className="text-xs text-muted-foreground">Vol Ratio</span>
                    <span className={`font-mono text-sm font-medium ${detail.volumeRatio != null && detail.volumeRatio > 1.5 ? "text-chart-4" : ""}`}>
                      {detail.volumeRatio != null ? detail.volumeRatio.toFixed(2) + "x" : "—"}
                    </span>
                  </div>

                  {/* Signal Summary */}
                  {detail.price != null && detail.sma50 != null && (
                    <div className={`p-3 rounded-lg border ${detail.price > detail.sma50 ? "border-[oklch(0.72_0.17_155/30%)] bg-[oklch(0.72_0.17_155/5%)]" : "border-[oklch(0.65_0.22_25/30%)] bg-[oklch(0.65_0.22_25/5%)]"}`}>
                      <div className="flex items-center gap-2">
                        {detail.price > detail.sma50 ? (
                          <TrendingUp className="h-4 w-4 text-gain" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-loss" />
                        )}
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

      {/* AI Sentiment */}
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
              {sentimentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
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
                  {sentimentMutation.data.sentiment === "bullish" ? (
                    <TrendingUp className="h-4 w-4 mr-1.5" />
                  ) : sentimentMutation.data.sentiment === "bearish" ? (
                    <TrendingDown className="h-4 w-4 mr-1.5" />
                  ) : null}
                  {sentimentMutation.data.sentiment.charAt(0).toUpperCase() + sentimentMutation.data.sentiment.slice(1)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Score: <span className="font-mono font-medium text-foreground">{sentimentMutation.data.score?.toFixed(2)}</span>
                </span>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {sentimentMutation.data.summary}
              </p>
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
    </div>
  );
}
