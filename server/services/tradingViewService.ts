/**
 * TradingView Scanner API Service
 * Free API - no key required. Provides real-time technical analysis,
 * recommendations, fundamentals, and market data for all UAE stocks.
 * Covers both ADX and DFM exchanges (174 stocks).
 */

const TV_SCANNER_URL = 'https://scanner.tradingview.com/uae/scan';

// ─── Column definitions ──────────────────────────────────────────────

// Group 1: Market Data & Price
const PRICE_COLUMNS = [
  'name', 'description', 'logoid', 'exchange', 'type', 'sector', 'industry',
  'close', 'change', 'change_abs', 'volume', 'open', 'high', 'low',
  'market_cap_basic', 'High.All', 'Low.All',
];

// Group 2: Fundamentals
const FUNDAMENTAL_COLUMNS = [
  'price_earnings_ttm', 'earnings_per_share_basic_ttm', 'dividend_yield_recent',
  'price_book_ratio', 'return_on_equity', 'debt_to_equity', 'current_ratio',
  'total_revenue', 'net_income', 'gross_margin', 'operating_margin',
  'after_tax_margin', 'pre_tax_margin', 'basic_eps_net_income', 'beta_1_year',
  'total_assets', 'total_debt', 'total_current_assets', 'gross_profit',
  'ebitda', 'free_cash_flow', 'total_shares_outstanding', 'price_sales_ratio',
  'number_of_employees',
];

// Group 3: Technical Indicators
const TECHNICAL_COLUMNS = [
  'Recommend.All', 'Recommend.MA', 'Recommend.Other',
  'RSI', 'MACD.macd', 'MACD.signal', 'Stoch.K', 'Stoch.D',
  'ADX', 'CCI20', 'BB.upper', 'BB.lower',
  'SMA20', 'SMA50', 'SMA200', 'EMA20', 'EMA50', 'EMA200',
  'Mom', 'AO',
];

// Group 4: Performance
const PERFORMANCE_COLUMNS = [
  'Perf.W', 'Perf.1M', 'Perf.3M', 'Perf.6M', 'Perf.YTD', 'Perf.Y',
  'Volatility.W', 'Volatility.M',
];

const ALL_COLUMNS = [
  ...PRICE_COLUMNS,
  ...FUNDAMENTAL_COLUMNS,
  ...TECHNICAL_COLUMNS,
  ...PERFORMANCE_COLUMNS,
];

// ─── Types ───────────────────────────────────────────────────────────

export interface TVStockData {
  // Identity
  ticker: string;         // e.g. "DFM:EMAAR"
  name: string;           // e.g. "EMAAR"
  description: string;    // e.g. "Emaar Properties (P.J.S.C)"
  logoId: string | null;
  exchange: string;       // "DFM" or "ADX"
  type: string;
  sector: string | null;
  industry: string | null;

  // Price
  close: number | null;
  change: number | null;
  changeAbs: number | null;
  volume: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  marketCap: number | null;
  allTimeHigh: number | null;
  allTimeLow: number | null;

  // Fundamentals
  pe: number | null;
  eps: number | null;
  dividendYield: number | null;
  priceToBook: number | null;
  returnOnEquity: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  totalRevenue: number | null;
  netIncome: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  afterTaxMargin: number | null;
  preTaxMargin: number | null;
  basicEps: number | null;
  beta: number | null;
  totalAssets: number | null;
  totalDebt: number | null;
  totalCurrentAssets: number | null;
  grossProfit: number | null;
  ebitda: number | null;
  freeCashFlow: number | null;
  sharesOutstanding: number | null;
  priceToSales: number | null;
  employees: number | null;

  // Technical Analysis
  recommendAll: number | null;    // -1 (strong sell) to +1 (strong buy)
  recommendMA: number | null;
  recommendOther: number | null;
  rsi: number | null;
  macdValue: number | null;
  macdSignal: number | null;
  stochK: number | null;
  stochD: number | null;
  adx: number | null;
  cci20: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  momentum: number | null;
  awesomeOscillator: number | null;

  // Performance
  perfWeek: number | null;
  perfMonth: number | null;
  perf3Month: number | null;
  perf6Month: number | null;
  perfYTD: number | null;
  perfYear: number | null;
  volatilityWeek: number | null;
  volatilityMonth: number | null;
}

export interface TVServiceStatus {
  connected: boolean;
  lastChecked: string;
  error: string | null;
  stockCount: number;
  lastSuccessfulFetch: string | null;
}

// ─── State ───────────────────────────────────────────────────────────

let lastStatus: TVServiceStatus = {
  connected: false,
  lastChecked: new Date().toISOString(),
  error: 'Not checked yet',
  stockCount: 0,
  lastSuccessfulFetch: null,
};

let totalRequests = 0;
let failedRequests = 0;
let cachedData: TVStockData[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── Core Functions ──────────────────────────────────────────────────

function parseRow(ticker: string, values: any[]): TVStockData {
  let i = 0;
  const v = (idx: number) => values[idx] ?? null;

  return {
    ticker,
    name: v(i++) as string,
    description: v(i++) as string,
    logoId: v(i++) as string | null,
    exchange: v(i++) as string,
    type: v(i++) as string,
    sector: v(i++) as string | null,
    industry: v(i++) as string | null,
    close: v(i++),
    change: v(i++),
    changeAbs: v(i++),
    volume: v(i++),
    open: v(i++),
    high: v(i++),
    low: v(i++),
    marketCap: v(i++),
    allTimeHigh: v(i++),
    allTimeLow: v(i++),
    // Fundamentals
    pe: v(i++),
    eps: v(i++),
    dividendYield: v(i++),
    priceToBook: v(i++),
    returnOnEquity: v(i++),
    debtToEquity: v(i++),
    currentRatio: v(i++),
    totalRevenue: v(i++),
    netIncome: v(i++),
    grossMargin: v(i++),
    operatingMargin: v(i++),
    afterTaxMargin: v(i++),
    preTaxMargin: v(i++),
    basicEps: v(i++),
    beta: v(i++),
    totalAssets: v(i++),
    totalDebt: v(i++),
    totalCurrentAssets: v(i++),
    grossProfit: v(i++),
    ebitda: v(i++),
    freeCashFlow: v(i++),
    sharesOutstanding: v(i++),
    priceToSales: v(i++),
    employees: v(i++),
    // Technical
    recommendAll: v(i++),
    recommendMA: v(i++),
    recommendOther: v(i++),
    rsi: v(i++),
    macdValue: v(i++),
    macdSignal: v(i++),
    stochK: v(i++),
    stochD: v(i++),
    adx: v(i++),
    cci20: v(i++),
    bbUpper: v(i++),
    bbLower: v(i++),
    sma20: v(i++),
    sma50: v(i++),
    sma200: v(i++),
    ema20: v(i++),
    ema50: v(i++),
    ema200: v(i++),
    momentum: v(i++),
    awesomeOscillator: v(i++),
    // Performance
    perfWeek: v(i++),
    perfMonth: v(i++),
    perf3Month: v(i++),
    perf6Month: v(i++),
    perfYTD: v(i++),
    perfYear: v(i++),
    volatilityWeek: v(i++),
    volatilityMonth: v(i++),
  };
}

/**
 * Get recommendation label from numeric value
 */
export function getRecommendationLabel(value: number | null): string {
  if (value === null) return 'N/A';
  if (value >= 0.5) return 'Strong Buy';
  if (value >= 0.1) return 'Buy';
  if (value > -0.1) return 'Neutral';
  if (value > -0.5) return 'Sell';
  return 'Strong Sell';
}

/**
 * Fetch all UAE stocks from TradingView Scanner
 */
export async function fetchAllTVStocks(): Promise<TVStockData[]> {
  // Return cached data if fresh
  if (cachedData.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedData;
  }

  try {
    totalRequests++;
    const resp = await fetch(TV_SCANNER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: [
          { left: 'exchange', operation: 'in_range', right: ['DFM', 'ADX'] },
        ],
        columns: ALL_COLUMNS,
        sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
        range: [0, 300],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      failedRequests++;
      lastStatus = {
        connected: false,
        lastChecked: new Date().toISOString(),
        error: `HTTP ${resp.status}`,
        stockCount: 0,
        lastSuccessfulFetch: lastStatus.lastSuccessfulFetch,
      };
      return cachedData; // Return stale cache
    }

    const data = await resp.json() as any;
    if (!data.data || !Array.isArray(data.data)) {
      failedRequests++;
      lastStatus = {
        connected: false,
        lastChecked: new Date().toISOString(),
        error: data.error || 'Invalid response format',
        stockCount: 0,
        lastSuccessfulFetch: lastStatus.lastSuccessfulFetch,
      };
      return cachedData;
    }

    const stocks = data.data.map((row: any) => parseRow(row.s, row.d));
    cachedData = stocks;
    cacheTimestamp = Date.now();

    lastStatus = {
      connected: true,
      lastChecked: new Date().toISOString(),
      error: null,
      stockCount: data.totalCount || stocks.length,
      lastSuccessfulFetch: new Date().toISOString(),
    };

    return stocks;
  } catch (e: any) {
    failedRequests++;
    lastStatus = {
      connected: false,
      lastChecked: new Date().toISOString(),
      error: e.message || 'Connection failed',
      stockCount: 0,
      lastSuccessfulFetch: lastStatus.lastSuccessfulFetch,
    };
    return cachedData;
  }
}

/**
 * Fetch specific stocks by ticker
 */
export async function fetchTVStocksByTickers(tickers: string[]): Promise<TVStockData[]> {
  try {
    totalRequests++;
    const resp = await fetch(TV_SCANNER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbols: { tickers, query: { types: [] } },
        columns: ALL_COLUMNS,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      failedRequests++;
      return [];
    }

    const data = await resp.json() as any;
    if (!data.data) return [];

    const stocks = data.data.map((row: any) => parseRow(row.s, row.d));

    lastStatus = {
      connected: true,
      lastChecked: new Date().toISOString(),
      error: null,
      stockCount: lastStatus.stockCount,
      lastSuccessfulFetch: new Date().toISOString(),
    };

    return stocks;
  } catch (e: any) {
    failedRequests++;
    return [];
  }
}

/**
 * Health check
 */
export async function checkTradingViewHealth(): Promise<TVServiceStatus> {
  try {
    totalRequests++;
    const resp = await fetch(TV_SCANNER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: [
          { left: 'exchange', operation: 'in_range', right: ['DFM', 'ADX'] },
        ],
        columns: ['name', 'close'],
        range: [0, 1],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      failedRequests++;
      lastStatus = {
        connected: false,
        lastChecked: new Date().toISOString(),
        error: `HTTP ${resp.status}`,
        stockCount: 0,
        lastSuccessfulFetch: lastStatus.lastSuccessfulFetch,
      };
      return lastStatus;
    }

    const data = await resp.json() as any;
    lastStatus = {
      connected: true,
      lastChecked: new Date().toISOString(),
      error: null,
      stockCount: data.totalCount || 0,
      lastSuccessfulFetch: new Date().toISOString(),
    };
    return lastStatus;
  } catch (e: any) {
    failedRequests++;
    lastStatus = {
      connected: false,
      lastChecked: new Date().toISOString(),
      error: e.message || 'Connection failed',
      stockCount: 0,
      lastSuccessfulFetch: lastStatus.lastSuccessfulFetch,
    };
    return lastStatus;
  }
}

/**
 * Get service statistics
 */
export function getTradingViewStats() {
  return {
    status: lastStatus,
    totalRequests,
    failedRequests,
    successRate: totalRequests > 0 ? ((totalRequests - failedRequests) / totalRequests * 100).toFixed(1) + '%' : 'N/A',
    cacheAge: cacheTimestamp > 0 ? Math.round((Date.now() - cacheTimestamp) / 1000) + 's' : 'empty',
    cachedStocks: cachedData.length,
  };
}
