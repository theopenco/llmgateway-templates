import assert from "node:assert/strict";
import { test } from "node:test";
import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import { findAgent } from "../src/utils/agents.js";
import {
  readJsonConfig,
  syncOpencodeModelCatalog,
} from "../src/utils/agent-configs.js";

test("agent configuration refreshes rotated keys and endpoints while preserving unrelated settings", async (t) => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "llmgateway-agent-configs-"),
  );
  t.mock.method(os, "homedir", () => dir);
  const oldXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = path.join(dir, ".config");
  try {
    const ctx = {
      apiKey: "rotated-key",
      gatewayUrl: "https://enterprise.example.com",
      model: "custom/model",
      bin: "unused",
    };
    await fs.mkdir(path.join(dir, ".pi/agent"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".pi/agent/models.json"),
      JSON.stringify({
        customSetting: true,
        providers: {
          llmgateway: {
            baseUrl: "https://old.example.com/v1",
            apiKey: "old-key",
            models: [{ id: "kept-model" }],
          },
        },
      }),
    );
    await findAgent("pi")!.prepare!(ctx);
    const pi = await readJsonConfig(path.join(dir, ".pi/agent/models.json"));
    assert.equal(pi!.customSetting, true);
    assert.equal(pi!.providers.llmgateway.baseUrl, `${ctx.gatewayUrl}/v1`);
    assert.equal(pi!.providers.llmgateway.apiKey, "LLM_GATEWAY_API_KEY");
    assert.deepEqual(
      pi!.providers.llmgateway.models.map((model: { id: string }) => model.id),
      ["kept-model", ctx.model],
    );
    for (const [agent, file] of [
      ["mimo", ".config/mimocode/mimocode.json"],
      ["openclaw", ".openclaw/openclaw.json"],
    ]) {
      await findAgent(agent)!.prepare!(ctx);
      const text = await fs.readFile(path.join(dir, file), "utf8");
      assert.ok(text.includes(ctx.gatewayUrl) && text.includes(ctx.model));
      if (process.platform !== "win32")
        assert.equal((await fs.stat(path.join(dir, file))).mode & 0o777, 0o600);
    }
    const file = path.join(dir, ".config/opencode/opencode.json");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(
      file,
      JSON.stringify({
        theme: "kept",
        provider: {
          llmgateway: {
            options: {
              baseURL: "https://old.example.com/v1",
              headers: { "x-team": "kept" },
            },
            models: { "my-model": { name: "Kept" } },
          },
        },
      }),
    );
    await syncOpencodeModelCatalog(ctx.gatewayUrl);
    const config = await readJsonConfig(file);
    assert.equal(config!.theme, "kept");
    assert.equal(
      config!.provider.llmgateway.options.baseURL,
      `${ctx.gatewayUrl}/v1`,
    );
    assert.equal(config!.provider.llmgateway.options.headers["x-team"], "kept");
    assert.equal(config!.provider.llmgateway.models["my-model"].name, "Kept");
    await fs.writeFile(file, "{ broken");
    await assert.rejects(
      syncOpencodeModelCatalog(ctx.gatewayUrl),
      /not valid JSON/,
    );
    assert.equal(await fs.readFile(file, "utf8"), "{ broken");
  } finally {
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("runtime provider overrides use the selected credential and preserve other OpenCode settings", () => {
  const old = process.env.OPENCODE_CONFIG_CONTENT;
  process.env.OPENCODE_CONFIG_CONTENT = JSON.stringify({
    theme: "kept",
    provider: {
      llmgateway: {
        options: { apiKey: "stale", baseURL: "https://old.example.com/v1" },
      },
    },
  });
  try {
    const ctx = {
      apiKey: "current",
      gatewayUrl: "https://enterprise.example.com",
      model: "private-model",
      bin: "unused",
    };
    for (const id of ["opencode", "devpass-code"]) {
      const env = findAgent(id)!.env!(ctx);
      const config = JSON.parse(env.OPENCODE_CONFIG_CONTENT);
      assert.equal(config.theme, "kept");
      assert.equal(config.provider.llmgateway.options.apiKey, "current");
      assert.equal(
        config.provider.llmgateway.options.baseURL,
        `${ctx.gatewayUrl}/v1`,
      );
    }
    const kimi = findAgent("kimi")!.env!(ctx);
    assert.equal(kimi.KIMI_MODEL_PROVIDER_TYPE, "openai");
    assert.equal(kimi.KIMI_MODEL_NAME, ctx.model);
    assert.equal(kimi.KIMI_MODEL_API_KEY, ctx.apiKey);
    assert.equal(kimi.KIMI_MODEL_BASE_URL, `${ctx.gatewayUrl}/v1`);
    assert.throws(() => findAgent("hermes")!.args!(ctx, []), /hosted gateway/);
    assert.ok(
      findAgent("hermes")!.args!(
        { ...ctx, gatewayUrl: "https://api.llmgateway.io" },
        [],
      ).includes("llmgateway"),
    );
  } finally {
    if (old === undefined) delete process.env.OPENCODE_CONFIG_CONTENT;
    else process.env.OPENCODE_CONFIG_CONTENT = old;
  }
});
