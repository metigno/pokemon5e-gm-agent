import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { compileStory } from "../src/compiler/story-compiler.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";
import {
  adjustNpcRelationship,
  selectFriendBeatCandidate,
  setNpcSchedule
} from "../src/engine/npc-state.mjs";

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../content/modules/", import.meta.url));
const fixedNow = () => "2026-10-05T08:50:00.000Z";
const FIVE = ["Luke", "Mattew", "Daniel", "Edward", "Fab"];
const MINUTES_PER_DAY = 24 * 60;

async function makeEngine() {
  const bundle = await compileStory({ scenesDir, modulesDir });
  const scenes = {
    async load(sceneId) {
      const scene = bundle.scenes[sceneId];
      if (!scene) throw new Error("missing scene " + sceneId);
      return structuredClone(scene);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents ?? []);
    }
  };
  return { engine: new BookgameEngine({ scenes, now: fixedNow }), bundle };
}

function setDay(state, day, minuteOfDay = 8 * 60) {
  state.world.elapsedMinutes = ((day - 1) * MINUTES_PER_DAY) + minuteOfDay;
  state.world.day = day;
  state.world.minuteOfDay = minuteOfDay;
  state.world.time =
    minuteOfDay < 6 * 60 ? "night" :
    minuteOfDay < 12 * 60 ? "morning" :
    minuteOfDay < 18 * 60 ? "afternoon" : "evening";
  return state;
}

test("M1_09 New Game initializes exactly the other Four for every protagonist", () => {
  for (const protagonist of FIVE) {
    const state = createNewGameState({ protagonist, now: fixedNow });
    const expected = FIVE.filter((id) => id !== protagonist).concat("Blue").sort();
    assert.deepEqual(Object.keys(state.npcs).sort(), expected);
    assert.equal(state.npcs[protagonist], undefined);

    for (const friendId of FIVE.filter((id) => id !== protagonist)) {
      assert.equal(state.npcs[friendId].state.trainerLevel, 1);
      assert.equal(state.npcs[friendId].state.rankState, "F");
      assert.equal(state.npcs[friendId].state.teamStage, "rookie");
      assert.equal(state.npcs[friendId].state.starterLevel, 5);
      assert.equal(state.npcs[friendId].state.recentResult, "none");
    }
  }
});

test("M1_09 selector uses location and schedule as hard eligibility gates", () => {
  const state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.world.locationId = "asteria_farm";

  setNpcSchedule(state, {
    npcId: "Mattew",
    scheduleId: "mattew_city",
    locationId: "valedarsena_city",
    availability: "available",
    activity: "farm_support"
  });
  setNpcSchedule(state, {
    npcId: "Daniel",
    scheduleId: "daniel_farm",
    locationId: "asteria_farm",
    availability: "busy",
    activity: "farm_support"
  });
  setNpcSchedule(state, {
    npcId: "Edward",
    scheduleId: "edward_farm",
    locationId: "asteria_farm",
    availability: "available",
    activity: "farm_support"
  });

  assert.equal(selectFriendBeatCandidate(state, {
    locationId: "asteria_farm",
    compatibleActivities: ["farm_support"]
  }), "Edward");
});

test("M1_09 selector considers content compatibility before relationship", () => {
  const state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.world.locationId = "asteria_farm";

  setNpcSchedule(state, {
    npcId: "Mattew",
    scheduleId: "mattew_farm",
    locationId: "asteria_farm",
    availability: "available",
    activity: "farm_support"
  });
  setNpcSchedule(state, {
    npcId: "Edward",
    scheduleId: "edward_farm",
    locationId: "asteria_farm",
    availability: "available",
    activity: "sparring"
  });
  adjustNpcRelationship(state, { npcId: "Edward", delta: 50 });

  assert.equal(selectFriendBeatCandidate(state, {
    locationId: "asteria_farm",
    compatibleActivities: ["farm_support"]
  }), "Mattew");
});

test("M1_09 selector considers recent result before relationship among equally compatible friends", () => {
  const state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.world.locationId = "asteria_farm";

  for (const npcId of ["Edward", "Fab"]) {
    setNpcSchedule(state, {
      npcId,
      scheduleId: npcId.toLowerCase() + "_farm",
      locationId: "asteria_farm",
      availability: "available",
      activity: "farm_support"
    });
  }
  state.npcs.Edward.state.recentResult = "road_scouted";
  state.npcs.Fab.state.recentResult = "herd_helped";
  adjustNpcRelationship(state, { npcId: "Edward", delta: 40 });

  assert.equal(selectFriendBeatCandidate(state, {
    locationId: "asteria_farm",
    compatibleActivities: ["farm_support"],
    preferredRecentResults: ["herd_helped"]
  }), "Fab");
});

test("M1_09 authored E6 schedules move the other Four independently and never schedule the protagonist", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Mattew", now: fixedNow });
  setDay(state, 3);
  state.story.sceneId = "m01-release";
  state.story.nodeId = "free_roam";

  state = await engine.choose(state, "to_ginestre");

  assert.equal(state.events.A1_FRIENDS_M1_SCHEDULE_START.status, "resolved");
  assert.equal(state.events.A1_FRIENDS_M1_DAY2.status, "resolved");
  assert.equal(state.events.A1_FRIENDS_M1_DAY3.status, "resolved");
  assert.equal(state.world.flags.friends_m1_schedule_day, 3);
  assert.equal(state.npcs.Mattew, undefined);
  assert.ok(state.npcs.Luke.schedule);
  assert.ok(state.npcs.Daniel.schedule);
  assert.ok(state.npcs.Edward.schedule);
  assert.ok(state.npcs.Fab.schedule);
});

test("M1_09 Valedarsena city hook selects the actual present friend and completes a non-battle beat", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "approach";

  state = await engine.choose(state, "enter_center");
  state.story.nodeId = "center";
  state = await engine.choose(state, "back_city");

  const cityView = await engine.present(state);
  assert.ok(cityView.choices.some((choice) => choice.id === "friend_beat_01"));

  state = await engine.choose(state, "friend_beat_01");
  assert.equal(state.world.flags.friend_beat_01_selected, true);
  assert.equal(state.world.flags.friend_beat_01_friend_id, "Daniel");
  assert.equal(state.world.flags.friend_beat_01_type, "city_encounter");
  assert.equal(state.story.sceneId, "m01-friend-beat-01");
  assert.equal(state.story.nodeId, "dispatch_city");

  state = await engine.choose(state, "meet_daniel");
  state = await engine.choose(state, "talk_progress");

  assert.equal(state.world.flags.friend_beat_01_complete, true);
  assert.equal(state.world.flags.friend_beat_01_friend_id, "Daniel");
  assert.equal(state.world.flags.friend_beat_01_type, "city_encounter");
  assert.equal(state.world.flags.friend_beat_01_result, "progress_talk");
  assert.equal(state.npcs.Daniel.state.friendBeat01Complete, true);
});

test("M1_09 farm hook deterministically selects a compatible present friend", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.story.sceneId = "m01-farm-first-arrival";
  state.story.nodeId = "approach";
  state.world.locationId = "asteria_farm";

  // One harmless authored action fires the day-1 living-world schedule.
  state = await engine.choose(state, "observe");
  state.story.nodeId = "approach";

  const view = await engine.present(state);
  assert.ok(view.choices.some((choice) => choice.id === "friend_beat_01"));

  state = await engine.choose(state, "friend_beat_01");
  assert.equal(state.world.flags.friend_beat_01_friend_id, "Edward");
  assert.equal(state.world.flags.friend_beat_01_type, "farm_help");
});

test("M1_09 day-2 Ginestre rotation produces an exploration beat instead of teleporting a friend", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  setDay(state, 2);
  state.story.sceneId = "m01-ginestre-crossroads";
  state.story.nodeId = "crossroads";
  state.world.locationId = "asteria_ginestre";

  state = await engine.choose(state, "stay");
  state.story.nodeId = "crossroads";

  const view = await engine.present(state);
  assert.ok(view.choices.some((choice) => choice.id === "friend_beat_01"));

  state = await engine.choose(state, "friend_beat_01");
  assert.equal(state.world.flags.friend_beat_01_friend_id, "Mattew");
  assert.equal(state.world.flags.friend_beat_01_type, "exploration");
});

test("M1_09 Arena spar uses the selected friend's canonical rookie Ace and real combat result", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "approach";

  state = await engine.choose(state, "arena");
  let view = await engine.present(state);
  assert.ok(view.choices.some((choice) => choice.id === "friend_beat_01_arena"));

  state = await engine.choose(state, "friend_beat_01_arena");
  assert.equal(state.world.flags.friend_beat_01_friend_id, "Mattew");
  assert.equal(state.world.flags.friend_beat_01_type, "sparring");

  state = await engine.choose(state, "meet_mattew");
  state = await engine.choose(state, "spar");

  assert.equal(state.pending.type, "pokemon5e_combat");
  assert.equal(state.pending.opponent.species, "Eevee");
  assert.equal(state.pending.opponent.level, 5);
  assert.equal(state.pending.opponent.trainerId, "Mattew");
  assert.equal(state.pending.competition, null);

  state = engine.resolveCombatHandoff(state, "lose");
  assert.equal(state.story.nodeId, "spar_mattew_loss");
  state = await engine.choose(state, "record");

  assert.equal(state.world.flags.friend_beat_01_complete, true);
  assert.equal(state.world.flags.friend_beat_01_result, "loss");
  assert.equal(state.npcs.Mattew.state.friendBeat01Result, "loss");
});

test("M1_09 sparring is optional and declining still completes the mandatory relationship beat", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.world.flags.friend_beat_01_friend_id = "Mattew";
  state.world.flags.friend_beat_01_type = "sparring";
  state.story.sceneId = "m01-friend-beat-01";
  state.story.nodeId = "dispatch_arena_mattew";

  state = await engine.choose(state, "decline");

  assert.equal(state.pending, null);
  assert.equal(state.world.flags.friend_beat_01_complete, true);
  assert.equal(state.world.flags.friend_beat_01_result, "spar_declined");
});

test("M1_09 completed beat removes all first-beat hooks", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "approach";

  state = await engine.choose(state, "enter_center");
  state.story.nodeId = "center";
  state = await engine.choose(state, "back_city");
  state = await engine.choose(state, "friend_beat_01");
  state = await engine.choose(state, "meet_daniel");
  state = await engine.choose(state, "keep_moving");
  state = await engine.choose(state, "back");

  const view = await engine.present(state);
  assert.ok(!view.choices.some((choice) => choice.id === "friend_beat_01"));
});

test("M1_09 selection and outcome survive save/reload exactly", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m1-friend-beat-"));
  try {
    const { engine } = await makeEngine();
    const store = new SaveStore(dir);
    let state = createNewGameState({ protagonist: "Luke", slot: "m1-friend", now: fixedNow });
    state.story.sceneId = "m01-valedarsena-first-arrival";
    state.story.nodeId = "approach";

    state = await engine.choose(state, "enter_center");
    state.story.nodeId = "center";
    state = await engine.choose(state, "back_city");
    state = await engine.choose(state, "friend_beat_01");
    state = await engine.choose(state, "meet_daniel");
    state = await engine.choose(state, "compare_results");

    await store.save(state);
    const loaded = await store.load("m1-friend");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.friend_beat_01_complete, true);
    assert.equal(loaded.world.flags.friend_beat_01_friend_id, "Daniel");
    assert.equal(loaded.world.flags.friend_beat_01_type, "city_encounter");
    assert.equal(loaded.world.flags.friend_beat_01_result, "result_comparison");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
