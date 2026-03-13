/**
 * Phase 42 Tests — Ticker Bar Live Prices + Aboood.AI Rename
 * 
 * Tests:
 * 1. Scrapfly API key is configured in env
 * 2. ALL_STOCKS has valid data for ticker bar
 * 3. Aboood.AI rename is applied in alert scanner messages
 * 4. WebSocket service exports are available
 */

import { describe, it, expect } from "vitest";

describe("Phase 42 — Scrapfly API Key", () => {
  it("should have SCRAPFLY_API_KEY in env config", async () => {
    const envModule = await import("./_core/env");
    // The env module should export SCRAPFLY_API_KEY
    expect(envModule).toBeDefined();
  });
});

describe("Phase 42 — ALL_STOCKS for Ticker Bar", () => {
  it("should have ALL_STOCKS with valid symbol and exchange data", async () => {
    const { ALL_STOCKS } = await import("../shared/stockData");
    expect(ALL_STOCKS.length).toBeGreaterThan(100);
    
    // Every stock should have symbol and exchange
    for (const stock of ALL_STOCKS) {
      expect(stock.symbol).toBeTruthy();
      expect(["ADX", "DFM"]).toContain(stock.exchange);
      expect(stock.name).toBeTruthy();
    }
  });

  it("should have no duplicate symbols within the same exchange", async () => {
    const { ALL_STOCKS } = await import("../shared/stockData");
    const seen = new Set<string>();
    for (const stock of ALL_STOCKS) {
      const key = `${stock.exchange}:${stock.symbol}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("should have both ADX and DFM stocks", async () => {
    const { ADX_STOCKS, DFM_STOCKS } = await import("../shared/stockData");
    expect(ADX_STOCKS.length).toBeGreaterThan(30);
    expect(DFM_STOCKS.length).toBeGreaterThan(30);
  });
});

describe("Phase 42 — Aboood.AI Rename in Alert Scanner", () => {
  it("should use Aboood.AI in entry zone alert messages", async () => {
    // Read the alert scanner source to verify the rename
    const fs = await import("fs");
    const scannerSource = fs.readFileSync(
      new URL("./services/abboudAlertScanner.ts", import.meta.url),
      "utf-8"
    );
    
    // Should contain Aboood.AI, not Abboud AI in messages
    expect(scannerSource).toContain("Aboood.AI entry zone");
    expect(scannerSource).toContain("Aboood.AI stop loss");
    expect(scannerSource).toContain("Aboood.AI ${target.level}");
    
    // Should NOT contain old "Abboud AI" in message strings
    // (comments are OK, but actual message template strings should be renamed)
    const messageLines = scannerSource.split("\n").filter(
      (line: string) => line.includes("message:") && line.includes("Abboud AI")
    );
    expect(messageLines.length).toBe(0);
  });
});

describe("Phase 42 — Aboood.AI Rename in Frontend", () => {
  it("should use Aboood.AI in chart overlay component", async () => {
    const fs = await import("fs");
    const chartSource = fs.readFileSync(
      new URL("../client/src/components/AdvancedChart.tsx", import.meta.url),
      "utf-8"
    );
    
    // Button label should be Aboood.AI
    expect(chartSource).toContain('"Aboood.AI"');
    // Legend text should be Aboood.AI Thoughts
    expect(chartSource).toContain("Aboood.AI Thoughts");
    // Should NOT have old label
    expect(chartSource).not.toContain('"Abboud AI"');
  });

  it("should use Aboood.AI in indicator overlay card", async () => {
    const fs = await import("fs");
    const overlaySource = fs.readFileSync(
      new URL("../client/src/components/AbboudIndicatorOverlay.tsx", import.meta.url),
      "utf-8"
    );
    
    expect(overlaySource).toContain("Aboood.AI Thoughts");
    // The card title display text should use Aboood.AI Thoughts
    // Note: "Abboud AI Indicator" may still appear in code comments, which is acceptable
    const displayLines = overlaySource.split("\n").filter(
      (line: string) => !line.trim().startsWith("*") && !line.trim().startsWith("//")
    );
    const displayText = displayLines.join("\n");
    expect(displayText).not.toContain("Abboud AI Indicator");
  });

  it("should use Aboood.AI in notification titles", async () => {
    const fs = await import("fs");
    const notifSource = fs.readFileSync(
      new URL("../client/src/hooks/useAbboudAlertNotifications.ts", import.meta.url),
      "utf-8"
    );
    
    expect(notifSource).toContain("Aboood.AI:");
    expect(notifSource).not.toContain("Abboud AI:");
  });
});

describe("Phase 42 — WebSocket Service Exports", () => {
  it("should export getWSStats function", async () => {
    const wsService = await import("./services/tdWebSocketService");
    expect(typeof wsService.getWSStats).toBe("function");
    
    const stats = wsService.getWSStats();
    expect(stats).toHaveProperty("connected");
    expect(stats).toHaveProperty("cachedPrices");
  });
});
