import { CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface Check {
  id: string;
  label: string;
  description: string;
  passed: boolean;
  value?: string;
  threshold?: string;
}

interface Category {
  name: string;
  score: number;
  maxScore: number;
  checks: Check[];
}

const CATEGORY_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  Value: { icon: "💎", color: "oklch(0.65 0.20 270)", bg: "oklch(0.65 0.20 270 / 10%)" },
  Future: { icon: "🚀", color: "oklch(0.65 0.20 200)", bg: "oklch(0.65 0.20 200 / 10%)" },
  Past: { icon: "📊", color: "oklch(0.65 0.20 145)", bg: "oklch(0.65 0.20 145 / 10%)" },
  Health: { icon: "🛡️", color: "oklch(0.65 0.20 50)", bg: "oklch(0.65 0.20 50 / 10%)" },
  Dividend: { icon: "💰", color: "oklch(0.65 0.20 330)", bg: "oklch(0.65 0.20 330 / 10%)" },
};

function ScoreBar({ score, maxScore, color }: { score: number; maxScore: number; color: string }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: maxScore }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 w-4 rounded-full transition-all"
          style={{
            background: i < score ? color : 'var(--secondary)',
            opacity: i < score ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}

function CategorySection({ category }: { category: Category }) {
  const [expanded, setExpanded] = useState(false);
  const config = CATEGORY_ICONS[category.name] || CATEGORY_ICONS.Value;
  const passedCount = category.checks.filter(c => c.passed).length;

  return (
    <div className="border border-border/50  overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8  flex items-center justify-center text-sm"
            style={{ background: config.bg }}
          >
            {config.icon}
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold">{category.name}</div>
            <div className="text-xs text-muted-foreground">
              {passedCount} of {category.maxScore} checks passed
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ScoreBar score={category.score} maxScore={category.maxScore} color={config.color} />
          <span className="text-sm font-bold font-mono" style={{ color: config.color }}>
            {category.score}/{category.maxScore}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/30 divide-y divide-border/20">
          {category.checks.map((check) => (
            <div key={check.id} className="px-3 py-2.5 flex items-start gap-2.5">
              {check.passed ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-gain" />
              ) : (
                <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-loss" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{check.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{check.description}</div>
                {(check.value || check.threshold) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                    {check.value && check.value !== 'N/A' && (
                      <span className="text-xs">
                        <span className="text-muted-foreground">Actual: </span>
                        <span className="font-mono font-medium">{check.value}</span>
                      </span>
                    )}
                    {check.threshold && check.threshold !== 'N/A' && (
                      <span className="text-xs">
                        <span className="text-muted-foreground">Required: </span>
                        <span className="font-mono">{check.threshold}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AnalysisChecks({ categories }: { categories: Category[] }) {
  return (
    <div className="space-y-2">
      {categories.map((cat) => (
        <CategorySection key={cat.name} category={cat} />
      ))}
    </div>
  );
}
