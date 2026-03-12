/**
 * StockAnalysis.com Web Scraping Service
 * 
 * Scrapes financial data from StockAnalysis.com for UAE stocks (ADX & DFM).
 * Data is extracted from the server-rendered SvelteKit pages which embed
 * structured data in JavaScript objects.
 * 
 * URL pattern: https://stockanalysis.com/quote/{exchange}/{symbol}/
 * Exchange codes: "dfm" for DFM, "adx" for ADX
 */

// ─── Types ─────────────────────────────────────────────────────────

export interface SAOverviewData {
  symbol: string;
  exchange: string;
  name: string;
  description: string;
  // Quote
  price: number | null;
  change: number | null;
  changePercent: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
  volume: number | null;
  previousClose: number | null;
  high52w: number | null;
  low52w: number | null;
  // Fundamentals
  marketCap: string | null;
  marketCapGrowth: number | null;
  revenue: string | null;
  revenueGrowth: number | null;
  netIncome: string | null;
  netIncomeGrowth: number | null;
  sharesOut: string | null;
  eps: string | null;
  epsGrowth: number | null;
  peRatio: string | null;
  forwardPE: string | null;
  // Dividend
  dividend: string | null;
  dividendYield: string | null;
  payoutRatio: string | null;
  payoutFrequency: string | null;
  exDividendDate: string | null;
  // Technical
  averageVolume: string | null;
  beta: string | null;
  rsi: string | null;
  earningsDate: string | null;
  // Company info
  industry: string | null;
  sector: string | null;
  founded: number | null;
  country: string | null;
  // Price changes
  priceChanges: {
    "1w": number | null;
    "1m": number | null;
    "3m": number | null;
    "6m": number | null;
    ytd: number | null;
    "1y": number | null;
    "5y": number | null;
  };
  // Financial chart data
  financialChart: Array<{
    year: string;
    revenue: number;
    earnings: number;
    revenueGrowth: number;
    earningsGrowth: number;
  }>;
  financialIntro: string | null;
  // News
  news: Array<{
    url: string;
    title: string;
    text: string;
    source: string;
    time: string;
  }>;
}

export interface SAFinancialsData {
  incomeStatement: any[];
  balanceSheet: any[];
  cashFlow: any[];
  ratios: any[];
}

// ─── Cache ─────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const overviewCache = new Map<string, CacheEntry<SAOverviewData>>();
const financialsCache = new Map<string, CacheEntry<SAFinancialsData>>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const REQUEST_DELAY = 500; // ms between requests to avoid rate limiting
let lastRequestTime = 0;

// ─── Stats ─────────────────────────────────────────────────────────

let stats = {
  totalRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  errors: 0,
  lastRequest: null as string | null,
  lastError: null as string | null,
};

// ─── Helpers ───────────────────────────────────────────────────────

function getExchangeCode(exchange: string): string {
  const ex = exchange.toUpperCase();
  if (ex === "DFM" || ex === "DUBAI") return "dfm";
  if (ex === "ADX" || ex === "ABU DHABI") return "adx";
  return ex.toLowerCase();
}

function buildUrl(symbol: string, exchange: string, page?: string): string {
  const ex = getExchangeCode(exchange);
  const base = `https://stockanalysis.com/quote/${ex}/${symbol.toUpperCase()}/`;
  return page ? `${base}${page}/` : base;
}

async function rateLimitedFetch(url: string): Promise<string> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < REQUEST_DELAY) {
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY - elapsed));
  }
  lastRequestTime = Date.now();

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.text();
}

/**
 * Parse the SvelteKit embedded data from the HTML page.
 * StockAnalysis uses SvelteKit SSR which embeds data in script tags.
 */
function parseJSValue(text: string): any {
  // Convert JS object notation to JSON-parseable format
  // Handle: void 0 -> null, unquoted keys, single quotes
  let json = text
    .replace(/void 0/g, "null")
    .replace(/undefined/g, "null")
    // Add quotes to unquoted keys
    .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
    // Handle trailing commas
    .replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function extractDataBlocks(html: string): any[] {
  const blocks: any[] = [];
  const pattern = /\{type:"data",\s*data:\s*/g;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    const startIdx = match.index + match[0].length;
    // Find the matching closing brace
    let depth = 0;
    let inString = false;
    let stringChar = "";
    let endIdx = startIdx;

    for (let i = startIdx; i < Math.min(startIdx + 50000, html.length); i++) {
      const ch = html[i];
      const prev = i > 0 ? html[i - 1] : "";

      if (inString) {
        if (ch === stringChar && prev !== "\\") {
          inString = false;
        }
        continue;
      }

      if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
        continue;
      }

      if (ch === "{" || ch === "[") depth++;
      if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }

    if (endIdx > startIdx) {
      const blockText = html.substring(startIdx, endIdx);
      const parsed = parseJSValue(blockText);
      if (parsed) {
        blocks.push(parsed);
      }
    }
  }

  return blocks;
}

function extractQuoteData(infoBlock: any): Partial<SAOverviewData> {
  const quote = infoBlock?.quote || {};
  return {
    symbol: infoBlock?.symbol || "",
    exchange: infoBlock?.exchange_code || "",
    name: infoBlock?.nameFull || infoBlock?.name || "",
    price: quote.p ?? quote.cl ?? null,
    change: quote.c ?? null,
    changePercent: quote.cp ?? null,
    high: quote.h ?? null,
    low: quote.l ?? null,
    open: quote.o ?? null,
    volume: quote.v ?? null,
    previousClose: quote.pd ?? null,
    high52w: quote.h52 ?? null,
    low52w: quote.l52 ?? null,
  };
}

function extractOverviewData(overviewBlock: any): Partial<SAOverviewData> {
  const infoTable = overviewBlock?.infoTable || [];
  const getInfo = (key: string) => infoTable.find((i: any) => i.t === key)?.v || null;

  return {
    marketCap: overviewBlock?.marketCap || null,
    marketCapGrowth: overviewBlock?.marketCapGrowth ?? null,
    revenue: overviewBlock?.revenue || null,
    revenueGrowth: overviewBlock?.revenueGrowth ?? null,
    netIncome: overviewBlock?.netIncome || null,
    netIncomeGrowth: overviewBlock?.netIncomeGrowth ?? null,
    sharesOut: overviewBlock?.sharesOut || null,
    eps: overviewBlock?.eps || null,
    epsGrowth: overviewBlock?.epsGrowth ?? null,
    peRatio: overviewBlock?.peRatio || null,
    forwardPE: overviewBlock?.forwardPE || null,
    dividend: overviewBlock?.dividend || null,
    dividendYield: overviewBlock?.dividendYield || null,
    payoutRatio: overviewBlock?.payoutRatio || null,
    payoutFrequency: overviewBlock?.payoutFrequency || null,
    exDividendDate: overviewBlock?.exDividendDate || null,
    averageVolume: overviewBlock?.averageVolume || null,
    beta: overviewBlock?.beta || null,
    rsi: overviewBlock?.rsi || null,
    earningsDate: overviewBlock?.earningsDate || null,
    description: overviewBlock?.description || null,
    industry: getInfo("Industry"),
    sector: getInfo("Sector"),
    founded: getInfo("Founded"),
    country: getInfo("Country") || "United Arab Emirates",
    priceChanges: {
      "1w": overviewBlock?.changes?.price1w ?? null,
      "1m": overviewBlock?.changes?.price1m ?? null,
      "3m": overviewBlock?.changes?.price3m ?? null,
      "6m": overviewBlock?.changes?.price6m ?? null,
      ytd: overviewBlock?.changes?.priceYTD ?? null,
      "1y": overviewBlock?.changes?.price1y ?? null,
      "5y": overviewBlock?.changes?.price5y ?? null,
    },
    financialChart: overviewBlock?.financialChart || [],
    financialIntro: overviewBlock?.financialIntro || null,
  };
}

function extractNewsData(html: string): SAOverviewData["news"] {
  // News is embedded in a separate data block
  const newsPattern = /\{url:"https?:\/\/[^"]+",img:"[^"]*",title:"[^"]+"/g;
  const newsItems: SAOverviewData["news"] = [];

  // Find the news array
  const newsIdx = html.indexOf('"news":[');
  if (newsIdx === -1) {
    // Try alternate format: news:[
    const altIdx = html.indexOf("news:[");
    if (altIdx === -1) return [];

    // Extract the news array
    let depth = 0;
    let start = html.indexOf("[", altIdx);
    let end = start;
    for (let i = start; i < Math.min(start + 30000, html.length); i++) {
      if (html[i] === "[") depth++;
      if (html[i] === "]") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }

    if (end > start) {
      const newsText = html.substring(start, end);
      const parsed = parseJSValue(newsText);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 10).map((n: any) => ({
          url: n.url || "",
          title: n.title || "",
          text: n.text || "",
          source: n.source || "",
          time: n.time || "",
        }));
      }
    }
  }

  return newsItems;
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Fetch overview data for a UAE stock from StockAnalysis.com
 */
export async function fetchSAOverview(
  symbol: string,
  exchange: string
): Promise<SAOverviewData | null> {
  const cacheKey = `${exchange.toUpperCase()}-${symbol.toUpperCase()}`;
  stats.totalRequests++;
  stats.lastRequest = cacheKey;

  // Check cache
  const cached = overviewCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    stats.cacheHits++;
    return cached.data;
  }
  stats.cacheMisses++;

  try {
    const url = buildUrl(symbol, exchange);
    console.log(`[StockAnalysis] Fetching overview: ${url}`);
    const html = await rateLimitedFetch(url);

    // Extract data blocks
    const blocks = extractDataBlocks(html);

    // Block 0: session info (skip)
    // Block 1: info (quote, symbol, exchange)
    // Block 2: overview (fundamentals, financials)
    // Block 3+: news, etc.

    let quoteData: Partial<SAOverviewData> = {};
    let overviewData: Partial<SAOverviewData> = {};

    for (const block of blocks) {
      if (block.info?.quote) {
        quoteData = extractQuoteData(block.info);
      }
      if (block.marketCap || block.eps || block.peRatio) {
        overviewData = extractOverviewData(block);
      }
    }

    const news = extractNewsData(html);

    const result: SAOverviewData = {
      symbol: (quoteData.symbol || symbol).toUpperCase(),
      exchange: (quoteData.exchange || exchange).toUpperCase(),
      name: quoteData.name || "",
      description: overviewData.description || "",
      price: quoteData.price ?? null,
      change: quoteData.change ?? null,
      changePercent: quoteData.changePercent ?? null,
      high: quoteData.high ?? null,
      low: quoteData.low ?? null,
      open: quoteData.open ?? null,
      volume: quoteData.volume ?? null,
      previousClose: quoteData.previousClose ?? null,
      high52w: quoteData.high52w ?? null,
      low52w: quoteData.low52w ?? null,
      marketCap: overviewData.marketCap ?? null,
      marketCapGrowth: overviewData.marketCapGrowth ?? null,
      revenue: overviewData.revenue ?? null,
      revenueGrowth: overviewData.revenueGrowth ?? null,
      netIncome: overviewData.netIncome ?? null,
      netIncomeGrowth: overviewData.netIncomeGrowth ?? null,
      sharesOut: overviewData.sharesOut ?? null,
      eps: overviewData.eps ?? null,
      epsGrowth: overviewData.epsGrowth ?? null,
      peRatio: overviewData.peRatio ?? null,
      forwardPE: overviewData.forwardPE ?? null,
      dividend: overviewData.dividend ?? null,
      dividendYield: overviewData.dividendYield ?? null,
      payoutRatio: overviewData.payoutRatio ?? null,
      payoutFrequency: overviewData.payoutFrequency ?? null,
      exDividendDate: overviewData.exDividendDate ?? null,
      averageVolume: overviewData.averageVolume ?? null,
      beta: overviewData.beta ?? null,
      rsi: overviewData.rsi ?? null,
      earningsDate: overviewData.earningsDate ?? null,
      industry: overviewData.industry ?? null,
      sector: overviewData.sector ?? null,
      founded: overviewData.founded ?? null,
      country: overviewData.country ?? "United Arab Emirates",
      priceChanges: overviewData.priceChanges || {
        "1w": null, "1m": null, "3m": null, "6m": null,
        ytd: null, "1y": null, "5y": null,
      },
      financialChart: overviewData.financialChart || [],
      financialIntro: overviewData.financialIntro ?? null,
      news,
    };

    // Cache the result
    overviewCache.set(cacheKey, { data: result, timestamp: Date.now() });
    console.log(`[StockAnalysis] Successfully scraped ${cacheKey}: ${result.name}, price=${result.price}`);
    return result;
  } catch (err: any) {
    stats.errors++;
    stats.lastError = `${cacheKey}: ${err.message}`;
    console.error(`[StockAnalysis] Error fetching ${cacheKey}:`, err.message);
    return null;
  }
}

/**
 * Fetch financials page data for a UAE stock
 */
export async function fetchSAFinancials(
  symbol: string,
  exchange: string
): Promise<SAFinancialsData | null> {
  const cacheKey = `${exchange.toUpperCase()}-${symbol.toUpperCase()}-financials`;
  stats.totalRequests++;

  const cached = financialsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    stats.cacheHits++;
    return cached.data;
  }
  stats.cacheMisses++;

  try {
    const url = buildUrl(symbol, exchange, "financials");
    console.log(`[StockAnalysis] Fetching financials: ${url}`);
    const html = await rateLimitedFetch(url);

    const blocks = extractDataBlocks(html);

    // Find the financials data block
    let financialsData: SAFinancialsData = {
      incomeStatement: [],
      balanceSheet: [],
      cashFlow: [],
      ratios: [],
    };

    for (const block of blocks) {
      if (block.data && Array.isArray(block.data)) {
        // This is likely the financials table data
        financialsData.incomeStatement = block.data;
      }
      if (block.incomeStatement) financialsData.incomeStatement = block.incomeStatement;
      if (block.balanceSheet) financialsData.balanceSheet = block.balanceSheet;
      if (block.cashFlow) financialsData.cashFlow = block.cashFlow;
      if (block.ratios) financialsData.ratios = block.ratios;
    }

    financialsCache.set(cacheKey, { data: financialsData, timestamp: Date.now() });
    return financialsData;
  } catch (err: any) {
    stats.errors++;
    stats.lastError = `${cacheKey}: ${err.message}`;
    console.error(`[StockAnalysis] Error fetching financials for ${cacheKey}:`, err.message);
    return null;
  }
}

/**
 * Get service statistics
 */
export function getSAStats() {
  return {
    ...stats,
    cacheSize: overviewCache.size + financialsCache.size,
    cacheTTL: CACHE_TTL / 1000,
  };
}

/**
 * Clear all caches
 */
export function clearSACache() {
  overviewCache.clear();
  financialsCache.clear();
  return { cleared: true };
}
