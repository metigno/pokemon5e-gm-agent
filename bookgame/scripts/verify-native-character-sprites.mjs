#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyOfflineNativeCharacterSprites } from '../src/assets/native-character-sprites.mjs';

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 0 && (args.length !== 2 || args[0] !== '--dir')) {
    throw new Error('Usage: node scripts/verify-native-character-sprites.mjs [--dir path]');
  }
  const directory = args.length ? resolve(args[1])
    : fileURLToPath(new URL('../assets/characters/files/', import.meta.url));
  const registry = JSON.parse(await readFile(new URL('../content/npcs/NPC_CHARACTER_LIBRARY_V1.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(await readFile(new URL('../assets/characters/native-sprites.json', import.meta.url), 'utf8'));
  const report = await verifyOfflineNativeCharacterSprites(registry, manifest, directory);
  console.log(JSON.stringify({ valid: report.valid, verified: report.verified,
    expected: report.expected, missing: report.missing }, null, 2));
  if (!report.valid) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
