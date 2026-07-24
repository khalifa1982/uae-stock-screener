/**
 * MarketHeatmap — Premium animated grid of stock tiles color-coded by daily performance
 * Treemap-style sizing based on market cap with smooth entrance animations
 */
import { useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

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

function getHeatBg(change: number | null): string {
  if (change == null) return "rgba(128,128,128,0.08)";
  if (change >= 5) return "rgba(34,197,94,0.25)";
  if (change >= 2) return "rgba(34,197,94,0.16)";
  if (change > 0) return "rgba(34,197,94,0.08)";
  if (change === 0) return "rgba(128,128,128,0.06)";
  if (change > -2) return "rgba(239,68,68,0.08)";
  if (change > -5) return "rgba(239,68,68,0.16)";
  return "rgba(239,68,68,0.25)";
}

function getHeatBorder(change: number | null): string {
  if (change == null) return "rgba(128,128,128,0.15)";
  if (change >= 2) return "rgba(34,197,94,0.35)";
  if (change > 0) return "rgba(34,197,94,0.2)";
  if (change === 0) return "rgba(128,128,128,0.15)";
  if (change > -2) return "rgba(239,68,68,0.2)";
  return "rgba(239,68,68,0.35)";
}

function getTextColor(change: number | null): string {
  if (change == null) return "text-muted-foreground";
  if (change > 0) return "text-gain";
  if (change < 0) return "text-loss";
  return "text-muted-foreground";
}

/** Determine tile size class based on relative market cap rank */
function getTileSize(rank: number): string {
  if (rank < 5) return "col-span-2 row-span-2"; // Top 5 get large tiles
  if (rank < 12) return "col-span-1 row-span-2"; // Next 7 get tall tiles
  return "col-span-1 row-span-1"; // Rest get standard tiles
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.02, delayChildren: 0.1 },
  },
};

const tileVariants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(239,68,68,0.25)" }} />
            <span>-5%+</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(239,68,68,0.1)" }} />
            <span>-2%</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(128,128,128,0.08)" }} />
            <span>0%</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(34,197,94,0.1)" }} />
            <span>+2%</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(34,197,94,0.25)" }} />
            <span>+5%+</span>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground">Top {topStocks.length} by market cap</span>
      </div>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 auto-rows-[60px] gap-1"
      >
        {topStocks.map((stock, idx) => (
          <motion.button
            key={`${stock.exchange}:${stock.symbol}`}
            variants={tileVariants}
            whileHover={{ scale: 1.06, zIndex: 10, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setLocation(`/stock/${stock.symbol}`)}
            className={`relative flex flex-col items-center justify-center rounded-md border cursor-pointer overflow-hidden backdrop-blur-sm ${getTileSize(idx)}`}
            style={{
              background: getHeatBg(stock.changePercent),
              borderColor: getHeatBorder(stock.changePercent),
            }}
            title={`${stock.name} (${stock.symbol}) — ${stock.changePercent != null ? (stock.changePercent > 0 ? "+" : "") + stock.changePercent.toFixed(2) + "%" : "N/A"}`}
          >
            {/* Glow effect for large movers */}
            {stock.changePercent != null && Math.abs(stock.changePercent) >= 3 && (
              <div
                className="absolute inset-0 opacity-30 animate-pulse"
                style={{
                  background: `radial-gradient(circle at center, ${stock.changePercent > 0 ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"} 0%, transparent 70%)`,
                }}
              />
            )}
            {/* Logo or symbol */}
            {stock.logoUrl ? (
              <img
                src={stock.logoUrl}
                alt={stock.symbol}
                className={`rounded-full object-contain bg-white/90 ${idx < 5 ? "h-8 w-8 mb-1.5" : idx < 12 ? "h-6 w-6 mb-1" : "h-5 w-5 mb-0.5"}`}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className={`rounded-full bg-muted/50 flex items-center justify-center ${idx < 5 ? "h-8 w-8 mb-1.5" : idx < 12 ? "h-6 w-6 mb-1" : "h-5 w-5 mb-0.5"}`}>
                <span className={`font-bold text-muted-foreground ${idx < 5 ? "text-[10px]" : "text-[8px]"}`}>{stock.symbol.slice(0, 2)}</span>
              </div>
            )}
            {/* Ticker */}
            <span className={`font-semibold text-foreground truncate w-full text-center leading-tight ${idx < 5 ? "text-[11px]" : "text-[9px]"}`}>
              {stock.symbol}
            </span>
            {/* Change % */}
            <span className={`font-bold tabular-nums ${getTextColor(stock.changePercent)} ${idx < 5 ? "text-[11px]" : "text-[9px]"}`}>
              {stock.changePercent != null
                ? `${stock.changePercent > 0 ? "+" : ""}${stock.changePercent.toFixed(2)}%`
                : "—"}
            </span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
