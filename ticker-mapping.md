# TradingView Ticker Mapping

TradingView uses format: `ADX:IHC`, `DFM:EMAAR`
Our internal format: `IHC` with exchange `ADX`, `EMAAR` with exchange `DFM`

Mapping: TV ticker `ADX:IHC` → split on `:` → exchange=`ADX`, symbol=`IHC`
This matches our internal format perfectly!

TradingView has 174 stocks with ALL data:
- Price, change%, volume
- Market cap, P/E, RSI
- Fundamentals (revenue, margins, etc.)
- Technical indicators (SMA, EMA, MACD, etc.)
