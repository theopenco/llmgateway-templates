import { useChat } from "./useChat.js";

export interface ChatProps {
  model: string;
  system?: string;
  placeholder?: string;
  /** Called after each completed assistant turn (e.g. to refetch balance). */
  onFinish?: () => void;
}

/**
 * Drop-in streaming chat widget bound to the end-user session. Each reply debits
 * the wallet. For full control, use the `useChat` hook directly.
 */
export function Chat(props: ChatProps) {
  const { model, system, placeholder = "Ask anything…", onFinish } = props;
  const { messages, input, setInput, send, isStreaming, error } = useChat({
    model,
    system,
    onFinish,
  });

  return (
    <div className="lg-chat">
      <div className="lg-chat__messages">
        {messages.length === 0 ? (
          <div className="lg-chat__empty">Start the conversation.</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`lg-chat__msg lg-chat__msg--${m.role}`}>
              {m.content ||
                (isStreaming && i === messages.length - 1 ? "…" : "")}
            </div>
          ))
        )}
      </div>

      {error ? <div className="lg-chat__error">{error.message}</div> : null}

      <form
        className="lg-chat__form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          className="lg-chat__input"
          value={input}
          placeholder={placeholder}
          disabled={isStreaming}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          className="lg-chat__send"
          type="submit"
          disabled={isStreaming || !input.trim()}
        >
          {isStreaming ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
