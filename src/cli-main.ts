import { parseArgs } from "node:util";
import { AX_CONTRACT_PROVENANCE } from "./contract/provenance.js";
import { lintAx } from "./files.js";
import { formatGitHub, formatJson, formatStylish } from "./formatters.js";

export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
  cwd: string;
}

const HELP = `ax-lint - validate Google AX manifests

Usage: ax-lint [options] <file|directory|glob...>

Options:
  --strict           Treat warnings as failures
  --json             Print machine-readable JSON
  --format <format>  stylish, json, or github
  --quiet            Show errors only
  --config <file>    Use a specific config file
  --no-config        Disable config discovery
  --version          Show package and AX contract versions
  --help             Show this help
`;

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        strict: { type: "boolean" },
        json: { type: "boolean" },
        quiet: { type: "boolean" },
        format: { type: "string" },
        config: { type: "string" },
        "no-config": { type: "boolean" },
        version: { type: "boolean", short: "v" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (error) {
    io.stderr(`ax-lint: ${(error as Error).message}\n`);
    return 2;
  }
  if (parsed.values.help) {
    io.stdout(HELP);
    return 0;
  }
  if (parsed.values.version) {
    io.stdout(
      `ax-lint 0.0.1 (AX ${AX_CONTRACT_PROVENANCE.apiVersion} ${AX_CONTRACT_PROVENANCE.commit.slice(0, 12)})\n`,
    );
    return 0;
  }
  if (parsed.positionals.length === 0) {
    io.stderr("ax-lint: provide a manifest file, directory, or glob\n");
    return 2;
  }
  const format = parsed.values.json
    ? "json"
    : (parsed.values.format ?? "stylish");
  if (!["stylish", "json", "github"].includes(format)) {
    io.stderr(`ax-lint: unknown format ${JSON.stringify(format)}\n`);
    return 2;
  }
  try {
    const lintOptions = {
      cwd: io.cwd,
      ...(parsed.values["no-config"]
        ? { configFile: false as const }
        : parsed.values.config
          ? { configFile: parsed.values.config }
          : {}),
    };
    const result = await lintAx(parsed.positionals, lintOptions);
    const output =
      format === "json"
        ? formatJson(result)
        : format === "github"
          ? formatGitHub(result, parsed.values.quiet)
          : formatStylish(result, parsed.values.quiet);
    io.stdout(output);
    return result.errors.length > 0 ||
      (parsed.values.strict === true && result.warnings.length > 0)
      ? 1
      : 0;
  } catch (error) {
    io.stderr(`ax-lint: ${(error as Error).message}\n`);
    return 2;
  }
}
