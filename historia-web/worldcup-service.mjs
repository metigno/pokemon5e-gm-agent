import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {FileSaveStore} from '../historia/src/storage.mjs';
import {createNewWorldCup} from '../historia/src/new-game.mjs';
import {loadHistoricalSeeding} from '../historia/src/seeding.mjs';

const ownerFolder=ownerKey=>{
 if(typeof ownerKey!=='string'||ownerKey.length<16)throw Error('Identità del salvataggio non valida');
 return createHash('sha256').update(ownerKey).digest('hex');
};
const slotNumber=value=>{
 const slot=Number(value);
 if(!Number.isInteger(slot)||slot<1||slot>3)throw Error('Slot deve essere 1, 2 o 3');
 return slot;
};

/**
 * A playable preparation/sorteggio for a WHAT-IF 2060. This does NOT claim
 * that any of the historical 2056 entrants qualified for 2060.
 * No result can be entered without a separate authenticated Showdown receipt.
 */
export function makeHistoricalHypothesis(){
 const historical=loadHistoricalSeeding();
 if(!historical.notQualifiedListFor2060)throw Error('Ranking storico non dichiarato non canonico');
 const rows=historical.ranking;
 if(rows.length!==32||new Set(rows.map(r=>r.id)).size!==32||
    rows.some((r,i)=>r.rank!==i+1||!Number.isFinite(r.total)))
   throw Error('Ranking 2056 non valido per una simulazione');
 // Use the VERIFIED historical rank for pot order. These are ordering weights,
 // not invented 2060 points, qualification results or match statistics.
 const entrants=rows.map(r=>({id:r.id,rankingPoints:33-r.rank,historicalRank:r.rank,historicalCoefficient:r.total}));
 const cup=createNewWorldCup(entrants,2060);
 return {...cup,scenario:{kind:'what-if',source:'historical-seeding-2056',official:false,
  qualifiersConfirmed:false,description:'Ipotesi di sorteggio 2060 basata sui 32 nomi del ranking 2056. Non sono qualificati 2060 confermati.'}};
}

export class WorldCupSlots {
 constructor(directory){this.directory=directory;this.locks=new Map();}
 store(ownerKey){return new FileSaveStore(join(this.directory,ownerFolder(ownerKey)));}
 async list(ownerKey){return this.store(ownerKey).list();}
 async load(ownerKey,slot){return this.store(ownerKey).load(slotNumber(slot));}
 async newHistoricalHypothesis(ownerKey,slot){
  const number=slotNumber(slot),lockKey=ownerFolder(ownerKey)+'-'+number;
  const previous=this.locks.get(lockKey)||Promise.resolve();
  const operation=previous.catch(()=>{}).then(async()=>{
   const store=this.store(ownerKey);
   if(await store.load(number))throw Error('Slot occupato: continua la partita esistente; non sovrascrivere il sorteggio');
   const cup=makeHistoricalHypothesis();
   const now=new Date().toISOString();
   await store.write(number,cup,{createdAt:now,updatedAt:now});
   return {slot:number,cup,meta:{createdAt:now,updatedAt:now},recovered:false};
  });
  this.locks.set(lockKey,operation);
  try{return await operation;}finally{if(this.locks.get(lockKey)===operation)this.locks.delete(lockKey);}
 }
}
