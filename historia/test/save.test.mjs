import test from 'node:test';import assert from 'node:assert/strict';
import {createNewWorldCup} from '../src/new-game.mjs';
import {serializeSave,deserializeSave,makeSaveFilename} from '../src/save.mjs';
const entrants=Array.from({length:32},(_,i)=>({id:'trainer-'+i,rankingPoints:3200-i}));
test('save roundtrip preserves seed, draw, schedule and metadata',()=>{const cup=createNewWorldCup(entrants);const json=serializeSave(cup,{createdAt:'2060-01-01'});const restored=deserializeSave(json);assert.deepEqual(restored.cup,cup);assert.equal(restored.meta.createdAt,'2060-01-01')});
test('save detects tampering',()=>{const cup=createNewWorldCup(entrants);const envelope=JSON.parse(serializeSave(cup));envelope.payload.cup.seed+=1;assert.throws(()=>deserializeSave(JSON.stringify(envelope)),/Corrupted/)});
test('save rejects invalid slots',()=>{const cup=createNewWorldCup(entrants);assert.equal(makeSaveFilename(cup,1),'historia-slot-1.json');assert.throws(()=>makeSaveFilename(cup,4))});
test('save rejects missing battle receipts',()=>{const cup=createNewWorldCup(entrants);cup.schedule[0].status='complete';assert.throws(()=>serializeSave(cup),/Incomplete battle receipt/)});
