/**
 * Investing.com Scraper Service
 * Extracts: Dividend History, Dividend Yield, Analyst Consensus, Index Data
 * Uses Scrapfly.io for web scraping with JS rendering
 */
import { scrapflyFetch } from "./scrapflyService";
import { recordCacheHit, recordCacheMiss } from "./cacheMetricsService";

// ─── URL Slug Mapping ───────────────────────────────────────────────────────
// Investing.com uses truncated company name slugs like "emaar-properti"

const INV_SLUG_MAP: Record<string, string> = {
  // DFM Stocks
  "EMAAR": "emaar-properti",
  "EMAARDEV": "emaar-develop",
  "DIB": "dubai-islamic-bank",
  "DFM": "dfm",
  "DEWA": "dubai-electricity-and-water-authority",
  "DAMAC": "damac-properties",
  "PARKIN": "parkin-company",
  "SALIK": "salik-company",
  "TECOM": "tecom-group",
  "ENBD": "emirates-nbd",
  "GFH": "gfh-financial-group",
  "DIC": "dubai-investments",
  "SHUAA": "shuaa-capital",
  "GGICO": "gulf-general-inv",
  "AMLAK": "amlak-finance",
  "ARMX": "aramex",
  "TABREED": "national-central-cooling",
  "DU": "du-emirates-integrated-telecom",
  "DEYAAR": "deyaar-development",
  "AJMANBANK": "ajman-bank",
  "CBD": "commercial-bank-of-dubai",
  "MASHREQ": "mashreqbank",
  "DNIR": "dar-al-takaful",
  "DEPA": "depa-limited",
  "SALAM": "salam-bounian-dev",
  "UAB": "united-arab-bank",
  "GULFNAV": "gulf-navigation-holding",
  "NMDC": "national-marine-dredging",
  "EMSTEEL": "emirates-steel-arkan",
  "IH": "international-holdings",
  "ADCB": "abu-dhabi-commercial-bank",
  // ADX Stocks
  "FAB": "first-abu-dhabi-bank",
  "ADIB": "abu-dhabi-islamic-bank",
  "EAND": "etisalat-group",
  "TAQA": "abu-dhabi-national-energy",
  "ALDAR": "aldar-properties",
  "IHC": "international-holding-co",
  "ADNOCDIST": "adnoc-distribution",
  "ADNOCGAS": "adnoc-gas",
  "ADNOCDRILL": "adnoc-drilling",
  "ADPORTS": "ad-ports-group",
  "FERTIGLB": "fertiglobe",
  "BOROUGE": "borouge",
  "PUREHEALTH": "pure-health-holding",
  "ALPHADHABI": "alpha-dhabi-holding",
  "PRESIGHT": "presight-ai-holding",
  "AGTHIA": "agthia-group",
  "RAKCEC": "rak-ceramics",
  "ADNH": "abu-dhabi-national-hotels",
  "ADNIC": "abu-dhabi-national-insurance",
  "BURJEEL": "burjeel-holdings",
  "ADAVIATION": "abu-dhabi-aviation",
  "ORAS": "orascom-construction",
  "BOS": "bank-of-sharjah",
  "RAKPROP": "rak-properties",
  "DRIVE": "emirates-driving-company",
  "ESG": "esg-emirates-stallions",
  "E7": "e7-group",
};

// ─── Data Interfaces ────────────────────────────────────────────────────────

export interface INVDividendRecord {
  exDate: string | null;
  dividend: number | null;
  type: string | null; // "Cash", "Stock", "Special"
  paymentDate: string | null;
  yield: number | null;
}

export interface INVDividendData {
  currentYield: number | null;
  annualDividend: number | null;
  payoutRatio: number | null;
  exDividendDate: string | null;
  dividendHistory: INVDividendRecord[];
  dividendGrowth5Y: number | null;
}

export interface INVConsensusData {
  recommendation: string | null;
  analystCount: number | null;
  targetPrice: number | null;
  highTarget: number | null;
  lowTarget: number | null;
}

export interface INVFullData {
  dividends: INVDividendData | null;
  consensus: INVConsensusData | null;
  fetchedAt: number;
  source: string;
}

// ─── Cache ──────────────────────────────────────────────────────────────────

const dataCache = new Map<string, { data: INVFullData; expiry: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ─── Parsing Functions ──────────────────────────────────────────────────────

function parseDividends(html: string): INVDividendData | null {
  try {
    const result: INVDividendData = {
      currentYield: null,
      annualDividend: null,
      payoutRatio: null,
      exDividendDate: null,
      dividendHistory: [],
      dividendGrowth5Y: null,
    };

    // Extract dividend yield from the page
    // Look for the yield value near "Dividend Yield" text
    const yieldPattern = /(?:Dividend\s*Yield|dividend_yield)[^>]*>[\s\S]{0,100}?(\d+\.?\d*)%?/i;
    const yieldMatch = html.match(yieldPattern);
    if (yieldMatch) {
      result.currentYield = parseFloat(yieldMatch[1]);
    }

    // Extract annual dividend amount
    const annualPattern = /(?:Annual\s*Dividend|annualDividend)[^>]*>[\s\S]{0,100}?(\d+\.?\d*)/i;
    const annualMatch = html.match(annualPattern);
    if (annualMatch) {
      result.annualDividend = parseFloat(annualMatch[1]);
    }

    // Extract payout ratio
    const payoutPattern = /(?:Payout\s*Ratio|payoutRatio)[^>]*>[\s\S]{0,100}?(\d+\.?\d*)%?/i;
    const payoutMatch = html.match(payoutPattern);
    if (payoutMatch) {
      result.payoutRatio = parseFloat(payoutMatch[1]);
    }

    // Extract ex-dividend date
    const exDatePattern = /(?:Ex-Dividend\s*Date|exDividendDate)[^>]*>[\s\S]{0,100}?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+ \d{1,2},? \d{4})/i;
    const exDateMatch = html.match(exDatePattern);
    if (exDateMatch) {
      result.exDividendDate = exDateMatch[1];
    }

    // Extract dividend history from table
    // Table headers: Ex-Dividend Date | Dividend | Type | Payment Date | Yield
    const tablePattern = /<table[\s\S]*?Ex-Dividend[\s\S]*?<\/table>/i;
    const tableMatch = html.match(tablePattern);
    if (tableMatch) {
      const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch;
      while ((rowMatch = rowPattern.exec(tableMatch[0])) !== null) {
        const cells = rowMatch[1].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
        if (cells && cells.length >= 4) {
          const cellTexts = cells.map(c =>
            c.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
          );

          const record: INVDividendRecord = {
            exDate: cellTexts[0] || null,
            dividend: cellTexts[1] ? parseFloat(cellTexts[1]) : null,
            type: cellTexts[2] || null,
            paymentDate: cellTexts[3] || null,
            yield: cellTexts[4] ? parseFloat(cellTexts[4].replace('%', '')) : null,
          };

          if (record.exDate && record.dividend) {
            result.dividendHistory.push(record);
          }
        }
      }
    }

    // If we found any data, return it
    if (result.currentYield || result.annualDividend || result.dividendHistory.length > 0) {
      return result;
    }

    return null;
  } catch (e) {
    console.error("[Investing.com] Failed to parse dividends:", e);
    return null;
  }
}

function parseConsensus(html: string): INVConsensusData | null {
  try {
    let recommendation: string | null = null;
    let analystCount: number | null = null;
    let targetPrice: number | null = null;
    let highTarget: number | null = null;
    let lowTarget: number | null = null;

    // Extract recommendation
    const recPattern = /(?:consensus|recommendation)[^>]*>[\s\S]{0,200}?(Strong Buy|Buy|Outperform|Hold|Neutral|Underperform|Sell|Strong Sell)/i;
    const recMatch = html.match(recPattern);
    if (recMatch) {
      recommendation = recMatch[1];
    }

    // Extract analyst count
    const countPattern = /(?:Based on|from)\s*(\d+)\s*(?:analyst|wall street)/i;
    const countMatch = html.match(countPattern);
    if (countMatch) {
      analystCount = parseInt(countMatch[1]);
    }

    // Extract target price
    const tpPattern = /(?:average|mean|target)\s*(?:price|target)[^>]*>[\s\S]{0,100}?(\d+\.?\d*)/i;
    const tpMatch = html.match(tpPattern);
    if (tpMatch) {
      targetPrice = parseFloat(tpMatch[1]);
    }

    // Extract high/low targets
    const highPattern = /(?:high|highest)\s*(?:estimate|target|price)[^>]*>[\s\S]{0,100}?(\d+\.?\d*)/i;
    const highMatch = html.match(highPattern);
    if (highMatch) {
      highTarget = parseFloat(highMatch[1]);
    }

    const lowPattern = /(?:low|lowest)\s*(?:estimate|target|price)[^>]*>[\s\S]{0,100}?(\d+\.?\d*)/i;
    const lowMatch = html.match(lowPattern);
    if (lowMatch) {
      lowTarget = parseFloat(lowMatch[1]);
    }

    if (!recommendation && !targetPrice) {
      return null;
    }

    return { recommendation, analystCount, targetPrice, highTarget, lowTarget };
  } catch (e) {
    console.error("[Investing.com] Failed to parse consensus:", e);
    return null;
  }
}

// ─── Main Fetch Functions ───────────────────────────────────────────────────

export async function fetchINVData(
  symbol: string,
  _companyName: string,
  _exchange: string
): Promise<INVFullData> {
  const cacheKey = `${_exchange}:${symbol}`;

  // Check cache
  const cached = dataCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    recordCacheHit("investingcom");
    return cached.data;
  }
  recordCacheMiss("investingcom");

  const result: INVFullData = {
    dividends: null,
    consensus: null,
    fetchedAt: Date.now(),
    source: "investing.com",
  };

  const slug = INV_SLUG_MAP[symbol];
  if (!slug) {
    console.warn(`[Investing.com] No slug found for ${symbol}`);
    dataCache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });
    return result;
  }

  const baseUrl = `https://www.investing.com/equities/${slug}`;

  // Fetch dividends page (requires JS rendering)
  try {
    const divResult = await scrapflyFetch(`${baseUrl}-dividends`, {
      renderJs: true,
      asp: true,
      country: "ae",
    });
    result.dividends = parseDividends(divResult.content);
  } catch (e) {
    console.error(`[Investing.com] Failed to fetch dividends for ${symbol}:`, e);
  }

  // Fetch consensus estimates page
  try {
    const consResult = await scrapflyFetch(`${baseUrl}-consensus-estimates`, {
      renderJs: true,
      asp: true,
      country: "ae",
    });
    result.consensus = parseConsensus(consResult.content);
  } catch (e) {
    console.error(`[Investing.com] Failed to fetch consensus for ${symbol}:`, e);
  }

  // Cache the result
  dataCache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });
  return result;
}
