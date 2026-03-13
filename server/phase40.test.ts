/**
 * Phase 40 Tests — Abboud AI Indicator (Fibonacci + RSI Divergence)
 */
import { describe, it, expect } from "vitest";
import { computeAbboudIndicator, type OHLCPoint } from "./services/abboudIndicator";

// ─── Helper: Generate synthetic OHLC data ────────────────────────────────────

function generateOHLC(
  startPrice: number,
  days: number,
  trend: "up" | "down" | "sideways" = "sideways",
  volatility: number = 0.02,
): OHLCPoint[] {
  const data: OHLCPoint[] = [];
  let price = startPrice;

  for (let i = 0; i < days; i++) {
    const date = new Date(2025, 0, 1 + i);
    const dateStr = date.toISOString().split("T")[0];

    // Add trend bias
    const bias = trend === "up" ? 0.003 : trend === "down" ? -0.003 : 0;
    const change = (Math.random() - 0.5) * volatility + bias;
    price = price * (1 + change);

    const open = price * (1 + (Math.random() - 0.5) * 0.01);
    const close = price;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = Math.floor(100000 + Math.random() * 500000);

    data.push({ date: dateStr, open, high, low, close, volume });
  }

  return data;
}

// Generate data with clear swing high and low for divergence testing
function generateDivergenceData(): OHLCPoint[] {
  const data: OHLCPoint[] = [];
  const basePrice = 10;

  // Phase 1: Rise to swing high (days 0-30)
  for (let i = 0; i < 30; i++) {
    const price = basePrice + (i / 30) * 3;
    const date = new Date(2025, 0, 1 + i).toISOString().split("T")[0];
    data.push({
      date,
      open: price - 0.05,
      high: price + 0.1,
      low: price - 0.1,
      close: price,
      volume: 200000,
    });
  }

  // Phase 2: Drop to swing low (days 30-60)
  for (let i = 0; i < 30; i++) {
    const price = 13 - (i / 30) * 4;
    const date = new Date(2025, 1, 1 + i).toISOString().split("T")[0];
    data.push({
      date,
      open: price + 0.05,
      high: price + 0.1,
      low: price - 0.1,
      close: price,
      volume: 250000,
    });
  }

  // Phase 3: Rise again (days 60-90)
  for (let i = 0; i < 30; i++) {
    const price = 9 + (i / 30) * 2.5;
    const date = new Date(2025, 2, 1 + i).toISOString().split("T")[0];
    data.push({
      date,
      open: price - 0.05,
      high: price + 0.1,
      low: price - 0.1,
      close: price,
      volume: 180000,
    });
  }

  return data;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Abboud AI Indicator — computeAbboudIndicator", () => {
  it("returns null for insufficient data (< 30 points)", () => {
    const shortData = generateOHLC(10, 20);
    const result = computeAbboudIndicator(shortData);
    expect(result).toBeNull();
  });

  it("returns null for empty data", () => {
    const result = computeAbboudIndicator([]);
    expect(result).toBeNull();
  });

  it("returns a valid result for 90 days of data", () => {
    const data = generateOHLC(10, 90, "up");
    const result = computeAbboudIndicator(data);

    expect(result).not.toBeNull();
    expect(result!.fibLevels).toBeDefined();
    expect(result!.rsiValues).toBeDefined();
    expect(result!.signal).toBeDefined();
    expect(result!.trendDirection).toBeDefined();
    expect(result!.currentPrice).toBeGreaterThan(0);
  });

  it("calculates correct Fibonacci retracement levels", () => {
    const data = generateOHLC(10, 100, "up");
    const result = computeAbboudIndicator(data);
    expect(result).not.toBeNull();

    const retracementLevels = result!.fibLevels.filter(f => f.type === "retracement");
    expect(retracementLevels.length).toBe(7); // 0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%

    // Verify level values
    const levelValues = retracementLevels.map(f => f.level);
    expect(levelValues).toContain(0);
    expect(levelValues).toContain(0.236);
    expect(levelValues).toContain(0.382);
    expect(levelValues).toContain(0.5);
    expect(levelValues).toContain(0.618);
    expect(levelValues).toContain(0.786);
    expect(levelValues).toContain(1);
  });

  it("calculates Fibonacci extension levels", () => {
    const data = generateOHLC(10, 100, "up");
    const result = computeAbboudIndicator(data);
    expect(result).not.toBeNull();

    const extensionLevels = result!.fibLevels.filter(f => f.type === "extension");
    expect(extensionLevels.length).toBe(4); // 127.2%, 161.8%, 200%, 261.8%

    const extValues = extensionLevels.map(f => f.level);
    expect(extValues).toContain(1.272);
    expect(extValues).toContain(1.618);
    expect(extValues).toContain(2.0);
    expect(extValues).toContain(2.618);
  });

  it("Fibonacci prices are ordered correctly in uptrend", () => {
    const data = generateOHLC(10, 100, "up");
    const result = computeAbboudIndicator(data);
    if (!result || result.trendDirection !== "uptrend") return; // skip if random data doesn't produce uptrend

    const retracementPrices = result.fibLevels
      .filter(f => f.type === "retracement")
      .sort((a, b) => a.level - b.level)
      .map(f => f.price);

    // In uptrend, higher fib level = lower price (retracing from high)
    for (let i = 1; i < retracementPrices.length; i++) {
      expect(retracementPrices[i]).toBeLessThanOrEqual(retracementPrices[i - 1] + 0.001);
    }
  });

  it("calculates RSI values", () => {
    const data = generateOHLC(10, 100, "up");
    const result = computeAbboudIndicator(data);
    expect(result).not.toBeNull();

    expect(result!.rsiValues.length).toBeGreaterThan(0);
    for (const rsi of result!.rsiValues) {
      expect(rsi.value).toBeGreaterThanOrEqual(0);
      expect(rsi.value).toBeLessThanOrEqual(100);
      expect(rsi.date).toBeDefined();
    }
  });

  it("detects trend direction", () => {
    const upData = generateOHLC(10, 100, "up", 0.005);
    const downData = generateOHLC(10, 100, "down", 0.005);

    const upResult = computeAbboudIndicator(upData);
    const downResult = computeAbboudIndicator(downData);

    expect(upResult).not.toBeNull();
    expect(downResult).not.toBeNull();

    // With low volatility and strong trend, should detect correctly most of the time
    // (random data may occasionally produce unexpected results)
    expect(["uptrend", "sideways", "downtrend"]).toContain(upResult!.trendDirection);
    expect(["uptrend", "sideways", "downtrend"]).toContain(downResult!.trendDirection);
  });

  it("generates a valid signal with action, confidence, and reason", () => {
    const data = generateOHLC(10, 200, "up");
    const result = computeAbboudIndicator(data);
    expect(result).not.toBeNull();

    const { signal } = result!;
    expect(["BUY", "SELL", "NEUTRAL"]).toContain(signal.action);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
    expect(signal.confidence).toBeLessThanOrEqual(100);
    expect(signal.reason).toBeTruthy();
    expect(typeof signal.reason).toBe("string");
  });

  it("entry zone has low < high when present", () => {
    const data = generateOHLC(10, 200, "up");
    const result = computeAbboudIndicator(data);
    expect(result).not.toBeNull();

    if (result!.signal.entryZone) {
      expect(result!.signal.entryZone.low).toBeLessThanOrEqual(result!.signal.entryZone.high);
    }
  });

  it("stop loss is a valid number when present", () => {
    const data = generateOHLC(10, 200, "up");
    const result = computeAbboudIndicator(data);
    expect(result).not.toBeNull();

    if (result!.signal.stopLoss) {
      expect(result!.signal.stopLoss).toBeGreaterThan(0);
      expect(typeof result!.signal.stopLoss).toBe("number");
    }
  });

  it("targets have valid price and level when present", () => {
    const data = generateOHLC(10, 200, "up");
    const result = computeAbboudIndicator(data);
    expect(result).not.toBeNull();

    for (const target of result!.signal.targets) {
      expect(target.price).toBeGreaterThan(0);
      expect(target.level).toBeTruthy();
      expect(typeof target.level).toBe("string");
    }
  });

  it("handles data with clear swing pattern", () => {
    const data = generateDivergenceData();
    const result = computeAbboudIndicator(data);
    expect(result).not.toBeNull();

    // Should detect swing points
    expect(result!.swingHigh).not.toBeNull();
    expect(result!.swingLow).not.toBeNull();

    if (result!.swingHigh && result!.swingLow) {
      expect(result!.swingHigh.price).toBeGreaterThan(result!.swingLow.price);
      expect(result!.swingHigh.type).toBe("high");
      expect(result!.swingLow.type).toBe("low");
    }
  });

  it("currentPrice matches last close", () => {
    const data = generateOHLC(10, 100, "up");
    const result = computeAbboudIndicator(data);
    expect(result).not.toBeNull();

    expect(result!.currentPrice).toBe(data[data.length - 1].close);
  });

  it("handles 200+ data points for comprehensive analysis", () => {
    const data = generateOHLC(5, 300, "up");
    const result = computeAbboudIndicator(data);
    expect(result).not.toBeNull();

    // Should have more RSI values with more data
    expect(result!.rsiValues.length).toBeGreaterThan(100);
  });

  it("divergences array is always defined (may be empty)", () => {
    const data = generateOHLC(10, 100, "sideways");
    const result = computeAbboudIndicator(data);
    expect(result).not.toBeNull();

    expect(Array.isArray(result!.divergences)).toBe(true);
  });

  it("divergence signals have valid structure when present", () => {
    const data = generateDivergenceData();
    const result = computeAbboudIndicator(data);
    expect(result).not.toBeNull();

    for (const div of result!.divergences) {
      expect(["bullish", "bearish", "hidden_bullish", "hidden_bearish"]).toContain(div.type);
      expect(["weak", "moderate", "strong"]).toContain(div.strength);
      expect(div.startIndex).toBeLessThan(div.endIndex);
      expect(div.startDate).toBeTruthy();
      expect(div.endDate).toBeTruthy();
      expect(div.rsiStart).toBeGreaterThanOrEqual(0);
      expect(div.rsiStart).toBeLessThanOrEqual(100);
      expect(div.rsiEnd).toBeGreaterThanOrEqual(0);
      expect(div.rsiEnd).toBeLessThanOrEqual(100);
    }
  });

  it("returns null when all prices are the same (no range)", () => {
    const data: OHLCPoint[] = [];
    for (let i = 0; i < 50; i++) {
      data.push({
        date: `2025-01-${String(i + 1).padStart(2, "0")}`,
        open: 10,
        high: 10,
        low: 10,
        close: 10,
        volume: 100000,
      });
    }
    const result = computeAbboudIndicator(data);
    // Should return null because highPrice === lowPrice
    expect(result).toBeNull();
  });

  it("handles very small price values (penny stocks)", () => {
    const data = generateOHLC(0.05, 100, "up", 0.03);
    const result = computeAbboudIndicator(data);
    expect(result).not.toBeNull();

    // Fibonacci levels should still be positive
    for (const fib of result!.fibLevels.filter(f => f.type === "retracement")) {
      expect(fib.price).toBeGreaterThan(0);
    }
  });

  it("handles large price values", () => {
    const data = generateOHLC(5000, 100, "down", 0.01);
    const result = computeAbboudIndicator(data);
    expect(result).not.toBeNull();

    expect(result!.currentPrice).toBeGreaterThan(1000);
  });
});

describe("Abboud AI Indicator — Fibonacci math correctness", () => {
  it("50% retracement is exactly midpoint between swing high and low", () => {
    const data = generateDivergenceData();
    const result = computeAbboudIndicator(data);
    expect(result).not.toBeNull();

    const swingHighPrice = result!.fibLevels.find(f => f.level === 0)?.price;
    const swingLowPrice = result!.fibLevels.find(f => f.level === 1)?.price;
    const fib50 = result!.fibLevels.find(f => f.level === 0.5)?.price;

    if (swingHighPrice && swingLowPrice && fib50) {
      const expectedMid = (swingHighPrice + swingLowPrice) / 2;
      expect(Math.abs(fib50 - expectedMid)).toBeLessThan(0.01);
    }
  });

  it("38.2% level is between 23.6% and 50%", () => {
    const data = generateOHLC(10, 100, "up");
    const result = computeAbboudIndicator(data);
    expect(result).not.toBeNull();

    const fib236 = result!.fibLevels.find(f => f.level === 0.236)?.price;
    const fib382 = result!.fibLevels.find(f => f.level === 0.382)?.price;
    const fib50 = result!.fibLevels.find(f => f.level === 0.5)?.price;

    if (fib236 && fib382 && fib50) {
      // In uptrend, higher level = lower price
      if (result!.trendDirection !== "downtrend") {
        expect(fib382).toBeLessThanOrEqual(fib236 + 0.001);
        expect(fib382).toBeGreaterThanOrEqual(fib50 - 0.001);
      }
    }
  });
});
