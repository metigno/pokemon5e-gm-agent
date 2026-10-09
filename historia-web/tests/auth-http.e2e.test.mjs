import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){
 const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const port=server.address().port;await new Promise(r=>server.close(r));return port;
}
async function launch(dir,port){
 const child=spawn(process.execPath,['server.mjs'],{
  cwd:new URL('../',import.meta.url).pathname,
  env:{...process.env,NODE_ENV:'test',HISTORIA_DATA_DIR:dir,HISTORIA_AUTH_MODE:'accounts',
   PORT:String(port),HISTORIA_PUBLIC_ORIGIN:'',OPENAI_API_KEY:''},stdio:['ignore','pipe','pipe']
 });
 let stderr='';child.stderr.on('data',x=>stderr+=String(x));
 const base='http://127.0.0.1:'+port;
 for(let i=0;i<120;i++){
  if(child.exitCode!==null)throw Error('Account server failed: '+stderr);
  try{if((await fetch(base+'/api/status')).ok)return {child,base};}catch{}
  await sleep(100);
 }
 child.kill();throw Error('Account server unavailable: '+stderr);
}
async function stop(child){
 if(!child||child.exitCode!==null)return;
 const done=once(child,'exit');child.kill();await done;
}
test('Real HTTP account cookies reject legacy header, protect choices with CSRF and survive Node restart',{timeout:60000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'historia-auth-http-')),port=await freePort();
 let server=null;
 const username='historia_visitor',password='tough enough password 123';
 try{
  server=await launch(dir,port);const base=server.base;
  const open=await fetch(base+'/api/status');assert.equal((await open.json()).authMode,'accounts');
  const api=(path,{method='GET',cookie='',csrf='',body,headers={}}={})=>fetch(base+path,{
   method,headers:{...(cookie?{cookie}:{}),...(csrf?{'x-historia-csrf':csrf}:{}),
    ...(body!==undefined?{'content-type':'application/json'}:{}),...headers},
   ...(body!==undefined?{body:JSON.stringify(body)}:{})
  });
  const unauthorized=await api('/api/battles',{headers:{'x-historia-session':'a'.repeat(40)}});
  assert.equal(unauthorized.status,401,'Anonymous capability header is unusable in accounts mode');
  const registered=await api('/api/auth/register',{method:'POST',body:{username,password}});
  assert.equal(registered.status,201);
  assert.ok(registered.headers.get('set-cookie').includes('HttpOnly'));
  const cookie=registered.headers.get('set-cookie').split(';')[0];
  const me=await api('/api/auth/me',{cookie});
  assert.equal(me.status,200);
  const owner=await me.json();assert.equal(owner.username,username);
  assert.match(owner.csrf,/^[a-f0-9]{48}$/);
  const missingCsrf=await api('/api/battles',{method:'POST',cookie,body:{practice:true,mode:'manual'}});
  assert.equal(missingCsrf.status,403);
  const badCsrf=await api('/api/battles',{method:'POST',cookie,csrf:'0'.repeat(48),body:{practice:true,mode:'manual'}});
  assert.equal(badCsrf.status,403);
  const started=await api('/api/battles',{method:'POST',cookie,csrf:owner.csrf,body:{practice:true,mode:'manual'}});
  assert.equal(started.status,201);
  const created=await started.json();
  const id=created?.id;
  assert.match(id,/^[0-9a-f-]{36}$/);
  const owned=await api('/api/battles/'+id,{cookie});
  assert.equal(owned.status,200);
  const another=await api('/api/auth/register',{method:'POST',body:{username:'othervisitor',password:'another very secure phrase'}});
  assert.equal(another.status,201);
  const outsider=another.headers.get('set-cookie').split(';')[0];
  assert.equal((await api('/api/battles/'+id,{cookie:outsider})).status,404);
  await stop(server.child);server=null;
  server=await launch(dir,port);
  const restored=await api('/api/battles/'+id,{cookie});
  assert.equal(restored.status,200,'Restart must not change account ownership');
  const login=await api('/api/auth/login',{method:'POST',body:{username,password}});
  assert.equal(login.status,200);
  const newer=login.headers.get('set-cookie').split(';')[0];
  assert.notEqual(newer,cookie);
  assert.equal((await api('/api/battles/'+id,{cookie:newer})).status,200);
  const newMe=await (await api('/api/auth/me',{cookie:newer})).json();
  const revoked=await api('/api/auth/logout-all',{method:'POST',cookie:newer,csrf:newMe.csrf,body:{}});
  assert.equal(revoked.status,200);
  assert.match(revoked.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal((await api('/api/battles/'+id,{cookie})).status,401);
  assert.equal((await api('/api/battles/'+id,{cookie:newer})).status,401);
  const relogin=await api('/api/auth/login',{method:'POST',body:{username,password}});
  assert.equal(relogin.status,200);
  const revived=relogin.headers.get('set-cookie').split(';')[0];
  assert.equal((await api('/api/battles/'+id,{cookie:revived})).status,200);
 }finally{await stop(server?.child);await rm(dir,{recursive:true,force:true});}
});
