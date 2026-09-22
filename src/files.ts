import { readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { glob } from "tinyglobby";
import { lintParsed } from "./engine.js";
import { parseAxSource } from "./parser.js";
import type { LintFilesOptions, LintOptions, LintResult } from "./types.js";

const CONFIG_NAMES = [
  "ax-lint.config.mjs",
  "ax-lint.config.js",
  "ax-lint.config.cjs",
];

async function loadConfig(
  cwd: string,
  explicit: string | false | undefined,
): Promise<LintOptions> {
  if (explicit === false) return {};
  const candidates = explicit
    ? [resolve(cwd, explicit)]
    : CONFIG_NAMES.map((name) => resolve(cwd, name));
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (!info.isFile()) continue;
      const loaded = (await import(
        `${pathToFileURL(candidate).href}?mtime=${info.mtimeMs}`
      )) as { default?: LintOptions };
      return loaded.default ?? {};
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw new Error(
        `Unable to load config ${candidate}: ${(error as Error).message}`,
        { cause: error },
      );
    }
  }
  if (explicit) throw new Error(`Config file not found: ${explicit}`);
  return {};
}

async function discover(
  inputs: readonly string[],
  cwd: string,
): Promise<string[]> {
  const patterns: string[] = [];
  for (const input of inputs) {
    const absolute = resolve(cwd, input);
    try {
      const info = await stat(absolute);
      if (info.isDirectory())
        patterns.push(
          `${relative(cwd, absolute).replaceAll("\\", "/")}/**/*.{yaml,yml}`,
        );
      else if (info.isFile())
        patterns.push(relative(cwd, absolute).replaceAll("\\", "/"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        patterns.push(isAbsolute(input) ? input : input.replaceAll("\\", "/"));
      else throw error;
    }
  }
  const files = await glob(patterns, {
    cwd,
    absolute: true,
    onlyFiles: true,
    dot: false,
    ignore: ["**/node_modules/**", "**/.git/**"],
  });
  return [...new Set(files.map((file) => resolve(file)))].sort();
}

export async function lintAx(
  input: string | readonly string[],
  options: LintFilesOptions = {},
): Promise<LintResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const files = await discover(
    typeof input === "string" ? [input] : input,
    cwd,
  );
  if (files.length === 0)
    throw new Error("No YAML manifest files matched the input.");
  const config = await loadConfig(cwd, options.configFile);
  const merged: LintOptions = {
    rules: { ...config.rules, ...options.rules },
    customRules: [
      ...(config.customRules ?? []),
      ...(options.customRules ?? []),
    ],
  };
  const parsed = await Promise.all(
    files.map(async (file) => {
      const info = await stat(file);
      if (info.size > 10 * 1024 * 1024)
        throw new Error(`Manifest is larger than 10 MiB: ${file}`);
      return parseAxSource(
        await readFile(file, "utf8"),
        relative(cwd, file) || file,
      );
    }),
  );
  return lintParsed(parsed, merged);
}
