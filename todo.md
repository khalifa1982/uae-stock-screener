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
