import { describe, it, expect, vi } from 'vitest';
import { buildOrderBook, type OrderBookData, type DFMStockData } from './services/dfmDataService';

describe('Order Book - buildOrderBook', () => {
  const baseTvData = {
    close: 13.30,
    open: 13.50,
    high: 13.80,
    low: 13.10,
    volume: 3650000,
    changeAbs: -0.20,
    change: -1.48,
    bbLower: 12.80,
    bbUpper: 14.20,
    pivotS1: 13.00,
    pivotS2: 12.70,
    pivotS3: 12.30,
    pivotR1: 13.60,
    pivotR2: 13.90,
    pivotR3: 14.30,
    pivotMiddle: 13.30,
    sma20: 13.15,
    sma50: 12.95,
    atr: 0.35,
  };

  it('returns null when price is missing', async () => {
    const result = await buildOrderBook('EMAAR', 'DFM', {
      ...baseTvData,
      close: null,
    });
    expect(result).toBeNull();
  });

  it('returns valid order book structure for ADX stock (derived data)', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    expect(result).not.toBeNull();
    const ob = result as OrderBookData;

    // Check required fields
    expect(ob.symbol).toBe('FAB');
    expect(ob.exchange).toBe('ADX');
    expect(ob.lastPrice).toBe(13.30);
    expect(ob.dataSource).toBe('delayed'); // ADX has no real-time API
    expect(ob.bidPrice).toBeGreaterThan(0);
    expect(ob.askPrice).toBeGreaterThan(0);
    expect(ob.spread).toBeGreaterThanOrEqual(0);
    expect(ob.spreadPercent).toBeGreaterThanOrEqual(0);
  });

  it('generates bid and ask depth levels from pivot/BB levels', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    expect(result).not.toBeNull();
    const ob = result as OrderBookData;

    // Should have at least 1 bid and 1 ask
    expect(ob.bids.length).toBeGreaterThanOrEqual(1);
    expect(ob.asks.length).toBeGreaterThanOrEqual(1);

    // All bids should be below or at the price
    for (const bid of ob.bids) {
      expect(bid.price).toBeLessThanOrEqual(ob.lastPrice);
      expect(bid.side).toBe('bid');
      expect(bid.quantity).toBeGreaterThanOrEqual(0);
      expect(bid.orders).toBeGreaterThanOrEqual(0);
    }

    // All asks should be above or at the price
    for (const ask of ob.asks) {
      expect(ask.price).toBeGreaterThanOrEqual(ob.lastPrice);
      expect(ask.side).toBe('ask');
      expect(ask.quantity).toBeGreaterThanOrEqual(0);
      expect(ask.orders).toBeGreaterThanOrEqual(0);
    }
  });

  it('bids are sorted highest first (closest to price)', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    const ob = result as OrderBookData;
    for (let i = 1; i < ob.bids.length; i++) {
      expect(ob.bids[i - 1].price).toBeGreaterThanOrEqual(ob.bids[i].price);
    }
  });

  it('asks are sorted lowest first (closest to price)', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    const ob = result as OrderBookData;
    for (let i = 1; i < ob.asks.length; i++) {
      expect(ob.asks[i - 1].price).toBeLessThanOrEqual(ob.asks[i].price);
    }
  });

  it('calculates spread correctly', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    const ob = result as OrderBookData;
    const expectedSpread = ob.askPrice - ob.bidPrice;
    expect(ob.spread).toBeCloseTo(expectedSpread, 4);
    if (ob.bidPrice > 0) {
      const expectedSpreadPct = (expectedSpread / ob.bidPrice) * 100;
      expect(ob.spreadPercent).toBeCloseTo(expectedSpreadPct, 2);
    }
  });

  it('handles minimal TV data (only close price)', async () => {
    const result = await buildOrderBook('TEST', 'ADX', {
      close: 5.0,
      open: null,
      high: null,
      low: null,
      volume: null,
      changeAbs: null,
      change: null,
      bbLower: null,
      bbUpper: null,
      pivotS1: null,
      pivotS2: null,
      pivotS3: null,
      pivotR1: null,
      pivotR2: null,
      pivotR3: null,
      pivotMiddle: null,
      sma20: null,
      sma50: null,
      atr: null,
    });
    expect(result).not.toBeNull();
    const ob = result as OrderBookData;
    expect(ob.lastPrice).toBe(5.0);
    expect(ob.bidPrice).toBeGreaterThan(0);
    expect(ob.askPrice).toBeGreaterThan(0);
    expect(ob.dataSource).toBe('delayed');
  });

  it('each order book entry has valid source field', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    const ob = result as OrderBookData;
    for (const entry of [...ob.bids, ...ob.asks]) {
      expect(['live', 'derived']).toContain(entry.source);
    }
  });

  it('includes day range and VWAP data', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    const ob = result as OrderBookData;
    expect(ob.dayHigh).toBe(13.80);
    expect(ob.dayLow).toBe(13.10);
    expect(ob.vwap).toBeGreaterThan(0);
    expect(ob.totalVolume).toBeGreaterThanOrEqual(0);
  });
});

describe('DFM API Integration (live)', () => {
  it('can fetch DFM stock data from the live API', async () => {
    // This test hits the real DFM API
    const { fetchAllDFMStocks } = await import('./services/dfmDataService');
    const stocks = await fetchAllDFMStocks();
    
    // DFM should have at least 40 equity stocks
    expect(stocks.length).toBeGreaterThan(40);
    
    // Check that the data has the expected shape
    const emaar = stocks.find(s => s.id === 'EMAAR');
    if (emaar) {
      expect(emaar.lastTradePrice).toBeGreaterThan(0);
      expect(emaar.totalVolume).toBeGreaterThanOrEqual(0);
      expect(emaar.market).toBe('510');
      // Bid/ask may be 0 after market close, but should be numbers
      expect(typeof emaar.bidPrice).toBe('number');
      expect(typeof emaar.offerPrice).toBe('number');
    }
  }, 20000);

  it('getDFMStats returns valid stats object', async () => {
    const { getDFMStats } = await import('./services/dfmDataService');
    const stats = getDFMStats();
    expect(stats).toHaveProperty('totalRequests');
    expect(stats).toHaveProperty('failedRequests');
    expect(stats).toHaveProperty('successRate');
    expect(stats).toHaveProperty('cacheAge');
    expect(stats).toHaveProperty('cachedStocks');
    expect(typeof stats.totalRequests).toBe('number');
  });
});
