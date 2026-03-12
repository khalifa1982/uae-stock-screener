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
  ChevronDown,
  ChevronRight,
  Layers,
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
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

interface NotificationGroup {
  symbol: string | null;
  items: any[];
  latestTime: Date;
  unreadCount: number;
  highestSeverity: string;
}

function groupNotifications(notifications: any[]): (NotificationGroup | any)[] {
  // Group by symbol, keep non-symbol notifications as standalone
  const symbolGroups = new Map<string, any[]>();
  const standalone: any[] = [];

  for (const notif of notifications) {
    if (notif.symbol) {
      const existing = symbolGroups.get(notif.symbol) || [];
      existing.push(notif);
      symbolGroups.set(notif.symbol, existing);
    } else {
      standalone.push(notif);
    }
  }

  const result: (NotificationGroup | any)[] = [];

  // Convert symbol groups - only group if 2+ notifications for same symbol
  for (const [symbol, items] of Array.from(symbolGroups.entries())) {
    if (items.length >= 2) {
      const severityOrder: Record<string, number> = { critical: 3, warning: 2, high: 2, medium: 1, info: 0 };
      const highestSeverity = items.reduce((max: string, item: any) => {
        return (severityOrder[item.severity] || 0) > (severityOrder[max] || 0) ? item.severity : max;
      }, "info");

      result.push({
        symbol,
        items,
        latestTime: new Date(items[0].createdAt),
        unreadCount: items.filter((i: any) => !i.isRead).length,
        highestSeverity,
      });
    } else {
      // Single notification for this symbol - show as standalone
      standalone.push(...items);
    }
  }

  // Add standalone notifications
  for (const notif of standalone) {
    result.push(notif);
  }

  // Sort by latest time (newest first)
  result.sort((a, b) => {
    const timeA = 'latestTime' in a ? a.latestTime.getTime() : new Date(a.createdAt).getTime();
    const timeB = 'latestTime' in b ? b.latestTime.getTime() : new Date(b.createdAt).getTime();
    return timeB - timeA;
  });

  return result;
}

function isGroup(item: any): item is NotificationGroup {
  return 'items' in item && Array.isArray(item.items);
}

function NotificationItem({
  notif,
  isLast,
  onMarkRead,
  onDelete,
  onClose,
}: {
  notif: any;
  isLast: boolean;
  onMarkRead: (id: number) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}) {
  return (
    <div
      className={`group relative flex gap-3 px-3 py-3 transition-colors hover:bg-white/5 ${
        !isLast ? "border-b border-border/20" : ""
      }`}
      style={!notif.isRead ? { background: "oklch(0.12 0.02 260)" } : undefined}
    >
      {!notif.isRead && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
      )}
      <div className="mt-0.5 shrink-0">
        <SeverityIcon severity={notif.severity} />
      </div>
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
        <div className="flex items-center gap-2 mt-1.5">
          {notif.symbol && (
            <Link
              href={`/stock/${notif.symbol}`}
              onClick={onClose}
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
                onClick={() => onMarkRead(notif.id)}
              >
                <Check className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            )}
            <button
              className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 transition-colors"
              title="Delete"
              onClick={() => onDelete(notif.id)}
            >
              <Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupedNotification({
  group,
  onMarkRead,
  onDelete,
  onClose,
}: {
  group: NotificationGroup;
  onMarkRead: (id: number) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border/20">
      {/* Group header - clickable to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/5 text-left"
        style={group.unreadCount > 0 ? { background: "oklch(0.11 0.018 260)" } : undefined}
      >
        <div className="mt-0.5 shrink-0">
          <Layers className="h-4 w-4 text-primary/70" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">{group.symbol}</span>
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-mono">
              {group.items.length} alerts
            </Badge>
            {group.unreadCount > 0 && (
              <Badge className="text-[9px] h-4 px-1.5 bg-primary/20 text-primary border-primary/30" variant="outline">
                {group.unreadCount} new
              </Badge>
            )}
            <span className="text-[9px] text-muted-foreground ml-auto shrink-0">
              {formatTimeAgo(group.latestTime)}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
            Latest: {group.items[0].title}
          </p>
        </div>
        <div className="shrink-0">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded items */}
      {expanded && (
        <div className="border-t border-border/10" style={{ background: "oklch(0.09 0.012 260)" }}>
          {group.items.map((notif, idx) => (
            <NotificationItem
              key={notif.id}
              notif={notif}
              isLast={idx === group.items.length - 1}
              onMarkRead={onMarkRead}
              onDelete={onDelete}
              onClose={onClose}
            />
          ))}
          <div className="px-3 py-1.5 flex justify-center">
            <Link
              href={`/stock/${group.symbol}`}
              onClick={onClose}
              className="text-[10px] text-primary hover:underline font-medium"
            >
              View {group.symbol} details &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotificationCenter() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const prevCountRef = useRef(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const {
    prefs,
    processAlerts,
    playSoundOnly,
  } = useAlertNotifications();

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

  const deleteAllMutation = trpc.notifications.deleteAll.useMutation({
    onSuccess: () => {
      refetchCount();
      refetchList();
      setShowClearConfirm(false);
      toast.success("All notifications cleared");
    },
  });

  // Group notifications by symbol
  const groupedItems = useMemo(() => {
    if (!notificationList || notificationList.length === 0) return [];
    return groupNotifications(notificationList);
  }, [notificationList]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowClearConfirm(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setShowClearConfirm(false);
      }
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
  const totalNotifications = notificationList?.length ?? 0;

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

      {/* Dropdown panel */}
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
                  Read all
                </Button>
              )}
              {totalNotifications > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1"
                  onClick={() => setShowClearConfirm(true)}
                >
                  <Trash2 className="h-3 w-3" />
                  Clear all
                </Button>
              )}
            </div>
          </div>

          {/* Clear All Confirmation */}
          {showClearConfirm && (
            <div
              className="px-3 py-3 border-b border-border/50 flex items-center justify-between gap-2"
              style={{ background: "oklch(0.12 0.03 25)" }}
            >
              <p className="text-xs text-red-300">
                Delete all {totalNotifications} notifications?
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-muted-foreground"
                  onClick={() => setShowClearConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-6 text-[10px]"
                  onClick={() => deleteAllMutation.mutate()}
                  disabled={deleteAllMutation.isPending}
                >
                  {deleteAllMutation.isPending ? "Clearing..." : "Yes, clear all"}
                </Button>
              </div>
            </div>
          )}

          {/* Notification List - scrollable with grouping */}
          <div
            className="overflow-y-auto overscroll-contain"
            style={{ maxHeight: isMobile ? "calc(100vh - 12rem)" : "380px" }}
          >
            {groupedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/60 mb-3" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Volume spike alerts will appear here during trading hours
                </p>
              </div>
            ) : (
              <div>
                {groupedItems.map((item, idx) =>
                  isGroup(item) ? (
                    <GroupedNotification
                      key={`group-${item.symbol}`}
                      group={item}
                      onMarkRead={(id) => markReadMutation.mutate({ notificationId: id })}
                      onDelete={(id) => deleteMutation.mutate({ notificationId: id })}
                      onClose={() => setOpen(false)}
                    />
                  ) : (
                    <NotificationItem
                      key={item.id}
                      notif={item}
                      isLast={idx === groupedItems.length - 1}
                      onMarkRead={(id) => markReadMutation.mutate({ notificationId: id })}
                      onDelete={(id) => deleteMutation.mutate({ notificationId: id })}
                      onClose={() => setOpen(false)}
                    />
                  )
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {totalNotifications > 0 && (
            <div
              className="border-t border-border/50 px-3 py-2 sticky bottom-0 flex items-center justify-between"
              style={{ background: "oklch(0.10 0.014 260)" }}
            >
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="text-xs text-primary hover:underline font-medium"
              >
                View all alerts &rarr;
              </Link>
              <span className="text-[9px] text-muted-foreground font-mono">
                {totalNotifications} total
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
