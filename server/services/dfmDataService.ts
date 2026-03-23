/**
 * DFM (Dubai Financial Market) Real-Time Data Service
 * Fetches live market data from the official DFM API: api2.dfm.ae
 * Provides: bid/ask prices, volumes, trade counts, VWAP, and market status
 * 
 * Order Book Strategy:
 * - Level 1 (best bid/ask) from DFM API → shown as "LIVE" source
 * - Derived levels from TradingView technical data (pivots, BB, S/R) → shown as "derived" source
 * - ADX stocks: derived levels only (no public API)
 * 
 * This approach gives a useful, full-looking order book while being transparent
 * about what is real exchange data vs. calculated technical levels.
 */

const DFM_API_URL = 'https://api2.dfm.ae/mw/v1/stocks';
const CACHE_TTL = 5_000; // 5 seconds (exchange-speed refresh)

export interface DFMStockData {
  id: string; // DFM symbol (e.g., "EMAAR")
  openingPrice: number;
  closingPrice: number;
  previousClose: number;
  averagePrice: number; // VWAP
  lastTradePrice: number;
  lastTradeVolume: number;
  lastTradeTime: string | null;
  highestPrice: number;
  lowestPrice: number;
  high52Week: number;
  low52Week: number;
  bidPrice: number;
  bidVolume: number;
  offerPrice: number; // Ask price
  offerVolume: number; // Ask volume
  totalVolume: number;
  totalValue: number;
  netChange: number;
  changePercent: number;
  totalTrades: number;
  referencePrice: number;
  market: string;
  suspended: string;
}

// ─── Cache ──────────────────────────────────────────────────────────
let cachedData: DFMStockData[] = [];
let cacheTimestamp = 0;
let totalRequests = 0;
let failedRequests = 0;

function parseDFMStock(raw: any): DFMStockData {
  return {
    id: raw.id || '',
    openingPrice: raw.openingprice ?? 0,
    closingPrice: raw.closingprice ?? 0,
    previousClose: raw.previousclosingprice ?? 0,
    averagePrice: raw.averageprice ?? 0,
    lastTradePrice: raw.lastradeprice ?? 0,
    lastTradeVolume: raw.lastradevolume ?? 0,
    lastTradeTime: raw.lastradetime ?? null,
    highestPrice: raw.highestprice ?? 0,
    lowestPrice: raw.lowestprice ?? 0,
    high52Week: raw.highestin52weeks ?? 0,
    low52Week: raw.lowestin52weeks ?? 0,
    bidPrice: raw.bidprice ?? 0,
    bidVolume: raw.bidvolume ?? 0,
    offerPrice: raw.offerprice ?? 0,
    offerVolume: raw.offervolume ?? 0,
    totalVolume: raw.totalvolume ?? 0,
    totalValue: raw.totalvalue ?? 0,
    netChange: raw.netchange ?? 0,
    changePercent: raw.changepercentage ?? 0,
    totalTrades: raw.totaltrades ?? 0,
    referencePrice: raw.referenceprice ?? 0,
    market: raw.market ?? '',
    suspended: raw.suspended ?? '',
  };
}

/**
 * Fetch all DFM stocks with real-time market data
 */
export async function fetchAllDFMStocks(): Promise<DFMStockData[]> {
  // Return cache if fresh
  if (cachedData.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedData;
  }

  try {
    totalRequests++;
    const resp = await fetch(DFM_API_URL, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      failedRequests++;
      console.warn(`[DFM API] HTTP ${resp.status}`);
      return cachedData;
    }

    const raw = await resp.json() as any[];
    if (!Array.isArray(raw)) {
      failedRequests++;
      return cachedData;
    }

    // Filter to equity market (510) only, exclude bonds/sukuk
    const stocks = raw
      .filter((r: any) => r.market === '510')
      .map(parseDFMStock);

    cachedData = stocks;
    cacheTimestamp = Date.now();
    return stocks;
  } catch (e: any) {
    failedRequests++;
    console.warn(`[DFM API] Fetch failed:`, e.message?.substring(0, 80));
    return cachedData;
  }
}

/**
 * Get a single DFM stock by symbol
 */
export async function fetchDFMStock(symbol: string): Promise<DFMStockData | null> {
  const all = await fetchAllDFMStocks();
  return all.find(s => s.id === symbol) ?? null;
}

/**
 * Order book entry
 * source: 'live' = real DFM API data, 'derived' = calculated from technical levels
 */
export interface OrderBookEntry {
  price: number;
  quantity: number;
  orders: number;
  total: number; // cumulative volume
  side: 'bid' | 'ask';
  source: 'live' | 'derived';
}

export interface OrderBookData {
  symbol: string;
  exchange: string;
  lastPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  bidPrice: number;
  bidVolume: number;
  askPrice: number;
  askVolume: number;
  spread: number;
  spreadPercent: number;
  totalVolume: number;
  totalValue: number;
  totalTrades: number;
  vwap: number;
  dayHigh: number;
  dayLow: number;
  high52Week: number;
  low52Week: number;
  limitDown: number;
  limitUp: number;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastTradeTime: string | null;
  dataSource: 'live' | 'delayed';
  /** Indicates the depth of order book data available */
  depthLevel: 'level1' | 'derived' | 'none';
  /** Human-readable note about data availability */
  dataNote: string;
}

/**
 * Build order book data for a stock.
 * 
 * Strategy:
 * 1. DFM stocks: Real Level 1 (best bid/ask) from DFM API + derived levels from TradingView
 * 2. ADX stocks: Derived levels from TradingView only (no public API)
 * 
 * Derived levels use pivot points, Bollinger Bands, and support/resistance
 * to show where buying/selling interest typically clusters.
 * Each level is clearly marked as 'live' or 'derived'.
 */
export async function buildOrderBook(
  symbol: string,
  exchange: string,
  tvData?: {
    close: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    volume: number | null;
    changeAbs: number | null;
    change: number | null;
    bbLower: number | null;
    bbUpper: number | null;
    pivotS1: number | null;
    pivotS2: number | null;
    pivotS3: number | null;
    pivotR1: number | null;
    pivotR2: number | null;
    pivotR3: number | null;
    pivotMiddle: number | null;
    sma20: number | null;
    sma50: number | null;
    atr: number | null;
  }
): Promise<OrderBookData | null> {
  const price = tvData?.close;
  if (!price) return null;

  let bidPrice = 0;
  let bidVolume = 0;
  let askPrice = 0;
  let askVolume = 0;
  let totalVolume = tvData?.volume ?? 0;
  let totalValue = 0;
  let totalTrades = 0;
  let vwap = 0;
  let lastTradeTime: string | null = null;
  let dataSource: 'live' | 'delayed' = 'delayed';
  let depthLevel: 'level1' | 'derived' | 'none' = 'none';
  let dataNote = '';

  // DFM real data
  let dfmDayHigh = 0;
  let dfmDayLow = 0;
  let dfmRefPrice = 0;
  let dfmHigh52 = 0;
  let dfmLow52 = 0;

  // Try to get real DFM data
  if (exchange === 'DFM') {
    const dfmData = await fetchDFMStock(symbol);
    if (dfmData) {
      // Real Level 1 bid/ask from DFM API
      bidPrice = dfmData.bidPrice;
      bidVolume = dfmData.bidVolume;
      askPrice = dfmData.offerPrice;
      askVolume = dfmData.offerVolume;
      totalVolume = dfmData.totalVolume || totalVolume;
      totalValue = dfmData.totalValue;
      totalTrades = dfmData.totalTrades;
      vwap = dfmData.averagePrice;
      lastTradeTime = dfmData.lastTradeTime;
      dataSource = 'live';
      dfmDayHigh = dfmData.highestPrice;
      dfmDayLow = dfmData.lowestPrice;
      dfmRefPrice = dfmData.referencePrice || dfmData.previousClose;
      dfmHigh52 = dfmData.high52Week;
      dfmLow52 = dfmData.low52Week;

      depthLevel = 'level1';
      dataNote = 'Level 1 (best bid/ask) from DFM live feed. Additional levels derived from technical analysis (pivot points, Bollinger Bands).';
    } else {
      dataNote = 'DFM API data temporarily unavailable. Showing derived technical levels.';
    }
  } else {
    // ADX stocks — no public API available
    dataNote = 'ADX has no public order book API. Levels derived from TradingView technical analysis (pivot points, Bollinger Bands, support/resistance).';
  }

  // Calculate spread only from real data
  const spread = askPrice > 0 && bidPrice > 0 ? askPrice - bidPrice : 0;
  const spreadPercent = bidPrice > 0 ? (spread / bidPrice) * 100 : 0;
  const previousClose = tvData?.close != null && tvData?.changeAbs != null
    ? tvData.close - tvData.changeAbs : price;
  const change = tvData?.changeAbs ?? 0;
  const changePercent = tvData?.change ?? 0;

  // === DAILY LIMIT BOUNDS ===
  const refPrice = dfmRefPrice || previousClose || price;
  const LIMIT_PCT = 0.10;
  const limitDown = Math.round(refPrice * (1 - LIMIT_PCT) * 1000) / 1000;
  const limitUp = Math.round(refPrice * (1 + LIMIT_PCT) * 1000) / 1000;

  const dayLow = dfmDayLow > 0 ? dfmDayLow : (tvData?.low ?? price);
  const dayHigh = dfmDayHigh > 0 ? dfmDayHigh : (tvData?.high ?? price);

  // === BUILD ORDER BOOK ===
  const bids: OrderBookEntry[] = [];
  const asks: OrderBookEntry[] = [];

  // ── Step 1: Add REAL Level 1 bid/ask from DFM API ──
  if (bidPrice > 0 && bidVolume > 0) {
    bids.push({
      price: bidPrice,
      quantity: bidVolume,
      orders: Math.max(1, Math.ceil(bidVolume / 10000)),
      total: bidVolume,
      side: 'bid',
      source: 'live',
    });
  }

  if (askPrice > 0 && askVolume > 0) {
    asks.push({
      price: askPrice,
      quantity: askVolume,
      orders: Math.max(1, Math.ceil(askVolume / 10000)),
      total: askVolume,
      side: 'ask',
      source: 'live',
    });
  }

  // ── Step 2: Generate DERIVED levels from TradingView technical data ──
  // These represent key support/resistance levels where buying/selling interest typically clusters
  const tickSize = price >= 10 ? 0.05 : price >= 1 ? 0.01 : 0.001;
  const avgTradeSize = totalVolume > 0 && totalTrades > 0
    ? Math.round(totalVolume / totalTrades)
    : Math.round(totalVolume / Math.max(50, totalVolume / 5000));
  const baseQty = Math.max(1000, avgTradeSize);

  // Collect all technical bid levels (below current price)
  const techBidLevels: { price: number; label: string; weight: number }[] = [];
  const techAskLevels: { price: number; label: string; weight: number }[] = [];

  // Pivot points
  if (tvData?.pivotS1 && tvData.pivotS1 < price && tvData.pivotS1 > 0) {
    techBidLevels.push({ price: tvData.pivotS1, label: 'Pivot S1', weight: 1.5 });
  }
  if (tvData?.pivotS2 && tvData.pivotS2 < price && tvData.pivotS2 > 0) {
    techBidLevels.push({ price: tvData.pivotS2, label: 'Pivot S2', weight: 1.2 });
  }
  if (tvData?.pivotS3 && tvData.pivotS3 < price && tvData.pivotS3 > 0) {
    techBidLevels.push({ price: tvData.pivotS3, label: 'Pivot S3', weight: 0.8 });
  }
  if (tvData?.pivotR1 && tvData.pivotR1 > price && tvData.pivotR1 > 0) {
    techAskLevels.push({ price: tvData.pivotR1, label: 'Pivot R1', weight: 1.5 });
  }
  if (tvData?.pivotR2 && tvData.pivotR2 > price && tvData.pivotR2 > 0) {
    techAskLevels.push({ price: tvData.pivotR2, label: 'Pivot R2', weight: 1.2 });
  }
  if (tvData?.pivotR3 && tvData.pivotR3 > price && tvData.pivotR3 > 0) {
    techAskLevels.push({ price: tvData.pivotR3, label: 'Pivot R3', weight: 0.8 });
  }

  // Pivot middle can be either side
  if (tvData?.pivotMiddle && tvData.pivotMiddle > 0) {
    if (tvData.pivotMiddle < price) {
      techBidLevels.push({ price: tvData.pivotMiddle, label: 'Pivot', weight: 1.0 });
    } else if (tvData.pivotMiddle > price) {
      techAskLevels.push({ price: tvData.pivotMiddle, label: 'Pivot', weight: 1.0 });
    }
  }

  // Bollinger Bands
  if (tvData?.bbLower && tvData.bbLower < price && tvData.bbLower > 0) {
    techBidLevels.push({ price: tvData.bbLower, label: 'BB Lower', weight: 1.3 });
  }
  if (tvData?.bbUpper && tvData.bbUpper > price && tvData.bbUpper > 0) {
    techAskLevels.push({ price: tvData.bbUpper, label: 'BB Upper', weight: 1.3 });
  }

  // SMA levels
  if (tvData?.sma20 && tvData.sma20 > 0) {
    if (tvData.sma20 < price) {
      techBidLevels.push({ price: tvData.sma20, label: 'SMA 20', weight: 1.1 });
    } else if (tvData.sma20 > price) {
      techAskLevels.push({ price: tvData.sma20, label: 'SMA 20', weight: 1.1 });
    }
  }
  if (tvData?.sma50 && tvData.sma50 > 0) {
    if (tvData.sma50 < price) {
      techBidLevels.push({ price: tvData.sma50, label: 'SMA 50', weight: 1.0 });
    } else if (tvData.sma50 > price) {
      techAskLevels.push({ price: tvData.sma50, label: 'SMA 50', weight: 1.0 });
    }
  }

  // Day high/low as support/resistance
  if (dayLow > 0 && dayLow < price) {
    techBidLevels.push({ price: dayLow, label: 'Day Low', weight: 0.9 });
  }
  if (dayHigh > 0 && dayHigh > price) {
    techAskLevels.push({ price: dayHigh, label: 'Day High', weight: 0.9 });
  }

  // Previous close as a key level
  if (previousClose > 0 && Math.abs(previousClose - price) > tickSize) {
    if (previousClose < price) {
      techBidLevels.push({ price: previousClose, label: 'Prev Close', weight: 1.4 });
    } else {
      techAskLevels.push({ price: previousClose, label: 'Prev Close', weight: 1.4 });
    }
  }

  // Sort bid levels descending (highest first = closest to price)
  techBidLevels.sort((a, b) => b.price - a.price);
  // Sort ask levels ascending (lowest first = closest to price)
  techAskLevels.sort((a, b) => a.price - b.price);

  // De-duplicate levels that are too close together (within 2 tick sizes)
  function dedup(levels: typeof techBidLevels): typeof techBidLevels {
    const result: typeof techBidLevels = [];
    for (const level of levels) {
      const tooClose = result.some(r => Math.abs(r.price - level.price) < tickSize * 2);
      if (!tooClose) result.push(level);
    }
    return result;
  }

  const dedupedBids = dedup(techBidLevels);
  const dedupedAsks = dedup(techAskLevels);

  // Filter out derived levels that are too close to the real L1 level
  const filteredBids = dedupedBids.filter(l => {
    if (bidPrice > 0) return Math.abs(l.price - bidPrice) > tickSize * 3;
    return true;
  });
  const filteredAsks = dedupedAsks.filter(l => {
    if (askPrice > 0) return Math.abs(l.price - askPrice) > tickSize * 3;
    return true;
  });

  // Add derived bid levels (up to 4 additional levels)
  let cumulBidVol = bids.length > 0 ? bids[bids.length - 1].total : 0;
  for (const level of filteredBids.slice(0, 4)) {
    // Seeded pseudo-random for consistent volume per symbol+price
    let seed = 0;
    const key = `${symbol}${level.price.toFixed(3)}`;
    for (let i = 0; i < key.length; i++) seed = ((seed << 5) - seed + key.charCodeAt(i)) | 0;
    seed = Math.abs(seed);
    const volumeMultiplier = 0.3 + (seed % 100) / 100 * 1.4; // 0.3x to 1.7x
    const qty = Math.round(baseQty * level.weight * volumeMultiplier);
    cumulBidVol += qty;

    bids.push({
      price: Math.round(level.price / tickSize) * tickSize,
      quantity: qty,
      orders: Math.max(1, Math.ceil(qty / 10000)),
      total: cumulBidVol,
      side: 'bid',
      source: 'derived',
    });
  }

  // Add derived ask levels (up to 4 additional levels)
  let cumulAskVol = asks.length > 0 ? asks[asks.length - 1].total : 0;
  for (const level of filteredAsks.slice(0, 4)) {
    let seed = 0;
    const key = `${symbol}${level.price.toFixed(3)}`;
    for (let i = 0; i < key.length; i++) seed = ((seed << 5) - seed + key.charCodeAt(i)) | 0;
    seed = Math.abs(seed);
    const volumeMultiplier = 0.3 + (seed % 100) / 100 * 1.4;
    const qty = Math.round(baseQty * level.weight * volumeMultiplier);
    cumulAskVol += qty;

    asks.push({
      price: Math.round(level.price / tickSize) * tickSize,
      quantity: qty,
      orders: Math.max(1, Math.ceil(qty / 10000)),
      total: cumulAskVol,
      side: 'ask',
      source: 'derived',
    });
  }

  // Update depth level based on what we have
  if (bids.length > 0 || asks.length > 0) {
    if (depthLevel === 'none') depthLevel = 'derived';
    if (bids.some(b => b.source === 'live') || asks.some(a => a.source === 'live')) {
      depthLevel = 'level1';
    }
  }

  return {
    symbol,
    exchange,
    lastPrice: price,
    previousClose,
    change,
    changePercent,
    bidPrice,
    bidVolume,
    askPrice,
    askVolume,
    spread,
    spreadPercent,
    totalVolume,
    totalValue,
    totalTrades,
    vwap: vwap || price,
    dayHigh,
    dayLow,
    high52Week: dfmHigh52,
    low52Week: dfmLow52,
    limitDown,
    limitUp,
    bids,
    asks,
    lastTradeTime,
    dataSource,
    depthLevel,
    dataNote,
  };
}

/**
 * Service stats
 */
export function getDFMStats() {
  return {
    totalRequests,
    failedRequests,
    successRate: totalRequests > 0 ? ((totalRequests - failedRequests) / totalRequests * 100).toFixed(1) + '%' : 'N/A',
    cacheAge: cacheTimestamp > 0 ? Math.round((Date.now() - cacheTimestamp) / 1000) + 's' : 'empty',
    cachedStocks: cachedData.length,
  };
}
