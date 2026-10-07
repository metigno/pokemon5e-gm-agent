import { legalTrainerFeatureActions } from "../engine/trainer-actions.mjs";

export function npcTrainerFeatureCandidates(state,{npcId,actionEconomy={action:true,bonusAction:true,reaction:true}}={}){
 const allowed=["trigger","pokemon-resource"];
 if(actionEconomy.bonusAction) allowed.push("bonus-action");
 if(actionEconomy.reaction) allowed.push("reaction");
 return legalTrainerFeatureActions(state,{actor:{kind:"npc",id:npcId},allowedActions:allowed});
}

export function scoreNpcTrainerFeature(candidate,{activeHpRatio=1,targetHpRatio=1}={}){
 let score=0;
 switch(candidate.effect){
  case "damage-roll-advantage": score=targetHpRatio>0.25?58:42; break;
  case "attack-or-damage-bonus": score=targetHpRatio>0.35?55:38; break;
  case "allied-attack-damage-or-ac": score=activeHpRatio<0.4?54:48; break;
  case "ac-or-save-bonus": score=activeHpRatio<0.45?62:44; break;
  case "leave-pokemon-at-1-hp": score=targetHpRatio<0.35?57:34; break;
  case "healing-bonus": score=activeHpRatio<0.5?60:25; break;
  default: score=20;
 }
 return score;
}

export function chooseNpcTrainerFeature(candidates,context={}){
 if(!candidates?.length) return null;
 return candidates.map((candidate,index)=>({candidate,index,score:scoreNpcTrainerFeature(candidate,context)}))
  .sort((a,b)=>b.score-a.score||a.index-b.index)[0].candidate;
}
