import assert from "node:assert/strict";
import { test } from "node:test";
import { LLMGatewayClient } from "../dist/index.js";

test("quotes and confirms using authenticated card-bound requests", async () => {
  const requests = [];
  const client = new LLMGatewayClient({
    session: { token: "session-test" },
    fetch: async (url, init) => {
      requests.push({ url, ...init });
      return Response.json({
        paymentIntentId: "pi_test",
        platformFee: 5,
        internationalFee: 1.5,
        totalAmount: 106.5,
        status: "succeeded",
      });
    },
  });
  const quote = await client.createTopUp(100, "pm_test");
  assert.equal(quote.internationalFee, 1.5);
  assert.equal(
    (await client.confirmTopUp(quote.paymentIntentId)).status,
    "succeeded",
  );
  assert.deepEqual(
    requests.map((request) => JSON.parse(request.body)),
    [
      { amount: 100, paymentMethodId: "pm_test" },
      { paymentIntentId: "pi_test" },
    ],
  );
  assert.ok(
    requests.every(
      (request) => request.headers.Authorization === "Bearer session-test",
    ),
  );
});

test("propagates quote and confirmation errors", async () => {
  const client = new LLMGatewayClient({
    session: { token: "session-test" },
    fetch: async () =>
      Response.json({ message: "Card unavailable" }, { status: 400 }),
  });
  await assert.rejects(client.createTopUp(100, "pm_test"), /Card unavailable/);
  await assert.rejects(client.confirmTopUp("pi_test"), /Card unavailable/);
});
