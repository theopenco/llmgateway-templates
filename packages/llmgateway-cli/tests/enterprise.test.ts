import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../src/index.ts", import.meta.url));
const baseEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("LLMGATEWAY_")),
);

test("browser session supports organization selection, full skill bundles, publishing, and logout", async () => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "llmgateway-enterprise-"),
  );
  const configDir = path.join(dir, "config");
  const catalog = [
    {
      id: "skill-1",
      name: "code-review",
      description: "Review code",
      enabled: true,
    },
    {
      id: "skill-2",
      name: "disabled",
      description: "Disabled skill",
      enabled: false,
    },
  ];
  const content =
    "---\nname: code-review\ndescription: Review code\n---\nRead references/rules.md.\n";
  const detail = {
    ...catalog[0],
    content,
    files: [{ path: "references/rules.md", content: "Review correctness." }],
  };
  let revoked = false;
  let published: unknown;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString();
    const body = raw ? JSON.parse(raw) : {};
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/auth/device/code") {
      assert.equal(body.client_id, "llmgateway-cli");
      res.end(
        JSON.stringify({
          device_code: "secret-device",
          user_code: "ABCDEFGH",
          verification_uri: `${url}/connect/device`,
          expires_in: 60,
          interval: 1,
        }),
      );
      return;
    }
    if (req.url === "/auth/device/token") {
      assert.equal(body.device_code, "secret-device");
      res.end(JSON.stringify({ access_token: "fixture-session" }));
      return;
    }
    if (req.headers.authorization !== "Bearer fixture-session" || revoked) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    if (req.url === "/auth/get-session")
      res.end(JSON.stringify({ user: { email: "developer@example.com" } }));
    else if (req.url === "/auth/sign-out") {
      assert.equal(req.headers["content-type"], "application/json");
      revoked = true;
      res.end(JSON.stringify({ success: true }));
    } else if (req.url === "/orgs")
      res.end(
        JSON.stringify({
          organizations: [
            { id: "org-1", name: "Engineering" },
            { id: "org-2", name: "Research" },
          ],
        }),
      );
    else if (req.url === "/orgs/org-1/skills" && req.method === "POST") {
      published = body;
      res.end(JSON.stringify({ skill: detail }));
    } else if (req.url === "/orgs/org-1/skills")
      res.end(JSON.stringify({ skills: catalog }));
    else if (req.url === "/orgs/org-1/skills/skill-1")
      res.end(JSON.stringify({ skill: detail }));
    else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not_found" }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  async function cli(args: string[]) {
    const child = spawn(
      process.execPath,
      ["--import", import.meta.resolve("tsx"), entry, ...args],
      {
        cwd: dir,
        env: { ...baseEnv, LLMGATEWAY_CONFIG_DIR: configDir },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    return { code, output };
  }

  try {
    const login = await cli([
      "auth",
      "login",
      "--no-browser",
      "--api-url",
      url,
      "--dashboard-url",
      url,
      "--gateway-url",
      "https://gateway.example.com",
    ]);
    assert.equal(login.code, 0, login.output);
    assert.match(login.output, /ABCDEFGH/);
    assert.ok(
      !login.output.includes("fixture-session") &&
        !login.output.includes("secret-device"),
    );
    const config = JSON.parse(
      await fs.readFile(path.join(configDir, "config.json"), "utf8"),
    );
    assert.equal(config.sessionToken, "fixture-session");
    assert.equal(config.sessionApiUrl, url);
    assert.equal(
      (await cli(["skills", "list"])).code,
      1,
      "multiple organizations require selection in scripts",
    );
    assert.equal((await cli(["orgs", "use", "Engineering"])).code, 0);
    assert.equal(
      (await cli(["skills", "list", "--org", "other-organization"])).code,
      1,
    );
    const list = await cli(["skills", "list", "--json"]);
    assert.deepEqual(JSON.parse(list.output), catalog);
    assert.equal(
      (await cli(["skills", "show", "code-review"])).output.trim(),
      content.trim(),
    );
    assert.equal(
      (await cli(["skills", "add", "--all", "--agent", "codex", "--dry-run"]))
        .code,
      0,
    );
    await assert.rejects(fs.stat(path.join(dir, ".agents")), {
      code: "ENOENT",
    });
    assert.equal(
      (await cli(["skills", "add", "--all", "--agent", "codex"])).code,
      0,
    );
    assert.equal(
      await fs.readFile(
        path.join(dir, ".agents/skills/code-review/SKILL.md"),
        "utf8",
      ),
      content,
    );
    assert.equal(
      await fs.readFile(
        path.join(dir, ".agents/skills/code-review/references/rules.md"),
        "utf8",
      ),
      "Review correctness.",
    );
    await assert.rejects(fs.stat(path.join(dir, ".agents/skills/disabled")), {
      code: "ENOENT",
    });
    assert.equal((await cli(["skills", "add", "code-review"])).code, 1);
    assert.equal(
      (await cli(["skills", "add", "code-review", "--force"])).code,
      0,
    );
    await fs.writeFile(path.join(dir, "SKILL.md"), content);
    assert.equal((await cli(["skills", "publish", "SKILL.md"])).code, 0);
    assert.deepEqual(published, { content, files: [] });
    assert.equal((await cli(["auth", "logout"])).code, 0);
    assert.equal(revoked, true);
    const cleared = JSON.parse(
      await fs.readFile(path.join(configDir, "config.json"), "utf8"),
    );
    assert.equal(cleared.sessionToken, undefined);
    assert.equal(cleared.defaultOrgId, undefined);
    assert.equal(cleared.gatewayUrl, "https://gateway.example.com");
    assert.equal((await cli(["skills", "list", "--org", "org-1"])).code, 1);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(dir, { recursive: true, force: true });
  }
});
