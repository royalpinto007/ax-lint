import { rm } from "node:fs/promises";

await Promise.all(["dist", "coverage"].map((path) => rm(path, { recursive: true, force: true })));
