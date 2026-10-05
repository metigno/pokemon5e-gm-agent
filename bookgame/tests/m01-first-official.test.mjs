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
const fixedNow = () => "2026-10-05T09:05:00.000Z";
const MINUTES_PER_DAY = 24 * 60;

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

function setDay(state, day, minuteOfDay = 8 * 60) {
  state.world.elapsedMinutes = ((day - 1) * MINUTES_PER_DAY) + minuteOfDay;
  state.world.day = day;
  state.world.minuteOfDay = minuteOfDay;
  state.world.time =
    minuteOfDay < 6 * 60 ? "night" :
    minuteOfDay < 12 * 60 ? "morning" :
    minuteOfDay < 18 * 60 ? "afternoon" : "evening";
  return state;
}

async function toArenaWithOpportunity(engine, { level = 1, day = 2 } = {}) {
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.player.trainerLevel = level;
  setDay(state, day);
  state.story.sceneId = "m01-ginestre-crossroads";
  state.story.nodeId = "crossroads";
  state.world.locationId = "asteria_ginestre";

  state = await engine.choose(state, "to_valedarsena");
  assert.equal(state.world.flags.valedarsena_discovered, true);
  assert.equal(state.events.A1_FIRST_OFFICIAL_WINDOW.status, "resolved");
  assert.equal(state.world.flags.official_match_opportunity, true);

  state = await engine.choose(state, "arena");
  assert.equal(state.story.nodeId, "arena_front");
  return state;
}

test("M1_10 authored opportunity opens the first official match even below Trainer Lv2", async () => {
  const { engine } = await makeEngine();
  const state = await toArenaWithOpportunity(engine, { level: 1, day: 2 });

  const view = await engine.present(state);
  assert.ok(view.choices.some((choice) => choice.id === "first_official"));
});

test("M1_10 Trainer Lv2 remains an independent legal trigger without an authored opportunity flag", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.player.trainerLevel = 2;
  state.world.flags.official_match_opportunity = false;
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "arena_front";
  state.world.locationId = "valedarsena_arena";

  const view = await engine.present(state);
  assert.ok(view.choices.some((choice) => choice.id === "first_official"));
});

test("M1_10 deferring the offered match does not invent a result or consume the opportunity", async () => {
  const { engine } = await makeEngine();
  let state = await toArenaWithOpportunity(engine);

  state = await engine.choose(state, "first_official");
  state = await engine.choose(state, "defer_first_official");

  assert.equal(state.competition.firstOfficialResolved, false);
  assert.equal(state.competition.firstOfficialResult, null);
  assert.equal(state.world.flags.official_match_opportunity, true);
  assert.equal(state.competition.history.length, 0);
  assert.equal(state.story.nodeId, "arena_front");
});

test("M1_10 sanctioned format registers exactly one player Pokémon even when more are owned", async () => {
  const { engine } = await makeEngine();
  let state = await toArenaWithOpportunity(engine);
  state.player.roster.push({
    speciesId: "houndour",
    name: "Houndour",
    level: 3,
    abilityId: "early-bird"
  });

  state = await engine.choose(state, "first_official");
  state = await engine.choose(state, "accept_first_official");

  assert.equal(state.pending.type, "pokemon5e_combat");
  assert.equal(state.pending.playerPokemon.rosterIndex, 0);
  assert.deepEqual(state.pending.playerBench, []);
  assert.equal(state.pending.opponent.species, "Shinx");
  assert.equal(state.pending.opponent.level, 2);
  assert.equal(state.pending.opponent.trainerId, "VALE_ROOKIE_001");
  assert.equal(state.pending.opponentRegistered, true);
  assert.equal(state.pending.competition.officialRosterSize, 1);
  assert.equal(state.pending.competition.format, "Singles");
  assert.equal(state.pending.competition.difficulty, "STANDARD");
});

test("M1_10 loss resolves the canonical event, persists factual history and never changes Rank F", async () => {
  const { engine } = await makeEngine();
  let state = await toArenaWithOpportunity(engine);

  state = await engine.choose(state, "first_official");
  state = await engine.choose(state, "accept_first_official");
  state = engine.resolveCombatHandoff(state, "lose");

  assert.equal(state.story.nodeId, "first_official_loss");
  assert.equal(state.competition.firstOfficialResolved, true);
  assert.equal(state.competition.firstOfficialResult, "lose");
  assert.equal(state.competition.rank, "F");
  assert.equal(state.competition.rankOrder, 0);
  assert.equal(state.world.flags.first_official_resolved, true);
  assert.equal(state.world.flags.first_official_result, "lose");
  assert.equal(state.world.flags.first_official_match_id, "A1_FIRST_OFFICIAL");
  assert.equal(state.world.flags.official_match_opportunity, false);

  const record = state.competition.history.at(-1);
  assert.equal(record.matchId, "A1_FIRST_OFFICIAL");
  assert.equal(record.type, "official_match");
  assert.equal(record.outcome, "lose");
  assert.equal(record.opponentTrainerId, "VALE_ROOKIE_001");
  assert.equal(record.officialRosterSize, 1);
  assert.equal(record.difficulty, "STANDARD");
  assert.equal(state.competition.trials.RANK_F_TO_E, undefined);
});

test("M1_10 win is recorded but still does not promote the player or complete a Trial", async () => {
  const { engine } = await makeEngine();
  let state = await toArenaWithOpportunity(engine);

  state = await engine.choose(state, "first_official");
  state = await engine.choose(state, "accept_first_official");
  state = engine.resolveCombatHandoff(state, "win");

  assert.equal(state.story.nodeId, "first_official_win");
  assert.equal(state.competition.firstOfficialResolved, true);
  assert.equal(state.competition.firstOfficialResult, "win");
  assert.equal(state.world.flags.first_official_result, "win");
  assert.equal(state.competition.rank, "F");
  assert.deepEqual(state.competition.trials, {});
  assert.equal(state.competition.history.at(-1).outcome, "win");
});

test("M1_10 completed first official disappears from Arena choices and cannot replay", async () => {
  const { engine } = await makeEngine();
  let state = await toArenaWithOpportunity(engine);

  state = await engine.choose(state, "first_official");
  state = await engine.choose(state, "accept_first_official");
  state = engine.resolveCombatHandoff(state, "lose");
  state = await engine.choose(state, "back_after_loss");

  const view = await engine.present(state);
  assert.ok(!view.choices.some((choice) => choice.id === "first_official"));
});

test("M1_10 explicit result callbacks and official history survive save/reload exactly", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m1-first-official-"));
  try {
    const { engine } = await makeEngine();
    const store = new SaveStore(dir);
    let state = await toArenaWithOpportunity(engine);
    state.slot = "m1-first-official";

    state = await engine.choose(state, "first_official");
    state = await engine.choose(state, "accept_first_official");
    state = engine.resolveCombatHandoff(state, "win");

    await store.save(state);
    const loaded = await store.load("m1-first-official");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.competition.firstOfficialResolved, true);
    assert.equal(loaded.competition.firstOfficialResult, "win");
    assert.equal(loaded.world.flags.first_official_resolved, true);
    assert.equal(loaded.world.flags.first_official_result, "win");
    assert.equal(loaded.competition.history.at(-1).matchId, "A1_FIRST_OFFICIAL");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
