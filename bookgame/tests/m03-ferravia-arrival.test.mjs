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
const fixedNow = () => "2026-10-05T13:00:00.000Z";

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

function enterFerravia(state) {
  state.story.sceneId = "m03-ferravia-arrival";
  state.story.nodeId = "station_approach";
  state.world.locationId = "fer_city_station";
  return state;
}

// ─── COMPILATION / NODE PRESENCE ──────────────────────────────────────────────

test("M3_02 scene compiles and all key nodes exist", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m03-ferravia-arrival"];
  assert.ok(scene, "m03-ferravia-arrival must compile");
  assert.equal(scene.moduleId, "M03");
  assert.equal(scene.entryNodeId, "station_approach");
  for (const nodeId of [
    "station_approach",
    "station_board",
    "city_hub",
    "workshop",
    "workshop_mechanics",
    "workshop_ferrox_rumor",
    "sala_verde",
    "sala_verde_rest_done",
    "arena_lobby",
    "arena_trial_rules",
    "arena_results_board",
    "shop"
  ]) {
    assert.ok(scene.nodes[nodeId], `node ${nodeId} must exist`);
  }
});

// ─── LEGAL ENTRY ──────────────────────────────────────────────────────────────

test("M3_02 legal entry presents station_approach node", async () => {
  const { engine } = await makeEngine();
  const state = enterFerravia(legalM3State());
  const view = await engine.present(state);
  assert.equal(view.sceneId, "m03-ferravia-arrival");
  assert.equal(view.nodeId, "station_approach");
  assert.equal(view.moduleId, "M03");
  assert.ok(view.choices.find((c) => c.id === "enter_city_hub"));
  assert.ok(view.choices.find((c) => c.id === "station_board_check"));
});

test("M3_02 enter_city_hub sets ferravia_discovered and routes to city_hub", async () => {
  const { engine } = await makeEngine();
  let state = enterFerravia(legalM3State());
  state = await engine.choose(state, "enter_city_hub");
  assert.equal(state.story.nodeId, "city_hub");
  assert.equal(state.world.flags.ferravia_discovered, true);
  assert.equal(state.world.locationId, "fer_city");
});

// ─── ILLEGAL ENTRY ────────────────────────────────────────────────────────────

test("M3_02 illegal entry: rank E blocks present()", async () => {
  const { engine } = await makeEngine();
  const state = enterFerravia(legalM3State());
  state.competition.rank = "E";
  await assert.rejects(() => engine.present(state), /Scene conditions are not satisfied/);
});

test("M3_02 illegal entry: m3_active=false blocks present()", async () => {
  const { engine } = await makeEngine();
  const state = enterFerravia(legalM3State());
  state.world.flags.m3_active = false;
  await assert.rejects(() => engine.present(state), /Scene conditions are not satisfied/);
});

// ─── CITY HUB SERVICES ────────────────────────────────────────────────────────

test("M3_02 city_hub exposes workshop, sala_verde, arena and shop", async () => {
  const { engine } = await makeEngine();
  let state = enterFerravia(legalM3State());
  state = await engine.choose(state, "enter_city_hub");
  const view = await engine.present(state);
  for (const choiceId of [
    "hub_workshop",
    "hub_sala_verde",
    "hub_arena",
    "hub_shop",
    "hub_leave_to_cava",
    "hub_leave_to_valedarsena"
  ]) {
    assert.ok(view.choices.find((c) => c.id === choiceId), `choice ${choiceId} must be visible`);
  }
});

// ─── WORKSHOP / FERROX RUMOR ──────────────────────────────────────────────────

test("M3_02 workshop_mechanics branch sets ferravia_safety_principle_noted", async () => {
  const { engine } = await makeEngine();
  let state = enterFerravia(legalM3State());
  state = await engine.choose(state, "enter_city_hub");
  state = await engine.choose(state, "hub_workshop");
  assert.equal(state.story.nodeId, "workshop");
  state = await engine.choose(state, "workshop_ask_mechanics");
  assert.equal(state.story.nodeId, "workshop_mechanics");
  state = await engine.choose(state, "mechanics_back");
  assert.equal(state.story.nodeId, "workshop");
  assert.equal(state.world.flags.ferravia_safety_principle_noted, true);
});

test("M3_02 workshop_ferrox_rumor sets steven_rumor_heard WITHOUT setting steven_met", async () => {
  const { engine } = await makeEngine();
  let state = enterFerravia(legalM3State());
  state = await engine.choose(state, "enter_city_hub");
  state = await engine.choose(state, "hub_workshop");
  state = await engine.choose(state, "workshop_ask_ferrox");
  assert.equal(state.story.nodeId, "workshop_ferrox_rumor");
  state = await engine.choose(state, "rumor_back");
  assert.equal(state.world.flags.steven_rumor_heard, true);
  assert.equal(state.world.flags.steven_met, undefined, "rumor must NOT trigger Steven's actual arrival");
});

// ─── SALA VERDE ───────────────────────────────────────────────────────────────

test("M3_02 sala_verde_rest advances time 60 min and sets ferravia_sala_verde_used", async () => {
  const { engine } = await makeEngine();
  let state = enterFerravia(legalM3State());
  const elapsedBefore = state.world.elapsedMinutes;
  state = await engine.choose(state, "enter_city_hub");
  state = await engine.choose(state, "hub_sala_verde");
  assert.equal(state.story.nodeId, "sala_verde");
  state = await engine.choose(state, "sala_verde_rest");
  assert.equal(state.story.nodeId, "sala_verde_rest_done");
  assert.equal(state.world.flags.ferravia_sala_verde_used, true);
  assert.ok(
    state.world.elapsedMinutes - elapsedBefore >= 60,
    "sala verde rest must advance time at least 60 minutes"
  );
});

// ─── ARENA / TRIAL RULES ──────────────────────────────────────────────────────

test("M3_02 arena_trial_rules sets ferravia_trial_rules_known but does NOT register the D→C trial", async () => {
  const { engine } = await makeEngine();
  let state = enterFerravia(legalM3State());
  state = await engine.choose(state, "enter_city_hub");
  state = await engine.choose(state, "hub_arena");
  assert.equal(state.story.nodeId, "arena_lobby");
  state = await engine.choose(state, "arena_check_rules");
  assert.equal(state.story.nodeId, "arena_trial_rules");
  state = await engine.choose(state, "trial_rules_back");
  assert.equal(state.world.flags.ferravia_trial_rules_known, true);
  assert.equal(state.competition.trials.RANK_D_TO_C, undefined, "D→C trial must not be registered");
});

test("M3_02 arena_results_board sets ferravia_results_board_seen and does not grant victories", async () => {
  const { engine } = await makeEngine();
  let state = enterFerravia(legalM3State());
  const historyBefore = state.competition.history.length;
  state = await engine.choose(state, "enter_city_hub");
  state = await engine.choose(state, "hub_arena");
  state = await engine.choose(state, "arena_read_results");
  assert.equal(state.story.nodeId, "arena_results_board");
  state = await engine.choose(state, "results_board_back");
  assert.equal(state.world.flags.ferravia_results_board_seen, true);
  assert.equal(state.competition.history.length, historyBefore, "no spurious competition history additions");
});

// ─── SHOP ─────────────────────────────────────────────────────────────────────

test("M3_02 shop entry does not auto-purchase or modify money", async () => {
  const { engine } = await makeEngine();
  let state = enterFerravia(legalM3State());
  state.player.money = 500;
  const moneyBefore = state.player.money;
  state = await engine.choose(state, "enter_city_hub");
  state = await engine.choose(state, "hub_shop");
  assert.equal(state.story.nodeId, "shop");
  state = await engine.choose(state, "shop_back");
  assert.equal(state.player.money, moneyBefore, "entering shop must not change money");
});

// ─── NO PREMATURE M3 CONTENT ──────────────────────────────────────────────────

test("M3_02 full tour does not auto-complete Steven/Ferrox/FRIEND_BEAT_03/Cup content", async () => {
  const { engine } = await makeEngine();
  let state = enterFerravia(legalM3State());
  state = await engine.choose(state, "station_board_check");
  state = await engine.choose(state, "board_to_hub");
  state = await engine.choose(state, "hub_workshop");
  state = await engine.choose(state, "workshop_ask_ferrox");
  state = await engine.choose(state, "rumor_back");
  state = await engine.choose(state, "hub_arena");
  state = await engine.choose(state, "arena_check_rules");
  state = await engine.choose(state, "trial_rules_back");
  state = await engine.choose(state, "arena_back");

  assert.equal(state.world.flags.steven_met, undefined, "steven_met must not auto-set");
  assert.equal(state.world.flags.friend_beat_03_complete, undefined);
  assert.equal(state.world.flags.ferrox_incident_started, undefined);
  assert.equal(state.world.flags.ferrox_rescue_state, undefined);
  assert.equal(state.world.flags.regional_cup_registered, undefined);
  assert.equal(state.world.flags.m3_complete, undefined);
  assert.equal(state.competition.rank, "D");
  assert.equal(state.competition.trials.RANK_D_TO_C, undefined);
  assert.equal(state.events.A3_RANK_TRIAL_D_C, undefined);
  assert.equal(state.events.A3_FRIEND_CALL?.status, "resolved");
  assert.equal(state.world.flags.a3_friend_call_available, true);
  assert.equal(state.events.A3_CROSSROADS, undefined);
  assert.equal(state.events.A3_REGIONAL_CUP, undefined);
});

// ─── CROSS-MODULE NAVIGATION ──────────────────────────────────────────────────

test("M3_02 cross-module: Cava Grigia exit_to_ferravia lands on station_approach", async () => {
  const { engine } = await makeEngine();
  let state = legalM3State();
  state.story.sceneId = "m03-cava-grigia";
  state.story.nodeId = "exit_point";
  state.world.locationId = "ast_quarry";
  state = await engine.choose(state, "exit_to_ferravia");
  assert.equal(state.story.sceneId, "m03-ferravia-arrival");
  assert.equal(state.story.nodeId, "station_approach");
  assert.equal(state.world.locationId, "fer_city_station");
});

test("M3_02 hub_leave_to_cava returns to Cava Grigia approach", async () => {
  const { engine } = await makeEngine();
  let state = enterFerravia(legalM3State());
  state = await engine.choose(state, "enter_city_hub");
  state = await engine.choose(state, "hub_leave_to_cava");
  assert.equal(state.story.sceneId, "m03-cava-grigia");
  assert.equal(state.story.nodeId, "approach");
});

test("M3_02 hub_leave_to_valedarsena returns to Valedarsena", async () => {
  const { engine } = await makeEngine();
  let state = enterFerravia(legalM3State());
  state = await engine.choose(state, "enter_city_hub");
  state = await engine.choose(state, "hub_leave_to_valedarsena");
  assert.equal(state.story.sceneId, "m01-valedarsena-first-arrival");
  assert.equal(state.story.nodeId, "city_hub");
  assert.equal(state.world.locationId, "valedarsena_city");
});

// ─── CALLBACK PRESERVATION ────────────────────────────────────────────────────

test("M3_02 preserves M01/M02 state and competition history through the whole scene", async () => {
  const { engine } = await makeEngine();
  let state = legalM3State();
  state.world.flags.houndour_ginestre_disposition = "captured";
  state.world.flags.poaching_network_state = "resolved";
  state.world.flags.rookie_invitational_result = "second";
  state.player.money = 820;
  state.competition.history = [
    { matchId: "first_official_001", outcome: "win" },
    { matchId: "rank_f_to_e_001", outcome: "win" },
    { matchId: "rank_e_to_d_001", outcome: "win" }
  ];
  enterFerravia(state);

  state = await engine.choose(state, "enter_city_hub");
  state = await engine.choose(state, "hub_arena");
  state = await engine.choose(state, "arena_check_rules");
  state = await engine.choose(state, "trial_rules_back");

  assert.equal(state.world.flags.houndour_ginestre_disposition, "captured");
  assert.equal(state.world.flags.poaching_network_state, "resolved");
  assert.equal(state.world.flags.rookie_invitational_result, "second");
  assert.equal(state.world.flags.n_met, true);
  assert.equal(state.world.flags.friend_beat_01_friend_id, "Mattew");
  assert.equal(state.world.flags.friend_beat_02_friend_id, "Daniel");
  assert.equal(state.player.money, 820);
  assert.equal(state.competition.history.length, 3);
});

// ─── SAVE / RELOAD ────────────────────────────────────────────────────────────

test("M3_02 state survives save/reload identically", async () => {
  let tmpDir;
  try {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "m3-ferravia-save-"));
    const store = new SaveStore(tmpDir);
    const { engine } = await makeEngine();

    let state = enterFerravia(legalM3State());
    state = await engine.choose(state, "enter_city_hub");
    state = await engine.choose(state, "hub_workshop");
    state = await engine.choose(state, "workshop_ask_ferrox");
    state = await engine.choose(state, "rumor_back");

    state.slot = "slot1";
    await store.save(state);
    const loaded = await store.load("slot1");
    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.ferravia_discovered, true);
    assert.equal(loaded.world.flags.steven_rumor_heard, true);
    assert.equal(loaded.world.flags.steven_met, undefined);
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  }
});


// ─── MODEL ALIGNMENT PASS ────────────────────────────────────────────────────

test("M3_02 Sala Verde rest advances time but never auto-heals HP, PP or status", async () => {
  const { engine } = await makeEngine();
  let state = enterFerravia(legalM3State());
  state.player.roster = [{
    speciesId: "growlithe",
    name: "Growlithe",
    level: 5,
    hp: { current: 3, max: 20 },
    statuses: ["poisoned"],
    pp: { ember: 1 }
  }];
  state.player.starter = structuredClone(state.player.roster[0]);
  const rosterBefore = structuredClone(state.player.roster);
  state = await engine.choose(state, "enter_city_hub");
  state = await engine.choose(state, "hub_sala_verde");
  state = await engine.choose(state, "sala_verde_rest");
  assert.deepEqual(state.player.roster, rosterBefore);
  assert.equal(state.world.flags.ferravia_sala_verde_used, true);
});

test("M3_02 medical consult is informational and leaves roster unchanged", async () => {
  const { engine } = await makeEngine();
  let state = enterFerravia(legalM3State());
  const rosterBefore = structuredClone(state.player.roster);
  state = await engine.choose(state, "enter_city_hub");
  state = await engine.choose(state, "hub_sala_verde");
  state = await engine.choose(state, "sala_verde_consult");
  assert.equal(state.world.flags.ferravia_medical_consulted, true);
  assert.deepEqual(state.player.roster, rosterBefore);
});

test("M3_02 shop purchase uses persistent money, inventory and finite stock", async () => {
  const { engine } = await makeEngine();
  let state = enterFerravia(legalM3State());
  state.player.money = 500;
  state = await engine.choose(state, "enter_city_hub");
  state = await engine.choose(state, "hub_shop");
  let view = await engine.present(state);
  assert.ok(view.choices.find((c) => c.id === "buy_poke_ball"));
  state = await engine.choose(state, "buy_poke_ball");
  assert.equal(state.player.money, 250);
  assert.ok(state.player.inventory.includes("poke-ball"));
  assert.equal(state.shops.ferravia_trainer_shop.stock["poke-ball"], 5);
});

test("M3_02 shop hides unaffordable purchases instead of allowing credit", async () => {
  const { engine } = await makeEngine();
  let state = enterFerravia(legalM3State());
  state.player.money = 0;
  state = await engine.choose(state, "enter_city_hub");
  state = await engine.choose(state, "hub_shop");
  const view = await engine.present(state);
  assert.equal(view.choices.some((c) => c.id === "buy_poke_ball"), false);
  assert.equal(view.choices.some((c) => c.id === "buy_potion"), false);
  assert.equal(view.choices.some((c) => c.id === "buy_antidote"), false);
});

test("M3_02 deferred Steven contact becomes recoverable from the Ferravia hub", async () => {
  const { engine } = await makeEngine();
  let state = enterFerravia(legalM3State());
  state.world.flags.old_maps_read = true;
  state.world.flags.steven_declined_contact = true;
  state = await engine.choose(state, "enter_city_hub");
  const view = await engine.present(state);
  assert.ok(view.choices.find((c) => c.id === "hub_recontact_steven"));
  state = await engine.choose(state, "hub_recontact_steven");
  assert.equal(state.story.sceneId, "m03-steven-enters");
  assert.equal(state.story.nodeId, "deferred_contact");
});

test("M3_02 re-entry preserves shop stock and prior Ferravia state", async () => {
  const { engine } = await makeEngine();
  let state = enterFerravia(legalM3State());
  state.player.money = 500;
  state = await engine.choose(state, "enter_city_hub");
  state = await engine.choose(state, "hub_shop");
  state = await engine.choose(state, "buy_poke_ball");
  const stockAfter = state.shops.ferravia_trainer_shop.stock["poke-ball"];
  state.story.sceneId = "m03-ferravia-arrival";
  state.story.nodeId = "city_hub";
  state.world.locationId = "fer_city";
  await engine.present(state);
  assert.equal(state.shops.ferravia_trainer_shop.stock["poke-ball"], stockAfter);
  assert.equal(state.world.flags.ferravia_discovered, true);
});
