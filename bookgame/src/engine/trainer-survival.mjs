function trainerRef(state,actor={kind:"player"}){
 if(actor.kind==="player") return state.player;
 if(actor.kind==="npc"){const npc=state.npcs?.[actor.id];if(!npc)throw new Error("Unknown NPC Trainer: "+actor.id);return npc.trainer;}
 throw new Error("Unknown Trainer actor kind: "+actor.kind);
}
function ensureDeath(t){t.death??={state:"alive",deathSaveSuccesses:0,deathSaveFailures:0,stable:false};return t.death;}
export function applyTrainerCondition(state,{actor={kind:"player"},condition}){
 const t=trainerRef(state,actor); if(typeof condition!=="string"||!condition)throw new Error("Trainer condition is required");
 t.conditions??=[]; if(!t.conditions.includes(condition))t.conditions.push(condition); return [...t.conditions];
}
export function removeTrainerCondition(state,{actor={kind:"player"},condition}){
 const t=trainerRef(state,actor); t.conditions??=[]; t.conditions=t.conditions.filter(x=>x!==condition); return [...t.conditions];
}
export function applyTrainerDamage(state,{actor={kind:"player"},amount}){
 if(!Number.isFinite(amount)||amount<0)throw new RangeError("Trainer damage must be non-negative");
 const t=trainerRef(state,actor); if(!t.hp)throw new Error("Trainer HP state is missing"); const death=ensureDeath(t);
 if(death.state==="dead")return {damage:0,hp:t.hp.current,state:"dead"};
 const before=t.hp.current; t.hp.current=Math.max(0,before-amount);
 if(t.hp.current===0&&death.state!=="dead"){death.state="dying";death.stable=false;death.deathSaveSuccesses=0;death.deathSaveFailures=0;}
 return {damage:before-t.hp.current,hp:t.hp.current,state:death.state};
}
export function healTrainer(state,{actor={kind:"player"},amount}){
 if(!Number.isFinite(amount)||amount<0)throw new RangeError("Trainer healing must be non-negative");
 const t=trainerRef(state,actor); const death=ensureDeath(t); if(death.state==="dead")return {healed:0,hp:t.hp.current,state:"dead"};
 const before=t.hp.current; t.hp.current=Math.min(t.hp.max,before+amount);
 if(t.hp.current>0){death.state="alive";death.stable=false;death.deathSaveSuccesses=0;death.deathSaveFailures=0;}
 return {healed:t.hp.current-before,hp:t.hp.current,state:death.state};
}
export function resolveTrainerDeathSave(state,{actor={kind:"player"},dice}){
 const t=trainerRef(state,actor); const death=ensureDeath(t);
 if(death.state!=="dying")throw new Error("Trainer is not dying"); if(!dice?.roll)throw new Error("Death save requires dice");
 const natural=dice.roll(20);
 if(natural===20){t.hp.current=Math.max(1,t.hp.current);death.state="alive";death.stable=false;death.deathSaveSuccesses=0;death.deathSaveFailures=0;return {natural,outcome:"critical_success",state:"alive"};}
 if(natural===1)death.deathSaveFailures+=2; else if(natural>=10)death.deathSaveSuccesses+=1; else death.deathSaveFailures+=1;
 if(death.deathSaveFailures>=3){death.state="dead";death.stable=false;}
 else if(death.deathSaveSuccesses>=3){death.state="stable";death.stable=true;}
 return {natural,outcome:natural>=10?"success":"failure",state:death.state,successes:death.deathSaveSuccesses,failures:death.deathSaveFailures};
}
export function trainerCareerEnded(state){return state.player?.death?.state==="dead";}
