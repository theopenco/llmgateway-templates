import { createSlackAdapter } from "@chat-adapter/slack";
import type { AiMessage, Message, Thread } from "chat";
import { Chat, toAiMessages } from "chat";

import { answer } from "./lib/ai.js";
import { state } from "./lib/state.js";

/** How many recent thread messages to feed the model as context. */
const HISTORY_LIMIT = 30;

/** Matches a standalone "stop" / "unsubscribe" so the bot can leave a thread. */
const UNSUBSCRIBE_PATTERN = /^\s*(stop|unsubscribe)\s*$/i;

const ERROR_MESSAGE =
  "Sorry, I ran into an error answering that. Please try again in a moment.";

export const bot = new Chat({
  adapters: {
    slack: createSlackAdapter(),
  },
  state,
  userName: "qa-bot",
});

/**
 * Build the model prompt from thread history when available, falling back to
 * the latest message text if the history fetch fails or is empty.
 */
const buildPrompt = async (
  thread: Thread,
  message: Message,
): Promise<string | AiMessage[]> => {
  try {
    const { messages } = await thread.adapter.fetchMessages(thread.id, {
      limit: HISTORY_LIMIT,
    });
    const history = await toAiMessages(messages, { includeNames: true });
    if (history.length > 0) {
      return history;
    }
  } catch (error) {
    console.error(
      "Failed to fetch thread history; using latest message",
      error,
    );
  }

  return message.text;
};

/** Stream an AI answer back to the thread, with graceful error handling. */
const respond = async (thread: Thread, message: Message) => {
  await thread.startTyping();

  try {
    const prompt = await buildPrompt(thread, message);
    await thread.post(await answer(prompt));
  } catch (error) {
    console.error("Failed to answer message", error);
    await thread.post(ERROR_MESSAGE);
  }
};

// Channel mention: start watching the thread, then answer.
bot.onNewMention(async (thread, message) => {
  await thread.subscribe();
  await respond(thread, message);
});

// Direct message: DMs are implicit mentions, so answer and keep listening.
bot.onDirectMessage(async (thread, message) => {
  await thread.subscribe();
  await respond(thread, message);
});

// Follow-up messages in a thread we already joined.
bot.onSubscribedMessage(async (thread, message) => {
  if (UNSUBSCRIBE_PATTERN.test(message.text)) {
    await thread.unsubscribe();
    await thread.post(
      "Got it — I'll stop following this thread. Mention me anytime.",
    );
    return;
  }

  await respond(thread, message);
});

// Slack assistant pane: offer a few starter prompts.
bot.onAssistantThreadStarted(async (event) => {
  const slack = bot.getAdapter("slack");

  await slack.setSuggestedPrompts(event.channelId, event.threadTs, [
    {
      message: "What can you help me with?",
      title: "Ask a question",
    },
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
