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

// Health checks now ping 7 external services (some with 30s timeout), so we need a generous test timeout
const HEALTH_CHECK_TIMEOUT = 90_000;

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

    // Should have exactly 7 data sources
    expect(result.sources).toHaveLength(7);
    expect(result.totalSources).toBe(7);

    // Verify all 7 source IDs
    const sourceIds = result.sources.map(s => s.id);
    expect(sourceIds).toContain("twelvedata");
    expect(sourceIds).toContain("tradingview");
    expect(sourceIds).toContain("scrapfly");
    expect(sourceIds).toContain("stockanalysis");
    expect(sourceIds).toContain("marketscreener");
    expect(sourceIds).toContain("investingcom");
    expect(sourceIds).toContain("simplywall");
  }, HEALTH_CHECK_TIMEOUT);

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
  }, HEALTH_CHECK_TIMEOUT);

  it("overall health is valid enum value", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiHealthCheck();

    expect(["healthy", "degraded", "critical"]).toContain(result.overallHealth);
  }, HEALTH_CHECK_TIMEOUT);

  it("connectedSources count matches actual connected sources", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiHealthCheck();

    const actualConnected = result.sources.filter(s => s.status === "connected").length;
    expect(result.connectedSources).toBe(actualConnected);
  }, HEALTH_CHECK_TIMEOUT);
});

describe("admin.apiStatus", () => {
  it("returns snapshot without making API calls", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiStatus();

    expect(result).toHaveProperty("sources");
    expect(result).toHaveProperty("totalSources");
    expect(result.sources).toHaveLength(7);
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
  }, HEALTH_CHECK_TIMEOUT);
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
  }, HEALTH_CHECK_TIMEOUT);
});

describe("Scrapfly source configuration", () => {
  it("reports as API key type for web scraping proxy", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiHealthCheck();
    const sf = result.sources.find(s => s.id === "scrapfly");

    expect(sf).toBeDefined();
    expect(sf!.type).toBe("api-key");
    expect(sf!.requiresApiKey).toBe(true);
    expect(sf!.website).toBe("https://scrapfly.io");
    expect(sf!.name).toBe("Scrapfly.io");
  }, HEALTH_CHECK_TIMEOUT);
});

describe("StockAnalysis.com source configuration", () => {
  it("reports as web-scraping type with financial data", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiHealthCheck();
    const sa = result.sources.find(s => s.id === "stockanalysis");

    expect(sa).toBeDefined();
    expect(sa!.type).toBe("web-scraping");
    expect(sa!.requiresApiKey).toBe(false);
    expect(sa!.website).toBe("https://stockanalysis.com");
    expect(sa!.features).toContain("Income Statement (Annual/Quarterly)");
    expect(sa!.features).toContain("Balance Sheet (Annual/Quarterly)");
    expect(sa!.features).toContain("Cash Flow (Annual/Quarterly)");
    expect(sa!.features).toContain("Financial Ratios");
  }, HEALTH_CHECK_TIMEOUT);
});

describe("MarketScreener.com source configuration", () => {
  it("reports as web-scraping type with ownership data", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiHealthCheck();
    const ms = result.sources.find(s => s.id === "marketscreener");

    expect(ms).toBeDefined();
    expect(ms!.type).toBe("web-scraping");
    expect(ms!.requiresApiKey).toBe(false);
    expect(ms!.website).toBe("https://www.marketscreener.com");
    expect(ms!.features).toContain("Ownership & Shareholders");
    expect(ms!.features).toContain("Analyst Consensus");
    expect(ms!.features).toContain("ESG MSCI Rating");
  }, HEALTH_CHECK_TIMEOUT);
});

describe("Investing.com source configuration", () => {
  it("reports as web-scraping type with dividend data", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiHealthCheck();
    const inv = result.sources.find(s => s.id === "investingcom");

    expect(inv).toBeDefined();
    expect(inv!.type).toBe("web-scraping");
    expect(inv!.requiresApiKey).toBe(false);
    expect(inv!.website).toBe("https://www.investing.com");
    expect(inv!.features).toContain("Dividend Details");
    expect(inv!.features).toContain("Analyst Ratings");
  }, HEALTH_CHECK_TIMEOUT);
});

describe("SimplyWall.St source configuration", () => {
  it("reports as web-scraping type with snowflake scores", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiHealthCheck();
    const sws = result.sources.find(s => s.id === "simplywall");

    expect(sws).toBeDefined();
    expect(sws!.type).toBe("web-scraping");
    expect(sws!.requiresApiKey).toBe(false);
    expect(sws!.website).toBe("https://simplywall.st");
    expect(sws!.features).toContain("Snowflake Scores");
    expect(sws!.features).toContain("Fair Value Estimate");
    expect(sws!.features).toContain("Risk Assessment");
  }, HEALTH_CHECK_TIMEOUT);
});

describe("All 7 data sources are present", () => {
  it("includes all required sources", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiHealthCheck();
    expect(result.sources.length).toBe(7);
    
    const expectedIds = [
      "twelvedata", "tradingview", "scrapfly",
      "stockanalysis", "marketscreener", "investingcom", "simplywall"
    ];
    const actualIds = result.sources.map(s => s.id).sort();
    expect(actualIds).toEqual(expectedIds.sort());
  }, HEALTH_CHECK_TIMEOUT);

  it("does NOT include Yahoo Finance", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiHealthCheck();
    const yahoo = result.sources.find(s => s.id === "yahoo");
    expect(yahoo).toBeUndefined();
  }, HEALTH_CHECK_TIMEOUT);

  it("has correct type distribution", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.apiHealthCheck();
    
    const apiKeySources = result.sources.filter(s => s.type === "api-key");
    const freeApiSources = result.sources.filter(s => s.type === "free-api");
    const scrapingSources = result.sources.filter(s => s.type === "web-scraping");

    expect(apiKeySources.length).toBe(2); // TwelveData + Scrapfly
    expect(freeApiSources.length).toBe(1); // TradingView
    expect(scrapingSources.length).toBe(4); // StockAnalysis, MarketScreener, Investing, SimplyWall
  }, HEALTH_CHECK_TIMEOUT);
});
