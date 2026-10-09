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

test('Zacian, Zamazenta and Eternatus cannot Dynamax even if a malformed request advertises it',()=>{
 for(const details of ['Zacian','Zacian-Crowned','Zamazenta','Zamazenta-Crowned','Eternatus']){
  const request={active:[{canDynamax:true,moves:[{move:'Tackle',pp:10}]}],side:{pokemon:[{active:true,details,condition:'100/100'}]}};
  assert.deepEqual(legalChoices(request),['move 1'],details);
  assert.throws(()=>validateChoice(request,'move 1 dynamax'),/non legale/);
 }
});
test('Possibly trapped is hidden-information uncertainty, not confirmed trapped',()=>{
 const maybe={...request,active:[{...request.active[0],maybeTrapped:true}]};
 assert.deepEqual(legalChoices(maybe),['move 1','switch 2']);
 const certain={...request,active:[{...request.active[0],trapped:true}]};
 assert.deepEqual(legalChoices(certain),['move 1']);
});
