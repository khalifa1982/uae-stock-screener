import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, ExternalLink, Clock } from "lucide-react";

function timeAgo(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function StockNewsTab({ symbol }: { symbol: string }) {
  const { data, isLoading } = trpc.stocks.news.useQuery(
    { symbol, count: 30 },
    { staleTime: 600_000, gcTime: 1800_000, refetchOnWindowFocus: false }
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center">
          <Newspaper className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No news available for this stock.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-primary" /> Latest Headlines
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {data.items.length} articles
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/30">
            {data.items.map((item) => (
              <a
                key={item.id}
                href={`https://www.tradingview.com${item.storyPath}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-4 p-4 hover:bg-muted/10 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-2">
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
                  {item.relatedSymbols && item.relatedSymbols.length > 1 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {item.relatedSymbols.slice(0, 5).map((rs) => (
                        <Badge key={rs.symbol} variant="outline" className="text-[9px] px-1 py-0 font-mono">
                          {rs.symbol}
                        </Badge>
                      ))}
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
  );
}
