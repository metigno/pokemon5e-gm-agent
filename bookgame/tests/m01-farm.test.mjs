import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { compileStory } from "../src/compiler/story-compiler.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../content/modules/", import.meta.url));
const fixedNow = () => "2026-10-05T08:18:00.000Z";

async function makeRepository(dice = new SequenceDice([20, 20, 20])) {
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
  return { engine: new BookgameEngine({ scenes, dice, now: fixedNow }), bundle };
}

function atFarm(state) {
  state.story.sceneId = "m01-farm-first-arrival";
  state.story.nodeId = "approach";
  state.world.locationId = "asteria_farm_road";
  return state;
}

test("M1_06 exposes every required non-forced approach and no authored combat", async () => {
  const { bundle } = await makeRepository();
  const scene = bundle.scenes["m01-farm-first-arrival"];
  const briefingIds = scene.nodes.briefing.choices.map((choice) => choice.id);

  assert.ok(briefingIds.includes("tracks"));
  assert.ok(briefingIds.includes("handling"));
  assert.ok(briefingIds.includes("pokemon_support"));
  assert.ok(briefingIds.includes("follow_worker"));
  assert.ok(briefingIds.includes("decline"));
  assert.ok(scene.nodes.tracks_failure.choices.some((choice) => choice.id === "ask_help"));

  const serialized = JSON.stringify(scene);
  assert.equal(serialized.includes('"combat"'), false);
});

test("M1_06 observing first and then volunteering starts a real quest before completion", async () => {
  const { engine } = await makeRepository(new SequenceDice([20]));
  let state = atFarm(createNewGameState({ protagonist: "Luke", now: fixedNow }));

  state = await engine.choose(state, "observe");
  assert.equal(state.story.nodeId, "observe_success");
  assert.equal(state.world.locationId, "asteria_farm");
  assert.equal(state.world.flags.m1_world_pressure_known, true);
  assert.equal(state.world.flags.m1_farm_evidence, true);

  state = await engine.choose(state, "help");
  assert.equal(state.story.nodeId, "briefing");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.status, "active");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.deadlineAtMinutes, state.world.elapsedMinutes + 360);
});

test("M1_06 direct volunteering creates a local deadline without replacing an existing board deadline", async () => {
  const { engine } = await makeRepository();
  let state = atFarm(createNewGameState({ protagonist: "Luke", now: fixedNow }));
  const directStart = state.world.elapsedMinutes;

  state = await engine.choose(state, "job");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.status, "active");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.deadlineAtMinutes, directStart + 360);

  const preservedDeadline = directStart + 999;
  state = atFarm(createNewGameState({ protagonist: "Luke", now: fixedNow }));
  state.quests.SQ_FARM_HERD_HANDS = {
    id: "SQ_FARM_HERD_HANDS",
    title: "Recinti aperti",
    objective: "Test",
    status: "active",
    offeredAtMinutes: directStart - 10,
    startedAtMinutes: directStart - 5,
    deadlineAtMinutes: preservedDeadline,
    resolvedAtMinutes: null,
    resolution: null,
    resolvedBy: null,
    onDeadline: { status: "completed", resolution: "board_owned", resolvedBy: "farm_workers" }
  };

  state = await engine.choose(state, "job");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.deadlineAtMinutes, preservedDeadline);
});

test("M1_06 own-Pokemon cooperation completes the job with factual persistent callbacks", async () => {
  const { engine } = await makeRepository();
  let state = atFarm(createNewGameState({ protagonist: "Luke", now: fixedNow }));

  state = await engine.choose(state, "job");
  state = await engine.choose(state, "pokemon_support");
  assert.equal(state.story.nodeId, "pokemon_support_plan");
  assert.equal(state.world.flags.m1_farm_pokemon_support, true);

  state = await engine.choose(state, "hold_line");
  assert.equal(state.story.nodeId, "job_complete");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.status, "completed");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.resolution, "herd_recovered_with_pokemon_support");
  assert.equal(state.world.flags.m1_world_pressure_known, true);
  assert.equal(state.world.flags.m1_world_pressure_player_involved, true);
  assert.equal(state.world.flags.m1_farm_helped, true);
  assert.equal(state.world.flags.m1_farm_evidence, true);
});

test("M1_06 following worker instructions is a legal successful route", async () => {
  const { engine } = await makeRepository();
  let state = atFarm(createNewGameState({ protagonist: "Luke", now: fixedNow }));

  state = await engine.choose(state, "job");
  state = await engine.choose(state, "follow_worker");
  assert.equal(state.story.nodeId, "guided_help");

  state = await engine.choose(state, "complete");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.status, "completed");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.resolution, "herd_recovered_under_worker_guidance");
});

test("M1_06 Investigation and Animal Handling preserve failure recovery instead of trapping the player", async () => {
  const { engine } = await makeRepository(new SequenceDice([1, 1]));
  let state = atFarm(createNewGameState({ protagonist: "Luke", now: fixedNow }));

  state = await engine.choose(state, "job");
  state = await engine.choose(state, "tracks");
  assert.equal(state.story.nodeId, "tracks_failure");

  const view = await engine.present(state);
  assert.equal(view.choices.some((choice) => choice.id === "handling"), true);
  assert.equal(view.choices.some((choice) => choice.id === "ask_help"), true);

  state = await engine.choose(state, "ask_help");
  state = await engine.choose(state, "complete");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.status, "completed");
});

test("M1_06 abandonment records the factual result and lets farm workers continue without player credit", async () => {
  const { engine } = await makeRepository();
  let state = atFarm(createNewGameState({ protagonist: "Luke", now: fixedNow }));

  state = await engine.choose(state, "job");
  state = await engine.choose(state, "decline");
  state = await engine.choose(state, "ginestre");

  assert.equal(state.quests.SQ_FARM_HERD_HANDS.status, "failed");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.resolution, "abandoned");
  assert.equal(state.world.flags.m1_farm_abandoned, true);
  assert.equal(state.world.flags.m1_farm_helped, undefined);
  assert.equal(state.world.locationId, "asteria_ginestre");
});

test("M1_06 farm exits keep world.locationId synchronized with the destination", async () => {
  const { engine } = await makeRepository();

  let state = atFarm(createNewGameState({ protagonist: "Luke", now: fixedNow }));
  state = await engine.choose(state, "leave_crossroads");
  assert.equal(state.world.locationId, "asteria_ginestre");
  assert.equal(state.story.sceneId, "m01-ginestre-crossroads");

  state = atFarm(createNewGameState({ protagonist: "Luke", now: fixedNow }));
  state = await engine.choose(state, "leave_city");
  assert.equal(state.world.locationId, "valedarsena_city");
  assert.equal(state.world.flags.first_settlement_reached, true);
  assert.equal(state.world.flags.valedarsena_discovered, true);
});

test("M1_06 completion preserves farm evidence even when returning to Ginestre", async () => {
  const { engine } = await makeRepository();
  let state = atFarm(createNewGameState({ protagonist: "Luke", now: fixedNow }));

  state = await engine.choose(state, "job");
  state = await engine.choose(state, "follow_worker");
  state = await engine.choose(state, "complete");
  state = await engine.choose(state, "ginestre");

  assert.equal(state.world.locationId, "asteria_ginestre");
  assert.equal(state.world.flags.m1_world_pressure_known, true);
  assert.equal(state.world.flags.m1_farm_evidence, true);
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.status, "completed");
});
