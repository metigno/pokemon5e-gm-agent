import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const PORT = 4299;
const BASE = "http://127.0.0.1:" + PORT;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO4B+M0AAAAASUVORK5CYII=", "base64");
const uiDir = new URL("../", import.meta.url);
const spriteMap = JSON.parse(await readFile(new URL("../assets/pokemon/sprite-runtime-map.json", import.meta.url)));

async function waitForServer(child) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error("Release-mode server failed to start");
    try {
      const response = await fetch(BASE + "/api/snapshot");
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error("Release-mode UI did not start");
}

test("release mode refuses missing sprites and serves all roles from a complete offline directory", async (t) => {
  const missingDir = await mkdtemp(join(tmpdir(), "p5e-release-missing-"));
  const completeDir = await mkdtemp(join(tmpdir(), "p5e-release-complete-"));
  t.after(async () => {
    await rm(missingDir, { recursive:true, force:true });
    await rm(completeDir, { recursive:true, force:true });
  });
  const missing = spawnSync(process.execPath, ["ui/server.mjs"], {
    cwd: uiDir,
    env: { ...process.env, P5E_SPRITE_DIR: missingDir, P5E_REQUIRE_OFFLINE_SPRITES: "1", P5E_UI_PORT: String(PORT) },
    encoding: "utf8",
    timeout: 15000
  });
  assert.notEqual(missing.status, 0, "missing sprites must block release startup");
  assert.match(missing.stderr, /Offline sprite release incomplete/);

  for (const [species, assets] of Object.entries(spriteMap.sprites)) {
    const folder = join(completeDir, species);
    await mkdir(folder, { recursive:true });
    for (const role of ["battleFront", "battleBack", "icon", "overworld"]) {
      if (assets[role]) await writeFile(join(folder, assets[role]), PNG);
    }
  }
  const child = spawn(process.execPath, ["ui/server.mjs"], {
    cwd: uiDir,
    env: { ...process.env, P5E_SPRITE_DIR: completeDir, P5E_REQUIRE_OFFLINE_SPRITES: "1", P5E_UI_PORT: String(PORT) },
    stdio:["ignore","pipe","pipe"]
  });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk.toString(); });
  t.after(() => child.kill("SIGTERM"));
  await waitForServer(child).catch(e => { throw new Error(e.message + "\n" + stderr); });
  for (const role of ["battleFront", "battleBack", "icon", "overworld"]) {
    const response = await fetch(BASE + "/sprites/abra/" + role);
    assert.equal(response.status, 200, role + ": " + stderr);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), PNG);
  }
});
