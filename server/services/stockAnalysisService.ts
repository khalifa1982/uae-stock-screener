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

export interface SAStatisticsData {
  // Valuation
  marketCap: number | null;
  enterpriseValue: number | null;
  // Important Dates
  earningsDate: string | null;
  exDividendDate: string | null;
  // Share Statistics
  sharesOutstanding: string | null;
  sharesChangeYoY: string | null;
  sharesChangeQoQ: string | null;
  insiderOwnership: number | null;
  institutionalOwnership: number | null;
  floatShares: string | null;
  // Valuation Ratios
  peRatio: number | null;
  forwardPE: number | null;
  psRatio: number | null;
  pbRatio: number | null;
  pTBV: number | null;
  pFCF: number | null;
  pOCF: number | null;
  pegRatio: number | null;
  // Enterprise Valuation
  evEarnings: number | null;
  evSales: number | null;
  evEbitda: number | null;
  evEbit: number | null;
  evFCF: number | null;
  // Financial Position
  currentRatio: number | null;
  quickRatio: number | null;
  debtToEquity: number | null;
  debtToEbitda: number | null;
  debtToFCF: number | null;
  interestCoverage: number | null;
  // Financial Efficiency
  roe: number | null;
  roa: number | null;
  roic: number | null;
  roce: number | null;
  wacc: number | null;
  assetTurnover: number | null;
  inventoryTurnover: number | null;
  // Taxes
  incomeTax: string | null;
  effectiveTaxRate: number | null;
  // Stock Price Statistics
  beta: number | null;
  weekChange52: number | null;
  ma50: number | null;
  ma200: number | null;
  rsi: number | null;
  avgVolume20: number | null;
  // Balance Sheet Summary
  cash: string | null;
  totalDebt: string | null;
  netCash: string | null;
  netCashPerShare: number | null;
  bookValue: string | null;
  bookValuePerShare: number | null;
  workingCapital: string | null;
  // Cash Flow Summary
  operatingCashFlow: string | null;
  capex: string | null;
  freeCashFlow: string | null;
  fcfPerShare: number | null;
  // Margins
  grossMargin: number | null;
  operatingMargin: number | null;
  pretaxMargin: number | null;
  profitMargin: number | null;
  ebitdaMargin: number | null;
  ebitMargin: number | null;
  fcfMargin: number | null;
  // Dividends & Yields
  dividendPerShare: number | null;
  dividendYield: number | null;
  dividendGrowthYoY: string | null;
  yearsOfDividendGrowth: number | null;
  payoutRatio: number | null;
  buybackYield: number | null;
  shareholderYield: number | null;
  earningsYield: number | null;
  fcfYield: number | null;
  // Fair Value
  lynchFairValue: number | null;
  lynchUpside: number | null;
  grahamNumber: number | null;
  grahamUpside: number | null;
  // Scores
  altmanZScore: number | null;
  piotoskiFScore: number | null;
  // Stock Splits
  lastSplitDate: string | null;
  splitType: string | null;
  splitRatio: string | null;
}

export interface SAProfileData {
  companyName: string | null;
  description: string | null;
  country: string | null;
  founded: string | null;
  industry: string | null;
  sector: string | null;
  ceo: string | null;
  // Contact
  address: string | null;
  phone: string | null;
  website: string | null;
  // Stock Details
  tickerSymbol: string | null;
  exchange: string | null;
  fiscalYear: string | null;
  reportingCurrency: string | null;
  isinNumber: string | null;
  sicCode: string | null;
  // Key Executives
  executives: Array<{
    name: string;
    position: string;
  }>;
}

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
const statisticsCache = new Map<string, CacheEntry<SAStatisticsData>>();
const profileCache = new Map<string, CacheEntry<SAProfileData>>();
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
  // String-aware JS-to-JSON converter.
  // Walks through the text character by character, only modifying content outside strings.
  const out: string[] = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    // Handle strings - copy them verbatim
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const useQuote = '"'; // Always output double quotes for JSON
      out.push(useQuote);
      i++;
      while (i < len) {
        const sc = text[i];
        if (sc === '\\') {
          // Escape sequence - copy both chars
          out.push(sc);
          i++;
          if (i < len) {
            out.push(text[i]);
            i++;
          }
        } else if (sc === quote) {
          // End of string
          out.push(useQuote);
          i++;
          break;
        } else if (sc === '"' && quote === "'") {
          // Double quote inside single-quoted string needs escaping
          out.push('\\"');
          i++;
        } else {
          out.push(sc);
          i++;
        }
      }
      continue;
    }

    // Handle unquoted identifiers (object keys or values like undefined/void 0)
    if (/[a-zA-Z_$]/.test(ch)) {
      let ident = '';
      const identStart = i;
      while (i < len && /[a-zA-Z0-9_$]/.test(text[i])) {
        ident += text[i];
        i++;
      }

      // Check for 'void 0' pattern
      if (ident === 'void') {
        // Skip whitespace and expect '0'
        let j = i;
        while (j < len && text[j] === ' ') j++;
        if (j < len && text[j] === '0') {
          out.push('null');
          i = j + 1;
          continue;
        }
      }

      if (ident === 'undefined' || ident === 'null') {
        out.push('null');
        continue;
      }

      if (ident === 'true' || ident === 'false') {
        out.push(ident);
        continue;
      }

      // Check if this is an object key (followed by ':')
      let j = i;
      while (j < len && text[j] === ' ') j++;
      if (j < len && text[j] === ':') {
        // It's a key - quote it
        out.push('"' + ident + '"');
      } else {
        // Unknown identifier - treat as string
        out.push('"' + ident + '"');
      }
      continue;
    }

    // Handle trailing commas before } or ]
    if (ch === ',') {
      // Look ahead for } or ] (skipping whitespace)
      let j = i + 1;
      while (j < len && (text[j] === ' ' || text[j] === '\n' || text[j] === '\r' || text[j] === '\t')) j++;
      if (j < len && (text[j] === '}' || text[j] === ']')) {
        // Skip trailing comma
        i++;
        continue;
      }
    }

    out.push(ch);
    i++;
  }

  const json = out.join('');
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
    cacheSize: overviewCache.size + financialsCache.size + dividendCache.size + statisticsCache.size + profileCache.size,
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
  statisticsCache.clear();
  profileCache.clear();
  return { cleared: true };
}

// ─── Statistics Page Scraper ──────────────────────────────────────

/**
 * Parse a number from text like "104.30B", "5.93", "21.92%", "n/a"
 */
function parseStatNumber(text: string | null | undefined): number | null {
  if (!text || text === 'n/a' || text === '-' || text === 'n/m') return null;
  const cleaned = text.replace(/[%,]/g, '').trim();
  // Handle B/M/K suffixes
  const suffixMatch = cleaned.match(/^([\-\d.]+)\s*([BMK])?$/i);
  if (suffixMatch) {
    let val = parseFloat(suffixMatch[1]);
    if (isNaN(val)) return null;
    const suffix = (suffixMatch[2] || '').toUpperCase();
    if (suffix === 'B') val *= 1e9;
    else if (suffix === 'M') val *= 1e6;
    else if (suffix === 'K') val *= 1e3;
    return val;
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Extract statistics data from the HTML using table-based parsing.
 * The statistics page has sections with key-value pairs in tables.
 */
function extractStatisticsFromHTML(html: string): SAStatisticsData {
  const result: SAStatisticsData = {
    marketCap: null, enterpriseValue: null,
    earningsDate: null, exDividendDate: null,
    sharesOutstanding: null, sharesChangeYoY: null, sharesChangeQoQ: null,
    insiderOwnership: null, institutionalOwnership: null, floatShares: null,
    peRatio: null, forwardPE: null, psRatio: null, pbRatio: null,
    pTBV: null, pFCF: null, pOCF: null, pegRatio: null,
    evEarnings: null, evSales: null, evEbitda: null, evEbit: null, evFCF: null,
    currentRatio: null, quickRatio: null, debtToEquity: null,
    debtToEbitda: null, debtToFCF: null, interestCoverage: null,
    roe: null, roa: null, roic: null, roce: null, wacc: null,
    assetTurnover: null, inventoryTurnover: null,
    incomeTax: null, effectiveTaxRate: null,
    beta: null, weekChange52: null, ma50: null, ma200: null, rsi: null, avgVolume20: null,
    cash: null, totalDebt: null, netCash: null, netCashPerShare: null,
    bookValue: null, bookValuePerShare: null, workingCapital: null,
    operatingCashFlow: null, capex: null, freeCashFlow: null, fcfPerShare: null,
    grossMargin: null, operatingMargin: null, pretaxMargin: null,
    profitMargin: null, ebitdaMargin: null, ebitMargin: null, fcfMargin: null,
    dividendPerShare: null, dividendYield: null, dividendGrowthYoY: null,
    yearsOfDividendGrowth: null, payoutRatio: null, buybackYield: null,
    shareholderYield: null, earningsYield: null, fcfYield: null,
    lynchFairValue: null, lynchUpside: null, grahamNumber: null, grahamUpside: null,
    altmanZScore: null, piotoskiFScore: null,
    lastSplitDate: null, splitType: null, splitRatio: null,
  };

  // Try to extract from SvelteKit data blocks first (primary method)
  const blocks = extractDataBlocks(html);
  for (const block of blocks) {
    // The statistics page uses sections like: valuation.data[{id, title, value}], shares.data[...], etc.
    if (block.valuation || block.ratios || block.financialPosition || block.financialEfficiency) {
      // Build a flat id->value map from all sections
      const idMap: Record<string, string> = {};
      const sections = [
        block.valuation, block.dates, block.shares, block.ratios,
        block.evRatios, block.financialPosition, block.financialEfficiency,
        block.taxes, block.stockPrice, block.shortSelling,
        block.incomeStatement, block.balanceSheet, block.cashFlow,
        block.margins, block.dividends, block.analystForecasts,
        block.fairValue, block.stockSplits, block.scores,
      ];
      for (const section of sections) {
        if (section?.data && Array.isArray(section.data)) {
          for (const item of section.data) {
            if (item.id && item.value != null) {
              idMap[item.id] = String(item.value);
            }
          }
        }
      }

      if (Object.keys(idMap).length > 0) {
        // Map IDs to result fields
        result.marketCap = parseStatNumber(idMap['marketcap'] || idMap['marketCap']);
        result.enterpriseValue = parseStatNumber(idMap['enterpriseValue']);
        result.earningsDate = idMap['earningsdate'] || idMap['earningsDate'] || null;
        result.exDividendDate = idMap['exdivdate'] || idMap['exDivDate'] || null;
        result.sharesOutstanding = idMap['sharesout'] || idMap['sharesOutstanding'] || null;
        result.sharesChangeYoY = idMap['sharesgrowthyoy'] !== 'n/a' ? idMap['sharesgrowthyoy'] || null : null;
        result.sharesChangeQoQ = idMap['sharesgrowthqoq'] !== 'n/a' ? idMap['sharesgrowthqoq'] || null : null;
        result.insiderOwnership = parseStatNumber(idMap['sharesInsiders']);
        result.institutionalOwnership = parseStatNumber(idMap['sharesInstitutions']);
        result.floatShares = idMap['float'] || null;
        result.peRatio = parseStatNumber(idMap['pe']);
        result.forwardPE = parseStatNumber(idMap['peForward']);
        result.psRatio = parseStatNumber(idMap['ps']);
        result.pbRatio = parseStatNumber(idMap['pb']);
        result.pTBV = parseStatNumber(idMap['ptbvRatio']);
        result.pFCF = parseStatNumber(idMap['pfcf']);
        result.pOCF = parseStatNumber(idMap['pocf']);
        result.pegRatio = parseStatNumber(idMap['pegRatio']);
        result.evEarnings = parseStatNumber(idMap['evEarnings']);
        result.evSales = parseStatNumber(idMap['evSales']);
        result.evEbitda = parseStatNumber(idMap['evEbitda']);
        result.evEbit = parseStatNumber(idMap['evEbit']);
        result.evFCF = parseStatNumber(idMap['evFcf'] || idMap['evFCF']);
        result.currentRatio = parseStatNumber(idMap['currentRatio']);
        result.quickRatio = parseStatNumber(idMap['quickRatio']);
        result.debtToEquity = parseStatNumber(idMap['debtEquity'] || idMap['debtToEquity']);
        result.debtToEbitda = parseStatNumber(idMap['debtEbitda'] || idMap['debtToEbitda']);
        result.debtToFCF = parseStatNumber(idMap['debtFcf'] || idMap['debtToFCF']);
        result.interestCoverage = parseStatNumber(idMap['interestCoverage']);
        result.roe = parseStatNumber(idMap['roe']);
        result.roa = parseStatNumber(idMap['roa']);
        result.roic = parseStatNumber(idMap['roic']);
        result.roce = parseStatNumber(idMap['roce']);
        result.wacc = parseStatNumber(idMap['wacc']);
        result.assetTurnover = parseStatNumber(idMap['assetTurnover']);
        result.inventoryTurnover = parseStatNumber(idMap['inventoryTurnover']);
        result.incomeTax = idMap['incomeTax'] || null;
        result.effectiveTaxRate = parseStatNumber(idMap['effectiveTaxRate']);
        result.beta = parseStatNumber(idMap['beta']);
        result.weekChange52 = parseStatNumber(idMap['priceChange52w'] || idMap['52wChange']);
        result.ma50 = parseStatNumber(idMap['sma50'] || idMap['ma50']);
        result.ma200 = parseStatNumber(idMap['sma200'] || idMap['ma200']);
        result.rsi = parseStatNumber(idMap['rsi']);
        result.avgVolume20 = parseStatNumber((idMap['avgVolume'] || '').replace(/,/g, ''));
        result.cash = idMap['cash'] || null;
        result.totalDebt = idMap['totalDebt'] || null;
        result.netCash = idMap['netCash'] || null;
        result.netCashPerShare = parseStatNumber(idMap['netCashPerShare']);
        result.bookValue = idMap['bookValue'] || idMap['equity'] || null;
        result.bookValuePerShare = parseStatNumber(idMap['bookValuePerShare'] || idMap['bvps']);
        result.workingCapital = idMap['workingCapital'] || null;
        result.operatingCashFlow = idMap['operatingCashFlow'] || idMap['ocf'] || null;
        result.capex = idMap['capex'] || idMap['capitalExpenditures'] || null;
        result.freeCashFlow = idMap['freeCashFlow'] || idMap['fcf'] || null;
        result.fcfPerShare = parseStatNumber(idMap['fcfPerShare'] || idMap['fcfps']);
        result.grossMargin = parseStatNumber(idMap['grossMargin']);
        result.operatingMargin = parseStatNumber(idMap['operatingMargin']);
        result.pretaxMargin = parseStatNumber(idMap['pretaxMargin']);
        result.profitMargin = parseStatNumber(idMap['profitMargin'] || idMap['netMargin']);
        result.ebitdaMargin = parseStatNumber(idMap['ebitdaMargin']);
        result.ebitMargin = parseStatNumber(idMap['ebitMargin']);
        result.fcfMargin = parseStatNumber(idMap['fcfMargin']);
        result.dividendPerShare = parseStatNumber(idMap['dividendPerShare'] || idMap['dps']);
        result.dividendYield = parseStatNumber(idMap['dividendYield'] || idMap['divYield']);
        result.dividendGrowthYoY = idMap['dividendGrowth'] !== 'n/a' ? idMap['dividendGrowth'] || null : null;
        result.yearsOfDividendGrowth = parseStatNumber(idMap['yearsOfDividendGrowth'] || idMap['divGrowthYears']);
        result.payoutRatio = parseStatNumber(idMap['payoutRatio']);
        result.buybackYield = parseStatNumber(idMap['buybackYield']);
        result.shareholderYield = parseStatNumber(idMap['shareholderYield']);
        result.earningsYield = parseStatNumber(idMap['earningsYield']);
        result.fcfYield = parseStatNumber(idMap['fcfYield']);
        result.lynchFairValue = parseStatNumber(idMap['lynchFairValue']);
        result.lynchUpside = parseStatNumber(idMap['lynchUpside']);
        result.grahamNumber = parseStatNumber(idMap['grahamNumber']);
        result.grahamUpside = parseStatNumber(idMap['grahamUpside']);
        result.altmanZScore = parseStatNumber(idMap['zScore'] || idMap['altmanZScore']);
        result.piotoskiFScore = parseStatNumber(idMap['fScore'] || idMap['piotoskiFScore'] || idMap['piotroskiFScore']);
        result.lastSplitDate = idMap['lastSplitDate'] || null;
        result.splitType = idMap['splitType'] || null;
        result.splitRatio = idMap['splitRatio'] || null;
      }
    }
  }

  // Fallback: parse from raw HTML table rows using title-based extraction
  // The HTML has comment nodes in <td> cells, so we use the title attribute on value cells
  // Pattern: <td ...title="exact_value">display_value</td>
  // First, try extracting from title attributes on value cells
  const titlePattern = /<td[^>]*>(?:[^<]|<!--[^>]*-->|<[^/][^>]*>)*?<span>(?:[^<]|<!--[^>]*-->)*?([^<]+?)(?:[^<]|<!--[^>]*-->)*?<\/span>(?:[^<]|<!--[^>]*-->|<[^/][^>]*>)*?<\/td>[^<]*<td[^>]*?(?:title="([^"]*)")?>\s*([^<]+)\s*<\/td>/gi;
  // Simpler fallback: just look for title attributes paired with display values
  const simpleTitlePattern = /title="([^"]+)"[^>]*>([^<]+)<\/td>/gi;
  const titleValues: Record<string, string> = {};
  let titleMatch;
  while ((titleMatch = simpleTitlePattern.exec(html)) !== null) {
    // title has the precise value, the text has the display value
    titleValues[titleMatch[2].trim()] = titleMatch[1];
  }

  // If SvelteKit extraction got nothing, use HTML table parsing
  if (!result.peRatio && !result.marketCap) {
    // Use a more robust regex that handles HTML comments in cells
    // Match: <td ...><span>...KEY...</span></td><td ...>VALUE</td>
    const rowPattern = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>\s*([^<]+)\s*<\/td>\s*(?:<\/tr>|<!--)/gi;
    let rowMatch;
    while ((rowMatch = rowPattern.exec(html)) !== null) {
      // Strip HTML tags and comments from the key cell
      const key = rowMatch[1].replace(/<[^>]*>/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
      const val = rowMatch[2].trim();
      if (!key || !val) continue;

      switch (key) {
        case 'Market Cap': result.marketCap = result.marketCap || parseStatNumber(val); break;
        case 'Enterprise Value': result.enterpriseValue = result.enterpriseValue || parseStatNumber(val); break;
        case 'Earnings Date': result.earningsDate = result.earningsDate || (val !== 'n/a' ? val : null); break;
        case 'Ex-Dividend Date': result.exDividendDate = result.exDividendDate || (val !== 'n/a' ? val : null); break;
        case 'Shares Outstanding': result.sharesOutstanding = result.sharesOutstanding || (val !== 'n/a' ? val : null); break;
        case 'Shares Change (YoY)': result.sharesChangeYoY = result.sharesChangeYoY || (val !== 'n/a' ? val : null); break;
        case 'Shares Change (QoQ)': result.sharesChangeQoQ = result.sharesChangeQoQ || (val !== 'n/a' ? val : null); break;
        case 'Owned by Insiders (%)': result.insiderOwnership = result.insiderOwnership || parseStatNumber(val); break;
        case 'Owned by Institutions (%)': result.institutionalOwnership = result.institutionalOwnership || parseStatNumber(val); break;
        case 'Float': result.floatShares = result.floatShares || (val !== 'n/a' ? val : null); break;
        case 'PE Ratio': result.peRatio = result.peRatio || parseStatNumber(val); break;
        case 'Forward PE': result.forwardPE = result.forwardPE || parseStatNumber(val); break;
        case 'PS Ratio': result.psRatio = result.psRatio || parseStatNumber(val); break;
        case 'PB Ratio': result.pbRatio = result.pbRatio || parseStatNumber(val); break;
        case 'P/TBV Ratio': result.pTBV = result.pTBV || parseStatNumber(val); break;
        case 'P/FCF Ratio': result.pFCF = result.pFCF || parseStatNumber(val); break;
        case 'P/OCF Ratio': result.pOCF = result.pOCF || parseStatNumber(val); break;
        case 'PEG Ratio': result.pegRatio = result.pegRatio || parseStatNumber(val); break;
        case 'EV / Earnings': result.evEarnings = result.evEarnings || parseStatNumber(val); break;
        case 'EV / Sales': result.evSales = result.evSales || parseStatNumber(val); break;
        case 'EV / EBITDA': result.evEbitda = result.evEbitda || parseStatNumber(val); break;
        case 'EV / EBIT': result.evEbit = result.evEbit || parseStatNumber(val); break;
        case 'EV / FCF': result.evFCF = result.evFCF || parseStatNumber(val); break;
        case 'Current Ratio': result.currentRatio = result.currentRatio || parseStatNumber(val); break;
        case 'Quick Ratio': result.quickRatio = result.quickRatio || parseStatNumber(val); break;
        case 'Debt / Equity': result.debtToEquity = result.debtToEquity || parseStatNumber(val); break;
        case 'Debt / EBITDA': result.debtToEbitda = result.debtToEbitda || parseStatNumber(val); break;
        case 'Debt / FCF': result.debtToFCF = result.debtToFCF || parseStatNumber(val); break;
        case 'Interest Coverage': result.interestCoverage = result.interestCoverage || parseStatNumber(val); break;
        case 'Return on Equity (ROE)': result.roe = result.roe || parseStatNumber(val); break;
        case 'Return on Assets (ROA)': result.roa = result.roa || parseStatNumber(val); break;
        case 'Return on Invested Capital (ROIC)': result.roic = result.roic || parseStatNumber(val); break;
        case 'Return on Capital Employed (ROCE)': result.roce = result.roce || parseStatNumber(val); break;
        case 'Weighted Average Cost of Capital (WACC)': result.wacc = result.wacc || parseStatNumber(val); break;
        case 'Asset Turnover': result.assetTurnover = result.assetTurnover || parseStatNumber(val); break;
        case 'Inventory Turnover': result.inventoryTurnover = result.inventoryTurnover || parseStatNumber(val); break;
        case 'Income Tax': result.incomeTax = result.incomeTax || (val !== 'n/a' ? val : null); break;
        case 'Effective Tax Rate': result.effectiveTaxRate = result.effectiveTaxRate || parseStatNumber(val); break;
        case 'Beta (5Y)': result.beta = result.beta || parseStatNumber(val); break;
        case '52-Week Price Change': result.weekChange52 = result.weekChange52 || parseStatNumber(val); break;
        case '50-Day Moving Average': result.ma50 = result.ma50 || parseStatNumber(val); break;
        case '200-Day Moving Average': result.ma200 = result.ma200 || parseStatNumber(val); break;
        case 'Relative Strength Index (RSI)': result.rsi = result.rsi || parseStatNumber(val); break;
        case 'Average Volume (20 Days)': result.avgVolume20 = result.avgVolume20 || parseStatNumber(val.replace(/,/g, '')); break;
        case 'Cash & Cash Equivalents': result.cash = result.cash || (val !== 'n/a' ? val : null); break;
        case 'Total Debt': result.totalDebt = result.totalDebt || (val !== 'n/a' ? val : null); break;
        case 'Net Cash': result.netCash = result.netCash || (val !== 'n/a' ? val : null); break;
        case 'Net Cash Per Share': result.netCashPerShare = result.netCashPerShare || parseStatNumber(val); break;
        case 'Equity (Book Value)': result.bookValue = val !== 'n/a' ? val : null; break;
        case 'Book Value Per Share': result.bookValuePerShare = result.bookValuePerShare || parseStatNumber(val); break;
        case 'Working Capital': result.workingCapital = result.workingCapital || (val !== 'n/a' ? val : null); break;
        case 'Operating Cash Flow': result.operatingCashFlow = result.operatingCashFlow || (val !== 'n/a' ? val : null); break;
        case 'Capital Expenditures': result.capex = result.capex || (val !== 'n/a' ? val : null); break;
        case 'Free Cash Flow': result.freeCashFlow = result.freeCashFlow || (val !== 'n/a' ? val : null); break;
        case 'FCF Per Share': result.fcfPerShare = result.fcfPerShare || parseStatNumber(val); break;
        case 'Gross Margin': result.grossMargin = result.grossMargin || parseStatNumber(val); break;
        case 'Operating Margin': result.operatingMargin = result.operatingMargin || parseStatNumber(val); break;
        case 'Pretax Margin': result.pretaxMargin = result.pretaxMargin || parseStatNumber(val); break;
        case 'Profit Margin': result.profitMargin = result.profitMargin || parseStatNumber(val); break;
        case 'EBITDA Margin': result.ebitdaMargin = result.ebitdaMargin || parseStatNumber(val); break;
        case 'EBIT Margin': result.ebitMargin = result.ebitMargin || parseStatNumber(val); break;
        case 'FCF Margin': result.fcfMargin = result.fcfMargin || parseStatNumber(val); break;
        case 'Dividend Per Share': result.dividendPerShare = result.dividendPerShare || parseStatNumber(val); break;
        case 'Dividend Yield': result.dividendYield = result.dividendYield || parseStatNumber(val); break;
        case 'Dividend Growth (YoY)': result.dividendGrowthYoY = result.dividendGrowthYoY || (val !== 'n/a' ? val : null); break;
        case 'Years of Dividend Growth': result.yearsOfDividendGrowth = result.yearsOfDividendGrowth || parseStatNumber(val); break;
        case 'Payout Ratio': result.payoutRatio = result.payoutRatio || parseStatNumber(val); break;
        case 'Buyback Yield': result.buybackYield = result.buybackYield || parseStatNumber(val); break;
        case 'Shareholder Yield': result.shareholderYield = result.shareholderYield || parseStatNumber(val); break;
        case 'Earnings Yield': result.earningsYield = result.earningsYield || parseStatNumber(val); break;
        case 'FCF Yield': result.fcfYield = result.fcfYield || parseStatNumber(val); break;
        case 'Lynch Fair Value': result.lynchFairValue = result.lynchFairValue || parseStatNumber(val); break;
        case 'Lynch Upside': result.lynchUpside = result.lynchUpside || parseStatNumber(val); break;
        case 'Graham Number': result.grahamNumber = result.grahamNumber || parseStatNumber(val); break;
        case 'Graham Upside': result.grahamUpside = result.grahamUpside || parseStatNumber(val); break;
        case 'Altman Z-Score': result.altmanZScore = result.altmanZScore || parseStatNumber(val); break;
        case 'Piotroski F-Score': result.piotoskiFScore = result.piotoskiFScore || parseStatNumber(val); break;
        case 'Last Split Date': result.lastSplitDate = val !== 'n/a' ? val : null; break;
        case 'Split Type': result.splitType = val !== 'n/a' ? val : null; break;
        case 'Split Ratio': result.splitRatio = val !== 'n/a' ? val : null; break;
      }
    }
  }

  return result;
}

/**
 * Extract profile data from the HTML
 */
function extractProfileFromHTML(html: string): SAProfileData {
  const result: SAProfileData = {
    companyName: null, description: null, country: null, founded: null,
    industry: null, sector: null, ceo: null,
    address: null, phone: null, website: null,
    tickerSymbol: null, exchange: null, fiscalYear: null,
    reportingCurrency: null, isinNumber: null, sicCode: null,
    executives: [],
  };

  // Try SvelteKit data blocks
  // Structure: { profile: {name, country, founded, industry, sector, ceo, ...},
  //              contact: {address, phone, website, domain},
  //              description: "<p>...",
  //              executives: [{Name, Title}, ...],
  //              details: {symbol, exchange, fiscalYear, currency, isin, sic} }
  const blocks = extractDataBlocks(html);
  for (const block of blocks) {
    if (block.profile || block.description || block.executives) {
      const profile = block.profile || {};
      result.companyName = profile.name || null;
      result.country = profile.country || null;
      result.founded = profile.founded?.toString() || null;
      // industry/sector can be objects {value, url} or strings
      result.industry = typeof profile.industry === 'object' ? profile.industry?.value : profile.industry || null;
      result.sector = typeof profile.sector === 'object' ? profile.sector?.value : profile.sector || null;
      result.ceo = profile.ceo || null;

      // Description is at top level (may contain HTML)
      if (block.description) {
        result.description = block.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }

      // Contact is at top level
      const contact = block.contact || {};
      result.phone = contact.phone || null;
      result.website = contact.website || contact.domain || null;
      result.address = contact.address?.replace(/<br>/g, ', ') || null;

      // Details is at top level
      const details = block.details || {};
      result.tickerSymbol = details.symbol || null;
      result.exchange = details.exchange || null;
      result.fiscalYear = details.fiscalYear || null;
      result.reportingCurrency = details.currency || null;
      result.isinNumber = details.isin || null;
      result.sicCode = details.sic || null;

      // Executives at top level - keys are capitalized: Name, Title
      if (Array.isArray(block.executives)) {
        result.executives = block.executives.map((e: any) => ({
          name: e.Name || e.name || '',
          position: e.Title || e.title || e.position || '',
        }));
      }
    }
  }

  // Fallback: regex-based extraction from rendered HTML
  // Extract description
  const descMatch = html.match(/Company Description<\/h[12]>\s*(?:<[^>]+>)*\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  if (descMatch && !result.description) {
    result.description = descMatch[1].replace(/<[^>]+>/g, '').trim();
  }

  // Extract key-value pairs from profile tables
  const profileKV = /(?:<td[^>]*>|<th[^>]*>)\s*([^<]+)\s*<\/(?:td|th)>\s*<td[^>]*>\s*([^<]+)\s*<\/td>/gi;
  let m;
  while ((m = profileKV.exec(html)) !== null) {
    const key = m[1].trim();
    const val = m[2].trim();
    switch (key) {
      case 'Country': result.country = val; break;
      case 'Founded': result.founded = val; break;
      case 'Industry': result.industry = val; break;
      case 'Sector': result.sector = val; break;
      case 'CEO': result.ceo = val; break;
      case 'Phone': result.phone = val; break;
      case 'Website': result.website = val; break;
      case 'Ticker Symbol': result.tickerSymbol = val; break;
      case 'Exchange': result.exchange = val; break;
      case 'Fiscal Year': result.fiscalYear = val; break;
      case 'Reporting Currency': result.reportingCurrency = val; break;
      case 'ISIN Number': result.isinNumber = val; break;
      case 'SIC Code': result.sicCode = val; break;
    }
  }

  // Extract executives from table
  const execPattern = /<tr[^>]*>\s*<td[^>]*>\s*([^<]+)\s*<\/td>\s*<td[^>]*>\s*([^<]+)\s*<\/td>\s*<\/tr>/gi;
  const execSection = html.indexOf('Key Executives');
  if (execSection !== -1 && result.executives.length === 0) {
    const execHtml = html.substring(execSection, execSection + 3000);
    let execMatch;
    while ((execMatch = execPattern.exec(execHtml)) !== null) {
      const name = execMatch[1].trim();
      const position = execMatch[2].trim();
      if (name && position && name !== 'Name' && position !== 'Position') {
        result.executives.push({ name, position });
      }
    }
  }

  return result;
}

/**
 * Fetch statistics data for a UAE stock from StockAnalysis.com
 */
export async function fetchSAStatistics(
  symbol: string,
  exchange: string
): Promise<SAStatisticsData | null> {
  const cacheKey = `${exchange.toUpperCase()}-${symbol.toUpperCase()}-statistics`;
  stats.totalRequests++;
  stats.lastRequest = cacheKey;

  const cached = statisticsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    stats.cacheHits++;
    return cached.data;
  }
  stats.cacheMisses++;

  try {
    const url = buildUrl(symbol, exchange, 'statistics');
    console.log(`[StockAnalysis] Fetching statistics: ${url}`);
    const fetchResult = await scrapflyFetch(url, { asp: true, cache: true, cacheTtl: 3600 });
    const html = fetchResult.content;

    const data = extractStatisticsFromHTML(html);
    statisticsCache.set(cacheKey, { data, timestamp: Date.now() });
    
    const fieldCount = Object.values(data).filter(v => v !== null).length;
    console.log(`[StockAnalysis] Scraped statistics ${cacheKey}: ${fieldCount} fields populated`);
    return data;
  } catch (err: any) {
    stats.errors++;
    stats.lastError = `${cacheKey}: ${err.message}`;
    console.error(`[StockAnalysis] Error fetching statistics ${cacheKey}:`, err.message);
    return null;
  }
}

/**
 * Fetch company profile data for a UAE stock from StockAnalysis.com
 */
export async function fetchSAProfile(
  symbol: string,
  exchange: string
): Promise<SAProfileData | null> {
  const cacheKey = `${exchange.toUpperCase()}-${symbol.toUpperCase()}-profile`;
  stats.totalRequests++;
  stats.lastRequest = cacheKey;

  const cached = profileCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    stats.cacheHits++;
    return cached.data;
  }
  stats.cacheMisses++;

  try {
    const url = buildUrl(symbol, exchange, 'company');
    console.log(`[StockAnalysis] Fetching profile: ${url}`);
    const fetchResult = await scrapflyFetch(url, { asp: true, cache: true, cacheTtl: 7200 });
    const html = fetchResult.content;

    const data = extractProfileFromHTML(html);
    profileCache.set(cacheKey, { data, timestamp: Date.now() });
    
    console.log(`[StockAnalysis] Scraped profile ${cacheKey}: ${data.companyName || 'unknown'}, ${data.executives.length} executives`);
    return data;
  } catch (err: any) {
    stats.errors++;
    stats.lastError = `${cacheKey}: ${err.message}`;
    console.error(`[StockAnalysis] Error fetching profile ${cacheKey}:`, err.message);
    return null;
  }
}
