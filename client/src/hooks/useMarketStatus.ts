import { useState, useEffect } from "react";
import { getMarketStatus, type MarketStatus } from "../../../shared/marketStatus";

/**
 * Hook that provides live market status, updating every second.
 * Also provides a countdown to the next market phase.
 * Holiday-aware: detects UAE public holidays and shows appropriate status.
 */
export function useMarketStatus() {
  const [status, setStatus] = useState<MarketStatus>(() => getMarketStatus());
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const update = () => {
      const s = getMarketStatus();
      setStatus(s);

      // Calculate countdown to next phase
      const diff = new Date(s.nextPhaseTime).getTime() - Date.now();
      if (diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        if (hours > 0) {
          setCountdown(`${hours}h ${mins}m`);
        } else if (mins > 0) {
          setCountdown(`${mins}m ${secs}s`);
        } else {
          setCountdown(`${secs}s`);
        }
      } else {
        setCountdown("");
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return { ...status, countdown };
}

/**
 * Hook that returns the appropriate refetch interval based on market status.
 * - During market hours (open/pre-close): 30 seconds
 * - During pre-open: 60 seconds
 * - When closed or holiday: disabled (false)
 * 
 * This ensures no unnecessary API calls outside of trading hours,
 * including weekends and UAE public holidays.
 */
export function useAutoRefreshInterval(): number | false {
  const [interval, setInterval_] = useState<number | false>(false);

  useEffect(() => {
    const update = () => {
      const s = getMarketStatus();
      if (s.phase === "open" || s.phase === "pre-close") {
        setInterval_(30 * 1000); // 30 seconds during trading
      } else if (s.phase === "pre-open") {
        setInterval_(60 * 1000); // 60 seconds during pre-open
      } else {
        // Closed, holiday, or weekend - no auto-refresh
        setInterval_(false);
      }
    };

    update();
    // Check every minute if market status changed
    const timer = window.setInterval(update, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  return interval;
}
