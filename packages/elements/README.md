# React Elements

See the [Payments SDK integration guide](https://docs.llmgateway.io/features/embeddable-payments).

## Card-priced checkout upgrade

Upgrade `@llmgateway/elements` and `@llmgateway/client` together with the gateway API. `<BuyCredits>` now collects a card, shows the platform fee and any separate international-card surcharge, then asks the user to confirm the final total.

The component handles server confirmation and card authentication. Keep the provider's `mode` matched to the wallet: `"test"` for sandbox wallets or `"prod"` for live wallets. Existing applications must update their installed SDK packages to use this checkout contract.
