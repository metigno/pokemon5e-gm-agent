import test from 'node:test';import assert from 'node:assert/strict';
import {createRoundOf16,advanceRound,crownChampion} from '../src/knockout.mjs';
const groups=Object.fromEntries('ABCDEFGH'.split('').map(g=>[g,Array.from({length:4},(_,i)=>({id:g+i,finalized:true}))]));
function finish(games){return games.map(m=>({...m,status:'complete',result:{winnerId:m.homeId,loserId:m.awayId,battleId:'battle-'+m.id,authority:'showdown-verified'}}));}
test('round of 16 has eight unique cross-group fixtures',()=>{const games=createRoundOf16(groups);assert.equal(games.length,8);assert.deepEqual([games[0].homeId,games[0].awayId],['A0','B1']);assert.equal(new Set(games.flatMap(x=>[x.homeId,x.awayId])).size,16)});
test('cannot progress without finalized standings or results',()=>{assert.throws(()=>createRoundOf16({...groups,A:groups.A.map(x=>({...x,finalized:false}))}));assert.throws(()=>advanceRound(createRoundOf16(groups),'round-of-16'))});
test('eight, four, two, one, champion',()=>{const r16=finish(createRoundOf16(groups));const q=finish(advanceRound(r16,'round-of-16'));const s=finish(advanceRound(q,'quarterfinal'));const f=finish(advanceRound(s,'semifinal'));assert.equal(q.length,4);assert.equal(s.length,2);assert.equal(f.length,1);assert.equal(crownChampion(f),'A0')});
