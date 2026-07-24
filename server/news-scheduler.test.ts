import { describe, it, expect, vi } from "vitest";

// Mock getDb to avoid actual DB calls in unit tests
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// Mock schema
vi.mock("../drizzle/schema", () => ({
  marketNews: {
    id: "id",
    externalId: "externalId",
    title: "title",
    provider: "provider",
    source: "source",
    sourceLogoId: "sourceLogoId",
    publishedAt: "publishedAt",
    urgency: "urgency",
    storyPath: "storyPath",
    relatedSymbols: "relatedSymbols",
    fetchedAt: "fetchedAt",
  },
}));

describe("News Scheduler Service", () => {
  it("should export startNewsScheduler function", async () => {
    const { startNewsScheduler } = await import("./services/newsSchedulerService");
    expect(startNewsScheduler).toBeDefined();
    expect(typeof startNewsScheduler).toBe("function");
  });

  it("should export stopNewsScheduler function", async () => {
    const { stopNewsScheduler } = await import("./services/newsSchedulerService");
    expect(stopNewsScheduler).toBeDefined();
    expect(typeof stopNewsScheduler).toBe("function");
  });

  it("should export getNewsSchedulerStatus function", async () => {
    const { getNewsSchedulerStatus } = await import("./services/newsSchedulerService");
    const status = getNewsSchedulerStatus();
    expect(status).toHaveProperty("running");
    expect(status).toHaveProperty("lastFetchTime");
    expect(status).toHaveProperty("totalArticlesFetched");
    expect(status).toHaveProperty("currentBatchIndex");
    expect(status).toHaveProperty("totalBatches");
    expect(status).toHaveProperty("prioritySymbolCount");
    expect(status).toHaveProperty("totalStockCount");
    expect(status.prioritySymbolCount).toBe(30);
    expect(status.totalStockCount).toBeGreaterThan(100);
  });

  it("should export getStoredNews function", async () => {
    const { getStoredNews } = await import("./services/newsSchedulerService");
    expect(getStoredNews).toBeDefined();
    // With null db, should return empty results
    const result = await getStoredNews();
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("totalCount");
    expect(result).toHaveProperty("lastUpdated");
    expect(result.items).toEqual([]);
  });

  it("should export getStockNews function", async () => {
    const { getStockNews } = await import("./services/newsSchedulerService");
    expect(getStockNews).toBeDefined();
  });

  it("should export triggerFullNewsFetch function", async () => {
    const { triggerFullNewsFetch } = await import("./services/newsSchedulerService");
    expect(triggerFullNewsFetch).toBeDefined();
  });

  it("getNewsSchedulerStatus should report not running initially", async () => {
    const { getNewsSchedulerStatus } = await import("./services/newsSchedulerService");
    const status = getNewsSchedulerStatus();
    expect(status.running).toBe(false);
    expect(status.totalArticlesFetched).toBe(0);
  });

  it("should have correct priority symbols count", async () => {
    const { getNewsSchedulerStatus } = await import("./services/newsSchedulerService");
    const status = getNewsSchedulerStatus();
    expect(status.prioritySymbolCount).toBe(30);
  });

  it("should have totalBatches > 0", async () => {
    const { getNewsSchedulerStatus } = await import("./services/newsSchedulerService");
    const status = getNewsSchedulerStatus();
    expect(status.totalBatches).toBeGreaterThan(0);
  });
});
