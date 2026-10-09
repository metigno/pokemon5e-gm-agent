import test from 'node:test';
import assert from 'node:assert/strict';
import {legalChoices,validateChoice,selectAiFallback} from '../showdown-protocol.mjs';
const request={active:[{moves:[{move:'Flare Blitz',pp:12},{move:'Protect',pp:0},{move:'Will-O-Wisp',pp:15,disabled:true}]}],side:{pokemon:[{active:true,condition:'100/100'},{active:false,condition:'90/100'},{active:false,condition:'0 fnt'}]}};
test('genera soltanto mosse disponibili e cambi validi',()=>{
 assert.deepEqual(legalChoices(request),['move 1','switch 2']);
 assert.equal(validateChoice(request,'move 1'),'move 1');
 assert.throws(()=>validateChoice(request,'move 2'),/non legale/);
 assert.throws(()=>validateChoice(request,'switch 3'),/non legale/);
});
test('in forceSwitch permette solo cambi',()=>{
 assert.deepEqual(legalChoices({...request,forceSwitch:[true]}),['switch 2']);
});
test('AI fallback sceglie una mossa legale senza inventare risultati',()=>{
 assert.equal(selectAiFallback(request),'move 1');
 assert.equal(selectAiFallback({wait:true}),null);
});
