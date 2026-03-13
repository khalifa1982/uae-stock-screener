import { int, float, bigint, mysqlEnum, mysqlTable, text, timestamp, varchar, uniqueIndex, boolean, index } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 256 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  resetToken: varchar("resetToken", { length: 128 }),
  resetTokenExpiry: timestamp("resetTokenExpiry"),
  mobileNumber: varchar("mobileNumber", { length: 20 }),
  avatarEmoji: varchar("avatarEmoji", { length: 8 }),
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

// User notification preferences - controls how/when users receive alerts
export const notificationPreferences = mysqlTable("notification_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // Channel toggles
  emailEnabled: int("emailEnabled").notNull().default(0),
  browserEnabled: int("browserEnabled").notNull().default(1),
  soundEnabled: int("soundEnabled").notNull().default(1),
  inAppEnabled: int("inAppEnabled").notNull().default(1),
  // Severity filters (which severities trigger notifications)
  emailSeverities: varchar("emailSeverities", { length: 128 }).notNull().default("high,critical"),
  browserSeverities: varchar("browserSeverities", { length: 128 }).notNull().default("medium,high,critical"),
  // Email address (optional override - defaults to user's registered email)
  notificationEmail: varchar("notificationEmail", { length: 320 }),
  // Quiet hours (UAE time, 24h format)
  quietHoursEnabled: int("quietHoursEnabled").notNull().default(0),
  quietHoursStart: varchar("quietHoursStart", { length: 5 }).notNull().default("22:00"),
  quietHoursEnd: varchar("quietHoursEnd", { length: 5 }).notNull().default("07:00"),
  // Sound settings
  soundVolume: float("soundVolume").notNull().default(0.7),
  // Alert type filters (comma-separated list of enabled alert types)
  alertTypes: varchar("alertTypes", { length: 256 }).notNull().default("volume_spike,price_alert,earnings,dividend,news"),
  // Frequency control
  minIntervalMinutes: int("minIntervalMinutes").notNull().default(5),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;

// Daily market summaries (EN/AR)
export const marketSummaries = mysqlTable("market_summaries", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  exchange: varchar("exchange", { length: 8 }).notNull(), // DFM, ADX, or ALL
  language: varchar("language", { length: 2 }).notNull(), // en or ar
  // Key stats
  indexValue: float("indexValue"),
  indexChange: float("indexChange"),
  indexChangePercent: float("indexChangePercent"),
  totalVolume: bigint("totalVolume", { mode: "number" }),
  totalValue: bigint("totalValue", { mode: "number" }),
  totalTrades: int("totalTrades"),
  advancers: int("advancers"),
  decliners: int("decliners"),
  unchanged: int("unchanged"),
  // JSON data
  topGainers: text("topGainers"), // JSON array
  topLosers: text("topLosers"), // JSON array
  mostActive: text("mostActive"), // JSON array
  sectorPerformance: text("sectorPerformance"), // JSON object
  // AI-generated narrative
  narrative: text("narrative"),
  // Metadata
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("date_exchange_lang_idx").on(table.date, table.exchange, table.language),
  index("date_idx").on(table.date),
]);

export type MarketSummary = typeof marketSummaries.$inferSelect;
export type InsertMarketSummary = typeof marketSummaries.$inferInsert;

// Live chat messages - daily reset (only today's messages kept)
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 128 }).notNull(),
  userColor: varchar("userColor", { length: 7 }).notNull(), // hex color for avatar
  messageType: mysqlEnum("messageType", ["text", "image", "system"]).notNull().default("text"),
  content: text("content"), // text content or system message
  imageUrl: varchar("imageUrl", { length: 512 }), // S3 URL for image messages
  replyToId: int("replyToId"), // ID of the message being replied to (null if not a reply)
  chatDate: varchar("chatDate", { length: 10 }).notNull(), // YYYY-MM-DD (UAE timezone)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("chat_date_idx").on(table.chatDate),
  index("chat_user_idx").on(table.userId),
]);

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// Chat message reactions - emoji reactions on messages
export const chatMessageReactions = mysqlTable("chat_message_reactions", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 128 }).notNull(),
  emoji: varchar("emoji", { length: 8 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("reaction_message_idx").on(table.messageId),
  uniqueIndex("reaction_unique_idx").on(table.messageId, table.userId, table.emoji),
]);

export type ChatMessageReaction = typeof chatMessageReactions.$inferSelect;
export type InsertChatMessageReaction = typeof chatMessageReactions.$inferInsert;


// Abboud AI alerts - tracks when stocks enter entry zones or hit targets
export const abboudAlerts = mysqlTable("abboud_alerts", {
  id: int("id").autoincrement().primaryKey(),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  exchange: varchar("exchange", { length: 8 }).notNull(),
  alertType: mysqlEnum("abboud_alert_type", [
    "entry_zone",      // Price entered the Fibonacci entry zone
    "stop_loss",       // Price hit stop loss level
    "target_1",        // Price hit TP1
    "target_2",        // Price hit TP2
    "target_3",        // Price hit TP3
    "fib_bounce",      // Price bounced off a key Fibonacci level
  ]).notNull(),
  price: float("price").notNull(),
  triggerLevel: float("triggerLevel").notNull(),
  direction: mysqlEnum("abboud_direction", ["bullish", "bearish"]).notNull().default("bullish"),
  message: text("message").notNull(),
  severity: mysqlEnum("abboud_severity", ["info", "warning", "critical"]).notNull().default("info"),
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
}, (table) => [
  index("abboud_symbol_idx").on(table.symbol, table.detectedAt),
  index("abboud_detected_idx").on(table.detectedAt),
]);

export type AbboudAlert = typeof abboudAlerts.$inferSelect;
export type InsertAbboudAlert = typeof abboudAlerts.$inferInsert;
