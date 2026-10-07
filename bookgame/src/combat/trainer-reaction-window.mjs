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

export function tryTrainerAcReaction(battle,{defenderSide,attackTotal,defenderAc,natural,critical=false,forcedHit=false}={}){
 if(forcedHit||critical||natural===20||natural===1||attackTotal<defenderAc) return {reacted:false,defenderAc};
 const candidates=legalTrainerReactionsForSide(battle,{side:defenderSide,featureIds:["raise-your-defenses"]});
 const feature=candidates.find(x=>x.featureId==="raise-your-defenses");
 if(!feature) return {reacted:false,defenderAc};
 const needed=attackTotal-defenderAc+1;
 const trainer=trainerForSide(battle,defenderSide);
 const available=Number(trainer.classResources?.[feature.resourceId]?.current??0);
 const max=Math.min(Number(feature.maxCost??needed),available);
 if(needed>max) return {reacted:false,defenderAc};
 const result=executeTrainerReactionForSide(battle,{side:defenderSide,featureId:feature.featureId,cost:needed,mode:"ac"});
 if(!result.used) return {reacted:false,defenderAc};
 return {reacted:true,defenderAc:defenderAc+needed,featureId:feature.featureId,cost:needed};
}

export function tryTrainerSaveReaction(battle,{defenderSide,saveTotal,saveDc,natural}={}){
 if(natural===20||saveTotal>=saveDc) return {reacted:false,saveTotal};
 const candidates=legalTrainerReactionsForSide(battle,{side:defenderSide,featureIds:["raise-your-defenses"]});
 const feature=candidates.find(x=>x.featureId==="raise-your-defenses");
 if(!feature) return {reacted:false,saveTotal};
 const needed=saveDc-saveTotal;
 const trainer=trainerForSide(battle,defenderSide);
 const available=Number(trainer.classResources?.[feature.resourceId]?.current??0);
 const max=Math.min(Number(feature.maxCost??needed),available);
 if(needed>max) return {reacted:false,saveTotal};
 const result=executeTrainerReactionForSide(battle,{side:defenderSide,featureId:feature.featureId,cost:needed,mode:"save"});
 if(!result.used) return {reacted:false,saveTotal};
 return {reacted:true,saveTotal:saveTotal+needed,featureId:feature.featureId,cost:needed};
}
