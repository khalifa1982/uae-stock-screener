import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Activity, AlertTriangle, Bell, BellOff, Clock, RefreshCw, Scan, TrendingDown, TrendingUp, Volume2, Zap } from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "wouter";

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}

function formatTimeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  return (
    <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-semibold ${colors[severity] || colors.medium}`}>
      {severity}
    </Badge>
  );
}

export default function Alerts() {
  const { isAuthenticated } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<any[] | null>(null);

  const { data: monitorStatus, refetch: refetchStatus } = trpc.monitor.status.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const { data: todayAlerts, refetch: refetchToday } = trpc.monitor.todayAlerts.useQuery(undefined, {
    refetchInterval: 60000,
  });

  const { data: recentAlerts, refetch: refetchRecent } = trpc.monitor.recentAlerts.useQuery(undefined, {
    refetchInterval: 60000,
  });

  const { data: tradingInfo } = trpc.monitor.tradingInfo.useQuery(undefined, {
    refetchInterval: 60000,
  });

  const scanMutation = trpc.monitor.scan.useMutation({
    onSuccess: (data) => {
      setScanResults(data.alerts);
      toast.success(`Scan complete: ${data.count} volume spikes detected`);
      refetchToday();
      refetchRecent();
      refetchStatus();
    },
    onError: () => toast.error("Scan failed. Please sign in to use this feature."),
  });

  const dismissMutation = trpc.monitor.dismiss.useMutation({
    onSuccess: () => {
      refetchToday();
      refetchRecent();
    },
  });

  const handleScan = () => {
    setIsScanning(true);
    scanMutation.mutate(undefined, {
      onSettled: () => setIsScanning(false),
    });
  };

  const activeAlerts = useMemo(() => {
    return (todayAlerts || []).filter((a: any) => !a.dismissed);
  }, [todayAlerts]);

  const criticalCount = activeAlerts.filter((a: any) => a.severity === "critical" || a.severity === "high").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Volume Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time volume spike detection for DFM stocks during trading hours
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetchStatus(); refetchToday(); refetchRecent(); }}
            className="gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          {isAuthenticated && (
            <Button
              size="sm"
              onClick={handleScan}
              disabled={isScanning || scanMutation.isPending}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              <Scan className={`h-3.5 w-3.5 ${isScanning ? "animate-spin" : ""}`} />
              {isScanning ? "Scanning..." : "Manual Scan"}
            </Button>
          )}
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Market Status */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Market Status</p>
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${tradingInfo?.isTrading ? "bg-green-500 animate-pulse" : "bg-zinc-500"}`} />
                  <span className="text-sm font-medium">
                    {tradingInfo?.isTrading ? "Market Open" : "Market Closed"}
                  </span>
                </div>
              </div>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            {!tradingInfo?.isTrading && tradingInfo?.nextSession && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Next: {new Date(tradingInfo.nextSession).toLocaleString("en-AE", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Monitor Status */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Monitor</p>
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${monitorStatus?.isRunning ? "bg-emerald-500 animate-pulse" : "bg-zinc-500"}`} />
                  <span className="text-sm font-medium">
                    {monitorStatus?.isRunning ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {monitorStatus?.trackedStocks || 0} stocks tracked | {monitorStatus?.pollCount || 0} polls
            </p>
          </CardContent>
        </Card>

        {/* Today's Alerts */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Today's Alerts</p>
                <p className="text-2xl font-bold">{activeAlerts.length}</p>
              </div>
              <Bell className={`h-5 w-5 ${criticalCount > 0 ? "text-red-400 animate-bounce" : "text-muted-foreground"}`} />
            </div>
            {criticalCount > 0 && (
              <p className="text-[11px] text-red-400 mt-2 font-medium">
                {criticalCount} critical/high severity
              </p>
            )}
          </CardContent>
        </Card>

        {/* Last Poll */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Last Poll</p>
                <p className="text-sm font-medium">
                  {monitorStatus?.lastPollTime
                    ? formatTimeAgo(monitorStatus.lastPollTime)
                    : "No polls yet"}
                </p>
              </div>
              <Zap className="h-5 w-5 text-muted-foreground" />
            </div>
            {monitorStatus?.errorCount ? (
              <p className="text-[11px] text-orange-400 mt-2">
                {monitorStatus.errorCount} errors encountered
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Trading Hours Banner */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Volume2 className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">Volume Spike Monitor</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically monitors DFM stocks every 60 seconds during UAE trading hours ({tradingInfo?.tradingHours || "Sun-Thu 10:00-14:00 GST"}).
                Detects stocks with volume exceeding 2x their average and sends instant notifications for high/critical spikes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scan Results */}
      {scanResults && scanResults.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scan className="h-4 w-4 text-primary" />
              Manual Scan Results ({scanResults.length} spikes detected)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {scanResults.map((alert, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                  <div className="flex items-center gap-3">
                    <SeverityBadge severity={alert.severity} />
                    <div>
                      <Link href={`/stock/${alert.symbol}`} className="text-sm font-medium hover:text-primary transition-colors">
                        {alert.stockName}
                      </Link>
                      <span className="text-xs text-muted-foreground ml-2">{alert.symbol}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-sm font-mono font-medium text-orange-400">{alert.volumeMultiplier}x</p>
                      <p className="text-[10px] text-muted-foreground">vs avg</p>
                    </div>
                    <div>
                      <p className="text-sm font-mono">{formatVolume(alert.currentVolume)}</p>
                      <p className="text-[10px] text-muted-foreground">volume</p>
                    </div>
                    {alert.price && (
                      <div>
                        <p className="text-sm font-mono">{alert.price.toFixed(2)}</p>
                        <p className={`text-[10px] font-mono ${(alert.changePercent || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {(alert.changePercent || 0) >= 0 ? "+" : ""}{(alert.changePercent || 0).toFixed(2)}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Alerts */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              Today's Volume Spikes
            </CardTitle>
            <Badge variant="outline" className="text-xs">{activeAlerts.length} active</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {activeAlerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BellOff className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No volume spikes detected today</p>
              <p className="text-xs mt-1">
                {tradingInfo?.isTrading
                  ? "Monitor is actively scanning. Alerts will appear here."
                  : "Market is closed. Alerts will appear during trading hours."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeAlerts.map((alert: any) => (
                <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50 hover:border-border transition-colors">
                  <div className="flex items-center gap-3">
                    <SeverityBadge severity={alert.severity} />
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={`/stock/${alert.symbol}`} className="text-sm font-medium hover:text-primary transition-colors">
                          {alert.stockName || alert.symbol}
                        </Link>
                        <span className="text-xs text-muted-foreground">{alert.exchange}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {alert.sector} · {formatTimeAgo(alert.detectedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-mono font-bold text-orange-400">{alert.volumeMultiplier}x</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatVolume(alert.currentVolume)} / {formatVolume(alert.avgVolume)}
                      </p>
                    </div>
                    {alert.price && (
                      <div className="text-right">
                        <p className="text-sm font-mono">{alert.price.toFixed(2)}</p>
                        <div className="flex items-center gap-0.5 justify-end">
                          {(alert.changePercent || 0) >= 0 ? (
                            <TrendingUp className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-400" />
                          )}
                          <span className={`text-[10px] font-mono ${(alert.changePercent || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {(alert.changePercent || 0) >= 0 ? "+" : ""}{(alert.changePercent || 0).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    )}
                    {isAuthenticated && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => dismissMutation.mutate({ alertId: alert.id })}
                      >
                        Dismiss
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent History */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Alert History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!recentAlerts || recentAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No alert history yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Time</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Stock</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Severity</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Volume</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Multiplier</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Price</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAlerts.slice(0, 30).map((alert: any) => (
                    <tr key={alert.id} className="border-b border-border/30 hover:bg-accent/5 transition-colors">
                      <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(alert.detectedAt)}
                      </td>
                      <td className="py-2 px-3">
                        <Link href={`/stock/${alert.symbol}`} className="text-sm font-medium hover:text-primary transition-colors">
                          {alert.stockName || alert.symbol}
                        </Link>
                      </td>
                      <td className="py-2 px-3">
                        <SeverityBadge severity={alert.severity} />
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {formatVolume(alert.currentVolume)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs font-bold text-orange-400">
                        {alert.volumeMultiplier}x
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {alert.price ? alert.price.toFixed(2) : "—"}
                      </td>
                      <td className={`py-2 px-3 text-right font-mono text-xs ${(alert.changePercent || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {alert.changePercent != null ? `${alert.changePercent >= 0 ? "+" : ""}${alert.changePercent.toFixed(2)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
