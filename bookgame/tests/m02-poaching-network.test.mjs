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

function legalNetworkState(protagonist = "Luke") {
  const state = legalM2State(protagonist);
  state.world.flags.mistwood_entry_complete = true;
  state.world.flags.capture_signs_investigated = true;
  state.world.locationId = "asteria_mistwood";
  state.story.sceneId = "m02-poaching-network";
  state.story.nodeId = "network_encounter";
  return state;
}

test("M2_07 scene compiles and network_encounter node is present", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-poaching-network"];
  assert.ok(scene, "m02-poaching-network must compile");
  assert.ok(scene.nodes["network_encounter"], "network_encounter must exist");
  assert.equal(scene.moduleId, "M02");
  assert.equal(scene.locationId, "asteria_mistwood");
});

test("M2_07 scene entry requires mistwood_entry_complete plus M2 gate conditions", async () => {
  const { engine } = await makeEngine();

  const legal = legalNetworkState();
  const view = await engine.present(legal);
  assert.ok(view, "legal state must present without error");

  for (const mutate of [
    (s) => { s.world.flags.m1_complete = false; },
    (s) => { s.world.flags.m02_unlocked = false; },
    (s) => { s.world.flags.m2_active = false; },
    (s) => { s.competition.rank = "F"; s.competition.rankOrder = 0; },
    (s) => { s.world.flags.mistwood_entry_complete = false; }
  ]) {
    const state = legalNetworkState();
    mutate(state);
    await assert.rejects(
      () => engine.present(state),
      /Scene conditions are not satisfied/
    );
  }
});

test("M2_07 choose() rejects illegal state", async () => {
  const { engine } = await makeEngine();
  const state = legalNetworkState();
  state.world.flags.m2_active = false;
  await assert.rejects(
    () => engine.choose(state, "investigate_from_cover"),
    /Scene conditions are not satisfied/
  );
});

test("M2_07 navigation from capture-signs follow_network_trail requires capture_signs_investigated", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.world.flags.mistwood_entry_complete = true;
  state.story.sceneId = "m02-capture-signs";
  state.story.nodeId = "inner_exit";
  state.world.locationId = "asteria_mistwood";

  const view = await engine.present(state);
  assert.equal(
    view.choices.some((c) => c.id === "follow_network_trail"),
    false,
    "follow_network_trail must be hidden without capture_signs_investigated"
  );
});

test("M2_07 navigation from capture-signs follow_network_trail visible with capture_signs_investigated", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.world.flags.mistwood_entry_complete = true;
  state.world.flags.capture_signs_investigated = true;
  state.story.sceneId = "m02-capture-signs";
  state.story.nodeId = "inner_exit";
  state.world.locationId = "asteria_mistwood";

  const view = await engine.present(state);
  assert.ok(
    view.choices.some((c) => c.id === "follow_network_trail"),
    "follow_network_trail must be visible with capture_signs_investigated"
  );
});

test("M2_07 navigation from capture-signs enters network_encounter", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.world.flags.mistwood_entry_complete = true;
  state.world.flags.capture_signs_investigated = true;
  state.story.sceneId = "m02-capture-signs";
  state.story.nodeId = "inner_exit";
  state.world.locationId = "asteria_mistwood";

  state = await engine.choose(state, "follow_network_trail");

  assert.equal(state.story.sceneId, "m02-poaching-network");
  assert.equal(state.story.nodeId, "network_encounter");
});

test("M2_07 navigation from marsh-approach investigate_marsh_network requires marsh_boundary_anomaly_noticed", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.story.sceneId = "m02-marsh-approach";
  state.story.nodeId = "marsh_threshold_done";
  state.world.locationId = "mir_marsh_approach";

  const view = await engine.present(state);
  assert.equal(
    view.choices.some((c) => c.id === "investigate_marsh_network"),
    false,
    "investigate_marsh_network must be hidden without anomaly_noticed"
  );
});

test("M2_07 navigation from marsh-approach visible with marsh_boundary_anomaly_noticed", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.world.flags.marsh_boundary_anomaly_noticed = true;
  state.story.sceneId = "m02-marsh-approach";
  state.story.nodeId = "marsh_threshold_done";
  state.world.locationId = "mir_marsh_approach";

  const view = await engine.present(state);
  assert.ok(
    view.choices.some((c) => c.id === "investigate_marsh_network"),
    "investigate_marsh_network must be visible with anomaly_noticed"
  );
});

test("M2_07 withdraw_silently sets poaching_network_state=avoided", async () => {
  const { engine } = await makeEngine();
  let state = legalNetworkState();

  state = await engine.choose(state, "withdraw_silently");

  assert.equal(state.story.nodeId, "network_withdraw");
  assert.equal(state.world.flags.poaching_network_state, "avoided");
});

test("M2_07 n_witness_present is hidden when n_met is false", async () => {
  const { engine } = await makeEngine();
  const state = legalNetworkState();

  const view = await engine.present(state);
  assert.equal(
    view.choices.some((c) => c.id === "n_witness_present"),
    false,
    "n_witness_present must be hidden without n_met"
  );
});

test("M2_07 n_witness_present is visible with n_met and n_relationship_positive", async () => {
  const { engine } = await makeEngine();
  const state = legalNetworkState();
  state.world.flags.n_met = true;
  state.world.flags.n_relationship_positive = true;

  const view = await engine.present(state);
  assert.ok(
    view.choices.some((c) => c.id === "n_witness_present"),
    "n_witness_present must be visible with n_met and n_relationship_positive"
  );
});

test("M2_07 investigate path with high roll sets poaching_network_evidence and network_evidence_strong", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = legalNetworkState();

  state = await engine.choose(state, "investigate_from_cover");
  state = await engine.choose(state, "observe_check_int");

  assert.equal(state.story.nodeId, "network_evidence_strong");
  assert.equal(state.world.flags.poaching_network_evidence, true);
});

test("M2_07 investigate path with low roll routes to network_evidence_partial", async () => {
  const { engine } = await makeEngine(new SequenceDice([1]));
  let state = legalNetworkState();

  state = await engine.choose(state, "investigate_from_cover");
  state = await engine.choose(state, "observe_check_int");

  assert.equal(state.story.nodeId, "network_evidence_partial");
  assert.equal(state.world.flags.poaching_network_evidence, undefined);
});

test("M2_07 document_and_report_ranger requires ranger_thread_opened", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = legalNetworkState();

  state = await engine.choose(state, "investigate_from_cover");
  state = await engine.choose(state, "observe_check_int");

  const view = await engine.present(state);
  assert.equal(
    view.choices.some((c) => c.id === "document_and_report_ranger"),
    false,
    "document_and_report_ranger must be hidden without ranger_thread_opened"
  );
});

test("M2_07 document_and_hold sets poaching_network_state=investigating", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = legalNetworkState();

  state = await engine.choose(state, "investigate_from_cover");
  state = await engine.choose(state, "observe_check_int");
  state = await engine.choose(state, "document_and_hold");

  assert.equal(state.world.flags.poaching_network_state, "investigating");
  assert.equal(state.world.flags.poaching_network_documented, true);
});

test("M2_07 confront path reaches network_combat_handoff with fight_poacher choice", async () => {
  const { engine } = await makeEngine();
  let state = legalNetworkState();

  state = await engine.choose(state, "confront_directly");
  state = await engine.choose(state, "challenge_trainer_combat");

  assert.equal(state.story.nodeId, "network_combat_handoff");
  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "fight_poacher"), "fight_poacher must be available");
});

test("M2_07 blockade sets poaching_network_state=intervened", async () => {
  const { engine } = await makeEngine();
  let state = legalNetworkState();

  state = await engine.choose(state, "confront_directly");
  state = await engine.choose(state, "block_without_combat");
  state = await engine.choose(state, "hold_and_document");

  assert.equal(state.world.flags.poaching_network_state, "intervened");
  assert.equal(state.world.flags.poaching_network_evidence, true);
});

test("M2_07 network_report_ready go_to_ranger_post costs 210 min and reaches borgo-salice", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = legalNetworkState();
  const before = state.world.elapsedMinutes;

  state = await engine.choose(state, "investigate_from_cover");
  state = await engine.choose(state, "observe_check_int");
  state = await engine.choose(state, "document_and_hold");
  state = await engine.choose(state, "go_report_now");
  state = await engine.choose(state, "go_to_ranger_post");

  assert.equal(state.story.sceneId, "m02-borgo-salice");
  assert.equal(state.story.nodeId, "borough_hub");
  assert.equal(state.world.locationId, "borgo_salice");
  assert.ok(state.world.elapsedMinutes > before + 200);
});

test("M2_07 N coordinate path sets poaching_n_witness and poaching_network_state=investigating", async () => {
  const { engine } = await makeEngine();
  let state = legalNetworkState();
  state.world.flags.n_met = true;
  state.world.flags.n_relationship_positive = true;

  state = await engine.choose(state, "n_witness_present");
  state = await engine.choose(state, "coordinate_with_n");

  assert.equal(state.world.flags.poaching_n_witness, true);
  assert.equal(state.world.flags.poaching_network_state, "investigating");
  assert.equal(state.world.flags.poaching_network_evidence, true);
});

test("M2_07 no Rank change occurs through any branch", async () => {
  const { engine } = await makeEngine();
  let state = legalNetworkState();

  state = await engine.choose(state, "withdraw_silently");
  state = await engine.choose(state, "withdraw_to_ranger");

  assert.equal(state.competition.rank, "E");
  assert.equal(state.competition.rankOrder, 1);
});

test("M2_07 no premature M2 exit content triggered", async () => {
  const { engine } = await makeEngine();
  let state = legalNetworkState();

  state = await engine.choose(state, "withdraw_silently");

  assert.equal(state.world.flags.friend_beat_02_complete, undefined);
  assert.equal(state.competition.trials?.RANK_E_TO_D, undefined);
});

test("M2_07 save/reload preserves poaching_network_state and investigation flags", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m2-network-"));
  try {
    const { engine } = await makeEngine(new SequenceDice([20]));
    const store = new SaveStore(dir);
    let state = legalNetworkState("Luke");
    state.slot = "m2-network-test";

    state = await engine.choose(state, "investigate_from_cover");
    state = await engine.choose(state, "observe_check_int");
    state = await engine.choose(state, "document_and_hold");

    await store.save(state);
    const loaded = await store.load("m2-network-test");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.poaching_network_state, "investigating");
    assert.equal(loaded.world.flags.poaching_network_evidence, true);
    assert.equal(loaded.world.flags.poaching_network_documented, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
