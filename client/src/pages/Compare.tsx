/**
 * Compare — Side-by-side stock comparison tool
 * Compare up to 3 stocks with key metrics, scores, and charts
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Scale, Plus, X,
  BarChart3, DollarSign, Activity, Shield, Zap, Target,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { ALL_STOCKS } from "../../../shared/stockData";
import { calculateStockScore } from "@/components/StockScore";
import { Link } from "wouter";

function formatNumber(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return "—";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatLargeNumber(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return "—";
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return num.toLocaleString();
}

function formatPercent(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return "—";
  return (num > 0 ? "+" : "") + num.toFixed(2) + "%";
}

// Stock search/select component
function StockSelector({
  selected,
  onSelect,
  onRemove,
  color,
  index,
}: {
  selected: string | null;
  onSelect: (symbol: string) => void;
  onRemove: () => void;
  color: string;
  index: number;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return ALL_STOCKS.slice(0, 20);
    const q = search.toLowerCase();
    return ALL_STOCKS.filter(
      s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [search]);

  if (selected) {
    const stock = ALL_STOCKS.find(s => s.symbol === selected);
    return (
      <div className={`flex items-center gap-2 p-2 rounded-lg border-2 ${color} bg-card/50`}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{selected}</p>
          <p className="text-[10px] text-muted-foreground truncate">{stock?.name || ""}</p>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onRemove}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className={`flex items-center gap-2 p-2 rounded-lg border-2 border-dashed ${color} bg-card/30`}>
        <Plus className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Stock ${index + 1}...`}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0"
        />
      </div>
      {isOpen && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {filtered.map(s => (
            <button
              key={s.symbol}
              className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-2 text-xs"
              onMouseDown={() => {
                onSelect(s.symbol);
                setSearch("");
                setIsOpen(false);
              }}
            >
              <span className="font-bold">{s.symbol}</span>
              <span className="text-muted-foreground truncate">{s.name}</span>
              <Badge variant="outline" className="ml-auto text-[9px] h-4 px-1">{s.exchange}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Comparison metric row
function CompareRow({
  label,
  values,
  format = "number",
  highlight = "higher",
}: {
  label: string;
  values: (number | null | undefined)[];
  format?: "number" | "large" | "percent" | "ratio";
  highlight?: "higher" | "lower" | "none";
}) {
  const formatted = values.map(v => {
    if (v == null || isNaN(v as number)) return "—";
    switch (format) {
      case "large": return formatLargeNumber(v);
      case "percent": return formatPercent(v);
      case "ratio": return (v as number).toFixed(2);
      default: return formatNumber(v);
    }
  });

  // Find best value index
  const numericValues = values.map(v => (v != null && !isNaN(v as number)) ? v as number : null);
  let bestIdx = -1;
  if (highlight !== "none") {
    const validValues = numericValues.filter(v => v != null) as number[];
    if (validValues.length > 1) {
      const best = highlight === "higher" ? Math.max(...validValues) : Math.min(...validValues);
      bestIdx = numericValues.indexOf(best);
    }
  }

  return (
    <div className="grid gap-2 py-2 border-b border-border/20 items-center" style={{ gridTemplateColumns: `120px repeat(${values.length}, 1fr)` }}>
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      {formatted.map((val, i) => (
        <span
          key={i}
          className={`text-xs font-mono text-center ${i === bestIdx ? "text-gain font-bold" : "text-foreground"}`}
        >
          {val}
        </span>
      ))}
    </div>
  );
}

const COLORS = [
  { border: "border-primary", fill: "hsl(var(--primary))", name: "primary" },
  { border: "border-emerald-500", fill: "#22c55e", name: "emerald" },
  { border: "border-amber-500", fill: "#f59e0b", name: "amber" },
];

export default function Compare() {
  const [symbols, setSymbols] = useState<(string | null)[]>([null, null]);

  const addSlot = () => {
    if (symbols.length < 3) setSymbols([...symbols, null]);
  };

  const removeSlot = (idx: number) => {
    const next = [...symbols];
    next[idx] = null;
    // Remove trailing nulls beyond 2
    while (next.length > 2 && next[next.length - 1] === null) next.pop();
    setSymbols(next);
  };

  const setSymbol = (idx: number, sym: string) => {
    const next = [...symbols];
    next[idx] = sym;
    setSymbols(next);
  };

  const activeSymbols = symbols.filter(Boolean) as string[];

  // Fetch detail data for each selected stock
  const stock1 = trpc.stocks.detail.useQuery(
    { symbol: activeSymbols[0] || "" },
    { enabled: !!activeSymbols[0], staleTime: 60_000 }
  );
  const stock2 = trpc.stocks.detail.useQuery(
    { symbol: activeSymbols[1] || "" },
    { enabled: !!activeSymbols[1], staleTime: 60_000 }
  );
  const stock3 = trpc.stocks.detail.useQuery(
    { symbol: activeSymbols[2] || "" },
    { enabled: !!activeSymbols[2], staleTime: 60_000 }
  );

  const stockData = [stock1.data, stock2.data, stock3.data].slice(0, activeSymbols.length);
  const isLoading = [stock1.isLoading, stock2.isLoading, stock3.isLoading]
    .slice(0, activeSymbols.length)
    .some(Boolean);

  // Build radar chart data for stock scores
  const radarData = useMemo(() => {
    if (activeSymbols.length < 2) return [];
    const scores = stockData.map(d => {
      if (!d) return null;
      return calculateStockScore({
        pe: d.pe ?? null,
        dividendYield: d.dividendYield ?? null,
        debtToEquity: null,
        currentRatio: null,
        returnOnEquity: null,
        perfYear: null,
        priceToBook: null,
        beta: d.beta ?? null,
        marketCap: d.marketCap ?? null,
      });
    });

    return [
      { metric: "Safety", ...Object.fromEntries(activeSymbols.map((s, i) => [s, scores[i]?.safety || 0])) },
      { metric: "Value", ...Object.fromEntries(activeSymbols.map((s, i) => [s, scores[i]?.valuation || 0])) },
      { metric: "Growth", ...Object.fromEntries(activeSymbols.map((s, i) => [s, scores[i]?.growth || 0])) },
      { metric: "Total", ...Object.fromEntries(activeSymbols.map((s, i) => [s, scores[i]?.total || 0])) },
    ];
  }, [stockData, activeSymbols]);

  // Build comparison bar chart data
  const barData = useMemo(() => {
    if (activeSymbols.length < 2 || stockData.some(d => !d)) return [];
    return [
      { metric: "P/E", ...Object.fromEntries(activeSymbols.map((s, i) => [s, stockData[i]?.pe || 0])) },
      { metric: "EPS", ...Object.fromEntries(activeSymbols.map((s, i) => [s, stockData[i]?.eps || 0])) },
      { metric: "Div Yield %", ...Object.fromEntries(activeSymbols.map((s, i) => [s, (stockData[i]?.dividendYield || 0) * 100])) },
      { metric: "ROE %", ...Object.fromEntries(activeSymbols.map((s, i) => [s, (stockData[i]?.roe || 0) * 100])) },
    ];
  }, [stockData, activeSymbols]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="glass-section-icon">
          <Scale className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-bold">Stock Comparison</h1>
          <p className="text-[10px] text-muted-foreground">Compare up to 3 stocks side-by-side</p>
        </div>
      </div>

      {/* Stock Selectors */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {symbols.map((sym, i) => (
          <StockSelector
            key={i}
            selected={sym}
            onSelect={(s) => setSymbol(i, s)}
            onRemove={() => removeSlot(i)}
            color={COLORS[i].border}
            index={i}
          />
        ))}
        {symbols.length < 3 && (
          <Button
            variant="outline"
            className="h-full min-h-[52px] border-dashed text-xs text-muted-foreground"
            onClick={addSlot}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Stock
          </Button>
        )}
      </div>

      {/* Comparison Content */}
      {activeSymbols.length >= 2 && !isLoading && stockData.every(Boolean) && (
        <div className="space-y-4">
          {/* Price & Change */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <span className="glass-section-icon"><Activity className="h-3.5 w-3.5 text-primary" /></span>
                Price & Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <CompareRow label="Price (AED)" values={stockData.map(d => d?.price)} />
              <CompareRow label="Change %" values={stockData.map(d => d?.changePercent)} format="percent" highlight="higher" />
              <CompareRow label="Market Cap" values={stockData.map(d => d?.marketCap)} format="large" highlight="higher" />
              <CompareRow label="Volume" values={stockData.map(d => d?.volume)} format="large" highlight="higher" />
              <CompareRow label="52W High" values={stockData.map(d => d?.week52High)} />
              <CompareRow label="52W Low" values={stockData.map(d => d?.week52Low)} />
            </CardContent>
          </Card>

          {/* Valuation */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <span className="glass-section-icon"><Target className="h-3.5 w-3.5 text-primary" /></span>
                Valuation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <CompareRow label="P/E Ratio" values={stockData.map(d => d?.pe)} format="ratio" highlight="lower" />
              <CompareRow label="P/B Ratio" values={stockData.map(d => (d as any)?.priceToBook)} format="ratio" highlight="lower" />
              <CompareRow label="EPS" values={stockData.map(d => d?.eps)} highlight="higher" />
              <CompareRow label="Beta" values={stockData.map(d => d?.beta)} format="ratio" highlight="none" />
            </CardContent>
          </Card>

          {/* Dividends & Returns */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <span className="glass-section-icon"><DollarSign className="h-3.5 w-3.5 text-primary" /></span>
                Dividends & Returns
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <CompareRow label="Dividend Yield" values={stockData.map(d => d?.dividendYield ? (d.dividendYield > 1 ? d.dividendYield : d.dividendYield * 100) : null)} format="percent" highlight="higher" />
              <CompareRow label="RSI" values={stockData.map(d => d?.rsi)} format="ratio" highlight="none" />
              <CompareRow label="SMA 50" values={stockData.map(d => d?.sma50)} highlight="none" />
              <CompareRow label="SMA 200" values={stockData.map(d => d?.sma200)} highlight="none" />
            </CardContent>
          </Card>

          {/* Financial Health */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <span className="glass-section-icon"><Shield className="h-3.5 w-3.5 text-primary" /></span>
                Financial Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <CompareRow label="Debt/Equity" values={stockData.map(d => (d as any)?.debtToEquity)} format="ratio" highlight="lower" />
              <CompareRow label="Current Ratio" values={stockData.map(d => (d as any)?.currentRatio)} format="ratio" highlight="higher" />
            </CardContent>
          </Card>

          {/* Radar Chart - Score Comparison */}
          {radarData.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <span className="glass-section-icon"><Zap className="h-3.5 w-3.5 text-primary" /></span>
                  Score Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border)/0.4)" />
                    <PolarAngleAxis
                      dataKey="metric"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 10]}
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    />
                    {activeSymbols.map((sym, i) => (
                      <Radar
                        key={sym}
                        name={sym}
                        dataKey={sym}
                        stroke={COLORS[i].fill}
                        fill={COLORS[i].fill}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    ))}
                    <Legend wrapperStyle={{ fontSize: "11px" }} iconType="circle" iconSize={8} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Bar Chart - Key Metrics */}
          {barData.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <span className="glass-section-icon"><BarChart3 className="h-3.5 w-3.5 text-primary" /></span>
                  Key Metrics Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                    <XAxis
                      dataKey="metric"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                    />
                    {activeSymbols.map((sym, i) => (
                      <Bar key={sym} dataKey={sym} fill={COLORS[i].fill} radius={[4, 4, 0, 0]} barSize={20} />
                    ))}
                    <Legend wrapperStyle={{ fontSize: "10px" }} iconType="circle" iconSize={8} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Links to individual stock pages */}
          <div className="flex items-center gap-2 flex-wrap">
            {activeSymbols.map((sym, i) => (
              <Link key={sym} href={`/stock/${sym}`}>
                <Badge variant="outline" className={`cursor-pointer hover:bg-muted/30 ${COLORS[i].border}`}>
                  View {sym} Details →
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {activeSymbols.length >= 2 && isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Loading comparison data...</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {activeSymbols.length < 2 && (
        <Card className="border-border/50 border-dashed">
          <CardContent className="py-16 text-center">
            <Scale className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Select at least 2 stocks to compare</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              Search and select stocks above to see a side-by-side comparison
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
