import { useMarketStatus, useAutoRefreshInterval } from "@/hooks/useMarketStatus";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Clock, CalendarOff, Wifi, Timer } from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";
import type { MarketPhase } from "../../../shared/marketStatus";

/**
 * Color config for each market phase.
 * Each phase gets a distinct, easily distinguishable color:
 * - Pre-Open:  Amber/Yellow  (warming up)
 * - Open:      Emerald/Green (active trading)
 * - Pre-Close: Orange        (winding down)
 * - Closed:    Red           (market shut)
 * - Holiday:   Purple        (special closure)
 */
const phaseConfig: Record<MarketPhase, {
  color: string;
  dotColor: string;
  pulseColor: string;
  liveColor: string;
}> = {
  "pre-open": {
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    dotColor: "bg-amber-400",
    pulseColor: "bg-amber-400/40",
    liveColor: "text-amber-400",
  },
  "open": {
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    dotColor: "bg-emerald-400",
    pulseColor: "bg-emerald-400/40",
    liveColor: "text-emerald-400",
  },
  "pre-close": {
    color: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    dotColor: "bg-orange-400",
    pulseColor: "bg-orange-400/40",
    liveColor: "text-orange-400",
  },
  "closed": {
    color: "bg-red-500/10 text-red-400/70 border-red-500/20",
    dotColor: "bg-red-400/70",
    pulseColor: "bg-red-400/30",
    liveColor: "text-red-400/70",
  },
  "holiday": {
    color: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    dotColor: "bg-purple-400",
    pulseColor: "bg-purple-400/40",
    liveColor: "text-purple-400",
  },
};

/**
 * Build a human-friendly countdown string like "Opens in 6h 17m" or "Closes in 12m 30s"
 */
function getCountdownDescription(phase: MarketPhase, countdown: string, nextPhaseLabel: string): string {
  if (!countdown) return "";
  
  if (phase === "closed" || phase === "holiday") {
    return `Opens in ${countdown}`;
  }
  if (phase === "pre-open") {
    return `Trading starts in ${countdown}`;
  }
  if (phase === "open") {
    return `Pre-close in ${countdown}`;
  }
  if (phase === "pre-close") {
    return `Closes in ${countdown}`;
  }
  return `${nextPhaseLabel} in ${countdown}`;
}

/**
 * Enhanced market status badge for the dashboard header.
 * 
 * Desktop: Shows phase badge + LIVE indicator + UAE time
 * Mobile: Shows only a small green pulsing dot (live indicator) + compact phase text
 * 
 * This is the ONLY market status indicator — shown in the global header bar.
 */
export function MarketStatusBadge() {
  const status = useMarketStatus();
  const autoRefresh = useAutoRefreshInterval();
  const config = phaseConfig[status.phase];
  const isActive = status.phase === "open" || status.phase === "pre-open" || status.phase === "pre-close";
  const isLive = autoRefresh !== false;
  const countdownDesc = getCountdownDescription(status.phase, status.countdown, status.nextPhaseLabel);
  const isMobile = useIsMobile();

  // ─── Mobile: Minimal indicator (just green dot + short status) ───
  if (isMobile) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-1.5 py-1">
              {/* Pulsing dot — green when live, phase-colored otherwise */}
              <span className="relative flex h-2.5 w-2.5">
                {(isActive || isLive) && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isLive ? "bg-emerald-400/40" : config.pulseColor}`} />
                )}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isLive ? "bg-emerald-400" : config.dotColor}`} />
              </span>
              {/* Short phase label */}
              <span className={`text-[10px] font-semibold ${isLive ? "text-emerald-400" : ""}`}>
                {status.phase === "open" ? "Open" : 
                 status.phase === "pre-open" ? "Pre" :
                 status.phase === "pre-close" ? "Close" :
                 status.phase === "holiday" ? "Off" : "Closed"}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs bg-popover text-popover-foreground">
            <div className="space-y-1.5">
              <p className="font-medium text-[11px] text-popover-foreground">{status.label}</p>
              <p className="text-xs text-popover-foreground/80">{status.description}</p>
              {status.countdown && (
                <div className="flex items-center gap-2 text-xs pt-1 border-t border-border/50">
                  <Timer className="h-3.5 w-3.5 text-primary" />
                  <span className="font-semibold text-popover-foreground">{countdownDesc}</span>
                </div>
              )}
              {status.holiday && (
                <div className="flex items-center gap-2 text-xs text-purple-400 pt-1 border-t border-border/50">
                  <CalendarOff className="h-3 w-3" />
                  <span>{status.holiday.name}{status.holiday.nameAr ? ` — ${status.holiday.nameAr}` : ""}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-popover-foreground/80 pt-1 border-t border-border/50">
                <Clock className="h-3 w-3" />
                <span>{status.uaeDayStr}, {status.uaeTimeStr} UAE (GMT+4)</span>
              </div>
              {isLive && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 pt-1 border-t border-border/50">
                  <Wifi className="h-3 w-3" />
                  <span>Live feed — auto-refreshing every {autoRefresh === 30000 ? "30s" : "60s"}</span>
                </div>
              )}
              <div className="text-[10px] text-popover-foreground/70 pt-1 border-t border-border/50">
                <p>Mon-Fri: Pre-Open 9:30 · Open 10:00 · Pre-Close 2:45 · Close 3:00</p>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // ─── Desktop: Full badge + LIVE signal + UAE time ───
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            {/* Phase Badge */}
            <Badge
              variant="outline"
              className={`gap-1.5 px-2.5 py-1 text-[11px] font-medium cursor-default select-none dark:shadow-[0_0_8px_rgba(255,255,255,0.04)] ${config.color}`}
            >
              <span className="relative flex h-2 w-2">
                {isActive && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.pulseColor}`} />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`} />
              </span>
              {status.phase === "holiday" ? (
                <span className="flex items-center gap-1">
                  <CalendarOff className="h-3 w-3" />
                  Holiday
                </span>
              ) : (
                status.label
              )}
              {status.countdown && (
                <span className="text-[10px] opacity-80 font-mono ml-0.5 hidden xl:inline">({status.countdown})</span>
              )}
            </Badge>

            {/* LIVE Signal - just a green pulsing dot (no text, no wifi icon) */}
            {isLive && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
            )}

            {/* UAE Time */}
            <span className="text-[10px] text-muted-foreground font-mono hidden xl:inline">
              {status.uaeTimeStr}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs bg-popover text-popover-foreground">
          <div className="space-y-1.5">
            <p className="font-medium text-[11px] text-popover-foreground">{status.label}</p>
            <p className="text-xs text-popover-foreground/80">{status.description}</p>
            
            {/* Countdown Timer - prominent display */}
            {status.countdown && (
              <div className="flex items-center gap-2 text-xs pt-1 border-t border-border/50">
                <Timer className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold text-popover-foreground">{countdownDesc}</span>
              </div>
            )}
            
            {status.holiday && (
              <div className="flex items-center gap-2 text-xs text-purple-400 pt-1 border-t border-border/50">
                <CalendarOff className="h-3 w-3" />
                <span>{status.holiday.name}{status.holiday.nameAr ? ` — ${status.holiday.nameAr}` : ""}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-popover-foreground/80 pt-1 border-t border-border/50">
              <Clock className="h-3 w-3" />
              <span>{status.uaeDayStr}, {status.uaeTimeStr} UAE (GMT+4)</span>
            </div>
            {isLive && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 pt-1 border-t border-border/50">
                <Wifi className="h-3 w-3" />
                <span>Live feed — auto-refreshing every {autoRefresh === 30000 ? "30s" : "60s"}</span>
              </div>
            )}
            {status.countdown && (
              <p className="text-xs text-popover-foreground/80">
                Next: <span className="font-medium text-popover-foreground">{status.nextPhaseLabel}</span>
              </p>
            )}
            <div className="text-[10px] text-popover-foreground/70 pt-1 border-t border-border/50">
              <p>Mon-Fri: Pre-Open 9:30 · Open 10:00 · Pre-Close 2:45 · Close 3:00</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
