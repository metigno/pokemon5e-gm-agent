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

function legalCrisisState(escalationType = "network_unchecked", protagonist = "Luke") {
  const state = legalM2State(protagonist);
  state.world.flags.local_problem_started = true;
  state.world.flags.a2_crisis_escalates_available = true;
  state.world.flags.crisis_escalation_type = escalationType;
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-crisis-moves";
  state.story.nodeId = "crisis_news_arrive";
  return state;
}

test("M2_10 scene compiles and crisis_news_arrive node is present", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-crisis-moves"];
  assert.ok(scene, "m02-crisis-moves must compile");
  assert.ok(scene.nodes["crisis_news_arrive"], "crisis_news_arrive must exist");
  assert.equal(scene.moduleId, "M02");
  assert.equal(scene.locationId, "borgo_salice");
});

test("M2_10 scene requires a2_crisis_escalates_available entry condition", async () => {
  const { engine } = await makeEngine();

  const legal = legalCrisisState();
  const view = await engine.present(legal);
  assert.ok(view, "legal state must present without error");

  for (const mutate of [
    (s) => { s.world.flags.m1_complete = false; },
    (s) => { s.world.flags.m02_unlocked = false; },
    (s) => { s.world.flags.m2_active = false; },
    (s) => { s.competition.rank = "F"; s.competition.rankOrder = 0; },
    (s) => { s.world.flags.a2_crisis_escalates_available = false; }
  ]) {
    const state = legalCrisisState();
    mutate(state);
    await assert.rejects(
      () => engine.present(state),
      /Scene conditions are not satisfied/
    );
  }
});

test("M2_10 read_network_unchecked visible when crisis_escalation_type=network_unchecked", async () => {
  const { engine } = await makeEngine();
  const state = legalCrisisState("network_unchecked");

  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "read_network_unchecked"));
  assert.equal(view.choices.some((c) => c.id === "read_silent_spread"), false);
  assert.equal(view.choices.some((c) => c.id === "read_partial_response"), false);
});

test("M2_10 read_silent_spread visible when crisis_escalation_type=silent_spread", async () => {
  const { engine } = await makeEngine();
  const state = legalCrisisState("silent_spread");

  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "read_silent_spread"));
  assert.equal(view.choices.some((c) => c.id === "read_network_unchecked"), false);
});

test("M2_10 read_partial_response visible when crisis_escalation_type=partial_response", async () => {
  const { engine } = await makeEngine();
  const state = legalCrisisState("partial_response");

  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "read_partial_response"));
  assert.equal(view.choices.some((c) => c.id === "read_network_unchecked"), false);
});

test("M2_10 network_unchecked path reaches crisis_assess_options", async () => {
  const { engine } = await makeEngine();
  let state = legalCrisisState("network_unchecked");

  state = await engine.choose(state, "read_network_unchecked");
  state = await engine.choose(state, "unchecked_assess");

  assert.equal(state.story.nodeId, "crisis_assess_options");
});

test("M2_10 network_unchecked direct investigate sets response_type=investigate", async () => {
  const { engine } = await makeEngine();
  let state = legalCrisisState("network_unchecked");

  state = await engine.choose(state, "read_network_unchecked");
  state = await engine.choose(state, "unchecked_go_direct");

  assert.equal(state.world.flags.crisis_response_type, "investigate");
  assert.equal(state.story.nodeId, "crisis_investigate_move");
});

test("M2_10 silent_spread path direct ranger sets response_type=ranger_report", async () => {
  const { engine } = await makeEngine();
  let state = legalCrisisState("silent_spread");

  state = await engine.choose(state, "read_silent_spread");
  state = await engine.choose(state, "silent_open_ranger_now");

  assert.equal(state.world.flags.crisis_response_type, "ranger_report");
  assert.equal(state.story.nodeId, "crisis_ranger_report");
});

test("M2_10 assess_report_ranger hidden without ranger_thread_opened", async () => {
  const { engine } = await makeEngine();
  let state = legalCrisisState("network_unchecked");

  state = await engine.choose(state, "read_network_unchecked");
  state = await engine.choose(state, "unchecked_assess");

  const view = await engine.present(state);
  assert.equal(view.choices.some((c) => c.id === "assess_report_ranger"), false,
    "assess_report_ranger must be hidden without ranger_thread_opened");
  assert.ok(view.choices.some((c) => c.id === "assess_open_ranger_first"),
    "assess_open_ranger_first must be visible without ranger_thread_opened");
});

test("M2_10 assess_report_ranger visible with ranger_thread_opened", async () => {
  const { engine } = await makeEngine();
  let state = legalCrisisState("network_unchecked");
  state.world.flags.ranger_thread_opened = true;

  state = await engine.choose(state, "read_network_unchecked");
  state = await engine.choose(state, "unchecked_assess");

  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "assess_report_ranger"),
    "assess_report_ranger must be visible with ranger_thread_opened");
  assert.equal(view.choices.some((c) => c.id === "assess_open_ranger_first"), false);
});

test("M2_10 investigate path documents evidence and sets crisis_evidence_gathered", async () => {
  const { engine } = await makeEngine();
  let state = legalCrisisState("network_unchecked");

  state = await engine.choose(state, "read_network_unchecked");
  state = await engine.choose(state, "unchecked_go_direct");
  state = await engine.choose(state, "document_crisis_find");

  assert.equal(state.world.flags.crisis_evidence_gathered, true);
  assert.equal(state.story.nodeId, "crisis_evidence_documented");
});

test("M2_10 ranger report full detail sets crisis_ranger_alerted and crisis_ranger_full_report", async () => {
  const { engine } = await makeEngine();
  let state = legalCrisisState("silent_spread");

  state = await engine.choose(state, "read_silent_spread");
  state = await engine.choose(state, "silent_open_ranger_now");
  state = await engine.choose(state, "report_full_detail");

  assert.equal(state.world.flags.crisis_ranger_alerted, true);
  assert.equal(state.world.flags.crisis_ranger_full_report, true);
});

test("M2_10 defer path sets local_problem_ignored=true", async () => {
  const { engine } = await makeEngine();
  let state = legalCrisisState("network_unchecked");

  state = await engine.choose(state, "read_network_unchecked");
  state = await engine.choose(state, "unchecked_ignore_again");
  state = await engine.choose(state, "defer_walk_away");

  assert.equal(state.world.flags.local_problem_ignored, true);
});

test("M2_10 crisis_moves_close sets crisis_moves_complete on back_to_borgo", async () => {
  const { engine } = await makeEngine();
  let state = legalCrisisState("partial_response");

  state = await engine.choose(state, "read_partial_response");
  state = await engine.choose(state, "partial_step_back");
  state = await engine.choose(state, "defer_passive_monitor");
  state = await engine.choose(state, "back_to_borgo_crisis");

  assert.equal(state.world.flags.crisis_moves_complete, true);
  assert.equal(state.story.sceneId, "m02-borgo-salice");
  assert.equal(state.world.locationId, "borgo_salice");
});

test("M2_10 does NOT set final poaching_network_state", async () => {
  const { engine } = await makeEngine();
  let state = legalCrisisState("network_unchecked");
  state.world.flags.poaching_network_state = "avoided";

  state = await engine.choose(state, "read_network_unchecked");
  state = await engine.choose(state, "unchecked_ignore_again");
  state = await engine.choose(state, "defer_walk_away");
  state = await engine.choose(state, "back_to_borgo_crisis");

  assert.equal(state.world.flags.poaching_network_state, "avoided",
    "poaching_network_state must not be changed by M2_10");
});

test("M2_10 no Rank change through any branch", async () => {
  const { engine } = await makeEngine();
  let state = legalCrisisState("partial_response");

  state = await engine.choose(state, "read_partial_response");
  state = await engine.choose(state, "partial_step_back");
  state = await engine.choose(state, "defer_passive_monitor");
  state = await engine.choose(state, "back_to_borgo_crisis");

  assert.equal(state.competition.rank, "E");
  assert.equal(state.competition.rankOrder, 1);
});

test("M2_10 A2_CRISIS_ESCALATES fires with local_problem_started and day>=20", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.world.flags.local_problem_started = true;
  state.world.elapsedMinutes = 20 * 24 * 60;
  state.world.day = 20;
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  state = await engine.choose(state, "sala_verde");

  assert.equal(state.events.A2_CRISIS_ESCALATES?.status, "resolved");
  assert.equal(state.world.flags.a2_crisis_escalates_available, true);
  assert.ok(state.world.flags.crisis_escalation_type, "crisis_escalation_type must be set");
});

test("M2_10 A2_CRISIS_ESCALATES fires with local_problem_ignored", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.world.flags.local_problem_started = true;
  state.world.flags.local_problem_ignored = true;
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  state = await engine.choose(state, "sala_verde");

  assert.equal(state.events.A2_CRISIS_ESCALATES?.status, "resolved");
  assert.equal(state.world.flags.a2_crisis_escalates_available, true);
});

test("M2_10 crisis_update choice visible in borough_hub with a2_crisis_escalates_available", async () => {
  const { engine } = await makeEngine();
  const state = legalM2State();
  state.world.flags.a2_crisis_escalates_available = true;
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  const view = await engine.present(state);
  assert.ok(
    view.choices.some((c) => c.id === "crisis_update"),
    "crisis_update must be visible with a2_crisis_escalates_available"
  );
});

test("M2_10 crisis_update hidden after crisis_moves_complete", async () => {
  const { engine } = await makeEngine();
  const state = legalM2State();
  state.world.flags.a2_crisis_escalates_available = true;
  state.world.flags.crisis_moves_complete = true;
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  const view = await engine.present(state);
  assert.equal(
    view.choices.some((c) => c.id === "crisis_update"),
    false,
    "crisis_update must be hidden after crisis_moves_complete"
  );
});

test("M2_10 partial_response crisis_intensified path sets crisis_intensified flag", async () => {
  const { engine } = await makeEngine();
  let state = legalCrisisState("partial_response");

  state = await engine.choose(state, "read_partial_response");
  state = await engine.choose(state, "partial_push_harder");

  assert.equal(state.world.flags.crisis_intensified, true);
  assert.equal(state.world.flags.crisis_response_type, "investigate");
});

test("M2_10 save/reload preserves crisis state", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m2-crisis-"));
  try {
    const { engine } = await makeEngine();
    const store = new SaveStore(dir);
    let state = legalCrisisState("network_unchecked", "Luke");
    state.slot = "m2-crisis-test";

    state = await engine.choose(state, "read_network_unchecked");
    state = await engine.choose(state, "unchecked_ignore_again");
    state = await engine.choose(state, "defer_passive_monitor");
    state = await engine.choose(state, "back_to_borgo_crisis");

    await store.save(state);
    const loaded = await store.load("m2-crisis-test");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.crisis_moves_complete, true);
    assert.equal(loaded.world.flags.local_problem_ignored, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
