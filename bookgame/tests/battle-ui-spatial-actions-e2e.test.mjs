import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const PORT = 4237;
const BASE = `http://127.0.0.1:${PORT}`;

async function post(route, body) {
  const response = await fetch(`${BASE}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

async function waitForServer() {
  for (let tries = 0; tries < 100; tries += 1) {
    try {
      const response = await fetch(`${BASE}/api/snapshot`);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error("Battle UI server did not start");
}

test("Battle UI exposes spatial actions, legality and persisted movement, Disengage and switch", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "p5e-battle-ui-spatial-"));
  const saves = new SaveStore(dir);
  const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([20, 1, 1, 1, 1, 1]) });
  const state = createNewGameState({ protagonist: "Luke", slot: "slot1" });

  const freshBattle = async () => {
    const battle = await combat.createBattle({
      encounterId: "BATTLE_UI_SPATIAL_E2E",
      playerPokemon: { species: "Growlithe", form: "Hisuian", level: 5 },
      playerBench: [{ species: "Totodile", level: 5 }],
      opponent: { species: "Houndour", level: 5 },
      playerPosition: { x: 0, y: 0 },
      trainerPosition: { x: 0, y: 0 },
      opponentPosition: { x: 20, y: 0 }
    });
    battle.order = ["player", "opponent"];
    battle.turnIndex = 0;
    return battle;
  };

  const setBattle = async (battle) => {
    state.pending = {
      type: "pokemon5e_combat",
      status: "in_progress",
      encounterId: battle.encounterId,
      sceneId: state.story.sceneId,
      returnNodes: { won: state.story.nodeId, lost: state.story.nodeId },
      battle
    };
    await saves.save(state);
  };

  await setBattle(await freshBattle());

  const child = spawn(process.execPath, ["ui/server.mjs"], {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, P5E_UI_PORT: String(PORT), P5E_SAVE_DIR: dir },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  t.after(async () => {
    child.kill("SIGTERM");
    await rm(dir, { recursive: true, force: true });
  });
  await waitForServer();

  let result = await post("/api/load", { slot: "slot1" });
  assert.equal(result.status, 200, stderr);
  assert.equal(result.body.battle.actor, "player");
  assert.deepEqual(result.body.battle.player.position, { x: 0, y: 0 });
  assert.deepEqual(result.body.battle.spatial.trainerPosition, { x: 0, y: 0 });
  assert.equal(result.body.battle.spatial.distance, 20);
  assert.equal(result.body.battle.spatial.disengageAvailable, true);
  assert.equal(result.body.battle.spatial.voluntarySwitchAvailable, true);
  assert.ok(result.body.battle.spatial.pokemonMovementModes.some((entry) => entry.type === "walking"));

  result = await post("/api/combat/movement", {
    unit: "pokemon", movementType: "walking", destination: { x: "5", y: 0 }
  });
  assert.equal(result.status, 400);
  assert.deepEqual((await post("/api/load", { slot: "slot1" })).body.battle.player.position, { x: 0, y: 0 });

  result = await post("/api/combat/movement", {
    unit: "pokemon", movementType: "walking", destination: { x: 5, y: 0 }
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.battle.player.position.x, 5);
  assert.ok(result.body.battle.player.movementRemaining > 0);
  assert.ok(result.body.battle.log.some((entry) => entry.type === "movement"));

  result = await post("/api/combat/disengage", {});
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.battle.player.disengaged, true);
  assert.equal(result.body.battle.player.actionAvailable, false);
  assert.equal(result.body.battle.spatial.disengageAvailable, false);

  result = await post("/api/combat/movement", {
    unit: "pokemon", movementType: "walking", destination: { x: 10, y: 0 }
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.battle.player.position.x, 10);

  result = await post("/api/combat/movement", { unit: "trainer", destination: { x: 3, y: 0 } });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.battle.spatial.trainerPosition.x, 3);
  assert.ok(result.body.battle.log.some((entry) => entry.type === "trainer_movement"));

  result = await post("/api/load", { slot: "slot1" });
  assert.equal(result.status, 200);
  assert.equal(result.body.battle.player.position.x, 10);
  assert.equal(result.body.battle.spatial.trainerPosition.x, 3);

  await setBattle(await freshBattle());
  result = await post("/api/load", { slot: "slot1" });
  assert.equal(result.body.battle.spatial.voluntarySwitchAvailable, true);
  result = await post("/api/combat/switch", { benchIndex: 0, releasePosition: { x: 10, y: 0 } });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.battle.player.speciesId, "totodile");
  assert.equal(result.body.battle.player.position.x, 10);
  assert.ok(result.body.battle.log.some((entry) => entry.type === "switch" && entry.forced === false));

  const forcedBattle = await freshBattle();
  forcedBattle.awaitingSwitch = "player";
  forcedBattle.player.hp.current = 0;
  await setBattle(forcedBattle);
  result = await post("/api/load", { slot: "slot1" });
  assert.equal(result.body.battle.awaitingSwitch, "player");
  assert.equal(result.body.battle.spatial.disengageAvailable, false);
  assert.deepEqual(result.body.battle.spatial.pokemonMovementModes, []);

  result = await post("/api/combat/movement", {
    unit: "pokemon", movementType: "walking", destination: { x: 5, y: 0 }
  });
  assert.equal(result.status, 409);

  result = await post("/api/combat/switch", {
    benchIndex: 0, releasePosition: { x: -10, y: 0 }
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.battle.player.speciesId, "totodile");
  assert.equal(result.body.battle.player.position.x, -10);
  assert.ok(result.body.battle.log.some((entry) => entry.type === "switch" && entry.forced === true));
});
