import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {ArenaService,practiceTeams} from '../battle-service.mjs';
const {Teams}=createRequire(import.meta.url)('pokemon-showdown');
test('A pre-Historia Gen8 journal retains its prior accepted import policy during recovery',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'historia-legacy-')),arena=new ArenaService(dir);
 try{
  const sets=Teams.unpack(practiceTeams().p1);sets[0].species='Mewtwo';sets[1].species='Lugia';sets[1].item='';
  const journal={version:1,id:randomUUID(),ownerDigest:'a'.repeat(64),mode:'manual',npcProfile:'balanced',p1name:'Luke',p2name:'NPC',createdAt:new Date().toISOString(),seed:[1,2,3,4],p1team:Teams.pack(sets),p2team:practiceTeams().p2,actions:[],publicLog:[],requestId:0};
  const restored=await arena.restore(journal);assert.equal(restored.format,'gen8customgame');assert.equal(restored.status,'active');
  const modern={...journal,id:randomUUID(),format:'historia'};
  await assert.rejects(arena.restore(modern),/Massimo un leggendario/);
 }finally{await arena.shutdown();await rm(dir,{recursive:true,force:true});}
});
