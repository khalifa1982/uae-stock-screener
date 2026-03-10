# UAE Stock Screener — 103 Feature Ideas

A comprehensive roadmap of feature ideas organized by category, from quick wins to ambitious long-term goals. Each idea includes a brief description and estimated complexity.

---

## Category 1: Data & Market Coverage (10 ideas)

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| 1 | **Real-time OHLCV Charts via TwelveData** | Replace synthetic chart interpolation with actual TwelveData time_series data for accurate candlestick charts | Medium |
| 2 | **Intraday Chart Support** | Fetch 1-minute and 5-minute data during market hours for day traders (TwelveData supports 1min/5min intervals) | Medium |
| 3 | **Multi-timeframe Charts** | Allow switching between 1D, 1W, 1M, 3M, 6M, 1Y, 5Y, All chart timeframes with TwelveData | Medium |
| 4 | **Candlestick Chart Mode** | Add OHLC candlestick view alongside the existing area chart using TwelveData OHLCV data | Medium |
| 5 | **Market Breadth Dashboard** | Show advance/decline ratio, new highs/lows, and market-wide momentum for ADX and DFM combined | High |
| 6 | **Sector Heatmap** | Visual heatmap showing all UAE sectors with color-coded daily performance (like finviz.com) | Medium |
| 7 | **IPO Tracker** | Track upcoming and recent IPOs on ADX and DFM with subscription dates, pricing, and performance since listing | Medium |
| 8 | **Corporate Actions Calendar** | Aggregate dividends, splits, rights issues, AGMs, and earnings dates into a unified calendar view | High |
| 9 | **Index Composition Tracker** | Show ADX General Index and DFM General Index composition with weight of each stock | Medium |
| 10 | **Cross-Market Correlation** | Show how UAE stocks correlate with oil prices, S&P 500, gold, and regional indices (Saudi Tadawul, QSE) | High |

---

## Category 2: Technical Analysis Enhancements (12 ideas)

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| 11 | **Chart Overlay Indicators** | Overlay Bollinger Bands, SMA, EMA, VWAP directly on the price chart (TwelveData bbands/sma/ema history) | High |
| 12 | **MACD Histogram Chart** | Display MACD line, signal line, and histogram as a sub-chart below the price chart | Medium |
| 13 | **RSI Sub-Chart** | Show RSI with overbought/oversold zones as a sub-chart with divergence detection | Medium |
| 14 | **Volume Profile** | Show volume distribution at different price levels to identify support/resistance zones | High |
| 15 | **Fibonacci Retracement Tool** | Auto-calculate and display Fibonacci levels based on recent swing high/low | Medium |
| 16 | **Pattern Recognition** | Detect common chart patterns (head & shoulders, double top/bottom, triangles, flags) using AI | High |
| 17 | **Divergence Scanner** | Scan for RSI/MACD divergences across all UAE stocks and alert when found | High |
| 18 | **Custom Indicator Builder** | Let users create custom technical indicators by combining existing ones with formulas | Very High |
| 19 | **Multi-Stock Comparison Chart** | Overlay multiple stocks on the same chart for side-by-side performance comparison | Medium |
| 20 | **Ichimoku Cloud Overlay** | Display full Ichimoku cloud (Tenkan, Kijun, Senkou A/B, Chikou) on the price chart | Medium |
| 21 | **Support & Resistance Levels** | Auto-detect and display key support/resistance levels based on price action history | High |
| 22 | **Candlestick Pattern Scanner** | Detect doji, hammer, engulfing, morning star, and other candlestick patterns across all stocks | High |

---

## Category 3: Fundamental Analysis (10 ideas)

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| 23 | **Peer Comparison Dashboard** | Side-by-side comparison of up to 5 stocks across all fundamental metrics (P/E, ROE, margins, growth) | High |
| 24 | **DCF Calculator** | Interactive DCF model where users can adjust growth rate, discount rate, and terminal value assumptions | Medium |
| 25 | **Dupont Analysis** | Break down ROE into profit margin, asset turnover, and equity multiplier components | Medium |
| 26 | **Altman Z-Score** | Calculate bankruptcy risk score for each stock using Altman Z-Score formula | Low |
| 27 | **Piotroski F-Score** | Calculate financial strength score (0-9) based on profitability, leverage, and efficiency signals | Medium |
| 28 | **Graham Number Calculator** | Calculate Benjamin Graham's intrinsic value formula for value investors | Low |
| 29 | **Revenue Segment Breakdown** | Show revenue by business segment and geography with trend charts | Medium |
| 30 | **Insider Transaction Tracker** | Track and display insider buying/selling activity with transaction details | High |
| 31 | **Institutional Ownership** | Show institutional holders, their stake sizes, and changes over time | High |
| 32 | **Earnings Surprise History** | Track actual vs estimated EPS over multiple quarters with surprise percentage | Medium |

---

## Category 4: Screening & Filtering (10 ideas)

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| 33 | **Advanced Multi-Criteria Screener** | Filter stocks by 50+ criteria simultaneously (P/E range, dividend yield, market cap, RSI, etc.) | High |
| 34 | **Pre-built Screener Templates** | One-click screens: "High Dividend Yield", "Undervalued Growth", "Momentum Leaders", "Low Volatility" | Medium |
| 35 | **Screener with Snowflake Scores** | Add Snowflake category scores (Value, Future, Past, Health, Dividend) as filterable columns | Medium |
| 36 | **Custom Screener Saves** | Let users save and name their custom screening criteria for quick reuse | Medium |
| 37 | **Screener Alerts** | Get notified when a stock enters or exits a saved screener's criteria | High |
| 38 | **Sector Screener** | Screen within a specific sector (e.g., "show me all Real Estate stocks with P/E < 15") | Low |
| 39 | **Technical Screener** | Filter stocks by technical signals (RSI oversold, MACD crossover, above 200 SMA) | Medium |
| 40 | **Relative Strength Screener** | Find stocks with the highest relative strength vs the market index over various periods | Medium |
| 41 | **Dividend Screener** | Filter by dividend yield, payout ratio, years of consecutive dividends, ex-dividend date | Medium |
| 42 | **Volume Spike Scanner** | Identify stocks with unusual volume activity (>2x average) in real-time | Medium |

---

## Category 5: Portfolio & Watchlist (10 ideas)

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| 43 | **Portfolio Tracker** | Add stocks with buy price, quantity, and date to track P&L, total return, and portfolio allocation | High |
| 44 | **Multiple Portfolios** | Create separate portfolios (e.g., "Growth", "Income", "Speculative") with independent tracking | Medium |
| 45 | **Portfolio Performance Chart** | Show portfolio value over time with benchmark comparison (ADX index, DFM index) | High |
| 46 | **Portfolio Risk Analysis** | Calculate portfolio beta, Sharpe ratio, max drawdown, and sector concentration risk | High |
| 47 | **Dividend Income Tracker** | Track expected and received dividends per stock and total annual dividend income | Medium |
| 48 | **Watchlist with Alerts** | Create watchlists with price alerts (above/below threshold, % change, volume spike) | High |
| 49 | **Portfolio Rebalancing Suggestions** | AI-powered suggestions to rebalance portfolio based on target allocation and risk tolerance | Very High |
| 50 | **Cost Basis Calculator** | Track average cost basis across multiple purchases of the same stock | Medium |
| 51 | **Tax Reporting Helper** | Generate capital gains/losses report for tax purposes based on portfolio transactions | High |
| 52 | **Portfolio Import from Broker** | Import portfolio holdings from UAE brokers (e.g., via CSV upload or API) | Medium |

---

## Category 6: Alerts & Notifications (8 ideas)

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| 53 | **Price Alert System** | Set alerts for specific price levels (above/below) with push/email/in-app notifications | High |
| 54 | **Technical Signal Alerts** | Get notified when a stock triggers a technical signal (RSI oversold, golden cross, MACD crossover) | High |
| 55 | **Earnings Alert** | Notification before a stock's earnings report date with expected EPS | Medium |
| 56 | **Dividend Alert** | Notification before ex-dividend date with yield and payout details | Medium |
| 57 | **Market Open/Close Summary** | Daily notification with market summary, top gainers/losers, and key events | Medium |
| 58 | **Unusual Volume Alert** | Real-time alert when a stock's volume exceeds 3x its 30-day average | Medium |
| 59 | **52-Week High/Low Alert** | Notification when a stock hits a new 52-week high or low | Low |
| 60 | **Snowflake Score Change Alert** | Alert when a stock's Snowflake score changes significantly (e.g., Health drops from 5 to 2) | Medium |

---

## Category 7: AI & Intelligence (12 ideas)

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| 61 | **AI Stock Chatbot** | Natural language chat interface: "Which UAE stocks have the best dividend yield?" powered by Gemini | Very High |
| 62 | **AI Earnings Call Summarizer** | Summarize earnings call transcripts and extract key takeaways, guidance changes, and sentiment | High |
| 63 | **AI News Sentiment Aggregator** | Analyze sentiment across all news articles for a stock and show sentiment trend over time | High |
| 64 | **AI Portfolio Advisor** | Personalized AI recommendations based on user's risk profile, goals, and current holdings | Very High |
| 65 | **AI Market Commentary** | Daily AI-generated market commentary covering UAE market trends, sector rotations, and key events | High |
| 66 | **AI Comparative Analysis** | "Compare EMAAR vs ALDAR" — AI generates a detailed head-to-head comparison report | High |
| 67 | **AI Risk Assessment** | AI-generated risk report for each stock covering market risk, sector risk, company-specific risk | Medium |
| 68 | **AI Sector Outlook** | AI-generated quarterly outlook for each UAE sector based on macro data and company fundamentals | High |
| 69 | **AI Trade Idea Generator** | AI suggests potential trade ideas based on technical setups and fundamental catalysts | Very High |
| 70 | **AI Annual Report Analyzer** | Upload a company's annual report PDF and get AI-extracted key metrics, risks, and insights | High |
| 71 | **AI Dividend Sustainability Score** | AI evaluates whether a company's dividend is sustainable based on cash flow, payout ratio, and debt | Medium |
| 72 | **AI Fair Value Consensus** | Combine multiple valuation models (DCF, comparables, residual income) into an AI-weighted fair value | High |

---

## Category 8: Social & Community (8 ideas)

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| 73 | **Stock Discussion Forum** | Per-stock discussion threads where users can share analysis and opinions | High |
| 74 | **Trade Idea Sharing** | Users can post trade ideas with entry/exit/stop-loss and track their performance | High |
| 75 | **Analyst Leaderboard** | Rank users by the accuracy of their predictions and trade ideas | Very High |
| 76 | **Stock Polls** | Quick polls on each stock page ("Bullish / Neutral / Bearish" with results visualization) | Medium |
| 77 | **Follow Analysts** | Follow top-performing analysts and get notifications when they post new ideas | High |
| 78 | **Share Analysis Reports** | Generate shareable links for AI analysis reports and Snowflake scores | Medium |
| 79 | **Community Watchlists** | Public watchlists curated by experienced traders that others can follow | Medium |
| 80 | **Market Sentiment Survey** | Weekly community sentiment survey for the overall UAE market direction | Medium |

---

## Category 9: Visualization & UX (10 ideas)

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| 81 | **Dark/Light Theme Toggle** | User-selectable dark and light themes with persistent preference | Low |
| 82 | **Market Map (Treemap)** | Full-screen treemap visualization of the entire UAE market by market cap and daily change | High |
| 83 | **Sparkline Mini-Charts** | Add tiny inline price charts in the screener table rows for quick visual trend assessment | Medium |
| 84 | **Interactive Financial Charts** | Click-to-explore charts for income statement, balance sheet, and cash flow over time | Medium |
| 85 | **Stock Comparison Tool** | Side-by-side visual comparison of two stocks across all metrics with radar charts | Medium |
| 86 | **Customizable Dashboard** | Drag-and-drop widgets: watchlist, market overview, sector performance, news feed, portfolio | Very High |
| 87 | **Full-Screen Chart Mode** | Expand the price chart to full screen with all technical indicators and drawing tools | High |
| 88 | **PDF Report Export** | Export a comprehensive stock analysis report as a professionally formatted PDF | Medium |
| 89 | **Mobile-Optimized Views** | Dedicated mobile layouts for key pages (screener, stock detail, portfolio) with swipe navigation | High |
| 90 | **Keyboard Shortcuts** | Power-user shortcuts: search stocks (Ctrl+K), switch tabs, navigate between stocks | Medium |

---

## Category 10: Data Export & Integration (8 ideas)

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| 91 | **Excel/CSV Export** | Export screener results, financial data, and portfolio holdings to Excel/CSV | Medium |
| 92 | **API Access** | Public REST API for developers to access UAE stock data programmatically | High |
| 93 | **Telegram Bot Integration** | Send price alerts, daily summaries, and analysis reports to a Telegram bot | High |
| 94 | **WhatsApp Notifications** | Send critical alerts (price targets hit, earnings) via WhatsApp Business API | High |
| 95 | **Google Sheets Integration** | Real-time stock data feed into Google Sheets for custom analysis | Medium |
| 96 | **Webhook Support** | Trigger webhooks on price alerts, technical signals, or portfolio events for automation | High |
| 97 | **Widget Embeds** | Embeddable stock ticker, mini-chart, and Snowflake score widgets for external websites | Medium |
| 98 | **Calendar Sync** | Sync earnings dates, ex-dividend dates, and AGMs to Google Calendar/iCal | Medium |

---

## Category 11: Advanced Features (5 ideas)

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| 99 | **Backtesting Engine** | Test trading strategies against historical UAE stock data with performance metrics | Very High |
| 100 | **Paper Trading** | Simulated trading with virtual money to practice strategies without real risk | Very High |
| 101 | **Options Chain Viewer** | Display options data if/when UAE exchanges introduce options trading | High |
| 102 | **Macro Economic Dashboard** | UAE GDP, inflation, interest rates, oil prices, and their impact on the stock market | High |
| 103 | **Multi-Language Support** | Full Arabic language support with RTL layout for the entire platform | High |

---

## Category 12: TwelveData-Powered Advanced Features (20 ideas)

*These features leverage the full 104 TwelveData technical indicators available for ADX & DFM.*

| # | Feature | TwelveData Indicator(s) | Description | Complexity |
|---|---------|------------------------|-------------|------------|
| 104 | **Hilbert Transform Cycle Analysis** | ht_dcperiod, ht_dcphase, ht_phasor, ht_sine, ht_trendline, ht_trendmode | Advanced cycle detection using all 6 Hilbert Transform indicators to identify dominant market cycles and trend/cycle modes | High |
| 105 | **VWAP Intraday Overlay** | vwap | Real-time Volume Weighted Average Price overlay on intraday charts for institutional-level execution analysis | Medium |
| 106 | **Keltner Channel Squeeze Detector** | keltner, bbands | Detect Bollinger Band squeeze inside Keltner Channels (volatility compression) as a breakout predictor | Medium |
| 107 | **Coppock Curve Long-term Signal** | coppock | Monthly Coppock Curve for long-term buy signals on UAE indices and large-cap stocks | Low |
| 108 | **KST Momentum System** | kst | Know Sure Thing indicator combining 4 ROC timeframes for smoothed momentum signals | Medium |
| 109 | **Linear Regression Channel** | linearreg, linearregangle, linearregslope, linearregintercept | Auto-draw regression channels with slope angle and deviation bands for trend analysis | Medium |
| 110 | **Heikin-Ashi Trend View** | heikinashicandles | Alternative candlestick view using Heikin-Ashi smoothed candles for clearer trend identification | Low |
| 111 | **SuperTrend Heikin-Ashi Hybrid** | supertrend_heikinashicandles | Combined SuperTrend + Heikin-Ashi for noise-filtered trend following signals | Medium |
| 112 | **Percent B Band Position** | percent_b | Show where price sits within Bollinger Bands (0-1 scale) for mean reversion strategies | Low |
| 113 | **Directional Movement System** | plus_di, minus_di, adx, adxr, dx | Complete DMI system with +DI/-DI crossovers, ADX strength, and ADXR smoothing | Medium |
| 114 | **Multi-Timeframe RSI Dashboard** | rsi | RSI values across 5 timeframes (1h, 4h, 1D, 1W, 1M) in a single dashboard view | Medium |
| 115 | **MACD Slope Momentum** | macd_slope | MACD regression slope for detecting acceleration/deceleration of momentum | Low |
| 116 | **Extended MACD Customizer** | macdext | Customizable MACD with different MA types (SMA, EMA, DEMA, TEMA) for each component | Medium |
| 117 | **Adaptive Moving Average System** | kama, mama, mcginley_dynamic | Compare 3 adaptive MAs (Kaufman, MESA, McGinley) to find the best-fit trend for each stock | Medium |
| 118 | **Volatility Dashboard** | atr, natr, stddev, trange, bbands, beta | Comprehensive volatility analysis combining 6 volatility measures with percentile rankings | High |
| 119 | **Volume Analysis Suite** | obv, ad, adosc, mfi, rvol | Complete volume analysis with OBV trend, A/D line, Chaikin oscillator, MFI, and relative volume | High |
| 120 | **ROC Multi-Speed Scanner** | roc, rocp, rocr, rocr100 | Scan all UAE stocks for momentum using 4 ROC variants across multiple timeframes | Medium |
| 121 | **Time Series Forecast** | tsf | Statistical price forecasting using linear regression-based Time Series Forecast indicator | Medium |
| 122 | **Parabolic SAR Extended** | sarext | Enhanced Parabolic SAR with customizable acceleration factors for different market conditions | Low |
| 123 | **Statistical Arbitrage Scanner** | correl, beta, stddev | Find pairs of UAE stocks with high correlation for statistical arbitrage opportunities | Very High |

---

## Priority Matrix

**Quick Wins (Low effort, High impact):**
- #26 Altman Z-Score, #28 Graham Number, #38 Sector Screener, #59 52-Week Alerts, #81 Theme Toggle
- #107 Coppock Curve, #110 Heikin-Ashi View, #112 Percent B, #115 MACD Slope, #122 SAR Extended

**High Priority (Medium effort, High impact):**
- #1 Real OHLCV Charts, #2 Intraday Charts, #3 Multi-timeframe, #33 Advanced Screener, #43 Portfolio Tracker, #53 Price Alerts, #88 PDF Export, #91 Excel Export
- #105 VWAP Overlay, #106 Keltner Squeeze, #113 DMI System, #114 Multi-TF RSI, #117 Adaptive MA System

**Strategic (High effort, High impact):**
- #5 Market Breadth, #6 Sector Heatmap, #61 AI Chatbot, #82 Market Map, #86 Customizable Dashboard, #93 Telegram Bot, #103 Arabic Support
- #104 Hilbert Transform, #118 Volatility Dashboard, #119 Volume Suite, #120 ROC Scanner

**Long-term Vision (Very High effort):**
- #18 Custom Indicators, #49 AI Rebalancing, #75 Analyst Leaderboard, #99 Backtesting, #100 Paper Trading, #123 Statistical Arbitrage

---

## TwelveData Coverage Summary

**104 Technical Indicators** available for all ADX & DFM stocks:

| Category | Count | Key Indicators |
|----------|-------|----------------|
| Trend | 15 | SMA, EMA, DEMA, TEMA, KAMA, MAMA, McGinley Dynamic, Ichimoku, SuperTrend, Parabolic SAR |
| Momentum | 25 | RSI, MACD, Stochastic, CCI, MFI, Williams %R, ROC, Momentum, CMO, ConnorsRSI, KST, Coppock |
| Volatility | 12 | Bollinger Bands, ATR, NATR, Keltner Channels, Standard Deviation, True Range, Beta |
| Volume | 8 | OBV, Chaikin A/D, ADOSC, MFI, RVOL, VWAP |
| Cycle | 7 | Hilbert Transform (6 variants), DPO |
| Statistical | 10 | Linear Regression (4 variants), Correlation, Variance, TSF, Min/Max |
| Math/Utility | 15 | Add, Sub, Mult, Div, Sqrt, Exp, Ln, Log10, Ceil, Floor, Sum, Avg |
| Hybrid | 12 | MACD Extended, MACD Slope, Stochastic RSI, Stochastic Fast, Percent B, Pivot Points, Aroon Oscillator |
