/**
 * Scrapfly.io Base Service
 * 
 * Provides a centralized web scraping client using Scrapfly.io API.
 * All scrapers (StockAnalysis, MarketScreener, Investing.com, SimplyWall.St)
 * should use this service for HTTP requests to benefit from:
 * - Anti-bot bypass (ASP)
 * - JavaScript rendering
 * - Proxy rotation
 * - Response caching
 * - Rate limiting
 */

import { ENV } from "../_core/env";

// ─── Types ─────────────────────────────────────────────────────────

export interface ScrapflyOptions {
  asp?: boolean;          // Anti-Scraping Protection bypass
  renderJs?: boolean;     // JavaScript rendering (headless browser)
  country?: string;       // Proxy country code
  cache?: boolean;        // Enable Scrapfly-side caching
  cacheTtl?: number;      // Cache TTL in seconds
  timeout?: number;       // Request timeout in ms
  retries?: number;       // Number of retries on failure
  headers?: Record<string, string>; // Custom headers
}

export interface ScrapflyResult {
  content: string;
  status: number;
  url: string;
  cached: boolean;
}

// ─── Stats ─────────────────────────────────────────────────────────

let stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  cachedResponses: 0,
  lastRequest: null as string | null,
  lastError: null as string | null,
  apiCreditsUsed: 0,
};

// ─── Rate Limiting ─────────────────────────────────────────────────

const REQUEST_DELAY = 1000; // 1 second between requests
let lastRequestTime = 0;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < REQUEST_DELAY) {
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY - elapsed));
  }
  lastRequestTime = Date.now();
}

// ─── Core Fetch ────────────────────────────────────────────────────

/**
 * Fetch a URL using Scrapfly.io API with anti-bot bypass.
 * Falls back to direct fetch if Scrapfly API key is not configured.
 */
export async function scrapflyFetch(
  url: string,
  options: ScrapflyOptions = {}
): Promise<ScrapflyResult> {
  const apiKey = ENV.scrapflyApiKey;
  
  stats.totalRequests++;
  stats.lastRequest = url;

  await waitForRateLimit();

  // If no API key, fall back to direct fetch
  if (!apiKey) {
    console.warn("[Scrapfly] No API key configured, using direct fetch");
    return directFetch(url, options);
  }

  const {
    asp = true,
    renderJs = false,
    country = "ae",
    cache = true,
    cacheTtl = 3600,
    timeout = 30000,
    retries = 2,
    headers = {},
  } = options;

  const params = new URLSearchParams({
    key: apiKey,
    url,
    asp: String(asp),
    render_js: String(renderJs),
    country,
    cache: String(cache),
    cache_ttl: String(cacheTtl),
  });

  // Add custom headers
  for (const [key, value] of Object.entries(headers)) {
    params.append(`headers[${key}]`, value);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(
        `https://api.scrapfly.io/scrape?${params.toString()}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Scrapfly HTTP ${response.status}: ${errorText.slice(0, 200)}`);
      }

      const json = await response.json();
      
      const result: ScrapflyResult = {
        content: json.result?.content || "",
        status: json.result?.status_code || response.status,
        url: json.result?.url || url,
        cached: json.result?.cache?.is_cached || false,
      };

      if (result.cached) {
        stats.cachedResponses++;
      }
      stats.successfulRequests++;
      stats.apiCreditsUsed++;

      return result;
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        console.warn(`[Scrapfly] Attempt ${attempt + 1} failed for ${url}: ${err.message}. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    }
  }

  stats.failedRequests++;
  stats.lastError = `${url}: ${lastError?.message}`;
  console.error(`[Scrapfly] All attempts failed for ${url}:`, lastError?.message);
  throw lastError || new Error("Scrapfly fetch failed");
}

/**
 * Direct fetch fallback (no Scrapfly)
 */
async function directFetch(url: string, options: ScrapflyOptions): Promise<ScrapflyResult> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();
    stats.successfulRequests++;

    return {
      content,
      status: response.status,
      url,
      cached: false,
    };
  } catch (err: any) {
    stats.failedRequests++;
    stats.lastError = `${url}: ${err.message}`;
    throw err;
  }
}

// ─── Utility: HTML Parser Helpers ──────────────────────────────────

/**
 * Extract text content between HTML tags
 */
export function extractText(html: string, selector: string): string | null {
  // Simple tag extraction for common patterns
  const tagMatch = selector.match(/^(\w+)(?:\.([a-zA-Z0-9_-]+))?$/);
  if (!tagMatch) return null;

  const [, tag, className] = tagMatch;
  const pattern = className
    ? new RegExp(`<${tag}[^>]*class="[^"]*${className}[^"]*"[^>]*>([^<]+)</${tag}>`, "i")
    : new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "i");

  const match = html.match(pattern);
  return match ? match[1].trim() : null;
}

/**
 * Extract all table rows from an HTML table
 */
export function extractTableRows(html: string): string[][] {
  const rows: string[][] = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const cells: string[] = [];
    const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;

    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      // Strip HTML tags from cell content
      const text = cellMatch[1].replace(/<[^>]+>/g, "").trim();
      cells.push(text);
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return rows;
}

/**
 * Extract JSON-LD structured data from HTML
 */
export function extractJsonLd(html: string): any[] {
  const results: any[] = [];
  const pattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    try {
      results.push(JSON.parse(match[1]));
    } catch {
      // Skip invalid JSON-LD
    }
  }

  return results;
}

// ─── Stats ─────────────────────────────────────────────────────────

export function getScrapflyStats() {
  return { ...stats };
}

export function resetScrapflyStats() {
  stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cachedResponses: 0,
    lastRequest: null,
    lastError: null,
    apiCreditsUsed: 0,
  };
}
