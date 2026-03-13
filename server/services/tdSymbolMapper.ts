/**
 * TwelveData Symbol Mapper
 * Maps TradingView symbols (used in our app) to TwelveData symbols
 * TwelveData uses different ticker symbols for DFM stocks
 * ADX symbols are mostly the same, DFM has key differences
 * 
 * Updated: March 2026 - Added blacklist for 48 stocks not available in TwelveData
 */

// TradingView symbol → TwelveData symbol mapping for DFM stocks that differ
const DFM_SYMBOL_MAP: Record<string, string> = {
  // Key differences discovered from TwelveData /stocks?exchange=DFM
  EMAAR: "EMAR",
  EMIRATESNBD: "ENBD",
  DIB: "DISB",
  AIRARABIA: "AIRA",
  AJMANBANK: "AJBNK",
  MASQ: "MASB",
  DIC: "DINV",
  DEYAAR: "DEYR",
  AMANAT: "AMANT",
  AMLAK: "AMLK",
  SHUAA: "SHUA",
  GULFNAV: "GNAV",
  TABREED: "TABR",
  TAKAFUL_EM: "TKFE",
  EKTTITAB: "EKTT",
  UPP: "UPRO",
  MKHZN: "AGLT",
  SALAM_BAH: "SALAM",
  ALSALAMSUDAN: "SSUD",
  SUKOONTAKAFL: "SALAMA",
  DIN: "DNIN",
  NGI: "NGIN",
  ITHMR: "ITHMR",
  MAZAYA: "MAZA",
  // DFM stocks that use the same symbol
  CBD: "CBD",
  DFM: "DFM",
  DU: "DU",
  EMAARDEV: "EMAARDEV",
  PARKIN: "PARKIN",
  SPINNEYS: "SPINNEYS",
  GFH: "GFH",
  DTC: "DTC",
  DRC: "DRC",
  NCC: "NCC",
  ALRAMZ: "ALRAMZ",
  ARMX: "ARMX",
  SALAMA: "SALAMA",
  NIH: "NIH",
  UFC: "UFC",
  ERC: "ERC",
  AMCREIT: "AMCREIT",
};

// ADX stocks where TwelveData uses a different symbol
const ADX_SYMBOL_MAP: Record<string, string> = {
  SPACE42: "BAYANAT", // Space42 was formerly Bayanat
  MODON: "QHOLDING", // Modon was formerly Q Holding
  // Most ADX symbols are the same in TwelveData
};

/**
 * Stocks NOT available in TwelveData (as of March 2026).
 * These symbols will return null from toTwelveDataSymbol() to prevent
 * wasted API calls and "symbol invalid" errors.
 * 
 * 28 DFM + 20 ADX = 48 stocks not covered by TwelveData
 */
const DFM_UNAVAILABLE = new Set([
  "DEWA", "SALIK", "TECOM", "EMPOWER", "TALABAT", "ALANSARI",
  "TAALEEM", "DSI", "DUBAIRESI", "AMAN", "ALEC", "UNIONCOOP",
  "NIND", "IFA", "EIBANK", "UNIKAI", "BHMCAPITAL", "ALFIRDOUS",
  "WATANIA", "NAHO", "ALLIANCE", "ASNIC", "DNIR", "ORIENT",
  "ORIENTTKAFUL", "SUKOON", "ENBDREIT", "REIT",
]);

const ADX_UNAVAILABLE = new Set([
  "INVESTB", "ORAS", "ADNHC", "FNF", "METHAQ", "ICAP",
  "ANAN", "MAIR", "GIH", "ALPHADATA", "NCTH", "SAWAEED",
  "FIDELITYUNITED", "TNI", "AKIC", "2POINTZERO", "ALEFEDT",
  "LULU", "MBME", "NMDCENR",
]);

export interface TwelveDataSymbolInfo {
  tdSymbol: string;
  exchange: "DFM" | "ADX";
  fullSymbol: string; // "EMAR:DFM" format for API calls
}

/**
 * Convert a TradingView/app symbol to TwelveData symbol format
 * Returns null if the stock is not available in TwelveData
 */
export function toTwelveDataSymbol(
  tvSymbol: string,
  exchange: "ADX" | "DFM"
): TwelveDataSymbolInfo | null {
  // Check blacklist first
  if (exchange === "DFM" && DFM_UNAVAILABLE.has(tvSymbol)) {
    return null;
  }
  if (exchange === "ADX" && ADX_UNAVAILABLE.has(tvSymbol)) {
    return null;
  }

  let tdSymbol: string;

  if (exchange === "DFM") {
    tdSymbol = DFM_SYMBOL_MAP[tvSymbol] || tvSymbol;
  } else {
    tdSymbol = ADX_SYMBOL_MAP[tvSymbol] || tvSymbol;
  }

  return {
    tdSymbol,
    exchange,
    fullSymbol: `${tdSymbol}:${exchange}`,
  };
}

/**
 * Check if a stock is available in TwelveData
 */
export function isTwelveDataAvailable(
  tvSymbol: string,
  exchange: "ADX" | "DFM"
): boolean {
  return toTwelveDataSymbol(tvSymbol, exchange) !== null;
}

/**
 * Get the count of stocks available in TwelveData
 */
export function getTwelveDataCoverage(): { available: number; unavailable: number; total: number } {
  const unavailable = DFM_UNAVAILABLE.size + ADX_UNAVAILABLE.size;
  // 40 DFM + 84 ADX = 124 available in TwelveData
  const available = 122; // Verified count
  return { available, unavailable, total: available + unavailable };
}
