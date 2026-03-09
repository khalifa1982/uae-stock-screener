import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { isUAETradingHours, getNextTradingSession } from "./volumeMonitor";

describe("Volume Monitor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isUAETradingHours", () => {
    it("returns true during UAE trading hours (Mon-Fri 9:30-14:59 GST)", () => {
      // Monday 12:00 GST = Monday 08:00 UTC (March 9, 2026 is a Monday)
      vi.setSystemTime(new Date("2026-03-09T08:00:00.000Z"));
      expect(isUAETradingHours()).toBe(true);
    });

    it("returns true on Monday during trading hours", () => {
      // Monday 11:00 GST = Monday 07:00 UTC
      vi.setSystemTime(new Date("2026-03-09T07:00:00.000Z"));
      expect(isUAETradingHours()).toBe(true);
    });

    it("returns true on Thursday during trading hours", () => {
      // Thursday 13:00 GST = Thursday 09:00 UTC (March 12, 2026 is a Thursday)
      vi.setSystemTime(new Date("2026-03-12T09:00:00.000Z"));
      expect(isUAETradingHours()).toBe(true);
    });

    it("returns false before market open (before 9:30 GST)", () => {
      // Monday 09:00 GST = Monday 05:00 UTC
      vi.setSystemTime(new Date("2026-03-09T05:00:00.000Z"));
      expect(isUAETradingHours()).toBe(false);
    });

    it("returns false after market close (at 15:00 GST)", () => {
      // Monday 15:00 GST = Monday 11:00 UTC
      vi.setSystemTime(new Date("2026-03-09T11:00:00.000Z"));
      expect(isUAETradingHours()).toBe(false);
    });

    it("returns false on Saturday (weekend)", () => {
      // Saturday 12:00 GST = Saturday 08:00 UTC (March 7, 2026 is a Saturday)
      vi.setSystemTime(new Date("2026-03-07T08:00:00.000Z"));
      expect(isUAETradingHours()).toBe(false);
    });

    it("returns false on Sunday (weekend)", () => {
      // Sunday 12:00 GST = Sunday 08:00 UTC (March 8, 2026 is a Sunday)
      vi.setSystemTime(new Date("2026-03-08T08:00:00.000Z"));
      expect(isUAETradingHours()).toBe(false);
    });

    it("returns true at exactly 9:30 GST on a trading day", () => {
      // Wednesday 9:30 GST = Wednesday 05:30 UTC (March 11, 2026 is a Wednesday)
      vi.setSystemTime(new Date("2026-03-11T05:30:00.000Z"));
      expect(isUAETradingHours()).toBe(true);
    });

    it("returns false at exactly 15:00 GST on a trading day", () => {
      // Wednesday 15:00 GST = Wednesday 11:00 UTC
      vi.setSystemTime(new Date("2026-03-11T11:00:00.000Z"));
      expect(isUAETradingHours()).toBe(false);
    });
  });

  describe("getNextTradingSession", () => {
    it("returns next day 9:30 GST when called after market close on a trading day", () => {
      // Monday 16:00 GST = Monday 12:00 UTC (March 9, 2026 is a Monday)
      vi.setSystemTime(new Date("2026-03-09T12:00:00.000Z"));
      const next = getNextTradingSession();
      // Should be Tuesday 9:30 GST = Tuesday 05:30 UTC
      expect(next.getUTCDay()).toBe(2); // Tuesday
      expect(next.getUTCHours()).toBe(5); // 9:30 GST = 05:30 UTC
      expect(next.getUTCMinutes()).toBe(30);
    });

    it("skips weekend (Sat-Sun) when called on Friday after close", () => {
      // Friday 16:00 GST = Friday 12:00 UTC (March 13, 2026 is a Friday)
      vi.setSystemTime(new Date("2026-03-13T12:00:00.000Z"));
      const next = getNextTradingSession();
      // Should be Monday 9:30 GST = Monday 05:30 UTC
      expect(next.getUTCDay()).toBe(1); // Monday
      expect(next.getUTCHours()).toBe(5);
      expect(next.getUTCMinutes()).toBe(30);
    });

    it("skips to Monday when called on Saturday", () => {
      // Saturday 12:00 GST = Saturday 08:00 UTC (March 7, 2026 is a Saturday)
      vi.setSystemTime(new Date("2026-03-07T08:00:00.000Z"));
      const next = getNextTradingSession();
      expect(next.getUTCDay()).toBe(1); // Monday
      expect(next.getUTCHours()).toBe(5);
      expect(next.getUTCMinutes()).toBe(30);
    });

    it("skips to Monday when called on Sunday", () => {
      // Sunday 12:00 GST = Sunday 08:00 UTC (March 8, 2026 is a Sunday)
      vi.setSystemTime(new Date("2026-03-08T08:00:00.000Z"));
      const next = getNextTradingSession();
      expect(next.getUTCDay()).toBe(1); // Monday
      expect(next.getUTCHours()).toBe(5);
      expect(next.getUTCMinutes()).toBe(30);
    });
  });
});

describe("Stock Data Shared Module", () => {
  it("has correct stock counts", async () => {
    const { ADX_STOCKS, DFM_STOCKS, ALL_STOCKS } = await import("../shared/stockData");
    expect(ADX_STOCKS.length).toBeGreaterThanOrEqual(80);
    expect(DFM_STOCKS.length).toBeGreaterThanOrEqual(55);
    expect(ALL_STOCKS.length).toBe(ADX_STOCKS.length + DFM_STOCKS.length);
  });

  it("all stocks have required fields", async () => {
    const { ALL_STOCKS } = await import("../shared/stockData");
    for (const stock of ALL_STOCKS) {
      expect(stock.symbol).toBeDefined();
      expect(stock.name).toBeDefined();
      expect(stock.exchange).toMatch(/^(ADX|DFM)$/);
      expect(stock.sector).toBeDefined();
      expect(stock.yahooSymbol).toBeDefined();
    }
  });

  it("no duplicate symbols within same exchange", async () => {
    const { ALL_STOCKS } = await import("../shared/stockData");
    const seen = new Set<string>();
    for (const stock of ALL_STOCKS) {
      const key = `${stock.exchange}:${stock.symbol}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("DFM stocks have .AE suffix in Yahoo symbols", async () => {
    const { DFM_STOCKS } = await import("../shared/stockData");
    for (const stock of DFM_STOCKS) {
      expect(stock.yahooSymbol).toMatch(/\.AE$/);
    }
  });
});

describe("Router Schema Validation", () => {
  it("appRouter has monitor routes", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter).toBeDefined();
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("monitor.status");
    expect(procedures).toContain("monitor.todayAlerts");
    expect(procedures).toContain("monitor.recentAlerts");
    expect(procedures).toContain("monitor.tradingInfo");
  });

  it("appRouter has watchlist routes", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("watchlist.list");
    expect(procedures).toContain("watchlist.add");
    expect(procedures).toContain("watchlist.remove");
  });

  it("appRouter has presets routes", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("presets.list");
    expect(procedures).toContain("presets.save");
    expect(procedures).toContain("presets.delete");
  });
});
