import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserCircle } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import NotificationCenter from "@/components/NotificationCenter";
import { useAbboudAlertNotifications } from "@/hooks/useAbboudAlertNotifications";
import { MarketStatusBadge } from "@/components/MarketStatusIndicator";
import { QuickSearch } from "@/components/QuickSearch";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";
import { APP_VERSION } from "../../../shared/const";
import { ALL_STOCKS } from "../../../shared/stockData";
import { useRealtimePrices } from "@/hooks/useRealtimePrices";
import {
  LayoutDashboard,
  Filter,
  Bell,
  Eye,
  Grid3X3,
  CalendarDays,
  Newspaper,
  FileText,
  Settings2,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  ChevronDown,
  Zap,
  BellRing,
  Search,
  Scale,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Filter, label: "Screener", path: "/screener" },
  { icon: Bell, label: "Alerts", path: "/alerts" },
  { icon: Eye, label: "Watchlist", path: "/watchlist" },
  { icon: Grid3X3, label: "Heatmap", path: "/heatmap" },
  { icon: CalendarDays, label: "Calendar", path: "/calendar" },
  { icon: Newspaper, label: "News", path: "/news" },
  { icon: FileText, label: "Summary", path: "/summary" },
  { icon: BellRing, label: "Notifications", path: "/notifications" },
  { icon: Scale, label: "Compare", path: "/compare" },
];

const adminNavItems = [
  { icon: Settings2, label: "API", path: "/admin" },
];

const mobileNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Filter, label: "Screener", path: "/screener" },
  { icon: Bell, label: "Alerts", path: "/alerts" },
  { icon: Eye, label: "Watchlist", path: "/watchlist" },
  { icon: Grid3X3, label: "More", path: "" },
];

/* ═══════════════════════════════════════════════════════════════════
   SCROLLING TICKER BAR — Live WebSocket Prices
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Smart price formatter: preserves the actual decimal precision of each stock.
 */
function formatStockPrice(price: number): string {
  const rounded = Math.round(price * 1000) / 1000;
  const third = Math.round((rounded * 1000) % 10);
  if (third !== 0) return rounded.toFixed(3);
  return rounded.toFixed(2);
}

/** Single ticker item that flashes on price change */
function TickerItem({ symbol, price, changePercent, flashDir }: {
  symbol: string;
  price: number;
  changePercent: number;
  flashDir: "up" | "down" | null;
}) {
  const isUp = changePercent > 0;
  const isDown = changePercent < 0;
  return (
    <span className="ticker-item">
      <span className="ticker-symbol">{symbol}</span>
      <span className={`ticker-price ${flashDir === "up" ? "ticker-flash-up" : flashDir === "down" ? "ticker-flash-down" : ""}`}>
        {formatStockPrice(price)}
      </span>
      <span
        className={`ticker-change ${
          isUp ? "text-gain" : isDown ? "text-loss" : "text-muted-foreground"
        } ${flashDir === "up" ? "ticker-flash-up" : flashDir === "down" ? "ticker-flash-down" : ""}`}
      >
        {isUp ? "+" : ""}
        {changePercent.toFixed(changePercent !== 0 && Math.abs(changePercent) < 0.1 ? 3 : 2)}%
      </span>
      <span className="ticker-divider">·</span>
    </span>
  );
}

function TickerBar() {
  const { data: snapshots } = trpc.stocks.fetchAll.useQuery(undefined, {
    staleTime: 5_000,
    refetchInterval: 15_000,
  });

  const { data: dfmLive } = trpc.stocks.dfmTicker.useQuery(undefined, {
    staleTime: 3_000,
    refetchInterval: 5_000,
  });

  const allSymbols = useMemo(() => ALL_STOCKS.map(s => s.symbol), []);
  const allExchanges = useMemo(() => ALL_STOCKS.map(s => s.exchange), []);
  const { prices: wsPrices } = useRealtimePrices(allSymbols, allExchanges);

  const [flashes, setFlashes] = useState<Record<string, "up" | "down">>({});
  const prevPricesRef = useRef<Record<string, number>>({});
  const flashTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const triggerFlash = useCallback((sym: string, newPrice: number) => {
    const prev = prevPricesRef.current;
    if (prev[sym] !== undefined && newPrice !== prev[sym]) {
      const dir = newPrice > prev[sym] ? "up" as const : "down" as const;
      setFlashes(f => ({ ...f, [sym]: dir }));
      if (flashTimersRef.current[sym]) clearTimeout(flashTimersRef.current[sym]);
      flashTimersRef.current[sym] = setTimeout(() => {
        setFlashes(f => {
          const copy = { ...f };
          delete copy[sym];
          return copy;
        });
      }, 800);
    }
    prev[sym] = newPrice;
  }, []);

  useEffect(() => {
    for (const [sym, data] of Object.entries(wsPrices)) {
      triggerFlash(sym, data.price);
    }
  }, [wsPrices, triggerFlash]);

  useEffect(() => {
    if (!dfmLive) return;
    for (const [sym, data] of Object.entries(dfmLive)) {
      triggerFlash(sym, data.price);
    }
  }, [dfmLive, triggerFlash]);

  useEffect(() => {
    return () => {
      Object.values(flashTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  const [isPaused, setIsPaused] = useState(false);

  const tickerStocks = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];
    const withPrice = snapshots.filter((s: any) => s.price && s.price > 0);
    const sorted = [...withPrice].sort((a: any, b: any) =>
      Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0)
    );
    return sorted;
  }, [snapshots]);

  const getLivePrice = useCallback((stock: any) => {
    const dfm = dfmLive?.[stock.symbol];
    if (dfm && dfm.price > 0) {
      return { price: dfm.price, changePercent: dfm.changePercent };
    }
    const ws = wsPrices[stock.symbol];
    if (ws && ws.price > 0) {
      const prevClose = stock.previousClose || (stock.price - (stock.price * (stock.changePercent || 0) / 100));
      const liveChangePercent = prevClose > 0 ? ((ws.price - prevClose) / prevClose) * 100 : (stock.changePercent || 0);
      return { price: ws.price, changePercent: liveChangePercent };
    }
    return { price: stock.price, changePercent: stock.changePercent || 0 };
  }, [wsPrices, dfmLive]);

  if (tickerStocks.length === 0) return null;

  return (
    <div
      className="ticker-bar"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className={`ticker-track ${isPaused ? "paused" : ""}`}>
        {[...tickerStocks, ...tickerStocks].map((stock: any, i: number) => {
          const live = getLivePrice(stock);
          return (
            <TickerItem
              key={`${stock.symbol}-${i}`}
              symbol={stock.symbol}
              price={live.price}
              changePercent={live.changePercent}
              flashDir={flashes[stock.symbol] || null}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VISITOR COUNTER
   ═══════════════════════════════════════════════════════════════════ */
function VisitorCounter() {
  const [loc] = useLocation();
  const { data: stats } = trpc.visitors.stats.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const recordMutation = trpc.visitors.record.useMutation();
  const pageViewMutation = trpc.visitors.recordPageView.useMutation();
  const hasRecorded = useRef(false);
  const lastTrackedPage = useRef('');

  useEffect(() => {
    if (!hasRecorded.current) {
      hasRecorded.current = true;
      recordMutation.mutate();
    }
  }, []);

  useEffect(() => {
    if (loc && loc !== lastTrackedPage.current) {
      lastTrackedPage.current = loc;
      const stockMatch = loc.match(/\/stock\/([A-Z0-9.]+)/i);
      pageViewMutation.mutate({
        pagePath: loc,
        symbol: stockMatch ? stockMatch[1].toUpperCase() : null,
      });
    }
  }, [loc]);

  if (!stats) return null;

  const fmt = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return n.toLocaleString();
  };

  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-gain animate-pulse" />
        <span className="text-gain font-medium">{stats.onlineNow}</span>
        <span>online</span>
      </span>
      <span>·</span>
      <span>{fmt(stats.todayVisitors)} today</span>
      <span>·</span>
      <span>{fmt(stats.totalVisitors)} total</span>
    </span>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   TERMINAL LAYOUT — Google Finance-inspired
   ═══════════════════════════════════════════════════════════════════ */
export default function TerminalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuItems = user?.role === "admin" ? [...navItems, ...adminNavItems] : navItems;

  useAbboudAlertNotifications();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ─── Top Navigation Bar ─── */}
      <header className="terminal-header">
        <div className="flex items-center gap-2 min-w-0">
          {/* Logo */}
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 px-1 py-1 hover:opacity-80 transition-opacity shrink-0"
          >
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/86205309/DiXZqGqijcrECmHgT5LC5F/uae-market-favicon-Z32CLT2cHbBTajhEohDmkp.webp"
              alt=""
              className="h-6 w-6 rounded"
            />
            <span className="text-foreground font-semibold text-base tracking-tight hidden sm:inline">
              uae.market
            </span>
          </button>

          {/* Desktop Nav Links */}
          {!isMobile && (
            <nav className="flex items-center gap-0.5 ml-2">
              {menuItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => setLocation(item.path)}
                    className={`terminal-nav-link ${isActive ? "active" : ""}`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Mobile hamburger */}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-full hover:bg-accent transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          )}
        </div>

        {/* Right side: Search + Market Status + Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <QuickSearch />
          <MarketStatusBadge />

          {toggleTheme && (
            <button
              onClick={toggleTheme}
              className="terminal-icon-btn"
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          )}

          <NotificationCenter />

          {/* User */}
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-full hover:bg-accent transition-colors">
                  <Avatar className="h-7 w-7 border border-border">
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground hidden lg:inline max-w-[100px] truncate">
                    {user?.name?.split(" ")[0] || "User"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden lg:inline" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {user?.email}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLocation("/profile")}
                  className="cursor-pointer"
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-sm px-4 rounded-full"
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
            >
              Sign in
            </Button>
          )}
        </div>
      </header>

      {/* ─── Mobile Menu Dropdown ─── */}
      {isMobile && mobileMenuOpen && (
        <div className="bg-background dark:bg-[rgba(13,17,23,0.85)] dark:backdrop-blur-xl border-b border-border dark:border-white/[0.06] px-3 py-2 flex flex-wrap gap-1 z-50 shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          {menuItems.map((item) => {
            const isActive = location === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  setLocation(item.path);
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary/15 text-primary backdrop-blur-sm border border-primary/20 shadow-[0_0_10px_rgba(59,130,246,0.12)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06] dark:hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08]"
                }`}
              >
                <div className={`h-6 w-6 rounded-md flex items-center justify-center ${
                  isActive
                    ? "bg-primary/20 shadow-[0_0_6px_rgba(59,130,246,0.15)]"
                    : "bg-white/[0.06] dark:bg-white/[0.06]"
                }`}>
                  <item.icon className="h-3.5 w-3.5" />
                </div>
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Scrolling Ticker Bar ─── */}
      <TickerBar />

      {/* ─── Main Content ─── */}
      <main className={`flex-1 ${isMobile ? "px-3 py-3 pb-24" : "px-4 py-4 lg:px-8 lg:py-5"}`}>
        <div className="max-w-[1440px] mx-auto">
          {children}
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className={`terminal-footer flex-col !gap-3 py-4 ${isMobile ? "mb-16" : ""}`}>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
              <img src="https://d2xsxph8kpxj0f.cloudfront.net/86205309/DiXZqGqijcrECmHgT5LC5F/aboood-ai-logo-new_f66f6c69.png" alt="" className="h-4 w-4 rounded-full" />
              Aboood.ai Network
            </span>
          <a href="https://whatsapp-group.aboood.ai" target="_blank" rel="noopener noreferrer" className="footer-glass-link group" title="WhatsApp Group">
            <span className="footer-glass-icon group-hover:bg-[rgba(37,211,102,0.15)] group-hover:border-[rgba(37,211,102,0.25)] group-hover:shadow-[0_0_8px_rgba(37,211,102,0.15)]">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </span>
            WA Group
          </a>
          <a href="https://whatsapp-channel.aboood.ai" target="_blank" rel="noopener noreferrer" className="footer-glass-link group" title="WhatsApp Channel">
            <span className="footer-glass-icon group-hover:bg-[rgba(37,211,102,0.15)] group-hover:border-[rgba(37,211,102,0.25)] group-hover:shadow-[0_0_8px_rgba(37,211,102,0.15)]">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </span>
            WA Channel
          </a>
          <a href="https://telegram-group.aboood.ai" target="_blank" rel="noopener noreferrer" className="footer-glass-link group" title="Telegram Group">
            <span className="footer-glass-icon group-hover:bg-[rgba(0,136,204,0.15)] group-hover:border-[rgba(0,136,204,0.25)] group-hover:shadow-[0_0_8px_rgba(0,136,204,0.15)]">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            </span>
            TG Group
          </a>
          <a href="https://telegram-channel.aboood.ai" target="_blank" rel="noopener noreferrer" className="footer-glass-link group" title="Telegram Channel">
            <span className="footer-glass-icon group-hover:bg-[rgba(0,136,204,0.15)] group-hover:border-[rgba(0,136,204,0.25)] group-hover:shadow-[0_0_8px_rgba(0,136,204,0.15)]">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            </span>
            TG Channel
          </a>
          <span className="text-border">|</span>
          <a href="https://chat.aboood.ai" target="_blank" rel="noopener noreferrer" className="footer-glass-link group" title="Aboood Web Analysis">
            <span className="footer-glass-icon group-hover:bg-primary/15 group-hover:border-primary/25 group-hover:shadow-[0_0_8px_rgba(59,130,246,0.15)]">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            </span>
            Web Analysis
          </a>
          <a href="https://deepmind.aboood.ai" target="_blank" rel="noopener noreferrer" className="footer-glass-link group" title="Aboood Deepmind">
            <span className="footer-glass-icon group-hover:bg-purple-500/15 group-hover:border-purple-500/25 group-hover:shadow-[0_0_8px_rgba(168,85,247,0.15)]">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 014 4v1a2 2 0 012 2v1a2 2 0 01-2 2 4 4 0 01-8 0 2 2 0 01-2-2V9a2 2 0 012-2V6a4 4 0 014-4z"/><path d="M8 14v.5a4 4 0 008 0V14"/><path d="M12 18v4"/><path d="M8 22h8"/></svg>
            </span>
            Deepmind
          </a>
          <a href="https://www.uae.market" target="_blank" rel="noopener noreferrer" className="footer-glass-link group" title="UAE Stock Market Live Prices">
            <span className="footer-glass-icon group-hover:bg-cyan-500/15 group-hover:border-cyan-500/25 group-hover:shadow-[0_0_8px_rgba(6,182,212,0.15)]">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            </span>
            UAE Market
          </a>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
          <a href="https://www.aboood.ai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-muted-foreground transition-colors">
            <img src="https://d2xsxph8kpxj0f.cloudfront.net/86205309/DiXZqGqijcrECmHgT5LC5F/aboood-ai-logo-new_f66f6c69.png" alt="Aboood.AI" className="h-5 w-5 rounded-full ring-1 ring-white/10" />
            www.aboood.ai
          </a>
          <span>|</span>
          <span>{APP_VERSION}</span>
          <span>·</span>
          <VisitorCounter />
        </div>
      </footer>

      {/* ─── Mobile Bottom Navigation ─── */}
      {isMobile && (
        <nav className="mobile-bottom-nav">
          <div className="flex items-center justify-around px-2">
            {mobileNavItems.map((item) => {
              if (item.path === "") {
                return (
                  <button
                    key="more"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className={`mobile-nav-item ${mobileMenuOpen ? "active" : "text-muted-foreground"}`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </button>
                );
              }
              const isActive = location === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  className={`mobile-nav-item ${isActive ? "active" : "text-muted-foreground"}`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                  <span className={`text-[10px] font-medium ${isActive ? "text-primary" : ""}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
