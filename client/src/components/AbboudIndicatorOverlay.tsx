/**
 * Abboud AI Indicator Overlay
 * 
 * Renders directly ON the price chart:
 * - Fibonacci retracement levels as horizontal lines with price labels
 * - Entry zone as a visible colored rectangle (pink/magenta)
 * - Stop-loss line (red, bold)
 * - Target lines (green, bold)
 * - Price projection arrows (blue zigzag path via Customized SVG)
 * - Signal summary card below the chart
 * 
 * Uses Recharts ReferenceLine, ReferenceArea, and Customized SVG shapes.
 */

import { useMemo, useCallback } from "react";
import { ReferenceLine, ReferenceArea, Customized, Label } from "recharts";
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
  entry: "#e040fb",           // magenta/pink for entry zone
  entryFill: "rgba(224, 64, 251, 0.12)",
  entryBorder: "rgba(224, 64, 251, 0.6)",
  stopLoss: "#ff1744",        // bright red
  stopLossDim: "rgba(255, 23, 68, 0.15)",
  target: "#00e676",          // bright green
  targetDim: "rgba(0, 230, 118, 0.15)",
  resistance: "#ff5252",      // red for resistance
  support: "#69f0ae",         // green for support
  projection: "#448aff",      // blue for price projection arrows
  projectionDim: "rgba(68, 138, 255, 0.3)",
  fib236: "#26c6da",          // cyan
  fib382: "#66bb6a",          // green
  fib50: "#ffd54f",           // gold/amber
  fib618: "#ff7043",          // orange
  fib786: "#ef5350",          // red
  swingHigh: "#ff5252",
  swingLow: "#69f0ae",
  labelBg: "rgba(0,0,0,0.85)",
};

// ─── Fib level color helper ────────────────────────────────────────────────

function getFibColor(level: number): string {
  if (level <= 0.236) return ABBOUD_COLORS.fib236;
  if (level <= 0.382) return ABBOUD_COLORS.fib382;
  if (level <= 0.5) return ABBOUD_COLORS.fib50;
  if (level <= 0.618) return ABBOUD_COLORS.fib618;
  return ABBOUD_COLORS.fib786;
}

// ─── Price Projection SVG Component (rendered via Customized) ──────────────

interface ProjectionRendererProps {
  currentPrice: number;
  projection: Array<{ price: number; label: string; type: string }>;
}

// Store projection data in a module-level ref so the Customized renderer can access it
let _projectionData: ProjectionRendererProps | null = null;

function ProjectionSVGRenderer(chartProps: any) {
  const { yAxisMap, xAxisMap, offset, width, height } = chartProps;
  
  if (!_projectionData || !_projectionData.projection || _projectionData.projection.length < 2) return null;
  if (!yAxisMap || !xAxisMap) return null;
  
  const yAxis = Object.values(yAxisMap)[0] as any;
  if (!yAxis?.scale) return null;
  
  const yScale = yAxis.scale;
  const chartLeft = offset?.left ?? 52;
  const chartRight = chartLeft + (offset?.width ?? width - 57);
  const chartWidth = chartRight - chartLeft;
  
  const { projection } = _projectionData;

  // Position projection in the right portion of the chart (future area)
  const startX = chartLeft + chartWidth * 0.65;
  const endX = chartRight - 60;
  const segmentWidth = (endX - startX) / Math.max(projection.length - 1, 1);

  const points = projection.map((p, i) => ({
    x: startX + i * segmentWidth,
    y: yScale(p.price),
    ...p,
  })).filter(p => !isNaN(p.y));

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
  const arrowLen = 10;
  const arrowAngle = Math.PI / 6;

  return (
    <g className="abboud-projection">
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
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={i === 0 ? 4 : 5}
            fill={p.type === "current" ? ABBOUD_COLORS.gold : 
                  p.type === "pullback" ? ABBOUD_COLORS.fib50 :
                  ABBOUD_COLORS.projection}
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={1}
          />
          {/* Label */}
          <rect
            x={p.x - 25}
            y={p.y + (p.type === "pullback" ? 8 : -22)}
            width={50}
            height={14}
            rx={3}
            fill="rgba(0,0,0,0.75)"
            stroke={p.type === "current" ? ABBOUD_COLORS.gold : 
                    p.type === "pullback" ? ABBOUD_COLORS.fib50 :
                    ABBOUD_COLORS.projection}
            strokeWidth={0.5}
          />
          <text
            x={p.x}
            y={p.y + (p.type === "pullback" ? 18 : -12)}
            textAnchor="middle"
            fill={p.type === "current" ? ABBOUD_COLORS.gold : 
                  p.type === "pullback" ? ABBOUD_COLORS.fib50 :
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
  // Set module-level data for the Customized renderer
  _projectionData = { currentPrice, projection: priceProjection };

  // Get retracement-only fib levels (exclude 0% and 100% which are swing high/low)
  const retracementLevels = fibLevels.filter(f => f.type === "retracement" && f.level > 0 && f.level < 1);
  
  // Swing high (0%) and swing low (100%)
  const swingHigh = fibLevels.find(f => f.level === 0 && f.type === "retracement");
  const swingLow = fibLevels.find(f => f.level === 1 && f.type === "retracement");

  return (
    <>
      {/* ═══ Entry Zone Rectangle ═══ */}
      {entryZone && (
        <ReferenceArea
          y1={entryZone.low}
          y2={entryZone.high}
          fill={ABBOUD_COLORS.entryFill}
          stroke={ABBOUD_COLORS.entryBorder}
          strokeWidth={1.5}
          strokeDasharray="6 3"
          ifOverflow="extendDomain"
        >
          <Label
            value="ENTRY ZONE"
            position="insideTopLeft"
            fill={ABBOUD_COLORS.entry}
            fontSize={10}
            fontWeight="bold"
            fontFamily="monospace"
            offset={5}
          />
        </ReferenceArea>
      )}

      {/* ═══ Stop Loss Line ═══ */}
      {stopLoss != null && (
        <ReferenceLine
          y={stopLoss}
          stroke={ABBOUD_COLORS.stopLoss}
          strokeWidth={2}
          strokeDasharray="8 4"
          ifOverflow="extendDomain"
        >
          <Label
            value={`STOP ${stopLoss.toFixed(3)}`}
            position="right"
            fill="#fff"
            fontSize={9}
            fontWeight="bold"
            fontFamily="monospace"
            offset={5}
          />
        </ReferenceLine>
      )}

      {/* ═══ Target Lines ═══ */}
      {targets.map((t, i) => (
        <ReferenceLine
          key={`target-${i}`}
          y={t.price}
          stroke={ABBOUD_COLORS.target}
          strokeWidth={2}
          strokeDasharray="6 4"
          ifOverflow="extendDomain"
        >
          <Label
            value={`TP${i + 1} ${t.price.toFixed(3)}`}
            position="right"
            fill={ABBOUD_COLORS.target}
            fontSize={9}
            fontWeight="bold"
            fontFamily="monospace"
            offset={5}
          />
        </ReferenceLine>
      ))}

      {/* ═══ Swing High Line (0% / Resistance) ═══ */}
      {swingHigh && (
        <ReferenceLine
          y={swingHigh.price}
          stroke={ABBOUD_COLORS.resistance}
          strokeWidth={2}
          ifOverflow="extendDomain"
        >
          <Label
            value={`${swingHigh.price.toFixed(3)}`}
            position="right"
            fill={ABBOUD_COLORS.resistance}
            fontSize={9}
            fontWeight="bold"
            fontFamily="monospace"
            offset={5}
          />
        </ReferenceLine>
      )}

      {/* ═══ Swing Low Line (100% / Support) ═══ */}
      {swingLow && (
        <ReferenceLine
          y={swingLow.price}
          stroke={ABBOUD_COLORS.support}
          strokeWidth={2}
          ifOverflow="extendDomain"
        >
          <Label
            value={`${swingLow.price.toFixed(3)}`}
            position="right"
            fill={ABBOUD_COLORS.support}
            fontSize={9}
            fontWeight="bold"
            fontFamily="monospace"
            offset={5}
          />
        </ReferenceLine>
      )}

      {/* ═══ Fibonacci Retracement Lines ═══ */}
      {retracementLevels.map((fib) => {
        const color = getFibColor(fib.level);
        return (
          <ReferenceLine
            key={`fib-${fib.level}`}
            y={fib.price}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="4 3"
            ifOverflow="extendDomain"
          >
            <Label
              value={`${fib.label} ${fib.price.toFixed(2)}`}
              position="insideTopLeft"
              fill={color}
              fontSize={8}
              fontWeight="bold"
              fontFamily="monospace"
              offset={3}
            />
          </ReferenceLine>
        );
      })}

      {/* ═══ Price Projection Arrows (SVG via Customized) ═══ */}
      {priceProjection && priceProjection.length >= 2 && (
        <Customized component={ProjectionSVGRenderer} />
      )}
    </>
  );
}

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
          <span style={{ color: ABBOUD_COLORS.gold }}>Abboud AI Indicator</span>
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
