/**
 * Abboud AI Indicator — Fibonacci Retracement + RSI Divergence Engine
 *
 * Strategy:
 * 1. Detect swing high / swing low from OHLC data
 * 2. Calculate Fibonacci retracement levels (23.6%, 38.2%, 50%, 61.8%, 78.6%)
 * 3. Calculate Fibonacci extension levels (127.2%, 161.8%) for price targets
 * 4. Compute RSI (14-period)
 * 5. Detect bullish / bearish divergence between price and RSI
 * 6. Generate entry zone, stop-loss, and target levels
 * 7. Produce a signal summary (Buy / Sell / Neutral)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OHLCPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FibonacciLevel {
  level: number;     // e.g. 0.236, 0.382, 0.5, 0.618, 0.786
  label: string;     // e.g. "23.6%"
  price: number;     // the price at this level
  type: "retracement" | "extension";
}

export interface SwingPoint {
  index: number;
  date: string;
  price: number;
  type: "high" | "low";
}

export interface DivergenceSignal {
  type: "bullish" | "bearish" | "hidden_bullish" | "hidden_bearish";
  startIndex: number;
  endIndex: number;
  startDate: string;
  endDate: string;
  priceStart: number;
  priceEnd: number;
  rsiStart: number;
  rsiEnd: number;
  strength: "weak" | "moderate" | "strong";
}

export interface AbboudSignal {
  action: "BUY" | "SELL" | "NEUTRAL";
  confidence: number;           // 0-100
  reason: string;
  entryZone: { low: number; high: number } | null;
  stopLoss: number | null;
  targets: { level: string; price: number }[];
}

export interface AbboudIndicatorResult {
  swingHigh: SwingPoint | null;
  swingLow: SwingPoint | null;
  fibLevels: FibonacciLevel[];
  rsiValues: { date: string; value: number }[];
  divergences: DivergenceSignal[];
  signal: AbboudSignal;
  trendDirection: "uptrend" | "downtrend" | "sideways";
  currentPrice: number;
}

// ─── RSI Calculation ────────────────────────────────────────────────────────

function calculateRSI(closes: number[], period: number = 14): (number | null)[] {
  const rsi: (number | null)[] = [];
  if (closes.length < period + 1) {
    return closes.map(() => null);
  }

  let avgGain = 0;
  let avgLoss = 0;

  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  // Fill nulls for the first period
  for (let i = 0; i < period; i++) {
    rsi.push(null);
  }

  // First RSI value
  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs0));

  // Subsequent RSI values using smoothed averages
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));
  }

  return rsi;
}

// ─── Swing Detection ────────────────────────────────────────────────────────

function detectSwings(data: OHLCPoint[], lookback: number = 5): SwingPoint[] {
  const swings: SwingPoint[] = [];
  if (data.length < lookback * 2 + 1) return swings;

  for (let i = lookback; i < data.length - lookback; i++) {
    // Check swing high
    let isSwingHigh = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && data[j].high >= data[i].high) {
        isSwingHigh = false;
        break;
      }
    }
    if (isSwingHigh) {
      swings.push({ index: i, date: data[i].date, price: data[i].high, type: "high" });
    }

    // Check swing low
    let isSwingLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && data[j].low <= data[i].low) {
        isSwingLow = false;
        break;
      }
    }
    if (isSwingLow) {
      swings.push({ index: i, date: data[i].date, price: data[i].low, type: "low" });
    }
  }

  return swings;
}

// ─── Fibonacci Levels ───────────────────────────────────────────────────────

function calculateFibLevels(swingHigh: number, swingLow: number, trend: "uptrend" | "downtrend" | "sideways"): FibonacciLevel[] {
  const diff = swingHigh - swingLow;
  const levels: FibonacciLevel[] = [];

  // Retracement levels
  const retracementRatios = [
    { level: 0, label: "0.0%" },
    { level: 0.236, label: "23.6%" },
    { level: 0.382, label: "38.2%" },
    { level: 0.5, label: "50.0%" },
    { level: 0.618, label: "61.8%" },
    { level: 0.786, label: "78.6%" },
    { level: 1, label: "100.0%" },
  ];

  for (const r of retracementRatios) {
    // In uptrend/sideways: retracement from high down; in downtrend: from low up
    const price = trend !== "downtrend"
      ? swingHigh - diff * r.level
      : swingLow + diff * r.level;

    levels.push({
      level: r.level,
      label: r.label,
      price: Math.round(price * 1000) / 1000,
      type: "retracement",
    });
  }

  // Extension levels (targets beyond the swing)
  const extensionRatios = [
    { level: 1.272, label: "127.2%" },
    { level: 1.618, label: "161.8%" },
    { level: 2.0, label: "200.0%" },
    { level: 2.618, label: "261.8%" },
  ];

  for (const e of extensionRatios) {
    const price = trend !== "downtrend"
      ? swingHigh + diff * (e.level - 1)
      : swingLow - diff * (e.level - 1);

    levels.push({
      level: e.level,
      label: e.label,
      price: Math.round(price * 1000) / 1000,
      type: "extension",
    });
  }

  return levels;
}

// ─── Divergence Detection ───────────────────────────────────────────────────

function detectDivergences(
  data: OHLCPoint[],
  rsiValues: (number | null)[],
  swings: SwingPoint[],
): DivergenceSignal[] {
  const divergences: DivergenceSignal[] = [];

  const swingHighs = swings.filter(s => s.type === "high");
  const swingLows = swings.filter(s => s.type === "low");

  // Check consecutive swing lows for bullish divergence
  // Bullish: price makes lower low, RSI makes higher low
  for (let i = 1; i < swingLows.length; i++) {
    const prev = swingLows[i - 1];
    const curr = swingLows[i];
    const prevRSI = rsiValues[prev.index];
    const currRSI = rsiValues[curr.index];

    if (prevRSI == null || currRSI == null) continue;

    // Regular bullish divergence: lower low in price, higher low in RSI
    if (curr.price < prev.price && currRSI > prevRSI) {
      const priceDiff = Math.abs((curr.price - prev.price) / prev.price);
      const rsiDiff = Math.abs(currRSI - prevRSI);
      const strength = rsiDiff > 10 && priceDiff > 0.03 ? "strong" : rsiDiff > 5 ? "moderate" : "weak";

      divergences.push({
        type: "bullish",
        startIndex: prev.index,
        endIndex: curr.index,
        startDate: prev.date,
        endDate: curr.date,
        priceStart: prev.price,
        priceEnd: curr.price,
        rsiStart: prevRSI,
        rsiEnd: currRSI,
        strength,
      });
    }

    // Hidden bullish divergence: higher low in price, lower low in RSI
    if (curr.price > prev.price && currRSI < prevRSI) {
      const rsiDiff = Math.abs(currRSI - prevRSI);
      const strength = rsiDiff > 10 ? "strong" : rsiDiff > 5 ? "moderate" : "weak";

      divergences.push({
        type: "hidden_bullish",
        startIndex: prev.index,
        endIndex: curr.index,
        startDate: prev.date,
        endDate: curr.date,
        priceStart: prev.price,
        priceEnd: curr.price,
        rsiStart: prevRSI,
        rsiEnd: currRSI,
        strength,
      });
    }
  }

  // Check consecutive swing highs for bearish divergence
  // Bearish: price makes higher high, RSI makes lower high
  for (let i = 1; i < swingHighs.length; i++) {
    const prev = swingHighs[i - 1];
    const curr = swingHighs[i];
    const prevRSI = rsiValues[prev.index];
    const currRSI = rsiValues[curr.index];

    if (prevRSI == null || currRSI == null) continue;

    // Regular bearish divergence: higher high in price, lower high in RSI
    if (curr.price > prev.price && currRSI < prevRSI) {
      const priceDiff = Math.abs((curr.price - prev.price) / prev.price);
      const rsiDiff = Math.abs(currRSI - prevRSI);
      const strength = rsiDiff > 10 && priceDiff > 0.03 ? "strong" : rsiDiff > 5 ? "moderate" : "weak";

      divergences.push({
        type: "bearish",
        startIndex: prev.index,
        endIndex: curr.index,
        startDate: prev.date,
        endDate: curr.date,
        priceStart: prev.price,
        priceEnd: curr.price,
        rsiStart: prevRSI,
        rsiEnd: currRSI,
        strength,
      });
    }

    // Hidden bearish divergence: lower high in price, higher high in RSI
    if (curr.price < prev.price && currRSI > prevRSI) {
      const rsiDiff = Math.abs(currRSI - prevRSI);
      const strength = rsiDiff > 10 ? "strong" : rsiDiff > 5 ? "moderate" : "weak";

      divergences.push({
        type: "hidden_bearish",
        startIndex: prev.index,
        endIndex: curr.index,
        startDate: prev.date,
        endDate: curr.date,
        priceStart: prev.price,
        priceEnd: curr.price,
        rsiStart: prevRSI,
        rsiEnd: currRSI,
        strength,
      });
    }
  }

  return divergences;
}

// ─── Trend Detection ────────────────────────────────────────────────────────

function detectTrend(data: OHLCPoint[]): "uptrend" | "downtrend" | "sideways" {
  if (data.length < 20) return "sideways";

  const recentCloses = data.slice(-20).map(d => d.close);
  const firstHalf = recentCloses.slice(0, 10);
  const secondHalf = recentCloses.slice(10);

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const changePct = (avgSecond - avgFirst) / avgFirst;

  if (changePct > 0.02) return "uptrend";
  if (changePct < -0.02) return "downtrend";
  return "sideways";
}

// ─── Generate Signal ────────────────────────────────────────────────────────

function generateSignal(
  currentPrice: number,
  fibLevels: FibonacciLevel[],
  divergences: DivergenceSignal[],
  rsiValues: (number | null)[],
  trend: "uptrend" | "downtrend" | "sideways",
): AbboudSignal {
  const currentRSI = rsiValues.filter((v): v is number => v != null).pop() ?? 50;
  const retracements = fibLevels.filter(f => f.type === "retracement");
  const extensions = fibLevels.filter(f => f.type === "extension");

  // Find which Fibonacci zone the price is in
  const fib382 = retracements.find(f => f.level === 0.382)?.price ?? 0;
  const fib50 = retracements.find(f => f.level === 0.5)?.price ?? 0;
  const fib618 = retracements.find(f => f.level === 0.618)?.price ?? 0;
  const fib786 = retracements.find(f => f.level === 0.786)?.price ?? 0;

  // Recent divergences (last 3)
  const recentDivergences = divergences.slice(-3);
  const hasBullishDiv = recentDivergences.some(d => d.type === "bullish" || d.type === "hidden_bullish");
  const hasBearishDiv = recentDivergences.some(d => d.type === "bearish" || d.type === "hidden_bearish");
  const strongBullish = recentDivergences.some(d => (d.type === "bullish" || d.type === "hidden_bullish") && d.strength === "strong");
  const strongBearish = recentDivergences.some(d => (d.type === "bearish" || d.type === "hidden_bearish") && d.strength === "strong");

  let action: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
  let confidence = 50;
  let reason = "No clear signal detected.";
  let entryZone: { low: number; high: number } | null = null;
  let stopLoss: number | null = null;
  const targets: { level: string; price: number }[] = [];

  if (trend === "uptrend" || trend === "sideways") {
    // BUY signal: price near 38.2%-50% Fibo + bullish divergence
    const inEntryZone = (fib382 > fib50)
      ? (currentPrice <= fib382 && currentPrice >= fib50)
      : (currentPrice >= fib382 && currentPrice <= fib50);

    const nearEntryZone = Math.abs(currentPrice - fib50) / currentPrice < 0.05 ||
                          Math.abs(currentPrice - fib382) / currentPrice < 0.05;

    if ((inEntryZone || nearEntryZone) && hasBullishDiv) {
      action = "BUY";
      confidence = strongBullish ? 85 : 70;
      reason = `Price at Fibonacci ${inEntryZone ? "38.2%-50%" : "near entry zone"} with ${strongBullish ? "strong" : ""}bullish RSI divergence. RSI: ${currentRSI.toFixed(1)}.`;
      entryZone = { low: Math.min(fib382, fib50), high: Math.max(fib382, fib50) };
      stopLoss = trend === "uptrend" ? Math.min(fib618, fib786) : Math.max(fib618, fib786);

      // Targets at extension levels
      for (const ext of extensions.slice(0, 2)) {
        targets.push({ level: ext.label, price: ext.price });
      }
    } else if (inEntryZone && currentRSI < 40) {
      action = "BUY";
      confidence = 55;
      reason = `Price in Fibonacci 38.2%-50% zone with oversold RSI (${currentRSI.toFixed(1)}). Waiting for divergence confirmation.`;
      entryZone = { low: Math.min(fib382, fib50), high: Math.max(fib382, fib50) };
      stopLoss = trend === "uptrend" ? Math.min(fib618, fib786) : Math.max(fib618, fib786);
      for (const ext of extensions.slice(0, 2)) {
        targets.push({ level: ext.label, price: ext.price });
      }
    } else if (hasBullishDiv) {
      action = "BUY";
      confidence = 60;
      reason = `Bullish RSI divergence detected. RSI: ${currentRSI.toFixed(1)}. Price not yet at ideal Fibonacci entry.`;
      entryZone = { low: Math.min(fib382, fib50), high: Math.max(fib382, fib50) };
      stopLoss = trend === "uptrend" ? Math.min(fib618, fib786) : Math.max(fib618, fib786);
      for (const ext of extensions.slice(0, 2)) {
        targets.push({ level: ext.label, price: ext.price });
      }
    }
  }

  if (trend === "downtrend" || (trend === "sideways" && action === "NEUTRAL")) {
    // SELL signal: price near 38.2%-50% Fibo from bottom + bearish divergence
    const inSellZone = (fib382 > fib50)
      ? (currentPrice <= fib382 && currentPrice >= fib50)
      : (currentPrice >= fib382 && currentPrice <= fib50);

    if (inSellZone && hasBearishDiv) {
      action = "SELL";
      confidence = strongBearish ? 80 : 65;
      reason = `Price at Fibonacci retracement zone with ${strongBearish ? "strong " : ""}bearish RSI divergence. RSI: ${currentRSI.toFixed(1)}.`;
      entryZone = { low: Math.min(fib382, fib50), high: Math.max(fib382, fib50) };
      stopLoss = trend === "downtrend" ? Math.max(fib618, fib786) : Math.min(fib618, fib786);
    } else if (hasBearishDiv && currentRSI > 60) {
      action = "SELL";
      confidence = 55;
      reason = `Bearish RSI divergence with overbought conditions. RSI: ${currentRSI.toFixed(1)}.`;
      stopLoss = retracements.find(f => f.level === 0)?.price ?? null;
    }
  }

  // If still neutral, provide context
  if (action === "NEUTRAL") {
    if (currentRSI > 70) {
      reason = `Overbought RSI (${currentRSI.toFixed(1)}). Watch for bearish divergence at Fibonacci resistance.`;
      confidence = 40;
    } else if (currentRSI < 30) {
      reason = `Oversold RSI (${currentRSI.toFixed(1)}). Watch for bullish divergence at Fibonacci support.`;
      confidence = 40;
    } else {
      reason = `Price between Fibonacci levels. RSI neutral at ${currentRSI.toFixed(1)}. No divergence detected.`;
      confidence = 30;
    }
  }

  return { action, confidence, reason, entryZone, stopLoss, targets };
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function computeAbboudIndicator(data: OHLCPoint[]): AbboudIndicatorResult | null {
  if (!data || data.length < 30) return null;

  const closes = data.map(d => d.close);
  const currentPrice = closes[closes.length - 1];

  // 1. Detect trend
  const trendDirection = detectTrend(data);

  // 2. Detect swings
  const swings = detectSwings(data, 5);
  const swingHighs = swings.filter(s => s.type === "high");
  const swingLows = swings.filter(s => s.type === "low");

  // Use the most recent significant swing high and swing low
  const swingHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1] : null;
  const swingLow = swingLows.length > 0 ? swingLows[swingLows.length - 1] : null;

  // If we can't find swings, use period high/low
  const highPrice = swingHigh?.price ?? Math.max(...data.map(d => d.high));
  const lowPrice = swingLow?.price ?? Math.min(...data.map(d => d.low));

  if (highPrice === lowPrice) return null;

  // 3. Calculate Fibonacci levels
  const fibLevels = calculateFibLevels(highPrice, lowPrice, trendDirection);

  // 4. Calculate RSI
  const rsiRaw = calculateRSI(closes, 14);
  const rsiValues = data.map((d, i) => ({
    date: d.date,
    value: rsiRaw[i] ?? 0,
  })).filter(r => r.value > 0);

  // 5. Detect divergences
  const divergences = detectDivergences(data, rsiRaw, swings);

  // 6. Generate signal
  const signal = generateSignal(currentPrice, fibLevels, divergences, rsiRaw, trendDirection);

  return {
    swingHigh,
    swingLow,
    fibLevels,
    rsiValues,
    divergences,
    signal,
    trendDirection,
    currentPrice,
  };
}
