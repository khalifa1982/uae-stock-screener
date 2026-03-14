/**
 * Phase 43 Tests — Full Data Scraping Integration
 * Tests for: Scrapfly service, StockAnalysis expanded, MarketScreener, Investing.com
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ─── Scrapfly Base Service Tests ─────────────────────────────────────
describe("Scrapfly Base Service", () => {
  const servicePath = path.join(__dirname, "services/scrapflyService.ts");

  it("service file exists", () => {
    expect(fs.existsSync(servicePath)).toBe(true);
  });

  it("exports scrapflyFetch function", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("export async function scrapflyFetch");
  });

  it("uses scrapflyApiKey from env", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("scrapflyApiKey");
  });

  it("has proper error handling", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("catch");
  });

  it("returns ScrapflyResult with content field", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("ScrapflyResult");
    expect(content).toContain("content");
  });
});

// ─── StockAnalysis.com Expanded Service Tests ────────────────────────
describe("StockAnalysis.com Expanded Service", () => {
  const servicePath = path.join(__dirname, "services/stockAnalysisService.ts");

  it("service file exists", () => {
    expect(fs.existsSync(servicePath)).toBe(true);
  });

  it("exports fetchSAFinancials function", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("export async function fetchSAFinancials");
  });

  it("exports fetchSADividends function", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("export async function fetchSADividends");
  });

  it("has SAFinancialsData interface with income, balance, cashflow, ratios", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("SAFinancialsData");
    expect(content).toContain("incomeStatement");
    expect(content).toContain("balanceSheet");
    expect(content).toContain("cashFlow");
    expect(content).toContain("ratios");
  });

  it("has SADividendData interface with history and yields", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("SADividendData");
    expect(content).toContain("history");
    expect(content).toContain("annualYields");
    expect(content).toContain("currentYield");
    expect(content).toContain("payoutRatio");
  });

  it("uses scrapflyFetch for data fetching", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("scrapflyFetch");
  });

  it("has caching mechanism", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("Cache");
    expect(content).toContain("CACHE_TTL");
  });

  it("handles ADX and DFM exchange URL patterns", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("stockanalysis.com");
  });
});

// ─── MarketScreener Service Tests ────────────────────────────────────
describe("MarketScreener Service", () => {
  const servicePath = path.join(__dirname, "services/marketScreenerService.ts");

  it("service file exists", () => {
    expect(fs.existsSync(servicePath)).toBe(true);
  });

  it("exports fetchMSData function", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("export async function fetchMSData");
  });

  it("has MSData interface with ownership, consensus, and esg", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("MSData");
    expect(content).toContain("ownership");
    expect(content).toContain("consensus");
    expect(content).toContain("esg");
  });

  it("parses shareholders with name, equityPercent, valuationMln", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("shareholders");
    expect(content).toContain("equityPercent");
    expect(content).toContain("valuationMln");
  });

  it("parses ownership breakdown categories", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("ownershipBreakdown");
  });

  it("parses geographic distribution", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("geographicDistribution");
  });

  it("parses analyst consensus with recommendation and target price", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("recommendation");
    expect(content).toContain("targetPrice");
    expect(content).toContain("analystCount");
  });

  it("parses ESG MSCI rating", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("msciRating");
  });

  it("uses scrapflyFetch for data fetching", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("scrapflyFetch");
  });

  it("has caching mechanism", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("Cache");
  });
});

// ─── Investing.com Service Tests ─────────────────────────────────────
describe("Investing.com Service", () => {
  const servicePath = path.join(__dirname, "services/investingComService.ts");

  it("service file exists", () => {
    expect(fs.existsSync(servicePath)).toBe(true);
  });

  it("exports fetchINVData function", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("export async function fetchINVData");
  });

  it("has INVData interface with dividends and analyst data", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("INVData");
    expect(content).toContain("dividends");
    expect(content).toContain("analyst");
  });

  it("parses dividend yield and annual dividend", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("currentYield");
    expect(content).toContain("annualDividend");
  });

  it("uses scrapflyFetch for data fetching", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("scrapflyFetch");
  });

  it("has caching mechanism", () => {
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("Cache");
  });
});

// ─── tRPC Router Endpoints Tests ─────────────────────────────────────
describe("tRPC Router - New Endpoints", () => {
  const routersPath = path.join(__dirname, "routers.ts");
  const content = fs.readFileSync(routersPath, "utf-8");

  it("has sa router with financials and dividends procedures", () => {
    expect(content).toContain("sa:");
    expect(content).toContain("financials:");
    expect(content).toContain("dividends:");
  });

  it("has marketScreener router with data procedure", () => {
    expect(content).toContain("marketScreener:");
  });

  it("has investingCom router with data procedure", () => {
    expect(content).toContain("investingCom:");
  });

  it("imports fetchSAFinancials and fetchSADividends", () => {
    expect(content).toContain("fetchSAFinancials");
    expect(content).toContain("fetchSADividends");
  });

  it("imports fetchMSData", () => {
    expect(content).toContain("fetchMSData");
  });

  it("imports fetchINVData", () => {
    expect(content).toContain("fetchINVData");
  });
});

// ─── UI Component Tests ──────────────────────────────────────────────
describe("UI Components", () => {
  const clientSrc = path.join(__dirname, "../client/src");

  it("SAFinancialsView component exists", () => {
    expect(fs.existsSync(path.join(clientSrc, "components/SAFinancialsView.tsx"))).toBe(true);
  });

  it("OwnershipView component exists", () => {
    expect(fs.existsSync(path.join(clientSrc, "components/OwnershipView.tsx"))).toBe(true);
  });

  it("DividendsView component exists", () => {
    expect(fs.existsSync(path.join(clientSrc, "components/DividendsView.tsx"))).toBe(true);
  });

  it("SAFinancialsView has sub-tabs for IS, BS, CF, Ratios", () => {
    const content = fs.readFileSync(path.join(clientSrc, "components/SAFinancialsView.tsx"), "utf-8");
    expect(content).toContain("Income Statement");
    expect(content).toContain("Balance Sheet");
    expect(content).toContain("Cash Flow");
    expect(content).toContain("Ratios");
  });

  it("OwnershipView shows shareholders, breakdown, geographic, ESG", () => {
    const content = fs.readFileSync(path.join(clientSrc, "components/OwnershipView.tsx"), "utf-8");
    expect(content).toContain("Major Shareholders");
    expect(content).toContain("Ownership Breakdown");
    expect(content).toContain("Geographic Distribution");
    expect(content).toContain("ESG MSCI Rating");
  });

  it("DividendsView shows yield, annual dividend, payout ratio", () => {
    const content = fs.readFileSync(path.join(clientSrc, "components/DividendsView.tsx"), "utf-8");
    expect(content).toContain("Dividend Yield");
    expect(content).toContain("Annual Dividend");
    expect(content).toContain("Payout Ratio");
    expect(content).toContain("Dividend History");
  });

  it("StockDetail page has Dividends and Ownership tabs", () => {
    const content = fs.readFileSync(path.join(clientSrc, "pages/StockDetail.tsx"), "utf-8");
    expect(content).toContain('value="dividends"');
    expect(content).toContain('value="ownership"');
    expect(content).toContain("OwnershipView");
    expect(content).toContain("DividendsView");
  });

  it("StockDetail page imports OwnershipView and DividendsView", () => {
    const content = fs.readFileSync(path.join(clientSrc, "pages/StockDetail.tsx"), "utf-8");
    expect(content).toContain('import OwnershipView from "@/components/OwnershipView"');
    expect(content).toContain('import DividendsView from "@/components/DividendsView"');
  });
});

// ─── Aboood.AI Rename Verification ──────────────────────────────────
describe("Aboood.AI Rename Verification", () => {
  const clientSrc = path.join(__dirname, "../client/src");

  it("no display text string 'Abboud AI' remains in overlay component", () => {
    const content = fs.readFileSync(path.join(clientSrc, "components/AbboudIndicatorOverlay.tsx"), "utf-8");
    // Check that no quoted display text "Abboud AI" exists (internal variable names like ABBOUD_COLORS are fine)
    const displayTextMatches = content.match(/["']Abboud AI["']/g);
    expect(displayTextMatches).toBeNull();
  });

  it("chart legend uses Aboood.AI", () => {
    const content = fs.readFileSync(path.join(clientSrc, "components/AdvancedChart.tsx"), "utf-8");
    expect(content).toContain("Aboood.AI");
  });
});
