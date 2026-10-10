import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WorldCupSlots} from '../worldcup-service.mjs';
test('Narrative transcript and verified tournament context belong to one owned slot and survive recreation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'historia-story-')),owner='b'.repeat(40),slots=new WorldCupSlots(dir);
 try{
  await slots.newHistoricalHypothesis(owner,1);await slots.newHistoricalHypothesis(owner,2);
  await slots.appendNarrative(owner,1,{message:'Intervista prima della partita',answer:'Il torneo WHAT-IF deve ancora iniziare.'});
  const saved=await new WorldCupSlots(dir).load(owner,1);
  assert.equal(saved.cup.narrative.chat.length,2);assert.equal(saved.cup.narrative.events.length,1);
  assert.equal((await slots.load(owner,2)).cup.narrative,undefined);
  await assert.rejects(slots.appendNarrative('c'.repeat(40),1,{message:'x',answer:'y'}),/Slot non occupato/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
