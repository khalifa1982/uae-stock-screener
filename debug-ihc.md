# IHC Stock Page Debug

## API Responses (all 200 OK)
1. **stocks.detail** - Returns full data: price=390, P/E=39.2, RSI=23.4, marketCap=855.48B ✅
2. **stocks.chart** - Returns null (no Yahoo chart for ADX stocks) ❌ 
3. **stocks.profile** - Returns available=true with full profile data ✅
   - Has TradingView data: tvRSI, tvMACD, tvSMA20, tvSMA50, tvSMA200, tvEBITDA, tvNetIncome, tvTotalAssets
   - Has marketCap, trailingPE, beta, fiftyTwoWeekHigh/Low, sharesOutstanding
   - Has profitability: totalRevenue, grossMargin, operatingMargin, profitMargin, returnOnEquity
   - Has financial health: totalDebt, debtToEquity, currentRatio, freeCashflow

## Issue
- The page is still loading (skeleton placeholders visible)
- Key Metrics and Technical Indicators sections show loading skeletons
- The data IS being returned by the API, but the frontend may not be rendering it properly
- Likely the page is waiting for chart data which is null for ADX stocks

## Fix Needed
- Frontend needs to handle null chart data gracefully
- Key Metrics should render even when chart is null
