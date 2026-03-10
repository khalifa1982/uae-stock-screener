/**
 * usePriceFlash - Tracks price changes across refetches and returns flash state
 * 
 * When a stock's price changes between refetches, it returns a flash direction
 * ("up" or "down") that triggers the CSS flash animation on the table row.
 * The flash auto-clears after 1 second.
 */

import { useRef, useState, useEffect, useCallback } from "react";

type FlashMap = Record<string, "up" | "down" | null>;
type PriceMap = Record<string, number>;

interface StockLike {
  symbol: string;
  exchange: string;
  price: number | null;
  changePercent?: number | null;
}

/**
 * Track price changes for a list of stocks and return flash states
 */
export function usePriceFlashes(stocks: StockLike[] | undefined): FlashMap {
  const prevPrices = useRef<PriceMap>({});
  const [flashes, setFlashes] = useState<FlashMap>({});
  const timeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!stocks) return;

    const newFlashes: FlashMap = {};
    let hasChanges = false;

    for (const stock of stocks) {
      const key = `${stock.exchange}-${stock.symbol}`;
      const currentPrice = stock.price;
      const prevPrice = prevPrices.current[key];

      if (currentPrice != null && prevPrice != null && currentPrice !== prevPrice) {
        const direction = currentPrice > prevPrice ? "up" : "down";
        newFlashes[key] = direction;
        hasChanges = true;

        // Clear previous timeout for this key
        if (timeouts.current[key]) {
          clearTimeout(timeouts.current[key]);
        }

        // Auto-clear flash after 1s
        timeouts.current[key] = setTimeout(() => {
          setFlashes(prev => ({ ...prev, [key]: null }));
        }, 1000);
      }

      if (currentPrice != null) {
        prevPrices.current[key] = currentPrice;
      }
    }

    if (hasChanges) {
      setFlashes(prev => ({ ...prev, ...newFlashes }));
    }
  }, [stocks]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(timeouts.current).forEach(clearTimeout);
    };
  }, []);

  return flashes;
}

/**
 * Get the flash CSS class for a specific stock
 */
export function getFlashClass(flashes: FlashMap, exchange: string, symbol: string): string {
  const key = `${exchange}-${symbol}`;
  const flash = flashes[key];
  if (flash === "up") return "flash-row-up";
  if (flash === "down") return "flash-row-down";
  return "";
}

/**
 * Get the flash CSS class for a price cell
 */
export function getPriceFlashClass(flashes: FlashMap, exchange: string, symbol: string): string {
  const key = `${exchange}-${symbol}`;
  const flash = flashes[key];
  if (flash === "up") return "flash-price-up";
  if (flash === "down") return "flash-price-down";
  return "";
}
