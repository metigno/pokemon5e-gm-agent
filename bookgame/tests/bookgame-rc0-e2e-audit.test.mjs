import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("bookgame-rc0 locks the complete M01-M12 authored surface", () => {
  const modules = [];
  for (let i = 1; i <= 12; i += 1) {
    const id = i < 10 ? `M0${i}` : `M${i}`;
    const file = path.join(root, "content", "modules", `${id}.json`);
    assert.ok(fs.existsSync(file), `${id} manifest must exist`);
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(manifest.id, id);
    assert.ok(Array.isArray(manifest.blocks) && manifest.blocks.length > 0, `${id} must contain blocks`);
    assert.equal(manifest.requiredBeats.length, manifest.blocks.length, `${id} required beats must match blocks`);
    modules.push(manifest);
  }

  const totals = modules.reduce(
    (acc, module) => ({
      stitches: acc.stitches + module.targets.stitches,
      choices: acc.choices + module.targets.choices,
      blocks: acc.blocks + module.blocks.length
    }),
    { stitches: 0, choices: 0, blocks: 0 }
  );

  assert.deepEqual(totals, { stitches: 60000, choices: 35000, blocks: 159 });
});

test("bookgame-rc0 Node Library V2 lock records the final runtime baseline", () => {
  const lock = fs.readFileSync(path.join(root, "docs", "NODE_LIBRARY_V2_LOCK.md"), "utf8");
  assert.match(lock, /M12 — .* is \*\*COMPLETE\*\*/);
  assert.match(lock, /2,462 runtime-validated logical nodes \/ 5,555 meaningful choices/);
  assert.match(lock, /R01→R38/);
  assert.match(lock, /no R39/i);
});

test("bookgame-rc0 closes the post-M12 NPC delta without introducing a new Anchor", () => {
  const registry = JSON.parse(
    fs.readFileSync(path.join(root, "content", "npcs", "NPC_CHARACTER_LIBRARY_V1.json"), "utf8")
  );

  assert.equal(registry.status, "LOCKED_RC0_POST_M12_DELTA_PASS");
  assert.equal(registry.productionCoverage.M12, "complete_runtime_validated");
  assert.equal(registry.moduleAnchors.find((entry) => entry.module === "M12").id, null);
  assert.equal(registry.deltaAudit.required, false);
  assert.equal(registry.deltaAudit.completed, true);
  assert.equal(registry.deltaAudit.result, "PASS");

  const ids = [
    ...registry.five.map((entry) => entry.id),
    ...registry.moduleAnchors.map((entry) => entry.id).filter(Boolean),
    ...registry.verifiedAdditionalCharacters
      .filter((entry) => entry.verifiedRuntimeRegistration)
      .map((entry) => entry.id)
  ];
  assert.equal(new Set(ids).size, ids.length, "RC0 runtime NPC IDs must remain unique");
});

test("bookgame-rc0 M12 has no undeclared persistent NPC registration surface", () => {
  const scenesDir = path.join(root, "content", "scenes");
  const m12Scenes = fs.readdirSync(scenesDir).filter((name) => /^m12-.*\.json$/.test(name));
  assert.equal(m12Scenes.length, 12, "M12 should expose exactly 12 scene files");

  for (const name of m12Scenes) {
    const raw = fs.readFileSync(path.join(scenesDir, name), "utf8");
    assert.doesNotMatch(raw, /npc_register/i, `${name} must not register an undeclared M12 NPC`);
    assert.doesNotMatch(raw, /"npcId"\s*:/, `${name} must not introduce a structured M12 npcId`);
  }
});
