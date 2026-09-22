import { describe, expect, test } from "vitest";
import { defineRule, lintAxText } from "../src/index.js";

const header = (kind: string, name: string, atespace = "default") =>
  `apiVersion: ax.io/v1alpha1\nkind: ${kind}\nmetadata:\n  name: ${name}\n  atespace: ${atespace}\n`;

describe("lintAxText", () => {
  test("resolves workspace and gateway references within an atespace", () => {
    const source = `${header("Task", "review")}spec:\n  workspaces:\n    - name: repo\n  gateway:\n    name: edge\n---\n${header("Workspace", "repo")}spec: {}\n---\n${header("Gateway", "edge")}spec: {}\n`;
    expect(lintAxText(source).errors).toEqual([]);
  });

  test("reports missing and cross-atespace references as definite errors", () => {
    const source = `${header("Task", "review", "prod")}spec:\n  workspaces:\n    - name: repo\n  gateway:\n    name: edge\n---\n${header("Workspace", "repo", "dev")}spec: {}\n`;
    expect(lintAxText(source).errors.map((item) => item.ruleId)).toEqual([
      "ax/invalid-reference",
      "ax/invalid-reference",
    ]);
  });

  test("reports duplicate resource identities", () => {
    const source = `${header("Gateway", "edge")}spec: {}\n---\n${header("Gateway", "edge")}spec: {}\n`;
    expect(lintAxText(source).errors[0]?.ruleId).toBe("ax/duplicate-resource");
  });

  test("reports security and reliability policy warnings", () => {
    const source = `${header("Task", "review")}spec:\n  image: org/runner:latest\n  debug: true\n  env:\n    - name: API_TOKEN\n      value: super-secret-value\n---\n${header("Gateway", "edge")}spec:\n  egress:\n    allowlist:\n      hosts:\n        - host: "*"\n          port: 443\n`;
    const result = lintAxText(source);
    expect(result.warnings.map((item) => item.ruleId)).toEqual(
      expect.arrayContaining([
        "ax/debug-enabled",
        "ax/missing-resource-limits",
        "ax/latest-image",
        "ax/unpinned-image",
        "ax/possible-inline-secret",
        "ax/unrestricted-egress",
      ]),
    );
    expect(JSON.stringify(result)).not.toContain("super-secret-value");
  });

  test("supports severity overrides and custom rules", () => {
    const custom = defineRule({
      name: "company/no-review",
      defaultSeverity: "warning",
      description: "Example custom policy.",
      check(document, context) {
        if (
          document.value.metadata &&
          (document.value.metadata as { name?: string }).name === "review"
        )
          context.report({
            ruleId: "company/no-review",
            message: "Rename this resource.",
            path: "metadata.name",
            location: document.location("metadata.name"),
          });
      },
    });
    const result = lintAxText(`${header("Task", "review")}spec: {}\n`, {
      rules: { "ax/debug-enabled": "off", "company/no-review": "error" },
      customRules: [custom],
    });
    expect(
      result.errors.some((item) => item.ruleId === "company/no-review"),
    ).toBe(true);
  });

  test("rejects invalid listener ports and duplicates", () => {
    const source = `${header("Gateway", "edge")}spec:\n  listeners:\n    - name: http\n      port: 70000\n      protocol: HTTP\n    - name: other\n      port: 70000\n      protocol: HTTP\n`;
    expect(lintAxText(source).errors.map((item) => item.ruleId)).toEqual(
      expect.arrayContaining(["ax/invalid-listener", "ax/duplicate-listener"]),
    );
  });
});
