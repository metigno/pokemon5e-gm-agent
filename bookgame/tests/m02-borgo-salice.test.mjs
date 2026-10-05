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
const fixedNow = () => "2026-10-05T11:30:00.000Z";

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

function legalM2State(protagonist = "Luke") {
  const state = createNewGameState({ protagonist, now: fixedNow });
  state.competition.rank = "E";
  state.competition.rankOrder = 1;
  state.world.flags.m1_complete = true;
  state.world.flags.m02_unlocked = true;
  state.world.flags.m2_active = true;
  state.world.flags.blue_met = true;
  state.world.flags.friend_beat_01_complete = true;
  state.world.flags.friends_split = true;
  state.world.locationId = "valedarsena_city";
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "city_hub";
  return state;
}

function legalBorgoState(protagonist = "Luke") {
  const state = legalM2State(protagonist);
  state.world.flags.mistwood_discovered = true;
  state.world.flags.mistwood_entry_complete = true;
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";
  return state;
}

test("M2_03 scene compiles and borough_hub node is present", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-borgo-salice"];
  assert.ok(scene, "m02-borgo-salice must compile");
  assert.ok(scene.nodes["borough_hub"], "borough_hub must exist");
  assert.equal(scene.moduleId, "M02");
  assert.equal(scene.locationId, "borgo_salice");
});

test("M2_03 shop compiles with borgo_salice_shop definition", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-borgo-salice"];
  assert.ok(scene.shops?.borgo_salice_shop);
  assert.ok(scene.shops.borgo_salice_shop.stock["poke-ball"] > 0);
  assert.ok(scene.shops.borgo_salice_shop.stock["potion"] > 0);
  assert.ok(scene.shops.borgo_salice_shop.stock["antidote"] > 0);
});

test("M2_03 scene entry rejects missing M2 gate conditions", async () => {
  const { engine } = await makeEngine();

  const legal = legalBorgoState();
  const view = await engine.present(legal);
  assert.ok(view, "legal state must present without error");

  for (const mutate of [
    (s) => { s.world.flags.m1_complete = false; },
    (s) => { s.world.flags.m02_unlocked = false; },
    (s) => { s.world.flags.m2_active = false; },
    (s) => { s.competition.rank = "F"; s.competition.rankOrder = 0; }
  ]) {
    const state = legalBorgoState();
    mutate(state);
    await assert.rejects(
      () => engine.present(state),
      /Scene conditions are not satisfied/
    );
  }
});

test("M2_03 choose() rejects illegal state", async () => {
  const { engine } = await makeEngine();
  const state = legalBorgoState();
  state.world.flags.m2_active = false;
  await assert.rejects(
    () => engine.choose(state, "ranger_post"),
    /Scene conditions are not satisfied/
  );
});

test("M2_03 navigation from M2_01 inner_path head_to_salice costs 210 min and enters borough_hub", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();

  state = await engine.choose(state, "mistwood");
  state = await engine.choose(state, "enter_wood");
  state = await engine.choose(state, "press_deeper");
  assert.equal(state.story.nodeId, "inner_path");
  const before = state.world.elapsedMinutes;

  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "head_to_salice"), "head_to_salice must be visible");

  state = await engine.choose(state, "head_to_salice");

  assert.equal(state.story.sceneId, "m02-borgo-salice");
  assert.equal(state.story.nodeId, "borough_hub");
  assert.equal(state.world.locationId, "borgo_salice");
  assert.equal(state.world.elapsedMinutes, before + 210);
});

test("M2_03 navigation from M2_02 inner_exit continue_to_salice reaches borough_hub", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.world.flags.mistwood_entry_complete = true;
  state.story.sceneId = "m02-capture-signs";
  state.story.nodeId = "inner_exit";
  state.world.locationId = "asteria_mistwood";
  const before = state.world.elapsedMinutes;

  state = await engine.choose(state, "continue_to_salice");

  assert.equal(state.story.sceneId, "m02-borgo-salice");
  assert.equal(state.story.nodeId, "borough_hub");
  assert.equal(state.world.locationId, "borgo_salice");
  assert.equal(state.world.elapsedMinutes, before + 210);
});

test("M2_03 ranger_post shows approach_ranger_new when Elio not yet registered", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();

  state = await engine.choose(state, "ranger_post");
  assert.equal(state.story.nodeId, "ranger_post");

  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "approach_ranger_new"), "approach_ranger_new must be visible");
  assert.equal(view.choices.some((c) => c.id === "approach_ranger_returning"), false);
});

test("M2_03 approach_ranger_new registers ElioMar as persistent NPC", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();

  state = await engine.choose(state, "ranger_post");
  assert.equal(state.npcs?.ElioMar, undefined);

  state = await engine.choose(state, "approach_ranger_new");

  assert.ok(state.npcs?.ElioMar, "ElioMar must be registered");
  assert.equal(state.npcs.ElioMar.state.role, "ranger");
  assert.equal(state.story.nodeId, "ranger_new_meeting");
});

test("M2_03 ranger_post shows approach_ranger_returning when Elio already registered from M1", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();
  state.npcs = state.npcs ?? {};
  state.npcs.ElioMar = {
    id: "ElioMar",
    name: "Ranger Elio Mar",
    relationship: { score: 5, qualitative: "friendly" },
    state: { role: "ranger" },
    schedule: null
  };

  state = await engine.choose(state, "ranger_post");
  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "approach_ranger_returning"), "approach_ranger_returning must be visible");
  assert.equal(view.choices.some((c) => c.id === "approach_ranger_new"), false);
});

test("M2_03 mention_forest_signs choice is hidden without capture_signs_noticed", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();

  state = await engine.choose(state, "ranger_post");
  state = await engine.choose(state, "approach_ranger_new");

  const view = await engine.present(state);
  assert.equal(
    view.choices.some((c) => c.id === "mention_forest_signs_new"),
    false,
    "mention_forest_signs_new must be hidden without capture_signs_noticed"
  );
});

test("M2_03 mention_forest_signs choice is visible with capture_signs_noticed=true", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();
  state.world.flags.capture_signs_noticed = true;

  state = await engine.choose(state, "ranger_post");
  state = await engine.choose(state, "approach_ranger_new");

  const view = await engine.present(state);
  assert.ok(
    view.choices.some((c) => c.id === "mention_forest_signs_new"),
    "mention_forest_signs_new must be visible with capture_signs_noticed"
  );
});

test("M2_03 sharing signs sets capture_ranger_told and routes to ranger_signs_shared", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();
  state.world.flags.capture_signs_noticed = true;

  state = await engine.choose(state, "ranger_post");
  state = await engine.choose(state, "approach_ranger_new");
  state = await engine.choose(state, "mention_forest_signs_new");

  assert.equal(state.story.nodeId, "ranger_signs_shared");
  assert.equal(state.world.flags.capture_ranger_told, true);
});

test("M2_03 show_evidence_ranger is hidden without capture_evidence_held", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();
  state.world.flags.capture_signs_noticed = true;

  state = await engine.choose(state, "ranger_post");
  state = await engine.choose(state, "approach_ranger_new");
  state = await engine.choose(state, "mention_forest_signs_new");

  const view = await engine.present(state);
  assert.equal(
    view.choices.some((c) => c.id === "show_evidence_ranger"),
    false,
    "show_evidence_ranger must be hidden without evidence"
  );
});

test("M2_03 show_evidence_ranger is visible with capture_evidence_held", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();
  state.world.flags.capture_signs_noticed = true;
  state.world.flags.capture_evidence_held = true;

  state = await engine.choose(state, "ranger_post");
  state = await engine.choose(state, "approach_ranger_new");
  state = await engine.choose(state, "mention_forest_signs_new");

  const view = await engine.present(state);
  assert.ok(
    view.choices.some((c) => c.id === "show_evidence_ranger"),
    "show_evidence_ranger must be visible with evidence"
  );
});

test("M2_03 full ranger report path sets capture_report_given", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();
  state.world.flags.capture_signs_noticed = true;
  state.world.flags.capture_evidence_held = true;

  state = await engine.choose(state, "ranger_post");
  state = await engine.choose(state, "approach_ranger_new");
  state = await engine.choose(state, "mention_forest_signs_new");
  state = await engine.choose(state, "show_evidence_ranger");

  assert.equal(state.story.nodeId, "ranger_evidence_received");
  assert.equal(state.world.flags.capture_report_given, true);
  assert.equal(state.world.flags.capture_ranger_told, true);
});

test("M2_03 sala_verde shows requirements without registering E→D trial", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();

  state = await engine.choose(state, "sala_verde");
  assert.equal(state.story.nodeId, "sala_verde");

  state = await engine.choose(state, "check_trial_requirements");
  assert.equal(state.story.nodeId, "sala_verde_reqs");

  assert.equal(state.competition.trials?.RANK_E_TO_D, undefined);
});

test("M2_03 shop purchase deducts money and adjusts stock", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();
  state.player.money = 1000;

  state = await engine.choose(state, "town_shop");
  state = await engine.choose(state, "buy_potion");

  assert.equal(state.player.money, 800);
  assert.equal(state.story.nodeId, "shop");
});

test("M2_03 buy_pokeball is hidden when stock is depleted", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();
  state.player.money = 5000;

  state = await engine.choose(state, "town_shop");

  state.shops = state.shops ?? {};
  state.shops["borgo_salice_shop"] = state.shops["borgo_salice_shop"] ?? {};
  state.shops["borgo_salice_shop"].stock = { "poke-ball": 0, "potion": 3, "antidote": 4 };

  const view = await engine.present(state);
  assert.equal(
    view.choices.some((c) => c.id === "buy_pokeball"),
    false,
    "buy_pokeball must be hidden when stock is 0"
  );
});

test("M2_03 rumors connect_rumors_to_signs is hidden without capture_signs_noticed", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();

  state = await engine.choose(state, "ask_rumors");
  state = await engine.choose(state, "ask_more_rumors");

  const view = await engine.present(state);
  assert.equal(
    view.choices.some((c) => c.id === "connect_rumors_to_signs"),
    false,
    "connect_rumors must be hidden without investigation"
  );
});

test("M2_03 rumors connect_rumors_to_signs sets capture_rumors_connected", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();
  state.world.flags.capture_signs_noticed = true;

  state = await engine.choose(state, "ask_rumors");
  state = await engine.choose(state, "ask_more_rumors");
  state = await engine.choose(state, "connect_rumors_to_signs");

  assert.equal(state.story.nodeId, "rumors_connected");
  assert.equal(state.world.flags.capture_rumors_connected, true);
});

test("M2_03 no premature M2 content triggered by any Borgo path", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();
  state.world.flags.capture_signs_noticed = true;
  state.world.flags.capture_evidence_held = true;

  state = await engine.choose(state, "ranger_post");
  state = await engine.choose(state, "approach_ranger_new");
  state = await engine.choose(state, "mention_forest_signs_new");
  state = await engine.choose(state, "show_evidence_ranger");
  state = await engine.choose(state, "back_from_evidence");

  assert.equal(state.competition.rank, "E");
  assert.equal(state.world.flags.n_met, undefined);
  assert.equal(state.world.flags.friend_beat_02_complete, undefined);
  assert.equal(state.world.flags.poaching_network_state, undefined);
  assert.equal(state.competition.trials?.RANK_E_TO_D, undefined);
});

test("M2_03 back_to_mistwood costs 210 min and returns to m02-mistwood-entry threshold", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();
  const before = state.world.elapsedMinutes;

  state = await engine.choose(state, "back_to_mistwood");

  assert.equal(state.story.sceneId, "m02-mistwood-entry");
  assert.equal(state.story.nodeId, "threshold");
  assert.equal(state.world.locationId, "asteria_mistwood");
  assert.equal(state.world.elapsedMinutes, before + 210);
});

test("M2_03 back_to_valedarsena costs 360 min and returns to city_hub", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();
  const before = state.world.elapsedMinutes;

  state = await engine.choose(state, "back_to_valedarsena");

  assert.equal(state.story.sceneId, "m01-valedarsena-first-arrival");
  assert.equal(state.story.nodeId, "city_hub");
  assert.equal(state.world.locationId, "valedarsena_city");
  assert.equal(state.world.elapsedMinutes, before + 360);
});

test("M2_03 exploration does not heal or mutate roster", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();
  state.player.roster.push({
    speciesId: "shroomish",
    name: "Shroomish",
    level: 4,
    hp: { current: 2, max: 18 },
    statuses: ["burned"]
  });
  const rosterBefore = structuredClone(state.player.roster);

  state = await engine.choose(state, "sala_verde");
  state = await engine.choose(state, "check_trial_requirements");
  state = await engine.choose(state, "back_from_reqs");

  assert.deepEqual(state.player.roster, rosterBefore);
});

test("M2_03 save/reload preserves Borgo state and M1 callbacks", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m2-borgo-"));
  try {
    const { engine } = await makeEngine();
    const store = new SaveStore(dir);
    let state = legalBorgoState("Luke");
    state.slot = "m2-borgo-test";
    state.player.money = 750;
    state.world.flags.friend_beat_01_friend_id = "Marco";
    state.world.flags.capture_signs_noticed = true;
    state.world.flags.capture_ranger_told = true;

    state = await engine.choose(state, "ask_rumors");
    state = await engine.choose(state, "note_rumors");

    await store.save(state);
    const loaded = await store.load("m2-borgo-test");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.capture_signs_noticed, true);
    assert.equal(loaded.world.flags.capture_ranger_told, true);
    assert.equal(loaded.player.money, 750);
    assert.equal(loaded.world.flags.friend_beat_01_friend_id, "Marco");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("M2_03 divergent M1 history A (Ranger known, Houndour captured) can access Borgo", async () => {
  const { engine } = await makeEngine();
  const state = legalBorgoState();
  state.npcs = state.npcs ?? {};
  state.npcs.ElioMar = {
    id: "ElioMar",
    name: "Ranger Elio Mar",
    relationship: { score: 10, qualitative: "friendly" },
    state: { role: "ranger" },
    schedule: null
  };
  state.world.flags.houndour_ginestre_disposition = "captured";
  state.world.flags.m1_world_pressure_local_resolved = true;

  const view = await engine.present(state);
  assert.ok(view, "history A must present Borgo without error");
  assert.ok(view.choices.some((c) => c.id === "ranger_post"));
});

test("M2_03 divergent M1 history B (Ranger never met, default state) can access Borgo", async () => {
  const { engine } = await makeEngine();
  const state = legalBorgoState();
  state.world.flags.houndour_ginestre_disposition = "fled";
  state.world.flags.m1_world_pressure_known = false;

  const view = await engine.present(state);
  assert.ok(view, "history B must present Borgo without error");
  assert.ok(view.choices.some((c) => c.id === "ranger_post"));
});

test("M2_03 repeated entry is idempotent — prior state flags preserved", async () => {
  const { engine } = await makeEngine();
  let state = legalBorgoState();
  state.player.money = 700;
  state.world.flags.capture_ranger_told = true;

  state = await engine.choose(state, "back_to_mistwood");
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";
  state.world.locationId = "borgo_salice";

  const view = await engine.present(state);
  assert.ok(view, "re-entry must succeed");
  assert.equal(state.world.flags.capture_ranger_told, true);
  assert.equal(state.player.money, 700);
});
