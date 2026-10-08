import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { createNewGameState } from "../src/engine/state.mjs";
import { POKEMON_LEVEL_CAPS_BY_MODULE } from "../src/engine/pokemon-xp-balance.mjs";
import { selectOrdinaryEncounter } from "../src/engine/ecology.mjs";

const SCENES = new URL("../content/scenes/", import.meta.url);
const now = () => "2026-10-08T10:00:00.000Z";

async function loadScene(file) {
  return JSON.parse(await readFile(new URL(file, SCENES), "utf8"));
}

function allCombatEntries(scene) {
  const result = [];
  for (const [nodeId, node] of Object.entries(scene.nodes ?? {})) {
    for (const choice of node.choices ?? []) {
      if (choice.combat) result.push({ nodeId, choiceId: choice.id, combat: choice.combat });
    }
  }
  return result;
}

test("FASE 3: every playable M01-M12 combat has valid, fixed Pokemon levels", async () => {
  const files = (await readdir(SCENES)).filter((name) => name.endsWith(".json"));
  assert.ok(files.length >= 155, "The complete playable scene library must be audited");
  const totals = { static: 0, dynamic: 0, captures: 0 };

  for (const file of files) {
    const scene = await loadScene(file);
    for (const { combat } of allCombatEntries(scene)) {
      // Some authored World hunt scenes have no moduleId but declare their
      // canonical M09 milestone in the encounter identifier.
      const milestone = combat.encounterId?.match(/(?:^|[_-])m(0?[1-9]|1[0-2])(?:$|[_-])/i);
      const inferredModule = milestone ? `M${String(Number(milestone[1])).padStart(2, "0")}` : null;
      const moduleCap = POKEMON_LEVEL_CAPS_BY_MODULE[scene.moduleId ?? inferredModule];
      const dynamicWorld = Number.isInteger(combat.competition?.worldOpponentIndex) ||
        ["R16", "QF", "SF", "FINAL"].includes(combat.competition?.worldKnockoutRound);
      if (dynamicWorld) {
        totals.dynamic += 1;
        assert.ok(["M09", "M10", "M11"].includes(scene.moduleId), file);
        assert.equal(combat.opponent, undefined, file + ": world opponent must use persistent roster");
        assert.equal(combat.opponentBench, undefined, file);
        continue;
      }

      totals.static += 1;
      const members = [combat.opponent, ...(combat.opponentBench ?? [])];
      const allowedTopLevel = scene.moduleId === "M09" || scene.moduleId === "M10" ||
        scene.moduleId === "M11" || scene.moduleId === "M12"
        ? 20
        : Math.min(20, (moduleCap ?? 20) + 1);

      for (const member of members) {
        assert.ok(member && typeof member.species === "string" && member.species.length > 0,
          file + ": encounter species required");
        assert.notEqual(member.species.toLowerCase(), "trainer",
          file + ": Trainer ID is not a Pokemon species");
        assert.ok(Number.isInteger(member.level) && member.level >= 1 && member.level <= 20,
          file + ": Pokemon levels must be within 1..20");
        assert.ok(member.level <= allowedTopLevel,
          file + ": fixed NPC/mandatory battle more than one Pokemon level above module cap");
      }

      if (combat.returnNodes?.captured) {
        totals.captures += 1;
        assert.notEqual(combat.opponentRegistered, true,
          file + ": a registered Trainer Pokemon may never be captured");
        assert.ok(moduleCap && combat.opponent.level <= moduleCap,
          file + ": catchable wild Pokemon must not exceed current module cap");
      }
    }
  }

  assert.ok(totals.static >= 61, "Expected all fixed authored combats");
  assert.equal(totals.dynamic, 7, "World stage must load seven dynamic Lv20 matches");
  assert.ok(totals.captures >= 15, "Expected existing authored optional catches");
});

test("FASE 3: rank trials, Masters, Continental and World qualifiers have stable levels", async () => {
  const cases = [
    ["m05-promotion-trial-b-a.json", "A5_RANK_TRIAL_B_A", 12],
    ["m05-masters-entry.json", "A5_MASTERS_ENTRY_MATCH", 13],
    ["m06-continental-cup.json", "A6_CONTINENTAL_QF", 14],
    ["m06-continental-cup.json", "A6_CONTINENTAL_SF", 14],
    ["m06-continental-cup.json", "A6_CONTINENTAL_FINAL", 14],
    ["m06-masters-circuit.json", "M6_MASTERS_CIRCUIT_MATCH_01", 14],
    ["m06-promotion-trial-a-s.json", "A6_RANK_TRIAL_A_S", 15],
    ["m07-world-qualifier.json", "A7_WORLD_QUALIFIER_R1", 16],
    ["m07-world-qualifier.json", "A7_WORLD_QUALIFIER_FINAL", 17],
    ["m07-last-chance.json", "A7_LAST_CHANCE_FINAL", 17]
  ];
  for (const [file, id, level] of cases) {
    const scene = await loadScene(file);
    const entries = allCombatEntries(scene).filter(({ combat }) => combat.encounterId === id);
    assert.equal(entries.length, 1, file + ": expected one stable handoff for " + id);
    const members = [entries[0].combat.opponent, ...(entries[0].combat.opponentBench ?? [])];
    assert.ok(members.length >= 3, id + ": complete authored team expected");
    assert.deepEqual(members.map((member) => member.level),
      Array.from({ length: members.length }, () => level), id);
  }
});

test("FASE 3: NPC Trainer identity and its Pokemon level stay distinct", async () => {
  const scene = await loadScene("m02-poaching-network.json");
  const entry = allCombatEntries(scene).find(({ combat }) => combat.encounterId === "M2_POACHING_NETWORK_01");
  assert.ok(entry);
  assert.equal(entry.combat.opponent.trainerId, "PoacherCampo01");
  assert.equal(entry.combat.opponent.species, "Houndour");
  assert.equal(entry.combat.opponent.level, 5);
  assert.equal(entry.combat.opponentRegistered, true);
  assert.equal(entry.combat.opponent.trainerLevel, undefined,
    "Do not invent a Trainer level from a Pokemon level");
});

test("FASE 3: an invalid higher-level capture cannot enter roster or bypass cap", () => {
  const engine = new BookgameEngine({ now });
  const state = createNewGameState({ protagonist: "Luke", now });
  state.story.sceneId = "first-road";
  state.pending = {
    type: "pokemon5e_combat",
    encounterId: "CAP_GUARD",
    moduleId: "M01",
    sceneId: "first-road",
    opponentRegistered: false,
    returnNodes: { captured: "first-road#arrival" },
    battle: { opponent: { speciesId: "wooloo", level: 6 } }
  };
  const oldRoster = structuredClone(state.player.roster);
  assert.throws(() => engine.resolveCombatHandoff(state, "captured"), /level cap 5/);
  assert.deepEqual(state.player.roster, oldRoster, "Invalid capture must not mutate the save");
});

test("FASE 3: ecological selection chooses a species, not an artificial scaled Pokemon level", () => {
  const state = createNewGameState({ protagonist: "Luke", now });
  state.world.minuteOfDay = 600;
  const catalog = {
    format: "p5e-librogame-ecology",
    zones: {
      AST_TEST: {
        sourceZoneId: "AST-GINESTRE",
        species: [{
          id: "wooloo", weight: 1, distributionClass: "established_wild",
          activity: ["day"], habitats: ["field"], encounterMethods: ["wild_observation"]
        }]
      }
    }
  };
  const encounter = selectOrdinaryEncounter(state, catalog, {
    requestId: "ECOLOGY_LEVEL_GUARD", zoneId: "AST_TEST",
    habitat: "field", method: "wild_observation"
  }, { roll: () => 1 });
  assert.equal(encounter.speciesId, "wooloo");
  assert.equal(encounter.capturable, true);
  assert.equal(encounter.level, undefined,
    "The ecological sampler must use the authored target encounter, not invent a level");
});
