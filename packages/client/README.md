# Browser client

See the [Payments SDK integration guide](https://docs.llmgateway.io/features/embeddable-payments).

## Card-priced checkout upgrade

Upgrade `@llmgateway/client` and `@llmgateway/elements` together with the gateway API. Create a Stripe payment method first, then call `createTopUp(amount, paymentMethodId)`. Show `platformFee`, `internationalFee` and `totalAmount` before calling `confirmTopUp(paymentIntentId)`.

Use `getStripePublishableKey("test")` for sandbox wallets and `getStripePublishableKey("prod")` for live wallets. Handle `requires_action` with Stripe.js, then reconfirm the same intent. Cardless top-up calls and client-side payment confirmation are no longer supported.
