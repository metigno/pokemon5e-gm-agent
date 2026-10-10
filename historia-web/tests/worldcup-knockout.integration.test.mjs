import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {WorldCupSlots} from '../worldcup-service.mjs';
import {ArenaService,practiceTeams} from '../battle-service.mjs';
import {recordScheduledResult} from '../../historia/src/schedule.mjs';
import {recordBattle} from '../../historia/src/tournament.mjs';
import {crownChampion} from '../../historia/src/knockout.mjs';

// Fixtures below are synthetic and exclusively exercise tournament structure.
// They must never be mistaken for an E2E test of 63 genuine Showdown battles.
function fakeReceipt(game,winningId){
 const losingId=game.homeId===winningId?game.awayId:game.homeId;
 const key='fixture-'+game.id;
 return {authority:'showdown-verified',battleId:'battle-'+key,
  logDigest:'sha256:'+createHash('sha256').update(key).digest('hex'),
  winnerId:winningId,loserId:losingId,
  koDifferential:{[winningId]:3,[losingId]:-3}};
}
function finishSynthetic(cup,game,winningId){
 const collection=game.stage==='group'?'schedule':'knockout';
 const receipt=fakeReceipt(game,winningId);
 const next=recordScheduledResult(cup[collection],game.id,receipt);
 return {...recordBattle(cup,receipt),[collection]:next};
}
function seedSyntheticGroupStage(cup){
 const indices=new Map(Object.values(cup.groups).flatMap(members=>members.map((m,index)=>[m.id,index])));
 for(const game of cup.schedule){
  const winner=indices.get(game.homeId)<indices.get(game.awayId)?game.homeId:game.awayId;
  cup=finishSynthetic(cup,game,winner);
 }
 return cup;
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function completed(arena,id){
 for(let i=0;i<550;i++){
  const b=await arena.load(id);
  if(b?.status==='complete')return b;
  if(b?.status==='error'||b?.status==='tie')throw Error('Unusable Showdown result '+b.status);
  await delay(100);
 }
 throw Error('Real Showdown NPC battle did not finish');
}

test('48 recorded group results unlock 15 knockout fixtures; one REAL NPC Showdown battle and rest structural fixtures persist through final', {timeout:90000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'historia-ko-'));
 const owner='e'.repeat(40),stranger='d'.repeat(40);
 const slots=new WorldCupSlots(join(directory,'slots')),arena=new ArenaService(join(directory,'battles'));
 try{
  const initial=await slots.newHistoricalHypothesis(owner,1);
  await assert.rejects(slots.openKnockout(owner,1),/48 incontri/);
  await assert.rejects(slots.openKnockout(stranger,1),/Slot non occupato/);
  const cup=seedSyntheticGroupStage(initial.cup);
  assert.equal(cup.results.length,48);
  await slots.store(owner).write(1,cup,initial.meta);
  const opened=await slots.openKnockout(owner,1);
  assert.equal(opened.cup.knockout.length,8);
  assert.equal(opened.cup.knockout.filter(g=>g.stage==='round-of-16').length,8);
  assert.equal(opened.cup.groupRankings.A.length,4);
  assert.deepEqual(opened.cup.schedule,cup.schedule);
  assert.equal((await slots.openKnockout(owner,1)).alreadyGenerated,true);
  await assert.rejects(slots.advanceKnockout(owner,1),/non completo/);
  const npc=opened.cup.knockout.find(g=>g.homeId!=='Luke'&&g.awayId!=='Luke');
  assert.ok(npc);
  const teams=practiceTeams();
  const started=await slots.startNpcFixture(owner,1,npc.id,{p1team:teams.p1,p2team:teams.p2},arena);
  assert.equal(started.battle.mode,'auto');
  const actual=await completed(arena,started.battle.id);
  const registered=await slots.finalizeNpcFixture(owner,1,npc.id,arena);
  const winner=actual.winner===actual.p1name?npc.homeId:npc.awayId;
  assert.equal(registered.cup.knockout.find(g=>g.id===npc.id).result.winnerId,winner);
  assert.equal(registered.cup.results.length,49);
  await assert.rejects(slots.advanceKnockout(owner,1),/non completo/);
  let state=registered.cup;
  for(const g of state.knockout.filter(g=>g.stage==='round-of-16'&&g.status==='scheduled'))
   state=finishSynthetic(state,g,g.homeId);
  await slots.store(owner).write(1,state,initial.meta);
  for(const [stage,expectedCount] of [['quarterfinal',4],['semifinal',2],['final',1]]){
   const advanced=await slots.advanceKnockout(owner,1);
   assert.equal(advanced.createdStage,stage);
   assert.equal(advanced.cup.knockout.filter(g=>g.stage===stage).length,expectedCount);
   state=advanced.cup;
   for(const g of state.knockout.filter(g=>g.stage===stage))state=finishSynthetic(state,g,g.homeId);
   if(stage==='final')state.champion=crownChampion(state.knockout.filter(g=>g.stage==='final'));
   await slots.store(owner).write(1,state,initial.meta);
  }
  assert.equal(state.results.length,63);
  assert.equal(state.knockout.length,15);
  assert.ok(state.champion);
  await assert.rejects(slots.advanceKnockout(owner,1),/Finale già generata/);
  const recovered=new WorldCupSlots(join(directory,'slots'));
  const saved=await recovered.load(owner,1);
  assert.equal(saved.cup.editionId,initial.cup.editionId);
  assert.equal(saved.cup.seed,initial.cup.seed);
  assert.deepEqual(saved.cup.knockout,state.knockout);
  assert.equal(saved.cup.champion,state.champion);
  assert.equal(saved.cup.results.length,63);
 }finally{await arena.shutdown();await rm(directory,{recursive:true,force:true});}
});

test('Unresolved group tie forbids generating invented knockout qualifiers',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'historia-ko-tie-'));
 const owner='a'.repeat(40),slots=new WorldCupSlots(directory);
 try{
  const created=await slots.newHistoricalHypothesis(owner,2);
  let cup=created.cup;
  const firstGroup=cup.groups.A.map(x=>x.id);
  for(const game of cup.schedule){
   const members=cup.groups[game.group].map(x=>x.id);
   let winner=members.indexOf(game.homeId)<members.indexOf(game.awayId)?game.homeId:game.awayId;
   if(game.group==='A'){
    const [a,b,c]=firstGroup;
    const key=[game.homeId,game.awayId].sort().join('|');
    if(key===[a,b].sort().join('|'))winner=a;
    if(key===[a,c].sort().join('|'))winner=c;
    if(key===[b,c].sort().join('|'))winner=b;
   }
   const receipt=fakeReceipt(game,winner);
   if(game.group==='A')receipt.koDifferential={
    [game.homeId]:winner===game.homeId?6:-6,
    [game.awayId]:winner===game.awayId?6:-6
   };
   cup={...recordBattle(cup,receipt),schedule:recordScheduledResult(cup.schedule,game.id,receipt)};
  }
  await slots.store(owner).write(2,cup,created.meta);
  const pending=await slots.openKnockout(owner,2);
  assert.equal(pending.playoffsPending,true);
  assert.equal(pending.cup.playoffs[0].status,'scheduled');
  assert.equal((await slots.load(owner,2)).cup.knockout,undefined);
 }finally{await rm(directory,{recursive:true,force:true});}
});
