import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../ui/public/index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../ui/public/app.mjs", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../ui/public/styles.css", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../ui/server.mjs", import.meta.url), "utf8");

test("Battle stage renders Pokemon images instead of placeholder orbs", () => {
  assert.match(html, /id="enemy-sprite"/);
  assert.match(html, /id="player-sprite"/);
  assert.doesNotMatch(html, /battle-orb/);
  assert.doesNotMatch(css, /\.battle-orb/);
});

test("Team, Battle, bench and evolution use the shared sprite route", () => {
  assert.match(app, /spriteUrl\(battle\.opponent\.speciesId, "battleFront"\)/);
  assert.match(app, /spriteUrl\(battle\.player\.speciesId, "battleBack"\)/);
  assert.match(app, /spriteUrl\(reserve\.speciesId, "icon"\)/);
  assert.match(app, /spriteUrl\(pokemon\.speciesId \?\? pokemon\.species, "icon"\)/);
  assert.match(app, /evolutionFromSprite\.src = spriteUrl\(presentation\.from, "battleFront"\)/);
  assert.match(app, /evolutionToSprite\.src = spriteUrl/);
});

test("sprite server resolves only canonical roles from the local manifest", () => {
  assert.match(server, /sprite-runtime-map\.json/);
  assert.match(server, /SPRITE_ROLES = new Set\(\["battleFront", "battleBack", "icon", "overworld"\]\)/);
  assert.match(server, /normalizeSpriteId\(requestedId\)/);
  assert.match(server, /spriteMap\.aliasIndex/);
  assert.match(server, /P5E_SPRITE_DIR/);
  assert.doesNotMatch(server, /fetch\s*\(\s*["'`]https?:\/\//);
  assert.match(server, /readFile\(join\(SPRITE_DIR, spriteId, asset\)\)/);
});
