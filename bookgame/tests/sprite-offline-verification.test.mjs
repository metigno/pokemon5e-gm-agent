import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyOfflineSpriteAssets } from "../scripts/verify-offline-sprites.mjs";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO4B+M0AAAAASUVORK5CYII=", "base64");

test("offline sprite verification checks actual PNG bytes and required roles", async () => {
  const root = await mkdtemp(join(tmpdir(), "p5e-sprite-verify-"));
  try {
    const sprites = {};
    for (let i = 0; i < 619; i++) {
      const id = `pokemon-${i}`;
      sprites[id] = { battleFront: "front.png", battleBack: "back.png", icon: "icon.png", overworld: i === 0 ? "overworld.png" : null };
      await mkdir(join(root, id));
      for (const asset of ["front.png", "back.png", "icon.png", ...(i === 0 ? ["overworld.png"] : [])]) {
        await writeFile(join(root, id, asset), PNG);
      }
    }
    const map = { sprites };
    const complete = await verifyOfflineSpriteAssets(map, root);
    assert.equal(complete.valid, true);
    assert.equal(complete.verifiedPng, 619 * 3 + 1);

    await rm(join(root, "pokemon-1", "back.png"));
    const missing = await verifyOfflineSpriteAssets(map, root);
    assert.equal(missing.valid, false);
    assert.match(missing.missing.join(" "), /pokemon-1:battleBack/);

    await writeFile(join(root, "pokemon-1", "back.png"), Buffer.from("placeholder"));
    const invalid = await verifyOfflineSpriteAssets(map, root);
    assert.equal(invalid.valid, false);
    assert.match(invalid.invalid.join(" "), /pokemon-1:battleBack/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
