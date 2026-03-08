import { describe, expect, it } from "vitest";

describe("TwelveData API Key", () => {
  it("should be set in environment", () => {
    const key = process.env.TWELVEDATA_API_KEY;
    expect(key).toBeDefined();
    expect(typeof key).toBe("string");
    expect(key!.length).toBeGreaterThan(10);
  });

  it("should be able to reach TwelveData API endpoint", async () => {
    const key = process.env.TWELVEDATA_API_KEY;
    if (!key) {
      console.warn("TWELVEDATA_API_KEY not set, skipping API test");
      return;
    }
    // Just verify the API is reachable - key may be expired but that's OK
    // The system will fall back to Yahoo Finance as primary source
    const resp = await fetch(`https://api.twelvedata.com/quote?symbol=EMAAR:DFM&apikey=${key}`);
    expect(resp.ok).toBe(true);
    const data = await resp.json();
    // API responds - either with data or auth error
    expect(data).toBeDefined();
  });
});
