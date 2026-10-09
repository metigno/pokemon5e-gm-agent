import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('Web HTTP API starts and finishes a real manual Showdown match, publishes verified replay',{timeout:45000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'historia-http-'));
 process.env.HISTORIA_DATA_DIR=dir;
 const {handler}=await import('../server.mjs');
 const server=http.createServer(handler);
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port,sessionId='http-test-session-0123456789';
 const api=async(path,body)=>{const res=await fetch(base+path,body===undefined?undefined:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await res.json();assert.ok(res.ok,JSON.stringify(data));return data;};
 try{
  const status=await api('/api/status');assert.equal(status.showdownIntegrated,true);
  const comp=await api('/api/competition');assert.equal(comp.ranking.length,32);assert.equal(comp.qualifiersConfirmed,false);
  const started=await api('/api/battles',{practice:true,mode:'manual',sessionId});
  assert.match(started.id,/^[a-f0-9-]{36}$/);
  const session=await api('/api/session?sessionId='+sessionId);assert.equal(session.lastBattleId,started.id);
  const end=Date.now()+30000;let done=null,choices=0;
  while(Date.now()<end){
   const current=await api('/api/battles/'+started.id);
   if(current.status==='complete'){done=current;break;}
   if(current.status==='error')throw Error(current.error);
   if(current.choices.length){
    const choice=current.choices.find(x=>/^move \d+$/.test(x))||current.choices[0];
    await api('/api/battles/'+started.id+'/choice',{requestId:current.requestId,choice});
    choices++;
   }
   await sleep(40);
  }
  assert.ok(done,'Official Showdown game did not finish');
  assert.ok(choices>0);
  assert.match(done.log,/\|win\|/);
  assert.ok(['Luke','NPC (allenamento)'].includes(done.winner));
  const history=await api('/api/battles');assert.equal(history.battles.length,1);
  assert.equal(history.battles[0].winner,done.winner);
 }finally{server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
