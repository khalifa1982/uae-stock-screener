/**
 * API Status Service
 * Aggregates health checks and statistics from TwelveData and TradingView.
 * Provides a unified view for the admin dashboard.
 */

import { checkTwelveDataHealth, getTwelveDataStats } from './twelveDataService';
import { checkTradingViewHealth, getTradingViewStats } from './tradingViewService';

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

/**
 * Run health checks on all data sources
 */
export async function checkAllApiHealth(): Promise<ApiStatusDashboard> {
  const [twelveData, tradingView] = await Promise.allSettled([
    checkTwelveDataHealth(),
    checkTradingViewHealth(),
  ]);

  const tdStats = getTwelveDataStats();
  const tvStats = getTradingViewStats();

  const tdStatus = twelveData.status === 'fulfilled' ? twelveData.value : null;
  const tvStatus = tradingView.status === 'fulfilled' ? tradingView.value : null;

  const sources: ApiSourceInfo[] = [
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
      dataProvided: ['Stock Prices', 'Income Statement', 'Balance Sheet', 'Cash Flow', 'RSI', 'MACD', 'SMA', 'EMA', 'Bollinger Bands'],
      requiresApiKey: true,
      apiKeyConfigured: !!process.env.TWELVEDATA_API_KEY,
      stocksCovered: 174,
      extra: {
        plan: tdStatus?.plan || 'Unknown',
        dailyUsage: tdStatus?.dailyUsage,
        dailyLimit: tdStatus?.dailyLimit,
      },
    },
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
  ];

  const connectedSources = sources.filter(s => s.status === 'connected').length;
  const overallHealth: 'healthy' | 'degraded' | 'critical' =
    connectedSources >= 2 ? 'healthy' :
    connectedSources >= 1 ? 'degraded' :
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
  ];

  const connectedSources = sources.filter(s => s.status === 'connected').length;

  return {
    sources,
    totalSources: sources.length,
    connectedSources,
    lastFullCheck: new Date().toISOString(),
    overallHealth: connectedSources >= 2 ? 'healthy' : connectedSources >= 1 ? 'degraded' : 'critical',
  };
}
