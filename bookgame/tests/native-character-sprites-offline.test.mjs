import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  validateNativeCharacterManifest, verifyOfflineNativeCharacterSprites,
  readVerifiedNativeCharacterSprite
} from '../src/assets/native-character-sprites.mjs';

const registryPath = new URL('../content/npcs/NPC_CHARACTER_LIBRARY_V1.json', import.meta.url);
const nativePath = new URL('../assets/characters/native-sprites.json', import.meta.url);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(name, payload) {
  const tag = Buffer.from(name);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(payload.length);
  const digest = Buffer.alloc(4);
  digest.writeUInt32BE(crc32(Buffer.concat([tag, payload])));
  return Buffer.concat([len, tag, payload, digest]);
}

function makePng(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (width * 4 + 1), 0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) raw[y * (width * 4 + 1) + 1 + x * 4 + 3] = 255;
  }
  return Buffer.concat([signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

async function fixture(t) {
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const approved = JSON.parse(await readFile(nativePath, 'utf8'));
  const manifest = structuredClone(approved);
  const dir = await mkdtemp(join(tmpdir(), 'trainer-native-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [id, entry] of Object.entries(manifest.entries)) {
    const battle = makePng(64, 64);
    const overworld = makePng(entry.frames * 16, 32);
    await mkdir(join(dir, id));
    await writeFile(join(dir, id, 'battleFront.png'), battle);
    await writeFile(join(dir, id, 'overworld.png'), overworld);
    entry.battleFrontSha256 = sha256(battle);
    entry.overworldSha256 = sha256(overworld);
  }
  return { registry, approved, manifest, dir };
}

test('19 named IDs, complete native SHA pins, source class honesty and Lance frames', async () => {
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const manifest = JSON.parse(await readFile(nativePath, 'utf8'));
  assert.equal(validateNativeCharacterManifest(registry, manifest).length, 19);
  assert.equal(manifest.entries.Lance.frames, 3);
  assert.equal(manifest.entries.KaiaSolari.frames, 10);
  const generic = Object.entries(manifest.entries).filter(([, entry]) => entry.sourceClass === 'neutral-fallback');
  assert.deepEqual(generic.map(([id]) => id).sort(), ['ElioMar', 'KaiaSolari', 'SeraNoll']);
});

test('physically complete 19-person native fixture passes 38 PNG SHA checks', async t => {
  const f = await fixture(t);
  const checked = await verifyOfflineNativeCharacterSprites(f.registry, f.manifest, f.dir);
  assert.equal(checked.valid, true);
  assert.equal(checked.expected, 38);
  assert.equal(checked.verified, 38);
  assert.deepEqual(checked.missing, []);
  assert.ok((await readVerifiedNativeCharacterSprite('Luke','battleFront',checked.available,f.dir)).length > 100);
  assert.ok((await readVerifiedNativeCharacterSprite('Lance','overworld',checked.available,f.dir)).length > 100);
});

test('missing, malformed and checksum-mismatched images fail closed', async t => {
  const f = await fixture(t);
  await rm(join(f.dir, 'Blue','overworld.png'));
  await writeFile(join(f.dir, 'Red','battleFront.png'), Buffer.from('broken'));
  await writeFile(join(f.dir, 'Luke','battleFront.png'), makePng(32,32));
  const checked = await verifyOfflineNativeCharacterSprites(f.registry,f.manifest,f.dir);
  assert.equal(checked.valid,false);
  assert.equal(checked.verified,35);
  assert.deepEqual(checked.missing.sort(), [
    'Blue/overworld.png','Luke/battleFront.png','Red/battleFront.png'
  ].sort());
  assert.equal(await readVerifiedNativeCharacterSprite('Luke','battleFront',checked.available,f.dir),null);
  assert.equal(await readVerifiedNativeCharacterSprite('../Red','battleFront',checked.available,f.dir),null);
  assert.equal(await readVerifiedNativeCharacterSprite('Red','unmappedRole',checked.available,f.dir),null);
});

test('manifest rejects extraneous IDs, fake frame counts and unapproved generic identities', async t => {
  const f = await fixture(t);
  const extra = structuredClone(f.manifest);
  extra.entries.Unrelated = structuredClone(extra.entries.Luke);
  assert.throws(()=>validateNativeCharacterManifest(f.registry,extra),/canonical/);
  const frames = structuredClone(f.manifest);
  frames.entries.Lance.frames = 9;
  assert.throws(()=>validateNativeCharacterManifest(f.registry,frames),/frames/);
  const falseCanon = structuredClone(f.manifest);
  falseCanon.entries.KaiaSolari.approvedIdentity = true;
  assert.throws(()=>validateNativeCharacterManifest(f.registry,falseCanon),/Generic/);
});

test('existing client/server integrate Trainer battle and overworld routes without external URLs', async () => {
  const server = await readFile(new URL('../ui/server.mjs', import.meta.url),'utf8');
  const app = await readFile(new URL('../ui/public/app.mjs', import.meta.url),'utf8');
  const info = await readFile(new URL('../ui/public/information-renderers.mjs',import.meta.url),'utf8');
  assert.match(server, /readVerifiedNativeCharacterSprite/);
  assert.match(server, /P5E_REQUIRE_OFFLINE_CHARACTERS/);
  assert.match(server, /visibleNativeCharacters/);
  assert.match(app, /opponentTrainerSprite/);
  assert.match(app, /battleFront/);
  assert.match(info, /character-overworld-frame/);
  assert.match(info, /\/overworld/);
  assert.doesNotMatch(info, /<img[^>]*src=["']https?:\/\//, 'Trainer image sources must not use external hosts');
});
