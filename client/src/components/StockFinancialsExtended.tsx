import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, PieChart, DollarSign } from "lucide-react";

function formatNumber(num: number | null | undefined, decimals = 2): string {
  if (num == null || isNaN(num)) return "—";
  return num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatLargeNumber(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return "—";
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  if (abs >= 1e12) return sign + (abs / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + "K";
  return num.toLocaleString();
}

function formatPercent(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "—";
  // TradingView returns margins/returns already as percentages (e.g., 52.86 for 52.86%)
  return val.toFixed(2) + "%";
}

function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-1.5 px-2 rounded ${highlight ? "bg-primary/5" : "hover:bg-muted/10"}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-mono ${highlight ? "font-semibold text-foreground" : "text-foreground/80"}`}>{value}</span>
    </div>
  );
}

export function StockFinancialsExtended({ symbol }: { symbol: string }) {
  const { data, isLoading } = trpc.stocks.extendedFinancials.useQuery(
    { symbol },
    { staleTime: 600_000, gcTime: 1800_000, refetchOnWindowFocus: false }
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 " />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Extended financial data is not available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Valuation Ratios */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" /> Valuation Ratios
            <Badge variant="outline" className="text-[10px] ml-2">TradingView</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0">
            <DataRow label="P/E Ratio (TTM)" value={formatNumber(data.peTTM, 1)} highlight />
            <DataRow label="Price/Sales (TTM)" value={formatNumber(data.psRatio, 2)} />
            <DataRow label="Price/Book" value={formatNumber(data.pbRatio, 2)} />
            <DataRow label="Price/FCF" value={formatNumber(data.pFCF, 2)} />
            <DataRow label="EV/EBITDA" value={formatNumber(data.evEbitda, 2)} />
            <DataRow label="Enterprise Value" value={formatLargeNumber(data.enterpriseValue)} />
          </div>
        </CardContent>
      </Card>

      {/* Growth & Profitability */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Margins & Returns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Margins</h4>
              <div className="space-y-0">
                <DataRow label="Gross Margin (TTM)" value={formatPercent(data.grossMarginTTM)} highlight />
                <DataRow label="Operating Margin (TTM)" value={formatPercent(data.operatingMarginTTM)} />
                <DataRow label="Pre-Tax Margin" value={formatPercent(data.preTaxMargin)} />
                <DataRow label="Net Margin (TTM)" value={formatPercent(data.netMarginTTM)} />
                <DataRow label="After-Tax Margin" value={formatPercent(data.afterTaxMargin)} />
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Returns</h4>
              <div className="space-y-0">
                <DataRow label="Return on Equity" value={formatPercent(data.roe)} highlight />
                <DataRow label="Return on Assets" value={formatPercent(data.roa)} />
                <DataRow label="Return on Invested Capital" value={formatPercent(data.roic)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Income Statement */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" /> Income Statement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Annual</h4>
              <div className="space-y-0">
                <DataRow label="Revenue" value={formatLargeNumber(data.revenueAnnual)} highlight />
                <DataRow label="Gross Profit" value={formatLargeNumber(data.grossProfitAnnual)} />
                <DataRow label="EBITDA" value={formatLargeNumber(data.ebitdaAnnual)} />
                <DataRow label="Net Income" value={formatLargeNumber(data.netIncomeAnnual)} />
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quarterly</h4>
              <div className="space-y-0">
                <DataRow label="Revenue" value={formatLargeNumber(data.revenueQuarterly)} highlight />
                <DataRow label="Gross Profit" value={formatLargeNumber(data.grossProfitQuarterly)} />
                <DataRow label="EBITDA" value={formatLargeNumber(data.ebitdaQuarterly)} />
                <DataRow label="Net Income" value={formatLargeNumber(data.netIncomeQuarterly)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dividends */}
      {(data.dividendYield != null || data.dpsAnnual != null) && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" /> Dividend Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3  bg-secondary/30 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Yield</p>
                <p className="text-lg font-bold font-mono">{data.dividendYield != null ? formatPercent(data.dividendYield) : "—"}</p>
              </div>
              <div className="p-3  bg-secondary/30 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Per Share (Annual)</p>
                <p className="text-lg font-bold font-mono">{data.dpsAnnual != null ? formatNumber(data.dpsAnnual, 3) : "—"}</p>
              </div>
              <div className="p-3  bg-secondary/30 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Payout Ratio</p>
                <p className="text-lg font-bold font-mono">{data.payoutRatioTTM != null ? formatPercent(data.payoutRatioTTM) : "—"}</p>
              </div>
              <div className="p-3  bg-secondary/30 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Shares Outstanding</p>
                <p className="text-lg font-bold font-mono">{formatLargeNumber(data.sharesOutstanding)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ownership & Other */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Other Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {data.floatShares != null && (
              <div className="p-3  bg-secondary/30 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Float Shares</p>
                <p className="text-lg font-bold font-mono">{formatLargeNumber(data.floatShares)}</p>
              </div>
            )}
            {data.employees != null && (
              <div className="p-3  bg-secondary/30 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Employees</p>
                <p className="text-lg font-bold font-mono">{data.employees.toLocaleString()}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
