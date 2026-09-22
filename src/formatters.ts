import type { AxDiagnostic, LintResult } from "./types.js";

function resourceLabel(item: AxDiagnostic): string {
  return item.resource
    ? `${item.resource.kind}/${item.resource.name}`
    : item.path || "manifest";
}

export function formatStylish(result: LintResult, quiet = false): string {
  const diagnostics = quiet ? result.errors : result.diagnostics;
  if (diagnostics.length === 0)
    return `✓ ${result.files.length} file${result.files.length === 1 ? "" : "s"} passed\n`;
  const grouped = new Map<string, AxDiagnostic[]>();
  for (const item of diagnostics) {
    const key = `${item.location.file}\0${resourceLabel(item)}`;
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  const lines: string[] = [];
  for (const [key, items] of grouped) {
    const [file, label] = key.split("\0");
    lines.push(
      file ?? "<input>",
      "",
      `${items[0]?.severity === "error" ? "✖" : "⚠"} ${label ?? "manifest"}`,
    );
    for (const item of items)
      lines.push(
        `  ${item.location.line}:${item.location.column}  ${item.severity.padEnd(7)}  ${item.message}  ${item.ruleId}`,
      );
    lines.push("");
  }
  lines.push(
    `${result.errors.length} error${result.errors.length === 1 ? "" : "s"} · ${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}`,
    "",
  );
  return lines.join("\n");
}

export function formatJson(result: LintResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

function escapeData(value: string): string {
  return value
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

function escapeProperty(value: string): string {
  return escapeData(value).replaceAll(":", "%3A").replaceAll(",", "%2C");
}

export function formatGitHub(result: LintResult, quiet = false): string {
  const diagnostics = quiet ? result.errors : result.diagnostics;
  return (
    diagnostics
      .map(
        (item) =>
          `::${item.severity === "error" ? "error" : "warning"} file=${escapeProperty(item.location.file)},line=${item.location.line},col=${item.location.column},title=${escapeProperty(item.ruleId)}::${escapeData(item.message)}`,
      )
      .join("\n") + (diagnostics.length ? "\n" : "")
  );
}
