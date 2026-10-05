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
const fixedNow = () => "2026-10-05T09:40:00.000Z";
const FIVE = ["Luke", "Mattew", "Daniel", "Edward", "Fab"];
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

function atCity(state) {
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "city_hub";
  state.world.locationId = "valedarsena_city";
  state.world.flags.first_settlement_reached = true;
  state.world.flags.valedarsena_discovered = true;
  return state;
}

function setDay(state, day, minuteOfDay = 9 * 60) {
  state.world.elapsedMinutes = ((day - 1) * MINUTES_PER_DAY) + minuteOfDay;
  state.world.day = day;
  state.world.minuteOfDay = minuteOfDay;
  state.world.time =
    minuteOfDay < 6 * 60 ? "night" :
    minuteOfDay < 12 * 60 ? "morning" :
    minuteOfDay < 18 * 60 ? "afternoon" : "evening";
  return state;
}

test("M1_12 does not split the Five before any canonical trigger", async () => {
  const { engine } = await makeEngine();
  let state = atCity(createNewGameState({ protagonist: "Luke", now: fixedNow }));

  state = await engine.choose(state, "center");

  assert.equal(state.events.A1_FIVE_ROADS, undefined);
  assert.equal(state.world.flags.friends_split, undefined);
});

test("M1_12 Trainer level 3 splits exactly the other Four for every protagonist", async () => {
  for (const protagonist of FIVE) {
    const { engine } = await makeEngine();
    let state = atCity(createNewGameState({ protagonist, now: fixedNow }));
    state.player.trainerLevel = 3;

    state = await engine.choose(state, "center");

    assert.equal(state.events.A1_FIVE_ROADS.status, "resolved");
    assert.equal(state.world.flags.friends_split, true);
    assert.ok(FIVE.includes(state.world.flags.m1_five_roads_focus_friend_id));
    assert.notEqual(state.world.flags.m1_five_roads_focus_friend_id, protagonist);
    assert.equal(state.npcs[protagonist], undefined);

    for (const friendId of FIVE.filter((id) => id !== protagonist)) {
      assert.ok(state.npcs[friendId].schedule, protagonist + " missing schedule for " + friendId);
      assert.match(state.npcs[friendId].schedule.id, /^m1_split_/);
      assert.equal(typeof state.npcs[friendId].state.fiveRoadsPath, "string");
      assert.notEqual(state.npcs[friendId].state.recentResult, "none");
    }
  }
});

test("M1_12 also triggers from Rank E without requiring level 3 or day 7", async () => {
  const { engine } = await makeEngine();
  let state = atCity(createNewGameState({ protagonist: "Luke", now: fixedNow }));
  state.competition.rank = "E";
  state.competition.rankOrder = 1;

  state = await engine.choose(state, "center");

  assert.equal(state.events.A1_FIVE_ROADS.status, "resolved");
  assert.equal(state.world.flags.friends_split, true);
});

test("M1_12 also triggers on world day 7 and final split schedules override the old day rotation", async () => {
  const { engine } = await makeEngine();
  let state = atCity(createNewGameState({ protagonist: "Luke", now: fixedNow }));
  setDay(state, 7);

  state = await engine.choose(state, "center");

  assert.equal(state.events.A1_FRIENDS_M1_SCHEDULE_START.status, "resolved");
  assert.equal(state.events.A1_FRIENDS_M1_DAY4.status, "resolved");
  assert.equal(state.events.A1_FIVE_ROADS.status, "resolved");
  assert.equal(state.world.flags.friends_split, true);
  for (const friendId of FIVE.filter((id) => id !== "Luke")) {
    assert.match(state.npcs[friendId].schedule.id, /^m1_split_/);
  }
});

test("M1_12 exposes one concrete divergence update in Valedarsena and records it once", async () => {
  const { engine } = await makeEngine();
  let state = atCity(createNewGameState({ protagonist: "Luke", now: fixedNow }));
  state.player.trainerLevel = 3;

  state = await engine.choose(state, "center");
  state = await engine.choose(state, "back_city");

  let view = await engine.present(state);
  assert.ok(view.choices.some((choice) => choice.id === "five_roads_update"));

  state = await engine.choose(state, "five_roads_update");
  assert.equal(state.story.sceneId, "m01-five-roads");
  assert.equal(state.story.nodeId, "dispatch");

  view = await engine.present(state);
  assert.deepEqual(view.choices.map((choice) => choice.id), ["focus_mattew"]);

  state = await engine.choose(state, "focus_mattew");
  view = await engine.present(state);
  assert.match(view.text, /Promotion Trial|preparazione/i);

  state = await engine.choose(state, "acknowledge");
  assert.equal(state.world.flags.m1_five_roads_seen, true);
  assert.equal(state.story.sceneId, "m01-valedarsena-first-arrival");
  assert.equal(state.story.nodeId, "city_hub");

  view = await engine.present(state);
  assert.ok(!view.choices.some((choice) => choice.id === "five_roads_update"));
});

test("M1_12 split event is one-shot and later actions do not rewrite divergence schedules", async () => {
  const { engine } = await makeEngine();
  let state = atCity(createNewGameState({ protagonist: "Daniel", now: fixedNow }));
  state.player.trainerLevel = 3;

  state = await engine.choose(state, "center");
  const before = Object.fromEntries(
    FIVE.filter((id) => id !== "Daniel").map((id) => [id, structuredClone(state.npcs[id].schedule)])
  );
  const firedAt = state.events.A1_FIVE_ROADS.firedAtMinutes;

  state = await engine.choose(state, "back_city");
  state = await engine.choose(state, "center");
  state = await engine.choose(state, "back_city");

  assert.equal(state.events.A1_FIVE_ROADS.firedAtMinutes, firedAt);
  for (const [friendId, schedule] of Object.entries(before)) {
    assert.deepEqual(state.npcs[friendId].schedule, schedule);
  }
});

test("M1_12 friends split, schedules and visible callback survive save/reload exactly", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m1-five-roads-"));
  try {
    const { engine } = await makeEngine();
    const store = new SaveStore(dir);
    let state = atCity(createNewGameState({ protagonist: "Fab", slot: "m1-five-roads", now: fixedNow }));
    setDay(state, 7);

    state = await engine.choose(state, "center");
    state = await engine.choose(state, "back_city");

    await store.save(state);
    const loaded = await store.load("m1-five-roads");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.friends_split, true);
    assert.equal(loaded.world.flags.m1_five_roads_focus_friend_id, "Luke");
    assert.equal(loaded.npcs.Luke.state.fiveRoadsPath, "long_route");

    const view = await engine.present(loaded);
    assert.ok(view.choices.some((choice) => choice.id === "five_roads_update"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
