interface FairValueGaugeProps {
  currentPrice: number;
  fairValue: number | null;
  discount: number | null;
  method: string;
}

export function FairValueGauge({ currentPrice, fairValue, discount, method }: FairValueGaugeProps) {
  if (!fairValue || discount === null) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="text-sm text-muted-foreground">Insufficient data for fair value estimation</div>
      </div>
    );
  }

  const isUndervalued = discount > 0;
  const absDiscount = Math.abs(discount);
  
  // Calculate bar positions
  const minPrice = Math.min(currentPrice, fairValue) * 0.7;
  const maxPrice = Math.max(currentPrice, fairValue) * 1.3;
  const range = maxPrice - minPrice;
  const currentPos = ((currentPrice - minPrice) / range) * 100;
  const fairPos = ((fairValue - minPrice) / range) * 100;

  return (
    <div className="space-y-4">
      {/* Main gauge */}
      <div className="relative pt-8 pb-2">
        {/* Price bar */}
        <div className="relative h-3 rounded-full bg-secondary/50 overflow-hidden">
          {/* Fill from min to current price */}
          <div
            className="absolute h-full rounded-full transition-all duration-500"
            style={{
              left: 0,
              width: `${currentPos}%`,
              background: isUndervalued
                ? 'linear-gradient(90deg, oklch(0.72 0.17 155 / 60%), oklch(0.72 0.17 155))'
                : 'linear-gradient(90deg, oklch(0.65 0.22 25 / 60%), oklch(0.65 0.22 25))',
            }}
          />
        </div>

        {/* Current price marker */}
        <div
          className="absolute top-0 flex flex-col items-center"
          style={{ left: `${currentPos}%`, transform: 'translateX(-50%)' }}
        >
          <span className="text-xs font-bold text-foreground whitespace-nowrap">
            AED {currentPrice.toFixed(3)}
          </span>
          <span className="text-[10px] text-muted-foreground">Current</span>
          <div className="w-0.5 h-3 bg-foreground/60 mt-0.5" />
        </div>

        {/* Fair value marker */}
        <div
          className="absolute flex flex-col items-center"
          style={{ left: `${fairPos}%`, transform: 'translateX(-50%)', top: '-2px' }}
        >
          <div className="w-0.5 h-3 mt-[42px]" style={{ background: isUndervalued ? 'oklch(0.72 0.17 155)' : 'oklch(0.65 0.22 25)' }} />
          <span className="text-[10px] text-muted-foreground mt-0.5">Fair Value</span>
          <span className="text-xs font-bold whitespace-nowrap" style={{ color: isUndervalued ? 'oklch(0.72 0.17 155)' : 'oklch(0.65 0.22 25)' }}>
            AED {fairValue.toFixed(3)}
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: isUndervalued ? 'oklch(0.72 0.17 155)' : 'oklch(0.65 0.22 25)' }}
          />
          <span className="text-sm font-medium">
            {isUndervalued ? 'Undervalued' : 'Overvalued'} by {absDiscount.toFixed(1)}%
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          Method: {method}
        </span>
      </div>
    </div>
  );
}
