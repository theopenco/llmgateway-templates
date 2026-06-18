import { beforeEach, describe, expect, it, vi } from "vitest";

const answer = vi.fn();
const toAiMessages = vi.fn();
const setSuggestedPrompts = vi.fn();
const createSlackAdapter = vi.fn(() => ({ name: "slack-adapter" }));

interface FakeThread {
  adapter: { fetchMessages: ReturnType<typeof vi.fn> };
  id: string;
  post: ReturnType<typeof vi.fn>;
  startTyping: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
}

interface FakeMessage {
  text: string;
}

interface AssistantEvent {
  channelId: string;
  threadTs: string;
}

type MessageHandler = (
  thread: FakeThread,
  message: FakeMessage,
) => Promise<void>;
type AssistantHandler = (event: AssistantEvent) => Promise<void>;

let mentionHandler: MessageHandler;
let dmHandler: MessageHandler;
let subscribedHandler: MessageHandler;
let assistantHandler: AssistantHandler;

vi.mock("@chat-adapter/slack", () => ({
  createSlackAdapter,
}));

vi.mock("../src/lib/ai.js", () => ({
  answer,
}));

vi.mock("../src/lib/state.js", () => ({
  state: { mocked: true },
}));

vi.mock("chat", () => ({
  Chat: function MockChat(this: {
    getAdapter: () => { setSuggestedPrompts: ReturnType<typeof vi.fn> };
    onAssistantThreadStarted: (handler: AssistantHandler) => void;
    onDirectMessage: (handler: MessageHandler) => void;
    onNewMention: (handler: MessageHandler) => void;
    onSubscribedMessage: (handler: MessageHandler) => void;
    webhooks: Record<string, unknown>;
  }) {
    this.webhooks = {};
    this.getAdapter = () => ({ setSuggestedPrompts });
    this.onNewMention = (handler) => {
      mentionHandler = handler;
    };
    this.onDirectMessage = (handler) => {
      dmHandler = handler;
    };
    this.onSubscribedMessage = (handler) => {
      subscribedHandler = handler;
    };
    this.onAssistantThreadStarted = (handler) => {
      assistantHandler = handler;
    };
  },
  toAiMessages,
}));

const STREAM = { stream: true };
const HISTORY = [{ content: "hi", role: "user" }];

const createThread = (): FakeThread => ({
  adapter: {
    fetchMessages: vi.fn(() => Promise.resolve({ messages: ["raw-message"] })),
  },
  id: "t1",
  post: vi.fn(),
  startTyping: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
});

describe("bot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => {});
    answer.mockResolvedValue(STREAM);
    toAiMessages.mockResolvedValue(HISTORY);
  });

  it("subscribes and streams an answer on a channel mention", async () => {
    await import("../src/bot.js");
    const thread = createThread();

    await mentionHandler(thread, { text: "hello" });

    expect(thread.subscribe).toHaveBeenCalledTimes(1);
    expect(thread.startTyping).toHaveBeenCalledTimes(1);
    expect(thread.adapter.fetchMessages).toHaveBeenCalledWith("t1", {
      limit: 30,
    });
    expect(toAiMessages).toHaveBeenCalledWith(["raw-message"], {
      includeNames: true,
    });
    expect(answer).toHaveBeenCalledWith(HISTORY);
    expect(thread.post).toHaveBeenCalledWith(STREAM);
  });

  it("subscribes and answers a direct message", async () => {
    await import("../src/bot.js");
    const thread = createThread();

    await dmHandler(thread, { text: "hi there" });

    expect(thread.subscribe).toHaveBeenCalledTimes(1);
    expect(answer).toHaveBeenCalledWith(HISTORY);
    expect(thread.post).toHaveBeenCalledWith(STREAM);
  });

  it("answers follow-up messages in a subscribed thread", async () => {
    await import("../src/bot.js");
    const thread = createThread();

    await subscribedHandler(thread, { text: "and another thing" });

    expect(thread.unsubscribe).not.toHaveBeenCalled();
    expect(answer).toHaveBeenCalledWith(HISTORY);
    expect(thread.post).toHaveBeenCalledWith(STREAM);
  });

  it("unsubscribes and stops answering when told to stop", async () => {
    await import("../src/bot.js");
    const thread = createThread();

    await subscribedHandler(thread, { text: "  STOP " });

    expect(thread.unsubscribe).toHaveBeenCalledTimes(1);
    expect(answer).not.toHaveBeenCalled();
    expect(thread.post).toHaveBeenCalledWith(
      expect.stringContaining("stop following"),
    );
  });

  it("falls back to the latest message when history is empty", async () => {
    toAiMessages.mockResolvedValueOnce([]);
    await import("../src/bot.js");
    const thread = createThread();

    await mentionHandler(thread, { text: "fallback question" });

    expect(answer).toHaveBeenCalledWith("fallback question");
  });

  it("falls back to the latest message when the history fetch fails", async () => {
    await import("../src/bot.js");
    const thread = createThread();
    thread.adapter.fetchMessages.mockRejectedValueOnce(new Error("boom"));

    await mentionHandler(thread, { text: "still works" });

    expect(answer).toHaveBeenCalledWith("still works");
  });

  it("posts a friendly error when answering fails", async () => {
    await import("../src/bot.js");
    const thread = createThread();
    answer.mockRejectedValueOnce(new Error("model down"));

    await mentionHandler(thread, { text: "oops" });

    expect(thread.post).toHaveBeenCalledWith(
      expect.stringContaining("ran into an error"),
    );
  });

  it("sets suggested prompts when an assistant thread starts", async () => {
    await import("../src/bot.js");

    await assistantHandler({ channelId: "C1", threadTs: "123.456" });

    expect(setSuggestedPrompts).toHaveBeenCalledWith("C1", "123.456", [
      { message: "What can you help me with?", title: "Ask a question" },
      {
        message: "Explain how OAuth 2.0 works in simple terms.",
        title: "Explain a concept",
      },
      {
        message: "Help me draft a status update for my team.",
        title: "Draft a message",
      },
    ]);
  });
});
