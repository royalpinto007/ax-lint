import { describe, expect, test } from "vitest";
import { parseAxSource } from "../src/parser.js";

describe("parseAxSource", () => {
  test("parses multiple documents and preserves source locations", () => {
    const source = "apiVersion: ax.io/v1alpha1\nkind: Task\nmetadata:\n  name: one\n---\nkind: Gateway\nmetadata:\n  name: edge\n";
    const parsed = parseAxSource(source, "ax.yaml");
    expect(parsed.documents).toHaveLength(2);
    expect(parsed.documents[0]?.value).toMatchObject({ kind: "Task" });
    expect(parsed.documents[1]?.location("metadata.name")).toMatchObject({ file: "ax.yaml", line: 8, column: 9 });
  });

  test("returns a located syntax diagnostic", () => {
    const parsed = parseAxSource("kind: [Task\n", "broken.yaml");
    expect(parsed.diagnostics[0]).toMatchObject({ ruleId: "contract/yaml-syntax", severity: "error", location: { file: "broken.yaml", line: 2 } });
  });

  test("rejects duplicate mapping keys", () => {
    const parsed = parseAxSource("kind: Task\nkind: Gateway\n", "duplicate.yaml");
    expect(parsed.diagnostics.some((item) => item.ruleId === "contract/yaml-syntax")).toBe(true);
  });

  test("ignores empty documents", () => {
    expect(parseAxSource("---\n# empty\n---\nkind: Task\n", "ax.yaml").documents).toHaveLength(1);
  });
});
