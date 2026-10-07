import {legalTrainerFeatureActions} from "../engine/trainer-actions.mjs";
import {executeNpcTrainerFeatureInCombat} from "./npc-trainer-runtime.mjs";

const TRIGGER_FEATURES=Object.freeze({
 incoming_attack:["raise-your-defenses"],
 incoming_save:["raise-your-defenses"],
 allied_failure:["were-a-team"]
});
export function legalNpcTrainerReactions(battle,{trigger}={}){
 if(!battle?.opponentTrainer?.reactionAvailable) return [];
 const allowed=new Set(TRIGGER_FEATURES[trigger]??[]);
 if(!allowed.size) return [];
 const state={npcs:{__combat_opponent__:{trainer:battle.opponentTrainer}}};
 return legalTrainerFeatureActions(state,{actor:{kind:"npc",id:"__combat_opponent__"},allowedActions:["reaction"]})
  .filter(x=>allowed.has(x.featureId));
}
export function chooseNpcTrainerReaction(battle,{trigger,neededBonus=1}={}){
 const candidates=legalNpcTrainerReactions(battle,{trigger});
 if(!candidates.length) return null;
 const candidate=candidates[0];
 if(candidate.featureId==="raise-your-defenses"){
  const max=Math.min(candidate.maxCost??1,Number(battle.opponentTrainer.classResources?.["tactical-points"]?.current??0));
  const required=Math.max(1,Math.ceil(neededBonus));
  if(required>max) return null;
  const cost=Math.max(candidate.minCost??1,required);
  return {featureId:candidate.featureId,cost,mode:trigger==="incoming_save"?"save":"ac"};
 }
 return {featureId:candidate.featureId};
}
export function executeNpcTrainerReaction(battle,{trigger,neededBonus=1,dice=null}={}){
 const args=chooseNpcTrainerReaction(battle,{trigger,neededBonus});
 if(!args) return null;
 return executeNpcTrainerFeatureInCombat(battle,{...args,dice});
}
