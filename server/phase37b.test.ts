import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Phase 37b: Tab overlap fix + Yahoo/SWS removal", () => {
  // ─── Tab Overlap Fix ───
  describe("StockDetail tab layout fix", () => {
    const stockDetailPath = path.join(__dirname, "../client/src/pages/StockDetail.tsx");
    const content = fs.readFileSync(stockDetailPath, "utf-8");

    it("TabsList uses h-auto for dynamic height", () => {
      expect(content).toContain("h-auto");
    });

    it("TabsList has flex-wrap for mobile wrapping", () => {
      expect(content).toContain("flex-wrap");
    });

    it("TabsList has gap for spacing between wrapped tabs", () => {
      expect(content).toMatch(/gap-[0-9]/);
    });

    it("TabsList has overflow-x-auto for horizontal scrolling", () => {
      expect(content).toContain("overflow-x-auto");
    });
  });

  // ─── Yahoo Finance Removal from stockService ───
  describe("stockService.ts - Yahoo Finance removed", () => {
    const servicePath = path.join(__dirname, "stockService.ts");
    const content = fs.readFileSync(servicePath, "utf-8");

    it("does NOT contain Yahoo Finance API URLs", () => {
      expect(content).not.toContain("query2.finance.yahoo.com");
      expect(content).not.toContain("YAHOO_V7");
      expect(content).not.toContain("YAHOO_V8");
    });

    it("does NOT contain Yahoo crumb logic", () => {
      expect(content).not.toContain("getYahooCrumb");
      expect(content).not.toContain("cachedCrumb");
      expect(content).not.toContain("cachedCookies");
      expect(content).not.toContain("crumbExpiry");
    });

    it("does NOT contain fetchQuoteViaDataApi (Yahoo Data API)", () => {
      expect(content).not.toContain("fetchQuoteViaDataApi");
      expect(content).not.toContain("YahooFinance/get_stock_chart");
    });

    it("does NOT contain fetchBatchQuotesDirect (Yahoo direct)", () => {
      expect(content).not.toContain("fetchBatchQuotesDirect");
    });

    it("fetchFullProfile returns null (stub)", () => {
      expect(content).toContain("export async function fetchFullProfile");
      expect(content).toContain("return null");
    });

    it("uses TwelveData as primary data source", () => {
      expect(content).toContain("api.twelvedata.com");
      expect(content).toContain("TWELVEDATA_API_KEY");
    });

    it("uses TradingView scanner as fallback", () => {
      expect(content).toContain("scanner.tradingview.com");
    });

    it("exports fetchYahooChart for backward compatibility", () => {
      expect(content).toContain("export async function fetchYahooChart");
    });

    it("exports fetchStockData", () => {
      expect(content).toContain("export async function fetchStockData");
    });

    it("exports fetchBatchQuotes", () => {
      expect(content).toContain("export async function fetchBatchQuotes");
    });

    it("exports memory cache functions", () => {
      expect(content).toContain("export function getFromMemoryCache");
      expect(content).toContain("export function setMemoryCache");
      expect(content).toContain("export function clearMemoryCache");
    });
  });

  // ─── Yahoo Finance Removal from routers.ts ───
  describe("routers.ts - Yahoo/SWS references removed", () => {
    const routersPath = path.join(__dirname, "routers.ts");
    const content = fs.readFileSync(routersPath, "utf-8");

    it("does NOT import getSWSStats", () => {
      expect(content).not.toContain("getSWSStats");
    });

    it("does NOT import getYahooStats", () => {
      expect(content).not.toContain("getYahooStats");
    });

    it("does NOT reference yahooProfile in snowflake section", () => {
      expect(content).not.toContain("let yahooProfile");
    });

    it("profile section uses TradingView only (no co, ks, div, an, ti vars)", () => {
      // These were the old Yahoo-derived variables
      expect(content).not.toMatch(/\bco\.name\b/);
      expect(content).not.toMatch(/\bks\.marketCap\b/);
      expect(content).not.toMatch(/\bti\.previousClose\b/);
      expect(content).not.toMatch(/\ban\.targetMeanPrice\b/);
    });

    it("profile section returns TradingView data for company info", () => {
      expect(content).toContain("tv.description || null");
      expect(content).toContain("tv.sector || stock.sector || null");
    });
  });

  // ─── API Status Service - All 7 data sources ───
  describe("apiStatusService.ts - All 7 data sources", () => {
    const statusPath = path.join(__dirname, "services/apiStatusService.ts");
    const content = fs.readFileSync(statusPath, "utf-8");

    it("contains SimplyWall.St as a Scrapfly-powered source", () => {
      expect(content).toContain("simplywall");
    });

    it("does NOT contain Yahoo Finance", () => {
      expect(content).not.toContain("Yahoo Finance");
      expect(content).not.toContain("yahoo");
    });

    it("contains TwelveData source", () => {
      expect(content).toContain("twelvedata");
      expect(content).toContain("TwelveData");
    });

    it("contains TradingView source", () => {
      expect(content).toContain("tradingview");
      expect(content).toContain("TradingView");
    });
  });

  // ─── Admin.tsx - Data source logos ───
  describe("Admin.tsx - Data source references", () => {
    const adminPath = path.join(__dirname, "../client/src/pages/Admin.tsx");
    const content = fs.readFileSync(adminPath, "utf-8");

    it("does NOT contain YahooLogo function", () => {
      expect(content).not.toContain("YahooLogo");
    });

    it("does NOT contain yahoo case in getSourceLogo", () => {
      expect(content).not.toContain('"yahoo"');
    });

    it("contains simplywall as a Scrapfly-powered source", () => {
      expect(content).toContain('"simplywall"');
    });

    it("contains all 7 data source references", () => {
      expect(content).toContain("twelvedata");
      expect(content).toContain("tradingview");
      expect(content).toContain("scrapfly");
      expect(content).toContain("stockanalysis");
      expect(content).toContain("marketscreener");
      expect(content).toContain("investingcom");
      expect(content).toContain("simplywall");
    });
  });

  // ─── Frontend - No Yahoo/SWS references ───
  describe("Frontend - No Yahoo/SWS references in components", () => {
    const forecastsPath = path.join(__dirname, "../client/src/components/StockForecastsTab.tsx");
    const forecastsContent = fs.readFileSync(forecastsPath, "utf-8");

    it("StockForecastsTab does not reference hasYahooAnalyst", () => {
      expect(forecastsContent).not.toContain("hasYahooAnalyst");
    });

    it("StockForecastsTab uses hasAnalystData instead", () => {
      expect(forecastsContent).toContain("hasAnalystData");
    });
  });
});
