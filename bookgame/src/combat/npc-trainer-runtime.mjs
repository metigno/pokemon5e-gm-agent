import {executeTrainerFeature} from "../engine/trainer-actions.mjs";
import {applyTrainerCombatEffect} from "./trainer-effects.mjs";

function combatTrainerState(battle){
 const id=battle.opponentTrainerId??"__combat_opponent__";
 return {id,state:{npcs:{[id]:{trainer:battle.opponentTrainer}}}};
}
export function executeNpcTrainerFeatureInCombat(battle,{featureId,cost=null,mode=null,roll=null}={}){
 const defState=combatTrainerState(battle);
 const result=executeTrainerFeature(defState.state,{actor:{kind:"npc",id:defState.id},featureId,cost,mode});
 if(!result.used) return {battle,result};
 const action=result.action;
 if(action==="reaction"){
  if(!battle.opponentTrainer.reactionAvailable) throw new Error("Opponent Trainer reaction is not available");
  battle.opponentTrainer.reactionAvailable=false;
 }else if(action==="bonus-action"){
  if(!battle.opponentTrainer.bonusActionAvailable) throw new Error("Opponent Trainer bonus action is not available");
  battle.opponentTrainer.bonusActionAvailable=false;
 }else if(action==="action"){
  if(!battle.opponentTrainer.actionAvailable) throw new Error("Opponent Trainer action is not available");
  battle.opponentTrainer.actionAvailable=false;
 }
 const effectResult={...result};
 if(featureId==="cheerleader") effectResult.trainerChaModifier=Number(battle.opponentTrainer?.attributes?.cha?.modifier??battle.opponentTrainer?.chaModifier??1);
 applyTrainerCombatEffect(battle,{side:"opponent",featureResult:effectResult,targetSide:"opponent",mode,roll});
 battle.log.push({type:"npc_trainer_feature",round:battle.round,actor:"opponent",trainerId:battle.opponentTrainerId??null,featureId,action:result.action,resource:result.resource??null});
 return {battle,result};
}
