import assert from "node:assert/strict";
import { mock, test } from "node:test";
mock.module("react/jsx-runtime", {
  namedExports: {
    jsx: (type, props) => ({ type, props }),
    jsxs: (type, props) => ({ type, props }),
    Fragment: "fragment",
  },
});

let state = [];
let cursor = 0;
let failures = [];
let successes = 0;
const quote = {
  paymentIntentId: "pi_test",
  clientSecret: "secret_test",
  platformFee: 5,
  internationalFee: 1.5,
  totalAmount: 106.5,
};
const createTopUp = mock.fn(async () => quote);
const confirmTopUp = mock.fn(async () => ({
  status: "succeeded",
  clientSecret: "secret_test",
}));
const submit = mock.fn(async () => ({}));
const createPaymentMethod = mock.fn(async () => ({
  paymentMethod: { id: "pm_test" },
}));
const handleNextAction = mock.fn(async () => ({}));
const client = { createTopUp, confirmTopUp };
const stripe = { createPaymentMethod, handleNextAction };
const elements = { submit };
mock.module("react", {
  namedExports: {
    useMemo: (factory) => factory(),
    useState: (initial) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [
        state[index],
        (value) => {
          state[index] = value;
        },
      ];
    },
  },
});
mock.module("@stripe/react-stripe-js", {
  namedExports: {
    Elements: () => null,
    PaymentElement: () => null,
    useElements: () => elements,
    useStripe: () => stripe,
  },
});
mock.module("@stripe/stripe-js", {
  namedExports: { loadStripe: async () => stripe },
});
mock.module("../dist/context.js", {
  namedExports: {
    useLLMGateway: () => ({
      client,
      stripePublishableKey: "pk_test",
      appearance: { theme: "dark" },
    }),
  },
});
mock.module("../dist/PoweredBy.js", {
  namedExports: { PoweredBy: () => null },
});
const { BuyCredits } = await import("../dist/BuyCredits.js");
function render() {
  cursor = 0;
  const root = BuyCredits({
    amount: 100,
    onSuccess: () => successes++,
    onError: (error) => failures.push(error.message),
  });
  return root.props.children.type(root.props.children.props);
}
function text(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node !== "object") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return text(node.props.children);
}
async function click() {
  await render().props.onSubmit({ preventDefault() {} });
}
function reset() {
  state = [];
  cursor = 0;
  failures = [];
  successes = 0;
  for (const fn of [
    createTopUp,
    confirmTopUp,
    submit,
    createPaymentMethod,
    handleNextAction,
  ])
    fn.mock.resetCalls();
  createTopUp.mock.mockImplementation(async () => quote);
  confirmTopUp.mock.mockImplementation(async () => ({
    status: "succeeded",
    clientSecret: "secret_test",
  }));
  submit.mock.mockImplementation(async () => ({}));
  handleNextAction.mock.mockImplementation(async () => ({}));
}
test("collects the card, displays the surcharge, and waits for explicit payment confirmation", async () => {
  reset();
  assert.match(text(render()), /Review payment/);
  await click();
  assert.deepEqual(createTopUp.mock.calls[0].arguments, [100, "pm_test"]);
  assert.equal(confirmTopUp.mock.callCount(), 0);
  assert.match(
    text(render()),
    /International card fee \(1.5%\).*1.50.*106.50.*Pay \$106.50/,
  );
  await click();
  assert.deepEqual(confirmTopUp.mock.calls[0].arguments, ["pi_test"]);
  assert.equal(successes, 1);
  await click();
  assert.equal(confirmTopUp.mock.callCount(), 1);
});
test("authenticates SCA and asks the server to reconfirm the same intent", async () => {
  reset();
  await click();
  let calls = 0;
  confirmTopUp.mock.mockImplementation(async () => ({
    status: ++calls === 1 ? "requires_action" : "succeeded",
    clientSecret: "secret_test",
  }));
  await click();
  assert.equal(handleNextAction.mock.callCount(), 1);
  assert.equal(confirmTopUp.mock.callCount(), 2);
  assert.equal(successes, 1);
});
test("keeps the quoted intent on network failure so retry cannot create a second charge", async () => {
  reset();
  await click();
  confirmTopUp.mock.mockImplementation(async () => {
    throw new Error("Network unavailable");
  });
  await click();
  assert.deepEqual(failures, ["Network unavailable"]);
  assert.equal(successes, 0);
  assert.match(text(render()), /Pay \$106.50/);
  assert.equal(createTopUp.mock.callCount(), 1);
});
test("declines return to card entry and domestic cards have no surcharge row", async () => {
  reset();
  createTopUp.mock.mockImplementation(async () => ({
    ...quote,
    internationalFee: 0,
    totalAmount: 105,
  }));
  await click();
  assert.doesNotMatch(text(render()), /International card fee/);
  confirmTopUp.mock.mockImplementation(async () => ({
    status: "requires_payment_method",
    clientSecret: "secret_test",
  }));
  await click();
  assert.match(text(render()), /Review payment/);
  assert.equal(successes, 0);
});
test("invalid card data never creates an intent", async () => {
  reset();
  submit.mock.mockImplementation(async () => ({
    error: { message: "Card incomplete" },
  }));
  await click();
  assert.equal(createTopUp.mock.callCount(), 0);
  assert.deepEqual(failures, ["Card incomplete"]);
});

test("rejects unsupported credit amounts before loading Elements", () => {
  reset();
  for (const amount of [0, 9, 10.5, 5001]) {
    const result = BuyCredits({ amount });
    assert.equal(result.props.role, "alert");
    assert.match(text(result), /whole dollar/);
  }
});

test("authentication errors do not report success or create another intent", async () => {
  reset();
  await click();
  confirmTopUp.mock.mockImplementation(async () => ({
    status: "requires_action",
    clientSecret: "secret_test",
  }));
  handleNextAction.mock.mockImplementation(async () => ({
    error: { message: "Authentication canceled" },
  }));
  await click();
  assert.equal(successes, 0);
  assert.equal(createTopUp.mock.callCount(), 1);
  assert.deepEqual(failures, ["Authentication canceled"]);
});
