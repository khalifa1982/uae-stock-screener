import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, TrendingUp, TrendingDown, BarChart3, ArrowUp, ArrowDown } from "lucide-react";

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

function getRecommendationLabel(mark: number | null): { label: string; color: string } {
  if (mark === null) return { label: "N/A", color: "text-muted-foreground" };
  if (mark <= 1.5) return { label: "Strong Buy", color: "text-gain" };
  if (mark <= 2.5) return { label: "Buy", color: "text-[oklch(0.72_0.17_155/80%)]" };
  if (mark <= 3.5) return { label: "Hold", color: "text-muted-foreground" };
  if (mark <= 4.5) return { label: "Sell", color: "text-[oklch(0.65_0.22_25/80%)]" };
  return { label: "Strong Sell", color: "text-loss" };
}

/** Analyst rating gauge (like TradingView's semicircle) */
function AnalystRatingGauge({ mark }: { mark: number | null }) {
  if (mark === null) return null;
  const { label, color } = getRecommendationLabel(mark);
  // mark: 1=Strong Buy, 5=Strong Sell. Map to percentage (1→100%, 5→0%)
  const pct = Math.max(0, Math.min(100, ((5 - mark) / 4) * 100));

  return (
    <div className="flex flex-col items-center">
      {/* Semicircle gauge */}
      <div className="relative w-48 h-24 overflow-hidden">
        <svg viewBox="0 0 200 100" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M 10 95 A 90 90 0 0 1 190 95"
            fill="none"
            stroke="oklch(0.22 0.01 260)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Colored segments */}
          <path d="M 10 95 A 90 90 0 0 1 46 30" fill="none" stroke="oklch(0.65 0.22 25)" strokeWidth="12" strokeLinecap="round" />
          <path d="M 46 30 A 90 90 0 0 1 82 10" fill="none" stroke="oklch(0.65 0.22 25 / 60%)" strokeWidth="12" />
          <path d="M 82 10 A 90 90 0 0 1 118 10" fill="none" stroke="oklch(0.5 0.01 260)" strokeWidth="12" />
          <path d="M 118 10 A 90 90 0 0 1 154 30" fill="none" stroke="oklch(0.72 0.17 155 / 60%)" strokeWidth="12" />
          <path d="M 154 30 A 90 90 0 0 1 190 95" fill="none" stroke="oklch(0.72 0.17 155)" strokeWidth="12" strokeLinecap="round" />
          {/* Needle */}
          {(() => {
            const angle = Math.PI - (pct / 100) * Math.PI;
            const cx = 100, cy = 95, r = 65;
            const x = cx + r * Math.cos(angle);
            const y = cy - r * Math.sin(angle);
            return (
              <>
                <line x1={cx} y1={cy} x2={x} y2={y} stroke="oklch(0.93 0.005 260)" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx={cx} cy={cy} r="5" fill="oklch(0.93 0.005 260)" />
              </>
            );
          })()}
        </svg>
      </div>
      <span className={`text-lg font-bold mt-1 ${color}`}>{label}</span>
      <div className="flex justify-between w-48 text-[10px] text-muted-foreground mt-1">
        <span>Strong Sell</span>
        <span>Strong Buy</span>
      </div>
    </div>
  );
}

/** Price target bar visualization */
function PriceTargetBar({ low, median, high, current }: { low: number; median: number; high: number; current: number }) {
  const min = Math.min(low, current) * 0.95;
  const max = Math.max(high, current) * 1.05;
  const range = max - min;
  const pctLow = ((low - min) / range) * 100;
  const pctMedian = ((median - min) / range) * 100;
  const pctHigh = ((high - min) / range) * 100;
  const pctCurrent = ((current - min) / range) * 100;

  return (
    <div className="space-y-3">
      <div className="relative h-10">
        {/* Background bar */}
        <div className="absolute top-4 left-0 right-0 h-2 rounded-full bg-secondary/50" />
        {/* Range bar */}
        <div
          className="absolute top-4 h-2 rounded-full bg-gradient-to-r from-[oklch(0.72_0.17_155/40%)] to-[oklch(0.72_0.17_155)]"
          style={{ left: `${pctLow}%`, width: `${pctHigh - pctLow}%` }}
        />
        {/* Low marker */}
        <div className="absolute top-2.5 flex flex-col items-center" style={{ left: `${pctLow}%`, transform: 'translateX(-50%)' }}>
          <div className="w-0.5 h-5 bg-muted-foreground/70" />
        </div>
        {/* Median marker */}
        <div className="absolute top-2 flex flex-col items-center" style={{ left: `${pctMedian}%`, transform: 'translateX(-50%)' }}>
          <div className="w-1 h-6 bg-primary rounded-full" />
        </div>
        {/* High marker */}
        <div className="absolute top-2.5 flex flex-col items-center" style={{ left: `${pctHigh}%`, transform: 'translateX(-50%)' }}>
          <div className="w-0.5 h-5 bg-muted-foreground/70" />
        </div>
        {/* Current price marker */}
        <div className="absolute top-0 flex flex-col items-center" style={{ left: `${pctCurrent}%`, transform: 'translateX(-50%)' }}>
          <div className="w-3 h-3 rounded-full bg-foreground border-2 border-background" />
        </div>
      </div>
      <div className="flex justify-between text-xs">
        <div className="text-center">
          <div className="text-muted-foreground">Low</div>
          <div className="font-mono font-medium">{formatNumber(low)}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">Median</div>
          <div className="font-mono font-bold text-primary">{formatNumber(median)}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">Current</div>
          <div className="font-mono font-medium">{formatNumber(current)}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">High</div>
          <div className="font-mono font-medium">{formatNumber(high)}</div>
        </div>
      </div>
    </div>
  );
}

export function StockForecastsTab({ symbol, currentPrice }: { symbol: string; currentPrice: number | null }) {
  const { data: forecast, isLoading } = trpc.stocks.forecast.useQuery(
    { symbol },
    { staleTime: 600_000, gcTime: 1800_000, refetchOnWindowFocus: false }
  );

  const { data: profileData } = trpc.stocks.profile.useQuery(
    { symbol },
    { staleTime: 600_000, gcTime: 3600_000, refetchOnWindowFocus: false }
  );

  const profile = profileData?.profile;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 " />
        ))}
      </div>
    );
  }

  const hasForecast = forecast && (forecast.priceTargetMedian != null || forecast.recommendationMark != null);
  const hasAnalystData = profile && (profile.targetMeanPrice != null || profile.recommendationKey != null);

  if (!hasForecast && !hasAnalystData) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center">
          <Target className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No forecast data available for this stock.</p>
          <p className="text-xs text-muted-foreground mt-1">Analyst coverage may be limited for this stock.</p>
        </CardContent>
      </Card>
    );
  }

  const priceTarget = forecast?.priceTargetMedian ?? profile?.targetMedianPrice ?? profile?.targetMeanPrice;
  const priceTargetHigh = forecast?.priceTargetHigh ?? profile?.targetHighPrice;
  const priceTargetLow = forecast?.priceTargetLow ?? profile?.targetLowPrice;
  const upside = priceTarget && currentPrice ? ((priceTarget - currentPrice) / currentPrice) * 100 : null;

  return (
    <div className="space-y-6">
      {/* Price Target */}
      {priceTarget != null && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Price Target
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold font-mono text-primary">{formatNumber(priceTarget)} <span className="text-sm text-muted-foreground">AED</span></div>
                {upside != null && (
                  <div className={`flex items-center justify-center gap-1 mt-1 text-sm font-semibold ${upside > 0 ? "text-gain" : "text-loss"}`}>
                    {upside > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    {upside > 0 ? "+" : ""}{upside.toFixed(1)}% upside
                  </div>
                )}
              </div>
              {priceTargetLow != null && priceTargetHigh != null && currentPrice != null && (
                <div className="flex-1 w-full">
                  <PriceTargetBar low={priceTargetLow} median={priceTarget} high={priceTargetHigh} current={currentPrice} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analyst Rating */}
      {(forecast?.recommendationMark != null || profile?.recommendationKey) && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Analyst Rating
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              {forecast?.recommendationMark != null && (
                <AnalystRatingGauge mark={forecast.recommendationMark} />
              )}
              {profile?.numberOfAnalystOpinions != null && (
                <p className="text-xs text-muted-foreground">
                  Based on {profile.numberOfAnalystOpinions} analyst{profile.numberOfAnalystOpinions !== 1 ? 's' : ''} giving stock ratings
                </p>
              )}
            </div>

            {/* Recommendation Trend Table */}
            {profile?.recommendations && profile.recommendations.length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recommendation Trend</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/20">
                        <th className="text-left p-2 pl-4 font-medium text-muted-foreground">Period</th>
                        <th className="text-center p-2 font-medium text-gain">Strong Buy</th>
                        <th className="text-center p-2 font-medium text-[oklch(0.72_0.17_155/80%)]">Buy</th>
                        <th className="text-center p-2 font-medium text-muted-foreground">Hold</th>
                        <th className="text-center p-2 font-medium text-[oklch(0.65_0.22_25/80%)]">Sell</th>
                        <th className="text-center p-2 pr-4 font-medium text-loss">Strong Sell</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.recommendations.slice(0, 4).map((rec: any, i: number) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-muted/10">
                          <td className="p-2 pl-4 font-mono">{rec.period || `Period ${i + 1}`}</td>
                          <td className="p-2 text-center font-mono font-medium text-gain">{rec.strongBuy || 0}</td>
                          <td className="p-2 text-center font-mono">{rec.buy || 0}</td>
                          <td className="p-2 text-center font-mono">{rec.hold || 0}</td>
                          <td className="p-2 text-center font-mono">{rec.sell || 0}</td>
                          <td className="p-2 pr-4 text-center font-mono font-medium text-loss">{rec.strongSell || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* EPS Estimates */}
      {(forecast?.epsActualFQ != null || forecast?.epsForecastFQ != null || forecast?.epsForecastNextFQ != null) && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> EPS Estimates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {forecast.epsActualFQ != null && (
                <div className="p-3  bg-secondary/30 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">EPS Actual (FQ)</p>
                  <p className="text-lg font-bold font-mono">{formatNumber(forecast.epsActualFQ, 3)}</p>
                </div>
              )}
              {forecast.epsForecastFQ != null && (
                <div className="p-3  bg-secondary/30 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">EPS Estimate (FQ)</p>
                  <p className="text-lg font-bold font-mono">{formatNumber(forecast.epsForecastFQ, 3)}</p>
                </div>
              )}
              {forecast.epsForecastNextFQ != null && (
                <div className="p-3  bg-secondary/30 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">EPS Next FQ</p>
                  <p className="text-lg font-bold font-mono text-primary">{formatNumber(forecast.epsForecastNextFQ, 3)}</p>
                </div>
              )}
              {forecast.epsSurprisePercentFQ != null && (
                <div className="p-3  bg-secondary/30 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">EPS Surprise</p>
                  <p className={`text-lg font-bold font-mono ${forecast.epsSurprisePercentFQ > 0 ? "text-gain" : forecast.epsSurprisePercentFQ < 0 ? "text-loss" : ""}`}>
                    {forecast.epsSurprisePercentFQ > 0 ? "+" : ""}{forecast.epsSurprisePercentFQ.toFixed(1)}%
                  </p>
                </div>
              )}
            </div>

            {/* Revenue Forecast */}
            {(forecast.revenueForecastFQ != null || forecast.revenueForecastNextFQ != null) && (
              <div className="mt-4 pt-4 border-t border-border/30">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Revenue Forecast</h4>
                <div className="grid grid-cols-2 gap-4">
                  {forecast.revenueForecastFQ != null && (
                    <div className="p-3  bg-secondary/30 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Revenue Est (FQ)</p>
                      <p className="text-lg font-bold font-mono">{formatLargeNumber(forecast.revenueForecastFQ)}</p>
                    </div>
                  )}
                  {forecast.revenueForecastNextFQ != null && (
                    <div className="p-3  bg-secondary/30 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Revenue Est (Next FQ)</p>
                      <p className="text-lg font-bold font-mono text-primary">{formatLargeNumber(forecast.revenueForecastNextFQ)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Earnings History */}
      {profile?.earnings && profile.earnings.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Earnings History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20">
                    <th className="text-left p-2 pl-4 font-medium text-muted-foreground">Quarter</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">EPS Actual</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">EPS Estimate</th>
                    <th className="text-right p-2 pr-4 font-medium text-muted-foreground">Surprise</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.earnings.map((e: any, i: number) => (
                    <tr key={i} className="border-b border-border/20 hover:bg-muted/10">
                      <td className="p-2 pl-4 font-mono">{e.quarter || e.date || `Q${i + 1}`}</td>
                      <td className="p-2 text-right font-mono">{formatNumber(e.actual)}</td>
                      <td className="p-2 text-right font-mono">{formatNumber(e.estimate)}</td>
                      <td className={`p-2 pr-4 text-right font-mono font-medium ${e.surprise > 0 ? "text-gain" : e.surprise < 0 ? "text-loss" : ""}`}>
                        {e.surprise != null ? (e.surprise > 0 ? "+" : "") + formatNumber(e.surprise) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
