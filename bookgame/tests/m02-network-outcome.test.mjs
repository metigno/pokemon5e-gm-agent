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

function legalOutcomeState(overrides = {}) {
  const state = legalM2State();
  state.world.flags.local_problem_started = true;
  state.world.flags.a2_network_outcome_available = true;
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-network-outcome";
  state.story.nodeId = "network_outcome_review";
  Object.assign(state.world.flags, overrides);
  return state;
}

// Helper: state that qualifies for RESOLVED path
function resolvedFlags() {
  return {
    poaching_network_state: "intervened",
    crisis_ranger_alerted: true,
    crisis_ranger_full_report: true
  };
}

// Helper: state that qualifies for PARTIAL path (intervened, no full report)
function partialFlags() {
  return {
    poaching_network_state: "intervened",
    crisis_ranger_alerted: true,
    crisis_ranger_full_report: false
  };
}

// Helper: state for ESCALATED (ignored, no engagement)
function escalatedFlags() {
  return {
    local_problem_ignored: true
    // no pns=intervened/investigating, no disrupted, no alerted
  };
}

// Helper: state for IGNORED (nothing done, not explicitly ignored)
function ignoredFlags() {
  return {
    poaching_network_state: "avoided"
    // local_problem_ignored not set
  };
}

test("M2_11 scene compiles and network_outcome_review node is present", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-network-outcome"];
  assert.ok(scene, "m02-network-outcome must compile");
  assert.ok(scene.nodes["network_outcome_review"], "network_outcome_review must exist");
  assert.equal(scene.moduleId, "M02");
  assert.equal(scene.locationId, "borgo_salice");
});

test("M2_11 scene requires a2_network_outcome_available entry condition", async () => {
  const { engine } = await makeEngine();
  const legal = legalOutcomeState(resolvedFlags());
  const view = await engine.present(legal);
  assert.ok(view, "legal state must present");

  for (const mutate of [
    (s) => { s.world.flags.m1_complete = false; },
    (s) => { s.world.flags.m02_unlocked = false; },
    (s) => { s.world.flags.m2_active = false; },
    (s) => { s.competition.rank = "F"; s.competition.rankOrder = 0; },
    (s) => { s.world.flags.a2_network_outcome_available = false; }
  ]) {
    const state = legalOutcomeState(resolvedFlags());
    mutate(state);
    await assert.rejects(
      () => engine.present(state),
      /Scene conditions are not satisfied/
    );
  }
});

test("M2_11 enter_resolved visible only with intervened+alerted+full_report", async () => {
  const { engine } = await makeEngine();
  const state = legalOutcomeState(resolvedFlags());
  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "enter_resolved"), "enter_resolved must be visible");
  assert.equal(view.choices.some((c) => c.id === "enter_partial"), false);
  assert.equal(view.choices.some((c) => c.id === "enter_escalated"), false);
  assert.equal(view.choices.some((c) => c.id === "enter_ignored"), false);
});

test("M2_11 enter_partial visible with intervened but no full_report", async () => {
  const { engine } = await makeEngine();
  const state = legalOutcomeState(partialFlags());
  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "enter_partial"), "enter_partial must be visible");
  assert.equal(view.choices.some((c) => c.id === "enter_resolved"), false);
});

test("M2_11 enter_partial visible with investigating+alerted", async () => {
  const { engine } = await makeEngine();
  const state = legalOutcomeState({
    poaching_network_state: "investigating",
    crisis_ranger_alerted: true
  });
  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "enter_partial"));
  assert.equal(view.choices.some((c) => c.id === "enter_resolved"), false);
  assert.equal(view.choices.some((c) => c.id === "enter_escalated"), false);
  assert.equal(view.choices.some((c) => c.id === "enter_ignored"), false);
});

test("M2_11 enter_escalated visible when ignored with no engagement", async () => {
  const { engine } = await makeEngine();
  const state = legalOutcomeState(escalatedFlags());
  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "enter_escalated"), "enter_escalated must be visible");
  assert.equal(view.choices.some((c) => c.id === "enter_resolved"), false);
  assert.equal(view.choices.some((c) => c.id === "enter_partial"), false);
  assert.equal(view.choices.some((c) => c.id === "enter_ignored"), false);
});

test("M2_11 enter_ignored visible with no engagement and not explicitly ignored", async () => {
  const { engine } = await makeEngine();
  const state = legalOutcomeState(ignoredFlags());
  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "enter_ignored"), "enter_ignored must be visible");
  assert.equal(view.choices.some((c) => c.id === "enter_resolved"), false);
  assert.equal(view.choices.some((c) => c.id === "enter_partial"), false);
  assert.equal(view.choices.some((c) => c.id === "enter_escalated"), false);
});

test("M2_11 resolved path sets poaching_network_state=resolved", async () => {
  const { engine } = await makeEngine();
  let state = legalOutcomeState(resolvedFlags());
  state = await engine.choose(state, "enter_resolved");
  assert.equal(state.world.flags.poaching_network_state, "resolved");
});

test("M2_11 partial path sets poaching_network_state=partial", async () => {
  const { engine } = await makeEngine();
  let state = legalOutcomeState(partialFlags());
  state = await engine.choose(state, "enter_partial");
  assert.equal(state.world.flags.poaching_network_state, "partial");
});

test("M2_11 escalated path sets poaching_network_state=escalated", async () => {
  const { engine } = await makeEngine();
  let state = legalOutcomeState(escalatedFlags());
  state = await engine.choose(state, "enter_escalated");
  assert.equal(state.world.flags.poaching_network_state, "escalated");
});

test("M2_11 ignored path sets poaching_network_state=ignored", async () => {
  const { engine } = await makeEngine();
  let state = legalOutcomeState(ignoredFlags());
  state = await engine.choose(state, "enter_ignored");
  assert.equal(state.world.flags.poaching_network_state, "ignored");
});

test("M2_11 resolved full path reaches close and sets network_outcome_complete", async () => {
  const { engine } = await makeEngine();
  let state = legalOutcomeState(resolvedFlags());

  state = await engine.choose(state, "enter_resolved");
  state = await engine.choose(state, "acknowledge_resolved");
  state = await engine.choose(state, "close_to_outro_resolved");
  state = await engine.choose(state, "back_to_borgo_outcome");

  assert.equal(state.world.flags.network_outcome_complete, true);
  assert.equal(state.world.flags.poaching_network_state, "resolved");
  assert.equal(state.story.sceneId, "m02-borgo-salice");
  assert.equal(state.world.locationId, "borgo_salice");
});

test("M2_11 partial full path with ranger review reaches close", async () => {
  const { engine } = await makeEngine();
  let state = legalOutcomeState(partialFlags());

  state = await engine.choose(state, "enter_partial");
  state = await engine.choose(state, "review_partial_evidence");
  state = await engine.choose(state, "accept_partial_outcome");
  state = await engine.choose(state, "close_to_outro_partial");
  state = await engine.choose(state, "back_to_borgo_outcome");

  assert.equal(state.world.flags.network_outcome_complete, true);
  assert.equal(state.world.flags.poaching_network_state, "partial");
  assert.equal(state.story.sceneId, "m02-borgo-salice");
});

test("M2_11 escalated path with assess reaches close", async () => {
  const { engine } = await makeEngine();
  let state = legalOutcomeState(escalatedFlags());

  state = await engine.choose(state, "enter_escalated");
  state = await engine.choose(state, "assess_escalated_damage");
  state = await engine.choose(state, "note_cost_of_inaction");
  state = await engine.choose(state, "close_to_outro_escalated");
  state = await engine.choose(state, "back_to_borgo_outcome");

  assert.equal(state.world.flags.network_outcome_complete, true);
  assert.equal(state.world.flags.poaching_network_state, "escalated");
});

test("M2_11 ignored path reaches close", async () => {
  const { engine } = await makeEngine();
  let state = legalOutcomeState(ignoredFlags());

  state = await engine.choose(state, "enter_ignored");
  state = await engine.choose(state, "observe_what_continued");
  state = await engine.choose(state, "accept_gap_in_record");
  state = await engine.choose(state, "close_to_outro_ignored");
  state = await engine.choose(state, "back_to_borgo_outcome");

  assert.equal(state.world.flags.network_outcome_complete, true);
  assert.equal(state.world.flags.poaching_network_state, "ignored");
});

test("M2_11 insufficient evidence cannot become resolved (investigating only, no ranger)", async () => {
  const { engine } = await makeEngine();
  const state = legalOutcomeState({ poaching_network_state: "investigating" });
  const view = await engine.present(state);
  assert.equal(view.choices.some((c) => c.id === "enter_resolved"), false,
    "investigating alone cannot qualify for resolved");
});

test("M2_11 alerted alone gives partial (not resolved)", async () => {
  const { engine } = await makeEngine();
  const state = legalOutcomeState({ crisis_ranger_alerted: true });
  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "enter_partial"));
  assert.equal(view.choices.some((c) => c.id === "enter_resolved"), false);
});

test("M2_11 disrupted alone gives partial", async () => {
  const { engine } = await makeEngine();
  const state = legalOutcomeState({ poaching_network_disrupted: true });
  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "enter_partial"));
});

test("M2_11 prior intervened state ignored when escalated+no_engagement also present", async () => {
  const { engine } = await makeEngine();
  // Partial wins over escalated when engagement exists even alongside ignored=true
  const state = legalOutcomeState({
    local_problem_ignored: true,
    poaching_network_state: "intervened",
    crisis_ranger_alerted: true
  });
  const view = await engine.present(state);
  // Has engagement (intervened), so partial should win
  assert.ok(view.choices.some((c) => c.id === "enter_partial"),
    "partial must win when engagement exists even if also ignored");
  assert.equal(view.choices.some((c) => c.id === "enter_escalated"), false);
});

test("M2_11 no Rank mutation through any branch", async () => {
  const { engine } = await makeEngine();
  let state = legalOutcomeState(resolvedFlags());
  state = await engine.choose(state, "enter_resolved");
  state = await engine.choose(state, "acknowledge_resolved");
  state = await engine.choose(state, "close_to_outro_resolved");
  state = await engine.choose(state, "back_to_borgo_outcome");
  assert.equal(state.competition.rank, "E");
  assert.equal(state.competition.rankOrder, 1);
});

test("M2_11 A2_NETWORK_OUTCOME fires with crisis_moves_complete", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.world.flags.local_problem_started = true;
  state.world.flags.crisis_moves_complete = true;
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  state = await engine.choose(state, "sala_verde");

  assert.equal(state.events.A2_NETWORK_OUTCOME?.status, "resolved");
  assert.equal(state.world.flags.a2_network_outcome_available, true);
});

test("M2_11 A2_NETWORK_OUTCOME fires with day>=25", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.world.flags.local_problem_started = true;
  state.world.day = 25;
  state.world.elapsedMinutes = 25 * 24 * 60;
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  state = await engine.choose(state, "sala_verde");

  assert.equal(state.events.A2_NETWORK_OUTCOME?.status, "resolved");
  assert.equal(state.world.flags.a2_network_outcome_available, true);
});

test("M2_11 A2_NETWORK_OUTCOME fires with pns=intervened", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.world.flags.local_problem_started = true;
  state.world.flags.poaching_network_state = "intervened";
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  state = await engine.choose(state, "sala_verde");

  assert.equal(state.events.A2_NETWORK_OUTCOME?.status, "resolved");
  assert.equal(state.world.flags.a2_network_outcome_available, true);
});

test("M2_11 network_outcome choice visible in borough_hub with a2_network_outcome_available", async () => {
  const { engine } = await makeEngine();
  const state = legalM2State();
  state.world.flags.a2_network_outcome_available = true;
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "network_outcome"),
    "network_outcome must be visible with a2_network_outcome_available");
});

test("M2_11 network_outcome hidden after network_outcome_complete", async () => {
  const { engine } = await makeEngine();
  const state = legalM2State();
  state.world.flags.a2_network_outcome_available = true;
  state.world.flags.network_outcome_complete = true;
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  const view = await engine.present(state);
  assert.equal(view.choices.some((c) => c.id === "network_outcome"), false,
    "network_outcome must be hidden after completion");
});

test("M2_11 idempotent: cannot re-classify after network_outcome_complete", async () => {
  const { engine } = await makeEngine();
  const state = legalOutcomeState(resolvedFlags());
  state.world.flags.network_outcome_complete = true;

  await assert.rejects(
    () => engine.present(state),
    /Scene conditions are not satisfied/,
    "must block re-entry after completion"
  );
});

test("M2_11 ranger_debrief path reachable from resolved context", async () => {
  const { engine } = await makeEngine();
  let state = legalOutcomeState(resolvedFlags());
  state = await engine.choose(state, "enter_resolved");
  state = await engine.choose(state, "check_ranger_record");
  assert.equal(state.story.nodeId, "outcome_ranger_debrief");
  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "ask_follow_up_steps"));
});

test("M2_11 n_impact_resolved reachable from resolved context", async () => {
  const { engine } = await makeEngine();
  let state = legalOutcomeState(resolvedFlags());
  state = await engine.choose(state, "enter_resolved");
  state = await engine.choose(state, "ask_n_contribution");
  assert.equal(state.story.nodeId, "outcome_n_impact_resolved");
});

test("M2_11 save/reload preserves network outcome state", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m2-outcome-"));
  try {
    const { engine } = await makeEngine();
    const store = new SaveStore(dir);
    let state = legalOutcomeState(partialFlags());
    state.slot = "m2-outcome-test";

    state = await engine.choose(state, "enter_partial");
    state = await engine.choose(state, "acknowledge_partial");
    state = await engine.choose(state, "close_to_outro_partial");
    state = await engine.choose(state, "back_to_borgo_outcome");

    await store.save(state);
    const loaded = await store.load("m2-outcome-test");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.poaching_network_state, "partial");
    assert.equal(loaded.world.flags.network_outcome_complete, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
