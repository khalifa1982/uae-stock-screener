/**
 * DividendsView — Displays dividend data from StockAnalysis.com and Investing.com
 * Shows dividend history, yield charts, payout ratio trends, and growth visualization
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, TrendingUp, Calendar, DollarSign, Percent, BarChart3, LineChart as LineChartIcon } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

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
          <div className={`p-2  bg-${color}/10`}>
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

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover/95  border border-border/50  px-3 py-2 shadow-xl">
      <p className="text-xs font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" ? entry.value.toFixed(2) : entry.value}
          {entry.name.includes("Yield") || entry.name.includes("Payout") || entry.name.includes("Growth") ? "%" : entry.name.includes("Dividend") ? " AED" : ""}
        </p>
      ))}
    </div>
  );
}

export default function DividendsView({ symbol, companyName, exchange }: DividendsViewProps) {
  const [chartView, setChartView] = useState<"yield" | "dividend" | "payout">("yield");

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

  // Prepare chart data from annualYields
  const chartData = useMemo(() => {
    if (!saData?.annualYields) return [];
    return [...saData.annualYields]
      .reverse() // oldest first for chart
      .filter(y => y.year && y.year !== "TTM")
      .map(y => ({
        year: y.year,
        dividend: y.dividend,
        yield: y.yield,
        growth: y.growth,
        payoutRatio: y.payoutRatio,
      }));
  }, [saData]);

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
          <CardContent className="py-6"><Skeleton className="h-64 w-full" /></CardContent>
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

      {/* Interactive Charts */}
      {chartData.length > 1 && (
        <Card className="bg-card/50 border-border/40">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Dividend History Charts</CardTitle>
              <div className="flex gap-1">
                <Button
                  variant={chartView === "yield" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => setChartView("yield")}
                >
                  <LineChartIcon className="w-3 h-3 mr-1" /> Yield
                </Button>
                <Button
                  variant={chartView === "dividend" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => setChartView("dividend")}
                >
                  <BarChart3 className="w-3 h-3 mr-1" /> Amount
                </Button>
                <Button
                  variant={chartView === "payout" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => setChartView("payout")}
                >
                  <Percent className="w-3 h-3 mr-1" /> Payout
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {chartView === "yield" ? (
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="yieldGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="yield"
                      name="Dividend Yield"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      fill="url(#yieldGradient)"
                      dot={{ r: 3, fill: "#06b6d4" }}
                      activeDot={{ r: 5, stroke: "#06b6d4", strokeWidth: 2 }}
                    />
                  </AreaChart>
                ) : chartView === "dividend" ? (
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dividendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `${v}`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      yAxisId="left"
                      dataKey="dividend"
                      name="Dividend (AED)"
                      fill="url(#dividendGradient)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="growth"
                      name="YoY Growth"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#f59e0b" }}
                    />
                  </ComposedChart>
                ) : (
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="payoutGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      type="monotone"
                      dataKey="payoutRatio"
                      name="Payout Ratio"
                      stroke="#a855f7"
                      strokeWidth={2}
                      fill="url(#payoutGradient)"
                      dot={{ r: 3, fill: "#a855f7" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="yield"
                      name="Dividend Yield"
                      stroke="#06b6d4"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={{ r: 2, fill: "#06b6d4" }}
                    />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Annual Yields Table */}
      {saData?.annualYields && saData.annualYields.length > 0 && (
        <Card className="bg-card/50 border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Annual Dividend Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Year</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Dividend</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Yield</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Growth</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Payout Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {saData.annualYields.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-border/10 last:border-0 hover:bg-muted/10">
                      <td className="py-2 font-mono text-xs font-medium">{row.year}</td>
                      <td className="py-2 text-right font-mono text-emerald-400">
                        {row.dividend != null ? `${row.dividend.toFixed(3)} AED` : "—"}
                      </td>
                      <td className="py-2 text-right font-mono text-cyan-400">
                        {row.yield != null ? `${row.yield.toFixed(2)}%` : "—"}
                      </td>
                      <td className={`py-2 text-right font-mono ${row.growth != null ? (row.growth > 0 ? "text-emerald-400" : "text-red-400") : ""}`}>
                        {row.growth != null ? `${row.growth > 0 ? "+" : ""}${row.growth.toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-2 text-right font-mono text-purple-400">
                        {row.payoutRatio != null ? `${row.payoutRatio.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dividend Payment History Table */}
      <Card className="bg-card/50 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Ex-Date</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Amount</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Type</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Payment Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-border/10 last:border-0 hover:bg-muted/10">
                      <td className="py-2 font-mono text-xs">{row.exDate || "—"}</td>
                      <td className="py-2 text-right font-mono text-cyan-400">
                        {row.amount != null ? `${row.amount.toFixed(4)} AED` : "—"}
                      </td>
                      <td className="py-2 text-right">
                        <Badge variant="outline" className="text-xs">
                          {row.type || "Cash"}
                        </Badge>
                      </td>
                      <td className="py-2 text-right font-mono text-xs text-muted-foreground">
                        {row.payDate || "—"}
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
