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
import { setTrialAvailable } from "../src/engine/competition-state.mjs";

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../content/modules/", import.meta.url));
const fixedNow = () => "2026-10-05T09:55:00.000Z";

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

function atRegistrationDesk(state) {
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "trial_registration_desk";
  state.world.locationId = "valedarsena_arena";
  return state;
}

function addSecondPokemon(state) {
  state.player.roster.push({
    speciesId: "shinx",
    name: "Shinx",
    level: 2,
    abilityId: "intimidate"
  });
  return state;
}

function openTrial(state) {
  setTrialAvailable(state, {
    checkpointId: "RANK_F_TO_E",
    fromRank: "F",
    toRank: "E",
    requiredRosterSize: 2,
    retryable: true
  });
  return state;
}

test("M1_13 unavailable Trial cannot be registered even with two Pokemon", async () => {
  const { engine } = await makeEngine();
  let state = atRegistrationDesk(addSecondPokemon(createNewGameState({ protagonist: "Luke", now: fixedNow })));

  const view = await engine.present(state);
  assert.equal(view.choices.some((choice) => choice.id === "register"), false);
  assert.equal(state.competition.trials.RANK_F_TO_E, undefined);

  await assert.rejects(
    () => engine.choose(state, "register"),
    /not currently available/
  );
});

test("M1_13 Rank F plus available Trial still rejects a one-Pokemon roster", async () => {
  const { engine } = await makeEngine();
  let state = atRegistrationDesk(openTrial(createNewGameState({ protagonist: "Luke", now: fixedNow })));

  const view = await engine.present(state);
  assert.equal(view.choices.some((choice) => choice.id === "register"), false);
  assert.equal(view.choices.some((choice) => choice.id === "missing_roster"), true);
  assert.equal(state.player.roster.length, 1);

  await assert.rejects(
    () => engine.choose(state, "register"),
    /not currently available/
  );
});

test("M1_13 non-F rank cannot register the F-to-E Trial", async () => {
  const { engine } = await makeEngine();
  let state = addSecondPokemon(createNewGameState({ protagonist: "Luke", now: fixedNow }));
  state.competition.rank = "E";
  state.competition.rankOrder = 1;
  state = atRegistrationDesk(state);

  setTrialAvailable(state, {
    checkpointId: "RANK_F_TO_E",
    fromRank: "F",
    toRank: "E",
    requiredRosterSize: 2,
    retryable: true
  });

  assert.equal(state.competition.trials.RANK_F_TO_E.available, false);
  const view = await engine.present(state);
  assert.equal(view.choices.some((choice) => choice.id === "register"), false);

  await assert.rejects(
    () => engine.choose(state, "register"),
    /not currently available/
  );
});

test("M1_13 eligible registration records the gate without starting or resolving competition", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state = atRegistrationDesk(openTrial(addSecondPokemon(state)));

  const beforeRank = state.competition.rank;
  const beforeHistory = structuredClone(state.competition.history);
  const beforeElapsed = state.world.elapsedMinutes;

  state = await engine.choose(state, "register");

  const trial = state.competition.trials.RANK_F_TO_E;
  assert.equal(state.story.nodeId, "trial_registered");
  assert.equal(trial.registered, true);
  assert.equal(trial.registeredAtMinutes, beforeElapsed);
  assert.equal(trial.requiredRosterSize, 2);
  assert.equal(trial.attempts, 0);
  assert.equal(trial.completed, false);
  assert.equal(state.competition.rank, beforeRank);
  assert.deepEqual(state.competition.history, beforeHistory);
  assert.equal(state.competition.activeMatch, null);
});

test("M1_13 registered player may heal, postpone or free-roam without losing registration", async () => {
  const { engine } = await makeEngine();

  for (const choiceId of ["heal_prepare", "postpone", "free_roam"]) {
    let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
    state = atRegistrationDesk(openTrial(addSecondPokemon(state)));
    state = await engine.choose(state, "register");

    state = await engine.choose(state, choiceId);

    assert.equal(state.competition.trials.RANK_F_TO_E.registered, true, choiceId);
    assert.equal(state.competition.trials.RANK_F_TO_E.attempts, 0, choiceId);
    assert.equal(state.competition.rank, "F", choiceId);
    assert.equal(state.competition.activeMatch, null, choiceId);
  }
});

test("M1_13 registration survives save and reload exactly", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m1-trial-registration-"));
  try {
    const { engine } = await makeEngine();
    const store = new SaveStore(dir);
    let state = createNewGameState({ protagonist: "Luke", slot: "m1-trial-reg", now: fixedNow });
    state = atRegistrationDesk(openTrial(addSecondPokemon(state)));

    state = await engine.choose(state, "register");
    state = await engine.choose(state, "postpone");

    await store.save(state);
    const loaded = await store.load("m1-trial-reg");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.competition.rank, "F");
    assert.equal(loaded.competition.trials.RANK_F_TO_E.registered, true);
    assert.equal(loaded.competition.trials.RANK_F_TO_E.attempts, 0);
    assert.equal(loaded.competition.activeMatch, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
