/**
 * TwelveData Comprehensive Data Service for UAE Stocks (ADX & DFM only)
 * Provides: OHLCV charts, 23 technical indicators, quotes, market state, statistics
 */

import { toTwelveDataSymbol } from "./tdSymbolMapper";

const API_KEY = process.env.TWELVEDATA_API_KEY || "";
const BASE_URL = "https://api.twelvedata.com";
const TIMEOUT = 12000;

// UAE exchanges only
const VALID_EXCHANGES = new Set(["ADX", "DFM"]);

function validateUAE(exchange: string): void {
  if (!VALID_EXCHANGES.has(exchange)) {
    throw new Error(
      `TwelveData: Only UAE markets (ADX, DFM) are supported. Got: ${exchange}`
    );
  }
}

async function fetchTD<T>(endpoint: string, params: Record<string, string>): Promise<T | null> {
  try {
    const url = new URL(`${BASE_URL}/${endpoint}`);
    url.searchParams.set("apikey", API_KEY);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    const resp = await fetch(url.toString(), {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = await resp.json();
    if (data.code || data.status === "error") {
      console.warn(`TwelveData ${endpoint} error:`, data.message?.substring(0, 100));
      return null;
    }
    return data as T;
  } catch (e: any) {
    console.warn(`TwelveData ${endpoint} fetch failed:`, e.message?.substring(0, 80));
    return null;
  }
}

// ─── OHLCV Chart Data ───────────────────────────────────────────

export interface TDCandle {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TDTimeSeries {
  meta: {
    symbol: string;
    interval: string;
    currency: string;
    exchange: string;
    type: string;
  };
  values: TDCandle[];
}

/**
 * Fetch OHLCV chart data from TwelveData
 * @param interval - 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 1day, 1week, 1month
 * @param outputsize - Number of data points (max 5000)
 */
export async function fetchChartData(
  tvSymbol: string,
  exchange: "ADX" | "DFM",
  interval: string = "1day",
  outputsize: number = 90
): Promise<TDCandle[] | null> {
  validateUAE(exchange);
  const info = toTwelveDataSymbol(tvSymbol, exchange);
  if (!info) return null;

  const data = await fetchTD<TDTimeSeries>("time_series", {
    symbol: info.fullSymbol,
    interval,
    outputsize: String(outputsize),
  });

  if (!data?.values) return null;

  return data.values
    .map((v: any) => ({
      datetime: v.datetime,
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: parseInt(v.volume) || 0,
    }))
    .reverse(); // TwelveData returns newest first, we want oldest first
}

// ─── Real-time Quote ────────────────────────────────────────────

export interface TDQuote {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  open: number;
  high: number;
  low: number;
  close: number;
  previous_close: number;
  change: number;
  percent_change: number;
  volume: number;
  average_volume: number;
  fifty_two_week: {
    low: number;
    high: number;
    low_change: number;
    high_change: number;
    low_change_percent: number;
    high_change_percent: number;
    range: string;
  };
  is_market_open: boolean;
}

export async function fetchQuote(
  tvSymbol: string,
  exchange: "ADX" | "DFM"
): Promise<TDQuote | null> {
  validateUAE(exchange);
  const info = toTwelveDataSymbol(tvSymbol, exchange);
  if (!info) return null;

  return fetchTD<TDQuote>("quote", { symbol: info.fullSymbol });
}

// ─── Technical Indicators ───────────────────────────────────────

export interface TDIndicatorValue {
  datetime: string;
  [key: string]: string;
}

export interface TDIndicatorResult {
  meta: Record<string, any>;
  values: TDIndicatorValue[];
}

// All 104 TwelveData technical indicators supported for UAE stocks (ADX & DFM)
export const AVAILABLE_INDICATORS = [
  // Trend Indicators
  "sma", "ema", "dema", "tema", "ma", "wma", "trima", "t3ma",
  "kama", "mama", "mcginley_dynamic",
  "bbands", "keltner", "ichimoku",
  "supertrend", "supertrend_heikinashicandles",
  "sar", "sarext",
  "adx", "adxr", "dx",
  "aroon", "aroonosc",
  "linearreg", "linearregangle", "linearregintercept", "linearregslope",
  "tsf",
  "ht_trendline", "ht_trendmode",
  // Momentum Indicators
  "rsi", "stoch", "stochf", "stochrsi",
  "macd", "macdext", "macd_slope",
  "mom", "roc", "rocp", "rocr", "rocr100",
  "cci", "willr", "mfi",
  "apo", "ppo", "cmo", "crsi",
  "bop", "ultosc", "dpo", "coppock",
  "plus_di", "minus_di", "plus_dm", "minus_dm",
  "percent_b",
  // Volatility Indicators
  "atr", "natr", "trange",
  "beta", "stddev", "var",
  // Volume Indicators
  "obv", "ad", "adosc", "vwap", "rvol",
  // Support/Resistance
  "pivot_points_hl",
  // Special Candle Types
  "heikinashicandles",
  // Hilbert Transform
  "ht_dcperiod", "ht_dcphase", "ht_phasor", "ht_sine",
  // Math/Utility
  "avg", "avgprice", "medprice", "midpoint", "midprice",
  "typprice", "wclprice", "hlc3",
  "max", "maxindex", "min", "minindex", "minmax", "minmaxindex",
  "correl", "sum",
  "add", "sub", "mult", "div",
  "ceil", "floor", "sqrt", "exp", "ln", "log10",
] as const;

// Key indicators used for technical analysis summary
export const KEY_ANALYSIS_INDICATORS: { name: IndicatorName; params?: Record<string, string> }[] = [
  // Oscillators
  { name: "rsi" },
  { name: "macd" },
  { name: "stoch" },
  { name: "stochrsi" },
  { name: "cci" },
  { name: "willr" },
  { name: "mfi" },
  { name: "mom" },
  { name: "roc" },
  { name: "adx" },
  { name: "dx" },
  { name: "bop" },
  { name: "cmo" },
  { name: "ultosc" },
  { name: "apo" },
  { name: "ppo" },
  { name: "dpo" },
  { name: "crsi" },
  // Trend
  { name: "supertrend" },
  { name: "aroon" },
  { name: "sar" },
  // Volatility
  { name: "atr" },
  { name: "natr" },
  { name: "bbands" },
  { name: "keltner" },
  { name: "beta" },
  // Volume
  { name: "rvol" },
  { name: "adosc" },
  // Ichimoku
  { name: "ichimoku" },
  // Pivot
  { name: "pivot_points_hl" },
];

export type IndicatorName = (typeof AVAILABLE_INDICATORS)[number];

/**
 * Fetch a single technical indicator
 */
export async function fetchIndicator(
  tvSymbol: string,
  exchange: "ADX" | "DFM",
  indicator: IndicatorName,
  interval: string = "1day",
  outputsize: number = 30,
  extraParams?: Record<string, string>
): Promise<TDIndicatorResult | null> {
  validateUAE(exchange);
  const info = toTwelveDataSymbol(tvSymbol, exchange);
  if (!info) return null;

  return fetchTD<TDIndicatorResult>(indicator, {
    symbol: info.fullSymbol,
    interval,
    outputsize: String(outputsize),
    ...extraParams,
  });
}

/**
 * Fetch multiple indicators in parallel for a stock
 * Returns a map of indicator name → latest values
 */
export async function fetchAllIndicators(
  tvSymbol: string,
  exchange: "ADX" | "DFM",
  interval: string = "1day"
): Promise<Record<string, any>> {
  validateUAE(exchange);
  const info = toTwelveDataSymbol(tvSymbol, exchange);
  if (!info) return {};

  // Use expanded KEY_ANALYSIS_INDICATORS list with all 30 key indicators
  const keyIndicators = [
    ...KEY_ANALYSIS_INDICATORS,
    // Additional MA periods for summary
    { name: "sma" as IndicatorName, params: { time_period: "20" } },
    { name: "sma" as IndicatorName, params: { time_period: "50" } },
    { name: "sma" as IndicatorName, params: { time_period: "200" } },
    { name: "ema" as IndicatorName, params: { time_period: "12" } },
    { name: "ema" as IndicatorName, params: { time_period: "26" } },
  ];

  const results: Record<string, any> = {};

  // Batch in groups of 8 for faster fetching while respecting rate limits
  for (let i = 0; i < keyIndicators.length; i += 8) {
    const batch = keyIndicators.slice(i, i + 8);
    const batchResults = await Promise.allSettled(
      batch.map((ind) =>
        fetchIndicator(tvSymbol, exchange, ind.name, interval, 3, ind.params)
      )
    );

    for (let j = 0; j < batch.length; j++) {
      const ind = batch[j];
      const result = batchResults[j];
      const key = ind.params
        ? `${ind.name}_${Object.values(ind.params).join("_")}`
        : ind.name;

      if (result.status === "fulfilled" && result.value?.values?.[0]) {
        results[key] = result.value.values[0];
      }
    }
  }

  return results;
}

// ─── Moving Average Summary (Buy/Sell/Neutral) ─────────────────

export interface MASummary {
  name: string;
  period: number;
  value: number;
  action: "Buy" | "Sell" | "Neutral";
}

/**
 * Calculate moving average buy/sell signals
 */
export async function fetchMASummary(
  tvSymbol: string,
  exchange: "ADX" | "DFM",
  currentPrice: number
): Promise<{ sma: MASummary[]; ema: MASummary[] }> {
  validateUAE(exchange);
  const info = toTwelveDataSymbol(tvSymbol, exchange);
  if (!info) return { sma: [], ema: [] };

  const periods = [5, 10, 20, 30, 50, 100, 200];
  const smaResults: MASummary[] = [];
  const emaResults: MASummary[] = [];

  // Fetch all SMAs and EMAs
  for (let i = 0; i < periods.length; i += 3) {
    const batch = periods.slice(i, i + 3);
    const smaPromises = batch.map((p) =>
      fetchIndicator(tvSymbol, exchange, "sma", "1day", 1, {
        time_period: String(p),
      })
    );
    const emaPromises = batch.map((p) =>
      fetchIndicator(tvSymbol, exchange, "ema", "1day", 1, {
        time_period: String(p),
      })
    );

    const [smaRes, emaRes] = await Promise.all([
      Promise.allSettled(smaPromises),
      Promise.allSettled(emaPromises),
    ]);

    for (let j = 0; j < batch.length; j++) {
      const period = batch[j];
      if (smaRes[j].status === "fulfilled") {
        const val = parseFloat(
          (smaRes[j] as PromiseFulfilledResult<any>).value?.values?.[0]?.sma || "0"
        );
        if (val > 0) {
          smaResults.push({
            name: `SMA`,
            period,
            value: val,
            action: currentPrice > val ? "Buy" : currentPrice < val ? "Sell" : "Neutral",
          });
        }
      }
      if (emaRes[j].status === "fulfilled") {
        const val = parseFloat(
          (emaRes[j] as PromiseFulfilledResult<any>).value?.values?.[0]?.ema || "0"
        );
        if (val > 0) {
          emaResults.push({
            name: `EMA`,
            period,
            value: val,
            action: currentPrice > val ? "Buy" : currentPrice < val ? "Sell" : "Neutral",
          });
        }
      }
    }
  }

  return { sma: smaResults, ema: emaResults };
}

// ─── Oscillator Summary ─────────────────────────────────────────

export interface OscillatorSummary {
  name: string;
  value: number;
  action: "Buy" | "Sell" | "Neutral";
}

/**
 * Calculate oscillator buy/sell signals
 */
export function computeOscillatorSignals(
  indicators: Record<string, any>
): OscillatorSummary[] {
  const signals: OscillatorSummary[] = [];

  // RSI
  if (indicators.rsi) {
    const val = parseFloat(indicators.rsi.rsi);
    signals.push({
      name: "RSI (14)",
      value: val,
      action: val < 30 ? "Buy" : val > 70 ? "Sell" : "Neutral",
    });
  }

  // Stochastic %K
  if (indicators.stoch) {
    const val = parseFloat(indicators.stoch.slow_k);
    signals.push({
      name: "Stochastic %K (14, 3, 3)",
      value: val,
      action: val < 20 ? "Buy" : val > 80 ? "Sell" : "Neutral",
    });
  }

  // CCI
  if (indicators.cci) {
    const val = parseFloat(indicators.cci.cci);
    signals.push({
      name: "CCI (20)",
      value: val,
      action: val < -100 ? "Buy" : val > 100 ? "Sell" : "Neutral",
    });
  }

  // MACD
  if (indicators.macd) {
    const macdVal = parseFloat(indicators.macd.macd);
    const signal = parseFloat(indicators.macd.macd_signal);
    signals.push({
      name: "MACD (12, 26)",
      value: macdVal,
      action: macdVal > signal ? "Buy" : macdVal < signal ? "Sell" : "Neutral",
    });
  }

  // Momentum
  if (indicators.mom) {
    const val = parseFloat(indicators.mom.mom);
    signals.push({
      name: "Momentum (10)",
      value: val,
      action: val > 0 ? "Buy" : val < 0 ? "Sell" : "Neutral",
    });
  }

  // Williams %R
  if (indicators.willr) {
    const val = parseFloat(indicators.willr.willr);
    signals.push({
      name: "Williams %R (14)",
      value: val,
      action: val < -80 ? "Buy" : val > -20 ? "Sell" : "Neutral",
    });
  }

  // MFI
  if (indicators.mfi) {
    const val = parseFloat(indicators.mfi.mfi);
    signals.push({
      name: "MFI (14)",
      value: val,
      action: val < 20 ? "Buy" : val > 80 ? "Sell" : "Neutral",
    });
  }

  // ADX / DX
  if (indicators.dx) {
    const val = parseFloat(indicators.dx.dx);
    signals.push({
      name: "ADX (14)",
      value: val,
      action: val > 25 ? "Buy" : val < 20 ? "Sell" : "Neutral",
    });
  }

  // ROC
  if (indicators.roc) {
    const val = parseFloat(indicators.roc.roc);
    signals.push({
      name: "ROC (10)",
      value: val,
      action: val > 0 ? "Buy" : val < 0 ? "Sell" : "Neutral",
    });
  }

  // Supertrend
  if (indicators.supertrend) {
    const val = parseFloat(indicators.supertrend.supertrend);
    signals.push({
      name: "Supertrend",
      value: val,
      action: indicators.supertrend.supertrend_direction === "up" ? "Buy" : "Sell",
    });
  }

  // Stochastic RSI
  if (indicators.stochrsi) {
    const val = parseFloat(indicators.stochrsi.stochrsi || indicators.stochrsi.fast_k || "0");
    if (!isNaN(val)) signals.push({
      name: "Stochastic RSI (14)",
      value: val,
      action: val < 20 ? "Buy" : val > 80 ? "Sell" : "Neutral",
    });
  }

  // ADX (Average Directional Index)
  if (indicators.adx) {
    const val = parseFloat(indicators.adx.adx);
    if (!isNaN(val)) signals.push({
      name: "ADX (14)",
      value: val,
      action: val > 25 ? "Buy" : val < 20 ? "Sell" : "Neutral",
    });
  }

  // Balance of Power
  if (indicators.bop) {
    const val = parseFloat(indicators.bop.bop);
    if (!isNaN(val)) signals.push({
      name: "Balance of Power",
      value: val,
      action: val > 0 ? "Buy" : val < 0 ? "Sell" : "Neutral",
    });
  }

  // Chande Momentum Oscillator
  if (indicators.cmo) {
    const val = parseFloat(indicators.cmo.cmo);
    if (!isNaN(val)) signals.push({
      name: "CMO (14)",
      value: val,
      action: val > 50 ? "Buy" : val < -50 ? "Sell" : "Neutral",
    });
  }

  // Ultimate Oscillator
  if (indicators.ultosc) {
    const val = parseFloat(indicators.ultosc.ultosc);
    if (!isNaN(val)) signals.push({
      name: "Ultimate Oscillator",
      value: val,
      action: val < 30 ? "Buy" : val > 70 ? "Sell" : "Neutral",
    });
  }

  // Absolute Price Oscillator
  if (indicators.apo) {
    const val = parseFloat(indicators.apo.apo);
    if (!isNaN(val)) signals.push({
      name: "APO",
      value: val,
      action: val > 0 ? "Buy" : val < 0 ? "Sell" : "Neutral",
    });
  }

  // Percentage Price Oscillator
  if (indicators.ppo) {
    const val = parseFloat(indicators.ppo.ppo);
    if (!isNaN(val)) signals.push({
      name: "PPO",
      value: val,
      action: val > 0 ? "Buy" : val < 0 ? "Sell" : "Neutral",
    });
  }

  // Detrended Price Oscillator
  if (indicators.dpo) {
    const val = parseFloat(indicators.dpo.dpo);
    if (!isNaN(val)) signals.push({
      name: "DPO (20)",
      value: val,
      action: val > 0 ? "Buy" : val < 0 ? "Sell" : "Neutral",
    });
  }

  // ConnorsRSI
  if (indicators.crsi) {
    const val = parseFloat(indicators.crsi.crsi);
    if (!isNaN(val)) signals.push({
      name: "ConnorsRSI",
      value: val,
      action: val < 20 ? "Buy" : val > 80 ? "Sell" : "Neutral",
    });
  }

  // Aroon
  if (indicators.aroon) {
    const up = parseFloat(indicators.aroon.aroon_up);
    const down = parseFloat(indicators.aroon.aroon_down);
    if (!isNaN(up) && !isNaN(down)) signals.push({
      name: "Aroon (14)",
      value: up - down,
      action: up > 70 && down < 30 ? "Buy" : down > 70 && up < 30 ? "Sell" : "Neutral",
    });
  }

  // Parabolic SAR
  if (indicators.sar) {
    const val = parseFloat(indicators.sar.sar);
    if (!isNaN(val)) signals.push({
      name: "Parabolic SAR",
      value: val,
      action: "Neutral", // Signal depends on price comparison, set in fetchTechnicalAnalysis
    });
  }

  // NATR (Normalized ATR)
  if (indicators.natr) {
    const val = parseFloat(indicators.natr.natr);
    if (!isNaN(val)) signals.push({
      name: "NATR (14)",
      value: val,
      action: val < 1 ? "Buy" : val > 3 ? "Sell" : "Neutral",
    });
  }

  // Beta
  if (indicators.beta) {
    const val = parseFloat(indicators.beta.beta);
    if (!isNaN(val)) signals.push({
      name: "Beta",
      value: val,
      action: val < 0.8 ? "Buy" : val > 1.5 ? "Sell" : "Neutral",
    });
  }

  // Relative Volume
  if (indicators.rvol) {
    const val = parseFloat(indicators.rvol.rvol);
    if (!isNaN(val)) signals.push({
      name: "Relative Volume",
      value: val,
      action: val > 2 ? "Buy" : val < 0.5 ? "Sell" : "Neutral",
    });
  }

  return signals;
}

// ─── Market State ───────────────────────────────────────────────

export interface MarketState {
  name: string;
  code: string;
  country: string;
  isOpen: boolean;
  timeToOpen: string;
  timeToClose: string;
}

export async function fetchMarketState(
  exchange: "ADX" | "DFM"
): Promise<MarketState | null> {
  validateUAE(exchange);

  const data = await fetchTD<any[]>("market_state", { exchange });
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const m = data[0];
  return {
    name: m.name,
    code: m.code,
    country: m.country,
    isOpen: m.is_market_open,
    timeToOpen: m.time_to_open || "",
    timeToClose: m.time_to_close || "",
  };
}

// ─── Statistics (partial data for UAE) ──────────────────────────

export interface TDStatistics {
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekChange: number | null;
  avg10Volume: number | null;
  avg90Volume: number | null;
  beta: number | null;
  day50MA: number | null;
  day200MA: number | null;
}

export async function fetchStatistics(
  tvSymbol: string,
  exchange: "ADX" | "DFM"
): Promise<TDStatistics | null> {
  validateUAE(exchange);
  const info = toTwelveDataSymbol(tvSymbol, exchange);
  if (!info) return null;

  const data = await fetchTD<any>("statistics", { symbol: info.fullSymbol });
  if (!data?.statistics) return null;

  const s = data.statistics;
  return {
    fiftyTwoWeekLow: s.stock_price_summary?.fifty_two_week_low ?? null,
    fiftyTwoWeekHigh: s.stock_price_summary?.fifty_two_week_high ?? null,
    fiftyTwoWeekChange: s.stock_price_summary?.fifty_two_week_change ?? null,
    avg10Volume: s.stock_statistics?.avg_10_volume ?? null,
    avg90Volume: s.stock_statistics?.avg_90_volume ?? null,
    beta: s.stock_price_summary?.beta ?? null,
    day50MA: s.stock_price_summary?.day_50_ma ?? null,
    day200MA: s.stock_price_summary?.day_200_ma ?? null,
  };
}

// ─── Comprehensive Technical Analysis ───────────────────────────

export interface TechnicalAnalysis {
  oscillators: OscillatorSummary[];
  movingAverages: { sma: MASummary[]; ema: MASummary[] };
  summary: {
    oscillatorsBuy: number;
    oscillatorsSell: number;
    oscillatorsNeutral: number;
    maBuy: number;
    maSell: number;
    maNeutral: number;
    overallSignal: "Strong Buy" | "Buy" | "Neutral" | "Sell" | "Strong Sell";
  };
  indicators: Record<string, any>;
}

/**
 * Fetch comprehensive technical analysis for a stock
 * This is the main function that combines all indicator data
 */
export async function fetchTechnicalAnalysis(
  tvSymbol: string,
  exchange: "ADX" | "DFM",
  currentPrice: number
): Promise<TechnicalAnalysis | null> {
  validateUAE(exchange);

  // Fetch indicators and MA summary in parallel
  const [indicators, maSummary] = await Promise.all([
    fetchAllIndicators(tvSymbol, exchange),
    fetchMASummary(tvSymbol, exchange, currentPrice),
  ]);

  if (Object.keys(indicators).length === 0) return null;

  const oscillators = computeOscillatorSignals(indicators);

  // Fix Parabolic SAR signal based on current price
  const sarSignal = oscillators.find(o => o.name === "Parabolic SAR");
  if (sarSignal) {
    sarSignal.action = currentPrice > sarSignal.value ? "Buy" : "Sell";
  }

  // Count signals
  const oscBuy = oscillators.filter((o) => o.action === "Buy").length;
  const oscSell = oscillators.filter((o) => o.action === "Sell").length;
  const oscNeutral = oscillators.filter((o) => o.action === "Neutral").length;

  const allMA = [...maSummary.sma, ...maSummary.ema];
  const maBuy = allMA.filter((m) => m.action === "Buy").length;
  const maSell = allMA.filter((m) => m.action === "Sell").length;
  const maNeutral = allMA.filter((m) => m.action === "Neutral").length;

  const totalBuy = oscBuy + maBuy;
  const totalSell = oscSell + maSell;
  const total = totalBuy + totalSell + oscNeutral + maNeutral;

  let overallSignal: TechnicalAnalysis["summary"]["overallSignal"] = "Neutral";
  if (total > 0) {
    const buyRatio = totalBuy / total;
    const sellRatio = totalSell / total;
    if (buyRatio > 0.6) overallSignal = buyRatio > 0.8 ? "Strong Buy" : "Buy";
    else if (sellRatio > 0.6) overallSignal = sellRatio > 0.8 ? "Strong Sell" : "Sell";
  }

  return {
    oscillators,
    movingAverages: maSummary,
    summary: {
      oscillatorsBuy: oscBuy,
      oscillatorsSell: oscSell,
      oscillatorsNeutral: oscNeutral,
      maBuy,
      maSell,
      maNeutral,
      overallSignal,
    },
    indicators,
  };
}

// ─── Bollinger Bands History (for chart overlay) ────────────────

export interface BBandPoint {
  datetime: string;
  upper: number;
  middle: number;
  lower: number;
}

export async function fetchBBandsHistory(
  tvSymbol: string,
  exchange: "ADX" | "DFM",
  outputsize: number = 90
): Promise<BBandPoint[] | null> {
  validateUAE(exchange);
  const result = await fetchIndicator(tvSymbol, exchange, "bbands", "1day", outputsize);
  if (!result?.values) return null;

  return result.values
    .map((v: any) => ({
      datetime: v.datetime,
      upper: parseFloat(v.upper_band),
      middle: parseFloat(v.middle_band),
      lower: parseFloat(v.lower_band),
    }))
    .reverse();
}

// ─── MACD History (for chart) ───────────────────────────────────

export interface MACDPoint {
  datetime: string;
  macd: number;
  signal: number;
  histogram: number;
}

export async function fetchMACDHistory(
  tvSymbol: string,
  exchange: "ADX" | "DFM",
  outputsize: number = 90
): Promise<MACDPoint[] | null> {
  validateUAE(exchange);
  const result = await fetchIndicator(tvSymbol, exchange, "macd", "1day", outputsize);
  if (!result?.values) return null;

  return result.values
    .map((v: any) => ({
      datetime: v.datetime,
      macd: parseFloat(v.macd),
      signal: parseFloat(v.macd_signal),
      histogram: parseFloat(v.macd_hist),
    }))
    .reverse();
}

// ─── RSI History (for chart) ────────────────────────────────────

export interface RSIPoint {
  datetime: string;
  rsi: number;
}

export async function fetchRSIHistory(
  tvSymbol: string,
  exchange: "ADX" | "DFM",
  outputsize: number = 90
): Promise<RSIPoint[] | null> {
  validateUAE(exchange);
  const result = await fetchIndicator(tvSymbol, exchange, "rsi", "1day", outputsize);
  if (!result?.values) return null;

  return result.values
    .map((v: any) => ({
      datetime: v.datetime,
      rsi: parseFloat(v.rsi),
    }))
    .reverse();
}

// ─── Keltner Channels History (for chart overlay) ─────────────

export interface KeltnerPoint {
  datetime: string;
  upper: number;
  middle: number;
  lower: number;
}

export async function fetchKeltnerHistory(
  tvSymbol: string,
  exchange: "ADX" | "DFM",
  outputsize: number = 90
): Promise<KeltnerPoint[] | null> {
  validateUAE(exchange);
  const result = await fetchIndicator(tvSymbol, exchange, "keltner", "1day", outputsize);
  if (!result?.values) return null;

  return result.values
    .map((v: any) => ({
      datetime: v.datetime,
      upper: parseFloat(v.upper_line),
      middle: parseFloat(v.middle_line),
      lower: parseFloat(v.lower_line),
    }))
    .reverse();
}

// ─── Ichimoku Cloud History ───────────────────────────────────

export interface IchimokuPoint {
  datetime: string;
  tenkan: number;
  kijun: number;
  senkouA: number;
  senkouB: number;
  chikou: number;
}

export async function fetchIchimokuHistory(
  tvSymbol: string,
  exchange: "ADX" | "DFM",
  outputsize: number = 90
): Promise<IchimokuPoint[] | null> {
  validateUAE(exchange);
  const result = await fetchIndicator(tvSymbol, exchange, "ichimoku", "1day", outputsize);
  if (!result?.values) return null;

  return result.values
    .map((v: any) => ({
      datetime: v.datetime,
      tenkan: parseFloat(v.tenkan_sen),
      kijun: parseFloat(v.kijun_sen),
      senkouA: parseFloat(v.senkou_span_a),
      senkouB: parseFloat(v.senkou_span_b),
      chikou: parseFloat(v.chikou_span),
    }))
    .reverse();
}

// ─── Parabolic SAR History ────────────────────────────────────

export interface SARPoint {
  datetime: string;
  sar: number;
}

export async function fetchSARHistory(
  tvSymbol: string,
  exchange: "ADX" | "DFM",
  outputsize: number = 90
): Promise<SARPoint[] | null> {
  validateUAE(exchange);
  const result = await fetchIndicator(tvSymbol, exchange, "sar", "1day", outputsize);
  if (!result?.values) return null;

  return result.values
    .map((v: any) => ({
      datetime: v.datetime,
      sar: parseFloat(v.sar),
    }))
    .reverse();
}

// ─── Supertrend History ───────────────────────────────────────

export interface SupertrendPoint {
  datetime: string;
  supertrend: number;
  direction: "up" | "down";
}

export async function fetchSupertrendHistory(
  tvSymbol: string,
  exchange: "ADX" | "DFM",
  outputsize: number = 90
): Promise<SupertrendPoint[] | null> {
  validateUAE(exchange);
  const result = await fetchIndicator(tvSymbol, exchange, "supertrend", "1day", outputsize);
  if (!result?.values) return null;

  return result.values
    .map((v: any) => ({
      datetime: v.datetime,
      supertrend: parseFloat(v.supertrend),
      direction: v.supertrend_direction as "up" | "down",
    }))
    .reverse();
}

// ─── Stochastic RSI History ───────────────────────────────────

export interface StochRSIPoint {
  datetime: string;
  fastK: number;
  fastD: number;
}

export async function fetchStochRSIHistory(
  tvSymbol: string,
  exchange: "ADX" | "DFM",
  outputsize: number = 90
): Promise<StochRSIPoint[] | null> {
  validateUAE(exchange);
  const result = await fetchIndicator(tvSymbol, exchange, "stochrsi", "1day", outputsize);
  if (!result?.values) return null;

  return result.values
    .map((v: any) => ({
      datetime: v.datetime,
      fastK: parseFloat(v.fast_k),
      fastD: parseFloat(v.fast_d),
    }))
    .reverse();
}

// ─── Heikin-Ashi Candles ──────────────────────────────────────

export interface HeikinAshiCandle {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export async function fetchHeikinAshiCandles(
  tvSymbol: string,
  exchange: "ADX" | "DFM",
  outputsize: number = 90
): Promise<HeikinAshiCandle[] | null> {
  validateUAE(exchange);
  const result = await fetchIndicator(tvSymbol, exchange, "heikinashicandles", "1day", outputsize);
  if (!result?.values) return null;

  return result.values
    .map((v: any) => ({
      datetime: v.datetime,
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
    }))
    .reverse();
}

// ─── ATR History (for volatility chart) ───────────────────────

export interface ATRPoint {
  datetime: string;
  atr: number;
}

export async function fetchATRHistory(
  tvSymbol: string,
  exchange: "ADX" | "DFM",
  outputsize: number = 90
): Promise<ATRPoint[] | null> {
  validateUAE(exchange);
  const result = await fetchIndicator(tvSymbol, exchange, "atr", "1day", outputsize);
  if (!result?.values) return null;

  return result.values
    .map((v: any) => ({
      datetime: v.datetime,
      atr: parseFloat(v.atr),
    }))
    .reverse();
}

// ─── OBV History (for volume analysis) ────────────────────────

export interface OBVPoint {
  datetime: string;
  obv: number;
}

export async function fetchOBVHistory(
  tvSymbol: string,
  exchange: "ADX" | "DFM",
  outputsize: number = 90
): Promise<OBVPoint[] | null> {
  validateUAE(exchange);
  const result = await fetchIndicator(tvSymbol, exchange, "obv", "1day", outputsize);
  if (!result?.values) return null;

  return result.values
    .map((v: any) => ({
      datetime: v.datetime,
      obv: parseFloat(v.obv),
    }))
    .reverse();
}
