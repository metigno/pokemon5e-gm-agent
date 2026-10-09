import {randomUUID} from 'node:crypto';
import {isAbsolute,dirname,join,resolve} from 'node:path';
import {chmod,lstat,mkdir,readFile,stat,unlink,writeFile} from 'node:fs/promises';

/**
 * Fail-closed persistence gate. A production container must receive an
 * explicit absolute HISTORIA_DATA_DIR under a pre-existing parent directory.
 * This cannot prove the parent is mounted on a durable volume: operators must
 * still attach, snapshot and externally verify the Railway volume.
 */
export function validateStorageConfig({directory,production=false,configured}={}){
 if(typeof directory!=='string'||!directory||!isAbsolute(directory))
  throw Error('HISTORIA_DATA_DIR deve essere un percorso assoluto');
 if(production&&!configured)
  throw Error('Avvio produzione bloccato: HISTORIA_DATA_DIR esplicita obbligatoria');
 const normalized=resolve(directory);
 if(normalized==='/'||normalized==='/data')
  throw Error('Non utilizzare direttamente la radice o la radice del volume');
 return normalized;
}
async function checkRoot(directory){
 const info=await lstat(directory);
 if(!info.isDirectory()||info.isSymbolicLink())
  throw Error('Archivio Historia non è una directory reale');
}
export async function prepareStorage({directory,production=false,configured}={}){
 const root=validateStorageConfig({directory,production,configured});
 if(production){
  const parent=dirname(root);
  const parentInfo=await lstat(parent).catch(()=>null);
  if(!parentInfo?.isDirectory()||parentInfo.isSymbolicLink())
   throw Error('Volume dati non trovato: montare la directory genitore prima di avviare Historia');
 }
 await mkdir(root,{recursive:!production,mode:0o700}).catch(e=>{if(e.code!=='EEXIST')throw e;});
 await checkRoot(root);
 await chmod(root,0o700);
 await probeStorage(root);
 return root;
}
export async function probeStorage(directory){
 await checkRoot(directory);
 const name=join(directory,'.historia-probe-'+randomUUID());
 const evidence=randomUUID();
 try{
  await writeFile(name,evidence,{flag:'wx',mode:0o600});
  if((await readFile(name,'utf8'))!==evidence)throw Error('Lettura del volume non coerente');
  const data=await stat(name);
  if(data.size!==evidence.length)throw Error('Persistenza non verificabile');
 }finally{
  await unlink(name).catch(e=>{if(e.code!=='ENOENT')throw e;});
 }
 return true;
}
