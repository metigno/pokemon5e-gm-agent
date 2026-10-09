import test from 'node:test';
import assert from 'node:assert/strict';
import {loadHistoricalSeeding,build2060SeedPots} from '../src/seeding.mjs';
const s=loadHistoricalSeeding();
test('2056 ranking snapshot is internally consistent',()=>{assert.equal(s.ranking.length,32);assert.equal(s.ranking[0].id,'Silas Crowe');assert.equal(s.ranking[0].total,69);assert.equal(s.ranking[1].id,'Luke');assert.equal(s.ranking[1].total,66);assert.equal(s.ranking[5].id,'Astrid Vahl');});
test('historical pots are reproducible, not a 2060 qualification assertion',()=>{const pots=build2060SeedPots(s.ranking.map(x=>x.id),s.ranking);assert.equal(pots[0][0].id,'Silas Crowe');assert.equal(pots[3][7].id,'N');assert.equal(s.notQualifiedListFor2060,true)});
test('reject unknown or incomplete 2060 qualifiers',()=>{assert.throws(()=>build2060SeedPots(['Luke'],s.ranking));assert.throws(()=>build2060SeedPots([...s.ranking.slice(0,31).map(x=>x.id),'unknown'],s.ranking))});
