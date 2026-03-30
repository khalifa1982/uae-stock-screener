/**
 * Order Book Tests — v10.9.1
 * 
 * Validates that buildOrderBook returns ONLY real DFM Level 1 data:
 * - No synthetic/derived/S/R levels
 * - DFM stocks: real bid/ask from DFM API when available
 * - ADX stocks: no order book data (no public API)
 * - Volume, value, trades from DFM API
 */

import { describe, it, expect } from 'vitest';
import { buildOrderBook, fetchAllDFMStocks, fetchDFMStock, getDFMStats, type OrderBookData } from './services/dfmDataService';

describe('buildOrderBook — Real L1 Only (No Derived Levels)', () => {
  // ─── Unit tests with mock TV data ───────────────────────────────

  it('returns null when no price data', async () => {
    const result = await buildOrderBook('EMAAR', 'DFM', {
      close: null as any, open: null, high: null, low: null, volume: null,
      changeAbs: null, change: null, bbLower: null, bbUpper: null,
      pivotS1: null, pivotS2: null, pivotS3: null,
      pivotR1: null, pivotR2: null, pivotR3: null, pivotMiddle: null,
      sma20: null, sma50: null, atr: null,
    });
    expect(result).toBeNull();
  });

  it('returns null when price is 0', async () => {
    const result = await buildOrderBook('TEST', 'DFM', {
      close: 0, open: null, high: null, low: null, volume: null,
      changeAbs: null, change: null, bbLower: null, bbUpper: null,
      pivotS1: null, pivotS2: null, pivotS3: null,
      pivotR1: null, pivotR2: null, pivotR3: null, pivotMiddle: null,
      sma20: null, sma50: null, atr: null,
    });
    expect(result).toBeNull();
  });

  it('ADX stocks have empty bids/asks and depthLevel=none', async () => {
    const result = await buildOrderBook('ETISALAT', 'ADX', {
      close: 25.5, open: 25.0, high: 26.0, low: 24.8, volume: 500000,
      changeAbs: 0.5, change: 2.0, bbLower: 24.0, bbUpper: 27.0,
      pivotS1: 24.5, pivotS2: 24.0, pivotS3: 23.5,
      pivotR1: 26.5, pivotR2: 27.0, pivotR3: 27.5, pivotMiddle: 25.5,
      sma20: 25.2, sma50: 24.8, atr: 0.8,
    });

    expect(result).not.toBeNull();
    const ob = result as OrderBookData;
    expect(ob.bids).toEqual([]);
    expect(ob.asks).toEqual([]);
    expect(ob.depthLevel).toBe('none');
    expect(ob.dataSource).toBe('delayed');
    expect(ob.dataNote).toContain('ADX');
  });

  it('no derived/S/R levels are ever generated even with full TV data', async () => {
    const result = await buildOrderBook('FAB', 'ADX', {
      close: 13.30, open: 13.50, high: 13.80, low: 13.10, volume: 3650000,
      changeAbs: -0.20, change: -1.48, bbLower: 12.80, bbUpper: 14.20,
      pivotS1: 13.00, pivotS2: 12.70, pivotS3: 12.30,
      pivotR1: 13.60, pivotR2: 13.90, pivotR3: 14.30, pivotMiddle: 13.30,
      sma20: 13.15, sma50: 12.95, atr: 0.35,
    });

    expect(result).not.toBeNull();
    const ob = result as OrderBookData;
    // ADX: should have zero levels — NO derived levels
    expect(ob.bids).toEqual([]);
    expect(ob.asks).toEqual([]);
  });

  it('calculates daily limits correctly from reference price', async () => {
    const result = await buildOrderBook('TEST', 'ADX', {
      close: 10.0, open: 9.8, high: 10.2, low: 9.7, volume: 100000,
      changeAbs: 0.2, change: 2.0, bbLower: null, bbUpper: null,
      pivotS1: null, pivotS2: null, pivotS3: null,
      pivotR1: null, pivotR2: null, pivotR3: null, pivotMiddle: null,
      sma20: null, sma50: null, atr: null,
    });

    expect(result).not.toBeNull();
    const ob = result as OrderBookData;
    // previousClose = close - changeAbs = 10.0 - 0.2 = 9.8
    // limitDown = 9.8 * 0.9 = 8.82
    // limitUp = 9.8 * 1.1 = 10.78
    expect(ob.limitDown).toBeCloseTo(8.82, 1);
    expect(ob.limitUp).toBeCloseTo(10.78, 1);
  });

  it('returns correct structure with all required fields', async () => {
    const result = await buildOrderBook('TEST', 'ADX', {
      close: 5.0, open: 4.9, high: 5.1, low: 4.85, volume: 200000,
      changeAbs: 0.1, change: 2.04, bbLower: null, bbUpper: null,
      pivotS1: null, pivotS2: null, pivotS3: null,
      pivotR1: null, pivotR2: null, pivotR3: null, pivotMiddle: null,
      sma20: null, sma50: null, atr: null,
    });

    expect(result).not.toBeNull();
    const ob = result as OrderBookData;
    expect(ob.symbol).toBe('TEST');
    expect(ob.exchange).toBe('ADX');
    expect(ob.lastPrice).toBe(5.0);
    expect(ob.spread).toBe(0);
    expect(ob.spreadPercent).toBe(0);
    expect(typeof ob.limitDown).toBe('number');
    expect(typeof ob.limitUp).toBe('number');
    expect(typeof ob.vwap).toBe('number');
    expect(typeof ob.totalVolume).toBe('number');
    expect(typeof ob.totalValue).toBe('number');
    expect(typeof ob.totalTrades).toBe('number');
    expect(ob.depthLevel).toBe('none');
    expect(ob.dataNote).toBeTruthy();
  });

  it('all bid/ask entries have source=live only (max 1 each)', async () => {
    const result = await buildOrderBook('TEST', 'DFM', {
      close: 3.0, open: 2.95, high: 3.1, low: 2.9, volume: 50000,
      changeAbs: 0.05, change: 1.69, bbLower: null, bbUpper: null,
      pivotS1: null, pivotS2: null, pivotS3: null,
      pivotR1: null, pivotR2: null, pivotR3: null, pivotMiddle: null,
      sma20: null, sma50: null, atr: null,
    });

    expect(result).not.toBeNull();
    const ob = result as OrderBookData;
    for (const bid of ob.bids) {
      expect(bid.source).toBe('live');
    }
    for (const ask of ob.asks) {
      expect(ask.source).toBe('live');
    }
    // Max 1 bid + 1 ask (Level 1 only)
    expect(ob.bids.length).toBeLessThanOrEqual(1);
    expect(ob.asks.length).toBeLessThanOrEqual(1);
  });

  it('spread is 0 when no real bid/ask data available (ADX)', async () => {
    const result = await buildOrderBook('FAB', 'ADX', {
      close: 13.30, open: 13.50, high: 13.80, low: 13.10, volume: 3650000,
      changeAbs: -0.20, change: -1.48, bbLower: null, bbUpper: null,
      pivotS1: null, pivotS2: null, pivotS3: null,
      pivotR1: null, pivotR2: null, pivotR3: null, pivotMiddle: null,
      sma20: null, sma50: null, atr: null,
    });
    const ob = result as OrderBookData;
    expect(ob.spread).toBe(0);
    expect(ob.spreadPercent).toBe(0);
  });

  it('includes day range and VWAP data', async () => {
    const result = await buildOrderBook('FAB', 'ADX', {
      close: 13.30, open: 13.50, high: 13.80, low: 13.10, volume: 3650000,
      changeAbs: -0.20, change: -1.48, bbLower: null, bbUpper: null,
      pivotS1: null, pivotS2: null, pivotS3: null,
      pivotR1: null, pivotR2: null, pivotR3: null, pivotMiddle: null,
      sma20: null, sma50: null, atr: null,
    });
    const ob = result as OrderBookData;
    expect(ob.dayHigh).toBe(13.80);
    expect(ob.dayLow).toBe(13.10);
    expect(ob.vwap).toBeGreaterThan(0);
    expect(ob.totalVolume).toBeGreaterThanOrEqual(0);
  });
});

describe('DFM API Integration (live)', () => {
  it('fetchAllDFMStocks returns array of DFM stocks', async () => {
    const stocks = await fetchAllDFMStocks();
    expect(Array.isArray(stocks)).toBe(true);
    expect(stocks.length).toBeGreaterThan(30);

    if (stocks.length > 0) {
      const s = stocks[0];
      expect(s.id).toBeTruthy();
      expect(typeof s.lastTradePrice).toBe('number');
      expect(typeof s.bidPrice).toBe('number');
      expect(typeof s.offerPrice).toBe('number');
      expect(typeof s.totalVolume).toBe('number');
      expect(typeof s.totalValue).toBe('number');
      expect(typeof s.totalTrades).toBe('number');
    }
  }, 15000);

  it('fetchDFMStock returns data for EMAAR', async () => {
    const emaar = await fetchDFMStock('EMAAR');
    expect(emaar).not.toBeNull();
    expect(emaar!.id).toBe('EMAAR');
    expect(emaar!.lastTradePrice).toBeGreaterThan(0);
    expect(typeof emaar!.bidPrice).toBe('number');
    expect(typeof emaar!.offerPrice).toBe('number');
    expect(typeof emaar!.totalVolume).toBe('number');
    expect(typeof emaar!.totalValue).toBe('number');
    expect(typeof emaar!.totalTrades).toBe('number');
  }, 15000);

  it('buildOrderBook for DFM stock returns live data with volume/value/trades', async () => {
    const emaar = await fetchDFMStock('EMAAR');
    if (!emaar || emaar.lastTradePrice === 0) {
      console.log('EMAAR not trading, skipping live test');
      return;
    }

    const result = await buildOrderBook('EMAAR', 'DFM', {
      close: emaar.lastTradePrice, open: emaar.openingPrice,
      high: emaar.highestPrice, low: emaar.lowestPrice,
      volume: emaar.totalVolume, changeAbs: emaar.netChange,
      change: emaar.changePercent,
      bbLower: null, bbUpper: null,
      pivotS1: null, pivotS2: null, pivotS3: null,
      pivotR1: null, pivotR2: null, pivotR3: null, pivotMiddle: null,
      sma20: null, sma50: null, atr: null,
    });

    expect(result).not.toBeNull();
    const ob = result as OrderBookData;
    expect(ob.dataSource).toBe('live');
    expect(ob.lastPrice).toBe(emaar.lastTradePrice);

    // Volume, value, trades should come from DFM
    expect(ob.totalVolume).toBeGreaterThanOrEqual(0);
    expect(ob.totalValue).toBeGreaterThanOrEqual(0);
    expect(ob.totalTrades).toBeGreaterThanOrEqual(0);

    // Max 1 bid + 1 ask (Level 1 only, no derived)
    expect(ob.bids.length).toBeLessThanOrEqual(1);
    expect(ob.asks.length).toBeLessThanOrEqual(1);

    // All entries must be 'live' source
    for (const bid of ob.bids) {
      expect(bid.source).toBe('live');
    }
    for (const ask of ob.asks) {
      expect(ask.source).toBe('live');
    }
  }, 15000);

  it('getDFMStats returns valid stats object', async () => {
    const stats = getDFMStats();
    expect(stats).toHaveProperty('totalRequests');
    expect(stats).toHaveProperty('failedRequests');
    expect(stats).toHaveProperty('successRate');
    expect(stats).toHaveProperty('cacheAge');
    expect(stats).toHaveProperty('cachedStocks');
    expect(typeof stats.totalRequests).toBe('number');
  });
});
