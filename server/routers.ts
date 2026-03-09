import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { ALL_STOCKS, ADX_STOCKS, DFM_STOCKS, SECTORS } from "../shared/stockData";
import { fetchStockData, fetchYahooChart, fetchBatchQuotes, fetchMultipleStocks, getFromMemoryCache, setMemoryCache, clearMemoryCache, fetchFullProfile } from "./stockService";
import { getAllStockSnapshots, getStockSnapshot, upsertStockSnapshot, addToWatchlist, removeFromWatchlist, getUserWatchlist, getMonitorSettingsForUser, upsertMonitorSettings, getUserPresets, savePreset, deletePreset, getUserNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead, deleteNotification, createNotification } from "./db";
import { invokeLLM } from "./_core/llm";
import { getMonitorStatus, getRecentAlerts, getTodayAlerts, dismissAlert, manualPoll, startVolumeMonitor, stopVolumeMonitor, isUAETradingHours, getNextTradingSession } from "./volumeMonitor";
import { checkAllApiHealth, getApiStatusSnapshot } from "./services/apiStatusService";
import { fetchAllTVStocks, fetchTVStocksByTickers, getTradingViewStats } from "./services/tradingViewService";
import { getTwelveDataStats } from "./services/twelveDataService";
import { getSWSStats } from "./services/simplyWallStService";
import { getYahooStats } from "./services/yahooFinanceService";

// ─── Background refresh state ───────────────────────────────────────
// Prevents multiple simultaneous background refreshes
const refreshInProgress = new Set<string>();

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
    console.log(`[Performance] Starting background refresh for ${exchange} via TradingView...`);
    const startTime = Date.now();
    
    // PRIMARY: Fetch ALL stocks from TradingView Scanner (covers both ADX & DFM)
    const tvStocks = await fetchAllTVStocks();
    
    // Build a map from TV ticker to TV data: "ADX:IHC" → data
    const tvMap = new Map<string, any>();
    for (const tv of tvStocks) {
      // TV ticker format: "ADX:IHC" or "DFM:EMAAR"
      const parts = tv.ticker.split(':');
      if (parts.length === 2) {
        tvMap.set(`${parts[0]}:${parts[1]}`, tv);
      }
    }
    
    const freshResults: any[] = [];
    const allStocksForExchange = exchange === "ADX" ? ADX_STOCKS : exchange === "DFM" ? DFM_STOCKS : ALL_STOCKS;
    
    for (const stock of allStocksForExchange) {
      const tvKey = `${stock.exchange}:${stock.symbol}`;
      const tvData = tvMap.get(tvKey);
      
      if (tvData) {
        const snapshot = tvToSnapshot(tvData, stock);
        try { await upsertStockSnapshot(snapshot); } catch (e) { /* ignore */ }
        freshResults.push(snapshot);
      } else {
        // Stock not found in TradingView, push with null data
        freshResults.push({
          symbol: stock.symbol,
          exchange: stock.exchange,
          name: stock.name,
          sector: stock.sector,
          yahooSymbol: stock.yahooSymbol,
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
    console.log(`[Performance] Background refresh for ${exchange} completed in ${elapsed}s (${matched}/${freshResults.length} stocks with data)`);
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
          if (age < 5 * 60 * 1000 && cached.price) return cached;
        }
        
        // PRIMARY: TradingView
        const tvKey = `${stock.exchange}:${stock.symbol}`;
        const tvStocks = await fetchTVStocksByTickers([tvKey]);
        if (tvStocks.length > 0) {
          const snapshot = tvToSnapshot(tvStocks[0], stock);
          try { await upsertStockSnapshot(snapshot); } catch (e) { /* ignore */ }
          return snapshot;
        }
        
        // FALLBACK: Yahoo Finance
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
            return memCached;
          }
        }
        
        // 2. Check DB cache (fast, ~200ms)
        if (!forceRefresh) {
          const cached = await getAllStockSnapshots(exchange === "ALL" ? undefined : exchange);
          const expectedCount = exchange === "ADX" ? ADX_STOCKS.length : exchange === "DFM" ? DFM_STOCKS.length : ALL_STOCKS.length;
          // Only use DB cache if it has a reasonable number of stocks (>80% coverage)
          if (cached.length > expectedCount * 0.8) {
            const results = cached.map(snap => {
              const info = ALL_STOCKS.find(s => s.symbol === snap.symbol);
              return { ...snap, name: info?.name, sector: info?.sector, yahooSymbol: info?.yahooSymbol };
            });
            
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
            
            // Return stale data immediately while refresh happens in background
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
        
        const stocks = exchange === "ADX" ? ADX_STOCKS : exchange === "DFM" ? DFM_STOCKS : ALL_STOCKS;
        const results = [];
        for (const stock of stocks) {
          const tvKey = `${stock.exchange}:${stock.symbol}`;
          const tvData = tvMap.get(tvKey);
          
          if (tvData) {
            const snapshot = tvToSnapshot(tvData, stock);
            try { await upsertStockSnapshot(snapshot); } catch (e) { /* ignore */ }
            results.push(snapshot);
          } else {
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

    chart: publicProcedure
      .input(z.object({
        symbol: z.string(),
        range: z.enum(["1mo", "3mo", "6mo", "1y", "2y", "5y"]).optional().default("3mo"),
        interval: z.enum(["1d", "1wk", "1mo"]).optional().default("1d"),
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
          return {
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
        }
        
        // FALLBACK: Yahoo Finance
        const data = await fetchStockData(stock);
        return { ...data, ...stock };
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
          return { symbol: stock.symbol, exchange: stock.exchange, name: stock.name, sector: stock.sector, yahooSymbol: stock.yahooSymbol, price: null, previousClose: null, open: null, dayHigh: null, dayLow: null, volume: null, avgVolume: null, marketCap: null, pe: null, eps: null, week52High: null, week52Low: null, dividendYield: null, beta: null, changePercent: null, rsi: null, sma20: null, sma50: null, ema12: null, ema26: null, volumeRatio: null };
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
        
        // Try Yahoo Finance for detailed profile
        let raw: any = null;
        if (stock.yahooSymbol) {
          raw = await fetchFullProfile(stock.yahooSymbol);
        }
        
        // If neither source has data, return unavailable
        if (!raw && !tvData) return { stock, profile: null, available: false };
        // Flatten the nested profile into a single object for the frontend
        // Use Yahoo data when available, fill gaps with TradingView
        const co = raw?.company || {} as any;
        const ks = raw?.keyStats || {} as any;
        const div = raw?.dividends || {} as any;
        const an = raw?.analyst || {} as any;
        const ti = raw?.tradingInfo || {} as any;
        const tv = tvData || {} as any;
        
        // Helper: pick first non-null value (Yahoo first, then TradingView)
        const pick = (...vals: any[]) => {
          for (const v of vals) { if (v != null && v !== 0) return v; }
          return null;
        };
        
        const profile = {
          // Company info
          name: co.name || tv.description || null,
          description: co.description || null,
          sector: co.sector || tv.sector || stock.sector || null,
          industry: co.industry || tv.industry || null,
          website: co.website || null,
          logo: co.logo || null,
          fullTimeEmployees: pick(co.fullTimeEmployees, tv.employees),
          country: co.country || null,
          city: co.city || null,
          phone: co.phone || null,
          officers: co.officers || [],
          // Key Stats - Valuation (merge Yahoo + TV)
          marketCap: pick(ks.marketCap, tv.marketCap),
          enterpriseValue: ks.enterpriseValue || null,
          trailingPE: pick(ks.trailingPE, tv.pe),
          forwardPE: ks.forwardPE || null,
          pegRatio: ks.pegRatio || null,
          priceToSales: pick(ks.priceToSales, tv.priceToSales),
          priceToBook: pick(ks.priceToBook, tv.priceToBook),
          evToRevenue: ks.evToRevenue || null,
          evToEbitda: ks.evToEbitda || null,
          // Key Stats - Profitability (merge Yahoo + TV)
          totalRevenue: pick(ks.totalRevenue, tv.totalRevenue),
          revenueGrowth: ks.revenueGrowth || null,
          grossMargin: pick(ks.grossMargin, tv.grossMargin),
          ebitdaMargin: ks.ebitdaMargin || null,
          operatingMargin: pick(ks.operatingMargin, tv.operatingMargin),
          profitMargin: pick(ks.profitMargin, tv.afterTaxMargin),
          returnOnEquity: pick(ks.returnOnEquity, tv.returnOnEquity),
          returnOnAssets: ks.returnOnAssets || null,
          // Key Stats - Financial Health (merge Yahoo + TV)
          totalCash: ks.totalCash || null,
          totalDebt: pick(ks.totalDebt, tv.totalDebt),
          debtToEquity: pick(ks.debtToEquity, tv.debtToEquity),
          currentRatio: pick(ks.currentRatio, tv.currentRatio),
          quickRatio: ks.quickRatio || null,
          bookValue: ks.bookValue || null,
          freeCashflow: pick(ks.freeCashflow, tv.freeCashFlow),
          operatingCashflow: ks.operatingCashflow || null,
          // Key Stats - Per Share (merge Yahoo + TV)
          trailingEps: pick(ks.trailingEps, tv.eps),
          forwardEps: ks.forwardEps || null,
          revenuePerShare: ks.revenuePerShare || null,
          // Key Stats - Trading (merge Yahoo + TV)
          beta: pick(ks.beta, tv.beta),
          fiftyTwoWeekHigh: pick(ks.fiftyTwoWeekHigh, tv.allTimeHigh),
          fiftyTwoWeekLow: pick(ks.fiftyTwoWeekLow, tv.allTimeLow),
          fiftyDayAverage: pick(ks.fiftyDayAverage, tv.sma50),
          twoHundredDayAverage: pick(ks.twoHundredDayAverage, tv.sma200),
          sharesOutstanding: pick(ks.sharesOutstanding, tv.sharesOutstanding),
          floatShares: ks.floatShares || null,
          heldPercentInsiders: ks.heldPercentInsiders || null,
          heldPercentInstitutions: ks.heldPercentInstitutions || null,
          shortRatio: ks.shortRatio || null,
          // Dividends (merge Yahoo + TV)
          dividendRate: div.dividendRate || null,
          dividendYield: pick(div.dividendYield, tv.dividendYield),
          exDividendDate: div.exDividendDate || null,
          payoutRatio: div.payoutRatio || null,
          fiveYearAvgDividendYield: div.fiveYearAvgDividendYield || null,
          trailingAnnualDividendRate: div.trailingAnnualDividendRate || null,
          trailingAnnualDividendYield: div.trailingAnnualDividendYield || null,
          // Analyst
          targetMeanPrice: an.targetMeanPrice || null,
          targetHighPrice: an.targetHighPrice || null,
          targetLowPrice: an.targetLowPrice || null,
          targetMedianPrice: an.targetMedianPrice || null,
          recommendationMean: an.recommendationMean || null,
          recommendationKey: an.recommendationKey || null,
          numberOfAnalystOpinions: an.numberOfAnalystOpinions || null,
          recommendations: an.recommendationTrend || [],
          // Earnings
          earnings: raw?.earnings?.history || [],
          // Financial Statements
          incomeStatement: raw?.financialStatements?.incomeStatements || [],
          balanceSheet: raw?.financialStatements?.balanceSheets || [],
          cashFlow: raw?.financialStatements?.cashFlows || [],
          // Insider Holders
          insiderHolders: raw?.insiderHolders || [],
          // Trading Info (merge Yahoo + TV)
          previousClose: pick(ti.previousClose, tv.close != null && tv.changeAbs != null ? tv.close - tv.changeAbs : null),
          open: pick(ti.open, tv.open),
          dayHigh: pick(ti.dayHigh, tv.high),
          dayLow: pick(ti.dayLow, tv.low),
          volume: pick(ti.volume, tv.volume),
          averageVolume: ti.averageVolume || null,
          averageVolume10days: ti.averageVolume10days || null,
          // TradingView-exclusive data
          tvRecommendation: tv.recommendAll ?? null,
          tvRSI: tv.rsi ?? null,
          tvMACD: tv.macdValue ?? null,
          tvMACDSignal: tv.macdSignal ?? null,
          tvSMA20: tv.sma20 ?? null,
          tvSMA50: tv.sma50 ?? null,
          tvSMA200: tv.sma200 ?? null,
          tvEMA20: tv.ema20 ?? null,
          tvEMA50: tv.ema50 ?? null,
          tvEMA200: tv.ema200 ?? null,
          tvEBITDA: tv.ebitda ?? null,
          tvNetIncome: tv.netIncome ?? null,
          tvTotalAssets: tv.totalAssets ?? null,
          tvGrossProfit: tv.grossProfit ?? null,
          tvPerfWeek: tv.perfWeek ?? null,
          tvPerfMonth: tv.perfMonth ?? null,
          tvPerf3Month: tv.perf3Month ?? null,
          tvPerfYear: tv.perfYear ?? null,
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
  }),
});

export type AppRouter = typeof appRouter;
