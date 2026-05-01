/**
 * SimpleChart — UAE Equity-inspired clean price chart
 * Features: smooth line with gradient fill, timeframe buttons, performance badge
 */
import { useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";

interface SimpleChartProps {
  data: Array<{ date: string; close: number }>;
  isLoading?: boolean;
  range: string;
  onRangeChange: (range: string) => void;
  symbol?: string;
}

const RANGES = [
  { label: "1M", value: "1mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
  { label: "3Y", value: "3y" },
  { label: "5Y", value: "5y" },
  { label: "All", value: "all" },
];

export function SimpleChart({ data, isLoading, range, onRangeChange, symbol }: SimpleChartProps) {
  // Calculate performance
  const performance = useMemo(() => {
    if (!data || data.length < 2) return null;
    const first = data[0].close;
    const last = data[data.length - 1].close;
    if (!first || first === 0) return null;
    return ((last - first) / first) * 100;
  }, [data]);

  // Format Y axis
  const [minY, maxY] = useMemo(() => {
    if (!data || data.length === 0) return [0, 100];
    const closes = data.map(d => d.close).filter(Boolean);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const padding = (max - min) * 0.1;
    return [Math.max(0, min - padding), max + padding];
  }, [data]);

  const isPositive = performance != null && performance >= 0;

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <span className="glass-section-icon">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </span>
            Price Chart
          </CardTitle>
          <span className="text-xs text-muted-foreground">Updated daily</span>
        </div>
        {/* Timeframe buttons + Performance badge */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => onRangeChange(r.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  range === r.value
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {performance != null && (
            <Badge
              variant="outline"
              className={`text-xs font-semibold ${
                isPositive
                  ? "border-gain/40 text-gain bg-gain/10"
                  : "border-loss/40 text-loss bg-loss/10"
              }`}
            >
              {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {isPositive ? "+" : ""}{performance.toFixed(2)}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${symbol || 'default'}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                  <stop offset="50%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.1} />
                  <stop offset="100%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                interval="preserveStartEnd"
                minTickGap={60}
              />
              <YAxis
                domain={[minY, maxY]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => v.toFixed(2)}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}
                labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: "11px" }}
                formatter={(value: any) => [`AED ${Number(value).toFixed(2)}`, "Price"]}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={isPositive ? "#22c55e" : "#ef4444"}
                strokeWidth={2}
                fill={`url(#gradient-${symbol || 'default'})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: isPositive ? "#22c55e" : "#ef4444", fill: "hsl(var(--card))" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            No chart data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
