import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { lintAxText } from "../src/index.js";

describe("real manifest regressions", () => {
  test("accepts the complete repository example", async () => {
    const source = await readFile(
      new URL("../examples/valid.yaml", import.meta.url),
      "utf8",
    );
    const result = lintAxText(source, {}, "examples/valid.yaml");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.resourceCount).toBe(3);
  });

  test("reports every intentional problem in the invalid example without exposing its value", async () => {
    const source = await readFile(
      new URL("../examples/invalid.yaml", import.meta.url),
      "utf8",
    );
    const result = lintAxText(source, {}, "examples/invalid.yaml");
    expect(result.errors.map((item) => item.ruleId)).toEqual([
      "ax/invalid-reference",
    ]);
    expect(new Set(result.warnings.map((item) => item.ruleId))).toEqual(
      new Set([
        "ax/latest-image",
        "ax/unpinned-image",
        "ax/debug-enabled",
        "ax/possible-inline-secret",
        "ax/missing-resource-limits",
        "ax/unrestricted-egress",
      ]),
    );
    expect(JSON.stringify(result)).not.toContain("replace-me");
  });

  test("fails safely on aliases that exceed the expansion limit", () => {
    const aliases = Array.from(
      { length: 110 },
      (_, index) => `  key${index}: *shared`,
    ).join("\n");
    const result = lintAxText(
      `shared: &shared [one, two]\n${aliases}\n`,
      {},
      "aliases.yaml",
    );
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("reports a scalar document instead of throwing", () => {
    expect(lintAxText("hello\n", {}, "scalar.yaml").errors[0]).toMatchObject({
      ruleId: "contract/document-type",
      location: { line: 1, column: 1 },
    });
  });

  test("accepts free-form model parameters but rejects unknown model fields", () => {
    const source = `apiVersion: ax.io/v1alpha1
kind: Model
metadata:
  name: gemini
spec:
  provider: google
  model: gemini-3.8-flash
  secretKey:
    name: gemini-key
    key: GEMINI_API_KEY
  parameters:
    temperature: 0.9
    nested:
      custom: true
`;
    expect(lintAxText(source).errors).toEqual([]);
    expect(
      lintAxText(
        source.replace(
          "provider: google",
          "provider: google\n  invented: true",
        ),
      ).errors[0]?.ruleId,
    ).toBe("contract/unknown-field");
  });
});
