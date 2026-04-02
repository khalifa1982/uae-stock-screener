import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Globe, Users, Eye, TrendingUp, MapPin, BarChart3,
  Clock, ArrowLeft, RefreshCw, Activity,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

// ─── Country flag helper ─────────────────────────────────────────
function countryFlag(code: string): string {
  if (!code || code === 'XX' || code.length !== 2) return '🌍';
  const codePoints = Array.from(code.toUpperCase()).map(c => 0x1F1E6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

// ─── Stat Card ───────────────────────────────────────────────────
function StatCard({ title, value, icon: Icon, subtitle, color }: {
  title: string; value: string | number; icon: any; subtitle?: string; color: string;
}) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-xl ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Bar Chart (simple CSS) ──────────────────────────────────────
function SimpleBarChart({ data, maxBars = 14 }: {
  data: Array<{ label: string; value: number; secondary?: number }>;
  maxBars?: number;
}) {
  const sliced = data.slice(-maxBars);
  const maxVal = Math.max(...sliced.map(d => d.value), 1);

  return (
    <div className="flex items-end gap-1 h-40">
      {sliced.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[10px] text-muted-foreground">{d.value}</span>
          <div className="w-full flex flex-col items-center gap-0.5">
            <div
              className="w-full bg-emerald-500/80 rounded-t-sm min-h-[2px] transition-all duration-300"
              style={{ height: `${(d.value / maxVal) * 100}%`, minHeight: d.value > 0 ? 4 : 2 }}
            />
            {d.secondary !== undefined && (
              <div
                className="w-full bg-cyan-500/50 rounded-t-sm min-h-[1px]"
                style={{ height: `${(d.secondary / maxVal) * 40}%`, minHeight: d.secondary > 0 ? 2 : 1 }}
              />
            )}
          </div>
          <span className="text-[9px] text-muted-foreground truncate w-full text-center">
            {d.label.slice(5)} {/* Show MM-DD */}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Analytics Page ─────────────────────────────────────────
export default function Analytics() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [days, setDays] = useState(30);

  const { data: visitorStats, isLoading: statsLoading } = trpc.visitors.stats.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const { data: geo, isLoading: geoLoading, refetch: refetchGeo } = trpc.visitors.geoBreakdown.useQuery(
    { days },
    { enabled: user?.role === 'admin' }
  );

  const { data: pageData, isLoading: pageLoading, refetch: refetchPages } = trpc.visitors.pageAnalytics.useQuery(
    { days },
    { enabled: user?.role === 'admin' }
  );

  const { data: recentVisitors, isLoading: recentLoading, refetch: refetchRecent } = trpc.visitors.recentVisitors.useQuery(
    { limit: 50 },
    { enabled: user?.role === 'admin' }
  );

  const refreshAll = () => {
    refetchGeo();
    refetchPages();
    refetchRecent();
  };

  // Auth guard
  if (authLoading) {
    return (
      <div className="container py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="container py-16 text-center">
        <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Admin Access Required</h2>
        <p className="text-muted-foreground mb-4">This page is restricted to administrators.</p>
        <Button variant="outline" onClick={() => setLocation('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation('/admin')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-emerald-500" />
              Site Analytics
            </h1>
            <p className="text-sm text-muted-foreground">Visitor insights & page performance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Time range selector */}
          <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
            {[7, 14, 30, 90].map(d => (
              <Button
                key={d}
                variant={days === d ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setDays(d)}
              >
                {d}d
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Online Now"
          value={visitorStats?.onlineNow ?? 0}
          icon={Activity}
          subtitle="Active in last 5 min"
          color="bg-emerald-500/10 text-emerald-500"
        />
        <StatCard
          title="Today"
          value={formatNum(visitorStats?.todayVisitors ?? 0)}
          icon={Users}
          subtitle="Unique visitors"
          color="bg-cyan-500/10 text-cyan-500"
        />
        <StatCard
          title="Total Visitors"
          value={formatNum(visitorStats?.totalVisitors ?? 0)}
          icon={Globe}
          subtitle="All time"
          color="bg-violet-500/10 text-violet-500"
        />
        <StatCard
          title="Page Views"
          value={formatNum(visitorStats?.totalPageViews ?? 0)}
          icon={Eye}
          subtitle="All time"
          color="bg-amber-500/10 text-amber-500"
        />
      </div>

      {/* Daily Traffic Chart */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Daily Traffic (Last {days} days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pageLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : pageData?.dailyTraffic && pageData.dailyTraffic.length > 0 ? (
            <SimpleBarChart
              data={pageData.dailyTraffic.map(d => ({
                label: d.date,
                value: d.visitors,
                secondary: d.pageViews,
              }))}
              maxBars={days <= 14 ? days : 30}
            />
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
              No traffic data yet. Data will appear as visitors browse the site.
            </div>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 bg-emerald-500/80 rounded-sm inline-block" /> Visitors
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 bg-cyan-500/50 rounded-sm inline-block" /> Page Views
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout: Geo + Top Stocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Geographic Breakdown */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-violet-500" />
              Visitors by Country
            </CardTitle>
          </CardHeader>
          <CardContent>
            {geoLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : geo?.countries && geo.countries.length > 0 ? (
              <div className="space-y-1">
                {geo.countries.map((c, i) => {
                  const maxVisitors = geo.countries[0]?.visitors ?? 1;
                  return (
                    <div key={i} className="flex items-center gap-2 py-1.5 group hover:bg-muted/30 rounded px-2 -mx-2">
                      <span className="text-lg w-7 text-center">{countryFlag(c.countryCode)}</span>
                      <span className="text-sm flex-1 truncate">{c.country}</span>
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500/60 rounded-full transition-all"
                          style={{ width: `${(c.visitors / maxVisitors) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right font-mono">
                        {formatNum(c.visitors)}
                      </span>
                      <span className="text-xs text-muted-foreground/60 w-16 text-right">
                        {formatNum(c.pageViews)} pv
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No geographic data yet. Data will appear as visitors browse the site.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Visitors by City */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-cyan-500" />
              Top Cities
            </CardTitle>
          </CardHeader>
          <CardContent>
            {geoLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : geo?.cities && geo.cities.length > 0 ? (
              <div className="space-y-1">
                {geo.cities.slice(0, 15).map((c, i) => {
                  const maxVisitors = geo.cities[0]?.visitors ?? 1;
                  return (
                    <div key={i} className="flex items-center gap-2 py-1.5 hover:bg-muted/30 rounded px-2 -mx-2">
                      <span className="text-lg w-7 text-center">{countryFlag(c.countryCode)}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm truncate block">{c.city}</span>
                        <span className="text-[10px] text-muted-foreground">{c.country}</span>
                      </div>
                      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500/60 rounded-full transition-all"
                          style={{ width: `${(c.visitors / maxVisitors) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right font-mono">
                        {formatNum(c.visitors)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No city data yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two-column: Top Stocks + Top Pages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Viewed Stocks */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-500" />
              Most Viewed Stocks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pageLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : pageData?.topStocks && pageData.topStocks.length > 0 ? (
              <div className="space-y-1">
                {pageData.topStocks.map((s, i) => {
                  const maxViews = pageData.topStocks[0]?.totalViews ?? 1;
                  return (
                    <div key={i} className="flex items-center gap-2 py-1.5 hover:bg-muted/30 rounded px-2 -mx-2 cursor-pointer"
                      onClick={() => setLocation(`/stock/${s.symbol}`)}
                    >
                      <Badge variant="outline" className="font-mono text-xs w-20 justify-center">
                        {s.symbol}
                      </Badge>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500/60 rounded-full transition-all"
                          style={{ width: `${(s.totalViews / maxViews) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-14 text-right font-mono">
                        {formatNum(s.totalViews)} views
                      </span>
                      <span className="text-xs text-muted-foreground/60 w-12 text-right">
                        {s.uniqueVisitors} users
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No stock page views yet. Data will appear as visitors view stock detail pages.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Pages */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4 text-emerald-500" />
              Top Pages
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pageLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : pageData?.topPages && pageData.topPages.length > 0 ? (
              <div className="space-y-1">
                {pageData.topPages.map((p, i) => {
                  const maxViews = pageData.topPages[0]?.totalViews ?? 1;
                  const pageName = p.pagePath === '/' ? 'Home' :
                    p.symbol ? `Stock: ${p.symbol}` :
                    p.pagePath.replace(/^\//, '').replace(/-/g, ' ');
                  return (
                    <div key={i} className="flex items-center gap-2 py-1.5 hover:bg-muted/30 rounded px-2 -mx-2">
                      <span className="text-sm flex-1 truncate capitalize">{pageName}</span>
                      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500/60 rounded-full transition-all"
                          style={{ width: `${(p.totalViews / maxViews) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-14 text-right font-mono">
                        {formatNum(p.totalViews)} views
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No page view data yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Visitors */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Recent Visitors
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : recentVisitors && recentVisitors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground text-xs">
                    <th className="text-left py-2 font-medium">Location</th>
                    <th className="text-left py-2 font-medium">Date</th>
                    <th className="text-right py-2 font-medium">Pages</th>
                    <th className="text-right py-2 font-medium">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVisitors.map((v, i) => (
                    <tr key={i} className="border-b border-border/20 hover:bg-muted/20">
                      <td className="py-2">
                        <span className="mr-1.5">{countryFlag(v.countryCode || 'XX')}</span>
                        <span>{v.city || 'Unknown'}, {v.country || 'Unknown'}</span>
                      </td>
                      <td className="py-2 text-muted-foreground">{v.visitDate}</td>
                      <td className="py-2 text-right font-mono">{v.pageViews}</td>
                      <td className="py-2 text-right text-muted-foreground text-xs">
                        {v.lastVisit ? new Date(v.lastVisit).toLocaleTimeString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No visitor data yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
