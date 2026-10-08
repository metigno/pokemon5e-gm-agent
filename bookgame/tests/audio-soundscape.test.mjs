import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectSoundtrack } from "../ui/public/audio-soundscape.mjs";

const scene = (moduleId, sceneTitle = "Lungo la strada", battle = null) => ({
  hasSession: true, story: { moduleId, sceneTitle }, battle
});

test("title and all M01–M12 chapters have independent scene tracks", () => {
  assert.equal(selectSoundtrack({ hasSession: false }), "intro");
  for (let number = 1; number <= 12; number++) {
    const moduleId = "M" + String(number).padStart(2, "0");
    assert.equal(selectSoundtrack(scene(moduleId)), moduleId.toLowerCase());
  }
});

test("wild, trainer, champion, legendary and world final battles are distinguished", () => {
  assert.equal(selectSoundtrack(scene("M01", "Strada", { encounterId: "wild-1" })), "battle_wild");
  assert.equal(selectSoundtrack(scene("M01", "Strada", { encounterId: "rival", opponentTrainerId: "Fab" })), "battle_trainer");
  assert.equal(selectSoundtrack(scene("M06", "Strada", { encounterId: "elite-four", opponentTrainerId: "Lance" })), "battle_boss");
  assert.equal(selectSoundtrack(scene("M08", "Strada", { encounterId: "kyurem_black" })), "battle_legendary");
  assert.equal(selectSoundtrack(scene("M12", "Strada", { encounterId: "world_cup_final" })), "pwt_final");
});

test("narrative mood follows existing scene title without changing story state", () => {
  const original = scene("M04", "Crisi nel porto");
  const untouched = structuredClone(original);
  assert.equal(selectSoundtrack(original), "danger");
  assert.equal(selectSoundtrack(scene("M03", "Indagini nella caverna")), "mystery");
  assert.equal(selectSoundtrack(scene("M05", "Un momento di riposo")), "calm");
  assert.equal(selectSoundtrack(scene("M12", "Vittoria nei mondiali")), "pwt_victor");
  assert.deepEqual(original, untouched);
});

test("app exposes real audio controls and disabled-by-default local installation", async () => {
  const app = await readFile(new URL("../ui/public/app.mjs", import.meta.url), "utf8");
  const html = await readFile(new URL("../ui/public/index.html", import.meta.url), "utf8");
  const server = await readFile(new URL("../ui/server.mjs", import.meta.url), "utf8");
  assert.match(app, /soundscape\.sync\(snapshot\)/);
  assert.match(app, /soundscape\.setOverride\("evolution"\)/);
  assert.match(app, /soundscape\.playCry/);
  assert.match(app, /soundscape\.playEffect\("ui_confirm"\)/);
  assert.match(html, /id="audio-toggle"/);
  assert.match(html, /id="start-audio"/);
  assert.match(server, /serveAudio\(res, url\.pathname\)/);
});
