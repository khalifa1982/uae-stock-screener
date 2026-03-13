/**
 * Aboood.AI Indicator Overlay — Enhanced Visuals
 * 
 * Renders directly ON the price chart using a single Customized SVG renderer:
 * - Fibonacci retracement levels with thick lines, glow effects, and price labels
 * - Entry zone as a prominent gradient-filled rectangle with pulsing border
 * - Stop-loss line (bold red with glow)
 * - Target lines (bold green with glow)
 * - Price projection arrows (gradient blue zigzag path with animated dots)
 * - Swing High/Low labels with icons
 * - Signal summary card below the chart
 * 
 * Uses Recharts Customized component to render raw SVG, bypassing
 * Recharts' child element detection which doesn't work with Fragment children.
 */

import { useMemo, useCallback } from "react";
import { Customized } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp, TrendingDown, Target, Shield, AlertTriangle,
  ArrowUp, ArrowDown, Minus, Sparkles,
} from "lucide-react";

// ─── Colors ─────────────────────────────────────────────────────────────────

const ABBOUD_COLORS = {
  gold: "oklch(0.82 0.16 80)",
  goldDim: "oklch(0.68 0.14 80)",
  goldBright: "oklch(0.92 0.16 80)",
  entry: "#e040fb",
  entryFill: "rgba(224, 64, 251, 0.22)",
  entryBorder: "rgba(224, 64, 251, 0.85)",
  stopLoss: "#ff1744",
  stopLossDim: "rgba(255, 23, 68, 0.18)",
  stopLossGlow: "rgba(255, 23, 68, 0.5)",
  target: "#00e676",
  targetDim: "rgba(0, 230, 118, 0.18)",
  targetGlow: "rgba(0, 230, 118, 0.5)",
  resistance: "#ff5252",
  support: "#69f0ae",
  projection: "#448aff",
  projectionBright: "#82b1ff",
  projectionDim: "rgba(68, 138, 255, 0.3)",
  fib236: "#26c6da",
  fib382: "#66bb6a",
  fib50: "#ffd54f",
  fib618: "#ff7043",
  fib786: "#ef5350",
  swingHigh: "#ff5252",
  swingLow: "#69f0ae",
  labelBg: "rgba(0,0,0,0.88)",
  labelBgLight: "rgba(0,0,0,0.75)",
  currentPrice: "#ffd54f",
};

function getFibColor(level: number): string {
  if (level <= 0.236) return ABBOUD_COLORS.fib236;
  if (level <= 0.382) return ABBOUD_COLORS.fib382;
  if (level <= 0.5) return ABBOUD_COLORS.fib50;
  if (level <= 0.618) return ABBOUD_COLORS.fib618;
  return ABBOUD_COLORS.fib786;
}

// ─── Module-level data store for the Customized renderer ──────────────────

interface AbboudOverlayData {
  fibLevels: Array<{ level: number; label: string; price: number; type: string }>;
  entryZone: { low: number; high: number } | null;
  stopLoss: number | null;
  targets: Array<{ level: string; price: number }>;
  currentPrice: number;
  priceProjection: Array<{ price: number; label: string; type: string }>;
}

let _abboudData: AbboudOverlayData | null = null;

// ─── Single SVG Renderer (renders ALL overlay elements) ───────────────────

function AbboudSVGRenderer(chartProps: any) {
  const { yAxisMap, xAxisMap, offset, width, height } = chartProps;

  if (!_abboudData) return null;
  if (!yAxisMap || !xAxisMap) return null;

  const yAxis = Object.values(yAxisMap)[0] as any;
  if (!yAxis?.scale) return null;

  const yScale = yAxis.scale;
  const chartLeft = offset?.left ?? 52;
  const chartRight = chartLeft + (offset?.width ?? (width - 57));
  const chartTop = offset?.top ?? 5;
  const chartBottom = chartTop + (offset?.height ?? (height - 30));
  const chartWidth = chartRight - chartLeft;

  const { fibLevels, entryZone, stopLoss, targets, currentPrice, priceProjection } = _abboudData;

  // Get retracement-only fib levels (exclude 0% and 100% which are swing high/low)
  const retracementLevels = fibLevels.filter(f => f.type === "retracement" && f.level > 0 && f.level < 1);
  const swingHigh = fibLevels.find(f => f.level === 0 && f.type === "retracement");
  const swingLow = fibLevels.find(f => f.level === 1 && f.type === "retracement");

  // Helper: clamp Y position to chart area
  const clampY = (y: number) => Math.max(chartTop, Math.min(chartBottom, y));
  const isInView = (price: number) => {
    const y = yScale(price);
    return y >= chartTop - 20 && y <= chartBottom + 20;
  };

  // Unique ID for SVG defs to avoid conflicts
  const uid = "abood-overlay";

  // Helper: draw a labeled line with glow effect and prominent label box
  const drawLabeledLine = (
    price: number,
    color: string,
    glowColor: string,
    lineWidth: number,
    dashArray: string,
    labelText: string,
    labelBgColor: string,
    key: string,
    labelWidth: number = 90,
  ) => {
    if (!isInView(price)) return null;
    const y = clampY(yScale(price));
    return (
      <g key={key}>
        {/* Glow line (wider, semi-transparent behind main line) */}
        <line
          x1={chartLeft}
          x2={chartRight}
          y1={y}
          y2={y}
          stroke={glowColor}
          strokeWidth={lineWidth + 4}
          strokeDasharray={dashArray}
          opacity={0.3}
          filter={`url(#${uid}-glow)`}
        />
        {/* Main line */}
        <line
          x1={chartLeft}
          x2={chartRight}
          y1={y}
          y2={y}
          stroke={color}
          strokeWidth={lineWidth}
          strokeDasharray={dashArray}
          opacity={0.92}
        />
        {/* Label box on the right edge */}
        <rect
          x={chartRight - labelWidth - 2}
          y={y - 10}
          width={labelWidth}
          height={20}
          rx={4}
          fill={labelBgColor}
          stroke={color}
          strokeWidth={1.2}
          opacity={0.97}
          filter={`url(#${uid}-shadow)`}
        />
        <text
          x={chartRight - labelWidth / 2 - 2}
          y={y + 4}
          textAnchor="middle"
          fill={color}
          fontSize={10}
          fontWeight="bold"
          fontFamily="monospace"
          style={{ textShadow: `0 0 4px ${glowColor}` }}
        >
          {labelText}
        </text>
      </g>
    );
  };

  return (
    <g className="abboud-overlay">
      {/* ═══ SVG Defs: Filters & Gradients ═══ */}
      <defs>
        {/* Glow filter for lines */}
        <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Stronger glow for entry zone */}
        <filter id={`${uid}-glow-strong`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Drop shadow for labels */}
        <filter id={`${uid}-shadow`} x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="rgba(0,0,0,0.6)" floodOpacity="0.6" />
        </filter>
        {/* Entry zone gradient */}
        <linearGradient id={`${uid}-entry-grad`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ABBOUD_COLORS.entry} stopOpacity="0.28" />
          <stop offset="50%" stopColor={ABBOUD_COLORS.entry} stopOpacity="0.18" />
          <stop offset="100%" stopColor={ABBOUD_COLORS.entry} stopOpacity="0.28" />
        </linearGradient>
        {/* Projection gradient */}
        <linearGradient id={`${uid}-proj-grad`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={ABBOUD_COLORS.projection} stopOpacity="0.6" />
          <stop offset="50%" stopColor={ABBOUD_COLORS.projectionBright} stopOpacity="1" />
          <stop offset="100%" stopColor={ABBOUD_COLORS.projection} stopOpacity="0.8" />
        </linearGradient>
        {/* Animated pulse for entry zone */}
        <style>{`
          @keyframes abboud-pulse {
            0%, 100% { opacity: 0.85; }
            50% { opacity: 0.5; }
          }
          .abboud-entry-border {
            animation: abboud-pulse 2s ease-in-out infinite;
          }
          @keyframes abboud-dot-pulse {
            0%, 100% { r: 5; opacity: 1; }
            50% { r: 7; opacity: 0.7; }
          }
          .abboud-proj-dot {
            animation: abboud-dot-pulse 1.5s ease-in-out infinite;
          }
        `}</style>
      </defs>

      {/* ═══ Entry Zone Rectangle ═══ */}
      {entryZone && isInView(entryZone.low) && isInView(entryZone.high) && (() => {
        const y1 = clampY(yScale(entryZone.high));
        const y2 = clampY(yScale(entryZone.low));
        const zoneHeight = Math.max(y2 - y1, 2);
        return (
          <g key="entry-zone">
            {/* Background fill with gradient */}
            <rect
              x={chartLeft}
              y={y1}
              width={chartWidth}
              height={zoneHeight}
              fill={`url(#${uid}-entry-grad)`}
            />
            {/* Animated pulsing border */}
            <rect
              className="abboud-entry-border"
              x={chartLeft}
              y={y1}
              width={chartWidth}
              height={zoneHeight}
              fill="none"
              stroke={ABBOUD_COLORS.entryBorder}
              strokeWidth={2.5}
              strokeDasharray="12 6"
              filter={`url(#${uid}-glow)`}
            />
            {/* Top edge highlight */}
            <line
              x1={chartLeft} x2={chartRight}
              y1={y1} y2={y1}
              stroke={ABBOUD_COLORS.entry}
              strokeWidth={1}
              opacity={0.6}
            />
            {/* Bottom edge highlight */}
            <line
              x1={chartLeft} x2={chartRight}
              y1={y2} y2={y2}
              stroke={ABBOUD_COLORS.entry}
              strokeWidth={1}
              opacity={0.6}
            />
            {/* Entry Zone label - centered, larger */}
            <rect
              x={chartLeft + 10}
              y={y1 + (zoneHeight / 2) - 12}
              width={110}
              height={24}
              rx={5}
              fill="rgba(224, 64, 251, 0.25)"
              stroke={ABBOUD_COLORS.entryBorder}
              strokeWidth={1.2}
              filter={`url(#${uid}-shadow)`}
            />
            <text
              x={chartLeft + 65}
              y={y1 + (zoneHeight / 2) + 4}
              textAnchor="middle"
              fill={ABBOUD_COLORS.entry}
              fontSize={12}
              fontWeight="bold"
              fontFamily="monospace"
              style={{ textShadow: `0 0 6px rgba(224, 64, 251, 0.6)` }}
            >
              ENTRY ZONE
            </text>
          </g>
        );
      })()}

      {/* ═══ Stop Loss Line ═══ */}
      {stopLoss != null && drawLabeledLine(
        stopLoss,
        ABBOUD_COLORS.stopLoss,
        ABBOUD_COLORS.stopLossGlow,
        3,
        "12 6",
        `STOP ${stopLoss.toFixed(3)}`,
        ABBOUD_COLORS.stopLossDim,
        "stop-loss",
        100,
      )}

      {/* ═══ Target Lines ═══ */}
      {targets.map((t, i) => drawLabeledLine(
        t.price,
        ABBOUD_COLORS.target,
        ABBOUD_COLORS.targetGlow,
        2.5,
        "10 5",
        `TP${i + 1} ${t.price.toFixed(3)}`,
        ABBOUD_COLORS.targetDim,
        `target-${i}`,
        100,
      ))}

      {/* ═══ Swing High Line (Resistance) ═══ */}
      {swingHigh && isInView(swingHigh.price) && (() => {
        const y = clampY(yScale(swingHigh.price));
        return (
          <g key="swing-high">
            {/* Solid resistance line */}
            <line
              x1={chartLeft} x2={chartRight}
              y1={y} y2={y}
              stroke={ABBOUD_COLORS.resistance}
              strokeWidth={2.2}
              opacity={0.85}
              filter={`url(#${uid}-glow)`}
            />
            {/* Label box */}
            <rect
              x={chartRight - 102}
              y={y - 10}
              width={100}
              height={20}
              rx={4}
              fill="rgba(255, 82, 82, 0.18)"
              stroke={ABBOUD_COLORS.resistance}
              strokeWidth={1.2}
              filter={`url(#${uid}-shadow)`}
            />
            <text
              x={chartRight - 52}
              y={y + 4}
              textAnchor="middle"
              fill={ABBOUD_COLORS.resistance}
              fontSize={10}
              fontWeight="bold"
              fontFamily="monospace"
            >
              RES {swingHigh.price.toFixed(3)}
            </text>
            {/* Triangle marker */}
            <polygon
              points={`${chartLeft + 6},${y - 2} ${chartLeft + 12},${y - 10} ${chartLeft + 18},${y - 2}`}
              fill={ABBOUD_COLORS.resistance}
              opacity={0.8}
            />
          </g>
        );
      })()}

      {/* ═══ Swing Low Line (Support) ═══ */}
      {swingLow && isInView(swingLow.price) && (() => {
        const y = clampY(yScale(swingLow.price));
        return (
          <g key="swing-low">
            {/* Solid support line */}
            <line
              x1={chartLeft} x2={chartRight}
              y1={y} y2={y}
              stroke={ABBOUD_COLORS.support}
              strokeWidth={2.2}
              opacity={0.85}
              filter={`url(#${uid}-glow)`}
            />
            {/* Label box */}
            <rect
              x={chartRight - 102}
              y={y - 10}
              width={100}
              height={20}
              rx={4}
              fill="rgba(105, 240, 174, 0.15)"
              stroke={ABBOUD_COLORS.support}
              strokeWidth={1.2}
              filter={`url(#${uid}-shadow)`}
            />
            <text
              x={chartRight - 52}
              y={y + 4}
              textAnchor="middle"
              fill={ABBOUD_COLORS.support}
              fontSize={10}
              fontWeight="bold"
              fontFamily="monospace"
            >
              SUP {swingLow.price.toFixed(3)}
            </text>
            {/* Inverted triangle marker */}
            <polygon
              points={`${chartLeft + 6},${y + 2} ${chartLeft + 12},${y + 10} ${chartLeft + 18},${y + 2}`}
              fill={ABBOUD_COLORS.support}
              opacity={0.8}
            />
          </g>
        );
      })()}

      {/* ═══ Fibonacci Retracement Lines ═══ */}
      {retracementLevels.map((fib) => {
        if (!isInView(fib.price)) return null;
        const color = getFibColor(fib.level);
        const y = clampY(yScale(fib.price));
        return (
          <g key={`fib-${fib.level}`}>
            {/* Glow behind fib line */}
            <line
              x1={chartLeft} x2={chartRight}
              y1={y} y2={y}
              stroke={color}
              strokeWidth={4}
              strokeDasharray="6 4"
              opacity={0.15}
              filter={`url(#${uid}-glow)`}
            />
            {/* Main fib line - thicker */}
            <line
              x1={chartLeft} x2={chartRight}
              y1={y} y2={y}
              stroke={color}
              strokeWidth={1.8}
              strokeDasharray="6 3"
              opacity={0.85}
            />
            {/* Fib label on the left - larger and more visible */}
            <rect
              x={chartLeft + 2}
              y={y - 16}
              width={82}
              height={16}
              rx={3}
              fill={ABBOUD_COLORS.labelBg}
              stroke={color}
              strokeWidth={0.8}
              filter={`url(#${uid}-shadow)`}
            />
            <text
              x={chartLeft + 43}
              y={y - 5}
              textAnchor="middle"
              fill={color}
              fontSize={9.5}
              fontWeight="bold"
              fontFamily="monospace"
              style={{ textShadow: `0 0 3px ${color}` }}
            >
              {fib.label} {fib.price.toFixed(3)}
            </text>
          </g>
        );
      })}

      {/* ═══ Current Price Marker ═══ */}
      {isInView(currentPrice) && (() => {
        const y = clampY(yScale(currentPrice));
        return (
          <g key="current-price-marker">
            {/* Thin dotted line at current price */}
            <line
              x1={chartLeft} x2={chartRight}
              y1={y} y2={y}
              stroke={ABBOUD_COLORS.currentPrice}
              strokeWidth={1}
              strokeDasharray="2 3"
              opacity={0.5}
            />
            {/* Small arrow on left edge */}
            <polygon
              points={`${chartLeft - 1},${y} ${chartLeft + 8},${y - 5} ${chartLeft + 8},${y + 5}`}
              fill={ABBOUD_COLORS.currentPrice}
              opacity={0.9}
            />
          </g>
        );
      })()}

      {/* ═══ Price Projection Arrows ═══ */}
      {priceProjection && priceProjection.length >= 2 && (() => {
        // Position projection in the right portion of the chart (future area)
        const startX = chartLeft + chartWidth * 0.65;
        const endX = chartRight - 60;
        const segmentWidth = (endX - startX) / Math.max(priceProjection.length - 1, 1);

        const points = priceProjection.map((p, i) => ({
          x: startX + i * segmentWidth,
          y: yScale(p.price),
          ...p,
        })).filter(p => !isNaN(p.y) && p.y >= chartTop - 20 && p.y <= chartBottom + 20);

        if (points.length < 2) return null;

        // Build smooth curve path using quadratic bezier
        const pathParts: string[] = [];
        points.forEach((p, i) => {
          if (i === 0) {
            pathParts.push(`M ${p.x} ${p.y}`);
          } else {
            // Use quadratic bezier for smoother curves
            const prev = points[i - 1];
            const cpX = (prev.x + p.x) / 2;
            pathParts.push(`Q ${cpX} ${prev.y} ${p.x} ${p.y}`);
          }
        });

        const lastPoint = points[points.length - 1];
        const prevPoint = points[points.length - 2];
        const angle = Math.atan2(lastPoint.y - prevPoint.y, lastPoint.x - prevPoint.x);
        const arrowLen = 14;
        const arrowAngle = Math.PI / 6;

        return (
          <g key="projection">
            {/* Projection glow path */}
            <path
              d={pathParts.join(" ")}
              fill="none"
              stroke={ABBOUD_COLORS.projectionDim}
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#${uid}-glow)`}
            />
            {/* Main projection path with gradient */}
            <path
              d={pathParts.join(" ")}
              fill="none"
              stroke={`url(#${uid}-proj-grad)`}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.95}
            />

            {/* Arrow head - larger */}
            <path
              d={`M ${lastPoint.x} ${lastPoint.y} 
                  L ${lastPoint.x - arrowLen * Math.cos(angle - arrowAngle)} ${lastPoint.y - arrowLen * Math.sin(angle - arrowAngle)}
                  M ${lastPoint.x} ${lastPoint.y}
                  L ${lastPoint.x - arrowLen * Math.cos(angle + arrowAngle)} ${lastPoint.y - arrowLen * Math.sin(angle + arrowAngle)}`}
              fill="none"
              stroke={ABBOUD_COLORS.projectionBright}
              strokeWidth={3}
              strokeLinecap="round"
            />

            {/* Dots at each projection point with pulse animation */}
            {points.map((p, i) => {
              const dotColor = p.type === "current" || p.type === "pullback"
                ? ABBOUD_COLORS.currentPrice
                : ABBOUD_COLORS.projectionBright;
              return (
                <g key={`proj-${i}`}>
                  {/* Outer glow ring */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={8}
                    fill="none"
                    stroke={dotColor}
                    strokeWidth={1}
                    opacity={0.3}
                  />
                  {/* Main dot */}
                  <circle
                    className="abboud-proj-dot"
                    cx={p.x}
                    cy={p.y}
                    r={i === 0 ? 4.5 : 5.5}
                    fill={dotColor}
                    stroke="rgba(0,0,0,0.6)"
                    strokeWidth={1.5}
                  />
                  {/* Label with shadow */}
                  <rect
                    x={p.x - 32}
                    y={p.y + (p.type === "pullback" ? 10 : -26)}
                    width={64}
                    height={18}
                    rx={4}
                    fill={ABBOUD_COLORS.labelBg}
                    stroke={dotColor}
                    strokeWidth={0.8}
                    filter={`url(#${uid}-shadow)`}
                  />
                  <text
                    x={p.x}
                    y={p.y + (p.type === "pullback" ? 22 : -14)}
                    textAnchor="middle"
                    fill={dotColor}
                    fontSize={9.5}
                    fontWeight="bold"
                    fontFamily="monospace"
                    style={{ textShadow: `0 0 4px ${dotColor}` }}
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })()}
    </g>
  );
}

// ─── Fibonacci Overlay (rendered inside ComposedChart) ──────────────────────

interface FibOverlayProps {
  fibLevels: Array<{ level: number; label: string; price: number; type: string }>;
  entryZone: { low: number; high: number } | null;
  stopLoss: number | null;
  targets: Array<{ level: string; price: number }>;
  currentPrice: number;
  priceProjection: Array<{ price: number; label: string; type: string }>;
}

export function AbboudFibOverlay({ fibLevels, entryZone, stopLoss, targets, currentPrice, priceProjection }: FibOverlayProps) {
  // Store data in module-level variable for the Customized renderer
  _abboudData = { fibLevels, entryZone, stopLoss, targets, currentPrice, priceProjection };

  // Render a single Customized component that draws ALL overlay elements as raw SVG
  // This bypasses Recharts' child element detection which doesn't work with Fragment children
  return <Customized component={AbboudSVGRenderer} />;
}

// ─── Direct exports for inline Customized usage in AdvancedChart ────────────
// Recharts only recognizes <Customized> as a direct child of ComposedChart,
// so we export the renderer and data setter for inline use.

export function setAbboudOverlayData(data: AbboudOverlayData) {
  _abboudData = data;
}

export const AbboudSVGRendererDirect = AbboudSVGRenderer;

// ─── Signal Summary Card ─────────────────────────────────────────────────────

interface AbboudSignalCardProps {
  symbol: string;
  exchange: "ADX" | "DFM";
  enabled: boolean;
}

export function AbboudSignalCard({ symbol, exchange, enabled }: AbboudSignalCardProps) {
  const { data: abboudData, isLoading } = trpc.td.abboud.useQuery(
    { symbol, exchange, outputsize: 200 },
    { enabled, staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000, refetchOnWindowFocus: false }
  );

  if (!enabled || isLoading || !abboudData) return null;

  const { signal, trendDirection, divergences, fibLevels, currentPrice } = abboudData;
  const recentDiv = divergences.slice(-2);

  const actionColor = signal.action === "BUY"
    ? "text-gain"
    : signal.action === "SELL"
    ? "text-loss"
    : "text-muted-foreground";

  const actionBg = signal.action === "BUY"
    ? "bg-gain/10 border-gain/30"
    : signal.action === "SELL"
    ? "bg-loss/10 border-loss/30"
    : "bg-muted/10 border-muted/30";

  const trendIcon = trendDirection === "uptrend"
    ? <TrendingUp className="h-3 w-3 text-gain" />
    : trendDirection === "downtrend"
    ? <TrendingDown className="h-3 w-3 text-loss" />
    : <Minus className="h-3 w-3 text-muted-foreground" />;

  const confidenceColor = signal.confidence >= 70
    ? "text-gain"
    : signal.confidence >= 50
    ? "text-yellow-400"
    : "text-muted-foreground";

  return (
    <Card className="border-border/50 neon-card overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: ABBOUD_COLORS.gold }} />
          <span style={{ color: ABBOUD_COLORS.gold }}>Aboood.AI Thoughts</span>
          <Badge variant="outline" className="text-[9px] ml-1" style={{ borderColor: ABBOUD_COLORS.goldDim, color: ABBOUD_COLORS.gold }}>
            Fib + RSI Divergence
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Signal Action */}
        <div className={`flex items-center justify-between p-3 rounded-lg border ${actionBg}`}>
          <div className="flex items-center gap-2">
            {signal.action === "BUY" ? (
              <ArrowUp className="h-5 w-5 text-gain" />
            ) : signal.action === "SELL" ? (
              <ArrowDown className="h-5 w-5 text-loss" />
            ) : (
              <Minus className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className={`text-lg font-bold font-mono ${actionColor}`}>{signal.action}</p>
              <p className="text-[10px] text-muted-foreground">{signal.reason}</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-sm font-bold font-mono ${confidenceColor}`}>{signal.confidence}%</p>
            <p className="text-[9px] text-muted-foreground">Confidence</p>
          </div>
        </div>

        {/* Key Levels Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Current Price */}
          <div className="bg-secondary/30 rounded-lg p-2 text-center">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Price</p>
            <p className="text-sm font-bold font-mono text-foreground">{currentPrice.toFixed(3)}</p>
          </div>

          {/* Trend */}
          <div className="bg-secondary/30 rounded-lg p-2 text-center">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Trend</p>
            <div className="flex items-center justify-center gap-1">
              {trendIcon}
              <p className="text-sm font-bold font-mono capitalize">{trendDirection}</p>
            </div>
          </div>

          {/* Entry Zone */}
          {signal.entryZone && (
            <div className="bg-secondary/30 rounded-lg p-2 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                <Target className="h-2.5 w-2.5 text-gain" /> Entry
              </p>
              <p className="text-[11px] font-bold font-mono text-gain">
                {signal.entryZone.low.toFixed(3)} - {signal.entryZone.high.toFixed(3)}
              </p>
            </div>
          )}

          {/* Stop Loss */}
          {signal.stopLoss && (
            <div className="bg-secondary/30 rounded-lg p-2 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                <Shield className="h-2.5 w-2.5 text-loss" /> Stop Loss
              </p>
              <p className="text-sm font-bold font-mono text-loss">{signal.stopLoss.toFixed(3)}</p>
            </div>
          )}
        </div>

        {/* Targets */}
        {signal.targets.length > 0 && (
          <div className="space-y-1">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Target className="h-2.5 w-2.5" style={{ color: ABBOUD_COLORS.target }} /> Price Targets
            </p>
            <div className="flex gap-2 flex-wrap">
              {signal.targets.map((t, i) => (
                <Badge key={i} variant="outline" className="text-[10px] font-mono" style={{ borderColor: ABBOUD_COLORS.target + "55", color: ABBOUD_COLORS.target }}>
                  TP{i + 1}: {t.price.toFixed(3)} ({t.level})
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Fibonacci Levels Summary */}
        <div className="space-y-1">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5" style={{ color: ABBOUD_COLORS.gold }} /> Fibonacci Levels
          </p>
          <div className="grid grid-cols-5 gap-1">
            {fibLevels.filter(f => f.type === "retracement" && f.level > 0 && f.level < 1).map((fib) => {
              const isNearPrice = Math.abs(fib.price - currentPrice) / currentPrice < 0.02;
              return (
                <div
                  key={fib.level}
                  className={`text-center p-1 rounded text-[9px] font-mono ${isNearPrice ? "ring-1 ring-primary/50 bg-primary/10" : "bg-secondary/20"}`}
                >
                  <p className="text-muted-foreground text-[8px]">{fib.label}</p>
                  <p className={`font-bold ${isNearPrice ? "text-primary" : "text-foreground"}`}>{fib.price.toFixed(3)}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Divergences */}
        {recentDiv.length > 0 && (
          <div className="space-y-1">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="h-2.5 w-2.5 text-yellow-400" /> RSI Divergence Signals
            </p>
            <div className="space-y-1">
              {recentDiv.map((div, i) => {
                const isBullish = div.type.includes("bullish");
                return (
                  <div key={i} className={`flex items-center gap-2 p-1.5 rounded text-[10px] ${isBullish ? "bg-gain/5 border border-gain/20" : "bg-loss/5 border border-loss/20"}`}>
                    {isBullish ? <TrendingUp className="h-3 w-3 text-gain shrink-0" /> : <TrendingDown className="h-3 w-3 text-loss shrink-0" />}
                    <div>
                      <span className={`font-semibold capitalize ${isBullish ? "text-gain" : "text-loss"}`}>
                        {div.type.replace("_", " ")}
                      </span>
                      <span className="text-muted-foreground ml-1">
                        ({div.strength}) RSI: {div.rsiStart.toFixed(0)} → {div.rsiEnd.toFixed(0)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Hook for Abboud data ────────────────────────────────────────────────────

export function useAbboudIndicator(symbol: string, exchange: "ADX" | "DFM", enabled: boolean) {
  return trpc.td.abboud.useQuery(
    { symbol, exchange, outputsize: 200 },
    { enabled, staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000, refetchOnWindowFocus: false }
  );
}
