import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Bell, BellOff, BellRing, Check, CheckCircle2,
  Clock, Info, Loader2,
  Monitor, Moon, Play, Save, Shield,
  Volume2, VolumeX, Zap
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAlertNotifications } from "@/hooks/useAlertNotifications";

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

const severityConfig: Record<string, { label: string; color: string; description: string }> = {
  low: { label: "Low", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", description: "Volume 2-3x average" },
  medium: { label: "Medium", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", description: "Volume 3-5x average" },
  high: { label: "High", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", description: "Volume 5-8x average" },
  critical: { label: "Critical", color: "bg-red-500/20 text-red-400 border-red-500/30", description: "Volume 8x+ average" },
};

export default function NotificationSettings() {
  const { isAuthenticated, user } = useAuth();
  const {
    prefs: localPrefs,
    permissionState,
    requestPermission,
    toggleBrowserNotifications: toggleLocalBrowser,
    toggleSound: toggleLocalSound,
    setVolume: setLocalVolume,
    testNotification,
  } = useAlertNotifications();

  // Server-side preferences
  const { data: serverPrefs, isLoading, refetch } = trpc.notifications.getPreferences.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const updateMutation = trpc.notifications.updatePreferences.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Preferences saved");
    },
    onError: (err) => toast.error(`Failed to save: ${err.message}`),
  });

  // Local form state (initialized from server prefs)
  const [browserEnabled, setBrowserEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [browserSeverities, setBrowserSeverities] = useState<string[]>(["medium", "high", "critical"]);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState("22:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("07:00");
  const [soundVolume, setSoundVolume] = useState(0.7);
  const [minInterval, setMinInterval] = useState(5);

  // Sync from server prefs when loaded
  useEffect(() => {
    if (serverPrefs) {
      setBrowserEnabled(serverPrefs.browserEnabled);
      setSoundEnabled(serverPrefs.soundEnabled);
      setInAppEnabled(serverPrefs.inAppEnabled);
      setBrowserSeverities(serverPrefs.browserSeverities.split(",").filter(Boolean));
      setQuietHoursEnabled(serverPrefs.quietHoursEnabled);
      setQuietHoursStart(serverPrefs.quietHoursStart);
      setQuietHoursEnd(serverPrefs.quietHoursEnd);
      setSoundVolume(serverPrefs.soundVolume);
      setMinInterval(serverPrefs.minIntervalMinutes);
    }
  }, [serverPrefs]);

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    if (!serverPrefs) return false;
    return (
      browserEnabled !== serverPrefs.browserEnabled ||
      soundEnabled !== serverPrefs.soundEnabled ||
      inAppEnabled !== serverPrefs.inAppEnabled ||
      browserSeverities.join(",") !== serverPrefs.browserSeverities ||
      quietHoursEnabled !== serverPrefs.quietHoursEnabled ||
      quietHoursStart !== serverPrefs.quietHoursStart ||
      quietHoursEnd !== serverPrefs.quietHoursEnd ||
      soundVolume !== serverPrefs.soundVolume ||
      minInterval !== serverPrefs.minIntervalMinutes
    );
  }, [serverPrefs, browserEnabled, soundEnabled, inAppEnabled, browserSeverities, quietHoursEnabled, quietHoursStart, quietHoursEnd, soundVolume, minInterval]);

  const handleSave = useCallback(() => {
    // Save to server — email fields sent as disabled defaults
    updateMutation.mutate({
      emailEnabled: false,
      browserEnabled,
      soundEnabled,
      inAppEnabled,
      emailSeverities: "",
      browserSeverities: browserSeverities.join(","),
      notificationEmail: "",
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      soundVolume,
      minIntervalMinutes: minInterval,
    });

    // Also sync to localStorage for the useAlertNotifications hook
    toggleLocalBrowser(browserEnabled);
    toggleLocalSound(soundEnabled);
    setLocalVolume(soundVolume);
  }, [browserEnabled, soundEnabled, inAppEnabled, browserSeverities, quietHoursEnabled, quietHoursStart, quietHoursEnd, soundVolume, minInterval, updateMutation, toggleLocalBrowser, toggleLocalSound, setLocalVolume]);

  const toggleSeverity = (list: string[], setList: (v: string[]) => void, severity: string) => {
    if (list.includes(severity)) {
      setList(list.filter(s => s !== severity));
    } else {
      setList([...list, severity]);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full glass-card">
          <CardContent className="p-8 text-center space-y-1.5">
            <BellOff className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-[11px] font-semibold">Sign In Required</h2>
            <p className="text-[11px] text-muted-foreground">
              Please sign in to configure your notification preferences.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-2 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        <div>
          <h1 className="text-xs font-bold tracking-tight flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            Notification Settings
          </h1>
          <p className="text-[11px] text-muted-foreground mt-1">
            Customize how and when you receive volume spike alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
              Unsaved changes
            </Badge>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
            className="gap-2"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Notification Channels */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="text-[11px] flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary" />
            Notification Channels
          </CardTitle>
          <CardDescription>
            Choose how you want to be notified when volume spikes are detected
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Browser Push Notifications */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <div className={`p-2 rounded ${browserEnabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <Monitor className="h-3.5 w-3.5" />
                </div>
                <div>
                  <Label className="text-[11px] font-medium">Browser Push Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    {permissionState === "unsupported"
                      ? "Your browser does not support push notifications"
                      : permissionState === "denied"
                        ? "Notifications blocked. Please enable in browser settings."
                        : "Get desktop notifications even when the tab is in the background"}
                  </p>
                </div>
              </div>
              <Switch
                checked={browserEnabled}
                onCheckedChange={(checked) => {
                  setBrowserEnabled(checked);
                  if (checked && permissionState !== "granted") {
                    requestPermission();
                  }
                }}
                disabled={permissionState === "unsupported" || permissionState === "denied"}
              />
            </div>
            {browserEnabled && (
              <div className="ml-12 space-y-2 animate-in slide-in-from-top-2 duration-200">
                <Label className="text-xs text-muted-foreground">Browser alert severity levels</Label>
                <div className="flex flex-wrap gap-2">
                  {SEVERITIES.map(sev => {
                    const cfg = severityConfig[sev];
                    const active = browserSeverities.includes(sev);
                    return (
                      <button
                        key={sev}
                        onClick={() => toggleSeverity(browserSeverities, setBrowserSeverities, sev)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          active ? cfg.color : "bg-muted/30 text-muted-foreground border-border/50 opacity-50"
                        }`}
                      >
                        {active && <Check className="h-3 w-3" />}
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
                {permissionState === "default" && (
                  <div className="flex items-center gap-2 p-2.5 rounded bg-primary/5 border border-primary/20 mt-2">
                    <Info className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-xs text-muted-foreground flex-1">
                      Browser permission not yet granted.
                    </p>
                    <Button size="sm" variant="outline" onClick={requestPermission} className="text-xs shrink-0">
                      Enable
                    </Button>
                  </div>
                )}
                {permissionState === "granted" && (
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Browser notifications enabled
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator className="bg-border/30" />

          {/* Sound Alerts */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <div className={`p-2 rounded ${soundEnabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                </div>
                <div>
                  <Label className="text-[11px] font-medium">Alert Sound</Label>
                  <p className="text-xs text-muted-foreground">
                    Play an audible alert when volume spikes are detected
                  </p>
                </div>
              </div>
              <Switch
                checked={soundEnabled}
                onCheckedChange={setSoundEnabled}
              />
            </div>
            {soundEnabled && (
              <div className="ml-12 space-y-3 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-1">
                  <VolumeX className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Slider
                    value={[soundVolume * 100]}
                    onValueChange={([v]) => setSoundVolume(v / 100)}
                    max={100}
                    min={5}
                    step={5}
                    className="flex-1 max-w-xs"
                  />
                  <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-mono text-muted-foreground w-10 text-right">{Math.round(soundVolume * 100)}%</span>
                </div>
              </div>
            )}
          </div>

          <Separator className="bg-border/30" />

          {/* In-App Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <div className={`p-2 rounded ${inAppEnabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                <Bell className="h-3.5 w-3.5" />
              </div>
              <div>
                <Label className="text-[11px] font-medium">In-App Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Show alerts in the notification center within the app
                </p>
              </div>
            </div>
            <Switch
              checked={inAppEnabled}
              onCheckedChange={setInAppEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="text-[11px] flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-primary" />
            Advanced Settings
          </CardTitle>
          <CardDescription>
            Fine-tune notification behavior and frequency
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Quiet Hours */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <div className={`p-2 rounded ${quietHoursEnabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <Moon className="h-3.5 w-3.5" />
                </div>
                <div>
                  <Label className="text-[11px] font-medium">Quiet Hours</Label>
                  <p className="text-xs text-muted-foreground">
                    Suppress notifications during specified hours (UAE time)
                  </p>
                </div>
              </div>
              <Switch
                checked={quietHoursEnabled}
                onCheckedChange={setQuietHoursEnabled}
              />
            </div>
            {quietHoursEnabled && (
              <div className="ml-12 flex items-center gap-1 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input
                    type="time"
                    value={quietHoursStart}
                    onChange={(e) => setQuietHoursStart(e.target.value)}
                    className="w-28 bg-background/50"
                  />
                </div>
                <span className="text-muted-foreground mt-5">to</span>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Until</Label>
                  <Input
                    type="time"
                    value={quietHoursEnd}
                    onChange={(e) => setQuietHoursEnd(e.target.value)}
                    className="w-28 bg-background/50"
                  />
                </div>
              </div>
            )}
          </div>

          <Separator className="bg-border/30" />

          {/* Minimum Interval */}
          <div className="space-y-3">
            <div className="flex items-center gap-1">
              <div className="p-2 rounded bg-muted text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1">
                <Label className="text-[11px] font-medium">Minimum Alert Interval</Label>
                <p className="text-xs text-muted-foreground">
                  Minimum time between notifications for the same stock
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={minInterval}
                  onChange={(e) => setMinInterval(Math.max(1, Math.min(60, parseInt(e.target.value) || 5)))}
                  className="w-16 bg-background/50 text-center"
                  min={1}
                  max={60}
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test & Preview */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="text-[11px] flex items-center gap-2">
            <Play className="h-3.5 w-3.5 text-primary" />
            Test Notifications
          </CardTitle>
          <CardDescription>
            Send test notifications to verify your setup is working correctly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            <Button
              variant="outline"
              onClick={testNotification}
              className="gap-2 h-auto py-1 flex-col"
              disabled={!browserEnabled && !soundEnabled}
            >
              <Monitor className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs">Test Browser + Sound</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                toast.info("Volume Spike Detected", {
                  description: "EMAAR (DFM) - 4.2x average volume at AED 8.50 (+2.35%)",
                  duration: 5000,
                });
              }}
              className="gap-2 h-auto py-1 flex-col"
              disabled={!inAppEnabled}
            >
              <Bell className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs">Test In-App</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Severity Reference */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="text-[11px] flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-primary" />
            Severity Levels Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {SEVERITIES.map(sev => {
              const cfg = severityConfig[sev];
              return (
                <div key={sev} className={`flex items-center gap-1 p-3 rounded border ${cfg.color}`}>
                  <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-semibold ${cfg.color}`}>
                    {cfg.label}
                  </Badge>
                  <span className="text-xs">{cfg.description}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Save floating button for mobile */}
      {hasChanges && (
        <div className="fixed bottom-20 left-0 right-0 flex justify-center z-50 sm:hidden animate-in slide-in-from-bottom-4">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="gap-2 shadow-lg shadow-primary/20 px-8"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}
