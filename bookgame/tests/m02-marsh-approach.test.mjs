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

function legalMarshState(protagonist = "Luke") {
  const state = legalM2State(protagonist);
  state.world.locationId = "mir_marsh_approach";
  state.story.sceneId = "m02-marsh-approach";
  state.story.nodeId = "marsh_road";
  return state;
}

test("M2_06 scene compiles and marsh_road node is present", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-marsh-approach"];
  assert.ok(scene, "m02-marsh-approach must compile");
  assert.ok(scene.nodes["marsh_road"], "marsh_road must exist");
  assert.equal(scene.moduleId, "M02");
  assert.equal(scene.locationId, "mir_marsh_approach");
});

test("M2_06 ecology M02.json includes MIR-MARSH zone", async () => {
  const { bundle } = await makeEngine();
  const ecology = bundle.ecology;
  assert.ok(ecology, "ecology bundle must exist");
  const zones = ecology.zones;
  assert.ok(zones, "ecology zones must exist");
  assert.ok("MIR-MARSH" in zones, "MIR-MARSH zone must be present in compiled ecology");
});

test("M2_06 scene entry requires M2 gate conditions", async () => {
  const { engine } = await makeEngine();

  const legal = legalMarshState();
  const view = await engine.present(legal);
  assert.ok(view, "legal state must present without error");

  for (const mutate of [
    (s) => { s.world.flags.m1_complete = false; },
    (s) => { s.world.flags.m02_unlocked = false; },
    (s) => { s.world.flags.m2_active = false; },
    (s) => { s.competition.rank = "F"; s.competition.rankOrder = 0; }
  ]) {
    const state = legalMarshState();
    mutate(state);
    await assert.rejects(
      () => engine.present(state),
      /Scene conditions are not satisfied/
    );
  }
});

test("M2_06 choose() rejects illegal M2 state", async () => {
  const { engine } = await makeEngine();
  const state = legalMarshState();
  state.world.flags.m2_active = false;
  await assert.rejects(
    () => engine.choose(state, "arrive_at_boundary"),
    /Scene conditions are not satisfied/
  );
});

test("M2_06 navigation from borgo-salice head_to_marsh costs 180 min", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.world.flags.mistwood_entry_complete = true;
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";
  state.world.locationId = "borgo_salice";
  const before = state.world.elapsedMinutes;

  state = await engine.choose(state, "head_to_marsh");

  assert.equal(state.story.sceneId, "m02-marsh-approach");
  assert.equal(state.story.nodeId, "marsh_road");
  assert.equal(state.world.locationId, "mir_marsh_approach");
  assert.equal(state.world.elapsedMinutes, before + 180);
});

test("M2_06 arrive_at_boundary sets marsh_approach_reached and enters marsh_boundary", async () => {
  const { engine } = await makeEngine();
  let state = legalMarshState();

  state = await engine.choose(state, "arrive_at_boundary");

  assert.equal(state.story.nodeId, "marsh_boundary");
  assert.equal(state.world.flags.marsh_approach_reached, true);
  assert.equal(state.world.locationId, "mir_marsh_approach");
});

test("M2_06 check_rank_gate sets marsh_rank_gate_seen", async () => {
  const { engine } = await makeEngine();
  let state = legalMarshState();

  state = await engine.choose(state, "arrive_at_boundary");
  state = await engine.choose(state, "check_rank_gate");

  assert.equal(state.story.nodeId, "rank_gate_info");
  assert.equal(state.world.flags.marsh_rank_gate_seen, true);
});

test("M2_06 rank gate info explains Rank D requirement without promoting player", async () => {
  const { engine } = await makeEngine();
  let state = legalMarshState();

  state = await engine.choose(state, "arrive_at_boundary");
  state = await engine.choose(state, "check_rank_gate");

  assert.equal(state.competition.rank, "E");
  assert.equal(state.story.nodeId, "rank_gate_info");
});

test("M2_06 ecology check success sets marsh_boundary_observed with high roll", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = legalMarshState();

  state = await engine.choose(state, "arrive_at_boundary");
  state = await engine.choose(state, "observe_boundary_ecology");
  state = await engine.choose(state, "ecology_check_wis");

  assert.equal(state.story.nodeId, "ecology_success");
  assert.equal(state.world.flags.marsh_boundary_observed, true);
});

test("M2_06 ecology check failure routes to ecology_obscured with low roll", async () => {
  const { engine } = await makeEngine(new SequenceDice([1]));
  let state = legalMarshState();

  state = await engine.choose(state, "arrive_at_boundary");
  state = await engine.choose(state, "observe_boundary_ecology");
  state = await engine.choose(state, "ecology_check_wis");

  assert.equal(state.story.nodeId, "ecology_obscured");
  assert.equal(state.world.flags.marsh_boundary_observed, undefined);
});

test("M2_06 look_for_boundary_signs is hidden without investigation context", async () => {
  const { engine } = await makeEngine();
  let state = legalMarshState();

  state = await engine.choose(state, "arrive_at_boundary");
  const view = await engine.present(state);

  assert.equal(
    view.choices.some((c) => c.id === "look_for_boundary_signs"),
    false,
    "look_for_boundary_signs must be hidden without investigation context"
  );
});

test("M2_06 look_for_boundary_signs is visible with capture_signs_noticed", async () => {
  const { engine } = await makeEngine();
  let state = legalMarshState();
  state.world.flags.capture_signs_noticed = true;

  state = await engine.choose(state, "arrive_at_boundary");
  const view = await engine.present(state);

  assert.ok(
    view.choices.some((c) => c.id === "look_for_boundary_signs"),
    "look_for_boundary_signs must be visible with capture context"
  );
});

test("M2_06 look_for_boundary_signs is visible with ranger_thread_opened", async () => {
  const { engine } = await makeEngine();
  let state = legalMarshState();
  state.world.flags.ranger_thread_opened = true;

  state = await engine.choose(state, "arrive_at_boundary");
  const view = await engine.present(state);

  assert.ok(
    view.choices.some((c) => c.id === "look_for_boundary_signs"),
    "look_for_boundary_signs must be visible with ranger context"
  );
});

test("M2_06 anomaly search success sets marsh_boundary_anomaly_noticed with high roll", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = legalMarshState();
  state.world.flags.capture_signs_noticed = true;

  state = await engine.choose(state, "arrive_at_boundary");
  state = await engine.choose(state, "look_for_boundary_signs");
  state = await engine.choose(state, "search_anomaly_int");

  assert.equal(state.story.nodeId, "anomaly_found");
  assert.equal(state.world.flags.marsh_boundary_anomaly_noticed, true);
});

test("M2_06 document_anomaly sets marsh_evidence_documented", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = legalMarshState();
  state.world.flags.capture_signs_noticed = true;

  state = await engine.choose(state, "arrive_at_boundary");
  state = await engine.choose(state, "look_for_boundary_signs");
  state = await engine.choose(state, "search_anomaly_int");
  state = await engine.choose(state, "document_anomaly");

  assert.equal(state.story.nodeId, "marsh_threshold_done");
  assert.equal(state.world.flags.marsh_evidence_documented, true);
});

test("M2_06 return from marsh costs 180 min and reaches borgo-salice borough_hub", async () => {
  const { engine } = await makeEngine();
  let state = legalMarshState();
  const before = state.world.elapsedMinutes;

  state = await engine.choose(state, "arrive_at_boundary");
  state = await engine.choose(state, "head_back_sal_town");

  assert.equal(state.story.sceneId, "m02-borgo-salice");
  assert.equal(state.story.nodeId, "borough_hub");
  assert.equal(state.world.locationId, "borgo_salice");
  assert.equal(state.world.elapsedMinutes, before + 180);
});

test("M2_06 no Rank change occurs at marsh boundary", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = legalMarshState();

  state = await engine.choose(state, "arrive_at_boundary");
  state = await engine.choose(state, "check_rank_gate");
  state = await engine.choose(state, "back_from_gate");

  assert.equal(state.competition.rank, "E");
  assert.equal(state.competition.rankOrder, 1);
});

test("M2_06 no premature M2 content triggered by marsh approach", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = legalMarshState();
  state.world.flags.capture_signs_noticed = true;

  state = await engine.choose(state, "arrive_at_boundary");
  state = await engine.choose(state, "check_rank_gate");
  state = await engine.choose(state, "back_from_gate");
  state = await engine.choose(state, "head_back_sal_town");

  assert.equal(state.competition.rank, "E");
  assert.equal(state.world.flags.n_met, undefined);
  assert.equal(state.world.flags.friend_beat_02_complete, undefined);
  assert.equal(state.world.flags.poaching_network_state, undefined);
  assert.equal(state.competition.trials?.RANK_E_TO_D, undefined);
});

test("M2_06 save/reload preserves marsh state flags", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m2-marsh-"));
  try {
    const { engine } = await makeEngine(new SequenceDice([20]));
    const store = new SaveStore(dir);
    let state = legalMarshState("Luke");
    state.slot = "m2-marsh-test";
    state.world.flags.capture_signs_noticed = true;

    state = await engine.choose(state, "arrive_at_boundary");
    state = await engine.choose(state, "check_rank_gate");
    state = await engine.choose(state, "back_from_gate");

    await store.save(state);
    const loaded = await store.load("m2-marsh-test");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.marsh_approach_reached, true);
    assert.equal(loaded.world.flags.marsh_rank_gate_seen, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
