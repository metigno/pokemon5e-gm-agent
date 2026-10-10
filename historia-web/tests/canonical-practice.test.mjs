import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ArenaService} from '../battle-service.mjs';
test('Luke normal practice uses exact 2060 roster, while technical fixtures remain explicitly separate',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'historia-practice-')),arena=new ArenaService(dir);
 try{
  const b=await arena.create({mode:'manual',canonicalPractice:true});
  assert.equal(b.p1roster[0].species,'Arcanine-Hisui');
  assert.equal(b.p1roster.find(p=>p.species==='Kilowattrel').item,'Focus Sash');
  assert.equal(b.p1roster.find(p=>p.species==='Blastoise').gigantamax,true);
 }finally{await arena.shutdown();await rm(dir,{recursive:true,force:true});}
});
