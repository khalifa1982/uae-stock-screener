/**
 * EPSDividendChart — Grouped bar chart comparing EPS vs Dividend per share
 * Inspired by uaeequity.app financial charts
 */
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

interface EPSDividendChartProps {
  eps: number | null;
  dividendPerShare: number | null;
  symbol: string;
}

export function EPSDividendChart({ eps, dividendPerShare, symbol }: EPSDividendChartProps) {
  // We only have current year data from TradingView, so show a single comparison
  if (eps == null && dividendPerShare == null) return null;

  const data = [
    {
      name: "Current",
      EPS: eps ?? 0,
      Dividend: dividendPerShare ?? 0,
    },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span className="glass-section-icon">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
          </span>
          EPS vs Dividend Per Share
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6 py-4">
          {/* EPS */}
          <div className="flex-1 text-center">
            <div className="inline-flex flex-col items-center gap-1">
              <div className="h-16 w-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="text-lg font-bold text-primary tabular-nums">
                  {eps != null ? eps.toFixed(2) : "—"}
                </span>
              </div>
              <span className="text-xs text-muted-foreground font-medium">EPS (AED)</span>
            </div>
          </div>
          {/* Divider */}
          <div className="h-16 w-px bg-border/50" />
          {/* Dividend */}
          <div className="flex-1 text-center">
            <div className="inline-flex flex-col items-center gap-1">
              <div className="h-16 w-16 rounded-xl bg-gain/10 border border-gain/20 flex items-center justify-center">
                <span className="text-lg font-bold text-gain tabular-nums">
                  {dividendPerShare != null ? dividendPerShare.toFixed(2) : "—"}
                </span>
              </div>
              <span className="text-xs text-muted-foreground font-medium">Dividend/Share (AED)</span>
            </div>
          </div>
          {/* Payout ratio */}
          {eps != null && eps > 0 && dividendPerShare != null && (
            <>
              <div className="h-16 w-px bg-border/50" />
              <div className="flex-1 text-center">
                <div className="inline-flex flex-col items-center gap-1">
                  <div className="h-16 w-16 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <span className="text-lg font-bold text-amber-500 tabular-nums">
                      {((dividendPerShare / eps) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">Payout Ratio</span>
                </div>
              </div>
            </>
          )}
        </div>
        {/* Mini bar chart */}
        {(eps != null || dividendPerShare != null) && (
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <XAxis dataKey="name" tick={false} axisLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: any) => [`AED ${Number(value).toFixed(2)}`]}
              />
              <Bar dataKey="EPS" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
              <Bar dataKey="Dividend" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={40} />
              <Legend
                wrapperStyle={{ fontSize: "11px" }}
                iconType="circle"
                iconSize={8}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
