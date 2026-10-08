import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadAvailableCharacterPortraits, readVerifiedCharacterPortrait } from '../src/assets/character-portraits.mjs';
import { informationRenderers } from '../ui/public/information-renderers.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/vAsAAAAASUVORK5CYII=', 'base64');
const sha = createHash('sha256').update(PNG).digest('hex');
const fixtureRegistry = { version: 1, five: [{ id: 'Luke', name: 'Luke' }, { id: 'Mattew', name: 'Mattew' }] };
const fixtureManifest = { schemaVersion: 1, files: { 'Luke/portrait.png': sha } };
const render = (snapshot) => informationRenderers(snapshot, {
  escapeHtml: (s) => String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;'),
  spriteUrl: (id) => '/sprites/' + id + '/icon',
  playerFacingLabel: String
});

test('14 approved supplied Trainer portraits map only onto canonical 19-character registry', async () => {
  const registry = JSON.parse(await readFile(new URL('../content/npcs/NPC_CHARACTER_LIBRARY_V1.json', import.meta.url)));
  const pins = JSON.parse(await readFile(new URL('../assets/characters/sha256.json', import.meta.url)));
  const canonical = new Set([...registry.five, ...registry.moduleAnchors, ...registry.verifiedAdditionalCharacters]
    .filter(entry => entry.id).map(entry => entry.id + '/portrait.png'));
  assert.equal(canonical.size, 19);
  assert.equal(Object.keys(pins.files).length, 14);
  assert.deepEqual([...canonical].filter(name => !pins.files[name]).sort(), [
    'Blue/portrait.png', 'ElioMar/portrait.png', 'Red/portrait.png',
    'SeraNoll/portrait.png', 'Steven/portrait.png'
  ]);
  for (const [name, hash] of Object.entries(pins.files)) {
    assert.ok(canonical.has(name), 'No extraneous character ' + name);
    assert.match(hash, /^[a-f0-9]{64}$/);
  }
});

test('physical SHA-approved portraits become available; unknown names do not', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'p5e-character-portrait-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'Luke'));
  await writeFile(join(dir, 'Luke', 'portrait.png'), PNG);
  const loaded = await loadAvailableCharacterPortraits(fixtureRegistry, fixtureManifest, dir);
  assert.equal(loaded.byName.Luke, 'Luke');
  assert.equal(loaded.byName.Mattew, undefined);
  assert.deepEqual(await readVerifiedCharacterPortrait('Luke', loaded, dir), PNG);
  assert.equal(await readVerifiedCharacterPortrait('Mattew', loaded, dir), null);
  assert.equal(await readVerifiedCharacterPortrait('../Luke', loaded, dir), null);
  await writeFile(join(dir, 'Luke', 'portrait.png'), Buffer.from('altered pixels'));
  assert.equal(await readVerifiedCharacterPortrait('Luke', loaded, dir), null, 'sha mismatch must never serve');
});

test('people panel includes only verified visible person art and never a broken image', () => {
  const people = [{ name: 'Luke', description: 'Amico', relationship: 'Neutral' },
    { name: 'Blue', description: 'Rivale', relationship: 'Neutral' }];
  const html = render({ information: { people }, assets: { characterPortraits: { Luke: 'Luke' } } }).people();
  assert.match(html, /\/characters\/Luke\/portrait/);
  assert.doesNotMatch(html, /\/characters\/Blue\/portrait/);
  assert.equal((html.match(/character-portrait/g) ?? []).length, 1);
  const absent = render({ information: { people } }).people();
  assert.doesNotMatch(absent, /character-portrait/);
  assert.match(absent, /Blue/);
});

test('invalid source PNG or checksum pin never gets advertised for display', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'p5e-character-denial-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'Luke'));
  await writeFile(join(dir, 'Luke', 'portrait.png'), PNG);
  const corrupted = await loadAvailableCharacterPortraits(fixtureRegistry,
    { schemaVersion: 1, files: { 'Luke/portrait.png': '0'.repeat(64) } }, dir);
  assert.equal(corrupted.byName.Luke, undefined);
  const unapproved = await loadAvailableCharacterPortraits(fixtureRegistry,
    { schemaVersion: 1, files: {} }, dir);
  assert.equal(unapproved.byName.Luke, undefined);
});
