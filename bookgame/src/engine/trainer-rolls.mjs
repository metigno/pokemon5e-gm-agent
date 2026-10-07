import { proficiencyBonus } from "./state.mjs";

const ABILITIES=new Set(["STR","DEX","CON","INT","WIS","CHA"]);
function actorTrainer(state,actor={kind:"player"}){
 if(actor.kind==="player") return state.player;
 if(actor.kind==="npc"){const npc=state.npcs?.[actor.id];if(!npc)throw new Error("Unknown NPC Trainer: "+actor.id);return {...npc.trainer,abilities:npc.trainer?.abilities??npc.abilities};}
 throw new Error("Unknown Trainer actor kind: "+actor.kind);
}
function mod(score){return Math.floor((Number(score??10)-10)/2);}
function includesCI(list,value){return (list??[]).some(x=>String(x).toLowerCase()===String(value).toLowerCase());}
function d20(dice,mode){
 const a=dice.roll(20); if(mode==="normal")return {natural:a,rolls:[a]};
 const b=dice.roll(20); return {natural:mode==="advantage"?Math.max(a,b):Math.min(a,b),rolls:[a,b]};
}
export function trainerCheckModifier(state,{actor={kind:"player"},ability,skill=null}){
 const t=actorTrainer(state,actor); const key=String(ability).toUpperCase();
 if(!ABILITIES.has(key)||!Number.isFinite(t.abilities?.[key])) throw new Error("Unknown Trainer ability: "+ability);
 let modifier=mod(t.abilities[key]); let proficiency=0;
 if(skill&&includesCI(t.proficiencies?.skills??t.skills,skill)) proficiency=proficiencyBonus(Number(t.trainerLevel??t.level??1));
 if(skill&&includesCI(t.proficiencies?.expertise,skill)) proficiency*=2;
 return {modifier:modifier+proficiency,abilityModifier:mod(t.abilities[key]),proficiency};
}
export function resolveTrainerCheck(state,{actor={kind:"player"},ability,skill=null,dc=null,advantage=false,disadvantage=false,dice}){
 if(!dice?.roll) throw new Error("Trainer check requires dice");
 const mode=advantage===disadvantage?"normal":advantage?"advantage":"disadvantage";
 const m=trainerCheckModifier(state,{actor,ability,skill}); const rolled=d20(dice,mode); const total=rolled.natural+m.modifier; const sign=m.modifier>=0?"+":"";
 return {...rolled,mode,ability:String(ability).toUpperCase(),skill,modifier:m.modifier,total,notation:`d20${sign}${m.modifier}=${total}`,dc:Number.isFinite(dc)?dc:null,passed:Number.isFinite(dc)?total>=dc:null};
}
export function trainerSavingThrowModifier(state,{actor={kind:"player"},ability}){
 const t=actorTrainer(state,actor); const key=String(ability).toUpperCase();
 if(!ABILITIES.has(key)||!Number.isFinite(t.abilities?.[key])) throw new Error("Unknown Trainer ability: "+ability);
 const base=mod(t.abilities[key]); const proficient=includesCI(t.savingThrows,key);
 const proficiency=proficient?proficiencyBonus(Number(t.trainerLevel??t.level??1)):0;
 return {modifier:base+proficiency,abilityModifier:base,proficiency,proficient};
}
export function resolveTrainerSavingThrow(state,{actor={kind:"player"},ability,dc=null,advantage=false,disadvantage=false,dice}){
 if(!dice?.roll) throw new Error("Trainer saving throw requires dice");
 const mode=advantage===disadvantage?"normal":advantage?"advantage":"disadvantage"; const m=trainerSavingThrowModifier(state,{actor,ability}); const rolled=d20(dice,mode); const total=rolled.natural+m.modifier; const sign=m.modifier>=0?"+":"";
 return {...rolled,mode,ability:String(ability).toUpperCase(),modifier:m.modifier,total,notation:`d20${sign}${m.modifier}=${total}`,dc:Number.isFinite(dc)?dc:null,passed:Number.isFinite(dc)?total>=dc:null,proficient:m.proficient};
}
