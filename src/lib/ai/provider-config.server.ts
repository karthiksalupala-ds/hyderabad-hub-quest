/**
 * Server-side provider selection for the assistant and optional ingestion extraction.
 * OpenRouter wins when both keys are configured, making migration explicit and safe.
 */
export interface AiProviderConfig {
  provider: "openrouter" | "openai";
  apiKey: string;
  baseUrl: string;
  model: string;
}

type Environment = Readonly<Record<string, string | undefined>>;

function baseUrl(value: string | undefined, fallback: string): string {
  return (value?.trim() || fallback).replace(/\\/+$/, "");
}

export function getAiProviderConfig(env: Environment = process.env): AiProviderConfig | null {
  const openRouterKey = env["OPENROUTER_API_KEY"]?.trim();
  if (openRouterKey) {
    return {
      provider: "openrouter",
      apiKey: openRouterKey,
      baseUrl: baseUrl(env["OPENROUTER_BASE_URL"], "https://openrouter.ai/api/v1"),
      model: env["OPENROUTER_MODEL"]?.trim() || "openrouter/free",
    };
  }

  const openAiKey = env["OPENAI_API_KEY"]?.trim();
  if (openAiKey) {
    return {
      provider: "openai",
      apiKey: openAiKey,
      baseUrl: baseUrl(env["OPENAI_BASE_URL"], "https://api.openai.com/v1"),
      model: env["OPENAI_MODEL"]?.trim() || "gpt-4.1-mini",
    };
  }

  return null;
}
