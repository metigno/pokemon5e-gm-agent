#!/usr/bin/env node
// Native skeleton only; NOT a release build. Actual dist is produced by build.mjs.
import { mkdir, cp } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
await mkdir(join(ROOT, "dist"), { recursive: true });
await cp(join(ROOT, "src/index.html"), join(ROOT, "dist/index.html"));
const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, ["cap", "add", "android"], { cwd: ROOT, stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
