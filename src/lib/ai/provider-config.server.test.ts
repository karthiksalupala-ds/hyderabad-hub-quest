import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getAiProviderConfig } from "./provider-config.server";

describe("AI provider configuration", () => {
  it("uses OpenRouter with the free router by default", () => {
    assert.deepEqual(getAiProviderConfig({ OPENROUTER_API_KEY: "  sk-or-test  " }), {
      provider: "openrouter",
      apiKey: "sk-or-test",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "openrouter/free",
    });
  });

  it("prefers OpenRouter when both provider keys are configured", () => {
    const config = getAiProviderConfig({
      OPENROUTER_API_KEY: "router-key",
      OPENAI_API_KEY: "openai-key",
    });
    assert.equal(config?.provider, "openrouter");
    assert.equal(config?.apiKey, "router-key");
  });

  it("allows explicit OpenRouter base URL and model overrides", () => {
    const config = getAiProviderConfig({
      OPENROUTER_API_KEY: "router-key",
      OPENROUTER_BASE_URL: "https://custom.example/v1///",
      OPENROUTER_MODEL: "provider/model:free",
    });
    assert.equal(config?.baseUrl, "https://custom.example/v1");
    assert.equal(config?.model, "provider/model:free");
  });

  it("preserves the existing OpenAI configuration as a fallback", () => {
    assert.deepEqual(getAiProviderConfig({
      OPENAI_API_KEY: "openai-key",
      OPENAI_BASE_URL: "https://api.openai.com/v1/",
      OPENAI_MODEL: "gpt-4.1-mini",
    }), {
      provider: "openai",
      apiKey: "openai-key",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4.1-mini",
    });
  });

  it("returns no configuration when neither provider has a key", () => {
    assert.equal(getAiProviderConfig({ OPENROUTER_API_KEY: " ", OPENAI_API_KEY: "" }), null);
  });
});
