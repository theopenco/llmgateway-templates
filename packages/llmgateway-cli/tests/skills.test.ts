import assert from "node:assert/strict";
import { after, test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  installSkill,
  skillFiles,
  skillTarget,
  type OrganizationSkill,
} from "../src/utils/skills.js";

const base = await fs.mkdtemp(
  path.join(os.tmpdir(), "llmgateway-skills-test-"),
);
after(() => fs.rm(base, { recursive: true, force: true }));
const skill: OrganizationSkill = {
  id: "s1",
  name: "review-code",
  description: "Review code: security\nand quality",
  content:
    "---\nname: review-code\ndescription: Review code\n---\n\n# Review\n\nCheck the diff.",
  files: [],
  enabled: true,
};

test("previews without writes, installs valid SKILL.md, and requires explicit overwrite", async () => {
  const target = { base, directory: ".agents/skills" };
  const file = await installSkill(skill, target, { dryRun: true });
  await assert.rejects(fs.stat(path.join(base, ".agents")), { code: "ENOENT" });
  assert.equal(await installSkill(skill, target), file);
  assert.equal(await fs.readFile(file, "utf8"), skill.content);
  await assert.rejects(installSkill(skill, target), /already exists/);
  const updated = { ...skill, content: "Updated instructions" };
  await installSkill(updated, target, { force: true });
  assert.equal(await fs.readFile(file, "utf8"), updated.content);
});

test("rejects disabled and path-traversing skills", async () => {
  for (const name of [
    "../secrets",
    "a/b",
    "a\\b",
    "/tmp/file",
    "..",
    "a\u0000b",
  ]) {
    assert.throws(() => skillFiles({ ...skill, name }));
  }
  await assert.rejects(
    installSkill({ ...skill, enabled: false }, { base, directory: "disabled" }),
    /disabled/,
  );
  assert.throws(() => skillFiles({ ...skill, content: " " }), /content/);
});

test("refuses symlinked destination directories and files even with --force", async () => {
  const outside = path.join(base, "outside");
  await fs.mkdir(outside);
  await fs.symlink(outside, path.join(base, ".claude"), "dir");
  await assert.rejects(
    installSkill(skill, { base, directory: ".claude/skills" }, { force: true }),
    /symlink/,
  );
  assert.deepEqual(await fs.readdir(outside), []);
  const target = { base, directory: "other-skills" };
  await fs.mkdir(path.join(base, "other-skills", skill.name), {
    recursive: true,
  });
  const protectedFile = path.join(outside, "important.md");
  await fs.writeFile(protectedFile, "keep me");
  await fs.symlink(
    protectedFile,
    path.join(base, "other-skills", skill.name, "SKILL.md"),
  );
  await assert.rejects(
    installSkill(skill, target, { force: true }),
    /regular file/,
  );
  assert.equal(await fs.readFile(protectedFile, "utf8"), "keep me");
});

test("maps project and global skill directories separately", () => {
  assert.deepEqual(skillTarget("codex", false, base), {
    base,
    directory: ".agents/skills",
  });
  assert.equal(skillTarget("pi", true).directory, ".pi/agent/skills");
  assert.equal(
    skillTarget("opencode", true).directory,
    ".config/opencode/skills",
  );
  assert.throws(() => skillTarget("unknown"), /Unsupported/);
});

test("installs supporting files and binary assets, and atomically replaces a complete skill", async () => {
  const target = { base, directory: "bundle-skills" };
  const bundle = {
    ...skill,
    files: [
      { path: "references/guide.md", content: "Read this guide" },
      {
        path: "assets/icon.bin",
        content: "AAECAw==",
        encoding: "base64" as const,
      },
    ],
  };
  const file = await installSkill(bundle, target);
  assert.equal(
    await fs.readFile(
      path.join(path.dirname(file), "references/guide.md"),
      "utf8",
    ),
    "Read this guide",
  );
  assert.deepEqual(
    await fs.readFile(path.join(path.dirname(file), "assets/icon.bin")),
    Buffer.from([0, 1, 2, 3]),
  );
  await installSkill(skill, target, { force: true });
  assert.deepEqual(await fs.readdir(path.dirname(file)), ["SKILL.md"]);
});

test("rejects duplicate, overlapping, reserved and escaping file paths before installation", () => {
  for (const files of [
    [{ path: "../outside", content: "bad" }],
    [{ path: "C:/outside", content: "bad" }],
    [{ path: "references/../bad", content: "bad" }],
    [{ path: "skill.md", content: "bad" }],
    [{ path: "CON.txt", content: "bad" }],
    [{ path: "file.", content: "bad" }],
    [
      { path: "A.txt", content: "a" },
      { path: "a.txt", content: "b" },
    ],
    [
      { path: "dir", content: "a" },
      { path: "dir/file", content: "b" },
    ],
    [{ path: "binary", content: "not base64!", encoding: "base64" as const }],
  ])
    assert.throws(() => skillFiles({ ...skill, files }));
  assert.throws(
    () => skillFiles({ ...skill, content: "a".repeat(1024 * 1024 + 1) }),
    /1 MiB/,
  );
});
