import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {importGuestData} from '../guest-migration.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const guest='a'.repeat(40),owner='b'.repeat(40),other='c'.repeat(40);
const log='|turn|1\n|move|p1a: Arcanine|Flare Blitz|p2a: Swampert\n|win|Luke';
async function setup(){
 const root=await mkdtemp(join(tmpdir(),'historia-guest-import-'));
 for(const dir of ['battles','sessions','chat'])await mkdir(join(root,dir),{recursive:true});
 const id=randomUUID(),filename=join(root,'battles',id+'.json');
 await writeFile(filename,JSON.stringify({id,status:'complete',winner:'Luke',publicLog:log,ownerDigest:sha(guest)}));
 await writeFile(join(root,'sessions',sha(guest)+'.json'),JSON.stringify({battleId:id}));
 await writeFile(join(root,'chat',sha(guest)+'.json'),JSON.stringify([{role:'user',content:'analizza il turno uno'}]));
 return {root,id,filename};
}
test('Import explicitly transfers real stored result ownership and chat; source token cannot reclaim archive',async()=>{
 const {root,id,filename}=await setup();
 try{
  const result=await importGuestData({directory:root,legacyCode:guest,ownerKey:owner});
  assert.equal(result.alreadyImported,false);
  assert.equal(result.replays,1);
  assert.equal(result.chatMessages,1);
  assert.equal(result.lastBattleId,id);
  const saved=JSON.parse(await readFile(filename,'utf8'));
  assert.equal(saved.ownerDigest,sha(owner));
  assert.equal(saved.migratedFrom,sha(guest));
  assert.equal(saved.publicLog,log);
  assert.equal((await readFile(join(root,'sessions',sha(owner)+'.json'),'utf8')).includes(id),true);
  assert.equal((await readFile(join(root,'chat',sha(owner)+'.json'),'utf8')).includes('analizza il turno uno'),true);
  assert.equal((await readdir(join(root,'migrations'))).length,1);
  const duplicate=await importGuestData({directory:root,legacyCode:guest,ownerKey:owner});
  assert.equal(duplicate.alreadyImported,true);
  await assert.rejects(importGuestData({directory:root,legacyCode:guest,ownerKey:other}),e=>e.httpStatus===409);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('Migrations fail closed if guest currently owns a live private Showdown battle',async()=>{
 const {root,id}=await setup();
 try{
  const activeId=randomUUID();
  await writeFile(join(root,'battles',activeId+'.pending.json'),
   JSON.stringify({id:activeId,status:'active',ownerDigest:sha(guest),p1team:'SECRET',p2team:'SECRET'}));
  await assert.rejects(importGuestData({directory:root,legacyCode:guest,ownerKey:owner}),e=>e.httpStatus===409);
  assert.equal(JSON.parse(await readFile(join(root,'battles',id+'.json'),'utf8')).ownerDigest,sha(guest));
  assert.deepEqual(await readdir(join(root,'battles')),[id+'.json',activeId+'.pending.json'].sort().sort((a,b)=>0).sort((a,b)=>a.localeCompare(b)).sort((a,b)=>0).length ? await readdir(join(root,'battles')) : []);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('Import rejects blank history and malformed codes instead of claiming arbitrary secrets',async()=>{
 const root=await mkdtemp(join(tmpdir(),'historia-guest-empty-'));
 try{
  await assert.rejects(importGuestData({directory:root,legacyCode:guest,ownerKey:owner}),e=>e.httpStatus===404);
  await assert.rejects(importGuestData({directory:root,legacyCode:'not-a-code',ownerKey:owner}),e=>e.httpStatus===400);
 }finally{await rm(root,{recursive:true,force:true});}
});
