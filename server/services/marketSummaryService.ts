/**
 * Market Summary Service
 * 
 * Generates automated daily market summaries for ADX and DFM
 * using real market data and structured templates (NO LLM).
 * 
 * Runs after market close (3:15 PM UAE time, Mon-Fri)
 * Collects market stats, top movers, and generates data-driven summaries.
 */

import { ALL_STOCKS, ADX_STOCKS, DFM_STOCKS, StockInfo } from "../../shared/stockData";
import { fetchAllTVStocks } from "./tradingViewService";
import { getDb } from "../db";
import { marketSummaries, InsertMarketSummary } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { isHoliday } from "../../shared/uaeHolidays";

// ─── Types ──────────────────────────────────────────────────────────

interface StockMover {
  symbol: string;
  name: string;
  nameAr?: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

interface ExchangeStats {
  exchange: string;
  indexValue: number | null;
  indexChange: number | null;
  indexChangePercent: number | null;
  totalVolume: number;
  totalValue: number;
  totalTrades: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  topGainers: StockMover[];
  topLosers: StockMover[];
  mostActive: StockMover[];
  sectorPerformance: Record<string, { avgChange: number; count: number }>;
}

// ─── State ──────────────────────────────────────────────────────────

let summaryInterval: ReturnType<typeof setInterval> | null = null;
let lastGeneratedDate: string | null = null;
let isGenerating = false;

// ─── Helpers ────────────────────────────────────────────────────────

function getUAEDate(): string {
  const now = new Date();
  const uaeTime = new Date(now.getTime() + (4 * 60 * 60 * 1000));
  return uaeTime.toISOString().split("T")[0];
}

function getUAEHour(): number {
  const now = new Date();
  const uaeTime = new Date(now.getTime() + (4 * 60 * 60 * 1000));
  return uaeTime.getUTCHours();
}

function getUAEMinute(): number {
  const now = new Date();
  const uaeTime = new Date(now.getTime() + (4 * 60 * 60 * 1000));
  return uaeTime.getUTCMinutes();
}

function isUAEWeekday(): boolean {
  const now = new Date();
  const uaeTime = new Date(now.getTime() + (4 * 60 * 60 * 1000));
  const day = uaeTime.getUTCDay();
  return day >= 1 && day <= 5;
}

function shouldGenerateSummary(): boolean {
  if (!isUAEWeekday()) return false;
  if (isHoliday(new Date())) return false;
  const hour = getUAEHour();
  const minute = getUAEMinute();
  const timeInMinutes = hour * 60 + minute;
  // Generate between 3:15 PM and 3:45 PM UAE time (915-945 minutes)
  if (timeInMinutes < 915 || timeInMinutes > 945) return false;
  // Don't generate twice on the same day
  const today = getUAEDate();
  if (lastGeneratedDate === today) return false;
  return true;
}

// ─── Data Collection ────────────────────────────────────────────────

async function collectExchangeStats(exchange: "ADX" | "DFM"): Promise<ExchangeStats> {
  const stockList = exchange === "ADX" ? ADX_STOCKS : DFM_STOCKS;
  
  // Fetch from TradingView scanner
  const tvData = await fetchAllTVStocks();
  
  // Filter for this exchange
  const exchangeData = tvData.filter((d: any) => {
    const sym = d.s || d.symbol || "";
    return sym.startsWith(`${exchange}:`);
  });

  let totalVolume = 0;
  let totalValue = 0;
  let advancers = 0;
  let decliners = 0;
  let unchanged = 0;
  const movers: StockMover[] = [];
  const sectorMap: Record<string, { totalChange: number; count: number }> = {};

  for (const item of exchangeData) {
    const sym = (item.ticker || "").replace(`${exchange}:`, "");
    const stockInfo = stockList.find(s => s.symbol === sym);
    if (!stockInfo) continue;

    const price = item.close || 0;
    const changePercent = item.change || 0;
    const changeAbs = item.changeAbs || 0;
    const volume = item.volume || 0;
    const value = price * volume;

    totalVolume += volume;
    totalValue += value;

    if (changePercent > 0.01) advancers++;
    else if (changePercent < -0.01) decliners++;
    else unchanged++;

    movers.push({
      symbol: sym,
      name: stockInfo.name,
      nameAr: stockInfo.name,
      exchange,
      price,
      change: changeAbs,
      changePercent,
      volume,
    });

    // Sector tracking
    const sector = stockInfo.sector || "Other";
    if (!sectorMap[sector]) sectorMap[sector] = { totalChange: 0, count: 0 };
    sectorMap[sector].totalChange += changePercent;
    sectorMap[sector].count++;
  }

  // Sort for top movers
  const sortedByGain = [...movers].sort((a, b) => b.changePercent - a.changePercent);
  const sortedByLoss = [...movers].sort((a, b) => a.changePercent - b.changePercent);
  const sortedByVolume = [...movers].sort((a, b) => b.volume - a.volume);

  const sectorPerformance: Record<string, { avgChange: number; count: number }> = {};
  for (const [sector, data] of Object.entries(sectorMap)) {
    sectorPerformance[sector] = {
      avgChange: data.count > 0 ? data.totalChange / data.count : 0,
      count: data.count,
    };
  }

  return {
    exchange,
    indexValue: null,
    indexChange: null,
    indexChangePercent: null,
    totalVolume,
    totalValue: Math.round(totalValue),
    totalTrades: exchangeData.length,
    advancers,
    decliners,
    unchanged,
    topGainers: sortedByGain.slice(0, 5),
    topLosers: sortedByLoss.filter(s => s.changePercent < 0).slice(0, 5),
    mostActive: sortedByVolume.slice(0, 5),
    sectorPerformance,
  };
}

// ─── Data-Driven Narrative Generation (No LLM) ─────────────────────

function generateNarrative(
  stats: ExchangeStats,
  language: "en" | "ar"
): string {
  const exchangeName = language === "en"
    ? (stats.exchange === "ADX" ? "Abu Dhabi Securities Exchange (ADX)" : "Dubai Financial Market (DFM)")
    : (stats.exchange === "ADX" ? "سوق أبوظبي للأوراق المالية" : "سوق دبي المالي");

  const totalStocks = stats.advancers + stats.decliners + stats.unchanged;
  const advanceRatio = totalStocks > 0 ? (stats.advancers / totalStocks * 100).toFixed(0) : "0";
  const declineRatio = totalStocks > 0 ? (stats.decliners / totalStocks * 100).toFixed(0) : "0";

  // Determine market direction
  const direction = stats.advancers > stats.decliners ? "positive" : stats.decliners > stats.advancers ? "negative" : "mixed";

  // Best and worst sectors
  const sortedSectors = Object.entries(stats.sectorPerformance)
    .sort((a, b) => b[1].avgChange - a[1].avgChange);
  const bestSector = sortedSectors[0];
  const worstSector = sortedSectors[sortedSectors.length - 1];

  if (language === "en") {
    const directionText = direction === "positive" 
      ? `closed on a positive note with **${stats.advancers}** stocks advancing (${advanceRatio}% of traded stocks)`
      : direction === "negative"
      ? `closed lower with **${stats.decliners}** stocks declining (${declineRatio}% of traded stocks)`
      : `ended the session mixed with advancers and decliners nearly balanced`;

    const volumeText = `Total trading volume reached **${stats.totalVolume.toLocaleString()}** shares with a turnover of **AED ${(stats.totalValue / 1e6).toFixed(2)} million** across **${stats.totalTrades}** traded stocks.`;

    const gainersText = stats.topGainers.length > 0
      ? `**Top Gainers:** ${stats.topGainers.slice(0, 3).map(s => `${s.name} (${s.symbol}) +${s.changePercent.toFixed(2)}%`).join(", ")}.`
      : "";

    const losersText = stats.topLosers.length > 0
      ? `**Top Losers:** ${stats.topLosers.slice(0, 3).map(s => `${s.name} (${s.symbol}) ${s.changePercent.toFixed(2)}%`).join(", ")}.`
      : "";

    const activeText = stats.mostActive.length > 0
      ? `**Most Active:** ${stats.mostActive.slice(0, 3).map(s => `${s.name} (${s.volume.toLocaleString()} shares)`).join(", ")}.`
      : "";

    const sectorText = bestSector && worstSector && bestSector[0] !== worstSector[0]
      ? `**Sector Performance:** ${bestSector[0]} led with an average gain of +${bestSector[1].avgChange.toFixed(2)}%, while ${worstSector[0]} underperformed at ${worstSector[1].avgChange.toFixed(2)}%.`
      : "";

    return [
      `**${exchangeName}** ${directionText}. ${stats.decliners} stocks declined and ${stats.unchanged} remained unchanged.`,
      "",
      volumeText,
      "",
      [gainersText, losersText].filter(Boolean).join(" "),
      "",
      activeText,
      "",
      sectorText,
    ].filter(line => line !== undefined).join("\n");
  } else {
    // Arabic version
    const directionText = direction === "positive"
      ? `أغلق على ارتفاع مع صعود **${stats.advancers}** سهماً (${advanceRatio}% من الأسهم المتداولة)`
      : direction === "negative"
      ? `أغلق على انخفاض مع تراجع **${stats.decliners}** سهماً (${declineRatio}% من الأسهم المتداولة)`
      : `أنهى الجلسة بأداء متباين مع تقارب عدد الأسهم المرتفعة والمنخفضة`;

    const volumeText = `بلغ إجمالي حجم التداول **${stats.totalVolume.toLocaleString()}** سهم بقيمة إجمالية **${(stats.totalValue / 1e6).toFixed(2)} مليون درهم** عبر **${stats.totalTrades}** سهماً متداولاً.`;

    const gainersText = stats.topGainers.length > 0
      ? `**أبرز الرابحين:** ${stats.topGainers.slice(0, 3).map(s => `${s.name} (${s.symbol}) +${s.changePercent.toFixed(2)}%`).join("، ")}.`
      : "";

    const losersText = stats.topLosers.length > 0
      ? `**أبرز الخاسرين:** ${stats.topLosers.slice(0, 3).map(s => `${s.name} (${s.symbol}) ${s.changePercent.toFixed(2)}%`).join("، ")}.`
      : "";

    const activeText = stats.mostActive.length > 0
      ? `**الأكثر نشاطاً:** ${stats.mostActive.slice(0, 3).map(s => `${s.name} (${s.volume.toLocaleString()} سهم)`).join("، ")}.`
      : "";

    const sectorText = bestSector && worstSector && bestSector[0] !== worstSector[0]
      ? `**أداء القطاعات:** تصدر قطاع ${bestSector[0]} بمتوسط ارتفاع +${bestSector[1].avgChange.toFixed(2)}%، بينما تراجع قطاع ${worstSector[0]} بنسبة ${worstSector[1].avgChange.toFixed(2)}%.`
      : "";

    return [
      `**${exchangeName}** ${directionText}. تراجع ${stats.decliners} سهماً واستقر ${stats.unchanged} دون تغيير.`,
      "",
      volumeText,
      "",
      [gainersText, losersText].filter(Boolean).join(" "),
      "",
      activeText,
      "",
      sectorText,
    ].filter(line => line !== undefined).join("\n");
  }
}

// ─── Database Operations ────────────────────────────────────────────

async function saveSummary(
  date: string,
  exchange: string,
  language: "en" | "ar",
  stats: ExchangeStats,
  narrative: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const record: InsertMarketSummary = {
    date,
    exchange,
    language,
    indexValue: stats.indexValue,
    indexChange: stats.indexChange,
    indexChangePercent: stats.indexChangePercent,
    totalVolume: stats.totalVolume,
    totalValue: stats.totalValue,
    totalTrades: stats.totalTrades,
    advancers: stats.advancers,
    decliners: stats.decliners,
    unchanged: stats.unchanged,
    topGainers: JSON.stringify(stats.topGainers),
    topLosers: JSON.stringify(stats.topLosers),
    mostActive: JSON.stringify(stats.mostActive),
    sectorPerformance: JSON.stringify(stats.sectorPerformance),
    narrative,
    generatedAt: new Date(),
  };

  // Upsert: delete existing then insert
  await db.delete(marketSummaries).where(
    and(
      eq(marketSummaries.date, date),
      eq(marketSummaries.exchange, exchange),
      eq(marketSummaries.language, language)
    )
  );
  await db.insert(marketSummaries).values(record);
}

export async function getLatestSummaries(language: "en" | "ar", limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(marketSummaries)
    .where(eq(marketSummaries.language, language))
    .orderBy(desc(marketSummaries.date), desc(marketSummaries.generatedAt))
    .limit(limit);
}

export async function getSummaryByDate(date: string, language: "en" | "ar") {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(marketSummaries)
    .where(
      and(
        eq(marketSummaries.date, date),
        eq(marketSummaries.language, language)
      )
    );
}

// ─── Main Generation Flow ───────────────────────────────────────────

export async function generateDailySummary(forceDate?: string): Promise<{
  success: boolean;
  date: string;
  summaries: number;
  error?: string;
}> {
  const date = forceDate || getUAEDate();
  
  if (isGenerating) {
    return { success: false, date, summaries: 0, error: "Generation already in progress" };
  }

  isGenerating = true;
  let summaryCount = 0;

  try {
    console.log(`[MarketSummary] Generating daily summary for ${date}...`);

    // Collect stats for both exchanges
    const [adxStats, dfmStats] = await Promise.all([
      collectExchangeStats("ADX"),
      collectExchangeStats("DFM"),
    ]);

    // Generate narratives for both languages for both exchanges
    const tasks = [
      { stats: adxStats, lang: "en" as const },
      { stats: adxStats, lang: "ar" as const },
      { stats: dfmStats, lang: "en" as const },
      { stats: dfmStats, lang: "ar" as const },
    ];

    for (const task of tasks) {
      try {
        const narrative = generateNarrative(task.stats, task.lang);
        await saveSummary(date, task.stats.exchange, task.lang, task.stats, narrative);
        summaryCount++;
        console.log(`[MarketSummary] Saved ${task.stats.exchange} ${task.lang} summary`);
      } catch (e) {
        console.error(`[MarketSummary] Failed to generate ${task.stats.exchange} ${task.lang}:`, e);
      }
    }

    lastGeneratedDate = date;
    console.log(`[MarketSummary] Generated ${summaryCount}/4 summaries for ${date}`);
    return { success: true, date, summaries: summaryCount };
  } catch (e: any) {
    console.error("[MarketSummary] Generation failed:", e);
    return { success: false, date, summaries: summaryCount, error: e.message };
  } finally {
    isGenerating = false;
  }
}

// ─── Scheduler ──────────────────────────────────────────────────────

export function startMarketSummaryScheduler(): void {
  if (summaryInterval) {
    console.log("[MarketSummary] Scheduler already running");
    return;
  }

  console.log("[MarketSummary] Starting scheduler (checks every 60s, generates at ~3:15 PM UAE)");

  // Check every 60 seconds
  summaryInterval = setInterval(async () => {
    if (shouldGenerateSummary()) {
      console.log("[MarketSummary] Triggering daily summary generation...");
      await generateDailySummary();
    }
  }, 60_000);

  // Also check immediately on startup (in case server restarts after market close)
  setTimeout(async () => {
    const hour = getUAEHour();
    const minute = getUAEMinute();
    const timeInMinutes = hour * 60 + minute;
    // If it's after 3:15 PM and before midnight, check if today's summary exists
    if (isUAEWeekday() && !isHoliday(new Date()) && timeInMinutes >= 915) {
      const today = getUAEDate();
      const existing = await getSummaryByDate(today, "en");
      if (existing.length === 0) {
        console.log("[MarketSummary] No summary for today found, generating...");
        await generateDailySummary();
      }
    }
  }, 10_000);
}

export function stopMarketSummaryScheduler(): void {
  if (summaryInterval) {
    clearInterval(summaryInterval);
    summaryInterval = null;
    console.log("[MarketSummary] Scheduler stopped");
  }
}

export function getMarketSummaryStatus() {
  return {
    isRunning: !!summaryInterval,
    isGenerating,
    lastGeneratedDate,
  };
}
