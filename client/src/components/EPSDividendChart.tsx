/**
 * EPSDividendChart — 5-year grouped bar chart comparing EPS vs Dividend per share
 * Uses StockAnalysis financials data for historical EPS and dividend data
 */
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

interface EPSDividendChartProps {
  eps: number | null;
  dividendPerShare: number | null;
  symbol: string;
  exchange?: "ADX" | "DFM";
}

export function EPSDividendChart({ eps, dividendPerShare, symbol, exchange = "DFM" }: EPSDividendChartProps) {
  // Fetch historical financials for EPS data
  const { data: financials } = trpc.sa.financials.useQuery(
    { symbol, exchange },
    { staleTime: 900_000, gcTime: 3600_000, refetchOnWindowFocus: false, enabled: !!symbol }
  );
  // Fetch historical dividend data
  const { data: dividendData } = trpc.sa.dividends.useQuery(
    { symbol, exchange },
    { staleTime: 24 * 60 * 60 * 1000, refetchOnWindowFocus: false, enabled: !!symbol }
  );

  // Build 5-year historical data
  const chartData = useMemo(() => {
    const yearData = new Map<string, { eps: number | null; dividend: number | null }>();

    // Get EPS from income statement
    const periods = financials?.periods?.incomeStatement || [];
    const epsRow = financials?.incomeStatement?.["EPS (Diluted)"] ||
                   financials?.incomeStatement?.["EPS (Basic)"] ||
                   financials?.incomeStatement?.["Earnings Per Share"] || null;

    if (periods.length > 0 && epsRow) {
      const recentPeriods = periods.slice(0, 5);
      recentPeriods.forEach((period: string, idx: number) => {
        const yearMatch = period.match(/\d{4}/);
        const year = yearMatch ? yearMatch[0] : period;
        yearData.set(year, { eps: epsRow[idx], dividend: null });
      });
    }

    // Merge dividend data from annual yields
    const annualYields = dividendData?.annualYields || [];
    for (const ay of annualYields) {
      const year = ay.year;
      if (yearData.has(year)) {
        yearData.get(year)!.dividend = ay.dividend;
      } else {
        yearData.set(year, { eps: null, dividend: ay.dividend });
      }
    }

    // Sort by year ascending, take last 5
    return Array.from(yearData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-5)
      .map(([year, data]) => ({
        year,
        EPS: data.eps ?? 0,
        Dividend: data.dividend ?? 0,
      }));
  }, [financials, dividendData]);

  // Fallback to current data if no historical data
  const hasHistorical = chartData.length > 1;
  const displayData = hasHistorical ? chartData : [{
    year: "Current",
    EPS: eps ?? 0,
    Dividend: dividendPerShare ?? 0,
  }];

  if (eps == null && dividendPerShare == null && chartData.length === 0) return null;

  // Calculate growth trends
  const epsGrowth = chartData.length >= 2
    ? ((chartData[chartData.length - 1].EPS - chartData[0].EPS) / Math.abs(chartData[0].EPS || 1)) * 100
    : null;
  const divGrowth = chartData.length >= 2
    ? ((chartData[chartData.length - 1].Dividend - chartData[0].Dividend) / Math.abs(chartData[0].Dividend || 1)) * 100
    : null;

  const payoutRatio = eps != null && eps > 0 && dividendPerShare != null
    ? ((dividendPerShare / eps) * 100)
    : null;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span className="glass-section-icon">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
          </span>
          EPS vs Dividend Per Share
          {hasHistorical && (
            <span className="text-[10px] text-muted-foreground font-normal ml-auto">
              {chartData.length}-Year History
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="inline-flex flex-col items-center gap-1">
              <div className="h-14 w-14  bg-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="text-base font-bold text-primary tabular-nums">
                  {eps != null ? eps.toFixed(2) : "—"}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">EPS (AED)</span>
              {epsGrowth != null && (
                <span className={`text-[9px] flex items-center gap-0.5 ${epsGrowth >= 0 ? "text-gain" : "text-loss"}`}>
                  {epsGrowth >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                  {epsGrowth >= 0 ? "+" : ""}{epsGrowth.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
          <div className="text-center">
            <div className="inline-flex flex-col items-center gap-1">
              <div className="h-14 w-14  bg-gain/10 border border-gain/20 flex items-center justify-center">
                <span className="text-base font-bold text-gain tabular-nums">
                  {dividendPerShare != null ? dividendPerShare.toFixed(2) : "—"}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">Div/Share</span>
              {divGrowth != null && (
                <span className={`text-[9px] flex items-center gap-0.5 ${divGrowth >= 0 ? "text-gain" : "text-loss"}`}>
                  {divGrowth >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                  {divGrowth >= 0 ? "+" : ""}{divGrowth.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
          <div className="text-center">
            <div className="inline-flex flex-col items-center gap-1">
              <div className="h-14 w-14  bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <span className="text-base font-bold text-amber-500 tabular-nums">
                  {payoutRatio != null ? `${payoutRatio.toFixed(0)}%` : "—"}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">Payout</span>
            </div>
          </div>
        </div>

        {/* Historical Bar Chart */}
        <div className="pt-2">
          <ResponsiveContainer width="100%" height={hasHistorical ? 180 : 100}>
            <BarChart data={displayData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.3)" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
                formatter={(value: any) => [`AED ${Number(value).toFixed(3)}`]}
              />
              <Bar dataKey="EPS" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={hasHistorical ? 20 : 40} />
              <Bar dataKey="Dividend" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={hasHistorical ? 20 : 40} />
              <Legend
                wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
                iconType="circle"
                iconSize={8}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
