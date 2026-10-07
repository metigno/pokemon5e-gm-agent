import test from "node:test";
import assert from "node:assert/strict";
import { trainerPathRuntime } from "../src/rules/trainer-path-runtime-2024.mjs";
import { createPersistentNpc } from "../src/engine/npc-state.mjs";

test("Tactician runtime scales Tactical Points and unlocks level features",()=>{
 const r=trainerPathRuntime("Tactician",{level:10,abilities:{DEX:14}});
 assert.equal(r.resources["tactical-points"].max,10);
 assert.equal(r.resources["tactical-points"].recharge,"long-rest");
 assert.deepEqual(r.features,["tactical-healing","directed-strike","raise-your-defenses"]);
});
test("Ace Trainer battle dice derive pool and die from level and DEX",()=>{
 const r=trainerPathRuntime("Ace Trainer",{level:15,abilities:{DEX:15}});
 assert.equal(r.resources["battle-dice"].max,3);
 assert.equal(r.resources["battle-dice"].die,"d10");
});
test("Commander has path features but no invented Trainer resource",()=>{
 const r=trainerPathRuntime("Commander",{level:15,abilities:{}});
 assert.deepEqual(r.resources,{});
 assert.ok(r.features.includes("were-a-team"));
});
test("scripted NPC snapshot gets real path runtime at appearance level",()=>{
 const npc=createPersistentNpc({id:"Luke",name:"Luke",state:{trainerLevel:10,trainerPath:"Tactician",abilities:{STR:13,DEX:14,CON:15,INT:12,WIS:8,CHA:10}}});
 assert.equal(npc.trainer.classResources["tactical-points"].max,10);
 assert.ok(npc.trainer.classFeatures.includes("raise-your-defenses"));
 assert.ok(!npc.trainer.classFeatures.includes("not-this-time"));
 assert.equal(npc.trainer.hp.max,62);
});
