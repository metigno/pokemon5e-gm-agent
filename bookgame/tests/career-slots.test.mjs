import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { CAREER_SLOTS, SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const PORT = 4277;
const BASE = `http://127.0.0.1:${PORT}`;

async function api(route, body, headers = {}) {
  const response = await fetch(BASE + route, body === undefined ? {} : {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  return { status: response.status, data: await response.json() };
}

async function launch(dir) {
  const child = spawn(process.execPath, ["ui/server.mjs"], {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, P5E_UI_PORT: String(PORT), P5E_SAVE_DIR: dir },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let errors = "";
  child.stderr.on("data", (chunk) => { errors += chunk.toString(); });
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${errors}`);
    try {
      if ((await fetch(BASE + "/api/slots")).ok) return child;
    } catch {}
    await delay(100);
  }
  child.kill("SIGKILL");
  throw new Error(`Server startup timeout: ${errors}`);
}

async function stop(child) {
  if (child?.exitCode == null && child?.signalCode == null) {
    child.kill("SIGKILL"); // Simulate sudden app termination, not a graceful save.
    await once(child, "exit");
  }
}

test("save files are isolated, overwrite is opt-in and interrupted temp files are ignored", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "p5e-three-slots-store-"));
  try {
    const saves = new SaveStore(dir);
    assert.deepEqual(CAREER_SLOTS, ["slot1", "slot2", "slot3"]);
    const a = createNewGameState({ protagonist: "Luke", slot: "slot1" });
    const b = createNewGameState({ protagonist: "Mattew", slot: "slot2" });
    const c = createNewGameState({ protagonist: "Fab", slot: "slot3" });
    await saves.save(a, { createOnly: true });
    await saves.save(b, { createOnly: true });
    await saves.save(c, { createOnly: true });
    await assert.rejects(saves.save(b, { createOnly: true }), { code: "EEXIST" });

    a.world.flags.saved_once = true;
    a.player.death.state = "dead";
    await saves.save(a);
    await writeFile(path.join(dir, "slot1.json.abandoned.tmp"), '{"broken":');
    assert.equal((await saves.load("slot1")).world.flags.saved_once, true);
    assert.equal((await saves.load("slot1")).player.death.state, "dead");
    assert.equal((await saves.load("slot2")).player.name, "Mattew");
    assert.equal((await saves.load("slot3")).player.name, "Fab");
    const summary = await saves.listCareers();
    assert.equal(summary.length, 3);
    assert.equal(summary[0].careerEnded, true);
    assert.ok(summary.every((entry) => entry.occupied && !entry.corrupted));
    await assert.rejects(saves.load("slot4"), { code: "ENOENT" });

    await saves.delete("slot2");
    assert.equal((await saves.listCareers())[1].occupied, false);
    assert.equal((await saves.load("slot1")).player.name, "Luke");
    assert.equal((await saves.load("slot3")).player.name, "Fab");
    const bad = { ...a, slot: "slot2" };
    await writeFile(saves.filePath("slot2"), JSON.stringify({ ...bad, slot: "slot3" }));
    assert.equal((await saves.listCareers())[1].corrupted, true);
    await assert.rejects(saves.load("slot2"), /Save slot mismatch/);
    assert.ok(JSON.parse(await readFile(saves.filePath("slot1"), "utf8")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("mobile API: three careers, protected actions, autosave, abrupt restart and permanent death", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "p5e-three-slots-http-"));
  let child;
  t.after(async () => {
    await stop(child);
    await rm(dir, { recursive: true, force: true });
  });
  child = await launch(dir);

  const empty = await api("/api/slots");
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.data.slots.map((item) => item.slot), CAREER_SLOTS);
  assert.ok(empty.data.slots.every((item) => !item.occupied));

  assert.equal((await api("/api/new-game", { protagonist: "Luke", slot: "slot4" })).status, 400);
  const first = await api("/api/new-game", { protagonist: "Luke", slot: "slot1" });
  assert.equal(first.status, 200);
  assert.equal(first.data.slot, "slot1");
  assert.equal(first.data.story.sceneId, "intro-m01");

  const refused = await api("/api/new-game", { protagonist: "Fab", slot: "slot1" });
  assert.equal(refused.status, 409);
  assert.equal((await api("/api/load", { slot: "slot1" })).data.player.name, "Luke");

  const choice = first.data.story.choices[0];
  assert.ok(choice?.id, "M1 must have a real first choice");
  const move = await api("/api/choose", { choiceId: choice.id }, { "x-career-slot": "slot1" });
  assert.equal(move.status, 200);
  assert.equal((await api("/api/save", {}, { "x-career-slot": "slot1" })).status, 200);

  assert.equal((await api("/api/new-game", { protagonist: "Edward", slot: "slot2" })).status, 200);
  assert.equal((await api("/api/new-game", { protagonist: "Fab", slot: "slot3" })).status, 200);
  assert.equal((await api("/api/choose", { choiceId: choice.id }, { "x-career-slot": "slot1" })).status, 409);
  assert.equal((await api("/api/delete-slot", { slot: "slot2" })).status, 409);
  assert.equal((await api("/api/slots")).data.slots.length, 3);

  const second = await api("/api/load", { slot: "slot2" });
  assert.equal(second.data.player.name, "Edward");
  assert.equal((await api("/api/load", { slot: "slot1" })).data.player.name, "Luke");
  assert.equal((await api("/api/load", { slot: "slot3" })).data.player.name, "Fab");

  await stop(child); // SIGKILL leaves no opportunity for an exit handler to save.
  child = null;
  const saves = new SaveStore(dir);
  assert.equal((await saves.load("slot1")).story.nodeId, move.data.story.nodeId);
  assert.equal((await saves.load("slot2")).player.name, "Edward");
  assert.equal((await saves.load("slot3")).player.name, "Fab");

  const deceased = await saves.load("slot2");
  deceased.player.death.state = "dead";
  await saves.save(deceased);
  child = await launch(dir);
  const ended = await api("/api/load", { slot: "slot2" });
  assert.equal(ended.status, 200);
  assert.equal(ended.data.careerEnded, true);
  assert.equal(ended.data.story.sceneTitle, "Carriera conclusa");
  assert.deepEqual(ended.data.story.choices, []);
  assert.equal((await api("/api/choose", { choiceId: choice.id }, { "x-career-slot": "slot2" })).status, 409);
  assert.equal((await api("/api/slots")).data.slots[1].careerEnded, true);

  assert.equal((await api("/api/new-game", { protagonist: "Daniel", slot: "slot2" })).status, 409);
  assert.equal((await api("/api/new-game", {
    protagonist: "Daniel", slot: "slot2", confirmOverwrite: true
  })).status, 200);
  assert.equal((await saves.load("slot2")).player.name, "Daniel");
  assert.equal((await api("/api/delete-slot", { slot: "slot2", confirmDelete: true })).status, 200);
  assert.equal((await api("/api/slots")).data.slots[1].occupied, false);
  assert.equal((await api("/api/load", { slot: "slot2" })).status, 404);
  assert.equal((await saves.load("slot1")).player.name, "Luke");
  assert.equal((await saves.load("slot3")).player.name, "Fab");
});
