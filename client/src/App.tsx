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
import DashboardLayout from "./components/DashboardLayout";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/screener"} component={Screener} />
        <Route path={"/alerts"} component={Alerts} />
        <Route path={"/watchlist"} component={Watchlist} />
        <Route path={"/heatmap"} component={Heatmap} />
        <Route path={"/calendar"} component={Calendar} />
        <Route path={"/notifications"} component={NotificationSettings} />
        <Route path={"/admin"} component={Admin} />
        <Route path={"/stock/:symbol"} component={StockDetail} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
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
