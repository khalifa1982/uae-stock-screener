import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// We need to test the internal parsing functions
// Since they're not exported, we'll test via the exported fetch functions by mocking scrapfly
// But for now, let's test the parseJSValue logic directly by importing the module

// Import the service - the fetch functions are exported
import { fetchSAStatistics, fetchSAProfile } from "./services/stockAnalysisService";

// Mock the scrapfly service to return our test HTML fixtures
import { vi } from "vitest";

vi.mock("./services/scrapflyService", () => ({
  scrapflyFetch: vi.fn(async (url: string) => {
    if (url.includes("/statistics/")) {
      const content = readFileSync(
        join(__dirname, "__test_fixtures__/sa_statistics_emaar.html"),
        "utf-8"
      );
      return { content, status: 200, url, cached: false };
    }
    if (url.includes("/company/")) {
      const content = readFileSync(
        join(__dirname, "__test_fixtures__/sa_profile_emaar.html"),
        "utf-8"
      );
      return { content, status: 200, url, cached: false };
    }
    return { content: "", status: 404, url, cached: false };
  }),
}));

describe("StockAnalysis Statistics Parser", () => {
  it("should extract statistics data from real EMAAR HTML", async () => {
    const result = await fetchSAStatistics("EMAAR", "DFM");
    expect(result).not.toBeNull();
    if (!result) return;

    // Valuation ratios
    expect(result.peRatio).toBeCloseTo(5.93, 1);
    expect(result.forwardPE).toBeCloseTo(5.95, 1);
    expect(result.psRatio).toBeCloseTo(2.1, 1);
    expect(result.pbRatio).toBeCloseTo(0.97, 1);

    // EV ratios
    expect(result.evEarnings).toBeCloseTo(5.69, 1);
    expect(result.evSales).toBeCloseTo(2.02, 1);
    expect(result.evEbitda).toBeCloseTo(4.0, 1);

    // Fair values
    expect(result.lynchFairValue).toBeCloseTo(49.78, 0);
    expect(result.grahamNumber).toBeCloseTo(21.86, 0);

    // Scores
    expect(result.altmanZScore).not.toBeNull();
    expect(result.piotoskiFScore).not.toBeNull();
  });

  it("should extract market cap and enterprise value", async () => {
    const result = await fetchSAStatistics("EMAAR", "DFM");
    expect(result).not.toBeNull();
    if (!result) return;

    // Market cap should be a large number (billions)
    expect(result.marketCap).not.toBeNull();
    expect(result.enterpriseValue).not.toBeNull();
  });

  it("should extract financial efficiency ratios", async () => {
    const result = await fetchSAStatistics("EMAAR", "DFM");
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.roe).not.toBeNull();
    expect(result.roa).not.toBeNull();
    expect(result.roic).not.toBeNull();
  });

  it("should extract margins", async () => {
    const result = await fetchSAStatistics("EMAAR", "DFM");
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.grossMargin).not.toBeNull();
    expect(result.operatingMargin).not.toBeNull();
    expect(result.profitMargin).not.toBeNull();
  });

  it("should extract dividend data", async () => {
    const result = await fetchSAStatistics("EMAAR", "DFM");
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.dividendYield).not.toBeNull();
    expect(result.payoutRatio).not.toBeNull();
  });
});

describe("StockAnalysis Profile Parser", () => {
  it("should extract profile data from real EMAAR HTML", async () => {
    const result = await fetchSAProfile("EMAAR", "DFM");
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.companyName).toBe("Emaar Properties PJSC");
    expect(result.country).toBe("United Arab Emirates");
    expect(result.founded).toBe("1997");
    expect(result.industry).toBe("Real Estate - Development");
    expect(result.sector).toBe("Real Estate");
    expect(result.ceo).toBe("Amit Jain");
  });

  it("should extract contact details", async () => {
    const result = await fetchSAProfile("EMAAR", "DFM");
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.phone).toBe("971 4 366 1688");
    expect(result.website).toContain("emaar.com");
    expect(result.address).toContain("Dubai");
  });

  it("should extract executives", async () => {
    const result = await fetchSAProfile("EMAAR", "DFM");
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.executives.length).toBeGreaterThan(0);
    const ceo = result.executives.find((e) => e.name === "Amit Jain");
    expect(ceo).toBeDefined();
    expect(ceo?.position).toBe("Chief Executive Officer");
  });

  it("should extract stock details", async () => {
    const result = await fetchSAProfile("EMAAR", "DFM");
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.tickerSymbol).toBe("EMAAR");
    expect(result.exchange).toBe("Dubai Financial Market");
    expect(result.isinNumber).toBe("AEE000301011");
    expect(result.reportingCurrency).toBe("AED");
  });

  it("should extract company description", async () => {
    const result = await fetchSAProfile("EMAAR", "DFM");
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.description).not.toBeNull();
    expect(result.description).toContain("property investment");
  });
});
