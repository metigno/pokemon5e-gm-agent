import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const PORT = 4197;
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

test("UI server can create a real M1 game through the same API used by the button", async (t) => {
  const child = spawn(process.execPath, ["ui/server.mjs"], {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, P5E_UI_PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

  t.after(() => {
    child.kill("SIGTERM");
  });

  await waitForServer();

  const response = await fetch(`${BASE}/api/new-game`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ protagonist: "Luke", slot: "ui-smoke" })
  });

  const payload = await response.json();
  assert.equal(response.status, 200, stderr);
  assert.equal(payload.ok, true);
  assert.equal(payload.hasSession, true);
  assert.equal(payload.player.name, "Luke");
  assert.equal(payload.story.sceneId, "intro-m01");
  assert.equal(payload.story.nodeId, "trainer_specialization");
  assert.ok(Array.isArray(payload.story.choices));
  assert.ok(payload.story.choices.length >= 1);

  const pokemon = payload.player.roster[0];
  assert.equal(pokemon.speciesId, "hisuian-growlithe");
  assert.equal(pokemon.level, 5);
  assert.ok(Number.isFinite(pokemon.ac));
  assert.ok(pokemon.hp.current > 0 && pokemon.hp.max >= pokemon.hp.current);
  assert.ok(Array.isArray(pokemon.types) && pokemon.types.length >= 1);
  assert.ok(pokemon.attributes && Number.isFinite(pokemon.attributes.str));
  assert.ok(pokemon.ability?.id);
  assert.ok(Array.isArray(pokemon.moves) && pokemon.moves.length >= 1);
  assert.ok(pokemon.moves.every((move) => Number.isFinite(move.ppCurrent) && Number.isFinite(move.ppMax)));
  assert.ok(Array.isArray(pokemon.statuses));
  assert.ok(Array.isArray(pokemon.pendingMoveLearning));
  assert.ok(Array.isArray(pokemon.pendingMoveChoices));
  assert.ok(Array.isArray(pokemon.pendingAsiChoices));
});
