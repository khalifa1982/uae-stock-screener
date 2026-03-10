/**
 * Tests for TwelveData WebSocket Service
 */
import { describe, it, expect } from "vitest";
import { getWSStats, getLatestPrice, getAllLatestPrices } from "./services/tdWebSocketService";

describe("TwelveData WebSocket Service", () => {
  describe("getWSStats", () => {
    it("should return WebSocket statistics object", () => {
      const stats = getWSStats();
      expect(stats).toBeDefined();
      expect(typeof stats.connected).toBe("boolean");
      expect(typeof stats.messagesReceived).toBe("number");
      expect(typeof stats.clientCount).toBe("number");
      expect(typeof stats.subscribedCount).toBe("number");
      expect(typeof stats.reconnects).toBe("number");
      expect(typeof stats.errors).toBe("number");
      expect(typeof stats.cachedPrices).toBe("number");
    });

    it("should have non-negative numeric values", () => {
      const stats = getWSStats();
      expect(stats.messagesReceived).toBeGreaterThanOrEqual(0);
      expect(stats.clientCount).toBeGreaterThanOrEqual(0);
      expect(stats.subscribedCount).toBeGreaterThanOrEqual(0);
      expect(stats.reconnects).toBeGreaterThanOrEqual(0);
      expect(stats.errors).toBeGreaterThanOrEqual(0);
      expect(stats.cachedPrices).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getLatestPrice", () => {
    it("should return null for unknown symbols", () => {
      const price = getLatestPrice("NONEXISTENT_SYMBOL_XYZ");
      expect(price).toBeNull();
    });

    it("should accept string symbol parameter", () => {
      expect(() => getLatestPrice("EMAAR")).not.toThrow();
      expect(() => getLatestPrice("FAB")).not.toThrow();
      expect(() => getLatestPrice("ETISALAT")).not.toThrow();
    });
  });

  describe("getAllLatestPrices", () => {
    it("should return a Map", () => {
      const prices = getAllLatestPrices();
      expect(prices).toBeInstanceOf(Map);
    });

    it("should have string keys", () => {
      const prices = getAllLatestPrices();
      for (const key of Array.from(prices.keys())) {
        expect(typeof key).toBe("string");
      }
    });
  });

  describe("PriceUpdate interface", () => {
    it("should define the expected shape for price updates", () => {
      const mockUpdate = {
        event: "price" as const,
        symbol: "EMAR",
        appSymbol: "EMAAR",
        exchange: "DFM",
        price: 8.50,
        dayVolume: 1234567,
        bid: 8.49,
        ask: 8.51,
        timestamp: Date.now() / 1000,
        currency: "AED",
      };

      expect(mockUpdate.event).toBe("price");
      expect(mockUpdate.appSymbol).toBe("EMAAR");
      expect(typeof mockUpdate.price).toBe("number");
      expect(typeof mockUpdate.timestamp).toBe("number");
    });
  });
});
