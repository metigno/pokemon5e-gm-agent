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

// State already at the trial_info entry node, rank E, trial flag active, trial available
function legalTrialRegState(overrides = {}) {
  const state = legalM2State();
  state.world.flags.a2_rank_trial_e_d_available = true;
  state.world.locationId = "borgo_salice_sala_verde";
  state.story.sceneId = "m02-trial-registration";
  state.story.nodeId = "trial_info";
  // Add trial available to competition state (normally applied by sala_verde nav choice)
  state.competition.trials = state.competition.trials ?? {};
  state.competition.trials.RANK_E_TO_D = {
    available: true,
    fromRank: "E",
    toRank: "D",
    requiredRosterSize: 3,
    retryable: true
  };
  // Add 3 Pokémon to roster
  state.player.roster = [
    { id: "bulbasaur_1", species: "Bulbasaur", level: 5 },
    { id: "charmander_1", species: "Charmander", level: 5 },
    { id: "squirtle_1", species: "Squirtle", level: 5 }
  ];
  Object.assign(state.world.flags, overrides);
  return state;
}

// State at trial_desk node
function atTrialDesk(overrides = {}) {
  const state = legalTrialRegState(overrides);
  state.story.nodeId = "trial_desk";
  return state;
}

// State at trial_roster_check node
function atRosterCheck(overrides = {}) {
  const state = legalTrialRegState(overrides);
  state.story.nodeId = "trial_roster_check";
  return state;
}

// ─── COMPILATION ──────────────────────────────────────────────────────────────

test("M2_12 scene compiles and trial_info node is present", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-trial-registration"];
  assert.ok(scene, "m02-trial-registration must compile");
  assert.ok(scene.nodes["trial_info"], "trial_info must exist");
  assert.equal(scene.moduleId, "M02");
  assert.equal(scene.locationId, "borgo_salice_sala_verde");
});

test("M2_12 scene has all required nodes", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-trial-registration"];
  const required = [
    "trial_info", "trial_desk", "trial_format_info", "trial_opponent_preview",
    "trial_examiner_detail", "trial_roster_check", "trial_roster_missing",
    "trial_registered", "trial_prep_review", "trial_strategy_notes",
    "trial_postponed", "trial_return_registered"
  ];
  for (const nodeId of required) {
    assert.ok(scene.nodes[nodeId], `node ${nodeId} must exist`);
  }
});

// ─── ENTRY CONDITIONS ─────────────────────────────────────────────────────────

test("M2_12 entry: legal state presents", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialRegState();
  const view = await engine.present(state);
  assert.ok(view, "legal trial registration state must present");
});

test("M2_12 entry: requires m1_complete", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialRegState({ m1_complete: false });
  state.world.flags.m1_complete = false;
  await assert.rejects(() => engine.present(state), /conditions are not satisfied/i);
});

test("M2_12 entry: requires m02_unlocked", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialRegState();
  state.world.flags.m02_unlocked = false;
  await assert.rejects(() => engine.present(state), /conditions are not satisfied/i);
});

test("M2_12 entry: requires m2_active", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialRegState();
  state.world.flags.m2_active = false;
  await assert.rejects(() => engine.present(state), /conditions are not satisfied/i);
});

test("M2_12 entry: requires rank E", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialRegState();
  state.competition.rank = "D";
  state.competition.rankOrder = 2;
  await assert.rejects(() => engine.present(state), /conditions are not satisfied/i);
});

test("M2_12 entry: requires a2_rank_trial_e_d_available", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialRegState();
  state.world.flags.a2_rank_trial_e_d_available = false;
  await assert.rejects(() => engine.present(state), /conditions are not satisfied/i);
});

// ─── A2_RANK_TRIAL_E_D EVENT ──────────────────────────────────────────────────

test("M2_12 A2_RANK_TRIAL_E_D event fires at trainerLevel >= 4 with rank E", async () => {
  const { bundle } = await makeEngine();
  const event = bundle.worldEvents.find(e => e.id === "A2_RANK_TRIAL_E_D");
  assert.ok(event, "A2_RANK_TRIAL_E_D event must exist");
  assert.equal(event.once, true);
  // Check trigger conditions structure
  const trigger = event.trigger;
  assert.ok(trigger.all, "trigger must use all");
  const rankCond = trigger.all.find(c => c.path === "competition.rank");
  assert.ok(rankCond, "rank condition must exist");
  assert.equal(rankCond.eq, "E");
  const levelCond = trigger.all.find(c => c.path === "player.trainerLevel");
  assert.ok(levelCond, "trainerLevel condition must exist");
  assert.equal(levelCond.gte, 4);
});

test("M2_12 A2_RANK_TRIAL_E_D outcome sets a2_rank_trial_e_d_available flag", async () => {
  const { bundle } = await makeEngine();
  const event = bundle.worldEvents.find(e => e.id === "A2_RANK_TRIAL_E_D");
  const outcome = event.outcomes[0];
  const flagEffect = outcome.effects.find(e => e.key === "a2_rank_trial_e_d_available");
  assert.ok(flagEffect, "must set a2_rank_trial_e_d_available");
  assert.equal(flagEffect.value, true);
});

// ─── TRIAL DESK: REGISTRATION CHOICE VISIBILITY ───────────────────────────────

test("M2_12 trial_desk: register_now visible with roster >= 3", async () => {
  const { engine } = await makeEngine();
  const state = atTrialDesk();
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "register_now");
  assert.ok(choice, "register_now must be visible with legal roster");
});

test("M2_12 trial_desk: register_now hidden when already registered", async () => {
  const { engine } = await makeEngine();
  const state = atTrialDesk();
  state.competition.trials.RANK_E_TO_D.registered = true;
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "register_now");
  assert.equal(choice, undefined, "register_now must be hidden when already registered");
});

test("M2_12 trial_desk: register_now hidden with roster < 3", async () => {
  const { engine } = await makeEngine();
  const state = atTrialDesk();
  state.player.roster = [{ id: "bulbasaur_1", species: "Bulbasaur", level: 5 }];
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "register_now");
  assert.equal(choice, undefined, "register_now must be hidden with insufficient roster");
});

test("M2_12 trial_desk: roster_missing_warning visible with roster < 3", async () => {
  const { engine } = await makeEngine();
  const state = atTrialDesk();
  state.player.roster = [{ id: "bulbasaur_1", species: "Bulbasaur", level: 5 }];
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "roster_missing_warning");
  assert.ok(choice, "roster_missing_warning must be visible with <3 Pokémon");
});

test("M2_12 trial_desk: roster_missing_warning hidden with roster >= 3", async () => {
  const { engine } = await makeEngine();
  const state = atTrialDesk();
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "roster_missing_warning");
  assert.equal(choice, undefined, "roster_missing_warning must be hidden with full roster");
});

// ─── REGISTRATION EFFECT ──────────────────────────────────────────────────────

test("M2_12 register_now applies competition_trial_register effect", async () => {
  const { engine } = await makeEngine();
  const state = atTrialDesk();
  const next = await engine.choose(state, "register_now");
  assert.equal(
    next.competition.trials.RANK_E_TO_D.registered,
    true,
    "competition.trials.RANK_E_TO_D.registered must be true after registration"
  );
});

test("M2_12 registration navigates to trial_registered node", async () => {
  const { engine } = await makeEngine();
  const state = atTrialDesk();
  const next = await engine.choose(state, "register_now");
  assert.equal(next.story.nodeId, "trial_registered", "must land on trial_registered");
  assert.equal(next.story.sceneId, "m02-trial-registration");
});

test("M2_12 roster_check: roster_ok_register visible with roster >= 3", async () => {
  const { engine } = await makeEngine();
  const state = atRosterCheck();
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "roster_ok_register");
  assert.ok(choice, "roster_ok_register must be visible with legal roster");
});

test("M2_12 roster_check: roster_ok_register applies competition_trial_register", async () => {
  const { engine } = await makeEngine();
  const state = atRosterCheck();
  const next = await engine.choose(state, "roster_ok_register");
  assert.equal(next.competition.trials.RANK_E_TO_D.registered, true);
  assert.equal(next.story.nodeId, "trial_registered");
});

// ─── REGISTRATION PERSISTENCE / IDEMPOTENCY ───────────────────────────────────

test("M2_12 trial_return_registered shown on re-entry when already registered", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialRegState();
  state.competition.trials.RANK_E_TO_D.registered = true;
  state.story.nodeId = "trial_info";
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "check_if_already_registered");
  assert.ok(choice, "check_if_already_registered must be visible when registered");
});

test("M2_12 trial_return_registered: enter_trial_return visible when registered", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialRegState();
  state.competition.trials.RANK_E_TO_D.registered = true;
  state.story.nodeId = "trial_return_registered";
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "enter_trial_return");
  assert.ok(choice, "enter_trial_return must be visible when rank=E and registered=true");
});

test("M2_12 trial_return_registered: enter_trial_return has rank=E condition in schema", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-trial-registration"];
  const node = scene.nodes["trial_return_registered"];
  const choice = node.choices.find(c => c.id === "enter_trial_return");
  assert.ok(choice, "enter_trial_return must exist");
  const conds = choice.conditions?.all ?? [];
  const rankCond = conds.find(c => c.path === "competition.rank");
  assert.ok(rankCond, "enter_trial_return must have a rank condition");
  assert.equal(rankCond.eq, "E", "enter_trial_return requires rank=E");
});

// ─── POSTPONE / RE-ENTER ──────────────────────────────────────────────────────

test("M2_12 postpone leads to trial_postponed node", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialRegState();
  const next = await engine.choose(state, "postpone_trial");
  assert.equal(next.story.nodeId, "trial_postponed");
});

test("M2_12 trial_postponed: back_to_sala_verde returns to borgo_salice scene", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialRegState();
  state.story.nodeId = "trial_postponed";
  const next = await engine.choose(state, "back_to_sala_verde");
  assert.equal(next.story.sceneId, "m02-borgo-salice");
  assert.equal(next.world.locationId, "borgo_salice_sala_verde");
});

test("M2_12 rank does NOT advance to D during registration", async () => {
  const { engine } = await makeEngine();
  const state = atTrialDesk();
  const next = await engine.choose(state, "register_now");
  assert.equal(next.competition.rank, "E", "rank must remain E after registration only");
});

// ─── SAVE / RELOAD PERSISTENCE ────────────────────────────────────────────────

test("M2_12 save/reload preserves RANK_E_TO_D.registered=true", async () => {
  let tmpDir;
  try {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "trial-reg-save-"));
    const store = new SaveStore(tmpDir);
    const { engine } = await makeEngine();

    const state = atTrialDesk();
    const afterReg = await engine.choose(state, "register_now");
    assert.equal(afterReg.competition.trials.RANK_E_TO_D.registered, true);

    afterReg.slot = "slot1";
    await store.save(afterReg);
    const loaded = await store.load("slot1");
    assert.equal(loaded.competition.trials.RANK_E_TO_D.registered, true);
    assert.equal(loaded.competition.rank, "E");
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  }
});

// ─── NAVIGATION TO M2_13 STUB ─────────────────────────────────────────────────

test("M2_12 proceed_to_trial navigates to m02-promotion-trial-e-d", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialRegState();
  state.competition.trials.RANK_E_TO_D.registered = true;
  state.story.nodeId = "trial_registered";
  const next = await engine.choose(state, "proceed_to_trial");
  assert.equal(next.story.sceneId, "m02-promotion-trial-e-d");
  assert.equal(next.story.nodeId, "trial_gate_call");
});

test("M2_12 proceed_to_trial hidden when not registered", async () => {
  const { engine } = await makeEngine();
  const state = legalTrialRegState();
  state.story.nodeId = "trial_registered";
  // competition.trials.RANK_E_TO_D.registered is not set
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "proceed_to_trial");
  assert.equal(choice, undefined, "proceed_to_trial must be hidden when not registered");
});

// ─── SALA VERDE INTEGRATION ───────────────────────────────────────────────────

test("M2_12 sala_verde trial_access choice is visible when a2_rank_trial_e_d_available", async () => {
  const { engine } = await makeEngine();
  const state = legalM2State();
  state.world.flags.a2_rank_trial_e_d_available = true;
  state.world.locationId = "borgo_salice_sala_verde";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "sala_verde";
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "trial_access");
  assert.ok(choice, "trial_access must be visible in sala_verde when flag is set");
});

test("M2_12 sala_verde trial_access hidden when a2_rank_trial_e_d_available not set", async () => {
  const { engine } = await makeEngine();
  const state = legalM2State();
  state.world.locationId = "borgo_salice_sala_verde";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "sala_verde";
  const view = await engine.present(state);
  const choice = view.choices.find(c => c.id === "trial_access");
  assert.equal(choice, undefined, "trial_access must be hidden before flag is set");
});

test("M2_12 sala_verde trial_access has rank=E condition in schema", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-borgo-salice"];
  const node = scene.nodes["sala_verde"];
  const choice = node.choices.find(c => c.id === "trial_access");
  assert.ok(choice, "trial_access must exist in sala_verde");
  const conds = choice.conditions?.all ?? [];
  const rankCond = conds.find(c => c.path === "competition.rank");
  assert.ok(rankCond, "trial_access must have a rank condition");
  assert.equal(rankCond.eq, "E", "trial_access requires rank=E");
});

test("M2_12 sala_verde trial_access applies competition_trial_available and navigates to trial_info", async () => {
  const { engine } = await makeEngine();
  const state = legalM2State();
  state.world.flags.a2_rank_trial_e_d_available = true;
  state.world.locationId = "borgo_salice_sala_verde";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "sala_verde";
  const next = await engine.choose(state, "trial_access");
  assert.equal(next.story.sceneId, "m02-trial-registration");
  assert.equal(next.story.nodeId, "trial_info");
  assert.equal(next.competition.trials.RANK_E_TO_D.available, true, "competition_trial_available must be applied");
  assert.equal(next.competition.trials.RANK_E_TO_D.fromRank, "E");
  assert.equal(next.competition.trials.RANK_E_TO_D.toRank, "D");
  assert.equal(next.competition.trials.RANK_E_TO_D.requiredRosterSize, 3);
  assert.equal(next.competition.trials.RANK_E_TO_D.retryable, true);
});
