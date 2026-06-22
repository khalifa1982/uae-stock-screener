/**
 * MarketHeatmap — Grid of stock tiles color-coded by daily performance
 * Inspired by uaeequity.app heatmap
 */
import { useMemo } from "react";
import { useLocation } from "wouter";

interface HeatmapStock {
  symbol: string;
  exchange: string;
  name: string;
  logoUrl?: string | null;
  changePercent: number | null;
  price: number | null;
  marketCap: number | null;
}

interface MarketHeatmapProps {
  stocks: HeatmapStock[];
  maxItems?: number;
}

function getHeatColor(change: number | null): string {
  if (change == null) return "bg-muted/30 border-border/30";
  if (change >= 5) return "bg-gain/30 border-gain/40";
  if (change >= 2) return "bg-gain/20 border-gain/30";
  if (change > 0) return "bg-gain/10 border-gain/20";
  if (change === 0) return "bg-muted/20 border-border/30";
  if (change > -2) return "bg-loss/10 border-loss/20";
  if (change > -5) return "bg-loss/20 border-loss/30";
  return "bg-loss/30 border-loss/40";
}

function getTextColor(change: number | null): string {
  if (change == null) return "text-muted-foreground";
  if (change > 0) return "text-gain";
  if (change < 0) return "text-loss";
  return "text-muted-foreground";
}

export function MarketHeatmap({ stocks, maxItems = 30 }: MarketHeatmapProps) {
  const [, setLocation] = useLocation();

  // Sort by market cap and take top items
  const topStocks = useMemo(() => {
    return [...stocks]
      .filter(s => s.price != null && s.changePercent != null)
      .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
      .slice(0, maxItems);
  }, [stocks, maxItems]);

  if (topStocks.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Market Heatmap</h3>
        <span className="text-[10px] text-muted-foreground">Top {topStocks.length} by market cap</span>
      </div>
      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
        {topStocks.map((stock) => (
          <button
            key={`${stock.exchange}:${stock.symbol}`}
            onClick={() => setLocation(`/stock/${stock.symbol}`)}
            className={`group relative flex flex-col items-center justify-center p-2  border  transition-all hover:scale-105 hover:shadow-[0_0_15px_var(--neon-cyan-dim)] cursor-pointer ${getHeatColor(stock.changePercent)}`}
            title={`${stock.name} (${stock.symbol})`}
          >
            {/* Logo or symbol */}
            {stock.logoUrl ? (
              <img
                src={stock.logoUrl}
                alt={stock.symbol}
                className="h-6 w-6 rounded-full object-contain bg-white mb-1"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-muted/50 flex items-center justify-center mb-1">
                <span className="text-[8px] font-bold text-muted-foreground">{stock.symbol.slice(0, 2)}</span>
              </div>
            )}
            {/* Ticker */}
            <span className="text-[9px] font-semibold text-foreground truncate w-full text-center leading-tight">
              {stock.symbol}
            </span>
            {/* Change % */}
            <span className={`text-[9px] font-bold tabular-nums ${getTextColor(stock.changePercent)}`}>
              {stock.changePercent != null
                ? `${stock.changePercent > 0 ? "+" : ""}${stock.changePercent.toFixed(2)}%`
                : "—"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
