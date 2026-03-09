import { useMarketStatus } from "@/hooks/useMarketStatus";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Clock } from "lucide-react";

const phaseConfig = {
  "pre-open": {
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    dotColor: "bg-amber-400",
    pulseColor: "bg-amber-400/40",
  },
  "open": {
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    dotColor: "bg-emerald-400",
    pulseColor: "bg-emerald-400/40",
  },
  "pre-close": {
    color: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    dotColor: "bg-orange-400",
    pulseColor: "bg-orange-400/40",
  },
  "closed": {
    color: "bg-red-500/10 text-red-400/70 border-red-500/20",
    dotColor: "bg-red-400/70",
    pulseColor: "bg-red-400/30",
  },
};

/**
 * Compact market status indicator for the dashboard header.
 * Shows a colored dot + label + countdown.
 */
export function MarketStatusBadge() {
  const status = useMarketStatus();
  const config = phaseConfig[status.phase];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`gap-1.5 px-2.5 py-1 text-[11px] font-medium cursor-default select-none ${config.color}`}
          >
            <span className="relative flex h-2 w-2">
              {(status.phase === "open" || status.phase === "pre-open" || status.phase === "pre-close") && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.pulseColor}`} />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`} />
            </span>
            {status.label}
            {status.countdown && (
              <span className="text-[10px] opacity-70 font-mono ml-0.5">({status.countdown})</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1.5">
            <p className="font-medium text-sm">{status.label}</p>
            <p className="text-xs text-muted-foreground">{status.description}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
              <Clock className="h-3 w-3" />
              <span>{status.uaeDayStr}, {status.uaeTimeStr} UAE</span>
            </div>
            {status.countdown && (
              <p className="text-xs">
                Next: <span className="font-medium text-foreground">{status.nextPhaseLabel}</span>
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Full market status card for the dashboard.
 * Shows phase, time, schedule, and next phase countdown.
 */
export function MarketStatusCard() {
  const status = useMarketStatus();
  const config = phaseConfig[status.phase];

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${config.color}`}>
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          {(status.phase === "open" || status.phase === "pre-open" || status.phase === "pre-close") && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.pulseColor}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.dotColor}`} />
        </span>
        <span className="font-semibold text-sm">{status.label}</span>
      </div>
      <span className="text-xs opacity-70">{status.uaeDayStr} {status.uaeTimeStr}</span>
      {status.countdown && (
        <span className="text-xs font-mono ml-auto opacity-80">
          {status.nextPhaseLabel} in {status.countdown}
        </span>
      )}
    </div>
  );
}
