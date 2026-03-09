# Investigation: Empty Data Issues

## Screener Page Issues
1. P/E column: ALL stocks show "—" (empty for every single stock)
2. RSI column: ALL stocks show "—" (empty for every single stock)  
3. Mkt Cap column: ALL stocks show "—" (empty for every single stock)
4. Many DFM stocks have Price/Change: Some have data, some completely empty
5. ALL ADX stocks: Completely empty (—) for Price, Change, P/E, RSI, Volume, Mkt Cap
6. Only DFM stocks with Yahoo Finance data have Price and Volume

## Root Cause Analysis
- The screener uses Yahoo Finance chart data which only covers DFM stocks
- ADX stocks have NO Yahoo Finance mapping → completely empty
- P/E, RSI, Mkt Cap are NOT fetched from Yahoo Finance chart endpoint
- TradingView Scanner has ALL this data (174 stocks, P/E, RSI, market cap, etc.) but it's NOT being used in the screener/dashboard

## Solution
- Use TradingView Scanner API as PRIMARY data source for screener
- TradingView returns: price, change%, P/E, RSI, volume, market cap for ALL 174 UAE stocks
- Fall back to Yahoo Finance for individual stock details only
- Map TradingView tickers (DFM:EMAAR, ADX:FAB) to our internal symbols
