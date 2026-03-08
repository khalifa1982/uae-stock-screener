import { int, float, bigint, mysqlEnum, mysqlTable, text, timestamp, varchar, uniqueIndex, boolean, index } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const stockSnapshots = mysqlTable("stock_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  exchange: varchar("exchange", { length: 8 }).notNull(),
  price: float("price"),
  previousClose: float("previousClose"),
  open: float("open"),
  dayHigh: float("dayHigh"),
  dayLow: float("dayLow"),
  volume: bigint("volume", { mode: "number" }),
  avgVolume: bigint("avgVolume", { mode: "number" }),
  marketCap: bigint("marketCap", { mode: "number" }),
  pe: float("pe"),
  eps: float("eps"),
  week52High: float("week52High"),
  week52Low: float("week52Low"),
  dividendYield: float("dividendYield"),
  beta: float("beta"),
  changePercent: float("changePercent"),
  rsi: float("rsi"),
  sma20: float("sma20"),
  sma50: float("sma50"),
  ema12: float("ema12"),
  ema26: float("ema26"),
  volumeRatio: float("volumeRatio"),
  sentiment: varchar("sentiment", { length: 16 }),
  sentimentScore: float("sentimentScore"),
  sentimentSummary: text("sentimentSummary"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("symbol_exchange_idx").on(table.symbol, table.exchange),
]);

export type StockSnapshot = typeof stockSnapshots.$inferSelect;
export type InsertStockSnapshot = typeof stockSnapshots.$inferInsert;

export const watchlists = mysqlTable("watchlists", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  exchange: varchar("exchange", { length: 8 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("user_symbol_idx").on(table.userId, table.symbol),
]);

export type Watchlist = typeof watchlists.$inferSelect;
export type InsertWatchlist = typeof watchlists.$inferInsert;

// Volume alerts - tracks detected volume spikes
export const volumeAlerts = mysqlTable("volume_alerts", {
  id: int("id").autoincrement().primaryKey(),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  exchange: varchar("exchange", { length: 8 }).notNull(),
  stockName: varchar("stockName", { length: 128 }),
  sector: varchar("sector", { length: 64 }),
  currentVolume: bigint("currentVolume", { mode: "number" }).notNull(),
  avgVolume: bigint("avgVolume", { mode: "number" }).notNull(),
  volumeMultiplier: float("volumeMultiplier").notNull(),
  price: float("price"),
  changePercent: float("changePercent"),
  alertType: varchar("alertType", { length: 32 }).notNull().default("volume_spike"),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).notNull().default("medium"),
  notified: int("notified").notNull().default(0),
  dismissed: int("dismissed").notNull().default(0),
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
}, (table) => [
  index("symbol_detected_idx").on(table.symbol, table.detectedAt),
  index("detected_at_idx").on(table.detectedAt),
]);

export type VolumeAlert = typeof volumeAlerts.$inferSelect;
export type InsertVolumeAlert = typeof volumeAlerts.$inferInsert;

// Monitor settings - user-configurable alert thresholds
export const monitorSettings = mysqlTable("monitor_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  enabled: int("enabled").notNull().default(1),
  volumeThreshold: float("volumeThreshold").notNull().default(2.0),
  minVolumeAbsolute: bigint("minVolumeAbsolute", { mode: "number" }).notNull().default(100000),
  notifyOnSpike: int("notifyOnSpike").notNull().default(1),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MonitorSettings = typeof monitorSettings.$inferSelect;
export type InsertMonitorSettings = typeof monitorSettings.$inferInsert;

// Screener presets - saved filter configurations
export const screenerPresets = mysqlTable("screener_presets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  filters: text("filters").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("user_presets_idx").on(table.userId),
]);

export type ScreenerPreset = typeof screenerPresets.$inferSelect;
export type InsertScreenerPreset = typeof screenerPresets.$inferInsert;

// In-app notifications for users
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 32 }).notNull().default("volume_spike"),
  title: varchar("title", { length: 256 }).notNull(),
  message: text("message").notNull(),
  symbol: varchar("symbol", { length: 32 }),
  exchange: varchar("exchange", { length: 8 }),
  severity: mysqlEnum("notif_severity", ["info", "warning", "critical"]).notNull().default("info"),
  isRead: int("isRead").notNull().default(0),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("user_notif_idx").on(table.userId, table.isRead),
  index("notif_created_idx").on(table.createdAt),
]);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
