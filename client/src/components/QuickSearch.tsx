/**
 * QuickSearch - Global instant search with autosuggest
 * Triggers after first letter typed, shows stock symbol short names
 * Keyboard navigation (arrow keys + enter), Cmd/Ctrl+K shortcut
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { ALL_STOCKS } from "../../../shared/stockData";
import { trpc } from "@/lib/trpc";
import {
  Search, ArrowRight, LayoutDashboard, Filter, Bell, Eye,
  Grid3X3, CalendarDays, Newspaper, FileText, X, Zap, Hash, Globe,
} from "lucide-react";

interface SearchResult {
  type: "stock" | "page" | "sector";
  symbol?: string;
  name: string;
  exchange?: string;
  sector?: string;
  path: string;
  price?: number;
  change?: number;
}

const PAGES = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard, keywords: ["home", "dashboard", "main"] },
  { name: "Screener", path: "/screener", icon: Filter, keywords: ["screener", "filter", "scan", "finance"] },
  { name: "Alerts", path: "/alerts", icon: Bell, keywords: ["alerts", "notifications", "price"] },
  { name: "Watchlist", path: "/watchlist", icon: Eye, keywords: ["watchlist", "favorites", "watch"] },
  { name: "Heatmap", path: "/heatmap", icon: Grid3X3, keywords: ["heatmap", "heat", "map", "visual"] },
  { name: "Calendar", path: "/calendar", icon: CalendarDays, keywords: ["calendar", "events", "earnings"] },
  { name: "News", path: "/news", icon: Newspaper, keywords: ["news", "articles", "market"] },
  { name: "Market Summary", path: "/summary", icon: FileText, keywords: ["summary", "market", "overview", "finance"] },
];

export function QuickSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const { data: snapshots } = trpc.stocks.fetchAll.useQuery(undefined, {
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const priceMap = useMemo(() => {
    const map = new Map<string, { price: number; change: number }>();
    if (snapshots) {
      for (const s of snapshots as any[]) {
        map.set(s.symbol, { price: s.price || 0, change: s.changePercent || 0 });
      }
    }
    return map;
  }, [snapshots]);

  const results = useMemo((): SearchResult[] => {
    if (!query || query.length < 1) return [];
    const q = query.toLowerCase().trim();
    const items: SearchResult[] = [];

    // Search stocks
    const stockMatches = ALL_STOCKS.filter(s =>
      s.symbol.toLowerCase().startsWith(q) ||
      s.symbol.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.sector.toLowerCase().includes(q)
    ).sort((a, b) => {
      const aStarts = a.symbol.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.symbol.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      const aNameStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bNameStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return aNameStarts - bNameStarts;
    });

    for (const s of stockMatches.slice(0, 8)) {
      const priceInfo = priceMap.get(s.symbol);
      items.push({
        type: "stock",
        symbol: s.symbol,
        name: s.name,
        exchange: s.exchange,
        sector: s.sector,
        path: `/stock/${s.symbol}`,
        price: priceInfo?.price,
        change: priceInfo?.change,
      });
    }

    // Search pages
    const pageMatches = PAGES.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.keywords.some(k => k.includes(q))
    );
    for (const p of pageMatches.slice(0, 3)) {
      items.push({ type: "page", name: p.name, path: p.path });
    }

    // Search by sector
    const sectorSet = new Set<string>();
    ALL_STOCKS.forEach(s => {
      if (s.sector.toLowerCase().includes(q) && !sectorSet.has(s.sector)) {
        sectorSet.add(s.sector);
      }
    });
    for (const sector of Array.from(sectorSet).slice(0, 2)) {
      items.push({
        type: "sector",
        name: sector,
        path: `/screener?sector=${encodeURIComponent(sector)}`,
      });
    }

    return items;
  }, [query, priceMap]);

  // Keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  useEffect(() => { setSelectedIndex(0); }, [results]);

  const handleSelect = useCallback((result: SearchResult) => {
    setLocation(result.path);
    setIsOpen(false);
    setQuery("");
  }, [setLocation]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  }, [results, selectedIndex, handleSelect]);

  useEffect(() => {
    if (resultsRef.current) {
      const selected = resultsRef.current.children[selectedIndex] as HTMLElement;
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <>
      {/* Search Trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2 py-1 bg-secondary/30 border border-border/30 hover:border-primary/30 hover:bg-secondary/50 transition-all text-muted-foreground group min-w-0"
      >
        <Search className="h-3 w-3 shrink-0 group-hover:text-primary transition-colors" />
        <span className="text-[10px] hidden lg:inline truncate">Search stocks...</span>
        <kbd className="hidden xl:inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-secondary/50 border border-border/30 text-[8px] font-mono text-muted-foreground/60 ml-1">
          <span className="text-[9px]">&#8984;</span>K
        </kbd>
      </button>

      {/* Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
          <div
            className="absolute inset-0 bg-background/80 "
            onClick={() => { setIsOpen(false); setQuery(""); }}
          />
          <div
            className="relative w-full max-w-lg mx-4 bg-card border border-border/50  shadow-2xl overflow-hidden"
            style={{ boxShadow: "0 0 40px oklch(0.72 0.18 195 / 10%)" }}
          >
            {/* Input */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
              <Search className="h-4 w-4 text-primary shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search stocks, pages, sectors..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              {query && (
                <button
                  onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                  className="p-0.5 rounded hover:bg-secondary/50 text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <kbd className="px-1.5 py-0.5 rounded bg-secondary/50 border border-border/30 text-[9px] font-mono text-muted-foreground/60">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto py-1">
              {query.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <Zap className="h-5 w-5 text-primary/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Start typing to search</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Stocks, pages, sectors</p>
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-muted-foreground">No results for &ldquo;{query}&rdquo;</p>
                </div>
              ) : (
                <>
                  {/* Stocks */}
                  {results.filter(r => r.type === "stock").length > 0 && (
                    <div className="px-2 py-1">
                      <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2 mb-0.5">Stocks</p>
                      {results.filter(r => r.type === "stock").map((result) => {
                        const globalIdx = results.indexOf(result);
                        const isSelected = globalIdx === selectedIndex;
                        return (
                          <button
                            key={result.symbol}
                            onClick={() => handleSelect(result)}
                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5  text-left transition-colors ${
                              isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary/30 border border-transparent"
                            }`}
                          >
                            <div className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                              result.exchange === "ADX" ? "bg-primary/15 text-primary" : "bg-chart-2/15 text-chart-2"
                            }`}>
                              {result.symbol}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium truncate text-foreground">{result.name}</p>
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-muted-foreground">{result.exchange}</span>
                                {result.sector && (
                                  <>
                                    <span className="text-[8px] text-muted-foreground/40">&middot;</span>
                                    <span className="text-[9px] text-muted-foreground">{result.sector}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {result.price != null && result.price > 0 && (
                              <div className="text-right shrink-0">
                                <p className="text-[11px] font-mono font-semibold">{result.price.toFixed(2)}</p>
                                {result.change != null && (
                                  <p className={`text-[9px] font-mono ${
                                    result.change > 0 ? "text-gain" : result.change < 0 ? "text-loss" : "text-muted-foreground"
                                  }`}>
                                    {result.change > 0 ? "+" : ""}{result.change.toFixed(2)}%
                                  </p>
                                )}
                              </div>
                            )}
                            <ArrowRight className={`h-3 w-3 shrink-0 transition-opacity ${isSelected ? "opacity-100 text-primary" : "opacity-0"}`} />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Pages */}
                  {results.filter(r => r.type === "page").length > 0 && (
                    <div className="px-2 py-1">
                      <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2 mb-0.5">Pages</p>
                      {results.filter(r => r.type === "page").map((result) => {
                        const globalIdx = results.indexOf(result);
                        const isSelected = globalIdx === selectedIndex;
                        const page = PAGES.find(p => p.path === result.path);
                        const Icon = page?.icon || Globe;
                        return (
                          <button
                            key={result.path}
                            onClick={() => handleSelect(result)}
                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5  text-left transition-colors ${
                              isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary/30 border border-transparent"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-[11px] font-medium text-foreground">{result.name}</span>
                            <ArrowRight className={`h-3 w-3 shrink-0 ml-auto transition-opacity ${isSelected ? "opacity-100 text-primary" : "opacity-0"}`} />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Sectors */}
                  {results.filter(r => r.type === "sector").length > 0 && (
                    <div className="px-2 py-1">
                      <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2 mb-0.5">Sectors</p>
                      {results.filter(r => r.type === "sector").map((result) => {
                        const globalIdx = results.indexOf(result);
                        const isSelected = globalIdx === selectedIndex;
                        return (
                          <button
                            key={result.name}
                            onClick={() => handleSelect(result)}
                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5  text-left transition-colors ${
                              isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary/30 border border-transparent"
                            }`}
                          >
                            <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-[11px] font-medium text-foreground">{result.name}</span>
                            <span className="text-[9px] text-muted-foreground ml-auto">Sector</span>
                            <ArrowRight className={`h-3 w-3 shrink-0 transition-opacity ${isSelected ? "opacity-100 text-primary" : "opacity-0"}`} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-border/30 bg-secondary/10">
              <div className="flex items-center gap-2 text-[9px] text-muted-foreground/60">
                <span className="flex items-center gap-0.5">
                  <kbd className="px-1 py-0.5 rounded bg-secondary/50 border border-border/30 text-[8px] font-mono">&uarr;&darr;</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-0.5">
                  <kbd className="px-1 py-0.5 rounded bg-secondary/50 border border-border/30 text-[8px] font-mono">&crarr;</kbd>
                  Select
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground/40">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
