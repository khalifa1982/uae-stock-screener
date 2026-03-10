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
