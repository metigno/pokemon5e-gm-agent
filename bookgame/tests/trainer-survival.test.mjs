import test from "node:test";
import assert from "node:assert/strict";
import { createNewGameState } from "../src/engine/state.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { applyTrainerCondition,removeTrainerCondition,applyTrainerDamage,healTrainer,resolveTrainerDeathSave,trainerCareerEnded } from "../src/engine/trainer-survival.mjs";

test("conditions use the same persistent runtime for player and NPC Trainers",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 applyTrainerCondition(s,{condition:"poisoned"});
 applyTrainerCondition(s,{actor:{kind:"npc",id:"Fab"},condition:"poisoned"});
 assert.deepEqual(s.player.conditions,["poisoned"]);
 assert.deepEqual(s.npcs.Fab.trainer.conditions,["poisoned"]);
 removeTrainerCondition(s,{actor:{kind:"npc",id:"Fab"},condition:"poisoned"});
 assert.deepEqual(s.npcs.Fab.trainer.conditions,[]);
});

test("damage to zero starts death saves and healing restores a Trainer",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 applyTrainerDamage(s,{amount:8});
 assert.equal(s.player.hp.current,0); assert.equal(s.player.death.state,"dying");
 healTrainer(s,{amount:1});
 assert.equal(s.player.hp.current,1); assert.equal(s.player.death.state,"alive");
});

test("three failed death saves kill the player Trainer and end the career",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 applyTrainerDamage(s,{amount:99});
 for(const n of [2,3,4]) resolveTrainerDeathSave(s,{dice:new SequenceDice([n])});
 assert.equal(s.player.death.state,"dead"); assert.equal(trainerCareerEnded(s),true);
});

test("three successful death saves stabilize without restoring HP",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 applyTrainerDamage(s,{amount:99});
 for(const n of [10,12,19]) resolveTrainerDeathSave(s,{dice:new SequenceDice([n])});
 assert.equal(s.player.death.state,"stable"); assert.equal(s.player.hp.current,0);
});

test("natural 20 death save restores one HP",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 applyTrainerDamage(s,{amount:99});
 const r=resolveTrainerDeathSave(s,{dice:new SequenceDice([20])});
 assert.equal(r.outcome,"critical_success"); assert.equal(s.player.hp.current,1); assert.equal(s.player.death.state,"alive");
});

test("natural 1 counts as two death-save failures",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 applyTrainerDamage(s,{amount:99});
 const r=resolveTrainerDeathSave(s,{dice:new SequenceDice([1])});
 assert.equal(r.failures,2);
});

test("NPC Trainer death is persistent but never ends the player's career",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 const actor={kind:"npc",id:"Edward"};
 applyTrainerDamage(s,{actor,amount:99});
 resolveTrainerDeathSave(s,{actor,dice:new SequenceDice([1])});
 resolveTrainerDeathSave(s,{actor,dice:new SequenceDice([2])});
 assert.equal(s.npcs.Edward.trainer.death.state,"dead");
 assert.equal(trainerCareerEnded(s),false);
});
