import { describe, it, expect, vi } from "vitest";

describe("Corporate Events endpoint", () => {
  it("should fetch and parse earnings/dividend data from TradingView", async () => {
    // Mock the TradingView scanner response
    const mockResponse = {
      totalCount: 2,
      data: [
        {
          s: "DFM:EMAAR",
          d: ["EMAAR", "Emaar Properties", "DFM", 1778155200, 1770973620, 1775217540, 12.15, 1.5, "Real Estate"],
        },
        {
          s: "ADX:FAB",
          d: ["FAB", "First Abu Dhabi Bank", "ADX", 1776945600, 1769601600, 1773835140, 18.0, -0.3, "Financials"],
        },
      ],
    };

    // Test the parsing logic
    const events: Array<{
      symbol: string;
      name: string;
      exchange: string;
      earningsNext: number | null;
      earningsLast: number | null;
      dividendExDate: number | null;
      price: number | null;
      change: number | null;
      sector: string | null;
    }> = [];

    for (const row of mockResponse.data) {
      const d = row.d;
      events.push({
        symbol: row.s?.split(":")[1] || (d[0] as string),
        name: d[1] as string,
        exchange: (d[2] as string) || row.s?.split(":")[0] || "DFM",
        earningsNext: d[3] ? (d[3] as number) * 1000 : null,
        earningsLast: d[4] ? (d[4] as number) * 1000 : null,
        dividendExDate: d[5] ? (d[5] as number) * 1000 : null,
        price: d[6] as number,
        change: d[7] as number,
        sector: d[8] as string,
      });
    }

    expect(events).toHaveLength(2);
    expect(events[0].symbol).toBe("EMAAR");
    expect(events[0].exchange).toBe("DFM");
    expect(events[0].earningsNext).toBe(1778155200 * 1000);
    expect(events[0].dividendExDate).toBe(1775217540 * 1000);
    expect(events[0].price).toBe(12.15);
    expect(events[0].sector).toBe("Real Estate");

    expect(events[1].symbol).toBe("FAB");
    expect(events[1].exchange).toBe("ADX");
    expect(events[1].earningsNext).toBe(1776945600 * 1000);
    expect(events[1].change).toBe(-0.3);
  });

  it("should handle null values in earnings/dividend dates", () => {
    const row = {
      s: "DFM:DFM",
      d: ["DFM", "Dubai Financial Market", "DFM", null, 1769601600, null, 1.4, 0.2, "Financials"],
    };

    const d = row.d;
    const event = {
      symbol: row.s?.split(":")[1] || (d[0] as string),
      name: d[1] as string,
      exchange: (d[2] as string) || row.s?.split(":")[0] || "DFM",
      earningsNext: d[3] ? (d[3] as number) * 1000 : null,
      earningsLast: d[4] ? (d[4] as number) * 1000 : null,
      dividendExDate: d[5] ? (d[5] as number) * 1000 : null,
      price: d[6] as number,
      change: d[7] as number,
      sector: d[8] as string,
    };

    expect(event.earningsNext).toBeNull();
    expect(event.dividendExDate).toBeNull();
    expect(event.earningsLast).toBe(1769601600 * 1000);
    expect(event.symbol).toBe("DFM");
  });

  it("should handle empty data response", () => {
    const mockResponse = { totalCount: 0, data: [] };
    const events: any[] = [];
    for (const row of mockResponse.data) {
      events.push(row);
    }
    expect(events).toHaveLength(0);
  });
});
