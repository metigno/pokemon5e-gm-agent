/**
 * Explicit, account-authenticated, single-host guest import.
 * Transfers already completed Showdown replays and optional chat/session
 * records. Never imports an active match (which would be racing Showdown).
 * Uses a durable, owner-pinned migration marker to prevent takeover after
 * partially completed file operations.
 */
import {createHash,randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {mkdir,readdir,readFile,rename,writeFile,unlink,chmod} from 'node:fs/promises';

const hash=v=>createHash('sha256').update(v).digest('hex');
const reject=(message,httpStatus=400)=>Object.assign(Error(message),{httpStatus});
const matchId=/^[0-9a-f-]{36}$/;
async function safeRead(file){
 try{return JSON.parse(await readFile(file,'utf8'));}
 catch(e){if(e.code==='ENOENT')return null;throw e;}
}
async function writePrivate(file,value){
 const dir=file.slice(0,file.lastIndexOf('/'));
 await mkdir(dir,{recursive:true,mode:0o700});
 await chmod(dir,0o700);
 const temp=file+'.'+randomUUID()+'.tmp';
 try{
  await writeFile(temp,JSON.stringify(value),{flag:'wx',mode:0o600});
  await rename(temp,file);
 }catch(e){await unlink(temp).catch(()=>{});throw e;}
}
export async function importGuestData({directory,legacyCode,ownerKey}){
 if(typeof legacyCode!=='string'||!/^[0-9a-f]{40}$/.test(legacyCode)||
    typeof ownerKey!=='string'||!/^[0-9a-f]{40}$/.test(ownerKey))
  throw reject('Codice di importazione non valido');
 if(legacyCode===ownerKey)throw reject('Impossibile importare il proprio account');
 const source=hash(legacyCode),target=hash(ownerKey);
 const battleDir=join(directory,'battles');
 const files=(await readdir(battleDir).catch(e=>{
  if(e.code==='ENOENT')return [];throw e;
 })).filter(f=>matchId.test(f.replace(/\.pending\.json$|\.json$/,'')));
 if(files.length>10000)throw reject('Archivio troppo grande per importazione automatica',409);
 const pending=[];
 const completed=[];
 for(const file of files){
  const isPending=file.endsWith('.pending.json');
  if(!isPending&&!file.endsWith('.json'))continue;
  const data=await safeRead(join(battleDir,file));
  if(!data||!data.id||!matchId.test(data.id))continue;
  if(isPending&&data.ownerDigest===source)pending.push(data.id);
  if(!isPending&&(data.ownerDigest===source||(data.migratedFrom===source&&data.ownerDigest===target))){
   if(!['complete','tie'].includes(data.status)||!(data.publicLog||data.log))
    throw reject('Archivio storico non completo',409);
   completed.push({file,data});
  }
 }
 if(pending.length)throw reject('Termina le battaglie anonime in corso prima di importare',409);
 const markerDir=join(directory,'migrations');
 const markerFile=join(markerDir,source+'.json');
 await mkdir(markerDir,{recursive:true,mode:0o700});await chmod(markerDir,0o700);
 let marker=await safeRead(markerFile);
 if(marker&&marker.target!==target)throw reject('Codice anonimo già importato da un altro account',409);
 if(!marker){
  try{
   await writeFile(markerFile,JSON.stringify({target,status:'started',createdAt:new Date().toISOString()}),{flag:'wx',mode:0o600});
  }catch(e){if(e.code!=='EEXIST')throw e;}
  marker=await safeRead(markerFile);
  if(marker?.target!==target)throw reject('Codice anonimo già prenotato da un altro account',409);
 }
 if(marker.status==='complete')return {alreadyImported:true,replays:0,chatMessages:0,lastBattleId:null};
 let transferred=0;
 for(const {file,data} of completed){
  if(data.ownerDigest===target)continue;
  if(data.ownerDigest!==source)throw reject('Archivio modificato durante importazione',409);
  await writePrivate(join(battleDir,file),{...data,ownerDigest:target,migratedFrom:source});
  transferred++;
 }
 const srcChat=join(directory,'chat',source+'.json');
 const dstChat=join(directory,'chat',target+'.json');
 const originalChat=await safeRead(srcChat);
 let chatMessages=0;
 if(Array.isArray(originalChat)){
  const existing=await safeRead(dstChat);
  const own=Array.isArray(existing)?existing:[];
  const imported=originalChat.filter(v=>v&&['user','assistant'].includes(v.role)&&typeof v.content==='string').slice(-50);
  chatMessages=imported.length;
  await writePrivate(dstChat,[...imported,...own].slice(-50));
  await unlink(srcChat).catch(e=>{if(e.code!=='ENOENT')throw e;});
 }
 const sourceSession=join(directory,'sessions',source+'.json');
 const targetSession=join(directory,'sessions',target+'.json');
 const prev=await safeRead(sourceSession);
 const theirs=await safeRead(targetSession);
 // Keep the account's own latest battle when it already has one.
 const candidate=prev?.battleId;
 let lastBattleId=null;
 if(!theirs?.battleId&&matchId.test(candidate||'')){
  const battle=await safeRead(join(battleDir,candidate+'.json'));
  if(battle?.ownerDigest===target){
   await writePrivate(targetSession,{battleId:candidate});
   lastBattleId=candidate;
  }
 }
 await unlink(sourceSession).catch(e=>{if(e.code!=='ENOENT')throw e;});
 await writePrivate(markerFile,{target,status:'complete',completedAt:new Date().toISOString()});
 return {alreadyImported:false,replays:transferred,chatMessages,lastBattleId};
}
