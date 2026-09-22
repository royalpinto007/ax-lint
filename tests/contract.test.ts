import { describe, expect, test } from "vitest";
import { validateContract } from "../src/contract/index.js";
import { parseAxSource } from "../src/parser.js";

function validate(source: string) {
  const parsed = parseAxSource(source, "ax.yaml");
  return [...parsed.diagnostics, ...parsed.documents.flatMap(validateContract)];
}

describe("AX v1alpha1 contract", () => {
  test.each(["Task", "Workspace", "Gateway", "Model"])("accepts a minimal %s", (kind) => {
    expect(validate(`apiVersion: ax.io/v1alpha1\nkind: ${kind}\nmetadata:\n  name: example\nspec: {}\n`)).toEqual([]);
  });

  test("rejects unknown fields with their source location", () => {
    expect(validate("apiVersion: ax.io/v1alpha1\nkind: Task\nmetadata:\n  name: example\nspec:\n  imgae: bad\n")[0]).toMatchObject({
      ruleId: "contract/unknown-field",
      path: "spec.imgae",
      location: { line: 6, column: 10 },
    });
  });

  test("rejects unsupported versions and kinds", () => {
    const diagnostics = validate("apiVersion: ax.io/v2\nkind: CronTask\nmetadata:\n  name: example\n");
    expect(diagnostics.map((item) => item.ruleId)).toEqual(["contract/api-version", "contract/kind"]);
  });

  test("requires a resource name", () => {
    expect(validate("apiVersion: ax.io/v1alpha1\nkind: Task\nmetadata: {}\n")[0]?.ruleId).toBe("contract/required-field");
  });

  test("enforces verified task workspace invariants", () => {
    const diagnostics = validate(`apiVersion: ax.io/v1alpha1
kind: Task
metadata:
  name: example
spec:
  workspaces:
    - name: repo
    - name: repo
      path: relative
`);
    expect(diagnostics.map((item) => item.ruleId)).toEqual(expect.arrayContaining(["contract/duplicate-workspace", "contract/workspace-path"]));
  });

  test("does not invent a Task model field", () => {
    const diagnostic = validate("apiVersion: ax.io/v1alpha1\nkind: Task\nmetadata:\n  name: example\nspec:\n  model:\n    name: default\n")[0];
    expect(diagnostic).toMatchObject({ ruleId: "contract/unknown-field", path: "spec.model" });
  });
});
