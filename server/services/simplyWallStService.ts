/**
 * Simply Wall St Service (v3 - URL Map + Scrapfly ASP)
 *
 * Provides company valuation snowflake scores, risk analysis, and fair value estimates.
 * Uses a pre-built URL mapping for all 170 UAE stocks to avoid 404 errors.
 * Falls back to search-based URL discovery when the mapped URL fails.
 * Uses Scrapfly.io with ASP (Anti-Scraping Protection) to bypass Cloudflare.
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
import { SWS_URL_MAP } from "./swsUrlMap";

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

// Cache for discovered canonical URLs (overrides the static map when corrected)
const discoveredUrlCache = new Map<string, string>();

// ─── URL Resolution ──────────────────────────────────────────────────

/**
 * Get the best URL for a stock. Priority:
 * 1. Previously discovered canonical URL (from successful scrape)
 * 2. Pre-built URL map (170 entries with sector-aware slugs)
 * 3. Constructed URL from name slugification (last resort)
 */
function getStockUrl(symbol: string, exchange: string, name: string): string {
  const key = `${exchange}:${symbol}`;

  // 1. Check discovered URL cache (from previous successful fetches)
  if (discoveredUrlCache.has(key)) {
    return `https://simplywall.st${discoveredUrlCache.get(key)}`;
  }

  // 2. Check pre-built URL map
  if (SWS_URL_MAP[key]) {
    return `https://simplywall.st${SWS_URL_MAP[key]}`;
  }

  // 3. Construct URL from name (last resort)
  const slug = name
    .toLowerCase()
    .replace(/\b(pjsc|psc|p\.j\.s\.c\.?|p\.s\.c\.?|plc|llc|ltd)\b/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `https://simplywall.st/stocks/ae/diversified-financials/${exchange.toLowerCase()}-${symbol.toLowerCase()}/${slug}-shares`;
}

// ─── Data Extraction ─────────────────────────────────────────────────

/**
 * Parse window.__REACT_QUERY_STATE__ from the rendered HTML page.
 */
function parseReactQueryState(html: string): any | null {
  const marker = "window.__REACT_QUERY_STATE__ = ";
  const idx = html.indexOf(marker);
  if (idx < 0) return null;

  const jsonStart = idx + marker.length;

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

  const mainQuery = queries[0];
  const companyRaw = mainQuery?.state?.data?.data;
  if (!companyRaw) return null;

  const scoreObj = companyRaw.score?.data || {};
  const snowflakeData = scoreObj.snowflake?.data || {};
  const analysisExtended = companyRaw.analysis?.data?.extended?.data || {};
  const analysisBase = companyRaw.analysis?.data || {};

  const checks = companyRaw.checks || [];
  const passedChecks = checks.filter((c: any) => c?.pass === true).length;

  let riskLevel: string | null = null;
  const failedChecksCount = checks.length - passedChecks;
  if (checks.length > 0) {
    if (failedChecksCount <= 1) riskLevel = "Low";
    else if (failedChecksCount <= 3) riskLevel = "Medium";
    else riskLevel = "High";
  }

  const riskFactors = checks
    .filter((c: any) => c?.pass === false)
    .map((c: any) => c?.name || c?.description || "Unknown risk")
    .slice(0, 10);

  const scores = analysisExtended.scores || scoreObj || {};
  const valueScore = scores.value ?? null;
  const futureScore = scores.future ?? null;
  const pastScore = scores.past ?? null;
  const healthScore = scores.health ?? null;
  const dividendScore = scores.income ?? scores.dividend ?? null;
  const totalScoreRaw = scores.total ?? null;

  let altScores: any = null;
  if (queries.length > 1) {
    const q1 = queries[1];
    altScores = q1?.state?.data?.Company?.score || null;
  }

  const finalValue = valueScore ?? altScores?.value ?? null;
  const finalFuture = futureScore ?? altScores?.future ?? null;
  const finalPast = pastScore ?? altScores?.past ?? null;
  const finalHealth = healthScore ?? altScores?.health ?? null;
  const finalDividend = dividendScore ?? altScores?.dividend ?? null;

  const finalTotal =
    totalScoreRaw ??
    (finalValue != null &&
    finalFuture != null &&
    finalPast != null &&
    finalHealth != null &&
    finalDividend != null
      ? finalValue + finalFuture + finalPast + finalHealth + finalDividend
      : null);

  const sharePrice = analysisBase.share_price ?? companyRaw.share_price ?? null;
  const intrinsicDiscount = analysisBase.intrinsic_discount ?? null;
  const pe = analysisBase.pe ?? null;
  const pb = analysisBase.pb ?? null;
  const peg = analysisBase.peg ?? null;
  const marketCap = analysisBase.market_cap ?? null;

  let fairValue: number | null = null;
  let undervaluedPercent: number | null = null;
  if (sharePrice != null && intrinsicDiscount != null) {
    fairValue = sharePrice / (1 + intrinsicDiscount);
    undervaluedPercent = -intrinsicDiscount * 100;
  }

  // Store canonical URL for future use (overrides static map)
  const canonicalUrl = companyRaw.canonical_url || null;
  if (canonicalUrl) {
    discoveredUrlCache.set(`${exchange}:${symbol}`, canonicalUrl);
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

// ─── Scrape Helper ───────────────────────────────────────────────────

/**
 * Attempt to scrape a SWS URL and extract company data.
 */
async function tryScrapeUrl(
  url: string,
  symbol: string,
  exchange: string,
  name: string
): Promise<{ data: SWSCompanyData | null; status: number }> {
  try {
    const result = await scrapflyFetch(url, {
      asp: true,
      renderJs: true,
      country: "ae",
      cache: false,
      timeout: 45000,
      retries: 1,
    });

    if (result.status === 200) {
      const rqs = parseReactQueryState(result.content);
      if (rqs) {
        const data = extractCompanyData(rqs, symbol, exchange, name);
        return { data, status: result.status };
      }
      return { data: null, status: result.status };
    }
    return { data: null, status: result.status };
  } catch (e: any) {
    const statusMatch = e.message?.match(/HTTP (\d+)/);
    const status = statusMatch ? parseInt(statusMatch[1]) : 0;
    return { data: null, status };
  }
}

// ─── Search-based URL Discovery ──────────────────────────────────────

/**
 * Use the SWS listing page to discover the canonical URL for a stock.
 */
async function discoverUrlViaSearch(
  symbol: string,
  exchange: string,
  _name: string
): Promise<string | null> {
  try {
    const searchUrl = `https://simplywall.st/stocks/ae?query=${encodeURIComponent(symbol)}`;

    const result = await scrapflyFetch(searchUrl, {
      asp: true,
      renderJs: true,
      country: "ae",
      cache: true,
      cacheTtl: 86400,
      timeout: 45000,
      retries: 1,
    });

    if (result.status === 200) {
      // Try exact match first
      const linkPattern = new RegExp(
        `href="(/stocks/ae/[^"]*/${exchange.toLowerCase()}-${symbol.toLowerCase()}/[^"]*-shares)`,
        "i"
      );
      const match = result.content.match(linkPattern);
      if (match) {
        const discoveredPath = match[1].split("?")[0];
        console.log(`[SWS] Discovered URL for ${exchange}:${symbol}: ${discoveredPath}`);
        discoveredUrlCache.set(`${exchange}:${symbol}`, discoveredPath);
        return `https://simplywall.st${discoveredPath}`;
      }

      // Try broader match
      const broadPattern = new RegExp(
        `href="(/stocks/ae/[^"]*-shares[^"]*)`,
        "gi"
      );
      let broadMatch;
      const exchangeSymLower = `${exchange.toLowerCase()}-${symbol.toLowerCase()}`;
      while ((broadMatch = broadPattern.exec(result.content)) !== null) {
        if (broadMatch[1].includes(exchangeSymLower)) {
          const discoveredPath = broadMatch[1].split("?")[0];
          console.log(`[SWS] Discovered URL (broad) for ${exchange}:${symbol}: ${discoveredPath}`);
          discoveredUrlCache.set(`${exchange}:${symbol}`, discoveredPath);
          return `https://simplywall.st${discoveredPath}`;
        }
      }
    }

    return null;
  } catch (e) {
    console.error(`[SWS] Search discovery failed for ${exchange}:${symbol}:`, (e as Error).message);
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Fetch company data from Simply Wall St via Scrapfly.
 * Uses pre-built URL mapping + search-based fallback for URL discovery.
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
      url = canonicalUrl.startsWith("http") ? canonicalUrl : `https://simplywall.st${canonicalUrl}`;
    } else {
      url = getStockUrl(symbol, exchange, name);
    }

    console.log(`[SWS] Fetching ${cacheKey}: ${url}`);

    // Attempt 1: Try the primary URL (from URL map or discovered cache)
    const { data, status } = await tryScrapeUrl(url, symbol, exchange, name);

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

    // Attempt 2: If 404, try search-based URL discovery
    if (status === 404 || status === 0) {
      console.log(`[SWS] Primary URL failed (${status}) for ${cacheKey}, trying search discovery...`);

      const discoveredUrl = await discoverUrlViaSearch(symbol, exchange, name);
      if (discoveredUrl) {
        totalRequests++;
        const result2 = await tryScrapeUrl(discoveredUrl, symbol, exchange, name);
        if (result2.data) {
          companyCache.set(cacheKey, { data: result2.data, timestamp: Date.now() });
          lastStatus = {
            connected: true,
            lastChecked: new Date().toISOString(),
            error: null,
            method: "scrapfly-asp+search",
            lastSuccessfulFetch: new Date().toISOString(),
            cachedCompanies: companyCache.size,
          };
          return result2.data;
        }
      }
    }

    // All attempts failed
    failedRequests++;
    lastStatus = {
      connected: false,
      lastChecked: new Date().toISOString(),
      error: `HTTP ${status} - Could not find valid SWS page for ${cacheKey}`,
      method: "scrapfly-asp",
      lastSuccessfulFetch: lastStatus.lastSuccessfulFetch,
      cachedCompanies: companyCache.size,
    };

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
    // Use a known working URL from the URL map
    const testUrl =
      "https://simplywall.st/stocks/ae/real-estate-management-and-development/dfm-emaar/emaar-properties-pjsc-shares";

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
    urlMapSize: Object.keys(SWS_URL_MAP).length,
    discoveredUrls: discoveredUrlCache.size,
  };
}

/**
 * Get the canonical URL cache for debugging
 */
export function getCanonicalUrlCache(): Record<string, string> {
  const result: Record<string, string> = {};
  // Include both static map and discovered URLs
  for (const [key, value] of Object.entries(SWS_URL_MAP)) {
    result[key] = value;
  }
  discoveredUrlCache.forEach((value, key) => {
    result[key] = value + " (discovered)";
  });
  return result;
}
