/**
 * Advanced Chart Component with Technical Indicator Overlays
 * 
 * Features:
 * - Price chart with SMA 20/50 overlays
 * - Bollinger Bands overlay
 * - Volume bars with color coding (green=up, red=down)
 * - MACD sub-chart with histogram
 * - RSI sub-chart with overbought/oversold zones
 * - Neon stock-market aesthetic
 * - Mobile responsive
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { BarChart3, TrendingUp, Activity, Layers, Eye, EyeOff } from "lucide-react";

interface AdvancedChartProps {
  symbol: string;
  exchange: "ADX" | "DFM";
  chartData: Array<{ date: string; close: number; volume: number; open?: number; high?: number; low?: number }>;
  chartRange: string;
  onRangeChange: (range: string) => void;
  chartLoading: boolean;
}

const chartRanges = [
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
  { label: "2Y", value: "2y" },
];

// Neon color palette
const NEON = {
  cyan: "oklch(0.82 0.16 195)",
  cyanDim: "oklch(0.72 0.18 195)",
  green: "oklch(0.78 0.2 155)",
  red: "oklch(0.65 0.24 25)",
  purple: "oklch(0.68 0.2 300)",
  gold: "oklch(0.82 0.16 80)",
  grid: "oklch(0.18 0.012 260)",
  tooltip: "oklch(0.11 0.01 260)",
  tooltipBorder: "oklch(0.25 0.012 260)",
  text: "oklch(0.6 0.015 260)",
  textBright: "oklch(0.93 0.005 260)",
  sma20: "oklch(0.82 0.16 80)",     // gold
  sma50: "oklch(0.68 0.2 300)",     // purple
  bbUpper: "oklch(0.72 0.18 195 / 40%)",
  bbLower: "oklch(0.72 0.18 195 / 40%)",
  bbFill: "oklch(0.72 0.18 195 / 8%)",
  macdLine: "oklch(0.82 0.16 195)",
  macdSignal: "oklch(0.82 0.16 80)",
  rsiLine: "oklch(0.72 0.18 195)",
};

function formatLargeNum(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
  return v.toFixed(0);
}

export function AdvancedChart({ symbol, exchange, chartData, chartRange, onRangeChange, chartLoading }: AdvancedChartProps) {
  const [showSMA, setShowSMA] = useState(true);
  const [showBB, setShowBB] = useState(true);
  const [showMACD, setShowMACD] = useState(true);
  const [showRSI, setShowRSI] = useState(true);

  // Fetch Bollinger Bands
  const { data: bbData } = trpc.td.bbands.useQuery(
    { symbol, exchange },
    { staleTime: 10 * 60 * 1000, enabled: showBB }
  );

  // Fetch MACD
  const { data: macdData } = trpc.td.macd.useQuery(
    { symbol, exchange },
    { staleTime: 10 * 60 * 1000, enabled: showMACD }
  );

  // Fetch RSI
  const { data: rsiData } = trpc.td.rsi.useQuery(
    { symbol, exchange },
    { staleTime: 10 * 60 * 1000, enabled: showRSI }
  );

  // Merge chart data with overlays
  const mergedData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];

    // Build lookup maps by date
    const bbMap = new Map<string, { upper: number; middle: number; lower: number }>();
    if (bbData?.bands) {
      for (const b of bbData.bands) {
        bbMap.set(b.datetime, b);
      }
    }

    const macdMap = new Map<string, { macd: number; signal: number; histogram: number }>();
    if (macdData?.data) {
      for (const m of macdData.data) {
        macdMap.set(m.datetime, m);
      }
    }

    const rsiMap = new Map<string, number>();
    if (rsiData?.data) {
      for (const r of rsiData.data) {
        rsiMap.set(r.datetime, r.rsi);
      }
    }

    // Compute SMA 20 and SMA 50
    const closes = chartData.map(d => d.close);
    const sma20: (number | null)[] = [];
    const sma50: (number | null)[] = [];

    for (let i = 0; i < closes.length; i++) {
      if (i >= 19) {
        let sum = 0;
        for (let j = i - 19; j <= i; j++) sum += closes[j];
        sma20.push(sum / 20);
      } else {
        sma20.push(null);
      }
      if (i >= 49) {
        let sum = 0;
        for (let j = i - 49; j <= i; j++) sum += closes[j];
        sma50.push(sum / 50);
      } else {
        sma50.push(null);
      }
    }

    return chartData.map((d, i) => {
      const bb = bbMap.get(d.date);
      const macd = macdMap.get(d.date);
      const rsi = rsiMap.get(d.date);
      const isUp = d.close >= (d.open ?? d.close);

      return {
        ...d,
        sma20: sma20[i],
        sma50: sma50[i],
        bbUpper: bb?.upper ?? null,
        bbMiddle: bb?.middle ?? null,
        bbLower: bb?.lower ?? null,
        macd: macd?.macd ?? null,
        macdSignal: macd?.signal ?? null,
        macdHist: macd?.histogram ?? null,
        rsi: rsi ?? null,
        volColor: isUp ? NEON.green : NEON.red,
      };
    });
  }, [chartData, bbData, macdData, rsiData]);

  // Calculate Y domain for price chart
  const priceDomain = useMemo(() => {
    if (mergedData.length === 0) return ["auto", "auto"] as const;
    let min = Infinity, max = -Infinity;
    for (const d of mergedData) {
      const vals = [d.close, d.sma20, d.sma50, d.bbUpper, d.bbLower].filter((v): v is number => v != null);
      for (const v of vals) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const padding = (max - min) * 0.05;
    return [min - padding, max + padding] as const;
  }, [mergedData]);

  const toggles = [
    { key: "sma", label: "SMA", active: showSMA, toggle: () => setShowSMA(!showSMA), color: NEON.sma20 },
    { key: "bb", label: "BB", active: showBB, toggle: () => setShowBB(!showBB), color: NEON.cyanDim },
    { key: "macd", label: "MACD", active: showMACD, toggle: () => setShowMACD(!showMACD), color: NEON.macdLine },
    { key: "rsi", label: "RSI", active: showRSI, toggle: () => setShowRSI(!showRSI), color: NEON.rsiLine },
  ];

  return (
    <Card className="border-border/50 neon-card">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="neon-text">Advanced Chart</span>
            <Badge variant="outline" className="text-[9px] ml-1 border-primary/30 text-primary">
              Live Indicators
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1 flex-wrap">
            {/* Indicator toggles */}
            {toggles.map(t => (
              <Button
                key={t.key}
                variant={t.active ? "default" : "ghost"}
                size="sm"
                className={`h-6 px-2 text-[10px] gap-1 ${t.active ? '' : 'opacity-50'}`}
                onClick={t.toggle}
              >
                {t.active ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                {t.label}
              </Button>
            ))}
            <div className="w-px h-4 bg-border mx-1" />
            {/* Range buttons */}
            {chartRanges.map(r => (
              <Button
                key={r.value}
                variant={chartRange === r.value ? "default" : "ghost"}
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => onRangeChange(r.value)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {chartLoading ? (
          <Skeleton className="h-[350px] w-full rounded-lg" />
        ) : mergedData.length > 0 ? (
          <>
            {/* ═══ Main Price Chart with Overlays ═══ */}
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={mergedData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="neonPriceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={NEON.cyan} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={NEON.cyan} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bbFillGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NEON.cyanDim} stopOpacity={0.08} />
                    <stop offset="100%" stopColor={NEON.cyanDim} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={NEON.grid} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: NEON.text, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fill: NEON.text, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  domain={priceDomain as [number, number]}
                  tickFormatter={(v) => v.toFixed(2)}
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: NEON.tooltip,
                    border: `1px solid ${NEON.tooltipBorder}`,
                    borderRadius: "8px",
                    fontSize: "11px",
                    color: NEON.textBright,
                    boxShadow: `0 0 12px ${NEON.cyanDim}33`,
                  }}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      close: "Close",
                      sma20: "SMA 20",
                      sma50: "SMA 50",
                      bbUpper: "BB Upper",
                      bbLower: "BB Lower",
                    };
                    return [value?.toFixed(3) + " AED", labels[name] || name];
                  }}
                />

                {/* Bollinger Bands fill area */}
                {showBB && (
                  <>
                    <Area type="monotone" dataKey="bbUpper" stroke="none" fill="url(#bbFillGrad)" dot={false} activeDot={false} isAnimationActive={false} />
                    <Area type="monotone" dataKey="bbLower" stroke="none" fill="transparent" dot={false} activeDot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="bbUpper" stroke={NEON.bbUpper} strokeWidth={1} dot={false} activeDot={false} strokeDasharray="4 2" isAnimationActive={false} />
                    <Line type="monotone" dataKey="bbLower" stroke={NEON.bbLower} strokeWidth={1} dot={false} activeDot={false} strokeDasharray="4 2" isAnimationActive={false} />
                  </>
                )}

                {/* SMA lines */}
                {showSMA && (
                  <>
                    <Line type="monotone" dataKey="sma20" stroke={NEON.sma20} strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="sma50" stroke={NEON.sma50} strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive={false} />
                  </>
                )}

                {/* Price line */}
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={NEON.cyan}
                  strokeWidth={2}
                  fill="url(#neonPriceGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: NEON.cyan, stroke: NEON.tooltip, strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center gap-3 px-2 flex-wrap">
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 rounded" style={{ backgroundColor: NEON.cyan }} />
                <span className="text-[9px] text-muted-foreground">Price</span>
              </div>
              {showSMA && (
                <>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 rounded" style={{ backgroundColor: NEON.sma20 }} />
                    <span className="text-[9px] text-muted-foreground">SMA 20</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 rounded" style={{ backgroundColor: NEON.sma50 }} />
                    <span className="text-[9px] text-muted-foreground">SMA 50</span>
                  </div>
                </>
              )}
              {showBB && (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 rounded border border-dashed" style={{ borderColor: NEON.cyanDim }} />
                  <span className="text-[9px] text-muted-foreground">Bollinger Bands</span>
                </div>
              )}
            </div>

            {/* ═══ Volume Chart ═══ */}
            <ResponsiveContainer width="100%" height={60}>
              <BarChart data={mergedData} margin={{ top: 0, right: 5, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis hide width={55} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: NEON.tooltip,
                    border: `1px solid ${NEON.tooltipBorder}`,
                    borderRadius: "8px",
                    fontSize: "11px",
                    color: NEON.textBright,
                  }}
                  formatter={(value: number) => [formatLargeNum(value), "Volume"]}
                />
                <Bar dataKey="volume" radius={[1, 1, 0, 0]}>
                  {mergedData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.volColor + "55"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* ═══ MACD Sub-Chart ═══ */}
            {showMACD && mergedData.some(d => d.macd != null) && (
              <div>
                <div className="flex items-center gap-2 px-2 mb-1">
                  <Activity className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">MACD (12, 26, 9)</span>
                </div>
                <ResponsiveContainer width="100%" height={80}>
                  <ComposedChart data={mergedData} margin={{ top: 2, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={NEON.grid} />
                    <XAxis dataKey="date" hide />
                    <YAxis tick={{ fill: NEON.text, fontSize: 9 }} tickLine={false} axisLine={false} width={55} tickFormatter={(v) => v.toFixed(3)} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: NEON.tooltip,
                        border: `1px solid ${NEON.tooltipBorder}`,
                        borderRadius: "8px",
                        fontSize: "11px",
                        color: NEON.textBright,
                      }}
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = { macd: "MACD", macdSignal: "Signal", macdHist: "Histogram" };
                        return [value?.toFixed(4), labels[name] || name];
                      }}
                    />
                    <ReferenceLine y={0} stroke={NEON.grid} strokeWidth={1} />
                    <Bar dataKey="macdHist" isAnimationActive={false}>
                      {mergedData.map((entry, idx) => (
                        <Cell key={idx} fill={(entry.macdHist ?? 0) >= 0 ? NEON.green + "66" : NEON.red + "66"} />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey="macd" stroke={NEON.macdLine} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="macdSignal" stroke={NEON.macdSignal} strokeWidth={1.5} dot={false} isAnimationActive={false} strokeDasharray="3 2" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ═══ RSI Sub-Chart ═══ */}
            {showRSI && mergedData.some(d => d.rsi != null) && (
              <div>
                <div className="flex items-center gap-2 px-2 mb-1">
                  <Layers className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">RSI (14)</span>
                </div>
                <ResponsiveContainer width="100%" height={70}>
                  <AreaChart data={mergedData} margin={{ top: 2, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rsiGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={NEON.rsiLine} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={NEON.rsiLine} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={NEON.grid} />
                    <XAxis dataKey="date" hide />
                    <YAxis
                      tick={{ fill: NEON.text, fontSize: 9 }}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                      ticks={[30, 50, 70]}
                      width={55}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: NEON.tooltip,
                        border: `1px solid ${NEON.tooltipBorder}`,
                        borderRadius: "8px",
                        fontSize: "11px",
                        color: NEON.textBright,
                      }}
                      formatter={(value: number) => [value?.toFixed(2), "RSI"]}
                    />
                    <ReferenceLine y={70} stroke={NEON.red + "55"} strokeDasharray="4 2" label={{ value: "70", fill: NEON.red, fontSize: 9, position: "right" }} />
                    <ReferenceLine y={30} stroke={NEON.green + "55"} strokeDasharray="4 2" label={{ value: "30", fill: NEON.green, fontSize: 9, position: "right" }} />
                    <Area type="monotone" dataKey="rsi" stroke={NEON.rsiLine} strokeWidth={1.5} fill="url(#rsiGrad)" dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No chart data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
