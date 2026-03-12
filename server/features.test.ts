import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { ALL_STOCKS } from "../shared/stockData";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createPublicContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("Stock Data Integrity", () => {
  it("ALL_STOCKS should contain ADX and DFM stocks", () => {
    const adxStocks = ALL_STOCKS.filter(s => s.exchange === "ADX");
    const dfmStocks = ALL_STOCKS.filter(s => s.exchange === "DFM");
    expect(adxStocks.length).toBeGreaterThan(0);
    expect(dfmStocks.length).toBeGreaterThan(0);
    expect(ALL_STOCKS.length).toBe(adxStocks.length + dfmStocks.length);
  });

  it("ALL_STOCKS should have unique symbols", () => {
    const symbols = ALL_STOCKS.map(s => s.symbol);
    const uniqueSymbols = new Set(symbols);
    expect(uniqueSymbols.size).toBe(symbols.length);
  });

  it("Each stock should have required fields", () => {
    for (const stock of ALL_STOCKS) {
      expect(stock.symbol).toBeTruthy();
      expect(stock.yahooSymbol).toBeTruthy();
      expect(stock.name).toBeTruthy();
      expect(["ADX", "DFM"]).toContain(stock.exchange);
      expect(stock.sector).toBeTruthy();
    }
  });
});

describe("Search Functionality", () => {
  // Test the search logic that QuickSearch component uses
  function searchStocks(query: string) {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return ALL_STOCKS.filter(s =>
      s.symbol.toLowerCase().startsWith(q) ||
      s.symbol.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.sector.toLowerCase().includes(q)
    ).sort((a, b) => {
      const aStarts = a.symbol.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.symbol.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return 0;
    });
  }

  it("should find stocks by first letter", () => {
    const results = searchStocks("f");
    expect(results.length).toBeGreaterThan(0);
    // FAB should be in results
    expect(results.some(r => r.symbol === "FAB")).toBe(true);
  });

  it("should find stocks by symbol prefix", () => {
    const results = searchStocks("adn");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.symbol.startsWith("ADN"))).toBe(true);
  });

  it("should find stocks by name", () => {
    const results = searchStocks("emirates");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.name.toLowerCase().includes("emirates"))).toBe(true);
  });

  it("should find stocks by sector", () => {
    const results = searchStocks("banking");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.sector.toLowerCase().includes("banking"))).toBe(true);
  });

  it("should prioritize exact symbol starts", () => {
    const results = searchStocks("ihc");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].symbol).toBe("IHC");
  });

  it("should return empty for empty query", () => {
    const results = searchStocks("");
    expect(results.length).toBe(0);
  });
});

describe("Earnings Transcript Procedure", () => {
  it("earningsTranscript procedure should exist on the router", () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // Verify the procedure exists (it's a public procedure)
    expect(typeof caller.stocks.earningsTranscript).toBe("function");
  });
});

describe("Chart Procedure", () => {
  it("chart procedure should exist on the router", () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.stocks.chart).toBe("function");
  });
});

describe("Profile Procedure", () => {
  it("profile procedure should exist on the router", () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.stocks.profile).toBe("function");
  });
});
