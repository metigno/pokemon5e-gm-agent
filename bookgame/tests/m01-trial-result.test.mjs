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

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../content/modules/", import.meta.url));
const fixedNow = () => "2026-10-05T10:05:00.000Z";

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

function addSecondPokemon(state) {
  state.player.roster.push({
    speciesId: "shinx",
    name: "Shinx",
    level: 2,
    abilityId: "intimidate"
  });
  return state;
}

async function reachTrial(engine, state) {
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "arena_front";
  state.world.locationId = "valedarsena_arena";
  state = await engine.choose(state, "note_trial");
  state = await engine.choose(state, "register");
  state = await engine.choose(state, "enter_trial");
  state = await engine.choose(state, "begin_trial");
  return state;
}

function satisfyExitContract(state) {
  state.world.flags.blue_met = true;
  state.npcs.Blue.state.met = true;
  state.world.flags.friend_beat_01_complete = true;
  state.world.flags.friend_beat_01_friend_id = "Mattew";
  state.world.flags.friend_beat_01_type = "city_encounter";
  state.world.flags.friends_split = true;
  return state;
}

test("M1_15 loss records the attempt, keeps Rank F and leaves the world retryable", async () => {
  const { engine } = await makeEngine();
  let state = addSecondPokemon(createNewGameState({ protagonist: "Luke", now: fixedNow }));

  state.world.flags.m1_world_pressure_state = "pressure_investigated";
  state.quests.M1_VALE_LOGISTICS_01 = {
    id: "M1_VALE_LOGISTICS_01",
    title: "Consegna",
    objective: "Test",
    status: "failed",
    resolution: "expired"
  };

  state = await reachTrial(engine, state);
  state = engine.resolveCombatHandoff(state, "lose");

  assert.equal(state.story.nodeId, "trial_result_loss");
  assert.equal(state.competition.rank, "F");
  assert.equal(state.competition.trials.RANK_F_TO_E.attempts, 1);
  assert.equal(state.competition.trials.RANK_F_TO_E.lastResult, "lose");
  assert.equal(state.competition.trials.RANK_F_TO_E.bestResult, "lose");
  assert.equal(state.competition.trials.RANK_F_TO_E.available, true);
  assert.equal(state.competition.trials.RANK_F_TO_E.registered, false);
  assert.equal(state.competition.history.at(-1).outcome, "lose");
  assert.equal(state.world.flags.m1_world_pressure_state, "pressure_investigated");
  assert.equal(state.quests.M1_VALE_LOGISTICS_01.status, "failed");
  assert.equal(state.world.flags.m1_complete, undefined);
  assert.equal(state.world.flags.m02_unlocked, undefined);

  const view = await engine.present(state);
  assert.equal(view.choices.some((choice) => choice.id === "retry_desk"), true);
  assert.equal(view.choices.some((choice) => choice.id === "free_roam"), true);
});

test("M1_15 loss then retry win records two attempts and promotes without reset", async () => {
  const { engine } = await makeEngine();
  let state = addSecondPokemon(createNewGameState({ protagonist: "Luke", now: fixedNow }));

  state.world.flags.houndour_ginestre_disposition = "calmed";
  state.world.flags.m1_world_pressure_state = "pressure_partially_resolved";
  state = await reachTrial(engine, state);
  state = engine.resolveCombatHandoff(state, "lose");

  state = await engine.choose(state, "retry_desk");
  state = await engine.choose(state, "register");
  state = await engine.choose(state, "enter_trial");
  state = await engine.choose(state, "begin_trial");
  state = engine.resolveCombatHandoff(state, "win");

  assert.equal(state.story.nodeId, "trial_result_win");
  assert.equal(state.competition.rank, "E");
  assert.equal(state.competition.rankOrder, 1);
  assert.equal(state.competition.trials.RANK_F_TO_E.attempts, 2);
  assert.equal(state.competition.trials.RANK_F_TO_E.lastResult, "win");
  assert.equal(state.competition.trials.RANK_F_TO_E.bestResult, "win");
  assert.equal(state.competition.trials.RANK_F_TO_E.completed, true);
  assert.equal(state.competition.trials.RANK_F_TO_E.available, false);
  assert.equal(state.competition.history.length, 2);
  assert.deepEqual(state.competition.history.map((record) => record.outcome), ["lose", "win"]);
  assert.equal(state.world.flags.houndour_ginestre_disposition, "calmed");
  assert.equal(state.world.flags.m1_world_pressure_state, "pressure_partially_resolved");
});

test("M1_15 Rank E alone cannot formally close M1 or unlock M02", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.competition.rank = "E";
  state.competition.rankOrder = 1;
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "rank_e_access";

  let view = await engine.present(state);
  assert.equal(view.choices.some((choice) => choice.id === "unlock_m02"), false);
  assert.equal(view.choices.some((choice) => choice.id === "review_m1_exit"), true);

  await assert.rejects(
    () => engine.choose(state, "unlock_m02"),
    /not currently available/
  );

  state = await engine.choose(state, "review_m1_exit");
  assert.equal(state.story.nodeId, "m1_exit_pending");
  view = await engine.present(state);
  assert.equal(view.choices.some((choice) => choice.id === "blue_pending"), true);
  assert.equal(view.choices.some((choice) => choice.id === "friend_pending"), true);
  assert.equal(state.world.flags.friends_split, true);
  assert.equal(view.choices.some((choice) => choice.id === "split_pending"), false);
  assert.equal(state.world.flags.m1_complete, undefined);
  assert.equal(state.world.flags.m02_unlocked, undefined);
});

test("M1_15 each mandatory exit beat independently gates formal completion", async () => {
  const { engine } = await makeEngine();
  const requirements = ["blue_met", "friend_beat_01_complete", "friends_split"];

  for (const missing of requirements) {
    let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
    state.competition.rank = "E";
    state.competition.rankOrder = 1;
    satisfyExitContract(state);
    state.world.flags[missing] = false;
    if (missing === "blue_met") state.npcs.Blue.state.met = false;
    state.story.sceneId = "m01-valedarsena-first-arrival";
    state.story.nodeId = "rank_e_access";

    const view = await engine.present(state);
    assert.equal(view.choices.some((choice) => choice.id === "unlock_m02"), false, missing);
    assert.equal(view.choices.some((choice) => choice.id === "review_m1_exit"), true, missing);
  }
});

test("M1_15 full exit contract unlocks M02 without erasing callbacks", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.competition.rank = "E";
  state.competition.rankOrder = 1;
  satisfyExitContract(state);

  state.world.flags.houndour_ginestre_disposition = "captured";
  state.world.flags.valedarsena_reputation = "helpful_rookie";
  state.world.flags.m1_world_pressure_state = "pressure_resolved_offscreen";
  state.world.flags.first_official_resolved = true;
  state.player.secondPokemonAcquisition = {
    speciesId: "houndour",
    name: "Houndour",
    level: 3,
    day: 2,
    locationId: "asteria_ginestre",
    encounterId: "HOUNDOUR_GINESTRE_001"
  };
  state.quests.SQ_FARM_HERD_HANDS = {
    id: "SQ_FARM_HERD_HANDS",
    title: "Recinti aperti",
    objective: "Test",
    status: "failed",
    resolution: "abandoned"
  };
  const preserved = structuredClone({
    houndour: state.world.flags.houndour_ginestre_disposition,
    reputation: state.world.flags.valedarsena_reputation,
    pressure: state.world.flags.m1_world_pressure_state,
    friend: state.world.flags.friend_beat_01_friend_id,
    second: state.player.secondPokemonAcquisition,
    quest: state.quests.SQ_FARM_HERD_HANDS
  });

  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "rank_e_access";

  const view = await engine.present(state);
  assert.equal(view.choices.some((choice) => choice.id === "unlock_m02"), true);
  assert.equal(view.choices.some((choice) => choice.id === "review_m1_exit"), false);

  state = await engine.choose(state, "unlock_m02");

  assert.equal(state.story.nodeId, "m02_handoff");
  assert.equal(state.world.flags.m1_complete, true);
  assert.equal(state.world.flags.m02_unlocked, true);
  assert.equal(state.competition.rank, "E");
  assert.equal(state.world.flags.houndour_ginestre_disposition, preserved.houndour);
  assert.equal(state.world.flags.valedarsena_reputation, preserved.reputation);
  assert.equal(state.world.flags.m1_world_pressure_state, preserved.pressure);
  assert.equal(state.world.flags.friend_beat_01_friend_id, preserved.friend);
  assert.deepEqual(state.player.secondPokemonAcquisition, preserved.second);
  assert.deepEqual(state.quests.SQ_FARM_HERD_HANDS, preserved.quest);
});

test("M1_15 formal completion and all preserved callbacks survive save/reload exactly", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m1-final-"));
  try {
    const { engine } = await makeEngine();
    const store = new SaveStore(dir);
    let state = createNewGameState({ protagonist: "Luke", slot: "m1-final", now: fixedNow });
    state.competition.rank = "E";
    state.competition.rankOrder = 1;
    satisfyExitContract(state);
    state.world.flags.m1_world_pressure_state = "pressure_resolved_local";
    state.world.flags.houndour_ginestre_disposition = "calmed_then_captured";
    state.quests.M1_VALE_LOGISTICS_01 = {
      id: "M1_VALE_LOGISTICS_01",
      title: "Consegna",
      objective: "Test",
      status: "expired",
      resolution: "expired"
    };
    state.story.sceneId = "m01-valedarsena-first-arrival";
    state.story.nodeId = "rank_e_access";

    state = await engine.choose(state, "unlock_m02");
    await store.save(state);
    const loaded = await store.load("m1-final");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.m1_complete, true);
    assert.equal(loaded.world.flags.m02_unlocked, true);
    assert.equal(loaded.competition.rank, "E");
    assert.equal(loaded.world.flags.blue_met, true);
    assert.equal(loaded.world.flags.friend_beat_01_complete, true);
    assert.equal(loaded.world.flags.friends_split, true);
    assert.equal(loaded.world.flags.m1_world_pressure_state, "pressure_resolved_local");
    assert.equal(loaded.quests.M1_VALE_LOGISTICS_01.status, "expired");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
