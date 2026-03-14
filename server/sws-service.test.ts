/**
 * SimplyWall.St Service Tests (v2 - Scrapfly-powered)
 *
 * Tests the data extraction from window.__REACT_QUERY_STATE__,
 * cache behavior, and health check functionality.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Scrapfly ──────────────────────────────────────────────────

const mockScrapflyFetch = vi.fn();
vi.mock("./services/scrapflyService", () => ({
  scrapflyFetch: (...args: any[]) => mockScrapflyFetch(...args),
}));

// Mock cache metrics
vi.mock("./services/cacheMetricsService", () => ({
  recordCacheHit: vi.fn(),
  recordCacheMiss: vi.fn(),
}));

// ─── Test Data ──────────────────────────────────────────────────────

const MOCK_REACT_QUERY_STATE = {
  mutations: [],
  queries: [
    {
      queryKey: ["company", "/stocks/ae/commercial-services/dfm-upp/union-properties-shares", "info,score"],
      state: {
        data: {
          data: {
            id: 9682763,
            company_id: "00F9DC7F-65EE-4BD2-8C56-AB1AE6039A80",
            name: "Union Properties",
            slug: "union-properties",
            exchange_symbol: "DFM",
            ticker_symbol: "UPP",
            unique_symbol: "DFM:UPP",
            canonical_url: "/stocks/ae/commercial-services/dfm-upp/union-properties-shares",
            score: {
              data: {
                value: 2,
                income: 0,
                health: 5,
                past: 4,
                future: 6,
                management: 0,
                misc: 0,
                total: 18,
                sentence: "Exceptional growth potential with excellent balance sheet.",
                snowflake: {
                  data: {
                    axes: [3, 7, 5, 6, 1],
                    color: 0.4,
                  },
                },
              },
            },
            checks: [
              { name: "Debt Level", pass: true, description: "Low debt" },
              { name: "Revenue Growth", pass: true, description: "Growing" },
              { name: "Dividend", pass: false, description: "No dividend" },
              { name: "Insider Trading", pass: false, description: "Recent selling" },
            ],
            analysis: {
              data: {
                id: 123,
                share_price: 0.723,
                market_cap: 844.34,
                intrinsic_discount: -0.15,
                pe: 6.706,
                pb: 0.849,
                peg: 0.5,
                extended: {
                  data: {
                    scores: {
                      value: 2,
                      income: 0,
                      health: 5,
                      past: 4,
                      future: 6,
                      management: 0,
                      misc: 0,
                      total: 18,
                      sentence: "Exceptional growth potential with excellent balance sheet.",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      queryKey: ["CompanySummary", { canonicalUrl: "/stocks/ae/commercial-services/dfm-upp/union-properties-shares" }],
      state: {
        data: {
          Company: {
            score: {
              dividend: 0,
              future: 6,
              health: 5,
              past: 4,
              value: 2,
            },
          },
        },
      },
    },
  ],
};

function buildMockHtml(rqs: any): string {
  const json = JSON.stringify(rqs);
  return `
    <html>
    <head><title>Test</title></head>
    <body>
      <div id="root"></div>
      <script>window.__REACT_QUERY_STATE__ = ${json}</script>
    </body>
    </html>
  `;
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("SimplyWall.St Service v2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module state by re-importing
    vi.resetModules();
  });

  describe("Data Extraction", () => {
    it("should extract snowflake scores from __REACT_QUERY_STATE__", async () => {
      const html = buildMockHtml(MOCK_REACT_QUERY_STATE);
      mockScrapflyFetch.mockResolvedValueOnce({
        content: html,
        status: 200,
        url: "https://simplywall.st/stocks/ae/commercial-services/dfm-upp/union-properties-shares",
        cached: false,
      });

      const { fetchSWSCompanyData } = await import("./services/simplyWallStService");
      const result = await fetchSWSCompanyData("UPP", "DFM", "Union Properties",
        "/stocks/ae/commercial-services/dfm-upp/union-properties-shares");

      expect(result).not.toBeNull();
      expect(result!.valueScore).toBe(2);
      expect(result!.futureScore).toBe(6);
      expect(result!.pastScore).toBe(4);
      expect(result!.healthScore).toBe(5);
      expect(result!.dividendScore).toBe(0);
      expect(result!.totalScore).toBe(18);
    });

    it("should extract company name and ticker", async () => {
      const html = buildMockHtml(MOCK_REACT_QUERY_STATE);
      mockScrapflyFetch.mockResolvedValueOnce({
        content: html,
        status: 200,
        url: "test",
        cached: false,
      });

      const { fetchSWSCompanyData } = await import("./services/simplyWallStService");
      const result = await fetchSWSCompanyData("UPP", "DFM", "Union Properties",
        "/stocks/ae/commercial-services/dfm-upp/union-properties-shares");

      expect(result).not.toBeNull();
      expect(result!.name).toBe("Union Properties");
      expect(result!.ticker).toBe("DFM:UPP");
      expect(result!.exchange).toBe("DFM");
    });

    it("should extract valuation data (PE, PB, market cap)", async () => {
      const html = buildMockHtml(MOCK_REACT_QUERY_STATE);
      mockScrapflyFetch.mockResolvedValueOnce({
        content: html,
        status: 200,
        url: "test",
        cached: false,
      });

      const { fetchSWSCompanyData } = await import("./services/simplyWallStService");
      const result = await fetchSWSCompanyData("UPP", "DFM", "Union Properties",
        "/stocks/ae/commercial-services/dfm-upp/union-properties-shares");

      expect(result).not.toBeNull();
      expect(result!.pe).toBeCloseTo(6.706, 2);
      expect(result!.pb).toBeCloseTo(0.849, 2);
      expect(result!.currentPrice).toBeCloseTo(0.723, 2);
      expect(result!.marketCap).toBeCloseTo(844.34, 1);
    });

    it("should extract risk checks and calculate risk level", async () => {
      const html = buildMockHtml(MOCK_REACT_QUERY_STATE);
      mockScrapflyFetch.mockResolvedValueOnce({
        content: html,
        status: 200,
        url: "test",
        cached: false,
      });

      const { fetchSWSCompanyData } = await import("./services/simplyWallStService");
      const result = await fetchSWSCompanyData("UPP", "DFM", "Union Properties",
        "/stocks/ae/commercial-services/dfm-upp/union-properties-shares");

      expect(result).not.toBeNull();
      expect(result!.riskChecksTotal).toBe(4);
      expect(result!.riskChecksPassed).toBe(2);
      expect(result!.riskLevel).toBe("Medium"); // 2 failed checks
      expect(result!.riskFactors).toHaveLength(2);
      expect(result!.riskFactors).toContain("Dividend");
      expect(result!.riskFactors).toContain("Insider Trading");
    });

    it("should extract snowflake axes for radar chart", async () => {
      const html = buildMockHtml(MOCK_REACT_QUERY_STATE);
      mockScrapflyFetch.mockResolvedValueOnce({
        content: html,
        status: 200,
        url: "test",
        cached: false,
      });

      const { fetchSWSCompanyData } = await import("./services/simplyWallStService");
      const result = await fetchSWSCompanyData("UPP", "DFM", "Union Properties",
        "/stocks/ae/commercial-services/dfm-upp/union-properties-shares");

      expect(result).not.toBeNull();
      expect(result!.snowflakeAxes).toEqual([3, 7, 5, 6, 1]);
    });

    it("should extract score sentence", async () => {
      const html = buildMockHtml(MOCK_REACT_QUERY_STATE);
      mockScrapflyFetch.mockResolvedValueOnce({
        content: html,
        status: 200,
        url: "test",
        cached: false,
      });

      const { fetchSWSCompanyData } = await import("./services/simplyWallStService");
      const result = await fetchSWSCompanyData("UPP", "DFM", "Union Properties",
        "/stocks/ae/commercial-services/dfm-upp/union-properties-shares");

      expect(result).not.toBeNull();
      expect(result!.scoreSentence).toBe("Exceptional growth potential with excellent balance sheet.");
    });

    it("should calculate fair value from intrinsic discount", async () => {
      const html = buildMockHtml(MOCK_REACT_QUERY_STATE);
      mockScrapflyFetch.mockResolvedValueOnce({
        content: html,
        status: 200,
        url: "test",
        cached: false,
      });

      const { fetchSWSCompanyData } = await import("./services/simplyWallStService");
      const result = await fetchSWSCompanyData("UPP", "DFM", "Union Properties",
        "/stocks/ae/commercial-services/dfm-upp/union-properties-shares");

      expect(result).not.toBeNull();
      // fairValue = sharePrice / (1 + intrinsicDiscount) = 0.723 / (1 + (-0.15)) = 0.723 / 0.85 ≈ 0.8506
      expect(result!.fairValue).toBeCloseTo(0.8506, 2);
      // undervaluedPercent = -intrinsicDiscount * 100 = 15%
      expect(result!.undervaluedPercent).toBeCloseTo(15, 0);
    });

    it("should store canonical URL for future use", async () => {
      const html = buildMockHtml(MOCK_REACT_QUERY_STATE);
      mockScrapflyFetch.mockResolvedValueOnce({
        content: html,
        status: 200,
        url: "test",
        cached: false,
      });

      const { fetchSWSCompanyData, getCanonicalUrlCache } = await import("./services/simplyWallStService");
      await fetchSWSCompanyData("UPP", "DFM", "Union Properties",
        "/stocks/ae/commercial-services/dfm-upp/union-properties-shares");

      const cache = getCanonicalUrlCache();
      expect(cache["DFM:UPP"]).toBe("/stocks/ae/commercial-services/dfm-upp/union-properties-shares");
    });
  });

  describe("Error Handling", () => {
    it("should return null when page has no __REACT_QUERY_STATE__", async () => {
      mockScrapflyFetch.mockResolvedValueOnce({
        content: "<html><body>No data here</body></html>",
        status: 200,
        url: "test",
        cached: false,
      });

      const { fetchSWSCompanyData } = await import("./services/simplyWallStService");
      const result = await fetchSWSCompanyData("UPP", "DFM", "Union Properties",
        "/stocks/ae/commercial-services/dfm-upp/union-properties-shares");

      expect(result).toBeNull();
    });

    it("should return null on HTTP error", async () => {
      mockScrapflyFetch.mockResolvedValueOnce({
        content: "",
        status: 403,
        url: "test",
        cached: false,
      });

      const { fetchSWSCompanyData } = await import("./services/simplyWallStService");
      const result = await fetchSWSCompanyData("UPP", "DFM", "Union Properties",
        "/stocks/ae/commercial-services/dfm-upp/union-properties-shares");

      expect(result).toBeNull();
    });

    it("should return null on network error", async () => {
      mockScrapflyFetch.mockRejectedValueOnce(new Error("Network timeout"));

      const { fetchSWSCompanyData } = await import("./services/simplyWallStService");
      const result = await fetchSWSCompanyData("UPP", "DFM", "Union Properties",
        "/stocks/ae/commercial-services/dfm-upp/union-properties-shares");

      expect(result).toBeNull();
    });
  });

  describe("Scrapfly Integration", () => {
    it("should call scrapflyFetch with ASP and JS rendering enabled", async () => {
      const html = buildMockHtml(MOCK_REACT_QUERY_STATE);
      mockScrapflyFetch.mockResolvedValueOnce({
        content: html,
        status: 200,
        url: "test",
        cached: false,
      });

      const { fetchSWSCompanyData } = await import("./services/simplyWallStService");
      await fetchSWSCompanyData("UPP", "DFM", "Union Properties",
        "/stocks/ae/commercial-services/dfm-upp/union-properties-shares");

      expect(mockScrapflyFetch).toHaveBeenCalledWith(
        "https://simplywall.st/stocks/ae/commercial-services/dfm-upp/union-properties-shares",
        expect.objectContaining({
          asp: true,
          renderJs: true,
          country: "ae",
        })
      );
    });
  });

  describe("Health Check", () => {
    it("should report connected when Scrapfly returns valid data", async () => {
      const html = buildMockHtml(MOCK_REACT_QUERY_STATE);
      mockScrapflyFetch.mockResolvedValueOnce({
        content: html,
        status: 200,
        url: "test",
        cached: false,
      });

      const { checkSWSHealth } = await import("./services/simplyWallStService");
      const status = await checkSWSHealth();

      expect(status.connected).toBe(true);
      expect(status.error).toBeNull();
      expect(status.method).toBe("scrapfly-asp");
    });

    it("should report disconnected on failure", async () => {
      mockScrapflyFetch.mockRejectedValueOnce(new Error("Scrapfly timeout"));

      const { checkSWSHealth } = await import("./services/simplyWallStService");
      const status = await checkSWSHealth();

      expect(status.connected).toBe(false);
      expect(status.error).toContain("timeout");
    });
  });

  describe("Statistics", () => {
    it("should track request statistics", async () => {
      const html = buildMockHtml(MOCK_REACT_QUERY_STATE);
      mockScrapflyFetch.mockResolvedValueOnce({
        content: html,
        status: 200,
        url: "test",
        cached: false,
      });

      const { fetchSWSCompanyData, getSWSStats } = await import("./services/simplyWallStService");
      await fetchSWSCompanyData("UPP", "DFM", "Union Properties",
        "/stocks/ae/commercial-services/dfm-upp/union-properties-shares");

      const stats = getSWSStats();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(1);
      expect(stats.cachedCompanies).toBeGreaterThanOrEqual(1);
    });
  });
});
