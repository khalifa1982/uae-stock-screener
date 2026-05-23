import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, Bell, BellOff, BellRing, Clock,
  RefreshCw, Scan, TrendingDown, TrendingUp, Volume2, VolumeX,
  Zap, Play, Settings2
} from "lucide-react";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useAlertNotifications } from "@/hooks/useAlertNotifications";

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
  const [showSettings, setShowSettings] = useState(false);
  const prevAlertCountRef = useRef(0);

  const {
    prefs,
    permissionState,
    requestPermission,
    toggleBrowserNotifications,
    toggleSound,
    setVolume,
    processAlerts,
    testNotification,
    playSoundOnly,
  } = useAlertNotifications();

  const { data: tradingInfo } = trpc.monitor.tradingInfo.useQuery(undefined, {
    refetchInterval: 120000, // Check trading status every 2 min
    staleTime: 60000,
  });

  const isTrading = tradingInfo?.isTrading ?? false;

  const { data: monitorStatus, refetch: refetchStatus } = trpc.monitor.status.useQuery(undefined, {
    refetchInterval: isTrading ? 30000 : 120000, // Faster during trading hours
    staleTime: 15000,
  });

  const { data: todayAlerts, refetch: refetchToday } = trpc.monitor.todayAlerts.useQuery(undefined, {
    refetchInterval: isTrading ? 15000 : 120000, // Poll fast during trading, slow otherwise
    staleTime: 10000,
  });

  const { data: recentAlerts, refetch: refetchRecent } = trpc.monitor.recentAlerts.useQuery(undefined, {
    refetchInterval: isTrading ? 60000 : 300000, // 1 min during trading, 5 min otherwise
    staleTime: 30000,
  });

  // Process new alerts for notifications
  useEffect(() => {
    if (!todayAlerts || todayAlerts.length === 0) return;
    const activeAlerts = todayAlerts.filter((a: any) => !a.dismissed);
    if (activeAlerts.length > prevAlertCountRef.current) {
      // New alerts detected - process them for notifications
      const newCount = processAlerts(activeAlerts);
      if (newCount && newCount > 0) {
        toast.info(`${newCount} new volume spike${newCount > 1 ? "s" : ""} detected!`, {
          duration: 5000,
          action: {
            label: "View",
            onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }),
          },
        });
      }
    }
    prevAlertCountRef.current = activeAlerts.length;
  }, [todayAlerts, processAlerts]);

  const scanMutation = trpc.monitor.scan.useMutation({
    onSuccess: (data) => {
      setScanResults(data.alerts);
      if (data.count > 0) {
        toast.success(`Scan complete: ${data.count} volume spikes detected`);
        // Play sound for scan results
        const maxSev = data.alerts.reduce((max: string, a: any) => {
          const order = ["low", "medium", "high", "critical"];
          return order.indexOf(a.severity) > order.indexOf(max) ? a.severity : max;
        }, "low");
        playSoundOnly(maxSev as any);
        // Process for browser notifications too
        processAlerts(data.alerts);
      } else {
        toast.info("Scan complete: No volume spikes detected");
      }
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
    <div className="space-y-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        <div>
          <h1 className="text-xs font-bold tracking-tight">Volume Alerts</h1>
          <p className="text-[11px] text-muted-foreground mt-1">
            Real-time volume spike detection for DFM stocks during trading hours
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className={`gap-2 ${showSettings ? "bg-accent" : ""}`}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Alerts
          </Button>
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

      {/* Notification Settings Panel */}
      {showSettings && (
        <Card className="border-primary/20 bg-card">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs flex items-center gap-2">
              <BellRing className="h-4 w-4 text-primary" />
              Notification Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {/* Browser Notifications */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[11px] font-medium">Browser Notifications</span>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  {permissionState === "unsupported"
                    ? "Your browser does not support notifications"
                    : permissionState === "denied"
                      ? "Notifications blocked. Please enable in browser settings."
                      : "Get push notifications even when the tab is in the background"}
                </p>
              </div>
              <Switch
                checked={prefs.browserNotifications}
                onCheckedChange={toggleBrowserNotifications}
                disabled={permissionState === "unsupported" || permissionState === "denied"}
              />
            </div>

            {/* Sound Alerts */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  {prefs.soundEnabled ? (
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-[11px] font-medium">Alert Sound</span>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Play an audible alert when volume spikes are detected
                </p>
              </div>
              <Switch
                checked={prefs.soundEnabled}
                onCheckedChange={toggleSound}
              />
            </div>

            {/* Volume Slider */}
            {prefs.soundEnabled && (
              <div className="ml-6 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Volume</span>
                  <span className="text-xs font-mono text-muted-foreground">{Math.round(prefs.soundVolume * 100)}%</span>
                </div>
                <Slider
                  value={[prefs.soundVolume * 100]}
                  onValueChange={([v]) => setVolume(v / 100)}
                  max={100}
                  min={5}
                  step={5}
                  className="w-full"
                />
              </div>
            )}

            {/* Test Button */}
            <div className="flex items-center gap-1 pt-2 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                onClick={testNotification}
                className="gap-2"
              >
                <Play className="h-3.5 w-3.5" />
                Test Alert
              </Button>
              <span className="text-xs text-muted-foreground">
                Sends a test notification with sound to verify your setup
              </span>
            </div>

            {/* Permission Status */}
            {permissionState === "default" && (
              <div className="flex items-center gap-1 p-3 rounded bg-primary/5 border border-primary/20">
                <Bell className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">
                    Browser notification permission has not been granted yet.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={requestPermission} className="shrink-0 text-xs">
                  Enable
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
        {/* Market Status */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Market Status</p>
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${tradingInfo?.isTrading ? "bg-green-500 animate-pulse" : "bg-zinc-500"}`} />
                  <span className="text-[11px] font-medium">
                    {tradingInfo?.isTrading ? "Market Open" : "Market Closed"}
                  </span>
                </div>
              </div>
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
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
          <CardContent className="p-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Monitor</p>
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${monitorStatus?.isRunning ? "bg-emerald-500 animate-pulse" : "bg-zinc-500"}`} />
                  <span className="text-[11px] font-medium">
                    {monitorStatus?.isRunning ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {monitorStatus?.trackedStocks || 0} stocks tracked | {monitorStatus?.pollCount || 0} polls
            </p>
          </CardContent>
        </Card>

        {/* Today's Alerts */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Today's Alerts</p>
                <p className="text-xs font-bold">{activeAlerts.length}</p>
              </div>
              <Bell className={`h-3.5 w-3.5 ${criticalCount > 0 ? "text-red-400 animate-bounce" : "text-muted-foreground"}`} />
            </div>
            {criticalCount > 0 && (
              <p className="text-[11px] text-red-400 mt-2 font-medium">
                {criticalCount} critical/high severity
              </p>
            )}
          </CardContent>
        </Card>

        {/* Notification Status */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Notifications</p>
                <div className="flex items-center gap-2">
                  {prefs.browserNotifications || prefs.soundEnabled ? (
                    <>
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span className="text-[11px] font-medium">Active</span>
                    </>
                  ) : (
                    <>
                      <div className="h-2.5 w-2.5 rounded-full bg-zinc-500" />
                      <span className="text-[11px] font-medium">Disabled</span>
                    </>
                  )}
                </div>
              </div>
              <BellRing className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {[
                prefs.browserNotifications ? "Push" : null,
                prefs.soundEnabled ? `Sound (${Math.round(prefs.soundVolume * 100)}%)` : null,
              ].filter(Boolean).join(" + ") || "Click Alerts to configure"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trading Hours Banner */}
      <Card className="bg-card border-primary/20">
        <CardContent className="p-2">
          <div className="flex items-center gap-1">
            <Volume2 className="h-3.5 w-3.5 text-primary shrink-0" />
            <div>
              <p className="text-[11px] font-medium">Volume Spike Monitor</p>
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
          <CardHeader className="pb-1">
            <CardTitle className="text-xs flex items-center gap-2">
              <Scan className="h-4 w-4 text-primary" />
              Manual Scan Results ({scanResults.length} spikes detected)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {scanResults.map((alert: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded bg-background/50 border border-border/50">
                  <div className="flex items-center gap-1">
                    <SeverityBadge severity={alert.severity} />
                    <div>
                      <Link href={`/stock/${alert.symbol}`} className="text-[11px] font-medium hover:text-primary transition-colors">
                        {alert.stockName}
                      </Link>
                      <span className="text-xs text-muted-foreground ml-2">{alert.symbol}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-right">
                    <div>
                      <p className="text-[11px] font-mono font-medium text-orange-400">{alert.volumeMultiplier}x</p>
                      <p className="text-[10px] text-muted-foreground">vs avg</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-mono">{formatVolume(alert.currentVolume)}</p>
                      <p className="text-[10px] text-muted-foreground">volume</p>
                    </div>
                    {alert.price && (
                      <div>
                        <p className="text-[11px] font-mono">{alert.price.toFixed(3)}</p>
                        <p className={`text-[10px] font-mono ${(alert.changePercent || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {(alert.changePercent || 0) >= 0 ? "+" : ""}{(alert.changePercent || 0).toFixed(3)}%
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
        <CardHeader className="pb-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs flex items-center gap-2">
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
              <p className="text-[11px]">No volume spikes detected today</p>
              <p className="text-xs mt-1">
                {tradingInfo?.isTrading
                  ? "Monitor is actively scanning. Alerts will appear here."
                  : "Market is closed. Alerts will appear during trading hours."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeAlerts.map((alert: any) => (
                <div key={alert.id} className="flex items-center justify-between p-3 rounded bg-background/50 border border-border/50 hover:border-border transition-colors">
                  <div className="flex items-center gap-1">
                    <SeverityBadge severity={alert.severity} />
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={`/stock/${alert.symbol}`} className="text-[11px] font-medium hover:text-primary transition-colors">
                          {alert.stockName || alert.symbol}
                        </Link>
                        <span className="text-xs text-muted-foreground">{alert.exchange}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {alert.sector} · {formatTimeAgo(alert.detectedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="text-right">
                      <p className="text-[11px] font-mono font-bold text-orange-400">{alert.volumeMultiplier}x</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatVolume(alert.currentVolume)} / {formatVolume(alert.avgVolume)}
                      </p>
                    </div>
                    {alert.price && (
                      <div className="text-right">
                        <p className="text-[11px] font-mono">{alert.price.toFixed(3)}</p>
                        <div className="flex items-center gap-0.5 justify-end">
                          {(alert.changePercent || 0) >= 0 ? (
                            <TrendingUp className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-400" />
                          )}
                          <span className={`text-[10px] font-mono ${(alert.changePercent || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {(alert.changePercent || 0) >= 0 ? "+" : ""}{(alert.changePercent || 0).toFixed(3)}%
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
        <CardHeader className="pb-1">
          <CardTitle className="text-xs flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Alert History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!recentAlerts || recentAlerts.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-8">No alert history yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
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
                        <Link href={`/stock/${alert.symbol}`} className="text-[11px] font-medium hover:text-primary transition-colors">
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
                        {alert.price ? alert.price.toFixed(3) : "—"}
                      </td>
                      <td className={`py-2 px-3 text-right font-mono text-xs ${(alert.changePercent || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {alert.changePercent != null ? `${alert.changePercent >= 0 ? "+" : ""}${alert.changePercent.toFixed(3)}%` : "—"}
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
