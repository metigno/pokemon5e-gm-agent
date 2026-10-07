function push(combatant,key,entry){combatant.effects??={};combatant.effects[key]??=[];combatant.effects[key].push(entry);}
export function applyTrainerCombatEffect(battle,{side,featureResult,targetSide=side,mode=null,roll=null}){
 if(!featureResult?.used)throw new Error("Trainer feature result must be successfully used");
 const target=battle[targetSide]; if(!target)throw new Error("Unknown combat target side: "+targetSide);
 const source="trainer:"+featureResult.featureId;
 const round=battle.round??1;
 switch(featureResult.effect){
  case "damage-roll-advantage":
   push(target,"damageAdvantageSources",{source,usesRemaining:1,expiresRound:round+1}); break;
  case "ac-or-save-bonus":
   if(mode==="ac")push(target,"acModifierSources",{source,value:featureResult.amount,expiresRound:round+1});
   else if(mode==="save")push(target,"saveModifierSources",{source,value:featureResult.amount,expiresRound:round+1});
   else throw new Error("Raise Your Defenses requires mode ac or save");
   break;
  case "attack-or-damage-bonus": {
   const value=Number(roll); if(!Number.isFinite(value)||value<1)throw new Error("Battle Die roll is required");
   const key=mode==="attack"?"attackModifierSources":mode==="damage"?"damageModifierSources":null;
   if(!key)throw new Error("Battle Master requires mode attack or damage");
   push(target,key,{source,value,usesRemaining:1,expiresRound:round+1}); break;
  }
  case "allied-attack-damage-or-ac": {
   const value=Math.max(1,Number(featureResult.trainerChaModifier??1));
   const key=mode==="attack"?"attackModifierSources":mode==="damage"?"damageModifierSources":mode==="ac"?"acModifierSources":null;
   if(!key)throw new Error("Cheerleader requires attack, damage, or ac mode");
   push(target,key,{source,value,expiresRound:round+1}); break;
  }
  case "capture-check-advantage":
   battle.trainerEffects??={};battle.trainerEffects.captureAdvantage={source,usesRemaining:1};break;
  case "leave-pokemon-at-1-hp":
   battle.trainerEffects??={};battle.trainerEffects.disciplinedStrikes={source,usesRemaining:1,targetSide};break;
  default: throw new Error("Trainer combat effect not bridged: "+featureResult.effect);
 }
 battle.log??=[];battle.log.push({type:"trainer_feature_effect",round,side,targetSide,featureId:featureResult.featureId,effect:featureResult.effect,mode});
 return battle;
}
