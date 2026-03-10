/**
 * TwelveData WebSocket Service
 * Connects to TwelveData's Distributed WebSocket System (TDDWS)
 * for real-time price streaming of UAE stocks.
 *
 * Architecture:
 * - Server maintains ONE persistent connection to TwelveData WS
 * - Subscribes to UAE stocks that clients are interested in
 * - Broadcasts price updates to all connected browser clients via our own WS server
 * - Handles reconnection, heartbeat, and subscription management
 */

import WebSocket, { WebSocketServer } from "ws";
import type { Server as HTTPServer } from "http";
import type { IncomingMessage } from "http";
import { toTwelveDataSymbol } from "./tdSymbolMapper";

const TD_API_KEY = process.env.TWELVEDATA_API_KEY || "";
const TD_WS_URL = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${TD_API_KEY}`;

// ─── Types ─────────────────────────────────────────────────────────

export interface PriceUpdate {
  event: "price";
  symbol: string;        // TwelveData symbol
  appSymbol: string;     // Our app symbol (TradingView format)
  exchange: string;
  price: number;
  dayVolume?: number;
  bid?: number;
  ask?: number;
  timestamp: number;
  currency?: string;
}

interface TDPriceEvent {
  event: "price";
  symbol: string;
  currency?: string;
  exchange?: string;
  type?: string;
  timestamp: number;
  price: number;
  day_volume?: number;
  bid?: number;
  ask?: number;
}

interface TDSubscribeStatus {
  event: "subscribe-status";
  status: string;
  success: Array<{ symbol: string; exchange: string; country: string; type: string }>;
  fails: Array<{ symbol: string; msg?: string }>;
}

interface ClientSubscription {
  ws: WebSocket;
  symbols: Set<string>; // App symbols this client wants
}

// ─── State ─────────────────────────────────────────────────────────

let tdSocket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let wss: WebSocketServer | null = null;

// Map: TwelveData symbol → app symbol (for reverse mapping)
const tdToAppSymbol = new Map<string, string>();
// Map: TwelveData symbol → exchange
const tdToExchange = new Map<string, string>();
// Currently subscribed TwelveData symbols
const subscribedSymbols = new Set<string>();
// Connected browser clients
const clients = new Map<WebSocket, ClientSubscription>();
// Latest prices cache (app symbol → PriceUpdate)
const latestPrices = new Map<string, PriceUpdate>();
// Connection stats
let stats = {
  connected: false,
  lastMessageAt: 0,
  messagesReceived: 0,
  clientCount: 0,
  subscribedCount: 0,
  reconnects: 0,
  errors: 0,
};

// ─── TwelveData Connection ─────────────────────────────────────────

function connectToTwelveData(): void {
  if (tdSocket && (tdSocket.readyState === WebSocket.OPEN || tdSocket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  if (!TD_API_KEY) {
    console.warn("[WS] No TWELVEDATA_API_KEY set, WebSocket disabled");
    return;
  }

  console.log("[WS] Connecting to TwelveData WebSocket...");

  try {
    tdSocket = new WebSocket(TD_WS_URL);

    tdSocket.on("open", () => {
      console.log("[WS] Connected to TwelveData WebSocket");
      stats.connected = true;

      // Re-subscribe to all symbols that clients want
      resubscribeAll();

      // Start heartbeat
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        if (tdSocket && tdSocket.readyState === WebSocket.OPEN) {
          tdSocket.ping();
        }
      }, 30000);
    });

    tdSocket.on("message", (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleTDMessage(msg);
      } catch (e) {
        // Ignore parse errors
      }
    });

    tdSocket.on("close", (code: number, reason: Buffer) => {
      console.log(`[WS] TwelveData connection closed: ${code} ${reason.toString()}`);
      stats.connected = false;
      cleanup();
      scheduleReconnect();
    });

    tdSocket.on("error", (err: Error) => {
      console.warn("[WS] TwelveData WebSocket error:", err.message);
      stats.errors++;
      stats.connected = false;
    });

    tdSocket.on("pong", () => {
      // Connection is alive
    });
  } catch (err: any) {
    console.warn("[WS] Failed to create TwelveData WebSocket:", err.message);
    stats.errors++;
    scheduleReconnect();
  }
}

function cleanup(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  subscribedSymbols.clear();
  stats.subscribedCount = 0;
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  const delay = Math.min(5000 * Math.pow(1.5, Math.min(stats.reconnects, 10)), 60000);
  console.log(`[WS] Reconnecting in ${Math.round(delay / 1000)}s...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    stats.reconnects++;
    connectToTwelveData();
  }, delay);
}

function handleTDMessage(msg: any): void {
  stats.lastMessageAt = Date.now();
  stats.messagesReceived++;

  if (msg.event === "price") {
    handlePriceEvent(msg as TDPriceEvent);
  } else if (msg.event === "subscribe-status") {
    handleSubscribeStatus(msg as TDSubscribeStatus);
  } else if (msg.event === "heartbeat") {
    // TwelveData heartbeat, ignore
  }
}

function handlePriceEvent(ev: TDPriceEvent): void {
  const appSymbol = tdToAppSymbol.get(ev.symbol) || ev.symbol;
  const exchange = tdToExchange.get(ev.symbol) || ev.exchange || "";

  const update: PriceUpdate = {
    event: "price",
    symbol: ev.symbol,
    appSymbol,
    exchange,
    price: ev.price,
    dayVolume: ev.day_volume,
    bid: ev.bid,
    ask: ev.ask,
    timestamp: ev.timestamp,
    currency: ev.currency,
  };

  // Cache latest price
  latestPrices.set(appSymbol, update);

  // Broadcast to interested clients
  broadcastToClients(update);
}

function handleSubscribeStatus(msg: TDSubscribeStatus): void {
  if (msg.success && msg.success.length > 0) {
    console.log(`[WS] Subscribed to ${msg.success.length} symbols:`, msg.success.map(s => s.symbol).join(", "));
    for (const s of msg.success) {
      subscribedSymbols.add(s.symbol);
    }
    stats.subscribedCount = subscribedSymbols.size;
  }
  if (msg.fails && msg.fails.length > 0) {
    console.warn(`[WS] Failed to subscribe to ${msg.fails.length} symbols:`, msg.fails.map(s => `${s.symbol}: ${s.msg || "unknown"}`).join(", "));
  }
}

// ─── Subscription Management ───────────────────────────────────────

function getDesiredSymbols(): Map<string, { tdSymbol: string; exchange: string }> {
  const desired = new Map<string, { tdSymbol: string; exchange: string }>();

  for (const [, client] of Array.from(clients.entries())) {
    for (const appSymbol of Array.from(client.symbols)) {
      if (!desired.has(appSymbol)) {
        const exchange = guessExchange(appSymbol);
        if (exchange) {
          const info = toTwelveDataSymbol(appSymbol, exchange);
          if (info) {
            desired.set(appSymbol, { tdSymbol: info.tdSymbol, exchange });
            tdToAppSymbol.set(info.tdSymbol, appSymbol);
            tdToExchange.set(info.tdSymbol, exchange);
          }
        }
      }
    }
  }

  return desired;
}

function guessExchange(appSymbol: string): "ADX" | "DFM" | null {
  // Import stock data to determine exchange
  try {
    // We'll use a simple heuristic - check both exchanges
    const adxInfo = toTwelveDataSymbol(appSymbol, "ADX");
    const dfmInfo = toTwelveDataSymbol(appSymbol, "DFM");

    // Check if the symbol is in our known stock lists
    // For now, try DFM first (more common for popular stocks)
    // The client should send exchange info when subscribing
    return "DFM"; // Default fallback
  } catch {
    return null;
  }
}

function resubscribeAll(): void {
  const desired = getDesiredSymbols();
  if (desired.size === 0) return;

  const symbolsToSubscribe: Array<{ symbol: string; exchange: string }> = [];

  for (const [, info] of Array.from(desired.entries())) {
    if (!subscribedSymbols.has(info.tdSymbol)) {
      symbolsToSubscribe.push({ symbol: info.tdSymbol, exchange: info.exchange });
    }
  }

  if (symbolsToSubscribe.length > 0 && tdSocket && tdSocket.readyState === WebSocket.OPEN) {
    // Use extended format for UAE stocks to specify exchange
    tdSocket.send(JSON.stringify({
      action: "subscribe",
      params: {
        symbols: symbolsToSubscribe,
      },
    }));
    console.log(`[WS] Subscribing to ${symbolsToSubscribe.length} symbols`);
  }
}

function subscribeSymbols(appSymbols: string[], exchanges: string[]): void {
  if (!tdSocket || tdSocket.readyState !== WebSocket.OPEN) return;

  const symbolsToSubscribe: Array<{ symbol: string; exchange: string }> = [];

  for (let i = 0; i < appSymbols.length; i++) {
    const appSymbol = appSymbols[i];
    const exchange = (exchanges[i] || "DFM") as "ADX" | "DFM";
    const info = toTwelveDataSymbol(appSymbol, exchange);

    if (info && !subscribedSymbols.has(info.tdSymbol)) {
      tdToAppSymbol.set(info.tdSymbol, appSymbol);
      tdToExchange.set(info.tdSymbol, exchange);
      symbolsToSubscribe.push({ symbol: info.tdSymbol, exchange });
    }
  }

  if (symbolsToSubscribe.length > 0) {
    tdSocket.send(JSON.stringify({
      action: "subscribe",
      params: {
        symbols: symbolsToSubscribe,
      },
    }));
  }
}

function unsubscribeSymbols(tdSymbols: string[]): void {
  if (!tdSocket || tdSocket.readyState !== WebSocket.OPEN) return;
  if (tdSymbols.length === 0) return;

  tdSocket.send(JSON.stringify({
    action: "unsubscribe",
    params: {
      symbols: tdSymbols.join(","),
    },
  }));

  for (const s of tdSymbols) {
    subscribedSymbols.delete(s);
  }
  stats.subscribedCount = subscribedSymbols.size;
}

// ─── Client Broadcasting ───────────────────────────────────────────

function broadcastToClients(update: PriceUpdate): void {
  const msg = JSON.stringify(update);

  for (const [clientWs, client] of Array.from(clients.entries())) {
    if (clientWs.readyState === WebSocket.OPEN && client.symbols.has(update.appSymbol)) {
      try {
        clientWs.send(msg);
      } catch {
        // Client disconnected
      }
    }
  }
}

// ─── Browser Client WebSocket Server ───────────────────────────────

export function initWebSocketServer(server: HTTPServer): void {
  wss = new WebSocketServer({
    server,
    path: "/ws/prices",
  });

  console.log("[WS] WebSocket server initialized on /ws/prices");

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const clientSub: ClientSubscription = {
      ws,
      symbols: new Set(),
    };
    clients.set(ws, clientSub);
    stats.clientCount = clients.size;

    console.log(`[WS] Client connected (total: ${clients.size})`);

    // Send current connection status
    ws.send(JSON.stringify({
      event: "status",
      connected: stats.connected,
      subscribedCount: stats.subscribedCount,
    }));

    ws.on("message", (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleClientMessage(ws, clientSub, msg);
      } catch {
        // Ignore parse errors
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      stats.clientCount = clients.size;
      console.log(`[WS] Client disconnected (total: ${clients.size})`);

      // Clean up subscriptions if no clients want certain symbols
      cleanupUnusedSubscriptions();
    });

    ws.on("error", () => {
      clients.delete(ws);
      stats.clientCount = clients.size;
    });
  });

  // Connect to TwelveData
  connectToTwelveData();
}

function handleClientMessage(ws: WebSocket, client: ClientSubscription, msg: any): void {
  switch (msg.action) {
    case "subscribe": {
      const symbols: string[] = msg.symbols || [];
      const exchanges: string[] = msg.exchanges || [];

      for (const s of symbols) {
        client.symbols.add(s);
      }

      // Send cached prices immediately
      for (const s of symbols) {
        const cached = latestPrices.get(s);
        if (cached) {
          try {
            ws.send(JSON.stringify(cached));
          } catch {
            // ignore
          }
        }
      }

      // Subscribe to TwelveData if needed
      subscribeSymbols(symbols, exchanges);
      break;
    }

    case "unsubscribe": {
      const symbols: string[] = msg.symbols || [];
      for (const s of symbols) {
        client.symbols.delete(s);
      }
      cleanupUnusedSubscriptions();
      break;
    }

    case "get_status": {
      ws.send(JSON.stringify({
        event: "status",
        connected: stats.connected,
        subscribedCount: stats.subscribedCount,
        clientCount: stats.clientCount,
        messagesReceived: stats.messagesReceived,
        lastMessageAt: stats.lastMessageAt,
      }));
      break;
    }

    case "get_cached": {
      // Send all cached prices for requested symbols
      const symbols: string[] = msg.symbols || [];
      for (const s of symbols) {
        const cached = latestPrices.get(s);
        if (cached) {
          try {
            ws.send(JSON.stringify(cached));
          } catch {
            // ignore
          }
        }
      }
      break;
    }
  }
}

function cleanupUnusedSubscriptions(): void {
  // Find symbols that no client wants anymore
  const wantedAppSymbols = new Set<string>();
  for (const [, client] of Array.from(clients.entries())) {
    for (const s of Array.from(client.symbols)) {
      wantedAppSymbols.add(s);
    }
  }

  const toUnsubscribe: string[] = [];
  for (const [tdSymbol, appSymbol] of Array.from(tdToAppSymbol.entries())) {
    if (!wantedAppSymbols.has(appSymbol)) {
      toUnsubscribe.push(tdSymbol);
      tdToAppSymbol.delete(tdSymbol);
      tdToExchange.delete(tdSymbol);
    }
  }

  if (toUnsubscribe.length > 0) {
    unsubscribeSymbols(toUnsubscribe);
  }
}

// ─── Public API ────────────────────────────────────────────────────

export function getWSStats() {
  return {
    ...stats,
    cachedPrices: latestPrices.size,
    uptime: stats.lastMessageAt > 0 ? Date.now() - stats.lastMessageAt : 0,
  };
}

export function getLatestPrice(appSymbol: string): PriceUpdate | null {
  return latestPrices.get(appSymbol) || null;
}

export function getAllLatestPrices(): Map<string, PriceUpdate> {
  return latestPrices;
}
