import {createHash} from 'node:crypto';
import {restoreTournament} from './tournament.mjs';
const VERSION=1;
function digest(payload){return createHash('sha256').update(JSON.stringify(payload)).digest('hex');}
function checkCup(cup){
 if(!cup||typeof cup!=='object'||!Number.isInteger(cup.year)||!Number.isInteger(cup.seed))throw new Error('Invalid championship identity');
 if(!cup.groups||Object.keys(cup.groups).sort().join('')!=='ABCDEFGH')throw new Error('Invalid group structure');
 const members=Object.values(cup.groups).flat();
 if(members.length!==32||new Set(members.map(x=>x.id)).size!==32)throw new Error('Invalid participants');
 if(!Array.isArray(cup.results)||!Array.isArray(cup.schedule)||cup.schedule.length!==48)throw new Error('Incomplete tournament state');
 const fixtureIds=new Set(cup.schedule.map(x=>x.id));
 if(fixtureIds.size!==48)throw new Error('Duplicate fixture IDs');
 for(const m of cup.schedule){
  if(!['scheduled','complete'].includes(m.status))throw new Error('Invalid fixture status');
  if(m.status==='complete'&&(!m.result||!m.result.battleId||m.result.authority!=='showdown-verified'||!m.result.logDigest))throw new Error('Incomplete battle receipt');
 }
}
export function serializeSave(cup,meta={}){
 checkCup(cup);
 const payload={version:VERSION,kind:'pokemon-gpt-historia',cup:structuredClone(cup),meta:{createdAt:meta.createdAt??null,updatedAt:meta.updatedAt??null}};
 return JSON.stringify({payload,sha256:digest(payload)});
}
export function deserializeSave(serialized){
 const envelope=JSON.parse(serialized);
 if(!envelope||!envelope.payload||typeof envelope.sha256!=='string'||digest(envelope.payload)!==envelope.sha256)throw new Error('Corrupted or modified save');
 if(envelope.payload.version!==VERSION||envelope.payload.kind!=='pokemon-gpt-historia')throw new Error('Unsupported save format');
 checkCup(envelope.payload.cup);
 return {cup:restoreTournament(envelope.payload.cup),meta:envelope.payload.meta};
}
/** Storage-independent adapter: callers write atomically via temp file + rename. */
export function makeSaveFilename(cup,slot){
 if(!Number.isInteger(slot)||slot<1||slot>3)throw new Error('Slot must be 1-3');
 if(!/^wc-\d{4}-[a-f0-9]{8}$/.test(cup.editionId??''))throw new Error('Invalid edition identifier');
 return `historia-slot-${slot}.json`;
}
