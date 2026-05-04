import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import NotificationCenter from "@/components/NotificationCenter";
import {
  Activity,
  Bell,
  BellRing,
  BarChart3,
  CalendarDays,
  Eye,
  FileText,
  Filter,
  Grid3X3,
  LayoutDashboard,
  LogOut,
  Moon,
  PanelLeft,
  Settings2,
  Sun,
  TrendingUp,
  Newspaper,
  Zap,
} from "lucide-react";
import { MarketStatusBadge } from "@/components/MarketStatusIndicator";
import { useTheme } from "@/contexts/ThemeContext";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { APP_VERSION } from "../../../shared/const";

const baseMenuItems = [
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

const adminMenuItems = [
  { icon: Settings2, label: "API", path: "/admin" },
];

const mobileNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Filter, label: "Screener", path: "/screener" },
  { icon: Bell, label: "Alerts", path: "/alerts" },
  { icon: Eye, label: "Watchlist", path: "/watchlist" },
  { icon: Grid3X3, label: "Heatmap", path: "/heatmap" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const menuItems = user?.role === "admin" ? [...baseMenuItems, ...adminMenuItems] : baseMenuItems;
  const activeMenuItem = menuItems.find((item) => item.path === location);
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft =
        sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          {/* ─── Sidebar Header ─── */}
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent/60 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-lg overflow-hidden shrink-0 border border-primary/20">
                    <img src="https://d2xsxph8kpxj0f.cloudfront.net/86205309/DiXZqGqijcrECmHgT5LC5F/uae-market-favicon-Z32CLT2cHbBTajhEohDmkp.webp" alt="uae.market" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold tracking-tight text-sm block leading-tight text-foreground">
                      uae.market
                    </span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] leading-none font-medium">
                      ADX & DFM
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          {/* ─── Navigation ─── */}
          <SidebarContent className="gap-0 px-3 pt-2">
            <div className="mb-3">
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/80 px-3 group-data-[collapsible=icon]:hidden">
                Navigation
              </span>
            </div>
            <SidebarMenu className="space-y-0.5">
              {menuItems.map((item: typeof baseMenuItems[number]) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-medium text-[13px] rounded-[10px] ${
                        isActive
                          ? "bg-gradient-to-r from-primary/12 to-neon-purple/6 text-foreground shadow-[0_0_1px_oklch(0.75_0.17_195/25%),inset_0_0_12px_oklch(0.75_0.17_195/5%)]"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                      }`}
                    >
                      <item.icon
                        className={`h-[18px] w-[18px] transition-all ${
                          isActive
                            ? "text-primary drop-shadow-[0_0_4px_oklch(0.75_0.17_195/40%)]"
                            : "opacity-60"
                        }`}
                      />
                      <span className="tracking-[0.01em]">{item.label}</span>
                      {isActive && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary neon-pulse-live" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          {/* ─── Footer / User ─── */}
          <SidebarFooter className="p-3">
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-accent/40 transition-all w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-transparent hover:border-border/30">
                    <Avatar className="h-8 w-8 border border-primary/20 shrink-0">
                      <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary/20 to-neon-purple/10 text-primary">
                        {user?.name?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                      <p className="text-sm font-medium truncate leading-none text-foreground/90">
                        {user?.name || "-"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate mt-1">
                        {user?.email || "-"}
                      </p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="group-data-[collapsible=icon]:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                  onClick={() => {
                    window.location.href = getLoginUrl();
                  }}
                >
                  Sign in
                </Button>
              </div>
            )}
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${
            isCollapsed ? "hidden" : ""
          }`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {/* ─── Top Bar ─── */}
        <div className="flex h-14 items-center justify-between px-4 sticky top-0 z-40 glass-strong border-b border-border/30">
          <div className="flex items-center gap-3">
            {isMobile && (
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-secondary/60 border border-border/40 hover:border-primary/30 transition-all" />
            )}
            <div className="flex items-center gap-2.5">
              {isMobile && (
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/15 to-neon-purple/8 flex items-center justify-center border border-primary/15">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <span className="tracking-tight text-foreground/90 font-medium text-sm hidden sm:inline">
                {activeMenuItem?.label ?? "uae.market"}
              </span>
            </div>
            <MarketStatusBadge />
          </div>
          <div className="flex items-center gap-2">
            {toggleTheme && (
              <button
                onClick={toggleTheme}
                className="theme-toggle"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}
            <NotificationCenter />
          </div>
        </div>

        {/* ─── Main Content ─── */}
        <main className={`flex-1 p-3 sm:p-4 lg:p-6 ${isMobile ? "pb-20" : ""}`}>{children}</main>

        {/* ─── Footer ─── */}
        <footer className={`border-t border-border/30 px-4 py-4 ${isMobile ? "mb-16" : ""}`}>
          <div className="flex flex-col items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
              <img src="https://d2xsxph8kpxj0f.cloudfront.net/86205309/DiXZqGqijcrECmHgT5LC5F/aboood-ai-logo-new_f66f6c69.png" alt="" className="h-4 w-4 rounded-full" />
              Aboood.ai Network
            </span>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a href="https://wg.aboood.ai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-emerald-400 transition-colors" title="WhatsApp Group">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WA Group
              </a>
              <a href="https://whatsapp-channel.aboood.ai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-emerald-400 transition-colors" title="WhatsApp Channel">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WA Channel
              </a>
              <a href="https://telegram-group.aboood.ai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-sky-400 transition-colors" title="Telegram Group">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                TG Group
              </a>
              <a href="https://telegram-channel.aboood.ai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-sky-400 transition-colors" title="Telegram Channel">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                TG Channel
              </a>
              <span className="text-border/50">|</span>
              <a href="https://chat.aboood.ai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-violet-400 transition-colors" title="Aboood Web Analysis">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                Web Analysis
              </a>
              <a href="https://deepmind.aboood.ai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-violet-400 transition-colors" title="Aboood Deepmind">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 014 4v1a2 2 0 012 2v1a2 2 0 01-2 2 4 4 0 01-8 0 2 2 0 01-2-2V9a2 2 0 012-2V6a4 4 0 014-4z"/><path d="M8 14v.5a4 4 0 008 0V14"/><path d="M12 18v4"/><path d="M8 22h8"/></svg>
                Deepmind
              </a>
              <a href="https://www.uae.market" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-amber-400 transition-colors" title="UAE Stock Market Live Prices">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                UAE Market
              </a>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
              <a href="https://www.aboood.ai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-muted-foreground transition-colors">
                <img src="https://d2xsxph8kpxj0f.cloudfront.net/86205309/DiXZqGqijcrECmHgT5LC5F/aboood-ai-logo-new_f66f6c69.png" alt="Aboood.AI" className="h-4 w-4 rounded-full ring-1 ring-white/10" />
                www.aboood.ai
              </a>
              <span>|</span>
              <span>{APP_VERSION}</span>
            </div>
          </div>
        </footer>

        {/* ─── Mobile Bottom Navigation ─── */}
        {isMobile && (
          <nav className="mobile-bottom-nav">
            <div className="flex items-center justify-around px-2">
              {mobileNavItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => setLocation(item.path)}
                    className={`mobile-nav-item ${isActive ? "active" : "text-muted-foreground"}`}
                  >
                    <div
                      className={`mobile-nav-icon rounded-lg p-1.5 transition-all ${
                        isActive ? "" : ""
                      }`}
                    >
                      <item.icon
                        className={`h-5 w-5 ${
                          isActive
                            ? "text-primary drop-shadow-[0_0_4px_oklch(0.75_0.17_195/40%)]"
                            : ""
                        }`}
                      />
                    </div>
                    <span
                      className={`text-[9px] font-semibold leading-none tracking-wide ${
                        isActive ? "text-primary" : ""
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </SidebarInset>
    </>
  );
}
