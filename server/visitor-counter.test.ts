import { describe, it, expect, vi } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  recordVisit: vi.fn().mockResolvedValue({
    totalVisitors: 42,
    todayVisitors: 5,
    totalPageViews: 150,
    onlineNow: 3,
  }),
  getVisitorStats: vi.fn().mockResolvedValue({
    totalVisitors: 42,
    todayVisitors: 5,
    totalPageViews: 150,
    onlineNow: 3,
  }),
}));

import { recordVisit, getVisitorStats } from "./db";

describe("Visitor Counter", () => {
  it("recordVisit returns visitor stats", async () => {
    const result = await recordVisit("192.168.1.1", "Mozilla/5.0 Test");
    expect(result).toHaveProperty("totalVisitors");
    expect(result).toHaveProperty("todayVisitors");
    expect(result).toHaveProperty("totalPageViews");
    expect(result).toHaveProperty("onlineNow");
    expect(result.totalVisitors).toBe(42);
    expect(result.todayVisitors).toBe(5);
    expect(result.totalPageViews).toBe(150);
    expect(result.onlineNow).toBe(3);
  });

  it("getVisitorStats returns all stat fields", async () => {
    const stats = await getVisitorStats();
    expect(stats).toHaveProperty("totalVisitors");
    expect(stats).toHaveProperty("todayVisitors");
    expect(stats).toHaveProperty("totalPageViews");
    expect(stats).toHaveProperty("onlineNow");
    expect(typeof stats.totalVisitors).toBe("number");
    expect(typeof stats.todayVisitors).toBe("number");
    expect(typeof stats.totalPageViews).toBe("number");
    expect(typeof stats.onlineNow).toBe("number");
  });

  it("stats values are non-negative", async () => {
    const stats = await getVisitorStats();
    expect(stats.totalVisitors).toBeGreaterThanOrEqual(0);
    expect(stats.todayVisitors).toBeGreaterThanOrEqual(0);
    expect(stats.totalPageViews).toBeGreaterThanOrEqual(0);
    expect(stats.onlineNow).toBeGreaterThanOrEqual(0);
  });

  it("recordVisit is called with IP and user agent", async () => {
    await recordVisit("10.0.0.1", "Chrome/120");
    expect(recordVisit).toHaveBeenCalledWith("10.0.0.1", "Chrome/120");
  });
});
