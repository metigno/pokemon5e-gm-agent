import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GmSaveStore,createCampaign } from '../src/gm-live/save-store.mjs';

test('concurrent saves with same revision never both commit',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'gm-race-'));
 try {
  const store=new GmSaveStore(dir);
  const first=await store.save(createCampaign({protagonist:'Luke',campaignId:'race'}),-1);
  const results=await Promise.allSettled([
   store.save({...first,world:{...first.world,location:'A'}},0),
   store.save({...first,world:{...first.world,location:'B'}},0)
  ]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected').length,1);
  assert.equal((await store.load('race')).revision,1);
 } finally {await rm(dir,{recursive:true,force:true});}
});
