import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { compileStory } from "../src/compiler/story-compiler.mjs";
import { createNewGameState } from "../src/engine/state.mjs";
import { Poke5eDataRepository } from "../src/combat/poke5e-data.mjs";

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../content/modules/", import.meta.url));
const fixedNow = () => "2026-10-05T10:00:00.000Z";

async function makeEngine() {
  const bundle = await compileStory({ scenesDir, modulesDir });
  const scenes = {
    async load(sceneId) {
      const scene = bundle.scenes[sceneId];
      if (!scene) throw new Error("missing scene " + sceneId);
      return structuredClone(scene);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents ?? []);
    }
  };
  return { engine: new BookgameEngine({ scenes, now: fixedNow }), bundle };
}

async function registeredState(engine, { trainerLevel = 2, secondLevel = 2 } = {}) {
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.player.trainerLevel = trainerLevel;
  state.player.roster.push({
    speciesId: "shinx",
    name: "Shinx",
    level: secondLevel,
    abilityId: "intimidate"
  });
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "arena_front";

  state = await engine.choose(state, "note_trial");
  state = await engine.choose(state, "register");
  return state;
}

test("M1_14 gate roster is backed by the real offline Pokemon 5e data pack", async () => {
  const data = new Poke5eDataRepository();

  const eevee = await data.getSpecies("eevee");
  const shinx = await data.getSpecies("shinx");
  const runAway = await data.getAbility("run-away");
  const intimidate = await data.getAbility("intimidate");
  const eeveeMoves = await data.getSupportedMoves(eevee, 4);
  const shinxMoves = await data.getSupportedMoves(shinx, 4);

  assert.equal(eevee.id, "eevee");
  assert.equal(eevee.abilities.some((entry) => entry.id === "run-away"), true);
  assert.equal(runAway.id, "run-away");
  assert.ok(eeveeMoves.length >= 1);

  assert.equal(shinx.id, "shinx");
  assert.equal(shinx.abilities.some((entry) => entry.id === "intimidate"), true);
  assert.equal(intimidate.id, "intimidate");
  assert.ok(shinxMoves.length >= 1);
});

test("M1_14 entering the gate persists Nara Voss as the fixed examiner", async () => {
  const { engine } = await makeEngine();
  let state = await registeredState(engine);

  state = await engine.choose(state, "enter_trial");

  assert.equal(state.story.nodeId, "trial_gate_call");
  assert.equal(state.npcs.VAL_GATE_F_E_NARA_VOSS.name, "Nara Voss");
  assert.equal(state.npcs.VAL_GATE_F_E_NARA_VOSS.state.role, "promotion_trial_examiner");
  assert.equal(state.npcs.VAL_GATE_F_E_NARA_VOSS.state.checkpointId, "RANK_F_TO_E");
  assert.equal(state.npcs.VAL_GATE_F_E_NARA_VOSS.state.fixedRoster, "eevee_l4_shinx_l4");
  assert.equal(state.npcs.VAL_GATE_F_E_NARA_VOSS.schedule.locationId, "valedarsena_arena");
  assert.equal(state.npcs.VAL_GATE_F_E_NARA_VOSS.schedule.activity, "promotion_trial_examiner");
});

test("M1_14 withdrawing before battle does not consume a Trial attempt", async () => {
  const { engine } = await makeEngine();
  let state = await registeredState(engine);

  state = await engine.choose(state, "enter_trial");
  state = await engine.choose(state, "withdraw_before_start");

  assert.equal(state.story.nodeId, "trial_registered");
  assert.equal(state.competition.trials.RANK_F_TO_E.registered, true);
  assert.equal(state.competition.trials.RANK_F_TO_E.attempts, 0);
  assert.equal(state.competition.activeMatch, null);
  assert.equal(state.pending, null);
});

test("M1_14 begin_trial starts exactly one HARD 2v2 Singles gate with fixed opponent levels", async () => {
  const { engine } = await makeEngine();
  let state = await registeredState(engine, { trainerLevel: 3, secondLevel: 20 });

  state = await engine.choose(state, "enter_trial");
  state = await engine.choose(state, "begin_trial");

  assert.equal(state.pending.type, "pokemon5e_combat");
  assert.equal(state.pending.encounterId, "A1_FIRST_GATE");
  assert.equal(state.pending.competition.type, "promotion_trial");
  assert.equal(state.pending.competition.format, "Singles");
  assert.equal(state.pending.competition.officialRosterSize, 2);
  assert.equal(state.pending.competition.difficulty, "HARD");
  assert.equal(state.pending.competition.opponentTrainerId, "VAL_GATE_F_E_NARA_VOSS");

  assert.equal(state.pending.playerBench.length, 1);
  assert.equal(state.pending.opponent.species, "Eevee");
  assert.equal(state.pending.opponent.level, 4);
  assert.equal(state.pending.opponent.abilityId, "run-away");
  assert.equal(state.pending.opponentBench.length, 1);
  assert.equal(state.pending.opponentBench[0].species, "Shinx");
  assert.equal(state.pending.opponentBench[0].level, 4);
  assert.equal(state.pending.opponentBench[0].abilityId, "intimidate");

  assert.equal(state.competition.trials.RANK_F_TO_E.attempts, 1);
  assert.equal(state.competition.activeMatch.matchId, "A1_FIRST_GATE");
});

test("M1_14 retry uses the same fixed Nara roster without invisible scaling", async () => {
  const { engine } = await makeEngine();
  let state = await registeredState(engine, { trainerLevel: 3, secondLevel: 8 });

  state = await engine.choose(state, "enter_trial");
  state = await engine.choose(state, "begin_trial");
  state = engine.resolveCombatHandoff(state, "lose");

  assert.equal(state.competition.rank, "F");
  assert.equal(state.competition.trials.RANK_F_TO_E.available, true);
  assert.equal(state.competition.trials.RANK_F_TO_E.registered, false);
  assert.equal(state.competition.trials.RANK_F_TO_E.attempts, 1);

  state = await engine.choose(state, "retry_desk");
  state = await engine.choose(state, "register");
  state = await engine.choose(state, "enter_trial");
  state = await engine.choose(state, "begin_trial");

  assert.equal(state.competition.trials.RANK_F_TO_E.attempts, 2);
  assert.equal(state.pending.opponent.species, "Eevee");
  assert.equal(state.pending.opponent.level, 4);
  assert.equal(state.pending.opponent.abilityId, "run-away");
  assert.equal(state.pending.opponentBench[0].species, "Shinx");
  assert.equal(state.pending.opponentBench[0].level, 4);
  assert.equal(state.pending.opponentBench[0].abilityId, "intimidate");
  assert.equal(state.pending.competition.opponentTrainerId, "VAL_GATE_F_E_NARA_VOSS");
});
