import { beforeEach, describe, expect, it, vi } from "vitest";

const fullStream = { fullStream: true };
const modelInstance = { id: "model-instance" };
const provider = vi.fn(() => modelInstance);
const createLLMGateway = vi.fn(() => provider);
const streamFn = vi.fn();
const agentConstructor = vi.fn();

vi.mock("@llmgateway/ai-sdk-provider", () => ({
  createLLMGateway,
}));

vi.mock("ai", () => ({
  ToolLoopAgent: class {
    stream = streamFn;

    constructor(settings: unknown) {
      agentConstructor(settings);
    }
  },
}));

describe("ai", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    streamFn.mockResolvedValue({ fullStream });
    delete process.env.AI_MODEL;
    delete process.env.WEB_SEARCH;
  });

  it("configures the agent with the default model and web search enabled", async () => {
    const mod = await import("../src/lib/ai.js");

    expect(createLLMGateway).toHaveBeenCalledTimes(1);
    expect(provider).toHaveBeenCalledWith("anthropic/claude-sonnet-4-6", {
      extraBody: { web_search: true },
    });
    expect(mod.model).toBe("anthropic/claude-sonnet-4-6");
    expect(agentConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ model: modelInstance }),
    );
  });

  it("honors the AI_MODEL override", async () => {
    process.env.AI_MODEL = "openai/gpt-4o";

    const mod = await import("../src/lib/ai.js");

    expect(provider).toHaveBeenCalledWith("openai/gpt-4o", {
      extraBody: { web_search: true },
    });
    expect(mod.model).toBe("openai/gpt-4o");
  });

  it("disables web search when WEB_SEARCH=false", async () => {
    process.env.WEB_SEARCH = "false";

    await import("../src/lib/ai.js");

    expect(provider).toHaveBeenCalledWith("anthropic/claude-sonnet-4-6", {});
  });

  it("streams an answer and returns the full stream", async () => {
    const { answer } = await import("../src/lib/ai.js");

    const result = await answer("What is Chat SDK?");

    expect(streamFn).toHaveBeenCalledWith({ prompt: "What is Chat SDK?" });
    expect(result).toBe(fullStream);
  });

  it("accepts a conversation history as the prompt", async () => {
    const { answer } = await import("../src/lib/ai.js");
    const history = [{ content: "hi", role: "user" as const }];

    await answer(history);

    expect(streamFn).toHaveBeenCalledWith({ prompt: history });
  });
});
