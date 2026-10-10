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
 const ko=cup.knockout??[];
 if(!Array.isArray(ko)||![0,8,12,14,15].includes(ko.length))
  throw Error('Invalid knockout bracket length');
 const stageCounts={'round-of-16':8,quarterfinal:4,semifinal:2,final:1};
 const allIds=new Set(members.map(x=>x.id));
 const unique=new Set();
 const usedReceipts=new Set(cup.schedule.filter(x=>x.status==='complete').map(x=>x.result.battleId));
 for(const m of ko){
  if(typeof m.id!=='string'||unique.has(m.id)||fixtureIds.has(m.id)||!Object.hasOwn(stageCounts,m.stage))
   throw Error('Invalid knockout fixture identity');
  unique.add(m.id);
  if(!allIds.has(m.homeId)||!allIds.has(m.awayId)||m.homeId===m.awayId)
   throw Error('Invalid knockout participants');
  if(!['scheduled','complete'].includes(m.status))throw Error('Invalid knockout fixture state');
  if(m.status==='complete'){
   if(!m.result||m.result.authority!=='showdown-verified'||!m.result.logDigest||
      !m.result.battleId||usedReceipts.has(m.result.battleId)||
      ![m.homeId,m.awayId].includes(m.result.winnerId)||
      ![m.homeId,m.awayId].includes(m.result.loserId)||
      m.result.winnerId===m.result.loserId)
    throw Error('Invalid knockout Showdown receipt');
   usedReceipts.add(m.result.battleId);
  }
 }
 let total=0,previous=null;
 for(const [stage,count] of Object.entries(stageCounts)){
  const games=ko.filter(x=>x.stage===stage);total+=games.length;
  if(games.length!==0&&games.length!==count)throw Error('Incomplete knockout stage');
  if(previous){
   if(games.length&&previous.some(x=>x.status!=='complete'))throw Error('Advanced an incomplete knockout round');
   if(games.length){
    const expected=previous.map(x=>x.result.winnerId).sort();
    const actual=games.flatMap(x=>[x.homeId,x.awayId]).sort();
    if(JSON.stringify(expected)!==JSON.stringify(actual))throw Error('Knockout pairing violates previous winners');
   }
  }
  if(games.length)previous=games;
 }
 if(total!==ko.length)throw Error('Unknown knockout stage');
 const final=ko.find(x=>x.stage==='final');
 if(cup.champion!==undefined&&cup.champion!==null&&
    (!final||final.status!=='complete'||final.result?.winnerId!==cup.champion))
  throw Error('Invalid crowned champion');
 if(final?.status==='complete'&&cup.champion!==final.result.winnerId)
  throw Error('Final winner must be crowned');
 if(cup.results.length>63||new Set(cup.results.map(x=>x.battleId)).size!==cup.results.length)
  throw Error('Invalid world championship receipt count');
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
