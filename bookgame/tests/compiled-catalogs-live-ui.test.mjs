import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import os from "node:os";
import path from "node:path";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const PORT = 4228;
const BASE = `http://127.0.0.1:${PORT}`;
const now = () => "2026-10-08T12:00:00.000Z";

async function request(route, body) {
  const response = await fetch(BASE + route, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  assert.equal(response.status, 200, `${route}: ${JSON.stringify(payload)}`);
  assert.equal(payload.ok, true);
  return payload;
}

async function waitForServer(child) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`UI server exited with ${child.exitCode}`);
    try {
      const response = await fetch(BASE + "/api/snapshot");
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error("UI server did not start");
}

test("standard runtime and real UI load compiled ecology/world events across save/reload", async (t) => {
  // No ecology or worldEvents injection: exercise the exact engine constructor
  // used by ui/server.mjs and the real /api/load -> /api/choose endpoints.
  const engine = new BookgameEngine();
  const events = await engine.loadWorldEvents();
  const ecology = await engine.loadEcology();
  assert.ok(events.some((event) => event.id === "A1_WORLD_MOVES"));
  assert.ok(ecology.zones["AST-GINESTRE"]);
  assert.ok(ecology.zones["AST-GINESTRE"].species.length > 0);

  const saveDir = await mkdtemp(path.join(os.tmpdir(), "p5e-live-catalogs-"));
  const store = new SaveStore(saveDir);
  const child = spawn(process.execPath, ["ui/server.mjs"], {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, P5E_UI_PORT: String(PORT), P5E_SAVE_DIR: saveDir },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  t.after(async () => {
    child.kill("SIGTERM");
    await rm(saveDir, { recursive: true, force: true });
  });
  await waitForServer(child).catch((error) => {
    throw new Error(`${error.message}\n${stderr}`);
  });

  // Ecology: enter an existing, authored wildlife choice through the real UI API.
  const wild = createNewGameState({ protagonist: "Luke", slot: "slot1", now });
  wild.story.sceneId = "m01-ginestre-crossroads";
  wild.story.nodeId = "crossroads";
  wild.world.locationId = "asteria_ginestre";
  wild.world.minuteOfDay = 600;
  await store.save(wild);

  const beforeWild = await request("/api/load", { slot: wild.slot });
  assert.equal(beforeWild.story.sceneId, wild.story.sceneId);
  assert.ok(beforeWild.story.choices.some((choice) => choice.id === "observe_wildlife"));
  const wildResponse = await request("/api/choose", { choiceId: "observe_wildlife" });
  assert.equal(wildResponse.story.sceneId, "m01-ecology-opportunities");

  const encountered = await store.load(wild.slot);
  assert.equal(encountered.ecology.history.length, 1);
  assert.equal(encountered.ecology.lastEncounter.zoneId, "AST-GINESTRE");
  assert.ok(["wooloo", "shinx"].includes(encountered.ecology.lastEncounter.speciesId));
  assert.ok(encountered.ecology.lastEncounter.level >= 1);
  assert.ok(encountered.ecology.lastEncounter.level <= 4);
  assert.equal(encountered.story.history.at(-1).ecology.speciesId, encountered.ecology.lastEncounter.speciesId);

  const wildReload = await request("/api/load", { slot: wild.slot });
  assert.equal(wildReload.story.sceneId, wildResponse.story.sceneId);
  assert.equal(wildReload.story.nodeId, wildResponse.story.nodeId);
  assert.deepEqual((await store.load(wild.slot)).ecology, encountered.ecology);
  const peaceChoice = encountered.story.nodeId === "gin_wooloo" ? "watch" : "leave";
  const continuedWild = await request("/api/choose", { choiceId: peaceChoice });
  assert.equal(continuedWild.story.nodeId, "gin_peaceful_return");
  assert.equal((await store.load(wild.slot)).ecology.history.length, 1);

  // World event: the real UI choice triggers the canonical compiled M01 catalog.
  const world = createNewGameState({ protagonist: "Luke", slot: "slot2", now });
  world.story.sceneId = "m01-valedarsena-first-arrival";
  world.story.nodeId = "city_hub";
  world.world.locationId = "valedarsena_city";
  world.world.flags.first_settlement_reached = true;
  await store.save(world);

  const beforeWorld = await request("/api/load", { slot: world.slot });
  assert.ok(beforeWorld.story.choices.some((choice) => choice.id === "center"));
  const worldResponse = await request("/api/choose", { choiceId: "center" });
  assert.equal(worldResponse.story.nodeId, "center");
  const afterWorld = await store.load(world.slot);
  assert.equal(afterWorld.events.A1_WORLD_MOVES.status, "resolved");
  assert.ok(["pressure_noticed", "pressure_unnoticed"].includes(afterWorld.world.flags.m1_world_pressure_state));
  assert.ok(afterWorld.story.history.at(-1).worldEvents.some((event) => event.eventId === "A1_WORLD_MOVES"));

  const worldReload = await request("/api/load", { slot: world.slot });
  assert.equal(worldReload.story.nodeId, "center");
  assert.deepEqual((await store.load(world.slot)).events, afterWorld.events);
  await request("/api/choose", { choiceId: "back_city" });
  const continuedWorld = await store.load(world.slot);
  assert.equal(continuedWorld.events.A1_WORLD_MOVES.status, "resolved");
  assert.equal(continuedWorld.events.A1_WORLD_MOVES.firedAtMinutes, afterWorld.events.A1_WORLD_MOVES.firedAtMinutes);
  assert.ok(!(continuedWorld.story.history.at(-1).worldEvents ?? []).some((event) => event.eventId === "A1_WORLD_MOVES"));
});
