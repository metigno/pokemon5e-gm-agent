import {randomUUID,createHash,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,readdir,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {createShowdownBattle} from './showdown-engine.mjs';
import {legalChoices,validateChoice,selectAiFallback} from './showdown-protocol.mjs';
import {selectTacticalChoice,resolveAiProfile,AI_PROFILES} from './tactical-ai.mjs';
import {parseShowdownOutcome} from '../historia/src/showdown-bridge.mjs';
import {buildReplayTimeline} from './replay-timeline.mjs';

const require=createRequire(import.meta.url);
const {Teams,Dex}=require('pokemon-showdown');
const VALID_MODES=new Set(['manual','auto']);
const VALID_NAME=/^[\p{L}\p{N} ._'-]{1,40}$/u;
const ownerDigest=sessionId=>sessionId?createHash('sha256').update(sessionId).digest('hex'):null;
const requestHash=request=>createHash('sha256').update(JSON.stringify(request)).digest('hex');
const randomSeed=()=>{const bytes=randomBytes(8);return [0,2,4,6].map(index=>bytes.readUInt16BE(index));};

// Explicitly non-canonical practice rosters. No historical tournament result
// is ever created by this practice match.
export function practiceTeams() {
 const make=(species,moves,extra={})=>({name:species,species,level:100,nature:'Hardy',ability:'',moves,...extra});
 return {
  p1:Teams.pack([
   make('Arcanine',['flareblitz','closecombat','crunch','extremespeed']),
   make('Venusaur',['gigadrain','sludgebomb','earthpower','synthesis'],{item:'Venusaurite'}),
   make('Kyurem-Black',['fusionbolt','icebeam','earthpower','dragonclaw']),
   make('Gliscor',['earthquake','knockoff','roost','toxic']),
   make('Aerodactyl',['stoneedge','earthquake','crunch','roost']),
   make('Blastoise',['scald','icebeam','rapidspin','protect'])
  ]),
  p2:Teams.pack([
   make('Feraligatr',['waterfall','icepunch','crunch','aquajet']),
   make('Jolteon',['thunderbolt','shadowball','voltswitch','quickattack']),
   make('Tyranitar',['stoneedge','crunch','earthquake','firepunch']),
   make('Lapras',['surf','icebeam','thunderbolt','bodyslam']),
   make('Houndoom',['darkpulse','flamethrower','sludgebomb','nastyplot']),
   make('Machamp',['dynamicpunch','knockoff','stoneedge','bulletpunch'])
  ])
 };
}

/**
 * Validate the public competitive restrictions without inventing the canon
 * classification of "major legendary". Official matches MUST supply the full
 * verified list; practice battles deliberately do not count as tournaments.
 */
export function validatePackedTeam(packed,{majorLegendarySpecies=null,official=false}={}) {
 if(typeof packed!=='string'||packed.length>16000||!packed.trim())throw new Error('Squadra packed mancante o troppo lunga');
 const sets=Teams.unpack(packed);
 if(!Array.isArray(sets)||sets.length!==6)throw new Error('Ogni squadra deve contenere esattamente sei Pokémon');
 if(official&&!Array.isArray(majorLegendarySpecies))throw new Error('Classificazione canonica leggendari maggiori non disponibile');
 const majorIds=new Set((majorLegendarySpecies||[]).map(x=>String(x).toLowerCase().replace(/[^a-z0-9]/g,'')));
 const seenItems=new Set();let majorCount=0;
 for(const set of sets){
  if(!set.species||!Array.isArray(set.moves)||set.moves.length<1||set.moves.length>4)throw new Error('Set Pokémon incompleto');
  const species=Dex.species.get(set.species);
  if(!species.exists)throw new Error('Specie Pokémon sconosciuta: '+set.species);
  if(set.level!=null&&set.level!==100)throw new Error('Solo livello 100');
  // Pokémon Alpha use the ordinary species base stats, with standard IV/EV ceilings.
  // Their Alpha designation is narrative/visual only: no hidden combat multiplier.
  const stats=['hp','atk','def','spa','spd','spe'];
  const evs=stats.map(stat=>set.evs?.[stat]??0);
  const ivs=stats.map(stat=>set.ivs?.[stat]??31);
  if(evs.some(ev=>!Number.isInteger(ev)||ev<0||ev>252)||evs.reduce((a,b)=>a+b,0)>510)
   throw new Error('EV fuori dai limiti standard');
  if(ivs.some(iv=>!Number.isInteger(iv)||iv<0||iv>31))
   throw new Error('IV fuori dai limiti standard');
  const itemId=String(set.item||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(itemId&&seenItems.has(itemId))throw new Error('Item Clause: strumento duplicato');
  if(itemId)seenItems.add(itemId);
  if(set.teraType||set.canGigantamax||set.gigantamax||/-gmax$/i.test(set.species))throw new Error('Tera e Gigantamax non consentiti');
  if(itemId&&Dex.items.get(itemId).zMove)throw new Error('Mosse Z e Cristalli Z non consentiti');
  for(const move of set.moves){const data=Dex.moves.get(move);
   if(data.isZ)throw new Error('Mosse Z non consentite');
   if(data.isMax)throw new Error('Mosse Dynamax non possono essere inserite come mosse ordinarie');
  }
  const baseId=String(species.baseSpecies).toLowerCase().replace(/[^a-z0-9]/g,'');
  if(majorIds.has(species.id)||majorIds.has(baseId))majorCount++;
 }
 if(majorCount>1)throw new Error('Massimo un leggendario maggiore per squadra');
 return packed;
}

export function summarizeVerifiedLog(log) {
 let turn=0;const events=[];let winner=null;
 for(const line of log.split(/\r?\n/)){
  const fields=line.split('|'),type=fields[1];
  if(type==='turn'){turn=Number(fields[2]);continue;}
  if(type==='win')winner=fields[2]||null;
  if(['move','switch','drag','faint','-mega','-dynamax','win'].includes(type))
   events.push({turn,type,actor:fields[2]||'',detail:fields[3]||''});
 }
 return {turns:turn,winner,events};
}

const MAX_LOG_LINES=10000;
export class ArenaService {
 constructor(directory){this.directory=directory;this.sessions=new Map();this.restoring=new Map();}
 file(id){if(!/^[0-9a-f-]{36}$/.test(id))throw new Error('Identificativo non valido');return join(this.directory,id+'.json');}
 pendingFile(id){return this.file(id).replace(/\.json$/,'.pending.json');}
 async pendingOnDisk(id){
  try{return JSON.parse(await readFile(this.pendingFile(id),'utf8'));}
  catch(e){if(e.code==='ENOENT')return null;throw e;}
 }
 async writePending(b){
  // Private packed teams and the precise action ledger are NEVER returned to browsers.
  const data={version:1,id:b.id,ownerDigest:b.ownerDigest,mode:b.mode,npcProfile:b.npcProfile,
   p2name:b.p2name,createdAt:b.createdAt,seed:b.seed,p1team:b.p1team,p2team:b.p2team,
   actions:b.actions.slice(),publicLog:b.publicLog.slice(),requestId:b.requestId};
  const serialized=JSON.stringify(data);
  if(serialized.length>2200000)throw new Error('Registro battaglia oltre il limite');
  await mkdir(this.directory,{recursive:true,mode:0o700});
  const filename=this.pendingFile(b.id);
  const task=async()=>{
   const temp=filename+'.'+randomUUID()+'.tmp';
   await writeFile(temp,serialized,{mode:0o600,flag:'wx'});
   await rename(temp,filename);
  };
  b.pendingWrites=(b.pendingWrites||Promise.resolve()).then(task);
  await b.pendingWrites;
 }
 async recordChoice(b,side,choice,request){
  const event={side,choice,requestHash:requestHash(request)};
  b.actions.push(event);
  try{await this.writePending(b);}catch(e){b.actions.pop();throw e;}
  await b.engine.choose(side,choice);
 }

 async persist(battle,finalStatus=null){
  await mkdir(this.directory,{recursive:true,mode:0o700});
  const snap={...this.snapshot(battle.id),ownerDigest:battle.ownerDigest,status:finalStatus||battle.status,publicLog:battle.publicLog.join('\n'),createdAt:battle.createdAt,analysis:summarizeVerifiedLog(battle.publicLog.join('\n'))};
  delete snap.request;delete snap.choices;
  const filename=this.file(battle.id),tmp=filename+'.tmp';
  await battle.pendingWrites;
  await writeFile(tmp,JSON.stringify(snap),{encoding:'utf8',mode:0o600});await rename(tmp,filename);
  await unlink(this.pendingFile(battle.id)).catch(e=>{if(e.code!=='ENOENT')throw e;});
 }
 snapshot(id) {
  const b=this.sessions.get(id);
  if(!b) return null;
  return {id:b.id,mode:b.mode,publicField:buildReplayTimeline(b.publicLog.join('\n')).frames.at(-1)?.field||null,aiProfiles:{p1:'luke',p2:b.npcProfile},kind:'practice',format:'gen8customgame',status:b.status,p1name:'Luke',p2name:b.p2name,turn:b.turn,requestId:b.requestId,request:b.mode==='manual'&&b.awaitingSide==='p1'?b.privateRequest:null,choices:b.mode==='manual'&&b.awaitingSide==='p1'?legalChoices(b.privateRequest):[],log:b.publicLog.slice(-800).join('\n'),winner:b.winner,error:b.error,createdAt:b.createdAt};
 }
 async load(id) {
  const active=this.snapshot(id);
  if(active&&!['complete','tie'].includes(active.status))return active;
  const journal=await this.pendingOnDisk(id);
  if(journal){
   if(!this.restoring.has(id)){
    const attempt=this.restore(journal).finally(()=>this.restoring.delete(id));
    this.restoring.set(id,attempt);
   }
   await this.restoring.get(id);
   return this.snapshot(id);
  }
  try{const saved=JSON.parse(await readFile(this.file(id),'utf8'));return {...saved,request:null,choices:[],log:saved.publicLog};}
  catch(e){if(e.code==='ENOENT')return null;throw e;}
 }
 async ownsBattle(id,sessionId){
  if(typeof sessionId!=='string'||!sessionId)return false;
  const battle=this.sessions.get(id);
  if(battle)return !!battle.ownerDigest&&battle.ownerDigest===ownerDigest(sessionId);
  const saved=await this.pendingOnDisk(id);
  if(saved)return !!saved.ownerDigest&&saved.ownerDigest===ownerDigest(sessionId);
  try{
   const finished=JSON.parse(await readFile(this.file(id),'utf8'));
   return !!finished.ownerDigest&&finished.ownerDigest===ownerDigest(sessionId);
  }catch(e){if(e.code==='ENOENT')return false;throw e;}
 }
 async list(sessionId=null){
  await mkdir(this.directory,{recursive:true,mode:0o700});
  const files=(await readdir(this.directory)).filter(x=>/^[0-9a-f-]{36}(?:\.pending)?\.json$/.test(x)).slice(-200);
  const saved=await Promise.all(files.map(async f=>{
   try{
    const a=JSON.parse(await readFile(join(this.directory,f),'utf8'));
    return {id:a.id,status:f.endsWith('.pending.json')?'active':a.status,winner:a.winner||null,
     turn:f.endsWith('.pending.json')?(a.publicLog||[]).filter(v=>v.startsWith('|turn|')).length:a.turn,
     createdAt:a.createdAt,p2name:a.p2name,ownerDigest:a.ownerDigest??null};
   }catch{return null;}
  }));
  const unique=new Map();
  for(const item of saved.filter(x=>x&&x.ownerDigest===ownerDigest(sessionId))){
   if(!unique.has(item.id)||item.status!=='active')unique.set(item.id,item);
  }
  return [...unique.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
   .map(({ownerDigest,...item})=>item);
 }
 async restore(journal){
  if(journal?.version!==1||!this.file(journal.id)||!VALID_MODES.has(journal.mode)||
     !Object.hasOwn(AI_PROFILES,journal.npcProfile)||
     !Array.isArray(journal.seed)||journal.seed.length!==4||
     !Array.isArray(journal.actions)||journal.actions.length>5000||
     !Array.isArray(journal.publicLog)||journal.publicLog.length>MAX_LOG_LINES)
    throw new Error('Registro di recupero battaglia non valido');
  validatePackedTeam(journal.p1team);validatePackedTeam(journal.p2team);
  if(journal.actions.some(a=>!['p1','p2'].includes(a.side)||
       !/^(?:move [1-4](?: mega| dynamax)?|switch [1-6]|team [1-6]{1,6})$/.test(a.choice)||
       !/^[a-f0-9]{64}$/.test(a.requestHash)))
   throw new Error('Comandi di recupero non validi');
  const b={id:journal.id,mode:journal.mode,npcProfile:journal.npcProfile,ownerDigest:journal.ownerDigest,
   p2name:journal.p2name,createdAt:journal.createdAt,seed:journal.seed,p1team:journal.p1team,
   p2team:journal.p2team,actions:journal.actions,publicLog:[],status:'active',turn:0,requestId:0,
   awaitingSide:null,privateRequest:null,winner:null,error:null,pendingWrites:Promise.resolve(),stopped:false};
  // Do not expose a request until the recorded public prefix has been reproduced.
  b.replaySkip={
   p1:b.actions.filter(x=>x.side==='p1'),
   p2:b.actions.filter(x=>x.side==='p2')
  };
  b.expectedPublic=journal.publicLog;
  this.sessions.set(b.id,b);
  try{
   await this.runBattle(b,{replay:true});
   return b;
  }catch(e){
   this.sessions.delete(b.id);
   await b.engine?.close().catch(()=>{});
   throw e;
  }
 }
 async create({mode='manual',p1team,p2team,p2name='NPC',practice=false,
  sessionId=null,official=false,npcProfile='balanced'}={}){
  if(official)throw new Error('Partite ufficiali non disponibili: qualificati e regolamento canonico incompleti');
  if(!VALID_MODES.has(mode))throw new Error('Modalità non valida');
  if(typeof npcProfile!=='string'||!Object.hasOwn(AI_PROFILES,npcProfile))throw new Error('Profilo NPC non valido');
  if(!VALID_NAME.test(p2name)||p2name==='Luke')throw new Error('Nome avversario non valido');
  if(practice){const teams=practiceTeams();p1team=teams.p1;p2team=teams.p2;p2name='NPC (allenamento)';}
  validatePackedTeam(p1team);validatePackedTeam(p2team);
  const b={id:randomUUID(),mode,npcProfile:resolveAiProfile(npcProfile),ownerDigest:ownerDigest(sessionId),
   p2name,createdAt:new Date().toISOString(),seed:randomSeed(),p1team,p2team,actions:[],
   status:'active',turn:0,requestId:0,awaitingSide:null,privateRequest:null,publicLog:[],
   winner:null,error:null,pendingWrites:Promise.resolve(),stopped:false};
  await this.writePending(b);
  this.sessions.set(b.id,b);
  try{await this.runBattle(b);return this.snapshot(b.id);}
  catch(e){this.sessions.delete(b.id);await b.engine?.close().catch(()=>{});throw e;}
 }
 async runBattle(b,{replay=false}={}){
  const engine=await createShowdownBattle({
   p1team:b.p1team,p2team:b.p2team,p1name:'Luke',p2name:b.p2name,seed:b.seed,format:'gen8customgame'
  });
  b.engine=engine;
  const fail=e=>{
   if(b.stopped)return;
   b.status='error';b.error=String(e?.message||e);
   // The private journal is deliberately retained to permit forensic recovery.
  };
  if(replay){
   for(const action of b.actions)await engine.choose(action.side,action.choice);
  }
  const publicLoop=async()=>{
   let prefixIndex=0;
   for await(const chunk of engine.spectator){
    for(const line of String(chunk).split(/\r?\n/)){
     if(!line||line.startsWith('|request|')||line.startsWith('|split|'))continue;
     if(b.publicLog.length>=MAX_LOG_LINES)throw new Error('Log oltre il limite di sicurezza');
     if(replay&&prefixIndex<b.expectedPublic.length){
      if(line!==b.expectedPublic[prefixIndex])throw new Error('Recupero rifiutato: log Showdown non deterministico (linea '+prefixIndex+': atteso '+JSON.stringify(b.expectedPublic[prefixIndex]).slice(0,160)+', ottenuto '+JSON.stringify(line).slice(0,160)+')');
      prefixIndex++;
     }
     b.publicLog.push(line);
     if(line.startsWith('|turn|'))b.turn=Number(line.slice(6))||b.turn;
     if(line.startsWith('|win|')){
      const outcome=parseShowdownOutcome(b.publicLog.join('\n'));
      b.winner=outcome.winnerName;b.awaitingSide=null;b.privateRequest=null;
      await this.persist(b,'complete');b.status='complete';return;
     }
     if(line.startsWith('|tie|')){
      b.awaitingSide=null;b.privateRequest=null;
      await this.persist(b,'tie');b.status='tie';return;
     }
    }
   }
   if(!b.stopped&&b.status==='active')throw new Error('Stream concluso senza risultato Showdown');
  };
  const spectatorTask=publicLoop().catch(fail);
  if(replay){
   // Stream is replayed in the exact persisted order, never silently branched.
   const deadline=Date.now()+4000;
   while(b.publicLog.length<b.expectedPublic.length&&b.status==='active'&&Date.now()<deadline)
    await new Promise(resolve=>setTimeout(resolve,10));
   if(b.status==='error')throw Error(b.error);
   if(b.publicLog.length<b.expectedPublic.length)throw Error('Recupero non confermato dal log Showdown');
   // Keep the verified prefix as a guard for subsequent public packets.
  }
  const playerLoop=async side=>{
   let skip=0;
   const previous=replay?b.replaySkip[side]:[];
   for await(const chunk of engine[side]){
    for(const line of String(chunk).split(/\r?\n/)){
     if(line.startsWith('|error|')){b.error=line.slice(7);continue;}
     if(!line.startsWith('|request|'))continue;
     const request=JSON.parse(line.slice(9));
     if(b.status!=='active'||request.wait)continue;
     if(skip<previous.length){
      if(previous[skip].requestHash!==requestHash(request))
       throw new Error('Recupero rifiutato: richiesta Showdown divergente');
      skip++;
      if(side==='p1'&&b.mode==='manual')b.requestId++;
      continue;
     }
     if(side==='p1'&&b.mode==='manual'){
      b.privateRequest=request;b.requestId++;b.awaitingSide='p1';
     }else{
      const choice=selectTacticalChoice(request,{side,publicLog:b.publicLog.join('\n'),
       profile:side==='p1'?'luke':b.npcProfile})||selectAiFallback(request);
      if(choice)await this.recordChoice(b,side,choice,request);
     }
    }
   }
   if(replay&&!b.stopped&&skip<previous.length)throw Error('Registro Showdown incompleto in recupero');
  };
  void playerLoop('p1').catch(fail);
  void playerLoop('p2').catch(fail);
  void spectatorTask;
 }
 async choose(id,{choice,requestId}){
  const b=this.sessions.get(id);
  if(!b||b.status!=='active'||b.mode!=='manual'||b.awaitingSide!=='p1')
   throw new Error('Nessuna scelta manuale disponibile');
  if(!Number.isInteger(requestId)||requestId!==b.requestId)throw new Error('Richiesta obsoleta');
  validateChoice(b.privateRequest,choice);
  const request=b.privateRequest;
  b.awaitingSide=null;b.privateRequest=null;
  await this.recordChoice(b,'p1',choice,request);
  return this.snapshot(id);
 }
 async shutdown(){
  for(const b of this.sessions.values()){
   b.stopped=true;
   await b.pendingWrites;
   await b.engine?.close().catch(()=>{});
  }
  this.sessions.clear();
 }

}
