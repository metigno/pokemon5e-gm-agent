#!/usr/bin/env node
/** Audit del pacchetto di sprite Trainer. Nessun asset fittizio o download remoto. */
import { readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const registryUrl = new URL('../content/npcs/NPC_CHARACTER_LIBRARY_V1.json', import.meta.url);
const defaultDir = fileURLToPath(new URL('../assets/characters/files/', import.meta.url));
const defaultChecksums = fileURLToPath(new URL('../assets/characters/sha256.json', import.meta.url));
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function characterSpritePaths(registry) {
  if (!registry || registry.version !== 1) throw new Error('Unsupported character registry');
  const ids = [
    ...(registry.five ?? []).map((entry) => entry.id),
    ...(registry.moduleAnchors ?? []).map((entry) => entry.id).filter(Boolean),
    ...(registry.verifiedAdditionalCharacters ?? []).map((entry) => entry.id)
  ];
  if (ids.length !== new Set(ids).size || ids.some((id) => !/^[A-Za-z][A-Za-z0-9]*$/.test(id))) {
    throw new Error('Unsafe or duplicated character sprite ID');
  }
  return ids.map((id) => id + '/portrait.png').sort();
}

export function validPng(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 57 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return false;
  let offset = 8, ihdr = false, idat = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return false;
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (!ihdr && (type !== 'IHDR' || length !== 13 || bytes.readUInt32BE(offset + 8) === 0 || bytes.readUInt32BE(offset + 12) === 0)) return false;
    if (type === 'IHDR') {
      if (ihdr || offset !== 8) return false;
      ihdr = true;
    }
    if (type === 'IDAT') idat = true;
    if (type === 'IEND') return length === 0 && ihdr && idat && end === bytes.length;
    offset = end;
  }
  return false;
}

export async function verifyOfflineCharacterSprites(registry, directory, checksumManifest) {
  const paths = characterSpritePaths(registry);
  const checksums = checksumManifest?.schemaVersion === 1 && checksumManifest.files &&
    typeof checksumManifest.files === 'object' ? checksumManifest.files : {};
  const unexpectedPins = Object.keys(checksums).filter((key) => !paths.includes(key));
  const result = { expected: paths.length, verified: 0, missing: [], invalid: [],
    unapproved: [], checksumMismatch: [], unexpectedPins, valid: false };
  for (const path of paths) {
    const id = path.split('/')[0];
    const wanted = checksums[path];
    if (typeof wanted !== 'string' || !/^[a-f0-9]{64}$/.test(wanted)) result.unapproved.push(path);
    try {
      const folder = await lstat(join(directory, id));
      const file = await lstat(join(directory, id, 'portrait.png'));
      if (!folder.isDirectory() || !file.isFile()) { result.invalid.push(path); continue; }
      const bytes = await readFile(join(directory, id, 'portrait.png'));
      if (!validPng(bytes)) { result.invalid.push(path); continue; }
      if (typeof wanted === 'string' && /^[a-f0-9]{64}$/.test(wanted)) {
        if (createHash('sha256').update(bytes).digest('hex') !== wanted) {
          result.checksumMismatch.push(path);
          continue;
        }
        result.verified++;
      }
    } catch (error) {
      if (error?.code === 'ENOENT') result.missing.push(path);
      else throw error;
    }
  }
  result.valid = result.verified === paths.length && !result.missing.length &&
    !result.invalid.length && !result.unapproved.length &&
    !result.checksumMismatch.length && !result.unexpectedPins.length;
  return result;
}

async function main() {
  let directory = defaultDir, checksumsPath = defaultChecksums;
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--dir' && process.argv[i + 1]) directory = resolve(process.argv[++i]);
    else if (process.argv[i] === '--checksums' && process.argv[i + 1]) checksumsPath = resolve(process.argv[++i]);
    else throw new Error('Unknown argument: ' + process.argv[i]);
  }
  const registry = JSON.parse(await readFile(registryUrl, 'utf8'));
  let pinned = null;
  try { pinned = JSON.parse(await readFile(checksumsPath, 'utf8')); }
  catch (error) { if (error?.code !== 'ENOENT') throw error; }
  const result = await verifyOfflineCharacterSprites(registry, directory, pinned);
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
