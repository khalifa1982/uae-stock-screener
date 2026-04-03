import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import { startVolumeMonitor } from "../volumeMonitor";
import { startMarketSummaryScheduler } from "../services/marketSummaryService";
import { startAbboudScanner } from "../services/abboudAlertScanner";
import { startCreditMonitor } from "../services/scrapflyCreditMonitor";
import { initWebSocketServer } from "../services/tdWebSocketService";
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
    const uptimeMs = Date.now() - startedAt;
    res.json({
      status: "ok",
      uptime: `${Math.floor(uptimeMs / 1000)}s`,
      version: "v10.10.3",
      timestamp: new Date().toISOString(),
    });
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

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

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
  });
}

startServer().catch(console.error);
