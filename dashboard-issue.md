# Dashboard Issue

The dashboard still shows 68 stocks (DFM only) because:
1. The dashboard uses fetchAll which checks DB cache first
2. DB has 68 DFM stocks from old Yahoo data
3. The 80% threshold check: 68 out of 170 = 40% - should trigger TV refresh
4. But the dashboard table shows "All Markets" tab with 68 stocks, and ADX (102) tab

The tabs show DFM (68) and ADX (102) which means the data IS there for the tabs.
The "All Markets" view shows 68 stocks - this is the default view showing DFM data.

Need to check: clicking ADX tab should show ADX stocks with data.
Also the STOCKS counter shows 68 - this is from the fetchAll response.

The issue is the fetchAll is returning old DFM cache because the DB has 68 rows.
The 80% check: 68 / 170 = 40% which is < 80%, so it should skip DB and go to TradingView.
But wait - the background refresh was triggered. Let me check if it populated.
