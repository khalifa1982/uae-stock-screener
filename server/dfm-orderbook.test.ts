import { describe, it, expect } from 'vitest';
import { buildOrderBook, type OrderBookData } from './services/dfmDataService';

describe('Order Book - Real L1 + Derived Technical Levels', () => {
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

  it('ADX stock should have derived levels from TradingView (not empty)', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    expect(result).not.toBeNull();
    const ob = result as OrderBookData;

    expect(ob.symbol).toBe('FAB');
    expect(ob.exchange).toBe('ADX');
    expect(ob.lastPrice).toBe(13.30);
    expect(ob.dataSource).toBe('delayed');

    expect(ob.bidPrice).toBe(0);
    expect(ob.askPrice).toBe(0);

    expect(ob.bids.length).toBeGreaterThan(0);
    expect(ob.asks.length).toBeGreaterThan(0);

    expect(ob.bids.every(b => b.source === 'derived')).toBe(true);
    expect(ob.asks.every(a => a.source === 'derived')).toBe(true);

    expect(ob.depthLevel).toBe('derived');
    expect(ob.dataNote).toContain('ADX');
  });

  it('spread is 0 when no real bid/ask data available (ADX)', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    const ob = result as OrderBookData;
    expect(ob.spread).toBe(0);
    expect(ob.spreadPercent).toBe(0);
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
    expect(ob.bidPrice).toBe(0);
    expect(ob.askPrice).toBe(0);
    expect(ob.dataSource).toBe('delayed');
    expect(Array.isArray(ob.bids)).toBe(true);
    expect(Array.isArray(ob.asks)).toBe(true);
  });

  it('includes day range and VWAP data', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    const ob = result as OrderBookData;
    expect(ob.dayHigh).toBe(13.80);
    expect(ob.dayLow).toBe(13.10);
    expect(ob.vwap).toBeGreaterThan(0);
    expect(ob.totalVolume).toBeGreaterThanOrEqual(0);
  });

  it('calculates daily limit bounds correctly', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    const ob = result as OrderBookData;
    expect(ob.limitDown).toBeCloseTo(12.15, 2);
    expect(ob.limitUp).toBeCloseTo(14.85, 2);
  });

  it('derived bid levels should be sorted descending (closest to price first)', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    const ob = result as OrderBookData;
    for (let i = 1; i < ob.bids.length; i++) {
      expect(ob.bids[i].price).toBeLessThanOrEqual(ob.bids[i - 1].price);
    }
  });

  it('derived ask levels should be sorted ascending (closest to price first)', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    const ob = result as OrderBookData;
    for (let i = 1; i < ob.asks.length; i++) {
      expect(ob.asks[i].price).toBeGreaterThanOrEqual(ob.asks[i - 1].price);
    }
  });

  it('cumulative total should increase for each level', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    const ob = result as OrderBookData;
    for (let i = 1; i < ob.bids.length; i++) {
      expect(ob.bids[i].total).toBeGreaterThan(ob.bids[i - 1].total);
    }
    for (let i = 1; i < ob.asks.length; i++) {
      expect(ob.asks[i].total).toBeGreaterThan(ob.asks[i - 1].total);
    }
  });

  it('includes depthLevel and dataNote fields', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    const ob = result as OrderBookData;
    expect(ob).toHaveProperty('depthLevel');
    expect(ob).toHaveProperty('dataNote');
    expect(['level1', 'derived', 'none']).toContain(ob.depthLevel);
    expect(typeof ob.dataNote).toBe('string');
    expect(ob.dataNote.length).toBeGreaterThan(0);
  });

  it('derived levels use technical indicators (pivots, BB, SMA)', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    const ob = result as OrderBookData;
    expect(ob.bids.length).toBeGreaterThanOrEqual(2);
    expect(ob.asks.length).toBeGreaterThanOrEqual(2);
  });
});

describe('DFM API Integration (live)', () => {
  it('can fetch DFM stock data from the live API', async () => {
    const { fetchAllDFMStocks } = await import('./services/dfmDataService');
    const stocks = await fetchAllDFMStocks();
    
    expect(stocks.length).toBeGreaterThan(40);
    
    const emaar = stocks.find(s => s.id === 'EMAAR');
    if (emaar) {
      expect(emaar.lastTradePrice).toBeGreaterThan(0);
      expect(emaar.totalVolume).toBeGreaterThanOrEqual(0);
      expect(emaar.market).toBe('510');
      expect(typeof emaar.bidPrice).toBe('number');
      expect(typeof emaar.offerPrice).toBe('number');
    }
  }, 20000);

  it('builds order book for DFM stock with L1 + derived levels', async () => {
    const { fetchAllDFMStocks } = await import('./services/dfmDataService');
    const stocks = await fetchAllDFMStocks();
    const emaar = stocks.find(s => s.id === 'EMAAR');
    
    if (emaar) {
      const price = emaar.lastTradePrice || 13.0;
      const result = await buildOrderBook('EMAAR', 'DFM', {
        close: price,
        open: emaar.openingPrice || null,
        high: emaar.highestPrice || null,
        low: emaar.lowestPrice || null,
        volume: emaar.totalVolume || null,
        changeAbs: emaar.netChange || null,
        change: emaar.changePercent || null,
        bbLower: price * 0.95,
        bbUpper: price * 1.05,
        pivotS1: price * 0.98,
        pivotS2: price * 0.95,
        pivotS3: price * 0.92,
        pivotR1: price * 1.02,
        pivotR2: price * 1.05,
        pivotR3: price * 1.08,
        pivotMiddle: price,
        sma20: price * 0.99,
        sma50: price * 0.97,
        atr: price * 0.03,
      });
      
      expect(result).not.toBeNull();
      const ob = result as OrderBookData;
      expect(ob.dataSource).toBe('live');
      
      // Should have asks (either live or derived)
      expect(ob.asks.length).toBeGreaterThan(0);
      
      // If bid exists in DFM API, first bid should be 'live'
      if (emaar.bidPrice > 0 && emaar.bidVolume > 0) {
        expect(ob.bids[0].source).toBe('live');
        expect(ob.bids[0].price).toBe(emaar.bidPrice);
      }
      
      // If ask exists in DFM API, first ask should be 'live'
      if (emaar.offerPrice > 0 && emaar.offerVolume > 0) {
        expect(ob.asks[0].source).toBe('live');
        expect(ob.asks[0].price).toBe(emaar.offerPrice);
      }
      
      // Should have derived levels
      const allEntries = [...ob.bids, ...ob.asks];
      const derivedEntries = allEntries.filter(e => e.source === 'derived');
      expect(derivedEntries.length).toBeGreaterThan(0);
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
