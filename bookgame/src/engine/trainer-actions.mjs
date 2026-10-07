// Shared Trainer gameplay actions for player and persistent NPC Trainers.
function clone(v){return structuredClone(v);}
function trainerRef(state,actor={kind:"player"}){
 if(actor.kind==="player") return state.player;
 if(actor.kind==="npc"){
  const npc=state.npcs?.[actor.id]; if(!npc) throw new Error("Unknown NPC Trainer: "+actor.id);
  return npc.trainer;
 }
 throw new Error("Unknown Trainer actor kind: "+actor.kind);
}
function findOwned(list,id){
 return (list??[]).findIndex(x=>(typeof x==="string"?x:(x.id??x.itemId))===id);
}
export function equipTrainerGear(state,{actor={kind:"player"},gearId}){
 const t=trainerRef(state,actor); t.trainerGear??=[]; t.equipment??=[];
 const i=findOwned(t.trainerGear,gearId); if(i<0) throw new Error("Trainer Gear not owned: "+gearId);
 const source=t.trainerGear[i]; const gear=typeof source==="string"?{id:source}:clone(source);
 if(t.equipment.some(x=>(x.id??x.itemId)===gearId)) return {equipped:false,reason:"already_equipped"};
 gear.equipped=true; t.equipment.push(gear);
 return {equipped:true,gearId};
}
export function unequipTrainerGear(state,{actor={kind:"player"},gearId}){
 const t=trainerRef(state,actor); t.equipment??=[];
 const i=findOwned(t.equipment,gearId); if(i<0) return {equipped:false,reason:"not_equipped"};
 t.equipment.splice(i,1); return {equipped:false,gearId};
}
export function spendTrainerResource(state,{actor={kind:"player"},resourceId,amount=1}){
 if(!Number.isInteger(amount)||amount<1) throw new RangeError("Trainer resource amount must be a positive integer");
 const t=trainerRef(state,actor); const r=t.classResources?.[resourceId];
 if(!r) throw new Error("Unknown Trainer class resource: "+resourceId);
 const current=Number(r.current??0); if(current<amount) return {spent:false,reason:"insufficient_resource",current};
 r.current=current-amount; return {spent:true,resourceId,amount,current:r.current,max:Number(r.max??current)};
}
export function useTrainerFeature(state,{actor={kind:"player"},featureId,resourceId=null,cost=1}){
 const t=trainerRef(state,actor); if(!(t.classFeatures??[]).includes(featureId)) throw new Error("Trainer feature not known: "+featureId);
 t.featureUsage??={}; const usage=t.featureUsage[featureId]??{uses:0};
 let resource=null; if(resourceId){resource=spendTrainerResource(state,{actor,resourceId,amount:cost});if(!resource.spent)return {used:false,reason:resource.reason,resource};}
 usage.uses=Number(usage.uses??0)+1; t.featureUsage[featureId]=usage;
 return {used:true,featureId,resource};
}
export function trainerRuntimeView(state,actor={kind:"player"}){return clone(trainerRef(state,actor));}

const FIVE_FEATURE_ACTIONS=Object.freeze({
 "tactical-healing":{resourceId:"tactical-points",minCost:1,action:"trigger",effect:"healing-bonus",die:"d4"},
 "directed-strike":{resourceId:"tactical-points",cost:2,action:"trigger",effect:"damage-roll-advantage"},
 "raise-your-defenses":{resourceId:"tactical-points",minCost:1,maxCost:5,action:"reaction",effect:"ac-or-save-bonus"},
 "not-this-time":{resourceId:"tactical-points",minCost:1,maxCost:5,action:"trigger",effect:"save-dc-bonus"},
 "battle-master":{resourceId:"battle-dice",cost:1,action:"trigger",effect:"attack-or-damage-bonus"},
 "cheerleader":{resourceId:"cheerleader",cost:1,action:"bonus-action",effect:"allied-attack-damage-or-ac"},
 "gotta-catch-em-all":{resourceId:"gotta-catch-em-all",cost:1,action:"trigger",effect:"capture-check-advantage"},
 "disciplined-strikes":{action:"trigger",effect:"leave-pokemon-at-1-hp"},
 "show-me-what-youve-got":{action:"pokemon-resource",effect:"spend-bond-point-higher-tier-move"},
 "were-a-team":{action:"reaction",effect:"ally-uses-pokemon-bond-point"}
});
export function executeTrainerFeature(state,{actor={kind:"player"},featureId,cost=null,mode=null}){
 const def=FIVE_FEATURE_ACTIONS[featureId]; if(!def) throw new Error("Trainer feature has no executable runtime definition: "+featureId);
 let amount=cost??def.cost??def.minCost??0;
 if(def.minCost!=null&&amount<def.minCost) throw new RangeError("Trainer feature resource cost below minimum");
 if(def.maxCost!=null&&amount>def.maxCost) throw new RangeError("Trainer feature resource cost above maximum");
 const used=useTrainerFeature(state,{actor,featureId,resourceId:def.resourceId??null,cost:amount||1});
 if(!used.used)return used;
 return {...used,action:def.action,effect:def.effect,amount,mode,die:def.die??null};
}
export function trainerFeatureRuntimeDefinition(featureId){return FIVE_FEATURE_ACTIONS[featureId]??null;}
export function rechargeTrainerResources(state,{actor={kind:"player"},rest}){
 if(!["short-rest","long-rest"].includes(rest))throw new Error("Unknown Trainer rest: "+rest);
 const t=trainerRef(state,actor); const restored={};
 for(const [id,r] of Object.entries(t.classResources??{})){
  const recharge=r.recharge;
  if(recharge==="short-rest"||recharge==="long-rest"&&rest==="long-rest"){
   r.current=Number(r.max??0); restored[id]=r.current;
  }
 }
 return restored;
}

export function legalTrainerFeatureActions(state,{actor={kind:"player"},allowedActions=null}={}){
 const t=trainerRef(state,actor);
 const out=[];
 for(const featureId of t.classFeatures??[]){
  const def=trainerFeatureRuntimeDefinition(featureId); if(!def) continue;
  if(allowedActions&&!(allowedActions.includes(def.action))) continue;
  const resource=def.resourceId?t.classResources?.[def.resourceId]:null;
  const minCost=def.cost??def.minCost??0;
  if(def.resourceId&&(!resource||Number(resource.current??0)<minCost)) continue;
  out.push({featureId,action:def.action,effect:def.effect,resourceId:def.resourceId??null,minCost,maxCost:def.maxCost??minCost});
 }
 return out;
}
