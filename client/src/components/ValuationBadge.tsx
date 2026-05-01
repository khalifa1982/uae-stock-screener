/**
 * ValuationBadge — Shows if a stock is undervalued, fairly valued, or overvalued
 * Based on fair value calculation from the snowflake engine
 */
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

interface ValuationBadgeProps {
  discount: number | null;  // positive = undervalued, negative = overvalued
  fairValue: number | null;
  currentPrice: number;
  compact?: boolean;
}

export function ValuationBadge({ discount, fairValue, currentPrice, compact }: ValuationBadgeProps) {
  if (discount == null || fairValue == null) return null;

  let status: "Undervalued" | "Fairly Valued" | "Overvalued";
  let color: string;
  let Icon: typeof ArrowDown;

  if (discount > 15) {
    status = "Undervalued";
    color = "bg-gain/10 text-gain border-gain/30";
    Icon = ArrowDown;
  } else if (discount < -15) {
    status = "Overvalued";
    color = "bg-loss/10 text-loss border-loss/30";
    Icon = ArrowUp;
  } else {
    status = "Fairly Valued";
    color = "bg-amber-500/10 text-amber-500 border-amber-500/30";
    Icon = Minus;
  }

  if (compact) {
    return (
      <Badge variant="outline" className={`text-[10px] h-5 ${color}`}>
        {status}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/30">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color.replace('text-', 'bg-').split(' ')[0]} backdrop-blur-md border ${color.split(' ')[2]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs font-semibold ${color}`}>
            {status}
          </Badge>
          {discount !== 0 && (
            <span className="text-xs text-muted-foreground">
              {discount > 0 ? `${discount.toFixed(0)}% below` : `${Math.abs(discount).toFixed(0)}% above`} fair value
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">Fair Value:</span>
          <span className="text-xs font-semibold text-foreground tabular-nums">AED {fairValue.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">Current:</span>
          <span className="text-xs font-semibold text-foreground tabular-nums">AED {currentPrice.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

/** Valuation filter buttons for the stock list */
export function ValuationFilterButtons({
  active,
  onChange,
}: {
  active: "all" | "undervalued" | "fair" | "overvalued";
  onChange: (val: "all" | "undervalued" | "fair" | "overvalued") => void;
}) {
  const buttons = [
    { id: "all" as const, label: "All", color: "" },
    { id: "undervalued" as const, label: "Undervalued", color: "text-gain" },
    { id: "fair" as const, label: "Fairly Valued", color: "text-amber-500" },
    { id: "overvalued" as const, label: "Overvalued", color: "text-loss" },
  ];

  return (
    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/50 dark:bg-white/[0.04] backdrop-blur-sm border border-white/30 dark:border-white/[0.08]">
      {buttons.map((btn) => (
        <button
          key={btn.id}
          onClick={() => onChange(btn.id)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            active === btn.id
              ? "bg-primary/90 text-white shadow-sm"
              : `${btn.color || "text-muted-foreground"} hover:text-foreground hover:bg-white/[0.06]`
          }`}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
