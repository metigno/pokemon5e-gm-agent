import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { characterSpritePaths, validPng, verifyOfflineCharacterSprites } from '../scripts/verify-offline-character-sprites.mjs';

const registryFile = new URL('../content/npcs/NPC_CHARACTER_LIBRARY_V1.json', import.meta.url);
// Solo fixture isolata 1x1: non viene installato alcun placeholder nel gioco.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/vAsAAAAASUVORK5CYII=', 'base64');
const hash = createHash('sha256').update(png).digest('hex');

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'bookgame-character-sprite-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const registry = JSON.parse(await readFile(registryFile, 'utf8'));
  const paths = characterSpritePaths(registry);
  const files = {};
  for (const path of paths) {
    await mkdir(join(dir, path.split('/')[0]));
    await writeFile(join(dir, path), png);
    files[path] = hash;
  }
  return { dir, registry, paths, checksumManifest: { schemaVersion: 1, files } };
}

test('character IDs derive from existing canonical NPC registry', async () => {
  const registry = JSON.parse(await readFile(registryFile, 'utf8'));
  const paths = characterSpritePaths(registry);
  assert.equal(paths.length, 19);
  assert.ok(paths.includes('Luke/portrait.png'));
  assert.ok(paths.includes('Cynthia/portrait.png'));
  assert.ok(paths.includes('SeraNoll/portrait.png'));
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(!paths.some((path) => path.includes('null')));
});

test('complete physically present, SHA-approved package passes offline', async (t) => {
  const f = await fixture(t);
  assert.equal(validPng(png), true);
  const report = await verifyOfflineCharacterSprites(f.registry, f.dir, f.checksumManifest);
  assert.equal(report.valid, true);
  assert.equal(report.verified, 19);
  assert.deepEqual(report.missing, []);
});

test('missing, corrupt, unapproved and mismatching files fail the gate', async (t) => {
  const f = await fixture(t);
  await rm(join(f.dir, 'Luke', 'portrait.png'));
  await writeFile(join(f.dir, 'Mattew', 'portrait.png'), 'not a PNG');
  await writeFile(join(f.dir, 'Blue', 'portrait.png'), Buffer.concat([png, Buffer.from('t')]));
  delete f.checksumManifest.files['N/portrait.png'];
  f.checksumManifest.files['Red/portrait.png'] = '0'.repeat(64);
  f.checksumManifest.files['Unexpected/portrait.png'] = hash;
  const report = await verifyOfflineCharacterSprites(f.registry, f.dir, f.checksumManifest);
  assert.equal(report.valid, false);
  assert.ok(report.missing.includes('Luke/portrait.png'));
  assert.ok(report.invalid.includes('Mattew/portrait.png'));
  assert.ok(report.invalid.includes('Blue/portrait.png'));
  assert.ok(report.unapproved.includes('N/portrait.png'));
  assert.ok(report.checksumMismatch.includes('Red/portrait.png'));
  assert.deepEqual(report.unexpectedPins, ['Unexpected/portrait.png']);
});

test('unapproved real PNG files cannot be marked verified', async (t) => {
  const f = await fixture(t);
  const report = await verifyOfflineCharacterSprites(f.registry, f.dir, null);
  assert.equal(report.valid, false);
  assert.equal(report.verified, 0);
  assert.equal(report.unapproved.length, 19);
});

test('unsafe or duplicated character IDs are rejected', () => {
  assert.throws(() => characterSpritePaths({ version: 1, five: [{ id: 'Luke' }, { id: 'Luke' }] }), /Unsafe/);
  assert.throws(() => characterSpritePaths({ version: 1, five: [{ id: '..' }] }), /Unsafe/);
});
