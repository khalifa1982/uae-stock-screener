import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, TrendingUp, TrendingDown } from "lucide-react";

export function StockSeasonalsTab({ symbol }: { symbol: string }) {
  const { data, isLoading } = trpc.stocks.seasonality.useQuery(
    { symbol },
    { staleTime: 3600_000, gcTime: 7200_000, refetchOnWindowFocus: false }
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 " />
        <Skeleton className="h-48 " />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Seasonality data is not available for this stock.</p>
          <p className="text-xs text-muted-foreground mt-1">Requires sufficient historical price data.</p>
        </CardContent>
      </Card>
    );
  }

  // data is Array<{ month: string; avgReturn: number; years: number[] }>
  const maxAbsVal = Math.max(...data.map(m => Math.abs(m.avgReturn)), 0.01);
  const yearsCount = data[0]?.years?.length ?? 0;

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Historical Seasonal Performance
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Average monthly returns based on historical data
              </p>
            </div>
            {yearsCount > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {yearsCount} years
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Bar chart */}
            <div className="flex items-end justify-between gap-2 h-48 px-2">
              {data.map((m) => {
                const isPositive = m.avgReturn >= 0;
                const barHeight = maxAbsVal > 0 ? (Math.abs(m.avgReturn) / maxAbsVal) * 100 : 0;
                return (
                  <div key={m.month} className="flex flex-col items-center flex-1 h-full justify-end relative">
                    <span className={`text-[9px] font-mono mb-1 ${isPositive ? "text-gain" : "text-loss"}`}>
                      {m.avgReturn > 0 ? "+" : ""}{m.avgReturn.toFixed(1)}%
                    </span>
                    <div
                      className={`w-full max-w-[32px] rounded-t-sm transition-all ${
                        isPositive
                          ? "bg-[oklch(0.72_0.17_155/60%)]"
                          : "bg-[oklch(0.65_0.22_25/60%)]"
                      }`}
                      style={{ height: `${Math.max(barHeight * 0.8, 4)}%` }}
                    />
                    <span className="text-[10px] text-muted-foreground mt-2 font-medium">{m.month}</span>
                  </div>
                );
              })}
            </div>

            {/* Detailed table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20">
                    <th className="text-left p-2 pl-4 font-medium text-muted-foreground">Month</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Avg Return</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Win Rate</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Best Year</th>
                    <th className="text-right p-2 pr-4 font-medium text-muted-foreground">Worst Year</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((m) => {
                    const positiveYears = m.years.filter(y => y > 0).length;
                    const winRate = m.years.length > 0 ? positiveYears / m.years.length : 0;
                    const best = m.years.length > 0 ? Math.max(...m.years) : 0;
                    const worst = m.years.length > 0 ? Math.min(...m.years) : 0;
                    return (
                      <tr key={m.month} className="border-b border-border/20 hover:bg-muted/10">
                        <td className="p-2 pl-4 font-medium">{m.month}</td>
                        <td className={`p-2 text-right font-mono font-medium ${m.avgReturn >= 0 ? "text-gain" : "text-loss"}`}>
                          {m.avgReturn > 0 ? "+" : ""}{m.avgReturn.toFixed(2)}%
                        </td>
                        <td className="p-2 text-right font-mono">
                          <span className={winRate >= 0.5 ? "text-gain" : "text-loss"}>
                            {(winRate * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="p-2 text-right font-mono text-gain">+{best.toFixed(2)}%</td>
                        <td className="p-2 pr-4 text-right font-mono text-loss">{worst.toFixed(2)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best/Worst months summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gain" /> Best Months
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...data]
                .sort((a, b) => b.avgReturn - a.avgReturn)
                .slice(0, 3)
                .map((m) => (
                  <div key={m.month} className="flex items-center justify-between p-2  bg-[oklch(0.72_0.17_155/5%)] border border-[oklch(0.72_0.17_155/15%)]">
                    <span className="text-sm font-medium">{m.month}</span>
                    <span className="text-sm font-mono font-bold text-gain">+{m.avgReturn.toFixed(2)}%</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-loss" /> Worst Months
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...data]
                .sort((a, b) => a.avgReturn - b.avgReturn)
                .slice(0, 3)
                .map((m) => (
                  <div key={m.month} className="flex items-center justify-between p-2  bg-[oklch(0.65_0.22_25/5%)] border border-[oklch(0.65_0.22_25/15%)]">
                    <span className="text-sm font-medium">{m.month}</span>
                    <span className="text-sm font-mono font-bold text-loss">{m.avgReturn.toFixed(2)}%</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
