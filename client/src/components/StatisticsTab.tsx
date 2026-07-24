/**
 * StatisticsTab — Comprehensive statistics view from StockAnalysis.com
 * Organized into sections: Valuation, Enterprise Value, Financial Position,
 * Efficiency, Margins, Dividends & Yields, Fair Value, Scores, Price Stats
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Shield,
  BarChart3, Target, Activity, Layers, Gauge, Calculator
} from "lucide-react";

interface StatisticsTabProps {
  symbol: string;
  exchange: "ADX" | "DFM";
}

function formatValue(val: number | string | null | undefined, suffix = "", prefix = ""): string {
  if (val == null) return "—";
  if (typeof val === "string") return val;
  if (suffix === "%") return `${prefix}${val.toFixed(2)}%`;
  if (Math.abs(val) >= 1e9) return `${prefix}${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e6) return `${prefix}${(val / 1e6).toFixed(2)}M`;
  if (Math.abs(val) >= 1e3) return `${prefix}${(val / 1e3).toFixed(1)}K`;
  return `${prefix}${val.toFixed(2)}`;
}

function getColor(val: number | null, thresholds: { good: number; bad: number; higherIsBetter?: boolean }): string {
  if (val == null) return "text-muted-foreground";
  const { good, bad, higherIsBetter = true } = thresholds;
  if (higherIsBetter) {
    if (val >= good) return "text-emerald-400";
    if (val <= bad) return "text-red-400";
    return "text-amber-400";
  } else {
    if (val <= good) return "text-emerald-400";
    if (val >= bad) return "text-red-400";
    return "text-amber-400";
  }
}

function StatRow({ label, value, color, tooltip }: {
  label: string;
  value: string;
  color?: string;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/10 last:border-0 group">
      <span className="text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors" title={tooltip}>
        {label}
      </span>
      <span className={`text-sm font-mono font-medium ${color || "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, color }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  color: string;
}) {
  return (
    <Card className="bg-card/50 border-border/40 hover:border-border/60 transition-colors">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
          <Icon className={`h-3.5 w-3.5 ${color}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {children}
      </CardContent>
    </Card>
  );
}

export function StatisticsTab({ symbol, exchange }: StatisticsTabProps) {
  const { data: stats, isLoading } = trpc.sa.statistics.useQuery(
    { symbol, exchange },
    { staleTime: 900_000, gcTime: 3600_000, refetchOnWindowFocus: false }
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Card key={i} className="bg-card/50 border-border/40">
            <CardContent className="py-6"><Skeleton className="h-40 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <Card className="bg-card/50 border-border/40">
        <CardContent className="py-12 text-center">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No statistics data available for this stock</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Data may not be available from StockAnalysis.com</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Score Badges at top */}
      {(stats.altmanZScore != null || stats.piotoskiFScore != null) && (
        <div className="flex flex-wrap gap-3">
          {stats.altmanZScore != null && (
            <Badge variant="outline" className={`text-sm px-3 py-1.5 ${
              stats.altmanZScore > 2.99 ? "border-emerald-500/50 text-emerald-400" :
              stats.altmanZScore > 1.81 ? "border-amber-500/50 text-amber-400" :
              "border-red-500/50 text-red-400"
            }`}>
              <Shield className="w-3.5 h-3.5 mr-1.5" />
              Altman Z-Score: {stats.altmanZScore.toFixed(2)}
              <span className="ml-1.5 text-xs opacity-70">
                ({stats.altmanZScore > 2.99 ? "Safe" : stats.altmanZScore > 1.81 ? "Grey Zone" : "Distress"})
              </span>
            </Badge>
          )}
          {stats.piotoskiFScore != null && (
            <Badge variant="outline" className={`text-sm px-3 py-1.5 ${
              stats.piotoskiFScore >= 7 ? "border-emerald-500/50 text-emerald-400" :
              stats.piotoskiFScore >= 4 ? "border-amber-500/50 text-amber-400" :
              "border-red-500/50 text-red-400"
            }`}>
              <Target className="w-3.5 h-3.5 mr-1.5" />
              Piotroski F-Score: {stats.piotoskiFScore}/9
              <span className="ml-1.5 text-xs opacity-70">
                ({stats.piotoskiFScore >= 7 ? "Strong" : stats.piotoskiFScore >= 4 ? "Moderate" : "Weak"})
              </span>
            </Badge>
          )}
        </div>
      )}

      {/* Fair Value Section */}
      {(stats.lynchFairValue != null || stats.grahamNumber != null) && (
        <Card className="bg-gradient-to-r from-card/80 to-card/50 border-border/40">
          <CardContent className="py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats.lynchFairValue != null && (
                <div className="flex items-center gap-3">
                  <div className="p-2  bg-cyan-500/10">
                    <Calculator className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Lynch Fair Value</p>
                    <p className="text-lg font-bold font-mono">{stats.lynchFairValue.toFixed(2)} AED</p>
                    {stats.lynchUpside != null && (
                      <p className={`text-xs font-mono ${stats.lynchUpside > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {stats.lynchUpside > 0 ? "▲" : "▼"} {Math.abs(stats.lynchUpside).toFixed(1)}% {stats.lynchUpside > 0 ? "Undervalued" : "Overvalued"}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {stats.grahamNumber != null && (
                <div className="flex items-center gap-3">
                  <div className="p-2  bg-purple-500/10">
                    <Calculator className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Graham Number</p>
                    <p className="text-lg font-bold font-mono">{stats.grahamNumber.toFixed(2)} AED</p>
                    {stats.grahamUpside != null && (
                      <p className={`text-xs font-mono ${stats.grahamUpside > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {stats.grahamUpside > 0 ? "▲" : "▼"} {Math.abs(stats.grahamUpside).toFixed(1)}% {stats.grahamUpside > 0 ? "Undervalued" : "Overvalued"}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Valuation Ratios */}
        <SectionCard title="Valuation Ratios" icon={DollarSign} color="text-cyan-400">
          <StatRow label="P/E Ratio" value={formatValue(stats.peRatio)} color={getColor(stats.peRatio, { good: 15, bad: 30, higherIsBetter: false })} />
          <StatRow label="Forward P/E" value={formatValue(stats.forwardPE)} color={getColor(stats.forwardPE, { good: 12, bad: 25, higherIsBetter: false })} />
          <StatRow label="P/S Ratio" value={formatValue(stats.psRatio)} />
          <StatRow label="P/B Ratio" value={formatValue(stats.pbRatio)} color={getColor(stats.pbRatio, { good: 1.5, bad: 5, higherIsBetter: false })} />
          <StatRow label="P/TBV" value={formatValue(stats.pTBV)} />
          <StatRow label="P/FCF" value={formatValue(stats.pFCF)} />
          <StatRow label="P/OCF" value={formatValue(stats.pOCF)} />
          <StatRow label="PEG Ratio" value={formatValue(stats.pegRatio)} color={getColor(stats.pegRatio, { good: 1, bad: 2, higherIsBetter: false })} />
        </SectionCard>

        {/* Enterprise Value */}
        <SectionCard title="Enterprise Value" icon={Layers} color="text-purple-400">
          <StatRow label="Enterprise Value" value={formatValue(stats.enterpriseValue)} />
          <StatRow label="EV/Earnings" value={formatValue(stats.evEarnings)} />
          <StatRow label="EV/Sales" value={formatValue(stats.evSales)} />
          <StatRow label="EV/EBITDA" value={formatValue(stats.evEbitda)} color={getColor(stats.evEbitda, { good: 10, bad: 20, higherIsBetter: false })} />
          <StatRow label="EV/EBIT" value={formatValue(stats.evEbit)} />
          <StatRow label="EV/FCF" value={formatValue(stats.evFCF)} />
        </SectionCard>

        {/* Financial Position */}
        <SectionCard title="Financial Position" icon={Shield} color="text-emerald-400">
          <StatRow label="Current Ratio" value={formatValue(stats.currentRatio)} color={getColor(stats.currentRatio, { good: 1.5, bad: 1, higherIsBetter: true })} />
          <StatRow label="Quick Ratio" value={formatValue(stats.quickRatio)} color={getColor(stats.quickRatio, { good: 1, bad: 0.5, higherIsBetter: true })} />
          <StatRow label="Debt/Equity" value={formatValue(stats.debtToEquity)} color={getColor(stats.debtToEquity, { good: 0.5, bad: 2, higherIsBetter: false })} />
          <StatRow label="Debt/EBITDA" value={formatValue(stats.debtToEbitda)} color={getColor(stats.debtToEbitda, { good: 2, bad: 4, higherIsBetter: false })} />
          <StatRow label="Debt/FCF" value={formatValue(stats.debtToFCF)} />
          <StatRow label="Interest Coverage" value={formatValue(stats.interestCoverage)} color={getColor(stats.interestCoverage, { good: 5, bad: 2, higherIsBetter: true })} />
        </SectionCard>

        {/* Financial Efficiency */}
        <SectionCard title="Efficiency & Returns" icon={Gauge} color="text-amber-400">
          <StatRow label="ROE" value={formatValue(stats.roe, "%")} color={getColor(stats.roe, { good: 15, bad: 5, higherIsBetter: true })} />
          <StatRow label="ROA" value={formatValue(stats.roa, "%")} color={getColor(stats.roa, { good: 8, bad: 2, higherIsBetter: true })} />
          <StatRow label="ROIC" value={formatValue(stats.roic, "%")} color={getColor(stats.roic, { good: 12, bad: 5, higherIsBetter: true })} />
          <StatRow label="ROCE" value={formatValue(stats.roce, "%")} color={getColor(stats.roce, { good: 15, bad: 5, higherIsBetter: true })} />
          <StatRow label="WACC" value={formatValue(stats.wacc, "%")} />
          <StatRow label="Asset Turnover" value={formatValue(stats.assetTurnover)} />
          <StatRow label="Inventory Turnover" value={formatValue(stats.inventoryTurnover)} />
        </SectionCard>

        {/* Margins */}
        <SectionCard title="Profit Margins" icon={Percent} color="text-pink-400">
          <StatRow label="Gross Margin" value={formatValue(stats.grossMargin, "%")} color={getColor(stats.grossMargin, { good: 40, bad: 20, higherIsBetter: true })} />
          <StatRow label="Operating Margin" value={formatValue(stats.operatingMargin, "%")} color={getColor(stats.operatingMargin, { good: 20, bad: 5, higherIsBetter: true })} />
          <StatRow label="Pretax Margin" value={formatValue(stats.pretaxMargin, "%")} />
          <StatRow label="Profit Margin" value={formatValue(stats.profitMargin, "%")} color={getColor(stats.profitMargin, { good: 15, bad: 5, higherIsBetter: true })} />
          <StatRow label="EBITDA Margin" value={formatValue(stats.ebitdaMargin, "%")} />
          <StatRow label="EBIT Margin" value={formatValue(stats.ebitMargin, "%")} />
          <StatRow label="FCF Margin" value={formatValue(stats.fcfMargin, "%")} />
        </SectionCard>

        {/* Dividends & Yields */}
        <SectionCard title="Dividends & Yields" icon={DollarSign} color="text-green-400">
          <StatRow label="Dividend/Share" value={stats.dividendPerShare != null ? `${stats.dividendPerShare.toFixed(3)} AED` : "—"} />
          <StatRow label="Dividend Yield" value={formatValue(stats.dividendYield, "%")} color={getColor(stats.dividendYield, { good: 4, bad: 1, higherIsBetter: true })} />
          <StatRow label="Payout Ratio" value={formatValue(stats.payoutRatio, "%")} color={getColor(stats.payoutRatio, { good: 60, bad: 90, higherIsBetter: false })} />
          <StatRow label="Growth Years" value={stats.yearsOfDividendGrowth != null ? `${stats.yearsOfDividendGrowth} years` : "—"} />
          <StatRow label="Buyback Yield" value={formatValue(stats.buybackYield, "%")} />
          <StatRow label="Shareholder Yield" value={formatValue(stats.shareholderYield, "%")} />
          <StatRow label="Earnings Yield" value={formatValue(stats.earningsYield, "%")} />
          <StatRow label="FCF Yield" value={formatValue(stats.fcfYield, "%")} />
        </SectionCard>

        {/* Share Statistics */}
        <SectionCard title="Share Statistics" icon={BarChart3} color="text-blue-400">
          <StatRow label="Market Cap" value={formatValue(stats.marketCap)} />
          <StatRow label="Shares Outstanding" value={stats.sharesOutstanding || "—"} />
          <StatRow label="Float" value={stats.floatShares || "—"} />
          <StatRow label="Insider Ownership" value={formatValue(stats.insiderOwnership, "%")} />
          <StatRow label="Institutional Ownership" value={formatValue(stats.institutionalOwnership, "%")} />
          <StatRow label="Shares Change (YoY)" value={stats.sharesChangeYoY || "—"} />
          <StatRow label="Shares Change (QoQ)" value={stats.sharesChangeQoQ || "—"} />
        </SectionCard>

        {/* Price Statistics */}
        <SectionCard title="Price & Technical" icon={Activity} color="text-orange-400">
          <StatRow label="Beta" value={formatValue(stats.beta)} />
          <StatRow label="52W Change" value={formatValue(stats.weekChange52, "%")} color={stats.weekChange52 != null ? (stats.weekChange52 > 0 ? "text-emerald-400" : "text-red-400") : undefined} />
          <StatRow label="50-Day MA" value={formatValue(stats.ma50)} />
          <StatRow label="200-Day MA" value={formatValue(stats.ma200)} />
          <StatRow label="RSI (14)" value={formatValue(stats.rsi)} color={getColor(stats.rsi, { good: 50, bad: 70, higherIsBetter: false })} />
          <StatRow label="Avg Volume (20D)" value={formatValue(stats.avgVolume20)} />
        </SectionCard>

        {/* Balance Sheet Summary */}
        <SectionCard title="Balance Sheet" icon={Layers} color="text-teal-400">
          <StatRow label="Cash & Equivalents" value={stats.cash || "—"} />
          <StatRow label="Total Debt" value={stats.totalDebt || "—"} />
          <StatRow label="Net Cash" value={stats.netCash || "—"} />
          <StatRow label="Net Cash/Share" value={formatValue(stats.netCashPerShare)} />
          <StatRow label="Book Value" value={stats.bookValue || "—"} />
          <StatRow label="Book Value/Share" value={formatValue(stats.bookValuePerShare)} />
          <StatRow label="Working Capital" value={stats.workingCapital || "—"} />
        </SectionCard>
      </div>

      {/* Important Dates & Misc */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cash Flow */}
        <SectionCard title="Cash Flow Summary" icon={TrendingUp} color="text-sky-400">
          <StatRow label="Operating Cash Flow" value={stats.operatingCashFlow || "—"} />
          <StatRow label="Capital Expenditure" value={stats.capex || "—"} />
          <StatRow label="Free Cash Flow" value={stats.freeCashFlow || "—"} />
          <StatRow label="FCF/Share" value={formatValue(stats.fcfPerShare)} />
        </SectionCard>

        {/* Important Dates */}
        <SectionCard title="Important Dates & Tax" icon={Target} color="text-rose-400">
          <StatRow label="Earnings Date" value={stats.earningsDate || "—"} />
          <StatRow label="Ex-Dividend Date" value={stats.exDividendDate || "—"} />
          <StatRow label="Income Tax" value={stats.incomeTax || "—"} />
          <StatRow label="Effective Tax Rate" value={formatValue(stats.effectiveTaxRate, "%")} />
          {stats.lastSplitDate && <StatRow label="Last Split" value={`${stats.splitRatio || ""} (${stats.lastSplitDate})`} />}
        </SectionCard>
      </div>

      {/* Source */}
      <p className="text-xs text-muted-foreground/40 text-right">
        Source: StockAnalysis.com
      </p>
    </div>
  );
}
