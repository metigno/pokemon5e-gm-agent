import test from 'node:test';
import assert from 'node:assert/strict';
import { abilityCheck } from '../src/gm-live/ability-check.mjs';

test('proficient check adds ability modifier and proficiency',()=>{
 const result=abilityCheck({score:15,proficiencyBonus:2,proficient:true,dc:14,roll:()=>10});
 assert.equal(result.modifier,4);
 assert.equal(result.total,14);
 assert.equal(result.success,true);
});
test('advantage selects higher and disadvantage lower',()=>{
 const rolls=[4,17];
 assert.equal(abilityCheck({score:10,dc:10,advantage:'advantage',roll:()=>rolls.shift()}).chosen,17);
 const other=[4,17];
 assert.equal(abilityCheck({score:10,dc:10,advantage:'disadvantage',roll:()=>other.shift()}).chosen,4);
});
test('invalid dice are rejected',()=>{
 assert.throws(()=>abilityCheck({score:10,dc:10,roll:()=>21}),/Invalid d20/);
});
