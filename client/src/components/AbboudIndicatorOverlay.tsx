/**
 * Abboud AI Indicator Overlay
 * 
 * Renders directly ON the price chart using a single Customized SVG renderer:
 * - Fibonacci retracement levels as horizontal lines with price labels
 * - Entry zone as a visible colored rectangle (pink/magenta)
 * - Stop-loss line (red, bold)
 * - Target lines (green, bold)
 * - Price projection arrows (blue zigzag path)
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
  entryFill: "rgba(224, 64, 251, 0.15)",
  entryBorder: "rgba(224, 64, 251, 0.7)",
  stopLoss: "#ff1744",
  stopLossDim: "rgba(255, 23, 68, 0.15)",
  target: "#00e676",
  targetDim: "rgba(0, 230, 118, 0.15)",
  resistance: "#ff5252",
  support: "#69f0ae",
  projection: "#448aff",
  projectionDim: "rgba(68, 138, 255, 0.3)",
  fib236: "#26c6da",
  fib382: "#66bb6a",
  fib50: "#ffd54f",
  fib618: "#ff7043",
  fib786: "#ef5350",
  swingHigh: "#ff5252",
  swingLow: "#69f0ae",
  labelBg: "rgba(0,0,0,0.85)",
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

  // Helper: draw a dashed horizontal line with a label box on the right
  const drawLabeledLine = (
    price: number,
    color: string,
    lineWidth: number,
    dashArray: string,
    labelText: string,
    labelBgColor: string,
    key: string,
  ) => {
    if (!isInView(price)) return null;
    const y = clampY(yScale(price));
    return (
      <g key={key}>
        <line
          x1={chartLeft}
          x2={chartRight}
          y1={y}
          y2={y}
          stroke={color}
          strokeWidth={lineWidth}
          strokeDasharray={dashArray}
          opacity={0.85}
        />
        {/* Label box on the right */}
        <rect
          x={chartRight - 80}
          y={y - 8}
          width={78}
          height={16}
          rx={3}
          fill={labelBgColor}
          stroke={color}
          strokeWidth={0.8}
          opacity={0.95}
        />
        <text
          x={chartRight - 41}
          y={y + 4}
          textAnchor="middle"
          fill={color}
          fontSize={9}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {labelText}
        </text>
      </g>
    );
  };

  return (
    <g className="abboud-overlay">
      {/* ═══ Entry Zone Rectangle ═══ */}
      {entryZone && isInView(entryZone.low) && isInView(entryZone.high) && (() => {
        const y1 = clampY(yScale(entryZone.high));
        const y2 = clampY(yScale(entryZone.low));
        return (
          <g key="entry-zone">
            <rect
              x={chartLeft}
              y={y1}
              width={chartWidth}
              height={Math.max(y2 - y1, 2)}
              fill={ABBOUD_COLORS.entryFill}
              stroke={ABBOUD_COLORS.entryBorder}
              strokeWidth={1.5}
              strokeDasharray="8 4"
              opacity={0.9}
            />
            {/* Entry Zone label */}
            <rect
              x={chartLeft + 8}
              y={y1 + 4}
              width={90}
              height={18}
              rx={4}
              fill="rgba(224, 64, 251, 0.2)"
              stroke={ABBOUD_COLORS.entryBorder}
              strokeWidth={0.8}
            />
            <text
              x={chartLeft + 53}
              y={y1 + 16}
              textAnchor="middle"
              fill={ABBOUD_COLORS.entry}
              fontSize={10}
              fontWeight="bold"
              fontFamily="monospace"
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
        2.5,
        "10 5",
        `STOP ${stopLoss.toFixed(3)}`,
        "rgba(255, 23, 68, 0.15)",
        "stop-loss",
      )}

      {/* ═══ Target Lines ═══ */}
      {targets.map((t, i) => drawLabeledLine(
        t.price,
        ABBOUD_COLORS.target,
        2,
        "8 4",
        `TP${i + 1} ${t.price.toFixed(3)}`,
        "rgba(0, 230, 118, 0.12)",
        `target-${i}`,
      ))}

      {/* ═══ Swing High Line (Resistance) ═══ */}
      {swingHigh && drawLabeledLine(
        swingHigh.price,
        ABBOUD_COLORS.resistance,
        2,
        "",
        `RES ${swingHigh.price.toFixed(3)}`,
        "rgba(255, 82, 82, 0.15)",
        "swing-high",
      )}

      {/* ═══ Swing Low Line (Support) ═══ */}
      {swingLow && drawLabeledLine(
        swingLow.price,
        ABBOUD_COLORS.support,
        2,
        "",
        `SUP ${swingLow.price.toFixed(3)}`,
        "rgba(105, 240, 174, 0.12)",
        "swing-low",
      )}

      {/* ═══ Fibonacci Retracement Lines ═══ */}
      {retracementLevels.map((fib) => {
        if (!isInView(fib.price)) return null;
        const color = getFibColor(fib.level);
        const y = clampY(yScale(fib.price));
        return (
          <g key={`fib-${fib.level}`}>
            <line
              x1={chartLeft}
              x2={chartRight}
              y1={y}
              y2={y}
              stroke={color}
              strokeWidth={1.2}
              strokeDasharray="5 3"
              opacity={0.7}
            />
            {/* Fib label on the left */}
            <rect
              x={chartLeft + 2}
              y={y - 14}
              width={72}
              height={13}
              rx={2}
              fill="rgba(0,0,0,0.75)"
              stroke={color}
              strokeWidth={0.5}
            />
            <text
              x={chartLeft + 38}
              y={y - 4}
              textAnchor="middle"
              fill={color}
              fontSize={8}
              fontWeight="bold"
              fontFamily="monospace"
            >
              {fib.label} {fib.price.toFixed(3)}
            </text>
          </g>
        );
      })}

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

        // Build path
        const pathParts: string[] = [];
        points.forEach((p, i) => {
          if (i === 0) pathParts.push(`M ${p.x} ${p.y}`);
          else pathParts.push(`L ${p.x} ${p.y}`);
        });

        const lastPoint = points[points.length - 1];
        const prevPoint = points[points.length - 2];
        const angle = Math.atan2(lastPoint.y - prevPoint.y, lastPoint.x - prevPoint.x);
        const arrowLen = 12;
        const arrowAngle = Math.PI / 6;

        return (
          <g key="projection">
            {/* Projection path */}
            <path
              d={pathParts.join(" ")}
              fill="none"
              stroke={ABBOUD_COLORS.projection}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />

            {/* Arrow head */}
            <path
              d={`M ${lastPoint.x} ${lastPoint.y} 
                  L ${lastPoint.x - arrowLen * Math.cos(angle - arrowAngle)} ${lastPoint.y - arrowLen * Math.sin(angle - arrowAngle)}
                  M ${lastPoint.x} ${lastPoint.y}
                  L ${lastPoint.x - arrowLen * Math.cos(angle + arrowAngle)} ${lastPoint.y - arrowLen * Math.sin(angle + arrowAngle)}`}
              fill="none"
              stroke={ABBOUD_COLORS.projection}
              strokeWidth={2.5}
              strokeLinecap="round"
            />

            {/* Dots at each projection point */}
            {points.map((p, i) => (
              <g key={`proj-${i}`}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={i === 0 ? 4 : 5}
                  fill={p.type === "current" ? "#ffd54f" :
                        p.type === "pullback" ? "#ffd54f" :
                        ABBOUD_COLORS.projection}
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth={1}
                />
                {/* Label */}
                <rect
                  x={p.x - 28}
                  y={p.y + (p.type === "pullback" ? 8 : -22)}
                  width={56}
                  height={14}
                  rx={3}
                  fill="rgba(0,0,0,0.8)"
                  stroke={p.type === "current" ? "#ffd54f" :
                          p.type === "pullback" ? "#ffd54f" :
                          ABBOUD_COLORS.projection}
                  strokeWidth={0.5}
                />
                <text
                  x={p.x}
                  y={p.y + (p.type === "pullback" ? 18 : -12)}
                  textAnchor="middle"
                  fill={p.type === "current" ? "#ffd54f" :
                        p.type === "pullback" ? "#ffd54f" :
                        ABBOUD_COLORS.projection}
                  fontSize={8}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {p.label}
                </text>
              </g>
            ))}
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
