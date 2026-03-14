/**
 * API Status Service
 * Aggregates health checks and statistics from all data sources:
 * - TwelveData (API key)
 * - TradingView (free scanner API)
 * - Scrapfly.io (web scraping proxy)
 * - StockAnalysis.com (via Scrapfly)
 * - MarketScreener.com (via Scrapfly)
 * - Investing.com (via Scrapfly)
 * - SimplyWall.St (direct scraping)
 */

import { checkTwelveDataHealth, getTwelveDataStats } from './twelveDataService';
import { checkTradingViewHealth, getTradingViewStats } from './tradingViewService';
import { ENV } from '../_core/env';

export interface ApiSourceInfo {
  id: string;
  name: string;
  description: string;
  website: string;
  type: 'api-key' | 'free-api' | 'web-scraping' | 'built-in';
  status: 'connected' | 'disconnected' | 'error' | 'checking' | 'limited';
  statusMessage: string | null;
  lastChecked: string | null;
  lastSuccessfulFetch: string | null;
  totalRequests: number;
  failedRequests: number;
  successRate: string;
  features: string[];
  dataProvided: string[];
  requiresApiKey: boolean;
  apiKeyConfigured: boolean;
  stocksCovered: number;
  extra: Record<string, any>;
}

export interface ApiStatusDashboard {
  sources: ApiSourceInfo[];
  totalSources: number;
  connectedSources: number;
  lastFullCheck: string;
  overallHealth: 'healthy' | 'degraded' | 'critical';
}

// ─── Scrapfly Health Check ──────────────────────────────────────────

let scrapflyStats = {
  totalRequests: 0,
  failedRequests: 0,
  lastSuccessfulFetch: null as string | null,
  lastChecked: null as string | null,
  connected: false,
  error: null as string | null,
  remainingCredits: null as number | null,
};

async function checkScrapflyHealth() {
  const apiKey = ENV.scrapflyApiKey;
  if (!apiKey) {
    scrapflyStats.connected = false;
    scrapflyStats.error = 'API key not configured';
    scrapflyStats.lastChecked = new Date().toISOString();
    return scrapflyStats;
  }

  try {
    const res = await fetch(`https://api.scrapfly.io/account?key=${apiKey}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      scrapflyStats.connected = true;
      scrapflyStats.error = null;
      scrapflyStats.lastSuccessfulFetch = new Date().toISOString();
      scrapflyStats.remainingCredits = data?.subscription?.usage?.scrape?.remaining ?? null;
      scrapflyStats.totalRequests++;
    } else {
      scrapflyStats.connected = false;
      scrapflyStats.error = `HTTP ${res.status}`;
      scrapflyStats.failedRequests++;
    }
  } catch (e: any) {
    scrapflyStats.connected = false;
    scrapflyStats.error = e.message || 'Connection failed';
    scrapflyStats.failedRequests++;
  }
  scrapflyStats.lastChecked = new Date().toISOString();
  return scrapflyStats;
}

// ─── StockAnalysis.com Health Check ─────────────────────────────────

let saStats = {
  totalRequests: 0,
  failedRequests: 0,
  lastSuccessfulFetch: null as string | null,
  lastChecked: null as string | null,
  connected: false,
  error: null as string | null,
};

async function checkStockAnalysisHealth() {
  const apiKey = ENV.scrapflyApiKey;
  if (!apiKey) {
    saStats.connected = false;
    saStats.error = 'Scrapfly API key required';
    saStats.lastChecked = new Date().toISOString();
    return saStats;
  }

  try {
    const url = `https://api.scrapfly.io/scrape?key=${apiKey}&url=${encodeURIComponent('https://stockanalysis.com/quote/dfm/EMAAR/')}&render_js=false&asp=true&country=us`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (res.ok) {
      saStats.connected = true;
      saStats.error = null;
      saStats.lastSuccessfulFetch = new Date().toISOString();
      saStats.totalRequests++;
    } else {
      saStats.connected = false;
      saStats.error = `HTTP ${res.status}`;
      saStats.failedRequests++;
    }
  } catch (e: any) {
    saStats.connected = false;
    saStats.error = e.message || 'Connection failed';
    saStats.failedRequests++;
  }
  saStats.lastChecked = new Date().toISOString();
  return saStats;
}

// ─── MarketScreener.com Health Check ────────────────────────────────

let msStats = {
  totalRequests: 0,
  failedRequests: 0,
  lastSuccessfulFetch: null as string | null,
  lastChecked: null as string | null,
  connected: false,
  error: null as string | null,
};

async function checkMarketScreenerHealth() {
  const apiKey = ENV.scrapflyApiKey;
  if (!apiKey) {
    msStats.connected = false;
    msStats.error = 'Scrapfly API key required';
    msStats.lastChecked = new Date().toISOString();
    return msStats;
  }

  try {
    const url = `https://api.scrapfly.io/scrape?key=${apiKey}&url=${encodeURIComponent('https://www.marketscreener.com/')}&render_js=false&asp=true&country=us`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (res.ok) {
      msStats.connected = true;
      msStats.error = null;
      msStats.lastSuccessfulFetch = new Date().toISOString();
      msStats.totalRequests++;
    } else {
      msStats.connected = false;
      msStats.error = `HTTP ${res.status}`;
      msStats.failedRequests++;
    }
  } catch (e: any) {
    msStats.connected = false;
    msStats.error = e.message || 'Connection failed';
    msStats.failedRequests++;
  }
  msStats.lastChecked = new Date().toISOString();
  return msStats;
}

// ─── Investing.com Health Check ─────────────────────────────────────

let invStats = {
  totalRequests: 0,
  failedRequests: 0,
  lastSuccessfulFetch: null as string | null,
  lastChecked: null as string | null,
  connected: false,
  error: null as string | null,
};

async function checkInvestingComHealth() {
  const apiKey = ENV.scrapflyApiKey;
  if (!apiKey) {
    invStats.connected = false;
    invStats.error = 'Scrapfly API key required';
    invStats.lastChecked = new Date().toISOString();
    return invStats;
  }

  try {
    const url = `https://api.scrapfly.io/scrape?key=${apiKey}&url=${encodeURIComponent('https://www.investing.com/')}&render_js=false&asp=true&country=us`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (res.ok) {
      invStats.connected = true;
      invStats.error = null;
      invStats.lastSuccessfulFetch = new Date().toISOString();
      invStats.totalRequests++;
    } else {
      invStats.connected = false;
      invStats.error = `HTTP ${res.status}`;
      invStats.failedRequests++;
    }
  } catch (e: any) {
    invStats.connected = false;
    invStats.error = e.message || 'Connection failed';
    invStats.failedRequests++;
  }
  invStats.lastChecked = new Date().toISOString();
  return invStats;
}

// ─── SimplyWall.St Health Check ─────────────────────────────────────

let swsStats = {
  totalRequests: 0,
  failedRequests: 0,
  lastSuccessfulFetch: null as string | null,
  lastChecked: null as string | null,
  connected: false,
  error: null as string | null,
};

async function checkSimplyWallStHealth() {
  try {
    const res = await fetch('https://simplywall.st/stocks/ae/diversified-financials/dfm-emaar/emaar-properties-pjsc-shares', {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (res.ok) {
      swsStats.connected = true;
      swsStats.error = null;
      swsStats.lastSuccessfulFetch = new Date().toISOString();
      swsStats.totalRequests++;
    } else {
      swsStats.connected = false;
      swsStats.error = `HTTP ${res.status}`;
      swsStats.failedRequests++;
    }
  } catch (e: any) {
    swsStats.connected = false;
    swsStats.error = e.message || 'Connection failed';
    swsStats.failedRequests++;
  }
  swsStats.lastChecked = new Date().toISOString();
  return swsStats;
}

// ─── Main Health Check ──────────────────────────────────────────────

/**
 * Run health checks on all data sources
 */
export async function checkAllApiHealth(): Promise<ApiStatusDashboard> {
  const [twelveData, tradingView, scrapfly, stockAnalysis, marketScreener, investingCom, simplyWallSt] = await Promise.allSettled([
    checkTwelveDataHealth(),
    checkTradingViewHealth(),
    checkScrapflyHealth(),
    checkStockAnalysisHealth(),
    checkMarketScreenerHealth(),
    checkInvestingComHealth(),
    checkSimplyWallStHealth(),
  ]);

  const tdStats = getTwelveDataStats();
  const tvStats = getTradingViewStats();

  const tdStatus = twelveData.status === 'fulfilled' ? twelveData.value : null;
  const tvStatus = tradingView.status === 'fulfilled' ? tradingView.value : null;
  const sfStatus = scrapfly.status === 'fulfilled' ? scrapfly.value : scrapflyStats;
  const saStatus = stockAnalysis.status === 'fulfilled' ? stockAnalysis.value : saStats;
  const msStatus = marketScreener.status === 'fulfilled' ? marketScreener.value : msStats;
  const invStatus = investingCom.status === 'fulfilled' ? investingCom.value : invStats;
  const swsStatus = simplyWallSt.status === 'fulfilled' ? simplyWallSt.value : swsStats;

  const sources: ApiSourceInfo[] = [
    // ── TwelveData ──
    {
      id: 'twelvedata',
      name: 'TwelveData',
      description: 'Real-time and historical market data API. Provides stock quotes, fundamentals (income statement, balance sheet, cash flow), and 100+ technical indicators for global markets including UAE (ADX & DFM).',
      website: 'https://twelvedata.com',
      type: 'api-key',
      status: tdStatus?.connected ? 'connected' : tdStatus?.apiKeyValid === false ? 'error' : 'disconnected',
      statusMessage: tdStatus?.error || null,
      lastChecked: tdStatus?.lastChecked || null,
      lastSuccessfulFetch: tdStats.lastSuccessfulFetch,
      totalRequests: tdStats.totalRequests,
      failedRequests: tdStats.failedRequests,
      successRate: tdStats.successRate,
      features: ['Real-time Quotes', 'Historical Data', 'Technical Indicators (100+)', 'Fundamentals', 'WebSocket Streaming'],
      dataProvided: ['Stock Prices', 'OHLCV Data', 'Income Statement', 'Balance Sheet', 'Cash Flow', 'RSI', 'MACD', 'SMA', 'EMA', 'Bollinger Bands'],
      requiresApiKey: true,
      apiKeyConfigured: !!process.env.TWELVEDATA_API_KEY,
      stocksCovered: 174,
      extra: {
        plan: tdStatus?.plan || 'Unknown',
        dailyUsage: tdStatus?.dailyUsage,
        dailyLimit: tdStatus?.dailyLimit,
      },
    },

    // ── TradingView ──
    {
      id: 'tradingview',
      name: 'TradingView',
      description: 'Free scanner API providing real-time technical analysis, recommendations (buy/sell/hold), fundamentals, and performance metrics for all 174 UAE stocks on ADX and DFM exchanges.',
      website: 'https://tradingview.com',
      type: 'free-api',
      status: tvStatus?.connected ? 'connected' : 'disconnected',
      statusMessage: tvStatus?.error || null,
      lastChecked: tvStatus?.lastChecked || null,
      lastSuccessfulFetch: tvStatus?.lastSuccessfulFetch || tvStats.status.lastSuccessfulFetch,
      totalRequests: tvStats.totalRequests,
      failedRequests: tvStats.failedRequests,
      successRate: tvStats.successRate,
      features: ['Technical Analysis', 'Recommendations', 'Fundamentals', 'Performance Metrics', 'Sector/Industry Data'],
      dataProvided: [
        'Price & Volume', 'Market Cap', 'P/E Ratio', 'EPS', 'Dividend Yield',
        'ROE', 'Debt/Equity', 'RSI', 'MACD', 'Stochastic', 'ADX', 'CCI',
        'Bollinger Bands', 'SMA (20/50/200)', 'EMA (20/50/200)',
        'Buy/Sell Recommendations', 'Weekly/Monthly/Yearly Performance',
        'Total Revenue', 'Net Income', 'Total Assets', 'EBITDA', 'Free Cash Flow',
      ],
      requiresApiKey: false,
      apiKeyConfigured: true,
      stocksCovered: tvStatus?.stockCount || 174,
      extra: {
        cacheAge: tvStats.cacheAge,
        cachedStocks: tvStats.cachedStocks,
      },
    },

    // ── Scrapfly.io ──
    {
      id: 'scrapfly',
      name: 'Scrapfly.io',
      description: 'Web scraping proxy service that powers data extraction from StockAnalysis.com, MarketScreener.com, and Investing.com. Provides anti-bot bypass, JavaScript rendering, and residential proxies.',
      website: 'https://scrapfly.io',
      type: 'api-key',
      status: sfStatus.connected ? 'connected' : 'disconnected',
      statusMessage: sfStatus.error,
      lastChecked: sfStatus.lastChecked,
      lastSuccessfulFetch: sfStatus.lastSuccessfulFetch,
      totalRequests: sfStatus.totalRequests,
      failedRequests: sfStatus.failedRequests,
      successRate: sfStatus.totalRequests > 0
        ? `${(((sfStatus.totalRequests - sfStatus.failedRequests) / sfStatus.totalRequests) * 100).toFixed(1)}%`
        : '—',
      features: ['Anti-Bot Bypass (ASP)', 'JavaScript Rendering', 'Residential Proxies', 'Country Targeting', 'Rate Limiting'],
      dataProvided: ['Proxy for StockAnalysis.com', 'Proxy for MarketScreener.com', 'Proxy for Investing.com'],
      requiresApiKey: true,
      apiKeyConfigured: !!ENV.scrapflyApiKey,
      stocksCovered: 174,
      extra: {
        remainingCredits: sfStatus.remainingCredits,
        role: 'Scraping Proxy',
      },
    },

    // ── StockAnalysis.com ──
    {
      id: 'stockanalysis',
      name: 'StockAnalysis.com',
      description: 'Comprehensive financial data source providing full Income Statement, Balance Sheet, Cash Flow Statement, and Financial Ratios for UAE stocks. Multi-year historical data with quarterly and annual breakdowns.',
      website: 'https://stockanalysis.com',
      type: 'web-scraping',
      status: saStatus.connected ? 'connected' : 'disconnected',
      statusMessage: saStatus.error,
      lastChecked: saStatus.lastChecked,
      lastSuccessfulFetch: saStatus.lastSuccessfulFetch,
      totalRequests: saStatus.totalRequests,
      failedRequests: saStatus.failedRequests,
      successRate: saStatus.totalRequests > 0
        ? `${(((saStatus.totalRequests - saStatus.failedRequests) / saStatus.totalRequests) * 100).toFixed(1)}%`
        : '—',
      features: ['Income Statement (Annual/Quarterly)', 'Balance Sheet (Annual/Quarterly)', 'Cash Flow (Annual/Quarterly)', 'Financial Ratios', 'Dividend History', 'Company Profile'],
      dataProvided: [
        'Revenue', 'Net Income', 'EPS', 'EBITDA', 'Gross Profit', 'Operating Income',
        'Total Assets', 'Total Liabilities', 'Shareholders Equity', 'Total Debt', 'Cash & Equivalents',
        'Operating Cash Flow', 'CapEx', 'Free Cash Flow', 'Dividends Paid',
        'P/E', 'P/B', 'P/S', 'EV/EBITDA', 'PEG', 'ROE', 'ROA', 'Profit Margin',
        'Dividend Yield', 'Payout Ratio', 'Ex-Dividend Date',
      ],
      requiresApiKey: false,
      apiKeyConfigured: true,
      stocksCovered: 170,
      extra: {
        scrapingVia: 'Scrapfly.io',
        cacheTTL: '24 hours',
        dataFormat: 'Structured JSON (embedded in HTML)',
      },
    },

    // ── MarketScreener.com ──
    {
      id: 'marketscreener',
      name: 'MarketScreener.com',
      description: 'European financial data platform providing institutional ownership data, analyst consensus ratings, target prices, and ESG (MSCI) ratings for UAE-listed companies.',
      website: 'https://www.marketscreener.com',
      type: 'web-scraping',
      status: msStatus.connected ? 'connected' : 'disconnected',
      statusMessage: msStatus.error,
      lastChecked: msStatus.lastChecked,
      lastSuccessfulFetch: msStatus.lastSuccessfulFetch,
      totalRequests: msStatus.totalRequests,
      failedRequests: msStatus.failedRequests,
      successRate: msStatus.totalRequests > 0
        ? `${(((msStatus.totalRequests - msStatus.failedRequests) / msStatus.totalRequests) * 100).toFixed(1)}%`
        : '—',
      features: ['Ownership & Shareholders', 'Analyst Consensus', 'Target Price', 'ESG MSCI Rating', 'Geographic Distribution'],
      dataProvided: [
        'Top Shareholders (Name, %)', 'Ownership Breakdown (Institutional, Government, Public)',
        'Geographic Distribution', 'Analyst Consensus (Buy/Hold/Sell)',
        'Target Price & Spread', 'Number of Analysts',
        'ESG MSCI Rating (AAA to CCC)', 'Revenue/EPS Estimates',
      ],
      requiresApiKey: false,
      apiKeyConfigured: true,
      stocksCovered: 150,
      extra: {
        scrapingVia: 'Scrapfly.io',
        cacheTTL: '24 hours',
        urlResolution: 'Search-based slug resolver',
      },
    },

    // ── Investing.com ──
    {
      id: 'investingcom',
      name: 'Investing.com',
      description: 'Global financial portal providing dividend details (yield, ex-date, payment date, history), analyst ratings, earnings calendar, and technical analysis for UAE stocks.',
      website: 'https://www.investing.com',
      type: 'web-scraping',
      status: invStatus.connected ? 'connected' : 'disconnected',
      statusMessage: invStatus.error,
      lastChecked: invStatus.lastChecked,
      lastSuccessfulFetch: invStatus.lastSuccessfulFetch,
      totalRequests: invStatus.totalRequests,
      failedRequests: invStatus.failedRequests,
      successRate: invStatus.totalRequests > 0
        ? `${(((invStatus.totalRequests - invStatus.failedRequests) / invStatus.totalRequests) * 100).toFixed(1)}%`
        : '—',
      features: ['Dividend Details', 'Analyst Ratings', 'Earnings Calendar', 'Technical Analysis', 'Price Targets'],
      dataProvided: [
        'Dividend Yield', 'Ex-Dividend Date', 'Payment Date', 'Dividend History',
        'Analyst Rating (Buy/Hold/Sell)', '12-Month Target Price',
        'Next Earnings Date', 'EPS Actual vs Estimate',
      ],
      requiresApiKey: false,
      apiKeyConfigured: true,
      stocksCovered: 160,
      extra: {
        scrapingVia: 'Scrapfly.io',
        cacheTTL: '24 hours',
        urlResolution: 'Search-based slug resolver',
      },
    },

    // ── SimplyWall.St ──
    {
      id: 'simplywall',
      name: 'SimplyWall.St',
      description: 'Visual stock analysis platform providing snowflake scores (Value, Future, Past, Health, Dividend), fair value estimates, risk assessments, and company narratives for UAE stocks.',
      website: 'https://simplywall.st',
      type: 'web-scraping',
      status: swsStatus.connected ? 'connected' : 'disconnected',
      statusMessage: swsStatus.error,
      lastChecked: swsStatus.lastChecked,
      lastSuccessfulFetch: swsStatus.lastSuccessfulFetch,
      totalRequests: swsStatus.totalRequests,
      failedRequests: swsStatus.failedRequests,
      successRate: swsStatus.totalRequests > 0
        ? `${(((swsStatus.totalRequests - swsStatus.failedRequests) / swsStatus.totalRequests) * 100).toFixed(1)}%`
        : '—',
      features: ['Snowflake Scores', 'Fair Value Estimate', 'Risk Assessment', 'Company Narrative', 'Peer Comparison'],
      dataProvided: [
        'Value Score', 'Future Score', 'Past Score', 'Health Score', 'Dividend Score',
        'Fair Value (AED)', 'Undervalued/Overvalued %',
        'Risk Level', 'Risk Count', 'Company Summary',
      ],
      requiresApiKey: false,
      apiKeyConfigured: true,
      stocksCovered: 170,
      extra: {
        scrapingVia: 'Direct (no proxy needed)',
        cacheTTL: '24 hours',
        dataFormat: 'Next.js __NEXT_DATA__ JSON',
      },
    },
  ];

  const connectedSources = sources.filter(s => s.status === 'connected').length;
  const overallHealth: 'healthy' | 'degraded' | 'critical' =
    connectedSources >= 5 ? 'healthy' :
    connectedSources >= 3 ? 'degraded' :
    'critical';

  return {
    sources,
    totalSources: sources.length,
    connectedSources,
    lastFullCheck: new Date().toISOString(),
    overallHealth,
  };
}

/**
 * Get cached status without running health checks
 */
export function getApiStatusSnapshot(): ApiStatusDashboard {
  const tdStats = getTwelveDataStats();
  const tvStats = getTradingViewStats();

  const sources: ApiSourceInfo[] = [
    {
      id: 'twelvedata',
      name: 'TwelveData',
      description: 'Real-time market data, fundamentals, and technical indicators API',
      website: 'https://twelvedata.com',
      type: 'api-key',
      status: tdStats.status.connected ? 'connected' : 'disconnected',
      statusMessage: tdStats.status.error,
      lastChecked: tdStats.status.lastChecked,
      lastSuccessfulFetch: tdStats.lastSuccessfulFetch,
      totalRequests: tdStats.totalRequests,
      failedRequests: tdStats.failedRequests,
      successRate: tdStats.successRate,
      features: ['Real-time Quotes', 'Historical Data', 'Technical Indicators', 'Fundamentals'],
      dataProvided: ['Stock Prices', 'Income Statement', 'Balance Sheet', 'Cash Flow', 'Technical Indicators'],
      requiresApiKey: true,
      apiKeyConfigured: !!process.env.TWELVEDATA_API_KEY,
      stocksCovered: 174,
      extra: {},
    },
    {
      id: 'tradingview',
      name: 'TradingView',
      description: 'Free scanner API for technical analysis and recommendations',
      website: 'https://tradingview.com',
      type: 'free-api',
      status: tvStats.status.connected ? 'connected' : 'disconnected',
      statusMessage: tvStats.status.error,
      lastChecked: tvStats.status.lastChecked,
      lastSuccessfulFetch: tvStats.status.lastSuccessfulFetch,
      totalRequests: tvStats.totalRequests,
      failedRequests: tvStats.failedRequests,
      successRate: tvStats.successRate,
      features: ['Technical Analysis', 'Recommendations', 'Fundamentals'],
      dataProvided: ['Technical Indicators', 'Buy/Sell Signals', 'Performance Metrics'],
      requiresApiKey: false,
      apiKeyConfigured: true,
      stocksCovered: tvStats.status.stockCount || 174,
      extra: { cacheAge: tvStats.cacheAge, cachedStocks: tvStats.cachedStocks },
    },
    {
      id: 'scrapfly',
      name: 'Scrapfly.io',
      description: 'Web scraping proxy powering StockAnalysis, MarketScreener, and Investing.com data extraction',
      website: 'https://scrapfly.io',
      type: 'api-key',
      status: scrapflyStats.connected ? 'connected' : 'disconnected',
      statusMessage: scrapflyStats.error,
      lastChecked: scrapflyStats.lastChecked,
      lastSuccessfulFetch: scrapflyStats.lastSuccessfulFetch,
      totalRequests: scrapflyStats.totalRequests,
      failedRequests: scrapflyStats.failedRequests,
      successRate: scrapflyStats.totalRequests > 0
        ? `${(((scrapflyStats.totalRequests - scrapflyStats.failedRequests) / scrapflyStats.totalRequests) * 100).toFixed(1)}%`
        : '—',
      features: ['Anti-Bot Bypass', 'JS Rendering', 'Residential Proxies'],
      dataProvided: ['Proxy for 3 scraping sources'],
      requiresApiKey: true,
      apiKeyConfigured: !!ENV.scrapflyApiKey,
      stocksCovered: 174,
      extra: { remainingCredits: scrapflyStats.remainingCredits },
    },
    {
      id: 'stockanalysis',
      name: 'StockAnalysis.com',
      description: 'Full financial statements and ratios via Scrapfly',
      website: 'https://stockanalysis.com',
      type: 'web-scraping',
      status: saStats.connected ? 'connected' : 'disconnected',
      statusMessage: saStats.error,
      lastChecked: saStats.lastChecked,
      lastSuccessfulFetch: saStats.lastSuccessfulFetch,
      totalRequests: saStats.totalRequests,
      failedRequests: saStats.failedRequests,
      successRate: saStats.totalRequests > 0
        ? `${(((saStats.totalRequests - saStats.failedRequests) / saStats.totalRequests) * 100).toFixed(1)}%`
        : '—',
      features: ['Income Statement', 'Balance Sheet', 'Cash Flow', 'Ratios', 'Dividends'],
      dataProvided: ['210+ Financial Fields', 'Multi-year Data', 'Quarterly & Annual'],
      requiresApiKey: false,
      apiKeyConfigured: true,
      stocksCovered: 170,
      extra: { scrapingVia: 'Scrapfly.io' },
    },
    {
      id: 'marketscreener',
      name: 'MarketScreener.com',
      description: 'Ownership, analyst consensus, and ESG ratings via Scrapfly',
      website: 'https://www.marketscreener.com',
      type: 'web-scraping',
      status: msStats.connected ? 'connected' : 'disconnected',
      statusMessage: msStats.error,
      lastChecked: msStats.lastChecked,
      lastSuccessfulFetch: msStats.lastSuccessfulFetch,
      totalRequests: msStats.totalRequests,
      failedRequests: msStats.failedRequests,
      successRate: msStats.totalRequests > 0
        ? `${(((msStats.totalRequests - msStats.failedRequests) / msStats.totalRequests) * 100).toFixed(1)}%`
        : '—',
      features: ['Ownership', 'Analyst Consensus', 'ESG MSCI Rating'],
      dataProvided: ['Shareholders', 'Target Price', 'Buy/Hold/Sell', 'ESG Rating'],
      requiresApiKey: false,
      apiKeyConfigured: true,
      stocksCovered: 150,
      extra: { scrapingVia: 'Scrapfly.io' },
    },
    {
      id: 'investingcom',
      name: 'Investing.com',
      description: 'Dividend details, analyst ratings, and earnings calendar via Scrapfly',
      website: 'https://www.investing.com',
      type: 'web-scraping',
      status: invStats.connected ? 'connected' : 'disconnected',
      statusMessage: invStats.error,
      lastChecked: invStats.lastChecked,
      lastSuccessfulFetch: invStats.lastSuccessfulFetch,
      totalRequests: invStats.totalRequests,
      failedRequests: invStats.failedRequests,
      successRate: invStats.totalRequests > 0
        ? `${(((invStats.totalRequests - invStats.failedRequests) / invStats.totalRequests) * 100).toFixed(1)}%`
        : '—',
      features: ['Dividend Details', 'Analyst Ratings', 'Earnings Calendar'],
      dataProvided: ['Dividend Yield & History', 'Analyst Targets', 'Earnings Dates'],
      requiresApiKey: false,
      apiKeyConfigured: true,
      stocksCovered: 160,
      extra: { scrapingVia: 'Scrapfly.io' },
    },
    {
      id: 'simplywall',
      name: 'SimplyWall.St',
      description: 'Snowflake scores, fair value, and risk assessment via direct scraping',
      website: 'https://simplywall.st',
      type: 'web-scraping',
      status: swsStats.connected ? 'connected' : 'disconnected',
      statusMessage: swsStats.error,
      lastChecked: swsStats.lastChecked,
      lastSuccessfulFetch: swsStats.lastSuccessfulFetch,
      totalRequests: swsStats.totalRequests,
      failedRequests: swsStats.failedRequests,
      successRate: swsStats.totalRequests > 0
        ? `${(((swsStats.totalRequests - swsStats.failedRequests) / swsStats.totalRequests) * 100).toFixed(1)}%`
        : '—',
      features: ['Snowflake Scores', 'Fair Value', 'Risk Assessment'],
      dataProvided: ['Value/Future/Past/Health/Dividend Scores', 'Fair Value Estimate', 'Risk Level'],
      requiresApiKey: false,
      apiKeyConfigured: true,
      stocksCovered: 170,
      extra: { scrapingVia: 'Direct (no proxy)' },
    },
  ];

  const connectedSources = sources.filter(s => s.status === 'connected').length;

  return {
    sources,
    totalSources: sources.length,
    connectedSources,
    lastFullCheck: new Date().toISOString(),
    overallHealth: connectedSources >= 5 ? 'healthy' : connectedSources >= 3 ? 'degraded' : 'critical',
  };
}
