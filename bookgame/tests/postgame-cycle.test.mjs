import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { createNewGameState } from "../src/engine/state.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import {
  ensurePostgame, finishPostgameEdition, POSTGAME_WORLD_INTERVAL_MINUTES
} from "../src/engine/postgame-cycle.mjs";

function readyPostgame() {
  const state = createNewGameState({ protagonist: "Luke", slot: "slot1" });
  state.competition.rank = "S";
  state.competition.rankOrder = 6;
  state.world.flags = {
    ...state.world.flags,
    m6_complete: true, m07_unlocked: true, m7_active: true,
    m7_complete: true, m7_before_lights_complete: true,
    m7_qualifier_registered: true,
    m12_world_exit_resolved: true, friend_beat_12_complete: true,
    m12_postgame_hooks_complete: true, m12_complete: true,
    main_story_complete: true, postgame_free_roam: true,
    world_qualified: false, worlds_missed: true,
    // Earlier canonical accomplishments are not part of a World bracket reset.
    ancient_mystery_layer_2: true
  };
  state.story.sceneId = "m12-main-story-complete";
  state.story.nodeId = "free_roam";
  return state;
}

test("M12 postgame exposes real actions, recorded first edition and a time-gated qualifier", async () => {
  const engine = new BookgameEngine({ worldEvents: [] });
  let state = readyPostgame();
  const initial = await engine.present(state);
  assert.ok(initial.choices.some((choice) => choice.id === "postgame_training"));
  assert.ok(initial.choices.some((choice) => choice.id === "postgame_history"));
  assert.ok(!initial.choices.some((choice) => choice.id === "postgame_qualifier"));
  assert.deepEqual(state.postgame.championships.map((c) => c.edition), [1]);
  assert.equal(state.postgame.championships[0].result, "missed");
  assert.equal(state.postgame.championships[0].champion, null);

  const firstStart = state.world.elapsedMinutes;
  state = await engine.choose(state, "postgame_training");
  assert.equal(state.world.elapsedMinutes, firstStart + 1440);
  assert.equal(state.postgame.activities.at(-1).kind, "training");
  assert.equal(state.player.roster.length, 1);
  await assert.rejects(engine.choose(state, "postgame_qualifier"), /not available/);
  state = await engine.choose(state, "postgame_history");
  const history = await engine.present(state);
  assert.match(history.text, /2060/);
  assert.deepEqual(history.choices.map((choice) => choice.id), ["postgame_back"]);
  state = await engine.choose(state, "postgame_back");

  for (let year = 0; year < 4; year++) {
    state = await engine.choose(state, "postgame_year");
  }
  assert.ok(state.world.elapsedMinutes >= state.postgame.nextWorldAtMinutes);
  assert.ok((await engine.present(state)).choices.some((choice) => choice.id === "postgame_qualifier"));
  return state;
});

test("second and third edition history persists without resetting team, NPCs or prior World champions", async () => {
  const engine = new BookgameEngine({ worldEvents: [] });
  let state = readyPostgame();
  const roster = structuredClone(state.player.roster);
  const npcs = structuredClone(state.npcs);
  const firstStart = state.world.elapsedMinutes;
  ensurePostgame(state);
  for (let edition = 2; edition <= 3; edition++) {
    for (let year = 0; year < 4; year++) state = await engine.choose(state, "postgame_year");
    const beforeEdition = state.world.elapsedMinutes;
    state = await engine.choose(state, "postgame_qualifier");
    assert.equal(state.competition.world.edition, edition);
    assert.equal(state.competition.world.drawComplete, false);
    assert.equal(state.story.sceneId, "m07-world-qualifier");
    assert.equal(state.world.flags.world_qualified, false);
    assert.equal(state.world.flags.ancient_mystery_layer_2, true);
    assert.deepEqual(state.player.roster, roster);
    assert.deepEqual(state.npcs, npcs);
    assert.ok(beforeEdition >= firstStart + (edition - 1) * POSTGAME_WORLD_INTERVAL_MINUTES);

    const qualifier = await engine.present(state);
    assert.equal(qualifier.nodeId, "qualifier_entry");
    // In production these records are populated by the actual M07–M11
    // Qualifier, group, knockout and Pokémon 5e combat pipeline.
    state.world.flags.world_qualified = true;
    state.world.flags.worlds_missed = false;
    state.world.flags.world_champion = edition === 2;
    state.world.flags.world_eliminated = edition !== 2;
    state.competition.world.finalResolved = true;
    state.competition.world.currentWorldChampion = {
      id: edition === 2 ? "c2060_01_luke" : "c2060_09_red",
      name: edition === 2 ? "Luke" : "Red"
    };
    state.competition.world.currentWorldRunnerUp = {
      id: edition === 2 ? "c2060_09_red" : "c2060_01_luke",
      name: edition === 2 ? "Red" : "Luke"
    };
    state.story.sceneId = "m12-world-exit-branch";
    state.story.nodeId = "world_exit_entry";
    const exit = await engine.present(state);
    assert.ok(exit.choices.some((choice) => choice.id === "postgame_finish_edition"));
    state = await engine.choose(state, "postgame_finish_edition");
    assert.equal(state.story.sceneId, "m12-main-story-complete");
    assert.equal(state.story.nodeId, "free_roam");
    assert.deepEqual(state.postgame.championships.map((entry) => entry.year),
      Array.from({ length: edition }, (_, i) => 2060 + i * 4));
  }

  const savedPath = await mkdtemp(path.join(os.tmpdir(), "p5e-postgame-"));
  try {
    const store = new SaveStore(savedPath);
    await store.save(state);
    const reloaded = await store.load(state.slot);
    assert.deepEqual(reloaded.postgame.championships, state.postgame.championships);
    assert.deepEqual(reloaded.player.roster, roster);
    assert.deepEqual(reloaded.npcs, npcs);
    assert.deepEqual(reloaded.postgame.championships.map((entry) => entry.champion?.name),
      [null, "Luke", "Red"]);
    assert.equal(reloaded.competition.world.edition, 3);
    assert.ok((await engine.present(reloaded)).choices.some((choice) => choice.id === "postgame_history"));
  } finally {
    await rm(savedPath, { recursive: true, force: true });
  }
});

test("postgame never invents a winner for an unresolved played World final", () => {
  const state = readyPostgame();
  ensurePostgame(state);
  state.competition.world.edition = 2;
  state.postgame.phase = "qualifying";
  state.world.flags.worlds_missed = false;
  state.world.flags.world_eliminated = true;
  assert.throws(() => finishPostgameEdition(state), /resolve the official final/);
  assert.equal(state.postgame.championships.length, 1);
  assert.throws(() => ensurePostgame({ world: { flags: {} }, competition: {} }),
    /locked until MAIN_STORY_COMPLETE/);
});
