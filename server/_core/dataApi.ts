/**
 * Data API replacement - uses yahoo-finance2 npm package directly
 * instead of the Manus Forge proxy.
 * 
 * Maintains the same callDataApi interface for backward compatibility.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import yahooFinanceModule from "yahoo-finance2";
const yahooFinance = yahooFinanceModule as any;

export type DataApiCallOptions = {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
  formData?: Record<string, unknown>;
};

// Suppress yahoo-finance2 validation warnings
try {
  if (typeof yahooFinance.setGlobalConfig === 'function') {
    yahooFinance.setGlobalConfig({ validation: { logErrors: false } });
  }
  if (typeof yahooFinance.suppressNotices === 'function') {
    yahooFinance.suppressNotices(['yahooSurvey']);
  }
} catch { /* ignore config errors */ }

export async function callDataApi(
  apiId: string,
  options: DataApiCallOptions = {}
): Promise<unknown> {
  const query = options.query || {};

  switch (apiId) {
    case "YahooFinance/get_stock_chart": {
      const symbol = query.symbol as string;
      const interval = (query.interval as string) || "1d";
      const range = (query.range as string) || "5d";

      const intervalMap: Record<string, string> = {
        "1d": "1d", "1wk": "1wk", "1mo": "1mo",
        "5m": "5m", "15m": "15m", "30m": "30m", "60m": "60m", "1h": "1h",
      };
      const mappedInterval = intervalMap[interval] || "1d";

      try {
        const result: any = await yahooFinance.chart(symbol, {
          period1: getStartDate(range),
          interval: mappedInterval,
        });

        const timestamps = (result.quotes || []).map((q: any) => Math.floor(new Date(q.date).getTime() / 1000));
        const quotes = {
          open: (result.quotes || []).map((q: any) => q.open ?? null),
          high: (result.quotes || []).map((q: any) => q.high ?? null),
          low: (result.quotes || []).map((q: any) => q.low ?? null),
          close: (result.quotes || []).map((q: any) => q.close ?? null),
          volume: (result.quotes || []).map((q: any) => q.volume ?? null),
        };

        const meta = result.meta || {};
        return {
          chart: {
            result: [{
              meta: {
                symbol: meta.symbol ?? symbol,
                regularMarketPrice: meta.regularMarketPrice ?? null,
                chartPreviousClose: meta.chartPreviousClose ?? null,
                previousClose: meta.previousClose ?? null,
                regularMarketDayHigh: meta.regularMarketDayHigh ?? null,
                regularMarketDayLow: meta.regularMarketDayLow ?? null,
                regularMarketVolume: meta.regularMarketVolume ?? null,
                fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
                fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
                shortName: meta.shortName ?? null,
              },
              timestamp: timestamps,
              indicators: {
                quote: [quotes],
              },
            }],
          },
        };
      } catch (e: any) {
        console.warn(`[DataApi] yahoo-finance2 chart failed for ${symbol}:`, e.message);
        throw new Error(`Data API request failed: ${e.message}`);
      }
    }

    case "YahooFinance/get_stock_profile": {
      const symbol = query.symbol as string;
      try {
        const result: any = await yahooFinance.quoteSummary(symbol, {
          modules: ["summaryProfile", "assetProfile"],
        });
        return {
          quoteSummary: {
            result: [{
              summaryProfile: result?.summaryProfile || result?.assetProfile || {},
            }],
          },
        };
      } catch (e: any) {
        console.warn(`[DataApi] yahoo-finance2 profile failed for ${symbol}:`, e.message);
        throw new Error(`Data API request failed: ${e.message}`);
      }
    }

    case "YahooFinance/get_stock_holders": {
      const symbol = query.symbol as string;
      try {
        const result: any = await yahooFinance.quoteSummary(symbol, {
          modules: ["insiderHolders", "institutionOwnership"],
        });
        return {
          quoteSummary: {
            result: [{
              insiderHolders: result?.insiderHolders || { holders: [] },
            }],
          },
        };
      } catch (e: any) {
        console.warn(`[DataApi] yahoo-finance2 holders failed for ${symbol}:`, e.message);
        throw new Error(`Data API request failed: ${e.message}`);
      }
    }

    case "YahooFinance/get_stock_insights": {
      const symbol = query.symbol as string;
      try {
        const result: any = await yahooFinance.quoteSummary(symbol, {
          modules: ["financialData", "recommendationTrend"],
        });
        return result || {};
      } catch (e: any) {
        console.warn(`[DataApi] yahoo-finance2 insights failed for ${symbol}:`, e.message);
        throw new Error(`Data API request failed: ${e.message}`);
      }
    }

    default:
      throw new Error(`Unsupported Data API: ${apiId}`);
  }
}

function getStartDate(range: string): Date {
  const now = new Date();
  switch (range) {
    case "1d": return new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    case "5d": return new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    case "1mo": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "3mo": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "6mo": return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    case "1y": return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case "2y": return new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
    case "5y": return new Date(now.getTime() - 1825 * 24 * 60 * 60 * 1000);
    case "max": return new Date(2000, 0, 1);
    default: return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  }
}
