import test from 'node:test';
import assert from 'node:assert/strict';
import {createGroupSchedule,recordScheduledResult,finalizedGroupStandings} from '../src/schedule.mjs';

const groups=Object.fromEntries('ABCDEFGH'.split('').map(g=>[g,Array.from({length:4},(_,i)=>({id:g+i}))]));
function fixtureResults(wins,differences={}){
 let schedule=createGroupSchedule(groups);
 for(const g of schedule.filter(m=>m.group==='A')){
  const key=[g.homeId,g.awayId].sort().join(':');
  const winningId=wins[key];
  if(!winningId)throw Error('Missing winner '+key);
  const losingId=g.homeId===winningId?g.awayId:g.homeId;
  const delta=differences[key]??2;
  const receipt={authority:'showdown-verified',battleId:'battle-'+g.id,
   logDigest:'sha256:'+g.id,winnerId:winningId,loserId:losingId,
   koDifferential:{[winningId]:delta,[losingId]:-delta}};
  schedule=recordScheduledResult(schedule,g.id,receipt);
 }
 return schedule;
}
test('Group never seeds incomplete fixtures',()=>{
 assert.throws(()=>finalizedGroupStandings(createGroupSchedule(groups),'A'),/sei gli incontri/);
});
test('Three wins sort unambiguously and qualify only completed groups',()=>{
 const wins={};
 for(const a of groups.A)for(const b of groups.A)if(a.id<b.id)wins[a.id+':'+b.id]=a.id;
 const rows=finalizedGroupStandings(fixtureResults(wins),'A');
 assert.deepEqual(rows.map(x=>x.id),['A0','A1','A2','A3']);
 assert.ok(rows.every(x=>x.finalized));
});
test('Three-way cycle uses observed KO differential, not seed or alphabetical tie break',()=>{
 const wins={'A0:A1':'A0','A0:A2':'A2','A1:A2':'A1',
   'A0:A3':'A0','A1:A3':'A1','A2:A3':'A2'};
 const differences={'A0:A1':5,'A0:A2':1,'A1:A2':1,
   'A0:A3':3,'A1:A3':2,'A2:A3':4};
 const rows=finalizedGroupStandings(fixtureResults(wins,differences),'A');
 assert.deepEqual(rows.map(x=>x.id),['A0','A2','A1','A3']);
 const unresolved=fixtureResults(wins,Object.fromEntries(Object.keys(wins).map(k=>[k,6])));
 assert.throws(()=>finalizedGroupStandings(unresolved,'A'),/spareggio Showdown richiesto/);
 for(const game of unresolved.filter(g=>g.group==='A'))delete game.result.koDifferential;
 assert.throws(()=>finalizedGroupStandings(unresolved,'A'),/dati KO verificati mancanti/);
});
test('Head-to-head decides exactly two tied teams',()=>{
 const wins={'A0:A1':'A1','A0:A2':'A0','A0:A3':'A0',
  'A1:A2':'A1','A1:A3':'A1','A2:A3':'A2'};
 // A1 finishes 3-0 and A0 2-1, no tie, direct group rankings remain safe.
 const rows=finalizedGroupStandings(fixtureResults(wins),'A');
 assert.deepEqual(rows.map(x=>x.id),['A1','A0','A2','A3']);
});
