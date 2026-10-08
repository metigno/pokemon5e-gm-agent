#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyOfflineSecondaryNpcAssets } from "../src/assets/npc-secondary-assets.mjs";

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--dir")) {
  throw new Error("Usage: node scripts/verify-secondary-npc-sprites.mjs [--dir /path]");
}
const dir = args.length ? resolve(args[1]) : join(repo, "assets/npc-sprites");
const registry = JSON.parse(await readFile(join(repo, "content/npcs/NPC_CHARACTER_LIBRARY_V1.json")));
const result = await verifyOfflineSecondaryNpcAssets(registry, dir);
console.log(JSON.stringify({ valid: result.valid, expected: result.expected,
  verified: result.verified, missing: result.missing }, null, 2));
if (!result.valid) process.exitCode = 1;
