import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { createNewGameState } from "../src/engine/state.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";

function m12State() {
  const s = createNewGameState({ protagonist: "Luke", slot: "slot1" });
  s.world.locationId = "meridiana_city";
  s.world.visitedLocationIds = ["meridiana_city", "valedarsena_city", "asteria_ginestre"];
  s.world.flags = {
    ...s.world.flags, main_story_complete: true, m12_complete: true,
    m12_world_exit_resolved: true, friend_beat_12_complete: true,
    m12_postgame_hooks_complete: true, world_qualified: false, worlds_missed: true
  };
  s.story.sceneId = "m12-main-story-complete";
  s.story.nodeId = "free_roam";
  return s;
}

test("M12 free roam uses prior M12 travel and existing M01 scenes; journal never teleports", async () => {
  const engine = new BookgameEngine({ worldEvents: [] });
  let state = m12State();
  const before = structuredClone(state);
  const home = await engine.present(state);
  assert.ok(home.choices.some((c) => c.id === "postgame_visit_valedarsena"));
  state = await engine.choose(state, "postgame_visit_valedarsena");
  assert.equal(state.world.elapsedMinutes, before.world.elapsedMinutes + 120);
  assert.equal(state.world.locationId, "valedarsena_city");
  assert.equal(state.story.sceneId, "m01-valedarsena-first-arrival");
  assert.equal(state.story.nodeId, "city_hub");
  assert.equal(state.world.flags.main_story_complete, true);
  assert.deepEqual(state.player.roster, before.player.roster);

  const city = await engine.present(state);
  assert.ok(city.choices.some((c) => c.id === "postgame_open_journal"));
  assert.ok(city.choices.some((c) => c.id === "ginestre"));
  state = await engine.choose(state, "ginestre");
  assert.equal(state.world.locationId, "asteria_ginestre");
  assert.equal(state.story.sceneId, "m01-ginestre-crossroads");

  const open = await engine.present(state);
  assert.ok(open.choices.some((c) => c.id === "postgame_open_journal"));
  state = await engine.choose(state, "postgame_open_journal");
  assert.equal(state.story.sceneId, "m12-main-story-complete");
  assert.equal(state.world.locationId, "asteria_ginestre");
  const diary = await engine.present(state);
  assert.ok(diary.choices.some((c) => c.id === "postgame_resume_exploration"));
  state = await engine.choose(state, "postgame_resume_exploration");
  assert.equal(state.story.sceneId, "m01-ginestre-crossroads");
  assert.equal(state.story.nodeId, "crossroads");
  assert.equal(state.world.locationId, "asteria_ginestre");
  assert.equal(state.world.flags.main_story_complete, true);
});

test("record multiple authored postgame events in one save; no free money/XP/Pokemon", async () => {
  const engine = new BookgameEngine({ worldEvents: [] });
  let state = m12State();
  await engine.present(state);
  const player = structuredClone(state.player);
  const choices = ["postgame_patrol", "postgame_research", "postgame_patrol"];
  for (const id of choices) state = await engine.choose(state, id);
  assert.deepEqual(state.postgame.activities.map(e => e.templateId),
    ["PGR_PATROL", "PGR_ARCHIVE", "PGR_PATROL"]);
  assert.equal(new Set(state.postgame.activities.map(e => e.id)).size, 3);
  assert.ok(state.postgame.activities.every(e => e.locationId === "meridiana_city"));
  assert.match((await engine.present(state)).text, /Ultimo evento:/);
  assert.deepEqual(state.player, player);
  const dir = await mkdtemp(path.join(os.tmpdir(), "postgame-roam-"));
  try {
    const store = new SaveStore(dir);
    await store.save(state);
    const loaded = await store.load(state.slot);
    assert.deepEqual(loaded.postgame.activities, state.postgame.activities);
    assert.deepEqual(loaded.postgame.championships, state.postgame.championships);
    assert.deepEqual(loaded.world.visitedLocationIds, state.world.visitedLocationIds);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("unvisited location is blocked and return to Meridiana costs actual travel time", async () => {
  const engine = new BookgameEngine({ worldEvents: [] });
  let state = m12State();
  state.world.visitedLocationIds = ["meridiana_city"];
  assert.ok(!(await engine.present(state)).choices.some((c) => c.id === "postgame_visit_valedarsena"));
  await assert.rejects(engine.choose(state, "postgame_visit_valedarsena"), /must have been visited/);
  state.world.visitedLocationIds.push("valedarsena_city");
  state = await engine.choose(state, "postgame_visit_valedarsena");
  state = await engine.choose(state, "postgame_open_journal");
  const start = state.world.elapsedMinutes;
  state = await engine.choose(state, "postgame_return_meridiana");
  assert.equal(state.world.elapsedMinutes, start + 120);
  assert.equal(state.world.locationId, "meridiana_city");
  assert.equal(state.story.sceneId, "m12-main-story-complete");
  assert.equal(state.world.flags.main_story_complete, true);
});
