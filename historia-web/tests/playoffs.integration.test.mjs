import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WorldCupSlots} from '../worldcup-service.mjs';
import {ArenaService} from '../battle-service.mjs';
test('WHAT-IF cyclic tie generates persistent playoffs and only real Showdown receipts resolve it',{timeout:30000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'historia-playoff-')),owner='a'.repeat(40);
 const slots=new WorldCupSlots(join(dir,'slots')),arena=new ArenaService(join(dir,'arena'));
 try{
  const initial=await slots.newHistoricalHypothesis(owner,1);const cup=initial.cup;
  // Synthetic group-stage scaffolding specifically forces a cyclic three-way tie.
  for(const game of cup.schedule){
   const ids=cup.groups[game.group].map(x=>x.id),a=ids.indexOf(game.homeId),b=ids.indexOf(game.awayId);
   let winner=Math.min(a,b);
   if(game.group==='A'&&a<3&&b<3)winner=([a,b].includes(0)&&[a,b].includes(2))?2:Math.min(a,b);
   game.status='complete';const w=ids[winner],l=game.homeId===w?game.awayId:game.homeId;
   game.result={authority:'showdown-verified',winnerId:w,loserId:l,battleId:game.id,logDigest:'synthetic-test-only',koDifferential:{[w]:6,[l]:-6}};
  }
  await slots.store(owner).write(1,cup,initial.meta);
  let opened=await slots.openKnockout(owner,1);
  assert.equal(opened.playoffsPending,true);
  const first=opened.cup.playoffs[0];
  assert.equal((await new WorldCupSlots(join(dir,'slots')).openKnockout(owner,1)).cup.playoffs[0].id,first.id);
  let count=0;
  while(opened.playoffsPending){
   const game=opened.cup.playoffs.find(g=>g.status==='scheduled');assert.ok(game);
   const luke=[game.homeId,game.awayId].includes('Luke');
   const started=await (luke?slots.startLukeFixture(owner,1,game.id,{mode:'auto'},arena):slots.startNpcFixture(owner,1,game.id,{},arena));
   for(let i=0;i<1000;i++){const b=await arena.load(started.battle.id);if(b.status==='complete')break;assert.equal(b.status,'active',b.error);await new Promise(r=>setTimeout(r,5));}
   await (luke?slots.finalizeLukeFixture(owner,1,game.id,arena):slots.finalizeNpcFixture(owner,1,game.id,arena));
   opened=await slots.openKnockout(owner,1);assert.ok(++count<=3);
  }
  assert.equal(count,3);assert.equal(opened.cup.knockout.length,8);
  assert.equal(opened.cup.playoffs.every(g=>g.result.authority==='showdown-verified'),true);
 }finally{await arena.shutdown();await rm(dir,{recursive:true,force:true});}
});
