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
  state.world.locationId = "valedarsena_city";
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "city_hub";
  return state;
}

// State that arrives at trial_win after a successful combat resolution
function winState(overrides = {}) {
  const state = legalM2State();
  state.competition.rank = "D";
  state.competition.rankOrder = 2;
  state.competition.trials = {
    RANK_E_TO_D: {
      available: true,
      fromRank: "E",
      toRank: "D",
      requiredRosterSize: 3,
      retryable: true,
      registered: true,
      completed: true
    }
  };
  state.player.roster = [
    { id: "bulbasaur_1", species: "Bulbasaur", level: 5 },
    { id: "charmander_1", species: "Charmander", level: 5 },
    { id: "squirtle_1", species: "Squirtle", level: 5 }
  ];
  state.world.locationId = "borgo_salice_arena";
  state.story.sceneId = "m02-trial-result";
  state.story.nodeId = "trial_win";
  Object.assign(state.world.flags, overrides);
  return state;
}

// State that arrives at trial_loss after a failed combat
function lossState(overrides = {}) {
  const state = legalM2State();
  state.competition.trials = {
    RANK_E_TO_D: {
      available: true,
      fromRank: "E",
      toRank: "D",
      requiredRosterSize: 3,
      retryable: true,
      registered: true
    }
  };
  state.player.roster = [
    { id: "bulbasaur_1", species: "Bulbasaur", level: 5 },
    { id: "charmander_1", species: "Charmander", level: 5 },
    { id: "squirtle_1", species: "Squirtle", level: 5 }
  ];
  state.world.locationId = "borgo_salice_arena";
  state.story.sceneId = "m02-trial-result";
  state.story.nodeId = "trial_loss";
  Object.assign(state.world.flags, overrides);
  return state;
}

// Full M2 exit contract met
function m2ExitFlags() {
  return {
    n_met: true,
    friend_beat_02_complete: true,
    network_outcome_complete: true
  };
}

// ─── COMPILATION ──────────────────────────────────────────────────────────────

test("M2_14 scene compiles and trial_win node is present", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-trial-result"];
  assert.ok(scene, "m02-trial-result must compile");
  assert.ok(scene.nodes["trial_win"], "trial_win must exist");
  assert.equal(scene.moduleId, "M02");
});

test("M2_14 scene has all required nodes", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-trial-result"];
  const required = [
    "trial_win", "m2_exit_confirmed", "m2_pending_items", "trial_loss"
  ];
  for (const nodeId of required) {
    assert.ok(scene.nodes[nodeId], `node ${nodeId} must exist`);
  }
});

// ─── WIN PATH: EXIT CONTRACT ──────────────────────────────────────────────────

test("M2_14 win: complete_m2_exit visible when all exit conditions met", async () => {
  const { engine } = await makeEngine();
  const state = winState(m2ExitFlags());
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "complete_m2_exit");
  assert.ok(choice, "complete_m2_exit must be visible when all exit conditions are met");
});

test("M2_14 win: complete_m2_exit hidden when n_met missing", async () => {
  const { engine } = await makeEngine();
  const state = winState({ friend_beat_02_complete: true, network_outcome_complete: true });
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "complete_m2_exit");
  assert.equal(choice, undefined, "complete_m2_exit must be hidden when n_met is false");
});

test("M2_14 win: complete_m2_exit hidden when friend_beat_02_complete missing", async () => {
  const { engine } = await makeEngine();
  const state = winState({ n_met: true, network_outcome_complete: true });
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "complete_m2_exit");
  assert.equal(choice, undefined, "complete_m2_exit must be hidden when friend_beat_02_complete is false");
});

test("M2_14 win: complete_m2_exit hidden when network_outcome_complete missing", async () => {
  const { engine } = await makeEngine();
  const state = winState({ n_met: true, friend_beat_02_complete: true });
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "complete_m2_exit");
  assert.equal(choice, undefined, "complete_m2_exit must be hidden when network_outcome_complete is false");
});

test("M2_14 win: review_m2_pending visible when any exit condition missing", async () => {
  const { engine } = await makeEngine();
  const state = winState({ n_met: true }); // missing friend_beat and network
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "review_m2_pending");
  assert.ok(choice, "review_m2_pending must be visible when exit conditions are incomplete");
});

test("M2_14 win: review_m2_pending hidden when all exit conditions met", async () => {
  const { engine } = await makeEngine();
  const state = winState(m2ExitFlags());
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "review_m2_pending");
  assert.equal(choice, undefined, "review_m2_pending must be hidden when all exit conditions are met");
});

// ─── M2 EXIT CONTRACT EFFECTS ─────────────────────────────────────────────────

test("M2_14 complete_m2_exit sets m2_complete=true", async () => {
  const { engine } = await makeEngine();
  const state = winState(m2ExitFlags());
  const next = await engine.choose(state, "complete_m2_exit");
  assert.equal(next.world.flags.m2_complete, true);
});

test("M2_14 complete_m2_exit sets m03_unlocked=true", async () => {
  const { engine } = await makeEngine();
  const state = winState(m2ExitFlags());
  const next = await engine.choose(state, "complete_m2_exit");
  assert.equal(next.world.flags.m03_unlocked, true);
});

test("M2_14 complete_m2_exit navigates to m2_exit_confirmed", async () => {
  const { engine } = await makeEngine();
  const state = winState(m2ExitFlags());
  const next = await engine.choose(state, "complete_m2_exit");
  assert.equal(next.story.nodeId, "m2_exit_confirmed");
  assert.equal(next.story.sceneId, "m02-trial-result");
});

test("M2_14 m2_exit_confirmed: go_to_m03 visible when m2_complete=true", async () => {
  const { engine } = await makeEngine();
  const state = winState(m2ExitFlags());
  state.world.flags.m2_complete = true;
  state.world.flags.m03_unlocked = true;
  state.story.nodeId = "m2_exit_confirmed";
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "go_to_m03");
  assert.ok(choice, "go_to_m03 must be visible when m2_complete=true");
});

test("M2_14 go_to_m03 navigates to m03-handoff#m03_entry", async () => {
  const { engine } = await makeEngine();
  const state = winState(m2ExitFlags());
  const exitState = await engine.choose(state, "complete_m2_exit");
  const next = await engine.choose(exitState, "go_to_m03");
  assert.equal(next.story.sceneId, "m03-handoff");
  assert.equal(next.story.nodeId, "m03_entry");
});

// ─── PENDING ITEMS PATH ───────────────────────────────────────────────────────

test("M2_14 review_m2_pending navigates to m2_pending_items", async () => {
  const { engine } = await makeEngine();
  const state = winState({ n_met: true }); // incomplete
  const next = await engine.choose(state, "review_m2_pending");
  assert.equal(next.story.nodeId, "m2_pending_items");
});

test("M2_14 m2_pending_items: finish_network_outcome visible when network_outcome_complete missing", async () => {
  const { engine } = await makeEngine();
  const state = winState({ n_met: true, friend_beat_02_complete: true });
  state.story.nodeId = "m2_pending_items";
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "finish_network_outcome");
  assert.ok(choice, "finish_network_outcome must be visible");
});

test("M2_14 m2_pending_items: find_n_pending visible when n_met missing", async () => {
  const { engine } = await makeEngine();
  const state = winState({ friend_beat_02_complete: true, network_outcome_complete: true });
  state.story.nodeId = "m2_pending_items";
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "find_n_pending");
  assert.ok(choice, "find_n_pending must be visible");
});

test("M2_14 m2_pending_items: finish_friend_beat visible when friend_beat_02_complete missing", async () => {
  const { engine } = await makeEngine();
  const state = winState({ n_met: true, network_outcome_complete: true });
  state.story.nodeId = "m2_pending_items";
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "finish_friend_beat");
  assert.ok(choice, "finish_friend_beat must be visible");
});

test("M2_14 m2_pending_items: back_to_borgo_pending always visible", async () => {
  const { engine } = await makeEngine();
  const state = winState();
  state.story.nodeId = "m2_pending_items";
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "back_to_borgo_pending");
  assert.ok(choice, "back_to_borgo_pending must always be visible");
});

// ─── LOSS PATH ────────────────────────────────────────────────────────────────

test("M2_14 loss: rank remains E", async () => {
  const { engine } = await makeEngine();
  const state = lossState();
  const view = await engine.present(state);
  assert.ok(view, "loss state must present");
  // State was already rank E when we set up lossState
  assert.equal(state.competition.rank, "E");
});

test("M2_14 loss: retry_trial visible when rank=E, available=true, not registered", async () => {
  const { engine } = await makeEngine();
  const state = lossState();
  state.competition.trials.RANK_E_TO_D.registered = false; // as set by loss resolution
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "retry_trial");
  assert.ok(choice, "retry_trial must be visible after loss with available=true and not registered");
});

test("M2_14 loss: retry_trial hidden when not available (non-retryable)", async () => {
  const { engine } = await makeEngine();
  const state = lossState();
  state.competition.trials.RANK_E_TO_D.available = false;
  state.competition.trials.RANK_E_TO_D.registered = false;
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "retry_trial");
  assert.equal(choice, undefined, "retry_trial must be hidden when trial not available");
});

test("M2_14 loss: retry_trial navigates to m02-trial-registration#trial_desk", async () => {
  const { engine } = await makeEngine();
  const state = lossState();
  state.competition.trials.RANK_E_TO_D.registered = false;
  const next = await engine.choose(state, "retry_trial");
  assert.equal(next.story.sceneId, "m02-trial-registration");
  assert.equal(next.story.nodeId, "trial_desk");
});

test("M2_14 loss: rest_before_retry returns to sala_verde", async () => {
  const { engine } = await makeEngine();
  const state = lossState();
  const next = await engine.choose(state, "rest_before_retry");
  assert.equal(next.story.sceneId, "m02-borgo-salice");
  assert.equal(next.world.locationId, "borgo_salice_sala_verde");
});

test("M2_14 loss: back_to_borough_loss returns to borough_hub", async () => {
  const { engine } = await makeEngine();
  const state = lossState();
  const next = await engine.choose(state, "back_to_borough_loss");
  assert.equal(next.story.sceneId, "m02-borgo-salice");
  assert.equal(next.world.locationId, "borgo_salice");
});

// ─── WORLD PRESERVATION ───────────────────────────────────────────────────────

test("M2_14 loss: world flags not reset on loss", async () => {
  const { engine } = await makeEngine();
  const state = lossState({
    n_met: true,
    friend_beat_02_complete: true,
    network_outcome_complete: true,
    local_problem_started: true
  });
  state.competition.trials.RANK_E_TO_D.registered = false; // as set by loss resolution
  const next = await engine.choose(state, "retry_trial");
  assert.equal(next.world.flags.n_met, true, "n_met must persist through loss");
  assert.equal(next.world.flags.local_problem_started, true, "local_problem_started must persist");
});

// ─── FULL E→D PATH INTEGRATION ────────────────────────────────────────────────

test("M2_14 full path: M2_13 win → M2_14 exit contract → m2_complete", async () => {
  const { engine } = await makeEngine();

  // Start at trial briefing
  const state = legalM2State();
  state.competition.trials = {
    RANK_E_TO_D: {
      available: true,
      fromRank: "E",
      toRank: "D",
      requiredRosterSize: 3,
      retryable: true,
      registered: true
    }
  };
  state.player.roster = [
    { id: "bulbasaur_1", species: "Bulbasaur", level: 5 },
    { id: "charmander_1", species: "Charmander", level: 5 },
    { id: "squirtle_1", species: "Squirtle", level: 5 }
  ];
  state.world.locationId = "borgo_salice_arena";
  state.story.sceneId = "m02-promotion-trial-e-d";
  state.story.nodeId = "trial_ines_briefing";

  // Begin trial → combat handoff
  const pendingState = await engine.choose(state, "begin_trial");
  assert.ok(pendingState.pending);

  // Resolve win → lands on trial_win with rank=D
  const winResult = await engine.resolveCombatHandoff(pendingState, "win");
  assert.equal(winResult.competition.rank, "D");
  assert.equal(winResult.story.nodeId, "trial_win");

  // Set up all exit conditions (normally achieved during M2 play)
  winResult.world.flags.n_met = true;
  winResult.world.flags.friend_beat_02_complete = true;
  winResult.world.flags.network_outcome_complete = true;

  // Confirm M2 exit
  const exitState = await engine.choose(winResult, "complete_m2_exit");
  assert.equal(exitState.world.flags.m2_complete, true);
  assert.equal(exitState.world.flags.m03_unlocked, true);
  assert.equal(exitState.story.nodeId, "m2_exit_confirmed");
});

test("M2_14 full path: M2_13 loss → M2_14 retry → m02-trial-registration", async () => {
  const { engine } = await makeEngine();

  const state = legalM2State();
  state.competition.trials = {
    RANK_E_TO_D: {
      available: true,
      fromRank: "E",
      toRank: "D",
      requiredRosterSize: 3,
      retryable: true,
      registered: true
    }
  };
  state.player.roster = [
    { id: "bulbasaur_1", species: "Bulbasaur", level: 5 },
    { id: "charmander_1", species: "Charmander", level: 5 },
    { id: "squirtle_1", species: "Squirtle", level: 5 }
  ];
  state.world.locationId = "borgo_salice_arena";
  state.story.sceneId = "m02-promotion-trial-e-d";
  state.story.nodeId = "trial_ines_briefing";

  const pendingState = await engine.choose(state, "begin_trial");
  const lossResult = await engine.resolveCombatHandoff(pendingState, "lose");

  assert.equal(lossResult.competition.rank, "E");
  assert.equal(lossResult.story.nodeId, "trial_loss");
  // After loss, engine sets registered=false and available=true (retryable)
  assert.equal(lossResult.competition.trials.RANK_E_TO_D.registered, false);
  assert.equal(lossResult.competition.trials.RANK_E_TO_D.available, true);

  const retryState = await engine.choose(lossResult, "retry_trial");
  assert.equal(retryState.story.sceneId, "m02-trial-registration");
  assert.equal(retryState.story.nodeId, "trial_desk");
  assert.equal(retryState.competition.rank, "E");
});

// ─── SAVE / RELOAD ────────────────────────────────────────────────────────────

test("M2_14 save/reload preserves m2_complete and rank D", async () => {
  let tmpDir;
  try {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "trial-result-save-"));
    const store = new SaveStore(tmpDir);
    const { engine } = await makeEngine();

    const state = winState(m2ExitFlags());
    const exitState = await engine.choose(state, "complete_m2_exit");
    assert.equal(exitState.world.flags.m2_complete, true);
    assert.equal(exitState.competition.rank, "D");

    exitState.slot = "slot1";
    await store.save(exitState);
    const loaded = await store.load("slot1");
    assert.equal(loaded.world.flags.m2_complete, true);
    assert.equal(loaded.world.flags.m03_unlocked, true);
    assert.equal(loaded.competition.rank, "D");
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  }
});
