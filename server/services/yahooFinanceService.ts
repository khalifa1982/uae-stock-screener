/**
 * Yahoo Finance Service Status Tracker
 * Wraps the existing Yahoo Finance / Data API integration
 * to provide consistent health check and status reporting.
 */

import { callDataApi } from "../_core/dataApi";

export interface YahooServiceStatus {
  connected: boolean;
  lastChecked: string;
  error: string | null;
  method: string;
  lastSuccessfulFetch: string | null;
  coveredStocks: number;
}

let lastStatus: YahooServiceStatus = {
  connected: false,
  lastChecked: new Date().toISOString(),
  error: 'Not checked yet',
  method: 'built-in-data-api',
  lastSuccessfulFetch: null,
  coveredStocks: 68, // DFM stocks
};

let totalRequests = 0;
let failedRequests = 0;

/**
 * Health check - test the built-in Data API
 */
export async function checkYahooHealth(): Promise<YahooServiceStatus> {
  try {
    totalRequests++;
    // Use quoteSummary which works even outside market hours
    const data = await callDataApi('YahooFinance/get_stock_insights', {
      query: {
        symbol: 'EMAAR.DU',
      },
    }) as any;

    // If we get any response without error, the API is working
    if (data && !data.error) {
      lastStatus = {
        connected: true,
        lastChecked: new Date().toISOString(),
        error: null,
        method: 'built-in-data-api',
        lastSuccessfulFetch: new Date().toISOString(),
        coveredStocks: 68,
      };
    } else {
      // Try chart endpoint as fallback
      const chartData = await callDataApi('YahooFinance/get_stock_chart', {
        query: {
          symbol: 'EMAAR.DU',
          interval: '1d',
          range: '5d',
          includeAdjustedClose: 'true',
        },
      }) as any;

      const result = chartData?.chart?.result?.[0];
      if (result?.meta) {
        lastStatus = {
          connected: true,
          lastChecked: new Date().toISOString(),
          error: null,
          method: 'built-in-data-api',
          lastSuccessfulFetch: new Date().toISOString(),
          coveredStocks: 68,
        };
      } else {
        failedRequests++;
        lastStatus = {
          connected: false,
          lastChecked: new Date().toISOString(),
          error: 'API returned no data',
          method: 'built-in-data-api',
          lastSuccessfulFetch: lastStatus.lastSuccessfulFetch,
          coveredStocks: 68,
        };
      }
    }
    return lastStatus;
  } catch (e: any) {
    failedRequests++;
    lastStatus = {
      connected: false,
      lastChecked: new Date().toISOString(),
      error: e.message || 'Connection failed',
      method: 'built-in-data-api',
      lastSuccessfulFetch: lastStatus.lastSuccessfulFetch,
      coveredStocks: 68,
    };
    return lastStatus;
  }
}

/**
 * Get service statistics
 */
export function getYahooStats() {
  return {
    status: lastStatus,
    totalRequests,
    failedRequests,
    successRate: totalRequests > 0 ? ((totalRequests - failedRequests) / totalRequests * 100).toFixed(1) + '%' : 'N/A',
  };
}
