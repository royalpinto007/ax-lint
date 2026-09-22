export { lintAxText, defineRule } from "./engine.js";
export { lintAx } from "./files.js";
export { builtinRules } from "./rules/builtin.js";
export { AX_CONTRACT_PROVENANCE } from "./contract/provenance.js";
export type {
  AxDiagnostic,
  AxRule,
  AxRuleContext,
  LintFilesOptions,
  LintOptions,
  LintResult,
  RuleSetting,
  Severity,
  SourceLocation,
} from "./types.js";
