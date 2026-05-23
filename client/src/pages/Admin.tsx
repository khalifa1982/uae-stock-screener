import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, AlertCircle, CheckCircle2, Clock, Database, ExternalLink,
  Globe, Key, Loader2, RefreshCw, Server, Shield, Wifi, WifiOff, Zap,
  BarChart3, TrendingUp, ChevronDown, ChevronUp, ArrowRight,
  LineChart, PieChart, Brain, Bell, Users, Layers,
  CreditCard, Gauge, RotateCcw, HardDrive,
} from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";

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

function getSourceLogo(id: string) {
  switch (id) {
    case "twelvedata":
      return (
        <div className="w-10 h-10 rounded bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-[11px] shrink-0">
          12
        </div>
      );
    case "tradingview":
      return (
        <div className="w-10 h-10 rounded bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shrink-0">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
      );
    case "scrapfly":
      return (
        <div className="w-10 h-10 rounded bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shrink-0">
          <Layers className="w-5 h-5 text-white" />
        </div>
      );
    case "stockanalysis":
      return (
        <div className="w-10 h-10 rounded bg-gradient-to-br from-green-600 to-teal-700 flex items-center justify-center shrink-0">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
      );
    case "marketscreener":
      return (
        <div className="w-10 h-10 rounded bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
          <PieChart className="w-5 h-5 text-white" />
        </div>
      );
    case "investingcom":
      return (
        <div className="w-10 h-10 rounded bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center shrink-0">
          <LineChart className="w-5 h-5 text-white" />
        </div>
      );
    case "simplywall":
      return (
        <div className="w-10 h-10 rounded bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center shrink-0">
          <Activity className="w-5 h-5 text-white" />
        </div>
      );
    default:
      return <div className="w-10 h-10 rounded bg-muted flex items-center justify-center"><Database className="w-5 h-5" /></div>;
  }
}

// ─── API Source Card ─────────────────────────────────────────────────

function ApiSourceCard({ source }: { source: ApiSource }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="bg-card/50 border-border/50 hover:border-border transition-colors">
      <CardContent className="p-2">
        {/* Header */}
        <div className="flex items-start gap-1.5">
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
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{source.description}</p>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mt-4">
          <div className="bg-background/50 rounded p-2.5 text-center">
            <div className="text-xs text-muted-foreground">Stocks</div>
            <div className="text-[11px] font-semibold text-foreground">{source.stocksCovered || "—"}</div>
          </div>
          <div className="bg-background/50 rounded p-2.5 text-center">
            <div className="text-xs text-muted-foreground">Requests</div>
            <div className="text-[11px] font-semibold text-foreground">{source.totalRequests}</div>
          </div>
          <div className="bg-background/50 rounded p-2.5 text-center">
            <div className="text-xs text-muted-foreground">Success</div>
            <div className="text-[11px] font-semibold text-foreground">{source.successRate}</div>
          </div>
          <div className="bg-background/50 rounded p-2.5 text-center">
            <div className="text-xs text-muted-foreground">Last Fetch</div>
            <div className="text-[11px] font-medium text-foreground">{formatTimeAgo(source.lastSuccessfulFetch)}</div>
          </div>
        </div>

        {/* API Key Warning */}
        {source.requiresApiKey && !source.apiKeyConfigured && (
          <div className="mt-3 p-2.5 rounded bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-[11px] text-amber-300">API key not configured. Add it in Settings &gt; Secrets.</span>
          </div>
        )}

        {/* Error Message */}
        {source.statusMessage && source.status !== "connected" && (
          <div className="mt-3 p-2.5 rounded bg-red-500/10 border border-red-500/20 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-[11px] text-red-300 truncate">{source.statusMessage}</span>
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
            <div className="flex gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border/30">
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

// ─── Data Flow Diagram ──────────────────────────────────────────────

function DataFlowDiagram({ sources }: { sources?: ApiSource[] }) {
  const getStatusDot = (id: string) => {
    const source = sources?.find(s => s.id === id);
    return source?.status === "connected" ? "bg-emerald-400" : "bg-zinc-500";
  };

  // Group sources by type for the diagram
  const directApis = [
    { id: "twelvedata", name: "TwelveData", icon: "12", color: "from-blue-600 to-blue-800" },
    { id: "tradingview", name: "TradingView", icon: "TV", color: "from-blue-500 to-indigo-700" },
  ];

  const scrapflySources = [
    { id: "stockanalysis", name: "StockAnalysis.com", color: "from-green-600 to-teal-700" },
    { id: "marketscreener", name: "MarketScreener.com", color: "from-cyan-500 to-blue-600" },
    { id: "investingcom", name: "Investing.com", color: "from-emerald-500 to-green-700" },
    { id: "simplywall", name: "SimplyWall.St", color: "from-yellow-500 to-orange-600" },
  ];

  const directScraping: { id: string; name: string; color: string }[] = [];

  const appFeatures = [
    { name: "Dashboard", icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { name: "Screener", icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { name: "Stock Profiles", icon: <LineChart className="w-3.5 h-3.5" /> },
    { name: "Financials", icon: <PieChart className="w-3.5 h-3.5" /> },
    { name: "Ownership & ESG", icon: <Users className="w-3.5 h-3.5" /> },
    { name: "Dividends", icon: <Activity className="w-3.5 h-3.5" /> },
    { name: "Aboood.AI Thoughts", icon: <Brain className="w-3.5 h-3.5" /> },
    { name: "Volume Alerts", icon: <Bell className="w-3.5 h-3.5" /> },
    { name: "Watchlist", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { name: "Heatmap", icon: <Layers className="w-3.5 h-3.5" /> },
    { name: "Live Ticker", icon: <Wifi className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      {/* ── Row 1: Data Sources ── */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          External Data Sources
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Direct APIs */}
          <div className="space-y-2">
            <div className="text-[11px] font-medium text-blue-400 mb-2">Direct APIs</div>
            {directApis.map((api) => (
              <div key={api.id} className="flex items-center gap-2 p-2 rounded bg-background/50 border border-border/30">
                <div className={`w-2 h-2 rounded-full ${getStatusDot(api.id)}`} />
                <div className={`w-6 h-6 rounded bg-gradient-to-br ${api.color} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                  {api.icon}
                </div>
                <span className="text-[11px] text-foreground font-medium">{api.name}</span>
              </div>
            ))}
          </div>

          {/* Scrapfly-proxied sources */}
          <div className="space-y-2">
            <div className="text-[11px] font-medium text-orange-400 mb-2">Via Scrapfly.io Proxy</div>
            <div className="p-2 rounded border border-orange-500/30 bg-orange-500/5 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${getStatusDot("scrapfly")}`} />
                <Layers className="w-4 h-4 text-orange-400" />
                <span className="text-[11px] text-orange-300 font-semibold">Scrapfly.io</span>
                <Badge className="text-[9px] bg-orange-500/15 text-orange-400 border-orange-500/30">Proxy</Badge>
              </div>
              {scrapflySources.map((src) => (
                <div key={src.id} className="flex items-center gap-2 p-1.5 rounded bg-background/30 ml-4">
                  <div className={`w-2 h-2 rounded-full ${getStatusDot(src.id)}`} />
                  <span className="text-[11px] text-foreground">{src.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="space-y-2">
            <div className="text-[11px] font-medium text-green-400 mb-2">Connection Summary</div>
            <div className="p-3 rounded bg-background/50 border border-border/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Total Sources</span>
                <span className="text-[11px] font-bold text-foreground">7</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Direct APIs</span>
                <span className="text-[11px] font-medium text-blue-400">2</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Via Scrapfly</span>
                <span className="text-[11px] font-medium text-orange-400">4</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Free APIs</span>
                <span className="text-[11px] font-medium text-purple-400">1 (TradingView)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Arrow Row ── */}
      <div className="flex items-center justify-center gap-2 text-muted-foreground">
        <div className="h-px flex-1 bg-border/50" />
        <ArrowRight className="w-5 h-5 text-primary/60" />
        <span className="text-xs text-muted-foreground">Data Pipeline</span>
        <ArrowRight className="w-5 h-5 text-primary/60" />
        <div className="h-px flex-1 bg-border/50" />
      </div>

      {/* ── Row 2: Processing Layer ── */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Processing Layer
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-3 bg-primary/10 border border-primary/20 text-center">
            <Server className="w-5 h-5 text-primary mx-auto mb-1" />
            <div className="text-[11px] font-medium text-foreground">tRPC Server</div>
            <div className="text-[10px] text-muted-foreground">API Routing</div>
          </div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-center">
            <Globe className="w-5 h-5 text-purple-400 mx-auto mb-1" />
            <div className="text-[11px] font-medium text-foreground">Scrapfly Service</div>
            <div className="text-[10px] text-muted-foreground">HTML Parse & Extract</div>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-center">
            <Database className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <div className="text-[11px] font-medium text-foreground">In-Memory Cache</div>
            <div className="text-[10px] text-muted-foreground">24h TTL per stock</div>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-center">
            <Brain className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <div className="text-[11px] font-medium text-foreground">Aboood.AI Engine</div>
            <div className="text-[10px] text-muted-foreground">Fibonacci + RSI Analysis</div>
          </div>
        </div>
      </div>

      {/* ── Arrow Row ── */}
      <div className="flex items-center justify-center gap-2 text-muted-foreground">
        <div className="h-px flex-1 bg-border/50" />
        <ArrowRight className="w-5 h-5 text-primary/60" />
        <span className="text-xs text-muted-foreground">Frontend</span>
        <ArrowRight className="w-5 h-5 text-primary/60" />
        <div className="h-px flex-1 bg-border/50" />
      </div>

      {/* ── Row 3: Application Features ── */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Application Features
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {appFeatures.map((feat) => (
            <div key={feat.name} className="flex items-center gap-2 p-2 rounded bg-background/50 border border-border/30">
              <div className="text-primary/70">{feat.icon}</div>
              <span className="text-[11px] text-foreground">{feat.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Data Source Mapping Table ── */}
      <div className="mt-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Data Source Mapping
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left p-2 text-muted-foreground font-medium">Feature / Tab</th>
                <th className="text-left p-2 text-muted-foreground font-medium">Primary Source</th>
                <th className="text-left p-2 text-muted-foreground font-medium">Data Fields</th>
                <th className="text-left p-2 text-muted-foreground font-medium">Scraping Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              <tr>
                <td className="p-2 text-foreground font-medium">Overview / Prices</td>
                <td className="p-2"><Badge className="text-[9px] bg-blue-500/15 text-blue-400 border-blue-500/30">TwelveData + TradingView</Badge></td>
                <td className="p-2 text-muted-foreground">OHLCV, Market Cap, P/E, EPS, Volume</td>
                <td className="p-2 text-muted-foreground">Direct API + WebSocket</td>
              </tr>
              <tr>
                <td className="p-2 text-foreground font-medium">Financials (4 sub-tabs)</td>
                <td className="p-2"><Badge className="text-[9px] bg-green-500/15 text-green-400 border-green-500/30">StockAnalysis.com</Badge></td>
                <td className="p-2 text-muted-foreground">210+ fields: Income, Balance Sheet, Cash Flow, Ratios</td>
                <td className="p-2 text-muted-foreground">Scrapfly.io (HTML parse)</td>
              </tr>
              <tr>
                <td className="p-2 text-foreground font-medium">Ownership & ESG</td>
                <td className="p-2"><Badge className="text-[9px] bg-cyan-500/15 text-cyan-400 border-cyan-500/30">MarketScreener.com</Badge></td>
                <td className="p-2 text-muted-foreground">Shareholders, Consensus, ESG MSCI Rating</td>
                <td className="p-2 text-muted-foreground">Scrapfly.io (HTML parse)</td>
              </tr>
              <tr>
                <td className="p-2 text-foreground font-medium">Dividends</td>
                <td className="p-2"><Badge className="text-[9px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Investing.com</Badge></td>
                <td className="p-2 text-muted-foreground">Yield, History, Ex-Date, Payment Date, Analyst Ratings</td>
                <td className="p-2 text-muted-foreground">Scrapfly.io (HTML parse)</td>
              </tr>
              <tr>
                <td className="p-2 text-foreground font-medium">Valuation & Risk</td>
                <td className="p-2"><Badge className="text-[9px] bg-yellow-500/15 text-yellow-400 border-yellow-500/30">SimplyWall.St</Badge></td>
                <td className="p-2 text-muted-foreground">Snowflake Scores, Fair Value, Risk Level</td>
                <td className="p-2 text-muted-foreground">Scrapfly.io ASP (__REACT_QUERY_STATE__)</td>
              </tr>
              <tr>
                <td className="p-2 text-foreground font-medium">Technical Analysis</td>
                <td className="p-2"><Badge className="text-[9px] bg-indigo-500/15 text-indigo-400 border-indigo-500/30">TradingView Scanner</Badge></td>
                <td className="p-2 text-muted-foreground">RSI, MACD, SMA, EMA, Stochastic, ADX, CCI, BB</td>
                <td className="p-2 text-muted-foreground">Free Scanner API</td>
              </tr>
              <tr>
                <td className="p-2 text-foreground font-medium">Aboood.AI Thoughts</td>
                <td className="p-2"><Badge className="text-[9px] bg-amber-500/15 text-amber-400 border-amber-500/30">TwelveData + Engine</Badge></td>
                <td className="p-2 text-muted-foreground">Fibonacci Levels, RSI Divergence, Entry/Exit Signals</td>
                <td className="p-2 text-muted-foreground">Computed from OHLCV data</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Page ─────────────────────────────────────────────────

export default function Admin() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [isChecking, setIsChecking] = useState(false);

  // Only admin users can access this page
  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-1.5">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-[11px] font-semibold">Access Denied</h2>
            <p className="text-[11px] text-muted-foreground">
              This page is restricted to administrators only.
            </p>
            <Button onClick={() => setLocation("/")} variant="outline">Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
    <div className="p-2 md:p-2 max-w-6xl mx-auto space-y-2">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xs font-bold text-foreground">API Data Sources</h1>
          <p className="text-[11px] text-muted-foreground mt-1">
            Monitor and manage all {data?.totalSources || 7} connected data feeds powering the stock screener
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation('/analytics')}
            className="gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            Site Analytics
          </Button>
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
      </div>

      {/* Overall Health Banner */}
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : data ? (
        <div className={`border p-2 ${healthBg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <div className={`p-2 rounded ${healthBg}`}>
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
                <div className="text-[11px] text-muted-foreground">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
          <Card className="bg-card/50">
            <CardContent className="p-2 text-center">
              <div className="text-[11px] font-bold text-foreground">{data.totalSources}</div>
              <div className="text-xs text-muted-foreground mt-1">Total Sources</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-2 text-center">
              <div className="text-[11px] font-bold text-emerald-400">{data.connectedSources}</div>
              <div className="text-xs text-muted-foreground mt-1">Connected</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-2 text-center">
              <div className="text-[11px] font-bold text-foreground">
                {data.sources.reduce((sum, s) => sum + s.totalRequests, 0)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Total Requests</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-2 text-center">
              <div className="text-[11px] font-bold text-purple-400">
                {data.sources.filter(s => s.type === 'web-scraping').length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Scraping Sources</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* API Source Cards */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-foreground">Source Health Status</h2>
        {isLoading ? (
          [1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-48" />
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

      {/* ── Scrapfly Credit Monitor ── */}
      <ScrapflyCreditMonitorPanel />

      {/* ── Cache Hit/Miss Metrics ── */}
      <CacheMetricsPanel />

      {/* Data Flow Diagram */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-xs">Data Flow Architecture</CardTitle>
          <CardDescription>
            How data flows from 7 external sources through the Scrapfly proxy and processing layer to the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataFlowDiagram sources={data?.sources} />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Scrapfly Credit Monitor Panel ──────────────────────────────────

function ScrapflyCreditMonitorPanel() {
  const creditQuery = trpc.admin.creditMonitor.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 60000,
  });
  const utils = trpc.useUtils();
  const forceCheck = trpc.admin.forceCheckCredits.useMutation({
    onSuccess: () => {
      utils.admin.creditMonitor.invalidate();
      toast.success("Credit check completed");
    },
    onError: () => toast.error("Failed to check credits"),
  });

  const data = creditQuery.data;
  const credits = data?.currentCredits;
  const total = data?.totalCredits;
  const usagePercent = credits != null && total != null && total > 0
    ? ((total - credits) / total) * 100
    : 0;

  const creditColor = credits == null
    ? "text-muted-foreground"
    : credits < 250
    ? "text-red-400"
    : credits < 1000
    ? "text-amber-400"
    : "text-emerald-400";

  const progressColor = credits == null
    ? "bg-muted"
    : credits < 250
    ? "bg-red-500"
    : credits < 1000
    ? "bg-amber-500"
    : "bg-emerald-500";

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-orange-400" />
            <CardTitle className="text-xs">Scrapfly Credit Monitor</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {data?.running && (
              <Badge className="text-[9px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1">
                <Activity className="w-3 h-3" /> Active
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => forceCheck.mutate()}
              disabled={forceCheck.isPending}
              className="h-7 text-xs gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${forceCheck.isPending ? "animate-spin" : ""}`} />
              Check Now
            </Button>
          </div>
        </div>
        <CardDescription>
          Monitors Scrapfly.io API credits and sends alerts when below threshold (warning &lt; 1,000 / critical &lt; 250)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {creditQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : data ? (
          <div className="space-y-4">
            {/* Credit gauge */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-baseline justify-between mb-2">
                  <span className={`text-2xl font-bold ${creditColor}`}>
                    {credits != null ? credits.toLocaleString() : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    of {total != null ? total.toLocaleString() : "—"} credits
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${progressColor}`}
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {usagePercent.toFixed(1)}% used
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {data.usedCredits != null ? data.usedCredits.toLocaleString() : "—"} consumed
                  </span>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-background/50 rounded p-2 text-center">
                <div className="text-[10px] text-muted-foreground">Checks</div>
                <div className="text-xs font-semibold">{data.checkCount}</div>
              </div>
              <div className="bg-background/50 rounded p-2 text-center">
                <div className="text-[10px] text-muted-foreground">Alerts Sent</div>
                <div className="text-xs font-semibold text-amber-400">{data.alertsSent}</div>
              </div>
              <div className="bg-background/50 rounded p-2 text-center">
                <div className="text-[10px] text-muted-foreground">Last Check</div>
                <div className="text-xs font-medium">{formatTimeAgo(data.lastCheck)}</div>
              </div>
              <div className="bg-background/50 rounded p-2 text-center">
                <div className="text-[10px] text-muted-foreground">Last Alert</div>
                <div className="text-xs font-medium">
                  {data.lastAlertSent ? (
                    <span className={data.lastAlertLevel === "critical" ? "text-red-400" : "text-amber-400"}>
                      {data.lastAlertLevel?.toUpperCase()} {formatTimeAgo(data.lastAlertSent)}
                    </span>
                  ) : "None"}
                </div>
              </div>
            </div>

            {/* Threshold indicators */}
            {credits != null && credits < 1000 && (
              <div className={`p-2.5 rounded border ${
                credits < 250
                  ? "bg-red-500/10 border-red-500/20"
                  : "bg-amber-500/10 border-amber-500/20"
              }`}>
                <div className="flex items-center gap-2">
                  <AlertCircle className={`w-4 h-4 ${
                    credits < 250 ? "text-red-400" : "text-amber-400"
                  }`} />
                  <span className={`text-xs ${
                    credits < 250 ? "text-red-300" : "text-amber-300"
                  }`}>
                    {credits < 250
                      ? "CRITICAL: Credits extremely low! Scraping services will stop when credits reach 0."
                      : "WARNING: Credits running low. Consider topping up your Scrapfly account."}
                  </span>
                </div>
              </div>
            )}

            {data.errors > 0 && (
              <div className="text-[10px] text-muted-foreground">
                Errors: {data.errors} {data.lastError && `— ${data.lastError}`}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-muted-foreground text-xs p-4">
            Failed to load credit monitor data
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Cache Metrics Panel ────────────────────────────────────────────

function CacheMetricsPanel() {
  const cacheQuery = trpc.admin.cacheMetrics.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });
  const utils = trpc.useUtils();
  const resetMutation = trpc.admin.resetCacheMetrics.useMutation({
    onSuccess: () => {
      utils.admin.cacheMetrics.invalidate();
      toast.success("Cache metrics reset");
    },
  });

  const data = cacheQuery.data;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-blue-400" />
            <CardTitle className="text-xs">Cache Hit/Miss Metrics</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => utils.admin.cacheMetrics.invalidate()}
              className="h-7 text-xs gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="h-7 text-xs gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
          </div>
        </div>
        <CardDescription>
          Cache hit rates per data source — higher rates mean fewer API calls and faster responses
        </CardDescription>
      </CardHeader>
      <CardContent>
        {cacheQuery.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : data ? (
          <div className="space-y-4">
            {/* Overall summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className="bg-background/50 rounded p-2.5 text-center">
                <div className="text-[10px] text-muted-foreground">Overall Hit Rate</div>
                <div className="text-lg font-bold text-foreground">{data.totals.overallHitRate}</div>
              </div>
              <div className="bg-background/50 rounded p-2.5 text-center">
                <div className="text-[10px] text-muted-foreground">Total Hits</div>
                <div className="text-sm font-semibold text-emerald-400">{data.totals.totalHits.toLocaleString()}</div>
              </div>
              <div className="bg-background/50 rounded p-2.5 text-center">
                <div className="text-[10px] text-muted-foreground">Total Misses</div>
                <div className="text-sm font-semibold text-red-400">{data.totals.totalMisses.toLocaleString()}</div>
              </div>
              <div className="bg-background/50 rounded p-2.5 text-center">
                <div className="text-[10px] text-muted-foreground">Total Requests</div>
                <div className="text-sm font-semibold">{data.totals.totalRequests.toLocaleString()}</div>
              </div>
              <div className="bg-background/50 rounded p-2.5 text-center">
                <div className="text-[10px] text-muted-foreground">Cached Entries</div>
                <div className="text-sm font-semibold text-blue-400">{data.totals.totalCacheEntries}</div>
              </div>
            </div>

            {/* Per-service breakdown */}
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left p-2 text-muted-foreground font-medium">Service</th>
                    <th className="text-right p-2 text-muted-foreground font-medium">Hit Rate</th>
                    <th className="text-right p-2 text-muted-foreground font-medium">Hits</th>
                    <th className="text-right p-2 text-muted-foreground font-medium">Misses</th>
                    <th className="text-right p-2 text-muted-foreground font-medium">Requests</th>
                    <th className="text-right p-2 text-muted-foreground font-medium">Entries</th>
                    <th className="text-right p-2 text-muted-foreground font-medium">TTL</th>
                    <th className="text-left p-2 text-muted-foreground font-medium">Visual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {data.services.map((svc) => {
                    const hitNum = parseFloat(svc.hitRate) || 0;
                    const barColor = hitNum >= 80
                      ? "bg-emerald-500"
                      : hitNum >= 50
                      ? "bg-amber-500"
                      : hitNum > 0
                      ? "bg-red-500"
                      : "bg-muted";
                    return (
                      <tr key={svc.serviceId}>
                        <td className="p-2 text-foreground font-medium">{svc.serviceName}</td>
                        <td className="p-2 text-right">
                          <span className={`font-semibold ${
                            hitNum >= 80 ? "text-emerald-400" :
                            hitNum >= 50 ? "text-amber-400" :
                            hitNum > 0 ? "text-red-400" : "text-muted-foreground"
                          }`}>
                            {svc.hitRate}
                          </span>
                        </td>
                        <td className="p-2 text-right text-emerald-400">{svc.cacheHits}</td>
                        <td className="p-2 text-right text-red-400">{svc.cacheMisses}</td>
                        <td className="p-2 text-right text-foreground">{svc.totalRequests}</td>
                        <td className="p-2 text-right text-blue-400">{svc.cacheSize || "—"}</td>
                        <td className="p-2 text-right text-muted-foreground">{svc.cacheTTL}</td>
                        <td className="p-2 w-24">
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${barColor}`}
                              style={{ width: `${Math.min(hitNum, 100)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground text-xs p-4">
            Failed to load cache metrics
          </div>
        )}
      </CardContent>
    </Card>
  );
}
