import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getMarketStatus } from "../shared/marketStatus";
import {
  getHoliday,
  isHoliday,
  isTradingDay,
  getNextTradingDay,
  getHolidaysForYear,
  getUpcomingHolidays,
  getHolidayCount,
} from "../shared/uaeHolidays";

describe("UAE Holidays Calendar", () => {
  it("has holidays loaded for 2025, 2026, and 2027", () => {
    const count = getHolidayCount();
    expect(count).toBeGreaterThan(40);
  });

  it("returns holidays for 2025", () => {
    const holidays = getHolidaysForYear(2025);
    expect(holidays.length).toBeGreaterThanOrEqual(12);
    expect(holidays[0].date).toMatch(/^2025-/);
  });

  it("returns holidays for 2026", () => {
    const holidays = getHolidaysForYear(2026);
    expect(holidays.length).toBeGreaterThanOrEqual(14);
    expect(holidays[0].date).toMatch(/^2026-/);
  });

  it("returns holidays for 2027", () => {
    const holidays = getHolidaysForYear(2027);
    expect(holidays.length).toBeGreaterThanOrEqual(12);
    expect(holidays[0].date).toMatch(/^2027-/);
  });

  it("detects New Year's Day 2026 as a holiday", () => {
    const h = getHoliday("2026-01-01");
    expect(h).not.toBeNull();
    expect(h!.name).toBe("New Year's Day");
    expect(h!.nameAr).toBe("رأس السنة الميلادية");
    expect(h!.type).toBe("fixed");
  });

  it("detects Eid Al Fitr 2026 as a holiday", () => {
    const h = getHoliday("2026-03-19");
    expect(h).not.toBeNull();
    expect(h!.name).toBe("Eid Al Fitr");
    expect(h!.type).toBe("islamic");
  });

  it("detects Eid Al Adha 2026 as a holiday", () => {
    const h = getHoliday("2026-05-27");
    expect(h).not.toBeNull();
    expect(h!.name).toBe("Eid Al Adha");
  });

  it("detects UAE National Day 2026 as a holiday", () => {
    const h = getHoliday("2026-12-02");
    expect(h).not.toBeNull();
    expect(h!.name).toBe("UAE National Day");
    expect(h!.nameAr).toBe("اليوم الوطني");
  });

  it("detects Commemoration Day 2026", () => {
    const h = getHoliday("2026-12-01");
    expect(h).not.toBeNull();
    expect(h!.name).toBe("Commemoration Day");
  });

  it("returns null for a regular trading day", () => {
    const h = getHoliday("2026-03-10"); // Tuesday, not a holiday
    expect(h).toBeNull();
  });

  it("isHoliday returns true for holidays", () => {
    expect(isHoliday("2026-01-01")).toBe(true);
    expect(isHoliday("2026-03-19")).toBe(true);
  });

  it("isHoliday returns false for regular days", () => {
    expect(isHoliday("2026-03-10")).toBe(false);
    expect(isHoliday("2026-06-15")).toBe(false);
  });

  it("detects holiday from Date object (UTC+4 conversion)", () => {
    // 2026-01-01 at 10:00 UAE = 06:00 UTC
    const d = new Date("2026-01-01T06:00:00Z");
    const h = getHoliday(d);
    expect(h).not.toBeNull();
    expect(h!.name).toBe("New Year's Day");
  });

  it("handles UTC midnight edge case (still previous day in UAE)", () => {
    // 2026-01-01 at 01:00 UTC = 05:00 UAE on Jan 1 → still holiday
    const d = new Date("2026-01-01T01:00:00Z");
    const h = getHoliday(d);
    expect(h).not.toBeNull();
  });
});

describe("Trading Day Detection", () => {
  it("weekday non-holiday is a trading day", () => {
    expect(isTradingDay("2026-03-10")).toBe(true); // Tuesday
    expect(isTradingDay("2026-03-11")).toBe(true); // Wednesday
  });

  it("Saturday is not a trading day", () => {
    expect(isTradingDay("2026-03-07")).toBe(false); // Saturday
  });

  it("Sunday is not a trading day", () => {
    expect(isTradingDay("2026-03-08")).toBe(false); // Sunday
  });

  it("holiday on weekday is not a trading day", () => {
    // 2026-01-01 is Thursday
    expect(isTradingDay("2026-01-01")).toBe(false);
  });

  it("Eid Al Fitr weekdays are not trading days", () => {
    expect(isTradingDay("2026-03-19")).toBe(false); // Thursday
    expect(isTradingDay("2026-03-20")).toBe(false); // Friday
  });
});

describe("Next Trading Day Calculation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips weekend to find next trading day", () => {
    // Friday March 13, 2026 at 16:00 UAE (12:00 UTC) - after market close
    const friday = new Date("2026-03-13T12:00:00Z");
    const next = getNextTradingDay(friday);
    // Should be Monday March 16
    const uaeMs = next.getTime() + (4 * 60 * 60 * 1000);
    const uae = new Date(uaeMs);
    expect(uae.getUTCDay()).toBe(1); // Monday
    expect(uae.getUTCDate()).toBe(16);
  });

  it("skips holidays to find next trading day", () => {
    // 2026-03-18 is Wednesday before Eid Al Fitr (Mar 19-22)
    const beforeEid = new Date("2026-03-18T12:00:00Z");
    const next = getNextTradingDay(beforeEid);
    // Mar 19 Thu = holiday, Mar 20 Fri = holiday, Mar 21 Sat = weekend, Mar 22 Sun = weekend+holiday
    // Mar 23 Mon = next trading day
    const uaeMs = next.getTime() + (4 * 60 * 60 * 1000);
    const uae = new Date(uaeMs);
    expect(uae.getUTCDate()).toBe(23);
    expect(uae.getUTCDay()).toBe(1); // Monday
  });

  it("returns next day when called on a regular weekday evening", () => {
    // Tuesday March 10, 2026 at 16:00 UAE (12:00 UTC)
    const tuesday = new Date("2026-03-10T12:00:00Z");
    const next = getNextTradingDay(tuesday);
    const uaeMs = next.getTime() + (4 * 60 * 60 * 1000);
    const uae = new Date(uaeMs);
    expect(uae.getUTCDate()).toBe(11); // Wednesday
    expect(uae.getUTCHours()).toBe(9); // 9:00 AM
  });
});

describe("Holiday-Aware Market Status", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'holiday' phase on New Year's Day 2026 (Thursday)", () => {
    // 2026-01-01 at 10:00 UAE (06:00 UTC) - Thursday
    vi.setSystemTime(new Date("2026-01-01T06:00:00Z"));
    const status = getMarketStatus();
    expect(status.phase).toBe("holiday");
    expect(status.label).toContain("Holiday");
    expect(status.label).toContain("New Year");
    expect(status.isTrading).toBe(false);
    expect(status.holiday).toBeDefined();
    expect(status.holiday!.name).toBe("New Year's Day");
  });

  it("returns 'holiday' phase on Eid Al Fitr 2026", () => {
    // 2026-03-19 at 10:00 UAE (06:00 UTC) - Thursday
    vi.setSystemTime(new Date("2026-03-19T06:00:00Z"));
    const status = getMarketStatus();
    expect(status.phase).toBe("holiday");
    expect(status.label).toContain("Eid Al Fitr");
    expect(status.isTrading).toBe(false);
  });

  it("returns 'holiday' with Arabic name", () => {
    vi.setSystemTime(new Date("2026-01-01T06:00:00Z"));
    const status = getMarketStatus();
    expect(status.holiday?.nameAr).toBe("رأس السنة الميلادية");
    expect(status.description).toContain("رأس السنة الميلادية");
  });

  it("returns 'open' on a regular weekday during trading hours", () => {
    // 2026-03-10 at 10:00 UAE (06:00 UTC) - Tuesday, not a holiday
    vi.setSystemTime(new Date("2026-03-10T06:00:00Z"));
    const status = getMarketStatus();
    expect(status.phase).toBe("open");
    expect(status.isTrading).toBe(true);
    expect(status.holiday).toBeUndefined();
  });

  it("returns 'closed' on weekend even if no holiday", () => {
    // Saturday March 7, 2026
    vi.setSystemTime(new Date("2026-03-07T08:00:00Z"));
    const status = getMarketStatus();
    expect(status.phase).toBe("closed");
    expect(status.holiday).toBeUndefined();
  });

  it("holiday nextPhase points to next trading day pre-open", () => {
    // 2026-01-01 Thursday holiday → next trading day should be Friday Jan 2 (if not holiday) or Monday Jan 5
    vi.setSystemTime(new Date("2026-01-01T06:00:00Z"));
    const status = getMarketStatus();
    expect(status.nextPhase).toBe("pre-open");
    expect(status.nextPhaseTime).toBeDefined();
    // Verify it's a valid ISO string
    const nextDate = new Date(status.nextPhaseTime);
    expect(nextDate.getTime()).toBeGreaterThan(new Date("2026-01-01T06:00:00Z").getTime());
  });

  it("Commemoration Day 2026 is detected as holiday", () => {
    // 2026-12-01 is Tuesday
    vi.setSystemTime(new Date("2026-12-01T06:00:00Z"));
    const status = getMarketStatus();
    expect(status.phase).toBe("holiday");
    expect(status.label).toContain("Commemoration Day");
  });
});

describe("Upcoming Holidays", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns upcoming holidays from current date", () => {
    vi.setSystemTime(new Date("2026-03-01T06:00:00Z"));
    const upcoming = getUpcomingHolidays(5);
    expect(upcoming.length).toBeLessThanOrEqual(5);
    expect(upcoming.length).toBeGreaterThan(0);
    // All should be >= March 2026
    for (const h of upcoming) {
      expect(h.date >= "2026-03-01").toBe(true);
    }
  });

  it("returns holidays in chronological order", () => {
    vi.setSystemTime(new Date("2026-01-01T06:00:00Z"));
    const upcoming = getUpcomingHolidays(10);
    for (let i = 1; i < upcoming.length; i++) {
      expect(upcoming[i].date >= upcoming[i - 1].date).toBe(true);
    }
  });
});
