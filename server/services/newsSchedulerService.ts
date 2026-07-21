/**
 * Market News Scheduler Service
 * 
 * Automatically fetches news from NewsAPI.ai (Event Registry) as primary source
 * and TradingView as fallback for all UAE stocks.
 * 
 * Strategy:
 * - NewsAPI.ai: Fetches comprehensive UAE financial news using concept URIs (DFM, ADX, major companies)
 * - TradingView: Fetches per-symbol news for top 30 blue-chip stocks as supplementary source
 * - Stores all articles in market_news table with deduplication
 * - Provides fast DB-backed queries for the frontend
 * - Auto-refreshes every 15 minutes
 */

import { ALL_STOCKS } from "../../shared/stockData";
import { getDb } from "../db";
import { marketNews } from "../../drizzle/schema";
import { desc, sql, and } from "drizzle-orm";

// ─── NewsAPI.ai Configuration ────────────────────────────────────────────
const NEWSAPI_BASE_URL = 'https://eventregistry.org/api/v1/article/getArticles';
import { ENV } from '../_core/env';
const NEWSAPI_KEY = ENV.newsApiKey;

// Concept URIs for UAE financial markets and major companies
const UAE_MARKET_CONCEPTS = [
  'http://en.wikipedia.org/wiki/Dubai_Financial_Market',
  'http://en.wikipedia.org/wiki/Abu_Dhabi_Securities_Exchange',
];

const UAE_COMPANY_CONCEPTS = [
  'http://en.wikipedia.org/wiki/Emaar_Properties',
  'http://en.wikipedia.org/wiki/Abu_Dhabi_National_Oil_Company',
  'http://en.wikipedia.org/wiki/Aldar_Properties',
  'http://en.wikipedia.org/wiki/First_Abu_Dhabi_Bank',
  'http://en.wikipedia.org/wiki/Emirates_NBD',
  'http://en.wikipedia.org/wiki/International_Holding_Company',
  'http://en.wikipedia.org/wiki/Dubai_Electricity_and_Water_Authority',
  'http://en.wikipedia.org/wiki/Abu_Dhabi_Islamic_Bank',
  'http://en.wikipedia.org/wiki/Etisalat',
  'http://en.wikipedia.org/wiki/Air_Arabia',
  'http://en.wikipedia.org/wiki/Damac_Properties',
  'http://en.wikipedia.org/wiki/Dubai_Islamic_Bank',
  'http://en.wikipedia.org/wiki/Abu_Dhabi_Ports',
  'http://en.wikipedia.org/wiki/Mashreq_(bank)',
  'http://en.wikipedia.org/wiki/TAQA',
];

// ─── TradingView Configuration (Fallback) ────────────────────────────────
const TV_NEWS_API_URL = 'https://news-headlines.tradingview.com/v2/headlines';

// Top 30 blue-chip stocks for TradingView per-symbol fetch
const PRIORITY_SYMBOLS = [
  'DFM:EMAAR', 'ADX:FAB', 'ADX:IHC', 'DFM:EMIRATESNBD', 'ADX:ALDAR',
  'ADX:ADNOCDIST', 'DFM:DIB', 'ADX:EAND', 'ADX:ADNOC', 'DFM:DFM',
  'DFM:AIRARABIA', 'ADX:ADIB', 'ADX:TAQA', 'ADX:ADNOCGAS', 'ADX:FERTIGLB',
  'DFM:DEWA', 'ADX:ADNOCLS', 'DFM:DAMAC', 'ADX:DANA', 'ADX:MULTIPLY',
  'DFM:SALAM', 'ADX:ADPORTS', 'DFM:DEYAAR', 'ADX:PRESIGHT', 'ADX:ADPOWER',
  'DFM:MASQ', 'DFM:GGICO', 'ADX:ALPHA', 'DFM:EMAARDEV', 'ADX:ESHRAQ',
];

// ─── Scheduler State ─────────────────────────────────────────────────────
let newsInterval: ReturnType<typeof setInterval> | null = null;
let tvRotationInterval: ReturnType<typeof setInterval> | null = null;
let batchIndex = 0;
let lastFetchTime = 0;
let totalArticlesFetched = 0;
let lastError: string | null = null;
let newsApiArticlesFetched = 0;
let tvArticlesFetched = 0;

const NEWSAPI_INTERVAL = 15 * 60 * 1000; // 15 minutes for NewsAPI.ai
const TV_ROTATION_INTERVAL = 5 * 60 * 1000; // 5 minutes for TradingView rotation
const BATCH_SIZE = 10;
const CONCURRENT_LIMIT = 5;
const ARTICLES_PER_SYMBOL = 20;

interface RawNewsItem {
  id: string;
  title: string;
  provider: string;
  source: string;
  sourceLogoId: string;
  published: number;
  urgency: number;
  storyPath: string;
  relatedSymbols: Array<{ symbol: string; logoid: string }>;
  articleUrl?: string;
  imageUrl?: string;
}

// ─── NewsAPI.ai Functions ────────────────────────────────────────────────

/**
 * Fetch articles from NewsAPI.ai (Event Registry)
 */
async function fetchFromNewsAPI(concepts: string[], count: number = 50): Promise<RawNewsItem[]> {
  try {
    const body = {
      action: 'getArticles',
      conceptUri: concepts,
      conceptOper: 'or',
      articlesPage: 1,
      articlesCount: count,
      articlesSortBy: 'date',
      articlesSortByAsc: false,
      resultType: 'articles',
      dataType: ['news'],
      lang: 'eng',
      apiKey: NEWSAPI_KEY,
    };

    const resp = await fetch(NEWSAPI_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      console.warn(`[NewsScheduler/NewsAPI] HTTP ${resp.status}`);
      return [];
    }

    const data = await resp.json() as any;
    const articles = data?.articles?.results || [];

    return articles.map((a: any) => {
      // Try to match article to UAE stock symbols based on title/body keywords
      const matchedSymbols = matchArticleToSymbols(a.title || '', a.body || '');

      return {
        id: `newsapi-${a.uri}`,
        title: a.title || '',
        provider: a.source?.title || '',
        source: a.source?.title || '',
        sourceLogoId: '', // NewsAPI doesn't provide logo IDs
        published: Math.floor(new Date(a.dateTime || a.date).getTime() / 1000),
        urgency: a.sentiment > 0.5 ? 2 : a.sentiment < -0.3 ? 1 : 0,
        storyPath: '', // Will use articleUrl instead
        relatedSymbols: matchedSymbols,
        articleUrl: a.url || '',
        imageUrl: a.image || '',
      };
    }).filter((a: RawNewsItem) => a.title && a.published > 0);
  } catch (e: any) {
    console.warn(`[NewsScheduler/NewsAPI] Fetch failed:`, e.message);
    return [];
  }
}

/**
 * Match an article to UAE stock symbols based on keywords in title/body
 */
function matchArticleToSymbols(title: string, body: string): Array<{ symbol: string; logoid: string }> {
  const text = `${title} ${body}`.toLowerCase();
  const matched: Array<{ symbol: string; logoid: string }> = [];

  // Keyword-to-symbol mapping for major UAE companies
  const KEYWORD_MAP: Array<{ keywords: string[]; symbol: string }> = [
    { keywords: ['emaar properties', 'emaar'], symbol: 'DFM:EMAAR' },
    { keywords: ['emaar development'], symbol: 'DFM:EMAARDEV' },
    { keywords: ['aldar properties', 'aldar'], symbol: 'ADX:ALDAR' },
    { keywords: ['first abu dhabi bank', 'fab bank', 'fab '], symbol: 'ADX:FAB' },
    { keywords: ['adnoc distribution', 'adnoc dist'], symbol: 'ADX:ADNOCDIST' },
    { keywords: ['adnoc gas'], symbol: 'ADX:ADNOCGAS' },
    { keywords: ['adnoc logistics', 'adnoc l&s'], symbol: 'ADX:ADNOCLS' },
    { keywords: ['adnoc drilling'], symbol: 'ADX:ADNOCDRILL' },
    { keywords: ['adnoc'], symbol: 'ADX:ADNOC' },
    { keywords: ['international holding company', 'ihc '], symbol: 'ADX:IHC' },
    { keywords: ['emirates nbd'], symbol: 'DFM:EMIRATESNBD' },
    { keywords: ['dubai islamic bank', 'dib '], symbol: 'DFM:DIB' },
    { keywords: ['abu dhabi islamic bank', 'adib'], symbol: 'ADX:ADIB' },
    { keywords: ['etisalat', 'e& '], symbol: 'ADX:EAND' },
    { keywords: ['dewa', 'dubai electricity'], symbol: 'DFM:DEWA' },
    { keywords: ['taqa', 'abu dhabi national energy'], symbol: 'ADX:TAQA' },
    { keywords: ['air arabia'], symbol: 'DFM:AIRARABIA' },
    { keywords: ['damac'], symbol: 'DFM:DAMAC' },
    { keywords: ['dana gas'], symbol: 'ADX:DANA' },
    { keywords: ['du telecom', 'du '], symbol: 'DFM:DU' },
    { keywords: ['mashreq'], symbol: 'DFM:MASQ' },
    { keywords: ['abu dhabi ports', 'ad ports'], symbol: 'ADX:ADPORTS' },
    { keywords: ['fertiglobe'], symbol: 'ADX:FERTIGLB' },
    { keywords: ['presight'], symbol: 'ADX:PRESIGHT' },
    { keywords: ['multiply group'], symbol: 'ADX:MULTIPLY' },
    { keywords: ['dfm', 'dubai financial market'], symbol: 'DFM:DFM' },
    { keywords: ['adx', 'abu dhabi securities'], symbol: 'ADX:ADX' },
    { keywords: ['salik'], symbol: 'DFM:SALIK' },
    { keywords: ['parkin'], symbol: 'DFM:PARKIN' },
    { keywords: ['talabat'], symbol: 'DFM:TALABAT' },
    { keywords: ['borouge'], symbol: 'ADX:BOROUGE' },
    { keywords: ['alpha dhabi'], symbol: 'ADX:ALPHA' },
  ];

  for (const { keywords, symbol } of KEYWORD_MAP) {
    if (keywords.some(kw => text.includes(kw))) {
      matched.push({ symbol, logoid: '' });
    }
  }

  // If no specific match found but it's about UAE markets, tag as general
  if (matched.length === 0) {
    if (text.includes('uae') || text.includes('dubai') || text.includes('abu dhabi')) {
      matched.push({ symbol: 'DFM:DFM', logoid: '' });
      matched.push({ symbol: 'ADX:ADX', logoid: '' });
    }
  }

  return matched.slice(0, 10); // Limit to 10 symbols per article
}

// ─── TradingView Functions (Fallback) ────────────────────────────────────

/**
 * Fetch news for a single symbol from TradingView
 */
async function fetchTVNewsForSymbol(fullSymbol: string, count: number = ARTICLES_PER_SYMBOL): Promise<RawNewsItem[]> {
  try {
    const params = new URLSearchParams({
      client: 'web',
      lang: 'en',
      category: 'base',
      symbol: fullSymbol,
      count: String(count),
    });

    const resp = await fetch(`${TV_NEWS_API_URL}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) return [];

    const data = await resp.json() as any;
    return (data.items || []).map((item: any) => ({
      id: item.id || '',
      title: item.title || '',
      provider: item.provider || '',
      source: item.source || '',
      sourceLogoId: item.sourceLogoId || '',
      published: item.published || 0,
      urgency: item.urgency || 0,
      storyPath: item.storyPath || '',
      relatedSymbols: item.relatedSymbols || [],
    }));
  } catch (e: any) {
    return [];
  }
}

// ─── Database Functions ──────────────────────────────────────────────────

/**
 * Store news articles in the database (with deduplication via externalId)
 */
async function storeArticles(articles: RawNewsItem[]): Promise<number> {
  if (articles.length === 0) return 0;
  const db = await getDb();
  if (!db) return 0;

  let stored = 0;
  for (const article of articles) {
    if (!article.id || !article.title) continue;

    try {
      await db.insert(marketNews).values({
        externalId: article.id,
        title: article.title,
        provider: article.provider || null,
        source: article.source || null,
        sourceLogoId: article.sourceLogoId || null,
        publishedAt: new Date(article.published * 1000),
        urgency: article.urgency || 0,
        storyPath: article.articleUrl || article.storyPath || null,
        relatedSymbols: article.relatedSymbols as any,
      }).onDuplicateKeyUpdate({
        set: { fetchedAt: sql`NOW()` },
      });
      stored++;
    } catch (e: any) {
      // Skip individual insert errors
    }
  }
  return stored;
}

/**
 * Fetch news for a batch of symbols from TradingView with concurrency control
 */
async function fetchTVBatch(symbols: string[]): Promise<number> {
  const allArticles: RawNewsItem[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < symbols.length; i += CONCURRENT_LIMIT) {
    const chunk = symbols.slice(i, i + CONCURRENT_LIMIT);
    const results = await Promise.allSettled(
      chunk.map(sym => fetchTVNewsForSymbol(sym))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const article of result.value) {
          if (!seenIds.has(article.id)) {
            seenIds.add(article.id);
            allArticles.push(article);
          }
        }
      }
    }

    if (i + CONCURRENT_LIMIT < symbols.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const stored = await storeArticles(allArticles);
  return stored;
}

// ─── Scheduler Tasks ─────────────────────────────────────────────────────

/**
 * Primary fetch: NewsAPI.ai for comprehensive UAE market news
 */
async function fetchNewsAPIArticles(): Promise<void> {
  try {
    console.log(`[NewsScheduler] Fetching from NewsAPI.ai...`);

    // Fetch market-level news (DFM + ADX)
    const marketArticles = await fetchFromNewsAPI(UAE_MARKET_CONCEPTS, 50);
    const marketStored = await storeArticles(marketArticles);

    // Fetch company-specific news
    const companyArticles = await fetchFromNewsAPI(UAE_COMPANY_CONCEPTS, 50);
    const companyStored = await storeArticles(companyArticles);

    const total = marketStored + companyStored;
    newsApiArticlesFetched += total;
    totalArticlesFetched += total;
    lastFetchTime = Date.now();
    lastError = null;

    console.log(`[NewsScheduler] NewsAPI.ai fetch complete: ${total} articles stored (${marketStored} market + ${companyStored} company)`);
  } catch (e: any) {
    lastError = `NewsAPI: ${e.message}`;
    console.warn(`[NewsScheduler] NewsAPI.ai fetch failed:`, e.message);
  }
}

/**
 * Secondary fetch: TradingView priority stocks
 */
async function fetchTVPriorityNews(): Promise<void> {
  try {
    console.log(`[NewsScheduler] Fetching TradingView news for ${PRIORITY_SYMBOLS.length} blue-chip stocks...`);
    const stored = await fetchTVBatch(PRIORITY_SYMBOLS);
    tvArticlesFetched += stored;
    totalArticlesFetched += stored;
    lastFetchTime = Date.now();
    console.log(`[NewsScheduler] TradingView priority fetch: ${stored} articles stored`);
  } catch (e: any) {
    lastError = `TV Priority: ${e.message}`;
    console.warn(`[NewsScheduler] TradingView priority fetch failed:`, e.message);
  }
}

/**
 * Rotation: TradingView fetch for remaining stocks
 */
async function fetchTVRotationBatch(): Promise<void> {
  try {
    const allSymbols = ALL_STOCKS.map(s => `${s.exchange}:${s.symbol}`);
    const nonPrioritySymbols = allSymbols.filter(s => !PRIORITY_SYMBOLS.includes(s));

    const startIdx = (batchIndex * BATCH_SIZE) % nonPrioritySymbols.length;
    const batch = nonPrioritySymbols.slice(startIdx, startIdx + BATCH_SIZE);

    if (batch.length === 0) {
      batchIndex = 0;
      return;
    }

    console.log(`[NewsScheduler] TV rotation batch ${batchIndex + 1}: ${batch.length} stocks (${batch[0]}...)`);
    const stored = await fetchTVBatch(batch);
    tvArticlesFetched += stored;
    totalArticlesFetched += stored;
    batchIndex++;
    lastFetchTime = Date.now();

    if (startIdx + BATCH_SIZE >= nonPrioritySymbols.length) {
      batchIndex = 0;
      console.log(`[NewsScheduler] Full TV rotation complete, resetting`);
    }
  } catch (e: any) {
    lastError = `TV Rotation: ${e.message}`;
    console.warn(`[NewsScheduler] TV rotation batch failed:`, e.message);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Get news from the database (fast, cached in DB)
 */
export async function getStoredNews(options: {
  count?: number;
  exchange?: 'DFM' | 'ADX' | 'all';
  symbol?: string;
  search?: string;
} = {}): Promise<{
  items: Array<{
    id: number;
    externalId: string;
    title: string;
    provider: string | null;
    source: string | null;
    sourceLogoId: string | null;
    published: number;
    urgency: number;
    storyPath: string | null;
    relatedSymbols: Array<{ symbol: string; logoid: string }>;
  }>;
  totalCount: number;
  lastUpdated: string;
}> {
  const count = options.count || 50;

  const db = await getDb();
  if (!db) return { items: [], totalCount: 0, lastUpdated: new Date().toISOString() };

  try {
    const conditions: any[] = [];

    if (options.symbol) {
      conditions.push(
        sql`JSON_SEARCH(${marketNews.relatedSymbols}, 'one', ${`%${options.symbol}%`}, NULL, '$[*].symbol') IS NOT NULL`
      );
    }

    if (options.exchange && options.exchange !== 'all') {
      conditions.push(
        sql`JSON_SEARCH(${marketNews.relatedSymbols}, 'one', ${`${options.exchange}:%`}, NULL, '$[*].symbol') IS NOT NULL`
      );
    }

    if (options.search) {
      conditions.push(
        sql`${marketNews.title} LIKE ${`%${options.search}%`}`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db.select()
      .from(marketNews)
      .where(whereClause)
      .orderBy(desc(marketNews.publishedAt))
      .limit(count);

    const [countResult] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(marketNews)
      .where(whereClause);

    return {
      items: items.map((item: any) => ({
        id: item.id,
        externalId: item.externalId,
        title: item.title,
        provider: item.provider,
        source: item.source,
        sourceLogoId: item.sourceLogoId,
        published: Math.floor(item.publishedAt.getTime() / 1000),
        urgency: item.urgency || 0,
        storyPath: item.storyPath,
        relatedSymbols: (item.relatedSymbols as any) || [],
      })),
      totalCount: countResult?.count || 0,
      lastUpdated: new Date(lastFetchTime || Date.now()).toISOString(),
    };
  } catch (e: any) {
    console.warn(`[NewsScheduler] getStoredNews failed:`, e.message);
    return { items: [], totalCount: 0, lastUpdated: new Date().toISOString() };
  }
}

/**
 * Get news for a specific stock symbol from DB (with live fallback)
 */
export async function getStockNews(symbol: string, exchange: string, count: number = 20): Promise<{
  items: Array<{
    id: string;
    title: string;
    provider: string;
    source: string;
    sourceLogoId: string;
    published: number;
    urgency: number;
    storyPath: string;
    relatedSymbols: Array<{ symbol: string; logoid: string }>;
  }>;
  fetchedAt: string;
}> {
  const fullSymbol = `${exchange}:${symbol}`;

  const db = await getDb();
  try {
    if (db) {
      const items = await db.select()
        .from(marketNews)
        .where(
          sql`JSON_SEARCH(${marketNews.relatedSymbols}, 'one', ${fullSymbol}, NULL, '$[*].symbol') IS NOT NULL`
        )
        .orderBy(desc(marketNews.publishedAt))
        .limit(count);

      if (items.length > 0) {
        return {
          items: items.map((item: any) => ({
            id: item.externalId,
            title: item.title,
            provider: item.provider || '',
            source: item.source || '',
            sourceLogoId: item.sourceLogoId || '',
            published: Math.floor(item.publishedAt.getTime() / 1000),
            urgency: item.urgency || 0,
            storyPath: item.storyPath || '',
            relatedSymbols: (item.relatedSymbols as any) || [],
          })),
          fetchedAt: new Date().toISOString(),
        };
      }
    }
  } catch (e: any) {
    // Fall through to live fetch
  }

  // If no DB results, fetch live from TradingView and store
  const liveArticles = await fetchTVNewsForSymbol(fullSymbol, count);
  if (liveArticles.length > 0) {
    await storeArticles(liveArticles);
  }

  return {
    items: liveArticles.map(a => ({
      id: a.id,
      title: a.title,
      provider: a.provider,
      source: a.source,
      sourceLogoId: a.sourceLogoId,
      published: a.published,
      urgency: a.urgency,
      storyPath: a.storyPath,
      relatedSymbols: a.relatedSymbols,
    })),
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Get scheduler status for admin monitoring
 */
export function getNewsSchedulerStatus() {
  return {
    running: newsInterval !== null,
    lastFetchTime: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
    totalArticlesFetched,
    newsApiArticlesFetched,
    tvArticlesFetched,
    currentBatchIndex: batchIndex,
    totalBatches: Math.ceil((ALL_STOCKS.length - PRIORITY_SYMBOLS.length) / BATCH_SIZE),
    lastError,
    prioritySymbolCount: PRIORITY_SYMBOLS.length,
    totalStockCount: ALL_STOCKS.length,
  };
}

/**
 * Manually trigger a full news fetch (for admin use)
 */
export async function triggerFullNewsFetch(): Promise<{ stored: number; newsApi: number; tv: number }> {
  console.log(`[NewsScheduler] Manual full fetch triggered`);

  // Fetch from both sources
  const newsApiBefore = newsApiArticlesFetched;
  const tvBefore = tvArticlesFetched;

  await fetchNewsAPIArticles();
  await fetchTVPriorityNews();

  const newsApiNew = newsApiArticlesFetched - newsApiBefore;
  const tvNew = tvArticlesFetched - tvBefore;

  return { stored: newsApiNew + tvNew, newsApi: newsApiNew, tv: tvNew };
}

/**
 * Clean up old news articles (older than 30 days)
 */
async function cleanupOldNews(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await db.delete(marketNews).where(
      sql`${marketNews.publishedAt} < ${thirtyDaysAgo}`
    );
    console.log(`[NewsScheduler] Cleanup: removed articles older than 30 days`);
  } catch (e: any) {
    console.warn(`[NewsScheduler] Cleanup failed:`, e.message);
  }
}

/**
 * Start the news scheduler
 */
export function startNewsScheduler(): void {
  if (newsInterval) {
    console.log("[NewsScheduler] Already running");
    return;
  }

  console.log("[NewsScheduler] Starting (NewsAPI.ai every 15min + TradingView rotation every 5min)");

  // Initial fetch on startup (after 10s delay to let other services start)
  setTimeout(async () => {
    console.log("[NewsScheduler] Initial fetch from NewsAPI.ai + TradingView...");
    await fetchNewsAPIArticles();
    await fetchTVPriorityNews();
  }, 10_000);

  // NewsAPI.ai fetch every 15 minutes
  newsInterval = setInterval(async () => {
    await fetchNewsAPIArticles();
  }, NEWSAPI_INTERVAL);

  // TradingView priority fetch every 15 minutes (offset by 7.5 min)
  setTimeout(() => {
    setInterval(async () => {
      await fetchTVPriorityNews();
    }, NEWSAPI_INTERVAL);
  }, NEWSAPI_INTERVAL / 2);

  // TradingView rotation batch every 5 minutes
  tvRotationInterval = setInterval(async () => {
    await fetchTVRotationBatch();
  }, TV_ROTATION_INTERVAL);

  // Daily cleanup at midnight
  setInterval(async () => {
    await cleanupOldNews();
  }, 24 * 60 * 60 * 1000);
}

/**
 * Stop the news scheduler
 */
export function stopNewsScheduler(): void {
  if (newsInterval) {
    clearInterval(newsInterval);
    newsInterval = null;
  }
  if (tvRotationInterval) {
    clearInterval(tvRotationInterval);
    tvRotationInterval = null;
  }
  console.log("[NewsScheduler] Stopped");
}
