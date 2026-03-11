/**
 * Market Summary Service
 * 
 * Generates automated daily market summaries for ADX and DFM
 * in both English and Arabic using LLM.
 * 
 * Runs after market close (3:15 PM UAE time, Mon-Fri)
 * Collects market stats, top movers, and generates narrative summaries.
 */

import { ALL_STOCKS, ADX_STOCKS, DFM_STOCKS, StockInfo } from "../../shared/stockData";
import { fetchAllTVStocks } from "./tradingViewService";
import { invokeLLM } from "../_core/llm";
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
  const tickers = stockList.map(s => `${exchange}:${s.symbol}`);
  
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
    // Note: totalTrades counted by loop iterations

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
    indexValue: null, // Will be filled from specific index data if available
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

// ─── LLM Narrative Generation ───────────────────────────────────────

async function generateNarrative(
  stats: ExchangeStats,
  language: "en" | "ar"
): Promise<string> {
  const gainersStr = stats.topGainers.map(s => 
    `${s.name} (${s.symbol}): ${s.changePercent > 0 ? '+' : ''}${s.changePercent.toFixed(2)}%, AED ${s.price.toFixed(2)}`
  ).join("\n");
  
  const losersStr = stats.topLosers.map(s => 
    `${s.name} (${s.symbol}): ${s.changePercent.toFixed(2)}%, AED ${s.price.toFixed(2)}`
  ).join("\n");
  
  const activeStr = stats.mostActive.map(s => 
    `${s.name} (${s.symbol}): ${s.volume.toLocaleString()} shares, AED ${s.price.toFixed(2)}`
  ).join("\n");

  const sectorStr = Object.entries(stats.sectorPerformance)
    .sort((a, b) => b[1].avgChange - a[1].avgChange)
    .map(([sector, data]) => `${sector}: ${data.avgChange > 0 ? '+' : ''}${data.avgChange.toFixed(2)}% (${data.count} stocks)`)
    .join("\n");

  const prompt = language === "en" 
    ? `Generate a professional daily market summary report for the ${stats.exchange === "ADX" ? "Abu Dhabi Securities Exchange (ADX)" : "Dubai Financial Market (DFM)"}.

Date: ${getUAEDate()}
Market Statistics:
- Total Volume: ${stats.totalVolume.toLocaleString()} shares
- Total Value: AED ${(stats.totalValue / 1e6).toFixed(2)} million
- Stocks Traded: ${stats.totalTrades}
- Advancers: ${stats.advancers} | Decliners: ${stats.decliners} | Unchanged: ${stats.unchanged}

Top Gainers:
${gainersStr || "No significant gainers"}

Top Losers:
${losersStr || "No significant losers"}

Most Active by Volume:
${activeStr || "N/A"}

Sector Performance:
${sectorStr || "N/A"}

Write a comprehensive 3-4 paragraph market summary in professional financial journalism style. Include:
1. Overall market direction and sentiment
2. Key movers and what drove them
3. Sector highlights
4. Brief outlook for the next session

Use markdown formatting with **bold** for key figures. Be factual and analytical.`
    : `اكتب تقريراً يومياً احترافياً لملخص السوق لـ ${stats.exchange === "ADX" ? "سوق أبوظبي للأوراق المالية (ADX)" : "سوق دبي المالي (DFM)"}.

التاريخ: ${getUAEDate()}
إحصائيات السوق:
- إجمالي حجم التداول: ${stats.totalVolume.toLocaleString()} سهم
- إجمالي قيمة التداول: ${(stats.totalValue / 1e6).toFixed(2)} مليون درهم
- عدد الأسهم المتداولة: ${stats.totalTrades}
- الأسهم المرتفعة: ${stats.advancers} | المنخفضة: ${stats.decliners} | دون تغيير: ${stats.unchanged}

أكبر الرابحين:
${gainersStr || "لا توجد ارتفاعات ملحوظة"}

أكبر الخاسرين:
${losersStr || "لا توجد انخفاضات ملحوظة"}

الأكثر نشاطاً من حيث الحجم:
${activeStr || "غير متوفر"}

أداء القطاعات:
${sectorStr || "غير متوفر"}

اكتب ملخصاً شاملاً للسوق من 3-4 فقرات بأسلوب صحافة مالية احترافية باللغة العربية. يتضمن:
1. الاتجاه العام للسوق والمعنويات
2. الأسهم الرئيسية المحركة وأسباب تحركها
3. أبرز أداء القطاعات
4. نظرة مختصرة للجلسة القادمة

استخدم تنسيق markdown مع **خط عريض** للأرقام الرئيسية. كن واقعياً وتحليلياً.`;

  try {
    const result = await invokeLLM({
      messages: [
        { 
          role: "system", 
          content: language === "en" 
            ? "You are a senior financial journalist specializing in UAE capital markets. Write clear, data-driven market summaries in professional English. Use markdown formatting."
            : "أنت صحفي مالي متخصص في أسواق رأس المال الإماراتية. اكتب ملخصات سوقية واضحة ومبنية على البيانات باللغة العربية الفصحى المهنية. استخدم تنسيق markdown."
        },
        { role: "user", content: prompt }
      ],
    });
    const content = result.choices[0]?.message?.content;
    return (typeof content === "string" ? content : null) || (language === "en" ? "Summary generation failed." : "فشل إنشاء الملخص.");
  } catch (e) {
    console.error("[MarketSummary] LLM generation failed:", e);
    return language === "en" 
      ? "Market summary temporarily unavailable. Please check back later." 
      : "ملخص السوق غير متوفر مؤقتاً. يرجى المحاولة لاحقاً.";
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
        const narrative = await generateNarrative(task.stats, task.lang);
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
