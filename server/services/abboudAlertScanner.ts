/**
 * Abboud AI Alert Scanner
 * 
 * Scans all stocks during market hours to detect when prices enter
 * Abboud AI entry zones or hit target levels. Creates notifications
 * for all users when significant events are detected.
 * 
 * Runs every 5 minutes during UAE trading hours (10:00-15:00 Mon-Fri).
 * Uses a cache to avoid duplicate alerts for the same stock/event within 24h.
 */

import { fetchChartData } from "./tdDataService";
import { computeAbboudIndicator, AbboudIndicatorResult } from "./abboudIndicator";
import { ALL_STOCKS } from "../../shared/stockData";
import { isUAETradingHours } from "../volumeMonitor";
import { isTwelveDataAvailable } from "./tdSymbolMapper";

// Filter stocks to only those available in TwelveData (avoids wasted API calls)
const SCANNABLE_STOCKS = ALL_STOCKS.filter(s => 
  isTwelveDataAvailable(s.symbol, s.exchange as "ADX" | "DFM")
);

// Lazy imports for DB operations
let dbModule: typeof import("../db") | null = null;
async function getDbModule() {
  if (!dbModule) {
    dbModule = await import("../db");
  }
  return dbModule;
}

// Cache to prevent duplicate alerts (key: symbol:alertType, value: timestamp)
const alertCache = new Map<string, number>();
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// Scanner state
let scannerInterval: ReturnType<typeof setInterval> | null = null;
let isScanning = false;
let lastScanTime: Date | null = null;
let lastScanResults: AbboudAlertResult[] = [];

export interface AbboudAlertResult {
  symbol: string;
  exchange: string;
  alertType: "entry_zone" | "stop_loss" | "target_1" | "target_2" | "target_3" | "fib_bounce";
  price: number;
  triggerLevel: number;
  direction: "bullish" | "bearish";
  message: string;
  severity: "info" | "warning" | "critical";
}

/**
 * Check a single stock for Abboud AI alert conditions
 */
async function checkStockForAlerts(
  symbol: string,
  exchange: "ADX" | "DFM"
): Promise<AbboudAlertResult[]> {
  const alerts: AbboudAlertResult[] = [];

  try {
    // Fetch daily OHLC data (200 days for reliable Fibonacci calculation)
    const candles = await fetchChartData(symbol, exchange, "1day", 200);
    if (!candles || candles.length < 30) return alerts;

    const ohlcData = candles.map((c: any) => ({
      date: c.datetime,
      open: typeof c.open === "number" ? c.open : parseFloat(c.open),
      high: typeof c.high === "number" ? c.high : parseFloat(c.high),
      low: typeof c.low === "number" ? c.low : parseFloat(c.low),
      close: typeof c.close === "number" ? c.close : parseFloat(c.close),
      volume: typeof c.volume === "number" ? c.volume : parseInt(c.volume, 10),
    }));

    const result = computeAbboudIndicator(ohlcData);
    if (!result) return alerts;

    const { signal, currentPrice, trendDirection } = result;
    const direction = trendDirection === "downtrend" ? "bearish" : "bullish";

    // Check if price is in entry zone
    if (signal.entryZone) {
      const { low, high } = signal.entryZone;
      if (currentPrice >= low && currentPrice <= high) {
        const cacheKey = `${symbol}:entry_zone`;
        if (!isAlertCached(cacheKey)) {
          alerts.push({
            symbol,
            exchange,
            alertType: "entry_zone",
            price: currentPrice,
            triggerLevel: (low + high) / 2,
            direction,
            message: `${symbol} (${exchange}) is in the Abboud AI entry zone (${low.toFixed(3)} - ${high.toFixed(3)}). Current price: ${currentPrice.toFixed(3)}. Signal: ${signal.action} (${signal.confidence}% confidence)`,
            severity: signal.confidence >= 70 ? "critical" : "warning",
          });
          cacheAlert(cacheKey);
        }
      }
    }

    // Check if price hit stop loss
    if (signal.stopLoss) {
      const stopDist = Math.abs(currentPrice - signal.stopLoss) / signal.stopLoss;
      if (stopDist < 0.01) { // Within 1% of stop loss
        const cacheKey = `${symbol}:stop_loss`;
        if (!isAlertCached(cacheKey)) {
          alerts.push({
            symbol,
            exchange,
            alertType: "stop_loss",
            price: currentPrice,
            triggerLevel: signal.stopLoss,
            direction,
            message: `⚠️ ${symbol} (${exchange}) is near the Abboud AI stop loss at ${signal.stopLoss.toFixed(3)}. Current price: ${currentPrice.toFixed(3)}`,
            severity: "critical",
          });
          cacheAlert(cacheKey);
        }
      }
    }

    // Check if price hit any targets
    for (let i = 0; i < signal.targets.length && i < 3; i++) {
      const target = signal.targets[i];
      const targetDist = Math.abs(currentPrice - target.price) / target.price;
      if (targetDist < 0.015) { // Within 1.5% of target
        const alertType = `target_${i + 1}` as "target_1" | "target_2" | "target_3";
        const cacheKey = `${symbol}:${alertType}`;
        if (!isAlertCached(cacheKey)) {
          alerts.push({
            symbol,
            exchange,
            alertType,
            price: currentPrice,
            triggerLevel: target.price,
            direction,
            message: `🎯 ${symbol} (${exchange}) hit Abboud AI ${target.level} at ${target.price.toFixed(3)}. Current price: ${currentPrice.toFixed(3)}`,
            severity: i === 0 ? "warning" : "info",
          });
          cacheAlert(cacheKey);
        }
      }
    }

    // Check for Fibonacci level bounces (price near a key Fib level)
    for (const fib of result.fibLevels) {
      if (fib.type === "extension") continue; // Skip extensions
      const fibDist = Math.abs(currentPrice - fib.price) / fib.price;
      if (fibDist < 0.008) { // Within 0.8% of Fib level
        const cacheKey = `${symbol}:fib_${fib.label}`;
        if (!isAlertCached(cacheKey)) {
          alerts.push({
            symbol,
            exchange,
            alertType: "fib_bounce",
            price: currentPrice,
            triggerLevel: fib.price,
            direction,
            message: `${symbol} (${exchange}) is testing the ${fib.label} Fibonacci level at ${fib.price.toFixed(3)}. Current price: ${currentPrice.toFixed(3)}`,
            severity: "info",
          });
          cacheAlert(cacheKey);
        }
      }
    }
  } catch (err) {
    // Silently skip stocks that fail (API errors, etc.)
    console.warn(`[AbboudScanner] Error checking ${symbol}:`, (err as Error).message);
  }

  return alerts;
}

function isAlertCached(key: string): boolean {
  const cached = alertCache.get(key);
  if (!cached) return false;
  if (Date.now() - cached > ALERT_COOLDOWN_MS) {
    alertCache.delete(key);
    return false;
  }
  return true;
}

function cacheAlert(key: string): void {
  alertCache.set(key, Date.now());
}

/**
 * Scan all stocks for Abboud AI alerts
 * Processes stocks in batches to respect API rate limits
 */
async function scanAllStocks(): Promise<AbboudAlertResult[]> {
  const allAlerts: AbboudAlertResult[] = [];
  const BATCH_SIZE = 3; // Process 3 stocks at a time
  const BATCH_DELAY = 2000; // 2 seconds between batches

  console.log(`[AbboudScanner] Starting scan of ${SCANNABLE_STOCKS.length} stocks (${ALL_STOCKS.length - SCANNABLE_STOCKS.length} skipped - not in TwelveData)...`);

  for (let i = 0; i < SCANNABLE_STOCKS.length; i += BATCH_SIZE) {
    const batch = SCANNABLE_STOCKS.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(stock => checkStockForAlerts(stock.symbol, stock.exchange as "ADX" | "DFM"))
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value.length > 0) {
        allAlerts.push(...result.value);
      }
    }

    // Rate limit delay between batches
    if (i + BATCH_SIZE < SCANNABLE_STOCKS.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  return allAlerts;
}

/**
 * Process detected alerts: save to DB and create notifications
 */
async function processAlerts(alerts: AbboudAlertResult[]): Promise<void> {
  if (alerts.length === 0) return;

  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return;

    const { abboudAlerts } = await import("../../drizzle/schema");
    const { createNotificationsForAllUsers } = await getDbModule();

    // Save alerts to the abboud_alerts table
    for (const alert of alerts) {
      try {
        await db.insert(abboudAlerts).values({
          symbol: alert.symbol,
          exchange: alert.exchange,
          alertType: alert.alertType,
          price: alert.price,
          triggerLevel: alert.triggerLevel,
          direction: alert.direction,
          message: alert.message,
          severity: alert.severity,
        });
      } catch (e) {
        console.warn(`[AbboudScanner] Failed to save alert for ${alert.symbol}:`, (e as Error).message);
      }
    }

    // Create in-app notifications for all users
    for (const alert of alerts) {
      const title = alert.alertType === "entry_zone"
        ? `📊 ${alert.symbol} in Entry Zone`
        : alert.alertType === "stop_loss"
        ? `⚠️ ${alert.symbol} Near Stop Loss`
        : alert.alertType.startsWith("target_")
        ? `🎯 ${alert.symbol} Hit Target`
        : `📈 ${alert.symbol} Fib Level Test`;

      await createNotificationsForAllUsers({
        type: "abboud_alert",
        title,
        message: alert.message,
        symbol: alert.symbol,
        exchange: alert.exchange,
        severity: alert.severity,
        metadata: JSON.stringify({
          alertType: alert.alertType,
          price: alert.price,
          triggerLevel: alert.triggerLevel,
          direction: alert.direction,
        }),
      });
    }

    console.log(`[AbboudScanner] Created ${alerts.length} alerts and notifications`);
  } catch (err) {
    console.error("[AbboudScanner] Error processing alerts:", err);
  }
}

/**
 * Run a single scan cycle
 */
async function runScan(): Promise<void> {
  if (isScanning) {
    console.log("[AbboudScanner] Scan already in progress, skipping...");
    return;
  }

  if (!isUAETradingHours()) {
    return;
  }

  isScanning = true;
  const startTime = Date.now();

  try {
    const alerts = await scanAllStocks();
    lastScanResults = alerts;
    lastScanTime = new Date();

    if (alerts.length > 0) {
      await processAlerts(alerts);
      console.log(`[AbboudScanner] Scan complete: ${alerts.length} alerts detected in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    } else {
      console.log(`[AbboudScanner] Scan complete: No alerts in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    }
  } catch (err) {
    console.error("[AbboudScanner] Scan failed:", err);
  } finally {
    isScanning = false;
  }
}

/**
 * Start the Abboud AI alert scanner
 * Runs every 5 minutes during market hours
 */
export function startAbboudScanner(): void {
  if (scannerInterval) {
    console.log("[AbboudScanner] Already running");
    return;
  }

  console.log("[AbboudScanner] Starting Abboud AI alert scanner (every 5 min during market hours)");

  // Run every 5 minutes
  scannerInterval = setInterval(() => {
    runScan();
  }, 5 * 60 * 1000);

  // Do an initial scan if during trading hours
  if (isUAETradingHours()) {
    // Delay initial scan by 30 seconds to let the server fully start
    setTimeout(() => runScan(), 30_000);
  }
}

/**
 * Stop the scanner
 */
export function stopAbboudScanner(): void {
  if (scannerInterval) {
    clearInterval(scannerInterval);
    scannerInterval = null;
  }
  isScanning = false;
  console.log("[AbboudScanner] Stopped");
}

/**
 * Get scanner status
 */
export function getAbboudScannerStatus() {
  return {
    running: scannerInterval !== null,
    scanning: isScanning,
    lastScanTime: lastScanTime?.toISOString() ?? null,
    lastAlertCount: lastScanResults.length,
    cacheSize: alertCache.size,
  };
}

/**
 * Manually trigger a scan (for testing or on-demand)
 */
export async function manualAbboudScan(): Promise<AbboudAlertResult[]> {
  if (isScanning) return lastScanResults;
  
  isScanning = true;
  try {
    const alerts = await scanAllStocks();
    lastScanResults = alerts;
    lastScanTime = new Date();
    if (alerts.length > 0) {
      await processAlerts(alerts);
    }
    return alerts;
  } finally {
    isScanning = false;
  }
}
