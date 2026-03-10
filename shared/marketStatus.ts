/**
 * UAE Stock Market Status Utility
 * 
 * Market Hours (UAE/GST = UTC+4):
 * - Trading Days: Monday to Friday (excluding public holidays)
 * - Pre-Open:    9:00 AM - 9:30 AM
 * - Open:        9:30 AM - 2:50 PM
 * - Pre-Close:   2:50 PM - 3:00 PM
 * - Closed:      3:00 PM - 9:00 AM (next day)
 * - Weekend:     Saturday & Sunday (fully closed)
 * - Holidays:    UAE public holidays (Eid Al Fitr, Eid Al Adha, National Day, etc.)
 * 
 * Both ADX (Abu Dhabi Securities Exchange) and DFM (Dubai Financial Market)
 * follow the same schedule.
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

  // Pre-Open: 9:00 AM - 9:30 AM (540 - 570 minutes)
  if (timeInMinutes >= 540 && timeInMinutes < 570) {
    const openTime = new Date(uae);
    openTime.setUTCHours(9, 30, 0, 0);
    const nextPhaseUTC = new Date(openTime.getTime() - (4 * 60 * 60 * 1000));
    
    return {
      phase: "pre-open",
      label: "Pre-Open",
      description: "Pre-opening auction session — Market opens at 9:30 AM",
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
      description: "Closing auction session — Market closes at 3:00 PM",
      isTrading: true,
      nextPhase: "closed",
      nextPhaseTime: nextPhaseUTC.toISOString(),
      nextPhaseLabel: "Market Closes 3:00 PM",
      uaeTimeStr,
      uaeDayStr,
    };
  }

  // Closed: Before 9:00 AM or after 3:00 PM on weekdays
  const nextTrading = timeInMinutes >= 900
    ? getNextTradingDay(utcNow)
    : (() => {
        // Before 9 AM today - check if today is a trading day
        const todayOpen = new Date(uae);
        todayOpen.setUTCHours(9, 0, 0, 0);
        return new Date(todayOpen.getTime() - (4 * 60 * 60 * 1000));
      })();

  const isFriday = day === 5;
  const isAfterClose = timeInMinutes >= 900;
  let desc = "Market is closed";
  if (isFriday && isAfterClose) {
    desc = "Weekend — Markets reopen on the next trading day";
  } else if (isAfterClose) {
    desc = "Market closed for the day — Reopens on the next trading day";
  } else {
    desc = "Market opens today at 9:00 AM";
  }

  return {
    phase: "closed",
    label: "Market Closed",
    description: desc,
    isTrading: false,
    nextPhase: "pre-open",
    nextPhaseTime: nextTrading.toISOString(),
    nextPhaseLabel: isAfterClose ? `Pre-Open ${formatNextDayLabel(nextTrading)}` : "Pre-Open 9:00 AM",
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
  return `${dayName} 9:00 AM`;
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
