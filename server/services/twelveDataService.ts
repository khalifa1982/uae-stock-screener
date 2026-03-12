/**
 * TwelveData API Service
 * Main data model for real-time quotes, fundamentals, and technical indicators.
 * API Docs: https://twelvedata.com/docs
 */

import { toTwelveDataSymbol } from './tdSymbolMapper';

const TWELVE_DATA_BASE = 'https://api.twelvedata.com';

function getApiKey(): string {
  return process.env.TWELVEDATA_API_KEY || '';
}

export interface TwelveDataQuote {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  previous_close: number | null;
  change: number | null;
  percent_change: number | null;
  datetime: string | null;
}

export interface TwelveDataStatus {
  connected: boolean;
  apiKeyValid: boolean;
  lastChecked: string;
  error: string | null;
  plan: string | null;
  dailyUsage: number | null;
  dailyLimit: number | null;
}

// In-memory status tracking
let lastStatus: TwelveDataStatus = {
  connected: false,
  apiKeyValid: false,
  lastChecked: new Date().toISOString(),
  error: 'Not checked yet',
  plan: null,
  dailyUsage: null,
  dailyLimit: null,
};

let lastSuccessfulFetch: string | null = null;
let totalRequests = 0;
let failedRequests = 0;

/**
 * Health check - verify API key and connectivity
 */
export async function checkTwelveDataHealth(): Promise<TwelveDataStatus> {
  const apiKey = getApiKey();
  if (!apiKey) {
    lastStatus = {
      connected: false,
      apiKeyValid: false,
      lastChecked: new Date().toISOString(),
      error: 'API key not configured',
      plan: null,
      dailyUsage: null,
      dailyLimit: null,
    };
    return lastStatus;
  }

  try {
    totalRequests++;
    // Test with a UAE stock to verify the key works (use mapped symbol)
    const resp = await fetch(`${TWELVE_DATA_BASE}/quote?symbol=EMAR:DFM&apikey=${apiKey}`, {
      signal: AbortSignal.timeout(10000),
    });

    const data = await resp.json() as any;

    // TwelveData returns 200 with error code in body for invalid keys
    if (data.code === 401 || data.code === 403 || data.status === 'error') {
      failedRequests++;
      lastStatus = {
        connected: false,
        apiKeyValid: false,
        lastChecked: new Date().toISOString(),
        error: data.message || 'Invalid or expired API key',
        plan: null,
        dailyUsage: null,
        dailyLimit: null,
      };
      return lastStatus;
    }

    if (!resp.ok) {
      failedRequests++;
      lastStatus = {
        connected: false,
        apiKeyValid: false,
        lastChecked: new Date().toISOString(),
        error: `HTTP ${resp.status}`,
        plan: null,
        dailyUsage: null,
        dailyLimit: null,
      };
      return lastStatus;
    }

    lastSuccessfulFetch = new Date().toISOString();

    // Now try to get usage info
    let dailyUsage = null;
    let dailyLimit = null;
    let plan = 'Active';
    try {
      const usageResp = await fetch(`${TWELVE_DATA_BASE}/api_usage?apikey=${apiKey}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (usageResp.ok) {
        const usageData = await usageResp.json() as any;
        dailyUsage = usageData.current_usage ?? null;
        dailyLimit = usageData.plan_limit ?? null;
      }
    } catch { /* ignore usage fetch errors */ }

    lastStatus = {
      connected: true,
      apiKeyValid: true,
      lastChecked: new Date().toISOString(),
      error: null,
      plan,
      dailyUsage,
      dailyLimit,
    };
    return lastStatus;
  } catch (e: any) {
    failedRequests++;
    lastStatus = {
      connected: false,
      apiKeyValid: false,
      lastChecked: new Date().toISOString(),
      error: e.message || 'Connection failed',
      plan: null,
      dailyUsage: null,
      dailyLimit: null,
    };
    return lastStatus;
  }
}

/**
 * Fetch real-time quote for a stock
 */
export async function fetchTwelveDataQuote(symbol: string, exchange: string): Promise<TwelveDataQuote | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  // Restrict to UAE market only (ADX and DFM exchanges)
  if (exchange !== 'ADX' && exchange !== 'DFM') {
    console.warn(`[TwelveData] Rejected non-UAE exchange: ${exchange}. Only ADX and DFM are allowed.`);
    return null;
  }

  try {
    totalRequests++;
    // Map to TwelveData symbol format
    const mapped = toTwelveDataSymbol(symbol, exchange as 'ADX' | 'DFM');
    const tdSymbol = mapped ? mapped.fullSymbol : `${symbol}:${exchange}`;
    const resp = await fetch(
      `${TWELVE_DATA_BASE}/quote?symbol=${encodeURIComponent(tdSymbol)}&apikey=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!resp.ok) {
      failedRequests++;
      return null;
    }

    const data = await resp.json() as any;
    if (data.code === 401 || data.code === 400 || data.status === 'error') {
      failedRequests++;
      return null;
    }

    lastSuccessfulFetch = new Date().toISOString();
    return {
      symbol: data.symbol || symbol,
      name: data.name || '',
      exchange: data.exchange || exchange,
      currency: data.currency || 'AED',
      open: data.open ? parseFloat(data.open) : null,
      high: data.high ? parseFloat(data.high) : null,
      low: data.low ? parseFloat(data.low) : null,
      close: data.close ? parseFloat(data.close) : null,
      volume: data.volume ? parseInt(data.volume) : null,
      previous_close: data.previous_close ? parseFloat(data.previous_close) : null,
      change: data.change ? parseFloat(data.change) : null,
      percent_change: data.percent_change ? parseFloat(data.percent_change) : null,
      datetime: data.datetime || null,
    };
  } catch (e) {
    failedRequests++;
    return null;
  }
}

/**
 * Fetch technical indicators for a stock
 */
export async function fetchTwelveDataIndicator(
  symbol: string,
  exchange: string,
  indicator: string,
  params: Record<string, string> = {}
): Promise<any> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  // Restrict to UAE market only (ADX and DFM exchanges)
  if (exchange !== 'ADX' && exchange !== 'DFM') {
    console.warn(`[TwelveData] Rejected non-UAE exchange: ${exchange}. Only ADX and DFM are allowed.`);
    return null;
  }

  try {
    totalRequests++;
    // Map to TwelveData symbol format
    const mapped = toTwelveDataSymbol(symbol, exchange as 'ADX' | 'DFM');
    const tdSymbol = mapped ? mapped.fullSymbol : `${symbol}:${exchange}`;
    const queryParams = new URLSearchParams({
      symbol: tdSymbol,
      interval: '1day',
      apikey: apiKey,
      ...params,
    });

    const resp = await fetch(
      `${TWELVE_DATA_BASE}/${indicator}?${queryParams}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!resp.ok) {
      failedRequests++;
      return null;
    }

    const data = await resp.json() as any;
    if (data.code || data.status === 'error') {
      failedRequests++;
      return null;
    }

    lastSuccessfulFetch = new Date().toISOString();
    return data;
  } catch (e) {
    failedRequests++;
    return null;
  }
}

/**
 * Fetch fundamentals (income statement, balance sheet, cash flow)
 */
export async function fetchTwelveDataFundamentals(
  symbol: string,
  exchange: string,
  type: 'income_statement' | 'balance_sheet' | 'cash_flow'
): Promise<any> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  // Restrict to UAE market only (ADX and DFM exchanges)
  if (exchange !== 'ADX' && exchange !== 'DFM') {
    console.warn(`[TwelveData] Rejected non-UAE exchange: ${exchange}. Only ADX and DFM are allowed.`);
    return null;
  }

  try {
    totalRequests++;
    // Map to TwelveData symbol format
    const mapped = toTwelveDataSymbol(symbol, exchange as 'ADX' | 'DFM');
    const tdSymbol = mapped ? mapped.fullSymbol : `${symbol}:${exchange}`;
    const resp = await fetch(
      `${TWELVE_DATA_BASE}/${type}?symbol=${encodeURIComponent(tdSymbol)}&apikey=${apiKey}`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!resp.ok) {
      failedRequests++;
      return null;
    }

    const data = await resp.json() as any;
    if (data.code || data.status === 'error') {
      failedRequests++;
      return null;
    }

    lastSuccessfulFetch = new Date().toISOString();
    return data;
  } catch (e) {
    failedRequests++;
    return null;
  }
}

/**
 * Get service statistics
 */
export function getTwelveDataStats() {
  return {
    status: lastStatus,
    lastSuccessfulFetch,
    totalRequests,
    failedRequests,
    successRate: totalRequests > 0 ? ((totalRequests - failedRequests) / totalRequests * 100).toFixed(1) + '%' : 'N/A',
  };
}
