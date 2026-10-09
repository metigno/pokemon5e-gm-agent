import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createGmServer } from '../src/gm-live/api.mjs';
import { createSafeGmAdapters } from '../src/gm-live/bootstrap.mjs';

test('HTTP action passes through server rules, ignores forged statePatch',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'gm-http-safe-'));
 const token='integration-secret-at-least-24-characters';
 const server=createGmServer({root,token,...createSafeGmAdapters()});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const post=(route,body)=>fetch(base+route,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
 try {
  const created=await post('/api/gm/campaigns',{protagonist:'Luke',campaignId:'http-safe'});
  assert.equal(created.status,201);
  const turn=await post('/api/gm/campaigns/http-safe/actions',{
   expectedRevision:1,
   action:{text:'Climb the wall',kind:'trainer-check',ability:'STR',dc:10,
    statePatch:{world:{flags:{champion:true}}}}
  });
  assert.equal(turn.status,200);
  const body=await turn.json();
  assert.equal(body.status,'committed');
  const loaded=await fetch(base+'/api/gm/campaigns/http-safe',{headers:{authorization:'Bearer '+token}});
  const saved=await loaded.json();
  assert.equal(saved.world.flags.champion,undefined);
  assert.equal(typeof saved.world.flags.lastTrainerCheck.success,'boolean');
  assert.equal(saved.revision,2);
 } finally {
  await new Promise(resolve=>server.close(resolve));
  await rm(root,{recursive:true,force:true});
 }
});
