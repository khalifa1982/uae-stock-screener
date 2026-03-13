import { describe, it, expect } from "vitest";

describe("Scrapfly API Key Validation", () => {
  it("should have SCRAPFLY_API_KEY set in environment", () => {
    const key = process.env.SCRAPFLY_API_KEY;
    expect(key).toBeDefined();
    expect(key).not.toBe("");
    expect(key!.startsWith("scp-")).toBe(true);
  });

  it("should successfully authenticate with Scrapfly API", async () => {
    const key = process.env.SCRAPFLY_API_KEY;
    if (!key) {
      console.warn("SCRAPFLY_API_KEY not set, skipping API test");
      return;
    }

    // Use Scrapfly's account info endpoint to validate the key
    const response = await fetch(
      `https://api.scrapfly.io/account?key=${key}`,
      { method: "GET" }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toBeDefined();
    // Account endpoint should return account info if key is valid
    expect(data.account).toBeDefined();
  }, 15000);
});
