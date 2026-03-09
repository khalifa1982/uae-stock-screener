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
