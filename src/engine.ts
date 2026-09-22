import { validateContract } from "./contract/index.js";
import { AX_CONTRACT_PROVENANCE } from "./contract/provenance.js";
import { parseAxSource, type ParsedDocument } from "./parser.js";
import { builtinRules } from "./rules/builtin.js";
import type {
  AxDiagnostic,
  AxRule,
  LintOptions,
  LintResult,
  RuleSetting,
  Severity,
} from "./types.js";

function identity(
  document: ParsedDocument,
): { kind: string; name: string; atespace: string } | undefined {
  const metadata = document.value.metadata;
  if (
    typeof document.value.kind !== "string" ||
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  )
    return undefined;
  const item = metadata as Record<string, unknown>;
  if (typeof item.name !== "string") return undefined;
  return {
    kind: document.value.kind,
    name: item.name,
    atespace:
      typeof item.atespace === "string" && item.atespace
        ? item.atespace
        : "default",
  };
}

function definite(
  document: ParsedDocument,
  ruleId: string,
  message: string,
  path: string,
): AxDiagnostic {
  const diagnostic: AxDiagnostic = {
    ruleId,
    severity: "error",
    category: "contract",
    message,
    path,
    location: document.location(path.replace(/\[(\d+)\]/g, ".$1")),
  };
  const resource = identity(document);
  if (resource) diagnostic.resource = resource;
  return diagnostic;
}

function validateResources(documents: ParsedDocument[]): AxDiagnostic[] {
  const output: AxDiagnostic[] = [];
  const resources = new Map<string, ParsedDocument>();
  for (const document of documents) {
    const id = identity(document);
    if (!id) continue;
    const key = `${id.atespace}\0${id.kind}\0${id.name}`;
    if (resources.has(key))
      output.push(
        definite(
          document,
          "ax/duplicate-resource",
          `Duplicate ${id.kind} ${JSON.stringify(id.name)} in atespace ${JSON.stringify(id.atespace)}.`,
          "metadata.name",
        ),
      );
    else resources.set(key, document);
  }
  for (const document of documents) {
    const id = identity(document);
    if (!id || id.kind !== "Task") continue;
    const spec = document.value.spec as Record<string, unknown> | undefined;
    if (Array.isArray(spec?.workspaces))
      spec.workspaces.forEach((raw, index) => {
        const name =
          raw && typeof raw === "object"
            ? (raw as { name?: unknown }).name
            : undefined;
        if (
          typeof name === "string" &&
          !resources.has(`${id.atespace}\0Workspace\0${name}`)
        )
          output.push(
            definite(
              document,
              "ax/invalid-reference",
              `Workspace ${JSON.stringify(name)} does not exist in atespace ${JSON.stringify(id.atespace)}.`,
              `spec.workspaces[${index}].name`,
            ),
          );
      });
    const gateway = spec?.gateway as Record<string, unknown> | undefined;
    if (
      typeof gateway?.name === "string" &&
      !resources.has(`${id.atespace}\0Gateway\0${gateway.name}`)
    )
      output.push(
        definite(
          document,
          "ax/invalid-reference",
          `Gateway ${JSON.stringify(gateway.name)} does not exist in atespace ${JSON.stringify(id.atespace)}.`,
          "spec.gateway.name",
        ),
      );
  }
  for (const document of documents) {
    if (document.value.kind !== "Gateway") continue;
    const spec = document.value.spec as Record<string, unknown> | undefined;
    if (!Array.isArray(spec?.listeners)) continue;
    const names = new Set<string>();
    const ports = new Set<number>();
    spec.listeners.forEach((raw, index) => {
      if (!raw || typeof raw !== "object") return;
      const item = raw as Record<string, unknown>;
      if (typeof item.port === "number" && (item.port < 1 || item.port > 65535))
        output.push(
          definite(
            document,
            "ax/invalid-listener",
            `Listener port ${item.port} is outside 1-65535.`,
            `spec.listeners[${index}].port`,
          ),
        );
      if (typeof item.name === "string" && names.has(item.name))
        output.push(
          definite(
            document,
            "ax/duplicate-listener",
            `Listener name ${JSON.stringify(item.name)} is duplicated.`,
            `spec.listeners[${index}].name`,
          ),
        );
      if (typeof item.port === "number" && ports.has(item.port))
        output.push(
          definite(
            document,
            "ax/duplicate-listener",
            `Listener port ${item.port} is duplicated.`,
            `spec.listeners[${index}].port`,
          ),
        );
      if (typeof item.name === "string") names.add(item.name);
      if (typeof item.port === "number") ports.add(item.port);
    });
  }
  return output;
}

function severity(
  setting: RuleSetting | undefined,
  fallback: Severity,
): Severity | "off" {
  if (setting === "off") return "off";
  if (setting === "error") return "error";
  if (setting === "warning" || setting === "warn") return "warning";
  return fallback;
}

export function defineRule<T extends AxRule>(rule: T): T {
  if (!/^[a-z0-9-]+\/[a-z0-9-]+$/u.test(rule.name))
    throw new Error(`Invalid rule name ${JSON.stringify(rule.name)}.`);
  return rule;
}

export function lintParsed(
  inputs: ReturnType<typeof parseAxSource>[],
  options: LintOptions = {},
): LintResult {
  const documents = inputs.flatMap((input) => input.documents);
  const diagnostics: AxDiagnostic[] = inputs.flatMap(
    (input) => input.diagnostics,
  );
  diagnostics.push(
    ...documents.flatMap(validateContract),
    ...validateResources(documents),
  );
  for (const rule of [...builtinRules, ...(options.customRules ?? [])]) {
    const configured = severity(
      options.rules?.[rule.name],
      rule.defaultSeverity,
    );
    if (configured === "off") continue;
    for (const document of documents) {
      rule.check(document, {
        documents,
        location: (target, path) =>
          target.location(path.replace(/\[(\d+)\]/g, ".$1")),
        report(item) {
          const diagnostic: AxDiagnostic = {
            ...item,
            severity: configured,
            category: "policy",
          };
          const resource = identity(document);
          if (resource) diagnostic.resource = resource;
          diagnostics.push(diagnostic);
        },
      });
    }
  }
  diagnostics.sort(
    (a, b) =>
      a.location.file.localeCompare(b.location.file) ||
      a.location.line - b.location.line ||
      a.location.column - b.location.column ||
      a.ruleId.localeCompare(b.ruleId),
  );
  return {
    diagnostics,
    errors: diagnostics.filter((item) => item.severity === "error"),
    warnings: diagnostics.filter((item) => item.severity === "warning"),
    files: [
      ...new Set(
        inputs
          .flatMap((input) => input.documents.map((document) => document.file))
          .concat(diagnostics.map((item) => item.location.file)),
      ),
    ],
    resourceCount: documents.length,
    contract: AX_CONTRACT_PROVENANCE,
  };
}

export function lintAxText(
  source: string,
  options: LintOptions = {},
  file = "<input>",
): LintResult {
  return lintParsed([parseAxSource(source, file)], options);
}
