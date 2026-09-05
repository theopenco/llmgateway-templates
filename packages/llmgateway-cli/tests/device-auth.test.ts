import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import {
  deviceLogin,
  parseDeviceCode,
  verificationUrl,
  type DeviceCode,
} from "../src/utils/device-auth.js";

const code: DeviceCode = {
  device_code: "secret-device",
  user_code: "ABCD-EFGH",
  verification_uri: "https://dashboard.example.com/device",
  expires_in: 600,
  interval: 1,
};

test("rejects verification links to another origin and validates authorization response fields", () => {
  for (const changes of [
    { verification_uri: "https://attacker.example.com/device" },
    { expires_in: 0 },
    { interval: -1 },
    { user_code: "bad\ncode" },
    { verification_uri_complete: "https://dashboard.example.com/other" },
  ]) {
    assert.throws(() =>
      parseDeviceCode({ ...code, ...changes }, "https://dashboard.example.com"),
    );
  }
  assert.equal(parseDeviceCode(code, "https://dashboard.example.com"), code);
});

test("SSO retains the same-origin verification destination and prefilled work email", () => {
  const url = new URL(
    verificationUrl(code, "https://dashboard.example.com", "dev@example.com"),
  );
  assert.equal(url.pathname, "/sso");
  assert.equal(url.searchParams.get("email"), "dev@example.com");
  assert.equal(url.searchParams.get("redirect"), "/device?user_code=ABCD-EFGH");
  assert.ok(!url.toString().includes("secret-device"));
});

async function withServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  action: (url: string) => Promise<void>,
) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  try {
    await action(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("polls until approval, honoring pending responses and sending only the device credential", async () => {
  let polls = 0;
  let shown = false;
  await withServer(
    (req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/auth/device/code") {
        res.end(JSON.stringify(code));
        return;
      }
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        assert.equal(JSON.parse(body).device_code, code.device_code);
        assert.equal(JSON.parse(body).client_id, "llmgateway-cli");
        assert.equal(req.headers.cookie, undefined);
        assert.equal(req.headers.authorization, undefined);
        polls++;
        if (polls === 1) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "authorization_pending" }));
        } else res.end(JSON.stringify({ access_token: "approved-session" }));
      });
    },
    async (apiUrl) => {
      assert.equal(
        await deviceLogin({
          apiUrl,
          dashboardUrl: "https://dashboard.example.com",
          onCode: async (received) => {
            assert.equal(received.user_code, code.user_code);
            shown = true;
          },
        }),
        "approved-session",
      );
    },
  );
  assert.equal(polls, 2);
  assert.equal(shown, true);
});

test("denial terminates the flow without accepting a token", async () => {
  await withServer(
    (req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/auth/device/code") res.end(JSON.stringify(code));
      else {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "access_denied" }));
      }
    },
    async (apiUrl) => {
      await assert.rejects(
        deviceLogin({
          apiUrl,
          dashboardUrl: "https://dashboard.example.com",
          onCode: async () => {},
        }),
        /denied/,
      );
    },
  );
});

test("cancellation and deadline abort polling and unsupported servers fail clearly", async () => {
  await withServer(
    (req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/auth/device/code") res.end(JSON.stringify(code));
      else {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "authorization_pending" }));
      }
    },
    async (apiUrl) => {
      const controller = new AbortController();
      await assert.rejects(
        deviceLogin({
          apiUrl,
          dashboardUrl: "https://dashboard.example.com",
          signal: controller.signal,
          onCode: async () => {
            controller.abort();
          },
        }),
      );
      await assert.rejects(
        deviceLogin({
          apiUrl,
          dashboardUrl: "https://dashboard.example.com",
          timeoutMs: 20,
          onCode: async () => {},
        }),
      );
    },
  );
  await withServer(
    (_req, res) => {
      res.writeHead(404).end();
    },
    async (apiUrl) => {
      await assert.rejects(
        deviceLogin({
          apiUrl,
          dashboardUrl: "https://dashboard.example.com",
          onCode: async () => {},
        }),
        /does not support browser login/,
      );
    },
  );
});
