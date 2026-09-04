import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ts from "typescript";
import { templates } from "../src/utils/templates.js";
import { standaloneManifest } from "../src/utils/scaffold.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const run = promisify(execFile);

test("every template and agent is registered, documented, and has a standalone installable manifest", async () => {
  const discovered: string[] = [];
  for (const group of ["templates", "agents"]) {
    for (const entry of await fs.readdir(path.join(root, group), {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory()) continue;
      try {
        await fs.stat(path.join(root, group, entry.name, "package.json"));
        discovered.push(`${group}/${entry.name}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  }
  assert.deepEqual(
    templates.map((template) => template.path).sort(),
    discovered.sort(),
  );
  for (const template of templates) {
    await fs.stat(path.join(root, template.path, "README.md"));
    const manifest = JSON.parse(
      await fs.readFile(path.join(root, template.path, "package.json"), "utf8"),
    );
    const standalone = standaloneManifest(manifest, template, "my-project");
    assert.equal(standalone.name, "my-project");
    assert.ok(
      !JSON.stringify(standalone).includes("workspace:"),
      template.name,
    );
    if (manifest.dependencies?.ai)
      assert.match(manifest.dependencies.ai, /^\^6\./);
  }
});

test("generated tools and routes compile against the template's AI SDK", async () => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "llmgateway-generated-test-"),
  );
  try {
    await fs.symlink(
      path.join(root, "templates/ai-chatbot/node_modules"),
      path.join(dir, "node_modules"),
      "dir",
    );
    const entry = path.join(root, "packages/llmgateway-cli/src/index.ts");
    for (const [kind, name] of [
      ["tool", "weather"],
      ["tool", "search"],
      ["tool", "calculator"],
      ["route", "generate"],
      ["route", "chat"],
    ]) {
      await run(
        process.execPath,
        ["--import", import.meta.resolve("tsx"), entry, "add", kind, name],
        { cwd: dir },
      );
    }
    const sources = [
      "src/tools/weather.ts",
      "src/tools/search.ts",
      "src/tools/calculator.ts",
      "src/app/api/generate/route.ts",
      "src/app/api/chat/route.ts",
    ];
    const program = ts.createProgram(
      sources.map((source) => path.join(dir, source)),
      {
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        types: ["node"],
        typeRoots: [path.join(dir, "node_modules/@types")],
      },
    );
    const errors = ts
      .getPreEmitDiagnostics(program)
      .filter(
        (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
      );
    assert.equal(
      errors.length,
      0,
      errors
        .map((error) =>
          ts.flattenDiagnosticMessageText(error.messageText, "\n"),
        )
        .join("\n"),
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
