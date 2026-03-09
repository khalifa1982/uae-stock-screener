# Comprehensive Stock Detail Page Verification - IHC

## Overview Tab - VERIFIED
- **Header**: IHC logo, ADX badge, Conglomerates sector, Medical/Nursing Services industry, Market Closed badge
- **Price**: 399.40 AED +2.41% - CORRECT
- **5 Tabs**: Overview, Technicals, Financials, Profile, AI Analysis - ALL VISIBLE
- **Price Chart**: Shows "No chart data available" (chart API issue for ADX stocks)
- **Key Metrics (16 cards)**: Open 390.00, Day High 399.40, Day Low 390.00, Prev Close 390.00, Volume 171.1K, Avg Vol 208.0K, Market Cap 855.48B, P/E 40.2, EPS 9.94, 52W High 418.00, 52W Low 0.80, Div Yield —, Beta 0.03, Shares Out 2.18B, EV 894.76B, P/B 5.70 - ALL POPULATED
- **Technical Snapshot**: RSI 51.7 (Neutral), Overall Rating: Buy (0.245), SMA 20 398.805, SMA 50 399.260, MACD -0.8933, "Price is above SMA 50" - ALL WORKING
- **Performance & Volatility (13 metrics)**: 1W -0.03%, 1M -0.05%, 3M -0.03%, 6M -0.17%, YTD -0.05%, 1Y -0.55%, 5Y +730.35%, All Time +27256.16%, Vol Day 2.41%, Vol Week 3.04%, Vol Month 0.52%, ATR 2.57, Beta 0.03 - ALL POPULATED
- **Key Statistics (4 columns, 40+ fields)**:
  - Valuation: Market Cap, EV, P/E, P/S, P/B, P/FCF, EV/EBITDA - ALL POPULATED
  - Profitability: Revenue 111.40B, Gross Margin 26.14%, Op Margin 14.99%, Pre-Tax 30.88%, Net 17.42%, ROE 13.57%, ROA 4.67%, ROIC 8.86% - ALL POPULATED
  - Financial Health: Total Debt 92.69B, Total Assets 428.60B, Liabilities 179.59B, Equity 249.01B, D/E 0.6, Current 3.06, Quick 2.64 - ALL POPULATED
  - Per Share: EPS 9.94, Diluted 9.94, FCF 14.82B, EBITDA 22.84B, Shares 2.18B - ALL POPULATED

## Issues Found
1. 52W Low shows 0.80 - this might be incorrect (stock split or data issue)
2. Chart shows "No chart data available" - Yahoo chart API may not work for ADX stocks
3. Div Yield shows — for IHC (may not pay dividends)
