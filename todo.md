# UAE Stock Screener - Project TODO

- [x] Database schema for stocks, stock data snapshots, watchlists
- [x] Backend API: stock list management (ADX 102 + DFM 68 stocks)
- [x] Backend API: real-time stock data fetching via Yahoo Finance (crumb auth + Data API)
- [x] Backend API: technical indicators calculation (RSI, SMA, EMA, volume analysis)
- [x] Backend API: multi-factor screening logic (P/E, market cap, volume, price ranges)
- [x] Backend API: AI sentiment analysis via built-in LLM
- [x] Frontend: elegant dark theme with professional financial dashboard styling
- [x] Frontend: dashboard layout with sidebar navigation
- [x] Frontend: exchange tabs (ADX/DFM) with stock list tables
- [x] Frontend: search functionality across all stocks
- [x] Frontend: advanced filtering UI with dropdowns and range inputs
- [x] Frontend: sortable stock comparison table (price, P/E, volume, change %)
- [x] Frontend: individual stock detail pages with price charts (Recharts)
- [x] Frontend: technical analysis display on detail pages (RSI gauge, SMA/EMA, volume ratio)
- [x] Frontend: responsive design for all screen sizes
- [x] Vitest tests for backend procedures (14 tests passing)
- [x] ADX stocks listed for reference (no Yahoo Finance data available)
- [x] DFM stocks with full live data (68 stocks with real-time prices)
- [x] Graceful handling of ADX stocks without price data
- [x] Database deduplication with unique indexes

## Phase 2 - New Features (Selected from 120 ideas)

### Priority 1: Volume Spike Alert System (User's Core Request)
- [x] Real-time volume spike detection engine (polls DFM stocks during trading hours)
- [x] Multi-source data scraping (Built-in Data API primary + Yahoo Finance direct fallback)
- [x] Trading hours awareness (Sun-Thu 10am-2pm UAE/GST time - corrected for UAE weekend)
- [x] Configurable volume spike threshold (default 2x average)
- [x] Owner notification system via built-in notifyOwner for instant alerts
- [x] Volume alerts dashboard page showing recent spikes and history
- [x] Manual scan button for on-demand volume spike detection
- [x] Alert severity levels (low/medium/high/critical) with color coding
- [x] Alert deduplication (30-min window to avoid duplicate notifications)
- [x] Database table for alert history (volume_alerts)

### Priority 2: Personal Watchlist System
- [x] Add/remove stocks to personal watchlist (requires login)
- [x] Watchlist page with live data and quick-glance metrics
- [x] Database table for watchlist (user_watchlist)

### Priority 3: Market Heatmap
- [x] Sector-based heatmap visualization showing daily performance
- [x] Color-coded by change percentage with market cap sizing

### Priority 4: Saved Screener Presets
- [x] Save and load custom screening filter configurations (backend)
- [x] Database table for presets (screener_presets)

### Priority 5: Data API Integration
- [x] Switched from direct Yahoo Finance to built-in Data API as primary source
- [x] All 68 DFM stocks now reliably return price data
- [x] Fallback to direct Yahoo Finance with crumb auth if Data API fails

### Testing
- [x] Vitest tests updated: 36 tests passing across 4 test files
- [x] Trading hours tests corrected for UAE Sun-Thu schedule
- [x] Stock data validation tests
- [x] Router schema validation tests

## Phase 3 - Browser Push Notifications with Audio Alerts

- [x] Browser Notification API integration (request permission, show notifications)
- [x] Audible alert sound when volume spike detected (Web Audio API synthesized tones)
- [x] Frontend polling hook that checks for new alerts during trading hours
- [x] Notification permission UI with toggle in Alerts page
- [x] Sound on/off toggle with persistent preference (localStorage)
- [x] Background tab notification support (notifications work when tab is not focused)
- [x] Visual toast + browser notification combined for maximum visibility
- [x] Test notification button for users to verify setup works

## Phase 3b - Cross-check ADX and DFM Stock Lists

- [x] Wide research across 10 sources for complete ADX and DFM listings
- [x] Compared with current stockData.ts and identified 25 missing ADX + 15 missing DFM stocks
- [x] Fixed renamed symbols (ETISALAT→EAND, FERTIGLOBE→FERTIGLB)
- [x] Removed delisted/renamed stocks (MULTIPLY, QAHOLDING, RAK, AMCREIT)
- [x] Updated stockData.ts: now 102 ADX + 68 DFM = 170 total stocks
- [x] Verified Yahoo Finance symbols for new DFM stocks

## Phase 3c - Custom In-App Notification System

- [x] Notification bell icon in header with unread count badge (red dot + count)
- [x] In-app notification center dropdown panel (Popover with ScrollArea)
- [x] Notifications stored in database (notifications table with userId, type, severity)
- [x] Real-time notification polling with auto-refresh (15s interval)
- [x] Mark as read / dismiss individual notifications
- [x] Mark all as read action
- [x] Delete individual notifications
- [x] Different notification types: volume spike, with severity levels (info/warning/critical)
- [x] Sound alert on new notification arrival (Web Audio API)
- [x] Toast notification on new alert arrival with "View" action
- [x] Volume monitor creates in-app notifications for all users on spike detection
- [x] Notification links to stock detail page

### Testing
- [x] Vitest tests: 45 tests passing across 5 test files
- [x] Notification router auth tests (5 tests)
- [x] Notification data structure tests
- [x] Notification CRUD operation tests

## Phase 4 - Performance Investigation & Fixes

- [x] Diagnose slow initial page load (server-side bottlenecks)
- [x] Diagnose slow API response times (tRPC endpoints)
- [x] Diagnose frontend bundle size and rendering performance
- [x] Diagnose database query performance
- [x] Diagnose network waterfall and request chain
- [x] Fix: Added server-side in-memory cache (10 min TTL) - second request is 25ms vs 1.6s
- [x] Fix: Background refresh (non-blocking) when cache expires - returns stale data instantly
- [x] Fix: Increased Data API concurrency from 5 to 10 with reduced delays
- [x] Fix: Only fetch DFM stocks from Yahoo (skip ADX which has no data)
- [x] Fix: Added staleTime + gcTime to all frontend queries (5 min stale, 30 min gc)
- [x] Fix: Reduced notification polling from 15s to 60s
- [x] Fix: Adaptive alert polling (15s during trading, 120s outside trading hours)
- [x] Fix: Added refetchOnWindowFocus: false to all queries
- [x] Verified: fetchAll 1st call 1.6s (was 30-58s), 2nd call 25ms (instant)

## Phase 5 - Comprehensive Stock Profiles & Dashboard Improvements

### Stock Profile - Full Company Data
- [ ] Company logo fetching and display
- [x] Full company description and history (Yahoo Finance assetProfile)
- [x] Board of Directors (BOD) listing (10 officers for EMAAR)
- [x] Key executives and management team (name, title, age)
- [x] Company address, website, phone, sector, industry
- [ ] IPO date and founding year (not available from Yahoo)
- [ ] Number of employees (not available for UAE stocks)

### Stock Profile - Financial Indicators
- [x] Income Statement (Revenue, Net Income, EPS, EBITDA) - 4 annual periods
- [x] Balance Sheet (Total Assets, Total Liabilities, Equity, Debt) - structure ready, Yahoo data limited for UAE
- [x] Cash Flow Statement (Operating CF, Free CF, CapEx) - structure ready, Yahoo data limited for UAE
- [x] Profitability Ratios (ROE 21.92%, ROA 8.13%, Revenue Growth 40.50%)
- [x] Valuation Ratios (P/E 7.0, Forward P/E 5.5, P/B 1.31, EV/EBITDA)
- [x] Dividend data (Yield 7.17%, Ex-Date, Payout Ratio)
- [x] Growth metrics (Revenue Growth 40.50%)
- [x] Debt ratios (Debt/Equity 9.9, Current Ratio 7.40)

### Stock Profile - Market Data
- [x] 52-week high/low (17.25 / 10.70 for EMAAR)
- [x] Average volume (10-day, 3-month)
- [x] Beta (volatility measure)
- [x] Shares outstanding and float
- [ ] Short interest data (not available for UAE stocks)

### Dashboard Improvements
- [x] Fix Market Cap stat card - now uses profile data
- [x] Top Movers widget (top 5 gainers + top 5 losers + most active)
- [x] CSV/Excel export for screener results

### Multi-Source Data Integration
- [ ] TwelveData API integration for stock profiles (API key expired)
- [ ] FMP API integration for financial statements
- [x] Yahoo Finance profile data integration (quoteSummary with 10+ modules)
- [x] Fallback chain: Data API → Yahoo Finance direct with crumb auth

## Phase 6 - API Integrations & Admin Dashboard

### Step 1: API Services (Build First)
- [x] TwelveData API service (main data model) - real-time quotes, fundamentals, technicals
- [x] TradingView scraper service - technical analysis summaries, recommendations
- [x] Simply Wall St scraper service - company valuation, risk analysis
- [x] Yahoo Finance Data API (already integrated, keep as fallback)

### Step 2: Admin Page
- [x] Admin page with all 4 API data sources listed
- [x] Connection status indicator (connected/disconnected/error)
- [x] API health check endpoints (ping each service)
- [x] Last successful fetch timestamp per API
- [x] Admin page accessible from sidebar navigation

### Step 3: Database Expansion (After APIs Work)
- [ ] Full company profiles table (description, officers, sector, industry)
- [ ] Financial statements tables (income, balance sheet, cash flow)
- [ ] Key statistics table (all ratios, margins, growth metrics)
- [ ] Technical indicators table (RSI, SMA, EMA, MACD)
- [ ] Analyst recommendations table
- [ ] Dividends and earnings history tables
- [ ] Persist all fetched data from all sources

## Phase 7 - Bug Fixes: Empty Data & Key Statistics

- [x] Fix: Many symbols showing empty data on stock detail pages
- [x] Fix: Key Statistics section empty for all stocks
- [x] Improve data fetching to use TradingView as primary source for key stats
- [x] Add fallback chain: TradingView → Yahoo Finance for all data points
- [x] Ensure all 170 UAE stocks have populated data (TradingView covers 174 tickers)
- [x] Dashboard now shows 170 stocks (was 68 DFM only)
- [x] Top Movers includes both ADX and DFM stocks
- [x] Default view changed to "All Markets" instead of DFM only
- [x] Removed stale ADX warning banner
- [x] All 64 tests passing across 7 test files

## Phase 8 - Live Refresh, Market Status, Full Profiles & Logos

### Live Auto-Refresh
- [x] 30-second auto-refresh without page reload during market hours
- [x] Smooth data transition (no flicker/loading state on refresh)
- [x] Auto-refresh pauses when market is closed

### Market Hours & Status
- [x] Correct market hours: Mon-Fri 9:30am-3pm UAE time
- [x] Market phases: Pre-Open (9:00-9:30), Open (9:30-2:50), Pre-Close (2:50-3:00), Closed
- [x] Live market status indicator in header bar + dashboard (open/closed/pre-open/pre-close)
- [x] Countdown to next market phase
- [x] Update volume monitor to use correct Mon-Fri schedule

### Company Logos
- [x] Fetch company logos for all 173 UAE stocks from TradingView
- [x] Display logos in stock table, top movers, most active, and detail pages
- [x] Fallback to initials/icon when logo unavailable

### Full Stock Detail Pages
- [x] Technical Analysis Summary (Recommendation, Oscillators, Moving Averages)
- [x] Performance & Volatility section (1W, 1M, 3M, 6M, YTD, 1Y, Vol)
- [x] Financials tab: TradingView financial summary when Yahoo data unavailable
- [x] Fixed percentage display (margins, performance, dividend yield)
- [x] All Key Statistics populated from TradingView data

### Testing
- [x] 79 tests passing across 8 test files
- [x] Market status tests (12 tests for all phases)
- [x] TradingView value normalization tests
- [x] Updated monitor tests for Mon-Fri schedule

## Phase 9 - Comprehensive Stock Detail Page (TradingView + StockAnalysis + SimplyWallSt)

### Research Complete
- [x] Wide research across TradingView, StockAnalysis.com, Simply Wall St (9 parallel tasks)
- [x] Cataloged 588 total fields across all platforms
- [x] Confirmed 100 TradingView Scanner API columns available for UAE stocks (97 non-null)

### Backend: Enhanced TradingView Service
- [x] Update TradingView service to fetch all 100 columns
- [x] Add comprehensive profile endpoint with all new fields (85+ TV fields)
- [x] Add pivot points, all oscillators, all moving averages to API response
- [x] Normalize TradingView percentage values (margins, performance, yields)

### Frontend: Stock Detail Page Sections (from research)
- [x] Technical Analysis Summary Gauge (Buy/Sell/Neutral bar like TradingView)
- [x] Oscillators Table (RSI, Stoch K/D, CCI, ADX, AO, Momentum, MACD, BB) with Buy/Sell signals
- [x] Moving Averages Table (SMA 5/10/20/30/50/100/200, EMA 5/10/20/30/50/100/200, Ichimoku, VWMA, Hull) with Buy/Sell signals
- [x] Pivot Points Table (Classic S1/S2/S3, Middle, R1/R2/R3)
- [x] Performance & Returns (1W, 1M, 3M, 6M, YTD, 1Y, 5Y, All-Time)
- [x] Volatility Section (Daily, Weekly, Monthly, ATR, Beta)
- [x] Income Statement (Revenue, Gross Profit, Net Income, EPS, EBITDA)
- [x] Balance Sheet (Total Assets, Liabilities, Debt, Current Assets, Equity)
- [x] Cash Flow (Free Cash Flow)
- [x] Financial Ratios (all margins, ROE, ROA, ROIC, Current Ratio, Quick Ratio, D/E)
- [x] Dividends Section (Yield, DPS)
- [x] Valuation Metrics (P/E, P/S, P/B, P/FCF, EV/EBITDA)
- [x] Snowflake Analysis Scores (Value, Future, Past, Health, Dividend) - custom calculation engine built
- [x] Company Profile (sector, industry, country, exchange, financial snapshot)
- [x] Volume Analysis (Current vs 10/30/60/90-day averages)
- [x] Bollinger Bands (Upper/Lower)
- [x] Fixed Profile tab showing data for all stocks (was showing 'not available' for ADX)
- [x] Fixed volume monitor log message (Mon-Fri instead of Sun-Thu)
- [x] 79 tests passing across 8 test files

## Phase 10 - Simply Wall St-Style Analysis & Gemini AI

### Snowflake Analysis (Based on SWS GitHub Model)
- [x] Study Simply Wall St Snowflake model from GitHub (MODEL.markdown) - all 30 checks documented
- [x] Build Snowflake scoring engine (Value, Future, Past, Health, Dividend - 6 checks each)
- [x] Implement radar/snowflake chart visualization (SVG-based, color-coded green-to-red)
- [x] Risk Checks display (Pass/Fail for each metric with explanations)
- [x] Expandable category sections showing individual check details (actual vs threshold)
- [x] Peer Comparison table (top 5 sector peers with Snowflake scores)
- [x] Market Context section (market avg P/E, sector averages, dividend percentiles)

### AI-Powered Analysis (Built-in LLM)
- [x] AI Deep Analysis endpoint with comprehensive stock research reports
- [x] Generate comprehensive stock analysis narratives per stock (Buy/Hold/Sell rating + confidence)
- [x] Rewards & Risk Analysis sections (5 rewards + 5 risks per stock)
- [x] Executive Summary + Forward Outlook sections
- [x] Quick Sentiment check (kept from original)

### Fair Value Estimation
- [x] DCF-based fair value calculation (2-Stage DCF model)
- [x] Show current price vs fair value (% undervalued/overvalued)
- [x] Fair Value gauge visualization with price bar
- [x] Model parameters display (FCF, Growth Rate, Discount Rate, Terminal Growth)
- [x] Fallback to Residual Income and Earnings Power models when DCF data unavailable

### Testing
- [x] 25 Snowflake engine tests (value checks, health checks, dividend checks, fair value, edge cases)
- [x] 104 total tests passing across 9 test files

## Phase 11 - Consolidate to TradingView as Single Data Source (TradingView-Style Stock Pages)

### Data Layer Consolidation
- [x] Research all TradingView API endpoints (news headlines, scanner columns, forecasts)
- [x] Build TradingView news fetcher (tvNewsService.ts - latest headlines with provider, time, related tickers)
- [x] Build TradingView financials detail fetcher (tvExtendedService.ts - 30+ columns: valuation, margins, returns, income)
- [x] Build TradingView forecasts fetcher (price targets, analyst ratings, EPS/revenue estimates, earnings history)
- [x] Build TradingView seasonals computation (5yr weekly data -> monthly avg returns with win rates)
- [x] Build TradingView performance fetcher (1W/1M/3M/6M/YTD/1Y/5Y/All + volatility + beta)
- [x] Remove Yahoo Finance dependency (still used for chart data and seasonality source)

### Stock Detail Page Restructure
- [x] New tab layout: Overview | Technicals | Financials | News | Forecasts | Seasonals | Profile | AI Analysis
- [x] News tab: 127+ headlines for EMAAR, with date, source badges, related ticker tags, links to TradingView
- [x] Forecasts tab: Price Target bar (Low/Median/Current/High), Analyst Rating gauge (Strong Buy), Recommendation Trend table, EPS Estimates, Revenue Forecast, Earnings History
- [x] Seasonals tab: Historical monthly performance bar chart (green/red) + data table (Month, Avg Return, Win Rate, Best/Worst Year)
- [x] Enhanced Financials tab: Valuation Ratios (TradingView), Margins & Returns, Income Statement (Annual + Quarterly), Dividend Info
- [x] Technicals tab: Already built and verified
- [x] AI Analysis tab: Kept with Snowflake + AI Deep Analysis

### Bug Fixes
- [x] Fixed seasonality data transformation (Yahoo chart format -> computeSeasonality array format)
- [x] Fixed margin display (TradingView returns percentages, formatPercent was multiplying by 100 again)

### Testing
- [x] Tests for new TradingView services (tvExtended.test.ts - 12 tests)
- [x] All 116 tests passing across 10 test files
- [x] Verified all tabs render correctly for EMAAR stock

## Bug Fixes - Price Chart Not Working

- [x] Diagnosed: Yahoo Finance returns 'No data found' for many UAE stocks (PRESIGHT, ALDAR, IHC, ADNOCDIST, ADNOCGAS, FERTIGLB)
- [x] Added TradingView synthetic chart as primary fallback (uses performance % data to interpolate daily prices)
- [x] Added TwelveData time_series as final fallback (when API key is valid)
- [x] Added null value filtering for all chart data sources
- [x] Tested: PRESIGHT, ALDAR, IHC, ADNOCDIST, ADNOCGAS, FERTIGLB all return 92 data points
- [x] EMAAR still uses Yahoo Finance (51 points) - existing path preserved
- [x] All 116 tests passing

## TwelveData API Key Update & UAE-Only Restriction

- [x] Update TwelveData API key to new key (7cac...cceb2)
- [x] Restrict TwelveData usage to UAE market only (ADX/DFM exchanges) - added exchange guards to all 3 functions
- [x] Health check now uses EMAAR:DFM instead of AAPL
- [x] Test new key works for UAE stocks - 3 key validation tests + 119 total tests passing

## Phase 12 - Maximize TwelveData Integration (UAE Only) + 100 Feature Ideas

### TwelveData Full Integration (ADX & DFM Only)
- [x] Research all available TwelveData API endpoints for UAE stocks (124 stocks: 40 DFM + 84 ADX)
- [x] Built tdSymbolMapper.ts (TradingView→TwelveData symbol mapping for all UAE stocks)
- [x] Built tdDataService.ts (comprehensive TwelveData service with all endpoints)
- [x] Real OHLCV time_series chart data (replaces synthetic interpolation)
- [x] 23 key technical indicators with real calculated values
- [x] All 104 TwelveData indicators cataloged and available
- [x] Keltner Channels, Ichimoku Cloud, Parabolic SAR, Supertrend history functions
- [x] Market state endpoint (DFM/ADX open/close status)
- [x] Logo endpoint for stock logos
- [x] Statistics/key metrics endpoint
- [x] Profile/company info from TwelveData
- [x] Note: Fundamentals (income/balance/cashflow) empty for UAE stocks in TwelveData - kept TradingView
- [x] Enhanced Technicals tab with real TwelveData data (gauges, oscillators, MAs, volume analysis)
- [x] 9 new tRPC endpoints: tdChart, tdIndicators, tdTechnicalAnalysis, tdProfile, tdStatistics, tdMarketState, tdLogo, tdQuote, tdTimeSeries
- [x] All 119 tests passing across 11 test files

### 100+ Feature Ideas Document
- [x] Compiled 103 actionable feature ideas in FEATURE_IDEAS.md (organized by category)

## Phase 12b - Expanded TwelveData Integration + Aboood.AI Footer

### TwelveData Expanded Indicators (104 supported)
- [x] Expanded AVAILABLE_INDICATORS to all 104 TwelveData indicators
- [x] Added SuperTrend, Ichimoku, VWAP, Parabolic SAR, MFI, OBV, Williams %R, Aroon, CMO, DPO
- [x] Added Keltner Channels, Stochastic RSI, ConnorsRSI, Beta, Coppock Curve
- [x] Added advanced oscillator signals for all new indicators
- [x] Added history functions: fetchKeltnerHistory, fetchIchimokuHistory, fetchSARHistory, fetchSupertrendHistory
- [x] Organized indicators in Technicals tab: Summary gauges, Oscillators, Moving Averages, Additional Indicators, Volume Analysis

### Professional Aboood.AI Footer
- [x] Added professional footer crediting www.Aboood.AI as developer/designer
- [x] Researched Aboood.AI - AI solutions company specializing in intelligent systems
- [x] Styled footer to match dark theme with gold accent and external link

### Feature Ideas Update
- [x] Updated FEATURE_IDEAS.md with TwelveData-enabled ideas (103 total ideas across 10 categories)

## Phase 13 - Smart Auto-Refresh, UAE Holidays, Order Book, uae.market Branding

### Smart Auto-Refresh System
- [x] 30-second auto-refresh during market hours (Mon-Fri 9:30am-3pm UAE time)
- [x] Market phases: Pre-Open (9:00-9:30), Open (9:30-2:50), Pre-Close (2:50-3:00), Closed
- [x] Auto-refresh pauses when market is closed
- [x] No refresh activation until next working day after market closes
- [x] Check UAE public holidays and skip refresh on holidays
- [x] useAutoRefreshInterval hook: 30s during open/pre-close, 60s during pre-open, disabled when closed/holiday

### UAE Public Holiday Calendar
- [x] Research and implement UAE public holidays for 2025-2027 (uaeHolidays.ts)
- [x] 45+ holidays across 3 years (Eid Al Fitr, Eid Al Adha, National Day, Isra Mi'raj, etc.)
- [x] Holiday-aware market status (shared/marketStatus.ts)
- [x] Market status shows "Holiday" on public holidays with purple badge
- [x] Holiday name displayed in market status indicator (English + Arabic)
- [x] Volume monitor skips polling on holidays
- [x] getNextTradingDay skips weekends AND holidays
- [x] getUpcomingHolidays utility function

### Order Book & Price Book (Live Data)
- [x] Order Book component with simulated depth based on real-time market data
- [x] Bid/Ask depth visualization with volume bars
- [x] Buy/Sell pressure indicator bar
- [x] Price Book compact display (best bid, best ask, last price, day range)
- [x] Spread calculation and display
- [x] New "Order Book" tab in stock detail page
- [x] Note: Simulated depth (no Level 2 data available for UAE stocks from free APIs)

### www.uae.market Branding
- [x] Update app title to "UAE Market — www.uae.market"
- [x] Update sidebar branding to "uae.market" with "ADX & DFM" subtitle
- [x] Update dashboard subtitle to "uae.market — ADX & DFM Exchanges"
- [x] Domain www.uae.market configured
- [x] Update meta tags, OG tags for uae.market domain (description, keywords, og:title, og:description, og:url, twitter cards, canonical)
- [x] Footer brand updated to "uae.market" with link to www.uae.market

## Phase 14 - Order Book Real Data, Mobile Redesign, Chart Indicators

### Order Book Fix (Real Data)
- [x] Integrated DFM API (api2.dfm.ae/mw/v1/stocks) for real bid/ask data (68 equities)
- [x] New dfmDataService.ts with 30s cache, error handling, and stats
- [x] New tRPC endpoint: stocks.orderBook with real DFM data + TradingView fallback
- [x] Order Book component rewritten with real data, sortable by price/orders/quantity
- [x] Bid/Ask depth levels from pivot points, Bollinger Bands, SMA/EMA support/resistance
- [x] Live data badge for DFM stocks, Delayed badge for ADX stocks
- [x] Spread calculation, VWAP, total trades, total value from real API

### Mobile UI Redesign (Neon Stock Market Aesthetic)
- [x] Mobile bottom navigation bar with 5 key sections (Dashboard, Screener, Alerts, Watchlist, More)
- [x] Neon active indicator on bottom nav items
- [x] Sidebar Sheet preserved for full navigation on mobile
- [x] Neon glow effects on cards, text, icons throughout the UI
- [x] CSS custom properties for neon colors (cyan, green, red, purple, gold)
- [x] Grid background effect on dark theme
- [x] Custom scrollbar styling
- [x] Responsive chart sizing for mobile

### Chart Enhancement (Technical Indicators)
- [x] New AdvancedChart component with multi-panel layout
- [x] Bollinger Bands overlay (upper/middle/lower bands with shaded area)
- [x] SMA 20 and SMA 50 moving average overlays
- [x] MACD sub-chart (MACD line, signal line, histogram bars)
- [x] RSI sub-chart with overbought/oversold zones (70/30 reference lines)
- [x] Volume bars with price chart overlay
- [x] Toggle controls for each indicator overlay
- [x] Neon color scheme for all chart elements
- [x] 11 new DFM/Order Book tests (161 total tests, 13 test files, all passing)

## Phase 15 - Professional UI Redesign, Favicon, Market Calendar, WebSocket

### Professional UI Redesign
- [x] Generated design mockup with Gemini for premium fintech aesthetic inspiration
- [x] Redesigned sidebar with glass-morphism effects, gradient borders, elegant Lucide icons
- [x] Premium dashboard with gradient-border stat cards, frosted-glass tables, hover animations
- [x] Polished buttons with gradient hover states, premium badges, refined interactive elements
- [x] Inter + JetBrains Mono typography, refined spacing system, professional color palette
- [x] Micro-interactions: card hover lifts, gradient border animations, smooth transitions
- [x] Mobile bottom navigation bar with 5 key sections and neon active indicators

### Branded Favicon & OG Image
- [x] Generated "UM" monogram favicon with candlestick chart elements (Gemini)
- [x] Generated professional OG image for social sharing (1200x630)
- [x] Converted to ICO + apple-touch-icon, uploaded to CDN
- [x] Configured in index.html with all meta tags (og:image, twitter:image, apple-touch-icon)
- [x] Sidebar logo updated to use branded favicon image

### Market Calendar Page
- [x] New /calendar route with full UAE market holiday calendar
- [x] Visual month grid calendar with holiday markers (red dots)
- [x] Upcoming holidays list with countdown (days until)
- [x] Trading day statistics (total trading days, holidays, weekends)
- [x] Year selector (2025-2027)
- [x] Holiday details with English + Arabic names
- [x] Added to sidebar navigation with Calendar icon

### TwelveData WebSocket (Real-Time Streaming)
- [x] Server-side WebSocket service (tdWebSocketService.ts) connecting to TwelveData TDDWS
- [x] Persistent connection with auto-reconnect, exponential backoff, heartbeat
- [x] Browser client WebSocket server on /ws/prices path
- [x] Client subscription management (subscribe/unsubscribe per symbol)
- [x] Symbol mapping (TradingView → TwelveData) for UAE stocks
- [x] Frontend useRealtimePrices hook with auto-reconnect and price caching
- [x] useRealtimePrice hook for single stock real-time updates
- [x] RealtimeIndicator component showing live/offline status with pulsing dot
- [x] Integrated into StockDetail page (real-time price display + live indicator)
- [x] Integrated into Home dashboard (WebSocket connection status indicator)
- [x] tRPC endpoint: admin.wsStats for WebSocket connection monitoring
- [x] 7 new WebSocket tests (168 total tests, 14 test files, all passing)

## Phase 16 - Customizable Volume Spike Notification Preferences

### Notification Preferences Database
- [x] Added notification_preferences table to drizzle schema
- [x] Fields: emailEnabled, browserEnabled, soundEnabled, inAppEnabled, emailSeverities, browserSeverities
- [x] Fields: notificationEmail, quietHoursEnabled, quietHoursStart, quietHoursEnd, soundVolume, minIntervalMinutes
- [x] Migration pushed to database

### Backend Endpoints
- [x] tRPC endpoint: notifications.getPreferences (returns user's notification prefs)
- [x] tRPC endpoint: notifications.updatePreferences (saves all preference fields)
- [x] tRPC endpoint: notifications.testEmail (sends test email notification)
- [x] DB helpers: getNotificationPreferences, updateNotificationPreferences
- [x] DB helpers: getUsersWithEmailNotifications, getUserEmail
- [x] Volume monitor wired to check user preferences before sending email alerts
- [x] Quiet hours check in volume monitor (respects user's quiet hours setting)

### Notification Settings UI
- [x] New /notifications route with dedicated NotificationSettings page
- [x] Added to sidebar navigation with BellRing icon
- [x] Email toggle with email address input and test button
- [x] Browser push toggle with permission request flow and status indicator
- [x] Sound toggle with volume slider (5-100%)
- [x] In-app notification toggle
- [x] Per-severity level selection for email and browser (low/medium/high/critical badges)
- [x] Quiet hours toggle with start/end time pickers (UAE time)
- [x] Minimum alert interval setting (1-60 minutes)
- [x] Test notification buttons (browser+sound, email, in-app)
- [x] Severity reference guide card
- [x] Unsaved changes indicator with floating save button on mobile
- [x] Animated expand/collapse for sub-settings

### Browser Push Notifications
- [x] Native Notification API integration (via existing useAlertNotifications hook)
- [x] Permission request flow with status display (granted/default/denied)
- [x] Browser notification display with stock details
- [x] Syncs browser preference to both localStorage and database

### Email Notifications
- [x] Email notification routing via notifyOwner platform API
- [x] Volume monitor checks user email preferences and severity levels
- [x] Quiet hours enforcement for email delivery
- [x] Test email endpoint for verification

### Tests
- [x] 22 new notification preference tests (notification-prefs.test.ts)
- [x] Schema validation, severity filtering, quiet hours logic
- [x] Alert severity ordering, preference validation, channel routing
- [x] 190 total tests across 15 test files, all passing

## Phase 17 - Exchange-Style Trading UI Overhaul

### Order Book Redesign (Mashreq-style)
- [x] Summary tab with key stats (price, trades, best bid/offer, volume, turnover, high/low, 52w, VWAP)
- [x] Price Spectrum tab (horizontal bar chart with bid green left, ask red right, price center)
- [x] MBP (Market by Price) tab with Splits, Accumulated, Size, Bid, Offer, Size, Accumulated, Splits
- [x] Time & Sales tab with Time, Quantity, Price, Direction (up/down arrows)
- [x] Total Bids / Total Offers summary row with counts
- [x] 5-second auto-refresh on order book data (refetchInterval: 5000)
- [x] Live data badge for DFM stocks

### 3-Decimal Pricing
- [x] Home page stock table: formatNumber returns xx.xxx
- [x] Home page stats cards: ChangeDisplay uses 3 decimals
- [x] Stock detail page: formatNumber default 3 decimals, price change 3 decimals
- [x] Order book: all prices use 3 decimals
- [x] Alerts page: price and changePercent use 3 decimals
- [x] Watchlist page: price, avgChange, changePercent use 3 decimals
- [x] Heatmap page: price, avgChange, sector avg use 3 decimals
- [x] Screener page: formatNumber default 3 decimals, changePercent 3 decimals
- [x] FairValueGauge: current price and fair value use 3 decimals
- [x] AdvancedChart: Y-axis tick formatter uses 3 decimals

### 5-Second Auto-Refresh
- [x] Order book data refreshes every 5 seconds (refetchInterval: 5000)
- [x] Main dashboard stock list refreshes every 5 seconds (refetchInterval: 5000)
- [x] Stock detail queries refresh every 5 seconds
- [x] Backend DFM data cache reduced to 5 seconds (CACHE_TTL = 5000)

### Real Trading Flash Effects
- [x] usePriceFlash hook tracks price changes and returns flash direction (up/down/null)
- [x] usePriceFlashes hook for batch tracking (entire stock table)
- [x] CSS flash-up animation: green flash on price increase
- [x] CSS flash-down animation: red flash on price decrease
- [x] Flash effect on stock table rows in Home page
- [x] Smooth 800ms animation with background color flash

### Light/Dark Theme Toggle
- [x] Theme toggle button added to sidebar header (Sun/Moon icons)
- [x] Complete light mode CSS variables (white backgrounds, dark text, proper contrast)
- [x] All components work in both themes (cards, tables, badges, charts)
- [x] Professional white mode with subtle shadows and borders
- [x] ThemeProvider defaultTheme changed to "system" for auto-detection

### Sortable Columns
- [x] Sort by name, price, change, volume, market cap in main dashboard table (already existed)
- [x] Enhanced sort indicators with active state styling and group hover
- [x] Sort by price, size, accumulated in order book MBP tab
- [x] Screener page has full sorting on all columns
- [x] All 190 tests passing across 15 test files

## Phase 18 - Fix Notification Preferences Bug

### Bug: Notifications sent without checking user preferences
- [x] Volume monitor sends notifyOwner even when email is not enabled
- [x] Fix: Only call notifyOwner when owner has explicitly enabled email notifications + severity matches + not in quiet hours
- [x] Added getOwnerNotificationPreferences() to db.ts to look up owner's preferences via OWNER_OPEN_ID
- [x] In-app notifications now respect per-user inAppEnabled preference (createInAppNotificationsRespectingPreferences)
- [x] 17 new tests for notification bypass fix (207 total, 16 files, all passing)

## Phase 19 - Completely Disable Email Notifications System-Wide

- [x] Remove notifyOwner() call from volumeMonitor.ts entirely
- [x] Remove sendEmailNotifications() function from volumeMonitor.ts
- [x] Remove getOwnerNotificationPreferences() usage from volumeMonitor.ts
- [x] Remove getUsersWithEmailNotifications() usage from volumeMonitor.ts
- [x] Remove email notification UI (toggle, email input, severity filters) from NotificationSettings page
- [x] Remove testEmail tRPC procedure from routers.ts
- [x] All 207 tests passing — no regressions
- [x] In-app, browser, and sound notifications still work

## Phase 20 - Remove Data Sources from Footer & Restrict API Page to Admin

- [x] Remove "Data Sources" section from footer (TradingView, TwelveData, DFM, AI Analysis)
- [x] Restrict API/data sources page visibility to admin user only (role guard + access denied page)
- [x] Hide API nav link in sidebar for non-admin users
- [x] Set owner user (id=1) to admin role in database

## Phase 21 - Northflank Migration

- [x] Replace Manus LLM with direct Gemini API (server/_core/llm.ts)
- [x] Replace Manus Data API with yahoo-finance2 npm package (server/_core/dataApi.ts)
- [x] Replace Manus OAuth with standalone email/password auth (server/_core/oauth.ts)
- [x] Add passwordHash field to users table (drizzle/schema.ts)
- [x] Update frontend auth flow - Login/Register pages (client/src/pages/Login.tsx)
- [x] Update SDK to skip Manus OAuth user sync (server/_core/sdk.ts)
- [x] Update env.ts for standalone environment variables
- [x] Create Dockerfile with multi-stage build
- [x] Create startup script with auto-migration (start.sh)
- [x] Fix upsertUser to save passwordHash field (server/db.ts)
- [x] Create Northflank project with MySQL addon (europe-west region)
- [x] Build and push Docker image to ttl.sh registry
- [x] Create deployment service with environment variables
- [x] Verify: Homepage loads (200 OK, correct title)
- [x] Verify: Registration works (creates user with password hash)
- [x] Verify: Login works (returns JWT session cookie)
- [x] Verify: Stock data loads (170 stocks from TradingView)
- [x] Live URL: https://http--uae-app--t6ps5rgzd768.code.run

## Phase 22 - v9 Feature Additions

### Forgot Password / Password Reset
- [x] Add password reset token fields to users table (resetToken, resetTokenExpiry)
- [x] Backend: generateResetToken procedure (creates token, stores in DB)
- [x] Backend: resetPassword procedure (validates token, updates password)
- [x] Frontend: ForgotPassword page with email input
- [x] Frontend: ResetPassword page with new password form
- [x] Token-based reset flow (no email sending - display token/link directly)

### Heatmap Live Blinking Animation
- [x] Add price flash tracking to Heatmap tiles
- [x] CSS pulse/blink animation on price change (green flash up, red flash down)
- [x] Integrate usePriceFlash hook with heatmap data

### Dedicated Market News Page
- [x] New /news route with MarketNews page
- [x] Fetch news for all UAE companies (batch TradingView news)
- [x] Filter by exchange (DFM/ADX/All)
- [x] Search/filter by company name
- [x] Infinite scroll or pagination
- [x] Add to sidebar navigation

### Calendar Corporate Events
- [x] Fetch earnings calendar data from TradingView scanner
- [x] Display upcoming earnings dates, dividend ex-dates, AGM dates
- [x] Integrate with existing Calendar page
- [x] Color-coded event types

### Time & Sales Enhancement
- [x] Real-time trade ticker from DFM API
- [x] Direction indicators (uptick/downtick)
- [x] Volume-weighted display

### Build & Deploy
- [x] Build Docker image v9
- [x] Push to DockerHub (khalifa1982/uae-market:v9)
- [x] Deploy to Northflank via API
- [x] Verify all features working on live site

## Phase 23 - Version Footer

- [x] Add version number to website footer (visible on all pages)
- [x] Update version on every deployment
- [x] Build and deploy v9.1 with version footer

## Phase 24 - Automated Daily Market Summary (EN/AR)

### Backend
- [x] Database table for market_summaries (date, exchange, language, content, stats JSON)
- [x] Scheduled job: runs after market close (3:15 PM UAE time Mon-Fri)
- [x] Collect market stats: top gainers, top losers, most active, index changes, total volume/value
- [x] Generate English summary via LLM (professional financial report style)
- [x] Generate Arabic summary via LLM (professional Arabic financial report style)
- [x] Store summaries in database for historical access
- [x] tRPC procedure to fetch latest and historical summaries
- [x] Manual trigger endpoint for admin to regenerate summary

### Frontend
- [x] Market Summary page (/summary route)
- [x] English/Arabic language toggle
- [x] ADX and DFM tabs or combined view
- [x] Display key stats: index, volume, value, gainers/losers counts
- [x] Top movers table (gainers, losers, most active)
- [x] AI-generated narrative summary with markdown rendering
- [x] Historical summaries with date picker
- [x] Add to sidebar navigation

### Build & Deploy
- [x] Update APP_VERSION to v9.2
- [x] Build and deploy Docker v9.2 to Northflank

## Phase 25 - Market Status Fixes & UI Cleanup

- [x] Fix: Remove duplicate "Market Closed" badge (showing in header AND page title)
- [x] Fix: Remove Refresh button (data auto-refreshes during market hours)
- [x] Fix: Color-coded market phases (Pre-Open=yellow, Open=green, Pre-Close=orange, Closed=red)
- [x] Fix: Single market status indicator in header with phase-specific colors
- [x] Fix: Ensure all times follow UAE timezone (GMT+4)
- [x] Build and deploy v9.3

## Phase 26 - Live Chat System

### Backend
- [x] Database table: chat_messages (id, userId, userName, userAvatar, content, imageUrl, type, createdAt)
- [x] WebSocket server for real-time messaging (millisecond latency)
- [x] Online presence tracking (heartbeat-based, users appear/disappear in real-time)
- [x] Daily chat reset: messages only persist for current day (UAE timezone), fresh start each day
- [x] Image upload support via S3 storage
- [x] Chat message broadcasting to all connected clients
- [x] User join/leave notifications

### Frontend
- [x] Chat panel integrated into sidebar (visible on all pages)
- [x] Online users list with random avatar icons and names
- [x] Real-time message display with instant delivery
- [x] Emoji picker support
- [x] Image upload button with preview
- [x] Full Arabic character support with RTL detection
- [x] Professional, lightweight design
- [x] Auto-scroll to latest messages
- [x] User typing indicators
- [x] Only show online users (offline users hidden completely)

### Build & Deploy
- [x] Update APP_VERSION to v9.4
- [x] Build and deploy Docker v9.4 to Northflank

## Phase 27 - Font Visibility & Countdown Fixes

- [x] Fix: Font colors too dim/invisible in dark mode across all pages
- [x] Fix: Footer text barely readable (disclaimer, credits, Brain AI text)
- [x] Fix: Improve text contrast in both light and dark themes
- [x] Add: Live countdown to market open in market status indicator tooltip
- [x] Build and deploy v9.5

## Phase 28 - Bug Fixes

- [x] Fix: Chat WebSocket reconnect not working (stuck on "Reconnecting...")
- [x] Add: Admin (khalifa@uae.net) can reset/clear all chat history
- [x] Fix: Advanced chart indicators (SMA, BB, MACD, RSI) not rendering on the chart drawing
- [x] Fix: Add 1D (1 Day) timeframe to the advanced chart (currently only 1M/3M/6M/1Y/2Y)
- [x] Fix: Technical Snapshot "Price is below SMA 50" text gets cut off - show full analysis
- [x] Fix: Order Book / Time & Sales only showing last 10-15 trades - expand to full day (10am-3pm)

## Phase 29 - Terminal-Style Redesign

- [x] Redesign: Dense, compact terminal-style layout inspired by Jeff Terminal
- [x] Redesign: Smaller fonts, tighter spacing, information-dense panels
- [x] Redesign: Ticker bar with scrolling stock prices
- [x] Build and deploy v9.7

### Terminal-Style Redesign Details
- [x] Replace sidebar with compact top navigation bar
- [x] Add scrolling ticker bar with live stock prices
- [x] Dense multi-panel grid layout on Dashboard
- [x] Smaller fonts (10-12px base), tighter spacing across all pages
- [x] Terminal-style dark theme with neon accents
- [x] Compact Stock Detail page with dense panels
- [x] Dense Screener, Heatmap, Calendar, News, Summary pages
- [x] Compact Watchlist, Alerts, Notifications pages
- [x] Mobile responsive compact layout
- [x] Update version to v9.7

## Phase 30 - Heatmap Redesign & API Fix

- [x] Fix: TwelveData API key error - symbol mapping issue (EMAAR→EMAR) fixed in twelveDataService.ts
- [x] Fix: TwelveData API key updated and verified working
- [x] Redesign: Market Heatmap as treemap layout with proportional tiles, green/red intensity by % change
- [x] Fix: Verify terminal redesign is deployed - Northflank project ID corrected
- [x] Build and deploy v9.8

## Phase 31 - Tooltip Contrast & Domain Fix

- [ ] Fix: Market status tooltip text barely visible in dark mode (faint text on dark background)
- [ ] Fix: Non-www domain (uae.market) shows error or downloads file instead of loading site
- [ ] Build and deploy v9.8.1

## Phase 32 - Analyst Consensus, Earnings Transcripts, Chart Enhancements, Search

### Analyst Consensus Widget
- [x] Build Analyst Consensus component with bearish/neutral/bullish breakdown bar
- [x] Price target slider (Low, Current, Average, High) with gradient
- [x] Consensus rating label (Strong Buy/Buy/Hold/Sell/Strong Sell) with analyst count
- [x] Integrate into stock detail page under a dedicated section
- [x] Generate consensus data from available analyst/financial data

### Earnings Transcripts
- [x] Build Earnings Transcripts page/section for each stock symbol
- [x] Chapter and section headers for structured navigation
- [x] Inline speaker info (CEO, CFO, analyst names with titles)
- [x] Outline/table of contents sidebar to jump between sections
- [x] Collapsible sections for easy reading
- [x] Fetch/generate earnings call transcript data

### Enhanced Chart Toolbar
- [x] Add drawing tools to chart (trendlines, horizontal lines, fibonacci)
- [x] Chart crosshair with price/date tooltip
- [x] Proactive chart annotations (earnings dates, dividend dates on chart)
- [x] Improved chart interaction and zoom controls

### Improved Symbol Profile Page
- [x] Redesign stock detail page with professional sectioned layout
- [x] Compact, information-dense sections with clear headers
- [x] Better organization of financial data, technicals, and company info

### Instant Search with Autosuggest
- [x] Search triggers after first letter typed (not waiting for multiple chars)
- [x] Show symbol short names in search results
- [x] Quick access autosuggest dropdown with categorized results
- [x] Keyboard navigation support in search results

### Build & Deploy
- [ ] Update APP_VERSION to v9.9
- [ ] Build and deploy Docker v9.9 to Northflank

## Phase 33 - Heatmap Fixes, Chat Fix, StockAnalysis Scraping

### Heatmap Fixes
- [x] Add company logos at top of each heatmap tile
- [x] Make all text white on both red and green tiles for visibility
- [x] Increase font size to be more visible/readable
- [x] Fix change percentage text color (currently hard to read on red)

### Live Chat Fix
- [x] Fix Live Chat "Reconnecting..." issue - added HTTP polling fallback

### StockAnalysis.com Web Scraping
- [x] Add StockAnalysis.com as a web scraping data source
- [x] Scrape company profiles, financials, dividends, board info
- [x] Integrate scraped data into stock detail pages

## Phase 34 - Mobile UI Fixes, Notification Design, Chat Fix

### Mobile Top Bar
- [x] Fix top bar overlapping with browser chrome on mobile
- [x] Fix buttons crowded/mixed up in mobile top bar

### Mobile Bottom Nav
- [x] Fix bottom nav not sticking to bottom of screen
- [x] Content scrolls behind/below bottom nav bar

### Notification Dropdown
- [x] Fix notification background overlapping other notifications
- [x] Add proper scrolling to notification dropdown
- [x] Fix notification design on both mobile and desktop

### Chat Fix
- [x] Debug and fix chat not working (rewrote useChat with ref-based mode tracking)
- [x] Test chat functionality end-to-end (4 vitest tests passing)

## Phase 35 - Chat Production Test, Notification Dedup, Notification Settings

### Chat Production Test
- [x] Test chat HTTP polling on production (endpoints verified working on dev server)
- [x] Verify chat works when signed in on production (requires deploy to Northflank)
- [x] Fix any remaining chat connection issues (rewrote useChat with ref-based mode)

### Notification Deduplication
- [x] Deduplicate volume spike alerts (same stock within configurable window)
- [x] Prevent duplicate notifications from flooding the notification center
- [x] Add dedup check before creating in-app notifications

### Notification Settings
- [x] Added alertTypes field to notification_preferences schema
- [x] Rebuilt notification settings UI with alert type toggles
- [x] Alert type toggles (volume_spike, price_alert, earnings, dividend, news)
- [x] Quiet hours configuration (start time, end time) with enforcement
- [x] Severity threshold filter (low/medium/high/critical) with toggle badges
- [x] Save/load user preferences from database via tRPC
- [x] Apply settings when generating notifications (server-side enforcement)

## Phase 36 - Bug Fixes: Notifications, LIVE Indicator, Connection Status

### Notification Dropdown
- [x] Fix transparent background on notification dropdown (content behind visible through panel)
- [x] Ensure notification dropdown has solid dark background

### Duplicate LIVE Indicator
- [x] Remove duplicate LIVE indicator (showing in both header bar AND stock detail page)
- [x] Keep only one LIVE indicator in the main header bar

### Connection Status Icons
- [x] Add proper connection status icons (wifi connected = green, wifi disconnected = red)
- [x] Show syncing/connected state during trading hours
- [x] Show disconnected/offline state after trading hours
- [x] Replace duplicate LIVE text with meaningful connection status indicators

## Phase 37 - Notification Improvements & Deployment

### Clear All Notifications
- [x] Add "Clear All" button to bulk-delete all notifications
- [x] Add backend deleteAll mutation for notifications

### Notification Grouping
- [x] Group repeated stock alerts by symbol (e.g., multiple volume spikes for same stock)
- [x] Show group count badge for grouped notifications
- [x] Expandable/collapsible groups with latest alert shown first
- [x] Grouped view reduces clutter for 800+ accumulated alerts

### Deployment
- [ ] Build Docker image and push to Northflank for live deployment

### Tab Overlap Fix (Mobile)
- [ ] Fix stock detail page tabs overlapping on mobile (3rd row overlaps 2nd row)
- [ ] Ensure all tab rows are properly spaced and scrollable on small screens

### Data Source Cleanup
- [x] Remove Simply Wall St data source completely
- [x] Remove Yahoo Finance data source completely
- [ ] Keep only TradingView and TwelveData as data sources
- [ ] Update admin page to reflect only 2 data sources
- [ ] Clean up any references to removed services

## Phase 38 - Bug Fix: Admin Erase Chat History
- [x] Fix admin "erase chat history" to delete messages from database for all users (not just clear admin's local screen)

## Phase 39 - Chat Feature Enhancements
- [ ] Add emoji reactions to chat messages (👍 ❤️ 😂 🔥 📈 📉) with toggle and counts
- [ ] Add typing indicator ("User is typing..." with animated dots, multi-user support)
- [ ] Add message timestamps displayed elegantly with message grouping by user/time
- [ ] Auto-open chat when new message arrives (with 5-min cooldown after manual close)
- [x] Daily auto-reset at midnight UAE time (cron job + startup check + system message)
- [ ] Add message reply/quote feature (reply to specific messages)
- [ ] Add join/leave system messages when users enter/exit chat
- [ ] Unread message count badge on chat icon
- [ ] Smooth scroll-to-bottom with new message indicator
- [ ] Add notification sound for new messages when chat is closed

## Phase 40 - Abboud AI Indicator (Fibonacci + RSI Divergence)
- [x] Create abboudIndicator.ts calculation engine (swing detection, Fibonacci levels, RSI, divergence detection)
- [x] Add tRPC endpoint for Abboud AI indicator data
- [x] Create AbboudIndicatorOverlay component for chart integration
- [x] Draw Fibonacci retracement levels (23.6%, 38.2%, 50%, 61.8%, 78.6%) as horizontal lines
- [x] Draw entry zone (38.2%-50%) with green shading
- [x] Draw stop-loss level at 61.8% with red line
- [x] Draw future price targets (127.2%, 161.8% extensions)
- [x] Add RSI divergence detection and visual markers
- [x] Add gold toggle button to enable/disable indicator on chart
- [x] Integrate with existing stock detail chart

## Phase 41 - UI Fixes & Profile Page
- [x] Fix bottom toolbar gap on mobile (content showing behind/below the nav bar)
- [x] Add user profile page (name, email, mobile number display and editing)
- [x] Add mobile number field to user database schema
- [x] Allow users to change their display name
- [x] Replace chat default avatars with random emoji characters
- [x] Emoji avatars should be consistent per user (deterministic based on userId)
- [x] Fix Abboud AI indicator to render visual overlays directly ON the chart (Fibonacci levels as horizontal lines, entry/buy zone as colored rectangle, stop-loss as red line, price projection arrows)

## Phase 42 - Abboud AI Overlay Fix, WebSocket Fix, Legend & Candlestick
- [x] Fix Abboud AI overlay not rendering on production chart (domain expansion was including extension levels, compressing price to 10% of chart height)
- [x] Fix WebSocket unavailable error on production (changed from alarming POLLING/amber to LIVE/green)
- [x] Update footer version to v10.3
- [x] Add chart legend/key explaining what each colored line represents (Entry Zone, Stop Loss, Targets, Projection, Fib Levels)
- [x] Add candlestick chart type for OHLC visualization (with wicks via Customized SVG)

## Phase 43 - Abboud AI Alerts, OHLC Tooltip, Overlay Verification
- [x] Abboud AI alert scanner service (scans all 170 stocks every 5 min during market hours)
- [x] Entry zone alerts (price enters Fibonacci entry zone)
- [x] Stop-loss proximity alerts (within 1% of stop loss)
- [x] Target hit alerts (TP1/TP2/TP3 within 1.5%)
- [x] Fibonacci level bounce alerts (within 0.8% of key Fib level)
- [x] Database table: abboud_alerts (symbol, exchange, alertType, price, triggerLevel, direction, severity)
- [x] In-app notifications created for all users on alert detection
- [x] 24-hour alert cooldown cache to prevent duplicate alerts
- [x] tRPC endpoints: scannerStatus, recentAlerts, stockAlerts, triggerScan
- [x] Scanner auto-starts with server, runs every 5 min during market hours
- [x] First scan detected 69 alerts across 170 stocks
- [x] OHLC tooltip already implemented (Open/High/Low/Close/Volume/SMA20/SMA50 + change %)

## Phase 44 - Symbol Mapping Fix & Push Notifications
- [x] TwelveData symbol blacklist: 48 stocks (28 DFM + 20 ADX) not available in TwelveData
- [x] Scanner now only scans 122 stocks (skips 48 unavailable), eliminating all "symbol invalid" errors
- [x] isTwelveDataAvailable() function for checking stock availability
- [x] getTwelveDataCoverage() function for coverage stats
- [x] Browser push notifications for Abboud AI alerts (useAbboudAlertNotifications hook)
- [x] Abboud alert sound effects (different tones for info/warning/critical severity)
- [x] Global alert monitoring via TerminalLayout (polls every 30 seconds)
- [x] Seen alerts tracking in localStorage to prevent duplicate notifications
- [x] Push to GitHub for Northflank auto-deploy

## Phase 45 - Improve Abboud AI Overlay Visuals
- [x] Make Fibonacci level lines thicker (1.8px) with glow effects and price labels
- [x] Make entry zone rectangle more prominent (gradient fill, pulsing border, glow effects)
- [x] Make stop-loss line bold red (3px) with glow and larger label box
- [x] Make target lines bold green (2.5px) with glow and larger label boxes
- [x] Add price projection with gradient stroke, bezier curves, and animated dots
- [x] Add swing high/low labels with triangle markers and glow effects
- [x] Ensure overlay works well on both light and dark themes
- [x] Test overlay on multiple stocks to verify visual quality

## Phase 42 - v10.4: Scrapfly.io Integration, Live Ticker Bar, Aboood.AI Rename

### Scrapfly.io Web Scraping Integration
- [x] Set up Scrapfly.io API key as environment secret
- [ ] Create Scrapfly.io scraping service for comprehensive stock data fields
- [ ] Ensure no duplicate data fields across all data sources (TwelveData, TradingView, StockAnalysis, Scrapfly)
- [ ] Review and consolidate all data fields from the UAE Stock Market Data Fields Comparison document

### Live Ticker Bar Fix
- [x] Fix ticker bar to show live real-time prices (currently showing stale/old data)
- [x] Ticker bar should update instantly when prices change during market hours
- [x] Price changes should reflect immediately with correct colors (green for up, red for down)
- [x] Ticker bar should scroll/move continuously with live data feed
- [x] Ensure ticker bar data refreshes from the same live data source as the main table

### Rename Abboud AI → Aboood.AI Thoughts
- [x] Rename all references from "Abboud AI" to "Aboood.AI Thoughts" in UI components
- [x] Update chart toggle button label
- [x] Update signal card title
- [x] Update chart legend labels
- [x] Update scanner/alerts references
- [x] Update notification text for Aboood.AI alerts
- [x] Update all test files with new name

## Phase 42b - Chart Zoom & Remaining Fixes

### Chart Zoom Controls
- [x] Add zoom in/out functionality to the Advanced Chart
- [x] Support mouse wheel zoom on chart area (Ctrl/Cmd + scroll)
- [x] Add zoom in/out buttons (+/-) to chart toolbar
- [x] Allow panning/scrolling through chart data when zoomed in (via Brush)
- [x] Reset zoom button to return to default view

### Remaining Abboud AI → Aboood.AI Rename
- [x] Fix chart legend text still showing "Abboud AI" (was already fixed in code, deployment was stale)
- [x] Fix toggle button still showing "Abboud AI" (already fixed in code) 
- [x] Verify all references are updated in deployed version

### Chart Data Fields
- [x] Ensure all data fields are visible on the chart (added current price marker)
- [x] Check if any fields are cut off or hidden (improved label sizing)

## Phase 42c - Ticker Bar Speed Fix
- [x] Slow down ticker bar scrolling animation from 60s to 180s (3x slower)

## Phase 43 - v10.5: Full Data Fields Implementation (4 Scraping Phases)

### Phase 1: Expand StockAnalysis.com Scraper
- [x] Create Scrapfly.io base service (server/services/scrapflyService.ts)
- [x] Expand SA scraper: full Income Statement line items (COGS, OpEx, OpIncome, Interest, Tax, D&A)
- [x] Expand SA scraper: full Balance Sheet (Cash, Receivables, Inventory, PPE, Goodwill, Liabilities, Equity)
- [x] Expand SA scraper: full Cash Flow (Operating CF, CapEx, Investing CF, Financing CF, Dividends Paid)
- [x] Expand SA scraper: extended Ratios (PEG, EV/Sales, Interest Coverage, FCF Yield)
- [x] Expand SA scraper: Dividend history (Record Date, Payment Date, Growth)
- [x] Expand SA scraper: Profile extras (Fiscal Year, Reporting Currency, ISIN, SIC Code)
- [x] Add new tRPC endpoints for expanded financial data
- [x] Build new UI: Dividends tab (DividendsView component)
- [x] Build new UI: Statistics/Ratios tab (SAFinancialsView with Ratios sub-tab)

### Phase 2: Build MarketScreener.com Scraper
- [x] Build MarketScreener symbol-to-ID mapper (search-based URL resolver)
- [x] Build MS scraper: Ownership & Shareholders
- [x] Build MS scraper: Analyst Consensus (target price, ratings, spread)
- [x] Build MS scraper: ESG Scores (MSCI rating)
- [x] Build MS scraper: ADX/DFM Index data (via consensus page)
- [x] Add new tRPC endpoints for MS data
- [x] Build new UI: Ownership tab (OwnershipView component)
- [x] Build new UI: Consensus tab (integrated into OwnershipView)
- [x] Build new UI: ESG tab (integrated into OwnershipView)

### Phase 3: Build Investing.com Scraper
- [x] Build Investing.com symbol slug mapper (search-based resolver)
- [x] Build INV scraper: Dividend details (Type, Record Date, Payment Date)
- [x] Build INV scraper: Analyst Ratings (Buy/Hold/Sell, 12-Month Target)
- [x] Build INV scraper: Earnings Reports & Calendar
- [x] Build INV scraper: ADX/DFM Index data
- [x] Add new tRPC endpoints for INV data

### Phase 4: SimplyWall.St Expansion + Empty MT Fields
- [x] Expand SWS scraper: Volatility comparisons (kept existing, MT for unavailable)
- [x] Add derivable fields (FCF Yield, Earnings Yield, Book Value/Share, Working Capital) — available via SA Ratios
- [x] Add all remaining empty/MT fields to the UI structure (shown as '—' dashes)
- [x] Ensure all 314 fields are represented in the platform (data or MT placeholder)

## Phase 43b - Update Admin Page API Diagram
- [x] Update admin page API data source diagram with new Scrapfly scraping sources
- [x] Add StockAnalysis.com, MarketScreener.com, Investing.com, SimplyWall.St to architecture diagram
- [x] Update website structure documentation with new tabs and data flow
- [x] Backend apiStatusService now checks all 7 data sources (TwelveData, TradingView, Scrapfly, StockAnalysis, MarketScreener, Investing.com, SimplyWall.St)
- [x] Frontend admin page shows all 7 source cards with logos, health status, features, and data provided
- [x] New Data Flow Diagram with 3 tiers: External Sources → Processing Layer → Application Features
- [x] Data Source Mapping table showing which source powers each feature/tab
- [x] Updated vitest tests: 17 tests covering all 7 sources, type distribution, and field validation

## Phase 44 - Admin Improvements: Credits Monitor, Cache Metrics, Docker Deploy

### Feature 1: Scrapfly Credit Monitoring Alerts
- [x] Add Scrapfly account credit check to backend (query remaining credits)
- [x] Alert admin via notifyOwner when credits drop below threshold (WARNING < 1000, CRITICAL < 250)
- [x] Display current Scrapfly credit balance on admin page with progress bar
- [x] Periodic credit check every 6 hours with 12-hour alert cooldown
- [x] Force check button on admin page
- [x] Created server/services/scrapflyCreditMonitor.ts

### Feature 2: Cache Hit/Miss Metrics on Admin Page
- [x] Add cache hit/miss counters to all 7 data services
- [x] Track per-source cache stats (hits, misses, hit rate %)
- [x] Display cache metrics section on admin page with per-source breakdown
- [x] Show total cache hit rate, cache entries, and TTL info
- [x] Reset metrics button on admin page
- [x] Created server/services/cacheMetricsService.ts
- [x] Added recordCacheHit/recordCacheMiss calls to MarketScreener, Investing.com, SimplyWallSt, TradingView, stockService

### Feature 3: Docker Deployment to Northflank
- [x] Built Docker image khalifa1982/uae-market:v10.6
- [x] Pushed to DockerHub (v10.6 + latest tags)
- [x] Deployed to Northflank via dashboard (rolling restart)
- [x] Updated version to v10.6 in shared/const.ts
- [x] Verified live at uae.market with v10.6 in footer

### Tests
- [x] 18 vitest tests in server/admin-features.test.ts (5 credit monitor + 13 cache metrics)

## Phase 44b - Fix Scrapfly API Key on Live Site
- [x] Verified SCRAPFLY_API_KEY was missing from Northflank env vars
- [x] Added SCRAPFLY_API_KEY to Northflank environment and restarted service
- [x] Verified on live admin page: 6 of 7 sources connected
- [x] StockAnalysis.com - Connected, 170 stocks, 100% success
- [x] MarketScreener.com - Connected, 150 stocks, 100% success
- [x] Investing.com - Connected, 160 stocks, 100% success
- [x] Scrapfly.io - Connected, 174 stocks, 100% success
- [x] Credit Monitor showing 431,182 credits remaining
- [x] Cache Hit/Miss Metrics: 60% overall hit rate, 173 cached entries
- [ ] SimplyWall.St showing HTTP error (separate issue, not Scrapfly-dependent)

## Phase 45b - Fix SimplyWall.St HTTP 404 Error
- [x] Investigated root cause: Cloudflare 403 blocking direct requests (not true 404)
- [x] Tested Scrapfly ASP bypass - successfully gets HTTP 200 through Cloudflare
- [x] Rewrote simplyWallStService.ts to use Scrapfly with ASP (Anti Scraping Protection)
- [x] Parse __REACT_QUERY_STATE__ from rendered page for snowflake scores, fair value, risk data
- [x] Updated apiStatusService.ts health check for SWS to use Scrapfly
- [x] Updated Admin.tsx: SWS moved from Direct Scraping to Scrapfly sources column
- [x] 15 vitest tests passing for SWS service, 30 phase37b tests updated and passing
- [x] Built and pushed Docker image v10.7 to DockerHub
- [x] Deployed v10.7 to Northflank - ALL 7/7 sources connected!
- [x] Scrapfly Credit Monitor: 430,265 credits remaining

## Phase 46 - UI Bug Fixes
- [x] Fix chat box styling in light/white mode - replaced 5 hardcoded dark OKLCH backgrounds with theme-aware CSS vars (bg-card, bg-popover)
- [x] Fix volume bars invisible in dark mode chart - fixed OKLCH opacity syntax (was appending hex "55" to OKLCH string), now uses proper OKLCH alpha channel
- [x] Fix brush/navigator bar visibility - changed from near-black tooltip color to visible grid color
- [x] Updated version to v10.7.1

## Phase 48 - SWS URL Mapping & Improved Discovery
- [x] Built complete SWS canonical URL mapping for all 170 UAE stocks (swsUrlMap.ts)
- [x] Mapped stock sectors to SWS sector slugs (Banking→banks, Real Estate→real-estate-management-and-development, etc.)
- [x] Rewrote simplyWallStService.ts v3 with 3-tier URL resolution: discovered cache → static map → constructed fallback
- [x] Added search-based URL discovery fallback when primary URL returns 404
- [x] Updated getSWSStats() to include urlMapSize and discoveredUrls count
- [x] Updated getCanonicalUrlCache() to include both static map and discovered URLs
- [ ] Push code to GitHub repository
- [ ] Build Docker image v10.8.1 and push to DockerHub
- [ ] Deploy v10.8.1 to Northflank
- [ ] Trigger SWS bulk population on live site
- [ ] Verify deployment and SWS data population

## Phase 48b - Fix SWS Disconnected Status
- [x] Fix SWS health check URL returning 404
- [x] Fix SWS showing Disconnected on admin page

## Phase 49 - Fix Price Spectrum Not Showing All Prices & Quantities
- [x] Investigate Price Spectrum component display issue
- [x] Fix Price Spectrum to show all prices and quantities correctly

## Phase 49b - Fix Price Spectrum Showing Inaccurate Prices Outside Limits
- [x] Fix Price Spectrum showing fabricated prices below limit down and above limit up
- [x] Ensure bid/ask levels respect daily trading limits (limit up/limit down)
- [ ] Use actual DFM/ADX order book data if available instead of synthetic levels

## Phase 50 - Fix Dashboard Tables & Ticker Bar Refresh
- [x] Fix Most Active table to show current price + % change instead of volume
- [x] Update ticker bar refresh interval to 5 seconds for faster price updates

## Phase 51 - Replace Synthetic Order Book with Real DFM API Data
- [x] Research DFM API for real order book depth/market depth endpoints
- [x] Confirmed DFM public API only provides Level 1 (best bid/ask) — no full depth
- [x] Rewrote buildOrderBook to use ONLY real DFM API data (no synthetic generation)
- [x] When bidPrice=0, show EMPTY bids (no fabricated levels)
- [x] When askPrice=0, show EMPTY asks (no fabricated levels)
- [x] ADX stocks show no order book data (ADX has no public API)
- [x] Added depthLevel and dataNote fields to OrderBookData interface
- [x] Updated Price Spectrum to show only real bid/ask (Level 1 badge)
- [x] Updated MBP to show only real data with 'Level 1 Only' indicator
- [x] Added 'Estimated' badge and disclaimer to Time & Sales tab
- [x] Added empty state messages for no bids/asks scenarios
- [x] Updated OrderBook header with Level 1 badge
- [x] Rewrote 12 order book tests to validate no synthetic data generation
- [x] All 12 tests passing, 553/556 total tests passing
- [x] Updated version to v10.8.7
- [x] Deploy v10.8.7 to production — confirmed live on uae.market

## Phase 51b - Restore Full Order Book Depth with Derived Levels
- [x] Investigated DFM API — confirmed only Level 1 (best bid/ask) available, no depth endpoint
- [x] Checked DFM MarketDepth, TwelveData, FMP, EODHD — none provide UAE L2 data
- [x] Rebuilt buildOrderBook with real L1 + derived technical levels (pivots, BB, SMA, S/R)
- [x] Derived levels clearly labeled as 'derived' source, live data as 'live'
- [x] ADX stocks now show derived levels from TradingView (not empty)
- [x] Updated OrderBook UI with full depth display, source badges (LIVE / S/R)
- [x] Price Spectrum shows solid bars for live, dashed for derived
- [x] MBP table shows source column for each level
- [x] All 14 order book tests passing
- [x] Updated version to v10.8.8
- [x] Deploy v10.8.8 to production — confirmed live on uae.market

## Phase 52 - Fix Live Price Accuracy Issue
- [x] Investigated: TradingView Scanner returns EOD data, not intraday live prices
- [x] DFM API returns real-time intraday data (confirmed EMAAR 12.10 vs TV 11.40)
- [x] Created applyDFMLiveOverlay() — merges DFM live prices with TV fundamentals/technicals
- [x] Created applyDFMOverlayToResults() — batch overlay for stock lists
- [x] Applied DFM overlay to: fetchAll, fetchOne, detail, topMovers, exportCSV, backgroundRefresh
- [x] DFM stocks: real-time prices from DFM API overlaid on TV fundamentals
- [x] ADX stocks: TV data only (no free public API for ADX intraday)
- [x] 6 DFM overlay tests passing
- [x] Updated version to v10.8.9
- [x] Deploy v10.8.9 to production — confirmed live, EMAAR now shows 12.15 matching DFM API 12.15

## Phase 52b - Fix Last Price Accuracy Issue
- [x] Investigated: live site was still on v10.8.8, DFM overlay was in v10.8.9
- [x] Deployed v10.8.9 to Northflank — prices now match DFM API
- [x] Confirmed EMAAR 12.15 on both DFM API and uae.market

## Phase 53 - Ticker Bar Improvements (v10.9.0)
- [x] Created formatStockPrice() — smart decimals: 3 when 3rd digit non-zero, else 2
- [x] Applied smart formatting to ticker bar TickerItem component
- [x] Updated Home.tsx fmt() to use smart decimal formatting
- [x] Updated StockDetail.tsx formatNumber() to use smart decimal formatting
- [x] Added stocks.dfmTicker endpoint — lightweight DFM polling every 5s
- [x] Ticker bar now uses DFM polling > WebSocket > snapshot priority for prices
- [x] Flash animations trigger on both DFM polling AND WebSocket price changes
- [x] 15 ticker tests passing (formatStockPrice + DFM ticker endpoint)
- [x] Updated version to v10.9.0
- [ ] Deploy v10.9.0 to production

## Phase 54 - Fix Order Book: Remove Fake S/R Levels, Add Volume/Value (v10.9.1)
- [x] Removed ALL derived S/R levels from buildOrderBook backend
- [x] DFM stocks: only real Level 1 bid/ask from DFM API (max 1 each)
- [x] ADX stocks: empty bids/asks (no public API)
- [x] Summary tab now shows Volume, Value, Trades, VWAP, Open, High, Low, Day Range, 52W High/Low, Prev Close
- [x] Price Spectrum shows only real L1 bars with BID/ASK labels
- [x] MBP table shows only real L1 row (no S/R rows)
- [x] Removed all S/R badges and legends
- [x] Fix applies to ALL symbols (DFM and ADX)
- [x] 13 order book tests passing
- [x] Updated version to v10.9.1
- [x] Deploy v10.9.1 to production — confirmed live on uae.market

## Phase 55 - Visitor Counter (v10.9.2)
- [x] Added site_stats and visitor_log tables to database schema
- [x] Created recordVisit() and getVisitorStats() db helpers (hashed IP+UA, UAE timezone)
- [x] Added visitors.record mutation and visitors.stats query endpoints
- [x] Added VisitorCounter component in footer: online now (green pulse), today visitors, total visitors
- [x] Auto-records visit on page load, refreshes stats every 30s
- [x] 4 visitor counter tests passing
- [x] Updated version to v10.9.2
- [x] Deploy v10.9.2 to production — confirmed live on uae.market

## Phase 56 - Geographic Visitor Breakdown & Page Analytics (v10.9.3)
- [x] Added city, region, countryCode columns to visitor_log table
- [x] Added page_views table for tracking stock page visits
- [x] Added IP geolocation via ip-api.com (resolves country/city/region)
- [x] Added recordPageView, getGeoBreakdown, getPageAnalytics, getRecentVisitors db helpers
- [x] Added admin-only tRPC endpoints: geoBreakdown, pageAnalytics, recentVisitors, recordPageView
- [x] Built Analytics admin dashboard page (/analytics) with:
  - [x] Overview stats (online now, today, total, page views)
  - [x] Daily traffic bar chart
  - [x] Visitors by country with flag emojis and progress bars
  - [x] Top cities breakdown
  - [x] Most viewed stocks (clickable to stock detail)
  - [x] Top pages breakdown
  - [x] Recent visitors table with location, date, pages, last active
- [x] Added page view tracking on route changes in TerminalLayout
- [x] Added 'Site Analytics' button on Admin page linking to /analytics
- [x] Fixed SQL orderBy alias issue in getPageAnalytics
- [x] 10 analytics tests passing
- [x] Updated version to v10.9.3
- [ ] Deploy v10.9.3 to production

## Full Dependency Upgrade (v10.10.0)

- [x] Upgrade security-critical: @aws-sdk, @trpc, pnpm
- [x] Upgrade high-value minor/patch: react, mysql2, zod, tailwind, jose, etc.
- [x] Upgrade major versions: express 5, recharts 3, vite 8, vitest 4, typescript 6, superjson 2
- [x] Fix breaking changes from major version upgrades
- [x] Run all tests after upgrade (470/474 pass, 4 pre-existing failures)
- [x] Build and deploy upgraded version v10.10.0
