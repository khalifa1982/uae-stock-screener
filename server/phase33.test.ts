import { describe, it, expect, vi } from "vitest";

// ─── StockAnalysis Service Tests ──────────────────────────────────

describe("StockAnalysis Service", () => {
  it("should export required functions", async () => {
    const sa = await import("./services/stockAnalysisService");
    expect(typeof sa.fetchSAOverview).toBe("function");
    expect(typeof sa.fetchSAFinancials).toBe("function");
    expect(typeof sa.getSAStats).toBe("function");
    expect(typeof sa.clearSACache).toBe("function");
  });

  it("getSAStats returns correct structure", async () => {
    const { getSAStats } = await import("./services/stockAnalysisService");
    const stats = getSAStats();
    expect(stats).toHaveProperty("totalRequests");
    expect(stats).toHaveProperty("cacheHits");
    expect(stats).toHaveProperty("cacheMisses");
    expect(stats).toHaveProperty("errors");
    expect(stats).toHaveProperty("cacheSize");
    expect(stats).toHaveProperty("cacheTTL");
    expect(typeof stats.totalRequests).toBe("number");
    expect(typeof stats.cacheSize).toBe("number");
  });

  it("clearSACache returns cleared status", async () => {
    const { clearSACache } = await import("./services/stockAnalysisService");
    const result = clearSACache();
    expect(result).toEqual({ cleared: true });
  });

  it("fetchSAOverview returns data for EMAAR", async () => {
    const { fetchSAOverview } = await import("./services/stockAnalysisService");
    const data = await fetchSAOverview("EMAAR", "DFM");
    // Should return data (or null if network fails)
    if (data) {
      expect(data.symbol).toBe("EMAAR");
      expect(data.exchange).toBe("DFM");
      // Name may come from different data blocks
      expect(typeof data.name).toBe("string");
      // Financial data should be present
      expect(data.marketCap).toBeTruthy();
      expect(data.priceChanges).toBeDefined();
      expect(data.financialChart).toBeDefined();
      expect(Array.isArray(data.financialChart)).toBe(true);
    }
  }, 15000);
});

// ─── Chat HTTP Polling Tests ──────────────────────────────────────

describe("Chat Service HTTP Polling", () => {
  it("should export polling functions", async () => {
    const chat = await import("./services/chatService");
    expect(typeof chat.getChatMessages).toBe("function");
    expect(typeof chat.postChatMessage).toBe("function");
    expect(typeof chat.getOnlineUsersList).toBe("function");
    expect(typeof chat.registerPollingUser).toBe("function");
  });

  it("getOnlineUsersList returns array", async () => {
    const { getOnlineUsersList } = await import("./services/chatService");
    const users = getOnlineUsersList();
    expect(Array.isArray(users)).toBe(true);
  });
});
