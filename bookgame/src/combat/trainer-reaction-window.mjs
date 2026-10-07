import {legalTrainerFeatureActions,executeTrainerFeature} from "../engine/trainer-actions.mjs";
import {applyTrainerCombatEffect} from "./trainer-effects.mjs";

function trainerForSide(battle,side){return side==="player"?battle.trainer:battle.opponentTrainer;}
function actorState(battle,side){
 const trainer=trainerForSide(battle,side);
 const id="__combat_"+side+"__";
 return {id,state:side==="player"?{player:trainer}:{npcs:{[id]:{trainer}}},actor:side==="player"?{kind:"player"}:{kind:"npc",id}};
}
export function legalTrainerReactionsForSide(battle,{side,featureIds=[]}={}){
 const trainer=trainerForSide(battle,side);
 if(!trainer?.reactionAvailable) return [];
 const ref=actorState(battle,side);
 const allowed=new Set(featureIds);
 return legalTrainerFeatureActions(ref.state,{actor:ref.actor,allowedActions:["reaction"]}).filter(x=>allowed.has(x.featureId));
}
export function executeTrainerReactionForSide(battle,{side,featureId,cost=null,mode=null,roll=null}={}){
 const trainer=trainerForSide(battle,side);
 if(!trainer?.reactionAvailable) return {used:false,reason:"reaction_unavailable"};
 const ref=actorState(battle,side);
 const result=executeTrainerFeature(ref.state,{actor:ref.actor,featureId,cost,mode});
 if(!result.used) return result;
 trainer.reactionAvailable=false;
 applyTrainerCombatEffect(battle,{side,featureResult:result,targetSide:side,mode,roll});
 battle.log.push({type:"trainer_reaction",round:battle.round,actor:side,featureId,cost:cost??null,mode});
 return result;
}
