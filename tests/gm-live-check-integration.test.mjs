import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GmTurnCoordinator } from '../src/gm-live/turn-coordinator.mjs';
import { createTrainerCheckAdapter } from '../src/gm-live/trainer-check-adapter.mjs';
import { openingState } from '../src/gm-live/canonical-opening.mjs';

test('canonical trainer check persists the rolled result',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'gm-check-'));
 try {
  const gm=new GmTurnCoordinator({root,engine:createTrainerCheckAdapter(),
   narrator:async({outcome})=>outcome.narration});
  const first=await gm.session.start('Luke','check-test');
  const initialized=await gm.session.record('check-test',first.revision,{
   playerAction:'Initialize canonical sheet',narration:'Intro pending',statePatch:openingState('Luke')
  });
  const turn=await gm.play({campaignId:'check-test',expectedRevision:initialized.revision,
   action:{text:'Try to climb the wall',kind:'trainer-check',ability:'STR',dc:12}});
  assert.equal(turn.status,'committed');
  const saved=await gm.session.get('check-test');
  assert.equal(typeof saved.world.flags.lastTrainerCheck.success,'boolean');
  assert.equal(saved.history.at(-1).playerAction,'Try to climb the wall');
 } finally {await rm(root,{recursive:true,force:true});}
});
test('unsupported combat does not alter save',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'gm-no-combat-'));
 try {
  const gm=new GmTurnCoordinator({root,engine:createTrainerCheckAdapter(),narrator:async()=> 'unused'});
  await gm.session.start('Luke','no-combat');
  const result=await gm.play({campaignId:'no-combat',expectedRevision:0,
   action:{text:'Attack with Growlithe',kind:'combat'}});
  assert.equal(result.status,'rejected');
  assert.equal((await gm.session.get('no-combat')).revision,0);
 } finally {await rm(root,{recursive:true,force:true});}
});
