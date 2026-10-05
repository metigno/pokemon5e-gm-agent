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
const ecologyProfilesDir = fileURLToPath(new URL("../content/ecology/", import.meta.url));
const zonePoolsFile = fileURLToPath(new URL("../../campaign/world/ecology/ZONE_POOLS.json", import.meta.url));
const distributionFile = fileURLToPath(new URL("../../campaign/world/ecology/SPECIES_DISTRIBUTION.json", import.meta.url));
const faunaIndexFile = fileURLToPath(new URL("../../campaign/world/fauna/ASTERIA_FAUNA_INDEX.json", import.meta.url));
const ecologyOptions = { profilesDir: ecologyProfilesDir, zonePoolsFile, distributionFile, faunaIndexFile };
const fixedNow = () => "2026-10-05T11:30:00.000Z";

async function makeEngine() {
  const bundle = await compileStory({ scenesDir, modulesDir, ecologyOptions });
  const scenes = {
    async load(sceneId) {
      const scene = bundle.scenes[sceneId];
      if (!scene) throw new Error("missing scene " + sceneId);
      return structuredClone(scene);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents ?? []);
    },
    async loadEcology() {
      return structuredClone(bundle.ecology);
    }
  };
  return { engine: new BookgameEngine({ scenes, now: fixedNow }), bundle };
}

// Build a state that satisfies the canonical M02 exit contract
function legalM02ExitState(protagonist = "Luke") {
  const state = createNewGameState({ protagonist, now: fixedNow });
  state.competition.rank = "D";
  state.competition.rankOrder = 2;
  state.world.flags.m1_complete = true;
  state.world.flags.m02_unlocked = true;
  state.world.flags.m2_active = true;
  state.world.flags.m2_complete = true;
  state.world.flags.m03_unlocked = true;
  state.world.flags.blue_met = true;
  state.npcs.Blue.state.met = true;
  state.world.flags.friend_beat_01_complete = true;
  state.world.flags.friend_beat_01_friend_id = "Mattew";
  state.world.flags.friends_split = true;
  state.world.flags.n_met = true;
  state.world.flags.friend_beat_02_complete = true;
  state.world.flags.friend_beat_02_friend_id = "Daniel";
  state.world.flags.network_outcome_complete = true;
  state.world.flags.poaching_network_state = "resolved";
  return state;
}

function enterHandoff(state) {
  state.story.sceneId = "m03-handoff";
  state.story.nodeId = "m03_entry";
  return state;
}

// ─── COMPILATION / NODE PRESENCE ──────────────────────────────────────────────

test("M3_00 scene compiles and all required nodes exist", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m03-handoff"];
  assert.ok(scene, "m03-handoff must compile");
  assert.equal(scene.moduleId, "M03");
  assert.equal(scene.entryNodeId, "m03_entry");
  for (const nodeId of ["m03_entry", "access_band_open", "m2_summary"]) {
    assert.ok(scene.nodes[nodeId], `node ${nodeId} must exist`);
  }
});

// ─── LEGAL ENTRY ──────────────────────────────────────────────────────────────

test("M3_00 legal entry presents handoff scene with confirm choice", async () => {
  const { engine } = await makeEngine();
  const state = enterHandoff(legalM02ExitState());
  const view = await engine.present(state);
  assert.equal(view.sceneId, "m03-handoff");
  assert.equal(view.nodeId, "m03_entry");
  assert.equal(view.moduleId, "M03");
  assert.equal(view.choices.some((c) => c.id === "confirm_rank_d_active"), true);
  assert.equal(view.choices.some((c) => c.id === "already_active_m3"), false);
});

test("M3_00 confirm_rank_d_active sets m3_active and advances to access_band_open", async () => {
  const { engine } = await makeEngine();
  const state = enterHandoff(legalM02ExitState());
  const next = await engine.choose(state, "confirm_rank_d_active");
  assert.equal(next.world.flags.m3_active, true);
  assert.equal(next.story.sceneId, "m03-handoff");
  assert.equal(next.story.nodeId, "access_band_open");
});

test("M3_00 access_band_open exposes return and summary choices", async () => {
  const { engine } = await makeEngine();
  const state = enterHandoff(legalM02ExitState());
  const next = await engine.choose(state, "confirm_rank_d_active");
  const view = await engine.present(next);
  assert.equal(view.nodeId, "access_band_open");
  for (const choiceId of ["back_to_valedarsena_d", "back_to_borgo_d", "review_m2_summary"]) {
    assert.ok(view.choices.find((c) => c.id === choiceId), `choice ${choiceId} must be visible`);
  }
});

// ─── ILLEGAL ENTRY ────────────────────────────────────────────────────────────

test("M3_00 illegal entry: rank E blocks present()", async () => {
  const { engine } = await makeEngine();
  const state = legalM02ExitState();
  state.competition.rank = "E";
  enterHandoff(state);
  await assert.rejects(
    () => engine.present(state),
    /Scene conditions are not satisfied/
  );
});

test("M3_00 illegal entry: m2_complete=false blocks present()", async () => {
  const { engine } = await makeEngine();
  const state = legalM02ExitState();
  state.world.flags.m2_complete = false;
  enterHandoff(state);
  await assert.rejects(
    () => engine.present(state),
    /Scene conditions are not satisfied/
  );
});

test("M3_00 illegal entry: m03_unlocked=false blocks present()", async () => {
  const { engine } = await makeEngine();
  const state = legalM02ExitState();
  state.world.flags.m03_unlocked = false;
  enterHandoff(state);
  await assert.rejects(
    () => engine.present(state),
    /Scene conditions are not satisfied/
  );
});

test("M3_00 illegal entry: rank F blocks choose()", async () => {
  const { engine } = await makeEngine();
  const state = legalM02ExitState();
  state.competition.rank = "F";
  enterHandoff(state);
  await assert.rejects(
    () => engine.choose(state, "confirm_rank_d_active"),
    /Scene conditions are not satisfied/
  );
});

// ─── IDEMPOTENCE ──────────────────────────────────────────────────────────────

test("M3_00 repeated entry uses already_active_m3 and does not duplicate m3_active", async () => {
  const { engine } = await makeEngine();
  let state = enterHandoff(legalM02ExitState());

  state = await engine.choose(state, "confirm_rank_d_active");
  assert.equal(state.world.flags.m3_active, true);

  state.story.sceneId = "m03-handoff";
  state.story.nodeId = "m03_entry";

  const view = await engine.present(state);
  assert.equal(view.choices.some((c) => c.id === "confirm_rank_d_active"), false,
    "confirm choice must be hidden after m3_active=true");
  assert.equal(view.choices.some((c) => c.id === "already_active_m3"), true,
    "already_active_m3 path must be visible on re-entry");

  state = await engine.choose(state, "already_active_m3");
  assert.equal(state.world.flags.m3_active, true, "flag remains true, not toggled or duplicated");
  assert.equal(state.story.nodeId, "access_band_open");
});

// ─── NO PREMATURE M3 CONTENT ──────────────────────────────────────────────────

test("M3_00 entry does not auto-trigger Steven, Ferrox, FRIEND_BEAT_03, Regional Cup or D→C trial", async () => {
  const { engine } = await makeEngine();
  let state = enterHandoff(legalM02ExitState());
  state = await engine.choose(state, "confirm_rank_d_active");
  assert.equal(state.world.flags.steven_met, undefined);
  assert.equal(state.world.flags.friend_beat_03_complete, undefined);
  assert.equal(state.world.flags.friend_beat_03_friend_id, undefined);
  assert.equal(state.world.flags.ferrox_incident_started, undefined);
  assert.equal(state.world.flags.ferrox_rescue_state, undefined);
  assert.equal(state.world.flags.regional_cup_registered, undefined);
  assert.equal(state.world.flags.m3_complete, undefined);
  assert.equal(state.competition.rank, "D", "rank must remain D — no auto-promotion");
  assert.equal(state.competition.trials.RANK_D_TO_C, undefined, "D→C trial must not be registered");
  assert.equal(state.events.A3_FRIEND_CALL, undefined);
  assert.equal(state.events.A3_CROSSROADS, undefined);
  assert.equal(state.events.A3_REGIONAL_CUP, undefined);
  assert.equal(state.events.A3_RANK_TRIAL_D_C, undefined);
});

test("M3_00 entry does not heal, reset or modify the player team or resources", async () => {
  const { engine } = await makeEngine();
  let state = legalM02ExitState();
  state.player.roster.push({
    speciesId: "zorua",
    name: "Zorua",
    level: 5,
    hp: { current: 8, max: 24 },
    statuses: ["bruised"]
  });
  state.player.money = 420;
  const rosterBefore = structuredClone(state.player.roster);
  const moneyBefore = state.player.money;

  enterHandoff(state);
  state = await engine.choose(state, "confirm_rank_d_active");

  assert.equal(state.player.roster.length, rosterBefore.length);
  assert.deepEqual(state.player.roster[1].hp, rosterBefore[1].hp);
  assert.deepEqual(state.player.roster[1].statuses, rosterBefore[1].statuses);
  assert.equal(state.player.money, moneyBefore, "money must not change");
});

// ─── M2 CALLBACK PRESERVATION ─────────────────────────────────────────────────

test("M3_00 entry preserves full M01/M02 history and callbacks", async () => {
  const { engine } = await makeEngine();
  let state = legalM02ExitState();
  state.world.flags.houndour_ginestre_disposition = "captured";
  state.world.flags.blue_m1_result = "win";
  state.world.flags.first_official_result = "win";
  state.world.flags.ranger_elio_relationship = "trusted";
  state.world.flags.poaching_network_state = "resolved";
  state.world.flags.rookie_invitational_result = "second";
  state.world.flags.m1_trial_attempts = 2;
  state.competition.history = [
    { matchId: "first_official_001", outcome: "win" },
    { matchId: "rank_f_to_e_001", outcome: "win" },
    { matchId: "rookie_invitational_sf", outcome: "win" },
    { matchId: "rookie_invitational_final", outcome: "lose" },
    { matchId: "rank_e_to_d_001", outcome: "win" }
  ];
  state.player.money = 920;
  state.player.roster.push({ speciesId: "houndour", name: "Houndour", level: 6 });

  const snapshot = {
    rank: state.competition.rank,
    history: state.competition.history.length,
    houndour: state.world.flags.houndour_ginestre_disposition,
    blueResult: state.world.flags.blue_m1_result,
    firstOfficial: state.world.flags.first_official_result,
    elio: state.world.flags.ranger_elio_relationship,
    networkState: state.world.flags.poaching_network_state,
    rookieResult: state.world.flags.rookie_invitational_result,
    trialAttempts: state.world.flags.m1_trial_attempts,
    money: state.player.money,
    rosterLen: state.player.roster.length,
    friendBeat01: state.world.flags.friend_beat_01_friend_id,
    friendBeat02: state.world.flags.friend_beat_02_friend_id,
    day: state.world.day,
    elapsed: state.world.elapsedMinutes
  };

  enterHandoff(state);
  state = await engine.choose(state, "confirm_rank_d_active");

  assert.equal(state.competition.rank, snapshot.rank);
  assert.equal(state.competition.history.length, snapshot.history);
  assert.equal(state.world.flags.houndour_ginestre_disposition, snapshot.houndour);
  assert.equal(state.world.flags.blue_m1_result, snapshot.blueResult);
  assert.equal(state.world.flags.first_official_result, snapshot.firstOfficial);
  assert.equal(state.world.flags.ranger_elio_relationship, snapshot.elio);
  assert.equal(state.world.flags.poaching_network_state, snapshot.networkState);
  assert.equal(state.world.flags.rookie_invitational_result, snapshot.rookieResult);
  assert.equal(state.world.flags.m1_trial_attempts, snapshot.trialAttempts);
  assert.equal(state.player.money, snapshot.money);
  assert.equal(state.player.roster.length, snapshot.rosterLen);
  assert.equal(state.world.flags.friend_beat_01_friend_id, snapshot.friendBeat01);
  assert.equal(state.world.flags.friend_beat_02_friend_id, snapshot.friendBeat02);
  assert.equal(state.world.day, snapshot.day);
  assert.equal(state.world.elapsedMinutes, snapshot.elapsed);
});

// ─── NAVIGATION OUT ───────────────────────────────────────────────────────────

test("M3_00 back_to_valedarsena_d navigates to m01-valedarsena-first-arrival#city_hub", async () => {
  const { engine } = await makeEngine();
  let state = enterHandoff(legalM02ExitState());
  state = await engine.choose(state, "confirm_rank_d_active");
  state = await engine.choose(state, "back_to_valedarsena_d");
  assert.equal(state.story.sceneId, "m01-valedarsena-first-arrival");
  assert.equal(state.story.nodeId, "city_hub");
  assert.equal(state.world.locationId, "valedarsena_city");
});

test("M3_00 back_to_borgo_d navigates to m02-borgo-salice#borough_hub", async () => {
  const { engine } = await makeEngine();
  let state = enterHandoff(legalM02ExitState());
  state = await engine.choose(state, "confirm_rank_d_active");
  state = await engine.choose(state, "back_to_borgo_d");
  assert.equal(state.story.sceneId, "m02-borgo-salice");
  assert.equal(state.story.nodeId, "borough_hub");
  assert.equal(state.world.locationId, "borgo_salice");
});

test("M3_00 review_m2_summary navigates to m2_summary and back", async () => {
  const { engine } = await makeEngine();
  let state = enterHandoff(legalM02ExitState());
  state = await engine.choose(state, "confirm_rank_d_active");
  state = await engine.choose(state, "review_m2_summary");
  assert.equal(state.story.nodeId, "m2_summary");
  state = await engine.choose(state, "back_to_access_band");
  assert.equal(state.story.nodeId, "access_band_open");
});

// ─── SAVE / RELOAD ────────────────────────────────────────────────────────────

test("M3_00 handoff state survives save/reload identically", async () => {
  let tmpDir;
  try {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "m3-handoff-save-"));
    const store = new SaveStore(tmpDir);
    const { engine } = await makeEngine();

    let state = legalM02ExitState();
    state.player.money = 540;
    state.player.roster.push({ speciesId: "houndour", name: "Houndour", level: 5 });
    enterHandoff(state);
    state = await engine.choose(state, "confirm_rank_d_active");

    state.slot = "slot1";
    await store.save(state);
    const loaded = await store.load("slot1");
    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.m3_active, true);
    assert.equal(loaded.world.flags.m2_complete, true);
    assert.equal(loaded.world.flags.m03_unlocked, true);
    assert.equal(loaded.competition.rank, "D");
    assert.equal(loaded.player.money, 540);
    assert.equal(loaded.player.roster.length, 2);
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  }
});

// ─── CROSS-MODULE ENTRY FROM M2_14 ────────────────────────────────────────────

test("M3_00 full cross-module entry: M2_14 go_to_m03 lands here", async () => {
  const { engine } = await makeEngine();
  let state = legalM02ExitState();
  state.story.sceneId = "m02-trial-result";
  state.story.nodeId = "m2_exit_confirmed";
  state.world.locationId = "borgo_salice_arena";

  state = await engine.choose(state, "go_to_m03");
  assert.equal(state.story.sceneId, "m03-handoff");
  assert.equal(state.story.nodeId, "m03_entry");
  assert.equal(state.world.locationId, "m03_entry_point");

  state = await engine.choose(state, "confirm_rank_d_active");
  assert.equal(state.world.flags.m3_active, true);
  assert.equal(state.story.nodeId, "access_band_open");
});
