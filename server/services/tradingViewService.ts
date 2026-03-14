/**
 * TradingView Scanner API Service
 * Free API - no key required. Provides real-time technical analysis,
 * recommendations, fundamentals, and market data for all UAE stocks.
 * Covers both ADX and DFM exchanges (174 stocks).
 * 
 * Expanded to 100 columns covering: price, volume, valuation, profitability,
 * income statement, balance sheet, cash flow, dividends, all oscillators,
 * all moving averages, pivot points, performance, and volatility.
 */

import { recordCacheHit, recordCacheMiss } from "./cacheMetricsService";

const TV_SCANNER_URL = 'https://scanner.tradingview.com/uae/scan';

// ─── Column definitions (100 confirmed working columns) ─────────────

const PRICE_COLUMNS = [
  'name', 'description', 'logoid', 'exchange', 'type', 'sector', 'industry',
  'close', 'change', 'change_abs', 'volume', 'open', 'high', 'low',
  'market_cap_basic', 'High.All', 'Low.All',
];

const VOLUME_COLUMNS = [
  'average_volume_10d_calc', 'average_volume_30d_calc',
  'average_volume_60d_calc', 'average_volume_90d_calc',
];

const VALUATION_COLUMNS = [
  'price_earnings_ttm', 'price_sales_current', 'price_book_fq',
  'price_free_cash_flow_ttm', 'enterprise_value_fq', 'enterprise_value_ebitda_ttm',
];

const INCOME_COLUMNS = [
  'total_revenue', 'gross_profit', 'net_income',
  'earnings_per_share_basic_ttm', 'earnings_per_share_diluted_ttm',
  'ebitda', 'earnings_per_share_forecast_next_fq',
];

const BALANCE_SHEET_COLUMNS = [
  'total_assets', 'total_liabilities_fq', 'total_debt',
  'total_current_assets', 'total_shares_outstanding_fundamental',
  'total_current_liabilities_fq', 'long_term_debt_fq', 'short_term_debt_fq',
  'book_value_per_share_fq',
];

const CASH_FLOW_COLUMNS = [
  'free_cash_flow',
  'cash_f_operating_activities_ttm',
];

const PROFITABILITY_COLUMNS = [
  'gross_margin', 'operating_margin', 'pre_tax_margin', 'net_margin',
  'return_on_equity', 'return_on_assets', 'return_on_invested_capital',
];

const DIVIDEND_COLUMNS = [
  'dividends_yield', 'dps_common_stock_prim_issue_fy',
  'price_earnings_growth_ttm',
];

const RATIO_COLUMNS = [
  'current_ratio', 'quick_ratio', 'debt_to_equity',
  'number_of_employees',
];

// All oscillators
const OSCILLATOR_COLUMNS = [
  'RSI', 'RSI[1]', 'Stoch.K', 'Stoch.D', 'CCI20', 'ADX', 'AO', 'Mom',
  'MACD.macd', 'MACD.signal', 'BB.lower', 'BB.upper',
];

// All moving averages (SMA + EMA + special)
const MOVING_AVERAGE_COLUMNS = [
  'SMA5', 'SMA10', 'SMA20', 'SMA30', 'SMA50', 'SMA100', 'SMA200',
  'EMA5', 'EMA10', 'EMA20', 'EMA30', 'EMA50', 'EMA100', 'EMA200',
  'Ichimoku.BLine', 'VWMA', 'HullMA9',
];

// Pivot points
const PIVOT_COLUMNS = [
  'Pivot.M.Classic.S3', 'Pivot.M.Classic.S2', 'Pivot.M.Classic.S1',
  'Pivot.M.Classic.Middle',
  'Pivot.M.Classic.R1', 'Pivot.M.Classic.R2', 'Pivot.M.Classic.R3',
];

// Recommendations
const RECOMMENDATION_COLUMNS = [
  'Recommend.All', 'Recommend.Other', 'Recommend.MA',
];

// Performance
const PERFORMANCE_COLUMNS = [
  'Perf.W', 'Perf.1M', 'Perf.3M', 'Perf.6M', 'Perf.YTD', 'Perf.Y',
  'Perf.5Y', 'Perf.All',
];

// Volatility
const VOLATILITY_COLUMNS = [
  'Volatility.D', 'Volatility.W', 'Volatility.M', 'ATR', 'beta_1_year',
];

const ALL_COLUMNS = [
  ...PRICE_COLUMNS,
  ...VOLUME_COLUMNS,
  ...VALUATION_COLUMNS,
  ...INCOME_COLUMNS,
  ...BALANCE_SHEET_COLUMNS,
  ...CASH_FLOW_COLUMNS,
  ...PROFITABILITY_COLUMNS,
  ...DIVIDEND_COLUMNS,
  ...RATIO_COLUMNS,
  ...OSCILLATOR_COLUMNS,
  ...MOVING_AVERAGE_COLUMNS,
  ...PIVOT_COLUMNS,
  ...RECOMMENDATION_COLUMNS,
  ...PERFORMANCE_COLUMNS,
  ...VOLATILITY_COLUMNS,
];

// ─── Types ───────────────────────────────────────────────────────────

export interface TVStockData {
  // Identity
  ticker: string;
  name: string;
  description: string;
  logoId: string | null;
  exchange: string;
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

  // Volume Averages
  avgVolume10d: number | null;
  avgVolume30d: number | null;
  avgVolume60d: number | null;
  avgVolume90d: number | null;

  // Valuation
  pe: number | null;
  priceToSales: number | null;
  priceToBook: number | null;
  priceToFreeCashFlow: number | null;
  enterpriseValue: number | null;
  evToEbitda: number | null;

  // Income Statement
  totalRevenue: number | null;
  grossProfit: number | null;
  netIncome: number | null;
  eps: number | null;
  epsDiluted: number | null;
  ebitda: number | null;
  epsForecast: number | null;

  // Balance Sheet
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalDebt: number | null;
  totalCurrentAssets: number | null;
  sharesOutstanding: number | null;
  totalCurrentLiabilities: number | null;
  longTermDebt: number | null;
  shortTermDebt: number | null;
  bookValuePerShare: number | null;

  // Cash Flow
  freeCashFlow: number | null;
  operatingCashFlow: number | null;

  // Profitability
  grossMargin: number | null;
  operatingMargin: number | null;
  preTaxMargin: number | null;
  netMargin: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  returnOnInvestedCapital: number | null;

  // Dividends
  dividendYield: number | null;
  dividendPerShare: number | null;
  pegRatio: number | null;

  // Ratios
  currentRatio: number | null;
  quickRatio: number | null;
  debtToEquity: number | null;
  employees: number | null;

  // Oscillators
  rsi: number | null;
  rsiPrev: number | null;
  stochK: number | null;
  stochD: number | null;
  cci20: number | null;
  adx: number | null;
  awesomeOscillator: number | null;
  momentum: number | null;
  macdValue: number | null;
  macdSignal: number | null;
  bbLower: number | null;
  bbUpper: number | null;

  // Moving Averages
  sma5: number | null;
  sma10: number | null;
  sma20: number | null;
  sma30: number | null;
  sma50: number | null;
  sma100: number | null;
  sma200: number | null;
  ema5: number | null;
  ema10: number | null;
  ema20: number | null;
  ema30: number | null;
  ema50: number | null;
  ema100: number | null;
  ema200: number | null;
  ichimokuBaseLine: number | null;
  vwma: number | null;
  hullMA9: number | null;

  // Pivot Points
  pivotS3: number | null;
  pivotS2: number | null;
  pivotS1: number | null;
  pivotMiddle: number | null;
  pivotR1: number | null;
  pivotR2: number | null;
  pivotR3: number | null;

  // Recommendations
  recommendAll: number | null;
  recommendOscillators: number | null;
  recommendMA: number | null;

  // Performance
  perfWeek: number | null;
  perfMonth: number | null;
  perf3Month: number | null;
  perf6Month: number | null;
  perfYTD: number | null;
  perfYear: number | null;
  perf5Year: number | null;
  perfAllTime: number | null;

  // Volatility
  volatilityDay: number | null;
  volatilityWeek: number | null;
  volatilityMonth: number | null;
  atr: number | null;
  beta: number | null;
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
const CACHE_TTL = 5 * 60 * 1000;

// ─── Core Functions ──────────────────────────────────────────────────

function parseRow(ticker: string, values: any[]): TVStockData {
  let i = 0;
  const v = (idx: number) => values[idx] ?? null;

  return {
    ticker,
    // Identity (7)
    name: v(i++) as string,
    description: v(i++) as string,
    logoId: v(i++) as string | null,
    exchange: v(i++) as string,
    type: v(i++) as string,
    sector: v(i++) as string | null,
    industry: v(i++) as string | null,
    // Price (10)
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
    // Volume Averages (4)
    avgVolume10d: v(i++),
    avgVolume30d: v(i++),
    avgVolume60d: v(i++),
    avgVolume90d: v(i++),
    // Valuation (6)
    pe: v(i++),
    priceToSales: v(i++),
    priceToBook: v(i++),
    priceToFreeCashFlow: v(i++),
    enterpriseValue: v(i++),
    evToEbitda: v(i++),
    // Income Statement (7)
    totalRevenue: v(i++),
    grossProfit: v(i++),
    netIncome: v(i++),
    eps: v(i++),
    epsDiluted: v(i++),
    ebitda: v(i++),
    epsForecast: v(i++),
    // Balance Sheet (9)
    totalAssets: v(i++),
    totalLiabilities: v(i++),
    totalDebt: v(i++),
    totalCurrentAssets: v(i++),
    sharesOutstanding: v(i++),
    totalCurrentLiabilities: v(i++),
    longTermDebt: v(i++),
    shortTermDebt: v(i++),
    bookValuePerShare: v(i++),
    // Cash Flow (2)
    freeCashFlow: v(i++),
    operatingCashFlow: v(i++),
    // Profitability (7)
    grossMargin: v(i++),
    operatingMargin: v(i++),
    preTaxMargin: v(i++),
    netMargin: v(i++),
    returnOnEquity: v(i++),
    returnOnAssets: v(i++),
    returnOnInvestedCapital: v(i++),
    // Dividends (3)
    dividendYield: v(i++),
    dividendPerShare: v(i++),
    pegRatio: v(i++),
    // Ratios (4)
    currentRatio: v(i++),
    quickRatio: v(i++),
    debtToEquity: v(i++),
    employees: v(i++),
    // Oscillators (12)
    rsi: v(i++),
    rsiPrev: v(i++),
    stochK: v(i++),
    stochD: v(i++),
    cci20: v(i++),
    adx: v(i++),
    awesomeOscillator: v(i++),
    momentum: v(i++),
    macdValue: v(i++),
    macdSignal: v(i++),
    bbLower: v(i++),
    bbUpper: v(i++),
    // Moving Averages (17)
    sma5: v(i++),
    sma10: v(i++),
    sma20: v(i++),
    sma30: v(i++),
    sma50: v(i++),
    sma100: v(i++),
    sma200: v(i++),
    ema5: v(i++),
    ema10: v(i++),
    ema20: v(i++),
    ema30: v(i++),
    ema50: v(i++),
    ema100: v(i++),
    ema200: v(i++),
    ichimokuBaseLine: v(i++),
    vwma: v(i++),
    hullMA9: v(i++),
    // Pivot Points (7)
    pivotS3: v(i++),
    pivotS2: v(i++),
    pivotS1: v(i++),
    pivotMiddle: v(i++),
    pivotR1: v(i++),
    pivotR2: v(i++),
    pivotR3: v(i++),
    // Recommendations (3)
    recommendAll: v(i++),
    recommendOscillators: v(i++),
    recommendMA: v(i++),
    // Performance (8)
    perfWeek: v(i++),
    perfMonth: v(i++),
    perf3Month: v(i++),
    perf6Month: v(i++),
    perfYTD: v(i++),
    perfYear: v(i++),
    perf5Year: v(i++),
    perfAllTime: v(i++),
    // Volatility (5)
    volatilityDay: v(i++),
    volatilityWeek: v(i++),
    volatilityMonth: v(i++),
    atr: v(i++),
    beta: v(i++),
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
 * Get signal for an oscillator value
 */
export function getOscillatorSignal(name: string, value: number | null, close?: number | null): 'Buy' | 'Sell' | 'Neutral' {
  if (value === null) return 'Neutral';
  switch (name) {
    case 'RSI':
      return value < 30 ? 'Buy' : value > 70 ? 'Sell' : 'Neutral';
    case 'Stoch.K':
      return value < 20 ? 'Buy' : value > 80 ? 'Sell' : 'Neutral';
    case 'CCI20':
      return value < -100 ? 'Buy' : value > 100 ? 'Sell' : 'Neutral';
    case 'ADX':
      return value > 25 ? 'Buy' : 'Neutral';
    case 'AO':
      return value > 0 ? 'Buy' : 'Sell';
    case 'Mom':
      return value > 0 ? 'Buy' : 'Sell';
    case 'MACD':
      return value > 0 ? 'Buy' : 'Sell';
    default:
      return 'Neutral';
  }
}

/**
 * Get signal for a moving average
 */
export function getMASignal(maValue: number | null, close: number | null): 'Buy' | 'Sell' | 'Neutral' {
  if (maValue === null || close === null) return 'Neutral';
  return close > maValue ? 'Buy' : 'Sell';
}

/**
 * Fetch all UAE stocks from TradingView Scanner
 */
export async function fetchAllTVStocks(): Promise<TVStockData[]> {
  if (cachedData.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL) {
    recordCacheHit("tradingview");
    return cachedData;
  }
  recordCacheMiss("tradingview");

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
      return cachedData;
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
