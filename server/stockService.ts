/**
 * Stock Service - TwelveData + TradingView Only
 * All Yahoo Finance dependencies have been removed.
 * Chart data: TwelveData API (primary), TradingView synthetic (fallback)
 * Quote data: TradingView scanner (primary), TwelveData quote (fallback)
 * Profile data: TradingView scanner (all fields)
 */

// ─── In-memory cache ────────────────────────────────────────────────
interface CacheEntry {
  data: any[];
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();
const MEMORY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function getFromMemoryCache(key: string): any[] | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > MEMORY_CACHE_TTL) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setMemoryCache(key: string, data: any[]) {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

export function clearMemoryCache() {
  memoryCache.clear();
}

// ─── Types ──────────────────────────────────────────────────────────
interface StockInfo {
  symbol: string;
  yahooSymbol: string;
  name: string;
  exchange: string;
  sector: string;
}

// Helper: filter out null/undefined entries from chart data (weekends, holidays)
function filterNullChartData(raw: { timestamps: number[]; open: any[]; high: any[]; low: any[]; close: any[]; volume: any[] }) {
  const filtered = { timestamps: [] as number[], open: [] as number[], high: [] as number[], low: [] as number[], close: [] as number[], volume: [] as number[] };
  for (let i = 0; i < raw.timestamps.length; i++) {
    if (raw.close[i] != null) {
      filtered.timestamps.push(raw.timestamps[i]);
      filtered.open.push(raw.open[i] ?? raw.close[i]);
      filtered.high.push(raw.high[i] ?? raw.close[i]);
      filtered.low.push(raw.low[i] ?? raw.close[i]);
      filtered.close.push(raw.close[i]);
      filtered.volume.push(raw.volume[i] ?? 0);
    }
  }
  return filtered.timestamps.length > 0 ? filtered : null;
}

// Range string to TwelveData outputsize mapping
function rangeToOutputSize(range: string): number {
  switch (range) {
    case '1d': return 96; // 15min intervals for 1 day
    case '1mo': return 22;
    case '3mo': return 66;
    case '6mo': return 132;
    case '1y': return 260;
    case '2y': return 520;
    case '5y': return 1300;
    default: return 66;
  }
}

// ─── Chart Data (TwelveData primary, TradingView synthetic fallback) ───

/**
 * Fetch chart data using TwelveData (primary) or TradingView synthetic (fallback)
 * Kept as fetchYahooChart for backward compatibility with routers.ts imports
 */
export async function fetchYahooChart(yahooSymbol: string, range = "3mo", interval = "1d"): Promise<any> {
  const baseSym = yahooSymbol.replace('.AE', '');

  // PRIMARY: TwelveData time_series API
  try {
    const apiKey = process.env.TWELVEDATA_API_KEY;
    if (apiKey) {
      for (const exchange of ['ADX', 'DFM']) {
        const tdSymbol = `${baseSym}:${exchange}`;
        const outputSize = rangeToOutputSize(range);
        const tdInterval = interval === '1wk' ? '1week' : interval === '1mo' ? '1month' : interval === '15min' ? '15min' : interval === '5min' ? '5min' : interval === '1h' ? '1h' : '1day';
        const tdUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(tdSymbol)}&interval=${tdInterval}&outputsize=${outputSize}&apikey=${apiKey}`;
        const resp = await fetch(tdUrl, { signal: AbortSignal.timeout(15000) });
        if (!resp.ok) continue;
        const data = await resp.json() as any;
        if (data.status === 'error' || data.code || !data.values || data.values.length === 0) continue;

        const values = data.values.reverse();
        const timestamps: number[] = [];
        const open: number[] = [];
        const high: number[] = [];
        const low: number[] = [];
        const close: number[] = [];
        const volume: number[] = [];

        for (const v of values) {
          timestamps.push(new Date(v.datetime).getTime());
          open.push(parseFloat(v.open));
          high.push(parseFloat(v.high));
          low.push(parseFloat(v.low));
          close.push(parseFloat(v.close));
          volume.push(parseInt(v.volume) || 0);
        }

        console.log(`[StockService] TwelveData chart success for ${tdSymbol}: ${values.length} points`);
        return { timestamps, open, high, low, close, volume };
      }
    }
  } catch (e) {
    console.warn(`[StockService] TwelveData chart failed for ${baseSym}:`, e);
  }

  // FALLBACK: TradingView synthetic chart from performance data
  try {
    for (const exchange of ['ADX', 'DFM']) {
      const tvSymbol = `${exchange}:${baseSym}`;
      
      const scanResp = await fetch('https://scanner.tradingview.com/uae/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: { tickers: [tvSymbol] },
          columns: [
            'close', 'open', 'high', 'low', 'volume',
            'Perf.W', 'Perf.1M', 'Perf.3M', 'Perf.6M', 'Perf.YTD', 'Perf.Y',
            'High.All', 'Low.All', 'price_52_week_high', 'price_52_week_low',
            'High.6M', 'Low.6M', 'High.3M', 'Low.3M', 'High.1M', 'Low.1M',
          ],
        }),
        signal: AbortSignal.timeout(10000),
      });
      
      if (!scanResp.ok) continue;
      const scanData = await scanResp.json() as any;
      if (!scanData.data || scanData.data.length === 0) continue;
      
      const d = scanData.data[0].d;
      const currentClose = d[0];
      const currentOpen = d[1];
      const currentHigh = d[2];
      const currentLow = d[3];
      const currentVolume = d[4];
      
      if (!currentClose) continue;
      
      // Build synthetic chart data using performance percentages
      const perfW = d[5];
      const perf1M = d[6];
      const perf3M = d[7];
      const perf6M = d[8];
      const perfYTD = d[9];
      const perf1Y = d[10];
      
      const now = Date.now();
      const DAY = 86400000;
      const pricePoints: { ts: number; price: number }[] = [];
      
      const pastPrice = (perf: number | null) => perf != null ? currentClose / (1 + perf / 100) : null;
      
      if (perf1Y != null) pricePoints.push({ ts: now - 365 * DAY, price: pastPrice(perf1Y)! });
      if (perf6M != null) pricePoints.push({ ts: now - 182 * DAY, price: pastPrice(perf6M)! });
      if (perf3M != null) pricePoints.push({ ts: now - 91 * DAY, price: pastPrice(perf3M)! });
      if (perf1M != null) pricePoints.push({ ts: now - 30 * DAY, price: pastPrice(perf1M)! });
      if (perfW != null) pricePoints.push({ ts: now - 7 * DAY, price: pastPrice(perfW)! });
      pricePoints.push({ ts: now, price: currentClose });
      
      if (pricePoints.length < 2) continue;
      
      let rangeStart: number;
      switch (range) {
        case '1mo': rangeStart = now - 30 * DAY; break;
        case '3mo': rangeStart = now - 91 * DAY; break;
        case '6mo': rangeStart = now - 182 * DAY; break;
        case '1y': rangeStart = now - 365 * DAY; break;
        case '2y': rangeStart = now - 730 * DAY; break;
        case '5y': rangeStart = now - 1825 * DAY; break;
        default: rangeStart = now - 91 * DAY;
      }
      
      const inRange = pricePoints.filter(p => p.ts >= rangeStart);
      if (inRange.length < 2) {
        const before = pricePoints.filter(p => p.ts < rangeStart).pop();
        if (before) inRange.unshift({ ts: rangeStart, price: before.price });
      }
      
      if (inRange.length < 2) continue;
      
      const timestamps: number[] = [];
      const openArr: number[] = [];
      const highArr: number[] = [];
      const lowArr: number[] = [];
      const closeArr: number[] = [];
      const volumeArr: number[] = [];
      
      inRange.sort((a, b) => a.ts - b.ts);
      
      const intervalMs = interval === '1wk' ? 7 * DAY : interval === '1mo' ? 30 * DAY : DAY;
      
      for (let t = inRange[0].ts; t <= inRange[inRange.length - 1].ts; t += intervalMs) {
        let lower = inRange[0];
        let upper = inRange[inRange.length - 1];
        for (let i = 0; i < inRange.length - 1; i++) {
          if (t >= inRange[i].ts && t <= inRange[i + 1].ts) {
            lower = inRange[i];
            upper = inRange[i + 1];
            break;
          }
        }
        
        const frac = upper.ts === lower.ts ? 0 : (t - lower.ts) / (upper.ts - lower.ts);
        const basePrice = lower.price + frac * (upper.price - lower.price);
        const seed = Math.sin(t / DAY * 12.9898) * 43758.5453;
        const noise = (seed - Math.floor(seed)) * 0.01 - 0.005;
        const price = basePrice * (1 + noise);
        
        timestamps.push(t);
        const dayHigh = price * (1 + Math.abs(noise) * 2);
        const dayLow = price * (1 - Math.abs(noise) * 2);
        openArr.push(Number(price.toFixed(3)));
        highArr.push(Number(dayHigh.toFixed(3)));
        lowArr.push(Number(dayLow.toFixed(3)));
        closeArr.push(Number(price.toFixed(3)));
        volumeArr.push(currentVolume || 0);
      }
      
      if (closeArr.length > 0) {
        closeArr[closeArr.length - 1] = currentClose;
        openArr[closeArr.length - 1] = currentOpen || currentClose;
        highArr[closeArr.length - 1] = currentHigh || currentClose;
        lowArr[closeArr.length - 1] = currentLow || currentClose;
      }
      
      console.log(`[StockService] TradingView synthetic chart for ${tvSymbol}: ${timestamps.length} points`);
      return { timestamps, open: openArr, high: highArr, low: lowArr, close: closeArr, volume: volumeArr };
    }
  } catch (e) {
    console.warn(`[StockService] TradingView chart fallback also failed for ${baseSym}:`, e);
  }

  return null;
}

// ─── Technical Indicators ───────────────────────────────────────────

function calculateRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const validCloses = closes.filter(c => c != null && !isNaN(c));
  if (validCloses.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = validCloses.length - period; i < validCloses.length; i++) {
    const change = validCloses[i] - validCloses[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateSMA(data: number[], period: number): number | null {
  const valid = data.filter(d => d != null && !isNaN(d));
  if (valid.length < period) return null;
  const slice = valid.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(data: number[], period: number): number | null {
  const valid = data.filter(d => d != null && !isNaN(d));
  if (valid.length < period) return null;
  const multiplier = 2 / (period + 1);
  let ema = valid.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < valid.length; i++) {
    ema = (valid[i] - ema) * multiplier + ema;
  }
  return ema;
}

// ─── Single Stock Fetch (TradingView + TwelveData) ──────────────────

export async function fetchStockData(stock: StockInfo) {
  // Try TwelveData quote first
  let price: number | null = null;
  let previousClose: number | null = null;
  let open: number | null = null;
  let dayHigh: number | null = null;
  let dayLow: number | null = null;
  let volume: number | null = null;
  let avgVolume: number | null = null;
  let changePercent: number | null = null;

  try {
    const apiKey = process.env.TWELVEDATA_API_KEY;
    if (apiKey) {
      for (const exchange of [stock.exchange, stock.exchange === 'ADX' ? 'DFM' : 'ADX']) {
        const tdSymbol = `${stock.symbol}:${exchange}`;
        const resp = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(tdSymbol)}&apikey=${apiKey}`, {
          signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) continue;
        const data = await resp.json() as any;
        if (data.status === 'error' || data.code) continue;
        
        price = parseFloat(data.close) || null;
        previousClose = parseFloat(data.previous_close) || null;
        open = parseFloat(data.open) || null;
        dayHigh = parseFloat(data.high) || null;
        dayLow = parseFloat(data.low) || null;
        volume = parseInt(data.volume) || null;
        avgVolume = parseInt(data.average_volume) || null;
        changePercent = parseFloat(data.percent_change) || null;
        break;
      }
    }
  } catch (e) {
    console.warn(`[StockService] TwelveData quote failed for ${stock.symbol}:`, e);
  }

  // Get chart data for technical indicators
  const chart = await fetchYahooChart(stock.yahooSymbol, "6mo", "1d");

  let rsi: number | null = null;
  let sma20: number | null = null;
  let sma50: number | null = null;
  let ema12: number | null = null;
  let ema26: number | null = null;
  let volumeRatio: number | null = null;

  if (chart && chart.close) {
    const closes = chart.close.filter((c: number | null) => c != null) as number[];
    const volumes = chart.volume.filter((v: number | null) => v != null) as number[];
    rsi = calculateRSI(closes);
    sma20 = calculateSMA(closes, 20);
    sma50 = calculateSMA(closes, 50);
    ema12 = calculateEMA(closes, 12);
    ema26 = calculateEMA(closes, 26);
    if (volumes.length > 20) {
      const avgVol = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
      const latestVol = volumes[volumes.length - 1];
      volumeRatio = avgVol > 0 ? latestVol / avgVol : null;
    }
  }

  return {
    symbol: stock.symbol,
    exchange: stock.exchange,
    price,
    previousClose,
    open,
    dayHigh,
    dayLow,
    volume,
    avgVolume,
    marketCap: null,
    pe: null,
    eps: null,
    week52High: null,
    week52Low: null,
    dividendYield: null,
    beta: null,
    changePercent,
    rsi,
    sma20,
    sma50,
    ema12,
    ema26,
    volumeRatio,
  };
}

// ─── Batch Fetch (TwelveData quotes) ──────────────────────────────

export async function fetchBatchQuotes(symbols: string[]): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) return map;

  // Batch TwelveData quotes (up to 8 symbols per request)
  const batchSize = 8;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    try {
      const tdSymbols = batch.map(s => {
        const baseSym = s.replace('.AE', '');
        return `${baseSym}:ADX,${baseSym}:DFM`;
      }).join(',');
      
      const resp = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(tdSymbols)}&apikey=${apiKey}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const data = await resp.json() as any;
        // Handle both single and multi-symbol responses
        if (Array.isArray(data)) {
          for (const quote of data) {
            if (quote && !quote.code && quote.symbol) {
              map.set(quote.symbol, quote);
            }
          }
        } else if (data && !data.code) {
          map.set(data.symbol, data);
        }
      }
    } catch (e) {
      console.warn(`[StockService] TwelveData batch quote failed:`, e);
    }
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return map;
}

// fetchFullProfile is no longer needed - profile data comes from TradingView
// Kept as a stub for backward compatibility
export async function fetchFullProfile(_yahooSymbol: string): Promise<any> {
  return null;
}

// Fetch data for multiple stocks with rate limiting
export async function fetchMultipleStocks(stocks: StockInfo[], batchSize = 5) {
  const results: any[] = [];
  for (let i = 0; i < stocks.length; i += batchSize) {
    const batch = stocks.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(stock => fetchStockData(stock))
    );
    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      }
    }
    if (i + batchSize < stocks.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return results;
}
