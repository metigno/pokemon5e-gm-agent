import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

test("mobile loopback rejects foreign clients but allows an authenticated offline career UI", async (t) => {
  const port = 42571;
  const token = "ab".repeat(32);
  const base = `http://127.0.0.1:${port}`;
  const dir = await mkdtemp(join(tmpdir(), "p5e-mobile-token-"));
  const child = spawn(process.execPath, ["ui/server.mjs"], {
    cwd: new URL("../", import.meta.url),
    env: {
      ...process.env, P5E_UI_HOST: "127.0.0.1", P5E_UI_PORT: String(port),
      P5E_UI_TOKEN: token, P5E_SAVE_DIR: dir,
      P5E_REQUIRE_OFFLINE_SPRITES: "0", P5E_REQUIRE_OFFLINE_CHARACTERS: "0"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", bytes => { stderr += bytes.toString(); });
  t.after(async () => {
    child.kill();
    await rm(dir, { recursive: true, force: true });
  });
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) throw Error("UI server crashed: " + stderr);
    try {
      const response = await fetch(base + "/api/slots");
      if (response.status === 403) { ready = true; break; }
    } catch { /* startup */ }
    await delay(100);
  }
  assert.ok(ready, "embedded-mode server must respond locally");

  const denied = await fetch(base + "/api/snapshot");
  assert.equal(denied.status, 403);
  const spoof = await fetch(base + "/api/slots", {
    headers: { cookie: "p5e_mobile_session=wrong" }
  });
  assert.equal(spoof.status, 403);
  const entered = await fetch(base + "/?entry=" + token, { redirect: "manual" });
  assert.equal(entered.status, 303);
  assert.equal(entered.headers.get("location"), "/");
  const cookie = entered.headers.get("set-cookie")?.split(";")[0];
  assert.equal(cookie, "p5e_mobile_session=" + token);
  assert.match(entered.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);
  const authorized = await fetch(base + "/api/slots", { headers: { cookie } });
  assert.equal(authorized.status, 200);
  const data = await authorized.json();
  assert.equal(data.ok, true);
  assert.equal(data.slots.length, 3);
  const home = await fetch(base + "/", { headers: { cookie } });
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Pokémon 5e Digital Bookgame/);
});
