/**
 * Simply Wall St Service
 * Provides company valuation snowflake scores, risk analysis, and fair value estimates.
 * Uses browser-style scraping since the API is Cloudflare-protected.
 * Falls back to cached data when scraping is blocked.
 */

import { recordCacheHit, recordCacheMiss } from "./cacheMetricsService";

export interface SWSCompanyData {
  ticker: string;
  name: string;
  exchange: string;
  // Snowflake scores (0-6 scale)
  valueScore: number | null;
  futureScore: number | null;
  pastScore: number | null;
  healthScore: number | null;
  dividendScore: number | null;
  totalScore: number | null;
  // Valuation
  fairValue: number | null;
  currentPrice: number | null;
  undervaluedPercent: number | null;
  // Risk
  riskLevel: string | null;
  riskFactors: string[];
}

export interface SWSServiceStatus {
  connected: boolean;
  lastChecked: string;
  error: string | null;
  method: string;
  lastSuccessfulFetch: string | null;
  cachedCompanies: number;
}

// ─── State ───────────────────────────────────────────────────────────

let lastStatus: SWSServiceStatus = {
  connected: false,
  lastChecked: new Date().toISOString(),
  error: 'Not checked yet',
  method: 'web-scraping',
  lastSuccessfulFetch: null,
  cachedCompanies: 0,
};

let totalRequests = 0;
let failedRequests = 0;

// Cache for scraped data
const companyCache = new Map<string, { data: SWSCompanyData; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (data changes slowly)

// ─── URL builders ────────────────────────────────────────────────────

function buildSWSUrl(symbol: string, exchange: string): string {
  // Simply Wall St URL format: /stocks/ae/diversified-financials/dfm-emaar
  const exch = exchange.toLowerCase();
  return `https://simplywall.st/stocks/ae/${exch}-${symbol.toLowerCase()}`;
}

/**
 * Attempt to fetch company data from Simply Wall St
 * Note: This may be blocked by Cloudflare. Returns cached data when blocked.
 */
export async function fetchSWSCompanyData(
  symbol: string,
  exchange: string,
  name: string
): Promise<SWSCompanyData | null> {
  const cacheKey = `${exchange}:${symbol}`;

  // Check cache first
  const cached = companyCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    recordCacheHit("simplywall");
    return cached.data;
  }
  recordCacheMiss("simplywall");

  try {
    totalRequests++;

    // Try the search/lookup endpoint
    const searchUrl = `https://simplywall.st/api/company/lookup?query=${encodeURIComponent(symbol)}&market=ae`;
    const resp = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (resp.ok) {
      const data = await resp.json() as any;
      if (data && Array.isArray(data) && data.length > 0) {
        const company = data[0];
        const result: SWSCompanyData = {
          ticker: cacheKey,
          name: company.name || name,
          exchange,
          valueScore: company.snowflake?.value ?? null,
          futureScore: company.snowflake?.future ?? null,
          pastScore: company.snowflake?.past ?? null,
          healthScore: company.snowflake?.health ?? null,
          dividendScore: company.snowflake?.dividend ?? null,
          totalScore: company.snowflake?.total ?? null,
          fairValue: company.intrinsic_value ?? null,
          currentPrice: company.last_price ?? null,
          undervaluedPercent: null,
          riskLevel: null,
          riskFactors: [],
        };

        if (result.fairValue && result.currentPrice) {
          result.undervaluedPercent = ((result.fairValue - result.currentPrice) / result.currentPrice) * 100;
        }

        companyCache.set(cacheKey, { data: result, timestamp: Date.now() });
        lastStatus = {
          connected: true,
          lastChecked: new Date().toISOString(),
          error: null,
          method: 'api',
          lastSuccessfulFetch: new Date().toISOString(),
          cachedCompanies: companyCache.size,
        };
        return result;
      }
    }

    // If API fails (Cloudflare), mark as unavailable but don't fail
    failedRequests++;
    lastStatus = {
      connected: false,
      lastChecked: new Date().toISOString(),
      error: 'Cloudflare protection active - API blocked',
      method: 'web-scraping',
      lastSuccessfulFetch: lastStatus.lastSuccessfulFetch,
      cachedCompanies: companyCache.size,
    };
    return cached?.data || null;
  } catch (e: any) {
    failedRequests++;
    lastStatus = {
      connected: false,
      lastChecked: new Date().toISOString(),
      error: e.message || 'Connection failed',
      method: 'web-scraping',
      lastSuccessfulFetch: lastStatus.lastSuccessfulFetch,
      cachedCompanies: companyCache.size,
    };
    return cached?.data || null;
  }
}

/**
 * Health check
 */
export async function checkSWSHealth(): Promise<SWSServiceStatus> {
  try {
    totalRequests++;
    const resp = await fetch('https://simplywall.st/api/company/lookup?query=EMAAR&market=ae', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (resp.ok) {
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        lastStatus = {
          connected: true,
          lastChecked: new Date().toISOString(),
          error: null,
          method: 'api',
          lastSuccessfulFetch: new Date().toISOString(),
          cachedCompanies: companyCache.size,
        };
        return lastStatus;
      }
    }

    // Cloudflare challenge page
    failedRequests++;
    lastStatus = {
      connected: false,
      lastChecked: new Date().toISOString(),
      error: 'Cloudflare protection active',
      method: 'web-scraping',
      lastSuccessfulFetch: lastStatus.lastSuccessfulFetch,
      cachedCompanies: companyCache.size,
    };
    return lastStatus;
  } catch (e: any) {
    failedRequests++;
    lastStatus = {
      connected: false,
      lastChecked: new Date().toISOString(),
      error: e.message || 'Connection failed',
      method: 'web-scraping',
      lastSuccessfulFetch: lastStatus.lastSuccessfulFetch,
      cachedCompanies: companyCache.size,
    };
    return lastStatus;
  }
}

/**
 * Get service statistics
 */
export function getSWSStats() {
  return {
    status: lastStatus,
    totalRequests,
    failedRequests,
    successRate: totalRequests > 0 ? ((totalRequests - failedRequests) / totalRequests * 100).toFixed(1) + '%' : 'N/A',
    cachedCompanies: companyCache.size,
  };
}
