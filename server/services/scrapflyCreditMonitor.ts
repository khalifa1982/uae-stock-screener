/**
 * Scrapfly Credit Monitor
 * 
 * Periodically checks Scrapfly account credits and sends admin notifications
 * when credits drop below configurable thresholds.
 * 
 * Thresholds:
 * - WARNING: < 1000 credits remaining
 * - CRITICAL: < 250 credits remaining
 * 
 * Check interval: Every 6 hours (4x/day)
 */

import { ENV } from "../_core/env";
import { notifyOwner } from "../_core/notification";

// ─── Configuration ────────────────────────────────────────────────

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const WARNING_THRESHOLD = 1000;
const CRITICAL_THRESHOLD = 250;

// Prevent duplicate alerts within a cooldown period
const ALERT_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours

// ─── State ────────────────────────────────────────────────────────

interface CreditMonitorState {
  running: boolean;
  lastCheck: string | null;
  lastAlertSent: string | null;
  lastAlertLevel: "warning" | "critical" | null;
  currentCredits: number | null;
  totalCredits: number | null;
  usedCredits: number | null;
  checkCount: number;
  alertsSent: number;
  errors: number;
  lastError: string | null;
}

let state: CreditMonitorState = {
  running: false,
  lastCheck: null,
  lastAlertSent: null,
  lastAlertLevel: null,
  currentCredits: null,
  totalCredits: null,
  usedCredits: null,
  checkCount: 0,
  alertsSent: 0,
  errors: 0,
  lastError: null,
};

let monitorInterval: ReturnType<typeof setInterval> | null = null;

// ─── Core Logic ───────────────────────────────────────────────────

/**
 * Fetch current Scrapfly account credit info
 */
async function fetchCreditInfo(): Promise<{
  remaining: number;
  total: number;
  used: number;
} | null> {
  const apiKey = ENV.scrapflyApiKey;
  if (!apiKey) return null;

  try {
    const res = await fetch(`https://api.scrapfly.io/account?key=${apiKey}`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const usage = data?.subscription?.usage?.scrape;

    if (!usage) {
      throw new Error("Unexpected API response structure");
    }

    return {
      remaining: usage.remaining ?? 0,
      total: usage.allowed ?? 0,
      used: usage.used ?? 0,
    };
  } catch (e: any) {
    state.errors++;
    state.lastError = e.message || "Unknown error";
    console.error("[ScrapflyCreditMonitor] Failed to fetch credit info:", e.message);
    return null;
  }
}

/**
 * Check credits and send alert if below threshold
 */
async function checkCredits(): Promise<void> {
  state.checkCount++;
  state.lastCheck = new Date().toISOString();

  const info = await fetchCreditInfo();
  if (!info) return;

  state.currentCredits = info.remaining;
  state.totalCredits = info.total;
  state.usedCredits = info.used;

  const usagePercent = info.total > 0
    ? ((info.used / info.total) * 100).toFixed(1)
    : "N/A";

  console.log(
    `[ScrapflyCreditMonitor] Credits: ${info.remaining}/${info.total} remaining (${usagePercent}% used)`
  );

  // Determine alert level
  let alertLevel: "warning" | "critical" | null = null;
  if (info.remaining < CRITICAL_THRESHOLD) {
    alertLevel = "critical";
  } else if (info.remaining < WARNING_THRESHOLD) {
    alertLevel = "warning";
  }

  if (!alertLevel) return;

  // Check cooldown: don't re-alert at the same level within cooldown
  if (
    state.lastAlertSent &&
    state.lastAlertLevel === alertLevel &&
    Date.now() - new Date(state.lastAlertSent).getTime() < ALERT_COOLDOWN_MS
  ) {
    console.log(
      `[ScrapflyCreditMonitor] ${alertLevel} alert suppressed (cooldown active, last sent ${state.lastAlertSent})`
    );
    return;
  }

  // Send notification
  const emoji = alertLevel === "critical" ? "🚨" : "⚠️";
  const title = `${emoji} Scrapfly Credits ${alertLevel === "critical" ? "CRITICAL" : "Low"}: ${info.remaining} remaining`;
  const content = [
    `**Scrapfly.io API Credit Alert**`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Remaining Credits | **${info.remaining.toLocaleString()}** |`,
    `| Total Credits | ${info.total.toLocaleString()} |`,
    `| Used Credits | ${info.used.toLocaleString()} |`,
    `| Usage | ${usagePercent}% |`,
    `| Alert Level | ${alertLevel.toUpperCase()} |`,
    `| Threshold | ${alertLevel === "critical" ? CRITICAL_THRESHOLD : WARNING_THRESHOLD} |`,
    ``,
    alertLevel === "critical"
      ? `**Action Required:** Credits are critically low. Scraping services (StockAnalysis, MarketScreener, Investing.com) will stop working when credits reach 0. Please top up your Scrapfly account immediately at https://scrapfly.io/dashboard`
      : `**Note:** Credits are running low. Consider monitoring usage or topping up at https://scrapfly.io/dashboard`,
    ``,
    `_Checked at ${new Date().toISOString()}_`,
  ].join("\n");

  try {
    const sent = await notifyOwner({ title, content });
    if (sent) {
      state.lastAlertSent = new Date().toISOString();
      state.lastAlertLevel = alertLevel;
      state.alertsSent++;
      console.log(`[ScrapflyCreditMonitor] ${alertLevel} alert sent successfully`);
    } else {
      console.warn("[ScrapflyCreditMonitor] Notification service returned false");
    }
  } catch (e: any) {
    console.error("[ScrapflyCreditMonitor] Failed to send alert:", e.message);
    state.errors++;
    state.lastError = `Alert send failed: ${e.message}`;
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────

/**
 * Start the credit monitor background service
 */
export function startCreditMonitor(): void {
  if (monitorInterval) {
    console.log("[ScrapflyCreditMonitor] Already running");
    return;
  }

  if (!ENV.scrapflyApiKey) {
    console.log("[ScrapflyCreditMonitor] No Scrapfly API key configured, skipping");
    return;
  }

  state.running = true;
  console.log(
    `[ScrapflyCreditMonitor] Started (check every ${CHECK_INTERVAL_MS / 3600000}h, warn < ${WARNING_THRESHOLD}, critical < ${CRITICAL_THRESHOLD})`
  );

  // Run first check after 30 seconds (let server finish startup)
  setTimeout(() => {
    checkCredits().catch(console.error);
  }, 30000);

  // Schedule periodic checks
  monitorInterval = setInterval(() => {
    checkCredits().catch(console.error);
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the credit monitor
 */
export function stopCreditMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  state.running = false;
  console.log("[ScrapflyCreditMonitor] Stopped");
}

/**
 * Get current monitor state
 */
export function getCreditMonitorStatus(): CreditMonitorState {
  return { ...state };
}

/**
 * Force an immediate credit check (for admin panel)
 */
export async function forceCheckCredits(): Promise<CreditMonitorState> {
  await checkCredits();
  return { ...state };
}
