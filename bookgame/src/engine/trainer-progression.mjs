import { trainerProgression2024 } from "../rules/trainer-2024.mjs";
import { experienceNeededAtLevel } from "./state.mjs";
import { moduleTrainerLevelCap, normalizeModuleId } from "./module-progression-guard.mjs";

export const TRAINER_PATHS = Object.freeze([
  ["ace-trainer","Ace Trainer"],["hobbyist","Hobbyist"],["poke-mentor","Poké Mentor"],
  ["researcher","Researcher"],["pokemon-collector","Pokémon Collector"],["nurse","Nurse"],
  ["type-master","Type Master"],["commander","Commander"],["grunt","Grunt"],
  ["tactician","Tactician"],["ranger","Ranger"],["guru","Guru"],["pokemon-breeder","Pokémon Breeder"]
]);

export const TRAINER_SPECIALIZATIONS = Object.freeze([
  "ghost","fairy","normal","fighting","flying","poison","fire","grass","water",
  "electric","psychic","dark","bug","ice","dragon","steel","rock","ground"
]);

const ABILITIES=Object.freeze(["STR","DEX","CON","INT","WIS","CHA"]);
const CHOICE_LEVELS=new Map([[2,"trainer_path"],[4,"asi_or_feat"],[7,"specialization"],[8,"asi_or_feat"],[12,"asi_or_feat"],[16,"asi_or_feat"],[18,"specialization"],[19,"epic_boon"]]);
const AUTO_FEATURES=new Map([
  [3,["max-sr-increase"]],[5,["trainer-path-feature","pokeslot-increase"]],
  [6,["max-sr-increase"]],[8,["max-sr-increase"]],[9,["trainer-path-feature"]],
  [10,["pokeslot-increase","trainer-resolve"]],[11,["max-sr-increase"]],
  [13,["pokemon-tracker"]],[14,["max-sr-increase"]],
  [15,["trainer-path-feature","pokeslot-increase"]],[17,["max-sr-increase"]],[20,["master-trainer"]]
]);

function abilityModifier(score){return Math.floor((Number(score??10)-10)/2);}

function ensureProgression(state){
  state.player??={};
  const p=state.player;
  if(Array.isArray(p.specializations)){
    p.specializations=Object.fromEntries(TRAINER_SPECIALIZATIONS.map(type=>[type,0]));
  }
  p.trainerProgression??={mode:"milestone",history:[],pendingChoices:[],resolvedChoices:[],targetLevel:p.trainerLevel??1,targetMilestoneId:null};
  p.trainerProgression.mode??="milestone";
  p.trainerProgression.history??=[];
  p.trainerProgression.pendingChoices??=[];
  p.trainerProgression.resolvedChoices??=[];
  p.trainerProgression.targetLevel=Number.isInteger(p.trainerProgression.targetLevel)?p.trainerProgression.targetLevel:(p.trainerLevel??1);
  p.trainerProgression.targetMilestoneId??=null;
  return p.trainerProgression;
}

function key(level,type){return `${level}:${type}`;}

function queueChoice(state,level,type,sourceMilestoneId){
  const p=ensureProgression(state);
  if(p.resolvedChoices.some(x=>x.key===key(level,type))) return;
  if(p.pendingChoices.some(x=>x.level===level&&x.type===type)) return;
  p.pendingChoices.push({key:key(level,type),level,type,sourceMilestoneId});
}

function addFeature(player,feature){
  player.classFeatures??=[];
  if(!player.classFeatures.includes(feature)) player.classFeatures.push(feature);
}

function unlockLevel(state,level,sourceMilestoneId){
  const choiceType=CHOICE_LEVELS.get(level);
  if(choiceType==="trainer_path"&&!state.player.trainerPath) queueChoice(state,level,choiceType,sourceMilestoneId);
  else if(choiceType) queueChoice(state,level,choiceType,sourceMilestoneId);
  for(const feature of AUTO_FEATURES.get(level)??[]){
    addFeature(state.player,feature);
    if(feature==="trainer-path-feature"&&state.player.trainerPath) addFeature(state.player,`trainer-path:${state.player.trainerPath}:level-${level}`);
  }
}

function hpGain(player){return Math.max(1,4+abilityModifier(player.abilities?.CON));}

export function pendingTrainerProgression(state){return ensureProgression(state).pendingChoices[0]??null;}
export function hasPendingTrainerProgression(state){return Boolean(pendingTrainerProgression(state));}

export function advanceTrainerToLevel(state,targetLevel,{sourceMilestoneId="manual"}={}){
  if(!Number.isInteger(targetLevel)||targetLevel<1||targetLevel>20) throw new RangeError("Trainer target level must be 1..20");
  const p=state.player;
  const progression=ensureProgression(state);
  p.trainerLevel=Number.isInteger(p.trainerLevel)?p.trainerLevel:1;
  p.trainerXp=Number.isFinite(p.trainerXp)?p.trainerXp:experienceNeededAtLevel(p.trainerLevel);
  p.hp??={current:1,max:1};
  p.hitDice??={die:"d6",current:p.trainerLevel,max:p.trainerLevel};
  const applied=[];
  while(p.trainerLevel<targetLevel){
    if(progression.pendingChoices.length>0) break;
    const fromLevel=p.trainerLevel;
    const level=fromLevel+1;
    const gain=hpGain(p);
    p.trainerLevel=level;
    p.trainerXp=experienceNeededAtLevel(level);
    p.hp.max=Math.max(1,Number(p.hp.max??1)+gain);
    p.hp.current=Math.min(p.hp.max,Math.max(0,Number(p.hp.current??0)+gain));
    p.hitDice.die??="d6";
    p.hitDice.max=Math.max(level,Number(p.hitDice.max??fromLevel)+1);
    p.hitDice.current=Math.min(p.hitDice.max,Math.max(0,Number(p.hitDice.current??0)+1));
    const p5e=trainerProgression2024(level);
    p.pokeslots=p5e.pokeslots;
    p.maxSr=p5e.maxSr;
    const record={sourceMilestoneId,fromLevel,level,trainerXp:p.trainerXp,hpGain:gain};
    progression.history.push(record);
    applied.push(record);
    unlockLevel(state,level,sourceMilestoneId);
  }
  return applied;
}

export function applyTrainerProgressionEffect(state,effect){
  if(effect?.type!=="trainer_milestone_level") throw new Error("Unsupported Trainer progression effect");
  if(!Number.isInteger(effect.level)||effect.level<1||effect.level>20) throw new RangeError("trainer_milestone_level requires level 1..20");
  if(typeof effect.milestoneId!=="string"||effect.milestoneId.length===0) throw new Error("trainer_milestone_level requires milestoneId");
  const progression=ensureProgression(state);
  const moduleId=normalizeModuleId(effect.moduleId??effect.milestoneId);
  if(moduleId&&effect.level>moduleTrainerLevelCap(moduleId)) throw new RangeError(`Trainer milestone ${effect.milestoneId} requests level ${effect.level} above ${moduleId} cap ${moduleTrainerLevelCap(moduleId)}`);
  if(effect.level>progression.targetLevel){
    progression.targetLevel=effect.level;
    progression.targetMilestoneId=effect.milestoneId;
  }
  return syncCampaignTrainerProgression(state);
}

export function syncCampaignTrainerProgression(state){
  const progression=ensureProgression(state);
  const target=Math.max(Number(state.player?.trainerLevel??1),Number(progression.targetLevel??1));
  if(target<=Number(state.player?.trainerLevel??1)) return [];
  return advanceTrainerToLevel(state,target,{sourceMilestoneId:progression.targetMilestoneId??"milestone"});
}

function asiChoices(state){
  const a=state.player?.abilities??{};
  const out=[];
  for(const ability of ABILITIES){
    if(Number(a[ability]??10)<=18) out.push({id:`trainer_asi_${ability.toLowerCase()}_2`,text:`Ability Score Improvement: +2 ${ability}`});
  }
  for(let i=0;i<ABILITIES.length;i++) for(let j=i+1;j<ABILITIES.length;j++){
    const x=ABILITIES[i],y=ABILITIES[j];
    if(Number(a[x]??10)<20&&Number(a[y]??10)<20) out.push({id:`trainer_asi_${x.toLowerCase()}_${y.toLowerCase()}`,text:`Ability Score Improvement: +1 ${x}, +1 ${y}`});
  }
  return out;
}

export function getTrainerProgressionView(state){
  const pending=pendingTrainerProgression(state);
  if(!pending) return null;
  if(pending.type==="trainer_path") return {level:pending.level,type:pending.type,text:"Trainer Level 2: scegli la Trainer Path prima di continuare.",choices:TRAINER_PATHS.map(([id,name])=>({id:`trainer_path_${id}`,text:name}))};
  if(pending.type==="asi_or_feat") return {level:pending.level,type:pending.type,text:`Trainer Level ${pending.level}: risolvi Ability Score Improvement o Feat prima di continuare.`,choices:asiChoices(state),acceptsProgrammaticFeatSelection:true};
  if(pending.type==="specialization") return {level:pending.level,type:pending.type,text:`Trainer Level ${pending.level}: scegli una Specialization aggiuntiva.`,choices:TRAINER_SPECIALIZATIONS.map(type=>({id:`trainer_specialization_${type}`,text:`Specialization: ${type}`}))};
  if(pending.type==="epic_boon") return {level:pending.level,type:pending.type,text:"Trainer Level 19: scegli l'Epic Boon.",choices:[],acceptsProgrammaticFeatSelection:true};
  throw new Error(`Unsupported Trainer progression choice: ${pending.type}`);
}

function applyAsi(state,deltas){
  const p=state.player;
  const oldCon=abilityModifier(p.abilities?.CON);
  for(const [ability,delta] of Object.entries(deltas)){
    if(!ABILITIES.includes(ability)) throw new Error(`Unknown Trainer ability: ${ability}`);
    const current=Number(p.abilities?.[ability]??10);
    if(current+delta>20) throw new Error(`${ability} cannot exceed 20`);
    p.abilities[ability]=current+delta;
  }
  const newCon=abilityModifier(p.abilities?.CON);
  if(newCon>oldCon){
    const bonus=(newCon-oldCon)*Number(p.trainerLevel??1);
    p.hp.max+=bonus;
    p.hp.current=Math.min(p.hp.max,p.hp.current+bonus);
  }
}

function resolvePending(state,pending,selection){
  const p=ensureProgression(state);
  p.pendingChoices.shift();
  p.resolvedChoices.push({key:pending.key,level:pending.level,type:pending.type,selection});
}

export function resolveTrainerProgressionChoice(state,choiceId){
  const pending=pendingTrainerProgression(state);
  if(!pending) throw new Error("No Trainer progression choice is pending");
  if(pending.type==="trainer_path"){
    const pathId=String(choiceId).replace(/^trainer_path_/,"");
    if(!TRAINER_PATHS.some(([id])=>id===pathId)) throw new Error(`Unknown Trainer Path: ${choiceId}`);
    state.player.trainerPath=pathId;
    addFeature(state.player,`trainer-path:${pathId}:level-2`);
    resolvePending(state,pending,{kind:"trainer_path",pathId});
    return {level:pending.level,type:pending.type,pathId};
  }
  if(pending.type==="asi_or_feat"){
    const single=/^trainer_asi_([a-z]+)_2$/.exec(choiceId);
    const split=/^trainer_asi_([a-z]+)_([a-z]+)$/.exec(choiceId);
    if(single){
      const a=single[1].toUpperCase(); applyAsi(state,{[a]:2}); resolvePending(state,pending,{kind:"asi",deltas:{[a]:2}}); return {level:pending.level,type:pending.type,deltas:{[a]:2}};
    }
    if(split){
      const a=split[1].toUpperCase(),b=split[2].toUpperCase();
      if(a===b) throw new Error("Split ASI requires two abilities");
      applyAsi(state,{[a]:1,[b]:1}); resolvePending(state,pending,{kind:"asi",deltas:{[a]:1,[b]:1}}); return {level:pending.level,type:pending.type,deltas:{[a]:1,[b]:1}};
    }
    throw new Error(`Unsupported Trainer ASI choice: ${choiceId}`);
  }
  if(pending.type==="specialization"){
    const type=String(choiceId).replace(/^trainer_specialization_/,"");
    if(!TRAINER_SPECIALIZATIONS.includes(type)) throw new Error(`Unknown Trainer Specialization: ${choiceId}`);
    state.player.specializations??={};
    state.player.specializations[type]=Number(state.player.specializations[type]??0)+1;
    resolvePending(state,pending,{kind:"specialization",specialization:type});
    return {level:pending.level,type:pending.type,specialization:type};
  }
  throw new Error(`Trainer progression choice requires a dedicated selector: ${pending.type}`);
}
