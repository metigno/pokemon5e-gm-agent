"use strict";
// Embedded Node.js runs inside the installed app, never on another machine.
// The plugin's writable datadir is stable across app updates; assets are not.
const { app, channel } = require("bridge");
const { join } = require("node:path");
const { randomBytes } = require("node:crypto");
const { existsSync } = require("node:fs");
process.env.P5E_SAVE_DIR = join(app.datadir(), "careers");
process.env.P5E_UI_HOST = "127.0.0.1";
process.env.P5E_UI_PORT = "4173";
const sessionToken = randomBytes(32).toString("hex");
process.env.P5E_UI_TOKEN = sessionToken;
process.env.P5E_REQUIRE_OFFLINE_SPRITES = "1";
process.env.P5E_REQUIRE_OFFLINE_CHARACTERS = "1";
process.env.P5E_REQUIRE_OFFLINE_AUDIO = existsSync(join(__dirname, "bookgame/ui/public/audio/manifest.json")) ? "1" : "0";

(async () => {
  await import("./bookgame/ui/server.mjs");
  // A successful module import is not proof the HTTP listener has bound yet.
  // Verify the exact loopback origin before transitioning the WebView.
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch("http://127.0.0.1:4173/?entry=" + sessionToken, { cache: "no-store", redirect: "manual" });
      if (response.status === 303) {
        channel.post("bookgame-server-ready", sessionToken);
        return;
      }
    } catch { /* listener still starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Il motore locale non è disponibile.");
})().catch(error => {
  channel.post("bookgame-server-error", String(error?.message || error));
});
