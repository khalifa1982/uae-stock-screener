import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import { startVolumeMonitor } from "../volumeMonitor";
import { startMarketSummaryScheduler } from "../services/marketSummaryService";
import { startAbboudScanner } from "../services/abboudAlertScanner";
import { startCreditMonitor } from "../services/scrapflyCreditMonitor";
import { startNewsScheduler } from "../services/newsSchedulerService";
import { initWebSocketServer } from "../services/tdWebSocketService";
import { createHealthStatus } from "./health";

import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // ─── Health check endpoint (for Northflank zero-downtime deployments) ───
  const startedAt = Date.now();
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json(createHealthStatus(startedAt));
  });

  // ─── Scheduled Task Endpoint: SA Statistics Batch Scraper ─────────
  // Called by Manus scheduled task via CURL with session cookie
  app.post("/api/scheduled/sa-scrape", async (req: Request, res: Response) => {
    try {
      // Authenticate via session cookie (scheduled task gets auto-injected cookie)
      const { sdk: sdkInstance } = await import("./sdk");
      const user = await sdkInstance.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      // Allow user role (scheduled tasks get "user" role)
      const { fetchSAStatistics } = await import("../services/stockAnalysisService");
      const { upsertSAStatisticsCache } = await import("../db");
      const { ALL_STOCKS } = await import("../../shared/stockData");

      const batchSize = Number(req.body?.batchSize) || 10;
      const offset = Number(req.body?.offset) || 0;
      const stocks = ALL_STOCKS.slice(offset, offset + batchSize);
      let success = 0, failed = 0;

      for (const stock of stocks) {
        try {
          const data = await fetchSAStatistics(stock.symbol, stock.exchange);
          if (data) {
            await upsertSAStatisticsCache(stock.symbol, stock.exchange, data);
            success++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
        // Rate limit: 2s between requests
        await new Promise(r => setTimeout(r, 2000));
      }

      res.json({
        status: "ok",
        totalStocks: ALL_STOCKS.length,
        batchSize,
        offset,
        processed: stocks.length,
        success,
        failed,
        nextOffset: offset + batchSize < ALL_STOCKS.length ? offset + batchSize : null,
      });
    } catch (e: any) {
      console.error("[Scheduled SA Scrape] Error:", e?.message);
      res.status(500).json({ error: e?.message || "Internal error" });
    }
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // ─── Express 5 async error handler ────────────────────────────────
  // Express 5 natively catches rejected promises from async handlers.
  // This global error handler logs the error and returns a clean 500.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[Express] Unhandled error:", err.message, err.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "3000");

  // Initialize WebSocket server for real-time price streaming
  initWebSocketServer(server);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Start the volume spike monitor
    startVolumeMonitor();
    // Start the market summary scheduler
    startMarketSummaryScheduler();
    // Start the Abboud AI alert scanner
    startAbboudScanner();
    // Start Scrapfly credit monitor (checks every 6h, alerts when low)
    startCreditMonitor();
    // Start the market news scheduler (fetches news for all stocks)
    startNewsScheduler();
    // Trigger initial data fetch to populate memory cache + logo cache (non-blocking)
    // This ensures logos are available from the first request
    import('../routers').then(({ prefetchLogosOnStartup }) => {
      prefetchLogosOnStartup().catch((e: unknown) => console.warn('[Startup] Logo prefetch failed:', e));
    }).catch(() => {});
  });
}

startServer().catch(console.error);
