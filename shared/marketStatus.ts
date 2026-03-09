/**
 * UAE Stock Market Status Utility
 * 
 * Market Hours (UAE/GST = UTC+4):
 * - Trading Days: Monday to Friday
 * - Pre-Open:    9:00 AM - 9:30 AM
 * - Open:        9:30 AM - 2:50 PM
 * - Pre-Close:   2:50 PM - 3:00 PM
 * - Closed:      3:00 PM - 9:00 AM (next day)
 * - Weekend:     Saturday & Sunday (fully closed)
 * 
 * Both ADX (Abu Dhabi Securities Exchange) and DFM (Dubai Financial Market)
 * follow the same schedule.
 */

export type MarketPhase = "pre-open" | "open" | "pre-close" | "closed";

export interface MarketStatus {
  phase: MarketPhase;
  label: string;
  description: string;
  isTrading: boolean;       // true during open + pre-close
  nextPhase: MarketPhase;
  nextPhaseTime: string;    // ISO string
  nextPhaseLabel: string;
  uaeTimeStr: string;       // e.g. "10:35 AM"
  uaeDayStr: string;        // e.g. "Monday"
}

/**
 * Get current UAE time components
 */
function getUAETime(now?: Date) {
  const d = now || new Date();
  // Convert to UAE time (UTC+4)
  const uaeMs = d.getTime() + (4 * 60 * 60 * 1000);
  const uae = new Date(uaeMs);
  return {
    hour: uae.getUTCHours(),
    minute: uae.getUTCMinutes(),
    day: uae.getUTCDay(), // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    uae,
    utcNow: d,
  };
}

/**
 * Format UAE time as readable string
 */
function formatUAETime(uae: Date): string {
  const h = uae.getUTCHours();
  const m = uae.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Get the current market status with full details
 */
export function getMarketStatus(now?: Date): MarketStatus {
  const { hour, minute, day, uae, utcNow } = getUAETime(now);
  const timeInMinutes = hour * 60 + minute;
  const uaeTimeStr = formatUAETime(uae);
  const uaeDayStr = DAY_NAMES[day];

  // Weekend: Saturday (6) and Sunday (0)
  if (day === 0 || day === 6) {
    const nextMonday = new Date(uae);
    const daysUntilMonday = day === 6 ? 2 : 1;
    nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
    nextMonday.setUTCHours(9, 0, 0, 0);
    const nextPhaseUTC = new Date(nextMonday.getTime() - (4 * 60 * 60 * 1000));
    
    return {
      phase: "closed",
      label: "Market Closed",
      description: "Weekend - Markets reopen Monday at 9:00 AM",
      isTrading: false,
      nextPhase: "pre-open",
      nextPhaseTime: nextPhaseUTC.toISOString(),
      nextPhaseLabel: "Pre-Open Monday 9:00 AM",
      uaeTimeStr,
      uaeDayStr,
    };
  }

  // Pre-Open: 9:00 AM - 9:30 AM (540 - 570 minutes)
  if (timeInMinutes >= 540 && timeInMinutes < 570) {
    const openTime = new Date(uae);
    openTime.setUTCHours(9, 30, 0, 0);
    const nextPhaseUTC = new Date(openTime.getTime() - (4 * 60 * 60 * 1000));
    
    return {
      phase: "pre-open",
      label: "Pre-Open",
      description: "Pre-opening auction session - Market opens at 9:30 AM",
      isTrading: false,
      nextPhase: "open",
      nextPhaseTime: nextPhaseUTC.toISOString(),
      nextPhaseLabel: "Market Opens 9:30 AM",
      uaeTimeStr,
      uaeDayStr,
    };
  }

  // Open: 9:30 AM - 2:50 PM (570 - 890 minutes)
  if (timeInMinutes >= 570 && timeInMinutes < 890) {
    const preCloseTime = new Date(uae);
    preCloseTime.setUTCHours(14, 50, 0, 0);
    const nextPhaseUTC = new Date(preCloseTime.getTime() - (4 * 60 * 60 * 1000));
    
    return {
      phase: "open",
      label: "Market Open",
      description: "Continuous trading session",
      isTrading: true,
      nextPhase: "pre-close",
      nextPhaseTime: nextPhaseUTC.toISOString(),
      nextPhaseLabel: "Pre-Close 2:50 PM",
      uaeTimeStr,
      uaeDayStr,
    };
  }

  // Pre-Close: 2:50 PM - 3:00 PM (890 - 900 minutes)
  if (timeInMinutes >= 890 && timeInMinutes < 900) {
    const closeTime = new Date(uae);
    closeTime.setUTCHours(15, 0, 0, 0);
    const nextPhaseUTC = new Date(closeTime.getTime() - (4 * 60 * 60 * 1000));
    
    return {
      phase: "pre-close",
      label: "Pre-Close",
      description: "Closing auction session - Market closes at 3:00 PM",
      isTrading: true,
      nextPhase: "closed",
      nextPhaseTime: nextPhaseUTC.toISOString(),
      nextPhaseLabel: "Market Closes 3:00 PM",
      uaeTimeStr,
      uaeDayStr,
    };
  }

  // Closed: Before 9:00 AM or after 3:00 PM on weekdays
  const nextDay = new Date(uae);
  if (timeInMinutes >= 900) {
    // After 3 PM - next trading day
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    // Skip weekend
    while (nextDay.getUTCDay() === 0 || nextDay.getUTCDay() === 6) {
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    }
  }
  nextDay.setUTCHours(9, 0, 0, 0);
  const nextPhaseUTC = new Date(nextDay.getTime() - (4 * 60 * 60 * 1000));

  const isFriday = day === 5;
  const isAfterClose = timeInMinutes >= 900;
  let desc = "Market is closed";
  if (isFriday && isAfterClose) {
    desc = "Weekend - Markets reopen Monday at 9:00 AM";
  } else if (isAfterClose) {
    desc = "Market closed for the day - Reopens tomorrow at 9:00 AM";
  } else {
    desc = "Market opens today at 9:00 AM";
  }

  return {
    phase: "closed",
    label: "Market Closed",
    description: desc,
    isTrading: false,
    nextPhase: "pre-open",
    nextPhaseTime: nextPhaseUTC.toISOString(),
    nextPhaseLabel: `Pre-Open ${formatUAETime(nextDay)}`,
    uaeTimeStr,
    uaeDayStr,
  };
}

/**
 * Check if market is currently in trading hours (open or pre-close)
 */
export function isMarketOpen(now?: Date): boolean {
  return getMarketStatus(now).isTrading;
}

/**
 * Check if we should be actively polling (during pre-open, open, and pre-close)
 */
export function shouldPoll(now?: Date): boolean {
  const { phase } = getMarketStatus(now);
  return phase === "pre-open" || phase === "open" || phase === "pre-close";
}
