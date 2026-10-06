import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryPath = path.join(root, "content", "npcs", "NPC_CHARACTER_LIBRARY_V1.json");
const lockPath = path.join(root, "docs", "NPC_CHARACTER_LIBRARY_V1_LOCK.md");

test("NPC Character Library V1 exists and has the locked Five/Anchor baseline", () => {
  assert.ok(fs.existsSync(registryPath), "NPC registry must exist");
  assert.ok(fs.existsSync(lockPath), "NPC library lock doc must exist");

  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  assert.equal(registry.version, 1);
  assert.equal(registry.five.length, 5);
  assert.deepEqual(
    registry.five.map((entry) => entry.id),
    ["Luke", "Mattew", "Daniel", "Edward", "Fab"]
  );

  const anchors = Object.fromEntries(
    registry.moduleAnchors.map((entry) => [entry.module, entry.id])
  );
  assert.deepEqual(anchors, {
    M01: "Blue",
    M02: "N",
    M03: "Steven",
    M04: "Archie",
    M05: "Lance",
    M06: "Red",
    M07: "Cynthia",
    M08: "AstridVahl",
    M09: "KaiaSolari",
    M10: "SilasCrowe",
    M11: "Rei",
    M12: null
  });
});

test("NPC Character Library runtime IDs are unique and M12 remains callback-only", () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

  const ids = [
    ...registry.five.map((entry) => entry.id),
    ...registry.moduleAnchors.map((entry) => entry.id).filter(Boolean),
    ...registry.verifiedAdditionalCharacters
      .filter((entry) => entry.verifiedRuntimeRegistration)
      .map((entry) => entry.id)
  ];

  assert.equal(new Set(ids).size, ids.length, "runtime character IDs must be unique");
  assert.equal(registry.productionCoverage.M11, "complete_runtime_validated");
  assert.equal(registry.productionCoverage.M12, "complete_runtime_validated");
  assert.equal(registry.m12Policy.anchor, "cast completo / WORLD_EXIT");
  assert.equal(registry.m12Policy.noTeleportForGroupScene, true);
  assert.equal(registry.deltaAudit.required, false);
  assert.equal(registry.deltaAudit.completed, true);
  assert.equal(registry.deltaAudit.result, "PASS");
  assert.equal(registry.deltaAudit.evidence.m12NpcRegisterMentions, 0);
  assert.equal(registry.deltaAudit.evidence.m12StructuredNpcIds, 0);
  assert.equal(registry.deltaAudit.evidence.newM12Anchor, false);
});

test("NPC library lock documents the evidence-based persistence rule", () => {
  const lock = fs.readFileSync(lockPath, "utf8");
  assert.match(lock, /M12 is intentionally not assigned a new Anchor/);
  assert.match(lock, /Ranger Elio Mar/);
  assert.match(lock, /Maxie/);
  assert.match(lock, /Sera Noll/);
  assert.match(lock, /Delta audit after M12 — PASS/);
  assert.match(lock, /0.*npc_register/);
  assert.match(lock, /release-candidate complete/);
  assert.match(lock, /reuse first, add only when genuinely new/i);
});
