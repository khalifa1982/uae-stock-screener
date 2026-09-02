import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type GenerateContentConfig,
  type GenerateContentResponse,
  type Part,
} from "@google/genai";
import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?:
      | "audio/mpeg"
      | "audio/wav"
      | "audio/webm"
      | "application/pdf"
      | "audio/mp4"
      | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type GeminiThinkingLevel = "low" | "medium" | "high";

export type InvokeParams = {
  messages: Message[];
  model?: string;
  fallbackModels?: string[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  thinkingLevel?: GeminiThinkingLevel;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

/**
 * Current Google Gemini production model catalog used by this application.
 * Text generation stays on stable GA models; specialized model identifiers
 * are centralized here so future integrations do not scatter stale IDs.
 */
export const GEMINI_MODELS = Object.freeze({
  textPrimary: "gemini-3.8-flash",
  textFallbacks: ["gemini-3.7-flash", "gemini-3.6-flash"] as const,
  reasoningPreview: "gemini-3.1-pro-preview",
  image: "gemini-3.1-flash-image",
  imageLite: "gemini-3.1-flash-lite-image",
  transcription: "gemini-3.5-transcribe",
  textToSpeech: "gemini-3.1-flash-tts-preview",
  video: "gemini-omni-1.1-flash",
});

const ensureArray = (
  value: MessageContent | MessageContent[],
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const serializeContent = (content: Message["content"]): string =>
  ensureArray(content)
    .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
    .join("\n");

const inferImageMimeType = (url: string): string => {
  const pathname = url.split(/[?#]/, 1)[0].toLowerCase();
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
};

const toGeminiPart = (part: MessageContent): Part => {
  if (typeof part === "string") return { text: part };
  if (part.type === "text") return { text: part.text };
  if (part.type === "image_url") {
    return {
      fileData: {
        fileUri: part.image_url.url,
        mimeType: inferImageMimeType(part.image_url.url),
      },
    };
  }
  return {
    fileData: {
      fileUri: part.file_url.url,
      mimeType: part.file_url.mime_type,
    },
  };
};

const buildGeminiConversation = (messages: Message[]) => {
  const systemInstruction = messages
    .filter((message) => message.role === "system")
    .map((message) => serializeContent(message.content))
    .filter(Boolean)
    .join("\n\n");

  const contents: Content[] = [];

  for (const message of messages) {
    if (message.role === "system") continue;

    const role = message.role === "assistant" ? "model" : "user";
    const parts: Part[] =
      message.role === "tool" || message.role === "function"
        ? [
            {
              functionResponse: {
                id: message.tool_call_id,
                name: message.name ?? "tool",
                response: { output: serializeContent(message.content) },
              },
            },
          ]
        : ensureArray(message.content).map(toGeminiPart);

    const previous = contents.at(-1);
    if (previous?.role === role) {
      previous.parts = [...(previous.parts ?? []), ...parts];
    } else {
      contents.push({ role, parts });
    }
  }

  if (contents.length === 0) {
    contents.push({ role: "user", parts: [{ text: "" }] });
  }

  return { contents, systemInstruction };
};

const normalizeResponseFormat = (params: InvokeParams): ResponseFormat | undefined => {
  const explicit = params.responseFormat ?? params.response_format;
  if (explicit) {
    if (explicit.type === "json_schema" && !explicit.json_schema?.schema) {
      throw new Error("responseFormat json_schema requires a defined schema object");
    }
    return explicit;
  }

  const schema = params.outputSchema ?? params.output_schema;
  if (!schema) return undefined;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return { type: "json_schema", json_schema: schema };
};

const toThinkingLevel = (level: GeminiThinkingLevel): ThinkingLevel => {
  if (level === "low") return ThinkingLevel.LOW;
  if (level === "high") return ThinkingLevel.HIGH;
  return ThinkingLevel.MEDIUM;
};

const buildGenerateConfig = (params: InvokeParams): GenerateContentConfig => {
  const config: GenerateContentConfig = {
    maxOutputTokens: params.maxTokens ?? params.max_tokens ?? 32768,
  };

  if (params.thinkingLevel) {
    config.thinkingConfig = {
      thinkingLevel: toThinkingLevel(params.thinkingLevel),
    };
  }

  const { tools } = params;
  if (tools?.length) {
    config.tools = [
      {
        functionDeclarations: tools.map((tool) => ({
          name: tool.function.name,
          description: tool.function.description,
          parametersJsonSchema: tool.function.parameters,
        })),
      },
    ];

    const choice = params.toolChoice ?? params.tool_choice;
    if (choice) {
      let mode = FunctionCallingConfigMode.AUTO;
      let allowedFunctionNames: string[] | undefined;

      if (choice === "none") mode = FunctionCallingConfigMode.NONE;
      if (choice === "required") mode = FunctionCallingConfigMode.ANY;
      if (typeof choice === "object") {
        mode = FunctionCallingConfigMode.ANY;
        allowedFunctionNames = [
          "name" in choice ? choice.name : choice.function.name,
        ];
      }

      config.toolConfig = {
        functionCallingConfig: { mode, allowedFunctionNames },
      };
    }
  }

  const responseFormat = normalizeResponseFormat(params);
  if (responseFormat?.type === "json_object") {
    config.responseMimeType = "application/json";
  }
  if (responseFormat?.type === "json_schema") {
    config.responseMimeType = "application/json";
    config.responseJsonSchema = responseFormat.json_schema.schema;
  }

  return config;
};

const toInvokeResult = (
  response: GenerateContentResponse,
  requestedModel: string,
): InvokeResult => {
  const candidates = response.candidates ?? [];
  const choices = candidates.map((candidate, candidateIndex) => {
    const parts = candidate.content?.parts ?? [];
    const text = parts
      .filter((part) => !part.thought && typeof part.text === "string")
      .map((part) => part.text)
      .join("");
    const toolCalls = parts
      .map((part, partIndex) => {
        const call = part.functionCall;
        if (!call?.name) return undefined;
        return {
          id: call.id ?? `${call.name}-${candidateIndex}-${partIndex}`,
          type: "function" as const,
          function: {
            name: call.name,
            arguments: JSON.stringify(call.args ?? {}),
          },
        };
      })
      .filter((call): call is ToolCall => Boolean(call));

    return {
      index: candidate.index ?? candidateIndex,
      message: {
        role: "assistant" as const,
        content: text,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
      finish_reason: candidate.finishReason?.toLowerCase() ?? null,
    };
  });

  const usage = response.usageMetadata;
  return {
    id: response.responseId ?? `${requestedModel}-${Date.now()}`,
    created: response.createTime
      ? Math.floor(new Date(response.createTime).getTime() / 1000)
      : Math.floor(Date.now() / 1000),
    model: response.modelVersion ?? requestedModel,
    choices:
      choices.length > 0
        ? choices
        : [
            {
              index: 0,
              message: { role: "assistant", content: response.text ?? "" },
              finish_reason: null,
            },
          ],
    ...(usage
      ? {
          usage: {
            prompt_tokens: usage.promptTokenCount ?? 0,
            completion_tokens: usage.candidatesTokenCount ?? 0,
            total_tokens: usage.totalTokenCount ?? 0,
          },
        }
      : {}),
  };
};

const getErrorStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object" || !("status" in error)) {
    return undefined;
  }
  return typeof error.status === "number" ? error.status : undefined;
};

const isRetriableModelError = (error: unknown): boolean => {
  const status = getErrorStatus(error);
  return status === undefined || status === 404 || status === 429 || status >= 500;
};

let cachedClient: GoogleGenAI | undefined;
let cachedApiKey: string | undefined;

const getGeminiClient = (): GoogleGenAI => {
  const apiKey = ENV.geminiApiKey;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedClient = new GoogleGenAI({ apiKey });
    cachedApiKey = apiKey;
  }
  return cachedClient;
};

/**
 * Invoke Gemini through Google's official `@google/genai` SDK while returning
 * the established OpenAI-compatible result shape used by this application.
 * Stable fallback models are attempted for transient, rate-limit, and
 * model-availability failures.
 */
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const client = getGeminiClient();
  const { contents, systemInstruction } = buildGeminiConversation(params.messages);
  const config = buildGenerateConfig(params);
  if (systemInstruction) config.systemInstruction = systemInstruction;

  const models = params.model
    ? [params.model, ...(params.fallbackModels ?? [])]
    : [GEMINI_MODELS.textPrimary, ...GEMINI_MODELS.textFallbacks];

  let lastError: unknown;
  for (const [index, model] of models.entries()) {
    try {
      const response = await client.models.generateContent({
        model,
        contents,
        config,
      });
      return toInvokeResult(response, model);
    } catch (error) {
      lastError = error;
      const hasFallback = index < models.length - 1;
      if (!hasFallback || !isRetriableModelError(error)) throw error;
      console.warn(
        `[LLM] Model ${model} failed (${getErrorStatus(error) ?? "network"}); trying ${models[index + 1]}`,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini request failed without an error response");
}
