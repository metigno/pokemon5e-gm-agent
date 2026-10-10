import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WorldCupSlots,showdownTrainerName} from '../worldcup-service.mjs';
import {ArenaService,practiceTeams} from '../battle-service.mjs';
import {groupStandings} from '../../historia/src/schedule.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function awaitVerifiedBattle(arena,id){
 for(let i=0;i<600;i++){
  const current=await arena.load(id);
  if(current?.status==='complete')return current;
  if(current?.status==='tie')throw Error('Draw requires explicitly decided tiebreak');
  if(current?.status==='error')throw Error('Simulator: '+current.error);
  await sleep(100);
 }
 throw Error('Showdown match timeout');
}

test('NPC vs NPC tournament group result comes ONLY from two real Showdown AIs and survives restart', {timeout:90000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'historia-npc-fixture-'));
 const owner='c'.repeat(40),other='d'.repeat(40);
 const slots=new WorldCupSlots(join(directory,'worldcup'));
 const arena=new ArenaService(join(directory,'battles'));
 try{
  const created=await slots.newHistoricalHypothesis(owner,1);
  const npcFixture=created.cup.schedule.find(m=>m.homeId!=='Luke'&&m.awayId!=='Luke');
  const lukeFixture=created.cup.schedule.find(m=>m.homeId==='Luke'||m.awayId==='Luke');
  const teams=practiceTeams();
  assert.ok(npcFixture);
  await assert.rejects(slots.startNpcFixture(owner,1,lukeFixture.id,teams,arena),/Luke/);
  await assert.rejects(slots.startNpcFixture(other,1,npcFixture.id,teams,arena),/Slot non occupato/);
  await assert.rejects(slots.startNpcFixture(owner,1,npcFixture.id,{p1team:teams.p1},arena),/entrambe/);
  await assert.rejects(slots.finalizeNpcFixture(owner,1,npcFixture.id,arena),/Avvia prima/);
  const begin=await slots.startNpcFixture(owner,1,npcFixture.id,{p1team:teams.p1,p2team:teams.p2},arena);
  assert.equal(begin.resumed,false);
  assert.equal(begin.battle.kind,'worldcup-what-if');
  assert.equal(begin.battle.mode,'auto');
  assert.equal(begin.battle.p1name,showdownTrainerName(npcFixture.homeId));
  assert.equal(begin.battle.p2name,showdownTrainerName(npcFixture.awayId));
  assert.equal(begin.battle.aiProfiles.p1,
   ['luke','mattew','daniel','edward','fab'].includes(npcFixture.homeId.toLowerCase())?npcFixture.homeId.toLowerCase():'balanced');
  const repeatedStart=await slots.startNpcFixture(owner,1,npcFixture.id,{},arena);
  assert.equal(repeatedStart.resumed,true);
  assert.equal(repeatedStart.battle.id,begin.battle.id);
  await assert.rejects(slots.finalizeNpcFixture(other,1,npcFixture.id,arena),/Slot non occupato/);
  const complete=await awaitVerifiedBattle(arena,begin.battle.id);
  assert.ok([complete.p1name,complete.p2name].includes(complete.winner));
  assert.match(complete.publicLog,/\|win\|/);
  const finalized=await slots.finalizeNpcFixture(owner,1,npcFixture.id,arena);
  assert.equal(finalized.alreadyRecorded,false);
  assert.equal(finalized.cup.results.length,1);
  const match=finalized.cup.schedule.find(x=>x.id===npcFixture.id);
  assert.equal(match.status,'complete');
  assert.equal(match.result.authority,'showdown-verified');
  assert.match(match.result.logDigest,/^sha256:[a-f0-9]{64}$/);
  assert.equal(match.result.battleId,'battle-'+begin.battle.id);
  const winningId=complete.winner===complete.p1name?npcFixture.homeId:npcFixture.awayId;
  assert.equal(match.result.winnerId,winningId);
  const table=groupStandings(finalized.cup.schedule,npcFixture.group);
  assert.equal(table.find(row=>row.id===winningId).points,3);
  const duplicate=await slots.finalizeNpcFixture(owner,1,npcFixture.id,arena);
  assert.equal(duplicate.alreadyRecorded,true);
  assert.equal(duplicate.cup.results.length,1);
  const restored=await new WorldCupSlots(join(directory,'worldcup')).load(owner,1);
  assert.equal(restored.cup.schedule.find(x=>x.id===npcFixture.id).result.winnerId,winningId);
  assert.equal(restored.cup.seed,created.cup.seed);
  assert.equal(restored.cup.results.length,1);
  await assert.rejects(slots.startNpcFixture(owner,1,npcFixture.id,teams,arena),/Incontro non disponibile/);
 }finally{await arena.shutdown();await rm(directory,{force:true,recursive:true});}
});

test('NPC fixture creation fails closed on invalid exact teams; never substitutes practice rosters',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'historia-npc-invalid-'));
 const owner='f'.repeat(40);
 const slots=new WorldCupSlots(join(directory,'cup'));
 const arena=new ArenaService(join(directory,'battles'));
 try{
  const {cup}=await slots.newHistoricalHypothesis(owner,2);
  const game=cup.schedule.find(m=>m.homeId!=='Luke'&&m.awayId!=='Luke');
  const teams=practiceTeams();
  await assert.rejects(slots.startNpcFixture(owner,2,game.id,{p1team:'NOT-SHOWDOWN',p2team:teams.p2},arena));
  const state=await slots.load(owner,2);
  assert.equal(state.cup.matchBindings?.[game.id],undefined);
  assert.equal(state.cup.schedule.find(x=>x.id===game.id).status,'scheduled');
  assert.equal(state.cup.results.length,0);
 }finally{await arena.shutdown();await rm(directory,{force:true,recursive:true});}
});
