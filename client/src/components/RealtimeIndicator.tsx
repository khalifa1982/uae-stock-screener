/**
 * RealtimeIndicator - Shows real-time WebSocket connection status
 * Displays a subtle indicator showing if live data is streaming
 */

import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMarketStatus } from "@/hooks/useMarketStatus";

interface RealtimeIndicatorProps {
  isConnected: boolean;
  subscribedCount?: number;
  className?: string;
}

export function RealtimeIndicator({ isConnected, subscribedCount, className = "" }: RealtimeIndicatorProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-1.5 ${className}`}>
          {isConnected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-green opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-green" />
              </span>
              <Wifi className="h-3.5 w-3.5 text-neon-green/70" />
              <span className="text-[10px] font-medium text-neon-green/70 uppercase tracking-wider">Live</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
              <WifiOff className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Offline</span>
            </>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {isConnected ? (
          <span>Real-time data streaming via TwelveData WebSocket{subscribedCount ? ` (${subscribedCount} symbols)` : ""}</span>
        ) : (
          <span>WebSocket disconnected. Data updates via polling.</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * DataConnectionIndicator - Shows data feed connection status on stock detail pages
 * 
 * When connected (WebSocket active): green wifi icon + "Synced" label
 * When disconnected: red wifi-off icon + "Disconnected" label  
 * Designed to NOT duplicate the LIVE indicator in the main header bar.
 */
interface DataConnectionIndicatorProps {
  isConnected: boolean;
  className?: string;
}

export function DataConnectionIndicator({ isConnected, className = "" }: DataConnectionIndicatorProps) {
  const status = useMarketStatus();
  const isMarketActive = status.phase === "open" || status.phase === "pre-open" || status.phase === "pre-close";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-1 ${className}`}>
          {isConnected ? (
            <>
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              <Wifi className="h-3 w-3 text-emerald-400" />
              <span className="text-[9px] font-medium text-emerald-400 uppercase tracking-wider">Synced</span>
            </>
          ) : isMarketActive ? (
            <>
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              <RefreshCw className="h-3 w-3 text-emerald-400" />
              <span className="text-[9px] font-medium text-emerald-400 uppercase tracking-wider">Live</span>
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-red-400/70" />
              <WifiOff className="h-3 w-3 text-red-400/70" />
              <span className="text-[9px] font-medium text-red-400/70 uppercase tracking-wider">Offline</span>
            </>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs bg-popover text-popover-foreground">
        {isConnected ? (
          <span className="text-popover-foreground">Real-time data streaming via WebSocket</span>
        ) : isMarketActive ? (
          <span className="text-popover-foreground">Data syncing via live API polling. Auto-refreshes every 30s.</span>
        ) : (
          <span className="text-popover-foreground">Market closed. Data will sync when market reopens.</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
