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

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../content/modules/", import.meta.url));
const fixedNow = () => "2026-10-05T10:05:00.000Z";

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

// Build a state that satisfies the full canonical M01 exit contract
function legalM01State(protagonist = "Luke") {
  const state = createNewGameState({ protagonist, now: fixedNow });
  state.competition.rank = "E";
  state.competition.rankOrder = 1;
  state.world.flags.m1_complete = true;
  state.world.flags.m02_unlocked = true;
  state.world.flags.blue_met = true;
  state.npcs.Blue.state.met = true;
  state.world.flags.friend_beat_01_complete = true;
  state.world.flags.friend_beat_01_friend_id = "Mattew";
  state.world.flags.friend_beat_01_type = "city_encounter";
  state.world.flags.friends_split = true;
  return state;
}

function enterHandoff(state) {
  state.story.sceneId = "m02-rank-e-handoff";
  state.story.nodeId = "rank_e_world";
  return state;
}

// ── Legal entry ─────────────────────────────────────────────────────────────

test("M2_00 legal entry loads the handoff scene and exposes confirm choice", async () => {
  const { engine } = await makeEngine();
  let state = enterHandoff(legalM01State());

  const view = await engine.present(state);
  assert.equal(view.sceneId, "m02-rank-e-handoff");
  assert.equal(view.nodeId, "rank_e_world");
  assert.equal(view.moduleId, "M02");
  assert.equal(view.choices.some((c) => c.id === "confirm_rank_e_active"), true);
  assert.equal(view.choices.some((c) => c.id === "already_active"), false);
});

test("M2_00 confirm_rank_e_active sets m2_active and advances to access_band_open", async () => {
  const { engine } = await makeEngine();
  let state = enterHandoff(legalM01State());

  state = await engine.choose(state, "confirm_rank_e_active");

  assert.equal(state.story.sceneId, "m02-rank-e-handoff");
  assert.equal(state.story.nodeId, "access_band_open");
  assert.equal(state.world.flags.m2_active, true);
});

test("M2_00 access_band_open exposes back_to_valedarsena choice", async () => {
  const { engine } = await makeEngine();
  let state = enterHandoff(legalM01State());
  state = await engine.choose(state, "confirm_rank_e_active");

  const view = await engine.present(state);
  assert.equal(view.nodeId, "access_band_open");
  assert.equal(view.choices.some((c) => c.id === "back_to_valedarsena"), true);
});

// ── M01 state preserved ──────────────────────────────────────────────────────

test("M2_00 entry preserves all M01 callbacks in full", async () => {
  const { engine } = await makeEngine();
  let state = legalM01State();

  // Plant rich M01 history
  state.world.flags.houndour_ginestre_disposition = "captured";
  state.world.flags.valedarsena_reputation = "helpful_rookie";
  state.world.flags.m1_world_pressure_state = "pressure_resolved_local";
  state.world.flags.first_official_resolved = true;
  state.world.flags.first_official_result = "win";
  state.world.flags.blue_m1_result = "win";
  state.world.flags.ranger_elio_relationship = "trusted";
  state.player.secondPokemonAcquisition = {
    speciesId: "houndour",
    name: "Houndour",
    level: 3,
    day: 2,
    locationId: "asteria_ginestre",
    encounterId: "HOUNDOUR_GINESTRE_001"
  };
  state.quests.SQ_FARM_HERD_HANDS = {
    id: "SQ_FARM_HERD_HANDS",
    title: "Recinti aperti",
    objective: "Test",
    status: "failed",
    resolution: "abandoned"
  };
  state.player.roster.push({ speciesId: "houndour", name: "Houndour", level: 3 });
  state.player.money = 740;

  const snapshot = {
    houndour: state.world.flags.houndour_ginestre_disposition,
    reputation: state.world.flags.valedarsena_reputation,
    pressure: state.world.flags.m1_world_pressure_state,
    firstOfficialResult: state.world.flags.first_official_result,
    blueResult: state.world.flags.blue_m1_result,
    elioRel: state.world.flags.ranger_elio_relationship,
    friendId: state.world.flags.friend_beat_01_friend_id,
    friendType: state.world.flags.friend_beat_01_type,
    friendBeat: state.world.flags.friend_beat_01_complete,
    second: structuredClone(state.player.secondPokemonAcquisition),
    quest: structuredClone(state.quests.SQ_FARM_HERD_HANDS),
    rosterLen: state.player.roster.length,
    money: state.player.money,
    rank: state.competition.rank,
    day: state.world.day,
    elapsed: state.world.elapsedMinutes
  };

  enterHandoff(state);
  state = await engine.choose(state, "confirm_rank_e_active");

  assert.equal(state.world.flags.houndour_ginestre_disposition, snapshot.houndour);
  assert.equal(state.world.flags.valedarsena_reputation, snapshot.reputation);
  assert.equal(state.world.flags.m1_world_pressure_state, snapshot.pressure);
  assert.equal(state.world.flags.first_official_result, snapshot.firstOfficialResult);
  assert.equal(state.world.flags.blue_m1_result, snapshot.blueResult);
  assert.equal(state.world.flags.ranger_elio_relationship, snapshot.elioRel);
  assert.equal(state.world.flags.friend_beat_01_friend_id, snapshot.friendId);
  assert.equal(state.world.flags.friend_beat_01_type, snapshot.friendType);
  assert.equal(state.world.flags.friend_beat_01_complete, snapshot.friendBeat);
  assert.deepEqual(state.player.secondPokemonAcquisition, snapshot.second);
  assert.deepEqual(state.quests.SQ_FARM_HERD_HANDS, snapshot.quest);
  assert.equal(state.player.roster.length, snapshot.rosterLen);
  assert.equal(state.player.money, snapshot.money);
  assert.equal(state.competition.rank, snapshot.rank);
  assert.equal(state.world.day, snapshot.day);
  assert.equal(state.world.elapsedMinutes, snapshot.elapsed);
});

// ── Illegal entry ────────────────────────────────────────────────────────────

test("M2_00 illegal entry: Rank F blocks present()", async () => {
  const { engine } = await makeEngine();
  const state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  // Rank F, no m1_complete, no m02_unlocked
  enterHandoff(state);

  await assert.rejects(
    () => engine.present(state),
    /Scene conditions are not satisfied/
  );
});

test("M2_00 illegal entry: m1_complete=false blocks present()", async () => {
  const { engine } = await makeEngine();
  const state = legalM01State();
  state.world.flags.m1_complete = false;
  enterHandoff(state);

  await assert.rejects(
    () => engine.present(state),
    /Scene conditions are not satisfied/
  );
});

test("M2_00 illegal entry: m02_unlocked=false blocks present()", async () => {
  const { engine } = await makeEngine();
  const state = legalM01State();
  state.world.flags.m02_unlocked = false;
  enterHandoff(state);

  await assert.rejects(
    () => engine.present(state),
    /Scene conditions are not satisfied/
  );
});

test("M2_00 illegal entry: Rank E but m02_unlocked=false blocks choose()", async () => {
  const { engine } = await makeEngine();
  const state = legalM01State();
  state.world.flags.m02_unlocked = false;
  enterHandoff(state);

  await assert.rejects(
    () => engine.choose(state, "confirm_rank_e_active"),
    /Scene conditions are not satisfied/
  );
});

test("M2_00 illegal entry: Rank F blocks choose() as well", async () => {
  const { engine } = await makeEngine();
  const state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  enterHandoff(state);

  await assert.rejects(
    () => engine.choose(state, "confirm_rank_e_active"),
    /Scene conditions are not satisfied/
  );
});

// ── No premature M2 content ──────────────────────────────────────────────────

test("M2_00 entry does not auto-trigger N, poaching, friend_beat_02, Rookie Cup or E→D trial", async () => {
  const { engine } = await makeEngine();
  let state = enterHandoff(legalM01State());

  state = await engine.choose(state, "confirm_rank_e_active");

  assert.equal(state.world.flags.n_met, undefined);
  assert.equal(state.world.flags.friend_beat_02_complete, undefined);
  assert.equal(state.world.flags.friend_beat_02_friend_id, undefined);
  assert.equal(state.world.flags.poaching_network_state, undefined);
  assert.equal(state.competition.rank, "E", "rank must remain E — no auto-promotion to D");
  assert.equal(state.competition.trials.RANK_E_TO_D, undefined, "E→D trial must not be registered");

  // A2_ROOKIE_CUP and A2_LOCAL_PROBLEM must not have fired
  assert.equal(state.events.A2_ROOKIE_CUP, undefined);
  assert.equal(state.events.A2_LOCAL_PROBLEM, undefined);
  assert.equal(state.events.A2_RANK_TRIAL_E_D, undefined);
});

test("M2_00 entry does not heal, reset or modify the player team", async () => {
  const { engine } = await makeEngine();
  let state = legalM01State();

  // Simulate a battle-worn team
  state.player.roster.push({
    speciesId: "shinx",
    name: "Shinx",
    level: 5,
    hp: { current: 4, max: 22 },
    statuses: ["poisoned"]
  });
  state.player.money = 180;

  const rosterBefore = structuredClone(state.player.roster);
  const moneyBefore = state.player.money;

  enterHandoff(state);
  state = await engine.choose(state, "confirm_rank_e_active");

  assert.equal(state.player.roster.length, rosterBefore.length);
  assert.deepEqual(state.player.roster[1].hp, rosterBefore[1].hp);
  assert.deepEqual(state.player.roster[1].statuses, rosterBefore[1].statuses);
  assert.equal(state.player.money, moneyBefore, "money must not change");
  assert.equal(state.player.inventory.length, 0, "no items awarded");
});

// ── Idempotence ──────────────────────────────────────────────────────────────

test("M2_00 repeated entry uses already_active path and does not duplicate m2_active", async () => {
  const { engine } = await makeEngine();
  let state = enterHandoff(legalM01State());

  // First entry
  state = await engine.choose(state, "confirm_rank_e_active");
  assert.equal(state.world.flags.m2_active, true);

  // Return to the handoff scene and re-enter
  state.story.sceneId = "m02-rank-e-handoff";
  state.story.nodeId = "rank_e_world";

  const view = await engine.present(state);
  assert.equal(view.choices.some((c) => c.id === "confirm_rank_e_active"), false,
    "confirm choice must be hidden after m2_active=true");
  assert.equal(view.choices.some((c) => c.id === "already_active"), true,
    "already_active path must be visible on re-entry");

  state = await engine.choose(state, "already_active");
  assert.equal(state.world.flags.m2_active, true, "flag remains true, not toggled or duplicated");
  assert.equal(state.story.nodeId, "access_band_open");
});

test("M2_00 idempotent re-entry does not reset NPC schedules or world time", async () => {
  const { engine } = await makeEngine();
  let state = enterHandoff(legalM01State());
  state.world.elapsedMinutes = 2880; // Day 3
  state.world.day = 3;

  // First entry — engine calls refreshNpcSchedules; capture schedule AFTER
  state = await engine.choose(state, "confirm_rank_e_active");
  const npcScheduleAfterFirst = structuredClone(state.npcs.Blue.schedule);
  const dayAfterFirst = state.world.day;
  const elapsedAfterFirst = state.world.elapsedMinutes;

  // Re-enter
  state.story.sceneId = "m02-rank-e-handoff";
  state.story.nodeId = "rank_e_world";
  state = await engine.choose(state, "already_active");

  assert.equal(state.world.day, dayAfterFirst, "world day must not change on re-entry");
  assert.equal(state.world.elapsedMinutes, elapsedAfterFirst, "elapsed minutes must not change on re-entry");
  assert.deepEqual(state.npcs.Blue.schedule, npcScheduleAfterFirst, "NPC schedules must not reset on re-entry");
});

// ── Persistence ──────────────────────────────────────────────────────────────

test("M2_00 handoff state survives save/reload identically", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m2-handoff-"));
  try {
    const { engine } = await makeEngine();
    const store = new SaveStore(dir);

    let state = createNewGameState({ protagonist: "Luke", slot: "m2-handoff-test", now: fixedNow });
    state.competition.rank = "E";
    state.competition.rankOrder = 1;
    state.world.flags.m1_complete = true;
    state.world.flags.m02_unlocked = true;
    state.world.flags.blue_met = true;
    state.npcs.Blue.state.met = true;
    state.world.flags.friend_beat_01_complete = true;
    state.world.flags.friend_beat_01_friend_id = "Edward";
    state.world.flags.friend_beat_01_type = "farm_help";
    state.world.flags.friends_split = true;
    state.world.flags.houndour_ginestre_disposition = "calmed";
    state.world.flags.m1_world_pressure_state = "pressure_partially_resolved";
    state.player.money = 520;
    state.player.roster.push({ speciesId: "wooloo", name: "Wooloo", level: 4 });

    enterHandoff(state);
    state = await engine.choose(state, "confirm_rank_e_active");
    await store.save(state);
    const loaded = await store.load("m2-handoff-test");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.m2_active, true);
    assert.equal(loaded.competition.rank, "E");
    assert.equal(loaded.world.flags.m1_complete, true);
    assert.equal(loaded.world.flags.m02_unlocked, true);
    assert.equal(loaded.world.flags.blue_met, true);
    assert.equal(loaded.world.flags.friend_beat_01_complete, true);
    assert.equal(loaded.world.flags.friend_beat_01_friend_id, "Edward");
    assert.equal(loaded.world.flags.houndour_ginestre_disposition, "calmed");
    assert.equal(loaded.world.flags.m1_world_pressure_state, "pressure_partially_resolved");
    assert.equal(loaded.player.money, 520);
    assert.equal(loaded.player.roster.length, 2);
    assert.equal(loaded.world.flags.n_met, undefined);
    assert.equal(loaded.world.flags.friend_beat_02_complete, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ── Divergent M01 histories ───────────────────────────────────────────────────

test("M2_00 History A: Houndour captured + Blue fought + First Official won + trial second attempt", async () => {
  const { engine } = await makeEngine();
  let state = legalM01State();

  // History A specifics
  state.world.flags.houndour_ginestre_disposition = "captured";
  state.world.flags.blue_m1_result = "win";
  state.world.flags.blue_m1_battled = true;
  state.world.flags.first_official_resolved = true;
  state.world.flags.first_official_result = "win";
  state.world.flags.m1_trial_attempts = 2;
  state.world.flags.m1_world_pressure_state = "pressure_resolved_local";
  state.competition.history = [
    { matchId: "first_official_001", outcome: "win" },
    { matchId: "rank_f_to_e_001", outcome: "lose" },
    { matchId: "rank_f_to_e_002", outcome: "win" }
  ];
  state.player.secondPokemonAcquisition = {
    speciesId: "houndour",
    name: "Houndour",
    level: 3,
    day: 2,
    locationId: "asteria_ginestre",
    encounterId: "HOUNDOUR_GINESTRE_001"
  };
  state.player.roster.push({ speciesId: "houndour", name: "Houndour", level: 4 });

  enterHandoff(state);
  state = await engine.choose(state, "confirm_rank_e_active");

  assert.equal(state.world.flags.m2_active, true);
  assert.equal(state.competition.rank, "E");
  assert.equal(state.world.flags.houndour_ginestre_disposition, "captured",
    "History A: Houndour captured flag preserved");
  assert.equal(state.world.flags.blue_m1_result, "win",
    "History A: Blue fight result preserved");
  assert.equal(state.world.flags.first_official_result, "win",
    "History A: First Official result preserved");
  assert.equal(state.world.flags.m1_trial_attempts, 2,
    "History A: trial attempt count preserved");
  assert.equal(state.competition.history.length, 3,
    "History A: competition history preserved");
  assert.equal(state.player.roster.length, 2,
    "History A: roster with Houndour preserved");
});

test("M2_00 History B: Houndour not captured + Blue not fought + First Official lost + trial first attempt", async () => {
  const { engine } = await makeEngine();
  let state = legalM01State();

  // History B specifics
  state.world.flags.houndour_ginestre_disposition = "calmed";
  // blue_m1_battled not set → undefined
  state.world.flags.first_official_resolved = true;
  state.world.flags.first_official_result = "lose";
  state.world.flags.m1_trial_attempts = 1;
  state.world.flags.m1_world_pressure_state = "pressure_investigated";
  state.competition.history = [
    { matchId: "first_official_001", outcome: "lose" },
    { matchId: "rank_f_to_e_001", outcome: "win" }
  ];
  // secondPokemonAcquisition not set → undefined (no capture)

  enterHandoff(state);
  state = await engine.choose(state, "confirm_rank_e_active");

  assert.equal(state.world.flags.m2_active, true);
  assert.equal(state.competition.rank, "E");
  assert.equal(state.world.flags.houndour_ginestre_disposition, "calmed",
    "History B: Houndour not captured, calmed flag preserved");
  assert.equal(state.world.flags.blue_m1_battled, undefined,
    "History B: Blue never fought, flag absent");
  assert.equal(state.world.flags.first_official_result, "lose",
    "History B: First Official loss preserved");
  assert.equal(state.world.flags.m1_trial_attempts, 1,
    "History B: single trial attempt preserved");
  assert.equal(state.competition.history.length, 2,
    "History B: shorter competition history preserved");
  assert.equal(state.player.secondPokemonAcquisition, undefined,
    "History B: no second Pokémon acquisition recorded");
});

test("M2_00 History A and B both enter the same M02 framework", async () => {
  const { engine } = await makeEngine();

  // History A
  let stateA = legalM01State();
  stateA.world.flags.houndour_ginestre_disposition = "captured";
  stateA.world.flags.first_official_result = "win";
  enterHandoff(stateA);
  stateA = await engine.choose(stateA, "confirm_rank_e_active");

  // History B
  let stateB = legalM01State();
  stateB.world.flags.houndour_ginestre_disposition = "calmed";
  stateB.world.flags.first_official_result = "lose";
  enterHandoff(stateB);
  stateB = await engine.choose(stateB, "confirm_rank_e_active");

  // Both reach access_band_open inside the same M2_00 scene
  assert.equal(stateA.story.sceneId, "m02-rank-e-handoff");
  assert.equal(stateA.story.nodeId, "access_band_open");
  assert.equal(stateB.story.sceneId, "m02-rank-e-handoff");
  assert.equal(stateB.story.nodeId, "access_band_open");

  // Both have m2_active=true and rank E
  assert.equal(stateA.world.flags.m2_active, true);
  assert.equal(stateB.world.flags.m2_active, true);
  assert.equal(stateA.competition.rank, "E");
  assert.equal(stateB.competition.rank, "E");

  // Their divergent history is still different
  assert.equal(stateA.world.flags.houndour_ginestre_disposition, "captured");
  assert.equal(stateB.world.flags.houndour_ginestre_disposition, "calmed");
  assert.equal(stateA.world.flags.first_official_result, "win");
  assert.equal(stateB.world.flags.first_official_result, "lose");
});
