/**
 * Tests for Phase 53 — Ticker Bar Improvements
 * 1. Smart decimal formatting (formatStockPrice)
 * 2. DFM ticker endpoint (fast polling)
 */
import { describe, it, expect } from "vitest";
import { fetchAllDFMStocks } from "./services/dfmDataService";

// ─── formatStockPrice logic (mirrors the frontend function) ────────
function formatStockPrice(price: number): string {
  const rounded = Math.round(price * 1000) / 1000;
  const third = Math.round((rounded * 1000) % 10);
  if (third !== 0) return rounded.toFixed(3);
  return rounded.toFixed(2);
}

describe("Phase 53 — Ticker Bar Improvements", () => {
  describe("formatStockPrice — Smart Decimal Formatting", () => {
    it("should show 2 decimals for prices like 12.15", () => {
      expect(formatStockPrice(12.15)).toBe("12.15");
    });

    it("should show 2 decimals for prices like 3.80", () => {
      expect(formatStockPrice(3.80)).toBe("3.80");
    });

    it("should show 3 decimals for prices like 0.222", () => {
      expect(formatStockPrice(0.222)).toBe("0.222");
    });

    it("should show 3 decimals for prices like 1.125", () => {
      expect(formatStockPrice(1.125)).toBe("1.125");
    });

    it("should show 3 decimals for prices like 0.456", () => {
      expect(formatStockPrice(0.456)).toBe("0.456");
    });

    it("should show 2 decimals for prices like 100.00", () => {
      expect(formatStockPrice(100.00)).toBe("100.00");
    });

    it("should show 2 decimals for prices like 7.50", () => {
      expect(formatStockPrice(7.50)).toBe("7.50");
    });

    it("should show 3 decimals for prices like 0.001", () => {
      expect(formatStockPrice(0.001)).toBe("0.001");
    });

    it("should handle floating point noise (e.g., 0.1 + 0.2)", () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JS
      expect(formatStockPrice(0.1 + 0.2)).toBe("0.30");
    });

    it("should show 2 decimals for integer prices", () => {
      expect(formatStockPrice(5.00)).toBe("5.00");
    });

    it("should show 3 decimals for prices like 2.345", () => {
      expect(formatStockPrice(2.345)).toBe("2.345");
    });

    it("should handle very small prices like 0.010", () => {
      expect(formatStockPrice(0.010)).toBe("0.01");
    });

    it("should handle prices like 0.015 (3rd decimal non-zero)", () => {
      expect(formatStockPrice(0.015)).toBe("0.015");
    });
  });

  describe("DFM Ticker Endpoint — Fast Polling Data", () => {
    it("should return DFM stock data with price and changePercent", async () => {
      const dfmStocks = await fetchAllDFMStocks();
      expect(Array.isArray(dfmStocks)).toBe(true);
      
      // Build the ticker map (same logic as the endpoint)
      const result: Record<string, { price: number; changePercent: number; previousClose: number }> = {};
      for (const d of dfmStocks) {
        if (d.lastTradePrice > 0) {
          result[d.id] = {
            price: d.lastTradePrice,
            changePercent: d.changePercent,
            previousClose: d.previousClose,
          };
        }
      }
      
      // Should have some DFM stocks
      const symbols = Object.keys(result);
      expect(symbols.length).toBeGreaterThan(0);
      
      // Each entry should have valid price data
      for (const sym of symbols) {
        const entry = result[sym];
        expect(entry.price).toBeGreaterThan(0);
        expect(typeof entry.changePercent).toBe("number");
        expect(typeof entry.previousClose).toBe("number");
      }
    }, 15000);

    it("should include well-known DFM stocks", async () => {
      const dfmStocks = await fetchAllDFMStocks();
      const ids = dfmStocks.map(d => d.id);
      // EMAAR should always be in DFM
      expect(ids).toContain("EMAAR");
    }, 15000);
  });
});
