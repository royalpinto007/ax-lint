import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lintAx } from "../dist/index.js";

const result = await lintAx("examples/valid.yaml", { configFile: false });
assert.equal(result.errors.length, 0);
assert.equal(result.warnings.length, 0);
const output = execFileSync(process.execPath, ["dist/cli.js", "--version"], {
  encoding: "utf8",
});
assert.match(output, /ax-lint 0\.0\.1 .*d8ed0fe38bce/);
console.log("package smoke test passed");
