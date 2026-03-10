/**
 * useRealtimePrices - React hook for real-time price streaming via WebSocket
 *
 * Connects to the server's WebSocket at /ws/prices and subscribes to
 * specified stock symbols. Returns live price updates as they arrive
 * from TwelveData's real-time feed.
 *
 * Usage:
 *   const { prices, isConnected } = useRealtimePrices(["EMAAR", "DIB"], ["DFM", "DFM"]);
 *   // prices["EMAAR"] = { price: 8.50, dayVolume: 1234567, ... }
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

export interface RealtimePrice {
  symbol: string;
  appSymbol: string;
  exchange: string;
  price: number;
  dayVolume?: number;
  bid?: number;
  ask?: number;
  timestamp: number;
  currency?: string;
}

interface WSMessage {
  event: string;
  [key: string]: unknown;
}

export function useRealtimePrices(
  symbols: string[],
  exchanges: string[]
): {
  prices: Record<string, RealtimePrice>;
  isConnected: boolean;
  subscribedCount: number;
} {
  const [prices, setPrices] = useState<Record<string, RealtimePrice>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [subscribedCount, setSubscribedCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);

  // Stabilize the symbols/exchanges arrays
  const symbolsKey = useMemo(() => symbols.join(","), [symbols]);
  const exchangesKey = useMemo(() => exchanges.join(","), [exchanges]);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/prices`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectCountRef.current = 0;

        // Subscribe to symbols
        const syms = symbolsKey.split(",").filter(Boolean);
        const exs = exchangesKey.split(",").filter(Boolean);
        if (syms.length > 0) {
          ws.send(JSON.stringify({
            action: "subscribe",
            symbols: syms,
            exchanges: exs,
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);

          if (msg.event === "price") {
            const priceUpdate = msg as unknown as RealtimePrice;
            setPrices(prev => ({
              ...prev,
              [priceUpdate.appSymbol]: priceUpdate,
            }));
          } else if (msg.event === "status") {
            setSubscribedCount((msg as any).subscribedCount || 0);
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        // Reconnect with exponential backoff
        const delay = Math.min(2000 * Math.pow(1.5, Math.min(reconnectCountRef.current, 8)), 30000);
        reconnectCountRef.current++;
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onclose will fire after this
      };
    } catch {
      // Schedule reconnect
      const delay = 5000;
      reconnectTimerRef.current = setTimeout(connect, delay);
    }
  }, [symbolsKey, exchangesKey]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (symbolsKey) {
      connect();
    }

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, symbolsKey]);

  // Re-subscribe when symbols change while connected
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && symbolsKey) {
      const syms = symbolsKey.split(",").filter(Boolean);
      const exs = exchangesKey.split(",").filter(Boolean);
      wsRef.current.send(JSON.stringify({
        action: "subscribe",
        symbols: syms,
        exchanges: exs,
      }));
    }
  }, [symbolsKey, exchangesKey]);

  return { prices, isConnected, subscribedCount };
}

/**
 * Hook for a single stock's real-time price
 */
export function useRealtimePrice(
  symbol: string,
  exchange: string
): {
  price: RealtimePrice | null;
  isConnected: boolean;
} {
  const symbols = useMemo(() => [symbol], [symbol]);
  const exchanges = useMemo(() => [exchange], [exchange]);
  const { prices, isConnected } = useRealtimePrices(symbols, exchanges);

  return {
    price: prices[symbol] || null,
    isConnected,
  };
}
