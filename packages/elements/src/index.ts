export {
	LLMGatewayProvider,
	useLLMGateway,
	type LLMGatewayProviderProps,
	type Appearance,
} from "./context.js";
export { useBalance, type UseBalanceResult } from "./useBalance.js";
export { CreditBalance, type CreditBalanceProps } from "./CreditBalance.js";
export { BuyCredits, type BuyCreditsProps } from "./BuyCredits.js";
export {
	useChat,
	type UseChatOptions,
	type UseChatResult,
	type ChatTurn,
} from "./useChat.js";
export { Chat, type ChatProps } from "./Chat.js";

export type {
	Balance,
	LedgerEntry,
	TopUp,
	SessionRef,
	ChatParams,
	ChatResult,
	ImageParams,
	ImageResult,
	EmbeddingsParams,
	EmbeddingsResult,
} from "@llmgateway/client";
