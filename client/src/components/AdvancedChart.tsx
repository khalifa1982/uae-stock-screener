/**
 * Advanced Chart Component with Technical Indicator Overlays
 * 
 * Features:
 * - Price chart with SMA 20/50 overlays
 * - Bollinger Bands overlay
 * - Volume bars with color coding (green=up, red=down)
 * - MACD sub-chart with histogram
 * - RSI sub-chart with overbought/oversold zones
 * - Enhanced toolbar with drawing tools, crosshair, chart type selector
 * - Proactive price alerts and annotations
 * - Neon stock-market aesthetic
 * - Mobile responsive
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
  Brush, Customized, ReferenceArea,
} from "recharts";
import {
  BarChart3, TrendingUp, Activity, Layers, Eye, EyeOff,
  Crosshair, Minus, TrendingDown, Maximize2, Minimize2,
  CandlestickChart, LineChart as LineChartIcon, BarChart2,
  Pencil, Ruler, Type, Eraser, Download, Camera, Settings2,
  ZoomIn, ZoomOut, RotateCcw, AlertTriangle, Bell, ChevronDown,
  Sparkles,
} from "lucide-react";
import { AbboudFibOverlay, AbboudSignalCard, useAbboudIndicator, setAbboudOverlayData, AbboudSVGRendererDirect } from "./AbboudIndicatorOverlay";

interface AdvancedChartProps {
  symbol: string;
  exchange: "ADX" | "DFM";
  chartData: Array<{ date: string; isoDate?: string; close: number; volume: number; open?: number; high?: number; low?: number }>;
  chartRange: string;
  onRangeChange: (range: string) => void;
  chartLoading: boolean;
}

const chartRanges = [
  { label: "1D", value: "1d" },
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
  sma20: "oklch(0.82 0.16 80)",
  sma50: "oklch(0.68 0.2 300)",
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

type ChartType = "area" | "candlestick" | "line" | "bar";
type DrawingTool = "none" | "trendline" | "horizontal" | "text" | "measure";

/** Custom Candlestick shape for Recharts */
function CandlestickShape(props: any) {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  const { open, close, high, low } = payload;
  if (open == null || close == null || high == null || low == null) return null;
  
  const isUp = close >= open;
  const color = isUp ? NEON.green : NEON.red;
  const bodyTop = Math.min(y, y + height);
  const bodyHeight = Math.abs(height) || 1;
  const midX = x + width / 2;
  
  // Scale wick positions relative to body
  const priceRange = props.yAxis?.scale;
  if (!priceRange) return (
    <rect x={x} y={bodyTop} width={width} height={bodyHeight} fill={color} rx={1} />
  );
  
  return (
    <g>
      {/* Wick */}
      <line x1={midX} y1={priceRange(high)} x2={midX} y2={priceRange(low)} stroke={color} strokeWidth={1} />
      {/* Body */}
      <rect
        x={x + 1}
        y={priceRange(Math.max(open, close))}
        width={Math.max(width - 2, 2)}
        height={Math.max(Math.abs(priceRange(open) - priceRange(close)), 1)}
        fill={isUp ? "transparent" : color}
        stroke={color}
        strokeWidth={1}
        rx={1}
      />
    </g>
  );
}

/** Chart toolbar with drawing tools and chart type selector */
function ChartToolbar({
  chartType, setChartType,
  drawingTool, setDrawingTool,
  showCrosshair, setShowCrosshair,
  isExpanded, setIsExpanded,
  onResetZoom,
}: {
  chartType: ChartType;
  setChartType: (t: ChartType) => void;
  drawingTool: DrawingTool;
  setDrawingTool: (t: DrawingTool) => void;
  showCrosshair: boolean;
  setShowCrosshair: (v: boolean) => void;
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
  onResetZoom: () => void;
}) {
  const chartTypes: { type: ChartType; icon: React.ReactNode; label: string }[] = [
    { type: "area", icon: <BarChart3 className="h-3 w-3" />, label: "Area" },
    { type: "candlestick", icon: <CandlestickChart className="h-3 w-3" />, label: "Candlestick" },
    { type: "line", icon: <LineChartIcon className="h-3 w-3" />, label: "Line" },
    { type: "bar", icon: <BarChart2 className="h-3 w-3" />, label: "OHLC" },
  ];

  const drawingTools: { tool: DrawingTool; icon: React.ReactNode; label: string }[] = [
    { tool: "trendline", icon: <TrendingUp className="h-3 w-3" />, label: "Trend Line" },
    { tool: "horizontal", icon: <Minus className="h-3 w-3" />, label: "Horizontal" },
    { tool: "measure", icon: <Ruler className="h-3 w-3" />, label: "Measure" },
    { tool: "text", icon: <Type className="h-3 w-3" />, label: "Text" },
  ];

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {/* Chart Type Selector */}
      <div className="flex items-center bg-secondary/30 rounded-md p-0.5 mr-1">
        {chartTypes.map(ct => (
          <Button
            key={ct.type}
            variant={chartType === ct.type ? "default" : "ghost"}
            size="sm"
            className={`h-5 w-5 p-0 ${chartType === ct.type ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setChartType(ct.type)}
            title={ct.label}
          >
            {ct.icon}
          </Button>
        ))}
      </div>

      {/* Separator */}
      <div className="w-px h-4 bg-border/40 mx-0.5" />

      {/* Drawing Tools */}
      <div className="flex items-center gap-0.5">
        {drawingTools.map(dt => (
          <Button
            key={dt.tool}
            variant={drawingTool === dt.tool ? "default" : "ghost"}
            size="sm"
            className={`h-5 w-5 p-0 ${drawingTool === dt.tool ? "bg-chart-2/20 text-chart-2" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setDrawingTool(drawingTool === dt.tool ? "none" : dt.tool)}
            title={dt.label}
          >
            {dt.icon}
          </Button>
        ))}
        {drawingTool !== "none" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-muted-foreground hover:text-loss"
            onClick={() => setDrawingTool("none")}
            title="Clear Drawing"
          >
            <Eraser className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Separator */}
      <div className="w-px h-4 bg-border/40 mx-0.5" />

      {/* Crosshair */}
      <Button
        variant={showCrosshair ? "default" : "ghost"}
        size="sm"
        className={`h-5 w-5 p-0 ${showCrosshair ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
        onClick={() => setShowCrosshair(!showCrosshair)}
        title="Crosshair"
      >
        <Crosshair className="h-3 w-3" />
      </Button>

      {/* Reset Zoom */}
      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
        onClick={onResetZoom}
        title="Reset Zoom"
      >
        <RotateCcw className="h-3 w-3" />
      </Button>

      {/* Expand/Collapse */}
      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? "Collapse" : "Expand"}
      >
        {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
      </Button>
    </div>
  );
}

/** Proactive price annotation showing key levels */
function PriceAnnotations({ data, currentPrice }: { data: any[]; currentPrice: number }) {
  if (!data || data.length < 5) return null;

  const closes = data.map(d => d.close).filter(Boolean);
  const high52 = Math.max(...closes);
  const low52 = Math.min(...closes);
  const avg = closes.reduce((a, b) => a + b, 0) / closes.length;
  const distFromHigh = ((currentPrice - high52) / high52 * 100).toFixed(1);
  const distFromLow = ((currentPrice - low52) / low52 * 100).toFixed(1);

  return (
    <div className="flex items-center gap-2 px-2 py-1 flex-wrap">
      <div className="flex items-center gap-1 text-[9px]">
        <div className="w-1.5 h-1.5 rounded-full bg-gain" />
        <span className="text-muted-foreground">52W High:</span>
        <span className="font-mono font-medium text-foreground">{high52.toFixed(3)}</span>
        <span className="text-loss text-[8px]">({distFromHigh}%)</span>
      </div>
      <div className="flex items-center gap-1 text-[9px]">
        <div className="w-1.5 h-1.5 rounded-full bg-loss" />
        <span className="text-muted-foreground">52W Low:</span>
        <span className="font-mono font-medium text-foreground">{low52.toFixed(3)}</span>
        <span className="text-gain text-[8px]">(+{distFromLow}%)</span>
      </div>
      <div className="flex items-center gap-1 text-[9px]">
        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
        <span className="text-muted-foreground">Avg:</span>
        <span className="font-mono font-medium text-foreground">{avg.toFixed(3)}</span>
      </div>
      {/* Proactive signal */}
      {currentPrice >= high52 * 0.98 && (
        <Badge variant="outline" className="text-[8px] px-1 py-0 border-gain/30 text-gain animate-pulse">
          <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> Near 52W High
        </Badge>
      )}
      {currentPrice <= low52 * 1.02 && (
        <Badge variant="outline" className="text-[8px] px-1 py-0 border-loss/30 text-loss animate-pulse">
          <TrendingDown className="h-2.5 w-2.5 mr-0.5" /> Near 52W Low
        </Badge>
      )}
    </div>
  );
}

/** Enhanced custom tooltip with OHLCV data */
function EnhancedTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div
      className="rounded-lg border px-3 py-2 text-[10px] shadow-lg"
      style={{
        backgroundColor: NEON.tooltip,
        borderColor: NEON.tooltipBorder,
        color: NEON.textBright,
        boxShadow: `0 0 16px ${NEON.cyanDim}22`,
      }}
    >
      <div className="font-semibold text-[11px] mb-1 text-primary">{d.date}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        {d.open != null && (
          <>
            <span className="text-muted-foreground">Open</span>
            <span className="font-mono text-right">{d.open.toFixed(3)}</span>
          </>
        )}
        {d.high != null && (
          <>
            <span className="text-muted-foreground">High</span>
            <span className="font-mono text-right" style={{ color: NEON.green }}>{d.high.toFixed(3)}</span>
          </>
        )}
        {d.low != null && (
          <>
            <span className="text-muted-foreground">Low</span>
            <span className="font-mono text-right" style={{ color: NEON.red }}>{d.low.toFixed(3)}</span>
          </>
        )}
        <span className="text-muted-foreground">Close</span>
        <span className="font-mono font-bold text-right">{d.close.toFixed(3)}</span>
        {d.volume != null && (
          <>
            <span className="text-muted-foreground">Volume</span>
            <span className="font-mono text-right">{formatLargeNum(d.volume)}</span>
          </>
        )}
        {d.sma20 != null && (
          <>
            <span style={{ color: NEON.sma20 }}>SMA 20</span>
            <span className="font-mono text-right" style={{ color: NEON.sma20 }}>{d.sma20.toFixed(3)}</span>
          </>
        )}
        {d.sma50 != null && (
          <>
            <span style={{ color: NEON.sma50 }}>SMA 50</span>
            <span className="font-mono text-right" style={{ color: NEON.sma50 }}>{d.sma50.toFixed(3)}</span>
          </>
        )}
      </div>
      {/* Change indicator */}
      {d.open != null && (
        <div className={`mt-1 pt-1 border-t border-border/20 font-semibold ${d.close >= d.open ? "text-gain" : "text-loss"}`}>
          {d.close >= d.open ? "+" : ""}{((d.close - d.open) / d.open * 100).toFixed(2)}%
        </div>
      )}
    </div>
  );
}

export function AdvancedChart({ symbol, exchange, chartData, chartRange, onRangeChange, chartLoading }: AdvancedChartProps) {
  const [showSMA, setShowSMA] = useState(true);
  const [showBB, setShowBB] = useState(true);
  const [showMACD, setShowMACD] = useState(true);
  const [showRSI, setShowRSI] = useState(true);
  const [chartType, setChartType] = useState<ChartType>("area");
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("none");
  const [showCrosshair, setShowCrosshair] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [brushRange, setBrushRange] = useState<{ startIndex?: number; endIndex?: number }>({});
  const [showAbboud, setShowAbboud] = useState(false);

  // Fetch Abboud AI Indicator
  const { data: abboudData } = useAbboudIndicator(symbol, exchange, showAbboud);

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
      const lookupKey = d.isoDate || d.date;
      const bb = bbMap.get(lookupKey);
      const macd = macdMap.get(lookupKey);
      const rsi = rsiMap.get(lookupKey);
      const isUp = d.close >= (d.open ?? d.close);

      // Candlestick: body is the range between open and close
      const openPrice = d.open ?? d.close;
      const candleBottom = Math.min(openPrice, d.close);
      const candleTop = Math.max(openPrice, d.close);
      const candleBody = candleTop - candleBottom || 0.001; // min body size

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
        candleBottom,
        candleBody,
        candleHigh: d.high ?? candleTop,
        candleLow: d.low ?? candleBottom,
      };
    });
  }, [chartData, bbData, macdData, rsiData]);

  // Calculate Y domain for price chart (includes Fibonacci levels when Abboud is active)
  const priceDomain = useMemo(() => {
    if (mergedData.length === 0) return ["auto", "auto"] as const;
    let min = Infinity, max = -Infinity;
    for (const d of mergedData) {
      const vals = [d.close, d.open, d.high, d.low, d.sma20, d.sma50, d.bbUpper, d.bbLower].filter((v): v is number => v != null);
      for (const v of vals) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    // Expand domain to include key Abboud levels (retracement only, not extensions)
    // Extensions and far targets are shown but don't force domain expansion to avoid
    // compressing the visible price action into a tiny band
    if (showAbboud && abboudData) {
      const priceRange = max - min;
      const maxExpansion = priceRange * 2; // Don't expand more than 2x the price range
      const domainCeiling = max + maxExpansion;
      const domainFloor = min - maxExpansion;

      // Only include retracement levels (not extensions) in domain
      for (const fib of abboudData.fibLevels) {
        if (fib.type === "retracement" && fib.price > 0) {
          if (fib.price < min && fib.price >= domainFloor) min = fib.price;
          if (fib.price > max && fib.price <= domainCeiling) max = fib.price;
        }
      }
      if (abboudData.signal.stopLoss) {
        const sl = abboudData.signal.stopLoss;
        if (sl < min && sl >= domainFloor) min = sl;
        if (sl > max && sl <= domainCeiling) max = sl;
      }
      if (abboudData.signal.entryZone) {
        const ez = abboudData.signal.entryZone;
        if (ez.low < min && ez.low >= domainFloor) min = ez.low;
        if (ez.high > max && ez.high <= domainCeiling) max = ez.high;
      }
      // Only include the first target (TP1) in domain, not far extensions
      if (abboudData.signal.targets.length > 0) {
        const tp1 = abboudData.signal.targets[0].price;
        if (tp1 < min && tp1 >= domainFloor) min = tp1;
        if (tp1 > max && tp1 <= domainCeiling) max = tp1;
      }
    }
    const padding = (max - min) * 0.05;
    return [min - padding, max + padding] as const;
  }, [mergedData, showAbboud, abboudData]);

  const currentPrice = mergedData.length > 0 ? mergedData[mergedData.length - 1].close : 0;

  const handleResetZoom = useCallback(() => {
    setBrushRange({});
  }, []);

  const toggles = [
    { key: "sma", label: "SMA", active: showSMA, toggle: () => setShowSMA(!showSMA), color: NEON.sma20 },
    { key: "bb", label: "BB", active: showBB, toggle: () => setShowBB(!showBB), color: NEON.cyanDim },
    { key: "macd", label: "MACD", active: showMACD, toggle: () => setShowMACD(!showMACD), color: NEON.macdLine },
    { key: "rsi", label: "RSI", active: showRSI, toggle: () => setShowRSI(!showRSI), color: NEON.rsiLine },
    { key: "abboud", label: "Aboood.AI", active: showAbboud, toggle: () => setShowAbboud(!showAbboud), color: NEON.gold },
  ];

  const chartHeight = isExpanded ? 450 : 280;

  return (
    <Card className={`border-border/50 neon-card ${isExpanded ? "fixed inset-4 z-50 overflow-auto" : ""}`}>
      <CardHeader className="pb-1">
        <div className="flex flex-col gap-1">
          {/* Row 1: Title + Chart Tools */}
          <div className="flex items-center justify-between flex-wrap gap-1">
            <CardTitle className="text-xs font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="neon-text">Advanced Chart</span>
              <Badge variant="outline" className="text-[9px] ml-1 border-primary/30 text-primary">
                Live Indicators
              </Badge>
              {drawingTool !== "none" && (
                <Badge variant="outline" className="text-[9px] border-chart-2/30 text-chart-2 animate-pulse">
                  <Pencil className="h-2.5 w-2.5 mr-0.5" /> {drawingTool}
                </Badge>
              )}
            </CardTitle>
            <ChartToolbar
              chartType={chartType}
              setChartType={setChartType}
              drawingTool={drawingTool}
              setDrawingTool={setDrawingTool}
              showCrosshair={showCrosshair}
              setShowCrosshair={setShowCrosshair}
              isExpanded={isExpanded}
              setIsExpanded={setIsExpanded}
              onResetZoom={handleResetZoom}
            />
          </div>
          {/* Row 2: Indicator Toggles + Range Buttons */}
          <div className="flex items-center gap-1 flex-wrap">
            {toggles.map(t => (
              <Button
                key={t.key}
                variant={t.active ? "default" : "ghost"}
                size="sm"
                className={`h-5 px-1.5 text-[9px] gap-0.5 ${t.active ? '' : 'opacity-50'} ${t.key === 'abboud' && t.active ? 'ring-1 ring-[oklch(0.82_0.16_80)] bg-[oklch(0.82_0.16_80)]/15' : ''}`}
                onClick={t.toggle}
                style={t.key === 'abboud' ? { color: t.active ? NEON.gold : undefined } : undefined}
              >
                {t.key === 'abboud' ? <Sparkles className="h-2.5 w-2.5" style={{ color: t.active ? NEON.gold : undefined }} /> : (t.active ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />)}
                {t.label}
              </Button>
            ))}
            <div className="w-px h-4 bg-border mx-0.5" />
            {chartRanges.map(r => (
              <Button
                key={r.value}
                variant={chartRange === r.value ? "default" : "ghost"}
                size="sm"
                className="h-5 px-1.5 text-[9px]"
                onClick={() => onRangeChange(r.value)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 px-2">
        {chartLoading ? (
          <Skeleton className="h-[350px] w-full rounded" />
        ) : mergedData.length > 0 ? (
          <>
            {/* Proactive Annotations */}
            <PriceAnnotations data={mergedData} currentPrice={currentPrice} />

            {/* ═══ Main Price Chart with Overlays ═══ */}
            <ResponsiveContainer width="100%" height={chartHeight}>
              <ComposedChart
                data={mergedData}
                margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
                style={{ cursor: drawingTool !== "none" ? "crosshair" : showCrosshair ? "crosshair" : "default" }}
              >
                <defs>
                  <linearGradient id="neonPriceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={NEON.cyan} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={NEON.cyan} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bbFillGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NEON.cyanDim} stopOpacity={0.08} />
                    <stop offset="100%" stopColor={NEON.cyanDim} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="greenVolGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NEON.green} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={NEON.green} stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={NEON.grid} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: NEON.text, fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fill: NEON.text, fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  domain={priceDomain as [number, number]}
                  tickFormatter={(v) => v.toFixed(2)}
                  width={52}
                />
                <Tooltip content={<EnhancedTooltip />} />

                {/* Bollinger Bands */}
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

                {/* Price rendering based on chart type */}
                {chartType === "area" && (
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke={NEON.cyan}
                    strokeWidth={2}
                    fill="url(#neonPriceGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: NEON.cyan, stroke: NEON.tooltip, strokeWidth: 2 }}
                  />
                )}
                {chartType === "line" && (
                  <Line
                    type="monotone"
                    dataKey="close"
                    stroke={NEON.cyan}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: NEON.cyan, stroke: NEON.tooltip, strokeWidth: 2 }}
                  />
                )}
                {chartType === "bar" && (
                  <Bar dataKey="close" radius={[1, 1, 0, 0]}>
                    {mergedData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.close >= (entry.open ?? entry.close) ? NEON.green + "88" : NEON.red + "88"} />
                    ))}
                  </Bar>
                )}
                {chartType === "candlestick" && (
                  <>
                    {/* Invisible bar to set the base (candleBottom) */}
                    <Bar dataKey="candleBottom" stackId="candle" barSize={6} fill="transparent" />
                    {/* Visible body bar stacked on top */}
                    <Bar dataKey="candleBody" stackId="candle" barSize={6}>
                      {mergedData.map((entry, idx) => {
                        const isBullish = entry.close >= (entry.open ?? entry.close);
                        return <Cell key={idx} fill={isBullish ? NEON.green : NEON.red} />;
                      })}
                    </Bar>
                    {/* Wicks drawn via Customized SVG */}
                    <Customized component={(props: any) => {
                      const { xAxisMap, yAxisMap, offset } = props;
                      if (!xAxisMap || !yAxisMap) return null;
                      const xAxis = Object.values(xAxisMap)[0] as any;
                      const yAxis = Object.values(yAxisMap)[0] as any;
                      if (!xAxis?.scale || !yAxis?.scale) return null;
                      return (
                        <g>
                          {mergedData.map((entry, idx) => {
                            const x = xAxis.scale(idx) + (xAxis.bandSize ? xAxis.bandSize / 2 : 0);
                            const yHigh = yAxis.scale(entry.candleHigh);
                            const yLow = yAxis.scale(entry.candleLow);
                            const isBullish = entry.close >= (entry.open ?? entry.close);
                            return (
                              <line
                                key={`wick-${idx}`}
                                x1={x}
                                x2={x}
                                y1={yHigh}
                                y2={yLow}
                                stroke={isBullish ? NEON.green : NEON.red}
                                strokeWidth={1}
                              />
                            );
                          })}
                        </g>
                      );
                    }} />
                  </>
                )}

                {/* Abboud AI Fibonacci Overlay - rendered as direct Customized child */}
                {showAbboud && abboudData && (
                  <Customized component={(chartProps: any) => {
                    // Set the module-level data for the renderer
                    setAbboudOverlayData({
                      fibLevels: abboudData.fibLevels,
                      entryZone: abboudData.signal.entryZone,
                      stopLoss: abboudData.signal.stopLoss,
                      targets: abboudData.signal.targets,
                      currentPrice: abboudData.currentPrice,
                      priceProjection: abboudData.signal.priceProjection ?? [],
                    });
                    return <AbboudSVGRendererDirect {...chartProps} />;
                  }} />
                )}

                {/* Zoom brush */}
                <Brush
                  dataKey="date"
                  height={20}
                  stroke={NEON.cyanDim + "44"}
                  fill={NEON.tooltip}
                  tickFormatter={() => ""}
                  startIndex={brushRange.startIndex}
                  endIndex={brushRange.endIndex}
                  onChange={(range: any) => setBrushRange(range)}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center gap-1.5 px-2 flex-wrap">
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 rounded" style={{ backgroundColor: NEON.cyan }} />
                <span className="text-[8px] text-muted-foreground">Price</span>
              </div>
              {showSMA && (
                <>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 rounded" style={{ backgroundColor: NEON.sma20 }} />
                    <span className="text-[8px] text-muted-foreground">SMA 20</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 rounded" style={{ backgroundColor: NEON.sma50 }} />
                    <span className="text-[8px] text-muted-foreground">SMA 50</span>
                  </div>
                </>
              )}
              {showBB && (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 rounded border border-dashed" style={{ borderColor: NEON.cyanDim }} />
                  <span className="text-[8px] text-muted-foreground">Bollinger Bands</span>
                </div>
              )}
              {showAbboud && (
                <>
                  <div className="flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5" style={{ color: NEON.gold }} />
                    <span className="text-[8px]" style={{ color: NEON.gold }}>Aboood.AI Thoughts</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-1.5 rounded-sm" style={{ backgroundColor: "rgba(224, 64, 251, 0.3)", border: "1px solid rgba(224, 64, 251, 0.6)" }} />
                    <span className="text-[8px] text-muted-foreground">Entry Zone</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 rounded" style={{ backgroundColor: "#ff1744" }} />
                    <span className="text-[8px] text-muted-foreground">Stop Loss</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 rounded" style={{ backgroundColor: "#00e676" }} />
                    <span className="text-[8px] text-muted-foreground">Targets</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 rounded" style={{ backgroundColor: "#448aff" }} />
                    <span className="text-[8px] text-muted-foreground">Projection</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 rounded border-dashed" style={{ borderTop: "1px dashed #ffd54f" }} />
                    <span className="text-[8px] text-muted-foreground">Fib Levels</span>
                  </div>
                </>
              )}
            </div>

            {/* ═══ Volume Chart ═══ */}
            <ResponsiveContainer width="100%" height={50}>
              <BarChart data={mergedData} margin={{ top: 0, right: 5, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis hide width={52} />
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
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">MACD (12, 26, 9)</span>
                </div>
                <ResponsiveContainer width="100%" height={70}>
                  <ComposedChart data={mergedData} margin={{ top: 2, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={NEON.grid} />
                    <XAxis dataKey="date" hide />
                    <YAxis tick={{ fill: NEON.text, fontSize: 8 }} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => v.toFixed(3)} />
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

            {/* ═══ Aboood.AI Thoughts Signal Card ═══ */}
            {showAbboud && (
              <AbboudSignalCard symbol={symbol} exchange={exchange} enabled={showAbboud} />
            )}

            {/* ═══ RSI Sub-Chart ═══ */}
            {showRSI && mergedData.some(d => d.rsi != null) && (
              <div>
                <div className="flex items-center gap-2 px-2 mb-1">
                  <Layers className="h-3 w-3 text-primary" />
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">RSI (14)</span>
                </div>
                <ResponsiveContainer width="100%" height={60}>
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
                      tick={{ fill: NEON.text, fontSize: 8 }}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                      ticks={[30, 50, 70]}
                      width={52}
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
                    <ReferenceLine y={70} stroke={NEON.red + "55"} strokeDasharray="4 2" label={{ value: "70", fill: NEON.red, fontSize: 8, position: "right" }} />
                    <ReferenceLine y={30} stroke={NEON.green + "55"} strokeDasharray="4 2" label={{ value: "30", fill: NEON.green, fontSize: 8, position: "right" }} />
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
