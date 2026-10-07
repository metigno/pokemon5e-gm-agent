import test from "node:test";
import assert from "node:assert/strict";
import { createPersistentNpc } from "../src/engine/npc-state.mjs";
import { executeTrainerFeature,rechargeTrainerResources } from "../src/engine/trainer-actions.mjs";

function stateWithNpc(path,level,abilities={}){
 const npc=createPersistentNpc({id:"npc",name:"NPC",state:{trainerLevel:level,trainerPath:path,abilities}});
 return {player:{},npcs:{npc}};
}
test("Tactician Directed Strike spends exactly two Tactical Points",()=>{
 const state=stateWithNpc("Tactician",5,{CON:10});
 const out=executeTrainerFeature(state,{actor:{kind:"npc",id:"npc"},featureId:"directed-strike"});
 assert.equal(out.used,true); assert.equal(out.effect,"damage-roll-advantage");
 assert.equal(state.npcs.npc.trainer.classResources["tactical-points"].current,3);
});
test("Tactician defensive reaction accepts 1..5 points",()=>{
 const state=stateWithNpc("Tactician",9,{});
 const out=executeTrainerFeature(state,{actor:{kind:"npc",id:"npc"},featureId:"raise-your-defenses",cost:5});
 assert.equal(out.action,"reaction"); assert.equal(out.amount,5);
 assert.equal(state.npcs.npc.trainer.classResources["tactical-points"].current,4);
 assert.throws(()=>executeTrainerFeature(state,{actor:{kind:"npc",id:"npc"},featureId:"raise-your-defenses",cost:6}),/above maximum/);
});
test("long rest recharges long-rest path resources",()=>{
 const state=stateWithNpc("Ace Trainer",5,{DEX:14});
 executeTrainerFeature(state,{actor:{kind:"npc",id:"npc"},featureId:"battle-master"});
 assert.equal(state.npcs.npc.trainer.classResources["battle-dice"].current,2);
 rechargeTrainerResources(state,{actor:{kind:"npc",id:"npc"},rest:"long-rest"});
 assert.equal(state.npcs.npc.trainer.classResources["battle-dice"].current,3);
});
test("short rest recharges Cheerleader",()=>{
 const state=stateWithNpc("Poké Mentor",9,{CHA:15});
 executeTrainerFeature(state,{actor:{kind:"npc",id:"npc"},featureId:"cheerleader",mode:"attack"});
 assert.equal(state.npcs.npc.trainer.classResources.cheerleader.current,0);
 rechargeTrainerResources(state,{actor:{kind:"npc",id:"npc"},rest:"short-rest"});
 assert.equal(state.npcs.npc.trainer.classResources.cheerleader.current,1);
});
