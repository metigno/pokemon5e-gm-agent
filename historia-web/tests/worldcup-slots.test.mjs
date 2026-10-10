import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {WorldCupSlots,makeHistoricalHypothesis} from '../worldcup-service.mjs';

test('A noncanonical 2056-ranking hypothesis produces 8 historical seed pots and 48 scheduled fixtures',()=>{
 const cup=makeHistoricalHypothesis();
 assert.equal(cup.scenario.official,false);
 assert.equal(cup.scenario.qualifiersConfirmed,false);
 assert.equal(cup.scenario.source,'historical-seeding-2056');
 assert.equal(cup.year,2060);
 assert.equal(Object.keys(cup.groups).length,8);
 assert.equal(cup.schedule.length,48);
 assert.equal(new Set(cup.schedule.map(m=>m.id)).size,48);
 assert.equal(cup.schedule.every(m=>m.status==='scheduled'&&!m.result),true);
 assert.equal(cup.results.length,0);
 const entries=Object.values(cup.groups).flat();
 assert.equal(entries.length,32);
 assert.equal(new Set(entries.map(e=>e.id)).size,32);
 assert.deepEqual(Object.values(cup.pots).map(p=>p.map(e=>e.historicalRank).sort((a,b)=>a-b)),[
  [1,2,3,4,5,6,7,8],[9,10,11,12,13,14,15,16],
  [17,18,19,20,21,22,23,24],[25,26,27,28,29,30,31,32]
 ]);
});

test('Three owner-isolated slots persist their exact random draws through store recreation; occupied draws cannot silently reroll',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'historia-wc-slots-'));
 try{
  const slotStore=new WorldCupSlots(directory),alice='a'.repeat(40),bob='b'.repeat(40);
  assert.deepEqual((await slotStore.list(alice)).map(x=>x.occupied),[false,false,false]);
  const first=await slotStore.newHistoricalHypothesis(alice,1);
  assert.equal(first.slot,1);
  assert.equal(first.cup.editionId.startsWith('wc-2060-'),true);
  assert.equal(first.cup.schedule.length,48);
  await assert.rejects(slotStore.newHistoricalHypothesis(alice,1),/Slot occupato/);
  await assert.rejects(slotStore.newHistoricalHypothesis(alice,4),/Slot deve/);
  const concurrent=await Promise.allSettled([
   slotStore.newHistoricalHypothesis(alice,2),slotStore.newHistoricalHypothesis(alice,2)
  ]);
  assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(concurrent.filter(r=>r.status==='rejected').length,1);
  const restored=new WorldCupSlots(directory);
  const loaded=await restored.load(alice,1);
  assert.equal(loaded.cup.seed,first.cup.seed);
  assert.deepEqual(loaded.cup.groups,first.cup.groups);
  assert.deepEqual(loaded.cup.schedule,first.cup.schedule);
  assert.equal(loaded.cup.scenario.official,false);
  assert.deepEqual((await restored.list(alice)).map(x=>x.occupied),[true,true,false]);
  assert.deepEqual((await restored.list(bob)).map(x=>x.occupied),[false,false,false]);
  assert.equal(await restored.load(bob,1),null);
  await restored.newHistoricalHypothesis(bob,1);
  assert.equal((await restored.list(bob))[0].occupied,true);
  assert.equal((await restored.list(alice))[2].occupied,false);
 }finally{await rm(directory,{recursive:true,force:true});}
});
