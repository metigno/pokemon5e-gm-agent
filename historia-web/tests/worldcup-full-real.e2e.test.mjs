import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WorldCupSlots} from '../worldcup-service.mjs';
import {ArenaService} from '../battle-service.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('Entire WHAT-IF World Cup: all 63 actual canonical-roster Showdown results, no fabricated receipts',{timeout:240000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'historia-full-'));
 const owner='f'.repeat(40),slots=new WorldCupSlots(join(dir,'slots'));
 let arena=new ArenaService(join(dir,'battles'));
 try{
  let {cup}=await slots.newHistoricalHypothesis(owner,1);
  const play=async game=>{
   const luke=[game.homeId,game.awayId].includes('Luke');
   const started=await (luke?slots.startLukeFixture(owner,1,game.id,{mode:'auto'},arena):slots.startNpcFixture(owner,1,game.id,{},arena));
   const until=Date.now()+15000;let done;
   while(Date.now()<until){done=await arena.load(started.battle.id);if(done.status!=='active')break;await wait(5);}
   assert.equal(done.status,'complete',`${game.homeId} vs ${game.awayId}: ${done.error||done.status}`);
   assert.match(done.publicLog||done.log,/\|win\|/);
   const finalized=await (luke?slots.finalizeLukeFixture(owner,1,game.id,arena):slots.finalizeNpcFixture(owner,1,game.id,arena));
   cup=finalized.cup;
   assert.equal(finalized.receipt.authority,'showdown-verified');
  };
  for(const game of cup.schedule)await play(game);
  await arena.shutdown();arena=new ArenaService(join(dir,'battles'));
  assert.equal((await new WorldCupSlots(join(dir,'slots')).load(owner,1)).cup.results.length,48);
  let opened=await slots.openKnockout(owner,1);
  while(opened.playoffsPending){cup=opened.cup;for(const game of cup.playoffs.filter(g=>g.status==='scheduled'))await play(game);opened=await slots.openKnockout(owner,1);}
  cup=opened.cup;
  for(const stage of ['round-of-16','quarterfinal','semifinal','final']){
   for(const game of cup.knockout.filter(g=>g.stage===stage))await play(game);
   if(stage!=='final')cup=(await slots.advanceKnockout(owner,1)).cup;
  }
  assert.equal(cup.results.length,63);assert.equal(cup.knockout.length,15);
  assert.equal(new Set(cup.results.map(r=>r.battleId)).size,63);
  assert.ok(cup.champion);
  console.log('REAL WORLD CUP CHAMPION:',cup.champion,'draw:',cup.seed);
 }finally{await arena.shutdown();await rm(dir,{recursive:true,force:true});}
});
