import { createHash } from 'node:crypto';
import { readFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { characterSpritePaths, validPng } from '../../scripts/verify-offline-character-sprites.mjs';

function canonicalEntries(registry) {
  return [...(registry.five ?? []), ...(registry.moduleAnchors ?? []),
    ...(registry.verifiedAdditionalCharacters ?? [])].filter(entry => entry.id);
}

export async function loadAvailableCharacterPortraits(registry, manifest, directory) {
  const expected = new Set(characterSpritePaths(registry));
  const byId = Object.create(null);
  const byName = Object.create(null);
  if (manifest?.schemaVersion !== 1 || !manifest.files || typeof manifest.files !== 'object') {
    return { byId, byName };
  }
  for (const entry of canonicalEntries(registry)) {
    const name = entry.id + '/portrait.png';
    const sha256 = manifest.files[name];
    if (!expected.has(name) || typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) continue;
    try {
      if (!(await lstat(join(directory, entry.id))).isDirectory()) continue;
      if (!(await lstat(join(directory, entry.id, 'portrait.png'))).isFile()) continue;
      const bytes = await readFile(join(directory, entry.id, 'portrait.png'));
      if (!validPng(bytes) || createHash('sha256').update(bytes).digest('hex') !== sha256) continue;
      byId[entry.id] = sha256;
      byName[entry.name] = entry.id;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return { byId, byName };
}

export async function readVerifiedCharacterPortrait(id, available, directory) {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(id) || !Object.hasOwn(available.byId, id)) return null;
  try {
    if (!(await lstat(join(directory, id, 'portrait.png'))).isFile()) return null;
    const bytes = await readFile(join(directory, id, 'portrait.png'));
    return validPng(bytes) && createHash('sha256').update(bytes).digest('hex') === available.byId[id]
      ? bytes : null;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}
