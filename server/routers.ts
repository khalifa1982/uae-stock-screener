import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ALL_STOCKS, ADX_STOCKS, DFM_STOCKS, SECTORS } from "../shared/stockData";
import { fetchStockData, fetchYahooChart, fetchBatchQuotes, fetchMultipleStocks, getFromMemoryCache, setMemoryCache, clearMemoryCache, fetchFullProfile } from "./stockService";
import { getAllStockSnapshots, getStockSnapshot, upsertStockSnapshot, addToWatchlist, removeFromWatchlist, getUserWatchlist, getMonitorSettingsForUser, upsertMonitorSettings, getUserPresets, savePreset, deletePreset, getUserNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead, deleteNotification, deleteAllNotifications, createNotification, getNotificationPreferences, upsertNotificationPreferences, updateUserProfile, recordVisit, getVisitorStats, recordPageView, getGeoBreakdown, getPageAnalytics, getRecentVisitors } from "./db";
import { invokeLLM } from "./_core/llm";
import { getMonitorStatus, getRecentAlerts, getTodayAlerts, dismissAlert, manualPoll, startVolumeMonitor, stopVolumeMonitor, isUAETradingHours, getNextTradingSession } from "./volumeMonitor";
import { checkAllApiHealth, getApiStatusSnapshot } from "./services/apiStatusService";
import { getCreditMonitorStatus, forceCheckCredits } from "./services/scrapflyCreditMonitor";
import { getCacheMetrics, resetCacheMetrics } from "./services/cacheMetricsService";
import { fetchAllTVStocks, fetchTVStocksByTickers, getTradingViewStats } from "./services/tradingViewService";
import { getTwelveDataStats } from "./services/twelveDataService";
import { fetchSWSCompanyData, getSWSStats, checkSWSHealth, getCanonicalUrlCache } from "./services/simplyWallStService";
import { computeSnowflake, computeMarketAverages, type SnowflakeInput } from "./services/snowflakeEngine";
import { fetchTVNews, fetchUAEMarketNews } from "./services/tvNewsService";
import { fetchTVForecast, fetchTVExtendedFinancials, fetchTVPerformance, computeSeasonality } from "./services/tvExtendedService";
import { fetchChartData, fetchQuote, fetchTechnicalAnalysis, fetchMASummary, fetchAllIndicators, computeOscillatorSignals, fetchBBandsHistory, fetchMACDHistory, fetchRSIHistory, fetchMarketState, fetchStatistics, type TechnicalAnalysis } from "./services/tdDataService";
import { toTwelveDataSymbol } from "./services/tdSymbolMapper";
import { buildOrderBook, fetchAllDFMStocks, fetchDFMStock, getDFMStats, type DFMStockData } from "./services/dfmDataService";
import { getWSStats } from "./services/tdWebSocketService";
import { getChatMessages, postChatMessage, postChatImage, clearAllChatMessages, getOnlineUsersList, registerPollingUser, getChatClearedAt, toggleMessageReaction, ALLOWED_REACTION_EMOJIS } from "./services/chatService";
import { fetchSAOverview, fetchSAFinancials, fetchSADividends, getSAStats, clearSACache } from "./services/stockAnalysisService";
import { fetchMSData } from "./services/marketScreenerService";
import { fetchINVData } from "./services/investingComService";
import { getLatestSummaries, getSummaryByDate, generateDailySummary, getMarketSummaryStatus } from "./services/marketSummaryService";
import { getEarningsTranscript } from "./services/earningsTranscriptService";

// ─── Background refresh state ───────────────────────────────────────
// Prevents multiple simultaneous background refreshes
const refreshInProgress = new Set<string>();

/**
 * Overlay DFM real-time prices on top of TradingView EOD data.
 * TradingView Scanner returns end-of-day data (yesterday's close during market hours).
 * DFM API returns real-time intraday data for DFM-listed stocks.
 * This function merges them: TV provides fundamentals/technicals, DFM provides live prices.
 */
function applyDFMLiveOverlay(snapshot: any, dfmData: DFMStockData): any {
  // Only overlay if DFM has a valid last trade price (> 0 means stock traded today)
  if (!dfmData || dfmData.lastTradePrice <= 0) return snapshot;
  
  const prevClose = dfmData.previousClose || snapshot.previousClose;
  const price = dfmData.lastTradePrice;
  const changePercent = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : snapshot.changePercent;
  
  return {
    ...snapshot,
    price,
    previousClose: prevClose,
    open: dfmData.openingPrice > 0 ? dfmData.openingPrice : snapshot.open,
    dayHigh: dfmData.highestPrice > 0 ? dfmData.highestPrice : snapshot.dayHigh,
    dayLow: dfmData.lowestPrice > 0 ? dfmData.lowestPrice : snapshot.dayLow,
    volume: dfmData.totalVolume > 0 ? dfmData.totalVolume : snapshot.volume,
    changePercent,
    // Keep all TV fundamentals/technicals (PE, EPS, RSI, SMA, etc.)
  };
}

/**
 * Apply DFM live overlay to an array of stock results.
 * Fetches DFM data once and overlays on all DFM stocks in the array.
 */
async function applyDFMOverlayToResults(results: any[]): Promise<any[]> {
  try {
    const dfmStocks = await fetchAllDFMStocks();
    if (dfmStocks.length === 0) return results;
    
    const dfmMap = new Map<string, DFMStockData>();
    for (const d of dfmStocks) dfmMap.set(d.id, d);
    
    return results.map(snap => {
      if (snap.exchange === 'DFM') {
        const dfmData = dfmMap.get(snap.symbol);
        if (dfmData) return applyDFMLiveOverlay(snap, dfmData);
      }
      return snap;
    });
  } catch (e) {
    // DFM overlay is optional — return original results if it fails
    return results;
  }
}

/**
 * Map TradingView data to our internal snapshot format.
 * TradingView is the PRIMARY data source for all UAE stocks (174 stocks, both ADX & DFM).
 */
function tvToSnapshot(tv: any, stock: { symbol: string; exchange: string; name: string; sector: string; yahooSymbol: string }) {
  return {
    symbol: stock.symbol,
    exchange: stock.exchange,
    name: stock.name,
    sector: stock.sector,
    yahooSymbol: stock.yahooSymbol,
    logoUrl: tv.logoId ? `https://s3-symbol-logo.tradingview.com/${tv.logoId}--big.svg` : null,
    description: tv.description ?? null,
    price: tv.close ?? null,
    previousClose: tv.close != null && tv.changeAbs != null ? tv.close - tv.changeAbs : null,
    open: tv.open ?? null,
    dayHigh: tv.high ?? null,
    dayLow: tv.low ?? null,
    volume: tv.volume ?? null,
    avgVolume: null as number | null,
    marketCap: tv.marketCap ?? null,
    pe: tv.pe ?? null,
    eps: tv.eps ?? null,
    week52High: tv.allTimeHigh ?? null,
    week52Low: tv.allTimeLow ?? null,
    dividendYield: tv.dividendYield ?? null,
    beta: tv.beta ?? null,
    changePercent: tv.change ?? null,
    rsi: tv.rsi ?? null,
    sma20: tv.sma20 ?? null,
    sma50: tv.sma50 ?? null,
    ema12: tv.ema20 ?? null, // Map EMA20 to ema12 slot
    ema26: tv.ema50 ?? null, // Map EMA50 to ema26 slot
    volumeRatio: null as number | null,
    // Extended TV data (not stored in DB but returned in API)
    sma200: tv.sma200 ?? null,
    ema200: tv.ema200 ?? null,
    macdValue: tv.macdValue ?? null,
    macdSignal: tv.macdSignal ?? null,
    recommendAll: tv.recommendAll ?? null,
    grossMargin: tv.grossMargin ?? null,
    operatingMargin: tv.operatingMargin ?? null,
    netIncome: tv.netIncome ?? null,
    totalRevenue: tv.totalRevenue ?? null,
    totalDebt: tv.totalDebt ?? null,
    totalAssets: tv.totalAssets ?? null,
    ebitda: tv.ebitda ?? null,
    freeCashFlow: tv.freeCashFlow ?? null,
    returnOnEquity: tv.returnOnEquity ?? null,
    debtToEquity: tv.debtToEquity ?? null,
    currentRatio: tv.currentRatio ?? null,
    priceToBook: tv.priceToBook ?? null,
    priceToSales: tv.priceToSales ?? null,
    sharesOutstanding: tv.sharesOutstanding ?? null,
    perfWeek: tv.perfWeek ?? null,
    perfMonth: tv.perfMonth ?? null,
    perf3Month: tv.perf3Month ?? null,
    perfYear: tv.perfYear ?? null,
  };
}

async function backgroundRefresh(exchange: string) {
  const key = `bg-refresh-${exchange}`;
  if (refreshInProgress.has(key)) return; // Already refreshing
  refreshInProgress.add(key);
  
  try {
    console.log(`[Performance] Starting background refresh for ${exchange} via TradingView + DFM live overlay...`);
    const startTime = Date.now();
    
    // PRIMARY: Fetch ALL stocks from TradingView Scanner (covers both ADX & DFM)
    // TradingView provides fundamentals, technicals, and EOD prices
    const tvStocks = await fetchAllTVStocks();
    
    // Build a map from TV ticker to TV data: "ADX:IHC" → data
    const tvMap = new Map<string, any>();
    for (const tv of tvStocks) {
      const parts = tv.ticker.split(':');
      if (parts.length === 2) {
        tvMap.set(`${parts[0]}:${parts[1]}`, tv);
      }
    }
    
    // LIVE OVERLAY: Fetch DFM real-time prices (covers all DFM stocks)
    // DFM API returns intraday live prices, which are more current than TV during market hours
    let dfmMap = new Map<string, DFMStockData>();
    try {
      const dfmStocks = await fetchAllDFMStocks();
      for (const d of dfmStocks) {
        dfmMap.set(d.id, d);
      }
      console.log(`[Performance] DFM live overlay: ${dfmStocks.length} stocks fetched`);
    } catch (e) {
      console.warn(`[Performance] DFM live overlay failed, using TV data only`);
    }
    
    const freshResults: any[] = [];
    const allStocksForExchange = exchange === "ADX" ? ADX_STOCKS : exchange === "DFM" ? DFM_STOCKS : ALL_STOCKS;
    
    for (const stock of allStocksForExchange) {
      const tvKey = `${stock.exchange}:${stock.symbol}`;
      const tvData = tvMap.get(tvKey);
      
      if (tvData) {
        let snapshot = tvToSnapshot(tvData, stock);
        // Apply DFM live price overlay for DFM stocks
        if (stock.exchange === 'DFM') {
          const dfmData = dfmMap.get(stock.symbol);
          if (dfmData) {
            snapshot = applyDFMLiveOverlay(snapshot, dfmData);
          }
        }
        try { await upsertStockSnapshot(snapshot); } catch (e) { /* ignore */ }
        freshResults.push(snapshot);
      } else {
        // Stock not found in TradingView — try DFM data directly for DFM stocks
        if (stock.exchange === 'DFM') {
          const dfmData = dfmMap.get(stock.symbol);
          if (dfmData && dfmData.lastTradePrice > 0) {
            const snapshot = {
              symbol: stock.symbol, exchange: stock.exchange, name: stock.name,
              sector: stock.sector, yahooSymbol: stock.yahooSymbol, logoUrl: null, description: null,
              price: dfmData.lastTradePrice,
              previousClose: dfmData.previousClose,
              open: dfmData.openingPrice > 0 ? dfmData.openingPrice : null,
              dayHigh: dfmData.highestPrice > 0 ? dfmData.highestPrice : null,
              dayLow: dfmData.lowestPrice > 0 ? dfmData.lowestPrice : null,
              volume: dfmData.totalVolume > 0 ? dfmData.totalVolume : null,
              avgVolume: null, marketCap: null, pe: null, eps: null,
              week52High: dfmData.high52Week > 0 ? dfmData.high52Week : null,
              week52Low: dfmData.low52Week > 0 ? dfmData.low52Week : null,
              dividendYield: null, beta: null,
              changePercent: dfmData.changePercent,
              rsi: null, sma20: null, sma50: null, ema12: null, ema26: null, volumeRatio: null,
            };
            try { await upsertStockSnapshot(snapshot); } catch (e) { /* ignore */ }
            freshResults.push(snapshot);
            continue;
          }
        }
        freshResults.push({
          symbol: stock.symbol, exchange: stock.exchange, name: stock.name,
          sector: stock.sector, yahooSymbol: stock.yahooSymbol,
          price: null, previousClose: null, open: null, dayHigh: null, dayLow: null,
          volume: null, avgVolume: null, marketCap: null, pe: null, eps: null,
          week52High: null, week52Low: null, dividendYield: null, beta: null,
          changePercent: null, rsi: null, sma20: null, sma50: null, ema12: null,
          ema26: null, volumeRatio: null,
        });
      }
    }
    
    // Update memory cache with fresh data
    setMemoryCache(`fetchAll-${exchange}`, freshResults);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const matched = freshResults.filter(r => r.price != null).length;
    const dfmOverlaid = freshResults.filter(r => (r as any)._dfmLive).length;
    console.log(`[Performance] Background refresh for ${exchange} completed in ${elapsed}s (${matched}/${freshResults.length} stocks with data, DFM live: ${dfmMap.size})`);
  } catch (e) {
    console.warn(`[Performance] Background refresh failed for ${exchange}:`, e);
  } finally {
    refreshInProgress.delete(key);
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(100).optional(),
        mobileNumber: z.string().max(20).nullable().optional(),
        avatarEmoji: z.string().max(8).nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const updated = await updateUserProfile(ctx.user.openId, input);
        if (!updated) throw new Error("Failed to update profile");
        return {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          mobileNumber: updated.mobileNumber,
          avatarEmoji: updated.avatarEmoji,
          role: updated.role,
          createdAt: updated.createdAt,
        };
      }),
    getProfile: protectedProcedure.query(async ({ ctx }) => {
      const { getUserByOpenId } = await import("./db");
      const user = await getUserByOpenId(ctx.user.openId);
      if (!user) throw new Error("User not found");
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        avatarEmoji: user.avatarEmoji,
        role: user.role,
        createdAt: user.createdAt,
        openId: user.openId,
      };
    }),
  }),

  stocks: router({
    list: publicProcedure
      .input(z.object({
        exchange: z.enum(["ADX", "DFM", "ALL"]).optional().default("ALL"),
      }).optional())
      .query(({ input }) => {
        const exchange = input?.exchange || "ALL";
        if (exchange === "ADX") return ADX_STOCKS;
        if (exchange === "DFM") return DFM_STOCKS;
        return ALL_STOCKS;
      }),

    sectors: publicProcedure.query(() => SECTORS),

    fetchOne: publicProcedure
      .input(z.object({ symbol: z.string(), exchange: z.enum(["ADX", "DFM"]) }))
      .query(async ({ input }) => {
        const stock = ALL_STOCKS.find(s => s.symbol === input.symbol && s.exchange === input.exchange);
        if (!stock) throw new Error("Stock not found");
        
        // Check DB cache first
        const cached = await getStockSnapshot(input.symbol, input.exchange);
        if (cached && cached.updatedAt) {
          const age = Date.now() - new Date(cached.updatedAt).getTime();
          if (age < 5 * 60 * 1000 && cached.price) {
            // Apply DFM live overlay even on cached data
            if (stock.exchange === 'DFM') {
              try {
                const dfmData = await fetchDFMStock(stock.symbol);
                if (dfmData) return applyDFMLiveOverlay(cached, dfmData);
              } catch (e) { /* fallback to cached */ }
            }
            return cached;
          }
        }
        
        // PRIMARY: TradingView + DFM overlay
        const tvKey = `${stock.exchange}:${stock.symbol}`;
        const tvStocks = await fetchTVStocksByTickers([tvKey]);
        if (tvStocks.length > 0) {
          let snapshot = tvToSnapshot(tvStocks[0], stock);
          // Apply DFM live overlay for DFM stocks
          if (stock.exchange === 'DFM') {
            try {
              const dfmData = await fetchDFMStock(stock.symbol);
              if (dfmData) snapshot = applyDFMLiveOverlay(snapshot, dfmData);
            } catch (e) { /* use TV data */ }
          }
          try { await upsertStockSnapshot(snapshot); } catch (e) { /* ignore */ }
          return snapshot;
        }
        
        // FALLBACK: TwelveData quote
        const data = await fetchStockData(stock);
        return { ...data, ...stock };
      }),

    // PERFORMANCE OPTIMIZED: Cache-first loading with background refresh
    fetchAll: publicProcedure
      .input(z.object({
        exchange: z.enum(["ADX", "DFM", "ALL"]).optional().default("ALL"),
        forceRefresh: z.boolean().optional().default(false),
      }).optional())
      .query(async ({ input }) => {
        const exchange = input?.exchange || "ALL";
        const forceRefresh = input?.forceRefresh || false;
        const cacheKey = `fetchAll-${exchange}`;
        
        // 1. Check in-memory cache first (instant, ~0ms)
        if (!forceRefresh) {
          const memCached = getFromMemoryCache(cacheKey);
          if (memCached && memCached.length > 0) {
            // Always apply DFM live overlay on cached data for freshest prices
            const overlaid = await applyDFMOverlayToResults(memCached);
            return overlaid;
          }
        }
        
        // 2. Check DB cache (fast, ~200ms)
        if (!forceRefresh) {
          const cached = await getAllStockSnapshots(exchange === "ALL" ? undefined : exchange);
          const expectedCount = exchange === "ADX" ? ADX_STOCKS.length : exchange === "DFM" ? DFM_STOCKS.length : ALL_STOCKS.length;
          // Only use DB cache if it has a reasonable number of stocks (>80% coverage)
          if (cached.length > expectedCount * 0.8) {
            let results = cached.map(snap => {
              const info = ALL_STOCKS.find(s => s.symbol === snap.symbol);
              return { ...snap, name: info?.name, sector: info?.sector, yahooSymbol: info?.yahooSymbol };
            });
            
            // Apply DFM live overlay for fresh prices
            results = await applyDFMOverlayToResults(results);
            
            // Store in memory cache for next request
            setMemoryCache(cacheKey, results);
            
            // Check if data is stale and trigger background refresh
            const newest = cached.reduce((a, b) => 
              new Date(a.updatedAt) > new Date(b.updatedAt) ? a : b
            );
            const age = Date.now() - new Date(newest.updatedAt).getTime();
            if (age > 15 * 60 * 1000) {
              // Trigger background refresh (non-blocking!)
              backgroundRefresh(exchange).catch(() => {});
            }
            
            // Return fresh-overlaid data
            return results;
          } else if (cached.length > 0) {
            // DB has partial data - trigger background refresh to fill gaps
            backgroundRefresh(exchange).catch(() => {});
          }
        }
        
        // 3. No cache at all — must fetch synchronously (first load only)
        // PRIMARY: Use TradingView Scanner for ALL stocks (both ADX & DFM)
        const tvStocks = await fetchAllTVStocks();
        const tvMap = new Map<string, any>();
        for (const tv of tvStocks) {
          const parts = tv.ticker.split(':');
          if (parts.length === 2) tvMap.set(`${parts[0]}:${parts[1]}`, tv);
        }
        
        // Fetch DFM live data for overlay
        let dfmMap = new Map<string, DFMStockData>();
        try {
          const dfmStocks = await fetchAllDFMStocks();
          for (const d of dfmStocks) dfmMap.set(d.id, d);
        } catch (e) { /* DFM overlay optional */ }
        
        const stocks = exchange === "ADX" ? ADX_STOCKS : exchange === "DFM" ? DFM_STOCKS : ALL_STOCKS;
        const results = [];
        for (const stock of stocks) {
          const tvKey = `${stock.exchange}:${stock.symbol}`;
          const tvData = tvMap.get(tvKey);
          
          if (tvData) {
            let snapshot = tvToSnapshot(tvData, stock);
            // Apply DFM live overlay for DFM stocks
            if (stock.exchange === 'DFM') {
              const dfmData = dfmMap.get(stock.symbol);
              if (dfmData) snapshot = applyDFMLiveOverlay(snapshot, dfmData);
            }
            try { await upsertStockSnapshot(snapshot); } catch (e) { /* ignore */ }
            results.push(snapshot);
          } else {
            // Try DFM data directly for DFM stocks not in TV
            if (stock.exchange === 'DFM') {
              const dfmData = dfmMap.get(stock.symbol);
              if (dfmData && dfmData.lastTradePrice > 0) {
                results.push({
                  symbol: stock.symbol, exchange: stock.exchange, name: stock.name,
                  sector: stock.sector, yahooSymbol: stock.yahooSymbol, logoUrl: null, description: null,
                  price: dfmData.lastTradePrice, previousClose: dfmData.previousClose,
                  open: dfmData.openingPrice > 0 ? dfmData.openingPrice : null,
                  dayHigh: dfmData.highestPrice > 0 ? dfmData.highestPrice : null,
                  dayLow: dfmData.lowestPrice > 0 ? dfmData.lowestPrice : null,
                  volume: dfmData.totalVolume > 0 ? dfmData.totalVolume : null,
                  avgVolume: null, marketCap: null, pe: null, eps: null,
                  week52High: null, week52Low: null, dividendYield: null, beta: null,
                  changePercent: dfmData.changePercent,
                  rsi: null, sma20: null, sma50: null, ema12: null, ema26: null, volumeRatio: null,
                });
                continue;
              }
            }
            results.push({
              symbol: stock.symbol, exchange: stock.exchange, name: stock.name,
              sector: stock.sector, yahooSymbol: stock.yahooSymbol,
              price: null, previousClose: null, open: null, dayHigh: null, dayLow: null,
              volume: null, avgVolume: null, marketCap: null, pe: null, eps: null,
              week52High: null, week52Low: null, dividendYield: null, beta: null,
              changePercent: null, rsi: null, sma20: null, sma50: null, ema12: null,
              ema26: null, volumeRatio: null,
            });
          }
        }
        
        // Cache the results
        setMemoryCache(cacheKey, results);
        return results;
      }),

    // Fast DFM ticker endpoint — lightweight, returns only price + change for all DFM stocks
    // Used by the ticker bar for real-time updates every 5 seconds
    dfmTicker: publicProcedure.query(async () => {
      try {
        const dfmStocks = await fetchAllDFMStocks();
        const result: Record<string, { price: number; changePercent: number; previousClose: number }> = {};
        for (const d of dfmStocks) {
          if (d.lastTradePrice > 0) {
            result[d.id] = {
              price: d.lastTradePrice,
              changePercent: d.changePercent,
              previousClose: d.previousClose,
            };
          }
        }
        return result;
      } catch (e) {
        return {} as Record<string, { price: number; changePercent: number; previousClose: number }>;
      }
    }),

    chart: publicProcedure
      .input(z.object({
        symbol: z.string(),
        range: z.enum(["1d", "1mo", "3mo", "6mo", "1y", "2y", "5y"]).optional().default("3mo"),
        interval: z.enum(["1d", "1wk", "1mo", "15min", "5min", "1h"]).optional().default("1d"),
      }))
      .query(async ({ input }) => {
        const stock = ALL_STOCKS.find(s => s.symbol === input.symbol);
        if (!stock) throw new Error("Stock not found");
        return fetchYahooChart(stock.yahooSymbol, input.range, input.interval);
      }),

    detail: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        const stock = ALL_STOCKS.find(s => s.symbol === input.symbol);
        if (!stock) throw new Error("Stock not found");
        
        // PRIMARY: Try TradingView first (works for ALL UAE stocks)
        const tvKey = `${stock.exchange}:${stock.symbol}`;
        const tvStocks = await fetchTVStocksByTickers([tvKey]);
        if (tvStocks.length > 0) {
          const tvData = tvStocks[0];
          let result: any = {
            ...stock,
            price: tvData.close ?? null,
            previousClose: tvData.close != null && tvData.changeAbs != null ? tvData.close - tvData.changeAbs : null,
            open: tvData.open ?? null,
            dayHigh: tvData.high ?? null,
            dayLow: tvData.low ?? null,
            volume: tvData.volume ?? null,
            avgVolume: null,
            marketCap: tvData.marketCap ?? null,
            pe: tvData.pe ?? null,
            eps: tvData.eps ?? null,
            week52High: tvData.allTimeHigh ?? null,
            week52Low: tvData.allTimeLow ?? null,
            dividendYield: tvData.dividendYield ?? null,
            beta: tvData.beta ?? null,
            changePercent: tvData.change ?? null,
            rsi: tvData.rsi ?? null,
            sma20: tvData.sma20 ?? null,
            sma50: tvData.sma50 ?? null,
            ema12: tvData.ema20 ?? null,
            ema26: tvData.ema50 ?? null,
            volumeRatio: null,
            sma200: tvData.sma200 ?? null,
            ema200: tvData.ema200 ?? null,
            macdValue: tvData.macdValue ?? null,
            macdSignal: tvData.macdSignal ?? null,
            recommendAll: tvData.recommendAll ?? null,
          };
          
          // Apply DFM live overlay for DFM stocks (real-time prices)
          if (stock.exchange === 'DFM') {
            try {
              const dfmData = await fetchDFMStock(stock.symbol);
              if (dfmData) result = applyDFMLiveOverlay(result, dfmData);
            } catch (e) { /* use TV data */ }
          }
          
          return result;
        }
        
        // FALLBACK: TwelveData quote
        const data = await fetchStockData(stock);
        return { ...data, ...stock };
      }),

    orderBook: publicProcedure
      .input(z.object({ symbol: z.string(), exchange: z.enum(["ADX", "DFM"]) }))
      .query(async ({ input }) => {
        const stock = ALL_STOCKS.find(s => s.symbol === input.symbol && s.exchange === input.exchange);
        if (!stock) throw new Error("Stock not found");

        // Get TradingView data for technical levels
        const tvKey = `${stock.exchange}:${stock.symbol}`;
        const tvStocks = await fetchTVStocksByTickers([tvKey]);
        const tvData = tvStocks.length > 0 ? tvStocks[0] : null;

        if (!tvData || !tvData.close) {
          throw new Error("No price data available");
        }

        const orderBook = await buildOrderBook(input.symbol, input.exchange, {
          close: tvData.close,
          open: tvData.open,
          high: tvData.high,
          low: tvData.low,
          volume: tvData.volume,
          changeAbs: tvData.changeAbs,
          change: tvData.change,
          bbLower: tvData.bbLower,
          bbUpper: tvData.bbUpper,
          pivotS1: tvData.pivotS1,
          pivotS2: tvData.pivotS2,
          pivotS3: tvData.pivotS3,
          pivotR1: tvData.pivotR1,
          pivotR2: tvData.pivotR2,
          pivotR3: tvData.pivotR3,
          pivotMiddle: tvData.pivotMiddle,
          sma20: tvData.sma20,
          sma50: tvData.sma50,
          atr: tvData.atr,
        });

        return orderBook;
      }),

    screen: publicProcedure
      .input(z.object({
        exchange: z.enum(["ADX", "DFM", "ALL"]).optional().default("ALL"),
        sector: z.string().optional(),
        minPE: z.number().optional(),
        maxPE: z.number().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        minMarketCap: z.number().optional(),
        maxMarketCap: z.number().optional(),
        minVolume: z.number().optional(),
        minRSI: z.number().optional(),
        maxRSI: z.number().optional(),
        minChangePercent: z.number().optional(),
        maxChangePercent: z.number().optional(),
        aboveSMA50: z.boolean().optional(),
        goldenCross: z.boolean().optional(),
        highVolume: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        // ALWAYS use TradingView as primary data source for screening
        // This ensures ALL stocks (ADX + DFM) have data
        const tvStocks = await fetchAllTVStocks();
        const tvMap = new Map<string, any>();
        for (const tv of tvStocks) {
          const parts = tv.ticker.split(':');
          if (parts.length === 2) tvMap.set(`${parts[0]}:${parts[1]}`, tv);
        }
        
        const stockList = input.exchange === "ADX" ? ADX_STOCKS : input.exchange === "DFM" ? DFM_STOCKS : ALL_STOCKS;
        let results: any[] = stockList.map(stock => {
          const tvData = tvMap.get(`${stock.exchange}:${stock.symbol}`);
          if (tvData) return tvToSnapshot(tvData, stock);
          return { symbol: stock.symbol, exchange: stock.exchange, name: stock.name, sector: stock.sector, yahooSymbol: stock.yahooSymbol, logoUrl: null, description: null, price: null, previousClose: null, open: null, dayHigh: null, dayLow: null, volume: null, avgVolume: null, marketCap: null, pe: null, eps: null, week52High: null, week52Low: null, dividendYield: null, beta: null, changePercent: null, rsi: null, sma20: null, sma50: null, ema12: null, ema26: null, volumeRatio: null };
        });

        if (input.sector) results = results.filter(s => s.sector === input.sector);
        if (input.minPE !== undefined) results = results.filter(s => s.pe != null && s.pe >= input.minPE!);
        if (input.maxPE !== undefined) results = results.filter(s => s.pe != null && s.pe <= input.maxPE!);
        if (input.minPrice !== undefined) results = results.filter(s => s.price != null && s.price >= input.minPrice!);
        if (input.maxPrice !== undefined) results = results.filter(s => s.price != null && s.price <= input.maxPrice!);
        if (input.minMarketCap !== undefined) results = results.filter(s => s.marketCap != null && s.marketCap >= input.minMarketCap!);
        if (input.maxMarketCap !== undefined) results = results.filter(s => s.marketCap != null && s.marketCap <= input.maxMarketCap!);
        if (input.minVolume !== undefined) results = results.filter(s => s.volume != null && s.volume >= input.minVolume!);
        if (input.minRSI !== undefined) results = results.filter(s => s.rsi != null && s.rsi >= input.minRSI!);
        if (input.maxRSI !== undefined) results = results.filter(s => s.rsi != null && s.rsi <= input.maxRSI!);
        if (input.minChangePercent !== undefined) results = results.filter(s => s.changePercent != null && s.changePercent >= input.minChangePercent!);
        if (input.maxChangePercent !== undefined) results = results.filter(s => s.changePercent != null && s.changePercent <= input.maxChangePercent!);
        if (input.aboveSMA50) results = results.filter(s => s.price != null && s.sma50 != null && s.price > s.sma50);
        if (input.goldenCross) results = results.filter(s => s.sma20 != null && s.sma50 != null && s.sma20 > s.sma50);
        if (input.highVolume) results = results.filter(s => s.volumeRatio != null && s.volumeRatio > 1.5);

        return results;
      }),

    // Full company profile with financials, BOD, etc.
    profile: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        const stock = ALL_STOCKS.find(s => s.symbol === input.symbol);
        if (!stock) throw new Error("Stock not found");
        
        // Always fetch TradingView data as supplement (works for ALL stocks)
        let tvData: any = null;
        try {
          const tvKey = `${stock.exchange}:${stock.symbol}`;
          const tvStocks = await fetchTVStocksByTickers([tvKey]);
          if (tvStocks.length > 0) tvData = tvStocks[0];
        } catch (e) { /* ignore TV errors */ }
        
        // TradingView is the sole data source for profiles
        if (!tvData) return { stock, profile: null, available: false };
        const tv = tvData || {} as any;
        
        // Helper: pick first non-null value
        const pick = (...vals: any[]) => {
          for (const v of vals) { if (v != null && v !== 0) return v; }
          return null;
        };
        
        const profile = {
          // Company info (TradingView only)
          name: tv.description || null,
          description: tv.description || null,
          sector: tv.sector || stock.sector || null,
          industry: tv.industry || null,
          website: null,
          logo: tv.logoId ? `https://s3-symbol-logo.tradingview.com/${tv.logoId}--big.svg` : null,
          fullTimeEmployees: tv.employees ?? null,
          country: tv.country || 'United Arab Emirates',
          city: null,
          phone: null,
          officers: [],
          // Key Stats - Valuation (TradingView)
          marketCap: tv.marketCap ?? null,
          enterpriseValue: tv.enterpriseValue ?? null,
          trailingPE: tv.pe ?? null,
          forwardPE: null,
          pegRatio: tv.pegRatio ?? null,
          priceToSales: tv.priceToSales ?? null,
          priceToBook: tv.priceToBook ?? null,
          evToRevenue: null,
          evToEbitda: tv.evToEbitda ?? null,
          // Key Stats - Profitability (TradingView)
          totalRevenue: tv.totalRevenue ?? null,
          revenueGrowth: null,
          grossMargin: tv.grossMargin != null ? tv.grossMargin / 100 : null,
          ebitdaMargin: null,
          operatingMargin: tv.operatingMargin != null ? tv.operatingMargin / 100 : null,
          profitMargin: tv.afterTaxMargin != null ? tv.afterTaxMargin / 100 : null,
          returnOnEquity: tv.returnOnEquity != null ? tv.returnOnEquity / 100 : null,
          returnOnAssets: tv.returnOnAssets != null ? tv.returnOnAssets / 100 : null,
          // Key Stats - Financial Health (TradingView)
          totalCash: null,
          totalDebt: tv.totalDebt ?? null,
          debtToEquity: tv.debtToEquity ?? null,
          currentRatio: tv.currentRatio ?? null,
          quickRatio: tv.quickRatio ?? null,
          bookValue: tv.bookValuePerShare ?? null,
          freeCashflow: tv.freeCashFlow ?? null,
          operatingCashflow: tv.operatingCashFlow ?? null,
          // Key Stats - Per Share (TradingView)
          trailingEps: tv.eps ?? null,
          forwardEps: tv.epsForecast ?? null,
          revenuePerShare: null,
          // Key Stats - Trading (TradingView)
          beta: tv.beta ?? null,
          fiftyTwoWeekHigh: tv.allTimeHigh ?? null,
          fiftyTwoWeekLow: tv.allTimeLow ?? null,
          fiftyDayAverage: tv.sma50 ?? null,
          twoHundredDayAverage: tv.sma200 ?? null,
          sharesOutstanding: tv.sharesOutstanding ?? null,
          floatShares: null,
          heldPercentInsiders: null,
          heldPercentInstitutions: null,
          shortRatio: null,
          // Dividends (TradingView)
          dividendRate: null,
          dividendYield: tv.dividendYield != null ? tv.dividendYield / 100 : null,
          exDividendDate: null,
          payoutRatio: null,
          fiveYearAvgDividendYield: null,
          trailingAnnualDividendRate: null,
          trailingAnnualDividendYield: null,
          // Analyst (TradingView recommendations)
          targetMeanPrice: null,
          targetHighPrice: null,
          targetLowPrice: null,
          targetMedianPrice: null,
          recommendationMean: tv.recommendAll ?? null,
          recommendationKey: tv.recommendAll != null ? (tv.recommendAll > 0.3 ? 'buy' : tv.recommendAll < -0.3 ? 'sell' : 'hold') : null,
          numberOfAnalystOpinions: null,
          recommendations: [],
          // Earnings (not available from TradingView)
          earnings: [],
          // Financial Statements (not available from TradingView scanner)
          incomeStatement: [],
          balanceSheet: [],
          cashFlow: [],
          // Insider Holders (not available from TradingView)
          insiderHolders: [],
          // Trading Info (TradingView)
          previousClose: tv.close != null && tv.changeAbs != null ? tv.close - tv.changeAbs : null,
          open: tv.open ?? null,
          dayHigh: tv.high ?? null,
          dayLow: tv.low ?? null,
          volume: tv.volume ?? null,
          averageVolume: null,
          averageVolume10days: null,
          // ─── TradingView Comprehensive Data ───
          // Volume Averages
          tvAvgVolume10d: tv.avgVolume10d ?? null,
          tvAvgVolume30d: tv.avgVolume30d ?? null,
          tvAvgVolume60d: tv.avgVolume60d ?? null,
          tvAvgVolume90d: tv.avgVolume90d ?? null,
          // Valuation
          tvPriceToFreeCashFlow: tv.priceToFreeCashFlow ?? null,
          tvEnterpriseValue: tv.enterpriseValue ?? null,
          tvEVToEBITDA: tv.evToEbitda ?? null,
          // Income Statement
          tvTotalRevenue: tv.totalRevenue ?? null,
          tvGrossProfit: tv.grossProfit ?? null,
          tvNetIncome: tv.netIncome ?? null,
          tvEPS: tv.eps ?? null,
          tvEPSDiluted: tv.epsDiluted ?? null,
          tvEBITDA: tv.ebitda ?? null,
          tvEPSForecast: tv.epsForecast ?? null,
          // Balance Sheet
          tvTotalAssets: tv.totalAssets ?? null,
          tvTotalLiabilities: tv.totalLiabilities ?? null,
          tvTotalDebt: tv.totalDebt ?? null,
          tvTotalCurrentAssets: tv.totalCurrentAssets ?? null,
          tvSharesOutstanding: tv.sharesOutstanding ?? null,
          tvTotalEquity: tv.totalAssets != null && tv.totalLiabilities != null ? tv.totalAssets - tv.totalLiabilities : null,
          // Cash Flow
          tvFreeCashFlow: tv.freeCashFlow ?? null,
          // Profitability (normalized to decimal)
          tvGrossMargin: tv.grossMargin != null ? tv.grossMargin / 100 : null,
          tvOperatingMargin: tv.operatingMargin != null ? tv.operatingMargin / 100 : null,
          tvPreTaxMargin: tv.preTaxMargin != null ? tv.preTaxMargin / 100 : null,
          tvNetMargin: tv.netMargin != null ? tv.netMargin / 100 : null,
          tvROE: tv.returnOnEquity != null ? tv.returnOnEquity / 100 : null,
          tvROA: tv.returnOnAssets != null ? tv.returnOnAssets / 100 : null,
          tvROIC: tv.returnOnInvestedCapital != null ? tv.returnOnInvestedCapital / 100 : null,
          // Dividends
          tvDividendYield: tv.dividendYield != null ? tv.dividendYield / 100 : null,
          tvDividendPerShare: tv.dividendPerShare ?? null,
          // Ratios
          tvCurrentRatio: tv.currentRatio ?? null,
          tvQuickRatio: tv.quickRatio ?? null,
          tvDebtToEquity: tv.debtToEquity ?? null,
          tvEmployees: tv.employees ?? null,
          // ─── Technical Analysis ───
          // Recommendations
          tvRecommendation: tv.recommendAll ?? null,
          tvRecommendMA: tv.recommendMA ?? null,
          tvRecommendOscillators: tv.recommendOscillators ?? null,
          // Oscillators
          tvRSI: tv.rsi ?? null,
          tvRSIPrev: tv.rsiPrev ?? null,
          tvStochK: tv.stochK ?? null,
          tvStochD: tv.stochD ?? null,
          tvCCI20: tv.cci20 ?? null,
          tvADX: tv.adx ?? null,
          tvAO: tv.awesomeOscillator ?? null,
          tvMomentum: tv.momentum ?? null,
          tvMACD: tv.macdValue ?? null,
          tvMACDSignal: tv.macdSignal ?? null,
          tvBBUpper: tv.bbUpper ?? null,
          tvBBLower: tv.bbLower ?? null,
          // Moving Averages (all 17)
          tvSMA5: tv.sma5 ?? null,
          tvSMA10: tv.sma10 ?? null,
          tvSMA20: tv.sma20 ?? null,
          tvSMA30: tv.sma30 ?? null,
          tvSMA50: tv.sma50 ?? null,
          tvSMA100: tv.sma100 ?? null,
          tvSMA200: tv.sma200 ?? null,
          tvEMA5: tv.ema5 ?? null,
          tvEMA10: tv.ema10 ?? null,
          tvEMA20: tv.ema20 ?? null,
          tvEMA30: tv.ema30 ?? null,
          tvEMA50: tv.ema50 ?? null,
          tvEMA100: tv.ema100 ?? null,
          tvEMA200: tv.ema200 ?? null,
          tvIchimoku: tv.ichimokuBaseLine ?? null,
          tvVWMA: tv.vwma ?? null,
          tvHullMA9: tv.hullMA9 ?? null,
          // Pivot Points
          tvPivotS3: tv.pivotS3 ?? null,
          tvPivotS2: tv.pivotS2 ?? null,
          tvPivotS1: tv.pivotS1 ?? null,
          tvPivotMiddle: tv.pivotMiddle ?? null,
          tvPivotR1: tv.pivotR1 ?? null,
          tvPivotR2: tv.pivotR2 ?? null,
          tvPivotR3: tv.pivotR3 ?? null,
          // Performance (raw TV values, already in %)
          tvPerfWeek: tv.perfWeek ?? null,
          tvPerfMonth: tv.perfMonth ?? null,
          tvPerf3Month: tv.perf3Month ?? null,
          tvPerf6Month: tv.perf6Month ?? null,
          tvPerfYTD: tv.perfYTD ?? null,
          tvPerfYear: tv.perfYear ?? null,
          tvPerf5Year: tv.perf5Year ?? null,
          tvPerfAllTime: tv.perfAllTime ?? null,
          // Volatility
          tvVolatilityDay: tv.volatilityDay ?? null,
          tvVolatilityWeek: tv.volatilityWeek ?? null,
          tvVolatilityMonth: tv.volatilityMonth ?? null,
          tvATR: tv.atr ?? null,
          tvBeta: tv.beta ?? null,
        };
        return { stock, profile, available: true };
      }),

    // Top movers - gainers and losers
    topMovers: publicProcedure
      .input(z.object({
        exchange: z.enum(["ADX", "DFM", "ALL"]).optional().default("ALL"),
        limit: z.number().optional().default(5),
      }).optional())
      .query(async ({ input }) => {
        const exchange = input?.exchange || "ALL";
        const limit = input?.limit || 5;
        const cacheKey = `fetchAll-${exchange}`;
        
        // Try memory cache first
        let stocks = getFromMemoryCache(cacheKey);
        if (!stocks || stocks.length === 0) {
          // Always use TradingView as primary source
          const tvStocks = await fetchAllTVStocks();
          const tvMap = new Map<string, any>();
          for (const tv of tvStocks) {
            const parts = tv.ticker.split(':');
            if (parts.length === 2) tvMap.set(`${parts[0]}:${parts[1]}`, tv);
          }
          const stockList = exchange === "ADX" ? ADX_STOCKS : exchange === "DFM" ? DFM_STOCKS : ALL_STOCKS;
          stocks = stockList.map(stock => {
            const tvData = tvMap.get(`${stock.exchange}:${stock.symbol}`);
            if (tvData) return tvToSnapshot(tvData, stock);
            return { symbol: stock.symbol, exchange: stock.exchange, name: stock.name, sector: stock.sector, price: null, changePercent: null, volume: null };
          });
        }
        
        // Apply DFM live overlay for fresh prices
        stocks = await applyDFMOverlayToResults(stocks);
        
        // Filter stocks with price data and valid change %
        const withData = stocks.filter((s: any) => s.price != null && s.changePercent != null);
        
        // Sort by change % for gainers (descending) and losers (ascending)
        const sorted = [...withData].sort((a: any, b: any) => (b.changePercent || 0) - (a.changePercent || 0));
        const gainers = sorted.slice(0, limit);
        const losers = sorted.slice(-limit).reverse();
        
        // Most active by volume
        const byVolume = [...withData].sort((a: any, b: any) => (b.volume || 0) - (a.volume || 0));
        const mostActive = byVolume.slice(0, limit);
        
        return { gainers, losers, mostActive };
      }),

    // CSV export
    exportCSV: publicProcedure
      .input(z.object({
        exchange: z.enum(["ADX", "DFM", "ALL"]).optional().default("ALL"),
      }).optional())
      .query(async ({ input }) => {
        const exchange = input?.exchange || "ALL";
        const cacheKey = `fetchAll-${exchange}`;
        
        let stocks = getFromMemoryCache(cacheKey);
        if (!stocks || stocks.length === 0) {
          // Always use TradingView as primary source
          const tvStocks = await fetchAllTVStocks();
          const tvMap = new Map<string, any>();
          for (const tv of tvStocks) {
            const parts = tv.ticker.split(':');
            if (parts.length === 2) tvMap.set(`${parts[0]}:${parts[1]}`, tv);
          }
          const stockList = exchange === "ADX" ? ADX_STOCKS : exchange === "DFM" ? DFM_STOCKS : ALL_STOCKS;
          stocks = stockList.map(stock => {
            const tvData = tvMap.get(`${stock.exchange}:${stock.symbol}`);
            if (tvData) return tvToSnapshot(tvData, stock);
            return { symbol: stock.symbol, exchange: stock.exchange, name: stock.name, sector: stock.sector, price: null, changePercent: null, volume: null };
          });
        }
        
        // Apply DFM live overlay for fresh prices
        stocks = await applyDFMOverlayToResults(stocks);
        
        // Build CSV
        const headers = ['Symbol', 'Name', 'Exchange', 'Sector', 'Price (AED)', 'Change %', 'Volume', 'Market Cap', 'P/E', 'EPS', '52W High', '52W Low', 'RSI', 'SMA20', 'SMA50'];
        const rows = stocks.map((s: any) => [
          s.symbol, s.name || '', s.exchange, s.sector || '',
          s.price ?? '', s.changePercent != null ? s.changePercent.toFixed(2) : '',
          s.volume ?? '', s.marketCap ?? '', s.pe != null ? s.pe.toFixed(2) : '',
          s.eps != null ? s.eps.toFixed(2) : '', s.week52High ?? '', s.week52Low ?? '',
          s.rsi != null ? s.rsi.toFixed(1) : '', s.sma20 != null ? s.sma20.toFixed(2) : '',
          s.sma50 != null ? s.sma50.toFixed(2) : '',
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
        
        return {
          csv: [headers.join(','), ...rows].join('\n'),
          filename: `uae-stocks-${exchange.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`,
        };
      }),

    // ─── Snowflake Analysis ───────────────────────────────────────
    snowflake: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        const stock = ALL_STOCKS.find(s => s.symbol === input.symbol);
        if (!stock) throw new Error("Stock not found");
        
        // Fetch all stocks for market averages
        const allTVStocks = await fetchAllTVStocks();
        const marketAvgs = computeMarketAverages(allTVStocks);
        
        // Fetch this specific stock's data
        const tvKey = `${stock.exchange}:${stock.symbol}`;
        const tvStocks = await fetchTVStocksByTickers([tvKey]);
        const tv = tvStocks.length > 0 ? tvStocks[0] : null;
        if (!tv) throw new Error("No data available for this stock");
        
        // Payout ratio not available from TradingView scanner
        
        const sector = tv.sector || stock.sector || 'Unknown';
        
        // Build snowflake input
        const snowflakeInput: SnowflakeInput = {
          close: tv.close,
          pe: tv.pe,
          pb: tv.priceToBook,
          peg: tv.pegRatio,
          marketCap: tv.marketCap,
          eps: tv.eps,
          epsForecast: tv.epsForecast,
          netIncome: tv.netIncome,
          totalRevenue: tv.totalRevenue,
          ebitda: tv.ebitda,
          grossProfit: tv.grossProfit,
          roe: tv.returnOnEquity != null ? tv.returnOnEquity / 100 : null,
          roa: tv.returnOnAssets != null ? tv.returnOnAssets / 100 : null,
          roic: tv.returnOnInvestedCapital != null ? tv.returnOnInvestedCapital / 100 : null,
          grossMargin: tv.grossMargin != null ? tv.grossMargin / 100 : null,
          operatingMargin: tv.operatingMargin != null ? tv.operatingMargin / 100 : null,
          netMargin: tv.netMargin != null ? tv.netMargin / 100 : null,
          totalAssets: tv.totalAssets,
          totalLiabilities: tv.totalLiabilities,
          totalCurrentAssets: tv.totalCurrentAssets,
          totalCurrentLiabilities: tv.totalCurrentLiabilities,
          totalDebt: tv.totalDebt,
          debtToEquity: tv.debtToEquity,
          currentRatio: tv.currentRatio,
          freeCashFlow: tv.freeCashFlow,
          operatingCashFlow: tv.operatingCashFlow,
          sharesOutstanding: tv.sharesOutstanding,
          bookValuePerShare: tv.bookValuePerShare,
          dividendYield: tv.dividendYield != null ? tv.dividendYield / 100 : null,
          dividendPerShare: tv.dividendPerShare,
          payoutRatio: null,
          perfYear: tv.perfYear,
          perf5Year: tv.perf5Year,
          sector,
          industry: tv.industry,
          marketAvgPE: marketAvgs.marketAvgPE,
          industryAvgPE: marketAvgs.industryAvgPE[sector] || null,
          industryAvgPB: marketAvgs.industryAvgPB[sector] || null,
          industryAvgROA: marketAvgs.industryAvgROA[sector] || null,
          marketAvgEarningsGrowth: marketAvgs.marketAvgEarningsGrowth,
          marketAvgRevenueGrowth: marketAvgs.marketAvgRevenueGrowth,
          marketDividendYield25thPctile: marketAvgs.marketDividendYield25thPctile,
          marketDividendYield75thPctile: marketAvgs.marketDividendYield75thPctile,
        };
        
        const result = computeSnowflake(snowflakeInput);
        
        // Get peer stocks for comparison (same sector, top 5 by market cap)
        const peers = allTVStocks
          .filter(s => s.sector === sector && s.ticker !== tvKey && s.marketCap != null)
          .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
          .slice(0, 5)
          .map(peer => {
            const peerInput: SnowflakeInput = {
              close: peer.close,
              pe: peer.pe,
              pb: peer.priceToBook,
              peg: peer.pegRatio,
              marketCap: peer.marketCap,
              eps: peer.eps,
              epsForecast: peer.epsForecast,
              netIncome: peer.netIncome,
              totalRevenue: peer.totalRevenue,
              ebitda: peer.ebitda,
              grossProfit: peer.grossProfit,
              roe: peer.returnOnEquity != null ? peer.returnOnEquity / 100 : null,
              roa: peer.returnOnAssets != null ? peer.returnOnAssets / 100 : null,
              roic: peer.returnOnInvestedCapital != null ? peer.returnOnInvestedCapital / 100 : null,
              grossMargin: peer.grossMargin != null ? peer.grossMargin / 100 : null,
              operatingMargin: peer.operatingMargin != null ? peer.operatingMargin / 100 : null,
              netMargin: peer.netMargin != null ? peer.netMargin / 100 : null,
              totalAssets: peer.totalAssets,
              totalLiabilities: peer.totalLiabilities,
              totalCurrentAssets: peer.totalCurrentAssets,
              totalCurrentLiabilities: peer.totalCurrentLiabilities,
              totalDebt: peer.totalDebt,
              debtToEquity: peer.debtToEquity,
              currentRatio: peer.currentRatio,
              freeCashFlow: peer.freeCashFlow,
              operatingCashFlow: peer.operatingCashFlow,
              sharesOutstanding: peer.sharesOutstanding,
              bookValuePerShare: peer.bookValuePerShare,
              dividendYield: peer.dividendYield != null ? peer.dividendYield / 100 : null,
              dividendPerShare: peer.dividendPerShare,
              payoutRatio: null,
              perfYear: peer.perfYear,
              perf5Year: peer.perf5Year,
              sector: peer.sector,
              industry: peer.industry,
              marketAvgPE: marketAvgs.marketAvgPE,
              industryAvgPE: marketAvgs.industryAvgPE[sector] || null,
              industryAvgPB: marketAvgs.industryAvgPB[sector] || null,
              industryAvgROA: marketAvgs.industryAvgROA[sector] || null,
              marketAvgEarningsGrowth: marketAvgs.marketAvgEarningsGrowth,
              marketAvgRevenueGrowth: marketAvgs.marketAvgRevenueGrowth,
              marketDividendYield25thPctile: marketAvgs.marketDividendYield25thPctile,
              marketDividendYield75thPctile: marketAvgs.marketDividendYield75thPctile,
            };
            const peerResult = computeSnowflake(peerInput);
            return {
              ticker: peer.ticker,
              name: peer.description || peer.name,
              logoId: peer.logoId,
              snowflake: peerResult.snowflake,
            };
          });
        
        return {
          snowflake: result.snowflake,
          fairValue: result.fairValue,
          peers,
          marketAverages: {
            pe: marketAvgs.marketAvgPE,
            industryPE: marketAvgs.industryAvgPE[sector] || null,
            industryPB: marketAvgs.industryAvgPB[sector] || null,
            earningsGrowth: marketAvgs.marketAvgEarningsGrowth,
            dividendYield25: marketAvgs.marketDividendYield25thPctile,
            dividendYield75: marketAvgs.marketDividendYield75thPctile,
          },
        };
      }),

    // ─── AI Company Analysis (Gemini-powered) ─────────────────────
    aiAnalysis: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .mutation(async ({ input }) => {
        const stock = ALL_STOCKS.find(s => s.symbol === input.symbol);
        if (!stock) throw new Error("Stock not found");
        
        // Get stock data for context
        const tvKey = `${stock.exchange}:${stock.symbol}`;
        const tvStocks = await fetchTVStocksByTickers([tvKey]);
        const tv = tvStocks.length > 0 ? tvStocks[0] : null;
        
        const stockContext = tv ? `
Company: ${tv.description || stock.name} (${stock.symbol})
Exchange: ${stock.exchange}
Sector: ${tv.sector || stock.sector}
Industry: ${tv.industry || 'N/A'}
Current Price: AED ${tv.close?.toFixed(2) || 'N/A'}
Market Cap: AED ${tv.marketCap ? (tv.marketCap / 1e9).toFixed(2) + 'B' : 'N/A'}
P/E Ratio: ${tv.pe?.toFixed(2) || 'N/A'}
P/B Ratio: ${tv.priceToBook?.toFixed(2) || 'N/A'}
ROE: ${tv.returnOnEquity?.toFixed(2) || 'N/A'}%
ROA: ${tv.returnOnAssets?.toFixed(2) || 'N/A'}%
Debt/Equity: ${tv.debtToEquity?.toFixed(2) || 'N/A'}%
Dividend Yield: ${tv.dividendYield?.toFixed(2) || 'N/A'}%
Net Margin: ${tv.netMargin?.toFixed(2) || 'N/A'}%
Revenue: AED ${tv.totalRevenue ? (tv.totalRevenue / 1e9).toFixed(2) + 'B' : 'N/A'}
Net Income: AED ${tv.netIncome ? (tv.netIncome / 1e6).toFixed(0) + 'M' : 'N/A'}
1Y Performance: ${tv.perfYear?.toFixed(2) || 'N/A'}%
5Y Performance: ${tv.perf5Year?.toFixed(2) || 'N/A'}%
RSI: ${tv.rsi?.toFixed(1) || 'N/A'}
Beta: ${tv.beta?.toFixed(2) || 'N/A'}
` : `Company: ${stock.name} (${stock.symbol}), Exchange: ${stock.exchange}`;
        
        try {
          const result = await invokeLLM({
            messages: [
              { role: "system", content: `You are a senior equity research analyst specializing in UAE markets (ADX and DFM). Provide comprehensive, data-driven analysis in the style of Simply Wall St. Be specific with numbers and comparisons. Return JSON with the exact schema specified.` },
              { role: "user", content: `Provide a comprehensive analysis for this UAE-listed stock:\n${stockContext}\n\nReturn a detailed analysis as JSON.` }
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "stock_analysis",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    summary: { type: "string", description: "2-3 paragraph executive summary of the company and its investment thesis" },
                    rewards: {
                      type: "array",
                      items: { type: "string" },
                      description: "3-5 key rewards/positive factors for investing"
                    },
                    risks: {
                      type: "array",
                      items: { type: "string" },
                      description: "3-5 key risks/negative factors for investing"
                    },
                    outlook: { type: "string", description: "1-2 paragraph forward-looking outlook" },
                    rating: { type: "string", description: "One of: Strong Buy, Buy, Hold, Sell, Strong Sell" },
                    confidence: { type: "number", description: "Confidence level 0-100" },
                  },
                  required: ["summary", "rewards", "risks", "outlook", "rating", "confidence"],
                  additionalProperties: false,
                },
              },
            },
          });
          const content = result.choices[0]?.message?.content;
          if (typeof content === "string") return JSON.parse(content);
          return { summary: "Analysis unavailable.", rewards: [], risks: [], outlook: "", rating: "Hold", confidence: 0 };
        } catch (e) {
          console.warn("[AI Analysis] Failed:", e);
          return { summary: "AI analysis temporarily unavailable. Please try again later.", rewards: [], risks: [], outlook: "", rating: "Hold", confidence: 0 };
        }
      }),

    sentiment: publicProcedure
      .input(z.object({ symbol: z.string(), name: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const result = await invokeLLM({
            messages: [
              { role: "system", content: "You are a financial analyst specializing in UAE stock markets (ADX and DFM). Analyze the given stock and provide a brief sentiment assessment. Return JSON with: sentiment (bullish/bearish/neutral), score (-1 to 1), and summary (2-3 sentences)." },
              { role: "user", content: `Analyze the current market sentiment for ${input.name} (${input.symbol}) listed on the UAE stock exchange. Consider recent market conditions, sector trends, and the company's position in the UAE economy. Return your analysis as JSON.` }
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "sentiment_analysis",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    sentiment: { type: "string", description: "bullish, bearish, or neutral" },
                    score: { type: "number", description: "Sentiment score from -1 (very bearish) to 1 (very bullish)" },
                    summary: { type: "string", description: "2-3 sentence analysis" },
                  },
                  required: ["sentiment", "score", "summary"],
                  additionalProperties: false,
                },
              },
            },
          });
          const content = result.choices[0]?.message?.content;
          if (typeof content === "string") return JSON.parse(content);
          return { sentiment: "neutral", score: 0, summary: "Unable to analyze sentiment at this time." };
        } catch (e) {
          console.warn("[Sentiment] Analysis failed:", e);
          return { sentiment: "neutral", score: 0, summary: "Sentiment analysis temporarily unavailable." };
        }
      }),

    // ─── TradingView News ─────────────────────────────────────────
    news: publicProcedure
      .input(z.object({ symbol: z.string(), count: z.number().optional().default(20) }))
      .query(async ({ input }) => {
        const stock = ALL_STOCKS.find(s => s.symbol === input.symbol);
        if (!stock) throw new Error("Stock not found");
        return fetchTVNews(stock.symbol, stock.exchange, input.count);
      }),

    marketNews: publicProcedure
      .input(z.object({ count: z.number().optional().default(30) }).optional())
      .query(async ({ input }) => {
        return fetchUAEMarketNews(input?.count || 30);
      }),

    // ─── TradingView Forecast/Analyst Data ────────────────────────
    forecast: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        const stock = ALL_STOCKS.find(s => s.symbol === input.symbol);
        if (!stock) throw new Error("Stock not found");
        return fetchTVForecast(stock.symbol, stock.exchange);
      }),

    // ─── TradingView Extended Financials ──────────────────────────
    extendedFinancials: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        const stock = ALL_STOCKS.find(s => s.symbol === input.symbol);
        if (!stock) throw new Error("Stock not found");
        return fetchTVExtendedFinancials(stock.symbol, stock.exchange);
      }),

    // ─── TradingView Performance ─────────────────────────────────
    performance: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        const stock = ALL_STOCKS.find(s => s.symbol === input.symbol);
        if (!stock) throw new Error("Stock not found");
        return fetchTVPerformance(stock.symbol, stock.exchange);
      }),

    // ─── Seasonality (computed from historical chart data) ───────
    seasonality: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        const stock = ALL_STOCKS.find(s => s.symbol === input.symbol);
        if (!stock) throw new Error("Stock not found");
        // Use 5 years of weekly data for seasonality (TwelveData/TradingView)
        const rawChart = await fetchYahooChart(stock.yahooSymbol, '5y', '1wk');
        if (!rawChart || !rawChart.timestamps || !rawChart.close) {
          return [];
        }
        // Transform chart data into { date, close } array for computeSeasonality
        const chartData = rawChart.timestamps.map((ts: number, i: number) => ({
          date: new Date(ts).toISOString().split('T')[0],
          close: rawChart.close[i] ?? 0,
        })).filter((p: any) => p.close > 0);
        return computeSeasonality(chartData);
      }),
    // ─── Earnings Transcript ─────────────────────────────────────
    earningsTranscript: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        const stock = ALL_STOCKS.find(s => s.symbol === input.symbol);
        if (!stock) throw new Error("Stock not found");
        return getEarningsTranscript(input.symbol);
      }),

    // Corporate events calendar (earnings & dividends from TradingView)
    corporateEvents: publicProcedure
      .query(async () => {
        const cacheKey = "corporateEvents";
        const cached = getFromMemoryCache(cacheKey);
        if (cached && Array.isArray(cached) && cached[0]) return cached[0] as any;

        try {
          const resp = await fetch("https://scanner.tradingview.com/uae/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              columns: [
                "name", "description", "exchange",
                "earnings_release_next_date", "earnings_release_date",
                "dividend_ex_date_upcoming",
                "close", "change", "sector"
              ],
              filter: [{ left: "exchange", operation: "in_range", right: ["DFM", "ADX"] }],
              sort: { sortBy: "earnings_release_next_date", sortOrder: "asc" },
              range: [0, 200],
            }),
          });

          const json = await resp.json() as any;
          const events: Array<{
            symbol: string;
            name: string;
            exchange: string;
            earningsNext: number | null;
            earningsLast: number | null;
            dividendExDate: number | null;
            price: number | null;
            change: number | null;
            sector: string | null;
          }> = [];

          for (const row of json.data || []) {
            const d = row.d;
            events.push({
              symbol: row.s?.split(":")[1] || d[0],
              name: d[1],
              exchange: d[2] || row.s?.split(":")[0] || "DFM",
              earningsNext: d[3] ? d[3] * 1000 : null,
              earningsLast: d[4] ? d[4] * 1000 : null,
              dividendExDate: d[5] ? d[5] * 1000 : null,
              price: d[6],
              change: d[7],
              sector: d[8],
            });
          }

          const result = { events, fetchedAt: Date.now() };
          setMemoryCache(cacheKey, [result] as any);
          return result;
        } catch (err) {
          console.error("[CorporateEvents] Failed to fetch:", err);
          return { events: [], fetchedAt: Date.now() };
        }
      }),
  }),

  watchlist: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserWatchlist(ctx.user.id);
    }),
    add: protectedProcedure
      .input(z.object({ symbol: z.string(), exchange: z.enum(["ADX", "DFM"]) }))
      .mutation(async ({ ctx, input }) => {
        await addToWatchlist(ctx.user.id, input.symbol, input.exchange);
        return { success: true };
      }),
    remove: protectedProcedure
      .input(z.object({ symbol: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await removeFromWatchlist(ctx.user.id, input.symbol);
        return { success: true };
      }),
  }),

  // Volume Monitor & Alerts
  monitor: router({
    status: publicProcedure.query(() => {
      return getMonitorStatus();
    }),

    recentAlerts: publicProcedure
      .input(z.object({ limit: z.number().optional().default(50) }).optional())
      .query(async ({ input }) => {
        return getRecentAlerts(input?.limit || 50);
      }),

    todayAlerts: publicProcedure.query(async () => {
      return getTodayAlerts();
    }),

    dismiss: protectedProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(async ({ input }) => {
        await dismissAlert(input.alertId);
        return { success: true };
      }),

    scan: protectedProcedure
      .input(z.object({
        threshold: z.number().optional().default(2.0),
        minVolume: z.number().optional().default(100000),
      }).optional())
      .mutation(async ({ input }) => {
        const alerts = await manualPoll(input?.threshold, input?.minVolume);
        return { alerts, count: alerts.length };
      }),

    settings: protectedProcedure.query(async ({ ctx }) => {
      return getMonitorSettingsForUser(ctx.user.id);
    }),

    updateSettings: protectedProcedure
      .input(z.object({
        enabled: z.boolean().optional(),
        volumeThreshold: z.number().min(1).max(10).optional(),
        minVolumeAbsolute: z.number().min(0).optional(),
        notifyOnSpike: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await upsertMonitorSettings(ctx.user.id, input);
        return { success: true };
      }),

    tradingInfo: publicProcedure.query(() => {
      return {
        isTrading: isUAETradingHours(),
        nextSession: isUAETradingHours() ? null : getNextTradingSession(),
        tradingHours: "Sun-Thu 10:00-14:00 GST (UTC+4)",
      };
    }),
  }),

  // In-app Notifications
  notifications: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().optional().default(50) }).optional())
      .query(async ({ ctx, input }) => {
        return getUserNotifications(ctx.user.id, input?.limit || 50);
      }),

    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return getUnreadNotificationCount(ctx.user.id);
    }),

    markRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await markNotificationRead(input.notificationId, ctx.user.id);
        return { success: true };
      }),

    markAllRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        await markAllNotificationsRead(ctx.user.id);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteNotification(input.notificationId, ctx.user.id);
        return { success: true };
      }),

    deleteAll: protectedProcedure
      .mutation(async ({ ctx }) => {
        await deleteAllNotifications(ctx.user.id);
        return { success: true };
      }),

    // ─── Notification Preferences ───
    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      const prefs = await getNotificationPreferences(ctx.user.id);
      if (!prefs) {
        // Return defaults
        return {
          emailEnabled: false,
          browserEnabled: true,
          soundEnabled: true,
          inAppEnabled: true,
          emailSeverities: "high,critical",
          browserSeverities: "medium,high,critical",
          notificationEmail: ctx.user.email || "",
          quietHoursEnabled: false,
          quietHoursStart: "22:00",
          quietHoursEnd: "07:00",
          soundVolume: 0.7,
          alertTypes: "volume_spike,price_alert,earnings,dividend,news",
          minIntervalMinutes: 5,
        };
      }
      return {
        emailEnabled: !!prefs.emailEnabled,
        browserEnabled: !!prefs.browserEnabled,
        soundEnabled: !!prefs.soundEnabled,
        inAppEnabled: !!prefs.inAppEnabled,
        emailSeverities: prefs.emailSeverities || "high,critical",
        browserSeverities: prefs.browserSeverities || "medium,high,critical",
        notificationEmail: prefs.notificationEmail || ctx.user.email || "",
        quietHoursEnabled: !!prefs.quietHoursEnabled,
        quietHoursStart: prefs.quietHoursStart || "22:00",
        quietHoursEnd: prefs.quietHoursEnd || "07:00",
        soundVolume: prefs.soundVolume ?? 0.7,
        alertTypes: (prefs as any).alertTypes || "volume_spike,price_alert,earnings,dividend,news",
        minIntervalMinutes: prefs.minIntervalMinutes ?? 5,
      };
    }),

    updatePreferences: protectedProcedure
      .input(z.object({
        emailEnabled: z.boolean().optional(),
        browserEnabled: z.boolean().optional(),
        soundEnabled: z.boolean().optional(),
        inAppEnabled: z.boolean().optional(),
        emailSeverities: z.string().optional(),
        browserSeverities: z.string().optional(),
        notificationEmail: z.string().optional(),
        quietHoursEnabled: z.boolean().optional(),
        quietHoursStart: z.string().optional(),
        quietHoursEnd: z.string().optional(),
        soundVolume: z.number().min(0).max(1).optional(),
        alertTypes: z.string().optional(),
        minIntervalMinutes: z.number().min(1).max(60).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const dbPrefs: Record<string, unknown> = {};
        if (input.emailEnabled !== undefined) dbPrefs.emailEnabled = input.emailEnabled ? 1 : 0;
        if (input.browserEnabled !== undefined) dbPrefs.browserEnabled = input.browserEnabled ? 1 : 0;
        if (input.soundEnabled !== undefined) dbPrefs.soundEnabled = input.soundEnabled ? 1 : 0;
        if (input.inAppEnabled !== undefined) dbPrefs.inAppEnabled = input.inAppEnabled ? 1 : 0;
        if (input.emailSeverities !== undefined) dbPrefs.emailSeverities = input.emailSeverities;
        if (input.browserSeverities !== undefined) dbPrefs.browserSeverities = input.browserSeverities;
        if (input.notificationEmail !== undefined) dbPrefs.notificationEmail = input.notificationEmail;
        if (input.quietHoursEnabled !== undefined) dbPrefs.quietHoursEnabled = input.quietHoursEnabled ? 1 : 0;
        if (input.quietHoursStart !== undefined) dbPrefs.quietHoursStart = input.quietHoursStart;
        if (input.quietHoursEnd !== undefined) dbPrefs.quietHoursEnd = input.quietHoursEnd;
        if (input.soundVolume !== undefined) dbPrefs.soundVolume = input.soundVolume;
        if (input.alertTypes !== undefined) dbPrefs.alertTypes = input.alertTypes;
        if (input.minIntervalMinutes !== undefined) dbPrefs.minIntervalMinutes = input.minIntervalMinutes;
        
        const result = await upsertNotificationPreferences(ctx.user.id, dbPrefs as any);
        return { success: true, preferences: result };
      }),

    // testEmail procedure removed — email notifications are completely disabled system-wide (Phase 19).
  }),

  // Screener Presets
  presets: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserPresets(ctx.user.id);
    }),
    save: protectedProcedure
      .input(z.object({ name: z.string(), filters: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await savePreset(ctx.user.id, input.name, input.filters);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deletePreset(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // Admin - API Data Sources
  admin: router({
    // Full health check (pings all APIs)
    apiHealthCheck: publicProcedure.query(async () => {
      return checkAllApiHealth();
    }),

    // Quick snapshot (no API calls, uses cached status)
    apiStatus: publicProcedure.query(() => {
      return getApiStatusSnapshot();
    }),

    // WebSocket real-time streaming stats
    wsStats: publicProcedure.query(() => {
      return getWSStats();
    }),

    // TradingView data fetch
    tvFetchAll: publicProcedure.query(async () => {
      const stocks = await fetchAllTVStocks();
      return {
        count: stocks.length,
        stocks: stocks.slice(0, 10), // Return top 10 for preview
        stats: getTradingViewStats(),
      };
    }),

    // TradingView fetch specific stocks
    tvFetchStocks: publicProcedure
      .input(z.object({ tickers: z.array(z.string()) }))
      .query(async ({ input }) => {
        const stocks = await fetchTVStocksByTickers(input.tickers);
        return { count: stocks.length, stocks };
      }),

    // Scrapfly credit monitor status
    creditMonitor: publicProcedure.query(() => {
      return getCreditMonitorStatus();
    }),

    // Force credit check (admin action)
    forceCheckCredits: publicProcedure.mutation(async () => {
      return forceCheckCredits();
    }),

    // Cache metrics from all services
    cacheMetrics: publicProcedure.query(() => {
      return getCacheMetrics();
    }),

    // Reset cache metrics counters
    resetCacheMetrics: publicProcedure.mutation(() => {
      resetCacheMetrics();
      return { success: true };
    }),

    // SWS stats
    swsStats: publicProcedure.query(() => {
      return getSWSStats();
    }),

    // SWS health check
    swsHealth: publicProcedure.query(async () => {
      return checkSWSHealth();
    }),

    // SWS URL cache
    swsUrlCache: publicProcedure.query(() => {
      return getCanonicalUrlCache();
    }),

    // SWS bulk populate - fetches data for all stocks
    swsBulkPopulate: publicProcedure.mutation(async () => {
      const BATCH_SIZE = 5;
      const DELAY_MS = 3000;
      const results: { symbol: string; exchange: string; success: boolean; error?: string }[] = [];
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < ALL_STOCKS.length; i += BATCH_SIZE) {
        const batch = ALL_STOCKS.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (stock) => {
          try {
            const data = await fetchSWSCompanyData(stock.symbol, stock.exchange, stock.name);
            if (data) {
              successCount++;
              results.push({ symbol: stock.symbol, exchange: stock.exchange, success: true });
            } else {
              failCount++;
              results.push({ symbol: stock.symbol, exchange: stock.exchange, success: false, error: "No data returned" });
            }
          } catch (e: any) {
            failCount++;
            results.push({ symbol: stock.symbol, exchange: stock.exchange, success: false, error: e.message });
          }
        });
        await Promise.all(batchPromises);
        // Delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < ALL_STOCKS.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }

      return {
        total: ALL_STOCKS.length,
        success: successCount,
        failed: failCount,
        successRate: ((successCount / ALL_STOCKS.length) * 100).toFixed(1) + "%",
        results,
        stats: getSWSStats(),
      };
    }),

    // Fetch SWS data for a single stock
    swsFetchStock: publicProcedure
      .input(z.object({ symbol: z.string(), exchange: z.string() }))
      .query(async ({ input }) => {
        const stock = ALL_STOCKS.find(s => s.symbol === input.symbol && s.exchange === input.exchange);
        if (!stock) throw new Error("Stock not found");
        const data = await fetchSWSCompanyData(stock.symbol, stock.exchange, stock.name);
        return data;
      }),
  }),

  // ─── TwelveData endpoints (UAE only) ──────────────────────────────
  td: router({
    // Real OHLCV chart data from TwelveData
    chart: publicProcedure
      .input(z.object({
        symbol: z.string(),
        exchange: z.enum(["ADX", "DFM"]),
        interval: z.enum(["1day", "1week", "1month"]).default("1day"),
        outputsize: z.number().min(10).max(5000).default(90),
      }))
      .query(async ({ input }) => {
        const candles = await fetchChartData(input.symbol, input.exchange, input.interval, input.outputsize);
        return { candles: candles || [] };
      }),

    // Real-time quote from TwelveData
    quote: publicProcedure
      .input(z.object({ symbol: z.string(), exchange: z.enum(["ADX", "DFM"]) }))
      .query(async ({ input }) => {
        const quote = await fetchQuote(input.symbol, input.exchange);
        return quote;
      }),

    // Comprehensive technical analysis with all indicators
    technicals: publicProcedure
      .input(z.object({
        symbol: z.string(),
        exchange: z.enum(["ADX", "DFM"]),
        currentPrice: z.number(),
      }))
      .query(async ({ input }) => {
        const analysis = await fetchTechnicalAnalysis(input.symbol, input.exchange, input.currentPrice);
        return analysis;
      }),

    // Bollinger Bands history for chart overlay
    bbands: publicProcedure
      .input(z.object({
        symbol: z.string(),
        exchange: z.enum(["ADX", "DFM"]),
        outputsize: z.number().default(90),
      }))
      .query(async ({ input }) => {
        const bands = await fetchBBandsHistory(input.symbol, input.exchange, input.outputsize);
        return { bands: bands || [] };
      }),

    // MACD history for chart
    macd: publicProcedure
      .input(z.object({
        symbol: z.string(),
        exchange: z.enum(["ADX", "DFM"]),
        outputsize: z.number().default(90),
      }))
      .query(async ({ input }) => {
        const data = await fetchMACDHistory(input.symbol, input.exchange, input.outputsize);
        return { data: data || [] };
      }),

    // RSI history for chart
    rsi: publicProcedure
      .input(z.object({
        symbol: z.string(),
        exchange: z.enum(["ADX", "DFM"]),
        outputsize: z.number().default(90),
      }))
      .query(async ({ input }) => {
        const data = await fetchRSIHistory(input.symbol, input.exchange, input.outputsize);
        return { data: data || [] };
      }),

    // Market state (open/closed) for DFM and ADX
    marketState: publicProcedure
      .input(z.object({ exchange: z.enum(["ADX", "DFM"]) }))
      .query(async ({ input }) => {
        const state = await fetchMarketState(input.exchange);
        return state;
      }),

    // Statistics (52-week range, volume averages, beta, MAs)
    statistics: publicProcedure
      .input(z.object({ symbol: z.string(), exchange: z.enum(["ADX", "DFM"]) }))
      .query(async ({ input }) => {
        const stats = await fetchStatistics(input.symbol, input.exchange);
        return stats;
      }),

    // Symbol mapping info
    symbolInfo: publicProcedure
      .input(z.object({ symbol: z.string(), exchange: z.enum(["ADX", "DFM"]) }))
      .query(({ input }) => {
        const info = toTwelveDataSymbol(input.symbol, input.exchange);
        return info;
      }),

    // Abboud AI Indicator (Fibonacci + RSI Divergence)
    abboud: publicProcedure
      .input(z.object({
        symbol: z.string(),
        exchange: z.enum(["ADX", "DFM"]),
        outputsize: z.number().min(30).max(5000).default(200),
      }))
      .query(async ({ input }) => {
        const candles = await fetchChartData(input.symbol, input.exchange, "1day", input.outputsize);
        if (!candles || candles.length < 30) return null;
        const ohlcData = candles.map((c: any) => ({
          date: c.datetime,
          open: parseFloat(c.open),
          high: parseFloat(c.high),
          low: parseFloat(c.low),
          close: parseFloat(c.close),
          volume: parseInt(c.volume, 10),
        }));
        const { computeAbboudIndicator } = await import("./services/abboudIndicator");
        return computeAbboudIndicator(ohlcData);
      }),

    // Abboud AI Scanner Status
    scannerStatus: publicProcedure
      .query(async () => {
        const { getAbboudScannerStatus } = await import("./services/abboudAlertScanner");
        return getAbboudScannerStatus();
      }),

    // Get recent Abboud alerts
    recentAlerts: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return [];
        const { abboudAlerts } = await import("../drizzle/schema");
        const { desc } = await import("drizzle-orm");
        return db.select().from(abboudAlerts)
          .orderBy(desc(abboudAlerts.detectedAt))
          .limit(input.limit);
      }),

    // Get Abboud alerts for a specific stock
    stockAlerts: publicProcedure
      .input(z.object({ symbol: z.string(), exchange: z.enum(["ADX", "DFM"]), limit: z.number().min(1).max(50).default(10) }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return [];
        const { abboudAlerts } = await import("../drizzle/schema");
        const { desc, eq, and } = await import("drizzle-orm");
        return db.select().from(abboudAlerts)
          .where(and(eq(abboudAlerts.symbol, input.symbol), eq(abboudAlerts.exchange, input.exchange)))
          .orderBy(desc(abboudAlerts.detectedAt))
          .limit(input.limit);
      }),

    // Manual scan trigger (protected - admin only)
    triggerScan: protectedProcedure
      .mutation(async () => {
        const { manualAbboudScan } = await import("./services/abboudAlertScanner");
        const alerts = await manualAbboudScan();
        return { alertCount: alerts.length, alerts };
      }),
  }),

  // Market Summary - daily automated summaries in EN/AR
  summary: router({
    latest: publicProcedure
      .input(z.object({ language: z.enum(["en", "ar"]), limit: z.number().min(1).max(30).default(10) }))
      .query(async ({ input }) => {
        return getLatestSummaries(input.language, input.limit);
      }),

    byDate: publicProcedure
      .input(z.object({ date: z.string(), language: z.enum(["en", "ar"]) }))
      .query(async ({ input }) => {
        return getSummaryByDate(input.date, input.language);
      }),

    generate: protectedProcedure
      .mutation(async () => {
        return generateDailySummary();
      }),

    status: publicProcedure
      .query(() => {
        return getMarketSummaryStatus();
      }),
  }),

  // ─── StockAnalysis.com data ───────────────────────────────────
  sa: router({
    overview: publicProcedure
      .input(z.object({ symbol: z.string(), exchange: z.enum(["ADX", "DFM"]) }))
      .query(async ({ input }) => {
        return fetchSAOverview(input.symbol, input.exchange);
      }),

    financials: publicProcedure
      .input(z.object({ symbol: z.string(), exchange: z.enum(["ADX", "DFM"]) }))
      .query(async ({ input }) => {
        return fetchSAFinancials(input.symbol, input.exchange);
      }),

    dividends: publicProcedure
      .input(z.object({ symbol: z.string(), exchange: z.enum(["ADX", "DFM"]) }))
      .query(async ({ input }) => {
        return fetchSADividends(input.symbol, input.exchange);
      }),

    stats: publicProcedure.query(() => getSAStats()),

    clearCache: protectedProcedure.mutation(() => clearSACache()),
  }),

  // ─── MarketScreener Data (Ownership, Consensus, ESG) ──────────
  marketScreener: router({
    data: publicProcedure
      .input(z.object({ symbol: z.string(), companyName: z.string(), exchange: z.enum(["ADX", "DFM"]) }))
      .query(async ({ input }) => {
        return fetchMSData(input.symbol, input.companyName, input.exchange);
      }),
  }),

  // ─── Investing.com Data (Dividends, Consensus) ────────────────
  investingCom: router({
    data: publicProcedure
      .input(z.object({ symbol: z.string(), companyName: z.string(), exchange: z.enum(["ADX", "DFM"]) }))
      .query(async ({ input }) => {
        return fetchINVData(input.symbol, input.companyName, input.exchange);
      }),
  }),

  // ─── Chat HTTP polling fallback ─────────────────────────────────
  chat: router({
    messages: protectedProcedure
      .input(z.object({ sinceId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        // Register as polling user
        registerPollingUser(ctx.user.id, ctx.user.name || "User");
        return getChatMessages(input.sinceId);
      }),

    send: protectedProcedure
      .input(z.object({ content: z.string().min(1).max(2000), replyToId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        registerPollingUser(ctx.user.id, ctx.user.name || "User");
        return postChatMessage(ctx.user.id, ctx.user.name || "User", input.content, input.replyToId);
      }),

    sendImage: protectedProcedure
      .input(z.object({ base64Data: z.string(), mime: z.string(), caption: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        return postChatImage(ctx.user.id, ctx.user.name || "User", input.base64Data, input.mime, input.caption);
      }),

    onlineUsers: protectedProcedure
      .query(() => {
        return getOnlineUsersList();
      }),

    clearedAt: protectedProcedure
      .query(() => {
        return { clearedAt: getChatClearedAt() };
      }),

    react: protectedProcedure
      .input(z.object({ messageId: z.number(), emoji: z.string() }))
      .mutation(async ({ input, ctx }) => {
        return toggleMessageReaction(input.messageId, ctx.user.id, ctx.user.name || "User", input.emoji);
      }),

    clearAll: protectedProcedure
      .mutation(async ({ ctx }) => {
        return clearAllChatMessages(ctx.user.id, ctx.user.name || "User");
      }),
  }),

  // ─── Visitor Counter ──────────────────────────────────────────
  visitors: router({
    record: publicProcedure
      .mutation(async ({ ctx }) => {
        const ip = ctx.req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || ctx.req.socket.remoteAddress || 'unknown';
        const userAgent = ctx.req.headers['user-agent'] || 'unknown';
        return recordVisit(ip, userAgent);
      }),
    stats: publicProcedure
      .query(async () => {
        return getVisitorStats();
      }),
    recordPageView: publicProcedure
      .input(z.object({ pagePath: z.string(), symbol: z.string().nullable() }))
      .mutation(async ({ input, ctx }) => {
        const ip = ctx.req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || ctx.req.socket.remoteAddress || 'unknown';
        const userAgent = ctx.req.headers['user-agent'] || 'unknown';
        await recordPageView(input.pagePath, input.symbol, ip, userAgent);
        return { success: true };
      }),
    geoBreakdown: protectedProcedure
      .input(z.object({ days: z.number().min(1).max(365).default(30) }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getGeoBreakdown(input?.days ?? 30);
      }),
    pageAnalytics: protectedProcedure
      .input(z.object({ days: z.number().min(1).max(365).default(30) }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getPageAnalytics(input?.days ?? 30);
      }),
    recentVisitors: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getRecentVisitors(input?.limit ?? 50);
      }),
  }),
});

export type AppRouter = typeof appRouter;
