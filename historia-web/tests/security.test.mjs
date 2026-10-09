import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,stat,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {makeSecurityHeaders,isSameOriginMutation,makeRateLimiter} from '../security.mjs';

test('Hashed CSP allows only the exact app script/style, with no unsafe-inline, framing, objects or arbitrary network',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const headers=makeSecurityHeaders(html);
 assert.doesNotMatch(headers['content-security-policy'],/unsafe-inline|unsafe-eval|script-src \*|connect-src https?:/);
 assert.match(headers['content-security-policy'],/connect-src 'self'/);
 assert.match(headers['content-security-policy'],/frame-ancestors 'none'/);
 assert.match(headers['content-security-policy'],/https:\/\/play\.pokemonshowdown\.com/);
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const hash=createHash('sha256').update(script).digest('base64');
 assert.ok(headers['content-security-policy'].includes("'sha256-"+hash+"'"));
 assert.equal(headers['x-frame-options'],'DENY');
 assert.equal(headers['referrer-policy'],'no-referrer');
 assert.equal(headers['cache-control'],'no-store');
 assert.doesNotMatch(html,/<code[^>]+style=/,'No inline style must be silently blocked');
});
test('Browser POST origin rule rejects cross-site and null origins, accepts same origin and native clients',()=>{
 const mock=(host,origin,site)=>({headers:{host,...(origin==null?{}:{origin}),...(site?{'sec-fetch-site':site}:{})}});
 assert.equal(isSameOriginMutation(mock('127.0.0.1:3000','http://127.0.0.1:3000','same-origin')),true);
 assert.equal(isSameOriginMutation(mock('127.0.0.1:3000','https://attacker.example','cross-site')),false);
 assert.equal(isSameOriginMutation(mock('127.0.0.1:3000','null','none')),false);
 assert.equal(isSameOriginMutation(mock('127.0.0.1:3000',null,'cross-site')),false);
 assert.equal(isSameOriginMutation(mock('127.0.0.1:3000',null,null)),true);
 assert.equal(isSameOriginMutation(mock('web.example','https://historia.example','same-origin'),{publicOrigin:'https://historia.example'}),true);
});
test('Rate limiter enforces create/chat/choice quota by actual socket IP and resets windows',()=>{
 let now=100000;const limiter=makeRateLimiter({clock:()=>now});
 const req=(method='POST',remoteAddress='127.0.0.1')=>({method,socket:{remoteAddress}});
 for(let i=0;i<3;i++)assert.equal(limiter.check(req(),'/api/auth/import-guest').allowed,true);
 assert.equal(limiter.check(req(),'/api/auth/import-guest').allowed,false);
 for(let i=0;i<8;i++)assert.equal(limiter.check(req(),'/api/battles').allowed,true);
 const blocked=limiter.check(req(),'/api/battles');
 assert.equal(blocked.allowed,false);assert.ok(blocked.retryAfter>=1);
 assert.equal(limiter.check(req(),'\/api/chat').allowed,true);
 assert.equal(limiter.check(req('POST','127.0.0.2'),'/api/battles').allowed,true);
 now+=61000;
 assert.equal(limiter.check(req(),'/api/battles').allowed,true);
});

test('HTTP layer enforces headers, origin, JSON limits, private session files and endpoint quotas',{timeout:35000},async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'historia-security-'));
 process.env.HISTORIA_DATA_DIR=dataDir;
 const {handler}=await import('../server.mjs');
 const server=createServer(handler);
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port,code='d'.repeat(40);
 const post=(route,body,headers={})=>fetch(base+route,{
  method:'POST',
  headers:{'content-type':'application/json','x-historia-session':code,...headers},
  body:JSON.stringify(body)
 });
 try{
  const home=await fetch(base+'/');
  assert.equal(home.status,200);
  assert.match(home.headers.get('content-security-policy'),/script-src 'sha256-/);
  assert.equal(home.headers.get('x-frame-options'),'DENY');
  assert.equal(home.headers.get('referrer-policy'),'no-referrer');
  assert.equal(home.headers.get('cache-control'),'no-store');
  assert.equal(home.headers.get('access-control-allow-origin'),null);
  const cross=await post('/api/battles',{practice:true,mode:'auto'},{origin:'https://attacker.example'});
  assert.equal(cross.status,403);
  const nullOrigin=await post('/api/battles',{practice:true},{origin:'null'});
  assert.equal(nullOrigin.status,403);
  const wrongType=await post('/api/battles',{practice:true},{'content-type':'text/plain'});
  assert.equal(wrongType.status,415);
  const malformed=await fetch(base+'/api/battles',{method:'POST',
   headers:{'content-type':'application/json','x-historia-session':code},body:'{bad'});
  assert.equal(malformed.status,400);
  const oversized=await post('/api/battles',{p1team:'x'.repeat(51000)});
  assert.equal(oversized.status,413);
  const started=await post('/api/battles',{practice:true,mode:'manual'});
  assert.equal(started.status,201,await started.text());
  const startedState=await (await fetch(base+'/api/session',{headers:{'x-historia-session':code}})).json();
  assert.ok(startedState.lastBattleId);
  const dir=join(dataDir,'sessions'),names=await readdir(dir);
  assert.equal(names.length,1);
  assert.equal(names[0],createHash('sha256').update(code).digest('hex')+'.json');
  if(process.platform!=='win32'){
   assert.equal((await stat(dir)).mode&0o777,0o700);
   assert.equal((await stat(join(dir,names[0]))).mode&0o777,0o600);
  }
  for(let i=0;i<20;i++){
   const ok=await post('/api/replay',{log:'|turn|1\n|win|FakeUser'});
   assert.equal(ok.status,200);
   assert.equal((await ok.json()).verified,false);
  }
  const blocked=await post('/api/replay',{log:'|turn|1'});
  assert.equal(blocked.status,429);
  assert.ok(Number(blocked.headers.get('retry-after'))>=1);
  const getStatus=await fetch(base+'/api/status');
  assert.equal(getStatus.status,200,'public status is not subject to the expensive replay quota');
 }finally{
  server.closeAllConnections?.();
  await new Promise(resolve=>server.close(resolve));
  await rm(dataDir,{recursive:true,force:true});
 }
});
