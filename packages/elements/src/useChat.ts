import { useCallback, useState } from "react";

import { useLLMGateway } from "./context.js";

import type { ChatMessage } from "@llmgateway/client";

export interface ChatTurn {
	role: "user" | "assistant";
	content: string;
}

export interface UseChatOptions {
	model: string;
	system?: string;
	/** Called after each completed assistant turn (e.g. to refetch balance). */
	onFinish?: () => void;
}

export interface UseChatResult {
	messages: ChatTurn[];
	input: string;
	setInput: (value: string) => void;
	/** Send `text` (or the current input) and stream the assistant reply. */
	send: (text?: string) => Promise<void>;
	isStreaming: boolean;
	error: Error | null;
	clear: () => void;
}

/**
 * Stateful streaming chat against the end-user session. Each turn debits the
 * wallet. Pairs with `<Chat>` or drives your own UI.
 */
export function useChat(options: UseChatOptions): UseChatResult {
	const { model, system, onFinish } = options;
	const { client } = useLLMGateway();

	const [messages, setMessages] = useState<ChatTurn[]>([]);
	const [input, setInput] = useState("");
	const [isStreaming, setIsStreaming] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const send = useCallback(
		async (text?: string) => {
			const content = (text ?? input).trim();
			if (!content || isStreaming) {
				return;
			}

			setError(null);
			setInput("");
			const history = [...messages, { role: "user" as const, content }];
			// Open an empty assistant turn we stream into.
			setMessages([...history, { role: "assistant", content: "" }]);
			setIsStreaming(true);

			const wireMessages: ChatMessage[] = [
				...(system ? [{ role: "system" as const, content: system }] : []),
				...history.map((m) => ({ role: m.role, content: m.content })),
			];

			try {
				for await (const delta of client.stream({
					model,
					messages: wireMessages,
				})) {
					setMessages((prev) => {
						const next = [...prev];
						const last = next[next.length - 1];
						if (last && last.role === "assistant") {
							next[next.length - 1] = {
								role: "assistant",
								content: last.content + delta,
							};
						}
						return next;
					});
				}
			} catch (err) {
				setError(err instanceof Error ? err : new Error(String(err)));
			} finally {
				setIsStreaming(false);
				onFinish?.();
			}
		},
		[client, model, system, input, isStreaming, messages, onFinish],
	);

	const clear = useCallback(() => {
		setMessages([]);
		setError(null);
	}, []);

	return { messages, input, setInput, send, isStreaming, error, clear };
}
