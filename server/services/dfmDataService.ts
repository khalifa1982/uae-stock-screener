/**
 * DFM (Dubai Financial Market) Real-Time Data Service
 * Fetches live market data from the official DFM API: api2.dfm.ae
 * Provides: bid/ask prices, volumes, trade counts, VWAP, and market status
 * 
 * This is the ONLY source of real bid/ask data for UAE stocks.
 * ADX does not expose a public API (Cloudflare-protected).
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
 * Get order book data for a stock (DFM only provides best bid/ask, not full depth)
 * We return the best bid/ask from the official API
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
}

/**
 * Build order book data for a stock
 * For DFM stocks: uses real bid/ask from DFM API
 * For ADX stocks: derives from TradingView price data
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

  // DFM real data for limit bounds
  let dfmDayHigh = 0;
  let dfmDayLow = 0;
  let dfmRefPrice = 0;

  // Try to get real DFM data
  if (exchange === 'DFM') {
    const dfmData = await fetchDFMStock(symbol);
    if (dfmData) {
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
    }
  }

  // If no real bid/ask, derive from price data
  if (bidPrice === 0 && askPrice === 0) {
    const atr = tvData?.atr ?? price * 0.02;
    const tickSize = price >= 10 ? 0.05 : price >= 1 ? 0.01 : 0.001;
    bidPrice = Math.max(0, price - tickSize);
    askPrice = price + tickSize;
    dataSource = 'delayed';
  }

  const spread = askPrice > 0 && bidPrice > 0 ? askPrice - bidPrice : 0;
  const spreadPercent = bidPrice > 0 ? (spread / bidPrice) * 100 : 0;
  const previousClose = tvData?.close != null && tvData?.changeAbs != null
    ? tvData.close - tvData.changeAbs : price;
  const change = tvData?.changeAbs ?? 0;
  const changePercent = tvData?.change ?? 0;

  // === DAILY LIMIT BOUNDS ===
  // UAE markets (DFM/ADX) have +/-10% daily limits from reference price
  const refPrice = dfmRefPrice || previousClose || price;
  const LIMIT_PCT = 0.10;
  const limitDown = Math.round(refPrice * (1 - LIMIT_PCT) * 1000) / 1000;
  const limitUp = Math.round(refPrice * (1 + LIMIT_PCT) * 1000) / 1000;

  // Use actual day range from DFM if available, otherwise use limit bounds
  // The actual traded range is the tightest bound we should show
  const dayLow = dfmDayLow > 0 ? dfmDayLow : (tvData?.low ?? limitDown);
  const dayHigh = dfmDayHigh > 0 ? dfmDayHigh : (tvData?.high ?? limitUp);

  // Floor/ceiling for price spectrum: use the wider of day range and a small buffer
  // but never exceed the daily limit
  const tickSize = price >= 50 ? 0.05 : price >= 10 ? 0.05 : price >= 1 ? 0.01 : 0.001;
  const spectrumFloor = Math.max(limitDown, Math.round((dayLow - tickSize * 2) / tickSize) * tickSize);
  const spectrumCeiling = Math.min(limitUp, Math.round((dayHigh + tickSize * 2) / tickSize) * tickSize);

  // Build order book depth levels within the valid price range
  const bids: OrderBookEntry[] = [];
  const asks: OrderBookEntry[] = [];

  // Calculate how many levels fit within the valid range
  const bidStart = bidPrice > 0 ? bidPrice : price - tickSize;
  const askStart = askPrice > 0 ? askPrice : price + tickSize;
  const maxBidLevels = Math.max(1, Math.floor((bidStart - spectrumFloor) / tickSize) + 1);
  const maxAskLevels = Math.max(1, Math.floor((spectrumCeiling - askStart) / tickSize) + 1);
  const NUM_BID_LEVELS = Math.min(15, maxBidLevels);
  const NUM_ASK_LEVELS = Math.min(15, maxAskLevels);

  // Seeded random for deterministic volume generation per symbol
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) seed = ((seed << 5) - seed + symbol.charCodeAt(i)) | 0;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  // Collect key technical levels for volume emphasis
  const supportLevels = new Set(
    [tvData?.pivotS1, tvData?.pivotS2, tvData?.pivotS3, tvData?.bbLower, tvData?.sma20, tvData?.sma50]
      .filter((v): v is number => v != null && v > 0 && v < price && v >= spectrumFloor)
      .map(v => Math.round(v / tickSize) * tickSize)
  );
  const resistanceLevels = new Set(
    [tvData?.pivotR1, tvData?.pivotR2, tvData?.pivotR3, tvData?.bbUpper]
      .filter((v): v is number => v != null && v > 0 && v > price && v <= spectrumCeiling)
      .map(v => Math.round(v / tickSize) * tickSize)
  );

  // Average volume per level as baseline
  const avgVolPerLevel = Math.max(1000, Math.round(totalVolume / 50));

  // === BID LEVELS (below price, down to spectrumFloor) ===
  let cumBidVol = 0;

  for (let i = 0; i < NUM_BID_LEVELS; i++) {
    const levelPrice = Math.round((bidStart - i * tickSize) * 1000) / 1000;
    if (levelPrice < spectrumFloor || levelPrice <= 0) break;

    // Volume: real data for first level if available, otherwise generate
    let qty: number;
    let orders: number;
    const isLive = i === 0 && bidVolume > 0 && dataSource === 'live';

    if (isLive) {
      qty = bidVolume;
      orders = Math.max(1, Math.ceil(qty / 10000));
    } else {
      // Volume increases slightly with distance (more passive orders further from price)
      // Technical levels get a volume boost
      const distMultiplier = 1 + (i * 0.15);
      const techBoost = supportLevels.has(Math.round(levelPrice / tickSize) * tickSize) ? 2.5 : 1;
      const randomFactor = 0.5 + rand() * 1.0;
      qty = Math.round(avgVolPerLevel * distMultiplier * techBoost * randomFactor);
      orders = Math.max(1, Math.round(qty / (3000 + rand() * 7000)));
    }

    cumBidVol += qty;
    bids.push({
      price: levelPrice,
      quantity: qty,
      orders,
      total: cumBidVol,
      side: 'bid',
      source: isLive ? 'live' : 'derived',
    });
  }

  // === ASK LEVELS (above price, up to spectrumCeiling) ===
  let cumAskVol = 0;

  for (let i = 0; i < NUM_ASK_LEVELS; i++) {
    const levelPrice = Math.round((askStart + i * tickSize) * 1000) / 1000;
    if (levelPrice > spectrumCeiling) break;

    let qty: number;
    let orders: number;
    const isLive = i === 0 && askVolume > 0 && dataSource === 'live';

    if (isLive) {
      qty = askVolume;
      orders = Math.max(1, Math.ceil(qty / 10000));
    } else {
      const distMultiplier = 1 + (i * 0.15);
      const techBoost = resistanceLevels.has(Math.round(levelPrice / tickSize) * tickSize) ? 2.5 : 1;
      const randomFactor = 0.5 + rand() * 1.0;
      qty = Math.round(avgVolPerLevel * distMultiplier * techBoost * randomFactor);
      orders = Math.max(1, Math.round(qty / (3000 + rand() * 7000)));
    }

    cumAskVol += qty;
    asks.push({
      price: levelPrice,
      quantity: qty,
      orders,
      total: cumAskVol,
      side: 'ask',
      source: isLive ? 'live' : 'derived',
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
    dayHigh: dfmDayHigh > 0 ? dfmDayHigh : (tvData?.high ?? price),
    dayLow: dfmDayLow > 0 ? dfmDayLow : (tvData?.low ?? price),
    high52Week: 0,
    low52Week: 0,
    limitDown,
    limitUp,
    bids,
    asks,
    lastTradeTime,
    dataSource,
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
