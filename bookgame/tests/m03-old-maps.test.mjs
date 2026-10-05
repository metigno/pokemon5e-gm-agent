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
import { SequenceDice } from "../src/engine/dice.mjs";

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../content/modules/", import.meta.url));
const ecologyProfilesDir = fileURLToPath(new URL("../content/ecology/", import.meta.url));
const zonePoolsFile = fileURLToPath(new URL("../../campaign/world/ecology/ZONE_POOLS.json", import.meta.url));
const distributionFile = fileURLToPath(new URL("../../campaign/world/ecology/SPECIES_DISTRIBUTION.json", import.meta.url));
const faunaIndexFile = fileURLToPath(new URL("../../campaign/world/fauna/ASTERIA_FAUNA_INDEX.json", import.meta.url));
const ecologyOptions = { profilesDir: ecologyProfilesDir, zonePoolsFile, distributionFile, faunaIndexFile };
const fixedNow = () => "2026-10-05T14:00:00.000Z";

async function makeEngine(dice = new SequenceDice([1])) {
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
  return { engine: new BookgameEngine({ scenes, dice, now: fixedNow }), bundle };
}

function legalM3State(protagonist = "Luke") {
  const state = createNewGameState({ protagonist, now: fixedNow });
  state.competition.rank = "D";
  state.competition.rankOrder = 2;
  state.world.flags.m1_complete = true;
  state.world.flags.m02_unlocked = true;
  state.world.flags.m2_active = true;
  state.world.flags.m2_complete = true;
  state.world.flags.m03_unlocked = true;
  state.world.flags.m3_active = true;
  state.world.flags.ferravia_discovered = true;
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

function enterArchive(state) {
  state.story.sceneId = "m03-old-maps";
  state.story.nodeId = "archive_entry";
  state.world.locationId = "fer_city_archive";
  return state;
}

// ─── COMPILATION / NODE PRESENCE ──────────────────────────────────────────────

test("M3_03 scene compiles and all key nodes exist", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m03-old-maps"];
  assert.ok(scene, "m03-old-maps must compile");
  assert.equal(scene.moduleId, "M03");
  assert.equal(scene.entryNodeId, "archive_entry");
  for (const nodeId of [
    "archive_entry",
    "archivist_quarry",
    "archivist_tunnels",
    "historical_map_review",
    "hist_map_insight",
    "hist_map_partial",
    "open_shelf",
    "survey_report"
  ]) {
    assert.ok(scene.nodes[nodeId], `node ${nodeId} must exist`);
  }
});

// ─── LEGAL ENTRY ──────────────────────────────────────────────────────────────

test("M3_03 legal entry presents archive_entry node", async () => {
  const { engine } = await makeEngine();
  const state = enterArchive(legalM3State());
  const view = await engine.present(state);
  assert.equal(view.sceneId, "m03-old-maps");
  assert.equal(view.nodeId, "archive_entry");
  for (const choiceId of [
    "ask_archivist_quarry",
    "ask_archivist_tunnels",
    "browse_open_shelf",
    "archive_leave"
  ]) {
    assert.ok(view.choices.find((c) => c.id === choiceId), `choice ${choiceId} must be visible`);
  }
});

// ─── ILLEGAL ENTRY ────────────────────────────────────────────────────────────

test("M3_03 illegal entry: rank E blocks present()", async () => {
  const { engine } = await makeEngine();
  const state = enterArchive(legalM3State());
  state.competition.rank = "E";
  await assert.rejects(() => engine.present(state), /Scene conditions are not satisfied/);
});

test("M3_03 illegal entry: ferravia_discovered=false blocks present()", async () => {
  const { engine } = await makeEngine();
  const state = enterArchive(legalM3State());
  state.world.flags.ferravia_discovered = false;
  await assert.rejects(() => engine.present(state), /Scene conditions are not satisfied/);
});

test("M3_03 illegal entry: m3_active=false blocks present()", async () => {
  const { engine } = await makeEngine();
  const state = enterArchive(legalM3State());
  state.world.flags.m3_active = false;
  await assert.rejects(() => engine.present(state), /Scene conditions are not satisfied/);
});

// ─── QUARRY MAP BRANCH ────────────────────────────────────────────────────────

test("M3_03 ask_archivist_quarry sets quarry_old_maps_read", async () => {
  const { engine } = await makeEngine();
  let state = enterArchive(legalM3State());
  state = await engine.choose(state, "ask_archivist_quarry");
  assert.equal(state.story.nodeId, "archivist_quarry");
  state = await engine.choose(state, "quarry_note_overlap");
  assert.equal(state.story.nodeId, "archive_entry");
  assert.equal(state.world.flags.quarry_old_maps_read, true);
});

// ─── TUNNELS HISTORICAL MAP BRANCH ────────────────────────────────────────────

test("M3_03 ask_archivist_tunnels + close WITHOUT review sets tunnels_history_mentioned only", async () => {
  const { engine } = await makeEngine();
  let state = enterArchive(legalM3State());
  state = await engine.choose(state, "ask_archivist_tunnels");
  assert.equal(state.story.nodeId, "archivist_tunnels");
  state = await engine.choose(state, "tunnels_back_to_entry");
  assert.equal(state.world.flags.tunnels_history_mentioned, true);
  assert.equal(state.world.flags.old_maps_read, undefined);
});

test("M3_03 historical_map_review success sets old_maps_read + tunnels_history_mentioned", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = enterArchive(legalM3State());
  state = await engine.choose(state, "ask_archivist_tunnels");
  state = await engine.choose(state, "tunnels_ask_old");
  assert.equal(state.story.nodeId, "historical_map_review");
  state = await engine.choose(state, "hist_map_investigate");
  assert.equal(state.story.nodeId, "hist_map_insight");
  assert.equal(state.world.flags.old_maps_read, true);
  assert.equal(state.world.flags.tunnels_history_mentioned, true);
});

test("M3_03 historical_map_review failure sets only tunnels_history_mentioned", async () => {
  const { engine } = await makeEngine(new SequenceDice([1]));
  let state = enterArchive(legalM3State());
  state = await engine.choose(state, "ask_archivist_tunnels");
  state = await engine.choose(state, "tunnels_ask_old");
  state = await engine.choose(state, "hist_map_investigate");
  assert.equal(state.story.nodeId, "hist_map_partial");
  assert.equal(state.world.flags.old_maps_read, undefined);
  assert.equal(state.world.flags.tunnels_history_mentioned, true);
});

test("M3_03 historical_map_review close (no investigate) sets only tunnels_history_mentioned", async () => {
  const { engine } = await makeEngine();
  let state = enterArchive(legalM3State());
  state = await engine.choose(state, "ask_archivist_tunnels");
  state = await engine.choose(state, "tunnels_ask_old");
  state = await engine.choose(state, "hist_map_close");
  assert.equal(state.story.nodeId, "archive_entry");
  assert.equal(state.world.flags.old_maps_read, undefined);
  assert.equal(state.world.flags.tunnels_history_mentioned, true);
});

// ─── OPEN SHELF / SURVEY REPORT ───────────────────────────────────────────────

test("M3_03 browse_open_shelf + read report sets ferrox_survey_report_read", async () => {
  const { engine } = await makeEngine();
  let state = enterArchive(legalM3State());
  state = await engine.choose(state, "browse_open_shelf");
  assert.equal(state.story.nodeId, "open_shelf");
  state = await engine.choose(state, "shelf_read_report");
  assert.equal(state.story.nodeId, "survey_report");
  state = await engine.choose(state, "report_back");
  assert.equal(state.world.flags.ferrox_survey_report_read, true);
  assert.equal(state.story.nodeId, "open_shelf");
});

test("M3_03 browse_open_shelf without reading report does NOT set ferrox_survey_report_read", async () => {
  const { engine } = await makeEngine();
  let state = enterArchive(legalM3State());
  state = await engine.choose(state, "browse_open_shelf");
  state = await engine.choose(state, "shelf_back");
  assert.equal(state.story.nodeId, "archive_entry");
  assert.equal(state.world.flags.ferrox_survey_report_read, undefined);
});

// ─── NO PREMATURE M3 CONTENT ──────────────────────────────────────────────────

test("M3_03 full archive investigation does NOT trigger Steven arrival, Ferrox incident or Trial", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = enterArchive(legalM3State());
  state = await engine.choose(state, "ask_archivist_quarry");
  state = await engine.choose(state, "quarry_note_overlap");
  state = await engine.choose(state, "ask_archivist_tunnels");
  state = await engine.choose(state, "tunnels_ask_old");
  state = await engine.choose(state, "hist_map_investigate");
  state = await engine.choose(state, "insight_back");
  state = await engine.choose(state, "browse_open_shelf");
  state = await engine.choose(state, "shelf_read_report");
  state = await engine.choose(state, "report_back");

  assert.equal(state.world.flags.steven_met, undefined);
  assert.equal(state.world.flags.friend_beat_03_complete, undefined);
  assert.equal(state.world.flags.ferrox_incident_started, undefined);
  assert.equal(state.world.flags.ferrox_rescue_state, undefined);
  assert.equal(state.world.flags.regional_cup_registered, undefined);
  assert.equal(state.competition.rank, "D");
  assert.equal(state.competition.trials.RANK_D_TO_C, undefined);
  assert.equal(state.events.A3_FRIEND_CALL, undefined);
  assert.equal(state.events.A3_CROSSROADS, undefined);
  assert.equal(state.events.A3_REGIONAL_CUP, undefined);
  assert.equal(state.events.A3_RANK_TRIAL_D_C, undefined);
});

// ─── CROSS-MODULE ENTRY ───────────────────────────────────────────────────────

test("M3_03 cross-module: Ferravia hub_archive navigates to archive_entry", async () => {
  const { engine } = await makeEngine();
  let state = legalM3State();
  state.story.sceneId = "m03-ferravia-arrival";
  state.story.nodeId = "city_hub";
  state.world.locationId = "fer_city";
  state = await engine.choose(state, "hub_archive");
  assert.equal(state.story.sceneId, "m03-old-maps");
  assert.equal(state.story.nodeId, "archive_entry");
  assert.equal(state.world.locationId, "fer_city_archive");
});

test("M3_03 archive_leave returns to Ferravia city_hub", async () => {
  const { engine } = await makeEngine();
  let state = enterArchive(legalM3State());
  state = await engine.choose(state, "archive_leave");
  assert.equal(state.story.sceneId, "m03-ferravia-arrival");
  assert.equal(state.story.nodeId, "city_hub");
  assert.equal(state.world.locationId, "fer_city");
});

// ─── CALLBACK PRESERVATION ────────────────────────────────────────────────────

test("M3_03 preserves M01/M02 state and competition history through the whole scene", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = legalM3State();
  state.world.flags.houndour_ginestre_disposition = "captured";
  state.world.flags.poaching_network_state = "resolved";
  state.world.flags.rookie_invitational_result = "second";
  state.player.money = 600;
  state.competition.history = [
    { matchId: "first_official_001", outcome: "win" },
    { matchId: "rank_e_to_d_001", outcome: "win" }
  ];
  enterArchive(state);

  state = await engine.choose(state, "ask_archivist_tunnels");
  state = await engine.choose(state, "tunnels_ask_old");
  state = await engine.choose(state, "hist_map_investigate");

  assert.equal(state.world.flags.houndour_ginestre_disposition, "captured");
  assert.equal(state.world.flags.poaching_network_state, "resolved");
  assert.equal(state.world.flags.n_met, true);
  assert.equal(state.world.flags.friend_beat_01_friend_id, "Mattew");
  assert.equal(state.world.flags.friend_beat_02_friend_id, "Daniel");
  assert.equal(state.world.flags.rookie_invitational_result, "second");
  assert.equal(state.player.money, 600);
  assert.equal(state.competition.history.length, 2);
});

// ─── SAVE / RELOAD ────────────────────────────────────────────────────────────

test("M3_03 state survives save/reload identically", async () => {
  let tmpDir;
  try {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "m3-oldmaps-save-"));
    const store = new SaveStore(tmpDir);
    const { engine } = await makeEngine(new SequenceDice([20]));

    let state = enterArchive(legalM3State());
    state = await engine.choose(state, "ask_archivist_tunnels");
    state = await engine.choose(state, "tunnels_ask_old");
    state = await engine.choose(state, "hist_map_investigate");

    state.slot = "slot1";
    await store.save(state);
    const loaded = await store.load("slot1");
    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.old_maps_read, true);
    assert.equal(loaded.world.flags.tunnels_history_mentioned, true);
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  }
});


// ─── MODEL ALIGNMENT PASS ────────────────────────────────────────────────────

test("M3_03 quarry cross-check success creates a durable evidence link", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = enterArchive(legalM3State());
  state.world.flags.cava_old_maps_mentioned = true;
  const view = await engine.present(state);
  assert.ok(view.choices.find((c) => c.id === "compare_quarry_material"));
  state = await engine.choose(state, "compare_quarry_material");
  state = await engine.choose(state, "quarry_crosscheck_investigate");
  assert.equal(state.story.nodeId, "quarry_crosscheck_clear");
  assert.equal(state.world.flags.archive_quarry_crosscheck, true);
});

test("M3_03 workshop safety knowledge unlocks a real archive cross-check", async () => {
  const { engine } = await makeEngine();
  let state = enterArchive(legalM3State());
  state.world.flags.ferravia_safety_principle_noted = true;
  state = await engine.choose(state, "browse_open_shelf");
  const view = await engine.present(state);
  assert.ok(view.choices.find((c) => c.id === "shelf_crosscheck_safety"));
  state = await engine.choose(state, "shelf_crosscheck_safety");
  state = await engine.choose(state, "record_safety_gap");
  assert.equal(state.world.flags.ferrox_safety_gap_noted, true);
});

test("M3_03 re-entry preserves investigation evidence and does not duplicate it", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = enterArchive(legalM3State());
  state = await engine.choose(state, "ask_archivist_tunnels");
  state = await engine.choose(state, "tunnels_ask_old");
  state = await engine.choose(state, "hist_map_investigate");
  assert.equal(state.world.flags.old_maps_read, true);
  state.story.sceneId = "m03-old-maps";
  state.story.nodeId = "archive_entry";
  state.world.locationId = "fer_city_archive";
  const view = await engine.present(state);
  assert.equal(view.nodeId, "archive_entry");
  assert.equal(state.world.flags.old_maps_read, true);
  assert.equal(state.world.flags.tunnels_history_mentioned, true);
});
