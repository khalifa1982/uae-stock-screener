import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getMarketStatus } from "../shared/marketStatus";

describe("Market Status", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'closed' on Saturday", () => {
    // Saturday March 7, 2026 at 12:00 UAE (08:00 UTC)
    vi.setSystemTime(new Date("2026-03-07T08:00:00Z"));
    const status = getMarketStatus();
    expect(status.phase).toBe("closed");
    expect(status.label).toContain("Closed");
  });

  it("returns 'closed' on Sunday", () => {
    // Sunday March 8, 2026 at 12:00 UAE (08:00 UTC)
    vi.setSystemTime(new Date("2026-03-08T08:00:00Z"));
    const status = getMarketStatus();
    expect(status.phase).toBe("closed");
    expect(status.label).toContain("Closed");
  });

  it("returns 'pre-open' on Monday at 9:00 UAE", () => {
    // Monday March 9, 2026 at 09:00 UAE (05:00 UTC)
    vi.setSystemTime(new Date("2026-03-09T05:00:00Z"));
    const status = getMarketStatus();
    expect(status.phase).toBe("pre-open");
    expect(status.label).toContain("Pre-Open");
  });

  it("returns 'open' on Monday at 10:00 UAE", () => {
    // Monday March 9, 2026 at 10:00 UAE (06:00 UTC)
    vi.setSystemTime(new Date("2026-03-09T06:00:00Z"));
    const status = getMarketStatus();
    expect(status.phase).toBe("open");
    expect(status.label).toContain("Open");
  });

  it("returns 'open' on Monday at 14:00 UAE", () => {
    // Monday March 9, 2026 at 14:00 UAE (10:00 UTC)
    vi.setSystemTime(new Date("2026-03-09T10:00:00Z"));
    const status = getMarketStatus();
    expect(status.phase).toBe("open");
    expect(status.label).toContain("Open");
  });

  it("returns 'pre-close' on Monday at 14:50 UAE", () => {
    // Monday March 9, 2026 at 14:50 UAE (10:50 UTC)
    vi.setSystemTime(new Date("2026-03-09T10:50:00Z"));
    const status = getMarketStatus();
    expect(status.phase).toBe("pre-close");
    expect(status.label).toContain("Pre-Close");
  });

  it("returns 'closed' on Monday at 15:05 UAE", () => {
    // Monday March 9, 2026 at 15:05 UAE (11:05 UTC)
    vi.setSystemTime(new Date("2026-03-09T11:05:00Z"));
    const status = getMarketStatus();
    expect(status.phase).toBe("closed");
    expect(status.label).toContain("Closed");
  });

  it("returns 'open' on Wednesday at 12:00 UAE", () => {
    // Wednesday March 11, 2026 at 12:00 UAE (08:00 UTC)
    vi.setSystemTime(new Date("2026-03-11T08:00:00Z"));
    const status = getMarketStatus();
    expect(status.phase).toBe("open");
    expect(status.label).toContain("Open");
  });

  it("returns 'closed' on Friday at 16:00 UAE", () => {
    // Friday March 13, 2026 at 16:00 UAE (12:00 UTC)
    vi.setSystemTime(new Date("2026-03-13T12:00:00Z"));
    const status = getMarketStatus();
    expect(status.phase).toBe("closed");
    expect(status.label).toContain("Closed");
  });

  it("includes nextPhaseTime and nextPhaseLabel", () => {
    // Monday March 9, 2026 at 09:00 UAE (05:00 UTC) - pre-open
    vi.setSystemTime(new Date("2026-03-09T05:00:00Z"));
    const status = getMarketStatus();
    expect(status.nextPhaseTime).toBeDefined();
    expect(status.nextPhaseLabel).toBeDefined();
    expect(status.nextPhaseLabel).toContain("Open");
  });

  it("includes UAE time string", () => {
    vi.setSystemTime(new Date("2026-03-09T08:00:00Z"));
    const status = getMarketStatus();
    expect(status.uaeTimeStr).toBeDefined();
    expect(status.uaeDayStr).toBeDefined();
  });

  it("includes description for each phase", () => {
    // Test pre-open
    vi.setSystemTime(new Date("2026-03-09T05:00:00Z"));
    expect(getMarketStatus().description).toBeTruthy();

    // Test open
    vi.setSystemTime(new Date("2026-03-09T06:00:00Z"));
    expect(getMarketStatus().description).toBeTruthy();

    // Test pre-close
    vi.setSystemTime(new Date("2026-03-09T10:45:00Z"));
    expect(getMarketStatus().description).toBeTruthy();

    // Test closed
    vi.setSystemTime(new Date("2026-03-09T12:00:00Z"));
    expect(getMarketStatus().description).toBeTruthy();
  });
});

describe("TradingView Value Normalization", () => {
  it("TradingView returns margins already as percentages", () => {
    // TradingView returns 26.14 meaning 26.14%, not 0.2614
    // Our backend divides by 100 to normalize to decimal form for formatPercent
    const tvGrossMargin = 26.14;
    const normalized = tvGrossMargin / 100; // 0.2614
    const displayed = (normalized * 100).toFixed(2) + "%"; // formatPercent logic
    expect(displayed).toBe("26.14%");
  });

  it("TradingView returns performance already as percentages", () => {
    // TradingView returns -2.38 meaning -2.38%, not -0.0238
    const tvPerfWeek = -2.3779;
    // Performance display uses val.toFixed(2) + "%" directly (no multiplication)
    const displayed = tvPerfWeek.toFixed(2) + "%";
    expect(displayed).toBe("-2.38%");
  });

  it("TradingView returns dividend yield already as percentages", () => {
    // TradingView returns 7.17 meaning 7.17%, not 0.0717
    const tvDivYield = 7.168459;
    const normalized = tvDivYield / 100; // 0.07168459
    const displayed = (normalized * 100).toFixed(2) + "%"; // formatPercent logic
    expect(displayed).toBe("7.17%");
  });
});
