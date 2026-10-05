import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";
import { registerTrial, setTrialAvailable } from "../src/engine/competition-state.mjs";

const fixedNow = () => "2026-10-05T18:50:00.000Z";

function makeState() {
  const state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.competition.rank = "E";
  state.competition.rankOrder = 1;
  state.player.roster = [
    { id: "A", species: "Bulbasaur", level: 5, hp: { current: 10, max: 10 } },
    { id: "B", species: "Charmander", level: 5, hp: { current: 10, max: 10 } },
    { id: "C", species: "Squirtle", level: 5, hp: { current: 10, max: 10 } },
    { id: "D", species: "Pikachu", level: 5, hp: { current: 10, max: 10 } }
  ];
  setTrialAvailable(state, {
    checkpointId: "RANK_E_TO_D",
    fromRank: "E",
    toRank: "D",
    requiredRosterSize: 3,
    retryable: true
  });
  state.story.sceneId = "official-three-test";
  state.story.nodeId = "start";
  return state;
}

function makeEngine() {
  const scene = {
    id: "official-three-test",
    title: "Official Three Test",
    nodes: {
      start: {
        choices: [{
          id: "begin",
          text: "Begin",
          combat: {
            encounterId: "A2_RANK_TRIAL_E_D",
            opponent: { species: "Growlithe", level: 5, trainerId: "SAL_GATE_E_D_INES_VARGA" },
            opponentBench: [
              { species: "Roselia", level: 5, trainerId: "SAL_GATE_E_D_INES_VARGA" },
              { species: "Sableye", level: 4, trainerId: "SAL_GATE_E_D_INES_VARGA" }
            ],
            opponentRegistered: true,
            goto: "handoff",
            returnNodes: { win: "win", lose: "lose" },
            competition: {
              type: "promotion_trial",
              matchId: "A2_RANK_TRIAL_E_D",
              checkpointId: "RANK_E_TO_D",
              fromRank: "E",
              toRank: "D",
              format: "Singles",
              officialRosterSize: 3,
              difficulty: "HARD",
              retryable: true,
              opponentTrainerId: "SAL_GATE_E_D_INES_VARGA"
            }
          }
        }]
      },
      handoff: { choices: [] },
      win: { choices: [] },
      lose: { choices: [] }
    }
  };
  const scenes = {
    async load(id) {
      if (id !== scene.id) throw new Error("missing scene " + id);
      return structuredClone(scene);
    }
  };
  return new BookgameEngine({ scenes, now: fixedNow });
}

test("Official Three: roster reorder cannot replace registered A/B/C", async () => {
  const engine = makeEngine();
  const state = makeState();
  registerTrial(state, { checkpointId: "RANK_E_TO_D" });
  assert.deepEqual(state.competition.trials.RANK_E_TO_D.registeredPokemonIds, ["A", "B", "C"]);

  state.player.roster = [
    state.player.roster[3],
    state.player.roster[2],
    state.player.roster[1],
    state.player.roster[0]
  ];

  const next = await engine.choose(state, "begin");
  assert.equal(next.pending.playerPokemon.id, "A");
  assert.deepEqual(next.pending.playerBench.map((p) => p.id), ["B", "C"]);
  assert.deepEqual(
    [next.pending.playerPokemon.rosterIndex, ...next.pending.playerBench.map((p) => p.rosterIndex)],
    [3, 2, 1]
  );
});

test("Official Three: missing registered Pokémon rejects Trial start without substitute", async () => {
  const engine = makeEngine();
  const state = makeState();
  registerTrial(state, { checkpointId: "RANK_E_TO_D" });
  state.player.roster = state.player.roster.filter((pokemon) => pokemon.id !== "B");

  await assert.rejects(
    () => engine.choose(state, "begin"),
    /Registered Pokémon is unavailable.*B/
  );
  assert.equal(state.competition.trials.RANK_E_TO_D.attempts, 0);
  assert.equal(state.competition.activeMatch, null);
});

test("Official Three: current live HP is used instead of registration-time HP", async () => {
  const engine = makeEngine();
  const state = makeState();
  registerTrial(state, { checkpointId: "RANK_E_TO_D" });
  state.player.roster.find((pokemon) => pokemon.id === "A").hp.current = 3;

  const next = await engine.choose(state, "begin");
  assert.equal(next.pending.playerPokemon.id, "A");
  assert.equal(next.pending.playerPokemon.hp.current, 3);
});

test("Official Three: loss clears registration but preserves attempt history", async () => {
  const engine = makeEngine();
  let state = makeState();
  registerTrial(state, { checkpointId: "RANK_E_TO_D" });
  state = await engine.choose(state, "begin");
  state = engine.resolveCombatHandoff(state, "lose");

  const trial = state.competition.trials.RANK_E_TO_D;
  assert.equal(trial.registered, false);
  assert.deepEqual(trial.registeredPokemonIds, []);
  assert.equal(trial.available, true);
  assert.equal(trial.attempts, 1);
  assert.equal(state.competition.history.at(-1).outcome, "lose");
  assert.deepEqual(state.competition.history.at(-1).registeredPokemonIds, ["A", "B", "C"]);
});

test("Official Three: retry may register a new legal three", async () => {
  const engine = makeEngine();
  let state = makeState();
  registerTrial(state, { checkpointId: "RANK_E_TO_D" });
  state = await engine.choose(state, "begin");
  state = engine.resolveCombatHandoff(state, "lose");

  state.player.roster = [
    state.player.roster.find((p) => p.id === "D"),
    state.player.roster.find((p) => p.id === "C"),
    state.player.roster.find((p) => p.id === "B"),
    state.player.roster.find((p) => p.id === "A")
  ];
  registerTrial(state, { checkpointId: "RANK_E_TO_D" });
  assert.deepEqual(state.competition.trials.RANK_E_TO_D.registeredPokemonIds, ["D", "C", "B"]);

  state.story.nodeId = "start";
  state = await engine.choose(state, "begin");
  assert.equal(state.pending.playerPokemon.id, "D");
  assert.deepEqual(state.pending.playerBench.map((p) => p.id), ["C", "B"]);
});

test("Official Three: registered identity survives save/reload", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "official-three-save-"));
  try {
    const store = new SaveStore(dir);
    const state = makeState();
    state.slot = "official-three";
    registerTrial(state, { checkpointId: "RANK_E_TO_D" });
    await store.save(state);
    const loaded = await store.load("official-three");
    assert.deepEqual(loaded.competition.trials.RANK_E_TO_D.registeredPokemonIds, ["A", "B", "C"]);
    assert.equal(loaded.competition.trials.RANK_E_TO_D.registered, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Official Three: registration assigns persistent ids only when roster entries lack them", () => {
  const state = makeState();
  delete state.player.roster[0].id;
  registerTrial(state, { checkpointId: "RANK_E_TO_D" });
  const ids = state.competition.trials.RANK_E_TO_D.registeredPokemonIds;
  assert.equal(ids.length, 3);
  assert.match(ids[0], /^pkm_\d+$/);
  assert.equal(state.player.roster[0].id, ids[0]);
  assert.equal(ids[1], "B");
  assert.equal(ids[2], "C");
});
