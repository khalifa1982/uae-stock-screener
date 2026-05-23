/**
 * SAFinancialsView — Comprehensive financial statements from StockAnalysis.com
 * Displays Income Statement, Balance Sheet, Cash Flow, and Ratios in multi-year tables.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, BarChart3, DollarSign, PieChart, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";

// ─── Formatters ────────────────────────────────────────────────────

function fmtLarge(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return "—";
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  if (abs >= 1e12) return sign + (abs / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + "K";
  return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtPct(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "—";
  return (val * 100).toFixed(2) + "%";
}

function fmtNum(val: number | null | undefined, dec = 2): string {
  if (val == null || isNaN(val)) return "—";
  return val.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtRatioPct(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "—";
  // Ratios page returns values like 0.1234 for 12.34%
  return (val * 100).toFixed(2) + "%";
}

function fmtRatioX(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "—";
  return val.toFixed(2) + "x";
}

// ─── Field Definitions ────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  format: "large" | "pct" | "num" | "ratioPct" | "ratioX" | "num0" | "num3";
  highlight?: boolean;
  indent?: boolean;
  separator?: boolean; // Add a visual separator before this row
}

const INCOME_FIELDS: FieldDef[] = [
  { key: "revenue", label: "Revenue", format: "large", highlight: true },
  { key: "revenueGrowth", label: "Revenue Growth", format: "pct" },
  { key: "cor", label: "Cost of Revenue", format: "large", indent: true },
  { key: "gp", label: "Gross Profit", format: "large", highlight: true },
  { key: "grossMargin", label: "Gross Margin", format: "pct" },
  { key: "sgna", label: "SG&A Expenses", format: "large", indent: true, separator: true },
  { key: "otheropex", label: "Other Operating Expenses", format: "large", indent: true },
  { key: "opex", label: "Total Operating Expenses", format: "large" },
  { key: "opinc", label: "Operating Income", format: "large", highlight: true },
  { key: "operatingMargin", label: "Operating Margin", format: "pct" },
  { key: "interestExpense", label: "Interest Expense", format: "large", indent: true, separator: true },
  { key: "interestIncome", label: "Interest Income", format: "large", indent: true },
  { key: "incomeEquity", label: "Income from Equity Investments", format: "large", indent: true },
  { key: "otherNonOperating", label: "Other Non-Operating Income", format: "large", indent: true },
  { key: "ebtExcl", label: "EBT (excl. unusual items)", format: "large" },
  { key: "pretax", label: "Pre-Tax Income", format: "large", highlight: true, separator: true },
  { key: "taxexp", label: "Income Tax Expense", format: "large", indent: true },
  { key: "taxrate", label: "Effective Tax Rate", format: "pct" },
  { key: "minorityInterest", label: "Minority Interest", format: "large", indent: true },
  { key: "netinc", label: "Net Income", format: "large", highlight: true, separator: true },
  { key: "netinccmn", label: "Net Income (Common)", format: "large" },
  { key: "netIncomeGrowth", label: "Net Income Growth", format: "pct" },
  { key: "profitMargin", label: "Profit Margin", format: "pct" },
  { key: "ebit", label: "EBIT", format: "large", separator: true },
  { key: "ebitMargin", label: "EBIT Margin", format: "pct" },
  { key: "ebitda", label: "EBITDA", format: "large", highlight: true },
  { key: "ebitdaMargin", label: "EBITDA Margin", format: "pct" },
  { key: "epsBasic", label: "EPS (Basic)", format: "num3", separator: true },
  { key: "epsdil", label: "EPS (Diluted)", format: "num3" },
  { key: "epsGrowth", label: "EPS Growth", format: "pct" },
  { key: "sharesBasic", label: "Shares Outstanding (Basic)", format: "large" },
  { key: "sharesDiluted", label: "Shares Outstanding (Diluted)", format: "large" },
  { key: "sharesYoY", label: "Shares Change YoY", format: "pct" },
  { key: "fcf", label: "Free Cash Flow", format: "large", separator: true },
  { key: "fcfMargin", label: "FCF Margin", format: "pct" },
  { key: "fcfps", label: "FCF Per Share", format: "num3" },
  { key: "dps", label: "Dividends Per Share", format: "num3" },
  { key: "payoutratio", label: "Payout Ratio", format: "pct" },
  { key: "dividendGrowth", label: "Dividend Growth", format: "pct" },
];

const BALANCE_SHEET_FIELDS: FieldDef[] = [
  // Current Assets
  { key: "cashneq", label: "Cash & Equivalents", format: "large", highlight: true },
  { key: "totalcash", label: "Total Cash", format: "large" },
  { key: "investmentsc", label: "Short-Term Investments", format: "large", indent: true },
  { key: "accountsReceivable", label: "Accounts Receivable", format: "large", indent: true },
  { key: "receivables", label: "Total Receivables", format: "large" },
  { key: "inventory", label: "Inventory", format: "large", indent: true },
  { key: "prepaidExpenses", label: "Prepaid Expenses", format: "large", indent: true },
  { key: "othercurrent", label: "Other Current Assets", format: "large", indent: true },
  { key: "assetsc", label: "Total Current Assets", format: "large", highlight: true },
  // Non-Current Assets
  { key: "netPPE", label: "Net PP&E", format: "large", separator: true },
  { key: "goodwill", label: "Goodwill", format: "large", indent: true },
  { key: "otherIntangibles", label: "Other Intangibles", format: "large", indent: true },
  { key: "investmentsnc", label: "Long-Term Investments", format: "large", indent: true },
  { key: "othernoncurrent", label: "Other Non-Current Assets", format: "large", indent: true },
  { key: "assets", label: "Total Assets", format: "large", highlight: true },
  // Current Liabilities
  { key: "accountsPayable", label: "Accounts Payable", format: "large", indent: true, separator: true },
  { key: "currentPortDebt", label: "Current Portion of Debt", format: "large", indent: true },
  { key: "accruedExpenses", label: "Accrued Expenses", format: "large", indent: true },
  { key: "otherCurrentLiabilities", label: "Other Current Liabilities", format: "large", indent: true },
  { key: "currentLiabilities", label: "Total Current Liabilities", format: "large", highlight: true },
  // Non-Current Liabilities
  { key: "debtnc", label: "Long-Term Debt", format: "large", indent: true, separator: true },
  { key: "capitalLeases", label: "Capital Leases", format: "large", indent: true },
  { key: "otherliabilitiesnoncurrent", label: "Other Non-Current Liabilities", format: "large", indent: true },
  { key: "liabilities", label: "Total Liabilities", format: "large", highlight: true },
  // Equity
  { key: "commonStock", label: "Common Stock", format: "large", indent: true, separator: true },
  { key: "additionalPaidInCapital", label: "Additional Paid-In Capital", format: "large", indent: true },
  { key: "retearn", label: "Retained Earnings", format: "large", indent: true },
  { key: "otherEquity", label: "Other Equity", format: "large", indent: true },
  { key: "totalCommonEquity", label: "Total Common Equity", format: "large" },
  { key: "minorityInterestBS", label: "Minority Interest", format: "large", indent: true },
  { key: "equity", label: "Total Equity", format: "large", highlight: true },
  { key: "liabilitiesequity", label: "Total Liabilities & Equity", format: "large" },
  // Per Share & Ratios
  { key: "debt", label: "Total Debt", format: "large", separator: true },
  { key: "netcash", label: "Net Cash / Debt", format: "large" },
  { key: "netcashpershare", label: "Net Cash Per Share", format: "num3" },
  { key: "bvps", label: "Book Value Per Share", format: "num3" },
  { key: "tangibleBookValue", label: "Tangible Book Value", format: "large" },
  { key: "tangibleBookValuePerShare", label: "Tangible BV Per Share", format: "num3" },
  { key: "workingcapital", label: "Working Capital", format: "large" },
  { key: "cashGrowth", label: "Cash Growth", format: "pct" },
];

const CASH_FLOW_FIELDS: FieldDef[] = [
  // Operating
  { key: "netIncomeCF", label: "Net Income", format: "large", highlight: true },
  { key: "totalDepAmorCF", label: "Depreciation & Amortization", format: "large", indent: true },
  { key: "changeWorkingCapital", label: "Change in Working Capital", format: "large", indent: true },
  { key: "changeAR", label: "Change in Accounts Receivable", format: "large", indent: true },
  { key: "changeAP", label: "Change in Accounts Payable", format: "large", indent: true },
  { key: "otheroperating", label: "Other Operating Activities", format: "large", indent: true },
  { key: "ncfo", label: "Cash from Operations", format: "large", highlight: true },
  { key: "ocfGrowth", label: "Operating CF Growth", format: "pct" },
  // Investing
  { key: "capex", label: "Capital Expenditures", format: "large", separator: true },
  { key: "investInSecurities", label: "Investment in Securities", format: "large", indent: true },
  { key: "cashAcquisition", label: "Acquisitions", format: "large", indent: true },
  { key: "divestitures", label: "Divestitures", format: "large", indent: true },
  { key: "otherinvesting", label: "Other Investing Activities", format: "large", indent: true },
  { key: "ncfi", label: "Cash from Investing", format: "large", highlight: true },
  // Financing
  { key: "debtIssuedLongTerm", label: "Debt Issued (Long-Term)", format: "large", indent: true, separator: true },
  { key: "debtRepaidLongTerm", label: "Debt Repaid (Long-Term)", format: "large", indent: true },
  { key: "netDebtIssued", label: "Net Debt Issued", format: "large" },
  { key: "commonDividendCF", label: "Dividends Paid", format: "large", indent: true },
  { key: "otherfinancing", label: "Other Financing Activities", format: "large", indent: true },
  { key: "ncff", label: "Cash from Financing", format: "large", highlight: true },
  // Net Change
  { key: "ncf", label: "Net Change in Cash", format: "large", highlight: true, separator: true },
  { key: "fcf", label: "Free Cash Flow", format: "large", highlight: true },
  { key: "fcfGrowth", label: "FCF Growth", format: "pct" },
  { key: "fcfMargin", label: "FCF Margin", format: "pct" },
  { key: "fcfps", label: "FCF Per Share", format: "num3" },
  { key: "leveredFCF", label: "Levered FCF", format: "large" },
  { key: "unleveredFCF", label: "Unlevered FCF", format: "large" },
  { key: "cashInterestPaid", label: "Cash Interest Paid", format: "large", separator: true },
  { key: "cashTaxesPaid", label: "Cash Taxes Paid", format: "large" },
];

const RATIOS_FIELDS: FieldDef[] = [
  // Valuation
  { key: "marketcap", label: "Market Cap", format: "large", highlight: true },
  { key: "marketCapGrowth", label: "Market Cap Growth", format: "pct" },
  { key: "ev", label: "Enterprise Value", format: "large" },
  { key: "pe", label: "P/E Ratio", format: "num" },
  { key: "peForward", label: "Forward P/E", format: "num" },
  { key: "pegRatio", label: "PEG Ratio", format: "num" },
  { key: "ps", label: "Price/Sales", format: "num" },
  { key: "pb", label: "Price/Book", format: "num" },
  { key: "ptbvRatio", label: "Price/Tangible Book", format: "num" },
  { key: "pfcf", label: "Price/FCF", format: "num" },
  { key: "pocf", label: "Price/Operating CF", format: "num" },
  { key: "evebitda", label: "EV/EBITDA", format: "num", separator: true },
  { key: "evebit", label: "EV/EBIT", format: "num" },
  { key: "evrevenue", label: "EV/Revenue", format: "num" },
  { key: "evfcf", label: "EV/FCF", format: "num" },
  // Yield
  { key: "earningsyield", label: "Earnings Yield", format: "ratioPct", separator: true },
  { key: "fcfyield", label: "FCF Yield", format: "ratioPct" },
  { key: "dividendyield", label: "Dividend Yield", format: "ratioPct" },
  { key: "payoutratio", label: "Payout Ratio", format: "ratioPct" },
  { key: "buybackyield", label: "Buyback Yield", format: "ratioPct" },
  { key: "totalreturn", label: "Total Shareholder Return", format: "ratioPct" },
  // Returns
  { key: "roe", label: "Return on Equity (ROE)", format: "ratioPct", highlight: true, separator: true },
  { key: "roa", label: "Return on Assets (ROA)", format: "ratioPct" },
  { key: "roic", label: "Return on Invested Capital", format: "ratioPct" },
  { key: "roce", label: "Return on Capital Employed", format: "ratioPct" },
  // Efficiency
  { key: "assetturnover", label: "Asset Turnover", format: "ratioX", separator: true },
  { key: "inventoryTurnover", label: "Inventory Turnover", format: "ratioX" },
  // Liquidity
  { key: "currentratio", label: "Current Ratio", format: "ratioX", separator: true },
  { key: "quickRatio", label: "Quick Ratio", format: "ratioX" },
  // Leverage
  { key: "debtequity", label: "Debt/Equity", format: "num", separator: true },
  { key: "debtebitda", label: "Debt/EBITDA", format: "num" },
  { key: "debtfcf", label: "Debt/FCF", format: "num" },
  { key: "netdebtequity", label: "Net Debt/Equity", format: "num" },
  { key: "netdebtebitda", label: "Net Debt/EBITDA", format: "num" },
  { key: "netdebtfcf", label: "Net Debt/FCF", format: "num" },
];

// ─── Sub-Components ────────────────────────────────────────────────

function formatValue(val: number | null | undefined, format: FieldDef["format"]): string {
  switch (format) {
    case "large": return fmtLarge(val);
    case "pct": return fmtPct(val);
    case "num": return fmtNum(val, 2);
    case "num0": return fmtNum(val, 0);
    case "num3": return fmtNum(val, 3);
    case "ratioPct": return fmtRatioPct(val);
    case "ratioX": return fmtRatioX(val);
    default: return fmtNum(val);
  }
}

function getChangeColor(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "";
  return val > 0 ? "text-gain" : val < 0 ? "text-loss" : "";
}

function FinancialStatementTable({
  title,
  icon: Icon,
  fields,
  data,
  periods,
}: {
  title: string;
  icon: React.ElementType;
  fields: FieldDef[];
  data: Record<string, (number | null)[]>;
  periods: string[];
}) {
  const [expanded, setExpanded] = useState(true);

  // Filter fields that have at least some data
  const availableFields = useMemo(() => {
    return fields.filter(f => {
      const values = data[f.key];
      if (!values) return true; // Show as MT
      return values.some(v => v != null);
    });
  }, [fields, data]);

  // Limit periods to most recent 6
  const displayPeriods = periods.slice(0, 6);
  const periodCount = displayPeriods.length;

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader
        className="pb-2 cursor-pointer hover:bg-muted/10 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
          <Badge variant="outline" className="text-[9px] ml-2 font-normal">StockAnalysis.com</Badge>
          <span className="ml-auto text-muted-foreground">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-left p-2 pl-4 font-medium text-muted-foreground sticky left-0 bg-muted/20 z-10 min-w-[200px]">
                    Metric
                  </th>
                  {displayPeriods.map((p, i) => (
                    <th key={i} className="text-right p-2 pr-3 font-medium text-muted-foreground whitespace-nowrap min-w-[100px]">
                      {p === "TTM" ? (
                        <Badge variant="secondary" className="text-[9px]">TTM</Badge>
                      ) : (
                        p
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {availableFields.map((field, idx) => {
                  const values = data[field.key] || [];
                  const isGrowthField = field.key.toLowerCase().includes("growth") ||
                    field.key.toLowerCase().includes("margin") ||
                    field.format === "pct" || field.format === "ratioPct";

                  return (
                    <tr
                      key={field.key}
                      className={`
                        border-b border-border/10 hover:bg-muted/10 transition-colors
                        ${field.highlight ? "bg-primary/[0.03]" : ""}
                        ${field.separator ? "border-t border-border/30" : ""}
                      `}
                    >
                      <td className={`p-2 ${field.indent ? "pl-8" : "pl-4"} sticky left-0 bg-card z-10 whitespace-nowrap ${field.highlight ? "font-semibold text-foreground bg-primary/[0.03]" : "text-muted-foreground"}`}>
                        {field.label}
                      </td>
                      {displayPeriods.map((_, i) => {
                        const val = values[i];
                        const colorClass = isGrowthField ? getChangeColor(val) : "";
                        return (
                          <td
                            key={i}
                            className={`p-2 pr-3 text-right font-mono whitespace-nowrap ${field.highlight ? "font-semibold" : ""} ${colorClass}`}
                          >
                            {formatValue(val, field.format)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-[10px] text-muted-foreground border-t border-border/20">
            {Object.keys(data).length} fields &middot; {periodCount} periods &middot; Values in AED
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export function SAFinancialsView({
  symbol,
  exchange,
}: {
  symbol: string;
  exchange: "ADX" | "DFM";
}) {
  const [subTab, setSubTab] = useState("income");

  const { data, isLoading, error } = trpc.sa.financials.useQuery(
    { symbol, exchange },
    { staleTime: 900_000, gcTime: 3600_000, refetchOnWindowFocus: false, enabled: !!symbol }
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 " />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            Financial statements are not available for this stock.
          </p>
          {error && (
            <p className="text-xs text-muted-foreground mt-2">Error: {error.message}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  const hasIncome = Object.keys(data.incomeStatement || {}).length > 0;
  const hasBS = Object.keys(data.balanceSheet || {}).length > 0;
  const hasCF = Object.keys(data.cashFlow || {}).length > 0;
  const hasRatios = Object.keys(data.ratios || {}).length > 0;

  const totalFields = (hasIncome ? Object.keys(data.incomeStatement).length : 0) +
    (hasBS ? Object.keys(data.balanceSheet).length : 0) +
    (hasCF ? Object.keys(data.cashFlow).length : 0) +
    (hasRatios ? Object.keys(data.ratios).length : 0);

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Financial Statements</h3>
          <Badge variant="outline" className="text-[9px]">{totalFields} fields</Badge>
        </div>
      </div>

      {/* Sub-tabs for statement type */}
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="bg-muted/30 h-8">
          <TabsTrigger value="income" className="text-xs h-7 gap-1" disabled={!hasIncome}>
            <DollarSign className="h-3 w-3" /> Income
          </TabsTrigger>
          <TabsTrigger value="balance" className="text-xs h-7 gap-1" disabled={!hasBS}>
            <BarChart3 className="h-3 w-3" /> Balance Sheet
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="text-xs h-7 gap-1" disabled={!hasCF}>
            <TrendingUp className="h-3 w-3" /> Cash Flow
          </TabsTrigger>
          <TabsTrigger value="ratios" className="text-xs h-7 gap-1" disabled={!hasRatios}>
            <PieChart className="h-3 w-3" /> Ratios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="mt-4">
          {hasIncome && (
            <FinancialStatementTable
              title="Income Statement (Annual)"
              icon={DollarSign}
              fields={INCOME_FIELDS}
              data={data.incomeStatement}
              periods={data.periods.incomeStatement}
            />
          )}
        </TabsContent>

        <TabsContent value="balance" className="mt-4">
          {hasBS && (
            <FinancialStatementTable
              title="Balance Sheet (Annual)"
              icon={BarChart3}
              fields={BALANCE_SHEET_FIELDS}
              data={data.balanceSheet}
              periods={data.periods.balanceSheet}
            />
          )}
        </TabsContent>

        <TabsContent value="cashflow" className="mt-4">
          {hasCF && (
            <FinancialStatementTable
              title="Cash Flow Statement (Annual)"
              icon={TrendingUp}
              fields={CASH_FLOW_FIELDS}
              data={data.cashFlow}
              periods={data.periods.cashFlow}
            />
          )}
        </TabsContent>

        <TabsContent value="ratios" className="mt-4">
          {hasRatios && (
            <FinancialStatementTable
              title="Financial Ratios (Annual)"
              icon={PieChart}
              fields={RATIOS_FIELDS}
              data={data.ratios}
              periods={data.periods.ratios}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
