import { int, float, bigint, mysqlEnum, mysqlTable, text, timestamp, varchar, uniqueIndex } from "drizzle-orm/mysql-core";

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
