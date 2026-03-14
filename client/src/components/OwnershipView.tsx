/**
 * OwnershipView — Displays shareholders, ownership breakdown, geographic distribution, and ESG data
 * Data from MarketScreener.com via Scrapfly.io
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PieChart, Users, Globe, Leaf, AlertCircle } from "lucide-react";

interface OwnershipViewProps {
  symbol: string;
  companyName: string;
  exchange: "ADX" | "DFM";
}

// ESG rating color mapping
function getESGColor(rating: string | null): string {
  if (!rating) return "text-muted-foreground";
  switch (rating.toUpperCase()) {
    case "AAA": return "text-emerald-400";
    case "AA": return "text-emerald-500";
    case "A": return "text-green-400";
    case "BBB": return "text-yellow-400";
    case "BB": return "text-orange-400";
    case "B": return "text-orange-500";
    case "CCC": return "text-red-500";
    default: return "text-muted-foreground";
  }
}

function getESGBadgeVariant(description: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (!description) return "outline";
  switch (description.toLowerCase()) {
    case "leader": return "default";
    case "average": return "secondary";
    case "laggard": return "destructive";
    default: return "outline";
  }
}

// Simple bar component for ownership percentages
function OwnershipBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-sm text-muted-foreground w-32 shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-sm font-mono w-14 text-right">{value.toFixed(1)}%</span>
    </div>
  );
}

export default function OwnershipView({ symbol, companyName, exchange }: OwnershipViewProps) {
  const { data, isLoading, error } = trpc.marketScreener.data.useQuery(
    { symbol, companyName, exchange },
    { staleTime: 24 * 60 * 60 * 1000 } // 24h stale time
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="bg-card/50 border-border/40">
            <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
            <CardContent><Skeleton className="h-32 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-card/50 border-border/40">
        <CardContent className="py-8 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Failed to load ownership data</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  const ownership = data?.ownership;
  const consensus = data?.consensus;
  const esg = data?.esg;

  const ownershipColors = [
    "bg-cyan-500", "bg-blue-500", "bg-purple-500", "bg-pink-500",
    "bg-amber-500", "bg-emerald-500", "bg-red-500", "bg-indigo-500",
  ];

  const geoColors = [
    "bg-emerald-500", "bg-cyan-500", "bg-blue-500", "bg-purple-500",
    "bg-amber-500", "bg-pink-500", "bg-red-500", "bg-indigo-500",
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Major Shareholders */}
        <Card className="bg-card/50 border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Major Shareholders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ownership?.shareholders && ownership.shareholders.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_80px_100px] gap-2 text-xs text-muted-foreground pb-1 border-b border-border/30">
                  <span>Shareholder</span>
                  <span className="text-right">Equity %</span>
                  <span className="text-right">Value (Mln)</span>
                </div>
                {ownership.shareholders.map((sh, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_100px] gap-2 text-sm py-1 border-b border-border/10 last:border-0">
                    <span className="truncate" title={sh.name}>{sh.name}</span>
                    <span className="text-right font-mono text-cyan-400">
                      {sh.equityPercent != null ? `${sh.equityPercent.toFixed(2)}%` : "—"}
                    </span>
                    <span className="text-right font-mono text-muted-foreground">
                      {sh.valuationMln != null ? sh.valuationMln.toLocaleString() : "—"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/60 text-center py-6">No shareholder data available</p>
            )}
          </CardContent>
        </Card>

        {/* Ownership Breakdown */}
        <Card className="bg-card/50 border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PieChart className="w-4 h-4 text-purple-400" />
              Ownership Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ownership?.ownershipBreakdown && Object.keys(ownership.ownershipBreakdown).length > 0 ? (
              <div className="space-y-1">
                {Object.entries(ownership.ownershipBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, pct], i) => (
                    <OwnershipBar
                      key={category}
                      label={category}
                      value={pct}
                      color={ownershipColors[i % ownershipColors.length]}
                    />
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/60 text-center py-6">No breakdown data available</p>
            )}
          </CardContent>
        </Card>

        {/* Geographic Distribution */}
        <Card className="bg-card/50 border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              Geographic Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ownership?.geographicDistribution && Object.keys(ownership.geographicDistribution).length > 0 ? (
              <div className="space-y-1">
                {Object.entries(ownership.geographicDistribution)
                  .sort(([, a], [, b]) => b - a)
                  .map(([country, pct], i) => (
                    <OwnershipBar
                      key={country}
                      label={country}
                      value={pct}
                      color={geoColors[i % geoColors.length]}
                    />
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/60 text-center py-6">No geographic data available</p>
            )}
          </CardContent>
        </Card>

        {/* Analyst Consensus & ESG */}
        <div className="space-y-4">
          {/* Analyst Consensus */}
          <Card className="bg-card/50 border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Analyst Consensus</CardTitle>
            </CardHeader>
            <CardContent>
              {consensus ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Recommendation</span>
                    <Badge variant={
                      consensus.recommendation?.toLowerCase().includes("buy") ? "default" :
                      consensus.recommendation?.toLowerCase().includes("sell") ? "destructive" :
                      "secondary"
                    }>
                      {consensus.recommendation || "—"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Analysts</span>
                    <span className="text-sm font-mono">{consensus.analystCount ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Target Price</span>
                    <span className="text-sm font-mono text-cyan-400">
                      {consensus.targetPrice != null
                        ? `${consensus.targetPrice.toFixed(2)} ${consensus.targetPriceCurrency || "AED"}`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Upside</span>
                    <span className={`text-sm font-mono ${
                      consensus.upside != null && consensus.upside > 0 ? "text-emerald-400" :
                      consensus.upside != null && consensus.upside < 0 ? "text-red-400" :
                      "text-muted-foreground"
                    }`}>
                      {consensus.upside != null ? `${consensus.upside > 0 ? "+" : ""}${consensus.upside.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                  {consensus.analysts.length > 0 && (
                    <div className="pt-2 border-t border-border/30">
                      <span className="text-xs text-muted-foreground">Coverage by:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {consensus.analysts.map((a, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{a}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/60 text-center py-4">No consensus data available</p>
              )}
            </CardContent>
          </Card>

          {/* ESG Rating */}
          <Card className="bg-card/50 border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Leaf className="w-4 h-4 text-green-400" />
                ESG MSCI Rating
              </CardTitle>
            </CardHeader>
            <CardContent>
              {esg?.msciRating ? (
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`text-3xl font-bold ${getESGColor(esg.msciRating)}`}>
                      {esg.msciRating}
                    </span>
                    {esg.msciDescription && (
                      <Badge variant={getESGBadgeVariant(esg.msciDescription)} className="ml-3">
                        {esg.msciDescription}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>MSCI ESG Rating</div>
                    <div className="mt-1">Scale: CCC → AAA</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/60 text-center py-4">No ESG rating available</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Source attribution */}
      <p className="text-xs text-muted-foreground/40 text-right">
        Source: MarketScreener.com · Updated: {data?.fetchedAt ? new Date(data.fetchedAt).toLocaleString() : "—"}
      </p>
    </div>
  );
}
