import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const base = new URL("../mobile/", import.meta.url);
const getText = name => readFile(new URL(name, base), "utf8");

test("Step 13 native host is local-only and preserves canonical engine ownership", async () => {
  const config = JSON.parse(await getText("capacitor.config.json"));
  assert.equal(config.webDir, "dist");
  assert.equal(config.server?.url, undefined, "never use an online/backend URL");
  assert.deepEqual(config.server.allowNavigation, ["127.0.0.1"]);
  assert.deepEqual(config.plugins.Nodejs, { nodeDir: "nodejs", startMode: "manual" });
  const runtime = await getText("runtime/index.cjs");
  assert.match(runtime, /bridge/);
  assert.match(runtime, /app\.datadir\(\)/, "saves must survive app updates");
  assert.match(runtime, /P5E_UI_HOST = "127\.0\.0\.1"/);
  assert.match(runtime, /P5E_REQUIRE_OFFLINE_SPRITES = "1"/);
  assert.match(runtime, /P5E_REQUIRE_OFFLINE_CHARACTERS = "1"/);
  assert.match(runtime, /P5E_REQUIRE_OFFLINE_AUDIO = "1"/);
  assert.match(runtime, /import\("\.\/bookgame\/ui\/server\.mjs"\)/, "reuse canonical UI server");
  const bootstrap = await getText("src/bootstrap.mjs");
  assert.match(bootstrap, /127\.0\.0\.1:4173/);
  assert.doesNotMatch(bootstrap, /https:\/\//);
});

test("Step 13 packaging checks physical canonical assets and copies compiled catalogs", async () => {
  const builder = await getText("build.mjs");
  for (const gate of [
    "verifyOfflineSpriteAssets", "verifyOfflineCharacterSprites",
    "verifyOfflineNativeCharacterSprites", "verifyOfflineAudioAssets",
    "APPROVED_MAP_ILLUSTRATION_IDS", "assertNoSymlinks", "assertBundle",
    "src", "content", "data", "assets", "ui", "build", "scripts"
  ]) assert.ok(builder.includes(gate), gate);
  assert.match(builder, /Mobile release BLOCKED: missing or invalid offline music pack/);
  assert.match(builder, /audio:import/);
  assert.match(builder, /audio\.verified/);
  assert.doesNotMatch(builder, /fetch\s*\(/, "no asset downloads inside release packager");
  assert.match(builder, /install-trainer-overlay\.py/, "explicit approved ZIP must be imported by offline build");
  assert.match(builder, /P5E_TRAINER_OVERLAY_ZIP/, "Android debug uses the same local artwork");
  assert.match(builder, /verifyMandatoryAssets\(target\)/, "post-copy native APK asset checks required");
  const stdout = execFileSync(process.execPath, [new URL("build.mjs", base).pathname, "--contract"], {
    cwd: new URL("../", base), encoding: "utf8"
  });
  assert.match(stdout, /PASS/);
});

test("Step 13 Android permissions only allow cleartext for loopback", async () => {
  const policy = await getText("scripts/configure-android.mjs");
  assert.match(policy, /cleartextTrafficPermitted="false"/);
  assert.match(policy, /127\.0\.0\.1/);
  assert.match(policy, /bookgame_network_security/);
  const packageJson = JSON.parse(await getText("package.json"));
  assert.ok(packageJson.dependencies["@capawesome/capacitor-nodejs"]);
  assert.ok(packageJson.dependencies["@capacitor/android"]);
  assert.match(packageJson.scripts["android:debug"], /build:web/);
});
