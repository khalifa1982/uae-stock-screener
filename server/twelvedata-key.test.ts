import { describe, it, expect } from "vitest";

describe("TwelveData API Key Validation", () => {
  it("should have TWELVEDATA_API_KEY set", () => {
    const key = process.env.TWELVEDATA_API_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(10);
  });

  it("should authenticate successfully with TwelveData for UAE stock", async () => {
    const key = process.env.TWELVEDATA_API_KEY;
    // Test with a UAE stock on ADX exchange
    const resp = await fetch(
      `https://api.twelvedata.com/time_series?symbol=EMAAR:DFM&interval=1day&outputsize=5&apikey=${key}`
    );
    expect(resp.ok).toBe(true);
    const data = await resp.json() as any;
    // Should NOT return 401 error
    expect(data.code).not.toBe(401);
    // Should return values array for a valid UAE stock
    if (data.values) {
      expect(data.values.length).toBeGreaterThan(0);
      expect(data.values[0]).toHaveProperty("close");
    }
  }, 15000);

  it("should return data for ADX exchange stocks", async () => {
    const key = process.env.TWELVEDATA_API_KEY;
    const resp = await fetch(
      `https://api.twelvedata.com/time_series?symbol=IHC:ADX&interval=1day&outputsize=3&apikey=${key}`
    );
    expect(resp.ok).toBe(true);
    const data = await resp.json() as any;
    expect(data.code).not.toBe(401);
  }, 15000);
});
