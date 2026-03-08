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

// Fetch chart data using the built-in Data API (primary) or direct Yahoo (fallback)
export async function fetchYahooChart(yahooSymbol: string, range = "3mo", interval = "1d"): Promise<any> {
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
      return {
        timestamps: timestamps.map((t: number) => t * 1000),
        open: quotes.open || [],
        high: quotes.high || [],
        low: quotes.low || [],
        close: quotes.close || [],
        volume: quotes.volume || [],
      };
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
    if (!resp.ok) return null;
    const data = await resp.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    return {
      timestamps: timestamps.map((t: number) => t * 1000),
      open: quotes.open || [],
      high: quotes.high || [],
      low: quotes.low || [],
      close: quotes.close || [],
      volume: quotes.volume || [],
    };
  } catch (e) {
    console.warn(`[StockService] Direct chart also failed for ${yahooSymbol}:`, e);
    return null;
  }
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
