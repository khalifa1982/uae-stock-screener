import { eq, and, sql, desc, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, stockSnapshots, InsertStockSnapshot, watchlists, volumeAlerts, monitorSettings, screenerPresets, notifications, InsertNotification, notificationPreferences, InsertNotificationPreference } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.passwordHash !== undefined) {
      values.passwordHash = user.passwordHash;
      updateSet.passwordHash = user.passwordHash;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Profile update operations
export async function updateUserProfile(
  openId: string,
  data: { name?: string; mobileNumber?: string | null; avatarEmoji?: string | null }
) {
  const db = await getDb();
  if (!db) return undefined;
  const updateSet: Record<string, unknown> = {};
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.mobileNumber !== undefined) updateSet.mobileNumber = data.mobileNumber;
  if (data.avatarEmoji !== undefined) updateSet.avatarEmoji = data.avatarEmoji;
  if (Object.keys(updateSet).length === 0) return undefined;
  await db.update(users).set(updateSet).where(eq(users.openId, openId));
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Stock snapshot operations
export async function upsertStockSnapshot(data: InsertStockSnapshot): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(stockSnapshots).values(data).onDuplicateKeyUpdate({
      set: {
        price: sql`VALUES(price)`,
        previousClose: sql`VALUES(previousClose)`,
        open: sql`VALUES(\`open\`)`,
        dayHigh: sql`VALUES(dayHigh)`,
        dayLow: sql`VALUES(dayLow)`,
        volume: sql`VALUES(volume)`,
        avgVolume: sql`VALUES(avgVolume)`,
        marketCap: sql`VALUES(marketCap)`,
        pe: sql`VALUES(pe)`,
        eps: sql`VALUES(eps)`,
        week52High: sql`VALUES(week52High)`,
        week52Low: sql`VALUES(week52Low)`,
        dividendYield: sql`VALUES(dividendYield)`,
        beta: sql`VALUES(beta)`,
        changePercent: sql`VALUES(changePercent)`,
        rsi: sql`VALUES(rsi)`,
        sma20: sql`VALUES(sma20)`,
        sma50: sql`VALUES(sma50)`,
        ema12: sql`VALUES(ema12)`,
        ema26: sql`VALUES(ema26)`,
        volumeRatio: sql`VALUES(volumeRatio)`,
        updatedAt: new Date(),
      },
    });
  } catch (e) {
    console.warn(`[Database] Failed to upsert snapshot for ${data.symbol}:`, e);
  }
}

export async function getStockSnapshot(symbol: string, exchange: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stockSnapshots)
    .where(and(eq(stockSnapshots.symbol, symbol), eq(stockSnapshots.exchange, exchange)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllStockSnapshots(exchange?: string) {
  const db = await getDb();
  if (!db) return [];
  if (exchange) {
    return db.select().from(stockSnapshots).where(eq(stockSnapshots.exchange, exchange));
  }
  return db.select().from(stockSnapshots);
}

// Watchlist operations
export async function addToWatchlist(userId: number, symbol: string, exchange: string) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(watchlists).values({ userId, symbol, exchange }).onDuplicateKeyUpdate({
      set: { exchange: sql`VALUES(exchange)` },
    });
  } catch (e) {
    console.warn("[Database] Failed to add to watchlist:", e);
  }
}

export async function removeFromWatchlist(userId: number, symbol: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(watchlists).where(and(eq(watchlists.userId, userId), eq(watchlists.symbol, symbol)));
}

export async function getUserWatchlist(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(watchlists).where(eq(watchlists.userId, userId));
}

// Monitor settings operations
export async function getMonitorSettingsForUser(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(monitorSettings).where(eq(monitorSettings.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertMonitorSettings(userId: number, settings: { enabled?: boolean; volumeThreshold?: number; minVolumeAbsolute?: number; notifyOnSpike?: boolean }) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(monitorSettings).values({
      userId,
      enabled: settings.enabled !== false ? 1 : 0,
      volumeThreshold: settings.volumeThreshold ?? 2.0,
      minVolumeAbsolute: settings.minVolumeAbsolute ?? 100000,
      notifyOnSpike: settings.notifyOnSpike !== false ? 1 : 0,
    }).onDuplicateKeyUpdate({
      set: {
        ...(settings.enabled !== undefined ? { enabled: settings.enabled ? 1 : 0 } : {}),
        ...(settings.volumeThreshold !== undefined ? { volumeThreshold: settings.volumeThreshold } : {}),
        ...(settings.minVolumeAbsolute !== undefined ? { minVolumeAbsolute: settings.minVolumeAbsolute } : {}),
        ...(settings.notifyOnSpike !== undefined ? { notifyOnSpike: settings.notifyOnSpike ? 1 : 0 } : {}),
      },
    });
  } catch (e) {
    console.warn("[Database] Failed to upsert monitor settings:", e);
  }
}

// Screener preset operations
export async function getUserPresets(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(screenerPresets).where(eq(screenerPresets.userId, userId));
}

export async function savePreset(userId: number, name: string, filters: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(screenerPresets).values({ userId, name, filters });
}

export async function deletePreset(presetId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(screenerPresets).where(and(eq(screenerPresets.id, presetId), eq(screenerPresets.userId, userId)));
}

// Notification operations
export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(notifications).values(data);
  } catch (e) {
    console.warn("[Database] Failed to create notification:", e);
  }
}

export async function createNotificationsForAllUsers(data: Omit<InsertNotification, "userId">) {
  const db = await getDb();
  if (!db) return;
  try {
    const allUsers = await db.select({ id: users.id }).from(users);
    if (allUsers.length === 0) return;
    const values = allUsers.map(u => ({ ...data, userId: u.id }));
    await db.insert(notifications).values(values);
  } catch (e) {
    console.warn("[Database] Failed to create notifications for all users:", e);
  }
}

export async function getUserNotifications(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)));
  return result[0]?.count ?? 0;
}

export async function markNotificationRead(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications)
    .set({ isRead: 1 })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications)
    .set({ isRead: 1 })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)));
}

export async function deleteNotification(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function deleteAllNotifications(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(notifications)
    .where(eq(notifications.userId, userId));
}

// Notification preferences operations
export async function getNotificationPreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertNotificationPreferences(userId: number, prefs: Partial<Omit<InsertNotificationPreference, "id" | "userId" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) return null;
  try {
    const existing = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
    if (existing.length > 0) {
      const updateSet: Record<string, unknown> = {};
      if (prefs.emailEnabled !== undefined) updateSet.emailEnabled = prefs.emailEnabled;
      if (prefs.browserEnabled !== undefined) updateSet.browserEnabled = prefs.browserEnabled;
      if (prefs.soundEnabled !== undefined) updateSet.soundEnabled = prefs.soundEnabled;
      if (prefs.inAppEnabled !== undefined) updateSet.inAppEnabled = prefs.inAppEnabled;
      if (prefs.emailSeverities !== undefined) updateSet.emailSeverities = prefs.emailSeverities;
      if (prefs.browserSeverities !== undefined) updateSet.browserSeverities = prefs.browserSeverities;
      if (prefs.notificationEmail !== undefined) updateSet.notificationEmail = prefs.notificationEmail;
      if (prefs.quietHoursEnabled !== undefined) updateSet.quietHoursEnabled = prefs.quietHoursEnabled;
      if (prefs.quietHoursStart !== undefined) updateSet.quietHoursStart = prefs.quietHoursStart;
      if (prefs.quietHoursEnd !== undefined) updateSet.quietHoursEnd = prefs.quietHoursEnd;
      if (prefs.soundVolume !== undefined) updateSet.soundVolume = prefs.soundVolume;
      if (prefs.minIntervalMinutes !== undefined) updateSet.minIntervalMinutes = prefs.minIntervalMinutes;
      if (Object.keys(updateSet).length > 0) {
        await db.update(notificationPreferences).set(updateSet).where(eq(notificationPreferences.userId, userId));
      }
      const updated = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
      return updated[0] || null;
    } else {
      await db.insert(notificationPreferences).values({ userId, ...prefs } as InsertNotificationPreference);
      const inserted = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
      return inserted[0] || null;
    }
  } catch (e) {
    console.warn("[Database] Failed to upsert notification preferences:", e);
    return null;
  }
}

// Get all users who want email notifications for a given severity
export async function getUsersWithEmailNotifications(severity: string) {
  const db = await getDb();
  if (!db) return [];
  try {
    const allPrefs = await db.select({
      userId: notificationPreferences.userId,
      emailSeverities: notificationPreferences.emailSeverities,
      notificationEmail: notificationPreferences.notificationEmail,
      quietHoursEnabled: notificationPreferences.quietHoursEnabled,
      quietHoursStart: notificationPreferences.quietHoursStart,
      quietHoursEnd: notificationPreferences.quietHoursEnd,
    }).from(notificationPreferences).where(eq(notificationPreferences.emailEnabled, 1));
    
    // Filter by severity
    return allPrefs.filter(p => {
      const severities = (p.emailSeverities || "").split(",").map(s => s.trim());
      return severities.includes(severity);
    });
  } catch (e) {
    console.warn("[Database] Failed to get users with email notifications:", e);
    return [];
  }
}

// Get user email by userId
export async function getUserEmail(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  return result[0]?.email || null;
}

/**
 * Get the owner's notification preferences by looking up their user record via OWNER_OPEN_ID.
 * Returns null if the owner has no preferences saved (meaning they haven't opted in to anything).
 */
export async function getOwnerNotificationPreferences() {
  const db = await getDb();
  if (!db) return null;
  try {
    const ownerOpenId = ENV.ownerOpenId;
    if (!ownerOpenId) return null;
    // Find the owner's user record
    const ownerUser = await db.select({ id: users.id }).from(users).where(eq(users.openId, ownerOpenId)).limit(1);
    if (ownerUser.length === 0) return null;
    const ownerId = ownerUser[0].id;
    // Get their notification preferences
    const prefs = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, ownerId)).limit(1);
    return prefs.length > 0 ? prefs[0] : null;
  } catch (e) {
    console.warn("[Database] Failed to get owner notification preferences:", e);
    return null;
  }
}

// ============ Visitor Counter Operations ============

import { siteStats, visitorLog, pageViews } from "../drizzle/schema";
import crypto from "crypto";

function hashVisitor(ip: string, userAgent: string): string {
  return crypto.createHash("sha256").update(`${ip}:${userAgent}`).digest("hex").slice(0, 32);
}

function getUAEDate(): string {
  const now = new Date();
  // UAE is UTC+4
  const uaeTime = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return uaeTime.toISOString().slice(0, 10);
}

/** Resolve IP to country/city using free ip-api.com */
async function resolveGeo(ip: string): Promise<{ country: string; city: string; region: string; countryCode: string }> {
  try {
    // Skip private/local IPs
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
      return { country: 'Local', city: 'Local', region: '', countryCode: 'XX' };
    }
    const resp = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,regionName,countryCode`, { signal: AbortSignal.timeout(3000) });
    if (resp.ok) {
      const data = await resp.json();
      return {
        country: data.country || 'Unknown',
        city: data.city || 'Unknown',
        region: data.regionName || '',
        countryCode: data.countryCode || 'XX',
      };
    }
  } catch { /* ignore geo errors */ }
  return { country: 'Unknown', city: 'Unknown', region: '', countryCode: 'XX' };
}

export async function recordVisit(ip: string, userAgent: string): Promise<{ totalVisitors: number; todayVisitors: number; totalPageViews: number; onlineNow: number }> {
  const db = await getDb();
  if (!db) return { totalVisitors: 0, todayVisitors: 0, totalPageViews: 0, onlineNow: 0 };

  try {
    const visitorHash = hashVisitor(ip, userAgent);
    const today = getUAEDate();

    // Resolve geo in background (don't block response)
    const geo = await resolveGeo(ip);

    // Try to insert or update the visitor log for today
    await db.insert(visitorLog).values({
      visitorHash,
      ipAddress: ip,
      userAgent: userAgent.slice(0, 500),
      country: geo.country,
      city: geo.city,
      region: geo.region,
      countryCode: geo.countryCode,
      visitDate: today,
      pageViews: 1,
    }).onDuplicateKeyUpdate({
      set: {
        pageViews: sql`pageViews + 1`,
        lastVisit: new Date(),
      },
    });

    // Increment total page views counter
    await db.insert(siteStats).values({
      statKey: "total_pageviews",
      statValue: 1,
    }).onDuplicateKeyUpdate({
      set: { statValue: sql`statValue + 1` },
    });

    // Check if this is a brand new visitor (first time ever)
    const existingVisits = await db.select({ count: sql<number>`count(*)` })
      .from(visitorLog)
      .where(eq(visitorLog.visitorHash, visitorHash));
    
    if ((existingVisits[0]?.count ?? 0) <= 1) {
      // New unique visitor — increment total visitors
      await db.insert(siteStats).values({
        statKey: "total_visitors",
        statValue: 1,
      }).onDuplicateKeyUpdate({
        set: { statValue: sql`statValue + 1` },
      });
    }

    // Get stats
    return await getVisitorStats();
  } catch (e) {
    console.warn("[Database] Failed to record visit:", e);
    return { totalVisitors: 0, todayVisitors: 0, totalPageViews: 0, onlineNow: 0 };
  }
}

/** Get current visitor stats without recording */
export async function getVisitorStats(): Promise<{ totalVisitors: number; todayVisitors: number; totalPageViews: number; onlineNow: number }> {
  const db = await getDb();
  if (!db) return { totalVisitors: 0, todayVisitors: 0, totalPageViews: 0, onlineNow: 0 };

  try {
    const today = getUAEDate();

    // Total unique visitors (all time)
    const totalVisitorsResult = await db.select({ statValue: siteStats.statValue })
      .from(siteStats)
      .where(eq(siteStats.statKey, "total_visitors"))
      .limit(1);
    const totalVisitors = totalVisitorsResult[0]?.statValue ?? 0;

    // Total page views
    const totalPVResult = await db.select({ statValue: siteStats.statValue })
      .from(siteStats)
      .where(eq(siteStats.statKey, "total_pageviews"))
      .limit(1);
    const totalPageViews = totalPVResult[0]?.statValue ?? 0;

    // Today's unique visitors
    const todayResult = await db.select({ count: sql<number>`count(*)` })
      .from(visitorLog)
      .where(eq(visitorLog.visitDate, today));
    const todayVisitors = todayResult[0]?.count ?? 0;

    // "Online now" — visitors active in the last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineResult = await db.select({ count: sql<number>`count(*)` })
      .from(visitorLog)
      .where(gte(visitorLog.lastVisit, fiveMinAgo));
    const onlineNow = onlineResult[0]?.count ?? 0;

    return { totalVisitors, todayVisitors, totalPageViews, onlineNow };
  } catch (e) {
    console.warn("[Database] Failed to get visitor stats:", e);
    return { totalVisitors: 0, todayVisitors: 0, totalPageViews: 0, onlineNow: 0 };
  }
}

/** Record a page view */
export async function recordPageView(pagePath: string, symbol: string | null, ip: string, userAgent: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const visitorHash = hashVisitor(ip, userAgent);
    const today = getUAEDate();

    await db.insert(pageViews).values({
      pagePath,
      symbol: symbol || null,
      visitorHash,
      viewDate: today,
      viewCount: 1,
    }).onDuplicateKeyUpdate({
      set: {
        viewCount: sql`viewCount + 1`,
      },
    });
  } catch (e) {
    console.warn("[Database] Failed to record page view:", e);
  }
}

/** Get geographic breakdown of visitors */
export async function getGeoBreakdown(days: number = 30): Promise<{
  countries: Array<{ country: string; countryCode: string; visitors: number; pageViews: number }>;
  cities: Array<{ city: string; country: string; countryCode: string; visitors: number }>;
}> {
  const db = await getDb();
  if (!db) return { countries: [], cities: [] };

  try {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000);
    const cutoff = cutoffDate.toISOString().slice(0, 10);

    // Country breakdown
    const countries = await db.select({
      country: visitorLog.country,
      countryCode: visitorLog.countryCode,
      visitors: sql<number>`count(distinct ${visitorLog.visitorHash})`,
      pageViews: sql<number>`sum(${visitorLog.pageViews})`,
    })
      .from(visitorLog)
      .where(and(
        gte(visitorLog.visitDate, cutoff),
        sql`${visitorLog.country} IS NOT NULL AND ${visitorLog.country} != 'Unknown' AND ${visitorLog.country} != 'Local'`
      ))
      .groupBy(visitorLog.country, visitorLog.countryCode)
      .orderBy(sql`visitors DESC`)
      .limit(50);

    // City breakdown
    const cities = await db.select({
      city: visitorLog.city,
      country: visitorLog.country,
      countryCode: visitorLog.countryCode,
      visitors: sql<number>`count(distinct ${visitorLog.visitorHash})`,
    })
      .from(visitorLog)
      .where(and(
        gte(visitorLog.visitDate, cutoff),
        sql`${visitorLog.city} IS NOT NULL AND ${visitorLog.city} != 'Unknown' AND ${visitorLog.city} != 'Local'`
      ))
      .groupBy(visitorLog.city, visitorLog.country, visitorLog.countryCode)
      .orderBy(sql`visitors DESC`)
      .limit(50);

    return {
      countries: countries.map(c => ({
        country: c.country || 'Unknown',
        countryCode: c.countryCode || 'XX',
        visitors: Number(c.visitors),
        pageViews: Number(c.pageViews),
      })),
      cities: cities.map(c => ({
        city: c.city || 'Unknown',
        country: c.country || 'Unknown',
        countryCode: c.countryCode || 'XX',
        visitors: Number(c.visitors),
      })),
    };
  } catch (e) {
    console.warn("[Database] Failed to get geo breakdown:", e);
    return { countries: [], cities: [] };
  }
}

/** Get most viewed pages/stocks */
export async function getPageAnalytics(days: number = 30): Promise<{
  topPages: Array<{ pagePath: string; symbol: string | null; uniqueVisitors: number; totalViews: number }>;
  topStocks: Array<{ symbol: string; uniqueVisitors: number; totalViews: number }>;
  dailyTraffic: Array<{ date: string; visitors: number; pageViews: number }>;
}> {
  const db = await getDb();
  if (!db) return { topPages: [], topStocks: [], dailyTraffic: [] };

  try {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000);
    const cutoff = cutoffDate.toISOString().slice(0, 10);

    // Top pages
    const topPages = await db.select({
      pagePath: pageViews.pagePath,
      symbol: pageViews.symbol,
      uniqueVisitors: sql<number>`count(distinct ${pageViews.visitorHash})`,
      totalViews: sql<number>`sum(${pageViews.viewCount})`,
    })
      .from(pageViews)
      .where(gte(pageViews.viewDate, cutoff))
      .groupBy(pageViews.pagePath, pageViews.symbol)
      .orderBy(sql`sum(${pageViews.viewCount}) DESC`)
      .limit(20);

    // Top stocks specifically
    const topStocks = await db.select({
      symbol: pageViews.symbol,
      uniqueVisitors: sql<number>`count(distinct ${pageViews.visitorHash})`,
      totalViews: sql<number>`sum(${pageViews.viewCount})`,
    })
      .from(pageViews)
      .where(and(
        gte(pageViews.viewDate, cutoff),
        sql`${pageViews.symbol} IS NOT NULL`
      ))
      .groupBy(pageViews.symbol)
      .orderBy(sql`sum(${pageViews.viewCount}) DESC`)
      .limit(20);

    // Daily traffic (last N days)
    const dailyTraffic = await db.select({
      date: visitorLog.visitDate,
      visitors: sql<number>`count(distinct ${visitorLog.visitorHash})`,
      pageViews: sql<number>`sum(${visitorLog.pageViews})`,
    })
      .from(visitorLog)
      .where(gte(visitorLog.visitDate, cutoff))
      .groupBy(visitorLog.visitDate)
      .orderBy(visitorLog.visitDate);

    return {
      topPages: topPages.map(p => ({
        pagePath: p.pagePath,
        symbol: p.symbol,
        uniqueVisitors: Number(p.uniqueVisitors),
        totalViews: Number(p.totalViews),
      })),
      topStocks: topStocks.map(s => ({
        symbol: s.symbol!,
        uniqueVisitors: Number(s.uniqueVisitors),
        totalViews: Number(s.totalViews),
      })),
      dailyTraffic: dailyTraffic.map(d => ({
        date: d.date,
        visitors: Number(d.visitors),
        pageViews: Number(d.pageViews),
      })),
    };
  } catch (e) {
    console.warn("[Database] Failed to get page analytics:", e);
    return { topPages: [], topStocks: [], dailyTraffic: [] };
  }
}

/** Get recent visitor log entries for admin view */
export async function getRecentVisitors(limit: number = 50): Promise<Array<{
  country: string | null;
  city: string | null;
  countryCode: string | null;
  visitDate: string;
  pageViews: number;
  lastVisit: Date;
}>> {
  const db = await getDb();
  if (!db) return [];

  try {
    const results = await db.select({
      country: visitorLog.country,
      city: visitorLog.city,
      countryCode: visitorLog.countryCode,
      visitDate: visitorLog.visitDate,
      pageViews: visitorLog.pageViews,
      lastVisit: visitorLog.lastVisit,
    })
      .from(visitorLog)
      .orderBy(sql`${visitorLog.lastVisit} DESC`)
      .limit(limit);

    return results;
  } catch (e) {
    console.warn("[Database] Failed to get recent visitors:", e);
    return [];
  }
}
