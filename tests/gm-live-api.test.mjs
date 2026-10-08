import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createGmServer } from '../src/gm-live/api.mjs';

test('authenticated API creates, updates and reloads a campaign',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'gm-api-'));
 const token='test-token-very-long-and-secret';
 const server=createGmServer({root:dir,token});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const call=(route,options={})=>fetch(base+route,{...options,headers:{authorization:'Bearer '+token,'content-type':'application/json',...options.headers}});
 try {
  assert.equal((await fetch(base+'/api/gm/campaigns')).status,401);
  const created=await call('/api/gm/campaigns',{method:'POST',body:JSON.stringify({protagonist:'Luke',campaignId:'luke-1'})});
  assert.equal(created.status,201);
  const action=await call('/api/gm/campaigns/luke-1/actions',{method:'POST',body:JSON.stringify({expectedRevision:1,action:{text:'Win instantly',statePatch:{world:{flags:{champion:true}}}}})});
  assert.equal(action.status,503);
  const loaded=await (await call('/api/gm/campaigns/luke-1')).json();
  assert.equal(loaded.history.length,1);
  assert.equal(loaded.revision,1);
  assert.equal(loaded.character.name,'Luke');
  assert.equal(loaded.team[0].species,'Growlithe');
 } finally {await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
