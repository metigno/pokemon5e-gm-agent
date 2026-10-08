#!/usr/bin/env node
/** Atomic offline-only installation of an approved canonical Trainer portrait directory. */
import { readFile, mkdir, mkdtemp, copyFile, rename, rm, lstat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { characterSpritePaths, verifyOfflineCharacterSprites } from './verify-offline-character-sprites.mjs';

export async function installOfflineCharacterSprites(sourceDir, targetDir, registry, checksumManifest) {
  const source = resolve(sourceDir), target = resolve(targetDir);
  if (source === target) throw new Error('Source and destination must differ');
  const preflight = await verifyOfflineCharacterSprites(registry, source, checksumManifest);
  if (!preflight.valid) throw new Error('Character sprite preflight failed: ' + JSON.stringify(preflight));
  try { await lstat(target); throw new Error('Destination already exists; never overwrite unverified assets'); }
  catch (error) { if (error?.code !== 'ENOENT') throw error; }
  await mkdir(dirname(target), { recursive: true });
  const staging = await mkdtemp(join(dirname(target), '.character-sprites-'));
  try {
    for (const path of characterSpritePaths(registry)) {
      const id = path.split('/')[0];
      await mkdir(join(staging, id));
      await copyFile(join(source, id, 'portrait.png'), join(staging, id, 'portrait.png'));
    }
    const staged = await verifyOfflineCharacterSprites(registry, staging, checksumManifest);
    if (!staged.valid) throw new Error('Copied character sprite package failed verification');
    await rename(staging, target);
    return staged;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  let source, target, checksums;
  for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i], value = process.argv[++i];
    if (!value) throw new Error('Missing value for ' + key);
    if (key === '--from') source = value;
    else if (key === '--to') target = value;
    else if (key === '--checksums') checksums = value;
    else throw new Error('Unknown argument ' + key);
  }
  if (!source || !target || !checksums) throw new Error('Usage: --from SOURCE --to DESTINATION --checksums APPROVED_SHA256_JSON');
  const registry = JSON.parse(await readFile(new URL('../content/npcs/NPC_CHARACTER_LIBRARY_V1.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(await readFile(resolve(checksums), 'utf8'));
  console.log(JSON.stringify(await installOfflineCharacterSprites(source, target, registry, manifest), null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
