import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Calendar,
  Globe,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Loader2,
  FileText,
  Sparkles,
} from "lucide-react";
import { Streamdown } from "streamdown";

// ─── Types ──────────────────────────────────────────────────────────

interface StockMover {
  symbol: string;
  name: string;
  nameAr?: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

// ─── Component ──────────────────────────────────────────────────────

export default function MarketSummary() {
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const isArabic = language === "ar";

  // Fetch latest summaries
  const { data: latestSummaries, isLoading } = trpc.summary.latest.useQuery(
    { language, limit: 20 },
    { refetchInterval: 60_000 }
  );

  // Fetch specific date if selected
  const { data: dateSummaries } = trpc.summary.byDate.useQuery(
    { date: selectedDate || "", language },
    { enabled: !!selectedDate }
  );

  // Generate mutation (admin only)
  const generateMutation = trpc.summary.generate.useMutation();

  // Get unique dates from summaries
  const availableDates = useMemo(() => {
    if (!latestSummaries) return [];
    const dateSet = new Set<string>();
    latestSummaries.forEach((s: any) => dateSet.add(s.date));
    return Array.from(dateSet).sort((a: string, b: string) => b.localeCompare(a));
  }, [latestSummaries]);

  // Current display summaries
  const displaySummaries = selectedDate ? dateSummaries : latestSummaries;

  // Group by exchange
  const adxSummary = displaySummaries?.find((s: any) => s.exchange === "ADX");
  const dfmSummary = displaySummaries?.find((s: any) => s.exchange === "DFM");

  const currentDate = selectedDate || availableDates[0] || new Date().toISOString().split("T")[0];

  // Navigate dates
  const navigateDate = (direction: "prev" | "next") => {
    const idx = availableDates.indexOf(currentDate);
    if (direction === "prev" && idx < availableDates.length - 1) {
      setSelectedDate(availableDates[idx + 1]);
    } else if (direction === "next" && idx > 0) {
      setSelectedDate(availableDates[idx - 1]);
    }
  };

  const t = {
    title: isArabic ? "ملخص السوق اليومي" : "Daily Market Summary",
    subtitle: isArabic ? "تقرير آلي لأسواق الإمارات" : "Automated UAE Market Report",
    adx: isArabic ? "سوق أبوظبي" : "ADX",
    dfm: isArabic ? "سوق دبي" : "DFM",
    volume: isArabic ? "حجم التداول" : "Volume",
    value: isArabic ? "قيمة التداول" : "Value",
    trades: isArabic ? "الأسهم المتداولة" : "Stocks Traded",
    advancers: isArabic ? "مرتفعة" : "Advancers",
    decliners: isArabic ? "منخفضة" : "Decliners",
    unchanged: isArabic ? "دون تغيير" : "Unchanged",
    topGainers: isArabic ? "أكبر الرابحين" : "Top Gainers",
    topLosers: isArabic ? "أكبر الخاسرين" : "Top Losers",
    mostActive: isArabic ? "الأكثر نشاطاً" : "Most Active",
    sectors: isArabic ? "أداء القطاعات" : "Sector Performance",
    narrative: isArabic ? "التحليل" : "Analysis",
    noData: isArabic ? "لا توجد بيانات متاحة بعد" : "No summaries available yet",
    noDataSub: isArabic ? "سيتم إنشاء الملخصات تلقائياً بعد إغلاق السوق" : "Summaries are auto-generated after market close",
    generate: isArabic ? "إنشاء الملخص" : "Generate Now",
    generating: isArabic ? "جاري الإنشاء..." : "Generating...",
    loading: isArabic ? "جاري التحميل..." : "Loading...",
    stock: isArabic ? "السهم" : "Stock",
    price: isArabic ? "السعر" : "Price",
    change: isArabic ? "التغير" : "Change",
    volumeCol: isArabic ? "الحجم" : "Volume",
    sector: isArabic ? "القطاع" : "Sector",
    avgChange: isArabic ? "متوسط التغير" : "Avg Change",
    count: isArabic ? "العدد" : "Count",
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className={`space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <div className="flex items-center rounded-lg border border-border/40 overflow-hidden">
            <button
              onClick={() => setLanguage("en")}
              className={`px-3 py-1.5 text-xs font-medium transition-all ${
                language === "en"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent/40 text-muted-foreground"
              }`}
            >
              <Globe className="h-3.5 w-3.5 inline mr-1" />
              English
            </button>
            <button
              onClick={() => setLanguage("ar")}
              className={`px-3 py-1.5 text-xs font-medium transition-all ${
                language === "ar"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent/40 text-muted-foreground"
              }`}
            >
              <Globe className="h-3.5 w-3.5 inline mr-1" />
              العربية
            </button>
          </div>

          {/* Generate button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="text-xs"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1" />
            )}
            {generateMutation.isPending ? t.generating : t.generate}
          </Button>
        </div>
      </div>

      {/* Date Navigation */}
      {availableDates.length > 0 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigateDate("prev")}
            disabled={availableDates.indexOf(currentDate) >= availableDates.length - 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-accent/30 border border-border/30">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{currentDate}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigateDate("next")}
            disabled={availableDates.indexOf(currentDate) <= 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">{t.loading}</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && (!displaySummaries || displaySummaries.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">{t.noData}</h3>
            <p className="text-sm text-muted-foreground/60 mt-1">{t.noDataSub}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1" />
              )}
              {generateMutation.isPending ? t.generating : t.generate}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Exchange Tabs */}
      {displaySummaries && displaySummaries.length > 0 && (
        <Tabs defaultValue="ADX" className="w-full">
          <TabsList className="grid w-full max-w-xs grid-cols-2 mx-auto">
            <TabsTrigger value="ADX">{t.adx}</TabsTrigger>
            <TabsTrigger value="DFM">{t.dfm}</TabsTrigger>
          </TabsList>

          {[
            { key: "ADX", summary: adxSummary },
            { key: "DFM", summary: dfmSummary },
          ].map(({ key, summary }) => (
            <TabsContent key={key} value={key} className="space-y-4 mt-4">
              {summary ? (
                <ExchangeSummaryView summary={summary} t={t} isArabic={isArabic} />
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-10 text-center text-muted-foreground">
                    {t.noData}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

// ─── Exchange Summary View ──────────────────────────────────────────

function ExchangeSummaryView({
  summary,
  t,
  isArabic,
}: {
  summary: any;
  t: Record<string, string>;
  isArabic: boolean;
}) {
  const topGainers: StockMover[] = summary.topGainers ? JSON.parse(summary.topGainers) : [];
  const topLosers: StockMover[] = summary.topLosers ? JSON.parse(summary.topLosers) : [];
  const mostActive: StockMover[] = summary.mostActive ? JSON.parse(summary.mostActive) : [];
  const sectorPerf: Record<string, { avgChange: number; count: number }> = summary.sectorPerformance
    ? JSON.parse(summary.sectorPerformance)
    : {};

  return (
    <div className="space-y-4">
      {/* Key Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label={t.volume}
          value={summary.totalVolume ? formatNumber(summary.totalVolume) : "—"}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <StatCard
          label={t.value}
          value={summary.totalValue ? `AED ${formatMillions(summary.totalValue)}` : "—"}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label={t.trades}
          value={summary.totalTrades?.toString() || "—"}
          icon={<FileText className="h-4 w-4" />}
        />
        <StatCard
          label={t.advancers}
          value={summary.advancers?.toString() || "0"}
          icon={<ArrowUpRight className="h-4 w-4 text-emerald-500" />}
          className="text-emerald-500"
        />
        <StatCard
          label={t.decliners}
          value={summary.decliners?.toString() || "0"}
          icon={<ArrowDownRight className="h-4 w-4 text-red-500" />}
          className="text-red-500"
        />
        <StatCard
          label={t.unchanged}
          value={summary.unchanged?.toString() || "0"}
          icon={<Minus className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* AI Narrative */}
      {summary.narrative && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {t.narrative}
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
            <Streamdown>{summary.narrative}</Streamdown>
          </CardContent>
        </Card>
      )}

      {/* Top Movers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Gainers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              {t.topGainers}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <MoverTable movers={topGainers} type="gainer" t={t} isArabic={isArabic} />
          </CardContent>
        </Card>

        {/* Top Losers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              {t.topLosers}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <MoverTable movers={topLosers} type="loser" t={t} isArabic={isArabic} />
          </CardContent>
        </Card>

        {/* Most Active */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              {t.mostActive}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <MoverTable movers={mostActive} type="active" t={t} isArabic={isArabic} />
          </CardContent>
        </Card>
      </div>

      {/* Sector Performance */}
      {Object.keys(sectorPerf).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              {t.sectors}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className={`px-4 py-2 font-medium text-muted-foreground ${isArabic ? "text-right" : "text-left"}`}>{t.sector}</th>
                    <th className={`px-4 py-2 font-medium text-muted-foreground ${isArabic ? "text-left" : "text-right"}`}>{t.avgChange}</th>
                    <th className={`px-4 py-2 font-medium text-muted-foreground ${isArabic ? "text-left" : "text-right"}`}>{t.count}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(sectorPerf)
                    .sort((a, b) => b[1].avgChange - a[1].avgChange)
                    .map(([sector, data]) => (
                      <tr key={sector} className="border-b border-border/10 hover:bg-accent/20 transition-colors">
                        <td className={`px-4 py-2 font-medium ${isArabic ? "text-right" : "text-left"}`}>{sector}</td>
                        <td className={`px-4 py-2 font-mono ${isArabic ? "text-left" : "text-right"} ${
                          data.avgChange > 0 ? "text-emerald-500" : data.avgChange < 0 ? "text-red-500" : "text-muted-foreground"
                        }`}>
                          {data.avgChange > 0 ? "+" : ""}{data.avgChange.toFixed(2)}%
                        </td>
                        <td className={`px-4 py-2 text-muted-foreground ${isArabic ? "text-left" : "text-right"}`}>{data.count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  className = "",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={`text-lg font-bold tracking-tight ${className}`}>{value}</p>
    </Card>
  );
}

function MoverTable({
  movers,
  type,
  t,
  isArabic,
}: {
  movers: StockMover[];
  type: "gainer" | "loser" | "active";
  t: Record<string, string>;
  isArabic: boolean;
}) {
  if (movers.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">—</p>;
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border/30">
          <th className={`px-3 py-1.5 font-medium text-muted-foreground ${isArabic ? "text-right" : "text-left"}`}>{t.stock}</th>
          <th className={`px-3 py-1.5 font-medium text-muted-foreground ${isArabic ? "text-left" : "text-right"}`}>{t.price}</th>
          <th className={`px-3 py-1.5 font-medium text-muted-foreground ${isArabic ? "text-left" : "text-right"}`}>
            {type === "active" ? t.volumeCol : t.change}
          </th>
        </tr>
      </thead>
      <tbody>
        {movers.map((m, i) => (
          <tr key={m.symbol + i} className="border-b border-border/10 hover:bg-accent/20 transition-colors">
            <td className={`px-3 py-1.5 ${isArabic ? "text-right" : "text-left"}`}>
              <span className="font-medium">{m.symbol}</span>
              <span className="text-muted-foreground ml-1 hidden sm:inline">
                {isArabic && m.nameAr ? m.nameAr.slice(0, 20) : m.name.slice(0, 20)}
              </span>
            </td>
            <td className={`px-3 py-1.5 font-mono ${isArabic ? "text-left" : "text-right"}`}>
              {m.price.toFixed(2)}
            </td>
            <td className={`px-3 py-1.5 font-mono ${isArabic ? "text-left" : "text-right"} ${
              type === "active"
                ? "text-blue-500"
                : m.changePercent > 0
                ? "text-emerald-500"
                : "text-red-500"
            }`}>
              {type === "active"
                ? formatNumber(m.volume)
                : `${m.changePercent > 0 ? "+" : ""}${m.changePercent.toFixed(2)}%`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString();
}

function formatMillions(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  return (n / 1e6).toFixed(2) + "M";
}
