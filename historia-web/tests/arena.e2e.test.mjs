import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const {Teams}=createRequire(import.meta.url)('pokemon-showdown');
import {ArenaService,practiceTeams,validatePackedTeam,summarizeVerifiedLog} from '../battle-service.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function eventually(service,id,timeout=25000,manual=false){
 const end=Date.now()+timeout;let seenChoice=false;
 while(Date.now()<end){
  const state=await service.load(id);
  assert.ok(state,'battle exists');
  if(state.status==='complete'||state.status==='tie'||state.status==='error')return {...state,seenChoice};
  if(manual&&state.request&&state.choices?.length){
   const choice=state.choices.find(x=>/^move \d+$/.test(x))||state.choices[0];
   await service.choose(id,{requestId:state.requestId,choice});
   seenChoice=true;
  }
  await sleep(35);
 }
 throw new Error('Timed out waiting for authentic Showdown completion');
}
test('6v6 roster validation and Item Clause',()=>{
 const {p1}=practiceTeams();
 assert.equal(validatePackedTeam(p1),p1);
 const sets=Teams.unpack(p1);
 sets[1].item='Leftovers';sets[2].item='Leftovers';
 assert.throws(()=>validatePackedTeam(Teams.pack(sets)),/Item Clause/);
 assert.throws(()=>validatePackedTeam(Teams.pack(sets.slice(0,5))),/sei Pokémon/);
});

test('Showdown real 6v6 autonomous battle with persistent replay and server-authored winner',{timeout:40000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'historia-auto-'));
 try{
  const service=new ArenaService(dir),start=await service.create({mode:'auto',practice:true});
  assert.equal(start.mode,'auto');
  const done=await eventually(service,start.id,30000);
  assert.equal(done.status,'complete',done.error||'Showdown did not finish');
  assert.ok(['Luke','NPC (allenamento)'].includes(done.winner));
  assert.match(done.log,/\|win\|/);
  assert.match(done.log,/\|teamsize\|p1\|6/);
  const saved=JSON.parse(await readFile(join(dir,start.id+'.json'),'utf8'));
  assert.equal(saved.winner,done.winner);
  assert.equal(saved.analysis.winner,done.winner);
  assert.ok(saved.analysis.turns>0);
  const restored=new ArenaService(dir);
  assert.equal((await restored.load(start.id)).winner,done.winner);
  assert.equal((await restored.list()).length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Manual Luke choices are legal and lead to an authentic Showdown terminal result',{timeout:40000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'historia-manual-'));
 try{
  const service=new ArenaService(dir),start=await service.create({mode:'manual',practice:true});
  const done=await eventually(service,start.id,30000,true);
  assert.equal(done.status,'complete',done.error||'Showdown did not finish');
  assert.equal(done.seenChoice,true);
  assert.ok(['Luke','NPC (allenamento)'].includes(done.winner));
  assert.equal(summarizeVerifiedLog(done.log).winner,done.winner);
 }finally{await rm(dir,{recursive:true,force:true});}
});
