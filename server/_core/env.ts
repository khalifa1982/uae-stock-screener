export const ENV = {
  appId: process.env.VITE_APP_ID ?? "uae-stock-screener",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  // Standalone auth - no more Manus OAuth
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // Gemini API for LLM
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  // TwelveData API
  twelveDataApiKey: process.env.TWELVEDATA_API_KEY ?? "",
  // Legacy forge references (kept for compatibility, mapped to Gemini)
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? process.env.GEMINI_API_KEY ?? "",
};
