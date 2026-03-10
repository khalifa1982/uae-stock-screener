/**
 * UAE Stock Market Holidays Calendar
 * 
 * Covers ADX (Abu Dhabi Securities Exchange) and DFM (Dubai Financial Market)
 * holidays for 2025-2027. Islamic holidays are approximate and may shift
 * by 1-2 days based on moon sighting.
 * 
 * Sources:
 * - DFM official holiday calendar (dfm.ae)
 * - ADX official holiday calendar (adx.ae)
 * - TradingHours.com verified data
 * - UAE Government official public holidays (u.ae)
 */

export interface UAEHoliday {
  date: string;       // YYYY-MM-DD format
  name: string;       // Holiday name in English
  nameAr?: string;    // Holiday name in Arabic
  type: "fixed" | "islamic";  // Fixed = same date every year, Islamic = lunar calendar
}

/**
 * UAE market holidays for 2025
 * Based on official DFM/ADX announcements
 */
const HOLIDAYS_2025: UAEHoliday[] = [
  { date: "2025-01-01", name: "New Year's Day", nameAr: "رأس السنة الميلادية", type: "fixed" },
  { date: "2025-03-28", name: "Eid Al Fitr", nameAr: "عيد الفطر", type: "islamic" },
  { date: "2025-03-29", name: "Eid Al Fitr", nameAr: "عيد الفطر", type: "islamic" },
  { date: "2025-03-30", name: "Eid Al Fitr", nameAr: "عيد الفطر", type: "islamic" },
  { date: "2025-03-31", name: "Eid Al Fitr", nameAr: "عيد الفطر", type: "islamic" },
  { date: "2025-06-05", name: "Arafat Day", nameAr: "يوم عرفة", type: "islamic" },
  { date: "2025-06-06", name: "Eid Al Adha", nameAr: "عيد الأضحى", type: "islamic" },
  { date: "2025-06-07", name: "Eid Al Adha", nameAr: "عيد الأضحى", type: "islamic" },
  { date: "2025-06-08", name: "Eid Al Adha", nameAr: "عيد الأضحى", type: "islamic" },
  { date: "2025-06-26", name: "Islamic New Year", nameAr: "رأس السنة الهجرية", type: "islamic" },
  { date: "2025-09-05", name: "Prophet Muhammad's Birthday", nameAr: "المولد النبوي الشريف", type: "islamic" },
  { date: "2025-11-30", name: "Commemoration Day", nameAr: "يوم الشهيد", type: "fixed" },
  { date: "2025-12-01", name: "UAE National Day", nameAr: "اليوم الوطني", type: "fixed" },
  { date: "2025-12-02", name: "UAE National Day", nameAr: "اليوم الوطني", type: "fixed" },
];

/**
 * UAE market holidays for 2026
 * Based on DFM official circular and TradingHours.com verified data
 */
const HOLIDAYS_2026: UAEHoliday[] = [
  { date: "2026-01-01", name: "New Year's Day", nameAr: "رأس السنة الميلادية", type: "fixed" },
  { date: "2026-02-18", name: "Isra and Mi'raj", nameAr: "الإسراء والمعراج", type: "islamic" },
  { date: "2026-03-02", name: "Ramadan Holiday", nameAr: "عطلة رمضان", type: "islamic" },
  { date: "2026-03-03", name: "Ramadan Holiday", nameAr: "عطلة رمضان", type: "islamic" },
  { date: "2026-03-19", name: "Eid Al Fitr", nameAr: "عيد الفطر", type: "islamic" },
  { date: "2026-03-20", name: "Eid Al Fitr", nameAr: "عيد الفطر", type: "islamic" },
  { date: "2026-03-21", name: "Eid Al Fitr", nameAr: "عيد الفطر", type: "islamic" },
  { date: "2026-03-22", name: "Eid Al Fitr", nameAr: "عيد الفطر", type: "islamic" },
  { date: "2026-05-26", name: "Arafat Day", nameAr: "يوم عرفة", type: "islamic" },
  { date: "2026-05-27", name: "Eid Al Adha", nameAr: "عيد الأضحى", type: "islamic" },
  { date: "2026-05-28", name: "Eid Al Adha", nameAr: "عيد الأضحى", type: "islamic" },
  { date: "2026-05-29", name: "Eid Al Adha", nameAr: "عيد الأضحى", type: "islamic" },
  { date: "2026-06-16", name: "Islamic New Year", nameAr: "رأس السنة الهجرية", type: "islamic" },
  { date: "2026-08-25", name: "Prophet Muhammad's Birthday", nameAr: "المولد النبوي الشريف", type: "islamic" },
  { date: "2026-12-01", name: "Commemoration Day", nameAr: "يوم الشهيد", type: "fixed" },
  { date: "2026-12-02", name: "UAE National Day", nameAr: "اليوم الوطني", type: "fixed" },
  { date: "2026-12-03", name: "UAE National Day", nameAr: "اليوم الوطني", type: "fixed" },
];

/**
 * UAE market holidays for 2027 (estimated - Islamic dates shift ~10 days earlier each year)
 */
const HOLIDAYS_2027: UAEHoliday[] = [
  { date: "2027-01-01", name: "New Year's Day", nameAr: "رأس السنة الميلادية", type: "fixed" },
  { date: "2027-02-08", name: "Isra and Mi'raj", nameAr: "الإسراء والمعراج", type: "islamic" },
  { date: "2027-03-08", name: "Eid Al Fitr", nameAr: "عيد الفطر", type: "islamic" },
  { date: "2027-03-09", name: "Eid Al Fitr", nameAr: "عيد الفطر", type: "islamic" },
  { date: "2027-03-10", name: "Eid Al Fitr", nameAr: "عيد الفطر", type: "islamic" },
  { date: "2027-03-11", name: "Eid Al Fitr", nameAr: "عيد الفطر", type: "islamic" },
  { date: "2027-05-16", name: "Arafat Day", nameAr: "يوم عرفة", type: "islamic" },
  { date: "2027-05-17", name: "Eid Al Adha", nameAr: "عيد الأضحى", type: "islamic" },
  { date: "2027-05-18", name: "Eid Al Adha", nameAr: "عيد الأضحى", type: "islamic" },
  { date: "2027-05-19", name: "Eid Al Adha", nameAr: "عيد الأضحى", type: "islamic" },
  { date: "2027-06-06", name: "Islamic New Year", nameAr: "رأس السنة الهجرية", type: "islamic" },
  { date: "2027-08-15", name: "Prophet Muhammad's Birthday", nameAr: "المولد النبوي الشريف", type: "islamic" },
  { date: "2027-11-30", name: "Commemoration Day", nameAr: "يوم الشهيد", type: "fixed" },
  { date: "2027-12-01", name: "UAE National Day", nameAr: "اليوم الوطني", type: "fixed" },
  { date: "2027-12-02", name: "UAE National Day", nameAr: "اليوم الوطني", type: "fixed" },
];

/**
 * Combined holiday map indexed by date string (YYYY-MM-DD)
 */
const ALL_HOLIDAYS: Map<string, UAEHoliday> = new Map();

for (const h of [...HOLIDAYS_2025, ...HOLIDAYS_2026, ...HOLIDAYS_2027]) {
  ALL_HOLIDAYS.set(h.date, h);
}

/**
 * Check if a given date is a UAE market holiday
 * @param date - Date object or YYYY-MM-DD string
 * @returns The holiday info if it's a holiday, null otherwise
 */
export function getHoliday(date: Date | string): UAEHoliday | null {
  let dateStr: string;
  if (typeof date === "string") {
    dateStr = date;
  } else {
    // Convert to UAE time first (UTC+4)
    const uaeMs = date.getTime() + (4 * 60 * 60 * 1000);
    const uae = new Date(uaeMs);
    dateStr = `${uae.getUTCFullYear()}-${String(uae.getUTCMonth() + 1).padStart(2, "0")}-${String(uae.getUTCDate()).padStart(2, "0")}`;
  }
  return ALL_HOLIDAYS.get(dateStr) || null;
}

/**
 * Check if a given date is a UAE market holiday
 */
export function isHoliday(date: Date | string): boolean {
  return getHoliday(date) !== null;
}

/**
 * Check if a given date is a trading day (not weekend and not holiday)
 */
export function isTradingDay(date: Date | string): boolean {
  if (typeof date === "string") {
    const d = new Date(date + "T12:00:00Z");
    const day = d.getUTCDay();
    if (day === 0 || day === 6) return false;
    return !isHoliday(date);
  }
  
  // Convert to UAE time
  const uaeMs = date.getTime() + (4 * 60 * 60 * 1000);
  const uae = new Date(uaeMs);
  const day = uae.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !isHoliday(date);
}

/**
 * Get the next trading day from a given date
 */
export function getNextTradingDay(from: Date): Date {
  const uaeOffset = 4 * 60 * 60 * 1000;
  const uaeNow = new Date(from.getTime() + uaeOffset);
  
  let next = new Date(uaeNow);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(9, 0, 0, 0);
  
  // Skip weekends and holidays
  let safety = 0;
  while (!isTradingDay(formatDateStr(next)) && safety < 30) {
    next.setUTCDate(next.getUTCDate() + 1);
    safety++;
  }
  
  // Convert back to UTC
  return new Date(next.getTime() - uaeOffset);
}

/**
 * Get all holidays for a given year
 */
export function getHolidaysForYear(year: number): UAEHoliday[] {
  const yearStr = String(year);
  return Array.from(ALL_HOLIDAYS.values()).filter(h => h.date.startsWith(yearStr));
}

/**
 * Get upcoming holidays from today
 */
export function getUpcomingHolidays(count = 5): UAEHoliday[] {
  const now = new Date();
  const uaeMs = now.getTime() + (4 * 60 * 60 * 1000);
  const uae = new Date(uaeMs);
  const todayStr = formatDateStr(uae);
  
  return Array.from(ALL_HOLIDAYS.values())
    .filter(h => h.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, count);
}

function formatDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Get total number of holidays loaded
 */
export function getHolidayCount(): number {
  return ALL_HOLIDAYS.size;
}
