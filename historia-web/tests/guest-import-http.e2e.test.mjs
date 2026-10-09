import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {ArenaService} from '../battle-service.mjs';
const pause=ms=>new Promise(done=>setTimeout(done,ms));
const hash=v=>createHash('sha256').update(v).digest('hex');
async function port(){
 const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const n=server.address().port;await new Promise(r=>server.close(r));return n;
}
async function launch(dir,n,{production=false}={}){
 const child=spawn(process.execPath,['server.mjs'],{
  cwd:new URL('../',import.meta.url).pathname,
  env:{...process.env,HISTORIA_DATA_DIR:dir,PORT:String(n),HISTORIA_AUTH_MODE:'accounts',
   NODE_ENV:production?'production':'test',
   HISTORIA_PUBLIC_ORIGIN:production?'https://historia-staging.example':''},
  stdio:['ignore','pipe','pipe']
 });
 let output='';child.stderr.on('data',c=>{output+=String(c);});
 const base='http://127.0.0.1:'+n;
 for(let i=0;i<120;i++){
  if(child.exitCode!==null)throw Error('Server exit: '+output.slice(-1200));
  try{if((await fetch(base+'/api/status')).ok)return {base,child};}catch{}
  await pause(100);
 }
 child.kill();throw Error('Account HTTP startup timeout');
}
async function stop(child){
 if(child&&child.exitCode==null){const exited=once(child,'exit');child.kill();await exited;}
}
test('Real Showdown guest replay migrates once to authenticated account and remains verified, private and persistent',{timeout:85000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'historia-guest-http-'));
 const guest='9'.repeat(40),n=await port();
 let service=new ArenaService(join(dir,'battles')),app=null;
 try{
  const battle=await service.create({practice:true,mode:'auto',sessionId:guest,npcProfile:'edward'});
  let finished=null;
  for(let i=0;i<750;i++){
   finished=await service.load(battle.id);
   if(finished.status==='complete')break;
   if(finished.status==='error')throw Error(finished.error);
   await pause(40);
  }
  assert.equal(finished.status,'complete','Only real completed Showdown battles may be imported');
  await service.shutdown();
  await mkdir(join(dir,'sessions'),{recursive:true});
  await mkdir(join(dir,'chat'),{recursive:true});
  await writeFile(join(dir,'sessions',hash(guest)+'.json'),JSON.stringify({battleId:battle.id}));
  await writeFile(join(dir,'chat',hash(guest)+'.json'),JSON.stringify([{role:'user',content:'Ricorda la Mega del turno due'}]));
  app=await launch(dir,n);
  const call=(path,{cookie='',csrf='',body}={})=>fetch(app.base+path,{
   method:body===undefined?'GET':'POST',
   headers:{...(cookie?{cookie}:{}),...(csrf?{'x-historia-csrf':csrf}:{}),
    ...(body===undefined?{}:{'content-type':'application/json'})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  const registration=await call('/api/auth/register',{body:{username:'migratedplayer',password:'very long distinct player password'}});
  assert.equal(registration.status,201);
  const cookie=registration.headers.get('set-cookie').split(';')[0];
  const csrf=(await registration.json()).csrf;
  const blocked=await call('/api/auth/import-guest',{cookie,body:{legacyCode:guest}});
  assert.equal(blocked.status,403,'Guest secret alone is not enough: account CSRF must be present');
  const imported=await call('/api/auth/import-guest',{cookie,csrf,body:{legacyCode:guest}});
  assert.equal(imported.status,200);
  const result=await imported.json();
  assert.equal(result.replays,1);
  assert.equal(result.lastBattleId,battle.id);
  const saved=await call('/api/battles/'+battle.id+'/replay',{cookie});
  assert.equal(saved.status,200);
  const data=await saved.json();
  assert.equal(data.verified,true);
  assert.equal(data.timeline.winner,finished.winner);
  const repeat=await call('/api/auth/import-guest',{cookie,csrf,body:{legacyCode:guest}});
  assert.equal(repeat.status,200);assert.equal((await repeat.json()).alreadyImported,true);
  const otherRegistration=await call('/api/auth/register',{body:{username:'otherplayer',password:'another strong different password'}});
  assert.equal(otherRegistration.status,201);
  const otherCookie=otherRegistration.headers.get('set-cookie').split(';')[0];
  const otherCsrf=(await otherRegistration.json()).csrf;
  assert.equal((await call('/api/battles/'+battle.id,{cookie:otherCookie})).status,404);
  const blockedReuse=await call('/api/auth/import-guest',{cookie:otherCookie,csrf:otherCsrf,body:{legacyCode:guest}});
  assert.equal(blockedReuse.status,409,'No second account may reclaim imported guest records');
  await stop(app.child);app=null;
  app=await launch(dir,n);
  assert.equal((await call('/api/battles/'+battle.id,{cookie})).status,200);
  assert.equal((await (await call('/api/session',{cookie})).json()).lastBattleId,battle.id);
  const chat=await (await call('/api/chat',{cookie})).json();
  assert.ok(chat.messages.some(m=>m.content.includes('Mega del turno due')));
 }finally{
  await service.shutdown();
  await stop(app?.child);
  await rm(dir,{recursive:true,force:true});
 }
});
test('Production reverse-proxy origin must be HTTPS; accounts issue Secure host-only cookie',{timeout:25000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'historia-https-proxy-')),n=await port();
 let app=null;
 try{
  app=await launch(dir,n,{production:true});
  const reject=await fetch(app.base+'/api/auth/register',{method:'POST',
   headers:{'content-type':'application/json',origin:'http://historia-staging.example'},
   body:JSON.stringify({username:'httpsplayer',password:'long password only for test'})});
  assert.equal(reject.status,403);
  const allow=await fetch(app.base+'/api/auth/register',{method:'POST',
   headers:{'content-type':'application/json',origin:'https://historia-staging.example'},
   body:JSON.stringify({username:'httpsplayer',password:'long password only for test'})});
  assert.equal(allow.status,201);
  const cookie=allow.headers.get('set-cookie');
  assert.match(cookie,/__Host-historia=/);
  assert.match(cookie,/HttpOnly/);
  assert.match(cookie,/Secure/);
  assert.match(cookie,/SameSite=Strict/);
  const data=await allow.json();
  const checked=await fetch(app.base+'/api/auth/me',{headers:{cookie:cookie.split(';')[0]}});
  assert.equal(checked.status,200);
  const valid=await fetch(app.base+'/api/auth/logout',{method:'POST',
   headers:{cookie:cookie.split(';')[0],origin:'https://historia-staging.example',
    'x-historia-csrf':data.csrf,'content-type':'application/json'},body:'{}'});
  assert.equal(valid.status,200);
 }finally{await stop(app?.child);await rm(dir,{recursive:true,force:true});}
});
