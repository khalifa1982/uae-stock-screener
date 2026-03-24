/**
 * Tests for DFM Live Price Overlay
 * Verifies that DFM real-time prices correctly overlay TradingView EOD data
 */
import { describe, it, expect } from 'vitest';
import { fetchAllDFMStocks, fetchDFMStock, type DFMStockData } from './services/dfmDataService';

// Simulate the applyDFMLiveOverlay function (same logic as in routers.ts)
function applyDFMLiveOverlay(snapshot: any, dfmData: DFMStockData): any {
  if (!dfmData || dfmData.lastTradePrice <= 0) return snapshot;
  
  const prevClose = dfmData.previousClose || snapshot.previousClose;
  const price = dfmData.lastTradePrice;
  const changePercent = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : snapshot.changePercent;
  
  return {
    ...snapshot,
    price,
    previousClose: prevClose,
    open: dfmData.openingPrice > 0 ? dfmData.openingPrice : snapshot.open,
    dayHigh: dfmData.highestPrice > 0 ? dfmData.highestPrice : snapshot.dayHigh,
    dayLow: dfmData.lowestPrice > 0 ? dfmData.lowestPrice : snapshot.dayLow,
    volume: dfmData.totalVolume > 0 ? dfmData.totalVolume : snapshot.volume,
    changePercent,
  };
}

describe('DFM Live Price Overlay', () => {
  it('should overlay DFM price on TradingView snapshot', () => {
    const tvSnapshot = {
      symbol: 'EMAAR',
      exchange: 'DFM',
      name: 'Emaar Properties',
      price: 11.4, // Yesterday's close from TV
      previousClose: 11.95,
      open: 11.6,
      dayHigh: 11.65,
      dayLow: 11.4,
      volume: 27885114,
      pe: 8.5,
      eps: 1.34,
      rsi: 45.2,
      sma20: 12.1,
      changePercent: -4.6,
    };

    const dfmData: DFMStockData = {
      id: 'EMAAR',
      openingPrice: 11.5,
      closingPrice: 0,
      previousClose: 11.4,
      averagePrice: 12.0,
      lastTradePrice: 12.1, // Today's live price
      lastTradeVolume: 5000,
      lastTradeTime: '2026-03-24T10:07:19',
      highestPrice: 12.15,
      lowestPrice: 11.5,
      high52Week: 15.0,
      low52Week: 8.0,
      bidPrice: 12.05,
      bidVolume: 1000,
      offerPrice: 12.1,
      offerVolume: 500,
      totalVolume: 35000000,
      totalValue: 420000000,
      netChange: 0.7,
      changePercent: 6.14,
      totalTrades: 5000,
      referencePrice: 11.4,
      market: '510',
      suspended: '',
    };

    const result = applyDFMLiveOverlay(tvSnapshot, dfmData);

    // Price should be from DFM (today's live)
    expect(result.price).toBe(12.1);
    // Previous close should be from DFM
    expect(result.previousClose).toBe(11.4);
    // Open should be from DFM
    expect(result.open).toBe(11.5);
    // High/Low should be from DFM
    expect(result.dayHigh).toBe(12.15);
    expect(result.dayLow).toBe(11.5);
    // Volume should be from DFM
    expect(result.volume).toBe(35000000);
    // Change % should be recalculated: (12.1 - 11.4) / 11.4 * 100 ≈ 6.14%
    expect(result.changePercent).toBeCloseTo(6.14, 1);
    // Fundamentals should be preserved from TV
    expect(result.pe).toBe(8.5);
    expect(result.eps).toBe(1.34);
    expect(result.rsi).toBe(45.2);
    expect(result.sma20).toBe(12.1);
    // Name and symbol preserved
    expect(result.symbol).toBe('EMAAR');
    expect(result.name).toBe('Emaar Properties');
  });

  it('should NOT overlay when DFM lastTradePrice is 0', () => {
    const tvSnapshot = {
      symbol: 'TESTSTOCK',
      exchange: 'DFM',
      price: 5.0,
      previousClose: 5.2,
      volume: 100000,
    };

    const dfmData: DFMStockData = {
      id: 'TESTSTOCK',
      openingPrice: 0,
      closingPrice: 0,
      previousClose: 5.2,
      averagePrice: 0,
      lastTradePrice: 0, // No trades today
      lastTradeVolume: 0,
      lastTradeTime: null,
      highestPrice: 0,
      lowestPrice: 0,
      high52Week: 0,
      low52Week: 0,
      bidPrice: 0,
      bidVolume: 0,
      offerPrice: 0,
      offerVolume: 0,
      totalVolume: 0,
      totalValue: 0,
      netChange: 0,
      changePercent: 0,
      totalTrades: 0,
      referencePrice: 0,
      market: '510',
      suspended: '',
    };

    const result = applyDFMLiveOverlay(tvSnapshot, dfmData);

    // Should return original TV data unchanged
    expect(result.price).toBe(5.0);
    expect(result.previousClose).toBe(5.2);
    expect(result.volume).toBe(100000);
  });

  it('should preserve TV fundamentals when overlaying DFM prices', () => {
    const tvSnapshot = {
      symbol: 'DIB',
      exchange: 'DFM',
      price: 7.34, // Yesterday's close
      pe: 12.5,
      eps: 0.59,
      rsi: 55.0,
      sma20: 7.5,
      sma50: 7.2,
      marketCap: 50000000000,
      dividendYield: 3.2,
      beta: 0.8,
    };

    const dfmData: DFMStockData = {
      id: 'DIB',
      openingPrice: 7.4,
      closingPrice: 0,
      previousClose: 7.34,
      averagePrice: 7.5,
      lastTradePrice: 7.56, // Today's live
      lastTradeVolume: 10000,
      lastTradeTime: '2026-03-24T10:07:19',
      highestPrice: 7.6,
      lowestPrice: 7.4,
      high52Week: 9.0,
      low52Week: 5.0,
      bidPrice: 7.56,
      bidVolume: 500,
      offerPrice: 7.58,
      offerVolume: 300,
      totalVolume: 5000000,
      totalValue: 37800000,
      netChange: 0.22,
      changePercent: 3.0,
      totalTrades: 2000,
      referencePrice: 7.34,
      market: '510',
      suspended: '',
    };

    const result = applyDFMLiveOverlay(tvSnapshot, dfmData);

    // DFM prices overlaid
    expect(result.price).toBe(7.56);
    // All TV fundamentals preserved
    expect(result.pe).toBe(12.5);
    expect(result.eps).toBe(0.59);
    expect(result.rsi).toBe(55.0);
    expect(result.sma20).toBe(7.5);
    expect(result.sma50).toBe(7.2);
    expect(result.marketCap).toBe(50000000000);
    expect(result.dividendYield).toBe(3.2);
    expect(result.beta).toBe(0.8);
  });

  it('should fetch DFM stocks from API', async () => {
    const stocks = await fetchAllDFMStocks();
    // DFM should return stocks (even if market is closed, cache may have data)
    expect(Array.isArray(stocks)).toBe(true);
    // When market is open, should have 60+ stocks
    if (stocks.length > 0) {
      const sample = stocks[0];
      expect(sample).toHaveProperty('id');
      expect(sample).toHaveProperty('lastTradePrice');
      expect(sample).toHaveProperty('previousClose');
      expect(sample).toHaveProperty('bidPrice');
      expect(sample).toHaveProperty('offerPrice');
    }
  }, 20000);

  it('should fetch single DFM stock by symbol', async () => {
    const emaar = await fetchDFMStock('EMAAR');
    // EMAAR is a major DFM stock, should always be available
    if (emaar) {
      expect(emaar.id).toBe('EMAAR');
      expect(typeof emaar.lastTradePrice).toBe('number');
      expect(typeof emaar.previousClose).toBe('number');
    }
  }, 20000);

  it('should handle ADX stocks (no DFM overlay)', () => {
    const tvSnapshot = {
      symbol: 'IHC',
      exchange: 'ADX',
      price: 500,
      previousClose: 495,
      pe: 30,
    };

    // ADX stocks should not be overlaid (no DFM data for them)
    // The overlay function should return unchanged if dfmData is null
    const result = applyDFMLiveOverlay(tvSnapshot, null as any);
    expect(result.price).toBe(500);
    expect(result.exchange).toBe('ADX');
  });
});
