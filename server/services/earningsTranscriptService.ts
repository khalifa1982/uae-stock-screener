/**
 * Earnings Transcript Service
 * 
 * Generates structured earnings call transcripts for UAE stocks using:
 * - FMP API for real transcript data (when available)
 * - LLM-generated structured summaries from available financial data
 * 
 * Output format includes chapters, speaker info, and navigable sections.
 */

import { invokeLLM } from "../_core/llm";
import { fetchFullProfile } from "../stockService";
import { fetchTVForecast } from "./tvExtendedService";
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
 * Generate a structured earnings transcript using LLM based on available financial data
 */
async function generateTranscriptFromData(
  symbol: string,
  companyName: string,
  exchange: string,
  profileData: any,
  forecastData: any
): Promise<TranscriptData | null> {
  try {
    const earnings = profileData?.earnings?.history || [];
    const incomeStatement = profileData?.financialStatements?.incomeStatements || [];
    const officers = profileData?.company?.officers || [];
    
    // Build context from available data
    const context = {
      symbol,
      company: companyName,
      exchange,
      sector: profileData?.company?.sector || "N/A",
      industry: profileData?.company?.industry || "N/A",
      price: profileData?.tradingInfo?.previousClose || null,
      marketCap: profileData?.keyStats?.marketCap || null,
      pe: profileData?.keyStats?.trailingPE || null,
      eps: profileData?.keyStats?.trailingEps || null,
      revenue: incomeStatement[0]?.totalRevenue || null,
      netIncome: incomeStatement[0]?.netIncome || null,
      officers: officers.slice(0, 5).map((o: any) => ({
        name: o.name,
        title: o.title,
        age: o.age,
      })),
      recentEarnings: earnings.slice(0, 4),
      forecast: forecastData ? {
        priceTarget: forecastData.priceTargetMedian,
        recommendation: forecastData.recommendationMark,
        epsForecast: forecastData.epsForecastNextFQ,
      } : null,
    };

    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a financial data formatter. Generate a realistic structured earnings call transcript summary for a UAE-listed stock. Return valid JSON matching this exact schema:
{
  "title": "string - e.g. 'Q4 2025 Earnings Call - EMAAR Properties'",
  "date": "string - recent date in YYYY-MM-DD format",
  "quarter": "string - e.g. 'Q4'",
  "year": number,
  "participants": [{"name":"string","role":"string","company":"string"}],
  "sections": [
    {"id":"s1","type":"header","title":"string","content":"string"},
    {"id":"s2","type":"speaker","speaker":"string","role":"string","company":"string","content":"string"},
    {"id":"s3","type":"text","content":"string"},
    {"id":"s4","type":"qa-header","title":"Questions & Answers","content":"Q&A Session"},
    ...more sections
  ]
}

Section types:
- "header": Chapter headers (Opening Remarks, Financial Highlights, Business Update, Guidance, Q&A)
- "speaker": A speaker's statement with their name, role, company
- "text": Plain text content
- "qa-header": Start of Q&A section

Make it realistic with 15-25 sections. Include CEO and CFO as main speakers. Add 2-3 analyst questions in Q&A.
Use real financial data provided. Keep each content block 2-4 sentences.`
        },
        {
          role: "user",
          content: `Generate earnings call transcript for:\n${JSON.stringify(context, null, 2)}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "earnings_transcript",
          strict: false,
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              date: { type: "string" },
              quarter: { type: "string" },
              year: { type: "number" },
              participants: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    role: { type: "string" },
                    company: { type: "string" }
                  },
                  required: ["name", "role", "company"]
                }
              },
              sections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    type: { type: "string" },
                    title: { type: "string" },
                    speaker: { type: "string" },
                    role: { type: "string" },
                    company: { type: "string" },
                    content: { type: "string" }
                  },
                  required: ["id", "type", "content"]
                }
              }
            },
            required: ["title", "date", "quarter", "year", "participants", "sections"]
          }
        }
      }
    });

    const content = result?.choices?.[0]?.message?.content;
    if (!content) return null;
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);

    const parsed = JSON.parse(contentStr);
    return parsed as TranscriptData;
  } catch (err) {
    console.error(`[EarningsTranscript] LLM generation failed for ${symbol}:`, err);
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
 * Get earnings transcript for a stock
 */
export async function getEarningsTranscript(symbol: string): Promise<TranscriptData | null> {
  // Check cache
  const cached = transcriptCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const stock = ALL_STOCKS.find(s => s.symbol === symbol);
  if (!stock) return null;

  // Try FMP first
  const fmpData = await fetchFMPTranscript(symbol, stock.exchange);
  if (fmpData && fmpData.content) {
    const parsed = parseFMPTranscript(fmpData, symbol, stock.name);
    transcriptCache.set(symbol, { data: parsed, timestamp: Date.now() });
    return parsed;
  }

  // Fall back to LLM-generated transcript from available data
  try {
    const [profileData, forecastData] = await Promise.all([
      fetchFullProfile(stock.yahooSymbol).catch(() => null),
      fetchTVForecast(stock.symbol, stock.exchange).catch(() => null),
    ]);

    const generated = await generateTranscriptFromData(
      symbol, stock.name, stock.exchange, profileData, forecastData
    );

    transcriptCache.set(symbol, { data: generated, timestamp: Date.now() });
    return generated;
  } catch (err) {
    console.error(`[EarningsTranscript] Failed for ${symbol}:`, err);
    transcriptCache.set(symbol, { data: null, timestamp: Date.now() });
    return null;
  }
}
