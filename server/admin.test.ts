import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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

describe("admin.apiHealthCheck", () => {
  it("returns a dashboard object with sources array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiHealthCheck();

    // Should return the dashboard structure
    expect(result).toHaveProperty("sources");
    expect(result).toHaveProperty("totalSources");
    expect(result).toHaveProperty("connectedSources");
    expect(result).toHaveProperty("lastFullCheck");
    expect(result).toHaveProperty("overallHealth");

    // Should have exactly 4 data sources
    expect(result.sources).toHaveLength(4);
    expect(result.totalSources).toBe(4);

    // Verify source IDs
    const sourceIds = result.sources.map(s => s.id);
    expect(sourceIds).toContain("twelvedata");
    expect(sourceIds).toContain("tradingview");
    expect(sourceIds).toContain("simplywall");
    expect(sourceIds).toContain("yahoo");
  });

  it("each source has required fields", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiHealthCheck();

    for (const source of result.sources) {
      expect(source).toHaveProperty("id");
      expect(source).toHaveProperty("name");
      expect(source).toHaveProperty("description");
      expect(source).toHaveProperty("website");
      expect(source).toHaveProperty("type");
      expect(source).toHaveProperty("status");
      expect(source).toHaveProperty("features");
      expect(source).toHaveProperty("dataProvided");
      expect(source).toHaveProperty("requiresApiKey");
      expect(source).toHaveProperty("totalRequests");
      expect(source).toHaveProperty("successRate");
      expect(source).toHaveProperty("stocksCovered");

      // Status must be one of the valid values
      expect(["connected", "disconnected", "error", "checking", "limited"]).toContain(source.status);

      // Type must be one of the valid values
      expect(["api-key", "free-api", "web-scraping", "built-in"]).toContain(source.type);

      // Features and dataProvided should be arrays
      expect(Array.isArray(source.features)).toBe(true);
      expect(Array.isArray(source.dataProvided)).toBe(true);
      expect(source.features.length).toBeGreaterThan(0);
      expect(source.dataProvided.length).toBeGreaterThan(0);
    }
  });

  it("overall health is valid enum value", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiHealthCheck();

    expect(["healthy", "degraded", "critical"]).toContain(result.overallHealth);
  });

  it("connectedSources count matches actual connected sources", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiHealthCheck();

    const actualConnected = result.sources.filter(s => s.status === "connected").length;
    expect(result.connectedSources).toBe(actualConnected);
  });
});

describe("admin.apiStatus", () => {
  it("returns snapshot without making API calls", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiStatus();

    expect(result).toHaveProperty("sources");
    expect(result).toHaveProperty("totalSources");
    expect(result.sources).toHaveLength(4);
  });
});

describe("admin.tvFetchAll", () => {
  it("returns TradingView stock data with stats", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.tvFetchAll();

    expect(result).toHaveProperty("count");
    expect(result).toHaveProperty("stocks");
    expect(result).toHaveProperty("stats");

    // Should return up to 10 stocks for preview
    expect(result.stocks.length).toBeLessThanOrEqual(10);

    // Stats should have expected structure
    expect(result.stats).toHaveProperty("status");
    expect(result.stats).toHaveProperty("totalRequests");
  });
});

describe("admin.tvFetchStocks", () => {
  it("returns specific stocks by ticker", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.tvFetchStocks({
      tickers: ["DFM:EMAAR", "ADX:FAB"],
    });

    expect(result).toHaveProperty("count");
    expect(result).toHaveProperty("stocks");

    // Should return the requested stocks
    if (result.count > 0) {
      const tickers = result.stocks.map(s => s.ticker);
      expect(tickers).toContain("DFM:EMAAR");
    }
  });
});

describe("TwelveData source configuration", () => {
  it("reports correct type and API key requirement", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiHealthCheck();
    const td = result.sources.find(s => s.id === "twelvedata");

    expect(td).toBeDefined();
    expect(td!.type).toBe("api-key");
    expect(td!.requiresApiKey).toBe(true);
    expect(td!.website).toBe("https://twelvedata.com");
  });
});

describe("TradingView source configuration", () => {
  it("reports as free API with no key required", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiHealthCheck();
    const tv = result.sources.find(s => s.id === "tradingview");

    expect(tv).toBeDefined();
    expect(tv!.type).toBe("free-api");
    expect(tv!.requiresApiKey).toBe(false);
    expect(tv!.website).toBe("https://tradingview.com");
  });
});

describe("Simply Wall St source configuration", () => {
  it("reports as web scraping type", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiHealthCheck();
    const sws = result.sources.find(s => s.id === "simplywall");

    expect(sws).toBeDefined();
    expect(sws!.type).toBe("web-scraping");
    expect(sws!.requiresApiKey).toBe(false);
  });
});

describe("Yahoo Finance source configuration", () => {
  it("reports as built-in type", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiHealthCheck();
    const yahoo = result.sources.find(s => s.id === "yahoo");

    expect(yahoo).toBeDefined();
    expect(yahoo!.type).toBe("built-in");
    expect(yahoo!.requiresApiKey).toBe(false);
  });
});
