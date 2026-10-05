import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { compileStory, validateScene } from "../src/compiler/story-compiler.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../content/modules/", import.meta.url));
const fixedNow = () => "2026-10-05T06:50:00.000Z";

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

test("M1_04 every authored first-arrival route establishes Valedarsena discovery at entry", async () => {
  const { bundle } = await makeRepository();
  const target = "m01-valedarsena-first-arrival#approach";
  const entries = [];

  for (const [sceneId, scene] of Object.entries(bundle.scenes)) {
    for (const [nodeId, node] of Object.entries(scene.nodes ?? {})) {
      for (const choice of node.choices ?? []) {
        if (choice.goto === target) entries.push({ sceneId, nodeId, choice });
      }
    }
  }

  assert.ok(entries.length >= 3);
  for (const entry of entries) {
    const effects = entry.choice.effects ?? [];
    assert.ok(
      effects.some((effect) => effect.type === "set_location" && effect.locationId === "valedarsena_city"),
      entry.sceneId + "#" + entry.nodeId + "." + entry.choice.id
    );
    assert.ok(
      effects.some((effect) => effect.type === "set_flag" && effect.key === "first_settlement_reached" && effect.value === true),
      entry.sceneId + "#" + entry.nodeId + "." + entry.choice.id
    );
    assert.ok(
      effects.some((effect) => effect.type === "set_flag" && effect.key === "valedarsena_discovered" && effect.value === true),
      entry.sceneId + "#" + entry.nodeId + "." + entry.choice.id
    );
  }
});

test("M1_04 direct release to Valedarsena discovers the city and triggers A1_WORLD_MOVES", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  const start = createNewGameState({ protagonist: "Luke", now: fixedNow });
  const before = start.world.elapsedMinutes;

  const state = await engine.choose(start, "to_valedarsena");

  assert.equal(state.story.sceneId, "m01-valedarsena-first-arrival");
  assert.equal(state.story.nodeId, "approach");
  assert.equal(state.world.locationId, "valedarsena_city");
  assert.equal(state.world.elapsedMinutes, before + 90);
  assert.equal(state.world.flags.first_settlement_reached, true);
  assert.equal(state.world.flags.valedarsena_discovered, true);
  assert.equal(state.events.A1_WORLD_MOVES.status, "resolved");
  assert.equal(state.world.flags.m1_world_pressure_state, "pressure_unnoticed");
  assert.deepEqual(state.quests, {});
});

test("M1_04 arrival offers services gradually and Job Board can be ignored", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state = await engine.choose(state, "to_valedarsena");

  const arrival = await engine.present(state);
  assert.deepEqual(
    arrival.choices.map((choice) => choice.id),
    ["enter_center", "job_board", "arena", "trainer_street", "leave_city"]
  );

  state = await engine.choose(state, "job_board");
  assert.equal(state.world.locationId, "valedarsena_job_board");
  assert.deepEqual(state.quests, {});

  state = await engine.choose(state, "ignore");
  assert.equal(state.story.nodeId, "city_hub");
  assert.equal(state.world.locationId, "valedarsena_city");
  assert.deepEqual(state.quests, {});
});

test("M1_04 service navigation keeps world.locationId synchronized with the actual district", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state = await engine.choose(state, "to_valedarsena");

  state = await engine.choose(state, "enter_center");
  assert.equal(state.world.locationId, "valedarsena_center");

  state = await engine.choose(state, "back_city");
  assert.equal(state.story.nodeId, "city_hub");
  assert.equal(state.world.locationId, "valedarsena_city");

  state = await engine.choose(state, "arena");
  assert.equal(state.world.locationId, "valedarsena_arena");

  state = await engine.choose(state, "leave");
  assert.equal(state.story.nodeId, "city_hub");
  assert.equal(state.world.locationId, "valedarsena_city");

  state = await engine.choose(state, "street");
  assert.equal(state.world.locationId, "valedarsena_trainer_street");

  state = await engine.choose(state, "shop_counter");
  assert.equal(state.story.nodeId, "trainer_shop");
  assert.equal(state.world.locationId, "valedarsena_trainer_shop");

  state = await engine.choose(state, "leave_shop");
  assert.equal(state.story.nodeId, "trainer_street");
  assert.equal(state.world.locationId, "valedarsena_trainer_street");
});

test("M1_04 shop uses canonical Pokémon 5e 2024 rookie item prices", async () => {
  const { bundle } = await makeRepository();
  const shop = bundle.scenes["m01-valedarsena-first-arrival"].nodes.trainer_shop;

  const pokeball = shop.choices.find((choice) => choice.id === "buy_poke_ball");
  const potion = shop.choices.find((choice) => choice.id === "buy_potion");
  const antidote = shop.choices.find((choice) => choice.id === "buy_antidote");

  assert.deepEqual(pokeball.effects, [{
    type: "purchase_item",
    shopId: "valedarsena_trainer_shop",
    itemId: "poke-ball",
    cost: 250,
    quantity: 1
  }]);
  assert.deepEqual(potion.effects, [{
    type: "purchase_item",
    shopId: "valedarsena_trainer_shop",
    itemId: "potion",
    cost: 200,
    quantity: 1
  }]);
  assert.deepEqual(antidote.effects, [{
    type: "purchase_item",
    shopId: "valedarsena_trainer_shop",
    itemId: "antidote",
    cost: 200,
    quantity: 1
  }]);
  assert.deepEqual(pokeball.conditions, {
    all: [
      { path: "player.money", gte: 250 },
      { path: "shops.valedarsena_trainer_shop.stock.poke-ball", gte: 1 }
    ]
  });
  assert.deepEqual(potion.conditions, {
    all: [
      { path: "player.money", gte: 200 },
      { path: "shops.valedarsena_trainer_shop.stock.potion", gte: 1 }
    ]
  });
});

test("M1_04 trainer begins without invented campaign cash and cannot buy on credit", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  const state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.world.locationId = "valedarsena_trainer_shop";
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "trainer_shop";

  assert.equal(state.player.money, 0);
  const view = await engine.present(state);
  const ids = view.choices.map((choice) => choice.id);
  assert.equal(ids.includes("buy_poke_ball"), false);
  assert.equal(ids.includes("buy_potion"), false);
  assert.equal(ids.includes("buy_antidote"), false);
  await assert.rejects(() => engine.choose(state, "buy_poke_ball"), /not currently available/i);
});

test("M1_04 purchase atomically subtracts money and adds the real item id to persistent inventory", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.player.money = 450;
  state.world.locationId = "valedarsena_trainer_shop";
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "trainer_shop";

  state = await engine.choose(state, "buy_poke_ball");
  assert.equal(state.player.money, 200);
  assert.deepEqual(state.player.inventory, ["poke-ball"]);

  state = await engine.choose(state, "buy_potion");
  assert.equal(state.player.money, 0);
  assert.deepEqual(state.player.inventory, ["poke-ball", "potion"]);

  const view = await engine.present(state);
  assert.equal(view.choices.some((choice) => choice.id.startsWith("buy_")), false);
});

test("M1_04 bought Poké Balls flow into the existing Pokémon 5e combat handoff inventory", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.player.money = 250;
  state.world.locationId = "valedarsena_trainer_shop";
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "trainer_shop";

  state = await engine.choose(state, "buy_poke_ball");
  state.world.locationId = "asteria_ginestre";
  state.story.sceneId = "first-road";
  state.story.nodeId = "arrival";

  state = await engine.choose(state, "send_starter");

  assert.deepEqual(state.pending.trainer.inventory, ["poke-ball"]);
  assert.equal(state.pending.authority, "pokemon5e_rules");
});

test("M1_04 leaving Valedarsena returns to surrounding zones with real travel time and location", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "city_hub";
  state.world.locationId = "valedarsena_city";

  const before = state.world.elapsedMinutes;
  state = await engine.choose(state, "ginestre");

  assert.equal(state.world.elapsedMinutes, before + 70);
  assert.equal(state.world.locationId, "asteria_ginestre");
  assert.equal(state.story.sceneId, "m01-ginestre-crossroads");
  assert.equal(state.story.nodeId, "crossroads");
});

test("M1_04 purchase compiler contract rejects malformed or negative authored purchases", () => {
  const report = validateScene({
    schemaVersion: 1,
    id: "bad-shop",
    title: "Bad shop",
    locationId: "test",
    nodes: {
      start: {
        text: "Shop",
        choices: [{
          id: "bad",
          text: "Bad",
          goto: "start",
          effects: [{ type: "purchase_item", shopId: "???", itemId: "???", cost: -1, quantity: 0 }]
        }]
      }
    }
  });

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.code === "INVALID_PURCHASE_ITEM_ID"));
  assert.ok(report.errors.some((error) => error.code === "INVALID_PURCHASE_COST"));
  assert.ok(report.errors.some((error) => error.code === "INVALID_PURCHASE_QUANTITY"));
  assert.ok(report.errors.some((error) => error.code === "INVALID_PURCHASE_SHOP_ID"));
});

test("M1_04 money and purchases survive save/reload exactly", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m1-valedarsena-"));
  try {
    const { scenes } = await makeRepository();
    const engine = new BookgameEngine({ scenes, now: fixedNow });
    const store = new SaveStore(dir);
    let state = createNewGameState({ protagonist: "Luke", slot: "m1-valedarsena", now: fixedNow });
    state.player.money = 500;
    state.story.sceneId = "m01-valedarsena-first-arrival";
    state.story.nodeId = "trainer_shop";
    state.world.locationId = "valedarsena_trainer_shop";

    state = await engine.choose(state, "buy_poke_ball");
    await store.save(state);
    const loaded = await store.load("m1-valedarsena");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.player.money, 250);
    assert.deepEqual(loaded.player.inventory, ["poke-ball"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("M1_04 trainer shop has finite stock and hides exhausted purchases", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.player.money = 5000;
  state.world.locationId = "valedarsena_trainer_shop";
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "trainer_shop";

  for (let index = 0; index < 6; index += 1) {
    state = await engine.choose(state, "buy_poke_ball");
  }

  assert.equal(state.shops.valedarsena_trainer_shop.stock["poke-ball"], 0);
  const view = await engine.present(state);
  assert.equal(view.choices.some((choice) => choice.id === "buy_poke_ball"), false);
  await assert.rejects(() => engine.choose(state, "buy_poke_ball"), /not currently available/i);
});

test("M1_04 trainer shop refreshes stock every three in-game days", async () => {
  const { scenes } = await makeRepository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.player.money = 5000;
  state.world.locationId = "valedarsena_trainer_shop";
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "trainer_shop";

  for (let index = 0; index < 6; index += 1) {
    state = await engine.choose(state, "buy_poke_ball");
  }
  assert.equal(state.shops.valedarsena_trainer_shop.stock["poke-ball"], 0);

  state.world.day = 3;
  await engine.present(state);
  assert.equal(state.shops.valedarsena_trainer_shop.stock["poke-ball"], 0);

  state.world.day = 4;
  const refreshed = await engine.present(state);
  assert.equal(state.shops.valedarsena_trainer_shop.stock["poke-ball"], 6);
  assert.equal(state.shops.valedarsena_trainer_shop.lastRefreshDay, 4);
  assert.equal(refreshed.choices.some((choice) => choice.id === "buy_poke_ball"), true);
});

test("M1_04 shop stock survives save/reload together with money and inventory", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m1-shop-stock-"));
  try {
    const { scenes } = await makeRepository();
    const engine = new BookgameEngine({ scenes, now: fixedNow });
    const store = new SaveStore(dir);
    let state = createNewGameState({ protagonist: "Luke", slot: "m1-shop-stock", now: fixedNow });
    state.player.money = 1000;
    state.world.locationId = "valedarsena_trainer_shop";
    state.story.sceneId = "m01-valedarsena-first-arrival";
    state.story.nodeId = "trainer_shop";

    state = await engine.choose(state, "buy_poke_ball");
    state = await engine.choose(state, "buy_potion");
    await store.save(state);
    const loaded = await store.load("m1-shop-stock");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.shops.valedarsena_trainer_shop.stock["poke-ball"], 5);
    assert.equal(loaded.shops.valedarsena_trainer_shop.stock.potion, 3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

