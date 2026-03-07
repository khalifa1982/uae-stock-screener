import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { ALL_STOCKS, ADX_STOCKS, DFM_STOCKS, SECTORS } from "../shared/stockData";
import { fetchStockData, fetchYahooChart, fetchBatchQuotes, fetchMultipleStocks } from "./stockService";
import { getAllStockSnapshots, getStockSnapshot, upsertStockSnapshot, addToWatchlist, removeFromWatchlist, getUserWatchlist } from "./db";
import { invokeLLM } from "./_core/llm";

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
    // Get the static stock list with exchange filter
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

    // Get sectors list
    sectors: publicProcedure.query(() => SECTORS),

    // Fetch real-time data for a single stock
    fetchOne: publicProcedure
      .input(z.object({ symbol: z.string(), exchange: z.enum(["ADX", "DFM"]) }))
      .query(async ({ input }) => {
        const stock = ALL_STOCKS.find(s => s.symbol === input.symbol && s.exchange === input.exchange);
        if (!stock) throw new Error("Stock not found");
        
        // Check cache first (less than 5 min old)
        const cached = await getStockSnapshot(input.symbol, input.exchange);
        if (cached && cached.updatedAt) {
          const age = Date.now() - new Date(cached.updatedAt).getTime();
          if (age < 5 * 60 * 1000 && cached.price) return cached;
        }
        
        const data = await fetchStockData(stock);
        return { ...data, ...stock };
      }),

    // Fetch data for all stocks of an exchange (batch)
    fetchAll: publicProcedure
      .input(z.object({
        exchange: z.enum(["ADX", "DFM", "ALL"]).optional().default("ALL"),
        forceRefresh: z.boolean().optional().default(false),
      }).optional())
      .query(async ({ input }) => {
        const exchange = input?.exchange || "ALL";
        const forceRefresh = input?.forceRefresh || false;
        
        // Try to return cached data first
        if (!forceRefresh) {
          const cached = await getAllStockSnapshots(exchange === "ALL" ? undefined : exchange);
          if (cached.length > 0) {
            // Check if data is fresh enough (less than 15 min)
            const newest = cached.reduce((a, b) => 
              new Date(a.updatedAt) > new Date(b.updatedAt) ? a : b
            );
            const age = Date.now() - new Date(newest.updatedAt).getTime();
            if (age < 15 * 60 * 1000) {
              // Merge with stock info
              return cached.map(snap => {
                const info = ALL_STOCKS.find(s => s.symbol === snap.symbol);
                return { ...snap, name: info?.name, sector: info?.sector, yahooSymbol: info?.yahooSymbol };
              });
            }
          }
        }
        
        // Fetch fresh data
        const stocks = exchange === "ADX" ? ADX_STOCKS : exchange === "DFM" ? DFM_STOCKS : ALL_STOCKS;
        
        // Use batch quote API for speed
        const yahooSymbols = stocks.map(s => s.yahooSymbol);
        const quotes = await fetchBatchQuotes(yahooSymbols);
        
        const results = [];
        for (const stock of stocks) {
          const quote = quotes.get(stock.yahooSymbol);
          const snapshot = {
            symbol: stock.symbol,
            exchange: stock.exchange,
            name: stock.name,
            sector: stock.sector,
            yahooSymbol: stock.yahooSymbol,
            price: quote?.regularMarketPrice ?? null,
            previousClose: quote?.regularMarketPreviousClose ?? null,
            open: quote?.regularMarketOpen ?? null,
            dayHigh: quote?.regularMarketDayHigh ?? null,
            dayLow: quote?.regularMarketDayLow ?? null,
            volume: quote?.regularMarketVolume ?? null,
            avgVolume: quote?.averageDailyVolume3Month ?? null,
            marketCap: quote?.marketCap ?? null,
            pe: quote?.trailingPE ?? null,
            eps: quote?.epsTrailingTwelveMonths ?? null,
            week52High: quote?.fiftyTwoWeekHigh ?? null,
            week52Low: quote?.fiftyTwoWeekLow ?? null,
            dividendYield: quote?.dividendYield ?? null,
            beta: quote?.beta ?? null,
            changePercent: quote?.regularMarketChangePercent ?? null,
            rsi: null as number | null,
            sma20: null as number | null,
            sma50: null as number | null,
            ema12: null as number | null,
            ema26: null as number | null,
            volumeRatio: null as number | null,
          };
          
          // Save to DB
          try {
            await upsertStockSnapshot(snapshot);
          } catch (e) {
            // ignore save errors
          }
          
          results.push(snapshot);
        }
        
        return results;
      }),

    // Get chart data for a stock
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

    // Get detailed stock data with technical indicators
    detail: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        const stock = ALL_STOCKS.find(s => s.symbol === input.symbol);
        if (!stock) throw new Error("Stock not found");
        
        const data = await fetchStockData(stock);
        return { ...data, ...stock };
      }),

    // Screen stocks based on filters
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
        // Get all cached snapshots
        let snapshots = await getAllStockSnapshots(input.exchange === "ALL" ? undefined : input.exchange);
        
        // Merge with stock info
        let results = snapshots.map(snap => {
          const info = ALL_STOCKS.find(s => s.symbol === snap.symbol);
          return { ...snap, name: info?.name, sector: info?.sector, yahooSymbol: info?.yahooSymbol };
        });

        // Apply filters
        if (input.sector) {
          results = results.filter(s => s.sector === input.sector);
        }
        if (input.minPE !== undefined) {
          results = results.filter(s => s.pe != null && s.pe >= input.minPE!);
        }
        if (input.maxPE !== undefined) {
          results = results.filter(s => s.pe != null && s.pe <= input.maxPE!);
        }
        if (input.minPrice !== undefined) {
          results = results.filter(s => s.price != null && s.price >= input.minPrice!);
        }
        if (input.maxPrice !== undefined) {
          results = results.filter(s => s.price != null && s.price <= input.maxPrice!);
        }
        if (input.minMarketCap !== undefined) {
          results = results.filter(s => s.marketCap != null && s.marketCap >= input.minMarketCap!);
        }
        if (input.maxMarketCap !== undefined) {
          results = results.filter(s => s.marketCap != null && s.marketCap <= input.maxMarketCap!);
        }
        if (input.minVolume !== undefined) {
          results = results.filter(s => s.volume != null && s.volume >= input.minVolume!);
        }
        if (input.minRSI !== undefined) {
          results = results.filter(s => s.rsi != null && s.rsi >= input.minRSI!);
        }
        if (input.maxRSI !== undefined) {
          results = results.filter(s => s.rsi != null && s.rsi <= input.maxRSI!);
        }
        if (input.minChangePercent !== undefined) {
          results = results.filter(s => s.changePercent != null && s.changePercent >= input.minChangePercent!);
        }
        if (input.maxChangePercent !== undefined) {
          results = results.filter(s => s.changePercent != null && s.changePercent <= input.maxChangePercent!);
        }
        if (input.aboveSMA50) {
          results = results.filter(s => s.price != null && s.sma50 != null && s.price > s.sma50);
        }
        if (input.goldenCross) {
          results = results.filter(s => s.sma20 != null && s.sma50 != null && s.sma20 > s.sma50);
        }
        if (input.highVolume) {
          results = results.filter(s => s.volumeRatio != null && s.volumeRatio > 1.5);
        }

        return results;
      }),

    // AI Sentiment analysis for a stock
    sentiment: publicProcedure
      .input(z.object({ symbol: z.string(), name: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: "You are a financial analyst specializing in UAE stock markets (ADX and DFM). Analyze the given stock and provide a brief sentiment assessment. Return JSON with: sentiment (bullish/bearish/neutral), score (-1 to 1), and summary (2-3 sentences)."
              },
              {
                role: "user",
                content: `Analyze the current market sentiment for ${input.name} (${input.symbol}) listed on the UAE stock exchange. Consider recent market conditions, sector trends, and the company's position in the UAE economy. Return your analysis as JSON.`
              }
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
          if (typeof content === "string") {
            return JSON.parse(content);
          }
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
});

export type AppRouter = typeof appRouter;
