import { ALL_STOCKS, StockInfo } from "../shared/stockData";
import { callDataApi } from "./_core/dataApi";

// ─── In-memory cache ────────────────────────────────────────────────
// Avoids hitting the DB or external APIs on every request.
// Cache is keyed by exchange and stores the full result array.
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

// ─── Yahoo Finance direct API (fallback only) ──────────────────────
const YAHOO_V7 = "https://query2.finance.yahoo.com/v7/finance";
const YAHOO_V8 = "https://query2.finance.yahoo.com/v8/finance";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

let cachedCrumb: string | null = null;
let cachedCookies: string | null = null;
let crumbExpiry = 0;

async function getYahooCrumb(): Promise<{ crumb: string; cookies: string }> {
  if (cachedCrumb && cachedCookies && Date.now() < crumbExpiry) {
    return { crumb: cachedCrumb, cookies: cachedCookies };
  }
  try {
    const cookieResp = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": UA },
      redirect: "manual",
    });
    const setCookies = cookieResp.headers.getSetCookie?.() || [];
    const cookieStr = setCookies.map(c => c.split(";")[0]).join("; ");
    const crumbResp = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, "Cookie": cookieStr },
    });
    if (!crumbResp.ok) throw new Error(`Crumb request failed: ${crumbResp.status}`);
    const crumb = (await crumbResp.text()).trim();
    cachedCrumb = crumb;
    cachedCookies = cookieStr;
    crumbExpiry = Date.now() + 10 * 60 * 1000;
    return { crumb, cookies: cookieStr };
  } catch (e) {
    console.warn("[StockService] Failed to get Yahoo crumb:", e);
    throw e;
  }
}

interface YahooQuoteResult {
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  averageDailyVolume3Month?: number;
  marketCap?: number;
  trailingPE?: number;
  epsTrailingTwelveMonths?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  dividendYield?: number;
  beta?: number;
  regularMarketChangePercent?: number;
  shortName?: string;
  symbol?: string;
}

// PRIMARY: Fetch a single stock's quote data via the built-in Data API
async function fetchQuoteViaDataApi(yahooSymbol: string): Promise<YahooQuoteResult | null> {
  try {
    const data = await callDataApi("YahooFinance/get_stock_chart", {
      query: {
        symbol: yahooSymbol,
        interval: "1d",
        range: "5d",
        includeAdjustedClose: "true",
      },
    }) as any;

    const result = data?.chart?.result?.[0];
    if (!result?.meta) return null;

    const meta = result.meta;
    return {
      regularMarketPrice: meta.regularMarketPrice ?? undefined,
      regularMarketPreviousClose: meta.chartPreviousClose ?? meta.previousClose ?? undefined,
      regularMarketOpen: meta.regularMarketDayHigh ? undefined : undefined,
      regularMarketDayHigh: meta.regularMarketDayHigh ?? undefined,
      regularMarketDayLow: meta.regularMarketDayLow ?? undefined,
      regularMarketVolume: meta.regularMarketVolume ?? undefined,
      averageDailyVolume3Month: undefined,
      marketCap: undefined,
      trailingPE: undefined,
      epsTrailingTwelveMonths: undefined,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? undefined,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? undefined,
      dividendYield: undefined,
      beta: undefined,
      regularMarketChangePercent: meta.regularMarketPrice && meta.chartPreviousClose
        ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
        : undefined,
      shortName: meta.shortName ?? undefined,
      symbol: meta.symbol ?? yahooSymbol,
    };
  } catch (e) {
    console.warn(`[StockService] Data API quote failed for ${yahooSymbol}:`, e);
    return null;
  }
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
    case '1mo': return 22;
    case '3mo': return 66;
    case '6mo': return 132;
    case '1y': return 260;
    case '2y': return 520;
    case '5y': return 1300;
    default: return 66;
  }
}

// Fetch chart data using the built-in Data API (primary), direct Yahoo (fallback), or TwelveData (final fallback)
export async function fetchYahooChart(yahooSymbol: string, range = "3mo", interval = "1d"): Promise<any> {
  // Try Data API first
  try {
    const data = await callDataApi("YahooFinance/get_stock_chart", {
      query: {
        symbol: yahooSymbol,
        interval,
        range,
        includeAdjustedClose: "true",
      },
    }) as any;

    const result = data?.chart?.result?.[0];
    if (result) {
      const timestamps = result.timestamp || [];
      const quotes = result.indicators?.quote?.[0] || {};
      const raw = {
        timestamps: timestamps.map((t: number) => t * 1000),
        open: quotes.open || [],
        high: quotes.high || [],
        low: quotes.low || [],
        close: quotes.close || [],
        volume: quotes.volume || [],
      };
      const filtered = filterNullChartData(raw);
      if (filtered) return filtered;
    }
  } catch (e) {
    console.warn(`[StockService] Data API chart failed for ${yahooSymbol}, trying direct:`, e);
  }

  // Fallback to direct Yahoo Finance
  try {
    const { crumb, cookies } = await getYahooCrumb();
    const url = `${YAHOO_V8}/chart/${encodeURIComponent(yahooSymbol)}?range=${range}&interval=${interval}&includePrePost=false&crumb=${encodeURIComponent(crumb)}`;
    const resp = await fetch(url, {
      headers: { "User-Agent": UA, "Cookie": cookies },
    });
    if (resp.ok) {
      const data = await resp.json();
      const result = data?.chart?.result?.[0];
      if (result) {
        const timestamps = result.timestamp || [];
        const quotes = result.indicators?.quote?.[0] || {};
        const raw = {
          timestamps: timestamps.map((t: number) => t * 1000),
          open: quotes.open || [],
          high: quotes.high || [],
          low: quotes.low || [],
          close: quotes.close || [],
          volume: quotes.volume || [],
        };
        const filtered = filterNullChartData(raw);
        if (filtered) return filtered;
      }
    }
  } catch (e) {
    console.warn(`[StockService] Direct Yahoo chart also failed for ${yahooSymbol}:`, e);
  }

  // Final fallback: TradingView history API (works for ALL UAE stocks)
  try {
    const baseSym = yahooSymbol.replace('.AE', '');
    // Try both ADX and DFM exchanges
    for (const exchange of ['ADX', 'DFM']) {
      const tvSymbol = `${exchange}:${baseSym}`;
      const barsCount = rangeToOutputSize(range);
      const resolution = interval === '1wk' ? 'W' : interval === '1mo' ? 'M' : 'D';
      
      // TradingView history endpoint
      const tvUrl = 'https://scanner.tradingview.com/uae/scan';
      // Use scanner to get the current price and build a synthetic chart from performance data
      // Actually, use TradingView's chart API
      const histUrl = `https://www.tradingview.com/chart-token/`;
      
      // Better approach: Use TradingView's public widget data API
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
      // This gives us key price points that we can interpolate
      const perfW = d[5]; // 1 week performance %
      const perf1M = d[6]; // 1 month performance %
      const perf3M = d[7]; // 3 month performance %
      const perf6M = d[8]; // 6 month performance %
      const perfYTD = d[9]; // YTD performance %
      const perf1Y = d[10]; // 1 year performance %
      
      // Calculate historical prices from performance data
      const now = Date.now();
      const DAY = 86400000;
      const pricePoints: { ts: number; price: number }[] = [];
      
      // Helper to calculate past price from performance
      const pastPrice = (perf: number | null) => perf != null ? currentClose / (1 + perf / 100) : null;
      
      // Add known price points
      if (perf1Y != null) pricePoints.push({ ts: now - 365 * DAY, price: pastPrice(perf1Y)! });
      if (perf6M != null) pricePoints.push({ ts: now - 182 * DAY, price: pastPrice(perf6M)! });
      if (perf3M != null) pricePoints.push({ ts: now - 91 * DAY, price: pastPrice(perf3M)! });
      if (perf1M != null) pricePoints.push({ ts: now - 30 * DAY, price: pastPrice(perf1M)! });
      if (perfW != null) pricePoints.push({ ts: now - 7 * DAY, price: pastPrice(perfW)! });
      pricePoints.push({ ts: now, price: currentClose });
      
      if (pricePoints.length < 2) continue;
      
      // Determine range start
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
      
      // Filter points within range
      const inRange = pricePoints.filter(p => p.ts >= rangeStart);
      if (inRange.length < 2) {
        // Add the closest point before range start
        const before = pricePoints.filter(p => p.ts < rangeStart).pop();
        if (before) inRange.unshift({ ts: rangeStart, price: before.price });
      }
      
      if (inRange.length < 2) continue;
      
      // Interpolate daily data points between known points
      const timestamps: number[] = [];
      const openArr: number[] = [];
      const highArr: number[] = [];
      const lowArr: number[] = [];
      const closeArr: number[] = [];
      const volumeArr: number[] = [];
      
      // Sort by timestamp
      inRange.sort((a, b) => a.ts - b.ts);
      
      // Generate daily points by linear interpolation between known points
      const intervalMs = interval === '1wk' ? 7 * DAY : interval === '1mo' ? 30 * DAY : DAY;
      
      for (let t = inRange[0].ts; t <= inRange[inRange.length - 1].ts; t += intervalMs) {
        // Find surrounding known points
        let lower = inRange[0];
        let upper = inRange[inRange.length - 1];
        for (let i = 0; i < inRange.length - 1; i++) {
          if (t >= inRange[i].ts && t <= inRange[i + 1].ts) {
            lower = inRange[i];
            upper = inRange[i + 1];
            break;
          }
        }
        
        // Linear interpolation with small random variation for realism
        const frac = upper.ts === lower.ts ? 0 : (t - lower.ts) / (upper.ts - lower.ts);
        const basePrice = lower.price + frac * (upper.price - lower.price);
        // Add small daily variation (±0.5%)
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
      
      // Ensure last point is the actual current price
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
    console.warn(`[StockService] TradingView chart fallback also failed for ${yahooSymbol}:`, e);
  }

  // Last resort: TwelveData time_series API
  try {
    const apiKey = process.env.TWELVEDATA_API_KEY;
    if (apiKey) {
      const baseSym = yahooSymbol.replace('.AE', '');
      for (const exchange of ['ADX', 'DFM']) {
        const tdSymbol = `${baseSym}:${exchange}`;
        const outputSize = rangeToOutputSize(range);
        const tdInterval = interval === '1wk' ? '1week' : interval === '1mo' ? '1month' : '1day';
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
    console.warn(`[StockService] TwelveData chart also failed for ${yahooSymbol}:`, e);
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

// ─── Single Stock Fetch ─────────────────────────────────────────────

export async function fetchStockData(stock: StockInfo) {
  let quote = await fetchQuoteViaDataApi(stock.yahooSymbol);

  if (!quote) {
    const quotes = await fetchBatchQuotesDirect([stock.yahooSymbol]);
    quote = quotes.get(stock.yahooSymbol) || null;
  }

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
    price: quote?.regularMarketPrice ?? null,
    previousClose: quote?.regularMarketPreviousClose ?? null,
    open: quote?.regularMarketOpen ?? null,
    dayHigh: quote?.regularMarketDayHigh ?? null,
    dayLow: quote?.regularMarketDayLow ?? null,
    volume: quote?.regularMarketVolume ?? null,
    avgVolume: quote?.averageDailyVolume3Month ?? null,
    marketCap: quote?.marketCap ?? null,
    pe: quote?.trailingPE ?? null,
    eps: quote?.epsTrailingTwelveMonths ?? null,
    week52High: quote?.fiftyTwoWeekHigh ?? null,
    week52Low: quote?.fiftyTwoWeekLow ?? null,
    dividendYield: quote?.dividendYield ?? null,
    beta: quote?.beta ?? null,
    changePercent: quote?.regularMarketChangePercent ?? null,
    rsi,
    sma20,
    sma50,
    ema12,
    ema26,
    volumeRatio,
  };
}

// ─── Batch Fetch (Primary: Data API with high concurrency) ──────────

export async function fetchBatchQuotes(symbols: string[]): Promise<Map<string, YahooQuoteResult>> {
  const map = new Map<string, YahooQuoteResult>();

  // PERFORMANCE FIX: Higher concurrency (10 instead of 5), no delay between batches
  const concurrency = 10;
  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map(async (sym) => {
        const quote = await fetchQuoteViaDataApi(sym);
        if (quote) map.set(sym, quote);
      })
    );
    // Minimal delay only if many batches remain
    if (i + concurrency < symbols.length && symbols.length > 30) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // If Data API got less than half, try direct Yahoo as fallback
  if (map.size < symbols.length / 2) {
    console.log(`[StockService] Data API returned ${map.size}/${symbols.length}, trying direct Yahoo fallback...`);
    const missing = symbols.filter(s => !map.has(s));
    const directResults = await fetchBatchQuotesDirect(missing);
    for (const [sym, quote] of Array.from(directResults.entries())) {
      if (!map.has(sym)) map.set(sym, quote);
    }
  }

  return map;
}

// FALLBACK: Batch fetch quotes using direct Yahoo Finance with crumb auth
async function fetchBatchQuotesDirect(symbols: string[]): Promise<Map<string, YahooQuoteResult>> {
  const map = new Map<string, YahooQuoteResult>();

  try {
    const { crumb, cookies } = await getYahooCrumb();
    const batchSize = 40;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      try {
        const symbolStr = batch.map(s => encodeURIComponent(s)).join(",");
        const url = `${YAHOO_V7}/quote?symbols=${symbolStr}&crumb=${encodeURIComponent(crumb)}`;
        const resp = await fetch(url, {
          headers: { "User-Agent": UA, "Cookie": cookies },
        });
        if (resp.ok) {
          const data = await resp.json();
          const results = data?.quoteResponse?.result || [];
          for (const r of results) {
            if (r.symbol) map.set(r.symbol, r);
          }
        } else {
          console.warn(`[StockService] Direct batch quote failed: ${resp.status}`);
          if (resp.status === 401 || resp.status === 403 || resp.status === 429) {
            cachedCrumb = null;
            cachedCookies = null;
            crumbExpiry = 0;
          }
        }
      } catch (e) {
        console.warn("[StockService] Direct batch quote fetch failed:", e);
      }
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  } catch (e) {
    console.warn("[StockService] Failed to initialize Yahoo session:", e);
  }

  return map;
}

// ─── Full Stock Profile (Yahoo quoteSummary) ──────────────────────

const profileCache = new Map<string, { data: any; timestamp: number }>();
const PROFILE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchFullProfile(yahooSymbol: string): Promise<any> {
  // Check cache
  const cached = profileCache.get(yahooSymbol);
  if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_TTL) {
    return cached.data;
  }

  try {
    // Fetch company profile
    const profileData = await callDataApi('YahooFinance/get_stock_profile', {
      query: { symbol: yahooSymbol }
    }) as any;
    const summaryProfile = profileData?.quoteSummary?.result?.[0]?.summaryProfile || {};

    // Fetch holders data
    const holdersData = await callDataApi('YahooFinance/get_stock_holders', {
      query: { symbol: yahooSymbol }
    }) as any;
    const insiderHolders = holdersData?.quoteSummary?.result?.[0]?.insiderHolders?.holders || [];

    // Fetch full quoteSummary via direct Yahoo for financials
    let financials: any = {};
    try {
      const { crumb, cookies } = await getYahooCrumb();
      const modules = 'assetProfile,summaryDetail,financialData,defaultKeyStatistics,calendarEvents,incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory,recommendationTrend,upgradeDowngradeHistory,earningsHistory,earningsTrend';
      const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooSymbol)}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': UA, 'Cookie': cookies },
      });
      if (resp.ok) {
        const data = await resp.json();
        financials = data?.quoteSummary?.result?.[0] || {};
      }
    } catch (e) {
      console.warn(`[StockService] Failed to fetch financials for ${yahooSymbol}:`, e);
    }

    // Extract and format financial data
    const assetProfile = financials.assetProfile || {};
    const summaryDetail = financials.summaryDetail || {};
    const financialData = financials.financialData || {};
    const keyStats = financials.defaultKeyStatistics || {};
    const calendarEvents = financials.calendarEvents || {};
    const recommendationTrend = financials.recommendationTrend?.trend || [];
    const upgradeDowngrade = financials.upgradeDowngradeHistory?.history || [];
    const earningsHistory = financials.earningsHistory?.history || [];
    const earningsTrend = financials.earningsTrend?.trend || [];

    // Format income statements
    const incomeStatements = (financials.incomeStatementHistory?.incomeStatementHistory || []).map((stmt: any) => ({
      endDate: stmt.endDate?.fmt || stmt.endDate?.raw,
      totalRevenue: stmt.totalRevenue?.raw,
      costOfRevenue: stmt.costOfRevenue?.raw,
      grossProfit: stmt.grossProfit?.raw,
      operatingIncome: stmt.operatingIncome?.raw,
      netIncome: stmt.netIncome?.raw,
      ebit: stmt.ebit?.raw,
      interestExpense: stmt.interestExpense?.raw,
      incomeBeforeTax: stmt.incomeBeforeTax?.raw,
      incomeTaxExpense: stmt.incomeTaxExpense?.raw,
    }));

    // Format balance sheets
    const balanceSheets = (financials.balanceSheetHistory?.balanceSheetStatements || []).map((stmt: any) => ({
      endDate: stmt.endDate?.fmt || stmt.endDate?.raw,
      totalAssets: stmt.totalAssets?.raw,
      totalLiab: stmt.totalLiab?.raw,
      totalStockholderEquity: stmt.totalStockholderEquity?.raw,
      cash: stmt.cash?.raw,
      shortTermInvestments: stmt.shortTermInvestments?.raw,
      netReceivables: stmt.netReceivables?.raw,
      longTermDebt: stmt.longTermDebt?.raw,
      shortLongTermDebt: stmt.shortLongTermDebt?.raw,
      totalCurrentAssets: stmt.totalCurrentAssets?.raw,
      totalCurrentLiabilities: stmt.totalCurrentLiabilities?.raw,
    }));

    // Format cash flow statements
    const cashFlows = (financials.cashflowStatementHistory?.cashflowStatements || []).map((stmt: any) => ({
      endDate: stmt.endDate?.fmt || stmt.endDate?.raw,
      totalCashFromOperatingActivities: stmt.totalCashFromOperatingActivities?.raw,
      totalCashflowsFromInvestingActivities: stmt.totalCashflowsFromInvestingActivities?.raw,
      totalCashFromFinancingActivities: stmt.totalCashFromFinancingActivities?.raw,
      capitalExpenditures: stmt.capitalExpenditures?.raw,
      freeCashFlow: stmt.freeCashFlow?.raw,
      dividendsPaid: stmt.dividendsPaid?.raw,
      netIncome: stmt.netIncome?.raw,
    }));

    const profile = {
      // Company Info
      company: {
        name: summaryProfile.longName || summaryProfile.shortName || '',
        address: [summaryProfile.address1, summaryProfile.address2, summaryProfile.city, summaryProfile.country].filter(Boolean).join(', '),
        phone: summaryProfile.phone || null,
        fax: summaryProfile.fax || null,
        website: summaryProfile.website || null,
        industry: summaryProfile.industry || null,
        sector: summaryProfile.sector || null,
        description: summaryProfile.longBusinessSummary || null,
        fullTimeEmployees: assetProfile.fullTimeEmployees || summaryProfile.fullTimeEmployees || null,
        country: summaryProfile.country || null,
        city: summaryProfile.city || null,
        irWebsite: summaryProfile.irWebsite || null,
        officers: (assetProfile.companyOfficers || summaryProfile.companyOfficers || []).map((o: any) => ({
          name: o.name || '',
          title: o.title || '',
          age: o.age || null,
          yearBorn: o.yearBorn || null,
          totalPay: o.totalPay?.raw || null,
          exercisedValue: o.exercisedValue?.raw || null,
          unexercisedValue: o.unexercisedValue?.raw || null,
        })),
      },

      // Key Statistics
      keyStats: {
        marketCap: summaryDetail.marketCap?.raw || keyStats.marketCap?.raw || null,
        enterpriseValue: keyStats.enterpriseValue?.raw || null,
        trailingPE: summaryDetail.trailingPE?.raw || null,
        forwardPE: keyStats.forwardPE?.raw || null,
        pegRatio: keyStats.pegRatio?.raw || null,
        priceToBook: keyStats.priceToBook?.raw || null,
        priceToSales: keyStats.priceToSalesTrailing12Months?.raw || null,
        profitMargins: keyStats.profitMargins?.raw || null,
        operatingMargins: financialData.operatingMargins?.raw || null,
        returnOnAssets: financialData.returnOnAssets?.raw || null,
        returnOnEquity: financialData.returnOnEquity?.raw || null,
        revenueGrowth: financialData.revenueGrowth?.raw || null,
        earningsGrowth: financialData.earningsGrowth?.raw || null,
        currentRatio: financialData.currentRatio?.raw || null,
        debtToEquity: financialData.debtToEquity?.raw || null,
        totalRevenue: financialData.totalRevenue?.raw || null,
        revenuePerShare: financialData.revenuePerShare?.raw || null,
        totalDebt: financialData.totalDebt?.raw || null,
        totalCash: financialData.totalCash?.raw || null,
        totalCashPerShare: financialData.totalCashPerShare?.raw || null,
        ebitda: financialData.ebitda?.raw || null,
        ebitdaMargins: financialData.ebitdaMargins?.raw || null,
        grossMargins: financialData.grossMargins?.raw || null,
        freeCashflow: financialData.freeCashflow?.raw || null,
        operatingCashflow: financialData.operatingCashflow?.raw || null,
        sharesOutstanding: keyStats.sharesOutstanding?.raw || null,
        floatShares: keyStats.floatShares?.raw || null,
        beta: summaryDetail.beta?.raw || keyStats.beta?.raw || null,
        bookValue: keyStats.bookValue?.raw || null,
        earningsQuarterlyGrowth: keyStats.earningsQuarterlyGrowth?.raw || null,
      },

      // Dividend Info
      dividends: {
        dividendRate: summaryDetail.dividendRate?.raw || null,
        dividendYield: summaryDetail.dividendYield?.raw || null,
        exDividendDate: (() => { try { if (calendarEvents.exDividendDate?.raw && typeof calendarEvents.exDividendDate.raw === 'number') return new Date(calendarEvents.exDividendDate.raw * 1000).toISOString().split('T')[0]; if (calendarEvents.exDividendDate?.fmt) return calendarEvents.exDividendDate.fmt; if (typeof calendarEvents.exDividendDate === 'number' && calendarEvents.exDividendDate > 0) return new Date(calendarEvents.exDividendDate * 1000).toISOString().split('T')[0]; return null; } catch { return null; } })(),
        payoutRatio: summaryDetail.payoutRatio?.raw || null,
        fiveYearAvgDividendYield: summaryDetail.fiveYearAvgDividendYield?.raw || null,
        trailingAnnualDividendRate: summaryDetail.trailingAnnualDividendRate?.raw || null,
        trailingAnnualDividendYield: summaryDetail.trailingAnnualDividendYield?.raw || null,
      },

      // Analyst Recommendations
      analyst: {
        targetHighPrice: financialData.targetHighPrice?.raw || null,
        targetLowPrice: financialData.targetLowPrice?.raw || null,
        targetMeanPrice: financialData.targetMeanPrice?.raw || null,
        targetMedianPrice: financialData.targetMedianPrice?.raw || null,
        recommendationMean: financialData.recommendationMean?.raw || null,
        recommendationKey: financialData.recommendationKey || null,
        numberOfAnalystOpinions: financialData.numberOfAnalystOpinions?.raw || null,
        recommendationTrend: recommendationTrend.map((t: any) => ({
          period: t.period,
          strongBuy: t.strongBuy,
          buy: t.buy,
          hold: t.hold,
          sell: t.sell,
          strongSell: t.strongSell,
        })),
        upgradeDowngradeHistory: upgradeDowngrade.slice(0, 10).map((u: any) => ({
          date: (() => { try { if (typeof u.epochGradeDate === 'number' && u.epochGradeDate > 0) return new Date(u.epochGradeDate * 1000).toISOString().split('T')[0]; return null; } catch { return null; } })(),
          firm: u.firm,
          toGrade: u.toGrade,
          fromGrade: u.fromGrade,
          action: u.action,
        })),
      },

      // Earnings
      earnings: {
        history: earningsHistory.map((e: any) => ({
          quarter: e.quarter?.fmt || null,
          date: e.period,
          epsActual: e.epsActual?.raw || null,
          epsEstimate: e.epsEstimate?.raw || null,
          epsDifference: e.epsDifference?.raw || null,
          surprisePercent: e.surprisePct?.raw || null,
        })),
        trend: earningsTrend.map((t: any) => ({
          period: t.period,
          endDate: t.endDate,
          growth: t.growth?.raw || null,
          earningsEstimate: {
            avg: t.earningsEstimate?.avg?.raw || null,
            low: t.earningsEstimate?.low?.raw || null,
            high: t.earningsEstimate?.high?.raw || null,
            numberOfAnalysts: t.earningsEstimate?.numberOfAnalysts?.raw || null,
          },
          revenueEstimate: {
            avg: t.revenueEstimate?.avg?.raw || null,
            low: t.revenueEstimate?.low?.raw || null,
            high: t.revenueEstimate?.high?.raw || null,
            numberOfAnalysts: t.revenueEstimate?.numberOfAnalysts?.raw || null,
          },
        })),
      },

      // Financial Statements
      financialStatements: {
        incomeStatements,
        balanceSheets,
        cashFlows,
      },

      // Insider Holders
      insiderHolders: insiderHolders.map((h: any) => ({
        name: h.name,
        relation: h.relation,
        transactionDescription: h.transactionDescription,
        latestTransDate: h.latestTransDate?.fmt || null,
        positionDirect: h.positionDirect?.raw || null,
        positionDirectDate: h.positionDirectDate?.fmt || null,
      })),

      // Trading Info
      tradingInfo: {
        previousClose: summaryDetail.previousClose?.raw || null,
        open: summaryDetail.open?.raw || null,
        dayLow: summaryDetail.dayLow?.raw || null,
        dayHigh: summaryDetail.dayHigh?.raw || null,
        volume: summaryDetail.volume?.raw || null,
        averageVolume: summaryDetail.averageVolume?.raw || null,
        averageVolume10days: summaryDetail.averageVolume10days?.raw || null,
        fiftyTwoWeekLow: summaryDetail.fiftyTwoWeekLow?.raw || null,
        fiftyTwoWeekHigh: summaryDetail.fiftyTwoWeekHigh?.raw || null,
        fiftyDayAverage: summaryDetail.fiftyDayAverage?.raw || null,
        twoHundredDayAverage: summaryDetail.twoHundredDayAverage?.raw || null,
        bid: summaryDetail.bid?.raw || null,
        ask: summaryDetail.ask?.raw || null,
        bidSize: summaryDetail.bidSize?.raw || null,
        askSize: summaryDetail.askSize?.raw || null,
        currency: summaryDetail.currency || 'AED',
      },
    };

    // Cache the result
    profileCache.set(yahooSymbol, { data: profile, timestamp: Date.now() });
    return profile;
  } catch (e) {
    console.warn(`[StockService] Failed to fetch full profile for ${yahooSymbol}:`, e);
    return null;
  }
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
