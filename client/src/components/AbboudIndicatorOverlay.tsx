/**
 * Abboud AI Indicator Overlay
 * 
 * Renders Fibonacci retracement/extension levels, entry zones, stop-loss lines,
 * divergence markers, and signal summary directly on the AdvancedChart.
 * 
 * Uses Recharts ReferenceLine, ReferenceArea, and custom shapes.
 */

import { useMemo } from "react";
import { ReferenceLine, ReferenceArea } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp, TrendingDown, Target, Shield, AlertTriangle,
  ArrowUp, ArrowDown, Minus, Sparkles,
} from "lucide-react";

// ─── Gold Neon Colors ────────────────────────────────────────────────────────

const ABBOUD_COLORS = {
  gold: "oklch(0.82 0.16 80)",
  goldDim: "oklch(0.68 0.14 80)",
  goldBright: "oklch(0.92 0.16 80)",
  entry: "oklch(0.78 0.2 155)",       // green
  entryFill: "oklch(0.78 0.2 155 / 12%)",
  stopLoss: "oklch(0.65 0.24 25)",    // red
  stopLossFill: "oklch(0.65 0.24 25 / 8%)",
  target: "oklch(0.82 0.16 195)",     // cyan
  fib236: "oklch(0.72 0.12 195)",
  fib382: "oklch(0.78 0.16 155)",
  fib50: "oklch(0.82 0.16 80)",
  fib618: "oklch(0.72 0.18 40)",
  fib786: "oklch(0.65 0.22 25)",
  divergenceBullish: "oklch(0.78 0.2 155)",
  divergenceBearish: "oklch(0.65 0.24 25)",
};

// ─── Fibonacci Level Lines (rendered inside ComposedChart) ───────────────────

interface FibOverlayProps {
  fibLevels: Array<{ level: number; label: string; price: number; type: string }>;
  entryZone: { low: number; high: number } | null;
  stopLoss: number | null;
  targets: Array<{ level: string; price: number }>;
}

export function AbboudFibOverlay({ fibLevels, entryZone, stopLoss, targets }: FibOverlayProps) {
  const retracementLevels = fibLevels.filter(f => f.type === "retracement" && f.level > 0 && f.level < 1);
  const extensionLevels = fibLevels.filter(f => f.type === "extension");

  const getFibColor = (level: number): string => {
    if (level <= 0.236) return ABBOUD_COLORS.fib236;
    if (level <= 0.382) return ABBOUD_COLORS.fib382;
    if (level <= 0.5) return ABBOUD_COLORS.fib50;
    if (level <= 0.618) return ABBOUD_COLORS.fib618;
    return ABBOUD_COLORS.fib786;
  };

  return (
    <>
      {/* Fibonacci Retracement Lines */}
      {retracementLevels.map((fib) => (
        <ReferenceLine
          key={`fib-${fib.level}`}
          y={fib.price}
          stroke={getFibColor(fib.level)}
          strokeDasharray="6 3"
          strokeWidth={1}
          strokeOpacity={0.7}
          label={{
            value: `${fib.label} (${fib.price.toFixed(3)})`,
            fill: getFibColor(fib.level),
            fontSize: 8,
            position: "right",
          }}
        />
      ))}

      {/* Entry Zone (green shaded area between 38.2% and 50%) */}
      {entryZone && (
        <ReferenceArea
          y1={entryZone.low}
          y2={entryZone.high}
          fill={ABBOUD_COLORS.entryFill}
          stroke={ABBOUD_COLORS.entry}
          strokeDasharray="4 2"
          strokeOpacity={0.5}
          label={{
            value: "ENTRY ZONE",
            fill: ABBOUD_COLORS.entry,
            fontSize: 9,
            fontWeight: "bold",
            position: "insideTopRight",
          }}
        />
      )}

      {/* Stop Loss Line */}
      {stopLoss && (
        <ReferenceLine
          y={stopLoss}
          stroke={ABBOUD_COLORS.stopLoss}
          strokeWidth={2}
          strokeDasharray="8 4"
          label={{
            value: `STOP ${stopLoss.toFixed(3)}`,
            fill: ABBOUD_COLORS.stopLoss,
            fontSize: 9,
            fontWeight: "bold",
            position: "right",
          }}
        />
      )}

      {/* Target Lines (extension levels) */}
      {targets.map((t, i) => (
        <ReferenceLine
          key={`target-${i}`}
          y={t.price}
          stroke={ABBOUD_COLORS.target}
          strokeWidth={1.5}
          strokeDasharray="4 4"
          strokeOpacity={0.6}
          label={{
            value: `TP${i + 1} ${t.level} (${t.price.toFixed(3)})`,
            fill: ABBOUD_COLORS.target,
            fontSize: 8,
            position: "right",
          }}
        />
      ))}

      {/* Swing High/Low markers via 0% and 100% fib levels */}
      {fibLevels.filter(f => f.level === 0 || f.level === 1).map((fib) => (
        <ReferenceLine
          key={`swing-${fib.level}`}
          y={fib.price}
          stroke={ABBOUD_COLORS.gold}
          strokeWidth={1.5}
          strokeOpacity={0.5}
          label={{
            value: fib.level === 0 ? `Swing High ${fib.price.toFixed(3)}` : `Swing Low ${fib.price.toFixed(3)}`,
            fill: ABBOUD_COLORS.gold,
            fontSize: 8,
            fontWeight: "bold",
            position: "left",
          }}
        />
      ))}
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
