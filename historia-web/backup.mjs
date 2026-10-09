/**
 * Offline, encrypted, authenticated backup of Historia's private JSON tree.
 *
 * This is an offline maintenance operation: stop the Node service, export and
 * verify the snapshot, then restart. Backups taken during writes are not
 * transactionally consistent. A failed or wrong-passphrase restore does not
 * overwrite existing player data.
 */
import {randomBytes,randomUUID,createHash,createCipheriv,createDecipheriv,scrypt as scryptCb} from 'node:crypto';
import {promisify} from 'node:util';
import {gzip as gzipCb,gunzip as gunzipCb} from 'node:zlib';
import {dirname,join,relative,resolve,isAbsolute} from 'node:path';
import {access,chmod,lstat,mkdir,readFile,readdir,rename,rm,writeFile} from 'node:fs/promises';

const scrypt=promisify(scryptCb);
const gzip=promisify(gzipCb);
const gunzip=promisify(gunzipCb);
const SHA=data=>createHash('sha256').update(data).digest('hex');
const directories=['auth/users','auth/tokens','battles','sessions','chat','migrations'];
const filePattern=/^[a-zA-Z0-9._-]{1,110}\.json$/;
const MAX_FILES=10000,MAX_FILE=4*1024*1024,MAX_TOTAL=64*1024*1024;
const MAX_BACKUP=100*1024*1024;
const kdf={N:32768,r:8,p:1,maxmem:128*1024*1024};
const aad=Buffer.from('pokemon-gpt-historia-offline-backup-v1');
const err=message=>Error('Backup Historia: '+message);

function passphraseOK(secret){
 if(typeof secret!=='string'||secret.length<16||Buffer.byteLength(secret)>4096)
  throw err('HISTORIA_BACKUP_PASSPHRASE deve contenere almeno 16 caratteri');
 return secret;
}
function safeRelative(name){
 if(typeof name!=='string'||!directories.some(dir=>name.startsWith(dir+'/')))throw err('Percorso archivio non autorizzato');
 const [file,...rest]=name.split('/').reverse();
 if(!filePattern.test(file)||rest.some(x=>!x||x==='..'||x==='.'))throw err('Nome file non autorizzato');
 return directories.some(dir=>name.startsWith(dir+'/')&&name.slice(dir.length+1)===file);
}
async function derive(secret,salt){
 return scrypt(passphraseOK(secret),salt,32,kdf);
}
async function collect(source){
 const root=resolve(source);
 const info=await lstat(root);
 if(!info.isDirectory()||info.isSymbolicLink())throw err('Directory sorgente non valida');
 const files=[];
 let total=0;
 for(const dir of directories){
  const folder=join(root,dir);
  let entries;
  try{entries=await readdir(folder,{withFileTypes:true});}
  catch(e){if(e.code==='ENOENT')continue;throw e;}
  for(const entry of entries){
   if(!entry.name.endsWith('.json'))continue;
   const name=dir+'/'+entry.name;
   if(!safeRelative(name)||!entry.isFile()||entry.isSymbolicLink())
    throw err('File non valido o link simbolico: '+name);
   if(++total>MAX_FILES)throw err('Troppi file privati');
   const file=await readFile(join(folder,entry.name));
   if(file.length>MAX_FILE)throw err('File individuale troppo grande');
   files.push({path:name,sha256:SHA(file),bytes:file.length,content:file.toString('base64')});
  }
 }
 files.sort((a,b)=>a.path.localeCompare(b.path));
 if(files.reduce((n,f)=>n+f.bytes,0)>MAX_TOTAL)throw err('Archivio troppo grande');
 return files;
}
async function decode(archive,passphrase){
 if(archive.length>MAX_BACKUP)throw err('File di backup troppo grande');
 let parsed;
 try{parsed=JSON.parse(archive.toString('utf8'));}catch{throw err('Formato archivio non valido');}
 if(parsed?.version!==1||parsed?.cipher!=='aes-256-gcm'||
    !/^[a-f0-9]{32}$/.test(parsed.salt||'')||
    !/^[a-f0-9]{24}$/.test(parsed.nonce||'')||
    !/^[a-f0-9]{32}$/.test(parsed.tag||'')||
    typeof parsed.ciphertext!=='string')throw err('Intestazione archivio non valida');
 let plaintext;
 try{
  const key=await derive(passphrase,Buffer.from(parsed.salt,'hex'));
  const decrypt=createDecipheriv('aes-256-gcm',key,Buffer.from(parsed.nonce,'hex'));
  decrypt.setAAD(aad);
  decrypt.setAuthTag(Buffer.from(parsed.tag,'hex'));
  const compressed=Buffer.concat([decrypt.update(Buffer.from(parsed.ciphertext,'base64')),decrypt.final()]);
  plaintext=await gunzip(compressed,{maxOutputLength:MAX_TOTAL*2+2*1024*1024});
 }catch{throw err('Passphrase errata o archivio modificato');}
 let bundle;
 try{bundle=JSON.parse(plaintext.toString('utf8'));}catch{throw err('Manifesto decrittato non valido');}
 if(bundle?.version!==1||!Array.isArray(bundle.files)||bundle.files.length>MAX_FILES)
  throw err('Manifesto privato non valido');
 const used=new Set(),files=[];
 let sum=0;
 for(const record of bundle.files){
  if(!record||!safeRelative(record.path)||used.has(record.path)||typeof record.content!=='string'||
     !/^[a-f0-9]{64}$/.test(record.sha256||''))throw err('Percorso o checksum non valido');
  used.add(record.path);
  const data=Buffer.from(record.content,'base64');
  if(data.length!==record.bytes||data.length>MAX_FILE||SHA(data)!==record.sha256)
   throw err('Checksum di un file privato non valido');
  sum+=data.length;
  if(sum>MAX_TOTAL)throw err('Dimensione totale oltre il limite');
  files.push({name:record.path,data});
 }
 return {files,createdAt:bundle.createdAt};
}
/** Export never includes OPENAI_API_KEY or process environment. */
export async function createEncryptedBackup({directory,output,passphrase}){
 passphraseOK(passphrase);
 const source=resolve(directory),out=resolve(output);
 if(out.startsWith(source+'/'))throw err('Salvare il backup fuori dalla directory dei dati');
 const files=await collect(source);
 const salt=randomBytes(16),nonce=randomBytes(12);
 const key=await derive(passphrase,salt);
 const plaintext=Buffer.from(JSON.stringify({version:1,createdAt:new Date().toISOString(),files}));
 const compressed=await gzip(plaintext);
 const cipher=createCipheriv('aes-256-gcm',key,nonce);
 cipher.setAAD(aad);
 const encrypted=Buffer.concat([cipher.update(compressed),cipher.final()]);
 const result=Buffer.from(JSON.stringify({version:1,cipher:'aes-256-gcm',kdf:'scrypt-32768',
  salt:salt.toString('hex'),nonce:nonce.toString('hex'),tag:cipher.getAuthTag().toString('hex'),
  ciphertext:encrypted.toString('base64')}));
 await mkdir(dirname(out),{recursive:true,mode:0o700});
 try{await access(out);throw err('Il file di destinazione esiste già');}
 catch(e){if(e.code!=='ENOENT')throw e;}
 const temp=out+'.'+randomUUID()+'.tmp';
 try{await writeFile(temp,result,{flag:'wx',mode:0o600});await rename(temp,out);}
 catch(e){await rm(temp,{force:true});throw e;}
 return {count:files.length,bytes:result.length,sha256:SHA(result),output:out};
}
export async function verifyEncryptedBackup({input,passphrase}){
 passphraseOK(passphrase);
 const raw=await readFile(input);
 const restored=await decode(raw,passphrase);
 return {count:restored.files.length,createdAt:restored.createdAt,sha256:SHA(raw)};
}
export async function restoreEncryptedBackup({input,directory,passphrase}){
 passphraseOK(passphrase);
 if(!isAbsolute(directory))throw err('Il percorso di ripristino deve essere assoluto');
 const destination=resolve(directory);
 const source=resolve(input);
 if(source.startsWith(destination+'/'))throw err('Il backup non deve essere nel percorso di ripristino');
 const archive=await decode(await readFile(source),passphrase);
 let existing;
 try{existing=await lstat(destination);}catch(e){if(e.code!=='ENOENT')throw e;}
 if(existing&&(!existing.isDirectory()||existing.isSymbolicLink()||
   (await readdir(destination)).length>0))throw err('Ripristino consentito solo in directory nuova o vuota');
 const stage=destination+'.restore-'+randomUUID();
 await mkdir(stage,{recursive:false,mode:0o700});
 try{
  for(const {name,data} of archive.files){
   const target=join(stage,name);
   await mkdir(dirname(target),{recursive:true,mode:0o700});
   await writeFile(target,data,{flag:'wx',mode:0o600});
  }
  // No modification to the target until every checksum and file write passes.
  await rename(stage,destination);
 }catch(e){await rm(stage,{recursive:true,force:true});throw e;}
 return {count:archive.files.length,directory:destination};
}
