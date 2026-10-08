import test from "node:test";
import assert from "node:assert/strict";
import { createNewGameState, experienceNeededAtLevel, migrateGameState } from "../src/engine/state.mjs";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import {
  awardTrainerXp, resolveTrainerProgressionChoice, syncCampaignTrainerProgression
} from "../src/engine/trainer-progression.mjs";
import {
  TRAINER_LEVEL_CAPS_BY_MODULE, trainerLevelCapForState,
  trainerActivityXp, trainerStoryRewardKind
} from "../src/engine/trainer-xp-balance.mjs";
import { pokemonLevelCapForState } from "../src/engine/pokemon-xp-balance.mjs";

const now=()=> "2026-10-08T12:00:00.000Z";
const create=()=>createNewGameState({protagonist:"Luke",now});

test("Trainer caps per module are independent from the established Pokémon caps",()=>{
  const state=create();
  assert.deepEqual(Object.values(TRAINER_LEVEL_CAPS_BY_MODULE),
    [3,5,9,12,15,18,20,20,20,20,20,20]);
  assert.equal(trainerLevelCapForState(state),3);
  assert.equal(pokemonLevelCapForState(state),5);
  state.world.flags.m1_complete=true;
  assert.equal(trainerLevelCapForState(state),5);
  assert.equal(pokemonLevelCapForState(state),6);
  state.world.flags.m6_complete=true;
  assert.equal(trainerLevelCapForState(state),20);
  state.story.sceneId="m01-release";
  assert.equal(trainerLevelCapForState(state),20,"older scene cannot lower a cap");
});

test("XP earned at a cap is lost rather than banked, including across a pending choice",()=>{
  const state=create();
  assert.equal(awardTrainerXp(state,199).awarded,199);
  assert.equal(state.player.trainerLevel,1);
  const atTwo=awardTrainerXp(state,1);
  assert.equal(atTwo.levelUps.length,1);
  assert.equal(state.player.trainerLevel,2);
  assert.equal(state.player.trainerProgression.pendingChoices[0].type,"trainer_path");
  const capped=awardTrainerXp(state,100000);
  assert.equal(state.player.trainerXp,experienceNeededAtLevel(3));
  assert.equal(capped.discarded,100000-(experienceNeededAtLevel(3)-200));
  assert.equal(state.player.trainerLevel,2,"required choice must not be skipped");
  resolveTrainerProgressionChoice(state,"trainer_path_ace-trainer");
  syncCampaignTrainerProgression(state);
  assert.equal(state.player.trainerLevel,3);
  assert.equal(state.player.trainerXp,experienceNeededAtLevel(3));
  assert.equal(awardTrainerXp(state,10000).awarded,0);
  state.world.flags.m1_complete=true;
  assert.equal(state.player.trainerXp,experienceNeededAtLevel(3),"higher cap never restores lost XP");
  assert.equal(awardTrainerXp(state,0).awarded,0);
  assert.equal(state.player.trainerLevel,3);
  awardTrainerXp(state,100000);
  assert.equal(state.player.trainerLevel,4);
  assert.equal(state.player.trainerXp,experienceNeededAtLevel(5));
  assert.equal(state.player.trainerProgression.pendingChoices[0].type,"asi_or_feat");
  resolveTrainerProgressionChoice(state,"trainer_asi_dex_2");
  syncCampaignTrainerProgression(state);
  assert.equal(state.player.trainerLevel,5);
  assert.equal(state.player.trainerXp,experienceNeededAtLevel(5));
});

test("One-shot authored rewards are idempotent and persist through save-state migration",()=>{
  const state=create();
  const first=awardTrainerXp(state,50,{rewardId:"story:test:resolve:discovery"});
  const second=awardTrainerXp(state,50,{rewardId:"story:test:resolve:discovery"});
  assert.equal(first.awarded,50);
  assert.equal(second.awarded,0);
  assert.equal(second.duplicate,true);
  const loaded=migrateGameState(JSON.parse(JSON.stringify(state)));
  assert.equal(awardTrainerXp(loaded,50,{rewardId:"story:test:resolve:discovery"}).awarded,0);
  assert.equal(loaded.player.trainerXp,50);
  assert.throws(()=>awardTrainerXp(loaded,-1),/non-negative/);
  assert.throws(()=>awardTrainerXp(loaded,1.5),/non-negative/);
});

test("Trainer activity rewards apply only to meaningful authored outcomes",()=>{
  const state=create();
  assert.equal(trainerActivityXp(state,"battle"),50);
  assert.equal(trainerActivityXp(state,"quest"),50);
  assert.equal(trainerActivityXp(state,"exploration"),20);
  assert.equal(trainerActivityXp(state,"check"),16);
  assert.equal(trainerActivityXp(state,"dialogue"),12);
  assert.equal(trainerStoryRewardKind({check:{},outcomes:{}},true),"check");
  assert.equal(trainerStoryRewardKind({check:{},outcomes:{}},false),null);
  assert.equal(trainerStoryRewardKind({effects:[{type:"quest_complete",questId:"test"}]},null),"quest");
  assert.equal(trainerStoryRewardKind({effects:[{type:"npc_relationship_adjust",npcId:"Blue"}]},null),"dialogue");
  assert.equal(trainerStoryRewardKind({effects:[{type:"set_flag",key:"clue_found",value:true}]},null),"exploration");
  assert.equal(trainerStoryRewardKind({effects:[{type:"trainer_milestone_level",level:3}]},null),null);
  assert.equal(trainerStoryRewardKind({goto:"next",effects:[]},null),null);
  assert.equal(trainerStoryRewardKind({combat:{},effects:[{type:"quest_complete"}]},true),null);
});

test("The real story choice pipeline awards a check only once and survives a replay",async()=>{
  const scene={
    id:"test-rewards",title:"Rewards",nodes:{
      entry:{choices:[{id:"inspect",check:{ability:"WIS",dc:1},
        outcomes:{success:{goto:"entry",effects:[{type:"set_flag",key:"clue_found",value:true}]},
          failure:{goto:"entry",effects:[]}}}]}
    }
  };
  const engine=new BookgameEngine({scenes:{load:async()=>scene},dice:new SequenceDice([15,15]),worldEvents:[],now});
  const state=create();
  state.story.sceneId="test-rewards";
  state.story.nodeId="entry";
  const once=await engine.choose(state,"inspect");
  assert.equal(once.player.trainerXp,16);
  assert.equal(once.story.history.at(-1).trainerXp.awarded,16);
  const twice=await engine.choose(once,"inspect");
  assert.equal(twice.player.trainerXp,16);
  assert.equal(twice.story.history.at(-1).trainerXp.duplicate,true);
});
