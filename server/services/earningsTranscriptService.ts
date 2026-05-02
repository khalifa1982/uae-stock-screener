/**
 * Earnings Transcript Service
 * 
 * Fetches real earnings call transcripts for UAE stocks using:
 * - FMP API for real transcript data (when available)
 * 
 * If no real transcript is available from FMP, returns null.
 * NO LLM-generated content is used.
 * 
 * Output format includes chapters, speaker info, and navigable sections.
 */

import { fetchTVForecast, fetchTVExtendedFinancials } from "./tvExtendedService";
import { fetchTVStocksByTickers } from "./tradingViewService";
import { ALL_STOCKS } from "../../shared/stockData";

const FMP_API_KEY = "mxE7tjUStkNWrahGNalQTcB7GPeI36zg";

interface TranscriptSection {
  id: string;
  type: "header" | "speaker" | "text" | "qa-header";
  title?: string;
  speaker?: string;
  role?: string;
  company?: string;
  content: string;
}

interface TranscriptData {
  title: string;
  date: string;
  quarter: string;
  year: number;
  sections: TranscriptSection[];
  participants: { name: string; role: string; company: string }[];
}

// In-memory cache for transcripts (1 hour TTL)
const transcriptCache = new Map<string, { data: TranscriptData | null; timestamp: number }>();
const CACHE_TTL = 3600_000; // 1 hour

/**
 * Try to fetch real transcript from FMP API
 */
async function fetchFMPTranscript(symbol: string, exchange: string): Promise<any | null> {
  try {
    // FMP uses different symbol format for UAE stocks
    const fmpSymbol = `${symbol}.${exchange === "ADX" ? "AE" : "AE"}`;
    const url = `https://financialmodelingprep.com/api/v3/earning_call_transcript/${encodeURIComponent(fmpSymbol)}?apikey=${FMP_API_KEY}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) return data[0];
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse FMP transcript into structured format
 */
function parseFMPTranscript(raw: any, symbol: string, companyName: string): TranscriptData {
  const text = raw.content || "";
  const lines = text.split("\n").filter((l: string) => l.trim());
  const sections: TranscriptSection[] = [];
  let sectionId = 0;

  // Simple parser: detect speakers and headers
  for (const line of lines) {
    sectionId++;
    const speakerMatch = line.match(/^([A-Z][a-zA-Z\s.]+)\s*[-–—:]\s*(.+)/);
    if (speakerMatch) {
      sections.push({
        id: `s${sectionId}`,
        type: "speaker",
        speaker: speakerMatch[1].trim(),
        role: "",
        company: companyName,
        content: speakerMatch[2].trim(),
      });
    } else if (line.match(/^(Opening|Financial|Business|Guidance|Q&A|Questions|Closing|Operator)/i)) {
      sections.push({
        id: `s${sectionId}`,
        type: line.match(/Q&A|Questions/i) ? "qa-header" : "header",
        title: line.trim(),
        content: line.trim(),
      });
    } else {
      sections.push({
        id: `s${sectionId}`,
        type: "text",
        content: line.trim(),
      });
    }
  }

  return {
    title: `Earnings Call - ${companyName}`,
    date: raw.date || new Date().toISOString().split("T")[0],
    quarter: raw.quarter ? `Q${raw.quarter}` : "Q4",
    year: raw.year || new Date().getFullYear(),
    sections,
    participants: [],
  };
}

/**
 * Get earnings transcript for a stock.
 * Returns real FMP data only — no LLM-generated content.
 */
export async function getEarningsTranscript(symbol: string): Promise<TranscriptData | null> {
  // Check cache
  const cached = transcriptCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const stock = ALL_STOCKS.find(s => s.symbol === symbol);
  if (!stock) return null;

  // Try FMP for real transcript data
  const fmpData = await fetchFMPTranscript(symbol, stock.exchange);
  if (fmpData && fmpData.content) {
    const parsed = parseFMPTranscript(fmpData, symbol, stock.name);
    transcriptCache.set(symbol, { data: parsed, timestamp: Date.now() });
    return parsed;
  }

  // No real transcript available — return null (no LLM fallback)
  transcriptCache.set(symbol, { data: null, timestamp: Date.now() });
  return null;
}
