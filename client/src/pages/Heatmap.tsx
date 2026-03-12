import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, ChevronRight } from "lucide-react";
import { useMemo, useState, useCallback } from "react";
import { Link } from "wouter";
import { usePriceFlashes, getFlashClass } from "@/hooks/usePriceFlash";

/* ── Color helpers ── */
function getHeatBg(change: number | null): string {
  if (change == null) return "rgba(63,63,70,0.5)";
  const abs = Math.abs(change);
  // Intensity scales with magnitude
  const intensity = Math.min(abs / 5, 1); // 0-1 scale, max at 5%
  if (change >= 0.05) {
    // Green shades - from dark to bright
    const r = Math.round(10 + (20 - 10) * (1 - intensity));
    const g = Math.round(60 + (160 - 60) * intensity);
    const b = Math.round(30 + (60 - 30) * intensity);
    return `rgb(${r},${g},${b})`;
  }
  if (change > -0.05) return "rgba(63,63,70,0.6)";
  // Red shades - from dark to bright
  const r = Math.round(80 + (200 - 80) * intensity);
  const g = Math.round(15 + (30 - 15) * (1 - intensity));
  const b = Math.round(15 + (30 - 15) * (1 - intensity));
  return `rgb(${r},${g},${b})`;
}

function getChangeColor(change: number | null): string {
  if (change == null) return "#a1a1aa";
  if (change >= 0.05) return "#4ade80";
  if (change > -0.05) return "#a1a1aa";
  return "#f87171";
}

function formatMarketCap(n: number | null): string {
  if (n == null) return "";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  return `${(n / 1e3).toFixed(0)}K`;
}

interface StockData {
  symbol: string;
  name?: string | null;
  sector?: string | null;
  exchange: string;
  price?: number | null | undefined;
  changePercent?: number | null | undefined;
  marketCap?: number | null | undefined;
  volume?: number | null | undefined;
}

/* ── Squarified Treemap Algorithm ── */
interface TreemapRect {
  x: number; y: number; w: number; h: number;
  stock: StockData;
}

function squarify(
  items: { stock: StockData; value: number }[],
  x: number, y: number, w: number, h: number
): TreemapRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ x, y, w, h, stock: items[0].stock }];
  }

  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return [];

  // Sort descending by value
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const rects: TreemapRect[] = [];

  let remaining = [...sorted];
  let cx = x, cy = y, cw = w, ch = h;

  while (remaining.length > 0) {
    const remTotal = remaining.reduce((s, i) => s + i.value, 0);
    const isWide = cw >= ch;

    // Find the best split
    let row: typeof remaining = [];
    let bestAspect = Infinity;

    for (let i = 1; i <= remaining.length; i++) {
      row = remaining.slice(0, i);
      const rowTotal = row.reduce((s, it) => s + it.value, 0);
      const rowFraction = rowTotal / remTotal;
      const rowSize = isWide ? cw * rowFraction : ch * rowFraction;
      const crossSize = isWide ? ch : cw;

      // Calculate worst aspect ratio in this row
      let worstAspect = 0;
      for (const item of row) {
        const itemFraction = item.value / rowTotal;
        const itemSize = crossSize * itemFraction;
        const aspect = Math.max(rowSize / itemSize, itemSize / rowSize);
        worstAspect = Math.max(worstAspect, aspect);
      }

      if (worstAspect <= bestAspect) {
        bestAspect = worstAspect;
      } else {
        // Previous row was better
        row = remaining.slice(0, i - 1);
        break;
      }
    }

    // Layout this row
    const rowTotal = row.reduce((s, it) => s + it.value, 0);
    const rowFraction = rowTotal / remTotal;
    let rx = cx, ry = cy;

    if (isWide) {
      const rowW = cw * rowFraction;
      for (const item of row) {
        const itemH = ch * (item.value / rowTotal);
        rects.push({ x: rx, y: ry, w: rowW, h: itemH, stock: item.stock });
        ry += itemH;
      }
      cx += rowW;
      cw -= rowW;
    } else {
      const rowH = ch * rowFraction;
      for (const item of row) {
        const itemW = cw * (item.value / rowTotal);
        rects.push({ x: rx, y: ry, w: itemW, h: rowH, stock: item.stock });
        rx += itemW;
      }
      cy += rowH;
      ch -= rowH;
    }

    remaining = remaining.slice(row.length);
  }

  return rects;
}

/* ── Treemap Tile Component ── */
function TreemapTile({ rect, flash }: { rect: TreemapRect; flash: string }) {
  const { stock, w, h } = rect;
  const change = stock.changePercent ?? null;
  const bg = getHeatBg(change);
  const color = getChangeColor(change);

  // Determine content size based on tile dimensions
  const isLarge = w > 120 && h > 80;
  const isMedium = w > 70 && h > 50;
  const isSmall = w > 40 && h > 30;

  return (
    <Link href={`/stock/${stock.symbol}`}>
      <div
        className={`absolute cursor-pointer hover:brightness-125 hover:z-10 transition-all duration-150 border border-black/30 overflow-hidden ${flash}`}
        style={{
          left: `${rect.x}%`,
          top: `${rect.y}%`,
          width: `${rect.w}%`,
          height: `${rect.h}%`,
          backgroundColor: bg,
        }}
      >
        <div className="w-full h-full flex flex-col items-center justify-center p-0.5 text-center">
          {isLarge ? (
            <>
              <span className="text-white font-bold text-sm leading-tight truncate max-w-full">
                {stock.symbol}
              </span>
              <span className="font-mono font-bold text-base leading-tight" style={{ color }}>
                {change != null ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "—"}
              </span>
              <span className="text-white/60 text-[9px] leading-tight truncate max-w-full mt-0.5">
                {stock.price?.toFixed(2)} AED
              </span>
            </>
          ) : isMedium ? (
            <>
              <span className="text-white font-bold text-xs leading-tight truncate max-w-full">
                {stock.symbol}
              </span>
              <span className="font-mono font-bold text-[11px] leading-tight" style={{ color }}>
                {change != null ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "—"}
              </span>
            </>
          ) : isSmall ? (
            <>
              <span className="text-white font-bold text-[9px] leading-tight truncate max-w-full">
                {stock.symbol}
              </span>
              <span className="font-mono text-[8px] leading-tight" style={{ color }}>
                {change != null ? `${change >= 0 ? "+" : ""}${change.toFixed(1)}%` : ""}
              </span>
            </>
          ) : (
            <span className="text-white/80 text-[7px] font-bold truncate">
              {stock.symbol.slice(0, 4)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ── Sector Treemap ── */
function SectorTreemap({
  sector,
  stocks,
  flashes,
  totalMarketCap,
}: {
  sector: string;
  stocks: StockData[];
  flashes: ReturnType<typeof usePriceFlashes>;
  totalMarketCap: number;
}) {
  const sectorCap = stocks.reduce((s, st) => s + (st.marketCap || st.volume || 1000), 0);
  const sectorPct = totalMarketCap > 0 ? (sectorCap / totalMarketCap * 100).toFixed(1) : "0";
  const avgChange = stocks.reduce((s, st) => s + (st.changePercent || 0), 0) / stocks.length;

  const rects = useMemo(() => {
    const items = stocks.map(s => ({
      stock: s,
      value: s.marketCap || s.volume || 1000,
    }));
    return squarify(items, 0, 0, 100, 100);
  }, [stocks]);

  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-[11px] font-bold text-white/90">{sector}</h3>
        <ChevronRight className="h-3 w-3 text-white/40" />
        <Badge variant="outline" className="text-[9px] h-4 px-1">{stocks.length}</Badge>
        <span className="text-[10px] text-white/50">{sectorPct}%</span>
        <span className={`text-[10px] font-mono font-bold ${avgChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {avgChange >= 0 ? "+" : ""}{avgChange.toFixed(2)}%
        </span>
      </div>
      <div className="relative w-full" style={{ paddingBottom: "30%" }}>
        {rects.map((rect) => (
          <TreemapTile
            key={rect.stock.symbol}
            rect={rect}
            flash={getFlashClass(flashes, rect.stock.exchange, rect.stock.symbol)}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Main Heatmap Page ── */
export default function Heatmap() {
  const [exchange, setExchange] = useState<"ALL" | "DFM" | "ADX">("DFM");
  const [viewMode, setViewMode] = useState<"sector" | "flat">("sector");

  const { data: allStocks, isLoading, refetch } = trpc.stocks.fetchAll.useQuery(
    { exchange },
    {
      staleTime: 5_000,
      gcTime: 30 * 60 * 1000,
      refetchInterval: 10_000,
      refetchOnWindowFocus: false,
    }
  );

  const flashableStocks = useMemo(() => {
    if (!allStocks) return undefined;
    return (allStocks as StockData[]).map(s => ({
      symbol: s.symbol,
      exchange: s.exchange,
      price: s.price ?? null,
      changePercent: s.changePercent ?? null,
    }));
  }, [allStocks]);
  const flashes = usePriceFlashes(flashableStocks);

  const stocksWithData = useMemo(() => {
    if (!allStocks) return [];
    return (allStocks as StockData[]).filter(s => s.price != null);
  }, [allStocks]);

  const totalMarketCap = useMemo(() => {
    return stocksWithData.reduce((s, st) => s + (st.marketCap || st.volume || 1000), 0);
  }, [stocksWithData]);

  const sectorGroups = useMemo(() => {
    const groups = new Map<string, StockData[]>();
    for (const stock of stocksWithData) {
      const sector = stock.sector || "Other";
      if (!groups.has(sector)) groups.set(sector, []);
      groups.get(sector)!.push(stock);
    }
    return Array.from(groups.entries()).sort((a, b) => {
      const aTotal = a[1].reduce((sum, s) => sum + (s.marketCap || 0), 0);
      const bTotal = b[1].reduce((sum, s) => sum + (s.marketCap || 0), 0);
      return bTotal - aTotal;
    });
  }, [stocksWithData]);

  // Flat treemap (all stocks in one view)
  const flatRects = useMemo(() => {
    if (viewMode !== "flat") return [];
    const items = stocksWithData.map(s => ({
      stock: s,
      value: s.marketCap || s.volume || 1000,
    }));
    return squarify(items, 0, 0, 100, 100);
  }, [stocksWithData, viewMode]);

  const marketSummary = useMemo(() => {
    const gainers = stocksWithData.filter(s => (s.changePercent || 0) > 0).length;
    const losers = stocksWithData.filter(s => (s.changePercent || 0) < 0).length;
    const unchanged = stocksWithData.length - gainers - losers;
    const avgChange = stocksWithData.length > 0
      ? stocksWithData.reduce((sum, s) => sum + (s.changePercent || 0), 0) / stocksWithData.length
      : 0;
    return { gainers, losers, unchanged, avgChange, total: stocksWithData.length };
  }, [stocksWithData]);

  return (
    <div className="space-y-2">
      {/* Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold">Market Heatmap</h1>
          <Badge variant="outline" className="text-[9px] border-primary/30 text-primary animate-pulse h-5">
            LIVE
          </Badge>
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-white/60">{marketSummary.total} stocks</span>
            <span className="text-emerald-400">{marketSummary.gainers} up</span>
            <span className="text-red-400">{marketSummary.losers} down</span>
            <span className={`font-bold ${marketSummary.avgChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              avg {marketSummary.avgChange >= 0 ? "+" : ""}{marketSummary.avgChange.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Tabs value={exchange} onValueChange={(v) => setExchange(v as any)}>
            <TabsList className="bg-background/50 h-7">
              <TabsTrigger value="DFM" className="text-[10px] h-5 px-2">DFM</TabsTrigger>
              <TabsTrigger value="ADX" className="text-[10px] h-5 px-2">ADX</TabsTrigger>
              <TabsTrigger value="ALL" className="text-[10px] h-5 px-2">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant={viewMode === "sector" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-[10px] px-2"
            onClick={() => setViewMode("sector")}
          >
            By Sector
          </Button>
          <Button
            variant={viewMode === "flat" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-[10px] px-2"
            onClick={() => setViewMode("flat")}
          >
            Flat
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Color Legend */}
      <div className="flex items-center gap-0.5 text-[9px] text-white/50">
        <span>-5%</span>
        {[-5, -3, -1, -0.5, 0, 0.5, 1, 3, 5].map((v) => (
          <div
            key={v}
            className="h-2.5 w-5 rounded-sm"
            style={{ backgroundColor: getHeatBg(v) }}
          />
        ))}
        <span>+5%</span>
      </div>

      {/* Treemap Content */}
      {isLoading ? (
        <div className="relative w-full" style={{ paddingBottom: "50%" }}>
          <div className="absolute inset-0 bg-zinc-800/30 animate-pulse rounded flex items-center justify-center">
            <span className="text-white/40 text-sm">Loading heatmap...</span>
          </div>
        </div>
      ) : stocksWithData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-white/50">
          <p>No stock data available</p>
          <p className="text-xs mt-1">Try refreshing or switching exchange</p>
        </div>
      ) : viewMode === "flat" ? (
        <div className="relative w-full" style={{ paddingBottom: "55%" }}>
          {flatRects.map((rect) => (
            <TreemapTile
              key={rect.stock.symbol}
              rect={rect}
              flash={getFlashClass(flashes, rect.stock.exchange, rect.stock.symbol)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {sectorGroups.map(([sector, stocks]) => (
            <SectorTreemap
              key={sector}
              sector={sector}
              stocks={stocks}
              flashes={flashes}
              totalMarketCap={totalMarketCap}
            />
          ))}
        </div>
      )}
    </div>
  );
}
