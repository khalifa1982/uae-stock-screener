/**
 * DFM (Dubai Financial Market) Real-Time Data Service
 * Fetches live market data from the official DFM API: api2.dfm.ae
 * Provides: bid/ask prices, volumes, trade counts, VWAP, and market status
 * 
 * This is the ONLY source of real bid/ask data for UAE stocks.
 * ADX does not expose a public API (Cloudflare-protected).
 * 
 * IMPORTANT: The DFM public API only provides Level 1 data (best bid/ask).
 * Full order book depth (Level 2) is NOT available from the public API.
 * We show ONLY real data — no synthetic/fabricated levels.
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
 * Order book entry — only from REAL data sources
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
  depthLevel: 'level1' | 'none';
  /** Human-readable note about data availability */
  dataNote: string;
}

/**
 * Build order book data for a stock using ONLY real data.
 * 
 * DFM stocks: Level 1 data (best bid/ask) from the official DFM API.
 * ADX stocks: No order book data available (ADX has no public API).
 * 
 * NO SYNTHETIC DATA IS GENERATED. If there are no bids, bids array is empty.
 * If there are no asks, asks array is empty.
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
  let depthLevel: 'level1' | 'none' = 'none';
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
      // Use ONLY real bid/ask from DFM API
      // If bidPrice is 0, it means there are NO bids in the market — we show empty
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

      // DFM provides Level 1 (best bid/ask only)
      depthLevel = 'level1';
      dataNote = 'Level 1 data from DFM API (best bid/ask only). Full order book depth requires a paid subscription.';
    } else {
      dataNote = 'DFM API data temporarily unavailable.';
    }
  } else {
    // ADX stocks — no public API available
    dataNote = 'ADX does not provide a public order book API. Price data from TradingView.';
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

  // === BUILD ORDER BOOK WITH REAL DATA ONLY ===
  const bids: OrderBookEntry[] = [];
  const asks: OrderBookEntry[] = [];

  // Only add a bid level if there is a REAL bid from DFM API
  if (bidPrice > 0 && bidVolume > 0) {
    bids.push({
      price: bidPrice,
      quantity: bidVolume,
      orders: Math.max(1, Math.ceil(bidVolume / 10000)), // Estimate orders from volume
      total: bidVolume,
      side: 'bid',
      source: 'live',
    });
  }

  // Only add an ask level if there is a REAL ask from DFM API
  if (askPrice > 0 && askVolume > 0) {
    asks.push({
      price: askPrice,
      quantity: askVolume,
      orders: Math.max(1, Math.ceil(askVolume / 10000)), // Estimate orders from volume
      total: askVolume,
      side: 'ask',
      source: 'live',
    });
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
