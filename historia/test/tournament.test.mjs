import test from 'node:test';
import assert from 'node:assert/strict';
import {makePots,drawGroups,recordBattle} from '../src/tournament.mjs';
const entrants=Array.from({length:32},(_,i)=>({id:'trainer-'+String(i+1).padStart(2,'0'),rankingPoints:3200-i*10}));
test('four pots ranked by points',()=>{const pots=makePots(entrants);assert.equal(pots.length,4);assert.equal(pots[0][0].id,'trainer-01');assert.equal(pots[3][7].id,'trainer-32')});
test('one player from each pot in every group',()=>{const t=drawGroups(entrants,2060);for(const g of Object.values(t.groups)){assert.equal(g.length,4);assert.deepEqual(g.map(x=>Math.floor((3200-x.rankingPoints)/80)),[0,1,2,3]);}});
test('draw is deterministic and covers every entrant once',()=>{const a=drawGroups(entrants,42),b=drawGroups(entrants,42);assert.deepEqual(a.groups,b.groups);assert.equal(new Set(Object.values(a.groups).flat().map(x=>x.id)).size,32)});
test('reject duplicate entrants and invalid points',()=>{assert.throws(()=>makePots([...entrants.slice(0,31),entrants[0]]));assert.throws(()=>makePots(entrants.map((e,i)=>i?e:{...e,rankingPoints:NaN})))});
test('reject unverified results; accept only declared authority',()=>{const t=drawGroups(entrants,1);assert.throws(()=>recordBattle(t,{battleId:'b1',winnerId:'trainer-01',loserId:'trainer-02'}));const n=recordBattle(t,{battleId:'b1',winnerId:'trainer-01',loserId:'trainer-02',authority:'showdown-verified'});assert.equal(n.results.length,1);assert.throws(()=>recordBattle(n,{battleId:'b1',winnerId:'trainer-01',loserId:'trainer-02',authority:'showdown-verified'}))});
