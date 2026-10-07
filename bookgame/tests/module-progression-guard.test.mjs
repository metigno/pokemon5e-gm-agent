import test from "node:test";
import assert from "node:assert/strict";
import { createNewGameState,experienceNeededAtLevel } from "../src/engine/state.mjs";
import { applyTrainerProgressionEffect } from "../src/engine/trainer-progression.mjs";
import { MODULE_TRAINER_LEVEL_BANDS,moduleTrainerXpCap } from "../src/engine/module-progression-guard.mjs";

test("canonical M1-M12 Trainer level bands are locked",()=>{
 assert.deepEqual(MODULE_TRAINER_LEVEL_BANDS,{
  M01:{min:1,max:3},M02:{min:3,max:5},M03:{min:5,max:9},M04:{min:8,max:12},
  M05:{min:11,max:15},M06:{min:14,max:18},M07:{min:17,max:20},M08:{min:18,max:20},
  M09:{min:18,max:20},M10:{min:18,max:20},M11:{min:18,max:20},M12:{min:18,max:20}
 });
 assert.equal(moduleTrainerXpCap("M01"),experienceNeededAtLevel(3));
 assert.equal(moduleTrainerXpCap("M12"),experienceNeededAtLevel(20));
});

test("campaign milestone cannot overlevel the active module",()=>{
 const state=createNewGameState({protagonist:"Luke"});
 assert.throws(()=>applyTrainerProgressionEffect(state,{
  type:"trainer_milestone_level",milestoneId:"M01_ILLEGAL_OVERLEVEL",level:4
 }),/above M01 cap 3/);
 assert.equal(state.player.trainerLevel,1);
});

test("explicit moduleId guards milestones whose story id has no module prefix",()=>{
 const state=createNewGameState({protagonist:"Luke"});
 assert.throws(()=>applyTrainerProgressionEffect(state,{
  type:"trainer_milestone_level",milestoneId:"PROMOTION_COMPLETE",moduleId:"M02",level:6
 }),/above M02 cap 5/);
});
