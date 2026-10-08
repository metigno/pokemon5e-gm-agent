import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const PORT = 4198;
const BASE = `http://127.0.0.1:${PORT}`;

async function waitForServer(timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${BASE}/api/snapshot`);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error("UI server did not start");
}

async function post(route, body) {
  const response = await fetch(`${BASE}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return { response, payload: await response.json() };
}

test("Trainer UI -> runtime -> save/reload -> continue battle integration", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "p5e-trainer-ui-e2e-"));
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 10, 10, 10, 10, 10, 10])
  });
  const state = createNewGameState({ protagonist: "Luke", slot: "slot1" });
  state.player.classFeatures.push("directed-strike");
  state.player.classResources["tactical-points"] = {
    id: "tactical-points",
    name: "Tactical Points",
    current: 2,
    max: 4,
    recharge: "long-rest"
  };
  const battle = await combat.createBattle({
    encounterId: "TRAINER_UI_E2E",
    playerPokemon: { species: "Growlithe", form: "Hisuian", level: 5 },
    opponent: { species: "Houndour", level: 5 }
  });
  battle.order = ["player", "opponent"];
  battle.turnIndex = 0;
  state.pending = {
    type: "pokemon5e_combat",
    status: "in_progress",
    encounterId: battle.encounterId,
    sceneId: state.story.sceneId,
    returnNodes: { won: state.story.nodeId, lost: state.story.nodeId },
    battle
  };
  await new SaveStore(dir).save(state);

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
  assert.equal(result.response.status, 200, stderr);
  const action = result.payload.trainerGameplay.features.find((entry) => entry.id === "directed-strike");
  assert.equal(action.legal, true);
  assert.equal(action.resource.current, 2);

  result = await post("/api/combat/trainer-feature", { featureId: "directed-strike" });
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  assert.equal(result.payload.trainerGameplay.classResources["tactical-points"].current, 0);
  assert.equal(result.payload.battle.actor, "player");

  result = await post("/api/combat/trainer-feature", { featureId: "directed-strike" });
  assert.equal(result.response.status, 409);
  assert.equal(result.payload.error, "insufficient_resource");

  result = await post("/api/load", { slot: "slot1" });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.trainerGameplay.classResources["tactical-points"].current, 0);
  const reloadedAction = result.payload.trainerGameplay.features.find((entry) => entry.id === "directed-strike");
  assert.equal(reloadedAction.legal, false);
  assert.equal(reloadedAction.reason, "insufficient_resource");

  const move = result.payload.battle.moves.find((entry) => entry.ppCurrent > 0);
  assert.ok(move, "battle must still expose a legal Pokémon move after reload");
  result = await post("/api/combat/move", { moveId: move.id });
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
});
