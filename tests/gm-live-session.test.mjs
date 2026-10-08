import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GmSession } from '../src/gm-live/session.mjs';

test('freeform action persists with dice and world state', async () => {
 const dir = await mkdtemp(path.join(tmpdir(),'gm-session-'));
 try {
  const session = new GmSession(dir);
  const game = await session.start('Mattew','test-mattew');
  const updated = await session.record(game.campaignId,0,{
   playerAction:'I sneak through the forest',
   narration:'A branch snaps and a guard hears you',
   statePatch:{world:{day:1,time:'evening',location:'forest',flags:{spotted:true}}},
   dice:{count:1,sides:20,modifier:3}
  });
  const reloaded = await session.get(game.campaignId);
  assert.equal(reloaded.history.length,1);
  assert.equal(reloaded.world.flags.spotted,true);
  assert.ok(updated.rolls[0].total >= 4 && updated.rolls[0].total <= 23);
  await assert.rejects(()=>session.record(game.campaignId,0,{playerAction:'again',narration:'again'}),/conflict/);
 } finally { await rm(dir,{recursive:true,force:true}); }
});
