/**
 * Simply Wall St Service (v2 - Scrapfly-powered)
 *
 * Provides company valuation snowflake scores, risk analysis, and fair value estimates.
 * Uses Scrapfly.io with ASP (Anti-Scraping Protection) to bypass Cloudflare.
 * Parses window.__REACT_QUERY_STATE__ from the rendered page for rich data.
 *
 * Data extracted:
 * - Snowflake scores (Value, Future, Past, Health, Dividend)
 * - Fair value / intrinsic discount
 * - Risk checks and risk level
 * - PE, PB, PEG ratios
 * - Market cap, share price
 * - Company summary sentence
 */

import { scrapflyFetch } from "./scrapflyService";
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
  // Snowflake axes (for radar chart)
  snowflakeAxes: number[] | null;
  // Valuation
  fairValue: number | null;
  currentPrice: number | null;
  undervaluedPercent: number | null;
  intrinsicDiscount: number | null;
  // Ratios
  pe: number | null;
  pb: number | null;
  peg: number | null;
  marketCap: number | null;
  // Risk
  riskLevel: string | null;
  riskFactors: string[];
  riskChecksPassed: number;
  riskChecksTotal: number;
  // Summary
  scoreSentence: string | null;
  canonicalUrl: string | null;
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
  error: "Not checked yet",
  method: "scrapfly-asp",
  lastSuccessfulFetch: null,
  cachedCompanies: 0,
};

let totalRequests = 0;
let failedRequests = 0;

// Cache for scraped data
const companyCache = new Map<
  string,
  { data: SWSCompanyData; timestamp: number }
>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (data changes slowly)

// ─── URL builders ────────────────────────────────────────────────────

/**
 * Build the SWS stock page URL.
 * Format: /stocks/ae/{sector}/{exchange}-{ticker}/{company-slug}-shares
 * Since we don't always know the sector/slug, we use the canonical_url from previous fetches
 * or fall back to a search-based approach.
 */

// Map of known canonical URLs (populated from successful fetches)
const canonicalUrlCache = new Map<string, string>();

function buildSWSSearchUrl(symbol: string): string {
  // Use the SWS search/autocomplete to find the correct page
  return `https://simplywall.st/stocks/ae?query=${encodeURIComponent(symbol)}`;
}

// ─── Data Extraction ─────────────────────────────────────────────────

/**
 * Parse window.__REACT_QUERY_STATE__ from the rendered HTML page.
 * This contains all the company data including scores, analysis, and peers.
 */
function parseReactQueryState(html: string): any | null {
  const marker = "window.__REACT_QUERY_STATE__ = ";
  const idx = html.indexOf(marker);
  if (idx < 0) return null;

  const jsonStart = idx + marker.length;

  // Find the matching closing brace
  let braceCount = 0;
  let jsonEnd = jsonStart;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === "{") braceCount++;
    else if (html[i] === "}") {
      braceCount--;
      if (braceCount === 0) {
        jsonEnd = i + 1;
        break;
      }
    }
  }

  const raw = html.slice(jsonStart, jsonEnd);
  // Replace JS-specific values that aren't valid JSON
  const cleaned = raw
    .replace(/\bundefined\b/g, "null")
    .replace(/\bNaN\b/g, "null")
    .replace(/\bInfinity\b/g, "null")
    .replace(/\b-Infinity\b/g, "null");

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("[SWS] Failed to parse __REACT_QUERY_STATE__:", (e as Error).message);
    return null;
  }
}

/**
 * Extract company data from the parsed React Query State.
 */
function extractCompanyData(
  rqs: any,
  symbol: string,
  exchange: string,
  name: string
): SWSCompanyData | null {
  const queries = rqs?.queries;
  if (!Array.isArray(queries) || queries.length === 0) return null;

  // Query 0 is typically the main company data
  const mainQuery = queries[0];
  const companyRaw = mainQuery?.state?.data?.data;
  if (!companyRaw) return null;

  // Extract scores from the score object
  const scoreObj = companyRaw.score?.data || {};
  const snowflakeData = scoreObj.snowflake?.data || {};

  // Extract analysis data - check both paths
  const analysisExtended = companyRaw.analysis?.data?.extended?.data || {};
  const analysisBase = companyRaw.analysis?.data || {};

  // Extract risk checks
  const checks = companyRaw.checks || [];
  const passedChecks = checks.filter((c: any) => c?.pass === true).length;

  // Determine risk level from checks
  let riskLevel: string | null = null;
  const failedChecks = checks.length - passedChecks;
  if (checks.length > 0) {
    if (failedChecks <= 1) riskLevel = "Low";
    else if (failedChecks <= 3) riskLevel = "Medium";
    else riskLevel = "High";
  }

  // Extract risk factor descriptions
  const riskFactors = checks
    .filter((c: any) => c?.pass === false)
    .map((c: any) => c?.name || c?.description || "Unknown risk")
    .slice(0, 10);

  // Get scores - try multiple locations
  const scores = analysisExtended.scores || scoreObj || {};
  const valueScore = scores.value ?? null;
  const futureScore = scores.future ?? null;
  const pastScore = scores.past ?? null;
  const healthScore = scores.health ?? null;
  const dividendScore = scores.income ?? scores.dividend ?? null;
  const totalScoreRaw = scores.total ?? null;

  // Also try Query 1 (CompanySummary) for alternative score data
  let altScores: any = null;
  if (queries.length > 1) {
    const q1 = queries[1];
    altScores = q1?.state?.data?.Company?.score || null;
  }

  // Use alt scores as fallback
  const finalValue = valueScore ?? altScores?.value ?? null;
  const finalFuture = futureScore ?? altScores?.future ?? null;
  const finalPast = pastScore ?? altScores?.past ?? null;
  const finalHealth = healthScore ?? altScores?.health ?? null;
  const finalDividend = dividendScore ?? altScores?.dividend ?? null;

  // Calculate total if not available
  const finalTotal =
    totalScoreRaw ??
    (finalValue != null &&
    finalFuture != null &&
    finalPast != null &&
    finalHealth != null &&
    finalDividend != null
      ? finalValue + finalFuture + finalPast + finalHealth + finalDividend
      : null);

  // Valuation data lives in analysisBase (not extended)
  const sharePrice = analysisBase.share_price ?? companyRaw.share_price ?? null;
  const intrinsicDiscount = analysisBase.intrinsic_discount ?? null;
  const pe = analysisBase.pe ?? null;
  const pb = analysisBase.pb ?? null;
  const peg = analysisBase.peg ?? null;
  const marketCap = analysisBase.market_cap ?? null;

  // Fair value from intrinsic discount
  let fairValue: number | null = null;
  let undervaluedPercent: number | null = null;
  if (sharePrice != null && intrinsicDiscount != null) {
    fairValue = sharePrice / (1 + intrinsicDiscount);
    undervaluedPercent = -intrinsicDiscount * 100; // positive = undervalued
  }

  // Store canonical URL for future use
  const canonicalUrl = companyRaw.canonical_url || null;
  if (canonicalUrl) {
    canonicalUrlCache.set(`${exchange}:${symbol}`, canonicalUrl);
  }

  return {
    ticker: `${exchange}:${symbol}`,
    name: companyRaw.name || name,
    exchange: companyRaw.exchange_symbol || exchange,
    valueScore: finalValue,
    futureScore: finalFuture,
    pastScore: finalPast,
    healthScore: finalHealth,
    dividendScore: finalDividend,
    totalScore: finalTotal,
    snowflakeAxes: snowflakeData.axes || null,
    fairValue,
    currentPrice: sharePrice,
    undervaluedPercent,
    intrinsicDiscount,
    pe,
    pb,
    peg,
    marketCap,
    riskLevel,
    riskFactors,
    riskChecksPassed: passedChecks,
    riskChecksTotal: checks.length,
    scoreSentence: scores.sentence || null,
    canonicalUrl,
  };
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Fetch company data from Simply Wall St via Scrapfly.
 * Uses ASP (Anti-Scraping Protection) to bypass Cloudflare.
 * Returns cached data when available (24h TTL).
 */
export async function fetchSWSCompanyData(
  symbol: string,
  exchange: string,
  name: string,
  canonicalUrl?: string
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

    // Determine the URL to scrape
    let url: string;
    if (canonicalUrl) {
      url = `https://simplywall.st${canonicalUrl}`;
    } else if (canonicalUrlCache.has(cacheKey)) {
      url = `https://simplywall.st${canonicalUrlCache.get(cacheKey)}`;
    } else {
      // Fall back to a search-based approach - we'll need the canonical URL
      // For now, try a common pattern
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      url = `https://simplywall.st/stocks/ae/diversified-financials/${exchange.toLowerCase()}-${symbol.toLowerCase()}/${slug}-shares`;
    }

    // Fetch via Scrapfly with ASP and JS rendering
    const result = await scrapflyFetch(url, {
      asp: true,
      renderJs: true,
      country: "ae",
      cache: false, // Don't use Scrapfly cache - we have our own
      timeout: 45000,
      retries: 1,
    });

    if (result.status === 200) {
      // Parse the React Query State
      const rqs = parseReactQueryState(result.content);
      if (rqs) {
        const data = extractCompanyData(rqs, symbol, exchange, name);
        if (data) {
          companyCache.set(cacheKey, { data, timestamp: Date.now() });
          lastStatus = {
            connected: true,
            lastChecked: new Date().toISOString(),
            error: null,
            method: "scrapfly-asp",
            lastSuccessfulFetch: new Date().toISOString(),
            cachedCompanies: companyCache.size,
          };
          return data;
        }
      }

      // Page loaded but no data found
      failedRequests++;
      lastStatus = {
        connected: false,
        lastChecked: new Date().toISOString(),
        error: "Page loaded but __REACT_QUERY_STATE__ not found or empty",
        method: "scrapfly-asp",
        lastSuccessfulFetch: lastStatus.lastSuccessfulFetch,
        cachedCompanies: companyCache.size,
      };
    } else {
      failedRequests++;
      lastStatus = {
        connected: false,
        lastChecked: new Date().toISOString(),
        error: `HTTP ${result.status}`,
        method: "scrapfly-asp",
        lastSuccessfulFetch: lastStatus.lastSuccessfulFetch,
        cachedCompanies: companyCache.size,
      };
    }

    return cached?.data || null;
  } catch (e: any) {
    failedRequests++;
    lastStatus = {
      connected: false,
      lastChecked: new Date().toISOString(),
      error: e.message || "Connection failed",
      method: "scrapfly-asp",
      lastSuccessfulFetch: lastStatus.lastSuccessfulFetch,
      cachedCompanies: companyCache.size,
    };
    return cached?.data || null;
  }
}

/**
 * Health check - fetch a known stock page via Scrapfly to verify connectivity.
 */
export async function checkSWSHealth(): Promise<SWSServiceStatus> {
  try {
    totalRequests++;
    // Use a known working URL
    const testUrl =
      "https://simplywall.st/stocks/ae/commercial-services/dfm-upp/union-properties-shares";

    const result = await scrapflyFetch(testUrl, {
      asp: true,
      renderJs: true,
      country: "ae",
      cache: false,
      timeout: 45000,
      retries: 1,
    });

    if (result.status === 200) {
      const rqs = parseReactQueryState(result.content);
      if (rqs && rqs.queries && rqs.queries.length > 0) {
        lastStatus = {
          connected: true,
          lastChecked: new Date().toISOString(),
          error: null,
          method: "scrapfly-asp",
          lastSuccessfulFetch: new Date().toISOString(),
          cachedCompanies: companyCache.size,
        };
        return lastStatus;
      }
    }

    failedRequests++;
    lastStatus = {
      connected: false,
      lastChecked: new Date().toISOString(),
      error: `HTTP ${result.status} - No data in response`,
      method: "scrapfly-asp",
      lastSuccessfulFetch: lastStatus.lastSuccessfulFetch,
      cachedCompanies: companyCache.size,
    };
    return lastStatus;
  } catch (e: any) {
    failedRequests++;
    lastStatus = {
      connected: false,
      lastChecked: new Date().toISOString(),
      error: e.message || "Connection failed",
      method: "scrapfly-asp",
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
    successRate:
      totalRequests > 0
        ? (
            ((totalRequests - failedRequests) / totalRequests) *
            100
          ).toFixed(1) + "%"
        : "N/A",
    cachedCompanies: companyCache.size,
  };
}

/**
 * Get the canonical URL cache for debugging
 */
export function getCanonicalUrlCache(): Record<string, string> {
  const result: Record<string, string> = {};
  canonicalUrlCache.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}
