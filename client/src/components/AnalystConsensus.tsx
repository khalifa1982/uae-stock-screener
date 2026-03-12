/**
 * Analyst Consensus Widget
 * 
 * Displays analyst consensus view with:
 * - Consensus rating (Strong Buy / Buy / Hold / Sell / Strong Sell)
 * - Bearish / Neutral / Bullish breakdown with color-coded bar
 * - Price target slider (Low, Current, Average, High)
 * 
 * Styled to match terminal-style dark theme with compact layout.
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, TrendingUp } from "lucide-react";

interface AnalystConsensusProps {
  // Analyst recommendation data
  recommendation?: number | null; // -1 (strong sell) to +1 (strong buy)
  totalAnalysts?: number | null;
  strongBuy?: number | null;
  buy?: number | null;
  hold?: number | null;
  sell?: number | null;
  strongSell?: number | null;
  // Price targets
  targetLow?: number | null;
  targetHigh?: number | null;
  targetMean?: number | null;
  targetMedian?: number | null;
  currentPrice?: number | null;
  // Symbol for navigation
  symbol?: string;
}

function getRatingLabel(rec: number): { label: string; color: string } {
  if (rec >= 0.5) return { label: "Strong Buy", color: "text-[oklch(0.72_0.17_155)]" };
  if (rec >= 0.1) return { label: "Buy", color: "text-[oklch(0.72_0.17_155)]" };
  if (rec > -0.1) return { label: "Hold", color: "text-muted-foreground" };
  if (rec > -0.5) return { label: "Sell", color: "text-[oklch(0.65_0.22_25)]" };
  return { label: "Strong Sell", color: "text-[oklch(0.65_0.22_25)]" };
}

function formatPrice(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return "—";
  return num.toFixed(2);
}

export function AnalystConsensus({
  recommendation,
  totalAnalysts,
  strongBuy,
  buy,
  hold,
  sell,
  strongSell,
  targetLow,
  targetHigh,
  targetMean,
  targetMedian,
  currentPrice,
  symbol,
}: AnalystConsensusProps) {
  // Compute bearish/neutral/bullish counts
  const bearishCount = (strongSell ?? 0) + (sell ?? 0);
  const neutralCount = hold ?? 0;
  const bullishCount = (strongBuy ?? 0) + (buy ?? 0);
  const total = totalAnalysts ?? (bearishCount + neutralCount + bullishCount);

  // If no data at all, don't render
  if (total === 0 && recommendation == null && targetMean == null) return null;

  const rating = recommendation != null ? getRatingLabel(recommendation) : null;

  // Build the breakdown bar segments
  const segments = useMemo(() => {
    if (total === 0) return [];
    const segs: { count: number; type: "bearish" | "neutral" | "bullish" }[] = [];
    for (let i = 0; i < bearishCount; i++) segs.push({ count: 1, type: "bearish" });
    for (let i = 0; i < neutralCount; i++) segs.push({ count: 1, type: "neutral" });
    for (let i = 0; i < bullishCount; i++) segs.push({ count: 1, type: "bullish" });
    return segs;
  }, [bearishCount, neutralCount, bullishCount, total]);

  // Price target slider position (0-100%)
  const sliderPosition = useMemo(() => {
    if (currentPrice == null || targetLow == null || targetHigh == null) return null;
    if (targetHigh === targetLow) return 50;
    const pct = ((currentPrice - targetLow) / (targetHigh - targetLow)) * 100;
    return Math.max(0, Math.min(100, pct));
  }, [currentPrice, targetLow, targetHigh]);

  const avgPosition = useMemo(() => {
    if (targetMean == null || targetLow == null || targetHigh == null) return null;
    if (targetHigh === targetLow) return 50;
    const pct = ((targetMean - targetLow) / (targetHigh - targetLow)) * 100;
    return Math.max(0, Math.min(100, pct));
  }, [targetMean, targetLow, targetHigh]);

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-1 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            Analyst Consensus
          </CardTitle>
          {symbol && (
            <span className="text-[10px] text-muted-foreground hover:text-primary cursor-pointer flex items-center gap-0.5">
              See all <ChevronRight className="h-3 w-3" />
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* Rating + Analyst Count */}
        {(rating || total > 0) && (
          <div className="flex items-center justify-between">
            {rating && (
              <Badge variant="outline" className={`text-[11px] font-semibold px-2.5 py-0.5 border-border/50 ${rating.color}`}>
                {rating.label}
              </Badge>
            )}
            {total > 0 && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {total} analyst{total !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Bearish / Neutral / Bullish Breakdown */}
        {total > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[oklch(0.65_0.22_25)] font-semibold font-mono">
                {bearishCount} Bearish
              </span>
              <span className="text-muted-foreground font-semibold font-mono">
                {neutralCount} Neutral
              </span>
              <span className="text-[oklch(0.72_0.17_155)] font-semibold font-mono">
                {bullishCount} Bullish
              </span>
            </div>

            {/* Color-coded bar */}
            <div className="flex gap-[2px] h-2.5 rounded-sm overflow-hidden">
              {segments.map((seg, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-[1px] ${
                    seg.type === "bearish"
                      ? "bg-[oklch(0.65_0.22_25)]"
                      : seg.type === "neutral"
                      ? "bg-muted-foreground/30"
                      : "bg-[oklch(0.72_0.17_155)]"
                  }`}
                />
              ))}
              {/* Fill remaining with dashes if total > segments */}
              {segments.length === 0 && (
                <div className="flex-1 bg-muted-foreground/20 rounded-[1px]" />
              )}
            </div>
          </div>
        )}

        {/* Price Target Slider */}
        {targetLow != null && targetHigh != null && currentPrice != null && (
          <div className="space-y-2.5 pt-1">
            {/* Price labels */}
            <div className="flex items-center justify-between text-[10px] font-mono">
              <div className="text-center">
                <div className="text-foreground font-semibold">{formatPrice(targetLow)}</div>
                <div className="flex items-center gap-1 text-[oklch(0.65_0.22_25)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.22_25)]" />
                  Low
                </div>
              </div>
              <div className="text-center">
                <div className="text-foreground font-semibold">{formatPrice(currentPrice)}</div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full border border-muted-foreground" />
                  Current
                </div>
              </div>
              {targetMean != null && (
                <div className="text-center">
                  <div className="text-foreground font-semibold">{formatPrice(targetMean)}</div>
                  <div className="flex items-center gap-1 text-[oklch(0.72_0.17_155)]">
                    <span className="w-1.5 h-1.5 rounded-full border-2 border-[oklch(0.72_0.17_155)]" />
                    Average
                  </div>
                </div>
              )}
              <div className="text-center">
                <div className="text-foreground font-semibold">{formatPrice(targetHigh)}</div>
                <div className="flex items-center gap-1 text-[oklch(0.72_0.17_155)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.17_155)]" />
                  High
                </div>
              </div>
            </div>

            {/* Gradient slider bar */}
            <div className="relative h-2 rounded-full overflow-hidden">
              {/* Gradient background: red → gray → green */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: "linear-gradient(to right, oklch(0.65 0.22 25), oklch(0.45 0.01 260) 40%, oklch(0.45 0.01 260) 60%, oklch(0.72 0.17 155))",
                }}
              />

              {/* Current price marker */}
              {sliderPosition != null && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                  style={{ left: `${sliderPosition}%` }}
                >
                  <div className="w-4 h-4 rounded-full border-2 border-foreground bg-card shadow-md" />
                </div>
              )}

              {/* Average price marker */}
              {avgPosition != null && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                  style={{ left: `${avgPosition}%` }}
                >
                  <div className="w-3 h-3 rounded-full border-2 border-[oklch(0.72_0.17_155)] bg-card" />
                </div>
              )}

              {/* Low marker */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 z-10">
                <div className="w-2.5 h-2.5 rounded-full bg-[oklch(0.65_0.22_25)]" />
              </div>

              {/* High marker */}
              <div className="absolute top-1/2 -translate-y-1/2 right-0 z-10">
                <div className="w-2.5 h-2.5 rounded-full bg-[oklch(0.72_0.17_155)]" />
              </div>
            </div>

            {/* Upside/downside from current */}
            {targetMean != null && currentPrice != null && currentPrice > 0 && (
              <div className="text-center">
                {(() => {
                  const diff = ((targetMean - currentPrice) / currentPrice) * 100;
                  const isUp = diff > 0;
                  return (
                    <span className={`text-[10px] font-mono font-semibold ${isUp ? "text-[oklch(0.72_0.17_155)]" : "text-[oklch(0.65_0.22_25)]"}`}>
                      {isUp ? "+" : ""}{diff.toFixed(1)}% to avg target
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
