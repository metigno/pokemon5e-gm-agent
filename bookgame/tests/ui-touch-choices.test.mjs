import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("progression and roster decisions use touch controls, never native text prompts", async () => {
  const [app, html, css] = await Promise.all([
    read("../ui/public/app.mjs"),
    read("../ui/public/index.html"),
    read("../ui/public/styles.css")
  ]);

  assert.doesNotMatch(app, /window\.prompt\s*\(/);
  assert.match(html, /id="choice-overlay"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /id="choice-dialog-cancel"/);
  assert.match(css, /\.choice-dialog-option/);

  for (const action of [
    "/api/pokemon/learn-move",
    "/api/pokemon/replace-move",
    "/api/pokemon/asi",
    "/api/pokemon/level-up",
    "/api/choose",
    "/api/evolution/apply"
  ]) {
    assert.ok(app.includes(action), `existing runtime endpoint lost: ${action}`);
  }

  assert.match(app, /chooseTouchOption\(/);
  assert.match(app, /chooseMoveToForget\(/);
  assert.match(app, /chooseAsiDistribution\(/);
  assert.match(app, /const distribution = await chooseAsiDistribution/);
  assert.match(app, /availableMoves\.map/);
  assert.match(app, /oldFocus\?\.focus\?\.\(/);
});

test("pending move names are resolved by the existing snapshot without changing action IDs", async () => {
  const server = await read("../ui/server.mjs");
  assert.match(server, /moveName: await moveName\(entry\.moveId\)/);
  assert.match(server, /availableMoves: await Promise\.all/);
  assert.match(server, /id,\s*name: await moveName\(id\)/);
  assert.match(server, /forgetMoveId: body\.forgetMoveId/);
});
