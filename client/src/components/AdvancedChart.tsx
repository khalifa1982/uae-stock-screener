/**
 * Advanced Chart Component v2.0 — Premium Redesign
 * 
 * Features:
 * - Proper SVG-based candlestick rendering with smooth animations
 * - Price chart with SMA 20/50 overlays & Bollinger Bands
 * - Volume bars with gradient color coding
 * - MACD sub-chart with histogram
 * - RSI sub-chart with overbought/oversold zones
 * - Enhanced toolbar with drawing tools, crosshair, chart type selector
 * - Proactive price alerts and annotations
 * - Premium glassmorphism aesthetic with animated gradients
 * - Framer Motion page/chart entrance animations
 * - Mobile responsive
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

// Premium neon color palette — enhanced
const NEON = {
  cyan: "oklch(0.82 0.16 195)",
  cyanDim: "oklch(0.72 0.18 195)",
  cyanGlow: "oklch(0.82 0.16 195 / 30%)",
  green: "oklch(0.78 0.2 155)",
  greenDim: "oklch(0.78 0.2 155 / 45%)",
  greenGlow: "oklch(0.78 0.2 155 / 20%)",
  red: "oklch(0.65 0.24 25)",
  redDim: "oklch(0.65 0.24 25 / 45%)",
  redGlow: "oklch(0.65 0.24 25 / 20%)",
  purple: "oklch(0.68 0.2 300)",
  gold: "oklch(0.82 0.16 80)",
  grid: "oklch(0.18 0.012 260)",
  gridLight: "oklch(0.22 0.012 260)",
  tooltip: "oklch(0.09 0.015 260 / 95%)",
  tooltipBorder: "oklch(0.35 0.02 220 / 40%)",
  text: "oklch(0.55 0.015 260)",
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

/** Chart toolbar with drawing tools and chart type selector */
function ChartToolbar({
  chartType, setChartType,
  drawingTool, setDrawingTool,
  showCrosshair, setShowCrosshair,
  isExpanded, setIsExpanded,
  onResetZoom, onZoomIn, onZoomOut,
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
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  const chartTypes: { type: ChartType; icon: React.ReactNode; label: string }[] = [
    { type: "candlestick", icon: <CandlestickChart className="h-3.5 w-3.5" />, label: "Candlestick" },
    { type: "area", icon: <BarChart3 className="h-3.5 w-3.5" />, label: "Area" },
    { type: "line", icon: <LineChartIcon className="h-3.5 w-3.5" />, label: "Line" },
    { type: "bar", icon: <BarChart2 className="h-3.5 w-3.5" />, label: "OHLC" },
  ];

  const drawingTools: { tool: DrawingTool; icon: React.ReactNode; label: string }[] = [
    { tool: "trendline", icon: <TrendingUp className="h-3.5 w-3.5" />, label: "Trend Line" },
    { tool: "horizontal", icon: <Minus className="h-3.5 w-3.5" />, label: "Horizontal" },
    { tool: "measure", icon: <Ruler className="h-3.5 w-3.5" />, label: "Measure" },
    { tool: "text", icon: <Type className="h-3.5 w-3.5" />, label: "Text" },
  ];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Chart Type Selector — pill style */}
      <div className="flex items-center bg-secondary/40 rounded-lg p-0.5 gap-0.5">
        {chartTypes.map(ct => (
          <button
            key={ct.type}
            className={`h-6 w-6 flex items-center justify-center rounded-md transition-all duration-200 ${
              chartType === ct.type
                ? "bg-primary/20 text-primary shadow-sm shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
            onClick={() => setChartType(ct.type)}
            title={ct.label}
          >
            {ct.icon}
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-border/30 mx-1" />

      {/* Drawing Tools */}
      <div className="flex items-center gap-0.5">
        {drawingTools.map(dt => (
          <button
            key={dt.tool}
            className={`h-6 w-6 flex items-center justify-center rounded-md transition-all duration-200 ${
              drawingTool === dt.tool
                ? "bg-chart-2/20 text-chart-2 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
            onClick={() => setDrawingTool(drawingTool === dt.tool ? "none" : dt.tool)}
            title={dt.label}
          >
            {dt.icon}
          </button>
        ))}
        {drawingTool !== "none" && (
          <button
            className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-loss hover:bg-loss/10 transition-all"
            onClick={() => setDrawingTool("none")}
            title="Clear Drawing"
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-border/30 mx-1" />

      {/* Crosshair + Zoom */}
      <div className="flex items-center gap-0.5">
        <button
          className={`h-6 w-6 flex items-center justify-center rounded-md transition-all duration-200 ${
            showCrosshair ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setShowCrosshair(!showCrosshair)}
          title="Crosshair"
        >
          <Crosshair className="h-3.5 w-3.5" />
        </button>
        <button
          className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
          onClick={onZoomIn}
          title="Zoom In"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
          onClick={onZoomOut}
          title="Zoom Out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
          onClick={onResetZoom}
          title="Reset Zoom"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Expand/Collapse */}
      <button
        className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all ml-1"
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? "Collapse" : "Expand"}
      >
        {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      </button>
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
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="flex items-center gap-3 px-3 py-1.5 flex-wrap bg-secondary/20 rounded-lg border border-border/20"
    >
      <div className="flex items-center gap-1.5 text-[10px]">
        <div className="w-2 h-2 rounded-full bg-gain shadow-sm shadow-gain/30" />
        <span className="text-muted-foreground">52W High:</span>
        <span className="font-mono font-semibold text-foreground">{high52.toFixed(3)}</span>
        <span className="text-loss text-[9px] font-medium">({distFromHigh}%)</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px]">
        <div className="w-2 h-2 rounded-full bg-loss shadow-sm shadow-loss/30" />
        <span className="text-muted-foreground">52W Low:</span>
        <span className="font-mono font-semibold text-foreground">{low52.toFixed(3)}</span>
        <span className="text-gain text-[9px] font-medium">(+{distFromLow}%)</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px]">
        <div className="w-2 h-2 rounded-full bg-primary shadow-sm shadow-primary/30" />
        <span className="text-muted-foreground">Avg:</span>
        <span className="font-mono font-semibold text-foreground">{avg.toFixed(3)}</span>
      </div>
      {currentPrice >= high52 * 0.98 && (
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-gain/40 text-gain bg-gain/5 animate-pulse">
          <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> Near 52W High
        </Badge>
      )}
      {currentPrice <= low52 * 1.02 && (
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-loss/40 text-loss bg-loss/5 animate-pulse">
          <TrendingDown className="h-2.5 w-2.5 mr-0.5" /> Near 52W Low
        </Badge>
      )}
    </motion.div>
  );
}

/** Premium enhanced tooltip with glassmorphism */
function EnhancedTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  const isUp = d.close >= (d.open ?? d.close);

  return (
    <div
      className="rounded-xl border px-3.5 py-2.5 text-[10px] shadow-2xl backdrop-blur-xl"
      style={{
        backgroundColor: NEON.tooltip,
        borderColor: NEON.tooltipBorder,
        color: NEON.textBright,
        boxShadow: `0 8px 32px oklch(0 0 0 / 40%), 0 0 16px ${NEON.cyanGlow}`,
      }}
    >
      <div className="font-semibold text-[11px] mb-1.5 text-primary font-heading tracking-tight">{d.date}</div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-1">
        {d.open != null && (
          <>
            <span className="text-muted-foreground">Open</span>
            <span className="font-mono text-right font-medium">{d.open.toFixed(3)}</span>
          </>
        )}
        {d.high != null && (
          <>
            <span className="text-muted-foreground">High</span>
            <span className="font-mono text-right font-medium" style={{ color: NEON.green }}>{d.high.toFixed(3)}</span>
          </>
        )}
        {d.low != null && (
          <>
            <span className="text-muted-foreground">Low</span>
            <span className="font-mono text-right font-medium" style={{ color: NEON.red }}>{d.low.toFixed(3)}</span>
          </>
        )}
        <span className="text-muted-foreground">Close</span>
        <span className="font-mono font-bold text-right">{d.close.toFixed(3)}</span>
        {d.volume != null && (
          <>
            <span className="text-muted-foreground">Volume</span>
            <span className="font-mono text-right font-medium">{formatLargeNum(d.volume)}</span>
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
      {d.open != null && (
        <div className={`mt-1.5 pt-1.5 border-t border-border/20 font-semibold text-[11px] ${isUp ? "text-gain" : "text-loss"}`}>
          {isUp ? "+" : ""}{((d.close - d.open) / d.open * 100).toFixed(2)}%
          <span className="text-[9px] font-normal text-muted-foreground ml-2">
            {isUp ? "Bullish" : "Bearish"}
          </span>
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
  const [chartType, setChartType] = useState<ChartType>("candlestick");
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

      const openPrice = d.open ?? d.close;
      const candleBottom = Math.min(openPrice, d.close);
      const candleTop = Math.max(openPrice, d.close);
      const candleBody = candleTop - candleBottom || 0.001;

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
        volColor: isUp ? NEON.greenDim : NEON.redDim,
        candleBottom,
        candleBody,
        candleHigh: d.high ?? candleTop,
        candleLow: d.low ?? candleBottom,
      };
    });
  }, [chartData, bbData, macdData, rsiData]);

  // Calculate Y domain for price chart
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
    // Include Abboud levels in domain
    if (showAbboud && abboudData) {
      const levels = [
        abboudData.signal.stopLoss,
        ...(abboudData.signal.targets || []),
        abboudData.signal.entryZone?.low,
        abboudData.signal.entryZone?.high,
      ].filter((v): v is number => v != null);
      for (const v of levels) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const pad = (max - min) * 0.05;
    return [min - pad, max + pad] as const;
  }, [mergedData, showAbboud, abboudData]);

  const currentPrice = mergedData.length > 0 ? mergedData[mergedData.length - 1].close : 0;

  // Zoom handlers
  const handleResetZoom = useCallback(() => setBrushRange({}), []);

  const handleZoomIn = useCallback(() => {
    const len = mergedData.length;
    if (len < 8) return;
    const start = brushRange.startIndex ?? 0;
    const end = brushRange.endIndex ?? len - 1;
    const visibleLen = end - start;
    if (visibleLen < 8) return;
    const step = Math.max(1, Math.floor(visibleLen * 0.15));
    setBrushRange({
      startIndex: Math.min(start + step, end - 4),
      endIndex: Math.max(end - step, start + 4),
    });
  }, [mergedData.length, brushRange]);

  const handleZoomOut = useCallback(() => {
    const len = mergedData.length;
    if (len < 2) return;
    const start = brushRange.startIndex ?? 0;
    const end = brushRange.endIndex ?? len - 1;
    const visibleLen = end - start;
    const step = Math.max(1, Math.floor(visibleLen * 0.2));
    const newStart = Math.max(0, start - step);
    const newEnd = Math.min(len - 1, end + step);
    if (newStart === 0 && newEnd === len - 1) {
      setBrushRange({});
    } else {
      setBrushRange({ startIndex: newStart, endIndex: newEnd });
    }
  }, [mergedData.length, brushRange]);

  // Mouse wheel zoom
  const chartContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      if (e.deltaY < 0) handleZoomIn();
      else handleZoomOut();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [handleZoomIn, handleZoomOut]);

  const toggles = [
    { key: "sma", label: "SMA", active: showSMA, toggle: () => setShowSMA(!showSMA), color: NEON.sma20 },
    { key: "bb", label: "BB", active: showBB, toggle: () => setShowBB(!showBB), color: NEON.cyanDim },
    { key: "macd", label: "MACD", active: showMACD, toggle: () => setShowMACD(!showMACD), color: NEON.macdLine },
    { key: "rsi", label: "RSI", active: showRSI, toggle: () => setShowRSI(!showRSI), color: NEON.rsiLine },
    { key: "abboud", label: "Aboood.AI", active: showAbboud, toggle: () => setShowAbboud(!showAbboud), color: NEON.gold },
  ];

  const chartHeight = isExpanded ? 480 : 320;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className={`chart-container border-border/30 overflow-hidden ${isExpanded ? "fixed inset-4 z-50 overflow-auto" : ""}`}>
        <CardHeader className="pb-2 pt-3">
          <div className="flex flex-col gap-2">
            {/* Row 1: Title + Chart Tools */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm font-heading font-semibold flex items-center gap-2">
                <div className="glass-section-icon">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="gradient-text">Advanced Chart</span>
                <Badge variant="outline" className="text-[9px] ml-1 border-primary/30 text-primary bg-primary/5">
                  Live
                </Badge>
                {drawingTool !== "none" && (
                  <Badge variant="outline" className="text-[9px] border-chart-2/30 text-chart-2 bg-chart-2/5 animate-pulse">
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
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
              />
            </div>
            {/* Row 2: Indicator Toggles + Range Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {toggles.map(t => (
                <button
                  key={t.key}
                  className={`h-6 px-2 text-[10px] font-medium rounded-md flex items-center gap-1 transition-all duration-200 ${
                    t.active
                      ? t.key === 'abboud'
                        ? 'bg-[oklch(0.82_0.16_80)]/15 text-[oklch(0.82_0.16_80)] ring-1 ring-[oklch(0.82_0.16_80)]/30'
                        : 'bg-primary/10 text-primary ring-1 ring-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50 opacity-60'
                  }`}
                  onClick={t.toggle}
                >
                  {t.key === 'abboud' ? <Sparkles className="h-3 w-3" /> : (t.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />)}
                  {t.label}
                </button>
              ))}
              <div className="w-px h-5 bg-border/30 mx-1" />
              <div className="flex items-center bg-secondary/30 rounded-lg p-0.5 gap-0.5">
                {chartRanges.map(r => (
                  <button
                    key={r.value}
                    className={`h-6 px-2 text-[10px] font-medium rounded-md transition-all duration-200 ${
                      chartRange === r.value
                        ? "bg-primary/15 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => onRangeChange(r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 px-3 pb-3" ref={chartContainerRef}>
          {chartLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-[320px] w-full rounded-lg" />
              <Skeleton className="h-[50px] w-full rounded-lg" />
            </div>
          ) : mergedData.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="space-y-2"
            >
              {/* Proactive Annotations */}
              <PriceAnnotations data={mergedData} currentPrice={currentPrice} />

              {/* ═══ Main Price Chart with Overlays ═══ */}
              <div className="rounded-lg overflow-hidden bg-[oklch(0.07_0.015_250_/_40%)] p-1">
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <ComposedChart
                    data={mergedData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    style={{ cursor: drawingTool !== "none" ? "crosshair" : showCrosshair ? "crosshair" : "default" }}
                  >
                    <defs>
                      <linearGradient id="neonPriceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={NEON.cyan} stopOpacity={0.3} />
                        <stop offset="50%" stopColor={NEON.cyan} stopOpacity={0.1} />
                        <stop offset="95%" stopColor={NEON.cyan} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="bbFillGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={NEON.cyanDim} stopOpacity={0.08} />
                        <stop offset="100%" stopColor={NEON.cyanDim} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="greenVolGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={NEON.green} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={NEON.green} stopOpacity={0.15} />
                      </linearGradient>
                      <linearGradient id="redVolGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={NEON.red} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={NEON.red} stopOpacity={0.15} />
                      </linearGradient>
                      {/* Glow filter for price line */}
                      <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                        <feMerge>
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke={NEON.grid} strokeOpacity={0.6} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: NEON.text, fontSize: 9, fontFamily: "JetBrains Mono" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={50}
                    />
                    <YAxis
                      tick={{ fill: NEON.text, fontSize: 9, fontFamily: "JetBrains Mono" }}
                      tickLine={false}
                      axisLine={false}
                      domain={priceDomain as [number, number]}
                      tickFormatter={(v) => v.toFixed(2)}
                      width={55}
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
                        activeDot={{ r: 5, fill: NEON.cyan, stroke: NEON.tooltip, strokeWidth: 2 }}
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                    )}
                    {chartType === "line" && (
                      <Line
                        type="monotone"
                        dataKey="close"
                        stroke={NEON.cyan}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5, fill: NEON.cyan, stroke: NEON.tooltip, strokeWidth: 2 }}
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                    )}
                    {chartType === "bar" && (
                      <Bar dataKey="close" radius={[2, 2, 0, 0]} animationDuration={600}>
                        {mergedData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.close >= (entry.open ?? entry.close) ? NEON.green + "88" : NEON.red + "88"} />
                        ))}
                      </Bar>
                    )}
                    {chartType === "candlestick" && (
                      <>
                        {/* Invisible bar to set the base (candleBottom) */}
                        <Bar dataKey="candleBottom" stackId="candle" barSize={8} fill="transparent" isAnimationActive={false} />
                        {/* Visible body bar stacked on top */}
                        <Bar dataKey="candleBody" stackId="candle" barSize={8} isAnimationActive={false} radius={[1, 1, 1, 1]}>
                          {mergedData.map((entry, idx) => {
                            const isBullish = entry.close >= (entry.open ?? entry.close);
                            return <Cell key={idx} fill={isBullish ? NEON.green : NEON.red} />;
                          })}
                        </Bar>
                        {/* Wicks drawn via Customized SVG */}
                        <Customized component={(props: any) => {
                          const { xAxisMap, yAxisMap } = props;
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
                                    strokeWidth={1.2}
                                    strokeLinecap="round"
                                  />
                                );
                              })}
                            </g>
                          );
                        }} />
                      </>
                    )}

                    {/* Abboud AI Fibonacci Overlay */}
                    {showAbboud && abboudData && (
                      <Customized component={(chartProps: any) => {
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
                      height={22}
                      stroke={NEON.cyanDim}
                      fill="oklch(0.10 0.015 250)"
                      tickFormatter={() => ""}
                      startIndex={brushRange.startIndex}
                      endIndex={brushRange.endIndex}
                      onChange={(range: any) => setBrushRange(range)}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-2 px-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: NEON.cyan }} />
                  <span className="text-[9px] text-muted-foreground">Price</span>
                </div>
                {showSMA && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: NEON.sma20 }} />
                      <span className="text-[9px] text-muted-foreground">SMA 20</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: NEON.sma50 }} />
                      <span className="text-[9px] text-muted-foreground">SMA 50</span>
                    </div>
                  </>
                )}
                {showBB && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 rounded border border-dashed" style={{ borderColor: NEON.cyanDim }} />
                    <span className="text-[9px] text-muted-foreground">Bollinger Bands</span>
                  </div>
                )}
                {showAbboud && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" style={{ color: NEON.gold }} />
                      <span className="text-[9px]" style={{ color: NEON.gold }}>Aboood.AI</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-2 rounded-sm" style={{ backgroundColor: "rgba(224, 64, 251, 0.3)", border: "1px solid rgba(224, 64, 251, 0.6)" }} />
                      <span className="text-[9px] text-muted-foreground">Entry</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: "#ff1744" }} />
                      <span className="text-[9px] text-muted-foreground">SL</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: "#00e676" }} />
                      <span className="text-[9px] text-muted-foreground">TP</span>
                    </div>
                  </>
                )}
              </div>

              {/* ═══ Volume Chart ═══ */}
              <div className="rounded-lg overflow-hidden bg-[oklch(0.07_0.015_250_/_30%)] p-1">
                <ResponsiveContainer width="100%" height={55}>
                  <BarChart data={mergedData} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" hide />
                    <YAxis hide width={55} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: NEON.tooltip,
                        border: `1px solid ${NEON.tooltipBorder}`,
                        borderRadius: "10px",
                        fontSize: "11px",
                        color: NEON.textBright,
                        backdropFilter: "blur(12px)",
                      }}
                      formatter={((value: any) => [formatLargeNum(Number(value)), "Volume"]) as any}
                    />
                    <Bar dataKey="volume" radius={[2, 2, 0, 0]} animationDuration={600}>
                      {mergedData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.volColor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* ═══ MACD Sub-Chart ═══ */}
              {showMACD && mergedData.some(d => d.macd != null) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-2 px-2 mb-1">
                    <div className="glass-section-icon !w-5 !h-5">
                      <Activity className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-heading">MACD (12, 26, 9)</span>
                  </div>
                  <div className="rounded-lg overflow-hidden bg-[oklch(0.07_0.015_250_/_30%)] p-1">
                    <ResponsiveContainer width="100%" height={75}>
                      <ComposedChart data={mergedData} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke={NEON.grid} strokeOpacity={0.5} />
                        <XAxis dataKey="date" hide />
                        <YAxis tick={{ fill: NEON.text, fontSize: 8, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} width={55} tickFormatter={(v) => v.toFixed(3)} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: NEON.tooltip,
                            border: `1px solid ${NEON.tooltipBorder}`,
                            borderRadius: "10px",
                            fontSize: "11px",
                            color: NEON.textBright,
                          }}
                          formatter={((value: any, name: any) => {
                            const labels: Record<string, string> = { macd: "MACD", macdSignal: "Signal", macdHist: "Histogram" };
                            return [Number(value)?.toFixed(4), labels[String(name)] || String(name)];
                          }) as any}
                        />
                        <ReferenceLine y={0} stroke={NEON.gridLight} strokeWidth={1} />
                        <Bar dataKey="macdHist" isAnimationActive={false} radius={[1, 1, 0, 0]}>
                          {mergedData.map((entry, idx) => (
                            <Cell key={idx} fill={(entry.macdHist ?? 0) >= 0 ? NEON.green + "66" : NEON.red + "66"} />
                          ))}
                        </Bar>
                        <Line type="monotone" dataKey="macd" stroke={NEON.macdLine} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="macdSignal" stroke={NEON.macdSignal} strokeWidth={1.5} dot={false} isAnimationActive={false} strokeDasharray="3 2" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}

              {/* ═══ Aboood.AI Signal Card ═══ */}
              {showAbboud && (
                <AbboudSignalCard symbol={symbol} exchange={exchange} enabled={showAbboud} />
              )}

              {/* ═══ RSI Sub-Chart ═══ */}
              {showRSI && mergedData.some(d => d.rsi != null) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-2 px-2 mb-1">
                    <div className="glass-section-icon !w-5 !h-5">
                      <Layers className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-heading">RSI (14)</span>
                  </div>
                  <div className="rounded-lg overflow-hidden bg-[oklch(0.07_0.015_250_/_30%)] p-1">
                    <ResponsiveContainer width="100%" height={65}>
                      <AreaChart data={mergedData} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="rsiGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={NEON.rsiLine} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={NEON.rsiLine} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 4" stroke={NEON.grid} strokeOpacity={0.5} />
                        <XAxis dataKey="date" hide />
                        <YAxis
                          tick={{ fill: NEON.text, fontSize: 8, fontFamily: "JetBrains Mono" }}
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
                            borderRadius: "10px",
                            fontSize: "11px",
                            color: NEON.textBright,
                          }}
                          formatter={((value: any) => [Number(value)?.toFixed(2), "RSI"]) as any}
                        />
                        <ReferenceLine y={70} stroke={NEON.red + "55"} strokeDasharray="4 2" label={{ value: "70", fill: NEON.red, fontSize: 8, position: "right" }} />
                        <ReferenceLine y={30} stroke={NEON.green + "55"} strokeDasharray="4 2" label={{ value: "30", fill: NEON.green, fontSize: 8, position: "right" }} />
                        <Area type="monotone" dataKey="rsi" stroke={NEON.rsiLine} strokeWidth={1.5} fill="url(#rsiGrad)" dot={false} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <BarChart3 className="h-8 w-8 mx-auto opacity-30" />
                <p className="text-sm">No chart data available</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
