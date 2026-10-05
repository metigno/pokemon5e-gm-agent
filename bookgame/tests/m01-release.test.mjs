import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileStory } from "../src/compiler/story-compiler.mjs";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";
import { setNpcSchedule } from "../src/engine/npc-state.mjs";

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../content/modules/", import.meta.url));
const fixedNow = () => "2026-10-05T06:00:00.000Z";

async function compiledRepository() {
  const bundle = await compileStory({ scenesDir, modulesDir });
  return {
    async load(sceneId) {
      const scene = bundle.scenes[sceneId];
      if (!scene) throw new Error("missing scene " + sceneId);
      return structuredClone(scene);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents ?? []);
    }
  };
}

test("M1_00 normal release starts in real free-roam with three non-mandatory directions", async () => {
  const engine = new BookgameEngine({ scenes: await compiledRepository(), now: fixedNow });
  const state = createNewGameState({ protagonist: "Luke", now: fixedNow });

  assert.equal(state.world.flags.intro_complete, true);
  assert.equal(state.world.flags.free_roam, true);
  assert.equal(state.story.sceneId, "m01-release");
  assert.equal(state.story.nodeId, "free_roam");
  assert.equal(state.world.locationId, "asteria_campus_exit");
  assert.deepEqual(state.quests, {});

  const view = await engine.present(state);
  const choiceIds = view.choices.map((choice) => choice.id);
  assert.deepEqual(choiceIds, ["to_ginestre", "to_valedarsena", "to_farm", "stay_and_observe"]);
  assert.match(view.text, /Promotion Trial/i);

  const routes = [
    ["to_ginestre", "m01-first-road", "road_entry", "asteria_ginestre", 20],
    ["to_valedarsena", "m01-valedarsena-first-arrival", "approach", "valedarsena_city", 90],
    ["to_farm", "m01-farm-first-arrival", "approach", "asteria_farm_road", 90]
  ];

  for (const [choiceId, sceneId, nodeId, locationId, minutes] of routes) {
    const next = await engine.choose(state, choiceId);
    assert.equal(next.story.sceneId, sceneId);
    assert.equal(next.story.nodeId, nodeId);
    assert.equal(next.world.locationId, locationId);
    assert.equal(next.world.elapsedMinutes, state.world.elapsedMinutes + minutes);
    assert.equal(next.world.flags.free_roam, true);
    assert.deepEqual(next.quests, {});
  }
});

test("M1_00 player can ignore all suggested roads while NPC schedules and world events advance", async () => {
  const worldEvents = [
    {
      id: "TEST_OFFSCREEN_ADVANCE",
      once: true,
      trigger: {
        path: "world.elapsedMinutes",
        gte: 510
      },
      outcomes: [
        {
          id: "advanced",
          effects: [
            {
              type: "set_flag",
              key: "offscreen_world_advanced",
              value: true
            }
          ]
        }
      ]
    }
  ];
  const engine = new BookgameEngine({
    scenes: await compiledRepository(),
    worldEvents,
    now: fixedNow
  });
  const state = createNewGameState({ protagonist: "Luke", now: fixedNow });

  setNpcSchedule(state, {
    npcId: "Blue",
    scheduleId: "release_window",
    locationId: "asteria_campus_exit",
    startsAtMinutes: 470,
    endsAtMinutes: 500
  });
  assert.equal(state.npcs.Blue.schedule.present, true);

  const next = await engine.choose(state, "stay_and_observe");

  assert.equal(next.story.sceneId, "m01-release");
  assert.equal(next.story.nodeId, "free_roam");
  assert.equal(next.world.elapsedMinutes, 510);
  assert.equal(next.npcs.Blue.schedule.present, false);
  assert.equal(next.world.flags.offscreen_world_advanced, true);
  assert.equal(next.events.TEST_OFFSCREEN_ADVANCE.status, "resolved");
  assert.equal(next.world.flags.free_roam, true);
  assert.deepEqual(next.quests, {});
});

test("M1_00 save/reload immediately after free-roam preserves the exact release point", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m1-release-"));
  try {
    const store = new SaveStore(dir);
    const state = createNewGameState({
      protagonist: "Luke",
      slot: "m1-release",
      now: fixedNow
    });

    await store.save(state);
    const loaded = await store.load("m1-release");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.intro_complete, true);
    assert.equal(loaded.world.flags.free_roam, true);
    assert.equal(loaded.story.sceneId, "m01-release");
    assert.equal(loaded.story.nodeId, "free_roam");
    assert.equal(loaded.world.locationId, "asteria_campus_exit");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("M1_00 save/reload after choosing a road resumes that exact branch", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m1-road-"));
  try {
    const store = new SaveStore(dir);
    const engine = new BookgameEngine({ scenes: await compiledRepository(), now: fixedNow });
    let state = createNewGameState({
      protagonist: "Luke",
      slot: "m1-road",
      now: fixedNow
    });

    state = await engine.choose(state, "to_farm");
    await store.save(state);
    const loaded = await store.load("m1-road");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.story.sceneId, "m01-farm-first-arrival");
    assert.equal(loaded.story.nodeId, "approach");
    assert.equal(loaded.world.locationId, "asteria_farm_road");
    assert.equal(loaded.world.flags.free_roam, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
