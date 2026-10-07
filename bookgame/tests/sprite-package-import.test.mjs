import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("sprite package importer reuses the canonical runtime map and rejects Gigantamax", async () => {
  const source = await readFile(new URL("../scripts/import-sprite-package.mjs", import.meta.url), "utf8");
  assert.match(source, /sprite-runtime-map\.json/);
  assert.match(source, /gmax\|gigantamax/i);
  assert.match(source, /requiredRoles = \["battleFront", "battleBack", "icon"\]/);
  assert.match(source, /missingRequiredAssets/);
  assert.doesNotMatch(source, /https?:\/\//);
});
