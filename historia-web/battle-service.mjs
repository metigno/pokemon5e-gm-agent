import {WHAT_IF_MAJOR_LEGENDARIES} from './historia-rules.mjs';
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
export function validatePackedTeam(packed,{majorLegendarySpecies=null,official=false,teamLabel='Squadra'}={}) {
 if(typeof packed!=='string'||packed.length>16000||!packed.trim())throw new Error('Squadra packed mancante o troppo lunga');
 const sets=Teams.unpack(packed);
 if(!Array.isArray(sets)||sets.length!==6)throw new Error('Ogni squadra deve contenere esattamente sei Pokémon');
 if(official&&!Array.isArray(majorLegendarySpecies))throw new Error('Classificazione canonica leggendari maggiori non disponibile');
 const majorIds=new Set((majorLegendarySpecies||WHAT_IF_MAJOR_LEGENDARIES).map(x=>String(x).toLowerCase().replace(/[^a-z0-9]/g,'')));
 // Item Clause belongs to one trainer, never pooled with an opponent's team.
 const seenItems=new Map();let majorCount=0;
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
  if(itemId){
   if(!Dex.items.get(itemId).exists)throw new Error('Strumento sconosciuto: '+set.item);
   const currentPokemon=set.name||set.species;
   if(seenItems.has(itemId))
    throw new Error('Item Clause ('+teamLabel+'): '+set.item+' duplicato tra '+seenItems.get(itemId)+' e '+currentPokemon);
   seenItems.set(itemId,currentPokemon);
  }
  if(set.ability&&!Dex.abilities.get(set.ability).exists)throw new Error('Abilità sconosciuta: '+set.ability);
  if(set.teraType)throw new Error('Teracristallizzazione non consentita');
  if(set.gigantamax&&!species.canGigantamax)throw new Error('Specie non compatibile con Gigantamax: '+set.species);
  if(/-gmax$/i.test(set.species))throw new Error('Importare la specie base con Gigantamax: Yes');
  if(itemId&&Dex.items.get(itemId).zMove)throw new Error('Mosse Z e Cristalli Z non consentiti');
  for(const move of set.moves){const data=Dex.moves.get(move);
   if(!data.exists)throw new Error('Mossa sconosciuta: '+move);
   if(data.isZ)throw new Error('Mosse Z non consentite');
   if(data.isMax)throw new Error('Mosse Dynamax non possono essere inserite come mosse ordinarie');
  }
  const baseId=String(species.baseSpecies).toLowerCase().replace(/[^a-z0-9]/g,'');
  if(majorIds.has(species.id)||majorIds.has(baseId))majorCount++;
 }
 if(majorCount>1)throw new Error('Massimo un leggendario maggiore per squadra');
 return packed;
}

/**
 * Showdown's own parser accepts both exported six-set text and packed teams.
 * No fallback, autogenerated roster or modified moves: always validate the
 * round-tripped team before it reaches the simulator.
 */
export function parseTeamInput(input,{teamLabel='Squadra'}={}){
 if(typeof input!=='string'||!input.trim()||input.length>20000)
  throw new Error('Importazione squadra mancante o troppo lunga');
 let sets;
 try{sets=Teams.import(input.trim());}
 catch{throw new Error('Formato squadra Showdown non valido');}
 if(!Array.isArray(sets)||sets.length!==6)throw new Error('Importare esattamente sei Pokémon Showdown');
 const packed=Teams.pack(sets);
 validatePackedTeam(packed,{teamLabel});
 return packed;
}
export function exportTeamInput(input){return Teams.export(Teams.unpack(parseTeamInput(input)));}
export function describeTeam(input,{teamLabel='Squadra'}={}){
 return Teams.unpack(parseTeamInput(input,{teamLabel})).map(set=>({
  name:set.name||set.species,species:set.species,item:set.item||'',
  ability:set.ability||'',nature:set.nature||'',
  level:set.level??100,evs:set.evs||{},ivs:set.ivs||{},
  moves:[...set.moves],gigantamax:!!set.gigantamax
 }));
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
  if(b.stopped||b.finalizing||['complete','tie'].includes(b.status))return;
  // Private packed teams and the precise action ledger are NEVER returned to browsers.
  const data={version:1,format:b.format,id:b.id,ownerDigest:b.ownerDigest,mode:b.mode,npcProfile:b.npcProfile,
   p1name:b.p1name,p1profile:b.p1profile,kind:b.kind,p1dynamaxTarget:b.p1dynamaxTarget,p2dynamaxTarget:b.p2dynamaxTarget,p2name:b.p2name,createdAt:b.createdAt,seed:b.seed,p1team:b.p1team,p2team:b.p2team,
   actions:b.actions.slice(),publicLog:b.publicLog.slice(),requestId:b.requestId};
  const serialized=JSON.stringify(data);
  if(serialized.length>2200000)throw new Error('Registro battaglia oltre il limite');
  await mkdir(this.directory,{recursive:true,mode:0o700});
  const filename=this.pendingFile(b.id);
  const task=async()=>{
   if(b.stopped||b.finalizing)return;
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
  if(!b.stopped)await b.engine.choose(side,choice);
 }

 async persist(battle,finalStatus=null){
  battle.finalizing=true;
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
  return {id:b.id,mode:b.mode,publicField:buildReplayTimeline(b.publicLog.join('\n')).frames.at(-1)?.field||null,aiProfiles:{p1:b.p1profile||'luke',p2:b.npcProfile},kind:b.kind||'practice',format:b.format||'gen8customgame',status:b.status,p1name:b.p1name||'Luke',p2name:b.p2name,turn:b.turn,requestId:b.requestId,request:b.mode==='manual'&&b.awaitingSide==='p1'?b.privateRequest:null,p1roster:b.mode==='manual'?describeTeam(b.p1team):null,choices:b.mode==='manual'&&b.awaitingSide==='p1'?legalChoices(b.privateRequest,{dynamaxTarget:b.p1dynamaxTarget}):[],log:b.publicLog.slice(-800).join('\n'),winner:b.winner,error:b.error,createdAt:b.createdAt};
 }
 async load(id) {
  const live=this.sessions.get(id);
  if(live?.status==='active'){
   const shown=this.snapshot(id);
   // A snapshot must not become visible before its public events have a
   // crash-recoverable checkpoint. Snapshot is captured before the async write.
   await this.writePending(live);
   return shown;
  }
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
      (journal.p1profile!==undefined&&!Object.hasOwn(AI_PROFILES,journal.p1profile))||
      (journal.p1name!==undefined&&(!VALID_NAME.test(journal.p1name)||journal.p1name===journal.p2name))||
     !Array.isArray(journal.seed)||journal.seed.length!==4||
     !Array.isArray(journal.actions)||journal.actions.length>5000||
     !Array.isArray(journal.publicLog)||journal.publicLog.length>MAX_LOG_LINES)
    throw new Error('Registro di recupero battaglia non valido');
  // Old journals replay their originally accepted rule policy and format.
  const policy=journal.format==='historia'?{}:{majorLegendarySpecies:[]};
  validatePackedTeam(journal.p1team,policy);validatePackedTeam(journal.p2team,policy);
  if(journal.actions.some(a=>!['p1','p2'].includes(a.side)||
       !/^(?:move [1-4](?: mega| dynamax)?|switch [1-6]|team [1-6]{1,6})$/.test(a.choice)||
       !/^[a-f0-9]{64}$/.test(a.requestHash)))
   throw new Error('Comandi di recupero non validi');
  const b={id:journal.id,mode:journal.mode,npcProfile:journal.npcProfile,ownerDigest:journal.ownerDigest,
    format:journal.format||'gen8customgame',p1name:journal.p1name||'Luke',p1profile:journal.p1profile||'luke',kind:journal.kind||'practice',
    p1dynamaxTarget:journal.p1dynamaxTarget||null,p2dynamaxTarget:journal.p2dynamaxTarget||null,
   p2name:journal.p2name,createdAt:journal.createdAt,seed:journal.seed,p1team:journal.p1team,
   p2team:journal.p2team,actions:journal.actions,publicLog:[],status:'active',turn:0,requestId:0,
   awaitingSide:null,privateRequest:null,winner:null,error:null,pendingWrites:Promise.resolve(),stopped:false};
  // Do not expose a request until the recorded public prefix has been reproduced.
  b.replaySkip={
   p1:b.actions.filter(x=>x.side==='p1'),
   p2:b.actions.filter(x=>x.side==='p2')
  };
  b.expectedPublic=journal.publicLog;
  b.previousRequestId=journal.requestId||0;
  // Journal may precede the latest request by one server event; reserve a
  // strictly newer token before exposing any restored action.
  b.requestId=b.previousRequestId+2;
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
 async create({mode='manual',p1team,p2team,p1name='Luke',p2name='NPC',practice=false,canonicalPractice=false,
  sessionId=null,official=false,p1profile='luke',npcProfile='balanced',kind='practice',
  p1dynamaxTarget=null,p2dynamaxTarget=null}={}){
  if(official)throw new Error('Partite ufficiali non disponibili: qualificati e regolamento canonico incompleti');
  if(!VALID_MODES.has(mode))throw new Error('Modalità non valida');
   if(typeof npcProfile!=='string'||!Object.hasOwn(AI_PROFILES,npcProfile)||
      typeof p1profile!=='string'||!Object.hasOwn(AI_PROFILES,p1profile))throw new Error('Profilo NPC non valido');
   if(!VALID_NAME.test(p1name)||!VALID_NAME.test(p2name)||p1name===p2name)
    throw new Error('Nomi allenatori non validi o duplicati');
   if(mode==='manual'&&p1name!=='Luke')throw new Error('Controllo manuale riservato a Luke');
   if(!['practice','worldcup-what-if'].includes(kind))throw new Error('Tipo battaglia non valido');
   if(practice&&(p1name!=='Luke'||kind!=='practice'))throw new Error('Allenamento riservato a Luke');
  if(canonicalPractice){
   if(practice||p1team||p2team||kind!=='practice'||p1name!=='Luke')throw Error('Allenamento canonico e fixture/importazioni non possono essere combinati');
   const {canonicalTeam,canonicalDynamaxTarget}=await import('./canonical-2060-teams.mjs');
   p1team=canonicalTeam('Luke');p2team=canonicalTeam('Mattew');p2name='Mattew';
   p1dynamaxTarget=canonicalDynamaxTarget('Luke');p2dynamaxTarget=canonicalDynamaxTarget('Mattew');
  }
  if(practice){
   if(p1team||p2team)throw new Error('Allenamento dimostrativo e squadre importate non possono essere combinati');
   const teams=practiceTeams();p1team=teams.p1;p2team=teams.p2;p2name='NPC (allenamento)';
  }
  p1team=parseTeamInput(p1team,{teamLabel:p1name});
  p2team=parseTeamInput(p2team,{teamLabel:p2name});
  const confirmTarget=(team,target,label)=>{
   if(target==null)return null;
   if(typeof target!=='string'||!target.trim()||!Teams.unpack(team).some(m=>m.species===target))
    throw new Error('Dynamax designato non presente nel team '+label);
   return target;
  };
  p1dynamaxTarget=confirmTarget(p1team,p1dynamaxTarget,p1name);
  p2dynamaxTarget=confirmTarget(p2team,p2dynamaxTarget,p2name);
  const active=[...this.sessions.values()].filter(b=>b.status==='active');
  if(active.length>=24)throw new Error('Limite battaglie simultanee del server');
  if(active.filter(b=>b.ownerDigest===ownerDigest(sessionId)).length>=2)
   throw new Error('Limite di due battaglie attive per sessione');
  const b={id:randomUUID(),format:'historia',mode,npcProfile:resolveAiProfile(npcProfile),ownerDigest:ownerDigest(sessionId),
   p1name,p1profile:resolveAiProfile(p1profile),kind,p1dynamaxTarget,p2dynamaxTarget,p2name,createdAt:new Date().toISOString(),seed:randomSeed(),p1team,p2team,actions:[],
   status:'active',turn:0,requestId:0,awaitingSide:null,privateRequest:null,publicLog:[],
   winner:null,error:null,pendingWrites:Promise.resolve(),stopped:false};
  await this.writePending(b);
  this.sessions.set(b.id,b);
  try{await this.runBattle(b);const shown=this.snapshot(b.id);await this.writePending(b);return shown;}
  catch(e){this.sessions.delete(b.id);await b.engine?.close().catch(()=>{});throw e;}
 }
 async runBattle(b,{replay=false}={}){
  const engine=await createShowdownBattle({
   p1team:b.p1team,p2team:b.p2team,p1name:b.p1name,p2name:b.p2name,seed:b.seed,format:b.format||'gen8customgame'
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
     let reproduced=line;
     if(replay&&prefixIndex<b.expectedPublic.length){
      const previous=b.expectedPublic[prefixIndex];
      // Showdown emits wall-clock '|t:|' entries. They are metadata, not RNG
      // or battle state. Preserve the original public timestamp in the replay.
      if(/^\|t:\|\d{9,12}$/.test(line)&&/^\|t:\|\d{9,12}$/.test(previous)){
       reproduced=previous;
      }else if(line!==previous){
       throw new Error('Recupero rifiutato: log Showdown non deterministico (linea '+prefixIndex+': atteso '+JSON.stringify(previous).slice(0,160)+', ottenuto '+JSON.stringify(line).slice(0,160)+')');
      }
      prefixIndex++;
     }
     b.publicLog.push(reproduced);
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
   // Showdown can coalesce historical side-request packets during journal
   // re-entry. Read the exact live request from the simulator as a fallback.
   // Bump rqid so stale pre-crash clicks can never act on the restored turn.
   if(b.mode==='manual'){
    const actual=engine.currentRequest('p1');
    if(actual&&!actual.wait){
     b.privateRequest=actual;
     b.awaitingSide='p1';
     b.requestId=Math.max(b.requestId,b.previousRequestId+2);
    }
   }
  }
  if(replay&&b.status==='active')engine.reissuePendingRequests();
  const playerLoop=async side=>{
   let skip=0;
   const previous=replay?b.replaySkip[side]:[];
   for await(const chunk of engine[side]){
    for(const line of String(chunk).split(/\r?\n/)){
     if(line.startsWith('|error|')){b.error=line.slice(7);continue;}
     if(!line.startsWith('|request|'))continue;
     const request=JSON.parse(line.slice(9));
     if(b.stopped||b.status!=='active'||request.wait)continue;
     if(skip<previous.length){
      if(previous[skip].requestHash!==requestHash(request))
       throw new Error('Recupero rifiutato: richiesta Showdown divergente');
      skip++;
      // Skipped historical requests have already been recorded in the ledger.
      continue;
     }
     if(side==='p1'&&b.mode==='manual'){
      const sameRestored=b.privateRequest&&requestHash(b.privateRequest)===requestHash(request);
      b.privateRequest=request;
      if(!sameRestored)b.requestId++;
      b.awaitingSide='p1';
     }else{
      const choice=selectTacticalChoice(request,{side,publicLog:b.publicLog.join('\n'),
       profile:side==='p1'?b.p1profile:b.npcProfile,
        dynamaxTarget:side==='p1'?b.p1dynamaxTarget:b.p2dynamaxTarget})||
        selectAiFallback(request,{dynamaxTarget:side==='p1'?b.p1dynamaxTarget:b.p2dynamaxTarget});
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
  validateChoice(b.privateRequest,choice,{dynamaxTarget:b.p1dynamaxTarget});
  const request=b.privateRequest;
  b.awaitingSide=null;b.privateRequest=null;
  await this.recordChoice(b,'p1',choice,request);
  const shown=this.snapshot(id);
  if(b.status==='active')await this.writePending(b);
  return shown;
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
