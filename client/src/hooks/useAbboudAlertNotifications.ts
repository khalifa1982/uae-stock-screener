import { useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Hook that polls for new Abboud AI alerts and shows browser notifications.
 * Uses the existing notification permission from useAlertNotifications.
 * 
 * Polls every 30 seconds during trading hours, 2 minutes otherwise.
 */

const SEEN_ABBOUD_KEY = "uae-screener-seen-abboud-alerts";

function getSeenAbboudAlerts(): Set<number> {
  try {
    const stored = localStorage.getItem(SEEN_ABBOUD_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {}
  return new Set();
}

function addSeenAbboudAlert(id: number) {
  const seen = getSeenAbboudAlerts();
  seen.add(id);
  // Keep only last 200 alert IDs
  const arr = Array.from(seen);
  if (arr.length > 200) arr.splice(0, arr.length - 200);
  localStorage.setItem(SEEN_ABBOUD_KEY, JSON.stringify(arr));
}

/**
 * Play Abboud AI alert sound using Web Audio API
 */
function playAbboudAlertSound(severity: "info" | "warning" | "critical") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);

    let time = ctx.currentTime + 0.05;

    if (severity === "critical") {
      // Urgent ascending triple beep
      const freqs = [600, 800, 1000];
      for (let r = 0; r < 2; r++) {
        for (const freq of freqs) {
          const osc = ctx.createOscillator();
          const env = ctx.createGain();
          osc.type = "square";
          osc.frequency.value = freq;
          env.gain.setValueAtTime(0, time);
          env.gain.linearRampToValueAtTime(0.5, time + 0.01);
          env.gain.exponentialRampToValueAtTime(0.01, time + 0.08);
          osc.connect(env);
          env.connect(masterGain);
          osc.start(time);
          osc.stop(time + 0.1);
          time += 0.1;
        }
        time += 0.15;
      }
    } else if (severity === "warning") {
      // Two-tone alert
      const freqs = [520, 660];
      for (const freq of freqs) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        env.gain.setValueAtTime(0, time);
        env.gain.linearRampToValueAtTime(0.4, time + 0.01);
        env.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
        osc.connect(env);
        env.connect(masterGain);
        osc.start(time);
        osc.stop(time + 0.14);
        time += 0.14;
      }
    } else {
      // Gentle single tone
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 440;
      env.gain.setValueAtTime(0, time);
      env.gain.linearRampToValueAtTime(0.3, time + 0.02);
      env.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
      osc.connect(env);
      env.connect(masterGain);
      osc.start(time);
      osc.stop(time + 0.22);
    }

    setTimeout(() => ctx.close(), 3000);
  } catch (e) {
    console.warn("[AbboudAlertSound] Failed:", e);
  }
}

/**
 * Show a browser notification for an Abboud AI alert
 */
function showAbboudNotification(alert: {
  id: number;
  symbol: string;
  exchange: string;
  alertType: string;
  price: number;
  triggerLevel: number;
  direction: string;
  message: string;
  severity: string;
}) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const typeEmoji: Record<string, string> = {
    entry_zone: "\u{1F4CA}",
    stop_loss: "\u{26A0}\u{FE0F}",
    target_1: "\u{1F3AF}",
    target_2: "\u{1F3AF}",
    target_3: "\u{1F3AF}",
    fib_bounce: "\u{1F4C8}",
  };

  const typeLabel: Record<string, string> = {
    entry_zone: "Entry Zone",
    stop_loss: "Stop Loss",
    target_1: "Target 1 Hit",
    target_2: "Target 2 Hit",
    target_3: "Target 3 Hit",
    fib_bounce: "Fib Bounce",
  };

  const emoji = typeEmoji[alert.alertType] || "\u{1F514}";
  const label = typeLabel[alert.alertType] || alert.alertType;
  const dirEmoji = alert.direction === "bullish" ? "\u{1F7E2}" : "\u{1F534}";

  const title = `${emoji} Abboud AI: ${alert.symbol} - ${label}`;
  const body = [
    `${dirEmoji} ${alert.direction.toUpperCase()} signal`,
    `Price: ${alert.price.toFixed(3)} AED`,
    `Trigger: ${alert.triggerLevel.toFixed(3)}`,
    `Exchange: ${alert.exchange}`,
  ].join("\n");

  try {
    const notification = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: `abboud-${alert.symbol}-${alert.alertType}`,
      requireInteraction: alert.severity === "critical",
    } as NotificationOptions);

    notification.onclick = () => {
      window.focus();
      window.location.pathname = `/stock/${alert.symbol}`;
      notification.close();
    };

    if (alert.severity !== "critical") {
      setTimeout(() => notification.close(), 20000);
    }
  } catch (e) {
    console.warn("[AbboudNotification] Failed:", e);
  }
}

export function useAbboudAlertNotifications() {
  const seenRef = useRef<Set<number>>(getSeenAbboudAlerts());

  // Poll for recent Abboud alerts every 30 seconds
  const { data: recentAlerts } = trpc.td.recentAlerts.useQuery(
    { limit: 10 },
    { refetchInterval: 30000 }
  );

  // Poll scanner status
  const { data: scannerStatus } = trpc.td.scannerStatus.useQuery(undefined, {
    refetchInterval: 60000,
  });

  // Process new alerts and show notifications
  useEffect(() => {
    if (!recentAlerts || recentAlerts.length === 0) return;

    const newAlerts = recentAlerts.filter(
      (a: any) => !seenRef.current.has(a.id)
    );

    if (newAlerts.length === 0) return;

    // Find highest severity
    let maxSeverity: "info" | "warning" | "critical" = "info";
    for (const alert of newAlerts) {
      if ((alert as any).severity === "critical") maxSeverity = "critical";
      else if ((alert as any).severity === "warning" && maxSeverity !== "critical") maxSeverity = "warning";
    }

    // Play sound for new alerts
    playAbboudAlertSound(maxSeverity);

    // Show browser notifications
    for (const alert of newAlerts) {
      const a = alert as any;
      showAbboudNotification({
        id: a.id,
        symbol: a.symbol,
        exchange: a.exchange,
        alertType: a.alertType,
        price: parseFloat(a.price),
        triggerLevel: parseFloat(a.triggerLevel),
        direction: a.direction,
        message: a.message,
        severity: a.severity,
      });
      seenRef.current.add(a.id);
      addSeenAbboudAlert(a.id);
    }
  }, [recentAlerts]);

  // Trigger manual scan
  const triggerScanMutation = trpc.td.triggerScan.useMutation();

  const triggerManualScan = useCallback(async () => {
    return triggerScanMutation.mutateAsync();
  }, [triggerScanMutation]);

  return {
    recentAlerts: recentAlerts || [],
    scannerStatus,
    triggerManualScan,
    isScanTriggering: triggerScanMutation.isPending,
  };
}
