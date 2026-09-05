import assert from "node:assert/strict";
import { beforeEach, after, test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import {
  getConfig,
  setConfig,
  clearConfig,
  configFile,
  normalizeUrl,
  sessionHeaders,
} from "../src/utils/config.js";
import { apiRequest, getSessionUser } from "../src/utils/api.js";

const dir = await fs.mkdtemp(path.join(os.tmpdir(), "llmgateway-config-test-"));
process.env.LLMGATEWAY_CONFIG_DIR = dir;
beforeEach(async () => {
  await fs.rm(configFile(), { force: true });
  delete process.env.LLMGATEWAY_API_URL;
});
after(() => fs.rm(dir, { recursive: true, force: true }));

test("writes credentials atomically with private permissions and preserves settings on logout", async () => {
  await setConfig({
    sessionToken: "secret",
    apiKey: "key",
    gatewayUrl: "https://gateway.example.com",
    defaultOrgId: "org",
  });
  await setConfig({ sessionEmail: "dev@example.com" });
  assert.equal((await fs.stat(configFile())).mode & 0o777, 0o600);
  assert.equal((await getConfig()).sessionToken, "secret");
  await clearConfig();
  assert.deepEqual(await getConfig(), {
    gatewayUrl: "https://gateway.example.com",
  });
  assert.deepEqual(await fs.readdir(dir), ["config.json"]);
});

test("does not silently erase malformed configuration", async () => {
  await fs.writeFile(configFile(), "{broken");
  await assert.rejects(setConfig({ apiKey: "new-key" }), /Cannot read/);
  assert.equal(await fs.readFile(configFile(), "utf8"), "{broken");
});

test("sessions cannot cross deployment boundaries, including legacy cookies", async () => {
  await setConfig({ sessionCookie: "better-auth.session_token=legacy" });
  process.env.LLMGATEWAY_API_URL = "https://another.example.com";
  await assert.rejects(sessionHeaders(), /another LLM Gateway instance/);
  await setConfig({
    sessionToken: "session",
    sessionApiUrl: "https://another.example.com/",
  });
  assert.deepEqual(await sessionHeaders(), { Authorization: "Bearer session" });
});

test("validates deployment URLs without substring-based loopback checks", () => {
  for (const url of [
    "http://localhost.attacker.com",
    "http://remote.example.com",
    "https://user:password@example.com",
    "https://example.com?token=x",
    "file:///tmp/test",
  ]) {
    assert.throws(() => normalizeUrl(url));
  }
  assert.equal(normalizeUrl("http://127.0.0.1:9999/"), "http://127.0.0.1:9999");
  assert.equal(
    normalizeUrl("https://enterprise.example.com/api/"),
    "https://enterprise.example.com/api",
  );
});

test("uses bearer auth for management calls, supports empty responses, and refuses redirects", async () => {
  let targetRequests = 0;
  const server = createServer((req, res) => {
    assert.equal(req.headers.authorization, "Bearer token");
    if (req.url === "/empty") {
      res.writeHead(204).end();
      return;
    }
    if (req.url === "/redirect") {
      res.writeHead(302, { location: "/target" }).end();
      return;
    }
    if (req.url === "/target") targetRequests++;
    if (req.url === "/auth/get-session") {
      res.writeHead(503).end("unavailable");
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const apiUrl = `http://127.0.0.1:${address.port}`;
  await setConfig({ apiUrl, sessionApiUrl: apiUrl, sessionToken: "token" });
  try {
    assert.deepEqual(await apiRequest("/example"), { ok: true });
    assert.equal(await apiRequest("/empty", { method: "DELETE" }), undefined);
    await assert.rejects(apiRequest("/redirect"));
    assert.equal(targetRequests, 0);
    await assert.rejects(getSessionUser(), { status: 503 });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
