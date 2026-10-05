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

function legalThreadState(protagonist = "Luke") {
  const state = legalM2State(protagonist);
  state.world.flags.capture_ranger_told = true;
  state.world.locationId = "borgo_salice_ranger";
  state.story.sceneId = "m02-ranger-thread";
  state.story.nodeId = "thread_open";
  state.npcs = state.npcs ?? {};
  state.npcs.ElioMar = {
    id: "ElioMar",
    name: "Ranger Elio Mar",
    relationship: { score: 0, qualitative: "neutral" },
    state: { role: "ranger" },
    schedule: null
  };
  return state;
}

test("M2_05 scene compiles and thread_open node is present", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-ranger-thread"];
  assert.ok(scene, "m02-ranger-thread must compile");
  assert.ok(scene.nodes["thread_open"], "thread_open must exist");
  assert.equal(scene.moduleId, "M02");
  assert.equal(scene.locationId, "borgo_salice_ranger");
});

test("M2_05 scene entry requires M2 gate conditions", async () => {
  const { engine } = await makeEngine();

  const legal = legalThreadState();
  const view = await engine.present(legal);
  assert.ok(view, "legal state must present without error");

  for (const mutate of [
    (s) => { s.world.flags.m1_complete = false; },
    (s) => { s.world.flags.m02_unlocked = false; },
    (s) => { s.world.flags.m2_active = false; },
    (s) => { s.competition.rank = "F"; s.competition.rankOrder = 0; }
  ]) {
    const state = legalThreadState();
    mutate(state);
    await assert.rejects(
      () => engine.present(state),
      /Scene conditions are not satisfied/
    );
  }
});

test("M2_05 choose() rejects illegal M2 state", async () => {
  const { engine } = await makeEngine();
  const state = legalThreadState();
  state.world.flags.m2_active = false;
  await assert.rejects(
    () => engine.choose(state, "share_general_overview"),
    /Scene conditions are not satisfied/
  );
});

test("M2_05 navigation from borgo-salice ranger_signs_shared pursue_investigation_signs", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.world.flags.mistwood_entry_complete = true;
  state.world.flags.capture_signs_noticed = true;
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "ranger_signs_shared";
  state.world.locationId = "borgo_salice_ranger";

  state = await engine.choose(state, "pursue_investigation_signs");

  assert.equal(state.story.sceneId, "m02-ranger-thread");
  assert.equal(state.story.nodeId, "thread_open");
  assert.equal(state.world.locationId, "borgo_salice_ranger");
});

test("M2_05 navigation from borgo-salice ranger_evidence_received pursue_investigation_evidence", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.world.flags.mistwood_entry_complete = true;
  state.world.flags.capture_report_given = true;
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "ranger_evidence_received";
  state.world.locationId = "borgo_salice_ranger";

  state = await engine.choose(state, "pursue_investigation_evidence");

  assert.equal(state.story.sceneId, "m02-ranger-thread");
  assert.equal(state.story.nodeId, "thread_open");
  assert.equal(state.world.locationId, "borgo_salice_ranger");
});

test("M2_05 describe_evidence_detail is hidden without capture_evidence_held", async () => {
  const { engine } = await makeEngine();
  const state = legalThreadState();

  const view = await engine.present(state);
  assert.equal(
    view.choices.some((c) => c.id === "describe_evidence_detail"),
    false,
    "describe_evidence_detail must be hidden without evidence"
  );
});

test("M2_05 describe_evidence_detail is visible with capture_evidence_held", async () => {
  const { engine } = await makeEngine();
  const state = legalThreadState();
  state.world.flags.capture_evidence_held = true;

  const view = await engine.present(state);
  assert.ok(
    view.choices.some((c) => c.id === "describe_evidence_detail"),
    "describe_evidence_detail must be visible with evidence"
  );
});

test("M2_05 describe_signs_detail is hidden without capture_signs_investigated", async () => {
  const { engine } = await makeEngine();
  const state = legalThreadState();

  const view = await engine.present(state);
  assert.equal(
    view.choices.some((c) => c.id === "describe_signs_detail"),
    false,
    "describe_signs_detail must be hidden without signs_investigated"
  );
});

test("M2_05 describe_signs_detail is visible with capture_signs_investigated", async () => {
  const { engine } = await makeEngine();
  const state = legalThreadState();
  state.world.flags.capture_signs_investigated = true;

  const view = await engine.present(state);
  assert.ok(
    view.choices.some((c) => c.id === "describe_signs_detail"),
    "describe_signs_detail must be visible with signs_investigated"
  );
});

test("M2_05 share_general_overview always available as fallback", async () => {
  const { engine } = await makeEngine();
  const state = legalThreadState();

  const view = await engine.present(state);
  assert.ok(
    view.choices.some((c) => c.id === "share_general_overview"),
    "share_general_overview must always be visible"
  );
});

test("M2_05 mention_m1_pressure hidden when m1_world_pressure_known is not set", async () => {
  const { engine } = await makeEngine();
  let state = legalThreadState();
  state.world.flags.capture_evidence_held = true;

  state = await engine.choose(state, "describe_evidence_detail");
  const view = await engine.present(state);
  assert.equal(
    view.choices.some((c) => c.id === "mention_m1_pressure"),
    false,
    "mention_m1_pressure must be hidden without m1_world_pressure_known"
  );
});

test("M2_05 mention_m1_pressure visible with m1_world_pressure_known=true", async () => {
  const { engine } = await makeEngine();
  let state = legalThreadState();
  state.world.flags.capture_evidence_held = true;
  state.world.flags.m1_world_pressure_known = true;

  state = await engine.choose(state, "describe_evidence_detail");
  const view = await engine.present(state);
  assert.ok(
    view.choices.some((c) => c.id === "mention_m1_pressure"),
    "mention_m1_pressure must be visible with m1_world_pressure_known"
  );
});

test("M2_05 mention_m1_pressure path sets ranger_m1_m2_connected", async () => {
  const { engine } = await makeEngine();
  let state = legalThreadState();
  state.world.flags.capture_evidence_held = true;
  state.world.flags.m1_world_pressure_known = true;

  state = await engine.choose(state, "describe_evidence_detail");
  state = await engine.choose(state, "mention_m1_pressure");

  assert.equal(state.story.nodeId, "elio_m1_connection");
  assert.equal(state.world.flags.ranger_m1_m2_connected, true);
});

test("M2_05 request_formal_from_evidence sets ranger_thread_opened and local_problem_started", async () => {
  const { engine } = await makeEngine();
  let state = legalThreadState();
  state.world.flags.capture_evidence_held = true;

  state = await engine.choose(state, "describe_evidence_detail");
  state = await engine.choose(state, "request_formal_from_evidence");

  assert.equal(state.story.nodeId, "elio_formal_track");
  assert.equal(state.world.flags.ranger_thread_opened, true);
  assert.equal(state.world.flags.local_problem_started, true);
});

test("M2_05 scope path → open_formal_from_scope sets ranger_thread_opened and local_problem_started", async () => {
  const { engine } = await makeEngine();
  let state = legalThreadState();
  state.world.flags.capture_evidence_held = true;

  state = await engine.choose(state, "describe_evidence_detail");
  state = await engine.choose(state, "ask_about_scale");
  state = await engine.choose(state, "open_formal_from_scope");

  assert.equal(state.story.nodeId, "elio_formal_track");
  assert.equal(state.world.flags.ranger_thread_opened, true);
  assert.equal(state.world.flags.local_problem_started, true);
});

test("M2_05 confirm_formal_open after M1 connection sets local_problem_started and adjusts ElioMar relationship", async () => {
  const { engine } = await makeEngine();
  let state = legalThreadState();
  state.world.flags.capture_evidence_held = true;
  state.world.flags.m1_world_pressure_known = true;

  state = await engine.choose(state, "describe_evidence_detail");
  state = await engine.choose(state, "mention_m1_pressure");
  const scoreBefore = state.npcs.ElioMar.relationship.score;
  state = await engine.choose(state, "confirm_formal_open");

  assert.equal(state.world.flags.local_problem_started, true);
  assert.equal(state.world.flags.ranger_thread_opened, true);
  assert.ok(state.npcs.ElioMar.relationship.score > scoreBefore, "relationship score must increase");
});

test("M2_05 ask_palude_mirto in formal_track navigates to elio_marsh_context", async () => {
  const { engine } = await makeEngine();
  let state = legalThreadState();
  state.world.flags.capture_evidence_held = true;

  state = await engine.choose(state, "describe_evidence_detail");
  state = await engine.choose(state, "request_formal_from_evidence");
  state = await engine.choose(state, "ask_palude_mirto");

  assert.equal(state.story.nodeId, "elio_marsh_context");
});

test("M2_05 thread_close back_to_borough returns to m02-borgo-salice borough_hub", async () => {
  const { engine } = await makeEngine();
  let state = legalThreadState();

  state = await engine.choose(state, "share_general_overview");
  state = await engine.choose(state, "accept_situation");
  state = await engine.choose(state, "back_to_borough");

  assert.equal(state.story.sceneId, "m02-borgo-salice");
  assert.equal(state.story.nodeId, "borough_hub");
  assert.equal(state.world.locationId, "borgo_salice");
});

test("M2_05 ranger_thread_opened is idempotent on second thread_open entry", async () => {
  const { engine } = await makeEngine();
  let state = legalThreadState();
  state.world.flags.capture_evidence_held = true;
  state.world.flags.ranger_thread_opened = true;
  state.world.flags.local_problem_started = true;

  const view = await engine.present(state);
  assert.ok(view, "re-entry must succeed with flags already set");
  assert.equal(state.world.flags.ranger_thread_opened, true);
  assert.equal(state.world.flags.local_problem_started, true);
});

test("M2_05 save/reload preserves ranger_thread_opened, local_problem_started, ranger_m1_m2_connected", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m2-ranger-thread-"));
  try {
    const { engine } = await makeEngine();
    const store = new SaveStore(dir);
    let state = legalThreadState("Luke");
    state.slot = "m2-ranger-thread-test";
    state.world.flags.capture_evidence_held = true;
    state.world.flags.m1_world_pressure_known = true;

    state = await engine.choose(state, "describe_evidence_detail");
    state = await engine.choose(state, "mention_m1_pressure");
    state = await engine.choose(state, "confirm_formal_open");

    await store.save(state);
    const loaded = await store.load("m2-ranger-thread-test");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.ranger_thread_opened, true);
    assert.equal(loaded.world.flags.local_problem_started, true);
    assert.equal(loaded.world.flags.ranger_m1_m2_connected, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("M2_05 no premature M2 content triggered by ranger thread", async () => {
  const { engine } = await makeEngine();
  let state = legalThreadState();
  state.world.flags.capture_evidence_held = true;

  state = await engine.choose(state, "describe_evidence_detail");
  state = await engine.choose(state, "request_formal_from_evidence");
  state = await engine.choose(state, "confirm_and_leave");
  state = await engine.choose(state, "back_to_borough");

  assert.equal(state.competition.rank, "E");
  assert.equal(state.world.flags.n_met, undefined);
  assert.equal(state.world.flags.friend_beat_02_complete, undefined);
  assert.equal(state.world.flags.poaching_network_state, undefined);
  assert.equal(state.competition.trials?.RANK_E_TO_D, undefined);
});
