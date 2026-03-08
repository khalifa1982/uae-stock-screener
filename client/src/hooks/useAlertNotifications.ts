import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Alert notification preferences stored in localStorage
 */
interface NotificationPrefs {
  browserNotifications: boolean;
  soundEnabled: boolean;
  soundVolume: number; // 0.0 - 1.0
}

const PREFS_KEY = "uae-screener-notification-prefs";
const SEEN_ALERTS_KEY = "uae-screener-seen-alerts";

const DEFAULT_PREFS: NotificationPrefs = {
  browserNotifications: false,
  soundEnabled: true,
  soundVolume: 0.7,
};

function loadPrefs(): NotificationPrefs {
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_PREFS;
}

function savePrefs(prefs: NotificationPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function getSeenAlerts(): Set<string> {
  try {
    const stored = localStorage.getItem(SEEN_ALERTS_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {}
  return new Set();
}

function addSeenAlert(alertKey: string) {
  const seen = getSeenAlerts();
  seen.add(alertKey);
  // Keep only last 500 alerts to avoid localStorage bloat
  const arr = Array.from(seen);
  if (arr.length > 500) arr.splice(0, arr.length - 500);
  localStorage.setItem(SEEN_ALERTS_KEY, JSON.stringify(arr));
}

/**
 * Generate an alert sound using Web Audio API
 * Creates a two-tone ascending beep pattern (financial alert style)
 */
function playAlertSound(volume: number, severity: "low" | "medium" | "high" | "critical") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ctx.destination);

    // Different sound patterns based on severity
    const patterns: Record<string, { freqs: number[]; durations: number[]; repeats: number }> = {
      low: { freqs: [440, 550], durations: [0.12, 0.12], repeats: 1 },
      medium: { freqs: [520, 660], durations: [0.1, 0.1], repeats: 2 },
      high: { freqs: [600, 800, 600], durations: [0.08, 0.08, 0.08], repeats: 2 },
      critical: { freqs: [700, 900, 700, 900], durations: [0.07, 0.07, 0.07, 0.07], repeats: 3 },
    };

    const pattern = patterns[severity] || patterns.medium;
    let time = ctx.currentTime + 0.05;

    for (let r = 0; r < pattern.repeats; r++) {
      for (let i = 0; i < pattern.freqs.length; i++) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = severity === "critical" ? "square" : "sine";
        osc.frequency.value = pattern.freqs[i];
        env.gain.setValueAtTime(0, time);
        env.gain.linearRampToValueAtTime(0.6, time + 0.01);
        env.gain.exponentialRampToValueAtTime(0.01, time + pattern.durations[i]);
        osc.connect(env);
        env.connect(masterGain);
        osc.start(time);
        osc.stop(time + pattern.durations[i] + 0.02);
        time += pattern.durations[i];
      }
      time += 0.15; // Gap between repeats
    }

    // Clean up after all sounds finish
    setTimeout(() => ctx.close(), (time - ctx.currentTime + 1) * 1000);
  } catch (e) {
    console.warn("[AlertSound] Failed to play:", e);
  }
}

/**
 * Show a browser notification for a volume spike alert
 */
function showBrowserNotification(alert: {
  symbol: string;
  stockName: string;
  volumeMultiplier: number;
  currentVolume: number;
  price: number | null;
  changePercent: number | null;
  severity: string;
  sector: string;
}) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const severityEmoji: Record<string, string> = {
    critical: "\u{1F534}",
    high: "\u{1F7E0}",
    medium: "\u{1F7E1}",
    low: "\u{1F535}",
  };

  const emoji = severityEmoji[alert.severity] || "\u{1F514}";
  const changeStr = alert.changePercent != null
    ? `${alert.changePercent >= 0 ? "+" : ""}${alert.changePercent.toFixed(2)}%`
    : "";
  const priceStr = alert.price != null ? `${alert.price.toFixed(2)} AED` : "";

  const volFormatted = alert.currentVolume >= 1_000_000
    ? `${(alert.currentVolume / 1_000_000).toFixed(2)}M`
    : alert.currentVolume >= 1_000
      ? `${(alert.currentVolume / 1_000).toFixed(1)}K`
      : alert.currentVolume.toString();

  const title = `${emoji} Volume Spike: ${alert.stockName} (${alert.volumeMultiplier}x)`;
  const body = [
    `Volume: ${volFormatted} (${alert.volumeMultiplier}x average)`,
    priceStr ? `Price: ${priceStr} ${changeStr}` : "",
    `Sector: ${alert.sector}`,
    `Severity: ${alert.severity.toUpperCase()}`,
  ].filter(Boolean).join("\n");

  try {
    const notification = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: `volume-spike-${alert.symbol}`,
      requireInteraction: alert.severity === "critical" || alert.severity === "high",
    } as NotificationOptions);

    notification.onclick = () => {
      window.focus();
      window.location.hash = "";
      window.location.pathname = `/stock/${alert.symbol}`;
      notification.close();
    };

    // Auto-close after 15 seconds for non-critical
    if (alert.severity !== "critical") {
      setTimeout(() => notification.close(), 15000);
    }
  } catch (e) {
    console.warn("[BrowserNotification] Failed:", e);
  }
}

export type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

export function useAlertNotifications() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadPrefs);
  const [permissionState, setPermissionState] = useState<NotificationPermissionState>("default");
  const seenAlertsRef = useRef<Set<string>>(getSeenAlerts());

  // Check notification permission on mount
  useEffect(() => {
    if (!("Notification" in window)) {
      setPermissionState("unsupported");
    } else {
      setPermissionState(Notification.permission as NotificationPermissionState);
    }
  }, []);

  // Request browser notification permission
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      setPermissionState("unsupported");
      return false;
    }
    try {
      const result = await Notification.requestPermission();
      setPermissionState(result as NotificationPermissionState);
      if (result === "granted") {
        setPrefs(prev => {
          const next = { ...prev, browserNotifications: true };
          savePrefs(next);
          return next;
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Toggle browser notifications
  const toggleBrowserNotifications = useCallback(async (enabled: boolean) => {
    if (enabled && Notification.permission !== "granted") {
      const granted = await requestPermission();
      if (!granted) return;
    }
    setPrefs(prev => {
      const next = { ...prev, browserNotifications: enabled };
      savePrefs(next);
      return next;
    });
  }, [requestPermission]);

  // Toggle sound
  const toggleSound = useCallback((enabled: boolean) => {
    setPrefs(prev => {
      const next = { ...prev, soundEnabled: enabled };
      savePrefs(next);
      return next;
    });
  }, []);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    setPrefs(prev => {
      const next = { ...prev, soundVolume: Math.max(0, Math.min(1, volume)) };
      savePrefs(next);
      return next;
    });
  }, []);

  // Process new alerts - play sound and show notification for unseen ones
  const processAlerts = useCallback((alerts: Array<{
    id?: number;
    symbol: string;
    stockName?: string;
    volumeMultiplier: number;
    currentVolume: number;
    price: number | null;
    changePercent: number | null;
    severity: string;
    sector?: string;
    detectedAt?: string | Date;
  }>) => {
    if (!alerts || alerts.length === 0) return;

    let hasNewAlerts = false;
    const newAlerts: typeof alerts = [];

    for (const alert of alerts) {
      // Create a unique key for this alert
      const key = `${alert.symbol}-${alert.id || ""}-${alert.volumeMultiplier}`;
      if (!seenAlertsRef.current.has(key)) {
        seenAlertsRef.current.add(key);
        addSeenAlert(key);
        hasNewAlerts = true;
        newAlerts.push(alert);
      }
    }

    if (!hasNewAlerts) return;

    // Find the highest severity among new alerts
    const severityOrder = ["low", "medium", "high", "critical"];
    let maxSeverity: "low" | "medium" | "high" | "critical" = "low";
    for (const a of newAlerts) {
      const idx = severityOrder.indexOf(a.severity);
      if (idx > severityOrder.indexOf(maxSeverity)) {
        maxSeverity = a.severity as typeof maxSeverity;
      }
    }

    // Play alert sound
    if (prefs.soundEnabled) {
      playAlertSound(prefs.soundVolume, maxSeverity);
    }

    // Show browser notifications
    if (prefs.browserNotifications && Notification.permission === "granted") {
      // Show individual notifications for high/critical, summary for others
      const importantAlerts = newAlerts.filter(a => a.severity === "critical" || a.severity === "high");
      const otherAlerts = newAlerts.filter(a => a.severity !== "critical" && a.severity !== "high");

      for (const alert of importantAlerts) {
        showBrowserNotification({
          symbol: alert.symbol,
          stockName: alert.stockName || alert.symbol,
          volumeMultiplier: alert.volumeMultiplier,
          currentVolume: alert.currentVolume,
          price: alert.price,
          changePercent: alert.changePercent,
          severity: alert.severity,
          sector: alert.sector || "Unknown",
        });
      }

      // Summary notification for medium/low alerts
      if (otherAlerts.length > 0 && importantAlerts.length === 0) {
        const first = otherAlerts[0];
        showBrowserNotification({
          symbol: first.symbol,
          stockName: otherAlerts.length > 1
            ? `${first.stockName || first.symbol} + ${otherAlerts.length - 1} more`
            : first.stockName || first.symbol,
          volumeMultiplier: first.volumeMultiplier,
          currentVolume: first.currentVolume,
          price: first.price,
          changePercent: first.changePercent,
          severity: first.severity,
          sector: first.sector || "Unknown",
        });
      }
    }

    return newAlerts.length;
  }, [prefs.soundEnabled, prefs.soundVolume, prefs.browserNotifications]);

  // Test notification - plays sound and shows a test browser notification
  const testNotification = useCallback(() => {
    if (prefs.soundEnabled) {
      playAlertSound(prefs.soundVolume, "high");
    }
    if (prefs.browserNotifications && Notification.permission === "granted") {
      showBrowserNotification({
        symbol: "TEST",
        stockName: "Test Alert",
        volumeMultiplier: 3.5,
        currentVolume: 5000000,
        price: 25.50,
        changePercent: 2.35,
        severity: "high",
        sector: "Test Sector",
      });
    }
  }, [prefs.soundEnabled, prefs.soundVolume, prefs.browserNotifications]);

  // Play sound only (for manual scan results)
  const playSoundOnly = useCallback((severity: "low" | "medium" | "high" | "critical" = "medium") => {
    if (prefs.soundEnabled) {
      playAlertSound(prefs.soundVolume, severity);
    }
  }, [prefs.soundEnabled, prefs.soundVolume]);

  return {
    prefs,
    permissionState,
    requestPermission,
    toggleBrowserNotifications,
    toggleSound,
    setVolume,
    processAlerts,
    testNotification,
    playSoundOnly,
  };
}
