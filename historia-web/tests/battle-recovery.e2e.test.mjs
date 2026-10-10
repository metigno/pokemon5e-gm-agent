import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ArenaService} from '../battle-service.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function stateUntil(service,id,predicate,timeout=20000){
 const until=Date.now()+timeout;
 while(Date.now()<until){
  const snap=await service.load(id);
  if(snap?.status==='error')throw Error(snap.error);
  if(predicate(snap))return snap;
  await sleep(30);
 }
 throw Error('Timeout waiting for authenticated Showdown request or terminal receipt');
}
test('Actual manual Showdown match resumes after a fresh ArenaService instance, preserving the same public prefix and private turn',{timeout:65000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'historia-restart-service-'));
 let service=new ArenaService(dir);
 try{
  const key='a'.repeat(40);
  const match=await service.create({practice:true,mode:'manual',sessionId:key,npcProfile:'edward'});
  let before=await stateUntil(service,match.id,s=>s?.choices?.length>0);
  // Advance more than one turn, ensuring there are multiple committed choices.
  for(let i=0;i<3;i++){
   const choice=before.choices.find(x=>/^move \d+$/.test(x))||before.choices[0];
   await service.choose(match.id,{choice,requestId:before.requestId});
   before=await stateUntil(service,match.id,s=>s?.requestId>before.requestId && s?.choices?.length>0);
  }
  const id=match.id,publicPrefix=before.log,turn=before.turn,rqid=before.requestId;
  const journal=JSON.parse(await readFile(join(dir,id+'.pending.json'),'utf8'));
  assert.equal(journal.version,1);
  assert.equal(journal.actions.filter(x=>x.side==='p1').length,3);
  assert.equal(journal.seed.length,4);
  assert.equal(journal.publicLog.join('\n'),publicPrefix,'An exposed live spectator log must already exist on disk for deterministic crash restoration');
  assert.ok(journal.p1team.length>0);
  assert.ok(journal.p2team.length>0);
  assert.doesNotMatch(JSON.stringify(before),/p1team|p2team|actions|seed/,'private team ledger must not reach browser');
  if(process.platform!=='win32'){
   const mode=(await stat(join(dir,id+'.pending.json'))).mode&0o777;
   assert.equal(mode,0o600,'The pending journal containing secret teams must be private to server account');
  }
  await service.shutdown();
  service=new ArenaService(dir);
  assert.equal(await service.ownsBattle(id,'b'.repeat(40)),false);
  assert.equal(await service.ownsBattle(id,key),true);
  const active=await stateUntil(service,id,s=>s?.choices?.length>0);
  assert.equal(active.status,'active');
  assert.ok(active.requestId>rqid,'Recovery invalidates stale pre-crash request ids');
  assert.equal(active.turn,turn);
  assert.equal(active.log,publicPrefix);
  assert.deepEqual(active.choices,before.choices);
  await assert.rejects(()=>service.choose(id,{choice:active.choices[0],requestId:rqid}),/obsoleta/,'Stale pre-crash commands must never be replayed as fresh user actions');
  const listed=await service.list(key);
  assert.ok(listed.some(item=>item.id===id && item.status==='active'));
  assert.deepEqual(await service.list('b'.repeat(40)),[]);
  let seen=active;
  const cutoff=Date.now()+35000;
  while(Date.now()<cutoff && seen.status==='active'){
   if(seen.choices?.length){
    const choice=seen.choices.find(x=>/^move \d+$/.test(x))||seen.choices[0];
    await service.choose(id,{choice,requestId:seen.requestId});
   }
   await sleep(30);
   seen=await service.load(id);
  }
  assert.equal(seen.status,'complete',seen.error);
  assert.match(seen.log,/\|win\|/);
  const saved=JSON.parse(await readFile(join(dir,id+'.json'),'utf8'));
  assert.equal(saved.winner,seen.winner);
  await assert.rejects(readFile(join(dir,id+'.pending.json')),e=>e.code==='ENOENT');
 }finally{await service.shutdown();await rm(dir,{force:true,recursive:true});}
});
test('A replay journal with a forged previously published event fails closed; no winner or new choice invented',{timeout:30000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'historia-restart-tamper-'));
 let service=new ArenaService(dir);
 try{
  const match=await service.create({practice:true,mode:'manual',sessionId:'c'.repeat(40)});
  await stateUntil(service,match.id,s=>s?.choices?.length>0&&s?.log?.length>0);
  const filename=join(dir,match.id+'.pending.json');
  const journal=JSON.parse(await readFile(filename,'utf8'));
  journal.publicLog[0]='|FAKE-HISTORIA|';
  await service.shutdown();
  await writeFile(filename,JSON.stringify(journal),'utf8');
  service=new ArenaService(dir);
  await assert.rejects(()=>service.load(match.id),/Recupero rifiutato: log Showdown non deterministico/);
  await assert.rejects(readFile(join(dir,match.id+'.json')),e=>e.code==='ENOENT');
 }finally{await service.shutdown();await rm(dir,{recursive:true,force:true});}
});
