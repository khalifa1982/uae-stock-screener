# Debug Notes - Screener Data Issue

## Current State (after TradingView integration)
- Screener shows 170 stocks total
- DFM stocks (68): ALL have data (price, P/E, RSI, volume, market cap) ✅
- ADX stocks (102): ALL show empty dashes (—) ❌

## Root Cause
The screener uses the `screen` procedure which reads from DB first.
The DB has old DFM data from Yahoo Finance but NO ADX data.
The TradingView fallback in `screen` only triggers when DB returns 0 rows.
Since DB has 68 DFM rows, it returns those and never triggers TV fallback.

## Fix Needed
1. Force a data refresh that populates ALL stocks (both ADX and DFM) from TradingView
2. The `fetchAll` with `forceRefresh: true` should do this
3. Or we need to update the `screen` procedure to check if ADX stocks are missing
4. Better approach: Clear old DB data and let the system repopulate from TradingView

## Quick Fix
Call the fetchAll endpoint with forceRefresh=true to populate DB with TV data for ALL stocks.
Then the screen procedure will find them in DB.
