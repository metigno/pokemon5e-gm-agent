import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { authoredOpponentLevelLimit, ecologicalLevelBand, validateAuthoredOpponentLevels } from "../src/engine/encounter-level-balance.mjs";
import { POKEMON_LEVEL_CAPS_BY_MODULE } from "../src/engine/pokemon-xp-balance.mjs";
import { ordinaryEncounterCandidates, selectOrdinaryEncounter } from "../src/engine/ecology.mjs";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const scenesRoot = new URL("../content/scenes/", import.meta.url);
const now = () => "2026-10-08T10:00:00.000Z";

async function authoredScenes() {
  const files = (await readdir(scenesRoot)).filter(name => name.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => ({
    file,
    scene: JSON.parse(await readFile(new URL(file, scenesRoot), "utf8"))
  })));
}

function combatEntries(scene) {
  return Object.entries(scene.nodes ?? {}).flatMap(([nodeId, node]) =>
    (node.choices ?? []).filter(choice => choice.combat).map(choice => ({
      nodeId,
      choiceId: choice.id,
      combat: choice.combat
    }))
  );
}

test("FASE 3: every authored M01-M12 Pokémon encounter respects module/elite bands", async () => {
  const scenes = await authoredScenes();
  const errors = [];
  const moduleCounts = Object.fromEntries(Object.keys(POKEMON_LEVEL_CAPS_BY_MODULE).map(m => [m, 0]));
  let staticCount = 0, dynamicWorldCount = 0;
  for (const { file, scene } of scenes) {
    for (const { nodeId, choiceId, combat } of combatEntries(scene)) {
      if (scene.moduleId && Object.hasOwn(moduleCounts, scene.moduleId)) moduleCounts[scene.moduleId]++;
      if (authoredOpponentLevelLimit(scene.moduleId, combat) == null) {
        if (scene.moduleId?.startsWith("M0") || scene.moduleId === "M10" || scene.moduleId === "M11") dynamicWorldCount++;
        continue;
      }
      staticCount++;
      for (const issue of validateAuthoredOpponentLevels(scene.moduleId, combat)) {
        errors.push({ file, nodeId, choiceId, id: combat.encounterId, ...issue });
      }
      if (!combat.opponentRegistered && !combat.competition) {
        for (const descriptor of [combat.opponent, ...(combat.opponentBench ?? [])].filter(Boolean)) {
          if (descriptor.level > POKEMON_LEVEL_CAPS_BY_MODULE[scene.moduleId]) {
            errors.push({ file, nodeId, id: combat.encounterId, reason: "wild_capture_bypasses_cap" });
          }
        }
      }
    }
  }
  assert.deepEqual(errors, [], JSON.stringify(errors, null, 2));
  assert.ok(staticCount >= 35, "Static encounters must be audited, not skipped");
  assert.ok(dynamicWorldCount >= 7, "Persistent World match entries remain untouched");
  assert.ok(moduleCounts.M07 >= 2);
  assert.ok(moduleCounts.M09 >= 3);
  assert.ok(moduleCounts.M11 >= 2);
});

test("FASE 3: promotions, tournaments and M07 qualifiers are challenging but attainable", async () => {
  const scenes = await authoredScenes();
  const lookup = new Map(scenes.flatMap(({ scene }) => combatEntries(scene).map(({ combat }) => [combat.encounterId, combat])));
  for (const [id, expected] of [
    ["A2_RANK_TRIAL_E_D", 6],
    ["A3_RANK_TRIAL_D_C", 8],
    ["A4_RANK_TRIAL_C_B", 10],
    ["A5_RANK_TRIAL_B_A", 13],
    ["A5_MASTERS_ENTRY_MATCH", 13],
    ["A6_RANK_TRIAL_A_S", 15],
    ["A6_CONTINENTAL_FINAL", 15],
    ["A7_WORLD_QUALIFIER_R1", 16],
    ["A7_WORLD_QUALIFIER_FINAL", 17],
    ["A7_LAST_CHANCE_FINAL", 17]
  ]) {
    const fight = lookup.get(id);
    assert.ok(fight, "Missing canonical combat " + id);
    const levels = [fight.opponent, ...(fight.opponentBench ?? [])].map(entry => entry.level);
    assert.ok(levels.every(level => level <= expected), id + ": " + levels);
  }
  // World games are resolved dynamically, NOT overwritten with proxy teams.
  for (const id of ["WORLD_GROUP_MD1", "WORLD_R16_PLAYER", "WORLD_FINAL_PLAYER"]) {
    const world = lookup.get(id);
    assert.ok(world);
    assert.equal(world.opponent, undefined);
  }
});

test("FASE 3: M02 poacher is a Trainer with a Pokémon, never a 'trainer' species", async () => {
  const scenes = await authoredScenes();
  const scene = scenes.find(x => x.file === "m02-poaching-network.json").scene;
  const fight = combatEntries(scene).find(x => x.combat.encounterId === "M2_POACHING_NETWORK_01").combat;
  assert.equal(fight.opponent.species, "Rattata");
  assert.equal(fight.opponent.level, 5);
  assert.equal(fight.opponent.trainerId, "PoacherCampo01");
  assert.equal(fight.opponentRegistered, true);
  assert.deepEqual(Object.keys(fight.returnNodes).sort(), ["lose", "win"]);
});

function catalogWithWild({ speciesMinLevel = 1, band = { min: 2, max: 4 } } = {}) {
  return {
    format: "p5e-librogame-ecology",
    zones: {
      TEST_WOODS: {
        sourceZoneId: "AST-GINESTRE",
        moduleId: "M01",
        levelBand: band,
        species: [{
          id: "wooloo", minLevel: speciesMinLevel, rarity: "common", weight: 4,
          distributionClass: "established_wild", activity: ["day"],
          habitats: ["field"], encounterMethods: ["wild_observation"]
        }]
      }
    }
  };
}

function wildScene() {
  return {
    id: "test-ecology-scene", moduleId: "M01", title: "Test locale",
    nodes: {
      start: { text: "Osservo.", choices: [{
        id: "observe", ecology: {
          requestId: "TEST_WOODS_SIGHTING", zoneId: "TEST_WOODS",
          habitat: "field", method: "wild_observation", allowedSpecies: ["wooloo"],
          returnNodes: { wooloo: "sighting", noEncounter: "empty" }
        }
      }] },
      sighting: { text: "Wooloo.", choices: [{
        id: "engage", combat: {
          encounterId: "TEST_WOOL00_01", opponent: { species: "Wooloo", level: 1 },
          opponentRegistered: false, goto: "handoff",
          returnNodes: { win: "win", lose: "lose", captured: "captured" }
        }
      }] },
      handoff: { text: "Combattimento.", choices: [] },
      empty: { text: "Nessun animale.", choices: [] },
      win: { text: "Vittoria.", choices: [] },
      lose: { text: "Sconfitta.", choices: [] },
      captured: { text: "Cattura.", choices: [] }
    }
  };
}

test("FASE 3: a zone's ecology determines its level, not the player's level or an extra die", async () => {
  const catalog = catalogWithWild();
  const dice = new SequenceDice([2]);
  const state = createNewGameState({ protagonist: "Luke", now });
  state.world.minuteOfDay = 600;
  state.player.roster[0].level = 20; // This must not affect the encounter.
  const chosen = selectOrdinaryEncounter(state, catalog, {
    requestId: "sample", zoneId: "TEST_WOODS", habitat: "field",
    method: "wild_observation", allowedSpecies: ["wooloo"]
  }, dice);
  assert.equal(chosen.speciesId, "wooloo");
  assert.equal(chosen.level, 3);
  assert.equal(ecologicalLevelBand("M01").max, 4);
  assert.equal(ecologicalLevelBand("M05").max, 11);
  assert.equal(ecologicalLevelBand("M06"), null);
  assert.equal(selectOrdinaryEncounter(state, catalogWithWild({ speciesMinLevel: 7 }), {
    zoneId: "TEST_WOODS", allowedSpecies: ["wooloo"]
  }, { roll: () => { throw new Error("should never roll illegal species"); } }), null);
  assert.equal(ordinaryEncounterCandidates(state, catalogWithWild({ speciesMinLevel: 7 }), {
    zoneId: "TEST_WOODS"
  }).length, 0);
});

test("FASE 3: selected ecology level is passed to the actual battle exactly once", async () => {
  const scene = wildScene();
  const engine = new BookgameEngine({
    scenes: { async load() { return structuredClone(scene); } },
    ecology: catalogWithWild(),
    dice: new SequenceDice([2]), now
  });
  let state = createNewGameState({ protagonist: "Luke", now });
  state.world.minuteOfDay = 600;
  state.story.sceneId = scene.id;
  state.story.nodeId = "start";
  state = await engine.choose(state, "observe");
  assert.equal(state.story.nodeId, "sighting");
  assert.equal(state.ecology.lastEncounter.level, 3);
  assert.equal(state.ecology.lastEncounter.targetSceneId, scene.id);
  state = await engine.choose(state, "engage");
  assert.equal(state.pending.opponent.level, 3);
  assert.equal(state.ecology.lastEncounter.usedForCombat, "TEST_WOOL00_01");
  const combatEngine = new Pokemon5eCombatEngine({ dice: new SequenceDice([10, 12]) });
  const battle = await combatEngine.createBattle(state.pending);
  assert.equal(battle.opponent.level, 3);
  const second = structuredClone(state);
  second.pending = null;
  second.story.nodeId = "sighting";
  const replay = await engine.choose(second, "engage");
  assert.equal(replay.pending.opponent.level, 1, "Old ecology roll must never be reused");
});

test("FASE 3: NPC Trainer level is separate from Pokémon level in live battle state", async () => {
  const base = wildScene();
  base.nodes.start.choices = [{
    id: "fight", combat: {
      encounterId: "TEST_TRAINER_01", opponent: {
        species: "Rattata", level: 5, trainerId: "NPC_TEST"
      }, opponentRegistered: true,
      goto: "handoff", returnNodes: { win: "win", lose: "lose" }
    }
  }];
  const engine = new BookgameEngine({
    scenes: { async load() { return structuredClone(base); } }, now
  });
  const state = createNewGameState({ protagonist: "Luke", now });
  state.story.sceneId = base.id;
  state.story.nodeId = "start";
  state.npcs.NPC_TEST = { trainerLevel: 2 };
  const handoff = await engine.choose(state, "fight");
  assert.equal(handoff.pending.opponent.level, 5);
  assert.equal(handoff.pending.opponentTrainerLevel, 2);
  const battle = await new Pokemon5eCombatEngine({
    dice: new SequenceDice([11, 13])
  }).createBattle(handoff.pending);
  assert.equal(battle.opponent.level, 5);
  assert.equal(battle.opponentTrainerLevel, 2);
  assert.equal(battle.opponentTrainerId, "NPC_TEST");
});
