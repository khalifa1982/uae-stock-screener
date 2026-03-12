/**
 * StockAnalysis.com Data Card
 * Displays enriched financial data scraped from StockAnalysis.com
 * Shows price performance, financial summary, and recent news
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp, TrendingDown, BarChart3, Globe, ExternalLink,
  Newspaper, Calendar, DollarSign, Activity, ArrowUp, ArrowDown,
} from "lucide-react";

interface SAOverviewData {
  symbol: string;
  exchange: string;
  name: string;
  description: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  high52w: number | null;
  low52w: number | null;
  marketCap: string | null;
  marketCapGrowth: number | null;
  revenue: string | null;
  revenueGrowth: number | null;
  netIncome: string | null;
  netIncomeGrowth: number | null;
  eps: string | null;
  epsGrowth: number | null;
  peRatio: string | null;
  forwardPE: string | null;
  dividend: string | null;
  dividendYield: string | null;
  payoutRatio: string | null;
  beta: string | null;
  rsi: string | null;
  earningsDate: string | null;
  industry: string | null;
  sector: string | null;
  priceChanges: {
    "1w": number | null;
    "1m": number | null;
    "3m": number | null;
    "6m": number | null;
    ytd: number | null;
    "1y": number | null;
    "5y": number | null;
  };
  financialChart: Array<{
    year: string;
    revenue: number;
    earnings: number;
    revenueGrowth: number;
    earningsGrowth: number;
  }>;
  financialIntro: string | null;
  news: Array<{
    url: string;
    title: string;
    text: string;
    source: string;
    time: string;
  }>;
}

function GrowthBadge({ value, suffix = "%" }: { value: number | null | undefined; suffix?: string }) {
  if (value == null) return <span className="text-muted-foreground text-xs">—</span>;
  const isPositive = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-mono font-semibold ${isPositive ? "text-gain" : "text-loss"}`}>
      {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {isPositive ? "+" : ""}{value.toFixed(1)}{suffix}
    </span>
  );
}

function PriceChangeBar({ label, value, refPrice }: { label: string; value: number | null; refPrice: number | null }) {
  if (value == null || refPrice == null || refPrice === 0) return null;
  const change = ((refPrice - value) / value) * 100;
  const isPositive = change > 0;
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/10">
      <span className="text-xs text-muted-foreground w-10">{label}</span>
      <div className="flex-1 mx-3 h-1.5 rounded-full bg-secondary/50 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isPositive ? "bg-gain" : "bg-loss"}`}
          style={{ width: `${Math.min(100, Math.abs(change) * 2)}%`, marginLeft: isPositive ? "50%" : `${50 - Math.min(50, Math.abs(change) * 2)}%` }}
        />
      </div>
      <span className={`text-xs font-mono font-semibold w-16 text-right ${isPositive ? "text-gain" : "text-loss"}`}>
        {isPositive ? "+" : ""}{change.toFixed(1)}%
      </span>
    </div>
  );
}

export function SADataCard({ data }: { data: SAOverviewData | null | undefined }) {
  if (!data) return null;

  const saUrl = `https://stockanalysis.com/quote/${data.exchange.toLowerCase()}/${data.symbol}/`;

  return (
    <div className="space-y-2">
      {/* Price Performance Card */}
      {data.priceChanges && (
        <Card className="border-border/50">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Price Performance
              </span>
              <a
                href={saUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                StockAnalysis.com <ExternalLink className="h-3 w-3" />
              </a>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
              {[
                { label: "1W", val: data.priceChanges["1w"], cur: data.price },
                { label: "1M", val: data.priceChanges["1m"], cur: data.price },
                { label: "3M", val: data.priceChanges["3m"], cur: data.price },
                { label: "6M", val: data.priceChanges["6m"], cur: data.price },
                { label: "YTD", val: data.priceChanges.ytd, cur: data.price },
                { label: "1Y", val: data.priceChanges["1y"], cur: data.price },
                { label: "5Y", val: data.priceChanges["5y"], cur: data.price },
              ].filter(p => p.val != null).map(({ label, val, cur }) => {
                const change = cur && val ? ((cur - val) / val) * 100 : null;
                const isPositive = (change ?? 0) > 0;
                return (
                  <div key={label} className="p-2 rounded bg-secondary/20 border border-border/30 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
                    <p className={`text-xs font-mono font-semibold ${isPositive ? "text-gain" : "text-loss"}`}>
                      {change != null ? `${isPositive ? "+" : ""}${change.toFixed(1)}%` : "—"}
                    </p>
                    <p className="text-[9px] text-muted-foreground/60 font-mono">
                      {val != null ? `AED ${val.toFixed(2)}` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Summary from SA */}
      {(data.financialIntro || data.financialChart.length > 0) && (
        <Card className="border-border/50">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Financial Summary
              <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto">StockAnalysis</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {data.financialIntro && (
              <p className="text-xs text-muted-foreground leading-relaxed">{data.financialIntro}</p>
            )}

            {/* Key SA Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
              {[
                { label: "Market Cap", value: data.marketCap, growth: data.marketCapGrowth },
                { label: "Revenue", value: data.revenue, growth: data.revenueGrowth },
                { label: "Net Income", value: data.netIncome, growth: data.netIncomeGrowth },
                { label: "EPS", value: data.eps, growth: data.epsGrowth },
                { label: "P/E Ratio", value: data.peRatio },
                { label: "Forward P/E", value: data.forwardPE },
                { label: "Dividend", value: data.dividend },
                { label: "Payout Ratio", value: data.payoutRatio },
              ].filter(m => m.value != null).map(({ label, value, growth }) => (
                <div key={label} className="p-2 rounded bg-secondary/20 border border-border/30">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                  <p className="text-xs font-mono font-semibold">{value}</p>
                  {growth != null && <GrowthBadge value={growth} />}
                </div>
              ))}
            </div>

            {/* Revenue/Earnings Chart */}
            {data.financialChart.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Annual Revenue & Earnings</p>
                <div className="grid grid-cols-1 gap-0.5">
                  {data.financialChart.slice(-5).map((yr) => {
                    const maxRev = Math.max(...data.financialChart.map(y => y.revenue));
                    const revPct = maxRev > 0 ? (yr.revenue / maxRev) * 100 : 0;
                    const earnPct = maxRev > 0 ? (yr.earnings / maxRev) * 100 : 0;
                    return (
                      <div key={yr.year} className="flex items-center gap-2 py-1">
                        <span className="text-[10px] text-muted-foreground w-10 font-mono">{yr.year}</span>
                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center gap-1">
                            <div className="h-2 rounded bg-primary/60" style={{ width: `${revPct}%` }} />
                            <span className="text-[9px] text-muted-foreground font-mono whitespace-nowrap">
                              {(yr.revenue / 1e9).toFixed(1)}B
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="h-2 rounded bg-gain/60" style={{ width: `${Math.max(0, earnPct)}%` }} />
                            <span className="text-[9px] text-muted-foreground font-mono whitespace-nowrap">
                              {(yr.earnings / 1e9).toFixed(1)}B
                            </span>
                          </div>
                        </div>
                        <div className="text-right w-16">
                          <GrowthBadge value={yr.revenueGrowth} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <span className="w-3 h-2 rounded bg-primary/60 inline-block" /> Revenue
                  </span>
                  <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <span className="w-3 h-2 rounded bg-gain/60 inline-block" /> Earnings
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SA News */}
      {data.news && data.news.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-primary" />
              Latest News
              <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto">StockAnalysis</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1">
              {data.news.slice(0, 5).map((article, i) => (
                <a
                  key={i}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 rounded hover:bg-muted/10 border border-transparent hover:border-border/30 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground line-clamp-2 leading-relaxed">{article.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[9px] px-1 py-0">{article.source}</Badge>
                        <span className="text-[9px] text-muted-foreground">
                          {article.time ? new Date(article.time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
