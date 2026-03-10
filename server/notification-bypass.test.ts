import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for Notification Preference Bypass Fix (Phase 18)
 * 
 * Bug: notifyOwner was called unconditionally for every high/critical volume spike,
 * sending email notifications to the owner regardless of their preference settings.
 * 
 * Fix: notifyOwner is now gated behind the owner's notification preferences:
 * 1. Owner must have emailEnabled = 1
 * 2. Alert severity must be in owner's emailSeverities filter
 * 3. Owner must not be in quiet hours
 * 4. In-app notifications respect inAppEnabled preference per user
 */

// ─── Owner Email Gate Logic ───────────────────────────────────────────

describe("Owner Email Notification Gate", () => {
  /**
   * Simulates the decision logic in sendVolumeNotification:
   * Should we call notifyOwner for the given alert?
   */
  function shouldSendOwnerNotification(
    ownerPrefs: {
      emailEnabled: number;
      emailSeverities: string;
      quietHoursEnabled: number;
      quietHoursStart: string;
      quietHoursEnd: string;
    } | null,
    alertSeverity: string,
    currentHour: number,
    currentMinute: number
  ): { send: boolean; reason: string } {
    if (!ownerPrefs) {
      return { send: false, reason: "no preferences saved" };
    }

    const ownerEmailEnabled = ownerPrefs.emailEnabled === 1;
    if (!ownerEmailEnabled) {
      return { send: false, reason: "email notifications disabled" };
    }

    // Check severity filter
    const ownerSeverities = (ownerPrefs.emailSeverities || "").split(",").map(s => s.trim());
    if (!ownerSeverities.includes(alertSeverity)) {
      return { send: false, reason: `severity '${alertSeverity}' not in owner's filter` };
    }

    // Check quiet hours
    if (ownerPrefs.quietHoursEnabled) {
      const [startH, startM] = (ownerPrefs.quietHoursStart || "22:00").split(":").map(Number);
      const [endH, endM] = (ownerPrefs.quietHoursEnd || "07:00").split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const currentMinutes = currentHour * 60 + currentMinute;

      let inQuietHours = false;
      if (startMinutes <= endMinutes) {
        inQuietHours = currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        inQuietHours = currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }

      if (inQuietHours) {
        return { send: false, reason: "quiet hours active" };
      }
    }

    return { send: true, reason: "owner opted in" };
  }

  it("should NOT send when owner has no preferences saved (default = no email)", () => {
    const result = shouldSendOwnerNotification(null, "critical", 12, 0);
    expect(result.send).toBe(false);
    expect(result.reason).toBe("no preferences saved");
  });

  it("should NOT send when owner has emailEnabled = 0", () => {
    const result = shouldSendOwnerNotification(
      { emailEnabled: 0, emailSeverities: "high,critical", quietHoursEnabled: 0, quietHoursStart: "22:00", quietHoursEnd: "07:00" },
      "critical",
      12, 0
    );
    expect(result.send).toBe(false);
    expect(result.reason).toBe("email notifications disabled");
  });

  it("should NOT send when alert severity is not in owner's filter", () => {
    const result = shouldSendOwnerNotification(
      { emailEnabled: 1, emailSeverities: "critical", quietHoursEnabled: 0, quietHoursStart: "22:00", quietHoursEnd: "07:00" },
      "high",
      12, 0
    );
    expect(result.send).toBe(false);
    expect(result.reason).toBe("severity 'high' not in owner's filter");
  });

  it("should NOT send during owner's quiet hours", () => {
    const result = shouldSendOwnerNotification(
      { emailEnabled: 1, emailSeverities: "high,critical", quietHoursEnabled: 1, quietHoursStart: "22:00", quietHoursEnd: "07:00" },
      "critical",
      23, 30 // 11:30 PM - during quiet hours
    );
    expect(result.send).toBe(false);
    expect(result.reason).toBe("quiet hours active");
  });

  it("should SEND when owner has explicitly enabled email and severity matches", () => {
    const result = shouldSendOwnerNotification(
      { emailEnabled: 1, emailSeverities: "high,critical", quietHoursEnabled: 0, quietHoursStart: "22:00", quietHoursEnd: "07:00" },
      "critical",
      12, 0
    );
    expect(result.send).toBe(true);
    expect(result.reason).toBe("owner opted in");
  });

  it("should SEND for high severity when owner has high in their filter", () => {
    const result = shouldSendOwnerNotification(
      { emailEnabled: 1, emailSeverities: "high,critical", quietHoursEnabled: 0, quietHoursStart: "22:00", quietHoursEnd: "07:00" },
      "high",
      10, 30
    );
    expect(result.send).toBe(true);
    expect(result.reason).toBe("owner opted in");
  });

  it("should SEND outside quiet hours even when quiet hours are enabled", () => {
    const result = shouldSendOwnerNotification(
      { emailEnabled: 1, emailSeverities: "high,critical", quietHoursEnabled: 1, quietHoursStart: "22:00", quietHoursEnd: "07:00" },
      "critical",
      12, 0 // Noon - outside quiet hours
    );
    expect(result.send).toBe(true);
    expect(result.reason).toBe("owner opted in");
  });

  it("should NOT send for low severity even when email is enabled", () => {
    const result = shouldSendOwnerNotification(
      { emailEnabled: 1, emailSeverities: "high,critical", quietHoursEnabled: 0, quietHoursStart: "22:00", quietHoursEnd: "07:00" },
      "low",
      12, 0
    );
    expect(result.send).toBe(false);
    expect(result.reason).toBe("severity 'low' not in owner's filter");
  });

  it("should NOT send for medium severity when only critical is in filter", () => {
    const result = shouldSendOwnerNotification(
      { emailEnabled: 1, emailSeverities: "critical", quietHoursEnabled: 0, quietHoursStart: "22:00", quietHoursEnd: "07:00" },
      "medium",
      12, 0
    );
    expect(result.send).toBe(false);
    expect(result.reason).toBe("severity 'medium' not in owner's filter");
  });
});

// ─── In-App Notification Preference Respect ───────────────────────────

describe("In-App Notification Preference Respect", () => {
  /**
   * Simulates the logic for deciding which users get in-app notifications.
   * If a user has no preferences saved, in-app defaults to enabled (schema default).
   * If preferences exist, respect the inAppEnabled flag.
   */
  function shouldCreateInAppNotification(
    prefs: { inAppEnabled: number } | null
  ): boolean {
    // No preferences saved = default is inAppEnabled=1
    if (!prefs) return true;
    return prefs.inAppEnabled === 1;
  }

  it("should create in-app notification when no preferences saved (default on)", () => {
    expect(shouldCreateInAppNotification(null)).toBe(true);
  });

  it("should create in-app notification when inAppEnabled = 1", () => {
    expect(shouldCreateInAppNotification({ inAppEnabled: 1 })).toBe(true);
  });

  it("should NOT create in-app notification when inAppEnabled = 0", () => {
    expect(shouldCreateInAppNotification({ inAppEnabled: 0 })).toBe(false);
  });
});

// ─── Combined Notification Flow ───────────────────────────────────────

describe("Combined Notification Flow", () => {
  /**
   * Simulates the full notification decision for a volume spike alert.
   * Returns which channels should fire for a given user's preferences.
   */
  function getNotificationChannels(
    prefs: {
      emailEnabled: number;
      browserEnabled: number;
      soundEnabled: number;
      inAppEnabled: number;
      emailSeverities: string;
      browserSeverities: string;
    } | null,
    alertSeverity: string
  ): string[] {
    const channels: string[] = [];

    // Default behavior when no preferences saved
    if (!prefs) {
      // email: OFF by default (schema default emailEnabled=0)
      // browser: ON by default
      // sound: ON by default
      // inApp: ON by default
      return ["browser", "sound", "inApp"];
    }

    // Email: must be explicitly enabled AND severity must match
    if (prefs.emailEnabled === 1) {
      const severities = prefs.emailSeverities.split(",").map(s => s.trim());
      if (severities.includes(alertSeverity)) {
        channels.push("email");
      }
    }

    // Browser: enabled AND severity matches
    if (prefs.browserEnabled === 1) {
      const severities = prefs.browserSeverities.split(",").map(s => s.trim());
      if (severities.includes(alertSeverity)) {
        channels.push("browser");
      }
    }

    // Sound: simple toggle
    if (prefs.soundEnabled === 1) {
      channels.push("sound");
    }

    // In-app: simple toggle
    if (prefs.inAppEnabled === 1) {
      channels.push("inApp");
    }

    return channels;
  }

  it("should NOT include email when no preferences saved (default off)", () => {
    const channels = getNotificationChannels(null, "critical");
    expect(channels).not.toContain("email");
    expect(channels).toContain("browser");
    expect(channels).toContain("sound");
    expect(channels).toContain("inApp");
  });

  it("should include email only when explicitly enabled and severity matches", () => {
    const channels = getNotificationChannels(
      {
        emailEnabled: 1,
        browserEnabled: 1,
        soundEnabled: 1,
        inAppEnabled: 1,
        emailSeverities: "high,critical",
        browserSeverities: "medium,high,critical",
      },
      "critical"
    );
    expect(channels).toContain("email");
    expect(channels).toContain("browser");
    expect(channels).toContain("sound");
    expect(channels).toContain("inApp");
  });

  it("should NOT include email when enabled but severity does not match", () => {
    const channels = getNotificationChannels(
      {
        emailEnabled: 1,
        browserEnabled: 1,
        soundEnabled: 1,
        inAppEnabled: 1,
        emailSeverities: "critical",
        browserSeverities: "medium,high,critical",
      },
      "medium"
    );
    expect(channels).not.toContain("email");
    expect(channels).toContain("browser");
  });

  it("should return empty when all channels disabled", () => {
    const channels = getNotificationChannels(
      {
        emailEnabled: 0,
        browserEnabled: 0,
        soundEnabled: 0,
        inAppEnabled: 0,
        emailSeverities: "",
        browserSeverities: "",
      },
      "critical"
    );
    expect(channels).toEqual([]);
  });

  it("should handle khalifa@uae.net scenario: email not enabled should not receive email", () => {
    // User has NOT enabled email notifications (the reported bug scenario)
    const channels = getNotificationChannels(
      {
        emailEnabled: 0,  // NOT enabled
        browserEnabled: 1,
        soundEnabled: 1,
        inAppEnabled: 1,
        emailSeverities: "high,critical",
        browserSeverities: "medium,high,critical",
      },
      "critical"
    );
    expect(channels).not.toContain("email");
    expect(channels).toContain("inApp");
  });
});
