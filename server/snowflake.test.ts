import { describe, expect, it } from "vitest";
import { computeSnowflake, computeMarketAverages, type SnowflakeInput } from "./services/snowflakeEngine";

// ─── Test Data ──────────────────────────────────────────────────────

function createBaseInput(overrides: Partial<SnowflakeInput> = {}): SnowflakeInput {
  return {
    close: 10.0,
    pe: 12.0,
    pb: 1.5,
    peg: 0.8,
    marketCap: 50e9,
    eps: 0.83,
    epsForecast: 0.95,
    netIncome: 5e9,
    totalRevenue: 20e9,
    ebitda: 8e9,
    grossProfit: 12e9,
    roe: 0.22,
    roa: 0.08,
    roic: 0.15,
    grossMargin: 0.60,
    operatingMargin: 0.35,
    netMargin: 0.25,
    totalAssets: 100e9,
    totalLiabilities: 40e9,
    totalCurrentAssets: 30e9,
    totalCurrentLiabilities: 15e9,
    totalDebt: 10e9,
    debtToEquity: 25,
    currentRatio: 2.0,
    freeCashFlow: 6e9,
    operatingCashFlow: 8e9,
    sharesOutstanding: 6e9,
    bookValuePerShare: 10.0,
    dividendYield: 0.04,
    dividendPerShare: 0.40,
    payoutRatio: 0.48,
    perfYear: 15.0,
    perf5Year: 80.0,
    sector: "Real Estate",
    industry: "Real Estate",
    marketAvgPE: 15.0,
    industryAvgPE: 14.0,
    industryAvgPB: 2.0,
    industryAvgROA: 0.05,
    marketAvgEarningsGrowth: 8.0,
    marketAvgRevenueGrowth: 6.0,
    marketDividendYield25thPctile: 0.02,
    marketDividendYield75thPctile: 0.06,
    ...overrides,
  };
}

// ─── Snowflake Scoring Tests ────────────────────────────────────────

describe("Snowflake Scoring Engine", () => {
  it("computes a valid snowflake result with all 5 categories", () => {
    const input = createBaseInput();
    const { snowflake, fairValue } = computeSnowflake(input);

    expect(snowflake.value).toBeDefined();
    expect(snowflake.future).toBeDefined();
    expect(snowflake.past).toBeDefined();
    expect(snowflake.health).toBeDefined();
    expect(snowflake.dividend).toBeDefined();
    expect(snowflake.totalScore).toBeGreaterThanOrEqual(0);
    expect(snowflake.totalScore).toBeLessThanOrEqual(30);
    expect(snowflake.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("each category has exactly 6 checks", () => {
    const input = createBaseInput();
    const { snowflake } = computeSnowflake(input);

    expect(snowflake.value.checks).toHaveLength(6);
    expect(snowflake.future.checks).toHaveLength(6);
    expect(snowflake.past.checks).toHaveLength(6);
    expect(snowflake.health.checks).toHaveLength(6);
    expect(snowflake.dividend.checks).toHaveLength(6);
  });

  it("category score equals count of passed checks", () => {
    const input = createBaseInput();
    const { snowflake } = computeSnowflake(input);

    for (const cat of [snowflake.value, snowflake.future, snowflake.past, snowflake.health, snowflake.dividend]) {
      const passedCount = cat.checks.filter(c => c.passed).length;
      expect(cat.score).toBe(passedCount);
      expect(cat.maxScore).toBe(6);
    }
  });

  it("total score is sum of all category scores", () => {
    const input = createBaseInput();
    const { snowflake } = computeSnowflake(input);

    const expectedTotal = snowflake.value.score + snowflake.future.score + snowflake.past.score + snowflake.health.score + snowflake.dividend.score;
    expect(snowflake.totalScore).toBe(expectedTotal);
  });
});

// ─── Value Checks Tests ─────────────────────────────────────────────

describe("Value Checks", () => {
  it("passes PE below market check when PE < market average", () => {
    const input = createBaseInput({ pe: 10, marketAvgPE: 15 });
    const { snowflake } = computeSnowflake(input);
    const check = snowflake.value.checks.find(c => c.id === "value_3");
    expect(check?.passed).toBe(true);
  });

  it("fails PE below market check when PE > market average", () => {
    const input = createBaseInput({ pe: 20, marketAvgPE: 15 });
    const { snowflake } = computeSnowflake(input);
    const check = snowflake.value.checks.find(c => c.id === "value_3");
    expect(check?.passed).toBe(false);
  });

  it("passes PEG check when PEG is between 0 and 1", () => {
    const input = createBaseInput({ peg: 0.7 });
    const { snowflake } = computeSnowflake(input);
    const check = snowflake.value.checks.find(c => c.id === "value_5");
    expect(check?.passed).toBe(true);
  });

  it("fails PEG check when PEG > 1", () => {
    const input = createBaseInput({ peg: 2.5 });
    const { snowflake } = computeSnowflake(input);
    const check = snowflake.value.checks.find(c => c.id === "value_5");
    expect(check?.passed).toBe(false);
  });
});

// ─── Health Checks Tests ────────────────────────────────────────────

describe("Health Checks", () => {
  it("passes short-term solvency when current assets > current liabilities", () => {
    const input = createBaseInput({ totalCurrentAssets: 50e9, totalCurrentLiabilities: 20e9 });
    const { snowflake } = computeSnowflake(input);
    const check = snowflake.health.checks.find(c => c.id === "health_1");
    expect(check?.passed).toBe(true);
  });

  it("fails short-term solvency when current assets < current liabilities", () => {
    const input = createBaseInput({ totalCurrentAssets: 10e9, totalCurrentLiabilities: 20e9 });
    const { snowflake } = computeSnowflake(input);
    const check = snowflake.health.checks.find(c => c.id === "health_1");
    expect(check?.passed).toBe(false);
  });

  it("passes low leverage when D/E < 40%", () => {
    const input = createBaseInput({ debtToEquity: 25 });
    const { snowflake } = computeSnowflake(input);
    const check = snowflake.health.checks.find(c => c.id === "health_4");
    expect(check?.passed).toBe(true);
  });

  it("fails low leverage when D/E > 40%", () => {
    const input = createBaseInput({ debtToEquity: 80 });
    const { snowflake } = computeSnowflake(input);
    const check = snowflake.health.checks.find(c => c.id === "health_4");
    expect(check?.passed).toBe(false);
  });

  it("passes all debt checks when company has no debt", () => {
    const input = createBaseInput({ totalDebt: 0, debtToEquity: 0 });
    const { snowflake } = computeSnowflake(input);
    // Checks 3, 4, 5, 6 should all pass when debt is 0
    const debtChecks = snowflake.health.checks.filter(c => ["health_3", "health_4", "health_5", "health_6"].includes(c.id));
    expect(debtChecks.every(c => c.passed)).toBe(true);
  });
});

// ─── Dividend Checks Tests ──────────────────────────────────────────

describe("Dividend Checks", () => {
  it("passes yield check when yield > 25th percentile", () => {
    const input = createBaseInput({ dividendYield: 0.04, marketDividendYield25thPctile: 0.02 });
    const { snowflake } = computeSnowflake(input);
    const check = snowflake.dividend.checks.find(c => c.id === "div_1");
    expect(check?.passed).toBe(true);
  });

  it("fails yield check when no dividend", () => {
    const input = createBaseInput({ dividendYield: 0, dividendPerShare: 0 });
    const { snowflake } = computeSnowflake(input);
    const check = snowflake.dividend.checks.find(c => c.id === "div_1");
    expect(check?.passed).toBe(false);
  });

  it("passes payout ratio check when ratio is between 0 and 90%", () => {
    const input = createBaseInput({ payoutRatio: 0.50 });
    const { snowflake } = computeSnowflake(input);
    const check = snowflake.dividend.checks.find(c => c.id === "div_5");
    expect(check?.passed).toBe(true);
  });

  it("fails payout ratio check when ratio > 90%", () => {
    const input = createBaseInput({ payoutRatio: 0.95 });
    const { snowflake } = computeSnowflake(input);
    const check = snowflake.dividend.checks.find(c => c.id === "div_5");
    expect(check?.passed).toBe(false);
  });
});

// ─── Fair Value Tests ───────────────────────────────────────────────

describe("Fair Value Estimation", () => {
  it("calculates fair value using DCF when FCF is available", () => {
    const input = createBaseInput({ freeCashFlow: 6e9, sharesOutstanding: 6e9 });
    const { fairValue } = computeSnowflake(input);
    expect(fairValue.fairValue).not.toBeNull();
    expect(fairValue.method).toBe("2-Stage DCF");
    expect(fairValue.currentPrice).toBe(10.0);
    expect(fairValue.discount).not.toBeNull();
  });

  it("returns null fair value when no data available", () => {
    const input = createBaseInput({
      close: 10,
      freeCashFlow: null,
      sharesOutstanding: null,
      roe: null,
      bookValuePerShare: null,
      eps: null,
    });
    const { fairValue } = computeSnowflake(input);
    expect(fairValue.method).toBe("Insufficient Data");
  });

  it("fair value discount is positive when undervalued", () => {
    // Low price + high FCF should give positive discount
    const input = createBaseInput({ close: 5, freeCashFlow: 10e9, sharesOutstanding: 6e9 });
    const { fairValue } = computeSnowflake(input);
    if (fairValue.fairValue && fairValue.discount !== null) {
      expect(fairValue.discount).toBeGreaterThan(0);
    }
  });
});

// ─── Market Averages Tests ──────────────────────────────────────────

describe("Market Averages", () => {
  it("computes valid market averages from stock data", () => {
    const stocks = [
      { pe: 10, priceToBook: 1.5, returnOnAssets: 5, perfYear: 10, dividendYield: 3, sector: "Real Estate", marketCap: 50e9 },
      { pe: 15, priceToBook: 2.0, returnOnAssets: 8, perfYear: 20, dividendYield: 5, sector: "Real Estate", marketCap: 30e9 },
      { pe: 20, priceToBook: 3.0, returnOnAssets: 3, perfYear: -5, dividendYield: 2, sector: "Banking", marketCap: 80e9 },
      { pe: 8, priceToBook: 1.0, returnOnAssets: 10, perfYear: 25, dividendYield: 7, sector: "Banking", marketCap: 100e9 },
    ];

    const avgs = computeMarketAverages(stocks);
    expect(avgs.marketAvgPE).toBeGreaterThan(0);
    expect(avgs.marketAvgEarningsGrowth).toBeDefined();
    expect(avgs.marketDividendYield25thPctile).toBeGreaterThan(0);
    expect(avgs.marketDividendYield75thPctile).toBeGreaterThanOrEqual(avgs.marketDividendYield25thPctile);
    expect(avgs.industryAvgPE["Real Estate"]).toBeDefined();
    expect(avgs.industryAvgPE["Banking"]).toBeDefined();
  });

  it("handles empty stock list gracefully", () => {
    const avgs = computeMarketAverages([]);
    expect(avgs.marketAvgPE).toBe(15); // default
    expect(avgs.marketAvgEarningsGrowth).toBe(5); // default
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────

describe("Edge Cases", () => {
  it("handles all null inputs without crashing", () => {
    const input = createBaseInput({
      close: null,
      pe: null,
      pb: null,
      peg: null,
      eps: null,
      roe: null,
      roa: null,
      roic: null,
      totalCurrentAssets: null,
      totalCurrentLiabilities: null,
      totalDebt: null,
      debtToEquity: null,
      freeCashFlow: null,
      operatingCashFlow: null,
      dividendYield: null,
      dividendPerShare: null,
      perfYear: null,
      perf5Year: null,
    });

    expect(() => computeSnowflake(input)).not.toThrow();
    const { snowflake } = computeSnowflake(input);
    // Some checks may pass with null data (e.g., debt-related checks pass when debt is null/0)
    expect(snowflake.totalScore).toBeGreaterThanOrEqual(0);
    expect(snowflake.totalScore).toBeLessThanOrEqual(30);
  });

  it("handles negative PE correctly", () => {
    const input = createBaseInput({ pe: -5 });
    const { snowflake } = computeSnowflake(input);
    const peCheck = snowflake.value.checks.find(c => c.id === "value_3");
    expect(peCheck?.passed).toBe(false); // Negative PE should fail
  });

  it("each check has required fields", () => {
    const input = createBaseInput();
    const { snowflake } = computeSnowflake(input);

    for (const cat of [snowflake.value, snowflake.future, snowflake.past, snowflake.health, snowflake.dividend]) {
      for (const check of cat.checks) {
        expect(check.id).toBeTruthy();
        expect(check.label).toBeTruthy();
        expect(check.description).toBeTruthy();
        expect(typeof check.passed).toBe("boolean");
      }
    }
  });
});
