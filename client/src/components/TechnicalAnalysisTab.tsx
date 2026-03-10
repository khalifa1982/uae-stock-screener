import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Gauge, Zap, ArrowUpDown, BarChart3, CircleDot, Activity, RefreshCw,
} from "lucide-react";

// ─── Signal Gauge SVG (TradingView-style semicircle) ───────────────
function SignalGauge({ value, label, counts }: {
  value: string; // "Strong Buy" | "Buy" | "Neutral" | "Sell" | "Strong Sell"
  label: string;
  counts?: { sell: number; neutral: number; buy: number };
}) {
  const signalToNum: Record<string, number> = {
    "Strong Sell": -1, "Sell": -0.5, "Neutral": 0, "Buy": 0.5, "Strong Buy": 1,
  };
  const num = signalToNum[value] ?? 0;
  const angle = 180 - ((num + 1) / 2) * 180;
  const rad = (angle * Math.PI) / 180;
  const cx = 100, cy = 90, r = 70;
  const needleX = cx + r * 0.85 * Math.cos(rad);
  const needleY = cy - r * 0.85 * Math.sin(rad);

  const getColor = (v: string) => {
    if (v.includes("Strong Sell")) return "text-red-500";
    if (v === "Sell") return "text-orange-500";
    if (v === "Neutral") return "text-gray-400";
    if (v === "Buy") return "text-emerald-400";
    return "text-emerald-500";
  };

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-48 h-28">
        <path d="M 20 90 A 80 80 0 0 1 52 38" fill="none" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
        <path d="M 52 38 A 80 80 0 0 1 100 10" fill="none" stroke="#f97316" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
        <path d="M 100 10 A 80 80 0 0 1 148 38" fill="none" stroke="#6b7280" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
        <path d="M 148 38 A 80 80 0 0 1 180 90" fill="none" stroke="#10b981" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="currentColor" strokeWidth="2.5" className="text-foreground" />
        <circle cx={cx} cy={cy} r="4" fill="currentColor" className="text-foreground" />
        <text x="15" y="105" className="fill-red-500 text-[9px]" textAnchor="start">Sell</text>
        <text x="185" y="105" className="fill-emerald-500 text-[9px]" textAnchor="end">Buy</text>
      </svg>
      <p className={`text-sm font-bold ${getColor(value)} -mt-1`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {counts && (
        <div className="flex gap-4 mt-2 text-xs">
          <span className="text-red-400">Sell <span className="font-bold">{counts.sell}</span></span>
          <span className="text-gray-400">Neutral <span className="font-bold">{counts.neutral}</span></span>
          <span className="text-emerald-400">Buy <span className="font-bold">{counts.buy}</span></span>
        </div>
      )}
    </div>
  );
}

function SignalBadge({ signal }: { signal: string }) {
  const color = signal === "Buy" ? "text-emerald-400 bg-emerald-500/10"
    : signal === "Sell" ? "text-red-400 bg-red-500/10"
    : "text-gray-400 bg-gray-500/10";
  return <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${color}`}>{signal}</span>;
}

function IndicatorRow({ label, value, signal }: { label: string; value: string; signal?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-secondary/20 transition-colors">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono font-medium text-foreground">{value}</span>
        {signal && <SignalBadge signal={signal} />}
      </div>
    </div>
  );
}

function formatNum(v: number | null | undefined, decimals = 3): string {
  if (v == null || isNaN(v)) return "—";
  return v.toFixed(decimals);
}

function formatLargeNum(v: number | null | undefined): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toFixed(0);
}

// ─── Main Component ────────────────────────────────────────────────
export function TechnicalAnalysisTab({ symbol, exchange, currentPrice }: {
  symbol: string;
  exchange: "ADX" | "DFM";
  currentPrice: number;
}) {
  const { data: analysis, isLoading, refetch, isFetching } = trpc.td.technicals.useQuery(
    { symbol, exchange, currentPrice },
    { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
      </div>
    );
  }

  if (!analysis) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center">
          <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Technical data is not available for this stock.</p>
        </CardContent>
      </Card>
    );
  }

  const { summary, oscillators, movingAverages, indicators } = analysis;

  // Compute oscillator signal for gauge
  const oscSignal = (() => {
    const buy = summary.oscillatorsBuy;
    const sell = summary.oscillatorsSell;
    const total = buy + sell + summary.oscillatorsNeutral;
    if (total === 0) return "Neutral";
    const buyR = buy / total;
    const sellR = sell / total;
    if (buyR > 0.6) return buyR > 0.8 ? "Strong Buy" : "Buy";
    if (sellR > 0.6) return sellR > 0.8 ? "Strong Sell" : "Sell";
    return "Neutral";
  })();

  const maSignal = (() => {
    const buy = summary.maBuy;
    const sell = summary.maSell;
    const total = buy + sell + summary.maNeutral;
    if (total === 0) return "Neutral";
    const buyR = buy / total;
    const sellR = sell / total;
    if (buyR > 0.6) return buyR > 0.8 ? "Strong Buy" : "Buy";
    if (sellR > 0.6) return sellR > 0.8 ? "Strong Sell" : "Sell";
    return "Neutral";
  })();

  const allSMA = movingAverages?.sma || [];
  const allEMA = movingAverages?.ema || [];

  // Pivot points from indicators
  const pivotPoints = indicators?.pivotPoints as { pivot?: number; s1?: number; s2?: number; s3?: number; r1?: number; r2?: number; r3?: number } | undefined;

  // Bollinger bands from indicators
  const bbands = indicators?.bbands as { upper?: number; middle?: number; lower?: number } | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">TwelveData Real-Time</Badge>
          <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/30">
            23 Indicators
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-7 text-xs gap-1">
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ═══ Summary Gauges ═══ */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" /> Indicators Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SignalGauge
              value={summary.overallSignal}
              label="Summary"
              counts={{
                sell: summary.oscillatorsSell + summary.maSell,
                neutral: summary.oscillatorsNeutral + summary.maNeutral,
                buy: summary.oscillatorsBuy + summary.maBuy,
              }}
            />
            <SignalGauge
              value={oscSignal}
              label="Oscillators"
              counts={{ sell: summary.oscillatorsSell, neutral: summary.oscillatorsNeutral, buy: summary.oscillatorsBuy }}
            />
            <SignalGauge
              value={maSignal}
              label="Moving Averages"
              counts={{ sell: summary.maSell, neutral: summary.maNeutral, buy: summary.maBuy }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ═══ Oscillators ═══ */}
      {oscillators && oscillators.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Oscillators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <div className="space-y-0.5">
                {oscillators.slice(0, Math.ceil(oscillators.length / 2)).map((o: { name: string; value: number; action: string }) => (
                  <IndicatorRow key={o.name} label={o.name} value={formatNum(o.value)} signal={o.action} />
                ))}
              </div>
              <div className="space-y-0.5">
                {oscillators.slice(Math.ceil(oscillators.length / 2)).map((o: { name: string; value: number; action: string }) => (
                  <IndicatorRow key={o.name} label={o.name} value={formatNum(o.value)} signal={o.action} />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ Moving Averages ═══ */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-primary" /> Moving Averages
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(allSMA.length > 0 || allEMA.length > 0) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Simple (SMA)</h4>
                <div className="space-y-0.5">
                  {allSMA.map((m: { name: string; period: number; value: number; action: string }) => (
                    <IndicatorRow key={`sma-${m.period}`} label={`SMA ${m.period}`} value={formatNum(m.value)} signal={m.action} />
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Exponential (EMA)</h4>
                <div className="space-y-0.5">
                  {allEMA.map((m: { name: string; period: number; value: number; action: string }) => (
                    <IndicatorRow key={`ema-${m.period}`} label={`EMA ${m.period}`} value={formatNum(m.value)} signal={m.action} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No moving average data available</p>
          )}
        </CardContent>
      </Card>

      {/* ═══ Bollinger Bands ═══ */}
      {bbands && (bbands.upper != null || bbands.middle != null || bbands.lower != null) && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Bollinger Bands (20, 2)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-3 rounded-lg bg-secondary/30 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Upper</p>
                <p className="text-sm font-bold font-mono text-emerald-400">{formatNum(bbands.upper)}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Middle</p>
                <p className="text-sm font-bold font-mono text-primary">{formatNum(bbands.middle)}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Lower</p>
                <p className="text-sm font-bold font-mono text-red-400">{formatNum(bbands.lower)}</p>
              </div>
            </div>
            {bbands.upper != null && bbands.lower != null && currentPrice > 0 && (
              <div className="relative h-8 bg-secondary/20 rounded-full overflow-hidden">
                {(() => {
                  const range = bbands.upper! - bbands.lower!;
                  const pos = range > 0 ? ((currentPrice - bbands.lower!) / range) * 100 : 50;
                  const clampedPos = Math.max(2, Math.min(98, pos));
                  return (
                    <>
                      <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500/20 via-transparent to-emerald-500/20 w-full" />
                      <div className="absolute top-1 bottom-1 w-1 bg-primary rounded-full shadow-lg shadow-primary/50" style={{ left: `${clampedPos}%` }} />
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">Lower</div>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">Upper</div>
                    </>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ Additional Indicators ═══ */}
      {indicators && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Additional Indicators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <div className="space-y-0.5">
                {indicators.atr != null && <IndicatorRow label="ATR (14)" value={formatNum(parseFloat(String(indicators.atr?.atr || indicators.atr)), 4)} />}
                {indicators.adx != null && (() => {
                  const val = parseFloat(String(indicators.adx?.adx || indicators.adx));
                  return <IndicatorRow label="ADX (14)" value={formatNum(val, 2)} signal={val > 25 ? "Strong Trend" : "Weak Trend"} />;
                })()}
                {indicators.cci != null && (() => {
                  const val = parseFloat(String(indicators.cci?.cci || indicators.cci));
                  return <IndicatorRow label="CCI (20)" value={formatNum(val, 2)} signal={val > 100 ? "Buy" : val < -100 ? "Sell" : "Neutral"} />;
                })()}
                {indicators.willr != null && (() => {
                  const val = parseFloat(String(indicators.willr?.willr || indicators.willr));
                  return <IndicatorRow label="Williams %R" value={formatNum(val, 2)} signal={val > -20 ? "Sell" : val < -80 ? "Buy" : "Neutral"} />;
                })()}
                {indicators.roc != null && (() => {
                  const val = parseFloat(String(indicators.roc?.roc || indicators.roc));
                  return <IndicatorRow label="ROC (10)" value={formatNum(val, 4)} signal={val > 0 ? "Buy" : "Sell"} />;
                })()}
              </div>
              <div className="space-y-0.5">
                {indicators.aroon != null && (() => {
                  const up = parseFloat(String(indicators.aroon?.aroon_up || "0"));
                  const down = parseFloat(String(indicators.aroon?.aroon_down || "0"));
                  return (
                    <>
                      <IndicatorRow label="Aroon Up" value={formatNum(up, 2)} />
                      <IndicatorRow label="Aroon Down" value={formatNum(down, 2)} />
                    </>
                  );
                })()}
                {indicators.stochrsi != null && (() => {
                  const k = parseFloat(String(indicators.stochrsi?.fast_k || "0"));
                  const d = parseFloat(String(indicators.stochrsi?.fast_d || "0"));
                  return (
                    <>
                      <IndicatorRow label="Stoch RSI %K" value={formatNum(k, 4)} />
                      <IndicatorRow label="Stoch RSI %D" value={formatNum(d, 4)} />
                    </>
                  );
                })()}
                {indicators.obv != null && <IndicatorRow label="OBV" value={formatLargeNum(parseFloat(String(indicators.obv?.obv || indicators.obv)))} />}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
