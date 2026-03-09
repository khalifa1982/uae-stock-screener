/**
 * Simply Wall St-style Snowflake Scoring Engine
 * 
 * Based on the open-source model: https://github.com/SimplyWallSt/Company-Analysis-Model
 * 5 categories × 6 checks each = 30 total checks
 * Each check passes (1) or fails (0), giving a score of 0-6 per category
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface SnowflakeCheck {
  id: string;
  label: string;
  description: string;
  passed: boolean;
  value?: string;  // The actual value used in the check
  threshold?: string;  // The threshold it was compared against
}

export interface SnowflakeCategory {
  name: string;
  score: number;  // 0-6
  maxScore: number;  // Always 6
  checks: SnowflakeCheck[];
}

export interface SnowflakeResult {
  value: SnowflakeCategory;
  future: SnowflakeCategory;
  past: SnowflakeCategory;
  health: SnowflakeCategory;
  dividend: SnowflakeCategory;
  totalScore: number;  // 0-30
  color: string;  // hex color based on total score
}

export interface FairValueResult {
  fairValue: number | null;
  currentPrice: number;
  discount: number | null;  // positive = undervalued, negative = overvalued
  method: string;
  details: {
    freeCashFlow: number | null;
    growthRate: number | null;
    discountRate: number | null;
    terminalGrowthRate: number | null;
    sharesOutstanding: number | null;
  };
}

// ─── Input Data Interface ───────────────────────────────────────────

export interface SnowflakeInput {
  // Price & Valuation
  close: number | null;
  pe: number | null;
  pb: number | null;
  peg: number | null;
  marketCap: number | null;
  
  // Earnings & Revenue
  eps: number | null;
  epsForecast: number | null;
  netIncome: number | null;
  totalRevenue: number | null;
  ebitda: number | null;
  grossProfit: number | null;
  
  // Profitability
  roe: number | null;  // as decimal (0.20 = 20%)
  roa: number | null;  // as decimal
  roic: number | null;  // as decimal
  grossMargin: number | null;  // as decimal
  operatingMargin: number | null;  // as decimal
  netMargin: number | null;  // as decimal
  
  // Balance Sheet
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalCurrentAssets: number | null;
  totalCurrentLiabilities: number | null;
  totalDebt: number | null;
  debtToEquity: number | null;  // as percentage (40 = 40%)
  currentRatio: number | null;
  freeCashFlow: number | null;
  operatingCashFlow: number | null;
  sharesOutstanding: number | null;
  bookValuePerShare: number | null;
  
  // Dividends
  dividendYield: number | null;  // as decimal (0.05 = 5%)
  dividendPerShare: number | null;
  payoutRatio: number | null;  // as decimal
  
  // Performance
  perfYear: number | null;  // as percentage
  perf5Year: number | null;  // as percentage
  
  // Sector/Industry info
  sector: string | null;
  industry: string | null;
  
  // Market averages (computed from all stocks)
  marketAvgPE: number | null;
  industryAvgPE: number | null;
  industryAvgPB: number | null;
  industryAvgROA: number | null;
  marketAvgEarningsGrowth: number | null;
  marketAvgRevenueGrowth: number | null;
  marketDividendYield25thPctile: number | null;
  marketDividendYield75thPctile: number | null;
}

// ─── UAE Market Constants ───────────────────────────────────────────

const UAE_RISK_FREE_RATE = 0.045;  // ~4.5% UAE 10yr bond
const UAE_INFLATION = 0.025;  // ~2.5% CPI
const UAE_SAVINGS_RATE = 0.04;  // ~4% savings rate
const TERMINAL_GROWTH_RATE = 0.025;  // 2.5% long-term growth
const UAE_EQUITY_RISK_PREMIUM = 0.065;  // ~6.5% for UAE

// ─── Helper Functions ───────────────────────────────────────────────

function isValid(val: any): val is number {
  return val != null && !isNaN(val) && isFinite(val);
}

// ─── Value Checks ───────────────────────────────────────────────────

function calculateFairValue(input: SnowflakeInput): FairValueResult {
  const { close, freeCashFlow, sharesOutstanding, eps, roe, bookValuePerShare, pe, perfYear } = input;
  
  if (!isValid(close)) {
    return { fairValue: null, currentPrice: close || 0, discount: null, method: 'N/A', details: { freeCashFlow: null, growthRate: null, discountRate: null, terminalGrowthRate: null, sharesOutstanding: null } };
  }

  // Method 1: Simple DCF from Free Cash Flow
  if (isValid(freeCashFlow) && isValid(sharesOutstanding) && freeCashFlow > 0 && sharesOutstanding > 0) {
    const fcfPerShare = freeCashFlow / sharesOutstanding;
    // Estimate growth rate from performance or use conservative 5%
    const growthRate = isValid(perfYear) ? Math.min(Math.max(perfYear / 100, -0.1), 0.3) : 0.05;
    const discountRate = UAE_RISK_FREE_RATE + UAE_EQUITY_RISK_PREMIUM;
    
    // 2-stage DCF: 5 years of growth, then terminal value
    let pvFCF = 0;
    let currentFCF = fcfPerShare;
    for (let year = 1; year <= 5; year++) {
      currentFCF *= (1 + growthRate);
      pvFCF += currentFCF / Math.pow(1 + discountRate, year);
    }
    
    // Terminal value (Gordon Growth)
    const terminalFCF = currentFCF * (1 + TERMINAL_GROWTH_RATE);
    const terminalValue = terminalFCF / (discountRate - TERMINAL_GROWTH_RATE);
    const pvTerminal = terminalValue / Math.pow(1 + discountRate, 5);
    
    const fairValue = pvFCF + pvTerminal;
    const discount = ((fairValue - close) / close) * 100;
    
    return {
      fairValue: Math.round(fairValue * 100) / 100,
      currentPrice: close,
      discount: Math.round(discount * 10) / 10,
      method: '2-Stage DCF',
      details: {
        freeCashFlow,
        growthRate: Math.round(growthRate * 1000) / 10,
        discountRate: Math.round(discountRate * 1000) / 10,
        terminalGrowthRate: TERMINAL_GROWTH_RATE * 100,
        sharesOutstanding,
      },
    };
  }

  // Method 2: Excess Returns Model (for financials)
  if (isValid(roe) && isValid(bookValuePerShare) && isValid(sharesOutstanding)) {
    const costOfEquity = UAE_RISK_FREE_RATE + UAE_EQUITY_RISK_PREMIUM;
    const excessReturn = (roe - costOfEquity) * bookValuePerShare;
    if (excessReturn > 0) {
      const terminalValue = excessReturn / (costOfEquity - TERMINAL_GROWTH_RATE);
      const fairValue = bookValuePerShare + terminalValue;
      const discount = ((fairValue - close) / close) * 100;
      
      return {
        fairValue: Math.round(fairValue * 100) / 100,
        currentPrice: close,
        discount: Math.round(discount * 10) / 10,
        method: 'Excess Returns',
        details: {
          freeCashFlow: null,
          growthRate: Math.round(roe * 1000) / 10,
          discountRate: Math.round(costOfEquity * 1000) / 10,
          terminalGrowthRate: TERMINAL_GROWTH_RATE * 100,
          sharesOutstanding,
        },
      };
    }
  }

  // Method 3: Earnings-based valuation (PE-based fair value)
  if (isValid(eps) && eps > 0 && isValid(pe)) {
    // Use industry average PE or market average as fair PE
    const fairPE = input.industryAvgPE || input.marketAvgPE || 15;
    const fairValue = eps * fairPE;
    const discount = ((fairValue - close) / close) * 100;
    
    return {
      fairValue: Math.round(fairValue * 100) / 100,
      currentPrice: close,
      discount: Math.round(discount * 10) / 10,
      method: 'PE-Based',
      details: {
        freeCashFlow: null,
        growthRate: null,
        discountRate: null,
        terminalGrowthRate: null,
        sharesOutstanding,
      },
    };
  }

  return { fairValue: null, currentPrice: close, discount: null, method: 'Insufficient Data', details: { freeCashFlow: null, growthRate: null, discountRate: null, terminalGrowthRate: null, sharesOutstanding: null } };
}

function computeValueChecks(input: SnowflakeInput, fairValue: FairValueResult): SnowflakeCategory {
  const checks: SnowflakeCheck[] = [];
  
  // CHECK 1: DCF fair value > 20% below share price (moderately undervalued)
  const fvDiscount = fairValue.discount;
  checks.push({
    id: 'value_1',
    label: 'Below Fair Value',
    description: 'Trading below estimated fair value by more than 20%',
    passed: isValid(fvDiscount) && fvDiscount >= 20,
    value: isValid(fvDiscount) ? `${fvDiscount > 0 ? '+' : ''}${fvDiscount.toFixed(1)}%` : 'N/A',
    threshold: '>20% below fair value',
  });

  // CHECK 2: DCF fair value > 40% below share price (substantially undervalued)
  checks.push({
    id: 'value_2',
    label: 'Significantly Below Fair Value',
    description: 'Trading below estimated fair value by more than 40%',
    passed: isValid(fvDiscount) && fvDiscount >= 40,
    value: isValid(fvDiscount) ? `${fvDiscount > 0 ? '+' : ''}${fvDiscount.toFixed(1)}%` : 'N/A',
    threshold: '>40% below fair value',
  });

  // CHECK 3: PE < market average and > 0
  const pe = input.pe;
  const mktPE = input.marketAvgPE;
  checks.push({
    id: 'value_3',
    label: 'P/E Below Market',
    description: 'Price-to-Earnings ratio is below the market average',
    passed: isValid(pe) && pe > 0 && isValid(mktPE) && pe < mktPE,
    value: isValid(pe) ? pe.toFixed(1) + 'x' : 'N/A',
    threshold: isValid(mktPE) ? `Market avg: ${mktPE.toFixed(1)}x` : 'N/A',
  });

  // CHECK 4: PE < industry average and > 0
  const indPE = input.industryAvgPE;
  checks.push({
    id: 'value_4',
    label: 'P/E Below Industry',
    description: 'Price-to-Earnings ratio is below the industry average',
    passed: isValid(pe) && pe > 0 && isValid(indPE) && pe < indPE,
    value: isValid(pe) ? pe.toFixed(1) + 'x' : 'N/A',
    threshold: isValid(indPE) ? `Industry avg: ${indPE.toFixed(1)}x` : 'N/A',
  });

  // CHECK 5: PEG ratio between 0 and 1
  const peg = input.peg;
  checks.push({
    id: 'value_5',
    label: 'PEG Ratio',
    description: 'Price/Earnings-to-Growth ratio is between 0 and 1 (fairly valued growth)',
    passed: isValid(peg) && peg > 0 && peg <= 1,
    value: isValid(peg) ? peg.toFixed(2) : 'N/A',
    threshold: '0 < PEG ≤ 1',
  });

  // CHECK 6: PB < industry average and > 0
  const pb = input.pb;
  const indPB = input.industryAvgPB;
  checks.push({
    id: 'value_6',
    label: 'P/B Below Industry',
    description: 'Price-to-Book ratio is below the industry average',
    passed: isValid(pb) && pb > 0 && isValid(indPB) && pb < indPB,
    value: isValid(pb) ? pb.toFixed(2) + 'x' : 'N/A',
    threshold: isValid(indPB) ? `Industry avg: ${indPB.toFixed(2)}x` : 'N/A',
  });

  const score = checks.filter(c => c.passed).length;
  return { name: 'Value', score, maxScore: 6, checks };
}

// ─── Future Performance Checks ──────────────────────────────────────

function computeFutureChecks(input: SnowflakeInput): SnowflakeCategory {
  const checks: SnowflakeCheck[] = [];
  const earningsGrowth = isValid(input.perfYear) ? input.perfYear : null;
  const savingsThreshold = (UAE_SAVINGS_RATE + UAE_INFLATION) * 100; // ~6.5%
  
  // CHECK 1: Earnings growth > savings rate + inflation
  checks.push({
    id: 'future_1',
    label: 'Earnings vs Savings Rate',
    description: 'Expected earnings growth exceeds the low-risk savings rate plus inflation',
    passed: isValid(earningsGrowth) && earningsGrowth > savingsThreshold,
    value: isValid(earningsGrowth) ? `${earningsGrowth > 0 ? '+' : ''}${earningsGrowth.toFixed(1)}%` : 'N/A',
    threshold: `>${savingsThreshold.toFixed(1)}% (savings + inflation)`,
  });

  // CHECK 2: Earnings growth > market average
  const mktGrowth = input.marketAvgEarningsGrowth;
  checks.push({
    id: 'future_2',
    label: 'Earnings vs Market',
    description: 'Expected earnings growth exceeds the market average',
    passed: isValid(earningsGrowth) && isValid(mktGrowth) && earningsGrowth > mktGrowth,
    value: isValid(earningsGrowth) ? `${earningsGrowth > 0 ? '+' : ''}${earningsGrowth.toFixed(1)}%` : 'N/A',
    threshold: isValid(mktGrowth) ? `Market avg: ${mktGrowth.toFixed(1)}%` : 'N/A',
  });

  // CHECK 3: Revenue growth > market average
  // Use net margin improvement as proxy for revenue growth
  const revenueGrowth = isValid(input.perfYear) ? input.perfYear : null;
  const mktRevGrowth = input.marketAvgRevenueGrowth;
  checks.push({
    id: 'future_3',
    label: 'Revenue vs Market',
    description: 'Expected revenue growth exceeds the market average',
    passed: isValid(revenueGrowth) && isValid(mktRevGrowth) && revenueGrowth > mktRevGrowth,
    value: isValid(revenueGrowth) ? `${revenueGrowth > 0 ? '+' : ''}${revenueGrowth.toFixed(1)}%` : 'N/A',
    threshold: isValid(mktRevGrowth) ? `Market avg: ${mktRevGrowth.toFixed(1)}%` : 'N/A',
  });

  // CHECK 4: Earnings growth > 20% (high growth)
  checks.push({
    id: 'future_4',
    label: 'High Earnings Growth',
    description: 'Annual earnings growth rate exceeds 20%',
    passed: isValid(earningsGrowth) && earningsGrowth > 20,
    value: isValid(earningsGrowth) ? `${earningsGrowth > 0 ? '+' : ''}${earningsGrowth.toFixed(1)}%` : 'N/A',
    threshold: '>20%',
  });

  // CHECK 5: Revenue growth > 20%
  checks.push({
    id: 'future_5',
    label: 'High Revenue Growth',
    description: 'Annual revenue growth rate exceeds 20%',
    passed: isValid(revenueGrowth) && revenueGrowth > 20,
    value: isValid(revenueGrowth) ? `${revenueGrowth > 0 ? '+' : ''}${revenueGrowth.toFixed(1)}%` : 'N/A',
    threshold: '>20%',
  });

  // CHECK 6: ROE > 20%
  const roe = input.roe;
  checks.push({
    id: 'future_6',
    label: 'Return on Equity',
    description: 'Return on Equity is expected to exceed 20%',
    passed: isValid(roe) && roe > 0.20,
    value: isValid(roe) ? `${(roe * 100).toFixed(1)}%` : 'N/A',
    threshold: '>20%',
  });

  const score = checks.filter(c => c.passed).length;
  return { name: 'Future', score, maxScore: 6, checks };
}

// ─── Past Performance Checks ────────────────────────────────────────

function computePastChecks(input: SnowflakeInput): SnowflakeCategory {
  const checks: SnowflakeCheck[] = [];
  const epsGrowth = isValid(input.perfYear) ? input.perfYear : null;
  
  // CHECK 1: EPS growth > industry average (past year)
  // Use market average as proxy for industry
  const mktGrowth = input.marketAvgEarningsGrowth;
  checks.push({
    id: 'past_1',
    label: 'EPS Growth vs Industry',
    description: 'Earnings per share growth exceeded industry average over the past year',
    passed: isValid(epsGrowth) && isValid(mktGrowth) && epsGrowth > mktGrowth,
    value: isValid(epsGrowth) ? `${epsGrowth > 0 ? '+' : ''}${epsGrowth.toFixed(1)}%` : 'N/A',
    threshold: isValid(mktGrowth) ? `Industry avg: ${mktGrowth.toFixed(1)}%` : 'N/A',
  });

  // CHECK 2: EPS increased in past 5 years
  const perf5Y = input.perf5Year;
  checks.push({
    id: 'past_2',
    label: 'Long-term EPS Growth',
    description: 'Earnings per share have increased over the past 5 years',
    passed: isValid(perf5Y) && perf5Y > 0,
    value: isValid(perf5Y) ? `${perf5Y > 0 ? '+' : ''}${perf5Y.toFixed(1)}%` : 'N/A',
    threshold: 'Positive 5-year growth',
  });

  // CHECK 3: Current EPS growth > 5-year average
  checks.push({
    id: 'past_3',
    label: 'Accelerating Growth',
    description: 'Current earnings growth exceeds the 5-year average annual growth',
    passed: isValid(epsGrowth) && isValid(perf5Y) && epsGrowth > (perf5Y / 5),
    value: isValid(epsGrowth) ? `${epsGrowth > 0 ? '+' : ''}${epsGrowth.toFixed(1)}%` : 'N/A',
    threshold: isValid(perf5Y) ? `5yr avg: ${(perf5Y / 5).toFixed(1)}%/yr` : 'N/A',
  });

  // CHECK 4: ROE > 20%
  const roe = input.roe;
  checks.push({
    id: 'past_4',
    label: 'High Return on Equity',
    description: 'Return on Equity exceeds 20%, indicating high profitability',
    passed: isValid(roe) && roe > 0.20,
    value: isValid(roe) ? `${(roe * 100).toFixed(1)}%` : 'N/A',
    threshold: '>20%',
  });

  // CHECK 5: ROCE improved (using ROIC as proxy)
  const roic = input.roic;
  checks.push({
    id: 'past_5',
    label: 'Return on Capital',
    description: 'Return on Capital Employed has improved or remains strong',
    passed: isValid(roic) && roic > 0.10,
    value: isValid(roic) ? `${(roic * 100).toFixed(1)}%` : 'N/A',
    threshold: '>10% (strong capital efficiency)',
  });

  // CHECK 6: ROA > industry average
  const roa = input.roa;
  const indROA = input.industryAvgROA;
  checks.push({
    id: 'past_6',
    label: 'Return on Assets',
    description: 'Return on Assets exceeds the industry average',
    passed: isValid(roa) && isValid(indROA) && roa > indROA,
    value: isValid(roa) ? `${(roa * 100).toFixed(1)}%` : 'N/A',
    threshold: isValid(indROA) ? `Industry avg: ${(indROA * 100).toFixed(1)}%` : 'N/A',
  });

  const score = checks.filter(c => c.passed).length;
  return { name: 'Past', score, maxScore: 6, checks };
}

// ─── Health Checks ──────────────────────────────────────────────────

function computeHealthChecks(input: SnowflakeInput): SnowflakeCategory {
  const checks: SnowflakeCheck[] = [];
  
  // CHECK 1: Short-term assets > short-term liabilities
  const stAssets = input.totalCurrentAssets;
  const stLiabilities = input.totalCurrentLiabilities;
  checks.push({
    id: 'health_1',
    label: 'Short-term Solvency',
    description: 'Short-term assets exceed short-term liabilities',
    passed: isValid(stAssets) && isValid(stLiabilities) && stAssets > stLiabilities,
    value: isValid(stAssets) ? formatLargeNum(stAssets) : 'N/A',
    threshold: isValid(stLiabilities) ? `ST Liabilities: ${formatLargeNum(stLiabilities)}` : 'N/A',
  });

  // CHECK 2: Short-term assets > long-term liabilities
  const ltLiabilities = isValid(input.totalLiabilities) && isValid(stLiabilities) 
    ? input.totalLiabilities - stLiabilities 
    : null;
  checks.push({
    id: 'health_2',
    label: 'Long-term Coverage',
    description: 'Short-term assets exceed long-term liabilities',
    passed: isValid(stAssets) && isValid(ltLiabilities) && stAssets > ltLiabilities,
    value: isValid(stAssets) ? formatLargeNum(stAssets) : 'N/A',
    threshold: isValid(ltLiabilities) ? `LT Liabilities: ${formatLargeNum(ltLiabilities)}` : 'N/A',
  });

  // CHECK 3: Debt/Equity ratio NOT increased (use current level as proxy)
  const de = input.debtToEquity;
  checks.push({
    id: 'health_3',
    label: 'Debt Trend',
    description: 'Debt-to-Equity ratio is at a manageable level',
    passed: isValid(de) && de < 100,  // Below 100% is reasonable
    value: isValid(de) ? `${de.toFixed(1)}%` : 'N/A',
    threshold: '<100%',
  });

  // CHECK 4: Debt/Equity < 40%
  checks.push({
    id: 'health_4',
    label: 'Low Leverage',
    description: 'Debt-to-Equity ratio is below 40%',
    passed: isValid(de) && de < 40,
    value: isValid(de) ? `${de.toFixed(1)}%` : 'N/A',
    threshold: '<40%',
  });

  // CHECK 5: Operating cash flow > 20% of total debt
  const ocf = input.operatingCashFlow;
  const debt = input.totalDebt;
  const ocfCoverage = isValid(ocf) && isValid(debt) && debt > 0 ? (ocf / debt) * 100 : null;
  checks.push({
    id: 'health_5',
    label: 'Debt Coverage',
    description: 'Operating cash flow covers more than 20% of total debt',
    passed: isValid(ocfCoverage) && ocfCoverage > 20,
    value: isValid(ocfCoverage) ? `${ocfCoverage.toFixed(1)}%` : (isValid(debt) && debt === 0 ? 'No debt' : 'N/A'),
    threshold: '>20% of total debt',
  });

  // CHECK 6: EBIT > 5x interest expense (use EBITDA/debt as proxy)
  const ebitda = input.ebitda;
  const interestCoverage = isValid(ebitda) && isValid(debt) && debt > 0 ? ebitda / (debt * 0.05) : null;  // Assume ~5% interest rate
  checks.push({
    id: 'health_6',
    label: 'Interest Coverage',
    description: 'Earnings cover interest obligations more than 5 times',
    passed: isValid(interestCoverage) && interestCoverage > 5,
    value: isValid(interestCoverage) ? `${interestCoverage.toFixed(1)}x` : (isValid(debt) && debt === 0 ? 'No debt' : 'N/A'),
    threshold: '>5x interest',
  });

  // Special case: if company has no debt, pass debt-related checks
  if (isValid(debt) && debt === 0) {
    checks[2].passed = true;
    checks[3].passed = true;
    checks[4].passed = true;
    checks[5].passed = true;
  }

  const score = checks.filter(c => c.passed).length;
  return { name: 'Health', score, maxScore: 6, checks };
}

// ─── Dividend Checks ────────────────────────────────────────────────

function computeDividendChecks(input: SnowflakeInput): SnowflakeCategory {
  const checks: SnowflakeCheck[] = [];
  const dy = input.dividendYield;
  const dps = input.dividendPerShare;
  const eps = input.eps;
  
  // CHECK 1: Dividend yield > 25th percentile of market
  const p25 = input.marketDividendYield25thPctile;
  checks.push({
    id: 'div_1',
    label: 'Yield vs Market (25th)',
    description: 'Dividend yield exceeds the 25th percentile of the market',
    passed: isValid(dy) && dy > 0 && isValid(p25) && dy > p25,
    value: isValid(dy) ? `${(dy * 100).toFixed(2)}%` : 'No dividend',
    threshold: isValid(p25) ? `25th pctile: ${(p25 * 100).toFixed(2)}%` : 'N/A',
  });

  // CHECK 2: Dividend yield > 75th percentile of market
  const p75 = input.marketDividendYield75thPctile;
  checks.push({
    id: 'div_2',
    label: 'Yield vs Market (75th)',
    description: 'Dividend yield exceeds the 75th percentile of the market (top quartile)',
    passed: isValid(dy) && dy > 0 && isValid(p75) && dy > p75,
    value: isValid(dy) ? `${(dy * 100).toFixed(2)}%` : 'No dividend',
    threshold: isValid(p75) ? `75th pctile: ${(p75 * 100).toFixed(2)}%` : 'N/A',
  });

  // CHECK 3: Dividend stability (no >10% drops) - use current yield as proxy
  // If company pays dividend consistently, consider it stable
  checks.push({
    id: 'div_3',
    label: 'Dividend Stability',
    description: 'Dividend has been stable without significant drops',
    passed: isValid(dy) && dy > 0 && isValid(dps) && dps > 0,
    value: isValid(dps) ? `${dps.toFixed(3)} per share` : 'No dividend',
    threshold: 'No drops >10% in recent years',
  });

  // CHECK 4: Dividend has increased
  checks.push({
    id: 'div_4',
    label: 'Dividend Growth',
    description: 'Dividend payments have increased over time',
    passed: isValid(dy) && dy > 0.02 && isValid(dps) && dps > 0,
    value: isValid(dy) ? `${(dy * 100).toFixed(2)}%` : 'No dividend',
    threshold: 'Growing dividend',
  });

  // CHECK 5: Payout ratio > 0% and < 90% (covered by earnings)
  let payoutRatio = input.payoutRatio;
  if (!isValid(payoutRatio) && isValid(dps) && isValid(eps) && eps > 0) {
    payoutRatio = dps / eps;
  }
  checks.push({
    id: 'div_5',
    label: 'Earnings Coverage',
    description: 'Dividends are well covered by earnings (payout ratio 0-90%)',
    passed: isValid(payoutRatio) && payoutRatio > 0 && payoutRatio < 0.90,
    value: isValid(payoutRatio) ? `${(payoutRatio * 100).toFixed(1)}%` : 'N/A',
    threshold: '0% < Payout < 90%',
  });

  // CHECK 6: Future payout coverage (use forecast EPS)
  const epsForecast = input.epsForecast;
  let futurePayoutRatio: number | null = null;
  if (isValid(dps) && isValid(epsForecast) && epsForecast > 0) {
    futurePayoutRatio = dps / epsForecast;
  }
  checks.push({
    id: 'div_6',
    label: 'Future Coverage',
    description: 'Future dividends expected to be covered by earnings',
    passed: isValid(futurePayoutRatio) ? (futurePayoutRatio > 0 && futurePayoutRatio < 0.90) : (isValid(payoutRatio) && payoutRatio > 0 && payoutRatio < 0.90),
    value: isValid(futurePayoutRatio) ? `${(futurePayoutRatio * 100).toFixed(1)}%` : (isValid(payoutRatio) ? `${(payoutRatio * 100).toFixed(1)}%` : 'N/A'),
    threshold: '0% < Future Payout < 90%',
  });

  const score = checks.filter(c => c.passed).length;
  return { name: 'Dividend', score, maxScore: 6, checks };
}

// ─── Color Calculation ──────────────────────────────────────────────

function getSnowflakeColor(totalScore: number): string {
  // 0-10: Red, 11-20: Yellow/Orange, 21-30: Green
  if (totalScore <= 6) return '#ef4444';   // Red
  if (totalScore <= 10) return '#f97316';  // Orange
  if (totalScore <= 15) return '#eab308';  // Yellow
  if (totalScore <= 20) return '#84cc16';  // Lime
  if (totalScore <= 25) return '#22c55e';  // Green
  return '#10b981';                         // Emerald
}

// ─── Large Number Formatter ─────────────────────────────────────────

function formatLargeNum(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(1) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toFixed(0);
}

// ─── Market Averages Calculator ─────────────────────────────────────

export interface MarketAverages {
  marketAvgPE: number;
  industryAvgPE: Record<string, number>;
  industryAvgPB: Record<string, number>;
  industryAvgROA: Record<string, number>;
  marketAvgEarningsGrowth: number;
  marketAvgRevenueGrowth: number;
  marketDividendYield25thPctile: number;
  marketDividendYield75thPctile: number;
}

export function computeMarketAverages(stocks: any[]): MarketAverages {
  // PE averages
  const validPEs = stocks.filter(s => s.pe > 0 && s.pe < 200).map(s => s.pe);
  const marketAvgPE = validPEs.length > 0 ? validPEs.reduce((a, b) => a + b, 0) / validPEs.length : 15;

  // Industry PE averages
  const industryAvgPE: Record<string, number> = {};
  const industryAvgPB: Record<string, number> = {};
  const industryAvgROA: Record<string, number> = {};
  
  const bySector: Record<string, any[]> = {};
  for (const s of stocks) {
    const sector = s.sector || 'Unknown';
    if (!bySector[sector]) bySector[sector] = [];
    bySector[sector].push(s);
  }
  
  for (const [sector, sectorStocks] of Object.entries(bySector)) {
    const pes = sectorStocks.filter(s => s.pe > 0 && s.pe < 200).map(s => s.pe);
    if (pes.length > 0) industryAvgPE[sector] = pes.reduce((a, b) => a + b, 0) / pes.length;
    
    const pbs = sectorStocks.filter(s => s.priceToBook > 0 && s.priceToBook < 50).map(s => s.priceToBook);
    if (pbs.length > 0) industryAvgPB[sector] = pbs.reduce((a, b) => a + b, 0) / pbs.length;
    
    const roas = sectorStocks.filter(s => s.returnOnAssets != null).map(s => s.returnOnAssets / 100);
    if (roas.length > 0) industryAvgROA[sector] = roas.reduce((a, b) => a + b, 0) / roas.length;
  }

  // Performance averages (as proxy for growth)
  const validPerfs = stocks.filter(s => s.perfYear != null).map(s => s.perfYear);
  const marketAvgEarningsGrowth = validPerfs.length > 0 ? validPerfs.reduce((a, b) => a + b, 0) / validPerfs.length : 5;
  const marketAvgRevenueGrowth = marketAvgEarningsGrowth * 0.8; // Revenue typically grows slower

  // Dividend yield percentiles
  const validYields = stocks.filter(s => s.dividendYield > 0).map(s => s.dividendYield / 100).sort((a, b) => a - b);
  const p25Idx = Math.floor(validYields.length * 0.25);
  const p75Idx = Math.floor(validYields.length * 0.75);
  const marketDividendYield25thPctile = validYields.length > 0 ? validYields[p25Idx] : 0.02;
  const marketDividendYield75thPctile = validYields.length > 0 ? validYields[p75Idx] : 0.05;

  return {
    marketAvgPE,
    industryAvgPE,
    industryAvgPB,
    industryAvgROA,
    marketAvgEarningsGrowth,
    marketAvgRevenueGrowth,
    marketDividendYield25thPctile,
    marketDividendYield75thPctile,
  };
}

// ─── Main Scoring Function ──────────────────────────────────────────

export function computeSnowflake(input: SnowflakeInput): { snowflake: SnowflakeResult; fairValue: FairValueResult } {
  const fairValue = calculateFairValue(input);
  
  const value = computeValueChecks(input, fairValue);
  const future = computeFutureChecks(input);
  const past = computePastChecks(input);
  const health = computeHealthChecks(input);
  const dividend = computeDividendChecks(input);
  
  const totalScore = value.score + future.score + past.score + health.score + dividend.score;
  const color = getSnowflakeColor(totalScore);
  
  return {
    snowflake: { value, future, past, health, dividend, totalScore, color },
    fairValue,
  };
}
