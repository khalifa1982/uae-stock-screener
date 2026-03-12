import { describe, expect, it } from "vitest";

describe("TwelveData API Key", () => {
  it("should be set in environment", () => {
    const key = process.env.TWELVEDATA_API_KEY;
    expect(key).toBeDefined();
    expect(typeof key).toBe("string");
    expect(key!.length).toBeGreaterThan(10);
  });

  it(
    "should return valid data from TwelveData API",
    async () => {
      const key = process.env.TWELVEDATA_API_KEY;
      if (!key) {
        console.warn("TWELVEDATA_API_KEY not set, skipping API test");
        return;
      }
      const resp = await fetch(
        `https://api.twelvedata.com/quote?symbol=EMAR:DFM&apikey=${key}`
      );
      expect(resp.ok).toBe(true);
      const data = await resp.json();
      expect(data).toBeDefined();
      if (data.code === 401) {
        throw new Error("TwelveData API key is invalid (401 Unauthorized)");
      }
      if (
        data.status === "error" &&
        data.message?.includes("parameter is missing")
      ) {
        throw new Error(`TwelveData API error: ${data.message}`);
      }
      console.log(
        "TwelveData response:",
        JSON.stringify(data).slice(0, 200)
      );
    },
    15000
  );
});
