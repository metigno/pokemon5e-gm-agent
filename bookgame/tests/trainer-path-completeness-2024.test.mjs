import test from "node:test";
import assert from "node:assert/strict";
import { trainerPathRuntime,trainerPathDefinition,trainerPathNames } from "../src/rules/trainer-path-runtime-2024.mjs";
import { TRAINER_PATHS_2024 } from "../src/rules/trainer-2024.mjs";

test("all canonical 2024 Trainer Paths have runtime definitions and four level unlocks",()=>{
 assert.deepEqual(new Set(trainerPathNames()),new Set(TRAINER_PATHS_2024));
 for(const path of TRAINER_PATHS_2024){
  const def=trainerPathDefinition(path);
  assert.ok(def, path+" missing runtime definition");
  assert.deepEqual(Object.keys(def.features).map(Number),[2,5,9,15],path+" must unlock at 2/5/9/15");
  assert.equal(trainerPathRuntime(path,{level:1,abilities:{}}).features.length,0);
  assert.equal(trainerPathRuntime(path,{level:20,abilities:{WIS:14,DEX:14}}).features.length,4);
 }
});

test("canonical resource paths scale from the pinned 2024 rules",()=>{
 assert.equal(trainerPathRuntime("Hobbyist",{level:15,abilities:{WIS:14}}).resources["skill-dice"].die,"d10");
 assert.equal(trainerPathRuntime("Hobbyist",{level:15,abilities:{WIS:14}}).resources["skill-dice"].max,3);
 assert.equal(trainerPathRuntime("Researcher",{level:9}).resources.understanding.max,4);
 assert.equal(trainerPathRuntime("Nurse",{level:9}).resources.pokechef.max,4);
 assert.equal(trainerPathRuntime("Grunt",{level:15}).resources["shadow-points"].max,15);
 assert.equal(trainerPathRuntime("Guru",{level:15,abilities:{WIS:14}}).resources.spirit.max,3);
});

test("paths without a consumable class pool do not invent one",()=>{
 for(const path of ["Type Master","Commander","Ranger","Pokémon Breeder"]){
  assert.deepEqual(trainerPathRuntime(path,{level:20,abilities:{}}).resources,{},path);
 }
});
