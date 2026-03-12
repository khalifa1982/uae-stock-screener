import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAlertNotifications } from "@/hooks/useAlertNotifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Trash2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useMobile";

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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

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
      refetchInterval: 60000,
      staleTime: 30000,
    }
  );

  const { data: notificationList, refetch: refetchList } = trpc.notifications.list.useQuery(
    undefined,
    {
      enabled: isAuthenticated && open,
      refetchInterval: open ? 30000 : false,
      staleTime: 15000,
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

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Play sound when new notifications arrive
  useEffect(() => {
    const count = unreadCount ?? 0;
    if (count > prevCountRef.current && prevCountRef.current >= 0) {
      const diff = count - prevCountRef.current;
      if (diff > 0 && prevCountRef.current > 0) {
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
        className="terminal-icon-btn relative"
        title="Sign in to see notifications"
      >
        <Bell className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    );
  }

  const count = unreadCount ?? 0;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="terminal-icon-btn relative"
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
      >
        {count > 0 ? (
          <BellRing className="h-3.5 w-3.5 text-primary" />
        ) : (
          <Bell className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        {count > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-0.5 leading-none">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Dropdown panel - uses explicit inline background to guarantee opacity */}
      {open && (
        <div
          className={`absolute z-[200] border border-border rounded-lg shadow-2xl overflow-hidden ${
            isMobile
              ? "fixed inset-x-2 top-12 max-h-[calc(100vh-8rem)]"
              : "right-0 top-full mt-2 w-[380px] max-h-[500px]"
          }`}
          style={
            isMobile
              ? {
                  position: "fixed",
                  left: "0.5rem",
                  right: "0.5rem",
                  top: "3.5rem",
                  background: "oklch(0.08 0.014 260)",
                }
              : {
                  background: "oklch(0.08 0.014 260)",
                }
          }
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2.5 border-b border-border/50 sticky top-0 z-10"
            style={{ background: "oklch(0.10 0.014 260)" }}
          >
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-semibold text-foreground">Notifications</span>
              {count > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                  {count} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
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
          </div>

          {/* Notification List - scrollable */}
          <div
            className="overflow-y-auto overscroll-contain"
            style={{ maxHeight: isMobile ? "calc(100vh - 12rem)" : "380px" }}
          >
            {!notificationList || notificationList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/60 mb-3" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Volume spike alerts will appear here during trading hours
                </p>
              </div>
            ) : (
              <div>
                {notificationList.map((notif: any, idx: number) => (
                  <div
                    key={notif.id}
                    className={`group relative flex gap-3 px-3 py-3 transition-colors hover:bg-white/5 ${
                      idx < notificationList.length - 1 ? "border-b border-border/20" : ""
                    }`}
                    style={
                      !notif.isRead
                        ? { background: "oklch(0.12 0.02 260)" }
                        : undefined
                    }
                  >
                    {/* Unread indicator */}
                    {!notif.isRead && (
                      <div className="absolute left-1 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
                    )}

                    {/* Icon */}
                    <div className="mt-0.5 shrink-0">
                      <SeverityIcon severity={notif.severity} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs leading-tight ${!notif.isRead ? "font-semibold text-foreground" : "font-medium text-foreground/90"}`}>
                          {notif.title}
                        </p>
                        <span className="text-[9px] text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-1.5">
                        {notif.symbol && (
                          <Link
                            href={`/stock/${notif.symbol}`}
                            onClick={() => setOpen(false)}
                            className="text-[10px] text-primary hover:underline font-medium"
                          >
                            View {notif.symbol}
                          </Link>
                        )}
                        <div className="flex-1" />
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notif.isRead && (
                            <button
                              className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors"
                              title="Mark as read"
                              onClick={() => markReadMutation.mutate({ notificationId: notif.id })}
                            >
                              <Check className="h-2.5 w-2.5 text-muted-foreground" />
                            </button>
                          )}
                          <button
                            className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 transition-colors"
                            title="Delete"
                            onClick={() => deleteMutation.mutate({ notificationId: notif.id })}
                          >
                            <Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notificationList && notificationList.length > 0 && (
            <div
              className="border-t border-border/50 px-3 py-2 sticky bottom-0"
              style={{ background: "oklch(0.10 0.014 260)" }}
            >
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="text-xs text-primary hover:underline font-medium"
              >
                View all alerts &rarr;
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
