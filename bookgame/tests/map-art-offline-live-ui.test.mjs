import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  APPROVED_MAP_SVG_IDS, APPROVED_MAP_ILLUSTRATION_IDS
} from "../src/assets/map-illustrations.mjs";

const PORT = 4379;
const ROOT = `http://127.0.0.1:${PORT}`;

async function waitForServer(child) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error("Local Bookgame UI exited prematurely");
    try {
      if ((await fetch(ROOT + "/api/snapshot")).ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error("Local Bookgame UI not reachable");
}

test("every allowlisted M01–M12 map graphic is actually served byte-for-byte offline", async (t) => {
  const saves = await mkdtemp(join(tmpdir(), "p5e-map-art-http-"));
  const child = spawn(process.execPath, ["ui/server.mjs"], {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, P5E_UI_PORT: String(PORT), P5E_SAVE_DIR: saves },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (buffer) => { stderr += buffer.toString(); });
  t.after(async () => { child.kill("SIGTERM"); await rm(saves, { recursive: true, force: true }); });
  await waitForServer(child).catch((error) => { throw new Error(error.message + "\n" + stderr); });

  let checked = 0;
  for (const [ids, extension, mime] of [
    [APPROVED_MAP_SVG_IDS, "svg", /^image\/svg\+xml/],
    [APPROVED_MAP_ILLUSTRATION_IDS, "png", /^image\/png/]
  ]) {
    for (const id of ids) {
      const expected = await readFile(new URL(`../assets/maps/illustrations/${id}.${extension}`, import.meta.url));
      const response = await fetch(`${ROOT}/map-art/${id}.${extension}`);
      assert.equal(response.status, 200, `${id}: ${stderr}`);
      assert.match(response.headers.get("content-type"), mime);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected, `Wrong bytes for ${id}`);
      checked++;
    }
  }
  assert.ok(checked >= 54, "Entire approved offline graphic bundle must be served");

  for (const url of [
    "/map-art/unknown.svg", "/map-art/unknown.png",
    "/map-art/m01-ginestre.svg", "/map-art/m08-world-village.png",
    "/map-art/..%2F..%2Fetc%2Fpasswd.svg"
  ]) {
    const response = await fetch(ROOT + url);
    assert.equal(response.status, 404, `Unapproved map art must never be served: ${url}`);
  }
});
