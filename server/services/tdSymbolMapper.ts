/**
 * TwelveData Symbol Mapper
 * Maps TradingView symbols (used in our app) to TwelveData symbols
 * TwelveData uses different ticker symbols for DFM stocks
 * ADX symbols are mostly the same, DFM has key differences
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
  SUKOONTAKAFL: "SALAMA", // approximate
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

export interface TwelveDataSymbolInfo {
  tdSymbol: string;
  exchange: "DFM" | "ADX";
  fullSymbol: string; // "EMAR:DFM" format for API calls
}

/**
 * Convert a TradingView/app symbol to TwelveData symbol format
 */
export function toTwelveDataSymbol(
  tvSymbol: string,
  exchange: "ADX" | "DFM"
): TwelveDataSymbolInfo | null {
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
 * (not all stocks in our app are covered by TwelveData)
 */
export function isTwelveDataAvailable(
  tvSymbol: string,
  exchange: "ADX" | "DFM"
): boolean {
  // TwelveData covers 40 DFM + 84 ADX = 124 stocks
  // Our app has more stocks, so some won't be available
  const info = toTwelveDataSymbol(tvSymbol, exchange);
  return info !== null;
}
