import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { lintAx } from "../src/index.js";
import { formatGitHub, formatJson, formatStylish } from "../src/formatters.js";
import { runCli } from "../src/cli-main.js";

const invalid = `apiVersion: ax.io/v1alpha1
kind: Task
metadata:
  name: review
spec:
  debug: true
  workspaces:
    - name: missing
`;

describe("filesystem API", () => {
  test("lints directories and resolves references across files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ax-lint-"));
    await writeFile(
      join(dir, "task.yaml"),
      `apiVersion: ax.io/v1alpha1\nkind: Task\nmetadata:\n  name: review\nspec:\n  workspaces:\n    - name: repo\n`,
    );
    await writeFile(
      join(dir, "workspace.yml"),
      `apiVersion: ax.io/v1alpha1\nkind: Workspace\nmetadata:\n  name: repo\nspec: {}\n`,
    );
    const result = await lintAx(dir, {
      rules: { "ax/missing-resource-limits": "off" },
    });
    expect(result.errors).toEqual([]);
    expect(result.files).toHaveLength(2);
  });

  test("loads an ESM config with rule severity", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ax-lint-config-"));
    const file = join(dir, "ax.yaml");
    await writeFile(file, invalid);
    await writeFile(
      join(dir, "ax-lint.config.mjs"),
      `export default { rules: { "ax/debug-enabled": "error" } };\n`,
    );
    const result = await lintAx(file, { cwd: dir });
    expect(
      result.errors.some((item) => item.ruleId === "ax/debug-enabled"),
    ).toBe(true);
  });
});

describe("formatters", () => {
  test("renders concise stylish output", () => {
    const output = formatStylish(awaitableResult(invalid));
    expect(output).toContain("Task/review");
    expect(output).toContain("✖ Task/review");
    expect(output).toContain('Workspace "missing" does not exist');
    expect(output).toContain("error");
  });

  test("renders stable JSON without source text", () => {
    const output = formatJson(awaitableResult(invalid));
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toHaveProperty("contract.commit");
    expect(parsed).not.toHaveProperty("source");
  });

  test("escapes GitHub workflow commands", () => {
    const result = awaitableResult(
      invalid.replace("missing", "bad%name"),
      "dir/a,b.yaml",
    );
    const output = formatGitHub(result);
    expect(output).toContain("file=dir/a%2Cb.yaml");
    expect(output).toContain("bad%25name");
  });
});

describe("CLI", () => {
  test("uses exit 1 for errors and strict warnings", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ax-lint-cli-"));
    const file = join(dir, "ax.yaml");
    await writeFile(file, invalid);
    const output: string[] = [];
    expect(
      await runCli([file], {
        stdout: (text) => output.push(text),
        stderr: (text) => output.push(text),
        cwd: dir,
      }),
    ).toBe(1);
    await writeFile(
      file,
      `apiVersion: ax.io/v1alpha1\nkind: Task\nmetadata:\n  name: review\nspec: {}\n`,
    );
    expect(
      await runCli(["--strict", file], {
        stdout: () => {},
        stderr: () => {},
        cwd: dir,
      }),
    ).toBe(1);
  });

  test("reports version and pinned contract", async () => {
    const output: string[] = [];
    expect(
      await runCli(["--version"], {
        stdout: (text) => output.push(text),
        stderr: () => {},
        cwd: process.cwd(),
      }),
    ).toBe(0);
    expect(output.join("")).toMatch(/ax-lint 0\.0\.1 .*d8ed0fe38bce/);
  });

  test("uses exit 2 for missing input and exit 3 for unexpected rule failures", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ax-lint-exit-"));
    expect(
      await runCli(["missing.yaml"], {
        stdout: () => {},
        stderr: () => {},
        cwd: dir,
      }),
    ).toBe(2);
    await writeFile(
      join(dir, "ax.yaml"),
      "kind: Task\nmetadata:\n  name: smoke\nspec: {}\n",
    );
    await writeFile(
      join(dir, "ax-lint.config.mjs"),
      `export default { customRules: [{ name: "test/crash", defaultSeverity: "warning", description: "crash", check() { throw new Error("unexpected"); } }] };\n`,
    );
    expect(
      await runCli(["ax.yaml"], {
        stdout: () => {},
        stderr: () => {},
        cwd: dir,
      }),
    ).toBe(3);
  });
});

import { lintAxText as importedLintAxText } from "../src/engine.js";

function awaitableResult(source: string, file = "ax.yaml") {
  return importedLintAxText(source, {}, file);
}
