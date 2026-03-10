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
  Filter,
  Grid3X3,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Settings2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { MarketStatusBadge } from "@/components/MarketStatusIndicator";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Filter, label: "Screener", path: "/screener" },
  { icon: Bell, label: "Alerts", path: "/alerts" },
  { icon: Eye, label: "Watchlist", path: "/watchlist" },
  { icon: Grid3X3, label: "Heatmap", path: "/heatmap" },
  { icon: CalendarDays, label: "Calendar", path: "/calendar" },
  { icon: BellRing, label: "Notifications", path: "/notifications" },
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
  const activeMenuItem = menuItems.find((item) => item.path === location);
  const isMobile = useIsMobile();

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
                    <span className="text-[9px] text-muted-foreground/60 uppercase tracking-[0.15em] leading-none font-medium">
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
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50 px-3 group-data-[collapsible=icon]:hidden">
                Navigation
              </span>
            </div>
            <SidebarMenu className="space-y-0.5">
              {menuItems.map((item) => {
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
                      <p className="text-[11px] text-muted-foreground/60 truncate mt-1">
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
            <NotificationCenter />
          </div>
        </div>

        {/* ─── Main Content ─── */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6">{children}</main>

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
