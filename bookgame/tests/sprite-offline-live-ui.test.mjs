import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const PORT = 4298;
const BASE = `http://127.0.0.1:${PORT}`;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO4B+M0AAAAASUVORK5CYII=", "base64");

async function waitForServer(child) {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (child.exitCode !== null) throw new Error("UI server exited unexpectedly");
    try {
      const response = await fetch(BASE + "/api/snapshot");
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error("UI server did not start");
}

test("real UI serves approved sprite files offline without a placeholder fallback", async (t) => {
  const spriteDir = await mkdtemp(join(tmpdir(), "p5e-sprite-http-"));
  const map = JSON.parse(await readFile(new URL("../assets/pokemon/sprite-runtime-map.json", import.meta.url)));
  try {
    for (const [id, role] of [["abra", "battleFront"], ["abra", "battleBack"], ["abra", "icon"], ["abra", "overworld"], ["growlithe-hisui", "battleFront"]]) {
      const asset = map.sprites[id][role];
      assert.ok(asset, `Missing canonical mapping for ${id}:${role}`);
      await mkdir(join(spriteDir, id), { recursive: true });
      await writeFile(join(spriteDir, id, asset), PNG);
    }
    const child = spawn(process.execPath, ["ui/server.mjs"], {
      cwd: new URL("../", import.meta.url),
      env: { ...process.env, P5E_UI_PORT: String(PORT), P5E_SPRITE_DIR: spriteDir },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    t.after(() => child.kill("SIGTERM"));
    await waitForServer(child).catch(e => { throw new Error(e.message + "\n" + stderr); });

    for (const url of ["/sprites/abra/battleFront", "/sprites/abra/battleBack", "/sprites/abra/icon", "/sprites/abra/overworld", "/sprites/growlithe-hisuian/battleFront"]) {
      const response = await fetch(BASE + url);
      assert.equal(response.status, 200, `${url}: ${stderr}`);
      assert.match(response.headers.get("content-type"), /^image\/png/);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), PNG);
    }
    const unavailable = await fetch(BASE + "/sprites/pikachu/icon");
    assert.equal(unavailable.status, 404, "missing sprite must not silently substitute a placeholder");
  } finally {
    await rm(spriteDir, { recursive: true, force: true });
  }
});
