import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,stat,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AccountAuth,authConfiguration} from '../auth.mjs';

const request=(token,csrf,method='GET')=>({
 method,headers:{cookie:'historia-local='+token,...(csrf?{'x-historia-csrf':csrf}:{})}
});
test('Local accounts use salted scrypt passwords, hashed opaque tokens and restricted files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'historia-auth-unit-'));
 try{
  const auth=new AccountAuth(dir);
  const alice=await auth.register('Alice_Player','correct horse battery staple');
  assert.match(alice.token,/^[0-9a-f]{64}$/);
  assert.match(auth.cookie(alice.token),/HttpOnly/);
  assert.match(auth.cookie(alice.token),/SameSite=Strict/);
  assert.doesNotMatch(auth.cookie(alice.token),/Domain=/);
  assert.match(alice.csrf,/^[0-9a-f]{48}$/);
  const files=await readdir(join(dir,'tokens'));
  assert.equal(files.length,1);assert.ok(!files[0].includes(alice.token));
  const stored=await readFile(join(dir,'users',(await readdir(join(dir,'users')))[0]),'utf8');
  assert.doesNotMatch(stored,/correct horse battery staple/);
  const parsed=JSON.parse(stored);
  assert.match(parsed.passwordHash,/^[0-9a-f]{128}$/);
  assert.equal(parsed.username,'alice_player');
  if(process.platform!=='win32'){
   assert.equal((await stat(join(dir,'users'))).mode&0o777,0o700);
   assert.equal((await stat(join(dir,'tokens'))).mode&0o777,0o700);
   assert.equal((await stat(join(dir,'tokens',files[0]))).mode&0o777,0o600);
  }
  const logged=await auth.login('ALICE_PLAYER','correct horse battery staple');
  assert.notEqual(logged.token,alice.token);
  const a=await auth.session(request(alice.token,alice.csrf,'POST'));
  const b=await auth.session(request(logged.token,logged.csrf,'POST'));
  assert.equal(a.ownerKey,b.ownerKey,'Re-login retains ownership of existing replay/saves');
  await assert.rejects(auth.session(request(logged.token,'0'.repeat(48),'POST')),e=>e.httpStatus===403);
  await assert.rejects(auth.session(request(logged.token,null,'POST')),e=>e.httpStatus===403);
  await assert.rejects(auth.login('ALICE_PLAYER','incorrect password'),e=>e.httpStatus===401);
  await assert.rejects(auth.register('alice_player','another twelve chars'),e=>e.httpStatus===409);
  await auth.revoke(alice.token);
  await assert.rejects(auth.session(request(alice.token)),e=>e.httpStatus===401);
  assert.equal((await auth.session(request(logged.token))).username,'alice_player');
  await auth.revokeAll('alice_player');
  await assert.rejects(auth.session(request(logged.token)),e=>e.httpStatus===401);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Expired cookies and restarted server instances cannot restore revoked sessions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'historia-auth-expiry-'));
 let clock=1700000000000;
 try{
  let auth=new AccountAuth(dir,{now:()=>clock});
  const first=await auth.register('Restart_User','password longer than twelve');
  auth=new AccountAuth(dir,{now:()=>clock});
  assert.equal((await auth.session(request(first.token))).username,'restart_user');
  clock+=8*24*60*60*1000;
  await assert.rejects(auth.session(request(first.token)),e=>e.httpStatus===401);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Production configuration fails closed without HTTPS and real account mode',()=>{
 assert.throws(()=>authConfiguration({NODE_ENV:'production',HISTORIA_AUTH_MODE:'capability',HISTORIA_PUBLIC_ORIGIN:'https://historia.example'}),/account/);
 assert.throws(()=>authConfiguration({NODE_ENV:'production',HISTORIA_AUTH_MODE:'accounts',HISTORIA_PUBLIC_ORIGIN:'http://historia.example'}),/https/);
 assert.deepEqual(authConfiguration({NODE_ENV:'production',HISTORIA_AUTH_MODE:'accounts',HISTORIA_PUBLIC_ORIGIN:'https://historia.example'}),{enabled:true,secure:true});
 assert.deepEqual(authConfiguration({NODE_ENV:'development'}),{enabled:false,secure:false});
});
