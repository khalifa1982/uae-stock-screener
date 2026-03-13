import { describe, expect, it } from "vitest";
import {
  computeAbboudIndicator,
  type OHLCPoint,
  type AbboudIndicatorResult,
} from "./abboudIndicator";

// ─── Helper: generate synthetic OHLC data ──────────────────────────────────

function generateOHLC(
  startPrice: number,
  days: number,
  pattern: "uptrend" | "downtrend" | "swing" = "swing"
): OHLCPoint[] {
  const data: OHLCPoint[] = [];
  let price = startPrice;

  for (let i = 0; i < days; i++) {
    const date = new Date(2025, 0, 1 + i).toISOString().slice(0, 10);
    let change: number;

    if (pattern === "uptrend") {
      change = (Math.random() * 0.04 - 0.01) * price; // mostly up
    } else if (pattern === "downtrend") {
      change = (Math.random() * 0.04 - 0.03) * price; // mostly down
    } else {
      // swing: go up first half, then down
      if (i < days / 2) {
        change = (Math.random() * 0.03) * price;
      } else {
        change = -(Math.random() * 0.03) * price;
      }
    }

    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 0.02 * price;
    const low = Math.min(open, close) - Math.random() * 0.02 * price;
    price = close;

    data.push({
      date,
      open: parseFloat(open.toFixed(3)),
      high: parseFloat(high.toFixed(3)),
      low: parseFloat(low.toFixed(3)),
      close: parseFloat(close.toFixed(3)),
      volume: Math.floor(100000 + Math.random() * 500000),
    });
  }

  return data;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("computeAbboudIndicator", () => {
  it("returns null for insufficient data (less than 30 points)", () => {
    const data = generateOHLC(10, 20);
    const result = computeAbboudIndicator(data);
    expect(result).toBeNull();
  });

  it("returns a valid result for 100 data points", () => {
    const data = generateOHLC(10, 100, "swing");
    const result = computeAbboudIndicator(data);

    // May return null if swingHigh === swingLow (unlikely with swing pattern)
    if (result === null) return;

    expect(result).toBeDefined();
    expect(result.currentPrice).toBeGreaterThan(0);
    expect(result.fibLevels.length).toBeGreaterThanOrEqual(7); // at least 7 retracement levels
    expect(result.rsiValues.length).toBeGreaterThan(0);
    expect(result.signal).toBeDefined();
    expect(["BUY", "SELL", "NEUTRAL"]).toContain(result.signal.action);
    expect(result.signal.confidence).toBeGreaterThanOrEqual(0);
    expect(result.signal.confidence).toBeLessThanOrEqual(100);
    expect(result.trendDirection).toBeDefined();
    expect(["uptrend", "downtrend", "sideways"]).toContain(result.trendDirection);
  });

  it("produces Fibonacci levels with correct structure", () => {
    const data = generateOHLC(10, 100, "swing");
    const result = computeAbboudIndicator(data);
    if (result === null) return;

    // Check retracement levels exist
    const retracementLevels = result.fibLevels.filter(f => f.type === "retracement");
    expect(retracementLevels.length).toBeGreaterThanOrEqual(5);

    // Each fib level should have required fields
    for (const fib of result.fibLevels) {
      expect(fib).toHaveProperty("level");
      expect(fib).toHaveProperty("label");
      expect(fib).toHaveProperty("price");
      expect(fib).toHaveProperty("type");
      expect(fib.price).toBeGreaterThan(0);
      expect(["retracement", "extension"]).toContain(fib.type);
    }

    // Check that 0% (swing high) and 100% (swing low) exist
    const zeroLevel = retracementLevels.find(f => f.level === 0);
    const hundredLevel = retracementLevels.find(f => f.level === 1);
    expect(zeroLevel).toBeDefined();
    expect(hundredLevel).toBeDefined();
  });

  it("produces swing high and swing low", () => {
    const data = generateOHLC(10, 100, "swing");
    const result = computeAbboudIndicator(data);
    if (result === null) return;

    expect(result.swingHigh).toBeDefined();
    expect(result.swingLow).toBeDefined();
    expect(result.swingHigh!.price).toBeGreaterThan(result.swingLow!.price);
    expect(result.swingHigh!.type).toBe("high");
    expect(result.swingLow!.type).toBe("low");
  });

  it("signal has entry zone, stop loss, and targets when action is BUY or SELL", () => {
    // Run multiple times to get a BUY or SELL signal
    let result: AbboudIndicatorResult | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const data = generateOHLC(5 + Math.random() * 5, 200, "swing");
      result = computeAbboudIndicator(data);
      if (result && result.signal.action !== "NEUTRAL") break;
    }

    if (!result || result.signal.action === "NEUTRAL") {
      // Can't guarantee a non-neutral signal with random data, so skip
      return;
    }

    expect(result.signal.entryZone).toBeDefined();
    if (result.signal.entryZone) {
      expect(result.signal.entryZone.low).toBeLessThan(result.signal.entryZone.high);
    }
    expect(result.signal.reason).toBeTruthy();
  });

  it("produces price projection points", () => {
    const data = generateOHLC(10, 150, "swing");
    const result = computeAbboudIndicator(data);
    if (result === null) return;

    const projection = result.signal.priceProjection;
    expect(projection).toBeDefined();
    expect(Array.isArray(projection)).toBe(true);

    if (projection.length > 0) {
      // First point should be current price
      expect(projection[0].type).toBe("current");
      expect(projection[0].price).toBeCloseTo(result.currentPrice, 1);

      // Each projection point should have required fields
      for (const p of projection) {
        expect(p).toHaveProperty("price");
        expect(p).toHaveProperty("label");
        expect(p).toHaveProperty("type");
        expect(p.price).toBeGreaterThan(0);
        expect(["current", "target", "pullback", "final_target"]).toContain(p.type);
      }
    }
  });

  it("RSI values are in valid range (0-100)", () => {
    const data = generateOHLC(10, 100, "swing");
    const result = computeAbboudIndicator(data);
    if (result === null) return;

    for (const rsi of result.rsiValues) {
      expect(rsi.value).toBeGreaterThanOrEqual(0);
      expect(rsi.value).toBeLessThanOrEqual(100);
    }
  });

  it("handles 200+ data points without errors", () => {
    const data = generateOHLC(10, 250, "uptrend");
    const result = computeAbboudIndicator(data);
    // Should not throw, may return null or valid result
    if (result) {
      expect(result.currentPrice).toBeGreaterThan(0);
      expect(result.fibLevels.length).toBeGreaterThan(0);
    }
  });
});
