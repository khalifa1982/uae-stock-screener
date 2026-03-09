/**
 * TradingView Extended Data Service
 * Fetches additional financial data columns not in the main scanner:
 * - Forecast/Analyst data (price targets, EPS estimates, recommendations)
 * - Extended financial metrics (margins TTM, revenue breakdown)
 * - Performance & Volatility data
 * - Ownership data (float shares)
 */

const TV_SCANNER_URL = 'https://scanner.tradingview.com/uae/scan';

// ─── Extended Column Groups ─────────────────────────────────────────

const FORECAST_COLUMNS = [
  'name', 'description',
  'price_target_median', 'price_target_high', 'price_target_low',
  'recommendation_mark',
  'earnings_per_share_forecast_next_fq', 'revenue_forecast_next_fq',
  'earnings_per_share_fq', 'earnings_per_share_forecast_fq',
  'eps_surprise_fq', 'eps_surprise_percent_fq',
  'revenue_forecast_fq',
];

const EXTENDED_FINANCIAL_COLUMNS = [
  'name',
  // FY data
  'total_revenue_fy', 'gross_profit_fy', 'net_income_fy', 'ebitda_fy',
  // FQ data
  'total_revenue_fq', 'gross_profit_fq', 'net_income_fq', 'ebitda_fq',
  // TTM margins
  'gross_margin_ttm', 'operating_margin_ttm', 'net_margin_ttm',
  'after_tax_margin', 'pre_tax_margin',
  // Returns
  'return_on_equity', 'return_on_assets', 'return_on_invested_capital',
  // Valuation
  'price_earnings_ttm', 'price_sales_ratio', 'price_book_ratio',
  'price_free_cash_flow_ttm', 'enterprise_value_ebitda_ttm', 'enterprise_value_fq',
  // Dividends
  'dividends_yield', 'dps_common_stock_prim_issue_fy',
  'dividend_payout_ratio_ttm', 'dividend_yield_recent',
  // Ownership
  'float_shares_outstanding', 'shares_outstanding',
  // Employees
  'number_of_employees',
];

const PERFORMANCE_COLUMNS = [
  'name',
  'Perf.W', 'Perf.1M', 'Perf.3M', 'Perf.6M', 'Perf.YTD', 'Perf.Y',
  'Perf.5Y', 'Perf.All',
  'Volatility.D', 'Volatility.W', 'Volatility.M',
  'beta_1_year',
];

// ─── Types ──────────────────────────────────────────────────────────

export interface TVForecastData {
  symbol: string;
  name: string;
  priceTargetMedian: number | null;
  priceTargetHigh: number | null;
  priceTargetLow: number | null;
  recommendationMark: number | null; // 1=Strong Buy, 2=Buy, 3=Hold, 4=Sell, 5=Strong Sell
  epsForecastNextFQ: number | null;
  revenueForecastNextFQ: number | null;
  epsActualFQ: number | null;
  epsForecastFQ: number | null;
  epsSurpriseFQ: number | null;
  epsSurprisePercentFQ: number | null;
  revenueForecastFQ: number | null;
}

export interface TVExtendedFinancials {
  symbol: string;
  // Annual
  revenueAnnual: number | null;
  grossProfitAnnual: number | null;
  netIncomeAnnual: number | null;
  ebitdaAnnual: number | null;
  // Quarterly
  revenueQuarterly: number | null;
  grossProfitQuarterly: number | null;
  netIncomeQuarterly: number | null;
  ebitdaQuarterly: number | null;
  // TTM Margins
  grossMarginTTM: number | null;
  operatingMarginTTM: number | null;
  netMarginTTM: number | null;
  afterTaxMargin: number | null;
  preTaxMargin: number | null;
  // Returns
  roe: number | null;
  roa: number | null;
  roic: number | null;
  // Valuation
  peTTM: number | null;
  psRatio: number | null;
  pbRatio: number | null;
  pFCF: number | null;
  evEbitda: number | null;
  enterpriseValue: number | null;
  // Dividends
  dividendYield: number | null;
  dpsAnnual: number | null;
  payoutRatioTTM: number | null;
  dividendYieldRecent: number | null;
  // Ownership
  floatShares: number | null;
  sharesOutstanding: number | null;
  // Employees
  employees: number | null;
}

export interface TVPerformanceData {
  symbol: string;
  perfWeek: number | null;
  perfMonth: number | null;
  perf3Month: number | null;
  perf6Month: number | null;
  perfYTD: number | null;
  perfYear: number | null;
  perf5Year: number | null;
  perfAll: number | null;
  volatilityDay: number | null;
  volatilityWeek: number | null;
  volatilityMonth: number | null;
  beta: number | null;
}

// ─── Cache ──────────────────────────────────────────────────────────

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data as T;
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

// ─── Fetch Functions ────────────────────────────────────────────────

async function scannerFetch(columns: string[], tickers: string[]): Promise<any[]> {
  try {
    const resp = await fetch(TV_SCANNER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbols: { tickers, query: { types: [] } },
        columns,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!resp.ok) return [];
    const data = await resp.json() as any;
    return data.data || [];
  } catch (e: any) {
    console.warn('[TVExtended] Scanner fetch failed:', e.message);
    return [];
  }
}

/**
 * Fetch forecast/analyst data for a stock
 */
export async function fetchTVForecast(symbol: string, exchange: string): Promise<TVForecastData | null> {
  const ticker = `${exchange}:${symbol}`;
  const cacheKey = `forecast-${ticker}`;
  const cached = getCached<TVForecastData>(cacheKey);
  if (cached) return cached;

  const rows = await scannerFetch(FORECAST_COLUMNS, [ticker]);
  if (rows.length === 0) return null;

  const d = rows[0].d;
  let i = 0;
  const v = (idx: number) => d[idx] ?? null;

  const result: TVForecastData = {
    symbol,
    name: v(i++) as string,
    priceTargetMedian: (i++, v(i - 1)), // skip description
    priceTargetHigh: v(i++),
    priceTargetLow: v(i++),
    recommendationMark: v(i++),
    epsForecastNextFQ: v(i++),
    revenueForecastNextFQ: v(i++),
    epsActualFQ: v(i++),
    epsForecastFQ: v(i++),
    epsSurpriseFQ: v(i++),
    epsSurprisePercentFQ: v(i++),
    revenueForecastFQ: v(i++),
  };

  // Fix: skip description properly
  const result2: TVForecastData = {
    symbol,
    name: d[0] as string,
    priceTargetMedian: d[2] ?? null,
    priceTargetHigh: d[3] ?? null,
    priceTargetLow: d[4] ?? null,
    recommendationMark: d[5] ?? null,
    epsForecastNextFQ: d[6] ?? null,
    revenueForecastNextFQ: d[7] ?? null,
    epsActualFQ: d[8] ?? null,
    epsForecastFQ: d[9] ?? null,
    epsSurpriseFQ: d[10] ?? null,
    epsSurprisePercentFQ: d[11] ?? null,
    revenueForecastFQ: d[12] ?? null,
  };

  setCache(cacheKey, result2);
  return result2;
}

/**
 * Fetch extended financial data for a stock
 */
export async function fetchTVExtendedFinancials(symbol: string, exchange: string): Promise<TVExtendedFinancials | null> {
  const ticker = `${exchange}:${symbol}`;
  const cacheKey = `ext-fin-${ticker}`;
  const cached = getCached<TVExtendedFinancials>(cacheKey);
  if (cached) return cached;

  const rows = await scannerFetch(EXTENDED_FINANCIAL_COLUMNS, [ticker]);
  if (rows.length === 0) return null;

  const d = rows[0].d;
  const result: TVExtendedFinancials = {
    symbol,
    revenueAnnual: d[1] ?? null,
    grossProfitAnnual: d[2] ?? null,
    netIncomeAnnual: d[3] ?? null,
    ebitdaAnnual: d[4] ?? null,
    revenueQuarterly: d[5] ?? null,
    grossProfitQuarterly: d[6] ?? null,
    netIncomeQuarterly: d[7] ?? null,
    ebitdaQuarterly: d[8] ?? null,
    grossMarginTTM: d[9] ?? null,
    operatingMarginTTM: d[10] ?? null,
    netMarginTTM: d[11] ?? null,
    afterTaxMargin: d[12] ?? null,
    preTaxMargin: d[13] ?? null,
    roe: d[14] ?? null,
    roa: d[15] ?? null,
    roic: d[16] ?? null,
    peTTM: d[17] ?? null,
    psRatio: d[18] ?? null,
    pbRatio: d[19] ?? null,
    pFCF: d[20] ?? null,
    evEbitda: d[21] ?? null,
    enterpriseValue: d[22] ?? null,
    dividendYield: d[23] ?? null,
    dpsAnnual: d[24] ?? null,
    payoutRatioTTM: d[25] ?? null,
    dividendYieldRecent: d[26] ?? null,
    floatShares: d[27] ?? null,
    sharesOutstanding: d[28] ?? null,
    employees: d[29] ?? null,
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Fetch performance data for a stock
 */
export async function fetchTVPerformance(symbol: string, exchange: string): Promise<TVPerformanceData | null> {
  const ticker = `${exchange}:${symbol}`;
  const cacheKey = `perf-${ticker}`;
  const cached = getCached<TVPerformanceData>(cacheKey);
  if (cached) return cached;

  const rows = await scannerFetch(PERFORMANCE_COLUMNS, [ticker]);
  if (rows.length === 0) return null;

  const d = rows[0].d;
  const result: TVPerformanceData = {
    symbol,
    perfWeek: d[1] ?? null,
    perfMonth: d[2] ?? null,
    perf3Month: d[3] ?? null,
    perf6Month: d[4] ?? null,
    perfYTD: d[5] ?? null,
    perfYear: d[6] ?? null,
    perf5Year: d[7] ?? null,
    perfAll: d[8] ?? null,
    volatilityDay: d[9] ?? null,
    volatilityWeek: d[10] ?? null,
    volatilityMonth: d[11] ?? null,
    beta: d[12] ?? null,
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Compute seasonality from Yahoo Finance historical data
 * Returns average monthly returns over the past N years
 */
export function computeSeasonality(
  chartData: Array<{ date: string; close: number }>
): Array<{ month: string; avgReturn: number; years: number[] }> {
  if (!chartData || chartData.length < 30) return [];

  // Group by year-month
  const monthlyReturns: Record<number, number[]> = {};
  for (let m = 0; m < 12; m++) monthlyReturns[m] = [];

  // Calculate monthly returns
  let prevClose: number | null = null;
  let prevMonth: number | null = null;

  for (const point of chartData) {
    const date = new Date(point.date);
    const month = date.getMonth();

    if (prevClose !== null && prevMonth !== null && month !== prevMonth) {
      const ret = ((point.close - prevClose) / prevClose) * 100;
      monthlyReturns[prevMonth].push(ret);
    }

    prevClose = point.close;
    prevMonth = month;
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return monthNames.map((name, i) => {
    const returns = monthlyReturns[i] || [];
    const avg = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    return {
      month: name,
      avgReturn: Math.round(avg * 100) / 100,
      years: returns.map(r => Math.round(r * 100) / 100),
    };
  });
}

/**
 * Get recommendation label from TradingView recommendation_mark
 * 1=Strong Buy, 2=Buy, 3=Hold, 4=Sell, 5=Strong Sell
 */
export function getRecommendationFromMark(mark: number | null): string {
  if (mark === null) return 'N/A';
  if (mark <= 1.5) return 'Strong Buy';
  if (mark <= 2.5) return 'Buy';
  if (mark <= 3.5) return 'Hold';
  if (mark <= 4.5) return 'Sell';
  return 'Strong Sell';
}
