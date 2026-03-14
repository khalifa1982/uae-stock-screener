/**
 * MarketScreener.com Scraper Service
 * Extracts: Shareholders/Ownership, Analyst Consensus, ESG MSCI Rating
 * Uses Scrapfly.io for web scraping
 */
import { scrapflyFetch } from "./scrapflyService";

// ─── URL Slug Mapping ───────────────────────────────────────────────────────
// MarketScreener uses company-specific URL slugs like EMAAR-PROPERTIES-9059234
// We maintain a lookup table for known UAE stocks and fall back to search for unknown ones

const MS_SLUG_MAP: Record<string, string> = {
  // DFM Stocks
  "EMAAR": "EMAAR-PROPERTIES-9059234",
  "EMAARDEV": "EMAAR-DEVELOPMENT-PJSC-53041",
  "DIB": "DUBAI-ISLAMIC-BANK-6498747",
  "DFM": "DUBAI-FINANCIAL-MARKET-6498750",
  "DEWA": "DUBAI-ELECTRICITY-AND-WATER-AUTHORITY-PJSC-119543",
  "DAMAC": "DAMAC-PROPERTIES-DUBAI-CO-PJSC-124285",
  "PARKIN": "PARKIN-COMPANY-PJSC-127741",
  "SALIK": "SALIK-COMPANY-PJSC-120557",
  "TECOM": "TECOM-GROUP-PJSC-120558",
  "ENBD": "EMIRATES-NBD-BANK-PJSC-6498748",
  "GFH": "GFH-FINANCIAL-GROUP-B-S-C-6498751",
  "DIC": "DUBAI-INVESTMENTS-PJSC-6498749",
  "SHUAA": "SHUAA-CAPITAL-PSC-6498753",
  "GGICO": "GULF-GENERAL-INVESTMENTS-COMPANY-PSC-6498752",
  "AMLAK": "AMLAK-FINANCE-PJSC-6498754",
  "ARMX": "ARAMEX-PJSC-6498755",
  "DNIR": "DAR-AL-TAKAFUL-PJSC-6498756",
  "TABREED": "NATIONAL-CENTRAL-COOLING-COMPANY-PJSC-6498757",
  "DU": "EMIRATES-INTEGRATED-TELECOMMUNICATIONS-COMPANY-PJSC-6498758",
  "DEYAAR": "DEYAAR-DEVELOPMENT-PJSC-6498759",
  "AJMANBANK": "AJMAN-BANK-PJSC-6498760",
  "CBD": "COMMERCIAL-BANK-OF-DUBAI-PSC-6498761",
  "MASHREQ": "MASHREQBANK-PSC-6498762",
  // ADX Stocks
  "FAB": "FIRST-ABU-DHABI-BANK-PJSC-6498763",
  "ADCB": "ABU-DHABI-COMMERCIAL-BANK-PJSC-6498764",
  "ADIB": "ABU-DHABI-ISLAMIC-BANK-PJSC-6498765",
  "EAND": "EMIRATES-TELECOMMUNICATIONS-GROUP-COMPANY-PJSC-6498766",
  "TAQA": "ABU-DHABI-NATIONAL-ENERGY-COMPANY-PJSC-6498767",
  "ALDAR": "ALDAR-PROPERTIES-PJSC-6498768",
  "IHC": "INTERNATIONAL-HOLDING-COMPANY-PJSC-6498769",
  "ADNOCDIST": "ADNOC-DISTRIBUTION-PJSC-53042",
  "ADNOCGAS": "ADNOC-GAS-PLC-124286",
  "ADNOCDRILL": "ADNOC-DRILLING-COMPANY-PJSC-110543",
  "ADPORTS": "AD-PORTS-GROUP-PJSC-110544",
  "FERTIGLB": "FERTIGLOBE-PLC-110545",
  "BOROUGE": "BOROUGE-PLC-119544",
  "PUREHEALTH": "PURE-HEALTH-HOLDING-PJSC-124287",
  "ALPHADHABI": "ALPHA-DHABI-HOLDING-PJSC-110546",
  "PRESIGHT": "PRESIGHT-AI-HOLDING-PLC-127742",
  "AGTHIA": "AGTHIA-GROUP-PJSC-6498770",
  "RAKCEC": "RAK-CERAMICS-PJSC-6498771",
};

// Cache for resolved slugs (search results)
const slugCache = new Map<string, string>();

// ─── Data Interfaces ────────────────────────────────────────────────────────

export interface MSShareholder {
  name: string;
  equityPercent: number | null;
  valuationMln: number | null;
}

export interface MSOwnershipData {
  shareholders: MSShareholder[];
  ownershipBreakdown: Record<string, number>; // e.g. { "Governments": 7.46, "Institutional": 1.09 }
  geographicDistribution: Record<string, number>; // e.g. { "UAE": 29.82, "UK": 0.32 }
}

export interface MSConsensusData {
  recommendation: string | null; // "Buy", "Hold", "Sell"
  analystCount: number | null;
  targetPrice: number | null;
  targetPriceCurrency: string | null;
  upside: number | null;
  analysts: string[];
}

export interface MSESGData {
  msciRating: string | null; // "AAA", "AA", "A", "BBB", "BB", "B", "CCC"
  msciDescription: string | null;
}

export interface MSFullData {
  ownership: MSOwnershipData | null;
  consensus: MSConsensusData | null;
  esg: MSESGData | null;
  fetchedAt: number;
  source: string;
}

// ─── Cache ──────────────────────────────────────────────────────────────────

const dataCache = new Map<string, { data: MSFullData; expiry: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (data changes infrequently)

// ─── URL Resolution ─────────────────────────────────────────────────────────

async function resolveSlug(symbol: string, companyName: string): Promise<string | null> {
  // Check static map first
  if (MS_SLUG_MAP[symbol]) {
    return MS_SLUG_MAP[symbol];
  }
  
  // Check cache
  if (slugCache.has(symbol)) {
    return slugCache.get(symbol) || null;
  }
  
  // Try to search MarketScreener for the stock
  try {
    const searchUrl = `https://www.marketscreener.com/search/?q=${encodeURIComponent(companyName + " DFM ADX")}`;
    const searchResult = await scrapflyFetch(searchUrl, { renderJs: false });
    
    // Look for stock links in search results
    const linkPattern = /href="\/quote\/stock\/([^"]+)"/gi;
    let match;
    while ((match = linkPattern.exec(searchResult.content)) !== null) {
      const slug = match[1].replace(/\/$/, '');
      // Check if it matches our company
      const slugUpper = slug.toUpperCase();
      const nameWords = companyName.toUpperCase().split(/\s+/).slice(0, 2);
      if (nameWords.some(w => slugUpper.includes(w))) {
        slugCache.set(symbol, slug);
        return slug;
      }
    }
  } catch (e) {
    console.error(`[MarketScreener] Failed to resolve slug for ${symbol}:`, e);
  }
  
  return null;
}

// ─── Parsing Functions ──────────────────────────────────────────────────────

function parseOwnership(html: string): MSOwnershipData | null {
  try {
    const shareholders: MSShareholder[] = [];
    const ownershipBreakdown: Record<string, number> = {};
    const geographicDistribution: Record<string, number> = {};
    
    // Parse shareholder table rows
    // Pattern: <td>Name</td><td>Equity %</td><td>Valuation (Mln)</td>
    const tableRows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    
    for (const row of tableRows) {
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
      if (!cells || cells.length < 2) continue;
      
      const cellTexts = cells.map(c => 
        c.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
      );
      
      // Check if this looks like a shareholder row (has a name and a percentage)
      const name = cellTexts[0];
      const pctText = cellTexts.find(t => t.match(/^\d+\.?\d*%?$/));
      
      if (name && name.length > 2 && pctText) {
        const pct = parseFloat(pctText.replace('%', ''));
        if (!isNaN(pct) && pct > 0 && pct <= 100) {
          const valText = cellTexts.find(t => t.match(/^\d[\d,]*\.?\d*$/) && t !== pctText);
          const valuation = valText ? parseFloat(valText.replace(/,/g, '')) : null;
          
          shareholders.push({
            name,
            equityPercent: pct,
            valuationMln: valuation,
          });
        }
      }
    }
    
    // Parse ownership breakdown (by type)
    // Look for patterns like "Governments 7.46%", "Institutional 1.09%"
    const breakdownPattern = /(Other|Governments?|Institutional|Individual|Public|Foreign|Domestic|Unknown|Free Float)\s*[\s\S]*?(\d+\.?\d*)%/gi;
    let bMatch;
    while ((bMatch = breakdownPattern.exec(html)) !== null) {
      const category = bMatch[1].trim();
      const pct = parseFloat(bMatch[2]);
      if (!isNaN(pct)) {
        ownershipBreakdown[category] = pct;
      }
    }
    
    // Parse geographic distribution
    // Look for country names followed by percentages
    const geoPattern = /(UAE|United Arab Emirates|Saudi Arabia|Kuwait|Qatar|Bahrain|Oman|UK|United Kingdom|USA|United States|Sweden|Norway|Japan|China|India|Singapore|France|Germany|Switzerland|Luxembourg|Netherlands|Canada|Australia)\s*[\s\S]*?(\d+\.?\d*)%/gi;
    let gMatch;
    while ((gMatch = geoPattern.exec(html)) !== null) {
      const country = gMatch[1].trim();
      const pct = parseFloat(gMatch[2]);
      if (!isNaN(pct)) {
        geographicDistribution[country] = pct;
      }
    }
    
    if (shareholders.length === 0 && Object.keys(ownershipBreakdown).length === 0) {
      return null;
    }
    
    return { shareholders, ownershipBreakdown, geographicDistribution };
  } catch (e) {
    console.error("[MarketScreener] Failed to parse ownership:", e);
    return null;
  }
}

function parseConsensus(mainHtml: string, consensusHtml?: string): MSConsensusData | null {
  try {
    let recommendation: string | null = null;
    let analystCount: number | null = null;
    let targetPrice: number | null = null;
    let targetPriceCurrency: string | null = null;
    let upside: number | null = null;
    const analysts: string[] = [];
    
    const html = consensusHtml || mainHtml;
    
    // Extract consensus recommendation from main page
    // Look for patterns like "Buy", "Outperform", "Hold", "Underperform", "Sell"
    const recPattern = /(?:Consensus|Recommendation|Rating)\s*[\s\S]{0,100}?(Strong Buy|Buy|Outperform|Overweight|Hold|Neutral|Underperform|Underweight|Sell|Strong Sell)/i;
    const recMatch = mainHtml.match(recPattern);
    if (recMatch) {
      recommendation = recMatch[1];
    }
    
    // Extract analyst count
    const countPattern = /(\d+)\s*(?:analyst|Analyst)/i;
    const countMatch = mainHtml.match(countPattern);
    if (countMatch) {
      analystCount = parseInt(countMatch[1]);
    }
    
    // Extract target price
    const tpPattern = /(?:target|Target|objective)\s*(?:price|Price)?\s*[\s\S]{0,50}?(\d+\.?\d*)\s*(AED|USD|EUR)?/i;
    const tpMatch = mainHtml.match(tpPattern);
    if (tpMatch) {
      targetPrice = parseFloat(tpMatch[1]);
      targetPriceCurrency = tpMatch[2] || "AED";
    }
    
    // Extract upside percentage
    const upsidePattern = /(?:upside|potential|gap)\s*[\s\S]{0,30}?([+-]?\d+\.?\d*)%/i;
    const upsideMatch = mainHtml.match(upsidePattern);
    if (upsideMatch) {
      upside = parseFloat(upsideMatch[1]);
    }
    
    // Extract analyst names from consensus page
    if (consensusHtml) {
      const analystPattern = /(?:AlphaMena|FAB Securities|Citigroup|UBS|Kepler Cheuvreux|HSBC|Goldman Sachs|JPMorgan|Morgan Stanley|Arqaam Capital|EFG-Hermes|CI Capital|Ubhar Capital|William O'Neil|Securities & Investment)/gi;
      let aMatch;
      const seen = new Set<string>();
      while ((aMatch = analystPattern.exec(consensusHtml)) !== null) {
        const name = aMatch[0];
        if (!seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          analysts.push(name);
        }
      }
    }
    
    if (!recommendation && !targetPrice) {
      return null;
    }
    
    return { recommendation, analystCount, targetPrice, targetPriceCurrency, upside, analysts };
  } catch (e) {
    console.error("[MarketScreener] Failed to parse consensus:", e);
    return null;
  }
}

function parseESG(html: string): MSESGData | null {
  try {
    // Look for ESG MSCI rating
    // Pattern from the HTML: noteDesc section contains the rating letter
    const esgPattern = /ESG MSCI[\s\S]*?(?:CCC|CC|B|BB|BBB|A|AA|AAA|Leader|Average|Laggard)/i;
    const esgMatch = html.match(esgPattern);
    
    if (esgMatch) {
      const ratingMatch = esgMatch[0].match(/(AAA|AA|A|BBB|BB|B|CCC|CC|C|Leader|Average|Laggard)/i);
      if (ratingMatch) {
        const rating = ratingMatch[1].toUpperCase();
        
        // Determine description based on rating
        let description = "Average";
        if (["AAA", "AA"].includes(rating) || rating === "LEADER") {
          description = "Leader";
        } else if (["A", "BBB"].includes(rating) || rating === "AVERAGE") {
          description = "Average";
        } else if (["BB", "B", "CCC", "CC", "C"].includes(rating) || rating === "LAGGARD") {
          description = "Laggard";
        }
        
        return { msciRating: rating, msciDescription: description };
      }
    }
    
    return null;
  } catch (e) {
    console.error("[MarketScreener] Failed to parse ESG:", e);
    return null;
  }
}

// ─── Main Fetch Functions ───────────────────────────────────────────────────

export async function fetchMSData(
  symbol: string,
  companyName: string,
  exchange: string
): Promise<MSFullData> {
  const cacheKey = `${exchange}:${symbol}`;
  
  // Check cache
  const cached = dataCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }
  
  const result: MSFullData = {
    ownership: null,
    consensus: null,
    esg: null,
    fetchedAt: Date.now(),
    source: "marketscreener.com",
  };
  
  try {
    const slug = await resolveSlug(symbol, companyName);
    if (!slug) {
      console.warn(`[MarketScreener] No slug found for ${symbol}`);
      dataCache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });
      return result;
    }
    
    const baseUrl = `https://www.marketscreener.com/quote/stock/${slug}/`;
    
    // Fetch main page (consensus summary + ESG)
    try {
      const mainResult = await scrapflyFetch(baseUrl, { renderJs: false });
      result.consensus = parseConsensus(mainResult.content);
      result.esg = parseESG(mainResult.content);
    } catch (e) {
      console.error(`[MarketScreener] Failed to fetch main page for ${symbol}:`, e);
    }
    
    // Fetch shareholders page
    try {
      const shareholdersResult = await scrapflyFetch(`${baseUrl}company-shareholders/`, { renderJs: false });
      result.ownership = parseOwnership(shareholdersResult.content);
    } catch (e) {
      console.error(`[MarketScreener] Failed to fetch shareholders for ${symbol}:`, e);
    }
    
    // Fetch consensus page (for detailed analyst data)
    try {
      const consensusResult = await scrapflyFetch(`${baseUrl}consensus/`, { renderJs: false });
      if (result.consensus) {
        const detailedConsensus = parseConsensus("", consensusResult.content);
        if (detailedConsensus?.analysts?.length) {
          result.consensus.analysts = detailedConsensus.analysts;
        }
      }
    } catch (e) {
      console.error(`[MarketScreener] Failed to fetch consensus for ${symbol}:`, e);
    }
    
  } catch (e) {
    console.error(`[MarketScreener] Failed to fetch data for ${symbol}:`, e);
  }
  
  // Cache the result
  dataCache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });
  return result;
}
