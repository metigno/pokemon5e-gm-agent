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
const fixedNow = () => "2026-10-05T12:00:00.000Z";

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

// Legal M3 state: completed handoff, m3_active, Rank D
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

function enterCava(state) {
  state.story.sceneId = "m03-cava-grigia";
  state.story.nodeId = "approach";
  state.world.locationId = "ast_quarry";
  return state;
}

// ─── COMPILATION / NODE PRESENCE ──────────────────────────────────────────────

test("M3_01 scene compiles and all key nodes exist", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m03-cava-grigia"];
  assert.ok(scene, "m03-cava-grigia must compile");
  assert.equal(scene.moduleId, "M03");
  assert.equal(scene.entryNodeId, "approach");
  for (const nodeId of [
    "approach",
    "ridge_overview",
    "ridge_insight",
    "ridge_unclear",
    "visitor_perimeter",
    "fauna_viewpoint",
    "fauna_no_encounter",
    "fauna_rolycoly",
    "fauna_nacli",
    "fauna_roggenrola",
    "fauna_drilbur",
    "fauna_diglett",
    "glass_wall",
    "tech_office",
    "tech_geology",
    "tech_fauna",
    "tech_ferravia",
    "exit_point"
  ]) {
    assert.ok(scene.nodes[nodeId], `node ${nodeId} must exist`);
  }
});

// ─── LEGAL ENTRY ──────────────────────────────────────────────────────────────

test("M3_01 legal entry presents approach node", async () => {
  const { engine } = await makeEngine();
  const state = enterCava(legalM3State());
  const view = await engine.present(state);
  assert.equal(view.sceneId, "m03-cava-grigia");
  assert.equal(view.nodeId, "approach");
  assert.equal(view.moduleId, "M03");
  assert.ok(view.choices.find((c) => c.id === "enter_perimeter"));
  assert.ok(view.choices.find((c) => c.id === "observe_from_ridge"));
});

test("M3_01 enter_perimeter sets cava_grigia_discovered and routes to visitor_perimeter", async () => {
  const { engine } = await makeEngine();
  let state = enterCava(legalM3State());
  state = await engine.choose(state, "enter_perimeter");
  assert.equal(state.story.nodeId, "visitor_perimeter");
  assert.equal(state.world.flags.cava_grigia_discovered, true);
  assert.equal(state.world.locationId, "ast_quarry_perimeter");
});

// ─── ILLEGAL ENTRY ────────────────────────────────────────────────────────────

test("M3_01 illegal entry: rank E blocks present()", async () => {
  const { engine } = await makeEngine();
  const state = enterCava(legalM3State());
  state.competition.rank = "E";
  await assert.rejects(() => engine.present(state), /Scene conditions are not satisfied/);
});

test("M3_01 illegal entry: m3_active=false blocks present()", async () => {
  const { engine } = await makeEngine();
  const state = enterCava(legalM3State());
  state.world.flags.m3_active = false;
  await assert.rejects(() => engine.present(state), /Scene conditions are not satisfied/);
});

test("M3_01 illegal entry: m2_complete=false blocks present()", async () => {
  const { engine } = await makeEngine();
  const state = enterCava(legalM3State());
  state.world.flags.m2_complete = false;
  await assert.rejects(() => engine.present(state), /Scene conditions are not satisfied/);
});

// ─── RIDGE OBSERVATION FORK ───────────────────────────────────────────────────

test("M3_01 observe_from_ridge success routes to ridge_insight and sets cava_layout_read", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = enterCava(legalM3State());
  state = await engine.choose(state, "observe_from_ridge");
  assert.equal(state.story.nodeId, "ridge_overview");
  state = await engine.choose(state, "ridge_wis_check");
  assert.equal(state.story.nodeId, "ridge_insight");
  assert.equal(state.world.flags.cava_layout_read, true);
});

test("M3_01 observe_from_ridge failure routes to ridge_unclear and does NOT set cava_layout_read", async () => {
  const { engine } = await makeEngine(new SequenceDice([1]));
  let state = enterCava(legalM3State());
  state = await engine.choose(state, "observe_from_ridge");
  state = await engine.choose(state, "ridge_wis_check");
  assert.equal(state.story.nodeId, "ridge_unclear");
  assert.equal(state.world.flags.cava_layout_read, undefined);
});

// ─── TECH OFFICE INFORMATION LADDER ───────────────────────────────────────────

test("M3_01 tech_office geology branch sets cava_old_maps_mentioned", async () => {
  const { engine } = await makeEngine();
  let state = enterCava(legalM3State());
  state = await engine.choose(state, "enter_perimeter");
  state = await engine.choose(state, "visitor_tech_office");
  assert.equal(state.story.nodeId, "tech_office");
  state = await engine.choose(state, "tech_ask_geology");
  assert.equal(state.story.nodeId, "tech_geology");
  state = await engine.choose(state, "geology_back");
  assert.equal(state.story.nodeId, "tech_office");
  assert.equal(state.world.flags.cava_old_maps_mentioned, true);
});

test("M3_01 tech_office ferravia branch sets ferravia_mentioned", async () => {
  const { engine } = await makeEngine();
  let state = enterCava(legalM3State());
  state = await engine.choose(state, "enter_perimeter");
  state = await engine.choose(state, "visitor_tech_office");
  state = await engine.choose(state, "tech_ask_ferravia");
  assert.equal(state.story.nodeId, "tech_ferravia");
  state = await engine.choose(state, "ferravia_back");
  assert.equal(state.world.flags.ferravia_mentioned, true);
});

test("M3_01 tech_office fauna branch does not set premature content flags", async () => {
  const { engine } = await makeEngine();
  let state = enterCava(legalM3State());
  state = await engine.choose(state, "enter_perimeter");
  state = await engine.choose(state, "visitor_tech_office");
  state = await engine.choose(state, "tech_ask_fauna");
  assert.equal(state.story.nodeId, "tech_fauna");
  state = await engine.choose(state, "fauna_tech_back");
  assert.equal(state.story.nodeId, "tech_office");
});

// ─── GLASS WALL / PRESSURE SIGNAL ─────────────────────────────────────────────

test("M3_01 glass_wall sets cava_production_pressure_noticed on explicit note", async () => {
  const { engine } = await makeEngine();
  let state = enterCava(legalM3State());
  state = await engine.choose(state, "enter_perimeter");
  state = await engine.choose(state, "visitor_glass_wall");
  assert.equal(state.story.nodeId, "glass_wall");
  state = await engine.choose(state, "glass_wall_note_pressure");
  assert.equal(state.story.nodeId, "visitor_perimeter");
  assert.equal(state.world.flags.cava_production_pressure_noticed, true);
});

test("M3_01 glass_wall silent back does NOT set cava_production_pressure_noticed", async () => {
  const { engine } = await makeEngine();
  let state = enterCava(legalM3State());
  state = await engine.choose(state, "enter_perimeter");
  state = await engine.choose(state, "visitor_glass_wall");
  state = await engine.choose(state, "glass_wall_back");
  assert.equal(state.world.flags.cava_production_pressure_noticed, undefined);
});

// ─── FAUNA / ECOLOGY ──────────────────────────────────────────────────────────

test("M3_01 fauna_viewpoint lists only the five allowed quarry species", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m03-cava-grigia"];
  const observeChoice = scene.nodes.fauna_viewpoint.choices.find((c) => c.id === "observe_cava_fauna");
  assert.ok(observeChoice.ecology, "ecology metadata must be present");
  assert.equal(observeChoice.ecology.zoneId, "AST-QUARRY");
  assert.equal(observeChoice.ecology.habitat, "cave");
  assert.equal(observeChoice.ecology.method, "wild_observation");
  const expected = ["rolycoly", "nacli", "roggenrola", "drilbur", "diglett"];
  assert.deepEqual([...observeChoice.ecology.allowedSpecies].sort(), [...expected].sort());
});

test("M3_01 observe_cava_fauna produces a legal encounter result on a quarry species", async () => {
  const { engine } = await makeEngine();
  let state = enterCava(legalM3State());
  state = await engine.choose(state, "enter_perimeter");
  state = await engine.choose(state, "visitor_fauna_zone");
  assert.equal(state.story.nodeId, "fauna_viewpoint");

  state = await engine.choose(state, "observe_cava_fauna");

  const allowed = new Set([
    "fauna_no_encounter",
    "fauna_rolycoly",
    "fauna_nacli",
    "fauna_roggenrola",
    "fauna_drilbur",
    "fauna_diglett"
  ]);
  assert.ok(
    allowed.has(state.story.nodeId),
    `ecology routing must land on a declared return node (got ${state.story.nodeId})`
  );
});

test("M3_01 ecology observation never catches a Pokémon and leaves roster unchanged", async () => {
  const { engine } = await makeEngine();
  let state = enterCava(legalM3State());
  const rosterBefore = structuredClone(state.player.roster);
  state = await engine.choose(state, "enter_perimeter");
  state = await engine.choose(state, "visitor_fauna_zone");
  state = await engine.choose(state, "observe_cava_fauna");
  assert.deepEqual(state.player.roster, rosterBefore, "wild_observation must not modify roster");
});

// ─── NO PREMATURE M3 CONTENT ──────────────────────────────────────────────────

test("M3_01 does not auto-trigger Steven, Ferrox, FRIEND_BEAT_03, Regional Cup or D→C trial", async () => {
  const { engine } = await makeEngine();
  let state = enterCava(legalM3State());
  state = await engine.choose(state, "enter_perimeter");
  state = await engine.choose(state, "visitor_tech_office");
  state = await engine.choose(state, "tech_ask_geology");
  state = await engine.choose(state, "geology_back");
  state = await engine.choose(state, "tech_ask_ferravia");
  state = await engine.choose(state, "ferravia_back");
  state = await engine.choose(state, "tech_office_leave");
  state = await engine.choose(state, "visitor_glass_wall");
  state = await engine.choose(state, "glass_wall_note_pressure");

  assert.equal(state.world.flags.steven_met, undefined);
  assert.equal(state.world.flags.friend_beat_03_complete, undefined);
  assert.equal(state.world.flags.ferrox_incident_started, undefined);
  assert.equal(state.world.flags.ferrox_rescue_state, undefined);
  assert.equal(state.world.flags.regional_cup_registered, undefined);
  assert.equal(state.world.flags.m3_complete, undefined);
  assert.equal(state.competition.rank, "D", "rank must remain D");
  assert.equal(state.competition.trials.RANK_D_TO_C, undefined);
  assert.equal(state.events.A3_FRIEND_CALL, undefined);
  assert.equal(state.events.A3_CROSSROADS, undefined);
  assert.equal(state.events.A3_REGIONAL_CUP, undefined);
  assert.equal(state.events.A3_RANK_TRIAL_D_C, undefined);
});

// ─── EXIT NAVIGATION ──────────────────────────────────────────────────────────

test("M3_01 exit_point back-to-valedarsena navigates correctly", async () => {
  const { engine } = await makeEngine();
  let state = enterCava(legalM3State());
  state = await engine.choose(state, "enter_perimeter");
  state = await engine.choose(state, "leave_quarry");
  assert.equal(state.story.nodeId, "exit_point");
  state = await engine.choose(state, "exit_back_to_valedarsena");
  assert.equal(state.story.sceneId, "m01-valedarsena-first-arrival");
  assert.equal(state.story.nodeId, "city_hub");
  assert.equal(state.world.locationId, "valedarsena_city");
});

test("M3_01 exit_point back-to-handoff navigates correctly", async () => {
  const { engine } = await makeEngine();
  let state = enterCava(legalM3State());
  state = await engine.choose(state, "enter_perimeter");
  state = await engine.choose(state, "leave_quarry");
  state = await engine.choose(state, "exit_back_to_handoff");
  assert.equal(state.story.sceneId, "m03-handoff");
  assert.equal(state.story.nodeId, "access_band_open");
  assert.equal(state.world.locationId, "m03_entry_point");
});

// ─── CROSS-MODULE ENTRY FROM M3_00 ────────────────────────────────────────────

test("M3_01 cross-module: M3_00 orient_toward_cava lands on approach", async () => {
  const { engine } = await makeEngine();
  let state = legalM3State();
  state.story.sceneId = "m03-handoff";
  state.story.nodeId = "access_band_open";
  state.world.locationId = "m03_entry_point";
  state = await engine.choose(state, "orient_toward_cava");
  assert.equal(state.story.sceneId, "m03-cava-grigia");
  assert.equal(state.story.nodeId, "approach");
  assert.equal(state.world.locationId, "ast_quarry");
});

// ─── CALLBACK PRESERVATION ────────────────────────────────────────────────────

test("M3_01 preserves M01/M02 state and competition history through the whole scene", async () => {
  const { engine } = await makeEngine();
  let state = legalM3State();
  state.world.flags.houndour_ginestre_disposition = "captured";
  state.world.flags.blue_m1_result = "win";
  state.world.flags.rookie_invitational_result = "second";
  state.world.flags.poaching_network_state = "resolved";
  state.player.money = 750;
  state.competition.history = [
    { matchId: "first_official_001", outcome: "win" },
    { matchId: "rank_f_to_e_001", outcome: "win" },
    { matchId: "rookie_invitational_sf", outcome: "win" },
    { matchId: "rookie_invitational_final", outcome: "lose" },
    { matchId: "rank_e_to_d_001", outcome: "win" }
  ];
  enterCava(state);

  state = await engine.choose(state, "enter_perimeter");
  state = await engine.choose(state, "visitor_tech_office");
  state = await engine.choose(state, "tech_ask_ferravia");
  state = await engine.choose(state, "ferravia_back");

  assert.equal(state.world.flags.houndour_ginestre_disposition, "captured");
  assert.equal(state.world.flags.blue_m1_result, "win");
  assert.equal(state.world.flags.rookie_invitational_result, "second");
  assert.equal(state.world.flags.poaching_network_state, "resolved");
  assert.equal(state.world.flags.n_met, true);
  assert.equal(state.world.flags.friend_beat_01_friend_id, "Mattew");
  assert.equal(state.world.flags.friend_beat_02_friend_id, "Daniel");
  assert.equal(state.player.money, 750);
  assert.equal(state.competition.history.length, 5);
});

// ─── SAVE / RELOAD ────────────────────────────────────────────────────────────

test("M3_01 state survives save/reload identically", async () => {
  let tmpDir;
  try {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "m3-cava-save-"));
    const store = new SaveStore(tmpDir);
    const { engine } = await makeEngine();

    let state = enterCava(legalM3State());
    state = await engine.choose(state, "enter_perimeter");
    state = await engine.choose(state, "visitor_glass_wall");
    state = await engine.choose(state, "glass_wall_note_pressure");

    state.slot = "slot1";
    await store.save(state);
    const loaded = await store.load("slot1");
    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.cava_grigia_discovered, true);
    assert.equal(loaded.world.flags.cava_production_pressure_noticed, true);
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  }
});
