import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import os from "node:os";
import path from "node:path";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState, migrateGameState } from "../src/engine/state.mjs";

const now = () => "2026-10-08T12:00:00.000Z";

function sixPokemonBattleState(slot = "capture-six") {
  const state = createNewGameState({ protagonist: "Luke", slot, now });
  state.player.roster = Array.from({ length: 6 }, (_, index) => ({
    ...structuredClone(state.player.starter),
    name: `Compagno ${index + 1}`
  }));
  state.pending = {
    type: "pokemon5e_combat",
    status: "resolved",
    encounterId: "WILD_SEVENTH",
    sceneId: state.story.sceneId,
    returnNodes: { captured: state.story.nodeId },
    opponentRegistered: false,
    battle: {
      outcome: "captured",
      opponentRegistered: false,
      opponent: {
        speciesId: "pidgey",
        name: "Pidgey",
        level: 5,
        hp: { current: 3, max: 15 },
        statuses: { nonVolatile: null, volatile: [] },
        abilityId: "keen-eye",
        moveIds: ["tackle"],
        pp: { tackle: 10 }
      }
    }
  };
  return state;
}

test("Seventh capture waits for a voluntary release instead of creating a reserve", async () => {
  const engine = new BookgameEngine({ now });
  const original = sixPokemonBattleState();
  const next = engine.resolveCombatHandoff(original, "captured");
  assert.equal(next.player.roster.length, 6);
  assert.equal(original.player.roster.length, 6);
  assert.equal(next.pending.type, "pokemon_capture_replacement");
  assert.equal(next.pending.pokemon.speciesId, "pidgey");
  assert.equal(next.pending.pokemon.hp.current, 3);
  assert.equal(next.story.nodeId, original.story.nodeId);
  const view = await engine.present(next);
  assert.equal(view.sceneTitle, "Squadra al completo");
  assert.equal(view.choices.length, 7);
  assert.deepEqual(view.choices.map((c) => c.id), [
    "replace_0", "replace_1", "replace_2", "replace_3",
    "replace_4", "replace_5", "release_captured"
  ]);
  await assert.rejects(engine.choose(next, "continue"), /Scegli un Pokémon/);
  assert.equal(next.player.roster.length, 6);
});

test("Replacing any team member permanently releases them; slot zero updates the starter fallback", async () => {
  const engine = new BookgameEngine({ now });
  for (const index of [0, 1, 2, 3, 4, 5]) {
    const captured = engine.resolveCombatHandoff(sixPokemonBattleState(`replace-${index}`), "captured");
    const previous = captured.player.roster[index];
    const next = await engine.choose(captured, `replace_${index}`);
    assert.equal(next.player.roster.length, 6);
    assert.equal(next.pending, null);
    assert.equal(next.player.roster[index].speciesId, "pidgey");
    assert.equal(next.player.roster.some((p) => p.name === previous.name), false);
    assert.equal(next.story.history.at(-1).releasedSpeciesId, previous.speciesId);
    assert.equal(next.story.history.at(-1).replacedRosterIndex, index);
    if (index === 0) assert.equal(next.player.starter.speciesId, "pidgey");
    else assert.equal(next.player.starter.speciesId, "growlithe-hisui");
    await assert.rejects(engine.choose(next, `replace_${index}`), /Unknown choice|not currently available|Scegli/);
  }
});

test("Releasing the new capture keeps all original six and never creates storage", async () => {
  const engine = new BookgameEngine({ now });
  const state = engine.resolveCombatHandoff(sixPokemonBattleState(), "captured");
  const names = state.player.roster.map((p) => p.name);
  const released = await engine.choose(state, "release_captured");
  assert.deepEqual(released.player.roster.map((p) => p.name), names);
  assert.equal(released.pending, null);
  assert.equal(released.story.history.at(-1).releasedSpeciesId, "pidgey");
  assert.equal(released.story.history.at(-1).replacedRosterIndex, null);
});

test("Save/reload preserves the pending decision and rejects old over-cap saves without silent deletion", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "p5e-capture-six-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new SaveStore(dir);
  const engine = new BookgameEngine({ now });
  const pending = engine.resolveCombatHandoff(sixPokemonBattleState(), "captured");
  await store.save(pending);
  const loaded = await store.load(pending.slot);
  assert.equal(loaded.player.roster.length, 6);
  assert.equal(loaded.pending.type, "pokemon_capture_replacement");
  const finalized = await engine.choose(loaded, "replace_4");
  await store.save(finalized);
  const after = await store.load(finalized.slot);
  assert.equal(after.player.roster.length, 6);
  assert.equal(after.player.roster[4].speciesId, "pidgey");
  assert.equal(after.pending, null);

  const illegal = sixPokemonBattleState("legacy-seven");
  illegal.pending = null;
  illegal.player.roster.push({ speciesId: "eevee", name: "Eevee", level: 5 });
  await assert.rejects(store.save(illegal), /massimo sei Pokémon/);
  assert.throws(() => migrateGameState(illegal), /massimo sei Pokémon/);
  const filename = store.filePath(illegal.slot);
  await writeFile(filename, JSON.stringify(illegal), "utf8");
  await assert.rejects(store.load(illegal.slot), /massimo sei Pokémon/);
  const unchanged = JSON.parse(await readFile(filename, "utf8"));
  assert.equal(unchanged.player.roster.length, 7);
});

test("Real HTTP UI resolves a seventh capture via touch choices and persists the choice after reload", async (t) => {
  const port = 4218;
  const base = `http://127.0.0.1:${port}`;
  const dir = await mkdtemp(path.join(os.tmpdir(), "p5e-capture-ui-"));
  const slot = "six-ui";
  const store = new SaveStore(dir);
  await store.save(sixPokemonBattleState(slot));
  const child = spawn(process.execPath, ["ui/server.mjs"], {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, P5E_UI_PORT: String(port), P5E_SAVE_DIR: dir },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  t.after(async () => {
    child.kill("SIGTERM");
    await rm(dir, { recursive: true, force: true });
  });
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      if ((await fetch(`${base}/api/snapshot`)).ok) break;
    } catch {}
    await delay(100);
  }
  async function post(endpoint, body) {
    const response = await fetch(`${base}${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    return { response, body: await response.json() };
  }

  let result = await post("/api/load", { slot });
  assert.equal(result.response.status, 200, stderr);
  assert.equal(result.body.player.roster.length, 6);
  assert.equal(result.body.story.sceneId, "capture-replacement");
  assert.equal(result.body.story.choices.length, 7);
  const blocked = await post("/api/pokemon/level-up", { rosterIndex: 0 });
  assert.equal(blocked.response.status, 409);
  assert.equal((await post("/api/choose", { choiceId: "invalid" })).response.status, 500);
  result = await post("/api/choose", { choiceId: "replace_5" });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.player.roster.length, 6);
  assert.equal(result.body.player.roster[5].speciesId, "pidgey");

  result = await post("/api/load", { slot });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.player.roster.length, 6);
  assert.equal(result.body.player.roster[5].speciesId, "pidgey");
  assert.notEqual(result.body.story.sceneId, "capture-replacement");
});
