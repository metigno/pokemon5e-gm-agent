import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AccountAuth} from '../auth.mjs';
import {ArenaService} from '../battle-service.mjs';
import {createEncryptedBackup,verifyEncryptedBackup,restoreEncryptedBackup} from '../backup.mjs';

const sleep=ms=>new Promise(done=>setTimeout(done,ms));
test('Encrypted offline backup restores real Showdown winner, verified private replay and login cookie',{timeout:65000},async()=>{
 const parent=await mkdtemp(join(tmpdir(),'historia-real-backup-'));
 const live=join(parent,'live'),saved=join(parent,'private.hbk'),restored=join(parent,'restored');
 let arena=null,restoredArena=null;
 try{
  const accounts=new AccountAuth(join(live,'auth'));
  const session=await accounts.register('backup_player','long password generated only for test');
  const identity=await accounts.session({method:'GET',headers:{cookie:'historia-local='+session.token}});
  arena=new ArenaService(join(live,'battles'));
  const created=await arena.create({mode:'auto',practice:true,sessionId:identity.ownerKey});
  let finished=null;
  for(let i=0;i<500;i++){
   finished=await arena.load(created.id);
   if(['complete','tie'].includes(finished.status))break;
   if(finished.status==='error')throw Error(finished.error);
   await sleep(40);
  }
  assert.equal(finished.status,'complete','Use a genuine concluded Showdown game');
  const oldLog=finished.log,oldWinner=finished.winner;
  await arena.shutdown();arena=null;
  const backup=await createEncryptedBackup({directory:live,output:saved,passphrase:'test-only-long-secret-for-real-showdown-check'});
  assert.ok(backup.count>=3,'Must include encrypted tokens, users, finished Showdown replay');
  assert.equal((await verifyEncryptedBackup({input:saved,passphrase:'test-only-long-secret-for-real-showdown-check'})).count,backup.count);
  await restoreEncryptedBackup({input:saved,directory:restored,passphrase:'test-only-long-secret-for-real-showdown-check'});
  const revived=new AccountAuth(join(restored,'auth'));
  const recoveredIdentity=await revived.session({method:'GET',headers:{cookie:'historia-local='+session.token}});
  assert.equal(recoveredIdentity.ownerKey,identity.ownerKey);
  restoredArena=new ArenaService(join(restored,'battles'));
  assert.equal(await restoredArena.ownsBattle(created.id,recoveredIdentity.ownerKey),true);
  const replay=await restoredArena.load(created.id);
  assert.equal(replay.status,'complete');
  assert.equal(replay.winner,oldWinner);
  assert.equal(replay.publicLog,oldLog,'Restored Showdown transcript must remain byte identical');
  await revived.revoke(session.token);
  await assert.rejects(revived.session({method:'GET',headers:{cookie:'historia-local='+session.token}}),e=>e.httpStatus===401);
 }finally{
  await arena?.shutdown();
  await restoredArena?.shutdown();
  await rm(parent,{recursive:true,force:true});
 }
});
