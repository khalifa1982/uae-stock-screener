import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Newspaper, ExternalLink, Clock, Search, RefreshCw, TrendingUp } from "lucide-react";

function timeAgo(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MarketNews() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "DFM" | "ADX">("all");

  const { data, isLoading, refetch, isFetching } = trpc.stocks.marketNews.useQuery(
    { count: 100, exchange: filter, search: search || undefined },
    {
      staleTime: 2 * 60 * 1000, // 2 minutes stale time
      gcTime: 30 * 60 * 1000,
      refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
      refetchOnWindowFocus: true,
    }
  );

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items;
  }, [data]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, typeof filteredItems>();
    for (const item of filteredItems) {
      const dateKey = new Date(item.published * 1000).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(item);
    }
    return Array.from(groups.entries());
  }, [filteredItems]);

  return (
    <div className="space-y-2 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        <div>
          <h1 className="text-xs font-bold tracking-tight flex items-center gap-2.5">
            <Newspaper className="h-4 w-4 text-primary" />
            Market News
          </h1>
          <p className="text-[11px] text-muted-foreground mt-1">
            Latest news and headlines for UAE stocks
            <span className="inline-flex items-center gap-1 ml-2">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-600 dark:text-green-400">Auto-updating</span>
            </span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-1">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search news by title, source, or symbol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList className="bg-background/50">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="DFM" className="text-xs">DFM</TabsTrigger>
            <TabsTrigger value="ADX" className="text-xs">ADX</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{filteredItems.length} articles</span>
        {data?.lastUpdated && (
          <span>Updated {timeAgo(new Date(data.lastUpdated).getTime() / 1000)}</span>
        )}
      </div>

      {/* News List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-16 text-center">
            <Newspaper className="h-10 w-10 text-muted-foreground/60 mx-auto mb-1" />
            <p className="text-muted-foreground">No news articles found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Try adjusting your search or filter criteria
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {groupedByDate.map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <div className="flex items-center gap-1 mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {dateLabel}
                </h3>
                <div className="flex-1 h-px bg-border/20" />
                <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
              </div>

              <Card className="border-border/30 bg-card/30 overflow-hidden">
                <CardContent className="p-0">
                  <div className="divide-y divide-border/20">
                    {items.map((item) => (
                      <a
                        key={item.id}
                        href={item.storyPath?.startsWith('http') ? item.storyPath : item.storyPath ? `https://www.tradingview.com${item.storyPath}` : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-1.5 p-2 hover:bg-muted/10 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[11px] font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2">
                            {item.title}
                          </h3>
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {timeAgo(item.published)}
                              </span>
                            </div>
                            {item.provider && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {item.provider}
                              </Badge>
                            )}
                            {item.source && item.source !== item.provider && (
                              <span className="text-[10px] text-muted-foreground">{item.source}</span>
                            )}
                          </div>
                          {item.relatedSymbols && item.relatedSymbols.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              {item.relatedSymbols.slice(0, 8).map((rs) => (
                                <Badge key={rs.symbol} variant="outline" className="text-[9px] px-1.5 py-0 font-mono">
                                  {rs.symbol}
                                </Badge>
                              ))}
                              {item.relatedSymbols.length > 8 && (
                                <span className="text-[9px] text-muted-foreground">
                                  +{item.relatedSymbols.length - 8} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
