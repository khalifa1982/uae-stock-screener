# Master Field List - Stock Detail Page Implementation

## Data Source: TradingView Scanner API (Primary - Free, No API Key)

### Available TradingView Scanner Columns for UAE Stocks
These are confirmed working columns from the TradingView Scanner API:

#### Price & Volume
- close, open, high, low, volume, average_volume_10d_calc, average_volume_30d_calc
- change, change_abs, Perf.W, Perf.1M, Perf.3M, Perf.6M, Perf.YTD, Perf.Y, Perf.5Y, Perf.All

#### Valuation
- price_earnings_ttm, price_sales_current, price_book_fq, price_free_cash_flow_ttm
- enterprise_value_fq, enterprise_value_ebitda_ttm, price_earnings_growth_ttm

#### Profitability
- gross_margin, operating_margin, pre_tax_margin, net_margin
- return_on_equity, return_on_assets, return_on_invested_capital

#### Income Statement
- total_revenue, gross_profit, operating_income, net_income, earnings_per_share_basic_ttm
- ebitda, revenue_per_employee

#### Balance Sheet
- total_assets, total_liabilities_fq, total_debt, total_current_assets, total_current_liabilities
- cash_and_short_term_investments, total_shares_outstanding_fundamental

#### Cash Flow
- free_cash_flow, cash_f_operating_activities, capital_expenditures

#### Dividends
- dividends_yield, dividend_payout_ratio, dps_common_stock_prim_issue_fy

#### Technical Indicators
- RSI, RSI[1] (prev), Stoch.K, Stoch.D, CCI20, ADX, AO, Mom, MACD.macd, MACD.signal
- Rec.Stoch.RSI, BB.lower, BB.upper, Pivot.M.Classic.S1/S2/S3/R1/R2/R3, Pivot.M.Classic.Middle
- SMA5, SMA10, SMA20, SMA30, SMA50, SMA100, SMA200
- EMA5, EMA10, EMA20, EMA30, EMA50, EMA100, EMA200
- Ichimoku.BLine, VWMA, HullMA9

#### Recommendations
- Recommend.All, Recommend.Other (Oscillators), Recommend.MA (Moving Averages)

#### Volatility
- Volatility.W, Volatility.M, Volatility.D, ATR, beta_1_year

#### Other
- description (company name), logoid (logo), sector, market_cap_basic, type
- earnings_per_share_forecast_next_fq, number_of_employees

---

## SECTIONS TO IMPLEMENT (Mapped to TradingView Data)

### Tab 1: Overview
1. **Price Header** - close, change, change_abs, high, low, open, volume
2. **Key Metrics Cards** - market_cap, P/E, EPS, Div Yield, 52W High/Low, Beta, Avg Volume
3. **Technical Analysis Summary Gauge** - Recommend.All, Recommend.Other, Recommend.MA (Buy/Sell/Neutral bar)
4. **Oscillators Table** - RSI, Stoch.K/D, CCI20, ADX, AO, Mom, MACD, BB
5. **Moving Averages Table** - SMA5/10/20/30/50/100/200, EMA5/10/20/30/50/100/200, Ichimoku, VWMA, HullMA
6. **Pivot Points Table** - Classic S1/S2/S3, Middle, R1/R2/R3
7. **Performance & Returns** - 1W, 1M, 3M, 6M, YTD, 1Y, 5Y, All-Time
8. **Volatility** - Daily, Weekly, Monthly volatility, ATR, Beta
9. **Key Statistics** - Valuation (P/E, P/S, P/B, P/FCF, EV/EBITDA), Profitability (margins, ROE, ROA, ROIC), Financial Health (debt ratios, current ratio)

### Tab 2: Financials
1. **Income Statement** - Revenue, Gross Profit, Operating Income, EBITDA, Net Income, EPS (Annual + Quarterly toggle)
2. **Balance Sheet** - Total Assets, Total Liabilities, Total Debt, Current Assets/Liabilities, Cash, Equity
3. **Cash Flow** - Operating CF, CapEx, Free CF
4. **Financial Ratios** - All margins, returns, debt ratios, efficiency ratios

### Tab 3: Dividends
1. **Dividend Overview** - Current Yield, Annual Dividend, Payout Ratio, Ex-Date
2. **Dividend History** - Table of past dividends

### Tab 4: Analysis (Snowflake-style)
1. **Snowflake Scores** - Value (P/E vs industry), Future (growth), Past (earnings track), Health (debt), Dividend
2. **Fair Value Estimate** - Based on P/E, DCF, or comparable
3. **Risk Checks** - Debt level, earnings stability, dividend sustainability
4. **Peer Comparison** - vs sector peers on key metrics

### Tab 5: Profile
1. **Company Description** - Full text description
2. **Company Info** - Sector, Industry, Website, Address, Phone, Employees
3. **Key Officers** - Name, Title, Age (from Yahoo Finance)

---

## WHAT WE CAN GET FROM TRADINGVIEW SCANNER API (Confirmed)
All the above fields marked with TradingView column names are fetchable via the Scanner API.
For financial statements (Income/Balance/Cash Flow), TradingView Scanner provides TTM/FQ snapshots only (not multi-year history).
For multi-year financial history, we rely on Yahoo Finance quoteSummary.

## WHAT WE GET FROM YAHOO FINANCE (Supplementary)
- Full company description, officers, address, website
- Multi-year financial statements (annual + quarterly)
- Analyst recommendations history
- Insider transactions
- Institutional holdings
