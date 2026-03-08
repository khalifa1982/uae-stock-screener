import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAlertNotifications } from "@/hooks/useAlertNotifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Trash2,
  TrendingUp,
  TrendingDown,
  Volume2,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

function formatTimeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "Just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-AE", { month: "short", day: "numeric" });
}

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case "critical":
      return <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />;
    default:
      return <Info className="h-4 w-4 text-blue-400 shrink-0" />;
  }
}

export default function NotificationCenter() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const prevCountRef = useRef(0);

  const {
    prefs,
    processAlerts,
    playSoundOnly,
  } = useAlertNotifications();

  // Only fetch if authenticated
  const { data: unreadCount, refetch: refetchCount } = trpc.notifications.unreadCount.useQuery(
    undefined,
    {
      enabled: isAuthenticated,
      refetchInterval: 15000, // Poll every 15s for new notifications
    }
  );

  const { data: notificationList, refetch: refetchList } = trpc.notifications.list.useQuery(
    undefined,
    {
      enabled: isAuthenticated && open,
      refetchInterval: open ? 10000 : false,
    }
  );

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      refetchCount();
      refetchList();
    },
  });

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      refetchCount();
      refetchList();
    },
  });

  const deleteMutation = trpc.notifications.delete.useMutation({
    onSuccess: () => {
      refetchCount();
      refetchList();
    },
  });

  // Play sound when new notifications arrive
  useEffect(() => {
    const count = unreadCount ?? 0;
    if (count > prevCountRef.current && prevCountRef.current >= 0) {
      const diff = count - prevCountRef.current;
      if (diff > 0 && prevCountRef.current > 0) {
        // New notification arrived
        if (prefs.soundEnabled) {
          playSoundOnly("high");
        }
        toast.info(`${diff} new notification${diff > 1 ? "s" : ""}`, {
          duration: 4000,
          action: {
            label: "View",
            onClick: () => setOpen(true),
          },
        });
      }
    }
    prevCountRef.current = count;
  }, [unreadCount, prefs.soundEnabled, playSoundOnly]);

  if (!isAuthenticated) {
    return (
      <button
        className="relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
        title="Sign in to see notifications"
      >
        <Bell className="h-4.5 w-4.5 text-muted-foreground" />
      </button>
    );
  }

  const count = unreadCount ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
        >
          {count > 0 ? (
            <BellRing className="h-4.5 w-4.5 text-primary animate-pulse" />
          ) : (
            <Bell className="h-4.5 w-4.5 text-muted-foreground" />
          )}
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4.5 min-w-[18px] flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1 leading-none">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-[380px] p-0 bg-card border-border shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Notifications</span>
            {count > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                {count} new
              </Badge>
            )}
          </div>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification List */}
        <ScrollArea className="max-h-[420px]">
          {!notificationList || notificationList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Volume spike alerts will appear here during trading hours
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {notificationList.map((notif: any) => (
                <div
                  key={notif.id}
                  className={`group relative flex gap-3 px-4 py-3 transition-colors hover:bg-accent/5 ${
                    !notif.isRead ? "bg-primary/5" : ""
                  }`}
                >
                  {/* Unread indicator */}
                  {!notif.isRead && (
                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
                  )}

                  {/* Icon */}
                  <div className="mt-0.5">
                    <SeverityIcon severity={notif.severity} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-tight ${!notif.isRead ? "font-semibold" : "font-medium"}`}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-2">
                      {notif.symbol && (
                        <Link
                          href={`/stock/${notif.symbol}`}
                          onClick={() => setOpen(false)}
                          className="text-[11px] text-primary hover:underline font-medium"
                        >
                          View {notif.symbol}
                        </Link>
                      )}
                      <div className="flex-1" />
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notif.isRead && (
                          <button
                            className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors"
                            title="Mark as read"
                            onClick={() => markReadMutation.mutate({ notificationId: notif.id })}
                          >
                            <Check className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                        <button
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 transition-colors"
                          title="Delete"
                          onClick={() => deleteMutation.mutate({ notificationId: notif.id })}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notificationList && notificationList.length > 0 && (
          <div className="border-t border-border/50 px-4 py-2.5">
            <Link
              href="/alerts"
              onClick={() => setOpen(false)}
              className="text-xs text-primary hover:underline font-medium"
            >
              View all alerts &rarr;
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
