# UAE Stock Screener - Project TODO

- [x] Database schema for stocks, stock data snapshots, watchlists
- [x] Backend API: stock list management (ADX 82 + DFM 59 stocks)
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
- [x] DFM stocks with full live data (59 stocks with real-time prices)
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
- [x] All 59 DFM stocks now reliably return price data
- [x] Fallback to direct Yahoo Finance with crumb auth if Data API fails

### Testing
- [x] Vitest tests updated: 36 tests passing across 4 test files
- [x] Trading hours tests corrected for UAE Sun-Thu schedule
- [x] Stock data validation tests
- [x] Router schema validation tests
