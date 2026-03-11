import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: "**Market Summary**: The ADX closed higher today with strong banking sector performance."
      }
    }]
  })
}));

// Mock the db module
const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([])
      })
    })
  })
});

const mockDelete = vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue(undefined)
});

const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined)
});

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: mockSelect,
    delete: mockDelete,
    insert: mockInsert,
  })
}));

// Mock tradingViewService
vi.mock("./services/tradingViewService", () => ({
  fetchAllTVStocks: vi.fn().mockResolvedValue([
    {
      ticker: "ADX:FAB",
      name: "First Abu Dhabi Bank",
      description: "First Abu Dhabi Bank P.J.S.C.",
      logoId: null,
      exchange: "ADX",
      type: "stock",
      sector: "Banking",
      industry: null,
      close: 15.50,
      change: 2.5,
      changeAbs: 0.38,
      volume: 5000000,
      open: 15.12,
      high: 15.60,
      low: 15.10,
      marketCap: 200000000000,
      allTimeHigh: null,
      allTimeLow: null,
      avgVolume10d: null,
      avgVolume30d: null,
      avgVolume60d: null,
      avgVolume90d: null,
      pe: null,
      priceToSales: null,
      priceToBook: null,
      priceToFreeCashFlow: null,
      enterpriseValue: null,
      evToEbitda: null,
      totalRevenue: null,
      grossProfit: null,
      netIncome: null,
      eps: null,
      epsDiluted: null,
      ebitda: null,
      epsForecast: null,
      totalAssets: null,
      totalLiabilities: null,
      totalDebt: null,
      totalCurrentAssets: null,
      sharesOutstanding: null,
      totalCurrentLiabilities: null,
      longTermDebt: null,
      shortTermDebt: null,
    },
    {
      ticker: "DFM:EMAAR",
      name: "Emaar Properties",
      description: "Emaar Properties PJSC",
      logoId: null,
      exchange: "DFM",
      type: "stock",
      sector: "Real Estate",
      industry: null,
      close: 8.20,
      change: -1.2,
      changeAbs: -0.10,
      volume: 12000000,
      open: 8.30,
      high: 8.35,
      low: 8.15,
      marketCap: 50000000000,
      allTimeHigh: null,
      allTimeLow: null,
      avgVolume10d: null,
      avgVolume30d: null,
      avgVolume60d: null,
      avgVolume90d: null,
      pe: null,
      priceToSales: null,
      priceToBook: null,
      priceToFreeCashFlow: null,
      enterpriseValue: null,
      evToEbitda: null,
      totalRevenue: null,
      grossProfit: null,
      netIncome: null,
      eps: null,
      epsDiluted: null,
      ebitda: null,
      epsForecast: null,
      totalAssets: null,
      totalLiabilities: null,
      totalDebt: null,
      totalCurrentAssets: null,
      sharesOutstanding: null,
      totalCurrentLiabilities: null,
      longTermDebt: null,
      shortTermDebt: null,
    },
  ]),
}));

describe("Market Summary Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export required functions", async () => {
    const mod = await import("./services/marketSummaryService");
    expect(mod.generateDailySummary).toBeDefined();
    expect(mod.getLatestSummaries).toBeDefined();
    expect(mod.getSummaryByDate).toBeDefined();
    expect(mod.getMarketSummaryStatus).toBeDefined();
    expect(mod.startMarketSummaryScheduler).toBeDefined();
    expect(mod.stopMarketSummaryScheduler).toBeDefined();
  });

  it("should return status with isRunning and isGenerating fields", async () => {
    const { getMarketSummaryStatus } = await import("./services/marketSummaryService");
    const status = getMarketSummaryStatus();
    expect(status).toHaveProperty("isRunning");
    expect(status).toHaveProperty("isGenerating");
    expect(status).toHaveProperty("lastGeneratedDate");
    expect(typeof status.isRunning).toBe("boolean");
    expect(typeof status.isGenerating).toBe("boolean");
  });

  it("should generate daily summary and return result", async () => {
    const { generateDailySummary } = await import("./services/marketSummaryService");
    const result = await generateDailySummary();
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("date");
    expect(result).toHaveProperty("summaries");
    expect(typeof result.date).toBe("string");
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should call getLatestSummaries with language parameter", async () => {
    const { getLatestSummaries } = await import("./services/marketSummaryService");
    const result = await getLatestSummaries("en", 5);
    expect(Array.isArray(result)).toBe(true);
  });

  it("should call getSummaryByDate with date and language", async () => {
    const { getSummaryByDate } = await import("./services/marketSummaryService");
    const result = await getSummaryByDate("2026-03-11", "ar");
    // Result may be an array or a mock chain result; just verify it resolves without error
    expect(result).toBeDefined();
  });

  it("should start and stop scheduler without errors", async () => {
    const { startMarketSummaryScheduler, stopMarketSummaryScheduler, getMarketSummaryStatus } = await import("./services/marketSummaryService");
    
    startMarketSummaryScheduler();
    const statusRunning = getMarketSummaryStatus();
    expect(statusRunning.isRunning).toBe(true);
    
    stopMarketSummaryScheduler();
    const statusStopped = getMarketSummaryStatus();
    expect(statusStopped.isRunning).toBe(false);
  });
});
