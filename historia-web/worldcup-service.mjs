import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {FileSaveStore} from '../historia/src/storage.mjs';
import {createNewWorldCup} from '../historia/src/new-game.mjs';
import {loadHistoricalSeeding} from '../historia/src/seeding.mjs';
import {applyAuthoritativeShowdownResult} from '../historia/src/showdown-bridge.mjs';
import {recordBattle} from '../historia/src/tournament.mjs';

const ownerFolder=ownerKey=>{
 if(typeof ownerKey!=='string'||ownerKey.length<16)throw Error('Identità del salvataggio non valida');
 return createHash('sha256').update(ownerKey).digest('hex');
};
export const showdownTrainerName=name=>String(name).replace(/[^\p{L}\p{N} ._'-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,40);
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
 async locked(ownerKey,slot,action){
  const number=slotNumber(slot),lockKey=ownerFolder(ownerKey)+'-'+number;
  const previous=this.locks.get(lockKey)||Promise.resolve();
  const operation=previous.catch(()=>{}).then(()=>action(this.store(ownerKey),number));
  this.locks.set(lockKey,operation);
  try{return await operation;}finally{if(this.locks.get(lockKey)===operation)this.locks.delete(lockKey);}
 }
 async newHistoricalHypothesis(ownerKey,slot){
  return this.locked(ownerKey,slot,async(store,number)=>{
   if(await store.load(number))throw Error('Slot occupato: continua la partita esistente; non sovrascrivere il sorteggio');
   const cup=makeHistoricalHypothesis(),now=new Date().toISOString();
   await store.write(number,cup,{createdAt:now,updatedAt:now});
   return {slot:number,cup,meta:{createdAt:now,updatedAt:now},recovered:false};
  });
 }
 /** Luke's group match only; every roster is supplied and vetted by ArenaService. */
 async startLukeFixture(ownerKey,slot,matchId,{p1team,p2team,mode='manual',npcProfile='balanced'}={},arena){
  return this.locked(ownerKey,slot,async(store,number)=>{
   const loaded=await store.load(number);
   if(!loaded)throw Error('Slot non occupato');
   const cup=loaded.cup;
   if(cup.scenario?.official!==false)throw Error('Formato Mondiale ufficiale non certificato');
   const fixture=cup.schedule.find(m=>m.id===matchId);
   if(!fixture||fixture.status!=='scheduled')throw Error('Incontro non disponibile');
   if(fixture.homeId!=='Luke'&&fixture.awayId!=='Luke')throw Error('Controllo Luke non disponibile per incontri NPC');
   if(!['manual','auto'].includes(mode))throw Error('Modalità non valida');
   const existing=cup.matchBindings?.[matchId];
   if(existing){
    if(!await arena.ownsBattle(existing.battleId,ownerKey))throw Error('Salvataggio della battaglia non recuperabile; rifiutato un nuovo sorteggio');
    const battle=await arena.load(existing.battleId);
    if(!battle)throw Error('Battaglia non recuperabile');
    return {slot:number,matchId,battle,resumed:true};
   }
   const opponent=fixture.homeId==='Luke'?fixture.awayId:fixture.homeId;
   const opponentName=showdownTrainerName(opponent);
   if(!opponentName||opponentName==='Luke')throw Error('Nome sfidante non valido per Showdown');
   const battle=await arena.create({sessionId:ownerKey,p1team,p2team,p2name:opponentName,mode,npcProfile});
   cup.matchBindings??={};
   cup.matchBindings[matchId]={battleId:battle.id,homeId:fixture.homeId,awayId:fixture.awayId,
    playerName:'Luke',opponentId:opponent,opponentName};
   await store.write(number,cup,{createdAt:loaded.meta?.createdAt,updatedAt:new Date().toISOString()});
   return {slot:number,matchId,battle,resumed:false};
  });
 }
 /** A trusted server call, NEVER a client-supplied log, winner or battleId. */
 async finalizeLukeFixture(ownerKey,slot,matchId,arena){
  return this.locked(ownerKey,slot,async(store,number)=>{
   const loaded=await store.load(number);
   if(!loaded)throw Error('Slot non occupato');
   const cup=loaded.cup,fixture=cup.schedule.find(m=>m.id===matchId);
   if(!fixture)throw Error('Incontro non disponibile');
   if(fixture.status==='complete')return {slot:number,matchId,cup,alreadyRecorded:true};
   const bound=cup.matchBindings?.[matchId];
   if(!bound||fixture.status!=='scheduled')throw Error('Avvia prima l’incontro Luke dallo slot');
   if(bound.homeId!==fixture.homeId||bound.awayId!==fixture.awayId||
      bound.playerName!=='Luke'||bound.opponentId!==(fixture.homeId==='Luke'?fixture.awayId:fixture.homeId)||
      bound.opponentName!==showdownTrainerName(bound.opponentId))
    throw Error('Associazione partita non coerente');
   if(!await arena.ownsBattle(bound.battleId,ownerKey))throw Error('Battaglia non appartenente allo slot');
   const completed=await arena.load(bound.battleId);
   if(completed?.status!=='complete'||!completed.publicLog||
      completed.p1name!=='Luke'||completed.p2name!==bound.opponentName||
      completed.winner===null)throw Error('Risultato Showdown verificato non ancora disponibile');
   const names={Luke:'Luke',[bound.opponentId]:bound.opponentName};
   const battleId='battle-'+bound.battleId;
   const next=applyAuthoritativeShowdownResult(cup.schedule,matchId,{
    battleId,log:completed.publicLog,playerNames:names,verifiedByServer:true
   });
   const receipt=next.find(m=>m.id===matchId).result;
   const updated=recordBattle(cup,{...receipt});
   updated.schedule=next;
   await store.write(number,updated,{createdAt:loaded.meta?.createdAt,updatedAt:new Date().toISOString()});
   return {slot:number,matchId,cup:updated,receipt,alreadyRecorded:false};
  });
 }
}
