import assert from "node:assert/strict";
import { after, test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  parseCustomAgent,
  customAgentDefinition,
} from "../src/utils/custom-agents.js";
import { AGENTS, findAgent } from "../src/utils/agents.js";

const dir = await fs.mkdtemp(path.join(os.tmpdir(), "llmgateway-launch-test-"));
after(() => fs.rm(dir, { recursive: true, force: true }));
const entry = fileURLToPath(new URL("../src/index.ts", import.meta.url));
const baseEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("LLMGATEWAY_")),
);
const fixture = path.join(dir, "fake-agent.cjs");
await fs.writeFile(
  fixture,
  `const fs = require('node:fs'); fs.writeFileSync(process.env.RESULT_FILE, JSON.stringify({args: process.argv.slice(2), key: process.env.OPENAI_API_KEY, url: process.env.OPENAI_BASE_URL})); if (process.argv.includes('--signal')) process.kill(process.pid, 'SIGTERM'); else process.exit(Number(process.env.EXIT_CODE || 0));`,
);

async function cli(args: string[], env: Record<string, string> = {}) {
  const child = spawn(
    process.execPath,
    ["--import", import.meta.resolve("tsx"), entry, ...args],
    {
      cwd: dir,
      env: {
        ...baseEnv,
        LLMGATEWAY_CONFIG_DIR: path.join(dir, "config"),
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const code = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  return { stdout, stderr, code };
}

const definition = {
  id: "enterprise-agent",
  label: "Enterprise agent",
  command: process.execPath,
  args: [fixture, "--model", "${model}"],
  defaultModel: "model-default",
  env: {
    OPENAI_API_KEY: "${apiKey}",
    OPENAI_BASE_URL: "${gatewayUrl}/v1",
    RESULT_FILE: path.join(dir, "result.json"),
  },
};

test("registers a custom agent and launches it with literal arguments, environment, and exit status", async () => {
  const file = path.join(dir, "agent.json");
  await fs.writeFile(file, JSON.stringify(definition));
  assert.equal((await cli(["agents", "add", file])).code, 0);
  assert.equal((await cli(["agents", "add", file])).code, 1);
  const list = await cli(["agents", "list", "--json"]);
  assert.ok(
    JSON.parse(list.stdout).some(
      (agent: { id: string }) => agent.id === definition.id,
    ),
  );
  const arg = 'literal argument ; $(touch should-not-exist) "quoted"';
  const result = await cli(
    [
      "launch",
      "--model",
      "org/model",
      "--gateway-url",
      "https://enterprise.example.com",
      definition.id,
      arg,
      "--continue",
    ],
    { LLMGATEWAY_API_KEY: "fixture-api-key", EXIT_CODE: "7" },
  );
  assert.equal(result.code, 7, result.stderr);
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(dir, "result.json"), "utf8")),
    {
      args: ["--model", "org/model", arg, "--continue"],
      key: "fixture-api-key",
      url: "https://enterprise.example.com/v1",
    },
  );
  await assert.rejects(fs.stat(path.join(dir, "should-not-exist")), {
    code: "ENOENT",
  });
});

test("dry-run needs no key, performs no preparation, and redacts a key even in passthrough args", async () => {
  await fs.rm(path.join(dir, "result.json"), { force: true });
  const result = await cli(
    ["launch", "--dry-run", definition.id, "--secret=fixture-api-key"],
    { LLMGATEWAY_API_KEY: "fixture-api-key" },
  );
  assert.equal(result.code, 0, result.stderr);
  assert.ok(!result.stdout.includes("fixture-api-key"));
  assert.match(result.stdout, /REDACTED/);
  await assert.rejects(fs.stat(path.join(dir, "result.json")), {
    code: "ENOENT",
  });
  assert.equal((await cli(["launch", "--dry-run", "codex"])).code, 0);
});

test(
  "propagates signal termination instead of returning success",
  { skip: process.platform === "win32" },
  async () => {
    const result = await cli(["launch", definition.id, "--signal"], {
      LLMGATEWAY_API_KEY: "fixture-api-key",
    });
    assert.equal(result.code, 143, result.stderr);
  },
);

test("rejects invalid or conflicting custom definitions and never puts credentials in arguments", () => {
  for (const changes of [
    { id: "codex" },
    { id: "../escape" },
    { command: "node --eval code" },
    { args: ["${apiKey}"] },
    { args: ["${unknown}"] },
    { shell: true },
    { env: { INVALID: "bad\nvalue" } },
  ]) {
    assert.throws(() => parseCustomAgent({ ...definition, ...changes }));
  }
  const parsed = parseCustomAgent({ ...definition, defaultModel: undefined });
  const agent = customAgentDefinition(parsed);
  assert.throws(
    () =>
      agent.args!(
        { apiKey: "key", bin: "bin", gatewayUrl: "https://api.example.com" },
        [],
      ),
    /requires a model/,
  );
});

test("built-in identifiers and aliases are unique; new agents configure the correct API protocol", () => {
  const ids = AGENTS.flatMap((agent) => [agent.id, ...(agent.aliases ?? [])]);
  assert.equal(new Set(ids).size, ids.length);
  const ctx = {
    apiKey: "test-key",
    gatewayUrl: "https://gateway.example.com",
    model: 'org/model"quoted',
    bin: "binary",
  };
  assert.equal(
    findAgent("aider")!.env!(ctx).OPENAI_API_BASE,
    "https://gateway.example.com/v1",
  );
  assert.equal(
    findAgent("qwen-code")!.env!(ctx).OPENAI_BASE_URL,
    "https://gateway.example.com/v1",
  );
  assert.ok(findAgent("qwen")!.args!(ctx, []).includes("openai"));
  assert.equal(
    findAgent("goose")!.env!(ctx).OPENAI_HOST,
    "https://gateway.example.com",
  );
  assert.ok(
    findAgent("codex")!.args!(ctx, []).includes(
      `model=${JSON.stringify(ctx.model)}`,
    ),
  );
});

test("missing agent arguments fail promptly without interactive prompts", async () => {
  const result = await cli(["launch"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr + result.stdout, /Specify an agent/);
});
