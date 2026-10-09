import {mkdir,readFile,writeFile,rename,unlink,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {serializeSave,deserializeSave,makeSaveFilename} from './save.mjs';
/**
 * Node filesystem adapter. A future browser/mobile adapter must implement
 * equivalent transactional semantics using platform-native storage.
 */
export class FileSaveStore {
 constructor(directory){if(!directory||typeof directory!=='string')throw new Error('Save directory required');this.directory=directory;}
 path(slot){if(!Number.isInteger(slot)||slot<1||slot>3)throw new Error('Slot must be 1-3');return join(this.directory,`historia-slot-${slot}.json`);}
 async write(slot,cup,meta={}){
  const target=this.path(slot);makeSaveFilename(cup,slot);
  await mkdir(this.directory,{recursive:true});
  const data=serializeSave(cup,meta);
  const temp=target+'.tmp';
  const backup=target+'.bak';
  // Preserve previous good snapshot before replacement. On interrupted writes
  // the loader can recover from backup; never silently redraw a tournament.
  try{const old=await readFile(target,'utf8');deserializeSave(old);await writeFile(backup,old,{flag:'w'});}catch(e){if(e.code!=='ENOENT'&&!(e.message?.includes('Corrupted')||e.message?.includes('Invalid')||e.message?.includes('Unsupported')))throw e;}
  try{await writeFile(temp,data,{flag:'w'});await rename(temp,target);}finally{await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  return {slot,filename:makeSaveFilename(cup,slot)};
 }
 async load(slot){
  const target=this.path(slot);
  for(const filename of [target,target+'.bak']){
   try{return {...deserializeSave(await readFile(filename,'utf8')),recovered:filename.endsWith('.bak')};}
   catch(e){if(e.code==='ENOENT'||e instanceof SyntaxError||/Corrupted|Invalid|Unsupported|Incomplete/.test(e.message))continue;throw e;}
  }
  return null;
 }
 async delete(slot){const target=this.path(slot);for(const suffix of ['', '.bak','.tmp'])await unlink(target+suffix).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 async list(){return Promise.all([1,2,3].map(async slot=>{const loaded=await this.load(slot);return {slot,occupied:!!loaded,year:loaded?.cup.year??null,editionId:loaded?.cup.editionId??null,recovered:loaded?.recovered??false};}));}
}
