import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO4B+M0AAAAASUVORK5CYII=", "base64");

test("strict importer treats --strict as an option, never an output directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "p5e-strict-path-"));
  try {
    const scripts = join(root, "scripts");
    const source = join(root, "source", "pikachu");
    const mapDir = join(root, "assets", "pokemon");
    await mkdir(scripts, { recursive: true });
    await mkdir(source, { recursive: true });
    await mkdir(mapDir, { recursive: true });
    await writeFile(join(scripts, "import-sprite-package.mjs"), await readFile(new URL("../scripts/import-sprite-package.mjs", import.meta.url)));
    await writeFile(join(mapDir, "sprite-runtime-map.json"), JSON.stringify({format:"p5e-librogame-sprite-runtime-map",sprites:{pikachu:{battleFront:"front.png",battleBack:"back.png",icon:"icon.png"}}}));
    for (const name of ["front.png", "back.png", "icon.png"]) await writeFile(join(source, name), PNG);
    const result = spawnSync(process.execPath, [join(scripts, "import-sprite-package.mjs"), join(root, "source"), "--strict"], {cwd:root, encoding:"utf8"});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).copiedFiles, 3);
    assert.deepEqual(await readFile(join(mapDir, "files", "pikachu", "front.png")), PNG);
    await assert.rejects(access(join(root, "--strict", "pikachu", "front.png")));
  } finally {
    await rm(root, { recursive:true, force:true });
  }
});
