/**
 * Historia local-account authentication, independent of Pokémon 5e.
 * Passwords are scrypt salted, bearer cookies are opaque HttpOnly capabilities,
 * only SHA-256 token digests are stored. Single-host private alpha.
 */
import {randomBytes,createHash,timingSafeEqual,scrypt as scryptCb,randomUUID} from 'node:crypto';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,rename,unlink,chmod} from 'node:fs/promises';
import {join} from 'node:path';
const scrypt=promisify(scryptCb);
const sha=value=>createHash('sha256').update(value).digest('hex');
const reject=(message,status=401)=>Object.assign(Error(message),{httpStatus:status});
const SECURE='Secure; ';
const ttlMs=7*24*60*60*1000;
const namePattern=/^[a-zA-Z0-9_]{3,30}$/;
const hexPattern=/^[0-9a-f]{64}$/;
function secureConfig(){return process.env.HISTORIA_PUBLIC_ORIGIN?.startsWith('https://')===true;}
const secure=secureConfig();
function authCookie(token,{clear=false}={}){
 const name=secure?'__Host-historia':'historia-local';
 return name+'='+(clear?'':token)+'; Path=/; HttpOnly; '+(secure?SECURE:'')+
  'SameSite=Strict; '+(clear?'Max-Age=0':'Max-Age='+Math.floor(ttlMs/1000));
}
const validateCredentials=(username,password)=>{
 if(typeof username!=='string'||!namePattern.test(username)||typeof password!=='string'||
    password.length<12||password.length>128)throw reject('Nome utente o password non valida',400);
 return username.toLowerCase();
};
export class AccountAuth {
 constructor(directory,{now=()=>Date.now()}={}){this.directory=directory;this.now=now;}
 userFile(name){return join(this.directory,'users',sha(name.toLowerCase())+'.json');}
 tokenFile(token){return join(this.directory,'tokens',sha(token)+'.json');}
 async ensure(dir){await mkdir(dir,{recursive:true,mode:0o700});await chmod(dir,0o700);}
 async atomic(file,value){
  const dir=file.slice(0,file.lastIndexOf('/'));
  await this.ensure(dir);
  const temp=file+'.'+randomUUID()+'.tmp';
  try{
   await writeFile(temp,JSON.stringify(value),{flag:'wx',mode:0o600});
   await rename(temp,file);
  }catch(e){await unlink(temp).catch(()=>{});throw e;}
 }
 async register(username,password){
  const normalized=validateCredentials(username,password);
  const file=this.userFile(normalized);
  await this.ensure(join(this.directory,'users'));
  const salt=randomBytes(24).toString('hex');
  const derived=await scrypt(password,Buffer.from(salt,'hex'),64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
  const user={id:randomUUID(),username:normalized,salt,passwordHash:derived.toString('hex'),
   authVersion:1,createdAt:new Date(this.now()).toISOString()};
  try{await writeFile(file,JSON.stringify(user),{flag:'wx',mode:0o600});}
  catch(e){if(e.code==='EEXIST')throw reject('Nome utente non disponibile',409);throw e;}
  return this.issue(user);
 }
 async readUser(name){
  try{return JSON.parse(await readFile(this.userFile(name),'utf8'));}
  catch(e){if(e.code==='ENOENT')return null;throw e;}
 }
 async login(username,password){
  const normalized=validateCredentials(username,password);
  const user=await this.readUser(normalized);
  // Every authentication attempt performs the same intentionally costly KDF.
  const salt=user?.salt||'00'.repeat(24);
  const hash=await scrypt(password,Buffer.from(salt,'hex'),64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
  const expected=Buffer.from(user?.passwordHash||'00'.repeat(64),'hex');
  if(!user||expected.length!==hash.length||!timingSafeEqual(hash,expected))
   throw reject('Credenziali non valide');
  return this.issue(user);
 }
 async issue(user){
  const token=randomBytes(32).toString('hex');
  const csrf=randomBytes(24).toString('hex');
  const session={username:user.username,id:user.id,ownerKey:sha('historia-user:'+user.id).slice(0,40),
   csrf,authVersion:user.authVersion,expiresAt:this.now()+ttlMs};
  await this.atomic(this.tokenFile(token),session);
  return {token,csrf,username:user.username,expiresAt:session.expiresAt};
 }
 cookie(token){return authCookie(token);}
 clearCookie(){return authCookie('',{clear:true});}
 parseToken(req){
  const header=req.headers.cookie||'';
  if(typeof header!=='string'||header.length>4096)return null;
  const name=secure?'__Host-historia':'historia-local';
  const entry=header.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='));
  const value=entry?.slice(name.length+1);
  return hexPattern.test(value||'')?value:null;
 }
 async session(req){
  const token=this.parseToken(req);
  if(!token)throw reject('Accesso richiesto');
  let data;
  try{data=JSON.parse(await readFile(this.tokenFile(token),'utf8'));}
  catch(e){if(e.code==='ENOENT')throw reject('Sessione scaduta o revocata');throw e;}
  if(!data||data.expiresAt<=this.now()){await this.revoke(token);throw reject('Sessione scaduta');}
  const user=await this.readUser(data.username);
  if(!user||user.id!==data.id||user.authVersion!==data.authVersion)
   throw reject('Sessione revocata');
  if(req.method==='POST'){
   const header=req.headers['x-historia-csrf'];
   const actual=Buffer.from(typeof header==='string'?header:'');
   const expected=Buffer.from(data.csrf);
   if(actual.length!==expected.length||!timingSafeEqual(actual,expected))
    throw reject('Protezione CSRF: token mancante o errato',403);
  }
  return {...data,token};
 }
 async revoke(token){
  if(token&&hexPattern.test(token))await unlink(this.tokenFile(token)).catch(e=>{if(e.code!=='ENOENT')throw e;});
 }
 async revokeAll(username){
  const user=await this.readUser(username);
  if(!user)throw reject('Account non trovato');
  user.authVersion++;
  await this.atomic(this.userFile(username),user);
 }
}
export function authConfiguration(env=process.env){
 const enabled=env.HISTORIA_AUTH_MODE==='accounts';
 if(env.HISTORIA_AUTH_MODE&&!['accounts','capability'].includes(env.HISTORIA_AUTH_MODE))
  throw Error('HISTORIA_AUTH_MODE deve essere accounts oppure capability');
 if(env.NODE_ENV==='production'){
  if(!enabled)throw Error('Deploy pubblico vietato: HISTORIA_AUTH_MODE=accounts richiesto');
  const url=env.HISTORIA_PUBLIC_ORIGIN;
  if(!url||!/^https:\/\//.test(url)||new URL(url).pathname!=='/'||
   new URL(url).search||new URL(url).hash)
   throw Error('Deploy pubblico vietato: HISTORIA_PUBLIC_ORIGIN=https://host richiesto');
 }
 return {enabled,secure:!!env.HISTORIA_PUBLIC_ORIGIN?.startsWith('https://')};
}
