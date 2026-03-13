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
import { useEffect, useRef, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";
import { APP_VERSION } from "../../../shared/const";
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
   SCROLLING TICKER BAR
   ═══════════════════════════════════════════════════════════════════ */
function TickerBar() {
  const { data: snapshots } = trpc.stocks.fetchAll.useQuery(undefined, {
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const tickerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Pick top movers (gainers + losers + most active) for the ticker
  const tickerStocks = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];
    const withPrice = snapshots.filter((s: any) => s.price && s.price > 0);
    // Sort by absolute change to get the most interesting stocks
    const sorted = [...withPrice].sort((a: any, b: any) =>
      Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0)
    );
    return sorted.slice(0, 30);
  }, [snapshots]);

  if (tickerStocks.length === 0) return null;

  return (
    <div
      className="ticker-bar"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        ref={tickerRef}
        className={`ticker-track ${isPaused ? "paused" : ""}`}
      >
        {/* Duplicate for seamless loop */}
        {[...tickerStocks, ...tickerStocks].map((stock: any, i: number) => {
          const isUp = (stock.changePercent || 0) > 0;
          const isDown = (stock.changePercent || 0) < 0;
          return (
            <span key={`${stock.symbol}-${i}`} className="ticker-item">
              <span className="ticker-symbol">{stock.symbol}</span>
              <span className="ticker-price font-mono">
                {stock.price?.toFixed(2)}
              </span>
              <span
                className={`ticker-change font-mono ${
                  isUp ? "text-gain" : isDown ? "text-loss" : "text-muted-foreground"
                }`}
              >
                {isUp ? "▲" : isDown ? "▼" : ""}
                {isUp ? "+" : ""}
                {(stock.changePercent || 0).toFixed(2)}%
              </span>
              <span className="ticker-divider">│</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TERMINAL LAYOUT
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

  // Global Abboud AI alert monitoring - polls for new alerts and shows browser notifications
  useAbboudAlertNotifications();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Zap className="h-4 w-4 animate-pulse text-primary" />
          <span className="text-xs font-mono tracking-wider">LOADING TERMINAL...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ─── Top Navigation Bar ─── */}
      <header className="terminal-header">
        <div className="flex items-center gap-1 min-w-0">
          {/* Logo */}
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-1.5 px-2 py-1 hover:opacity-80 transition-opacity shrink-0"
          >
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/86205309/DiXZqGqijcrECmHgT5LC5F/uae-market-favicon-Z32CLT2cHbBTajhEohDmkp.webp"
              alt=""
              className="h-5 w-5 rounded"
            />
            <span className="text-primary font-bold text-sm tracking-tight hidden sm:inline">
              uae.market
            </span>
          </button>

          {/* Desktop Nav Links */}
          {!isMobile && (
            <nav className="flex items-center gap-0">
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
              className="p-1.5 rounded hover:bg-accent/40 transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Right side: Search + Market Status + Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <QuickSearch />
          <MarketStatusBadge />

          {toggleTheme && (
            <button
              onClick={toggleTheme}
              className="terminal-icon-btn"
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          <NotificationCenter />

          {/* User */}
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-accent/40 transition-colors">
                  <Avatar className="h-5 w-5 border border-primary/20">
                    <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[10px] font-medium text-foreground/80 hidden lg:inline max-w-[80px] truncate">
                    {user?.name?.split(" ")[0] || "User"}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground hidden lg:inline" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  {user?.email}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLocation("/profile")}
                  className="cursor-pointer text-xs"
                >
                  <UserCircle className="mr-2 h-3 w-3" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive text-xs"
                >
                  <LogOut className="mr-2 h-3 w-3" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-2 border-primary/20"
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
        <div className="bg-card border-b border-border/30 px-2 py-1 flex flex-wrap gap-1 z-50">
          {menuItems.map((item) => {
            const isActive = location === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  setLocation(item.path);
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-1 px-2 py-1.5 rounded text-[11px] font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                }`}
              >
                <item.icon className="h-3 w-3" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Scrolling Ticker Bar ─── */}
      <TickerBar />

      {/* ─── Main Content ─── */}
      <main className={`flex-1 p-2 sm:p-3 lg:p-4 ${isMobile ? "pb-20" : ""}`}>{children}</main>

      {/* ─── Footer ─── */}
      <footer className={`terminal-footer ${isMobile ? "mb-16" : ""}`}>
        <span>UAE Market &mdash; www.uae.market</span>
        <span className="mx-2">·</span>
        <span>{APP_VERSION}</span>
        <span className="mx-2">·</span>
        <span>ADX & DFM Exchanges</span>
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
                    <item.icon className="h-4 w-4" />
                    <span className="text-[8px] font-semibold">{item.label}</span>
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
                  <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                  <span className={`text-[8px] font-semibold ${isActive ? "text-primary" : ""}`}>
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
