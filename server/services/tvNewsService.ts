/**
 * TradingView News Headlines Service
 * Fetches news for UAE stocks from TradingView's news API.
 */

const NEWS_API_URL = 'https://news-headlines.tradingview.com/v2/headlines';

export interface TVNewsItem {
  id: string;
  title: string;
  provider: string;
  source: string;
  sourceLogoId: string;
  published: number; // Unix timestamp
  urgency: number;
  storyPath: string;
  relatedSymbols: Array<{
    symbol: string;
    logoid: string;
  }>;
}

export interface TVNewsResponse {
  items: TVNewsItem[];
  fetchedAt: string;
}

// In-memory cache per symbol
const newsCache = new Map<string, { data: TVNewsResponse; timestamp: number }>();
const NEWS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch news headlines for a specific stock symbol
 */
export async function fetchTVNews(
  symbol: string,
  exchange: string,
  count: number = 20
): Promise<TVNewsResponse> {
  const fullSymbol = `${exchange}:${symbol}`;
  const cacheKey = `${fullSymbol}-${count}`;

  // Check cache
  const cached = newsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < NEWS_CACHE_TTL) {
    return cached.data;
  }

  try {
    const params = new URLSearchParams({
      client: 'web',
      lang: 'en',
      category: 'base',
      symbol: fullSymbol,
      count: String(count),
    });

    const resp = await fetch(`${NEWS_API_URL}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      throw new Error(`News API returned ${resp.status}`);
    }

    const data = await resp.json() as any;
    const items: TVNewsItem[] = (data.items || []).map((item: any) => ({
      id: item.id || '',
      title: item.title || '',
      provider: item.provider || '',
      source: item.source || '',
      sourceLogoId: item.sourceLogoId || '',
      published: item.published || 0,
      urgency: item.urgency || 0,
      storyPath: item.storyPath || '',
      relatedSymbols: item.relatedSymbols || [],
    }));

    const result: TVNewsResponse = {
      items,
      fetchedAt: new Date().toISOString(),
    };

    // Cache the result
    newsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (e: any) {
    console.warn(`[TVNews] Failed to fetch news for ${fullSymbol}:`, e.message);
    // Return cached data if available, even if stale
    if (cached) return cached.data;
    return { items: [], fetchedAt: new Date().toISOString() };
  }
}

/**
 * Fetch general UAE market news
 */
export async function fetchUAEMarketNews(count: number = 30): Promise<TVNewsResponse> {
  const cacheKey = `uae-market-${count}`;
  const cached = newsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < NEWS_CACHE_TTL) {
    return cached.data;
  }

  try {
    // Fetch news for major UAE stocks and combine
    const majorSymbols = ['DFM:EMAAR', 'ADX:ADNOCDIST', 'ADX:FAB', 'ADX:IHC', 'ADX:ALDAR'];
    const allItems: TVNewsItem[] = [];
    const seenIds = new Set<string>();

    for (const symbol of majorSymbols) {
      try {
        const params = new URLSearchParams({
          client: 'web',
          lang: 'en',
          category: 'base',
          symbol,
          count: '10',
        });

        const resp = await fetch(`${NEWS_API_URL}?${params}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(8000),
        });

        if (resp.ok) {
          const data = await resp.json() as any;
          for (const item of (data.items || [])) {
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id);
              allItems.push({
                id: item.id || '',
                title: item.title || '',
                provider: item.provider || '',
                source: item.source || '',
                sourceLogoId: item.sourceLogoId || '',
                published: item.published || 0,
                urgency: item.urgency || 0,
                storyPath: item.storyPath || '',
                relatedSymbols: item.relatedSymbols || [],
              });
            }
          }
        }
      } catch { /* skip individual failures */ }
    }

    // Sort by published date (newest first)
    allItems.sort((a, b) => b.published - a.published);

    const result: TVNewsResponse = {
      items: allItems.slice(0, count),
      fetchedAt: new Date().toISOString(),
    };

    newsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (e: any) {
    if (cached) return cached.data;
    return { items: [], fetchedAt: new Date().toISOString() };
  }
}
