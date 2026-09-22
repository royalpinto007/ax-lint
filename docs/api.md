# API

## `lintAx(input, options?)`

Reads one or more files, directories, or glob patterns and returns a `Promise<LintResult>`. References are resolved across every discovered document.

## `lintAxText(source, options?, fileName?)`

Synchronously validates one in-memory YAML source. Use this in editors or tools that already own file I/O.

## `defineRule(rule)`

Defines and type-checks a custom policy rule. Rule names use `namespace/rule-name`. A rule receives one parsed AX document and a context containing every document, located reporting, and location lookup.

## `LintResult`

The result contains `diagnostics`, `errors`, `warnings`, `files`, `resourceCount`, and `contract`. Every diagnostic includes severity, category, rule ID, message, YAML path, file, line, and column. Resource diagnostics also identify kind, name, and atespace.

## Contract provenance

`AX_CONTRACT_PROVENANCE` identifies the API version, repository, exact upstream commit, commit time, and source files used to implement the contract snapshot.
