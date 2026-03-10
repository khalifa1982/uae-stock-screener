import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketStatusBadge } from "@/components/MarketStatusIndicator";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Star,
  Moon,
  Sun,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  getHolidaysForYear,
  getUpcomingHolidays,
  isTradingDay,
  getHoliday,
  type UAEHoliday,
} from "@shared/uaeHolidays";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);

  return days;
}

function formatDateForCheck(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function HolidayIcon({ type }: { type: "fixed" | "islamic" }) {
  if (type === "islamic") {
    return <Moon className="h-3.5 w-3.5 text-neon-purple" />;
  }
  return <Star className="h-3.5 w-3.5 text-neon-gold" />;
}

function CalendarGrid({ year, month }: { year: number; month: number }) {
  const days = getMonthDays(year, month);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="grid grid-cols-7 gap-px bg-border/10 rounded-xl overflow-hidden border border-border/20">
      {/* Weekday headers */}
      {WEEKDAYS.map((wd, i) => (
        <div
          key={wd}
          className={`text-center py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
            i === 5 || i === 6
              ? "text-muted-foreground/30 bg-card/20"
              : "text-muted-foreground/60 bg-card/40"
          }`}
        >
          {wd}
        </div>
      ))}

      {/* Day cells */}
      {days.map((day, idx) => {
        if (day === null) {
          return <div key={`empty-${idx}`} className="h-16 sm:h-20 bg-card/10" />;
        }

        const dateStr = formatDateForCheck(year, month, day);
        const holiday = getHoliday(dateStr);
        const isToday = dateStr === todayStr;
        const dayOfWeek = new Date(year, month, day).getDay();
        const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
        const isTradable = isTradingDay(dateStr);
        const isPast = dateStr < todayStr;

        return (
          <div
            key={`day-${day}`}
            className={`h-16 sm:h-20 p-1 sm:p-1.5 relative transition-all ${
              isToday
                ? "bg-primary/[0.08] ring-1 ring-inset ring-primary/30"
                : holiday
                ? "bg-neon-purple/[0.04]"
                : isWeekend
                ? "bg-card/15"
                : isPast
                ? "bg-card/20 opacity-60"
                : "bg-card/30 hover:bg-card/40"
            }`}
          >
            <div className="flex items-start justify-between">
              <span
                className={`text-xs font-mono font-medium ${
                  isToday
                    ? "text-primary font-bold"
                    : holiday
                    ? "text-neon-purple"
                    : isWeekend
                    ? "text-muted-foreground/30"
                    : "text-foreground/70"
                }`}
              >
                {day}
              </span>
              {isToday && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </div>

            {holiday && (
              <div className="mt-0.5">
                <div className="flex items-center gap-0.5">
                  <HolidayIcon type={holiday.type} />
                  <span className="text-[8px] sm:text-[9px] text-neon-purple/80 font-medium truncate leading-tight">
                    {holiday.name}
                  </span>
                </div>
              </div>
            )}

            {!holiday && isWeekend && (
              <span className="text-[8px] text-muted-foreground/20 mt-1 block">Weekend</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UpcomingHolidayCard({ holiday, index }: { holiday: UAEHoliday; index: number }) {
  const date = new Date(holiday.date + "T12:00:00Z");
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const daysAway = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const dayName = date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

  return (
    <div className="flex items-center gap-4 py-3.5 px-4 rounded-xl hover:bg-white/[0.02] transition-all group">
      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-neon-purple/10 to-primary/5 border border-neon-purple/15 flex flex-col items-center justify-center shrink-0">
        <span className="text-[10px] text-neon-purple/70 font-semibold uppercase leading-none">
          {date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}
        </span>
        <span className="text-lg font-bold text-neon-purple font-mono leading-tight">
          {date.getUTCDate()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <HolidayIcon type={holiday.type} />
          <span className="font-semibold text-sm text-foreground/90">{holiday.name}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground/50">{dayName}</span>
          {holiday.nameAr && (
            <span className="text-[11px] text-muted-foreground/40 font-arabic" dir="rtl">
              {holiday.nameAr}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        {daysAway <= 0 ? (
          <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">Today</Badge>
        ) : daysAway <= 7 ? (
          <Badge variant="outline" className="border-neon-gold/30 text-neon-gold text-[10px]">
            {daysAway}d away
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground/40 font-mono">{daysAway}d</span>
        )}
      </div>
    </div>
  );
}

function YearSummary({ year }: { year: number }) {
  const holidays = getHolidaysForYear(year);
  const fixedCount = holidays.filter(h => h.type === "fixed").length;
  const islamicCount = holidays.filter(h => h.type === "islamic").length;

  // Group by holiday name (multi-day holidays)
  const grouped: { name: string; nameAr?: string; type: "fixed" | "islamic"; dates: string[] }[] = [];
  const seen = new Map<string, number>();

  for (const h of holidays) {
    const key = h.name;
    if (seen.has(key)) {
      grouped[seen.get(key)!].dates.push(h.date);
    } else {
      seen.set(key, grouped.length);
      grouped.push({ name: h.name, nameAr: h.nameAr, type: h.type, dates: [h.date] });
    }
  }

  return (
    <Card className="border-border/30 bg-card/30 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
            <CalendarDays className="h-4 w-4 text-primary" />
            {year} Holiday Summary
          </CardTitle>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50">
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 text-neon-gold" /> {fixedCount} Fixed
            </span>
            <span className="flex items-center gap-1">
              <Moon className="h-3 w-3 text-neon-purple" /> {islamicCount} Islamic
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/10">
          {grouped.map((g, i) => {
            const startDate = new Date(g.dates[0] + "T12:00:00Z");
            const endDate = g.dates.length > 1 ? new Date(g.dates[g.dates.length - 1] + "T12:00:00Z") : null;

            return (
              <div key={i} className="flex items-center gap-4 py-3 px-5 hover:bg-white/[0.015] transition-all">
                <HolidayIcon type={g.type} />
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-medium text-foreground/85">{g.name}</span>
                  {g.nameAr && (
                    <span className="text-[11px] text-muted-foreground/40 ml-2" dir="rtl">{g.nameAr}</span>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xs font-mono text-muted-foreground/60">
                    {startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                    {endDate && (
                      <> - {endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</>
                    )}
                  </span>
                  {g.dates.length > 1 && (
                    <span className="text-[10px] text-muted-foreground/30 ml-1.5">({g.dates.length} days)</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Calendar() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<string>(String(now.getFullYear()));

  const upcoming = useMemo(() => getUpcomingHolidays(8), []);

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const goToToday = () => {
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  // Count trading days this month
  const tradingDaysThisMonth = useMemo((): number => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDateForCheck(viewYear, viewMonth, d);
      if (isTradingDay(dateStr)) count++;
    }
    return count;
  }, [viewYear, viewMonth]);

  const holidaysThisMonth = useMemo((): UAEHoliday[] => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const holidays: UAEHoliday[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDateForCheck(viewYear, viewMonth, d);
      const hol = getHoliday(dateStr);
      if (hol && !holidays.find((x: UAEHoliday) => x.name === hol.name)) holidays.push(hol);
    }
    return holidays;
  }, [viewYear, viewMonth]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Market Calendar</h1>
            <MarketStatusBadge />
          </div>
          <p className="text-muted-foreground/70 text-sm mt-1.5">
            UAE public holidays and trading schedule for ADX & DFM
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50 bg-card/30 border border-border/20 rounded-lg px-3 py-2">
            <span className="flex items-center gap-1.5">
              <Sun className="h-3 w-3 text-neon-green" />
              {tradingDaysThisMonth} trading days
            </span>
            <span className="text-border/30">|</span>
            <span className="flex items-center gap-1.5">
              <Moon className="h-3 w-3 text-neon-purple" />
              {holidaysThisMonth.length} holidays
            </span>
          </div>
        </div>
      </div>

      {/* Market Hours Info */}
      <div className="gradient-border-card p-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
              <Clock className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-[0.12em]">Trading Hours</p>
              <p className="text-sm font-semibold text-foreground/90">Mon-Fri, 10:00 AM - 3:00 PM (UAE Time, GMT+4)</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground/50">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-neon-gold" />
              Pre-Open: 9:30-10:00
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-neon-green" />
              Open: 10:00-2:50
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-neon-red" />
              Pre-Close: 2:50-3:00
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="xl:col-span-2 space-y-4">
          <Card className="border-border/30 bg-card/30 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={goToPrevMonth}
                    className="h-8 w-8 rounded-lg border border-border/20 flex items-center justify-center hover:bg-accent/40 transition-all"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-center min-w-[180px]">
                    <h2 className="text-lg font-bold tracking-tight">
                      {MONTHS[viewMonth]} {viewYear}
                    </h2>
                  </div>
                  <button
                    onClick={goToNextMonth}
                    className="h-8 w-8 rounded-lg border border-border/20 flex items-center justify-center hover:bg-accent/40 transition-all"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={goToToday}
                  className="btn-premium text-xs"
                >
                  Today
                </button>
              </div>
            </CardHeader>
            <CardContent className="pb-5">
              <CalendarGrid year={viewYear} month={viewMonth} />

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 mt-4 text-[10px] text-muted-foreground/50">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border border-primary/30 bg-primary/[0.08]" />
                  Today
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border border-neon-purple/30 bg-neon-purple/[0.04]" />
                  Holiday
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-card/15 border border-border/10" />
                  Weekend (Sat-Sun)
                </span>
                <span className="flex items-center gap-1.5">
                  <Star className="h-3 w-3 text-neon-gold" />
                  Fixed Holiday
                </span>
                <span className="flex items-center gap-1.5">
                  <Moon className="h-3 w-3 text-neon-purple" />
                  Islamic Holiday
                </span>
              </div>

              {/* This month's holidays */}
              {holidaysThisMonth.length > 0 && (
                <div className="mt-4 p-3 rounded-xl border border-neon-purple/10 bg-neon-purple/[0.02]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neon-purple/60 mb-2">
                    Holidays this month
                  </p>
                  <div className="space-y-1">
                    {holidaysThisMonth.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-[12px]">
                        <HolidayIcon type={h.type} />
                        <span className="text-foreground/80">{h.name}</span>
                        {h.nameAr && <span className="text-muted-foreground/40 text-[11px]" dir="rtl">{h.nameAr}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Holidays Sidebar */}
        <div className="space-y-4">
          <Card className="border-border/30 bg-card/30 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-neon-purple/15 to-neon-purple/5 flex items-center justify-center">
                  <AlertTriangle className="h-3.5 w-3.5 text-neon-purple" />
                </div>
                Upcoming Holidays
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {upcoming.length > 0 ? (
                <div className="divide-y divide-border/10">
                  {upcoming.map((h: UAEHoliday, i: number) => (
                    <UpcomingHolidayCard key={`${h.date}-${i}`} holiday={h} index={i} />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground/40 text-sm">
                  No upcoming holidays in the calendar
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick note */}
          <div className="p-3.5 rounded-xl border border-primary/10 bg-primary/[0.02] text-[11px] text-muted-foreground/50 leading-relaxed">
            <p className="font-semibold text-foreground/60 mb-1">Note on Islamic Holidays</p>
            <p>
              Islamic holidays follow the Hijri (lunar) calendar and may shift by 1-2 days 
              based on official moon sighting announcements by the UAE government. 
              Dates shown are approximate estimates.
            </p>
          </div>
        </div>
      </div>

      {/* Year Summary */}
      <div>
        <Tabs value={selectedYear} onValueChange={setSelectedYear}>
          <TabsList className="bg-secondary/40 border border-border/20 mb-4">
            <TabsTrigger value="2025" className="text-xs px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">2025</TabsTrigger>
            <TabsTrigger value="2026" className="text-xs px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">2026</TabsTrigger>
            <TabsTrigger value="2027" className="text-xs px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">2027</TabsTrigger>
          </TabsList>
        </Tabs>
        <YearSummary year={parseInt(selectedYear)} />
      </div>
    </div>
  );
}
