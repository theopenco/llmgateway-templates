import type { LLMGatewayMode } from "./index.js";

/** LLM Gateway's Stripe publishable keys — safe to ship in the browser bundle. */
const STRIPE_PUBLISHABLE_KEY_LIVE =
  "pk_live_51RRXLsEAkKxa3kRayCPr9oW8dUp7mIzwev1FVpM3jpKU3StLaaiKvXCEPkewabL5hRip4IXLzFlFTLC4RpFWRknN00lX2vgZHP";
const STRIPE_PUBLISHABLE_KEY_TEST =
  "pk_test_51Tg7FdClMO1TUqxQyb9JNdUvhTrklBtarL7hN4OXAM2dpcjYoz1AvS1245HRezcguhrYqQRKKsyKnrAVLwaspfQe00teC3fLDZ";
const STRIPE_PUBLISHABLE_KEY_INTERNAL =
  "pk_test_51RRXM1CYKGHizcWTfXxFSEzN8gsUQkg2efi2FN5KO2M2hxdV9QPCjeZMPaZQHSAatxpK9wDcSeilyYU14gz2qA2p00R4q5xU1R";

const STRIPE_PUBLISHABLE_KEY_BY_MODE: Record<LLMGatewayMode, string> = {
  prod: STRIPE_PUBLISHABLE_KEY_LIVE,
  test: STRIPE_PUBLISHABLE_KEY_TEST,
  internal: STRIPE_PUBLISHABLE_KEY_INTERNAL,
};

/** LLM Gateway's browser-safe Stripe key for the wallet mode. */
export function getStripePublishableKey(mode: LLMGatewayMode = "prod"): string {
  return STRIPE_PUBLISHABLE_KEY_BY_MODE[mode];
}
