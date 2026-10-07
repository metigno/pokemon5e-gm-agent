import test from "node:test";
import assert from "node:assert/strict";

import { createNewGameState, experienceNeededAtLevel } from "../src/engine/state.mjs";
import {
  advanceTrainerToLevel,
  applyTrainerProgressionEffect,
  getTrainerProgressionView,
  resolveTrainerProgressionChoice,
  syncCampaignTrainerProgression
} from "../src/engine/trainer-progression.mjs";

const fixedNow=()=> "2026-10-07T05:55:00.000Z";

test("M1 milestone requires Trainer Path before level 3",()=>{
  const state=createNewGameState({protagonist:"Luke",now:fixedNow});
  let applied=applyTrainerProgressionEffect(state,{type:"trainer_milestone_level",milestoneId:"M01_COMPLETE",level:3});
  assert.equal(state.player.trainerLevel,2);
  assert.equal(state.player.trainerXp,experienceNeededAtLevel(2));
  assert.equal(state.player.hp.max,12);
  assert.equal(state.player.hitDice.max,2);
  assert.equal(applied.length,1);

  const view=getTrainerProgressionView(state);
  assert.equal(view.type,"trainer_path");
  assert.equal(view.choices.length,13);

  resolveTrainerProgressionChoice(state,"trainer_path_ace-trainer");
  applied=syncCampaignTrainerProgression(state);
  assert.equal(state.player.trainerPath,"ace-trainer");
  assert.equal(state.player.trainerLevel,3);
  assert.equal(state.player.trainerXp,experienceNeededAtLevel(3));
  assert.equal(state.player.hp.max,16);
  assert.equal(state.player.hitDice.max,3);
  assert.equal(applied.length,1);
  assert.equal(getTrainerProgressionView(state),null);
});

test("M2 network milestone reaches level 4 and CON ASI retroactively raises HP",()=>{
  const state=createNewGameState({protagonist:"Luke",now:fixedNow});
  applyTrainerProgressionEffect(state,{type:"trainer_milestone_level",milestoneId:"M01_COMPLETE",level:3});
  resolveTrainerProgressionChoice(state,"trainer_path_tactician");
  syncCampaignTrainerProgression(state);

  applyTrainerProgressionEffect(state,{type:"trainer_milestone_level",milestoneId:"M02_NETWORK_OUTCOME",level:4});
  assert.equal(state.player.trainerLevel,4);
  assert.equal(state.player.trainerXp,experienceNeededAtLevel(4));
  assert.equal(state.player.hp.max,20);

  const view=getTrainerProgressionView(state);
  assert.equal(view.type,"asi_or_feat");
  assert.ok(view.choices.some(choice=>choice.id==="trainer_asi_con_2"));

  resolveTrainerProgressionChoice(state,"trainer_asi_con_2");
  assert.equal(state.player.abilities.CON,12);
  assert.equal(state.player.hp.max,24);
  assert.equal(state.player.hp.current,24);

  const applied=applyTrainerProgressionEffect(state,{type:"trainer_milestone_level",milestoneId:"M02_COMPLETE",level:5});
  assert.equal(state.player.trainerLevel,5);
  assert.equal(state.player.trainerXp,experienceNeededAtLevel(5));
  assert.equal(state.player.hp.max,29);
  assert.equal(state.player.hitDice.max,5);
  assert.equal(applied.length,1);
});

test("Trainer progression never jumps across unresolved required choices",()=>{
  const state=createNewGameState({protagonist:"Fab",now:fixedNow});
  const applied=advanceTrainerToLevel(state,5,{sourceMilestoneId:"TEST"});
  assert.equal(state.player.trainerLevel,2);
  assert.equal(applied.length,1);
  assert.equal(getTrainerProgressionView(state).type,"trainer_path");
});
