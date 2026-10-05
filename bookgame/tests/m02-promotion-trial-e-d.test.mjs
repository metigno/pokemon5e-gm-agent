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

function legalTrialState(overrides = {}) {
  const state = legalM2State();
  state.competition.trials = {
    RANK_E_TO_D: {
      available: true,
      fromRank: "E",
      toRank: "D",
      requiredRosterSize: 3,
      retryable: true,
      registered: true,
      registeredPokemonIds: ["bulbasaur_1", "charmander_1", "squirtle_1"]
    }
  };
  state.player.roster = [
    { id: "bulbasaur_1", species: "Bulbasaur", level: 5 },
    { id: "charmander_1", species: "Charmander", level: 5 },
    { id: "squirtle_1", species: "Squirtle", level: 5 }
  ];
  state.world.locationId = "borgo_salice_arena";
  state.story.sceneId = "m02-promotion-trial-e-d";
  state.story.nodeId = "trial_gate_call";
  Object.assign(state.world.flags, overrides);
  return state;
}

// ─── COMPILATION ──────────────────────────────────────────────────────────────

test("M2_13 scene compiles and trial_gate_call node is present", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-promotion-trial-e-d"];
  assert.ok(scene, "m02-promotion-trial-e-d must compile");
  assert.ok(scene.nodes["trial_gate_call"], "trial_gate_call must exist");
  assert.equal(scene.moduleId, "M02");
  assert.equal(scene.locationId, "borgo_salice_arena");
});

test("M2_13 scene has all required nodes", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-promotion-trial-e-d"];
  const required = ["trial_gate_call", "trial_ines_briefing", "trial_combat_handoff"];
  for (const nodeId of required) {
    assert.ok(scene.nodes[nodeId], `node ${nodeId} must exist`);
  }
});

test("M2_13 trial_combat_handoff is terminal (no choices)", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-promotion-trial-e-d"];
  const node = scene.nodes["trial_combat_handoff"];
  assert.ok(Array.isArray(node.choices), "choices must be an array");
  assert.equal(node.choices.length, 0, "trial_combat_handoff must be terminal");
});

// ─── ENTRY CONDITIONS ─────────────────────────────────────────────────────────

test("M2_13 entry: legal state presents", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialState();
  const view = await engine.present(state);
  assert.ok(view, "legal trial state must present");
});

test("M2_13 entry: requires rank E", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialState();
  state.competition.rank = "D";
  await assert.rejects(() => engine.present(state), /conditions are not satisfied/i);
});

test("M2_13 entry: requires RANK_E_TO_D.registered=true", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialState();
  state.competition.trials.RANK_E_TO_D.registered = false;
  await assert.rejects(() => engine.present(state), /conditions are not satisfied/i);
});

test("M2_13 entry: requires m2_active", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialState();
  state.world.flags.m2_active = false;
  await assert.rejects(() => engine.present(state), /conditions are not satisfied/i);
});

// ─── NAVIGATION ───────────────────────────────────────────────────────────────

test("M2_13 approach_ines navigates to trial_ines_briefing", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialState();
  const next = await engine.choose(state, "approach_ines");
  assert.equal(next.story.nodeId, "trial_ines_briefing");
});

test("M2_13 withdraw_before_briefing returns to m02-trial-registration#trial_registered", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialState();
  const next = await engine.choose(state, "withdraw_before_briefing");
  assert.equal(next.story.sceneId, "m02-trial-registration");
  assert.equal(next.story.nodeId, "trial_registered");
});

test("M2_13 withdraw_before_start from ines_briefing returns to m02-trial-registration#trial_registered", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialState();
  state.story.nodeId = "trial_ines_briefing";
  const next = await engine.choose(state, "withdraw_before_start");
  assert.equal(next.story.sceneId, "m02-trial-registration");
  assert.equal(next.story.nodeId, "trial_registered");
});

// ─── COMBAT CHOICE ────────────────────────────────────────────────────────────

test("M2_13 begin_trial creates combat handoff state", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialState();
  state.story.nodeId = "trial_ines_briefing";
  const next = await engine.choose(state, "begin_trial");
  assert.ok(next.pending, "must have pending state after begin_trial");
  assert.equal(next.pending.type, "pokemon5e_combat");
  assert.equal(next.story.nodeId, "trial_combat_handoff");
});

test("M2_13 begin_trial combat has correct checkpoint metadata", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialState();
  state.story.nodeId = "trial_ines_briefing";
  const next = await engine.choose(state, "begin_trial");
  assert.equal(next.pending.competition.checkpointId, "RANK_E_TO_D");
  assert.equal(next.pending.competition.fromRank, "E");
  assert.equal(next.pending.competition.toRank, "D");
  assert.equal(next.pending.competition.format, "Singles");
  assert.equal(next.pending.competition.difficulty, "HARD");
  assert.equal(next.pending.competition.retryable, true);
  assert.equal(next.pending.competition.type, "promotion_trial");
});

test("M2_13 begin_trial opponent is Ines Varga with Growlithe lead", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialState();
  state.story.nodeId = "trial_ines_briefing";
  const next = await engine.choose(state, "begin_trial");
  assert.equal(next.pending.encounterId, "A2_RANK_TRIAL_E_D");
  assert.equal(next.pending.opponent.trainerId, "SAL_GATE_E_D_INES_VARGA");
  assert.equal(next.pending.opponent.species, "Growlithe");
  assert.equal(next.pending.opponent.level, 5);
});

test("M2_13 begin_trial opponent bench has Roselia and Sableye", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialState();
  state.story.nodeId = "trial_ines_briefing";
  const next = await engine.choose(state, "begin_trial");
  assert.equal(next.pending.opponentBench.length, 2);
  assert.equal(next.pending.opponentBench[0].species, "Roselia");
  assert.equal(next.pending.opponentBench[1].species, "Sableye");
});

test("M2_13 begin_trial sets opponentRegistered=true", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialState();
  state.story.nodeId = "trial_ines_briefing";
  const next = await engine.choose(state, "begin_trial");
  assert.equal(next.pending.opponentRegistered, true);
});

test("M2_13 begin_trial returnNodes point to m02-trial-result", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialState();
  state.story.nodeId = "trial_ines_briefing";
  const next = await engine.choose(state, "begin_trial");
  assert.equal(next.pending.returnNodes.win, "m02-trial-result#trial_win");
  assert.equal(next.pending.returnNodes.lose, "m02-trial-result#trial_loss");
});

// ─── COMBAT RESOLUTION ────────────────────────────────────────────────────────

test("M2_13 win resolution advances rank to D", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialState();
  state.story.nodeId = "trial_ines_briefing";
  const pending = await engine.choose(state, "begin_trial");
  const result = await engine.resolveCombatHandoff(pending, "win");
  assert.equal(result.competition.rank, "D");
  assert.equal(result.story.sceneId, "m02-trial-result");
  assert.equal(result.story.nodeId, "trial_win");
});

test("M2_13 loss resolution preserves rank E", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialState();
  state.story.nodeId = "trial_ines_briefing";
  const pending = await engine.choose(state, "begin_trial");
  const result = await engine.resolveCombatHandoff(pending, "lose");
  assert.equal(result.competition.rank, "E");
  assert.equal(result.story.sceneId, "m02-trial-result");
  assert.equal(result.story.nodeId, "trial_loss");
});

test("M2_13 win clears pending state", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialState();
  state.story.nodeId = "trial_ines_briefing";
  const pending = await engine.choose(state, "begin_trial");
  const result = await engine.resolveCombatHandoff(pending, "win");
  assert.equal(result.pending, null);
});

// ─── SAVE / RELOAD WITH PENDING ───────────────────────────────────────────────

test("M2_13 save/reload preserves pending combat state", async () => {
  let tmpDir;
  try {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "trial-e-d-pending-"));
    const store = new SaveStore(tmpDir);
    const { engine } = await makeEngine();

    const state = legalTrialState();
    state.story.nodeId = "trial_ines_briefing";
    const pending = await engine.choose(state, "begin_trial");
    assert.ok(pending.pending);

    pending.slot = "slot1";
    await store.save(pending);
    const loaded = await store.load("slot1");
    assert.ok(loaded.pending, "pending must persist through save/reload");
    assert.equal(loaded.pending.competition.checkpointId, "RANK_E_TO_D");
    assert.equal(loaded.competition.rank, "E", "rank must still be E while pending");
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  }
});
