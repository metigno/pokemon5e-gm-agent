import test from "node:test";
import assert from "node:assert/strict";
import { createPersistentNpc } from "../src/engine/npc-state.mjs";
import { executeTrainerFeature } from "../src/engine/trainer-actions.mjs";
import { applyTrainerCombatEffect } from "../src/combat/trainer-effects.mjs";

test("scripted NPC path survives feature -> combat effect -> serialization",()=>{
 const npc=createPersistentNpc({id:"Luke",name:"Luke",state:{trainerLevel:10,trainerPath:"Tactician",abilities:{STR:13,DEX:14,CON:15,INT:12,WIS:8,CHA:10}}});
 const state={player:{},npcs:{Luke:npc}};
 const feature=executeTrainerFeature(state,{actor:{kind:"npc",id:"Luke"},featureId:"directed-strike"});
 const battle={round:4,player:{effects:{}},opponent:{effects:{}},log:[]};
 applyTrainerCombatEffect(battle,{side:"opponent",featureResult:feature});
 const saved=JSON.parse(JSON.stringify({state,battle}));
 assert.equal(saved.state.npcs.Luke.trainer.classResources["tactical-points"].current,8);
 assert.equal(saved.battle.opponent.effects.damageAdvantageSources[0].usesRemaining,1);
 assert.equal(saved.battle.log[0].featureId,"directed-strike");
});
