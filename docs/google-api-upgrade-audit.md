# Google API and Model Upgrade Audit

**Audit date:** 2026-09-02

Google's current Gemini API model catalog identifies `gemini-3.8-flash` as the newest stable Gemini text model. It is generally available for production and supersedes `gemini-3.7-flash` as the leading Flash model. Google documents a 1 million-token context window, a 64,000-token maximum output, and supported thinking levels of `low`, `medium`, and `high`.

The official migration guidance requires applications moving to `gemini-3.8-flash` to remove deprecated sampling parameters (`temperature`, `top_p`, and `top_k`), replace `thinking_budget` with `thinking_level`, remove `candidate_count`, and avoid prefilled model turns. The current UAE Stock Screener wrapper uses the OpenAI-compatible Chat Completions endpoint and does not send those deprecated sampling fields.

The official TypeScript/JavaScript SDK is `@google/genai`. The npm registry and Google's release history identify **2.20.0** as the latest stable release, published on 2026-08-31. The superseded `@google/generative-ai` package remains at 0.24.1 and should not be introduced. Version 2.20.0 adds Interactions API video-understanding support, `audio/webm` handling, and upload fixes. Google's SDK documentation confirms server-side initialization with `new GoogleGenAI({ apiKey })` and `ai.models.generateContent({ model, contents })`.

| Role | Recommended model ID | Stability |
| --- | --- | --- |
| Primary production model | `gemini-3.8-flash` | Stable / generally available |
| First fallback | `gemini-3.7-flash` | Stable |
| Second fallback | `gemini-3.6-flash` | Stable |
| High-reasoning optional model | `gemini-3.1-pro-preview` | Preview |

## Implemented configuration

The application now uses `@google/genai` 2.20.0 for server-side Gemini requests. The compatibility wrapper keeps the application's existing `invokeLLM` return contract while translating system instructions, multi-turn content, structured JSON schemas, function declarations, tool-selection modes, thinking levels, token limits, function calls, and usage metadata to and from the native Google SDK.

The production fallback chain is `gemini-3.8-flash` → `gemini-3.7-flash` → `gemini-3.6-flash`. Fallback is limited to model-unavailable, rate-limit, server, and network failures; malformed requests are surfaced immediately. Current specialized model identifiers are centralized in `GEMINI_MODELS` for image generation, lightweight image generation, transcription, text-to-speech, video, and optional Pro reasoning.

`@types/google.maps` was upgraded to 3.66.1. The latest Google SDK introduced a transitive `qs` 6.15.3 dependency with two moderate advisories, so the project now pins `qs` 6.16.0; the final production audit reports no known vulnerabilities.

## Validation

| Check | Result |
| --- | --- |
| Live Gemini API catalog | `gemini-3.8-flash`, `gemini-3.7-flash`, and `gemini-3.6-flash` available |
| Live SDK generation | `gemini-3.8-flash` returned `READY` successfully |
| New SDK/model unit tests | 4 passed |
| Auth regression test | 1 passed |
| TypeScript | Passed with zero errors |
| Production build | Passed |
| Runtime smoke check | HTTP 200; 170 stocks returned |
| Visual preview | Dashboard rendered and footer displayed `v17.2.0` |
| Production dependency audit | No known vulnerabilities |

The broader historical suite currently reports 509 passing and 18 failing tests. The failures are pre-existing network-dependent or stale UI-source assertions in StockAnalysis, Simply Wall St, TwelveData, and the earlier Phase 42 chart tests; none involve the Google SDK or modified LLM helper.

At deployment time, the public GitHub repository still showed commit `54d964a` (`v17.0.0`) as its latest commit. The configured GitHub command-line credential and the sandbox browser session were both expired/signed out, so the v17.2.0 source could not yet be pushed to the GitHub-triggered Northflank pipeline from this session. The Manus-hosted v17.2.0 checkpoint was published successfully.

## Sources

1. [Models — Gemini API](https://ai.google.dev/gemini-api/docs/models)
2. [What's new in Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/latest-model)
3. [Google Gen AI SDK for TypeScript and JavaScript](https://googleapis.github.io/js-genai/)
4. [Google Gen AI SDK releases](https://github.com/googleapis/js-genai/releases)
