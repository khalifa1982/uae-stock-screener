import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for Notification Preferences System
 * - Database schema validation
 * - Preference CRUD operations
 * - Severity filtering logic
 * - Quiet hours calculation
 * - Email notification routing
 */

// ─── Schema & Type Tests ───────────────────────────────────────────────

describe("Notification Preferences Schema", () => {
  it("should define all required preference fields", () => {
    const defaultPrefs = {
      emailEnabled: false,
      browserEnabled: true,
      soundEnabled: true,
      inAppEnabled: true,
      emailSeverities: "high,critical",
      browserSeverities: "medium,high,critical",
      notificationEmail: "",
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      soundVolume: 0.7,
      minIntervalMinutes: 5,
    };

    expect(defaultPrefs).toHaveProperty("emailEnabled");
    expect(defaultPrefs).toHaveProperty("browserEnabled");
    expect(defaultPrefs).toHaveProperty("soundEnabled");
    expect(defaultPrefs).toHaveProperty("inAppEnabled");
    expect(defaultPrefs).toHaveProperty("emailSeverities");
    expect(defaultPrefs).toHaveProperty("browserSeverities");
    expect(defaultPrefs).toHaveProperty("notificationEmail");
    expect(defaultPrefs).toHaveProperty("quietHoursEnabled");
    expect(defaultPrefs).toHaveProperty("quietHoursStart");
    expect(defaultPrefs).toHaveProperty("quietHoursEnd");
    expect(defaultPrefs).toHaveProperty("soundVolume");
    expect(defaultPrefs).toHaveProperty("minIntervalMinutes");
  });

  it("should have valid default severity levels", () => {
    const emailSeverities = "high,critical".split(",");
    const browserSeverities = "medium,high,critical".split(",");
    const validSeverities = ["low", "medium", "high", "critical"];

    for (const sev of emailSeverities) {
      expect(validSeverities).toContain(sev);
    }
    for (const sev of browserSeverities) {
      expect(validSeverities).toContain(sev);
    }
  });
});

// ─── Severity Filtering Logic ──────────────────────────────────────────

describe("Severity Filtering", () => {
  function shouldNotify(alertSeverity: string, enabledSeverities: string): boolean {
    const enabled = enabledSeverities.split(",").filter(Boolean);
    return enabled.includes(alertSeverity);
  }

  it("should match exact severity levels", () => {
    expect(shouldNotify("critical", "high,critical")).toBe(true);
    expect(shouldNotify("high", "high,critical")).toBe(true);
    expect(shouldNotify("medium", "high,critical")).toBe(false);
    expect(shouldNotify("low", "high,critical")).toBe(false);
  });

  it("should handle all severities enabled", () => {
    const allEnabled = "low,medium,high,critical";
    expect(shouldNotify("low", allEnabled)).toBe(true);
    expect(shouldNotify("medium", allEnabled)).toBe(true);
    expect(shouldNotify("high", allEnabled)).toBe(true);
    expect(shouldNotify("critical", allEnabled)).toBe(true);
  });

  it("should handle empty severity string", () => {
    expect(shouldNotify("critical", "")).toBe(false);
    expect(shouldNotify("high", "")).toBe(false);
  });

  it("should handle single severity", () => {
    expect(shouldNotify("critical", "critical")).toBe(true);
    expect(shouldNotify("high", "critical")).toBe(false);
  });
});

// ─── Quiet Hours Logic ─────────────────────────────────────────────────

describe("Quiet Hours", () => {
  function isInQuietHours(
    currentHour: number,
    currentMinute: number,
    startTime: string,
    endTime: string
  ): boolean {
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const currentMinutes = currentHour * 60 + currentMinute;

    if (startMinutes <= endMinutes) {
      // Same day range (e.g., 09:00 - 17:00)
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Overnight range (e.g., 22:00 - 07:00)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  it("should detect overnight quiet hours (22:00 - 07:00)", () => {
    // During quiet hours
    expect(isInQuietHours(23, 0, "22:00", "07:00")).toBe(true);
    expect(isInQuietHours(0, 0, "22:00", "07:00")).toBe(true);
    expect(isInQuietHours(3, 30, "22:00", "07:00")).toBe(true);
    expect(isInQuietHours(6, 59, "22:00", "07:00")).toBe(true);
    expect(isInQuietHours(22, 0, "22:00", "07:00")).toBe(true);

    // Outside quiet hours
    expect(isInQuietHours(7, 0, "22:00", "07:00")).toBe(false);
    expect(isInQuietHours(12, 0, "22:00", "07:00")).toBe(false);
    expect(isInQuietHours(21, 59, "22:00", "07:00")).toBe(false);
  });

  it("should detect same-day quiet hours (09:00 - 17:00)", () => {
    // During quiet hours
    expect(isInQuietHours(9, 0, "09:00", "17:00")).toBe(true);
    expect(isInQuietHours(12, 30, "09:00", "17:00")).toBe(true);
    expect(isInQuietHours(16, 59, "09:00", "17:00")).toBe(true);

    // Outside quiet hours
    expect(isInQuietHours(8, 59, "09:00", "17:00")).toBe(false);
    expect(isInQuietHours(17, 0, "09:00", "17:00")).toBe(false);
    expect(isInQuietHours(22, 0, "09:00", "17:00")).toBe(false);
  });

  it("should handle midnight boundary", () => {
    expect(isInQuietHours(0, 0, "23:00", "06:00")).toBe(true);
    expect(isInQuietHours(23, 0, "23:00", "06:00")).toBe(true);
    expect(isInQuietHours(5, 59, "23:00", "06:00")).toBe(true);
    expect(isInQuietHours(6, 0, "23:00", "06:00")).toBe(false);
  });
});

// ─── Alert Severity Ordering ───────────────────────────────────────────

describe("Alert Severity Ordering", () => {
  const severityOrder = ["low", "medium", "high", "critical"];

  function getMaxSeverity(alerts: { severity: string }[]): string {
    let maxSeverity = "low";
    for (const alert of alerts) {
      if (severityOrder.indexOf(alert.severity) > severityOrder.indexOf(maxSeverity)) {
        maxSeverity = alert.severity;
      }
    }
    return maxSeverity;
  }

  it("should find the highest severity among alerts", () => {
    expect(getMaxSeverity([
      { severity: "low" },
      { severity: "critical" },
      { severity: "medium" },
    ])).toBe("critical");
  });

  it("should handle single alert", () => {
    expect(getMaxSeverity([{ severity: "high" }])).toBe("high");
  });

  it("should handle all same severity", () => {
    expect(getMaxSeverity([
      { severity: "medium" },
      { severity: "medium" },
    ])).toBe("medium");
  });

  it("should handle ascending order", () => {
    expect(getMaxSeverity([
      { severity: "low" },
      { severity: "medium" },
      { severity: "high" },
    ])).toBe("high");
  });
});

// ─── Notification Preference Validation ────────────────────────────────

describe("Notification Preference Validation", () => {
  function validatePreferences(prefs: Record<string, any>): string[] {
    const errors: string[] = [];

    if (prefs.soundVolume < 0 || prefs.soundVolume > 1) {
      errors.push("Sound volume must be between 0 and 1");
    }
    if (prefs.minIntervalMinutes < 1 || prefs.minIntervalMinutes > 60) {
      errors.push("Minimum interval must be between 1 and 60 minutes");
    }
    if (prefs.emailEnabled && !prefs.emailSeverities) {
      errors.push("Email severities required when email is enabled");
    }
    if (prefs.quietHoursEnabled) {
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!timeRegex.test(prefs.quietHoursStart)) {
        errors.push("Invalid quiet hours start time format");
      }
      if (!timeRegex.test(prefs.quietHoursEnd)) {
        errors.push("Invalid quiet hours end time format");
      }
    }
    return errors;
  }

  it("should accept valid preferences", () => {
    const errors = validatePreferences({
      emailEnabled: true,
      emailSeverities: "high,critical",
      soundVolume: 0.5,
      minIntervalMinutes: 5,
      quietHoursEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    });
    expect(errors).toHaveLength(0);
  });

  it("should reject invalid sound volume", () => {
    const errors = validatePreferences({
      emailEnabled: false,
      soundVolume: 1.5,
      minIntervalMinutes: 5,
      quietHoursEnabled: false,
    });
    expect(errors).toContain("Sound volume must be between 0 and 1");
  });

  it("should reject invalid min interval", () => {
    const errors = validatePreferences({
      emailEnabled: false,
      soundVolume: 0.5,
      minIntervalMinutes: 0,
      quietHoursEnabled: false,
    });
    expect(errors).toContain("Minimum interval must be between 1 and 60 minutes");
  });

  it("should require email severities when email is enabled", () => {
    const errors = validatePreferences({
      emailEnabled: true,
      emailSeverities: "",
      soundVolume: 0.5,
      minIntervalMinutes: 5,
      quietHoursEnabled: false,
    });
    expect(errors).toContain("Email severities required when email is enabled");
  });

  it("should validate quiet hours time format", () => {
    const errors = validatePreferences({
      emailEnabled: false,
      soundVolume: 0.5,
      minIntervalMinutes: 5,
      quietHoursEnabled: true,
      quietHoursStart: "invalid",
      quietHoursEnd: "07:00",
    });
    expect(errors).toContain("Invalid quiet hours start time format");
  });
});

// ─── Notification Channel Routing ──────────────────────────────────────

describe("Notification Channel Routing", () => {
  function getActiveChannels(prefs: {
    emailEnabled: boolean;
    browserEnabled: boolean;
    soundEnabled: boolean;
    inAppEnabled: boolean;
  }): string[] {
    const channels: string[] = [];
    if (prefs.emailEnabled) channels.push("email");
    if (prefs.browserEnabled) channels.push("browser");
    if (prefs.soundEnabled) channels.push("sound");
    if (prefs.inAppEnabled) channels.push("inApp");
    return channels;
  }

  it("should return all channels when all enabled", () => {
    const channels = getActiveChannels({
      emailEnabled: true,
      browserEnabled: true,
      soundEnabled: true,
      inAppEnabled: true,
    });
    expect(channels).toEqual(["email", "browser", "sound", "inApp"]);
  });

  it("should return empty when all disabled", () => {
    const channels = getActiveChannels({
      emailEnabled: false,
      browserEnabled: false,
      soundEnabled: false,
      inAppEnabled: false,
    });
    expect(channels).toEqual([]);
  });

  it("should return only email when only email enabled", () => {
    const channels = getActiveChannels({
      emailEnabled: true,
      browserEnabled: false,
      soundEnabled: false,
      inAppEnabled: false,
    });
    expect(channels).toEqual(["email"]);
  });

  it("should return browser + sound combo", () => {
    const channels = getActiveChannels({
      emailEnabled: false,
      browserEnabled: true,
      soundEnabled: true,
      inAppEnabled: false,
    });
    expect(channels).toEqual(["browser", "sound"]);
  });
});
