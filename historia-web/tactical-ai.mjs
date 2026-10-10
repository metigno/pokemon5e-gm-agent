/**
 * Deterministic, inspectable tactical controller for non-canonical training.
 *
 * Information barrier:
 *   1. request comes from THIS player's private Showdown stream only.
 *   2. publicLog comes from the spectator stream only.
 *   3. Dex contains public species, type and move data (not hidden builds).
 *
 * Never accept or inspect the opposing player's request, unrevealed moves,
 * held items, EVs/IVs, abilities, or omniscient stream.
 * Showdown alone calculates legal actions, damage and battle outcomes.
 */
import {createRequire} from 'node:module';
import {legalChoices,selectAiFallback} from './showdown-protocol.mjs';

const {Dex}=createRequire(import.meta.url)('pokemon-showdown');
const id=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export const AI_PROFILES=Object.freeze({
 luke: Object.freeze({label:'Luke · Adaptive Bulky Pressure',offense:1.0,utility:1.10,setup:1.00,switching:1.25,mega:1.00,dynamax:1.00}),
 mattew: Object.freeze({label:'Mattew · Tecnico',offense:1.02,utility:1.10,setup:1.24,switching:1.18,mega:1.0,dynamax:0.94}),
 daniel: Object.freeze({label:'Daniel · Analitico',offense:0.98,utility:1.20,setup:1.16,switching:1.12,mega:0.95,dynamax:0.95}),
 edward: Object.freeze({label:'Edward · Offensivo',offense:1.32,utility:0.65,setup:0.94,switching:0.65,mega:1.25,dynamax:1.28}),
 fab: Object.freeze({label:'Fab · Creativo',offense:0.99,utility:1.02,setup:0.92,switching:0.95,mega:1.04,dynamax:1.14}),
 balanced: Object.freeze({label:'Allenatore · Bilanciato',offense:1,utility:1,setup:1,switching:1,mega:1,dynamax:1})
});
export function resolveAiProfile(value='balanced') {
 const key=id(value);
 return Object.hasOwn(AI_PROFILES,key)?key:'balanced';
}
function hpFraction(pokemon) {
 const condition=String(pokemon?.condition||'');
 if(condition.includes('fnt'))return 0;
 const hit=condition.match(/^(\d+)\/(\d+)/);
 if(hit&&Number(hit[2])>0)return clamp(Number(hit[1])/Number(hit[2]),0,1);
 return 1;
}
function infoSpecies(entry) {
 const detail=String(entry?.details||'').split(',')[0].trim();
 const name=detail||String(entry?.ident||'').split(': ').at(-1);
 const species=Dex.species.get(name);
 return species?.exists?species:null;
}
function publicObservation(log,side) {
 // Only Showdown's spectator feed is admitted by ArenaService.
 const foe=side==='p1'?'p2':'p1';
 const state={foeSpecies:null,foeStatus:null,foeLeechSeed:false,foeHazards:new Set(),ownHazards:new Set(),turn:0,ownBoosts:0,lastOwnMove:null};
 const hazardIds=new Set(['Stealth Rock','Spikes','Toxic Spikes','Sticky Web']);
 let ownActive=false;
 for(const line of String(log||'').split(/\r?\n/)) {
  if(line.startsWith('|turn|')){const n=Number(line.slice(6));if(Number.isInteger(n))state.turn=n;continue;}
  const parts=line.split('|'),event=parts[1],actor=parts[2]||'',details=parts[3]||'';
  if(['switch','drag','replace'].includes(event)) {
   if(actor.startsWith(foe+'a:')) {
    const candidate=Dex.species.get(details.split(',')[0]);
    state.foeSpecies=candidate?.exists?candidate:null;
    state.foeStatus=null;state.foeLeechSeed=false;
   }
   if(actor.startsWith(side+'a:')){ownActive=true;state.ownBoosts=0;state.lastOwnMove=null;}
  }
  if(event==='faint'&&actor.startsWith(foe+'a:')){state.foeSpecies=null;state.foeStatus=null;state.foeLeechSeed=false;}
  if(event==='-status'&&actor.startsWith(foe+'a:'))state.foeStatus=details;
  if(event==='-curestatus'&&actor.startsWith(foe+'a:'))state.foeStatus=null;
  if(event==='-start'&&actor.startsWith(foe+'a:')&&id(details)==='leechseed')state.foeLeechSeed=true;
  if(['-sidestart','-sideend'].includes(event)&&hazardIds.has(details.replace(/^move: /,''))){
   const hazards=actor.split(':')[0]===foe?state.foeHazards:actor.split(':')[0]===side?state.ownHazards:null;
   if(hazards)hazards[event==='-sidestart'?'add':'delete'](details.replace(/^move: /,''));
  }
  if(event==='-boost'&&actor.startsWith(side+'a:'))state.ownBoosts+=Number(parts[4])||1;
  if(event==='-unboost'&&actor.startsWith(side+'a:'))state.ownBoosts-=Number(parts[4])||1;
  if(event==='move'&&actor.startsWith(side+'a:'))state.lastOwnMove=id(details);
 }
 return state;
}
function multiplier(type,targetSpecies) {
 if(!targetSpecies||!type)return 1;
 if(!Dex.getImmunity(type,targetSpecies.types))return 0;
 return Math.pow(2,Dex.getEffectiveness(type,targetSpecies.types));
}
const RECOVERY=new Set(['recover','roost','synthesis','morningsun','moonlight','softboiled','slackoff','rest','wish','healorder','shoreup','milkdrink']);
const SETUP=new Set(['swordsdance','nastyplot','calmmind','dragondance','quiverdance','bulkup','irondefense','agility','shellsmash','curse','coil']);
const STATUS=new Set(['toxic','willowisp','thunderwave','spore','sleeppowder','stunspore','glare','yawn']);
const HAZARDS=new Map([['stealthrock','Stealth Rock'],['spikes','Spikes'],['toxicspikes','Toxic Spikes'],['stickyweb','Sticky Web']]);

function moveScore(moveInfo,own,obs,profile) {
 const mid=id(moveInfo?.id||moveInfo?.move);
 const move=Dex.moves.get(mid);
 const hp=hpFraction(own);
 const ownSpecies=infoSpecies(own);
 const foe=obs.foeSpecies;
 if(!move.exists)return 20;
 const accuracy=typeof move.accuracy==='number'?clamp(move.accuracy/100,0.3,1):1;
 if(move.category!=='Status' && move.basePower>0) {
  const stab=ownSpecies?.types.includes(move.type)?1.5:1;
  const effectiveness=multiplier(move.type,foe);
  if(effectiveness===0)return -100;
  const power=move.basePower*(move.multihit?1.35:1);
  let score=(22+power*0.66*stab*effectiveness*accuracy)*profile.offense;
  if(move.priority>0)score+=11+Math.max(0,(0.4-hp))*12;
  if(move.recoil||move.hasCrashDamage)score-=hp<0.28?26:7;
  if(move.selfdestruct)score-=hp>0.18?80:0;
  if(moveInfo.pp!=null&&moveInfo.pp<3)score-=5;
  if(['rapidspin','mortalspin'].includes(mid)&&obs.ownHazards.size)score+=90*profile.utility;
  return score;
 }
 if(RECOVERY.has(mid))return (hp>0.91?-55:(40+115*(1-hp)))*profile.utility;
 if(SETUP.has(mid))return (obs.ownBoosts>=3?0:hp>0.68?88:hp>0.38?47:7)*profile.setup;
 if(HAZARDS.has(mid))return (obs.foeHazards.has(HAZARDS.get(mid))?0:obs.turn<6?85:32)*profile.utility;
 if(STATUS.has(mid)) {
  if(obs.foeStatus)return 1;
  const foeTypes=foe?.types||[];
  if(mid==='toxic' && (foeTypes.includes('Steel')||foeTypes.includes('Poison')))return 0;
  if(mid==='willowisp'&&foeTypes.includes('Fire'))return 0;
  if(mid==='thunderwave'&&(foeTypes.includes('Electric')||foeTypes.includes('Ground')))return 0;
  if(mid==='sleeppowder'&&foeTypes.includes('Grass'))return 0;
  return 78*profile.utility*accuracy;
 }
 if(mid==='leechseed')return (!obs.foeLeechSeed&&!foe?.types.includes('Grass')?77:0)*profile.utility;
 if(mid==='protect'||mid==='detect')return obs.lastOwnMove===mid?0:25*profile.utility;
 if(['uturn','voltswitch','flipturn'].includes(mid))return 43*profile.offense;
 if(['defog','rapidspin','mortalspin'].includes(mid))return (obs.ownHazards.size?140:0)*profile.utility;
 return (move.category==='Status'?18:32)*profile.utility;
}
function switchScore(own,bench,obs,profile) {
 const hp=hpFraction(own),healthy=hpFraction(bench);
 if(healthy<0.27)return -90;
 const foe=obs.foeSpecies;
 const active=infoSpecies(own),candidate=infoSpecies(bench);
 if(!candidate)return -90;
 let score=6+(healthy-hp)*28;
 // Species typing is public knowledge. We do not infer hidden foe moves.
 if(foe&&active){
  const pressure=types=>Math.max(...foe.types.map(t=>multiplier(t,{types})));
  const threatNow=pressure(active.types),threatAfter=pressure(candidate.types);
  score+=((threatNow-threatAfter)*28);
  if(threatNow>=2&&threatAfter<=1)score+=43;
 }
 if(hp<0.3)score+=45;
 if(obs.lastOwnMove===null&&obs.turn>0)score-=3;
 return score*profile.switching;
}
export function selectTacticalChoice(request,{side='p2',publicLog='',profile='balanced',dynamaxTarget=null}={}) {
 const choices=legalChoices(request,{dynamaxTarget});
 if(!choices.length)return null;
 if(request.teamPreview)return choices[0];
 if(request.forceSwitch?.some(Boolean)) {
  const bench=request.side?.pokemon||[];
  return choices.filter(v=>v.startsWith('switch ')).sort((a,b)=>{
   const sa=hpFraction(bench[Number(a.split(' ')[1])-1]);
   const sb=hpFraction(bench[Number(b.split(' ')[1])-1]);
   return sb-sa;
  })[0]||choices[0];
 }
 const observation=publicObservation(publicLog,side);
 const style=AI_PROFILES[resolveAiProfile(profile)];
 const team=request.side?.pokemon||[],own=team.find(p=>p.active);
 const moves=request.active?.[0]?.moves||[];
 const scored=choices.map((choice,index)=>{
  let score=0;
  const parts=choice.split(' ');
  if(parts[0]==='move'){
   const mi=moves[Number(parts[1])-1];
   score=moveScore(mi,own,observation,style);
   const move=Dex.moves.get(id(mi?.id||mi?.move));
   if(parts[2]==='mega'){
    score+=(!move?.selfdestruct&&hpFraction(own)>0.17?26:-30)*style.mega;
   }
   if(parts[2]==='dynamax'){
    score+=(!move?.selfdestruct&&hpFraction(own)>0.36?24:-24)*style.dynamax;
    if(observation.turn>5)score+=7;
   }
  }else if(parts[0]==='switch'){
   score=switchScore(own,team[Number(parts[1])-1],observation,style);
  }else score=30;
  // Distinct personalities can break near ties without randomness; replayable.
  if(resolveAiProfile(profile)==='fab')score+=(((observation.turn+index*3)%5)-2)*2;
  return {choice,score,index};
 });
 scored.sort((a,b)=>b.score-a.score||a.index-b.index);
 const selected=scored[0]?.choice||selectAiFallback(request);
 return choices.includes(selected)?selected:selectAiFallback(request);
}
