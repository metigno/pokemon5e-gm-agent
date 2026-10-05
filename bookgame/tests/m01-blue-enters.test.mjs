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
const fixedNow = () => "2026-10-05T08:35:00.000Z";
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

function atCityHub(state) {
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "city_hub";
  state.world.locationId = "valedarsena_city";
  state.world.flags.first_settlement_reached = true;
  state.world.flags.valedarsena_discovered = true;
  return state;
}

function directBlue(state, nodeId) {
  state.story.sceneId = "m01-blue-enters";
  state.story.nodeId = nodeId;
  return state;
}

test("M1_08 Blue circuit schedule is authored by E6 and advances without player interaction", async () => {
  const { engine } = await makeEngine();
  let state = atCityHub(createNewGameState({ protagonist: "Luke", now: fixedNow }));
  setDay(state, 4);

  state = await engine.choose(state, "center");

  assert.equal(state.events.A1_WORLD_MOVES.status, "resolved");
  assert.equal(state.events.A1_BLUE_CIRCUIT_START.status, "resolved");
  assert.equal(state.events.A1_BLUE_CIRCUIT_DAY2.status, "resolved");
  assert.equal(state.events.A1_BLUE_CIRCUIT_DAY3.status, "resolved");
  assert.equal(state.events.A1_BLUE_CIRCUIT_DAY4.status, "resolved");
  assert.equal(state.world.flags.blue_current_schedule, "trainer_shop");
  assert.equal(state.npcs.Blue.state.currentSchedule, "trainer_shop");
  assert.equal(state.npcs.Blue.schedule.locationId, "valedarsena_trainer_shop");
  assert.equal(state.npcs.Blue.schedule.present, true);
});

test("M1_08 day-1 overlap exposes Blue at the Arena but not at the Center", async () => {
  const { engine } = await makeEngine();

  let arenaState = createNewGameState({ protagonist: "Luke", now: fixedNow });
  arenaState.story.sceneId = "m01-valedarsena-first-arrival";
  arenaState.story.nodeId = "approach";
  arenaState = await engine.choose(arenaState, "arena");

  assert.equal(arenaState.world.flags.blue_current_schedule, "arena");
  let view = await engine.present(arenaState);
  assert.ok(view.choices.some((choice) => choice.id === "blue_arena_intro"));

  let centerState = createNewGameState({ protagonist: "Luke", now: fixedNow });
  centerState.story.sceneId = "m01-valedarsena-first-arrival";
  centerState.story.nodeId = "approach";
  centerState = await engine.choose(centerState, "enter_center");

  assert.equal(centerState.world.flags.blue_current_schedule, "arena");
  view = await engine.present(centerState);
  assert.ok(!view.choices.some((choice) => choice.id === "blue_center_intro"));
});

test("M1_08 day-2 schedule creates a causal Center introduction", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  setDay(state, 2);
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "approach";

  state = await engine.choose(state, "enter_center");

  assert.equal(state.world.flags.blue_current_schedule, "center");
  const view = await engine.present(state);
  assert.ok(view.choices.some((choice) => choice.id === "blue_center_intro"));

  state = await engine.choose(state, "blue_center_intro");
  assert.equal(state.story.sceneId, "m01-blue-enters");
  assert.equal(state.story.nodeId, "center_intro");
});

test("M1_08 day-3 field schedule can overlap a real logistics job", async () => {
  const { engine } = await makeEngine();
  let state = atCityHub(createNewGameState({ protagonist: "Luke", now: fixedNow }));
  setDay(state, 3);

  state = await engine.choose(state, "board");
  state = await engine.choose(state, "logistics");
  assert.equal(state.world.flags.blue_current_schedule, "field");

  state = await engine.choose(state, "just_deliver");
  assert.equal(state.world.locationId, "valedarsena_warehouses");
  const view = await engine.present(state);
  assert.ok(view.choices.some((choice) => choice.id === "blue_field_intro"));
});

test("M1_08 day-4 schedule can introduce Blue in the Trainer Shop", async () => {
  const { engine } = await makeEngine();
  let state = atCityHub(createNewGameState({ protagonist: "Luke", now: fixedNow }));
  setDay(state, 4);

  state = await engine.choose(state, "street");
  assert.equal(state.world.flags.blue_current_schedule, "trainer_shop");

  state = await engine.choose(state, "shop_counter");
  assert.equal(state.world.locationId, "valedarsena_trainer_shop");
  const view = await engine.present(state);
  assert.ok(view.choices.some((choice) => choice.id === "blue_shop_intro"));
});

test("M1_08 every minimum introduction route allows talk, ignore, verbal competition, information and leave", async () => {
  const { bundle } = await makeEngine();
  for (const nodeId of ["arena_intro", "center_intro", "shop_intro", "field_intro_done", "field_intro_clue"]) {
    const ids = bundle.scenes["m01-blue-enters"].nodes[nodeId].choices.map((choice) => choice.id);
    for (const required of ["talk", "ignore", "compete_verbally", "ask_information", "leave"]) {
      assert.ok(ids.includes(required), nodeId + " missing " + required);
    }
  }
});

test("M1_08 introduction outcomes persist Blue meeting, relationship context and result context", async () => {
  const { engine } = await makeEngine();
  const cases = [
    ["talk", "measured", "conversation"],
    ["ignore", "distant", "brief_recognition"],
    ["compete_verbally", "competitive", "verbal_competition"],
    ["ask_information", "technical", "information_exchange"],
    ["leave", "distant", "brief_recognition"]
  ];

  for (const [choiceId, relationshipContext, resultContext] of cases) {
    let state = directBlue(createNewGameState({ protagonist: "Luke", now: fixedNow }), "center_intro");
    state = await engine.choose(state, choiceId);

    assert.equal(state.world.flags.blue_met, true);
    assert.equal(state.world.flags.m1_blue_intro_complete, true);
    assert.equal(state.world.flags.blue_relationship_state, relationshipContext);
    assert.equal(state.world.flags.blue_m1_result_context, resultContext);
    assert.equal(state.npcs.Blue.state.met, true);
    assert.equal(state.npcs.Blue.state.relationshipContext, relationshipContext);
    assert.equal(state.npcs.Blue.state.resultContext, resultContext);
  }
});

test("M1_08 optional Arena spar uses early-game Squirtle and has real win/loss branches", async () => {
  const { engine, bundle } = await makeEngine();
  const offer = bundle.scenes["m01-blue-enters"].nodes.arena_match_offer;
  const spar = offer.choices.find((choice) => choice.id === "accept_spar");

  assert.equal(spar.combat.opponent.species, "Squirtle");
  assert.equal(spar.combat.opponent.level, 5);
  assert.equal(spar.combat.competition, undefined);
  assert.deepEqual(Object.keys(spar.combat.returnNodes).sort(), ["lose", "win"]);

  let state = directBlue(createNewGameState({ protagonist: "Luke", now: fixedNow }), "arena_intro");
  state = await engine.choose(state, "offer_spar");
  assert.equal(state.npcs.Blue.state.met, true);

  state = await engine.choose(state, "accept_spar");
  assert.equal(state.pending.type, "pokemon5e_combat");
  assert.equal(state.pending.encounterId, "M1_BLUE_SPAR_001");
  assert.equal(state.pending.opponent.species, "Squirtle");

  state = engine.resolveCombatHandoff(state, "lose");
  assert.equal(state.story.nodeId, "arena_match_loss");
  state = await engine.choose(state, "record_loss");

  assert.equal(state.world.flags.blue_m1_result_context, "spar_loss");
  assert.equal(state.world.flags.blue_relationship_state, "competitive_respect");
  assert.equal(state.story.sceneId, "m01-valedarsena-first-arrival");
  assert.equal(state.story.nodeId, "arena_front");
});

test("M1_08 meeting Blue is sufficient; beating him is never a progression requirement", async () => {
  const { engine } = await makeEngine();
  let state = directBlue(createNewGameState({ protagonist: "Luke", now: fixedNow }), "arena_intro");

  state = await engine.choose(state, "leave");

  assert.equal(state.world.flags.m1_blue_intro_complete, true);
  assert.equal(state.world.flags.blue_met, true);
  assert.equal(state.world.flags.blue_m1_result_context, "brief_recognition");
  assert.equal(state.pending, null);
});

test("M1_08 a completed introduction removes the first-meeting hook on later overlap", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  setDay(state, 2);
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "approach";

  state = await engine.choose(state, "enter_center");
  state = await engine.choose(state, "blue_center_intro");
  state = await engine.choose(state, "talk");
  state = await engine.choose(state, "back");

  assert.equal(state.story.nodeId, "center");
  const view = await engine.present(state);
  assert.ok(!view.choices.some((choice) => choice.id === "blue_center_intro"));
});

test("M1_08 Blue state and current schedule survive save/reload exactly", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m1-blue-"));
  try {
    const { engine } = await makeEngine();
    const store = new SaveStore(dir);
    let state = createNewGameState({ protagonist: "Luke", slot: "m1-blue", now: fixedNow });
    setDay(state, 2);
    state.story.sceneId = "m01-valedarsena-first-arrival";
    state.story.nodeId = "approach";

    state = await engine.choose(state, "enter_center");
    state = await engine.choose(state, "blue_center_intro");
    state = await engine.choose(state, "ask_information");

    await store.save(state);
    const loaded = await store.load("m1-blue");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.npcs.Blue.state.met, true);
    assert.equal(loaded.npcs.Blue.state.currentSchedule, "center");
    assert.equal(loaded.world.flags.blue_m1_result_context, "information_exchange");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
