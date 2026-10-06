import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileStory } from "../src/compiler/story-compiler.mjs";
import {
  auditCanonicalRuntime,
  compileCanonicalAbilityRule,
  compileCanonicalItemRule
} from "../src/combat/canonical-runtime.mjs";
import { Poke5eDataRepository } from "../src/combat/poke5e-data.mjs";
import { auditSemanticCoverage } from "../src/combat/semantic-coverage.mjs";

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const warningAllowlistFile = fileURLToPath(
  new URL("../content/story-warning-allowlist.json", import.meta.url)
);

function warningIdentity(warning) {
  const at = String(warning.at ?? "");
  const hash = at.lastIndexOf("#");
  const filePart = hash >= 0 ? at.slice(0, hash) : at;
  const nodeId = hash >= 0 ? at.slice(hash + 1) : "";
  return [warning.code, path.basename(filePart), nodeId].join("|");
}

function allowlistIdentity(entry) {
  return [entry.code, entry.sceneFile, entry.nodeId].join("|");
}

test("RC semantic gate certifies every canonical ability and item with owned rule domains", async () => {
  const data = new Poke5eDataRepository();
  const [abilities, items] = await Promise.all([
    data.listAbilities(),
    data.listItems()
  ]);

  const semantic = auditSemanticCoverage({ abilities, items });
  assert.deepEqual(semantic.abilities.unresolved, []);
  assert.deepEqual(semantic.items.unresolved, []);
  assert.equal(semantic.abilities.total, 340);
  assert.equal(semantic.abilities.certified, 340);
  assert.equal(semantic.items.total, 305);
  assert.equal(semantic.items.certified, 305);

  assert.deepEqual(
    semantic.abilities.explicitExceptions.sort(),
    ["hunger-switch", "intrepid-sword", "keen-eye", "ripen", "unnerve"].sort()
  );
  assert.deepEqual(
    semantic.items.explicitExceptions.sort(),
    [
      "red-nectar", "yellow-nectar", "pink-nectar", "purple-nectar",
      "smoke-ball", "dna-splicer", "binoculars", "energy-cell",
      "flint-and-steel", "thieves-tools"
    ].sort()
  );

  for (const ability of abilities) {
    const rule = compileCanonicalAbilityRule(ability);
    assert.equal(rule.supported, true, `${ability.id} must be semantically certified`);
    assert.ok(rule.semanticDomains.length > 0, `${ability.id} needs a semantic domain`);
    assert.ok(rule.runtimeOwners.length > 0, `${ability.id} needs a runtime owner`);
  }

  for (const item of items) {
    const rule = compileCanonicalItemRule(item);
    assert.equal(rule.supported, true, `${item.id} must be semantically certified`);
    assert.ok(rule.semanticDomains.length > 0, `${item.id} needs a semantic domain`);
    assert.ok(rule.runtimeOwners.length > 0, `${item.id} needs a runtime owner`);
  }

  const canonical = auditCanonicalRuntime({ abilities, items });
  assert.deepEqual(canonical.abilities.unresolved, []);
  assert.deepEqual(canonical.items.unresolved, []);
});

test("RC warning gate triages exactly the known 117 compiler warnings and rejects drift", async () => {
  const allowlist = JSON.parse(fs.readFileSync(warningAllowlistFile, "utf8"));
  const bundle = await compileStory({ scenesDir });
  const actual = bundle.diagnostics.warnings.map(warningIdentity).sort();
  const expected = allowlist.entries.map(allowlistIdentity).sort();

  assert.equal(allowlist.schemaVersion, 1);
  assert.deepEqual(allowlist.expectedCounts, {
    total: 117,
    TERMINAL_NODE: 14,
    UNREACHABLE_NODE_LOCAL: 103
  });
  assert.equal(allowlist.entries.length, 117);
  assert.equal(new Set(expected).size, 117, "warning allowlist identities must be unique");
  assert.ok(
    allowlist.entries.every((entry) => typeof entry.reason === "string" && entry.reason.length > 0),
    "every accepted warning must have a triage reason"
  );

  assert.deepEqual(
    actual,
    expected,
    "compiler warning surface drifted: fix the graph or explicitly re-triage the changed warning"
  );

  const terminal = bundle.diagnostics.warnings.filter((entry) => entry.code === "TERMINAL_NODE");
  const unreachable = bundle.diagnostics.warnings.filter(
    (entry) => entry.code === "UNREACHABLE_NODE_LOCAL"
  );
  assert.equal(terminal.length, 14);
  assert.equal(unreachable.length, 103);
});
