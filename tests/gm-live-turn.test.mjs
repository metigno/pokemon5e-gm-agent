import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GmTurnCoordinator } from '../src/gm-live/turn-coordinator.mjs';

test('turn saves only after canonical validation and narration',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'gm-turn-'));
 try {
  const gm=new GmTurnCoordinator({root:dir,
   engine:{
    validateAction:async()=>({allowed:true}),
    resolveAction:async()=>({narration:'Mechanics resolved',statePatch:{world:{day:1,time:'noon',location:'Valedarsena',flags:{metFab:true}}}}),
    validateState:async()=>({valid:true})
   },
   narrator:async()=> 'Fab notices your approach.'
  });
  const created=await gm.session.start('Luke','turn-test');
  const result=await gm.play({campaignId:created.campaignId,expectedRevision:0,action:'Speak to Fab'});
  assert.equal(result.status,'committed');
  assert.equal((await gm.session.get('turn-test')).world.flags.metFab,true);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('rejected actions cannot change saves',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'gm-reject-'));
 try {
  const gm=new GmTurnCoordinator({root:dir,
   engine:{validateAction:async()=>({allowed:false,reason:'Not possible'}),resolveAction:async()=>{throw Error('unexpected');},validateState:async()=>({valid:true})},
   narrator:async()=>{throw Error('unexpected');}
  });
  await gm.session.start('Fab','reject-test');
  const result=await gm.play({campaignId:'reject-test',expectedRevision:0,action:'Fly without a Pokemon'});
  assert.equal(result.status,'rejected');
  assert.equal((await gm.session.get('reject-test')).revision,0);
 } finally {await rm(dir,{recursive:true,force:true});}
});
