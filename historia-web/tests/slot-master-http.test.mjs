import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('Master HTTP integration sends only active-slot context and persists narrative independently (provider mocked)',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'historia-master-'));
 process.env.HISTORIA_DATA_DIR=dir;process.env.HISTORIA_AUTH_MODE='capability';process.env.NODE_ENV='test';process.env.OPENAI_API_KEY='test-only-no-live-credential';
 const realFetch=globalThis.fetch;let captured;
 globalThis.fetch=async(input,options)=>{
  if(String(input)==='https://api.openai.com/v1/chat/completions'){
   captured=JSON.parse(options.body);
   return new Response(JSON.stringify({choices:[{message:{content:'Intervista prima degli incontri: nessun risultato è stato ancora registrato.'}}]}),{status:200});
  }
  return realFetch(input,options);
 };
 let server;
 try{
  const {handler}=await import('../server.mjs');server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port,owner='e'.repeat(40);
  const call=async(path,body)=>{
   const r=await realFetch(base+path,{method:body?'POST':'GET',headers:{'x-historia-session':owner,origin:base,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
   return {status:r.status,data:await r.json()};
  };
  const slot1=await call('/api/worldcup/slots/1/new-historical-hypothesis',{acknowledgeProvisional:true});assert.equal(slot1.status,201);
  await call('/api/worldcup/slots/2/new-historical-hypothesis',{acknowledgeProvisional:true});
  const answer=await call('/api/chat',{slot:1,message:'Intervista con Luke prima della gara.'});assert.equal(answer.status,200);
  assert.ok(captured.messages[0].content.includes(slot1.data.cup.editionId));
  assert.match(captured.messages[0].content,/Slot attivo/);
  assert.equal((await call('/api/chat?slot=1')).data.messages.length,2);
  assert.equal((await call('/api/chat?slot=2')).data.messages.length,0);
  const saved=await call('/api/worldcup/slots/1');assert.equal(saved.data.cup.results.length,0);assert.equal(saved.data.cup.narrative.events.length,1);
 }finally{globalThis.fetch=realFetch;if(server)await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
