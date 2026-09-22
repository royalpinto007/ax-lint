import type { ParsedDocument } from "./parser.js";

export type Severity = "error" | "warning";
export type RuleSetting = Severity | "warn" | "off";

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface AxDiagnostic {
  ruleId: string;
  severity: Severity;
  message: string;
  path: string;
  location: SourceLocation;
  resource?: { kind: string; name: string; atespace: string };
  category: "contract" | "policy";
}

export interface AxRuleContext {
  documents: readonly ParsedDocument[];
  report(diagnostic: Omit<AxDiagnostic, "category" | "severity"> & { severity?: Severity }): void;
  location(document: ParsedDocument, path: string): SourceLocation;
}

export interface AxRule {
  name: string;
  defaultSeverity: Severity;
  description: string;
  check(document: ParsedDocument, context: AxRuleContext): void;
}

export interface LintOptions {
  rules?: Record<string, RuleSetting>;
  customRules?: readonly AxRule[];
}

export interface LintResult {
  diagnostics: AxDiagnostic[];
  errors: AxDiagnostic[];
  warnings: AxDiagnostic[];
  files: string[];
  resourceCount: number;
  contract: typeof import("./contract/provenance.js").AX_CONTRACT_PROVENANCE;
}
