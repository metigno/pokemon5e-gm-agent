import { isTrainerPath2024, specializationByType, trainerProgression2024 } from "../rules/trainer-2024.mjs";
import { NPC_ASI_SCRIPTS, applyAsi } from "../../../src/bridge/motor-to-poke5e.mjs";

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
  Object.assign(next.trainer,p);
 }
 return next;
}
