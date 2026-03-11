import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, EyeOff, RefreshCw, Star, TrendingDown, TrendingUp, X } from "lucide-react";
import { useMemo } from "react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(3);
}

export default function Watchlist() {
  const { isAuthenticated } = useAuth();

  const { data: watchlistItems, refetch: refetchWatchlist } = trpc.watchlist.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: allStocks, refetch: refetchStocks } = trpc.stocks.fetchAll.useQuery(
    { exchange: "ALL" },
    { 
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchInterval: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    }
  );

  const removeMutation = trpc.watchlist.remove.useMutation({
    onSuccess: () => {
      refetchWatchlist();
      toast.success("Removed from watchlist");
    },
    onError: () => toast.error("Failed to remove"),
  });

  const watchlistStocks = useMemo(() => {
    if (!watchlistItems || !allStocks) return [];
    return watchlistItems.map((item: any) => {
      const stockData = allStocks.find((s: any) => s.symbol === item.symbol);
      return { ...item, ...(stockData || {}) };
    });
  }, [watchlistItems, allStocks]);

  const totalValue = useMemo(() => {
    return watchlistStocks.reduce((sum: number, s: any) => sum + (s.marketCap || 0), 0);
  }, [watchlistStocks]);

  const avgChange = useMemo(() => {
    const withChange = watchlistStocks.filter((s: any) => s.changePercent != null);
    if (withChange.length === 0) return 0;
    return withChange.reduce((sum: number, s: any) => sum + (s.changePercent || 0), 0) / withChange.length;
  }, [watchlistStocks]);

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Watchlist</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your favorite UAE stocks</p>
        </div>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <EyeOff className="h-12 w-12 text-muted-foreground/60 mb-4" />
            <p className="text-muted-foreground mb-4">Sign in to create and manage your watchlist</p>
            <Button onClick={() => { window.location.href = getLoginUrl(); }}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Watchlist</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {watchlistStocks.length} stocks tracked
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { refetchWatchlist(); refetchStocks(); }}
          className="gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Stocks Tracked</p>
            <p className="text-2xl font-bold mt-1">{watchlistStocks.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Market Cap</p>
            <p className="text-2xl font-bold mt-1">{formatNumber(totalValue)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Change</p>
            <p className={`text-2xl font-bold mt-1 ${avgChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {avgChange >= 0 ? "+" : ""}{avgChange.toFixed(3)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Watchlist Table */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-400" />
            Your Watchlist
          </CardTitle>
        </CardHeader>
        <CardContent>
          {watchlistStocks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Eye className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Your watchlist is empty</p>
              <p className="text-xs mt-1">Add stocks from the Dashboard or Stock Detail pages</p>
              <Link href="/">
                <Button variant="outline" size="sm" className="mt-4">
                  Browse Stocks
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Stock</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Exchange</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Price</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Change</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Volume</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Market Cap</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">P/E</th>
                    <th className="text-center py-2 px-3 text-xs text-muted-foreground font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {watchlistStocks.map((stock: any) => (
                    <tr key={stock.symbol} className="border-b border-border/30 hover:bg-accent/5 transition-colors">
                      <td className="py-3 px-3">
                        <Link href={`/stock/${stock.symbol}`} className="hover:text-primary transition-colors">
                          <p className="font-medium">{stock.name || stock.symbol}</p>
                          <p className="text-xs text-muted-foreground">{stock.symbol}</p>
                        </Link>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="text-[10px]">{stock.exchange}</Badge>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {stock.price ? stock.price.toFixed(3) : "—"}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {stock.changePercent != null ? (
                          <div className="flex items-center gap-1 justify-end">
                            {stock.changePercent >= 0 ? (
                              <TrendingUp className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-red-400" />
                            )}
                            <span className={`font-mono text-xs ${stock.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(3)}%
                            </span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs">
                        {formatNumber(stock.volume)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs">
                        {formatNumber(stock.marketCap)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs">
                        {stock.pe ? stock.pe.toFixed(1) : "—"}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                          onClick={() => removeMutation.mutate({ symbol: stock.symbol })}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
