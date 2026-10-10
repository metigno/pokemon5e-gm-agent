import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {FileSaveStore} from '../historia/src/storage.mjs';
import {createNewWorldCup} from '../historia/src/new-game.mjs';
import {loadHistoricalSeeding} from '../historia/src/seeding.mjs';
import {applyAuthoritativeShowdownResult} from '../historia/src/showdown-bridge.mjs';
import {recordBattle} from '../historia/src/tournament.mjs';
import {resolveAiProfile} from './tactical-ai.mjs';
import {canonicalTeam,canonicalDynamaxTarget} from './canonical-2060-teams.mjs';
import {finalizedGroupStandings} from '../historia/src/schedule.mjs';
import {createRoundOf16,advanceRound,crownChampion} from '../historia/src/knockout.mjs';

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

const fixtureCollection=(cup,matchId)=>{
 const group=cup.schedule.find(m=>m.id===matchId);
 if(group)return {fixture:group,key:'schedule',games:cup.schedule};
 const playoff=(cup.playoffs||[]).find(m=>m.id===matchId);
 if(playoff)return {fixture:playoff,key:'playoffs',games:cup.playoffs};
 const knockout=(cup.knockout||[]).find(m=>m.id===matchId);
 if(knockout)return {fixture:knockout,key:'knockout',games:cup.knockout};
 return {fixture:null,key:null,games:null};
};

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
 /** The narrative journal is slot-scoped; it cannot write match results or teams. */
 async appendNarrative(ownerKey,slot,{message,answer}){
  if(typeof message!=='string'||typeof answer!=='string'||message.length>5000||answer.length>30000)throw Error('Evento narrativo non valido');
  return this.locked(ownerKey,slot,async(store,number)=>{
   const loaded=await store.load(number);if(!loaded)throw Error('Slot non occupato');
   const cup=loaded.cup;cup.narrative??={chat:[],events:[]};
   cup.narrative.chat.push({role:'user',content:message},{role:'assistant',content:answer});
   cup.narrative.events.push({kind:'conversation',at:new Date().toISOString(),message,answer,editionId:cup.editionId,verifiedResults:cup.results.length});
   await store.write(number,cup,{createdAt:loaded.meta?.createdAt,updatedAt:new Date().toISOString()});
  });
 }
 /** Luke's group match only; every roster is supplied and vetted by ArenaService. */
 async startLukeFixture(ownerKey,slot,matchId,{p1team,p2team,mode='manual',npcProfile='balanced'}={},arena){
  return this.locked(ownerKey,slot,async(store,number)=>{
   const loaded=await store.load(number);
   if(!loaded)throw Error('Slot non occupato');
   const cup=loaded.cup;
   if(cup.scenario?.official!==false)throw Error('Formato Mondiale ufficiale non certificato');
   const {fixture}=fixtureCollection(cup,matchId);
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
   // Custom imports remain an explicit opt-in; fixture buttons send no teams.
   // Never pull whichever unrelated opponent was last saved in the Arena.
   const actualP1=p1team?.trim()?p1team:canonicalTeam('Luke');
   const actualP2=p2team?.trim()?p2team:canonicalTeam(opponent);
   const battle=await arena.create({sessionId:ownerKey,p1team:actualP1,p2team:actualP2,
    p2name:opponentName,mode,npcProfile,kind:'worldcup-what-if',
    p1dynamaxTarget:p1team?.trim()?null:canonicalDynamaxTarget('Luke'),
    p2dynamaxTarget:p2team?.trim()?null:canonicalDynamaxTarget(opponent)});
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
   const cup=loaded.cup,{fixture,key,games}=fixtureCollection(cup,matchId);
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
   const next=applyAuthoritativeShowdownResult(games,matchId,{
    battleId,log:completed.publicLog,playerNames:names,verifiedByServer:true
   });
   const receipt=next.find(m=>m.id===matchId).result;
   const updated=fixture.stage==='playoff'?{...cup}:recordBattle(cup,{...receipt});
   updated[key]=next;
   if(fixture.stage==='final')updated.champion=crownChampion(next.filter(m=>m.stage==='final'));
   await store.write(number,updated,{createdAt:loaded.meta?.createdAt,updatedAt:new Date().toISOString()});
   return {slot:number,matchId,cup:updated,receipt,alreadyRecorded:false};
  });
 }
 /**
  * A non-Luke scheduled match, using ONLY the exact teams explicitly supplied
  * by the slot owner. No generated NPC roster and no fake result. The Showdown
  * engine runs in automatic mode with a private request per NPC.
  */
 async startNpcFixture(ownerKey,slot,matchId,{p1team,p2team}={},arena){
  return this.locked(ownerKey,slot,async(store,number)=>{
   const loaded=await store.load(number);
   if(!loaded)throw Error('Slot non occupato');
   const cup=loaded.cup;
   if(cup.scenario?.official!==false)throw Error('Formato Mondiale ufficiale non certificato');
   const {fixture}=fixtureCollection(cup,matchId);
   if(!fixture||fixture.status!=='scheduled')throw Error('Incontro non disponibile');
   if(fixture.homeId==='Luke'||fixture.awayId==='Luke')
    throw Error('Gli incontri di Luke utilizzano il controllo dedicato');
   const bound=cup.matchBindings?.[matchId];
   if(bound){
    if(bound.kind!=='npc'||bound.homeId!==fixture.homeId||bound.awayId!==fixture.awayId)
     throw Error('Associazione NPC non coerente');
    if(!await arena.ownsBattle(bound.battleId,ownerKey))
     throw Error('Battaglia NPC non recuperabile: risultato non assegnato');
    const battle=await arena.load(bound.battleId);
    if(!battle)throw Error('Battaglia NPC non recuperabile');
    return {slot:number,matchId,battle,resumed:true};
   }
   // Prefer trainer-specific canonical builds. Manual overrides require two
   // explicit full imports, never the previous battle's copied form values.
   const hasP1=typeof p1team==='string'&&!!p1team.trim();
   const hasP2=typeof p2team==='string'&&!!p2team.trim();
   if(hasP1!==hasP2)throw Error('Per importare build personalizzate servono entrambe le squadre');
   const actualP1=hasP1?p1team:canonicalTeam(fixture.homeId);
   const actualP2=hasP2?p2team:canonicalTeam(fixture.awayId);
   const homeName=showdownTrainerName(fixture.homeId),awayName=showdownTrainerName(fixture.awayId);
   if(!homeName||!awayName||homeName===awayName)
    throw Error('Nomi allenatori Showdown ambigui');
   const battle=await arena.create({
    sessionId:ownerKey,mode:'auto',kind:'worldcup-what-if',
    p1name:homeName,p2name:awayName,p1team:actualP1,p2team:actualP2,
    p1profile:resolveAiProfile(fixture.homeId),
    npcProfile:resolveAiProfile(fixture.awayId),
    p1dynamaxTarget:hasP1?null:canonicalDynamaxTarget(fixture.homeId),
    p2dynamaxTarget:hasP2?null:canonicalDynamaxTarget(fixture.awayId)
   });
   cup.matchBindings??={};
   cup.matchBindings[matchId]={kind:'npc',battleId:battle.id,homeId:fixture.homeId,
    awayId:fixture.awayId,homeName,awayName};
   await store.write(number,cup,{createdAt:loaded.meta?.createdAt,updatedAt:new Date().toISOString()});
   return {slot:number,matchId,battle,resumed:false};
  });
 }
 /** Persist only a finished owned battle's server-observed terminal log. */
 async finalizeNpcFixture(ownerKey,slot,matchId,arena){
  return this.locked(ownerKey,slot,async(store,number)=>{
   const loaded=await store.load(number);
   if(!loaded)throw Error('Slot non occupato');
   const cup=loaded.cup,{fixture,key,games}=fixtureCollection(cup,matchId);
   if(!fixture)throw Error('Incontro non disponibile');
   if(fixture.homeId==='Luke'||fixture.awayId==='Luke')
    throw Error('Gli incontri di Luke hanno una registrazione separata');
   if(fixture.status==='complete')return {slot:number,matchId,cup,alreadyRecorded:true};
   const bound=cup.matchBindings?.[matchId];
   if(fixture.status!=='scheduled'||bound?.kind!=='npc'||bound.homeId!==fixture.homeId||
      bound.awayId!==fixture.awayId||
      bound.homeName!==showdownTrainerName(fixture.homeId)||
      bound.awayName!==showdownTrainerName(fixture.awayId))
    throw Error('Avvia prima la battaglia NPC Showdown');
   if(!await arena.ownsBattle(bound.battleId,ownerKey))
    throw Error('La battaglia NPC appartiene a un altro salvataggio');
   const completed=await arena.load(bound.battleId);
   if(completed?.status!=='complete'||typeof completed.publicLog!=='string'||
      completed.p1name!==bound.homeName||completed.p2name!==bound.awayName||
      ![bound.homeName,bound.awayName].includes(completed.winner))
    throw Error('Risultato NPC Showdown verificato non ancora disponibile');
   const names=Object.fromEntries([[fixture.homeId,bound.homeName],[fixture.awayId,bound.awayName]]);
   const next=applyAuthoritativeShowdownResult(games,matchId,{
    battleId:'battle-'+bound.battleId,log:completed.publicLog,playerNames:names,verifiedByServer:true
   });
   const receipt=next.find(m=>m.id===matchId).result;
   const updated=fixture.stage==='playoff'?{...cup}:recordBattle(cup,receipt);
   updated[key]=next;
   if(fixture.stage==='final')updated.champion=crownChampion(next.filter(m=>m.stage==='final'));
   await store.write(number,updated,{createdAt:loaded.meta?.createdAt,updatedAt:new Date().toISOString()});
   return {slot:number,matchId,cup:updated,receipt,alreadyRecorded:false};
  });
 }

 /** No R16 fixture exists until every group outcome, including tie policy, is verified. */
 async openKnockout(ownerKey,slot){
  return this.locked(ownerKey,slot,async(store,number)=>{
   const loaded=await store.load(number);
   if(!loaded)throw Error('Slot non occupato');
   const cup=loaded.cup;
   if(cup.scenario?.official!==false)throw Error('Formato 2060 non certificato');
   if(cup.knockout?.length)return {slot:number,cup,alreadyGenerated:true};
   if(cup.schedule.length!==48||cup.schedule.some(m=>m.status!=='complete'))
    throw Error('Completare i 48 incontri Showdown dei gironi prima degli ottavi');
   // WHAT-IF only: a points bucket still cyclic after observed KO differences
   // is ranked by a repeated elimination ladder. Initial pair order comes from
   // the persisted draw; it never awards a rank, every rank requires Showdown.
   cup.playoffPolicy??='what-if-repeated-elimination-ladder-v1';
   cup.playoffs??=[];cup.playoffPlans??={};
   const rankings={};let pending=false;
   for(const group of 'ABCDEFGH'){
    const orders={};
    while(true){
     try{rankings[group]=finalizedGroupStandings(cup.schedule,group,{playoffOrders:orders});break;}
     catch(error){
      if(!error.tiedIds)throw error;
      const orderKey=error.points+':'+error.koDifference;
      const key=group+'-'+orderKey;
      const plan=cup.playoffPlans[key]??={participants:cup.groups[group].map(r=>r.id).filter(id=>error.tiedIds.includes(id))};
      const remaining=[...plan.participants],order=[];
      let waiting=false;
      while(remaining.length>1){
       let contender=remaining[0];
       for(let i=1;i<remaining.length;i++){
        const id=cup.year+'-P'+group+'-B'+error.points+'-K'+String(error.koDifference).replace('-','N')+'-R'+(order.length+1)+'-M'+i;
        let game=cup.playoffs.find(g=>g.id===id);
        if(!game){game={id,stage:'playoff',group,homeId:contender,awayId:remaining[i],status:'scheduled'};cup.playoffs.push(game);}
        if(game.homeId!==contender||game.awayId!==remaining[i])throw Error('Associazione spareggio non coerente');
        if(game.status!=='complete'){waiting=true;break;}
        if(game.result?.authority!=='showdown-verified'||![game.homeId,game.awayId].includes(game.result.winnerId))throw Error('Spareggio senza risultato verificato');
        contender=game.result.winnerId;
       }
       if(waiting)break;
       order.push(contender);remaining.splice(remaining.indexOf(contender),1);
      }
      if(waiting){pending=true;break;}
      orders[orderKey]=[...order,...remaining];
     }
    }
   }
   if(pending){
    await store.write(number,cup,{createdAt:loaded.meta?.createdAt,updatedAt:new Date().toISOString()});
    return {slot:number,cup,playoffsPending:true};
   }
   const bracket=createRoundOf16(rankings);
   const updated={...cup,groupRankings:rankings,knockout:bracket};
   await store.write(number,updated,{createdAt:loaded.meta?.createdAt,updatedAt:new Date().toISOString()});
   return {slot:number,cup:updated,alreadyGenerated:false};
  });
 }
 /** Advance at most one complete knockout round. No matches get invented. */
 async advanceKnockout(ownerKey,slot){
  return this.locked(ownerKey,slot,async(store,number)=>{
   const loaded=await store.load(number);
   if(!loaded)throw Error('Slot non occupato');
   const cup=loaded.cup;
   if(cup.scenario?.official!==false)throw Error('Formato 2060 non certificato');
   const knockout=cup.knockout||[];
   if(!knockout.length)throw Error('Generare prima gli ottavi di finale');
   const stages=['round-of-16','quarterfinal','semifinal','final'];
   const stage=[...stages].reverse().find(name=>knockout.some(g=>g.stage===name));
   if(stage==='final')throw Error('Finale già generata: disputare l’incontro');
   const last=knockout.filter(g=>g.stage===stage);
   if(last.some(g=>g.status!=='complete'))throw Error('Turno eliminatorio non completo');
   const next=advanceRound(knockout,stage);
   const updated={...cup,knockout:[...knockout,...next]};
   await store.write(number,updated,{createdAt:loaded.meta?.createdAt,updatedAt:new Date().toISOString()});
   return {slot:number,cup:updated,createdStage:next[0].stage};
  });
 }

}
