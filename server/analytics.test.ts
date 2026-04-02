import { describe, it, expect, vi } from "vitest";
import { recordPageView, getGeoBreakdown, getPageAnalytics, getRecentVisitors, getVisitorStats } from "./db";

describe("Analytics — Page View Tracking", () => {
  it("recordPageView returns without error for valid input", async () => {
    const result = await recordPageView({
      pagePath: "/stock/EMAAR",
      symbol: "EMAAR",
      visitorHash: "test-hash-" + Date.now(),
    });
    // Should not throw — result may be void or undefined
    expect(true).toBe(true);
  }, 15000);

  it("recordPageView handles null symbol for non-stock pages", async () => {
    const result = await recordPageView({
      pagePath: "/screener",
      symbol: null,
      visitorHash: "test-hash-screener-" + Date.now(),
    });
    expect(true).toBe(true);
  }, 15000);
});

describe("Analytics — Geographic Breakdown", () => {
  it("getGeoBreakdown returns countries and cities arrays", async () => {
    const result = await getGeoBreakdown(30);
    expect(result).toHaveProperty("countries");
    expect(result).toHaveProperty("cities");
    expect(Array.isArray(result.countries)).toBe(true);
    expect(Array.isArray(result.cities)).toBe(true);
  }, 15000);

  it("getGeoBreakdown country entries have expected shape", async () => {
    const result = await getGeoBreakdown(7);
    if (result.countries.length > 0) {
      const c = result.countries[0];
      expect(c).toHaveProperty("country");
      expect(c).toHaveProperty("countryCode");
      expect(c).toHaveProperty("visitors");
      expect(c).toHaveProperty("pageViews");
      expect(typeof c.visitors).toBe("number");
    }
  }, 15000);
});

describe("Analytics — Page Analytics", () => {
  it("getPageAnalytics returns topPages, topStocks, and dailyTraffic", async () => {
    const result = await getPageAnalytics(30);
    expect(result).toHaveProperty("topPages");
    expect(result).toHaveProperty("topStocks");
    expect(result).toHaveProperty("dailyTraffic");
    expect(Array.isArray(result.topPages)).toBe(true);
    expect(Array.isArray(result.topStocks)).toBe(true);
    expect(Array.isArray(result.dailyTraffic)).toBe(true);
  }, 15000);

  it("topStocks entries have expected shape", async () => {
    const result = await getPageAnalytics(30);
    if (result.topStocks.length > 0) {
      const s = result.topStocks[0];
      expect(s).toHaveProperty("symbol");
      expect(s).toHaveProperty("totalViews");
      expect(s).toHaveProperty("uniqueVisitors");
      expect(typeof s.totalViews).toBe("number");
    }
  }, 15000);

  it("dailyTraffic entries have date, visitors, pageViews", async () => {
    const result = await getPageAnalytics(30);
    if (result.dailyTraffic.length > 0) {
      const d = result.dailyTraffic[0];
      expect(d).toHaveProperty("date");
      expect(d).toHaveProperty("visitors");
      expect(d).toHaveProperty("pageViews");
    }
  }, 15000);
});

describe("Analytics — Recent Visitors", () => {
  it("getRecentVisitors returns an array", async () => {
    const result = await getRecentVisitors(10);
    expect(Array.isArray(result)).toBe(true);
  }, 15000);

  it("recent visitor entries have expected shape", async () => {
    const result = await getRecentVisitors(10);
    if (result.length > 0) {
      const v = result[0];
      expect(v).toHaveProperty("country");
      expect(v).toHaveProperty("city");
      expect(v).toHaveProperty("visitDate");
      expect(v).toHaveProperty("pageViews");
    }
  }, 15000);
});

describe("Analytics — Visitor Stats", () => {
  it("getVisitorStats returns totalPageViews field", async () => {
    const result = await getVisitorStats();
    expect(result).toHaveProperty("totalVisitors");
    expect(result).toHaveProperty("todayVisitors");
    expect(result).toHaveProperty("totalPageViews");
    expect(result).toHaveProperty("onlineNow");
    expect(typeof result.totalPageViews).toBe("number");
  }, 15000);
});
