import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,stat,symlink,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createEncryptedBackup,verifyEncryptedBackup,restoreEncryptedBackup} from '../backup.mjs';
import {prepareStorage,probeStorage,validateStorageConfig} from '../storage.mjs';

const password='Test only — unusually long secret, not a real player password';
async function sampleRoot(){
 const base=await mkdtemp(join(tmpdir(),'historia-backup-tests-'));
 const directory=join(base,'original');
 for(const path of ['auth/users','auth/tokens','battles','sessions','chat','migrations'])
  await mkdir(join(directory,path),{recursive:true,mode:0o700});
 const assets={
  'auth/users/alice.json':{username:'Alice',passwordHash:'example-hash'},
  'auth/tokens/123.json':{csrf:'a'.repeat(48),expiresAt:99999999999},
  'battles/123.json':{status:'complete',winner:'Luke',publicLog:'|turn|1\n|win|Luke'},
  'battles/abc.pending.json':{status:'active',p1team:'private-Arcanine-team'},
  'sessions/444.json':{battleId:'123'},
  'chat/666.json':[{role:'assistant',content:'master private log'}],
  'migrations/777.json':{status:'complete'}
 };
 for(const [name,data] of Object.entries(assets))
  await writeFile(join(directory,name),JSON.stringify(data),{mode:0o600});
 return {base,directory,assets};
}
test('Encrypted complete player backup can be verified and restored, with no plaintext secrets exposed',{timeout:30000},async()=>{
 const {base,directory,assets}=await sampleRoot();
 try{
  const archive=join(base,'private-export.hbk'),dest=join(base,'restored');
  const result=await createEncryptedBackup({directory,output:archive,passphrase:password});
  assert.equal(result.count,Object.keys(assets).length);
  const encoded=await readFile(archive,'utf8');
  assert.doesNotMatch(encoded,/private-Arcanine-team|master private log|example-hash|Alice/);
  assert.match(encoded,/"aes-256-gcm"/);
  if(process.platform!=='win32')
   assert.equal((await stat(archive)).mode&0o777,0o600);
  const checked=await verifyEncryptedBackup({input:archive,passphrase:password});
  assert.equal(checked.count,result.count);
  assert.equal(checked.sha256,result.sha256);
  const extracted=await restoreEncryptedBackup({input:archive,directory:dest,passphrase:password});
  assert.equal(extracted.count,Object.keys(assets).length);
  for(const [name,value] of Object.entries(assets)){
   assert.deepEqual(JSON.parse(await readFile(join(dest,name),'utf8')),value);
   if(process.platform!=='win32')
    assert.equal((await stat(join(dest,name))).mode&0o777,0o600);
  }
  await assert.rejects(restoreEncryptedBackup({input:archive,directory:dest,passphrase:password}),/directory nuova o vuota/);
  await assert.rejects(createEncryptedBackup({directory,output:archive,passphrase:password}),/esiste già/);
 }finally{await rm(base,{recursive:true,force:true});}
});
test('Wrong passphrases, modified ciphertext, path misuse and short passwords fail closed',{timeout:30000},async()=>{
 const {base,directory}=await sampleRoot();
 try{
  const archive=join(base,'encrypted.hbk'),tampered=join(base,'tampered.hbk');
  await createEncryptedBackup({directory,output:archive,passphrase:password});
  const original=await readFile(archive,'utf8');
  const parsed=JSON.parse(original);
  parsed.ciphertext=parsed.ciphertext.slice(0,-3)+'AAA';
  await writeFile(tampered,JSON.stringify(parsed));
  await assert.rejects(verifyEncryptedBackup({input:archive,passphrase:'this is the wrong password'}),/Passphrase errata/);
  await assert.rejects(verifyEncryptedBackup({input:tampered,passphrase:password}),/modificato/);
  const target=join(base,'must-not-exist');
  await assert.rejects(restoreEncryptedBackup({input:archive,directory:target,passphrase:'this is the wrong password'}),/Passphrase errata/);
  await assert.rejects(stat(target),e=>e.code==='ENOENT');
  await assert.rejects(createEncryptedBackup({directory,output:join(directory,'do-not-do-this.hbk'),passphrase:password}),/fuori/);
  await assert.rejects(createEncryptedBackup({directory,output:join(base,'too-short.hbk'),passphrase:'weak'}),/16/);
  // Symlinks must not be followed into files outside the private tree.
  await symlink(join(directory,'auth','users','alice.json'),join(directory,'battles','stolen.json'));
  await assert.rejects(createEncryptedBackup({directory,output:join(base,'danger.hbk'),passphrase:password}),/link simbolico/);
 }finally{await rm(base,{recursive:true,force:true});}
});
test('Production storage startup rejects unset or missing parent, checks read-write health',{timeout:12000},async()=>{
 const base=await mkdtemp(join(tmpdir(),'historia-storage-'));
 const storage=join(base,'volume','historia');
 try{
  assert.throws(()=>validateStorageConfig({directory:storage,production:true}),/esplicita/);
  assert.throws(()=>validateStorageConfig({directory:'/data',production:true,configured:'/data'}),/radice/);
  await assert.rejects(prepareStorage({directory:storage,production:true,configured:storage}),/Volume dati non trovato/);
  await mkdir(join(base,'volume'));
  assert.equal(await prepareStorage({directory:storage,production:true,configured:storage}),storage);
  assert.equal(await probeStorage(storage),true);
  assert.equal((await readdir(storage)).length,0,'Probe leaves no persistent secret artifacts');
  if(process.platform!=='win32')
   assert.equal((await stat(storage)).mode&0o777,0o700);
  const bad=join(base,'symbolic');
  await symlink(storage,bad);
  await assert.rejects(prepareStorage({directory:bad,production:true,configured:bad}),/directory reale/);
 }finally{await rm(base,{recursive:true,force:true});}
});
test('Operational CLI uses environment passphrase and verifies its encrypted file, never printing a secret',{timeout:30000},async()=>{
 const {base,directory}=await sampleRoot();
 try{
  const archive=join(base,'cli-export.hbk'),cli=new URL('../scripts/backup.mjs',import.meta.url).pathname;
  const env={...process.env,HISTORIA_BACKUP_PASSPHRASE:password};
  const created=spawnSync(process.execPath,[cli,'create','--data-dir',directory,'--out',archive],{env,encoding:'utf8',timeout:20000});
  assert.equal(created.status,0,created.stderr);
  const result=JSON.parse(created.stdout);
  assert.equal(result.count,7);
  assert.ok(!created.stdout.includes(password),'CLI must not print backup passphrase');
  const verified=spawnSync(process.execPath,[cli,'verify','--input',archive],{env,encoding:'utf8',timeout:20000});
  assert.equal(verified.status,0,verified.stderr);
  assert.equal(JSON.parse(verified.stdout).count,7);
 }finally{await rm(base,{recursive:true,force:true});}
});
