import test from 'node:test';
import assert from 'node:assert/strict';
import {legalChoices,validateChoice} from '../showdown-protocol.mjs';
import {selectTacticalChoice} from '../tactical-ai.mjs';

function fakeRequest(species){
 return {
  active:[{canDynamax:true,moves:[{id:'hydropump',move:'Hydro Pump',pp:5}]}],
  side:{pokemon:[{active:true,details:species+', L100',condition:'100/100'}]}
 };
}
test('Canonical Luke may Dynamax only Gigamax Blastoise, even though engine offers others',()=>{
 const wrong=fakeRequest('Great Tusk');
 assert.ok(legalChoices(wrong).includes('move 1 dynamax'));
 assert.deepEqual(legalChoices(wrong,{dynamaxTarget:'Blastoise'}),['move 1']);
 assert.throws(()=>validateChoice(wrong,'move 1 dynamax',{dynamaxTarget:'Blastoise'}));
 assert.equal(selectTacticalChoice(wrong,{side:'p1',profile:'luke',
  dynamaxTarget:'Blastoise'}),'move 1');
 const right=fakeRequest('Blastoise');
 assert.ok(legalChoices(right,{dynamaxTarget:'Blastoise'}).includes('move 1 dynamax'));
 assert.doesNotThrow(()=>validateChoice(right,'move 1 dynamax',{dynamaxTarget:'Blastoise'}));
});
