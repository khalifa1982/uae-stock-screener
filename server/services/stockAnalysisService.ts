/**
 * StockAnalysis.com Web Scraping Service (v2 - Scrapfly-powered)
 * 
 * Scrapes comprehensive financial data from StockAnalysis.com for UAE stocks.
 * Uses Scrapfly.io for anti-bot bypass and proxy rotation.
 * 
 * Pages scraped:
 * - Overview: /quote/{exchange}/{symbol}/
 * - Income Statement: /quote/{exchange}/{symbol}/financials/
 * - Balance Sheet: /quote/{exchange}/{symbol}/financials/balance-sheet/
 * - Cash Flow: /quote/{exchange}/{symbol}/financials/cash-flow-statement/
 * - Ratios: /quote/{exchange}/{symbol}/financials/ratios/
 * - Dividends: /quote/{exchange}/{symbol}/dividend/
 */

import { scrapflyFetch } from "./scrapflyService";

// ─── Types ─────────────────────────────────────────────────────────

export interface SAOverviewData {
  symbol: string;
  exchange: string;
  name: string;
  description: string;
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
  dividend: string | null;
  dividendYield: string | null;
  payoutRatio: string | null;
  payoutFrequency: string | null;
  exDividendDate: string | null;
  averageVolume: string | null;
  beta: string | null;
  rsi: string | null;
  earningsDate: string | null;
  industry: string | null;
  sector: string | null;
  founded: number | null;
  country: string | null;
  priceChanges: {
    "1w": number | null;
    "1m": number | null;
    "3m": number | null;
    "6m": number | null;
    ytd: number | null;
    "1y": number | null;
    "5y": number | null;
  };
  financialChart: Array<{
    year: string;
    revenue: number;
    earnings: number;
    revenueGrowth: number;
    earningsGrowth: number;
  }>;
  financialIntro: string | null;
  news: Array<{
    url: string;
    title: string;
    text: string;
    source: string;
    time: string;
  }>;
}

export interface SAFinancialsData {
  incomeStatement: Record<string, (number | null)[]>;
  balanceSheet: Record<string, (number | null)[]>;
  cashFlow: Record<string, (number | null)[]>;
  ratios: Record<string, (number | null)[]>;
  periods: {
    incomeStatement: string[];
    balanceSheet: string[];
    cashFlow: string[];
    ratios: string[];
  };
}

export interface SADividendData {
  history: Array<{
    exDate: string | null;
    payDate: string | null;
    amount: number | null;
    type: string | null;
    frequency: string | null;
  }>;
  annualYields: Array<{
    year: string;
    dividend: number | null;
    yield: number | null;
    growth: number | null;
    payoutRatio: number | null;
  }>;
  currentYield: number | null;
  annualDividend: number | null;
  payoutRatio: number | null;
  dividendGrowth5Y: number | null;
}

// ─── Cache ─────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const overviewCache = new Map<string, CacheEntry<SAOverviewData>>();
const financialsCache = new Map<string, CacheEntry<SAFinancialsData>>();
const dividendCache = new Map<string, CacheEntry<SADividendData>>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

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

/**
 * Parse JS object notation to JSON-parseable format.
 * StockAnalysis uses SvelteKit SSR which embeds data in JS objects.
 */
function parseJSValue(text: string): any {
  let json = text
    .replace(/void 0/g, "null")
    .replace(/undefined/g, "null")
    .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
    .replace(/,\s*([}\]])/g, "$1");
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Extract the financial data block from the HTML page.
 * Finds the data:{statement:"...",...,financialData:{...}} block.
 */
function extractFinancialBlock(html: string, statementType: string): any {
  const marker = `data:{statement:"${statementType}"`;
  const idx = html.indexOf(marker);
  if (idx === -1) return null;

  const dataStart = idx + 5; // skip 'data:'
  let depth = 0;
  let inString = false;
  let stringChar = "";
  let end = dataStart;

  for (let i = dataStart; i < Math.min(dataStart + 200000, html.length); i++) {
    const ch = html[i];
    const prev = i > 0 ? html[i - 1] : "";
    if (inString) {
      if (ch === stringChar && prev !== "\\") inString = false;
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
        end = i + 1;
        break;
      }
    }
  }

  if (end <= dataStart) return null;
  const blockText = html.substring(dataStart, end);
  return parseJSValue(blockText);
}

/**
 * Extract all data blocks from the HTML (SvelteKit format)
 */
function extractDataBlocks(html: string): any[] {
  const blocks: any[] = [];
  const pattern = /\{type:"data",\s*data:\s*/g;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    const startIdx = match.index + match[0].length;
    let depth = 0;
    let inString = false;
    let stringChar = "";
    let endIdx = startIdx;

    for (let i = startIdx; i < Math.min(startIdx + 100000, html.length); i++) {
      const ch = html[i];
      const prev = i > 0 ? html[i - 1] : "";
      if (inString) {
        if (ch === stringChar && prev !== "\\") inString = false;
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
      const parsed = parseJSValue(html.substring(startIdx, endIdx));
      if (parsed) blocks.push(parsed);
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
  const altIdx = html.indexOf("news:[");
  if (altIdx === -1) return [];

  let depth = 0;
  const start = html.indexOf("[", altIdx);
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

  return [];
}

/**
 * Extract financial data from a parsed block.
 * The financialData object contains arrays keyed by field name.
 */
function extractFinancialData(block: any): {
  periods: string[];
  data: Record<string, (number | null)[]>;
} {
  const fd = block?.financialData;
  if (!fd) return { periods: [], data: {} };

  const periods = fd.datekey || fd.fiscalYear || [];
  const data: Record<string, (number | null)[]> = {};

  // Skip metadata fields
  const skipFields = new Set([
    "datekey", "fiscalYear", "fiscalQuarter", "map",
    "availableSources", "params", "cookies", "dark",
    "hideNewsSources", "md",
  ]);

  for (const [key, value] of Object.entries(fd)) {
    if (skipFields.has(key)) continue;
    if (Array.isArray(value)) {
      data[key] = value.map((v: any) => (typeof v === "number" ? v : null));
    }
  }

  return { periods, data };
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

  const cached = overviewCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    stats.cacheHits++;
    return cached.data;
  }
  stats.cacheMisses++;

  try {
    const url = buildUrl(symbol, exchange);
    console.log(`[StockAnalysis] Fetching overview: ${url}`);
    const result = await scrapflyFetch(url, { asp: true, cache: true, cacheTtl: 1800 });
    const html = result.content;

    const blocks = extractDataBlocks(html);

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

    const data: SAOverviewData = {
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

    overviewCache.set(cacheKey, { data, timestamp: Date.now() });
    console.log(`[StockAnalysis] Scraped overview ${cacheKey}: ${data.name}, price=${data.price}`);
    return data;
  } catch (err: any) {
    stats.errors++;
    stats.lastError = `${cacheKey}: ${err.message}`;
    console.error(`[StockAnalysis] Error fetching overview ${cacheKey}:`, err.message);
    return null;
  }
}

/**
 * Fetch comprehensive financial statements for a UAE stock.
 * Scrapes 4 pages: Income Statement, Balance Sheet, Cash Flow, Ratios.
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
    // Fetch all 4 financial pages
    const pages = [
      { page: "financials", type: "income-statement" },
      { page: "financials/balance-sheet", type: "balance-sheet" },
      { page: "financials/cash-flow-statement", type: "cash-flow-statement" },
      { page: "financials/ratios", type: "ratios" },
    ];

    const result: SAFinancialsData = {
      incomeStatement: {},
      balanceSheet: {},
      cashFlow: {},
      ratios: {},
      periods: {
        incomeStatement: [],
        balanceSheet: [],
        cashFlow: [],
        ratios: [],
      },
    };

    for (const { page, type } of pages) {
      try {
        const url = buildUrl(symbol, exchange, page);
        console.log(`[StockAnalysis] Fetching ${type}: ${url}`);
        const fetchResult = await scrapflyFetch(url, { asp: true, cache: true, cacheTtl: 3600 });
        const html = fetchResult.content;

        const block = extractFinancialBlock(html, type);
        if (block) {
          const { periods, data } = extractFinancialData(block);

          switch (type) {
            case "income-statement":
              result.incomeStatement = data;
              result.periods.incomeStatement = periods;
              break;
            case "balance-sheet":
              result.balanceSheet = data;
              result.periods.balanceSheet = periods;
              break;
            case "cash-flow-statement":
              result.cashFlow = data;
              result.periods.cashFlow = periods;
              break;
            case "ratios":
              result.ratios = data;
              result.periods.ratios = periods;
              break;
          }
        }
      } catch (pageErr: any) {
        console.warn(`[StockAnalysis] Failed to fetch ${type} for ${symbol}: ${pageErr.message}`);
        // Continue with other pages
      }
    }

    financialsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    console.log(
      `[StockAnalysis] Scraped financials ${cacheKey}: IS=${Object.keys(result.incomeStatement).length} fields, BS=${Object.keys(result.balanceSheet).length} fields, CF=${Object.keys(result.cashFlow).length} fields, R=${Object.keys(result.ratios).length} fields`
    );
    return result;
  } catch (err: any) {
    stats.errors++;
    stats.lastError = `${cacheKey}: ${err.message}`;
    console.error(`[StockAnalysis] Error fetching financials ${cacheKey}:`, err.message);
    return null;
  }
}

/**
 * Fetch dividend data for a UAE stock
 */
export async function fetchSADividends(
  symbol: string,
  exchange: string
): Promise<SADividendData | null> {
  const cacheKey = `${exchange.toUpperCase()}-${symbol.toUpperCase()}-dividends`;
  stats.totalRequests++;

  const cached = dividendCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    stats.cacheHits++;
    return cached.data;
  }
  stats.cacheMisses++;

  try {
    const url = buildUrl(symbol, exchange, "dividend");
    console.log(`[StockAnalysis] Fetching dividends: ${url}`);
    const fetchResult = await scrapflyFetch(url, { asp: true, cache: true, cacheTtl: 3600 });
    const html = fetchResult.content;

    const blocks = extractDataBlocks(html);

    const result: SADividendData = {
      history: [],
      annualYields: [],
      currentYield: null,
      annualDividend: null,
      payoutRatio: null,
      dividendGrowth5Y: null,
    };

    for (const block of blocks) {
      // Look for dividend history data
      if (block.dividendHistory && Array.isArray(block.dividendHistory)) {
        result.history = block.dividendHistory.map((d: any) => ({
          exDate: d.exDate || d.ex_date || null,
          payDate: d.payDate || d.pay_date || null,
          amount: d.amount ?? d.dividend ?? null,
          type: d.type || "Cash",
          frequency: d.frequency || null,
        }));
      }

      // Look for annual yield data
      if (block.annualData && Array.isArray(block.annualData)) {
        result.annualYields = block.annualData.map((d: any) => ({
          year: d.year || d.fiscalYear || "",
          dividend: d.dividend ?? d.dps ?? null,
          yield: d.yield ?? d.dividendYield ?? null,
          growth: d.growth ?? d.dividendGrowth ?? null,
          payoutRatio: d.payoutRatio ?? null,
        }));
      }

      // Overview-level dividend stats
      if (block.dividendYield !== undefined) result.currentYield = block.dividendYield;
      if (block.dividend !== undefined) result.annualDividend = block.dividend;
      if (block.payoutRatio !== undefined) result.payoutRatio = block.payoutRatio;
      if (block.dividendGrowth5Y !== undefined) result.dividendGrowth5Y = block.dividendGrowth5Y;

      // Check for table-format dividend data
      if (block.dividendTable && Array.isArray(block.dividendTable)) {
        result.history = block.dividendTable.map((d: any) => ({
          exDate: d.exDate || d.ex || null,
          payDate: d.payDate || d.pay || null,
          amount: d.amount ?? d.cash ?? null,
          type: d.type || "Cash",
          frequency: d.frequency || null,
        }));
      }
    }

    dividendCache.set(cacheKey, { data: result, timestamp: Date.now() });
    console.log(`[StockAnalysis] Scraped dividends ${cacheKey}: ${result.history.length} records`);
    return result;
  } catch (err: any) {
    stats.errors++;
    stats.lastError = `${cacheKey}: ${err.message}`;
    console.error(`[StockAnalysis] Error fetching dividends ${cacheKey}:`, err.message);
    return null;
  }
}

/**
 * Get service statistics
 */
export function getSAStats() {
  return {
    ...stats,
    cacheSize: overviewCache.size + financialsCache.size + dividendCache.size,
    cacheTTL: CACHE_TTL / 1000,
  };
}

/**
 * Clear all caches
 */
export function clearSACache() {
  overviewCache.clear();
  financialsCache.clear();
  dividendCache.clear();
  return { cleared: true };
}
