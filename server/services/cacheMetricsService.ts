/**
 * Cache Metrics Service
 * 
 * Aggregates cache hit/miss statistics from all data services:
 * - StockAnalysis.com (overviewCache, financialsCache, dividendCache)
 * - MarketScreener.com (dataCache, slugCache)
 * - Investing.com (dataCache)
 * - SimplyWall.St (companyCache)
 * - TradingView (in-memory stock cache)
 * - TwelveData (via stockService memoryCache)
 * - Scrapfly.io (API-level caching stats)
 */

import { getSAStats } from "./stockAnalysisService";
import { getScrapflyStats } from "./scrapflyService";
import { getTradingViewStats } from "./tradingViewService";
import { getTwelveDataStats } from "./twelveDataService";
import { getSWSStats } from "./simplyWallStService";

// ─── Types ────────────────────────────────────────────────────────

export interface ServiceCacheMetrics {
  serviceId: string;
  serviceName: string;
  cacheHits: number;
  cacheMisses: number;
  totalRequests: number;
  hitRate: string;       // e.g. "85.2%"
  cacheSize: number;     // number of cached entries
  cacheTTL: string;      // human-readable TTL
  cachedResponses: number; // Scrapfly API-level cache hits
}

export interface AggregatedCacheMetrics {
  services: ServiceCacheMetrics[];
  totals: {
    totalHits: number;
    totalMisses: number;
    totalRequests: number;
    overallHitRate: string;
    totalCacheEntries: number;
  };
  timestamp: string;
}

// ─── Internal tracking for services that don't natively track cache stats ──

// MarketScreener cache tracking
let msCacheStats = { hits: 0, misses: 0 };
// Investing.com cache tracking
let invCacheStats = { hits: 0, misses: 0 };
// SimplyWall.St cache tracking
let swsCacheStats = { hits: 0, misses: 0 };
// TradingView cache tracking
let tvCacheStats = { hits: 0, misses: 0 };
// TwelveData / stockService cache tracking
let tdCacheStats = { hits: 0, misses: 0 };

/**
 * Record a cache hit for a service
 */
export function recordCacheHit(serviceId: string): void {
  switch (serviceId) {
    case "marketscreener": msCacheStats.hits++; break;
    case "investingcom": invCacheStats.hits++; break;
    case "simplywall": swsCacheStats.hits++; break;
    case "tradingview": tvCacheStats.hits++; break;
    case "twelvedata": tdCacheStats.hits++; break;
  }
}

/**
 * Record a cache miss for a service
 */
export function recordCacheMiss(serviceId: string): void {
  switch (serviceId) {
    case "marketscreener": msCacheStats.misses++; break;
    case "investingcom": invCacheStats.misses++; break;
    case "simplywall": swsCacheStats.misses++; break;
    case "tradingview": tvCacheStats.misses++; break;
    case "twelvedata": tdCacheStats.misses++; break;
  }
}

// ─── Aggregation ──────────────────────────────────────────────────

/**
 * Get aggregated cache metrics from all services
 */
export function getCacheMetrics(): AggregatedCacheMetrics {
  const saStats = getSAStats();
  const sfStats = getScrapflyStats();
  const tvStats = getTradingViewStats();
  const tdStats = getTwelveDataStats();
  const swsStats = getSWSStats();

  const services: ServiceCacheMetrics[] = [
    // StockAnalysis - has native cache tracking
    {
      serviceId: "stockanalysis",
      serviceName: "StockAnalysis.com",
      cacheHits: saStats.cacheHits,
      cacheMisses: saStats.cacheMisses,
      totalRequests: saStats.totalRequests,
      hitRate: saStats.totalRequests > 0
        ? `${((saStats.cacheHits / saStats.totalRequests) * 100).toFixed(1)}%`
        : "—",
      cacheSize: saStats.cacheSize,
      cacheTTL: `${saStats.cacheTTL / 60}m`,
      cachedResponses: 0,
    },

    // MarketScreener - uses external tracking
    {
      serviceId: "marketscreener",
      serviceName: "MarketScreener.com",
      cacheHits: msCacheStats.hits,
      cacheMisses: msCacheStats.misses,
      totalRequests: msCacheStats.hits + msCacheStats.misses,
      hitRate: (msCacheStats.hits + msCacheStats.misses) > 0
        ? `${((msCacheStats.hits / (msCacheStats.hits + msCacheStats.misses)) * 100).toFixed(1)}%`
        : "—",
      cacheSize: 0, // We don't expose cache size from MS service
      cacheTTL: "24h",
      cachedResponses: 0,
    },

    // Investing.com - uses external tracking
    {
      serviceId: "investingcom",
      serviceName: "Investing.com",
      cacheHits: invCacheStats.hits,
      cacheMisses: invCacheStats.misses,
      totalRequests: invCacheStats.hits + invCacheStats.misses,
      hitRate: (invCacheStats.hits + invCacheStats.misses) > 0
        ? `${((invCacheStats.hits / (invCacheStats.hits + invCacheStats.misses)) * 100).toFixed(1)}%`
        : "—",
      cacheSize: 0,
      cacheTTL: "24h",
      cachedResponses: 0,
    },

    // SimplyWall.St - uses external tracking
    {
      serviceId: "simplywall",
      serviceName: "SimplyWall.St",
      cacheHits: swsCacheStats.hits,
      cacheMisses: swsCacheStats.misses,
      totalRequests: swsCacheStats.hits + swsCacheStats.misses,
      hitRate: (swsCacheStats.hits + swsCacheStats.misses) > 0
        ? `${((swsCacheStats.hits / (swsCacheStats.hits + swsCacheStats.misses)) * 100).toFixed(1)}%`
        : "—",
      cacheSize: swsStats.cachedCompanies,
      cacheTTL: "24h",
      cachedResponses: 0,
    },

    // TradingView - uses external tracking
    {
      serviceId: "tradingview",
      serviceName: "TradingView",
      cacheHits: tvCacheStats.hits,
      cacheMisses: tvCacheStats.misses,
      totalRequests: tvStats.totalRequests,
      hitRate: (tvCacheStats.hits + tvCacheStats.misses) > 0
        ? `${((tvCacheStats.hits / (tvCacheStats.hits + tvCacheStats.misses)) * 100).toFixed(1)}%`
        : "—",
      cacheSize: tvStats.cachedStocks,
      cacheTTL: "5m",
      cachedResponses: 0,
    },

    // TwelveData - uses external tracking
    {
      serviceId: "twelvedata",
      serviceName: "TwelveData",
      cacheHits: tdCacheStats.hits,
      cacheMisses: tdCacheStats.misses,
      totalRequests: tdStats.totalRequests,
      hitRate: (tdCacheStats.hits + tdCacheStats.misses) > 0
        ? `${((tdCacheStats.hits / (tdCacheStats.hits + tdCacheStats.misses)) * 100).toFixed(1)}%`
        : "—",
      cacheSize: 0,
      cacheTTL: "10m",
      cachedResponses: 0,
    },

    // Scrapfly - API-level caching
    {
      serviceId: "scrapfly",
      serviceName: "Scrapfly.io (API Cache)",
      cacheHits: sfStats.cachedResponses,
      cacheMisses: sfStats.successfulRequests - sfStats.cachedResponses,
      totalRequests: sfStats.totalRequests,
      hitRate: sfStats.successfulRequests > 0
        ? `${((sfStats.cachedResponses / sfStats.successfulRequests) * 100).toFixed(1)}%`
        : "—",
      cacheSize: 0,
      cacheTTL: "varies",
      cachedResponses: sfStats.cachedResponses,
    },
  ];

  // Calculate totals
  const totalHits = services.reduce((sum, s) => sum + s.cacheHits, 0);
  const totalMisses = services.reduce((sum, s) => sum + s.cacheMisses, 0);
  const totalRequests = totalHits + totalMisses;
  const totalCacheEntries = services.reduce((sum, s) => sum + s.cacheSize, 0);

  return {
    services,
    totals: {
      totalHits,
      totalMisses,
      totalRequests,
      overallHitRate: totalRequests > 0
        ? `${((totalHits / totalRequests) * 100).toFixed(1)}%`
        : "—",
      totalCacheEntries,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Reset all external cache tracking stats
 */
export function resetCacheMetrics(): void {
  msCacheStats = { hits: 0, misses: 0 };
  invCacheStats = { hits: 0, misses: 0 };
  swsCacheStats = { hits: 0, misses: 0 };
  tvCacheStats = { hits: 0, misses: 0 };
  tdCacheStats = { hits: 0, misses: 0 };
}
