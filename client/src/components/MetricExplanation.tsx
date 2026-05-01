/**
 * MetricExplanation — Tooltip/popover explaining financial metrics
 * Inspired by uaeequity.app's educational approach for beginners
 */
import { HelpCircle } from "lucide-react";
import { useState } from "react";

const METRIC_EXPLANATIONS: Record<string, { title: string; description: string; good: string; bad: string }> = {
  pe: {
    title: "Price-to-Earnings (P/E)",
    description: "Measures how much investors pay for each AED of earnings. A lower P/E may indicate the stock is undervalued relative to its earnings.",
    good: "P/E below 15 is generally considered good value",
    bad: "P/E above 30 may indicate overvaluation",
  },
  pb: {
    title: "Price-to-Book (P/B)",
    description: "Compares the stock price to the company's book value (assets minus liabilities). A P/B below 1 means the stock trades below its net asset value.",
    good: "P/B below 1.5 suggests reasonable valuation",
    bad: "P/B above 5 may indicate overpricing",
  },
  eps: {
    title: "Earnings Per Share (EPS)",
    description: "The portion of a company's profit allocated to each outstanding share. Higher EPS indicates more profitability per share.",
    good: "Growing EPS year-over-year is a positive sign",
    bad: "Negative EPS means the company is losing money",
  },
  dividendYield: {
    title: "Dividend Yield",
    description: "Annual dividend payment as a percentage of the stock price. Shows how much cash flow you get for each AED invested.",
    good: "Yield above 3% is attractive for income investors",
    bad: "Very high yields (>10%) may be unsustainable",
  },
  roe: {
    title: "Return on Equity (ROE)",
    description: "Measures how efficiently a company uses shareholder equity to generate profits. Higher ROE means better capital efficiency.",
    good: "ROE above 15% indicates strong management",
    bad: "ROE below 5% suggests poor capital utilization",
  },
  debtToEquity: {
    title: "Debt-to-Equity Ratio",
    description: "Shows how much debt a company uses relative to shareholder equity. Lower ratios indicate less financial risk.",
    good: "D/E below 50% is considered conservative",
    bad: "D/E above 100% indicates high leverage risk",
  },
  currentRatio: {
    title: "Current Ratio",
    description: "Measures a company's ability to pay short-term obligations. A ratio above 1 means the company can cover its short-term debts.",
    good: "Above 1.5 indicates strong liquidity",
    bad: "Below 1.0 may signal liquidity problems",
  },
  beta: {
    title: "Beta",
    description: "Measures stock volatility relative to the market. Beta of 1 means the stock moves with the market. Higher beta = more volatile.",
    good: "Beta 0.5-1.0 for conservative investors",
    bad: "Beta above 1.5 means significantly higher risk",
  },
  rsi: {
    title: "RSI (Relative Strength Index)",
    description: "Momentum indicator measuring speed and magnitude of price changes. Ranges from 0-100.",
    good: "RSI 30-70 is the normal range",
    bad: "Above 70 = overbought, Below 30 = oversold",
  },
  marketCap: {
    title: "Market Capitalization",
    description: "Total market value of a company's outstanding shares. Calculated as share price × total shares outstanding.",
    good: "Large-cap (>10B AED) = more stable",
    bad: "Micro-cap (<500M AED) = higher risk",
  },
};

interface MetricExplanationProps {
  metric: string;
  className?: string;
}

export function MetricExplanation({ metric, className = "" }: MetricExplanationProps) {
  const [show, setShow] = useState(false);
  const info = METRIC_EXPLANATIONS[metric];
  if (!info) return null;

  return (
    <span className={`relative inline-block ${className}`}>
      <button
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
        className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        title={info.title}
      >
        <HelpCircle className="h-3 w-3" />
      </button>
      {show && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShow(false)} />
          <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-popover border border-border shadow-lg text-left">
            <p className="text-xs font-semibold text-foreground mb-1">{info.title}</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">{info.description}</p>
            <div className="space-y-1">
              <p className="text-[10px] text-gain flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-gain inline-block" />
                {info.good}
              </p>
              <p className="text-[10px] text-loss flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-loss inline-block" />
                {info.bad}
              </p>
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="w-2 h-2 rotate-45 bg-popover border-r border-b border-border" />
            </div>
          </div>
        </>
      )}
    </span>
  );
}

/** Get explanation text for a metric (for inline use) */
export function getMetricExplanation(metric: string): string | null {
  return METRIC_EXPLANATIONS[metric]?.description || null;
}
