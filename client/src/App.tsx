import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import StockDetail from "./pages/StockDetail";
import Screener from "./pages/Screener";
import Alerts from "./pages/Alerts";
import Watchlist from "./pages/Watchlist";
import Heatmap from "./pages/Heatmap";
import Admin from "./pages/Admin";
import Calendar from "./pages/Calendar";
import NotificationSettings from "./pages/NotificationSettings";
import MarketNews from "./pages/MarketNews";
import MarketSummary from "./pages/MarketSummary";
import TerminalLayout from "./components/TerminalLayout";
import { LiveChat } from "./components/LiveChat";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Analytics from "./pages/Analytics";

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
            <Route path={"/analytics"} component={Analytics} />
            <Route path={"/profile"} component={Profile} />
            <Route path={"/stock/:symbol"} component={StockDetail} />
            <Route path={"/404"} component={NotFound} />
            <Route component={NotFound} />
          </Switch>
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
          <LiveChat />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
