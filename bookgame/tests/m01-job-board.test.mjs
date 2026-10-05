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
const fixedNow = () => "2026-10-05T08:05:00.000Z";

async function makeRepository() {
  const bundle = await compileStory({ scenesDir, modulesDir });
  return {
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

function atBoard(state) {
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "job_board";
  state.world.locationId = "valedarsena_job_board";
  state.world.flags.first_settlement_reached = true;
  state.world.flags.valedarsena_discovered = true;
  return state;
}

async function goToGinestrePause(engine, state) {
  state = await engine.choose(state, "ginestre");
  state = await engine.choose(state, "stay");
  return state;
}

async function waitHalfHours(engine, state, count) {
  for (let index = 0; index < count; index += 1) {
    state = await engine.choose(state, "wait_again");
  }
  return state;
}

test("M1_05 ignoring the board creates real expiring offers without accepting them", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = atBoard(createNewGameState({ protagonist: "Luke", now: fixedNow }));
  const before = state.world.elapsedMinutes;

  state = await engine.choose(state, "ignore");

  assert.equal(state.story.nodeId, "city_hub");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.status, "available");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.deadlineAtMinutes, before + 360);
  assert.equal(state.quests.M1_VALE_LOGISTICS_01.status, "available");
  assert.equal(state.quests.M1_VALE_LOGISTICS_01.deadlineAtMinutes, before + 180);
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.startedAtMinutes, null);
  assert.equal(state.quests.M1_VALE_LOGISTICS_01.startedAtMinutes, null);
});

test("M1_05 ignored logistics expires and is automatically reposted in changed form", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = atBoard(createNewGameState({ protagonist: "Luke", now: fixedNow }));

  state = await engine.choose(state, "ignore");
  state = await goToGinestrePause(engine, state);
  state = await waitHalfHours(engine, state, 3);

  assert.equal(state.quests.M1_VALE_LOGISTICS_01.status, "expired");
  assert.equal(state.quests.M1_VALE_LOGISTICS_01.resolution, "posting_expired");
  assert.equal(state.quests.M1_VALE_LOGISTICS_01.resolvedBy, "world");
  assert.equal(state.events.A1_JOB_BOARD_LOGISTICS_REPOST.status, "resolved");
  assert.equal(state.world.flags.m1_logistics_reposted, true);
  assert.equal(state.quests.M1_VALE_LOGISTICS_02.status, "available");
  assert.equal(state.quests.M1_VALE_LOGISTICS_02.title, "Consegna ai magazzini — ripubblicata");
});

test("M1_05 ignored farm job is taken and resolved off-screen by another actor", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = atBoard(createNewGameState({ protagonist: "Luke", now: fixedNow }));

  state = await engine.choose(state, "ignore");
  state = await goToGinestrePause(engine, state);
  state = await waitHalfHours(engine, state, 9);

  assert.equal(state.quests.SQ_FARM_HERD_HANDS.status, "completed");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.resolution, "taken_by_npc");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.resolvedBy, "npc_trainer");
});

test("M1_05 accepted farm work can still resolve off-screen when the player delays", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = atBoard(createNewGameState({ protagonist: "Luke", now: fixedNow }));

  state = await engine.choose(state, "farm_job");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.status, "active");
  const deadline = state.quests.SQ_FARM_HERD_HANDS.deadlineAtMinutes;

  state = await engine.choose(state, "later");
  state = await goToGinestrePause(engine, state);
  state = await waitHalfHours(engine, state, 13);

  assert.ok(state.world.elapsedMinutes >= deadline);
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.status, "completed");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.resolution, "resolved_offscreen_after_player_delay");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.resolvedBy, "farm_workers");
});

test("M1_05 accepted logistics can be postponed and misses its real delivery window", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = atBoard(createNewGameState({ protagonist: "Luke", now: fixedNow }));

  state = await engine.choose(state, "logistics");
  assert.equal(state.story.nodeId, "job_logistics");
  assert.equal(state.quests.M1_VALE_LOGISTICS_01.status, "active");

  state = await engine.choose(state, "later");
  state = await goToGinestrePause(engine, state);
  state = await waitHalfHours(engine, state, 5);

  assert.equal(state.quests.M1_VALE_LOGISTICS_01.status, "failed");
  assert.equal(state.quests.M1_VALE_LOGISTICS_01.resolution, "delivery_window_missed");
  assert.equal(state.quests.M1_VALE_LOGISTICS_01.resolvedBy, "world");
  assert.equal(state.quests.M1_VALE_LOGISTICS_02, undefined);
});

test("M1_05 board notices are an authored source for the M1 world-pressure information", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = atBoard(createNewGameState({ protagonist: "Luke", now: fixedNow }));

  state = await engine.choose(state, "read_notices_new");

  assert.equal(state.story.nodeId, "job_board_notice_new");
  assert.equal(state.world.flags.m1_world_pressure_known, true);
  assert.equal(state.world.flags.m1_world_pressure_state, "pressure_noticed");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.status, "available");
  assert.equal(state.quests.M1_VALE_LOGISTICS_01.status, "available");
});

test("M1_05 reposted logistics can be accepted later and completed without resurrecting the old posting", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = atBoard(createNewGameState({ protagonist: "Luke", now: fixedNow }));

  state = await engine.choose(state, "ignore");
  state = await goToGinestrePause(engine, state);
  state = await waitHalfHours(engine, state, 3);
  state = await engine.choose(state, "back");
  state = await engine.choose(state, "to_valedarsena");
  state = await engine.choose(state, "job_board");

  const view = await engine.present(state);
  assert.equal(view.choices.some((choice) => choice.id === "logistics"), false);
  assert.equal(view.choices.some((choice) => choice.id === "logistics_repost"), true);

  state = await engine.choose(state, "logistics_repost");
  assert.equal(state.quests.M1_VALE_LOGISTICS_02.status, "active");
  state = await engine.choose(state, "just_deliver");

  assert.equal(state.quests.M1_VALE_LOGISTICS_01.status, "expired");
  assert.equal(state.quests.M1_VALE_LOGISTICS_02.status, "completed");
  assert.equal(state.quests.M1_VALE_LOGISTICS_02.resolution, "repost_completed_delivery");
  assert.equal(state.world.locationId, "valedarsena_warehouses");
});

test("M1_05 terminal jobs remain terminal when the board refreshes its offers", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = atBoard(createNewGameState({ protagonist: "Luke", now: fixedNow }));

  state = await engine.choose(state, "ignore");
  state = await goToGinestrePause(engine, state);
  state = await waitHalfHours(engine, state, 9);
  state = await engine.choose(state, "back");
  state = await engine.choose(state, "to_valedarsena");
  state = await engine.choose(state, "job_board");
  state = await engine.choose(state, "read_notices_new");

  assert.equal(state.quests.SQ_FARM_HERD_HANDS.status, "completed");
  assert.equal(state.quests.SQ_FARM_HERD_HANDS.resolution, "taken_by_npc");
});

test("M1_05 temporal job state survives save/reload exactly", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m1-job-board-"));
  try {
    const { scenes } = await makeRepository();
    const engine = new BookgameEngine({ scenes, now: fixedNow });
    const store = new SaveStore(dir);
    let state = atBoard(createNewGameState({ protagonist: "Luke", slot: "m1-job-board", now: fixedNow }));

    state = await engine.choose(state, "ignore");
    state = await goToGinestrePause(engine, state);
    state = await waitHalfHours(engine, state, 3);
    await store.save(state);
    const loaded = await store.load("m1-job-board");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.quests.M1_VALE_LOGISTICS_01.status, "expired");
    assert.equal(loaded.quests.M1_VALE_LOGISTICS_02.status, "available");
    assert.equal(loaded.quests.SQ_FARM_HERD_HANDS.status, "available");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
