import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { ALL_STOCKS, ADX_STOCKS, DFM_STOCKS, SECTORS } from "../shared/stockData";

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

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("stocks.list", () => {
  it("returns all stocks when exchange is ALL", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.stocks.list({ exchange: "ALL" });
    expect(result.length).toBe(ALL_STOCKS.length);
    expect(result.length).toBeGreaterThan(100);
  });

  it("returns only ADX stocks when exchange is ADX", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.stocks.list({ exchange: "ADX" });
    expect(result.length).toBe(ADX_STOCKS.length);
    expect(result.every(s => s.exchange === "ADX")).toBe(true);
  });

  it("returns only DFM stocks when exchange is DFM", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.stocks.list({ exchange: "DFM" });
    expect(result.length).toBe(DFM_STOCKS.length);
    expect(result.every(s => s.exchange === "DFM")).toBe(true);
  });

  it("returns all stocks by default when no input", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.stocks.list();
    expect(result.length).toBe(ALL_STOCKS.length);
  });
});

describe("stocks.sectors", () => {
  it("returns the list of sectors", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.stocks.sectors();
    expect(result).toEqual(SECTORS);
    expect(result.length).toBeGreaterThan(10);
    expect(result).toContain("Banking");
    expect(result).toContain("Real Estate");
    expect(result).toContain("Energy");
  });
});

describe("shared/stockData", () => {
  it("has correct stock structure", () => {
    for (const stock of ALL_STOCKS) {
      expect(stock).toHaveProperty("symbol");
      expect(stock).toHaveProperty("yahooSymbol");
      expect(stock).toHaveProperty("name");
      expect(stock).toHaveProperty("exchange");
      expect(stock).toHaveProperty("sector");
      expect(["ADX", "DFM"]).toContain(stock.exchange);
      expect(stock.yahooSymbol).toMatch(/\.AE$/);
    }
  });

  it("has no duplicate symbols within the same exchange", () => {
    const adxSymbols = ADX_STOCKS.map(s => s.symbol);
    const dfmSymbols = DFM_STOCKS.map(s => s.symbol);
    expect(new Set(adxSymbols).size).toBe(adxSymbols.length);
    expect(new Set(dfmSymbols).size).toBe(dfmSymbols.length);
  });

  it("all sectors in stocks are in the SECTORS list", () => {
    for (const stock of ALL_STOCKS) {
      expect(SECTORS).toContain(stock.sector);
    }
  });

  it("ADX has approximately 100 stocks", () => {
    expect(ADX_STOCKS.length).toBeGreaterThanOrEqual(90);
    expect(ADX_STOCKS.length).toBeLessThanOrEqual(120);
  });

  it("DFM has approximately 68 stocks", () => {
    expect(DFM_STOCKS.length).toBeGreaterThanOrEqual(60);
    expect(DFM_STOCKS.length).toBeLessThanOrEqual(80);
  });
});

describe("stocks.fetchOne", () => {
  it("throws error for non-existent stock", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.stocks.fetchOne({ symbol: "NONEXISTENT", exchange: "ADX" })).rejects.toThrow("Stock not found");
  });
});

describe("stocks.detail", () => {
  it("throws error for non-existent stock", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.stocks.detail({ symbol: "NONEXISTENT" })).rejects.toThrow("Stock not found");
  });
});

describe("stocks.chart", () => {
  it("throws error for non-existent stock", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.stocks.chart({ symbol: "NONEXISTENT" })).rejects.toThrow("Stock not found");
  });
});
