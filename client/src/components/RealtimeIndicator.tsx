/**
 * RealtimeIndicator - Shows real-time WebSocket connection status
 * Displays a subtle indicator showing if live data is streaming
 */

import { Wifi, WifiOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
              <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
              <WifiOff className="h-3.5 w-3.5 text-muted-foreground/30" />
              <span className="text-[10px] font-medium text-muted-foreground/30 uppercase tracking-wider">Offline</span>
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
