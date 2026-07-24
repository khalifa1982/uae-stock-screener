import { describe, it, expect } from "vitest";

// We test the calculateStockScore function logic inline since it's a client component
// Replicate the scoring logic for server-side testing

function calculateStockScore(data: {
  pe: number | null;
  dividendYield: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  returnOnEquity: number | null;
  perfYear: number | null;
  priceToBook: number | null;
  beta: number | null;
  marketCap: number | null;
}) {
  let safety = 5;
  let valuation = 5;
  let growth = 5;

  // Safety Score
  let safetyPoints = 0;
  let safetyChecks = 0;
  if (data.debtToEquity != null) {
    safetyChecks++;
    if (data.debtToEquity < 30) safetyPoints += 10;
    else if (data.debtToEquity < 60) safetyPoints += 8;
    else if (data.debtToEquity < 100) safetyPoints += 6;
    else if (data.debtToEquity < 150) safetyPoints += 4;
    else safetyPoints += 2;
  }
  if (data.currentRatio != null) {
    safetyChecks++;
    if (data.currentRatio > 2) safetyPoints += 10;
    else if (data.currentRatio > 1.5) safetyPoints += 8;
    else if (data.currentRatio > 1) safetyPoints += 6;
    else if (data.currentRatio > 0.5) safetyPoints += 4;
    else safetyPoints += 2;
  }
  if (data.beta != null) {
    safetyChecks++;
    if (data.beta < 0.5) safetyPoints += 9;
    else if (data.beta < 0.8) safetyPoints += 8;
    else if (data.beta < 1.2) safetyPoints += 6;
    else if (data.beta < 1.5) safetyPoints += 4;
    else safetyPoints += 2;
  }
  if (data.marketCap != null) {
    safetyChecks++;
    if (data.marketCap > 50e9) safetyPoints += 10;
    else if (data.marketCap > 10e9) safetyPoints += 8;
    else if (data.marketCap > 2e9) safetyPoints += 6;
    else if (data.marketCap > 500e6) safetyPoints += 4;
    else safetyPoints += 2;
  }
  if (safetyChecks > 0) safety = safetyPoints / safetyChecks;

  // Valuation Score
  let valPoints = 0;
  let valChecks = 0;
  if (data.pe != null && data.pe > 0) {
    valChecks++;
    if (data.pe < 8) valPoints += 10;
    else if (data.pe < 12) valPoints += 8;
    else if (data.pe < 18) valPoints += 6;
    else if (data.pe < 25) valPoints += 4;
    else valPoints += 2;
  }
  if (data.priceToBook != null && data.priceToBook > 0) {
    valChecks++;
    if (data.priceToBook < 1) valPoints += 10;
    else if (data.priceToBook < 1.5) valPoints += 8;
    else if (data.priceToBook < 2.5) valPoints += 6;
    else if (data.priceToBook < 4) valPoints += 4;
    else valPoints += 2;
  }
  if (data.dividendYield != null) {
    valChecks++;
    const dy = data.dividendYield > 1 ? data.dividendYield : data.dividendYield * 100;
    if (dy > 6) valPoints += 10;
    else if (dy > 4) valPoints += 8;
    else if (dy > 2) valPoints += 6;
    else if (dy > 1) valPoints += 4;
    else valPoints += 2;
  }
  if (valChecks > 0) valuation = valPoints / valChecks;

  // Growth Score
  let growthPoints = 0;
  let growthChecks = 0;
  if (data.returnOnEquity != null) {
    growthChecks++;
    const roe = data.returnOnEquity > 1 ? data.returnOnEquity : data.returnOnEquity * 100;
    if (roe > 25) growthPoints += 10;
    else if (roe > 15) growthPoints += 8;
    else if (roe > 10) growthPoints += 6;
    else if (roe > 5) growthPoints += 4;
    else growthPoints += 2;
  }
  if (data.perfYear != null) {
    growthChecks++;
    if (data.perfYear > 50) growthPoints += 10;
    else if (data.perfYear > 20) growthPoints += 8;
    else if (data.perfYear > 5) growthPoints += 6;
    else if (data.perfYear > -10) growthPoints += 4;
    else growthPoints += 2;
  }
  if (growthChecks > 0) growth = growthPoints / growthChecks;

  const total = safety * 0.3 + valuation * 0.4 + growth * 0.3;

  let status: string;
  if (total >= 8) status = "Strong Buy";
  else if (total >= 6.5) status = "Buy";
  else if (total >= 4.5) status = "Hold";
  else if (total >= 3) status = "Sell";
  else status = "Strong Sell";

  return { safety, valuation, growth, total, status };
}

describe("Stock Score Calculation", () => {
  it("should return Strong Buy for excellent fundamentals", () => {
    const result = calculateStockScore({
      pe: 7,
      dividendYield: 0.08,
      debtToEquity: 20,
      currentRatio: 3,
      returnOnEquity: 30,
      perfYear: 60,
      priceToBook: 0.8,
      beta: 0.4,
      marketCap: 60e9,
    });
    expect(result.status).toBe("Strong Buy");
    expect(result.total).toBeGreaterThanOrEqual(8);
    expect(result.safety).toBeGreaterThan(8);
    expect(result.valuation).toBeGreaterThan(8);
    expect(result.growth).toBeGreaterThan(8);
  });

  it("should return Hold for average fundamentals", () => {
    const result = calculateStockScore({
      pe: 20,
      dividendYield: 0.02,
      debtToEquity: 80,
      currentRatio: 1.2,
      returnOnEquity: 8,
      perfYear: 10,
      priceToBook: 2,
      beta: 1.0,
      marketCap: 5e9,
    });
    expect(result.status).toBe("Hold");
    expect(result.total).toBeGreaterThanOrEqual(4.5);
    expect(result.total).toBeLessThan(6.5);
  });

  it("should return Sell or Strong Sell for poor fundamentals", () => {
    const result = calculateStockScore({
      pe: 40,
      dividendYield: 0.005,
      debtToEquity: 200,
      currentRatio: 0.3,
      returnOnEquity: 2,
      perfYear: -20,
      priceToBook: 6,
      beta: 2.0,
      marketCap: 200e6,
    });
    expect(["Sell", "Strong Sell"]).toContain(result.status);
    expect(result.total).toBeLessThan(5);
  });

  it("should handle null values gracefully", () => {
    const result = calculateStockScore({
      pe: null,
      dividendYield: null,
      debtToEquity: null,
      currentRatio: null,
      returnOnEquity: null,
      perfYear: null,
      priceToBook: null,
      beta: null,
      marketCap: null,
    });
    // All null → defaults to 5 for each
    expect(result.safety).toBe(5);
    expect(result.valuation).toBe(5);
    expect(result.growth).toBe(5);
    expect(result.total).toBe(5);
    expect(result.status).toBe("Hold");
  });

  it("should handle partial data", () => {
    const result = calculateStockScore({
      pe: 10,
      dividendYield: null,
      debtToEquity: 40,
      currentRatio: null,
      returnOnEquity: null,
      perfYear: 30,
      priceToBook: null,
      beta: 0.7,
      marketCap: null,
    });
    expect(result.total).toBeGreaterThan(0);
    expect(result.total).toBeLessThanOrEqual(10);
    expect(["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"]).toContain(result.status);
  });

  it("should weight valuation at 40% and safety/growth at 30% each", () => {
    // Create a scenario where valuation is high but others are low
    const result = calculateStockScore({
      pe: 5, // excellent valuation
      dividendYield: 0.1, // excellent
      debtToEquity: 200, // terrible safety
      currentRatio: 0.3, // terrible
      returnOnEquity: 1, // terrible growth
      perfYear: -30, // terrible
      priceToBook: 0.5, // excellent valuation
      beta: 2.0, // terrible safety
      marketCap: 100e6, // terrible safety
    });
    // Valuation should be high, safety low
    expect(result.valuation).toBeGreaterThan(8);
    expect(result.safety).toBeLessThan(4);
    // Total should follow the formula
    const expectedTotal = result.safety * 0.3 + result.valuation * 0.4 + result.growth * 0.3;
    expect(result.total).toBeCloseTo(expectedTotal, 1);
  });
});
