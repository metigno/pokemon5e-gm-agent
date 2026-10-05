import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { compileStory } from "../src/compiler/story-compiler.mjs";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../content/modules/", import.meta.url));
const fixedNow = () => "2026-10-05T06:40:00.000Z";

async function makeRepository() {
  const bundle = await compileStory({ scenesDir, modulesDir });
  return {
    bundle,
    scenes: {
      async load(sceneId) {
        const scene = bundle.scenes[sceneId];
        if (!scene) throw new Error("missing scene " + sceneId);
        return structuredClone(scene);
      },
      async loadWorldEvents() {
        return structuredClone(bundle.worldEvents ?? []);
      }
    }
  };
}

function forkState() {
  const state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.world.locationId = "asteria_ginestre";
  state.story.sceneId = "m01-ginestre-crossroads";
  state.story.nodeId = "crossroads";
  return state;
}

test("M1_03 first fork exposes city, farm, local exploration and staying with no required correct route", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  const state = forkState();

  const view = await engine.present(state);
  const ids = view.choices.map((choice) => choice.id);

  assert.ok(ids.includes("to_valedarsena"));
  assert.ok(ids.includes("to_farm"));
  assert.ok(ids.includes("inspect_signs"));
  assert.ok(ids.includes("observe_wildlife"));
  assert.ok(ids.includes("stay"));
  assert.ok(ids.includes("watch_morning"));
  assert.equal(ids.some((id) => id.startsWith("review_houndour_")), false);
  assert.equal(ids.includes("review_pressure"), false);
});

test("M1_03 direct Valedarsena and Farm routes are peer exits with equal travel cost", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });

  const cityStart = forkState();
  const cityBefore = cityStart.world.elapsedMinutes;
  const city = await engine.choose(cityStart, "to_valedarsena");
  assert.equal(city.world.elapsedMinutes, cityBefore + 70);
  assert.equal(city.world.locationId, "valedarsena_road");
  assert.equal(city.world.flags.m1_first_fork_choice, "valedarsena");
  assert.equal(city.story.sceneId, "m01-valedarsena-first-arrival");
  assert.equal(city.story.nodeId, "approach");

  const farmStart = forkState();
  const farmBefore = farmStart.world.elapsedMinutes;
  const farm = await engine.choose(farmStart, "to_farm");
  assert.equal(farm.world.elapsedMinutes, farmBefore + 70);
  assert.equal(farm.world.locationId, "asteria_farm_road");
  assert.equal(farm.world.flags.m1_first_fork_choice, "farm");
  assert.equal(farm.story.sceneId, "m01-farm-first-arrival");
  assert.equal(farm.story.nodeId, "approach");
});

test("M1_03 staying in Ginestre advances time and can let the world progress off-screen", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  const state = forkState();

  // Twenty minutes before day 3 begins.
  state.world.elapsedMinutes = (2 * 1440) - 20;
  state.world.day = 2;
  state.world.minuteOfDay = 1420;
  state.world.time = "evening";

  const next = await engine.choose(state, "stay");

  assert.equal(next.world.elapsedMinutes, (2 * 1440) + 10);
  assert.equal(next.world.day, 3);
  assert.equal(next.story.nodeId, "ginestre_pause");
  assert.equal(next.world.flags.m1_first_fork_context, "stayed_in_ginestre");
  assert.equal(next.events.A1_WORLD_MOVES.status, "resolved");
  assert.equal(next.world.flags.m1_world_pressure_state, "pressure_unnoticed");
});

test("M1_03 Ginestre pause is a real loop and can consume repeated world time", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = forkState();

  state = await engine.choose(state, "stay");
  const afterFirst = state.world.elapsedMinutes;
  state = await engine.choose(state, "wait_again");

  assert.equal(state.story.sceneId, "m01-ginestre-crossroads");
  assert.equal(state.story.nodeId, "ginestre_pause");
  assert.equal(state.world.elapsedMinutes, afterFirst + 30);

  state = await engine.choose(state, "back");
  assert.equal(state.story.nodeId, "crossroads");
});

test("M1_03 reads calm Houndour outcome without making it mandatory", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = forkState();
  state.world.flags.houndour_ginestre_disposition = "calm";
  state.world.flags.houndour_ginestre_escalation = "deescalated";
  state.world.flags.houndour_ginestre_available = false;

  const view = await engine.present(state);
  const ids = view.choices.map((choice) => choice.id);
  assert.ok(ids.includes("review_houndour_calm"));
  assert.ok(ids.includes("to_valedarsena"));
  assert.ok(ids.includes("to_farm"));

  state = await engine.choose(state, "review_houndour_calm");
  assert.equal(state.story.nodeId, "houndour_calm_context");

  state = await engine.choose(state, "back");
  assert.equal(state.world.flags.m1_first_fork_houndour_context, "calm_behavior");
  assert.equal(state.story.nodeId, "crossroads");
});

test("M1_03 reads captured Houndour as roster context, not as a forced destination", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  const state = forkState();
  state.world.flags.houndour_ginestre_disposition = "captured";
  state.world.flags.houndour_ginestre_escalation = "capture";
  state.world.flags.houndour_ginestre_available = false;
  state.player.roster.push({ speciesId: "houndour", name: "Houndour", level: 3 });

  const view = await engine.present(state);
  const ids = view.choices.map((choice) => choice.id);

  assert.ok(ids.includes("review_houndour_captured"));
  assert.ok(ids.includes("to_valedarsena"));
  assert.ok(ids.includes("to_farm"));
  assert.ok(ids.includes("stay"));
});

test("M1_03 known world-pressure clue replaces redundant discovery check with contextual follow-up", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = forkState();
  state.world.flags.m1_world_pressure_known = true;

  const view = await engine.present(state);
  const ids = view.choices.map((choice) => choice.id);
  assert.equal(ids.includes("inspect_signs"), false);
  assert.ok(ids.includes("review_pressure"));

  state = await engine.choose(state, "review_pressure");
  assert.equal(state.story.nodeId, "pressure_context");

  const city = await engine.choose(state, "city");
  assert.equal(city.world.locationId, "valedarsena_road");
  assert.equal(city.world.flags.m1_first_fork_choice, "valedarsena");
  assert.equal(city.world.elapsedMinutes, state.world.elapsedMinutes + 70);
});

test("M1_03 failed Perception does not trap the player and both roads remain available", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({
    scenes,
    dice: new SequenceDice([1]),
    now: fixedNow
  });
  let state = forkState();

  state = await engine.choose(state, "inspect_signs");
  assert.equal(state.story.nodeId, "tracks_failure");

  const view = await engine.present(state);
  const ids = view.choices.map((choice) => choice.id);
  assert.ok(ids.includes("city_anyway"));
  assert.ok(ids.includes("farm_anyway"));
  assert.ok(ids.includes("back"));

  state = await engine.choose(state, "farm_anyway");
  assert.equal(state.world.locationId, "asteria_farm_road");
  assert.equal(state.world.flags.m1_first_fork_choice, "farm");
  assert.equal(state.story.sceneId, "m01-farm-first-arrival");
});

test("M1_03 time-sensitive local observation exposes only the current daypart route", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  const state = forkState();

  state.world.elapsedMinutes = 17 * 60 + 50;
  state.world.day = 1;
  state.world.minuteOfDay = 17 * 60 + 50;
  state.world.time = "afternoon";

  const view = await engine.present(state);
  const ids = view.choices.map((choice) => choice.id);
  assert.ok(ids.includes("watch_afternoon"));
  assert.equal(ids.includes("watch_morning"), false);
  assert.equal(ids.includes("watch_evening"), false);
  assert.equal(ids.includes("watch_night"), false);

  const next = await engine.choose(state, "watch_afternoon");
  assert.equal(next.world.elapsedMinutes, (17 * 60 + 50) + 15);
  assert.equal(next.world.time, "evening");
  assert.equal(next.story.nodeId, "time_afternoon");
});

test("M1_03 alternate information routes update location and fork history exactly like direct routes", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({
    scenes,
    dice: new SequenceDice([20]),
    now: fixedNow
  });
  let state = forkState();

  state = await engine.choose(state, "inspect_signs");
  assert.equal(state.story.nodeId, "tracks_success");
  state = await engine.choose(state, "city_followup");

  assert.equal(state.world.locationId, "valedarsena_road");
  assert.equal(state.world.flags.m1_first_fork_choice, "valedarsena");
  assert.equal(state.story.sceneId, "m01-valedarsena-first-arrival");
});
