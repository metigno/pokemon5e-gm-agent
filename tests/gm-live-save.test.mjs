import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCampaign, GmSaveStore } from '../src/gm-live/save-store.mjs';

test('GM slot persists state and rejects stale revision', async () => {
 const dir = await mkdtemp(path.join(tmpdir(), 'gm-live-'));
 try {
  const store = new GmSaveStore(dir);
  const game = createCampaign({ protagonist: 'Luke', campaignId: 'campaign-test' });
  assert.equal(await store.load(game.campaignId), null);
  const saved = await store.save(game, -1);
  saved.world.location = 'Kanto';
  saved.history.push({ action: 'Travel to Kanto', outcome: 'arrived' });
  const updated = await store.save(saved, 0);
  assert.equal((await store.load(game.campaignId)).history.length, 1);
  assert.equal(updated.world.location, 'Kanto');
  await assert.rejects(() => store.save(saved, 0), /conflict/);
 } finally { await rm(dir, { recursive: true, force: true }); }
});
test('path traversal is rejected', () => {
 assert.throws(() => createCampaign({ protagonist: 'Fab', campaignId: '../bad' }), /Invalid campaign id/);
});
