/**
 * Volume Spike Monitor Engine
 * 
 * Polls DFM stocks during UAE trading hours (Mon-Fri 10:00-15:00 GST/UTC+4)
 * Detects unusual volume spikes and creates in-app notifications.
 * 
 * Architecture:
 * - Runs a setInterval loop every 60 seconds
 * - Only active during trading hours
 * - Compares current volume to average volume
 * - Triggers alerts when volume exceeds threshold (default 2x)
 * - Creates in-app notifications for users who have them enabled
 * - Stores alerts in database for history
 * 
 * NOTE: Email notifications are completely disabled system-wide.
 */

import { DFM_STOCKS, ALL_STOCKS, StockInfo } from "../shared/stockData";
import { fetchBatchQuotes } from "./stockService";
import { getDb, getNotificationPreferences } from "./db";
import { users, volumeAlerts, monitorSettings, notifications as notificationsTable, InsertNotification } from "../drizzle/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { isHoliday } from "../shared/uaeHolidays";

// In-memory state
let monitorInterval: ReturnType<typeof setInterval> | null = null;
let isMonitoring = false;
let lastPollTime: Date | null = null;
let lastAlerts: VolumeAlertData[] = [];
let pollCount = 0;
let errorCount = 0;

// Track previous volumes to detect intra-day spikes
const previousVolumes = new Map<string, number>();

export interface VolumeAlertData {
  symbol: string;
  exchange: string;
  stockName: string;
  sector: string;
  currentVolume: number;
  avgVolume: number;
  volumeMultiplier: number;
  price: number | null;
  changePercent: number | null;
  severity: "low" | "medium" | "high" | "critical";
  detectedAt: Date;
}

/**
 * Check if current time is within UAE trading hours
 * UAE/GST = UTC+4
 * Trading hours: Mon-Fri 9:30-15:00 GST
 * Pre-Open: 9:00-9:30, Open: 9:30-14:50, Pre-Close: 14:50-15:00
 */
export function isUAETradingHours(): boolean {
  const now = new Date();
  // Convert to UAE time (UTC+4)
  const uaeTime = new Date(now.getTime() + (4 * 60 * 60 * 1000));
  const uaeHour = uaeTime.getUTCHours();
  const uaeMinute = uaeTime.getUTCMinutes();
  const uaeDay = uaeTime.getUTCDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat

  // UAE markets: Mon-Fri, 9:30 - 15:00
  // Weekend: Saturday (6) & Sunday (0)
  if (uaeDay === 0 || uaeDay === 6) return false; // Weekend: Sat & Sun
  // Check for UAE public holidays
  if (isHoliday(now)) return false;
  const timeInMinutes = uaeHour * 60 + uaeMinute;
  // Active from 9:30 (570) to 15:00 (900)
  if (timeInMinutes < 570 || timeInMinutes >= 900) return false;
  return true;
}

/**
 * Get the next trading session start time
 */
export function getNextTradingSession(): Date {
  const now = new Date();
  const uaeOffset = 4 * 60 * 60 * 1000;
  const uaeNow = new Date(now.getTime() + uaeOffset);
  
  let targetDate = new Date(uaeNow);
  targetDate.setUTCHours(9, 30, 0, 0); // Market opens at 9:30
  
  // If it's past 3pm today or weekend, move to next trading day
  if (uaeNow.getUTCHours() >= 15 || uaeNow.getUTCDay() === 0 || uaeNow.getUTCDay() === 6) {
    targetDate.setUTCDate(targetDate.getUTCDate() + 1);
  }
  
  // Skip weekends (Saturday=6, Sunday=0)
  while (targetDate.getUTCDay() === 0 || targetDate.getUTCDay() === 6) {
    targetDate.setUTCDate(targetDate.getUTCDate() + 1);
  }
  
  // Convert back from UAE time to UTC
  return new Date(targetDate.getTime() - uaeOffset);
}

/**
 * Determine alert severity based on volume multiplier
 */
function getSeverity(multiplier: number): "low" | "medium" | "high" | "critical" {
  if (multiplier >= 5) return "critical";
  if (multiplier >= 3) return "high";
  if (multiplier >= 2) return "medium";
  return "low";
}

/**
 * Format large numbers for display
 */
function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}

/**
 * Core polling function - fetches quotes and detects volume spikes
 */
async function pollForVolumeSpikes(threshold = 2.0, minVolume = 100000): Promise<VolumeAlertData[]> {
  const alerts: VolumeAlertData[] = [];
  
  try {
    // Fetch batch quotes for all DFM stocks (they have Yahoo Finance data)
    const dfmSymbols = DFM_STOCKS.map(s => s.yahooSymbol);
    const quotes = await fetchBatchQuotes(dfmSymbols);
    
    for (const stock of DFM_STOCKS) {
      const quote = quotes.get(stock.yahooSymbol);
      if (!quote) continue;
      
      const currentVolume = quote.regularMarketVolume;
      const avgVolume = quote.averageDailyVolume3Month;
      
      if (!currentVolume || !avgVolume || avgVolume === 0) continue;
      if (currentVolume < minVolume) continue;
      
      const multiplier = currentVolume / avgVolume;
      
      // Check if volume exceeds threshold
      if (multiplier >= threshold) {
        // Also check for intra-day spike (volume jumped significantly since last poll)
        const prevVol = previousVolumes.get(stock.symbol) || 0;
        const volumeJump = prevVol > 0 ? (currentVolume - prevVol) / prevVol : 1;
        
        const alert: VolumeAlertData = {
          symbol: stock.symbol,
          exchange: stock.exchange,
          stockName: stock.name,
          sector: stock.sector,
          currentVolume,
          avgVolume,
          volumeMultiplier: Math.round(multiplier * 100) / 100,
          price: quote.regularMarketPrice ?? null,
          changePercent: quote.regularMarketChangePercent ?? null,
          severity: getSeverity(multiplier),
          detectedAt: new Date(),
        };
        
        alerts.push(alert);
      }
      
      // Update previous volume tracking
      previousVolumes.set(stock.symbol, currentVolume);
    }
    
    pollCount++;
    lastPollTime = new Date();
    
    if (alerts.length > 0) {
      lastAlerts = alerts;
      // Save alerts to database
      await saveAlerts(alerts);
      // Email notifications are completely disabled system-wide.
      // Only in-app notifications are created for users who have them enabled.
      for (const alert of alerts) {
        const sevMap: Record<string, "info" | "warning" | "critical"> = {
          low: "info", medium: "info", high: "warning", critical: "critical",
        };
        await createInAppNotificationsRespectingPreferences({
          type: "volume_spike",
          title: `Volume Spike: ${alert.stockName} (${alert.volumeMultiplier}x)`,
          message: `${alert.stockName} (${alert.symbol}) volume is ${alert.volumeMultiplier}x the average at ${formatVolume(alert.currentVolume)}. Price: ${alert.price?.toFixed(2) ?? "N/A"} AED (${alert.changePercent != null ? (alert.changePercent >= 0 ? "+" : "") + alert.changePercent.toFixed(2) + "%" : "N/A"}).`,
          symbol: alert.symbol,
          exchange: alert.exchange,
          severity: sevMap[alert.severity] || "info",
          metadata: JSON.stringify({ volumeMultiplier: alert.volumeMultiplier, currentVolume: alert.currentVolume, avgVolume: alert.avgVolume, sector: alert.sector }),
        });
      }
    }
    
    return alerts;
  } catch (e) {
    errorCount++;
    console.error("[VolumeMonitor] Poll error:", e);
    return [];
  }
}

/**
 * Save alerts to database
 */
async function saveAlerts(alerts: VolumeAlertData[]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  for (const alert of alerts) {
    try {
      // Check if we already have a recent alert for this stock (within 30 min)
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      const existing = await db.select()
        .from(volumeAlerts)
        .where(and(
          eq(volumeAlerts.symbol, alert.symbol),
          gte(volumeAlerts.detectedAt, thirtyMinAgo)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing alert if multiplier is higher
        if (alert.volumeMultiplier > (existing[0].volumeMultiplier || 0)) {
          await db.update(volumeAlerts)
            .set({
              currentVolume: alert.currentVolume,
              volumeMultiplier: alert.volumeMultiplier,
              price: alert.price,
              changePercent: alert.changePercent,
              severity: alert.severity,
            })
            .where(eq(volumeAlerts.id, existing[0].id));
        }
        continue;
      }
      
      await db.insert(volumeAlerts).values({
        symbol: alert.symbol,
        exchange: alert.exchange,
        stockName: alert.stockName,
        sector: alert.sector,
        currentVolume: alert.currentVolume,
        avgVolume: alert.avgVolume,
        volumeMultiplier: alert.volumeMultiplier,
        price: alert.price,
        changePercent: alert.changePercent,
        alertType: "volume_spike",
        severity: alert.severity,
        notified: 0,
        dismissed: 0,
      });
    } catch (e) {
      console.warn(`[VolumeMonitor] Failed to save alert for ${alert.symbol}:`, e);
    }
  }
}

// NOTE: sendVolumeNotification and sendEmailNotifications have been removed.
// Email notifications are completely disabled system-wide (Phase 19).

/**
 * Check if current time is within a user's quiet hours (UAE timezone, UTC+4).
 */
function isInQuietHours(prefs: { quietHoursEnabled: number; quietHoursStart: string; quietHoursEnd: string } | null): boolean {
  if (!prefs || !prefs.quietHoursEnabled) return false;
  const now = new Date();
  // UAE is UTC+4
  const uaeHour = (now.getUTCHours() + 4) % 24;
  const uaeMin = now.getUTCMinutes();
  const currentMinutes = uaeHour * 60 + uaeMin;

  const [startH, startM] = prefs.quietHoursStart.split(":").map(Number);
  const [endH, endM] = prefs.quietHoursEnd.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    // Same day range (e.g., 09:00 - 17:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight range (e.g., 22:00 - 07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

/**
 * Create in-app notifications with deduplication and quiet hours.
 * - Dedup: Skip if a notification for the same symbol exists within 30 min for that user
 * - Quiet hours: Skip if user has quiet hours enabled and current time is within range
 * - Preferences: Only create for users with inAppEnabled=1
 */
type InAppNotificationData = Omit<InsertNotification, "userId">;

const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

async function createInAppNotificationsRespectingPreferences(data: InAppNotificationData): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const allUsers = await db.select({ id: users.id }).from(users);
    if (allUsers.length === 0) return;

    const eligibleUserIds: number[] = [];
    let skippedQuietHours = 0;
    let skippedDedup = 0;
    let skippedDisabled = 0;

    for (const user of allUsers) {
      const prefs = await getNotificationPreferences(user.id);

      // 1. Check if in-app notifications are enabled
      if (prefs && prefs.inAppEnabled !== 1) {
        skippedDisabled++;
        continue;
      }

      // 1b. Check if this alert type is enabled for the user
      const alertTypes = ((prefs as any)?.alertTypes || "volume_spike,price_alert,earnings,dividend,news").split(",");
      const notifType = data.type || "volume_spike";
      if (!alertTypes.includes(notifType)) {
        skippedDisabled++;
        continue;
      }

      // 2. Check quiet hours
      if (isInQuietHours(prefs)) {
        skippedQuietHours++;
        continue;
      }

      // 3. Deduplication: check if a notification for the same symbol exists within the dedup window
      if (data.symbol) {
        const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_MS);
        const existing = await db.select({ id: notificationsTable.id })
          .from(notificationsTable)
          .where(and(
            eq(notificationsTable.userId, user.id),
            eq(notificationsTable.symbol, data.symbol),
            eq(notificationsTable.type, data.type || "volume_spike"),
            gte(notificationsTable.createdAt, dedupCutoff)
          ))
          .limit(1);

        if (existing.length > 0) {
          skippedDedup++;
          continue;
        }
      }

      eligibleUserIds.push(user.id);
    }

    if (eligibleUserIds.length === 0) {
      console.log(`[VolumeMonitor] No eligible users (disabled: ${skippedDisabled}, quiet: ${skippedQuietHours}, dedup: ${skippedDedup})`);
      return;
    }

    const values = eligibleUserIds.map(userId => ({ ...data, userId }));
    await db.insert(notificationsTable).values(values);
    console.log(`[VolumeMonitor] Notifications created for ${eligibleUserIds.length}/${allUsers.length} users (skipped: disabled=${skippedDisabled}, quiet=${skippedQuietHours}, dedup=${skippedDedup})`);
  } catch (e) {
    console.warn("[VolumeMonitor] Failed to create in-app notifications:", e);
  }
}

/**
 * Start the volume monitor
 */
export function startVolumeMonitor(): void {
  if (monitorInterval) {
    console.log("[VolumeMonitor] Already running");
    return;
  }
  
  isMonitoring = true;
  console.log("[VolumeMonitor] Starting volume spike monitor...");
  console.log(`[VolumeMonitor] UAE trading hours: Mon-Fri 9:30-15:00 GST (UTC+4)`);
  
  // Poll every 60 seconds
  monitorInterval = setInterval(async () => {
    if (!isUAETradingHours()) {
      // Log once when market closes
      if (isMonitoring) {
        const next = getNextTradingSession();
        console.log(`[VolumeMonitor] Market closed. Next session: ${next.toISOString()}`);
        isMonitoring = false;
        // Clear previous volumes at market close
        previousVolumes.clear();
      }
      return;
    }
    
    if (!isMonitoring) {
      console.log("[VolumeMonitor] Market open! Starting to poll...");
      isMonitoring = true;
    }
    
    const alerts = await pollForVolumeSpikes();
    if (alerts.length > 0) {
      console.log(`[VolumeMonitor] Detected ${alerts.length} volume spikes:`, 
        alerts.map(a => `${a.symbol} (${a.volumeMultiplier}x)`).join(", "));
    }
  }, 60_000); // Every 60 seconds
  
  // Also do an immediate poll if during trading hours
  if (isUAETradingHours()) {
    pollForVolumeSpikes().then(alerts => {
      if (alerts.length > 0) {
        console.log(`[VolumeMonitor] Initial scan: ${alerts.length} volume spikes detected`);
      } else {
        console.log("[VolumeMonitor] Initial scan: No volume spikes detected");
      }
    });
  } else {
    const next = getNextTradingSession();
    console.log(`[VolumeMonitor] Market currently closed. Next session: ${next.toISOString()}`);
  }
}

/**
 * Stop the volume monitor
 */
export function stopVolumeMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  isMonitoring = false;
  console.log("[VolumeMonitor] Stopped");
}

/**
 * Get monitor status
 */
export function getMonitorStatus() {
  return {
    isRunning: monitorInterval !== null,
    isTrading: isUAETradingHours(),
    lastPollTime,
    pollCount,
    errorCount,
    lastAlerts,
    nextSession: isUAETradingHours() ? null : getNextTradingSession(),
    trackedStocks: DFM_STOCKS.length,
  };
}

/**
 * Get recent alerts from database
 */
export async function getRecentAlerts(limit = 50): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(volumeAlerts)
    .orderBy(desc(volumeAlerts.detectedAt))
    .limit(limit);
}

/**
 * Get alerts for today
 */
export async function getTodayAlerts(): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Start of today in UAE time
  const now = new Date();
  const uaeNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  uaeNow.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date(uaeNow.getTime() - 4 * 60 * 60 * 1000);
  
  return db.select()
    .from(volumeAlerts)
    .where(gte(volumeAlerts.detectedAt, todayStart))
    .orderBy(desc(volumeAlerts.detectedAt));
}

/**
 * Dismiss an alert
 */
export async function dismissAlert(alertId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(volumeAlerts)
    .set({ dismissed: 1 })
    .where(eq(volumeAlerts.id, alertId));
}

/**
 * Force a manual poll (for testing or on-demand scanning)
 */
export async function manualPoll(threshold?: number, minVolume?: number): Promise<VolumeAlertData[]> {
  return pollForVolumeSpikes(threshold || 2.0, minVolume || 100000);
}
