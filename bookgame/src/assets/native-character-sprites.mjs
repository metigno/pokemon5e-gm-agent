import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { characterSpritePaths, validPng } from '../../scripts/verify-offline-character-sprites.mjs';

export const NATIVE_ROLES = Object.freeze(['battleFront', 'overworld']);

export function validateNativeCharacterManifest(registry, manifest) {
  const canonical = new Set(characterSpritePaths(registry).map(path => path.split('/')[0]));
  if (manifest?.schemaVersion !== 1 || !manifest.entries || typeof manifest.entries !== 'object') {
    throw new Error('Invalid canonical native Trainer sprite manifest');
  }
  const ids = Object.keys(manifest.entries);
  if (ids.length !== canonical.size || ids.some(id => !canonical.has(id))) {
    throw new Error('Native Trainer sprite manifest differs from canonical NPC registry');
  }
  for (const [id, entry] of Object.entries(manifest.entries)) {
    const expectedFrames = id === 'Lance' ? 3 : id === 'KaiaSolari' ? 10 : 9;
    if (entry.frames !== expectedFrames || entry.frameWidth !== 16 || entry.frameHeight !== 32) {
      throw new Error('Unexpected native overworld frames for ' + id);
    }
    for (const role of NATIVE_ROLES) {
      if (entry[role] !== role + '.png' || !/^[a-f0-9]{64}$/.test(entry[role + 'Sha256'] ?? '')) {
        throw new Error('Unapproved native Trainer sprite ' + id + ':' + role);
      }
    }
    if (id === 'KaiaSolari' || id === 'ElioMar' || id === 'SeraNoll') {
      if (entry.sourceClass !== 'neutral-fallback' || entry.approvedIdentity !== false) {
        throw new Error('Generic Trainer art must never claim a canonical identity: ' + id);
      }
    }
  }
  return ids;
}

export async function readVerifiedNativeCharacterSprite(id, role, available, directory) {
  if (!NATIVE_ROLES.includes(role) || !/^[A-Za-z][A-Za-z0-9]*$/.test(id)) return null;
  const entry = available?.[id];
  if (!entry || !Object.hasOwn(entry, role)) return null;
  try {
    const filepath = join(directory, id, role + '.png');
    if (!(await lstat(join(directory, id))).isDirectory() || !(await lstat(filepath)).isFile()) return null;
    const bytes = await readFile(filepath);
    if (!validPng(bytes)) return null;
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    if ((role === 'battleFront' && (width !== 64 || height !== 64)) ||
        (role === 'overworld' && (width !== entry.frames * 16 || height !== 32))) return null;
    if (createHash('sha256').update(bytes).digest('hex') !== entry[role]) return null;
    return bytes;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export async function verifyOfflineNativeCharacterSprites(registry, manifest, directory) {
  const ids = validateNativeCharacterManifest(registry, manifest);
  const available = Object.create(null), missing = [];
  for (const id of ids) {
    const entry = manifest.entries[id];
    const registered = {
      battleFront: entry.battleFrontSha256,
      overworld: entry.overworldSha256,
      frames: entry.frames
    };
    let good = true;
    for (const role of NATIVE_ROLES) {
      if (!await readVerifiedNativeCharacterSprite(id, role, { [id]: registered }, directory)) {
        missing.push(id + '/' + role + '.png');
        good = false;
      }
    }
    if (good) available[id] = registered;
  }
  return { valid: missing.length === 0, expected: ids.length * 2,
    verified: ids.length * 2 - missing.length, missing, available };
}
