/**
 * UAE Stock Market Status Utility
 * 
 * Market Hours (UAE/GST = UTC+4):
 * - Trading Days: Monday to Friday (excluding public holidays)
 * - Pre-Open:    9:30 AM - 10:00 AM  (order entry, no trading)
 * - Open:       10:00 AM -  2:45 PM  (continuous trading)
 * - Pre-Close:   2:45 PM -  3:00 PM  (closing auction)
 * - Closed:      3:00 PM -  9:30 AM  (next day)
 * - Weekend:     Saturday & Sunday (fully closed)
 * - Holidays:    UAE public holidays (Eid Al Fitr, Eid Al Adha, National Day, etc.)
 * 
 * Both ADX (Abu Dhabi Securities Exchange) and DFM (Dubai Financial Market)
 * follow approximately the same schedule.
 * ADX: Pre-Open 9:30-10:00, Trading 10:00-2:45, Pre-Close 2:45-2:55
 * DFM: Pre-Open 9:55-10:00, Trading 10:00-2:45, Pre-Close 2:45-2:53
 * We use the broader window (9:30 pre-open, 3:00 close) to cover both.
 */

import { getHoliday, isTradingDay, getNextTradingDay, type UAEHoliday } from "./uaeHolidays";

export type MarketPhase = "pre-open" | "open" | "pre-close" | "closed" | "holiday";

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
  holiday?: UAEHoliday;     // Present if today is a holiday
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

// Market schedule in minutes from midnight (UAE time)
const PRE_OPEN_START = 9 * 60 + 30;   // 9:30 AM = 570 minutes
const OPEN_START     = 10 * 60;        // 10:00 AM = 600 minutes
const PRE_CLOSE_START = 14 * 60 + 45;  // 2:45 PM = 885 minutes
const CLOSE_TIME     = 15 * 60;        // 3:00 PM = 900 minutes

/**
 * Get the current market status with full details, including holiday awareness
 */
export function getMarketStatus(now?: Date): MarketStatus {
  const { hour, minute, day, uae, utcNow } = getUAETime(now);
  const timeInMinutes = hour * 60 + minute;
  const uaeTimeStr = formatUAETime(uae);
  const uaeDayStr = DAY_NAMES[day];

  // Check for holiday first (takes priority over weekday checks)
  const holiday = getHoliday(utcNow);

  // Weekend: Saturday (6) and Sunday (0)
  if (day === 0 || day === 6) {
    const nextTrading = getNextTradingDay(utcNow);
    
    return {
      phase: "closed",
      label: "Market Closed",
      description: "Weekend — Markets reopen on the next trading day",
      isTrading: false,
      nextPhase: "pre-open",
      nextPhaseTime: nextTrading.toISOString(),
      nextPhaseLabel: `Pre-Open ${formatNextDayLabel(nextTrading)}`,
      uaeTimeStr,
      uaeDayStr,
    };
  }

  // Holiday on a weekday
  if (holiday) {
    const nextTrading = getNextTradingDay(utcNow);
    
    return {
      phase: "holiday",
      label: `Holiday — ${holiday.name}`,
      description: `Market closed for ${holiday.name}${holiday.nameAr ? ` (${holiday.nameAr})` : ""}`,
      isTrading: false,
      nextPhase: "pre-open",
      nextPhaseTime: nextTrading.toISOString(),
      nextPhaseLabel: `Pre-Open ${formatNextDayLabel(nextTrading)}`,
      uaeTimeStr,
      uaeDayStr,
      holiday,
    };
  }

  // Pre-Open: 9:30 AM - 10:00 AM (570 - 600 minutes)
  if (timeInMinutes >= PRE_OPEN_START && timeInMinutes < OPEN_START) {
    const openTime = new Date(uae);
    openTime.setUTCHours(10, 0, 0, 0);
    const nextPhaseUTC = new Date(openTime.getTime() - (4 * 60 * 60 * 1000));
    
    return {
      phase: "pre-open",
      label: "Pre-Open",
      description: "Pre-opening auction session — Market opens at 10:00 AM",
      isTrading: false,
      nextPhase: "open",
      nextPhaseTime: nextPhaseUTC.toISOString(),
      nextPhaseLabel: "Market Opens 10:00 AM",
      uaeTimeStr,
      uaeDayStr,
    };
  }

  // Open: 10:00 AM - 2:45 PM (600 - 885 minutes)
  if (timeInMinutes >= OPEN_START && timeInMinutes < PRE_CLOSE_START) {
    const preCloseTime = new Date(uae);
    preCloseTime.setUTCHours(14, 45, 0, 0);
    const nextPhaseUTC = new Date(preCloseTime.getTime() - (4 * 60 * 60 * 1000));
    
    return {
      phase: "open",
      label: "Market Open",
      description: "Continuous trading session",
      isTrading: true,
      nextPhase: "pre-close",
      nextPhaseTime: nextPhaseUTC.toISOString(),
      nextPhaseLabel: "Pre-Close 2:45 PM",
      uaeTimeStr,
      uaeDayStr,
    };
  }

  // Pre-Close: 2:45 PM - 3:00 PM (885 - 900 minutes)
  if (timeInMinutes >= PRE_CLOSE_START && timeInMinutes < CLOSE_TIME) {
    const closeTime = new Date(uae);
    closeTime.setUTCHours(15, 0, 0, 0);
    const nextPhaseUTC = new Date(closeTime.getTime() - (4 * 60 * 60 * 1000));
    
    return {
      phase: "pre-close",
      label: "Pre-Close",
      description: "Closing auction session — Market closes at 3:00 PM",
      isTrading: true,
      nextPhase: "closed",
      nextPhaseTime: nextPhaseUTC.toISOString(),
      nextPhaseLabel: "Market Closes 3:00 PM",
      uaeTimeStr,
      uaeDayStr,
    };
  }

  // Closed: Before 9:30 AM or after 3:00 PM on weekdays
  const nextTrading = timeInMinutes >= CLOSE_TIME
    ? getNextTradingDay(utcNow)
    : (() => {
        // Before 9:30 AM today - check if today is a trading day
        const todayOpen = new Date(uae);
        todayOpen.setUTCHours(9, 30, 0, 0);
        return new Date(todayOpen.getTime() - (4 * 60 * 60 * 1000));
      })();

  const isFriday = day === 5;
  const isAfterClose = timeInMinutes >= CLOSE_TIME;
  let desc = "Market is closed";
  if (isFriday && isAfterClose) {
    desc = "Weekend — Markets reopen on the next trading day";
  } else if (isAfterClose) {
    desc = "Market closed for the day — Reopens on the next trading day";
  } else {
    desc = "Market opens today at 9:30 AM (Pre-Open)";
  }

  return {
    phase: "closed",
    label: "Market Closed",
    description: desc,
    isTrading: false,
    nextPhase: "pre-open",
    nextPhaseTime: nextTrading.toISOString(),
    nextPhaseLabel: isAfterClose ? `Pre-Open ${formatNextDayLabel(nextTrading)}` : "Pre-Open 9:30 AM",
    uaeTimeStr,
    uaeDayStr,
  };
}

/**
 * Format a next-day label showing the day name
 */
function formatNextDayLabel(utcDate: Date): string {
  const uaeMs = utcDate.getTime() + (4 * 60 * 60 * 1000);
  const uae = new Date(uaeMs);
  const dayName = DAY_NAMES[uae.getUTCDay()];
  return `${dayName} 9:30 AM`;
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
