import { isTrainerPath2024, specializationByType, trainerProgression2024 } from "../rules/trainer-2024.mjs";
import { NPC_ASI_SCRIPTS, applyAsi } from "../../../src/bridge/motor-to-poke5e.mjs";

function abilityModifier(score){return Math.floor((Number(score??10)-10)/2);}
function addFeature(trainer,feature){trainer.classFeatures??=[];if(!trainer.classFeatures.includes(feature)) trainer.classFeatures.push(feature);}
const AUTO_FEATURES=new Map([[3,["max-sr-increase"]],[5,["trainer-path-feature","pokeslot-increase"]],[6,["max-sr-increase"]],[8,["max-sr-increase"]],[9,["trainer-path-feature"]],[10,["pokeslot-increase","trainer-resolve"]],[11,["max-sr-increase"]],[13,["pokemon-tracker"]],[14,["max-sr-increase"]],[15,["trainer-path-feature","pokeslot-increase"]],[17,["max-sr-increase"]],[20,["master-trainer"]]]);
function advanceNpcRuntimeLevel(next,level){
 const trainer=next.trainer;
 const gain=Math.max(1,4+abilityModifier(next.abilities?.CON));
 trainer.hp??={current:8,max:8}; trainer.hp.max+=gain; trainer.hp.current+=gain;
 trainer.hitDice??={die:"d6",current:level-1,max:level-1}; trainer.hitDice.max=level; trainer.hitDice.current=Math.min(level,trainer.hitDice.current+1);
 for(const feature of AUTO_FEATURES.get(level)??[]){addFeature(trainer,feature);if(feature==="trainer-path-feature"&&trainer.trainerPath)addFeature(trainer,`trainer-path:${trainer.trainerPath}:level-${level}`);}
}

export function progressCanonicalFriendNpc(npc,targetLevel){
 const next=structuredClone(npc);
 const career=next.canonicalCareer;
 if(!career) throw new Error("NPC has no canonical friend career");
 if(!Number.isInteger(targetLevel)||targetLevel<next.trainer.trainerLevel||targetLevel>20) throw new RangeError("Invalid target Trainer level");
 for(let level=next.trainer.trainerLevel+1;level<=targetLevel;level++){
  const p=trainerProgression2024(level);
  next.trainer.trainerLevel=level;
  if(level===2){if(!isTrainerPath2024(career.path)) throw new Error("Invalid canonical path"); next.trainer.trainerPath=career.path;}
  if(level===7||level===18){
   const type=career.additionalSpecializations[level];
   const spec=specializationByType(type); if(!spec) throw new Error("Invalid canonical specialization");
   if(!next.trainer.specializations.includes(type)) next.trainer.specializations.push(type);
  }
  const asi=NPC_ASI_SCRIPTS[next.name]?.[level];
  if(asi) next.abilities=applyAsi(next.abilities??{},asi);
  advanceNpcRuntimeLevel(next,level);
  Object.assign(next.trainer,p);
 }
 return next;
}
