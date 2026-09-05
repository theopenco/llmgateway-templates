"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, KeyRound, Send, Trash2, User } from "lucide-react";
import { useApiKey } from "@/components/api-key-provider";
import { ModelPicker } from "@/components/model-picker";
import { PoweredBy } from "@/components/powered-by";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Model } from "@/lib/models";

export function Chat({
  models,
  defaultModel,
}: {
  models: Model[];
  defaultModel: string;
}) {
  const [model, setModel] = useState(defaultModel);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { apiKey, setOpen: setApiKeyOpen } = useApiKey();

  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const isLoading = status === "submitted" || status === "streaming";
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || isLoading) return;
    void sendMessage(
      { text: input },
      {
        body: { model },
        headers: apiKey ? { "x-api-key": apiKey } : undefined,
      },
    );
    setInput("");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="text-lg font-semibold">AI Chatbot</h1>
        <div className="flex items-center gap-3">
          <ModelPicker
            models={models}
            value={model}
            onChange={setModel}
            className="w-[220px]"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setApiKeyOpen(true)}
            title="API Key"
          >
            <KeyRound className="size-4" />
          </Button>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
              <Trash2 className="size-4" />
              Clear
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center pt-32 text-center">
              <div>
                <Bot className="mx-auto mb-4 size-12 text-muted-foreground" />
                <h2 className="mb-2 text-xl font-semibold">
                  How can I help you today?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Send a message to start a conversation.
                </p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Bot className="size-4" />
                </div>
              )}
              <Card
                className={`max-w-[80%] py-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card"
                }`}
              >
                <CardContent className="whitespace-pre-wrap text-sm">
                  {message.parts
                    .filter((part) => part.type === "text")
                    .map((part, i) => (
                      <span key={i}>{part.text}</span>
                    ))}
                </CardContent>
              </Card>
              {message.role === "user" && (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <User className="size-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                <Bot className="size-4" />
              </div>
              <Card className="bg-card py-3">
                <CardContent>
                  <div className="flex gap-1">
                    <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                    <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                    <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-border px-4 py-4">
        {error && (
          <p
            role="alert"
            className="mx-auto mb-3 max-w-3xl text-sm text-destructive"
          >
            The response failed. Check your API key and model, then try again.
          </p>
        )}
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl gap-3">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-md border border-input bg-secondary px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
        <div className="mx-auto mt-3 flex max-w-3xl justify-center">
          <PoweredBy />
        </div>
      </div>
    </main>
  );
}
