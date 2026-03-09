# API Research Notes

## TwelveData API
- API key `6f6e619953d34e849126d39c58d77aca` returns 401 (expired/invalid)
- Supports UAE stocks via ADX and DFM exchanges
- Has fundamentals (income statement, balance sheet, cash flow) on Pro plan
- Has technical indicators (100+)
- Status: KEY EXPIRED - need new key or will show as disconnected

## TradingView Scanner API
- FREE, no API key needed
- URL: `https://scanner.tradingview.com/uae/scan`
- Works perfectly for UAE stocks (both ADX: and DFM: prefixed)
- Returns comprehensive data:
  - Technical indicators: RSI, MACD, Stoch K/D, CCI, ADX, BB, SMA20/50/200, EMA20/50/200
  - Recommendations: Recommend.All, Recommend.MA, Recommend.Other (-1 to +1 scale)
  - Fundamentals: market_cap, P/E, EPS, dividend_yield, P/B, ROE, debt_to_equity, current_ratio
  - Revenue/income: total_revenue, net_income, gross_margin, operating_margin
  - Performance: Perf.W, Perf.1M, Perf.3M, Perf.6M, Perf.YTD, Perf.Y
  - Other: total_assets, total_debt, total_shares_outstanding, free_cash_flow, beta, sector, industry
  - Company info: name, description, logoid, exchange, type

## Simply Wall St
- Cloudflare protected - cannot scrape via API
- Would need browser automation to access
- Status: BLOCKED - will use browser scraping approach or mark as unavailable

## Yahoo Finance (Built-in Data API)
- Already integrated and working
- Good for DFM stocks, limited for ADX
- Has quoteSummary with 10+ modules (profile, financials, etc.)

## TradingView Symbol Format
- DFM stocks: `DFM:EMAAR`, `DFM:DIB`, `DFM:EMIRATESNBD`
- ADX stocks: `ADX:FAB`, `ADX:EAND`, `ADX:ADCB`, `ADX:ALDAR`
