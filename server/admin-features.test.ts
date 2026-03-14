import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  getCacheMetrics,
  resetCacheMetrics,
  recordCacheHit,
  recordCacheMiss,
} from "./services/cacheMetricsService";
import {
  getCreditMonitorStatus,
} from "./services/scrapflyCreditMonitor";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ─── Credit Monitor Tests ────────────────────────────────────────

describe("Scrapfly Credit Monitor", () => {
  it("getCreditMonitorStatus returns correct state shape", () => {
    const status = getCreditMonitorStatus();

    expect(status).toHaveProperty("running");
    expect(status).toHaveProperty("lastCheck");
    expect(status).toHaveProperty("lastAlertSent");
    expect(status).toHaveProperty("lastAlertLevel");
    expect(status).toHaveProperty("currentCredits");
    expect(status).toHaveProperty("totalCredits");
    expect(status).toHaveProperty("usedCredits");
    expect(status).toHaveProperty("checkCount");
    expect(status).toHaveProperty("alertsSent");
    expect(status).toHaveProperty("errors");
    expect(status).toHaveProperty("lastError");
  });

  it("creditMonitor tRPC route returns state", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.creditMonitor();

    expect(result).toHaveProperty("running");
    expect(typeof result.running).toBe("boolean");
    expect(typeof result.checkCount).toBe("number");
    expect(typeof result.alertsSent).toBe("number");
    expect(typeof result.errors).toBe("number");
  });

  it("forceCheckCredits tRPC route returns updated state", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.forceCheckCredits();

    expect(result).toHaveProperty("running");
    expect(result).toHaveProperty("lastCheck");
    expect(result).toHaveProperty("checkCount");
    // After a force check, checkCount should be at least 1
    expect(result.checkCount).toBeGreaterThanOrEqual(1);
  }, 30000);

  it("lastAlertLevel is null or valid enum", () => {
    const status = getCreditMonitorStatus();
    const validLevels = [null, "warning", "critical"];
    expect(validLevels).toContain(status.lastAlertLevel);
  });

  it("alertsSent and errors are non-negative", () => {
    const status = getCreditMonitorStatus();
    expect(status.alertsSent).toBeGreaterThanOrEqual(0);
    expect(status.errors).toBeGreaterThanOrEqual(0);
  });
});

// ─── Cache Metrics Tests ─────────────────────────────────────────

describe("Cache Metrics Service", () => {
  beforeEach(() => {
    resetCacheMetrics();
  });

  it("getCacheMetrics returns correct structure", () => {
    const metrics = getCacheMetrics();

    expect(metrics).toHaveProperty("services");
    expect(metrics).toHaveProperty("totals");
    expect(metrics).toHaveProperty("timestamp");

    expect(Array.isArray(metrics.services)).toBe(true);
    expect(metrics.services.length).toBe(7); // All 7 services

    expect(metrics.totals).toHaveProperty("totalHits");
    expect(metrics.totals).toHaveProperty("totalMisses");
    expect(metrics.totals).toHaveProperty("totalRequests");
    expect(metrics.totals).toHaveProperty("overallHitRate");
    expect(metrics.totals).toHaveProperty("totalCacheEntries");
  });

  it("each service metric has required fields", () => {
    const metrics = getCacheMetrics();

    for (const service of metrics.services) {
      expect(service).toHaveProperty("serviceId");
      expect(service).toHaveProperty("serviceName");
      expect(service).toHaveProperty("cacheHits");
      expect(service).toHaveProperty("cacheMisses");
      expect(service).toHaveProperty("totalRequests");
      expect(service).toHaveProperty("hitRate");
      expect(service).toHaveProperty("cacheSize");
      expect(service).toHaveProperty("cacheTTL");
      expect(service).toHaveProperty("cachedResponses");

      expect(typeof service.cacheHits).toBe("number");
      expect(typeof service.cacheMisses).toBe("number");
      expect(typeof service.totalRequests).toBe("number");
      expect(typeof service.hitRate).toBe("string");
      expect(typeof service.cacheTTL).toBe("string");
    }
  });

  it("includes all 7 service IDs", () => {
    const metrics = getCacheMetrics();
    const serviceIds = metrics.services.map(s => s.serviceId);

    expect(serviceIds).toContain("stockanalysis");
    expect(serviceIds).toContain("marketscreener");
    expect(serviceIds).toContain("investingcom");
    expect(serviceIds).toContain("simplywall");
    expect(serviceIds).toContain("tradingview");
    expect(serviceIds).toContain("twelvedata");
    expect(serviceIds).toContain("scrapfly");
  });

  it("recordCacheHit increments hit count", () => {
    recordCacheHit("marketscreener");
    recordCacheHit("marketscreener");
    recordCacheHit("marketscreener");

    const metrics = getCacheMetrics();
    const ms = metrics.services.find(s => s.serviceId === "marketscreener");

    expect(ms).toBeDefined();
    expect(ms!.cacheHits).toBe(3);
    expect(ms!.cacheMisses).toBe(0);
  });

  it("recordCacheMiss increments miss count", () => {
    recordCacheMiss("investingcom");
    recordCacheMiss("investingcom");

    const metrics = getCacheMetrics();
    const inv = metrics.services.find(s => s.serviceId === "investingcom");

    expect(inv).toBeDefined();
    expect(inv!.cacheMisses).toBe(2);
    expect(inv!.cacheHits).toBe(0);
  });

  it("hit rate calculates correctly", () => {
    // 3 hits, 1 miss = 75% hit rate
    recordCacheHit("simplywall");
    recordCacheHit("simplywall");
    recordCacheHit("simplywall");
    recordCacheMiss("simplywall");

    const metrics = getCacheMetrics();
    const sws = metrics.services.find(s => s.serviceId === "simplywall");

    expect(sws).toBeDefined();
    expect(sws!.hitRate).toBe("75.0%");
    expect(sws!.totalRequests).toBe(4);
  });

  it("resetCacheMetrics clears all counters", () => {
    recordCacheHit("tradingview");
    recordCacheMiss("tradingview");
    recordCacheHit("twelvedata");

    resetCacheMetrics();

    const metrics = getCacheMetrics();
    const tv = metrics.services.find(s => s.serviceId === "tradingview");
    const td = metrics.services.find(s => s.serviceId === "twelvedata");

    expect(tv!.cacheHits).toBe(0);
    expect(tv!.cacheMisses).toBe(0);
    expect(td!.cacheHits).toBe(0);
  });

  it("totals aggregate correctly across services", () => {
    recordCacheHit("marketscreener");
    recordCacheHit("marketscreener");
    recordCacheMiss("investingcom");
    recordCacheHit("simplywall");
    recordCacheMiss("simplywall");

    const metrics = getCacheMetrics();

    // External tracking: 3 hits + 2 misses = 5 requests (from external tracking only)
    // SA, Scrapfly, TV, TD also contribute from their native stats
    expect(metrics.totals.totalHits).toBeGreaterThanOrEqual(3);
    expect(metrics.totals.totalMisses).toBeGreaterThanOrEqual(2);
  });

  it("cacheMetrics tRPC route returns metrics", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.cacheMetrics();

    expect(result).toHaveProperty("services");
    expect(result).toHaveProperty("totals");
    expect(result).toHaveProperty("timestamp");
    expect(result.services.length).toBe(7);
  });

  it("resetCacheMetrics tRPC route works", async () => {
    // Add some data first
    recordCacheHit("tradingview");
    recordCacheMiss("tradingview");

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.resetCacheMetrics();
    expect(result).toHaveProperty("success");
    expect(result.success).toBe(true);

    // Verify reset worked
    const metrics = await caller.admin.cacheMetrics();
    const tv = metrics.services.find(s => s.serviceId === "tradingview");
    expect(tv!.cacheHits).toBe(0);
    expect(tv!.cacheMisses).toBe(0);
  });

  it("hit rate shows dash when no requests", () => {
    // Don't record anything for marketscreener
    const metrics = getCacheMetrics();
    const ms = metrics.services.find(s => s.serviceId === "marketscreener");

    expect(ms!.hitRate).toBe("—");
  });

  it("timestamp is valid ISO string", () => {
    const metrics = getCacheMetrics();
    const date = new Date(metrics.timestamp);
    expect(date.getTime()).not.toBeNaN();
  });

  it("each service has a valid cacheTTL", () => {
    const metrics = getCacheMetrics();

    for (const service of metrics.services) {
      expect(service.cacheTTL).toBeTruthy();
      expect(typeof service.cacheTTL).toBe("string");
    }
  });
});
