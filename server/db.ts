import { eq, and, sql, desc, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, stockSnapshots, InsertStockSnapshot, watchlists, volumeAlerts, monitorSettings, screenerPresets } from "../drizzle/schema";
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
