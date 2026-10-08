import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const importer = fileURLToPath(new URL("../scripts/import-sprite-package.mjs", import.meta.url));
const map = JSON.parse(await readFile(new URL("../assets/pokemon/sprite-runtime-map.json", import.meta.url), "utf8"));
const required = ["battleFront", "battleBack", "icon"];

test("strict importer refuses incomplete package without writing any sprites", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "p5e-sprite-incomplete-"));
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
  const source = join(root, "source");
  const destination = join(root, "destination");
  await mkdir(source);
  const result = spawnSync(process.execPath, [importer, source, destination, "--strict"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stderr);
  assert.ok(report.missingRequiredAssets > 0);
  await assert.rejects(stat(destination), { code: "ENOENT" });
});

test("strict importer installs all canonical front/back/icon assets from complete fixture", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "p5e-sprite-complete-"));
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
  const source = join(root, "source");
  const destination = join(root, "destination");
  const expected = new Set();
  for (const [spriteId, roles] of Object.entries(map.sprites)) {
    const folder = join(source, spriteId);
    await mkdir(folder, { recursive: true });
    for (const role of required) {
      const filename = roles[role];
      assert.ok(filename, `Missing map role ${spriteId}/${role}`);
      await writeFile(join(folder, filename), "fixture");
      expected.add(`${spriteId}/${filename}`);
    }
  }
  const result = spawnSync(process.execPath, [importer, source, destination, "--strict"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.missingRequiredAssets, 0);
  assert.equal(report.expectedSprites, Object.keys(map.sprites).length);
  assert.equal(report.copiedFiles, expected.size);
  for (const relative of expected) {
    assert.equal((await readFile(join(destination, relative), "utf8")), "fixture");
  }
});
