import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {WorldCupSlots,showdownTrainerName} from '../worldcup-service.mjs';
import {ArenaService,practiceTeams} from '../battle-service.mjs';

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function finishRealBattle(arena,id){
 for(let i=0;i<600;i++){
  const current=await arena.load(id);
  if(current?.status==='complete')return current;
  if(current?.status==='error')throw Error('Showdown failed: '+current.error);
  if(current?.status==='tie')throw Error('Unexpected Showdown tie');
  await delay(100);
 }
 throw Error('Showdown simulation did not finish');
}

test('Showdown display alias does not alter historical tournament identity',()=>{
 assert.equal(showdownTrainerName('Dandel / Leon'),'Dandel Leon');
 assert.equal(showdownTrainerName('Campione di Borrius'),'Campione di Borrius');
});

test('Luke what-if fixture registers only an owner-bound actual Showdown result and cannot be finalized twice', {timeout:90000}, async()=>{
 const directory=await mkdtemp(join(tmpdir(),'historia-luke-cup-'));
 const slots=new WorldCupSlots(join(directory,'worldcups'));
 const arena=new ArenaService(join(directory,'battles'));
 const owner='a'.repeat(40),stranger='b'.repeat(40);
 try{
  const started=await slots.newHistoricalHypothesis(owner,1);
  const lukeGame=started.cup.schedule.find(m=>m.homeId==='Luke'||m.awayId==='Luke');
  const npcGame=started.cup.schedule.find(m=>m.homeId!=='Luke'&&m.awayId!=='Luke');
  const fixtureId=lukeGame.id,teams=practiceTeams();
  await assert.rejects(slots.finalizeLukeFixture(owner,1,fixtureId,arena),/Avvia prima/);
  await assert.rejects(slots.startLukeFixture(owner,1,npcGame.id,{p1team:teams.p1,p2team:teams.p2},arena),/incontri NPC/);
  await assert.rejects(slots.startLukeFixture(stranger,1,fixtureId,{p1team:teams.p1,p2team:teams.p2},arena),/Slot non occupato/);
  const open=await slots.startLukeFixture(owner,1,fixtureId,{
   p1team:teams.p1,p2team:teams.p2,mode:'auto',npcProfile:'balanced'
  },arena);
  assert.equal(open.resumed,false);
  assert.equal(open.battle.p2name,showdownTrainerName(lukeGame.homeId==='Luke'?lukeGame.awayId:lukeGame.homeId));
  const dup=await slots.startLukeFixture(owner,1,fixtureId,{mode:'auto'},arena);
  assert.equal(dup.resumed,true);
  assert.equal(dup.battle.id,open.battle.id);
  await assert.rejects(slots.finalizeLukeFixture(stranger,1,fixtureId,arena),/Slot non occupato/);
  const completed=await finishRealBattle(arena,open.battle.id);
  assert.ok([completed.p1name,completed.p2name].includes(completed.winner));
  const result=await slots.finalizeLukeFixture(owner,1,fixtureId,arena);
  assert.equal(result.alreadyRecorded,false);
  assert.equal(result.cup.results.length,1);
  const match=result.cup.schedule.find(m=>m.id===fixtureId);
  assert.equal(match.status,'complete');
  assert.equal(match.result.authority,'showdown-verified');
  assert.equal(match.result.battleId,'battle-'+open.battle.id);
  assert.match(match.result.logDigest,/^sha256:[a-f0-9]{64}$/);
  const actualWinningId=completed.winner==='Luke'?'Luke':(lukeGame.homeId==='Luke'?lukeGame.awayId:lukeGame.homeId);
  assert.equal(match.result.winnerId,actualWinningId);
  const repeated=await slots.finalizeLukeFixture(owner,1,fixtureId,arena);
  assert.equal(repeated.alreadyRecorded,true);
  assert.equal(repeated.cup.results.length,1);
  const restored=await new WorldCupSlots(join(directory,'worldcups')).load(owner,1);
  assert.equal(restored.cup.schedule.find(m=>m.id===fixtureId).result.winnerId,actualWinningId);
  assert.equal(restored.cup.results.length,1);
 }finally{await arena.shutdown();await rm(directory,{recursive:true,force:true});}
});
