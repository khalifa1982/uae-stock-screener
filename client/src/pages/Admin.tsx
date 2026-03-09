import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Activity, AlertCircle, CheckCircle2, Clock, Database, ExternalLink,
  Globe, Key, Loader2, RefreshCw, Server, Shield, Wifi, WifiOff, Zap,
  BarChart3, TrendingUp, ChevronDown, ChevronUp,
} from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────

interface ApiSource {
  id: string;
  name: string;
  description: string;
  website: string;
  type: "api-key" | "free-api" | "web-scraping" | "built-in";
  status: "connected" | "disconnected" | "error" | "checking" | "limited";
  statusMessage: string | null;
  lastChecked: string | null;
  lastSuccessfulFetch: string | null;
  totalRequests: number;
  failedRequests: number;
  successRate: string;
  features: string[];
  dataProvided: string[];
  requiresApiKey: boolean;
  apiKeyConfigured: boolean;
  stocksCovered: number;
  extra: Record<string, any>;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "connected": return "text-emerald-400";
    case "disconnected": return "text-zinc-500";
    case "error": return "text-red-400";
    case "limited": return "text-amber-400";
    case "checking": return "text-blue-400";
    default: return "text-zinc-500";
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "connected":
      return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1"><CheckCircle2 className="w-3 h-3" /> Connected</Badge>;
    case "disconnected":
      return <Badge className="bg-zinc-500/15 text-zinc-400 border-zinc-500/30 gap-1"><WifiOff className="w-3 h-3" /> Disconnected</Badge>;
    case "error":
      return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 gap-1"><AlertCircle className="w-3 h-3" /> Error</Badge>;
    case "limited":
      return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1"><Shield className="w-3 h-3" /> Limited</Badge>;
    case "checking":
      return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Checking</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case "api-key": return <Key className="w-4 h-4 text-amber-400" />;
    case "free-api": return <Zap className="w-4 h-4 text-emerald-400" />;
    case "web-scraping": return <Globe className="w-4 h-4 text-purple-400" />;
    case "built-in": return <Server className="w-4 h-4 text-blue-400" />;
    default: return <Activity className="w-4 h-4" />;
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case "api-key": return "API Key";
    case "free-api": return "Free API";
    case "web-scraping": return "Web Scraping";
    case "built-in": return "Built-in";
    default: return type;
  }
}

// ─── Logo Components ─────────────────────────────────────────────────

function TwelveDataLogo() {
  return (
    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-sm shrink-0">
      12
    </div>
  );
}

function TradingViewLogo() {
  return (
    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shrink-0">
      <TrendingUp className="w-5 h-5 text-white" />
    </div>
  );
}

function SimplyWallStLogo() {
  return (
    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-700 flex items-center justify-center shrink-0">
      <BarChart3 className="w-5 h-5 text-white" />
    </div>
  );
}

function YahooLogo() {
  return (
    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white font-bold text-sm shrink-0">
      Y!
    </div>
  );
}

function getSourceLogo(id: string) {
  switch (id) {
    case "twelvedata": return <TwelveDataLogo />;
    case "tradingview": return <TradingViewLogo />;
    case "simplywall": return <SimplyWallStLogo />;
    case "yahoo": return <YahooLogo />;
    default: return <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><Database className="w-5 h-5" /></div>;
  }
}

// ─── API Source Card ─────────────────────────────────────────────────

function ApiSourceCard({ source }: { source: ApiSource }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="bg-card/50 border-border/50 hover:border-border transition-colors">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start gap-4">
          {getSourceLogo(source.id)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground">{source.name}</h3>
              {getStatusBadge(source.status)}
              <Badge variant="outline" className="gap-1 text-xs">
                {getTypeIcon(source.type)}
                {getTypeLabel(source.type)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{source.description}</p>
          </div>
          <a
            href={source.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-background/50 rounded-lg p-2.5 text-center">
            <div className="text-xs text-muted-foreground">Stocks</div>
            <div className="text-lg font-semibold text-foreground">{source.stocksCovered || "—"}</div>
          </div>
          <div className="bg-background/50 rounded-lg p-2.5 text-center">
            <div className="text-xs text-muted-foreground">Requests</div>
            <div className="text-lg font-semibold text-foreground">{source.totalRequests}</div>
          </div>
          <div className="bg-background/50 rounded-lg p-2.5 text-center">
            <div className="text-xs text-muted-foreground">Success</div>
            <div className="text-lg font-semibold text-foreground">{source.successRate}</div>
          </div>
          <div className="bg-background/50 rounded-lg p-2.5 text-center">
            <div className="text-xs text-muted-foreground">Last Fetch</div>
            <div className="text-sm font-medium text-foreground">{formatTimeAgo(source.lastSuccessfulFetch)}</div>
          </div>
        </div>

        {/* API Key Warning */}
        {source.requiresApiKey && !source.apiKeyConfigured && (
          <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-sm text-amber-300">API key not configured. Add it in Settings &gt; Secrets.</span>
          </div>
        )}

        {/* Error Message */}
        {source.statusMessage && source.status !== "connected" && (
          <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-sm text-red-300 truncate">{source.statusMessage}</span>
          </div>
        )}

        {/* Expand/Collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Hide details" : "Show features & data"}
        </button>

        {expanded && (
          <div className="mt-3 space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
            {/* Features */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5">Features</div>
              <div className="flex flex-wrap gap-1.5">
                {source.features.map((f) => (
                  <Badge key={f} variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary/80">
                    {f}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Data Provided */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5">Data Provided</div>
              <div className="flex flex-wrap gap-1.5">
                {source.dataProvided.map((d) => (
                  <Badge key={d} variant="outline" className="text-xs bg-secondary/50">
                    {d}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Extra Info */}
            {Object.keys(source.extra).length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5">Additional Info</div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(source.extra).map(([key, value]) => (
                    <div key={key} className="text-xs">
                      <span className="text-muted-foreground">{key}: </span>
                      <span className="text-foreground">{String(value ?? "N/A")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="flex gap-4 text-xs text-muted-foreground pt-1 border-t border-border/30">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Checked: {formatTimeAgo(source.lastChecked)}
              </span>
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Failed: {source.failedRequests}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Admin Page ─────────────────────────────────────────────────

export default function Admin() {
  const [isChecking, setIsChecking] = useState(false);

  const healthQuery = trpc.admin.apiHealthCheck.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  const utils = trpc.useUtils();

  const handleRefresh = useCallback(async () => {
    setIsChecking(true);
    try {
      await utils.admin.apiHealthCheck.invalidate();
      toast.success("Health checks refreshed");
    } catch {
      toast.error("Failed to refresh health checks");
    } finally {
      setIsChecking(false);
    }
  }, [utils]);

  const data = healthQuery.data;
  const isLoading = healthQuery.isLoading;

  // Overall health indicator
  const healthColor = data?.overallHealth === "healthy"
    ? "text-emerald-400"
    : data?.overallHealth === "degraded"
    ? "text-amber-400"
    : "text-red-400";

  const healthBg = data?.overallHealth === "healthy"
    ? "bg-emerald-500/10 border-emerald-500/20"
    : data?.overallHealth === "degraded"
    ? "bg-amber-500/10 border-amber-500/20"
    : "bg-red-500/10 border-red-500/20";

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">API Data Sources</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and manage all connected data feeds powering the stock screener
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isChecking || isLoading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? "animate-spin" : ""}`} />
          {isChecking ? "Checking..." : "Refresh All"}
        </Button>
      </div>

      {/* Overall Health Banner */}
      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : data ? (
        <div className={`rounded-xl border p-4 ${healthBg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${healthBg}`}>
                {data.overallHealth === "healthy" ? (
                  <Wifi className={`w-5 h-5 ${healthColor}`} />
                ) : data.overallHealth === "degraded" ? (
                  <AlertCircle className={`w-5 h-5 ${healthColor}`} />
                ) : (
                  <WifiOff className={`w-5 h-5 ${healthColor}`} />
                )}
              </div>
              <div>
                <div className={`font-semibold ${healthColor}`}>
                  {data.overallHealth === "healthy" ? "All Systems Operational" :
                   data.overallHealth === "degraded" ? "Partial Service Degradation" :
                   "Critical: Most Services Down"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {data.connectedSources} of {data.totalSources} data sources connected
                </div>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Last full check</div>
              <div>{formatTimeAgo(data.lastFullCheck)}</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-card/50">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-foreground">{data.totalSources}</div>
              <div className="text-xs text-muted-foreground mt-1">Total Sources</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-emerald-400">{data.connectedSources}</div>
              <div className="text-xs text-muted-foreground mt-1">Connected</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-foreground">
                {data.sources.reduce((sum, s) => sum + s.totalRequests, 0)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Total Requests</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-foreground">
                {Math.max(...data.sources.map(s => s.stocksCovered))}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Max Coverage</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* API Source Cards */}
      <div className="space-y-3">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))
        ) : data ? (
          data.sources.map((source) => (
            <ApiSourceCard key={source.id} source={source} />
          ))
        ) : (
          <Card className="bg-card/50">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Failed to load API status. Try refreshing.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Data Flow Diagram */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Data Flow Architecture</CardTitle>
          <CardDescription>How data flows from sources to the application</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sources Column */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Data Sources</div>
              {data?.sources.map((s) => (
                <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/50">
                  <div className={`w-2 h-2 rounded-full ${s.status === "connected" ? "bg-emerald-400" : "bg-zinc-500"}`} />
                  <span className="text-sm text-foreground">{s.name}</span>
                </div>
              )) || [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-9" />)}
            </div>

            {/* Processing Column */}
            <div className="space-y-2 flex flex-col items-center justify-center">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Processing</div>
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center w-full">
                <Server className="w-5 h-5 text-primary mx-auto mb-1" />
                <div className="text-sm font-medium text-foreground">API Aggregator</div>
                <div className="text-xs text-muted-foreground">Merge & Normalize</div>
              </div>
              <div className="text-muted-foreground">↓</div>
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center w-full">
                <Database className="w-5 h-5 text-primary mx-auto mb-1" />
                <div className="text-sm font-medium text-foreground">Database</div>
                <div className="text-xs text-muted-foreground">Persist & Cache</div>
              </div>
            </div>

            {/* Output Column */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Application</div>
              {["Dashboard", "Screener", "Stock Profiles", "Volume Alerts", "Watchlist", "Heatmap"].map((item) => (
                <div key={item} className="flex items-center gap-2 p-2 rounded-lg bg-background/50">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-sm text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
