import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
} from "lucide-react";
import {
  getHolidaysForYear,
  getUpcomingHolidays,
  isTradingDay,
  getHoliday,
  type UAEHoliday,
} from "@shared/uaeHolidays";
import { Link } from "wouter";

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
    <div className="grid grid-cols-7 gap-px bg-border/10 rounded-md overflow-hidden border border-border/20">
      {WEEKDAYS.map((wd, i) => (
        <div
          key={wd}
          className={`text-center py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
            i === 5 || i === 6
              ? "text-muted-foreground/60 bg-card/20"
              : "text-muted-foreground/60 bg-card/40"
          }`}
        >
          {wd}
        </div>
      ))}

      {days.map((day, idx) => {
        if (day === null) {
          return <div key={`empty-${idx}`} className="h-16 sm:h-20 bg-card/10" />;
        }

        const dateStr = formatDateForCheck(year, month, day);
        const holiday = getHoliday(dateStr);
        const isToday = dateStr === todayStr;
        const dayOfWeek = new Date(year, month, day).getDay();
        const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
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
                    ? "text-muted-foreground/60"
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
              <span className="text-[8px] text-muted-foreground/60 mt-1 block">Weekend</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UpcomingHolidayCard({ holiday }: { holiday: UAEHoliday }) {
  const date = new Date(holiday.date + "T12:00:00Z");
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const daysAway = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const dayName = date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

  return (
    <div className="flex items-center gap-1.5 py-1.5 px-2 rounded-md hover:bg-white/[0.02] transition-all group">
      <div className="h-12 w-12 rounded-md bg-gradient-to-br from-neon-purple/10 to-primary/5 border border-neon-purple/15 flex flex-col items-center justify-center shrink-0">
        <span className="text-[10px] text-neon-purple/70 font-semibold uppercase leading-none">
          {date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}
        </span>
        <span className="text-[11px] font-bold text-neon-purple font-mono leading-tight">
          {date.getUTCDate()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <HolidayIcon type={holiday.type} />
          <span className="font-semibold text-[11px] text-foreground/90">{holiday.name}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground">{dayName}</span>
          {holiday.nameAr && (
            <span className="text-[11px] text-muted-foreground/70 font-arabic" dir="rtl">
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
          <span className="text-xs text-muted-foreground/70 font-mono">{daysAway}d</span>
        )}
      </div>
    </div>
  );
}

function YearSummary({ year }: { year: number }) {
  const holidays = getHolidaysForYear(year);
  const fixedCount = holidays.filter(h => h.type === "fixed").length;
  const islamicCount = holidays.filter(h => h.type === "islamic").length;

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
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[11px] font-semibold flex items-center gap-2.5">
            <CalendarDays className="h-4 w-4 text-primary" />
            {year} Holiday Summary
          </CardTitle>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
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
              <div key={i} className="flex items-center gap-1.5 py-1 px-2 hover:bg-white/[0.015] transition-all">
                <HolidayIcon type={g.type} />
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-medium text-foreground/85">{g.name}</span>
                  {g.nameAr && (
                    <span className="text-[11px] text-muted-foreground/70 ml-2" dir="rtl">{g.nameAr}</span>
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
                    <span className="text-[10px] text-muted-foreground/70 ml-1.5">({g.dates.length} days)</span>
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

// ─── Corporate Events Section ───────────────────────────────────────
interface CorporateEvent {
  symbol: string;
  name: string;
  exchange: string;
  earningsNext: number | null;
  earningsLast: number | null;
  dividendExDate: number | null;
  price: number | null;
  change: number | null;
  sector: string | null;
}

function CorporateEventsSection() {
  const { data, isLoading } = trpc.stocks.corporateEvents.useQuery(undefined, {
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const [eventFilter, setEventFilter] = useState<"all" | "earnings" | "dividends">("all");

  const upcomingEarnings = useMemo(() => {
    if (!data?.events) return [];
    const now = Date.now();
    return data.events
      .filter((e: CorporateEvent) => e.earningsNext && e.earningsNext > now)
      .sort((a: CorporateEvent, b: CorporateEvent) => (a.earningsNext || 0) - (b.earningsNext || 0));
  }, [data]);

  const upcomingDividends = useMemo(() => {
    if (!data?.events) return [];
    const now = Date.now();
    return data.events
      .filter((e: CorporateEvent) => e.dividendExDate && e.dividendExDate > now)
      .sort((a: CorporateEvent, b: CorporateEvent) => (a.dividendExDate || 0) - (b.dividendExDate || 0));
  }, [data]);

  const recentEarnings = useMemo(() => {
    if (!data?.events) return [];
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    return data.events
      .filter((e: CorporateEvent) => e.earningsLast && e.earningsLast > thirtyDaysAgo && e.earningsLast <= now)
      .sort((a: CorporateEvent, b: CorporateEvent) => (b.earningsLast || 0) - (a.earningsLast || 0));
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded" />
        ))}
      </div>
    );
  }

  const formatEventDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };

  const daysUntil = (ts: number) => {
    const diff = Math.ceil((ts - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return `${diff}d`;
  };

  return (
    <div className="space-y-1.5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-1">
        <Card className="bg-card/50 border-border/30">
          <CardContent className="p-3 text-center">
            <BarChart3 className="h-4 w-4 text-blue-400 mx-auto mb-1" />
            <p className="text-[11px] font-bold">{upcomingEarnings.length}</p>
            <p className="text-[10px] text-muted-foreground">Upcoming Earnings</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/30">
          <CardContent className="p-3 text-center">
            <DollarSign className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
            <p className="text-[11px] font-bold">{upcomingDividends.length}</p>
            <p className="text-[10px] text-muted-foreground">Upcoming Dividends</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/30">
          <CardContent className="p-3 text-center">
            <Clock className="h-4 w-4 text-amber-400 mx-auto mb-1" />
            <p className="text-[11px] font-bold">{recentEarnings.length}</p>
            <p className="text-[10px] text-muted-foreground">Recent Earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Tabs value={eventFilter} onValueChange={(v) => setEventFilter(v as any)}>
        <TabsList className="bg-background/50">
          <TabsTrigger value="all" className="text-xs">All Events</TabsTrigger>
          <TabsTrigger value="earnings" className="text-xs">Earnings</TabsTrigger>
          <TabsTrigger value="dividends" className="text-xs">Dividends</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Upcoming Earnings */}
      {(eventFilter === "all" || eventFilter === "earnings") && upcomingEarnings.length > 0 && (
        <Card className="border-border/30 bg-card/30 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              Upcoming Earnings Releases
              <Badge variant="outline" className="text-[10px] ml-auto">{upcomingEarnings.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/10">
              {upcomingEarnings.slice(0, 20).map((event: CorporateEvent) => (
                <Link key={`earn-${event.symbol}`} href={`/stock/${event.symbol}`}>
                  <div className="flex items-center gap-1 px-2 py-1 hover:bg-muted/10 transition-colors cursor-pointer">
                    <div className="h-10 w-10 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-blue-400">{event.exchange}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold">{event.symbol}</span>
                        <span className="text-xs text-muted-foreground truncate">{event.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground/60 font-mono">
                          {formatEventDate(event.earningsNext!)}
                        </span>
                        {event.sector && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">{event.sector}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          (event.earningsNext! - Date.now()) < 7 * 24 * 60 * 60 * 1000
                            ? "border-amber-500/30 text-amber-400"
                            : "border-border/30"
                        }`}
                      >
                        {daysUntil(event.earningsNext!)}
                      </Badge>
                      {event.price && (
                        <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                          AED {event.price.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Dividends */}
      {(eventFilter === "all" || eventFilter === "dividends") && upcomingDividends.length > 0 && (
        <Card className="border-border/30 bg-card/30 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              Upcoming Ex-Dividend Dates
              <Badge variant="outline" className="text-[10px] ml-auto">{upcomingDividends.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/10">
              {upcomingDividends.slice(0, 20).map((event: CorporateEvent) => (
                <Link key={`div-${event.symbol}`} href={`/stock/${event.symbol}`}>
                  <div className="flex items-center gap-1 px-2 py-1 hover:bg-muted/10 transition-colors cursor-pointer">
                    <div className="h-10 w-10 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <DollarSign className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold">{event.symbol}</span>
                        <span className="text-xs text-muted-foreground truncate">{event.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground/60 font-mono">
                          Ex-Date: {formatEventDate(event.dividendExDate!)}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          (event.dividendExDate! - Date.now()) < 7 * 24 * 60 * 60 * 1000
                            ? "border-emerald-500/30 text-emerald-400"
                            : "border-border/30"
                        }`}
                      >
                        {daysUntil(event.dividendExDate!)}
                      </Badge>
                      {event.price && (
                        <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                          AED {event.price.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Earnings */}
      {eventFilter === "all" && recentEarnings.length > 0 && (
        <Card className="border-border/30 bg-card/30 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              Recent Earnings (Last 30 Days)
              <Badge variant="outline" className="text-[10px] ml-auto">{recentEarnings.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/10">
              {recentEarnings.slice(0, 15).map((event: CorporateEvent) => (
                <Link key={`recent-${event.symbol}`} href={`/stock/${event.symbol}`}>
                  <div className="flex items-center gap-1 px-2 py-1 hover:bg-muted/10 transition-colors cursor-pointer opacity-80">
                    <div className="h-10 w-10 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-amber-400">{event.exchange}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold">{event.symbol}</span>
                        <span className="text-xs text-muted-foreground truncate">{event.name}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground/60 font-mono">
                        Reported: {formatEventDate(event.earningsLast!)}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      {event.change != null && (
                        <div className={`flex items-center gap-1 ${event.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {event.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          <span className="text-xs font-mono">{event.change >= 0 ? "+" : ""}{event.change.toFixed(2)}%</span>
                        </div>
                      )}
                      {event.price && (
                        <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                          AED {event.price.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {upcomingEarnings.length === 0 && upcomingDividends.length === 0 && (
        <Card className="border-border/30 bg-card/30">
          <CardContent className="py-12 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-muted-foreground">No upcoming corporate events found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Calendar Component ────────────────────────────────────────
export default function Calendar() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<string>(String(now.getFullYear()));
  const [mainTab, setMainTab] = useState<"holidays" | "events">("holidays");

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
    <div className="space-y-2 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1 flex-wrap">
            <h1 className="text-xs font-bold tracking-tight">Market Calendar</h1>
            <MarketStatusBadge />
          </div>
          <p className="text-muted-foreground/70 text-[11px] mt-1.5">
            UAE holidays, earnings releases & dividend dates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground bg-card/30 border border-border/20 rounded px-3 py-2">
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
      <div className="gradient-border-card p-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.12em]">Trading Hours</p>
              <p className="text-[11px] font-semibold text-foreground/90">Mon-Fri, 10:00 AM - 3:00 PM (UAE Time, GMT+4)</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
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

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)}>
        <TabsList className="bg-background/50 border border-border/20">
          <TabsTrigger value="holidays" className="text-xs gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Holidays & Schedule
          </TabsTrigger>
          <TabsTrigger value="events" className="text-xs gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Corporate Events
          </TabsTrigger>
        </TabsList>

        <TabsContent value="holidays" className="mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
            {/* Calendar Grid */}
            <div className="xl:col-span-2 space-y-1.5">
              <Card className="border-border/30 bg-card/30 backdrop-blur-sm overflow-hidden">
                <CardHeader className="pb-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={goToPrevMonth}
                        className="h-8 w-8 rounded border border-border/20 flex items-center justify-center hover:bg-accent/40 transition-all"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <div className="text-center min-w-[180px]">
                        <h2 className="text-[11px] font-bold tracking-tight">
                          {MONTHS[viewMonth]} {viewYear}
                        </h2>
                      </div>
                      <button
                        onClick={goToNextMonth}
                        className="h-8 w-8 rounded border border-border/20 flex items-center justify-center hover:bg-accent/40 transition-all"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                    <button onClick={goToToday} className="btn-premium text-xs">
                      Today
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="pb-5">
                  <CalendarGrid year={viewYear} month={viewMonth} />

                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-4 text-[10px] text-muted-foreground">
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
                    <div className="mt-4 p-3 rounded-md border border-neon-purple/10 bg-neon-purple/[0.02]">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neon-purple/60 mb-2">
                        Holidays this month
                      </p>
                      <div className="space-y-1">
                        {holidaysThisMonth.map((h, i) => (
                          <div key={i} className="flex items-center gap-2 text-[12px]">
                            <HolidayIcon type={h.type} />
                            <span className="text-foreground/80">{h.name}</span>
                            {h.nameAr && <span className="text-muted-foreground/70 text-[11px]" dir="rtl">{h.nameAr}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Upcoming Holidays Sidebar */}
            <div className="space-y-1.5">
              <Card className="border-border/30 bg-card/30 backdrop-blur-sm overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[11px] font-semibold flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded bg-gradient-to-br from-neon-purple/15 to-neon-purple/5 flex items-center justify-center">
                      <AlertTriangle className="h-3.5 w-3.5 text-neon-purple" />
                    </div>
                    Upcoming Holidays
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {upcoming.length > 0 ? (
                    <div className="divide-y divide-border/10">
                      {upcoming.map((h: UAEHoliday, i: number) => (
                        <UpcomingHolidayCard key={`${h.date}-${i}`} holiday={h} />
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground/70 text-[11px]">
                      No upcoming holidays in the calendar
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="p-3.5 rounded-md border border-primary/10 bg-primary/[0.02] text-[11px] text-muted-foreground leading-relaxed">
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
          <div className="mt-2">
            <Tabs value={selectedYear} onValueChange={setSelectedYear}>
              <TabsList className="bg-secondary/40 border border-border/20 mb-1">
                <TabsTrigger value="2025" className="text-xs px-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">2025</TabsTrigger>
                <TabsTrigger value="2026" className="text-xs px-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">2026</TabsTrigger>
                <TabsTrigger value="2027" className="text-xs px-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">2027</TabsTrigger>
              </TabsList>
            </Tabs>
            <YearSummary year={parseInt(selectedYear)} />
          </div>
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <CorporateEventsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
