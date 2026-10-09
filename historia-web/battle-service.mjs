import {randomUUID,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {createShowdownBattle} from './showdown-engine.mjs';
import {legalChoices,validateChoice,selectAiFallback} from './showdown-protocol.mjs';
import {selectTacticalChoice,resolveAiProfile,AI_PROFILES} from './tactical-ai.mjs';
import {parseShowdownOutcome} from '../historia/src/showdown-bridge.mjs';

const require=createRequire(import.meta.url);
const {Teams,Dex}=require('pokemon-showdown');
const VALID_MODES=new Set(['manual','auto']);
const VALID_NAME=/^[\p{L}\p{N} ._'-]{1,40}$/u;
const ownerDigest=sessionId=>sessionId?createHash('sha256').update(sessionId).digest('hex'):null;

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
 constructor(directory){this.directory=directory;this.sessions=new Map();}
 file(id){if(!/^[0-9a-f-]{36}$/.test(id))throw new Error('Identificativo non valido');return join(this.directory,id+'.json');}
 async persist(battle,finalStatus=null){
  await mkdir(this.directory,{recursive:true});
  const snap={...this.snapshot(battle.id),ownerDigest:battle.ownerDigest,status:finalStatus||battle.status,publicLog:battle.publicLog.join('\n'),createdAt:battle.createdAt,analysis:summarizeVerifiedLog(battle.publicLog.join('\n'))};
  delete snap.request;delete snap.choices;
  const filename=this.file(battle.id),tmp=filename+'.tmp';
  await writeFile(tmp,JSON.stringify(snap),'utf8');await rename(tmp,filename);
 }
 snapshot(id) {
  const b=this.sessions.get(id);
  if(!b) return null;
  return {id:b.id,mode:b.mode,aiProfiles:{p1:'luke',p2:b.npcProfile},kind:'practice',format:'gen8customgame',status:b.status,p1name:'Luke',p2name:b.p2name,turn:b.turn,requestId:b.requestId,request:b.mode==='manual'&&b.awaitingSide==='p1'?b.privateRequest:null,choices:b.mode==='manual'&&b.awaitingSide==='p1'?legalChoices(b.privateRequest):[],log:b.publicLog.slice(-800).join('\n'),winner:b.winner,error:b.error,createdAt:b.createdAt};
 }
 async load(id) {
  const active=this.snapshot(id);
  if(active && !['complete','tie'].includes(active.status))return active;
  try{const saved=JSON.parse(await readFile(this.file(id),'utf8'));return {...saved,request:null,choices:[],log:saved.publicLog};}
  catch(e){if(e.code==='ENOENT')return active;throw e;}
 }
 async ownsBattle(id,sessionId){
  if(typeof sessionId!=='string'||!sessionId)return false;
  const battle=this.sessions.get(id);
  if(battle)return !!battle.ownerDigest && battle.ownerDigest===ownerDigest(sessionId);
  try{
   const saved=JSON.parse(await readFile(this.file(id),'utf8'));
   return !!saved.ownerDigest && saved.ownerDigest===ownerDigest(sessionId);
  }catch(e){if(e.code==='ENOENT')return false;throw e;}
 }
 async list(sessionId=null) {
  await mkdir(this.directory,{recursive:true});
  const files=(await readdir(this.directory)).filter(x=>/^[0-9a-f-]{36}\.json$/.test(x)).slice(-100);
  const saved=await Promise.all(files.map(async f=>{try{const a=JSON.parse(await readFile(join(this.directory,f),'utf8'));return {id:a.id,status:a.status,winner:a.winner,turn:a.turn,createdAt:a.createdAt,p2name:a.p2name,ownerDigest:a.ownerDigest??null}}catch{return null;}}));
  return saved.filter(x=>x && x.ownerDigest===ownerDigest(sessionId)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(({ownerDigest,...item})=>item);
 }
 async create({mode='manual',p1team,p2team,p2name='NPC',practice=false,sessionId=null,official=false,npcProfile='balanced'}={}) {
  if(official)throw new Error('Partite ufficiali non disponibili: qualificati e regolamento canonico incompleti');
  if(!VALID_MODES.has(mode))throw new Error('Modalità non valida');
  if(typeof npcProfile!=='string'||!Object.hasOwn(AI_PROFILES,npcProfile))throw new Error('Profilo NPC non valido');
  if(!VALID_NAME.test(p2name)||p2name==='Luke')throw new Error('Nome avversario non valido');
  if(practice){const teams=practiceTeams();p1team=teams.p1;p2team=teams.p2;p2name='NPC (allenamento)';}
  validatePackedTeam(p1team);validatePackedTeam(p2team);
  const id=randomUUID(),battle={id,mode,npcProfile:resolveAiProfile(npcProfile),ownerDigest:ownerDigest(sessionId),p2name,status:'active',turn:0,requestId:0,awaitingSide:null,privateRequest:null,publicLog:[],winner:null,error:null,createdAt:new Date().toISOString()};
  const engine=await createShowdownBattle({p1team,p2team,p1name:'Luke',p2name,format:'gen8customgame'});
  battle.engine=engine;this.sessions.set(id,battle);
  const fail=(e)=>{battle.status='error';battle.error=String(e?.message||e);void this.persist(battle).catch(()=>{});};
  const playerLoop=async(side)=>{
   for await(const chunk of engine[side]){
    for(const line of String(chunk).split(/\r?\n/)){
     if(line.startsWith('|error|')){battle.error=line.slice(7);continue;}
     if(!line.startsWith('|request|'))continue;
     const request=JSON.parse(line.slice(9));
     if(battle.status!=='active'||request.wait)continue;
     if(side==='p1'&&mode==='manual'){
      battle.privateRequest=request;battle.requestId++;battle.awaitingSide='p1';
     } else {
      const choice=selectTacticalChoice(request,{side,publicLog:battle.publicLog.join('\n'),profile:side==='p1'?'luke':battle.npcProfile})||selectAiFallback(request);
      if(choice)await engine.choose(side,choice);
     }
    }
   }
  };
  const publicLoop=async()=>{
   for await(const chunk of engine.spectator){
    for(const line of String(chunk).split(/\r?\n/)){
     if(!line||line.startsWith('|request|')||line.startsWith('|split|'))continue;
     if(battle.publicLog.length>=MAX_LOG_LINES)throw new Error('Log oltre il limite di sicurezza');
     battle.publicLog.push(line);
     if(line.startsWith('|turn|'))battle.turn=Number(line.slice(6))||battle.turn;
     if(line.startsWith('|win|')){
      // Terminal receipt is parsed from the actual Showdown public stream.
      const outcome=parseShowdownOutcome(battle.publicLog.join('\n'));
      battle.winner=outcome.winnerName;
      battle.awaitingSide=null;battle.privateRequest=null;
      await this.persist(battle,'complete');battle.status='complete';
      return;
     }
     if(line.startsWith('|tie|')){await this.persist(battle,'tie');battle.status='tie';return;}
    }
   }
   if(battle.status==='active')throw new Error('Stream concluso senza risultato Showdown');
  };
  void playerLoop('p1').catch(fail);
  void playerLoop('p2').catch(fail);
  void publicLoop().catch(fail);
  return this.snapshot(id);
 }
 async choose(id,{choice,requestId}) {
  const b=this.sessions.get(id);
  if(!b||b.status!=='active'||b.mode!=='manual'||b.awaitingSide!=='p1')throw new Error('Nessuna scelta manuale disponibile');
  if(!Number.isInteger(requestId)||requestId!==b.requestId)throw new Error('Richiesta obsoleta');
  validateChoice(b.privateRequest,choice);
  b.awaitingSide=null;b.privateRequest=null;
  await b.engine.choose('p1',choice);
  return this.snapshot(id);
 }
}
