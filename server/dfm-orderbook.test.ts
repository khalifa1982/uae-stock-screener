import { describe, it, expect, vi } from 'vitest';
import { buildOrderBook, type OrderBookData, type DFMStockData } from './services/dfmDataService';

describe('Order Book - buildOrderBook (Real Data Only)', () => {
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

  it('returns valid order book structure for ADX stock (no order book data)', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    expect(result).not.toBeNull();
    const ob = result as OrderBookData;

    // Check required fields
    expect(ob.symbol).toBe('FAB');
    expect(ob.exchange).toBe('ADX');
    expect(ob.lastPrice).toBe(13.30);
    expect(ob.dataSource).toBe('delayed'); // ADX has no real-time API

    // ADX stocks should have NO fabricated bid/ask
    expect(ob.bidPrice).toBe(0);
    expect(ob.askPrice).toBe(0);
    expect(ob.bids).toHaveLength(0);
    expect(ob.asks).toHaveLength(0);
    expect(ob.depthLevel).toBe('none');
  });

  it('ADX stocks have empty order book (no synthetic data)', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    expect(result).not.toBeNull();
    const ob = result as OrderBookData;

    // CRITICAL: No fabricated levels for ADX
    expect(ob.bids).toHaveLength(0);
    expect(ob.asks).toHaveLength(0);
    expect(ob.bidPrice).toBe(0);
    expect(ob.askPrice).toBe(0);
    expect(ob.spread).toBe(0);
    expect(ob.spreadPercent).toBe(0);
    expect(ob.dataNote).toContain('ADX');
  });

  it('spread is 0 when no bid/ask data available', async () => {
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
    // No fabricated bid/ask for ADX
    expect(ob.bidPrice).toBe(0);
    expect(ob.askPrice).toBe(0);
    expect(ob.bids).toHaveLength(0);
    expect(ob.asks).toHaveLength(0);
    expect(ob.dataSource).toBe('delayed');
    expect(ob.depthLevel).toBe('none');
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
    // Previous close = 13.30 - (-0.20) = 13.50
    // Limit down = 13.50 * 0.90 = 12.15
    // Limit up = 13.50 * 1.10 = 14.85
    expect(ob.limitDown).toBeCloseTo(12.15, 2);
    expect(ob.limitUp).toBeCloseTo(14.85, 2);
  });

  it('includes depthLevel and dataNote fields', async () => {
    const result = await buildOrderBook('FAB', 'ADX', baseTvData);
    const ob = result as OrderBookData;
    expect(ob).toHaveProperty('depthLevel');
    expect(ob).toHaveProperty('dataNote');
    expect(['level1', 'none']).toContain(ob.depthLevel);
    expect(typeof ob.dataNote).toBe('string');
    expect(ob.dataNote.length).toBeGreaterThan(0);
  });

  it('never generates synthetic order book levels', async () => {
    // Test with multiple symbols to ensure no synthetic data
    const symbols = ['FAB', 'ADNOC', 'ETISALAT', 'TEST1', 'TEST2'];
    for (const sym of symbols) {
      const result = await buildOrderBook(sym, 'ADX', baseTvData);
      if (result) {
        // ADX stocks should never have fabricated levels
        expect(result.bids).toHaveLength(0);
        expect(result.asks).toHaveLength(0);
        // All entries (if any) must be from 'live' source
        for (const entry of [...result.bids, ...result.asks]) {
          expect(entry.source).toBe('live');
        }
      }
    }
  });
});

describe('DFM API Integration (live)', () => {
  it('can fetch DFM stock data from the live API', async () => {
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

  it('builds order book for DFM stock with real data only', async () => {
    const { fetchAllDFMStocks } = await import('./services/dfmDataService');
    const stocks = await fetchAllDFMStocks();
    const emaar = stocks.find(s => s.id === 'EMAAR');
    
    if (emaar) {
      const result = await buildOrderBook('EMAAR', 'DFM', {
        close: emaar.lastTradePrice || 13.0,
        open: emaar.openingPrice || null,
        high: emaar.highestPrice || null,
        low: emaar.lowestPrice || null,
        volume: emaar.totalVolume || null,
        changeAbs: emaar.netChange || null,
        change: emaar.changePercent || null,
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
      expect(ob.dataSource).toBe('live');
      expect(ob.depthLevel).toBe('level1');
      
      // If bid exists in DFM API, it should appear in bids array
      if (emaar.bidPrice > 0 && emaar.bidVolume > 0) {
        expect(ob.bids).toHaveLength(1); // Level 1 = exactly 1 level
        expect(ob.bids[0].price).toBe(emaar.bidPrice);
        expect(ob.bids[0].source).toBe('live');
      } else {
        // No bids = empty array (NOT fabricated levels)
        expect(ob.bids).toHaveLength(0);
      }
      
      // If ask exists in DFM API, it should appear in asks array
      if (emaar.offerPrice > 0 && emaar.offerVolume > 0) {
        expect(ob.asks).toHaveLength(1); // Level 1 = exactly 1 level
        expect(ob.asks[0].price).toBe(emaar.offerPrice);
        expect(ob.asks[0].source).toBe('live');
      } else {
        expect(ob.asks).toHaveLength(0);
      }
      
      // CRITICAL: No derived/synthetic entries
      for (const entry of [...ob.bids, ...ob.asks]) {
        expect(entry.source).toBe('live');
      }
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
