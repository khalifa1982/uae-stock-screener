import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import TerminalLayout from "./components/TerminalLayout";
import { lazy, Suspense } from "react";

// ─── Eagerly loaded (lightweight auth pages) ────────────────────────
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

// ─── Eagerly loaded (main landing page for fast first paint) ────────
import Home from "./pages/Home";
import NotFound from "@/pages/NotFound";

// ─── Lazily loaded (heavy pages with charts, data tables, etc.) ─────
const StockDetail = lazy(() => import("./pages/StockDetail"));
const Screener = lazy(() => import("./pages/Screener"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Watchlist = lazy(() => import("./pages/Watchlist"));
const Heatmap = lazy(() => import("./pages/Heatmap"));
const Admin = lazy(() => import("./pages/Admin"));
const Calendar = lazy(() => import("./pages/Calendar"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const MarketNews = lazy(() => import("./pages/MarketNews"));
const MarketSummary = lazy(() => import("./pages/MarketSummary"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Profile = lazy(() => import("./pages/Profile"));
const Compare = lazy(() => import("./pages/Compare"));

// ─── Loading fallback ───────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Auth pages outside dashboard layout */}
      <Route path={"/login"} component={Login} />
      <Route path={"/forgot-password"} component={ForgotPassword} />
      <Route path={"/reset-password"} component={ResetPassword} />
      
      {/* All other routes inside dashboard layout */}
      <Route>
        <TerminalLayout>
          <Suspense fallback={<PageLoader />}>
            <Switch>
              <Route path={"/"} component={Home} />
              <Route path={"/screener"} component={Screener} />
              <Route path={"/alerts"} component={Alerts} />
              <Route path={"/watchlist"} component={Watchlist} />
              <Route path={"/heatmap"} component={Heatmap} />
              <Route path={"/calendar"} component={Calendar} />
              <Route path={"/news"} component={MarketNews} />
              <Route path={"/summary"} component={MarketSummary} />
              <Route path={"/notifications"} component={NotificationSettings} />
              <Route path={"/admin"} component={Admin} />
              <Route path={"/compare"} component={Compare} />
              <Route path={"/analytics"} component={Analytics} />
              <Route path={"/profile"} component={Profile} />
              <Route path={"/stock/:symbol"} component={StockDetail} />
              <Route path={"/404"} component={NotFound} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </TerminalLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable={true}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
