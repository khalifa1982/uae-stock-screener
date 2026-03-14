/**
 * DividendsView — Displays dividend data from StockAnalysis.com and Investing.com
 * Shows dividend history, yield, payout ratio, growth
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, Calendar, DollarSign, Percent } from "lucide-react";

interface DividendsViewProps {
  symbol: string;
  companyName: string;
  exchange: "ADX" | "DFM";
}

function StatCard({ icon: Icon, label, value, subValue, color }: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  color: string;
}) {
  return (
    <Card className="bg-card/50 border-border/40">
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-${color}/10`}>
            <Icon className={`w-4 h-4 text-${color}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold font-mono">{value}</p>
            {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DividendsView({ symbol, companyName, exchange }: DividendsViewProps) {
  // Fetch from StockAnalysis.com
  const { data: saData, isLoading: saLoading } = trpc.sa.dividends.useQuery(
    { symbol, exchange },
    { staleTime: 24 * 60 * 60 * 1000 }
  );

  // Fetch from Investing.com
  const { data: invData, isLoading: invLoading } = trpc.investingCom.data.useQuery(
    { symbol, companyName, exchange },
    { staleTime: 24 * 60 * 60 * 1000 }
  );

  const isLoading = saLoading || invLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="bg-card/50 border-border/40">
              <CardContent className="py-4"><Skeleton className="h-16 w-full" /></CardContent>
            </Card>
          ))}
        </div>
        <Card className="bg-card/50 border-border/40">
          <CardContent><Skeleton className="h-48 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  // Merge data from both sources (SA takes priority, INV fills gaps)
  const dividendYield = saData?.currentYield ?? invData?.dividends?.currentYield ?? null;
  const annualDividend = saData?.annualDividend ?? invData?.dividends?.annualDividend ?? null;
  const payoutRatio = saData?.payoutRatio ?? invData?.dividends?.payoutRatio ?? null;
  const exDividendDate = saData?.history?.[0]?.exDate ?? invData?.dividends?.exDividendDate ?? null;
  const dividendGrowth = saData?.dividendGrowth5Y ?? invData?.dividends?.dividendGrowth5Y ?? null;
  const frequency = saData?.history?.[0]?.frequency ?? null;

  // Dividend history from SA (more reliable)
  const history = saData?.history || [];

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Percent}
          label="Dividend Yield"
          value={dividendYield != null ? `${dividendYield.toFixed(2)}%` : "—"}
          color="cyan-400"
        />
        <StatCard
          icon={DollarSign}
          label="Annual Dividend"
          value={annualDividend != null ? `${annualDividend.toFixed(3)} AED` : "—"}
          subValue={frequency || undefined}
          color="emerald-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Payout Ratio"
          value={payoutRatio != null ? `${payoutRatio.toFixed(1)}%` : "—"}
          subValue={dividendGrowth != null ? `5Y Growth: ${dividendGrowth > 0 ? "+" : ""}${dividendGrowth.toFixed(1)}%` : undefined}
          color="purple-400"
        />
        <StatCard
          icon={Calendar}
          label="Ex-Dividend Date"
          value={exDividendDate || "—"}
          color="amber-400"
        />
      </div>

      {/* Dividend History Table */}
      <Card className="bg-card/50 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Dividend History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Ex-Date</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Amount</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Yield</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Type</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Payment Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-border/10 last:border-0 hover:bg-muted/10">
                      <td className="py-2 font-mono text-xs">{row.exDate || "—"}</td>
                      <td className="py-2 text-right font-mono text-cyan-400">
                        {row.amount != null ? row.amount.toFixed(4) : "—"}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {row.yield != null ? `${row.yield.toFixed(2)}%` : "—"}
                      </td>
                      <td className="py-2 text-right">
                        <Badge variant="outline" className="text-xs">
                          {row.type || "Cash"}
                        </Badge>
                      </td>
                      <td className="py-2 text-right font-mono text-xs text-muted-foreground">
                        {row.paymentDate || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground/60">No dividend history available</p>
              <p className="text-xs text-muted-foreground/40 mt-1">This stock may not pay dividends</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Source attribution */}
      <p className="text-xs text-muted-foreground/40 text-right">
        Sources: StockAnalysis.com, Investing.com
      </p>
    </div>
  );
}
