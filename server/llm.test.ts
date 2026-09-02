import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateContentMock, clientConstructorMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
  clientConstructorMock: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  FunctionCallingConfigMode: {
    AUTO: "AUTO",
    ANY: "ANY",
    NONE: "NONE",
  },
  ThinkingLevel: {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
  },
  GoogleGenAI: class GoogleGenAI {
    models = { generateContent: generateContentMock };

    constructor(options: unknown) {
      clientConstructorMock(options);
    }
  },
}));

vi.mock("./_core/env", () => ({
  ENV: { geminiApiKey: "test-gemini-key" },
}));

import { GEMINI_MODELS, invokeLLM } from "./_core/llm";

const successResponse = (modelVersion = "gemini-3.8-flash") => ({
  responseId: "response-123",
  createTime: "2026-09-02T12:00:00.000Z",
  modelVersion,
  candidates: [
    {
      index: 0,
      finishReason: "STOP",
      content: { role: "model", parts: [{ text: "Market analysis ready." }] },
    },
  ],
  usageMetadata: {
    promptTokenCount: 12,
    candidatesTokenCount: 5,
    totalTokenCount: 17,
  },
  text: "Market analysis ready.",
});

describe("Gemini SDK integration", () => {
  beforeEach(() => {
    generateContentMock.mockReset();
    clientConstructorMock.mockClear();
  });

  it("uses the current stable Gemini model catalog", () => {
    expect(GEMINI_MODELS.textPrimary).toBe("gemini-3.8-flash");
    expect(GEMINI_MODELS.textFallbacks).toEqual([
      "gemini-3.7-flash",
      "gemini-3.6-flash",
    ]);
    expect(GEMINI_MODELS.image).toBe("gemini-3.1-flash-image");
    expect(GEMINI_MODELS.transcription).toBe("gemini-3.5-transcribe");
  });

  it("sends requests through the official SDK and preserves result compatibility", async () => {
    generateContentMock.mockResolvedValueOnce(successResponse());

    const result = await invokeLLM({
      messages: [
        { role: "system", content: "Analyze UAE equities." },
        { role: "user", content: "Summarize EMAAR." },
      ],
      thinkingLevel: "medium",
      maxTokens: 2048,
    });

    expect(generateContentMock).toHaveBeenCalledWith({
      model: "gemini-3.8-flash",
      contents: [
        { role: "user", parts: [{ text: "Summarize EMAAR." }] },
      ],
      config: expect.objectContaining({
        systemInstruction: "Analyze UAE equities.",
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingLevel: "MEDIUM" },
      }),
    });
    expect(result.model).toBe("gemini-3.8-flash");
    expect(result.choices[0].message.content).toBe("Market analysis ready.");
    expect(result.usage).toEqual({
      prompt_tokens: 12,
      completion_tokens: 5,
      total_tokens: 17,
    });
  });

  it("maps strict JSON output and function declarations to SDK configuration", async () => {
    generateContentMock.mockResolvedValueOnce(successResponse());

    const schema = {
      type: "object",
      properties: { rating: { type: "string" } },
      required: ["rating"],
      additionalProperties: false,
    };

    await invokeLLM({
      messages: [{ role: "user", content: "Rate EMAAR." }],
      tools: [
        {
          type: "function",
          function: {
            name: "get_quote",
            description: "Fetch a UAE stock quote",
            parameters: {
              type: "object",
              properties: { symbol: { type: "string" } },
              required: ["symbol"],
            },
          },
        },
      ],
      toolChoice: { name: "get_quote" },
      responseFormat: {
        type: "json_schema",
        json_schema: { name: "stock_rating", strict: true, schema },
      },
    });

    const request = generateContentMock.mock.calls[0][0];
    expect(request.config).toEqual(
      expect.objectContaining({
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        tools: [
          {
            functionDeclarations: [
              expect.objectContaining({
                name: "get_quote",
                description: "Fetch a UAE stock quote",
              }),
            ],
          },
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: "ANY",
            allowedFunctionNames: ["get_quote"],
          },
        },
      }),
    );
  });

  it("falls back from Gemini 3.8 to 3.7 for a rate-limit error", async () => {
    generateContentMock
      .mockRejectedValueOnce(Object.assign(new Error("Rate limited"), { status: 429 }))
      .mockResolvedValueOnce(successResponse("gemini-3.7-flash"));

    const result = await invokeLLM({
      messages: [{ role: "user", content: "Analyze ADX." }],
    });

    expect(generateContentMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ model: "gemini-3.8-flash" }),
    );
    expect(generateContentMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ model: "gemini-3.7-flash" }),
    );
    expect(result.model).toBe("gemini-3.7-flash");
  });
});
