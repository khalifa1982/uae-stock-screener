/**
 * StockScore — UAE Equity-inspired scoring display
 * Shows Safety/Valuation/Growth out of 10 with colored pills and total score
 */
import { Badge } from "@/components/ui/badge";
import { Shield, Target, TrendingUp } from "lucide-react";

export interface StockScoreData {
  safety: number;      // 0-10
  valuation: number;   // 0-10
  growth: number;      // 0-10
  total: number;       // 0-10
  status: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
}

interface StockScoreProps {
  score: StockScoreData;
  compact?: boolean;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "Strong Buy": return "bg-gain/20 text-gain border-gain/30";
    case "Buy": return "bg-gain/10 text-gain border-gain/20";
    case "Hold": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    case "Sell": return "bg-loss/10 text-loss border-loss/20";
    case "Strong Sell": return "bg-loss/20 text-loss border-loss/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function getScoreColor(score: number): string {
  if (score >= 8) return "text-gain";
  if (score >= 6) return "text-emerald-400";
  if (score >= 4) return "text-amber-500";
  if (score >= 2) return "text-orange-500";
  return "text-loss";
}

/** Score bar visualization (0-10 gradient) */
function ScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const hue = (score / 10) * 120; // 0=red, 120=green
  return (
    <div className="h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          background: `hsl(${hue}, 70%, 50%)`,
        }}
      />
    </div>
  );
}

/** Full score display with pills */
export function StockScoreDisplay({ score, compact }: StockScoreProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold tabular-nums ${getScoreColor(score.total)}`}>
          {score.total.toFixed(1)}
        </span>
        <span className="text-xs text-muted-foreground">/10</span>
        <Badge variant="outline" className={`text-[10px] h-5 ${getStatusColor(score.status)}`}>
          {score.status}
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sub-scores as pills */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
          <Shield className="h-3 w-3 text-blue-400" />
          <span className="text-xs font-medium text-blue-400">Safety</span>
          <span className="text-xs font-bold text-blue-300">{score.safety.toFixed(1)}/10</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <Target className="h-3 w-3 text-emerald-400" />
          <span className="text-xs font-medium text-emerald-400">Valuation</span>
          <span className="text-xs font-bold text-emerald-300">{score.valuation.toFixed(1)}/10</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
          <TrendingUp className="h-3 w-3 text-amber-400" />
          <span className="text-xs font-medium text-amber-400">Growth</span>
          <span className="text-xs font-bold text-amber-300">{score.growth.toFixed(1)}/10</span>
        </div>
      </div>

      {/* Total score */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Score</span>
        <span className={`text-2xl font-bold tabular-nums ${getScoreColor(score.total)}`}>
          {score.total.toFixed(1)}
        </span>
        <span className="text-sm text-muted-foreground">/10</span>
        <Badge variant="outline" className={`ml-auto text-xs font-semibold ${getStatusColor(score.status)}`}>
          {score.status}
        </Badge>
      </div>

      {/* Score bar */}
      <ScoreBar score={score.total} />
    </div>
  );
}

/** Compact inline score for table rows */
export function InlineScore({ score, total }: { score: number; total?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12">
        <ScoreBar score={score} />
      </div>
      <span className={`text-[11px] font-bold tabular-nums ${getScoreColor(score)}`}>
        {score.toFixed(1)}
      </span>
      {total && <span className="text-[10px] text-muted-foreground">/10</span>}
    </div>
  );
}

/** Calculate stock score from available financial data */
export function calculateStockScore(data: {
  pe: number | null;
  dividendYield: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  returnOnEquity: number | null;
  perfYear: number | null;
  priceToBook: number | null;
  beta: number | null;
  marketCap: number | null;
}): StockScoreData {
  let safety = 5;
  let valuation = 5;
  let growth = 5;

  // Safety Score (0-10)
  // Based on: debt/equity, current ratio, beta, market cap
  let safetyPoints = 0;
  let safetyChecks = 0;

  if (data.debtToEquity != null) {
    safetyChecks++;
    if (data.debtToEquity < 30) safetyPoints += 10;
    else if (data.debtToEquity < 60) safetyPoints += 8;
    else if (data.debtToEquity < 100) safetyPoints += 6;
    else if (data.debtToEquity < 150) safetyPoints += 4;
    else safetyPoints += 2;
  }
  if (data.currentRatio != null) {
    safetyChecks++;
    if (data.currentRatio > 2) safetyPoints += 10;
    else if (data.currentRatio > 1.5) safetyPoints += 8;
    else if (data.currentRatio > 1) safetyPoints += 6;
    else if (data.currentRatio > 0.5) safetyPoints += 4;
    else safetyPoints += 2;
  }
  if (data.beta != null) {
    safetyChecks++;
    if (data.beta < 0.5) safetyPoints += 9;
    else if (data.beta < 0.8) safetyPoints += 8;
    else if (data.beta < 1.2) safetyPoints += 6;
    else if (data.beta < 1.5) safetyPoints += 4;
    else safetyPoints += 2;
  }
  if (data.marketCap != null) {
    safetyChecks++;
    if (data.marketCap > 50e9) safetyPoints += 10;
    else if (data.marketCap > 10e9) safetyPoints += 8;
    else if (data.marketCap > 2e9) safetyPoints += 6;
    else if (data.marketCap > 500e6) safetyPoints += 4;
    else safetyPoints += 2;
  }
  if (safetyChecks > 0) safety = safetyPoints / safetyChecks;

  // Valuation Score (0-10)
  // Based on: P/E, P/B, dividend yield
  let valPoints = 0;
  let valChecks = 0;

  if (data.pe != null && data.pe > 0) {
    valChecks++;
    if (data.pe < 8) valPoints += 10;
    else if (data.pe < 12) valPoints += 8;
    else if (data.pe < 18) valPoints += 6;
    else if (data.pe < 25) valPoints += 4;
    else valPoints += 2;
  }
  if (data.priceToBook != null && data.priceToBook > 0) {
    valChecks++;
    if (data.priceToBook < 1) valPoints += 10;
    else if (data.priceToBook < 1.5) valPoints += 8;
    else if (data.priceToBook < 2.5) valPoints += 6;
    else if (data.priceToBook < 4) valPoints += 4;
    else valPoints += 2;
  }
  if (data.dividendYield != null) {
    valChecks++;
    const dy = data.dividendYield > 1 ? data.dividendYield : data.dividendYield * 100; // normalize
    if (dy > 6) valPoints += 10;
    else if (dy > 4) valPoints += 8;
    else if (dy > 2) valPoints += 6;
    else if (dy > 1) valPoints += 4;
    else valPoints += 2;
  }
  if (valChecks > 0) valuation = valPoints / valChecks;

  // Growth Score (0-10)
  // Based on: ROE, yearly performance
  let growthPoints = 0;
  let growthChecks = 0;

  if (data.returnOnEquity != null) {
    growthChecks++;
    const roe = data.returnOnEquity > 1 ? data.returnOnEquity : data.returnOnEquity * 100;
    if (roe > 25) growthPoints += 10;
    else if (roe > 15) growthPoints += 8;
    else if (roe > 10) growthPoints += 6;
    else if (roe > 5) growthPoints += 4;
    else growthPoints += 2;
  }
  if (data.perfYear != null) {
    growthChecks++;
    if (data.perfYear > 50) growthPoints += 10;
    else if (data.perfYear > 20) growthPoints += 8;
    else if (data.perfYear > 5) growthPoints += 6;
    else if (data.perfYear > -10) growthPoints += 4;
    else growthPoints += 2;
  }
  if (growthChecks > 0) growth = growthPoints / growthChecks;

  // Total = weighted average
  const total = (safety * 0.3 + valuation * 0.4 + growth * 0.3);

  // Status
  let status: StockScoreData["status"];
  if (total >= 8) status = "Strong Buy";
  else if (total >= 6.5) status = "Buy";
  else if (total >= 4.5) status = "Hold";
  else if (total >= 3) status = "Sell";
  else status = "Strong Sell";

  return { safety, valuation, growth, total, status };
}
