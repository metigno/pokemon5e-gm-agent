import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateScene } from "../src/compiler/story-compiler.mjs";
import { evaluateCondition } from "../src/engine/conditions.mjs";
import { Poke5eDataRepository } from "../src/combat/poke5e-data.mjs";
import { POKEMON_LEVEL_CAPS_BY_MODULE, pokemonLevelCapForState } from "../src/engine/pokemon-xp-balance.mjs";
import { swapPlayerRosterSlots } from "../src/engine/player-roster-selection.mjs";
import { captureBallsInInventory, attemptCapture } from "../src/combat/capture.mjs";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const load = async (filename) => JSON.parse(await readFile(fileURLToPath(new URL(filename, import.meta.url)), "utf8"));
const hunt = await load("../content/scenes/legendary-world-hunt.json");
const interday = await load("../content/scenes/m09-interday-one.json");
const trainerSpecies = [
  ["Luke", "luke", "black-kyurem", 20],
  ["Mattew", "mattew", "zacian-crowned", 20],
  ["Daniel", "daniel", "mewtwo", 20],
  ["Edward", "edward", "lugia", 20],
  ["Fab", "fab", "rayquaza", 18]
];

function stateFor(name, id, level, { qualified = true, evidence = true, captured = false, quest = "active" } = {}) {
  return {
    player: { name, trainerLevel: level },
    world: { flags: {
      m8_complete: true,
      m9_matchday_one_complete: true,
      m8_world_registration_complete: true,
      world_qualified: qualified,
      ["legendary_m09_clue_" + id]: evidence,
      ["legendary_world_captured_" + id]: captured
    }},
    quests: { ["legendary_m08_lead_" + id]: { status: quest } },
    story: { sceneId: "legendary-world-hunt" }
  };
}

test("World legendary encounters are compiled as optional side content from real M09 Interday 1", () => {
  const validation = validateScene(hunt, { sourceFile: "legendary-world-hunt.json" });
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  const choice = interday.nodes.media_window.choices.find(c => c.id === "media_resources");
  assert.equal(choice.goto, "legendary-world-hunt#hunt_entry");
  assert.deepEqual(choice.effects, [{ type: "set_flag", key: "m9_personal_press_notes_reviewed", value: true }]);
  assert.equal(Object.keys(interday.nodes).length, 13, "Main M09 logical node budget unchanged");
  assert.equal(Object.values(interday.nodes).reduce((s,n) => s + (n.choices?.length ?? 0), 0), 30);
  assert.equal(hunt.moduleId, undefined, "optional side scene does not change canonical M09 module budget");
  assert.equal(hunt.nodes.hunt_entry.choices.some(c => c.goto === "m09-interday-one#resource_guard"), true);
});

test("Every trainer has one catchable wild Pokémon with legal species minimum and M09 cap", async () => {
  const data = new Poke5eDataRepository();
  assert.equal(POKEMON_LEVEL_CAPS_BY_MODULE.M09, 20);
  for (const [name, id, speciesId, encounterLevel] of trainerSpecies) {
    const lead = hunt.nodes.hunt_leads.choices.find(c => c.id === "follow_" + id);
    const encounter = hunt.nodes[id + "_approach"].choices.find(c => c.id === "challenge_" + id);
    const pokemon = await data.getSpecies(speciesId);
    assert.equal(pokemon.id, speciesId);
    assert.ok(encounterLevel >= pokemon.minLevel, name + " cannot spawn under minimum species level");
    assert.ok(encounterLevel <= POKEMON_LEVEL_CAPS_BY_MODULE.M09, "M09 cap");
    assert.equal(encounter.combat.opponent.species, speciesId);
    assert.equal(encounter.combat.opponent.level, encounterLevel);
    assert.equal(encounter.combat.opponentRegistered, false, "wild opponent is capturable");
    assert.equal(encounter.combat.competition, undefined, "not a Championship match");
    assert.equal(encounter.combat.returnNodes.captured, id + "_captured");
    for (const outcome of ["win", "lose", "fled"]) {
      assert.equal(encounter.combat.returnNodes[outcome], id + "_uncaught");
    }
    const record = hunt.nodes[id + "_captured"].choices[0];
    assert.ok(record.effects.some(e => e.type === "quest_complete" && e.questId === "legendary_m08_lead_" + id));
    assert.ok(record.effects.some(e => e.type === "set_flag" && e.key === "legendary_world_captured_" + id && e.value === true));
    assert.equal(evaluateCondition(stateFor(name, id, encounterLevel), lead.conditions), true, name + " can follow eligible clue");
    assert.equal(evaluateCondition(stateFor(name, id, encounterLevel - 1), lead.conditions), false, name + " needs legal Trainer level");
    assert.equal(evaluateCondition(stateFor(name, id, encounterLevel, { evidence: false }), lead.conditions), false);
    assert.equal(evaluateCondition(stateFor(name, id, encounterLevel, { captured: true }), lead.conditions), false);
    assert.equal(evaluateCondition(stateFor(name, id, encounterLevel, { quest: "completed" }), lead.conditions), false);
    assert.equal(evaluateCondition(stateFor(name, id, encounterLevel, { qualified: false }), hunt.conditions), false);
    assert.equal(pokemonLevelCapForState(stateFor(name, id, encounterLevel)), 20);
  }
});

test("Mattew encounters true Crowned Zacian at Lv20, with its distinct Fairy/Steel rules and no awarded sword", async () => {
  const data = new Poke5eDataRepository();
  const crowned = await data.getSpecies("zacian-crowned");
  const ordinary = await data.getSpecies("zacian");
  assert.equal(crowned.id, "zacian-crowned");
  assert.equal(crowned.minLevel, 20);
  assert.deepEqual(crowned.type, ["fairy", "steel"]);
  assert.deepEqual(ordinary.type, ["fairy"]);
  assert.ok(crowned.moves.start.includes("behemoth-blade"));
  const combat = hunt.nodes.mattew_approach.choices.find(c => c.id === "challenge_mattew").combat;
  assert.deepEqual(combat.opponent, { species: "zacian-crowned", level: 20 });
  assert.equal(combat.opponentRegistered, false);
  const captureChoice = hunt.nodes.mattew_captured.choices[0];
  assert.equal(captureChoice.effects.some(effect => effect.type === "add_item" ||
    effect.type === "give_item" || effect.type === "purchase_item"), false,
    "The player does not receive the Rusted Sword item");
  assert.match(hunt.nodes.mattew_approach.stitches[0].text, /forma incoronata/);
  assert.match(hunt.nodes.mattew_approach.stitches[0].text, /non era stata recuperata da te/i);
});

test("Captured legendary can replace a reserve into the first six, without losing starter or duplicating Pokémon", () => {
  const originals = Array.from({ length: 7 }, (_, i) => ({ speciesId: i === 6 ? "mewtwo" : "pokemon_" + i, level: 20 }));
  const state = { player: { starter: structuredClone(originals[0]), roster: structuredClone(originals) }, pending: null };
  const result = swapPlayerRosterSlots(state, { reserveIndex: 6, officialIndex: 5 });
  assert.equal(result.player.roster.length, 7);
  assert.equal(result.player.roster[5].speciesId, "mewtwo");
  assert.equal(result.player.roster[6].speciesId, "pokemon_5");
  assert.equal(result.player.roster[0].speciesId, "pokemon_0");
  assert.equal(result.player.starter.speciesId, "pokemon_0");
  assert.equal(state.player.roster[6].speciesId, "mewtwo", "original save object not mutated");
  assert.equal(new Set(result.player.roster.map(x => x.speciesId)).size, 7, "no duplicates");
  assert.deepEqual(JSON.parse(JSON.stringify(result.player.roster)), result.player.roster, "save/reload keeps slot order");
});

test("Roster selection never bypasses an active subsystem or exchanges the starter", () => {
  const roster = Array.from({ length: 7 }, (_, i) => ({ speciesId: String(i) }));
  const state = { player: { roster }, pending: null };
  for (const payload of [
    { reserveIndex: 5, officialIndex: 4 },
    { reserveIndex: 6, officialIndex: 0 },
    { reserveIndex: 7, officialIndex: 3 },
    { reserveIndex: 6, officialIndex: 6 },
    { reserveIndex: 6.5, officialIndex: 2 }
  ]) assert.throws(() => swapPlayerRosterSlots(state, payload));
  assert.throws(() => swapPlayerRosterSlots({ ...state, pending: { type: "pokemon5e_combat" } }, { reserveIndex: 6, officialIndex: 5 }));
});

test("Web capture options use only real owned Poké Balls, never ordinary inventory items", () => {
  assert.deepEqual(captureBallsInInventory([
    "Pokeball", { id: "ultra-ball" }, "Potion", "Pokeball", { id: "great-ball" }
  ]), [
    { id: "pokeball", count: 2 },
    { id: "ultra-ball", count: 1 },
    { id: "great-ball", count: 1 }
  ]);
});

test("A nonregistered M09 Legendary can be caught through the real Pokémon 5e roll; Trainer restriction holds", () => {
  const trainer = { level: 20, abilities: { WIS: 20 }, skills: ["Animal Handling"] };
  const target = {
    level: 20, sr: 15, size: "medium", types: ["psychic"],
    hp: { current: 1, max: 500 }, statuses: { nonVolatile: null }
  };
  const result = attemptCapture({
    trainer, target, activePokemon: { attributes: { cha: 10 } },
    ball: "ultra-ball", distanceFeet: 5, round: 2, dice: { roll: () => 20 }
  });
  assert.equal(result.legal, true);
  assert.equal(result.captured, true);
  assert.equal(result.consumed, true);
  assert.ok(result.total >= result.dc, "actual capture DC succeeds, not a scripted gift");
  const disallowed = attemptCapture({
    trainer: { ...trainer, level: 19 },
    target, activePokemon: { attributes: { cha: 10 } },
    ball: "ultra-ball", distanceFeet: 5, dice: { roll: () => 20 }
  });
  assert.equal(disallowed.legal, false);
  assert.equal(disallowed.captured, false);
  assert.equal(disallowed.reason, "target_level_above_trainer");
  const registered = attemptCapture({
    trainer, target, activePokemon: { attributes: { cha: 10 } },
    ball: "ultra-ball", distanceFeet: 5, registered: true,
    dice: { roll: () => 20 }
  });
  assert.equal(registered.legal, false);
  assert.equal(registered.reason, "registered_to_trainer");
});

test("Actual captured outcome persists Mewtwo, completes the quest and permits Official Six selection", async () => {
  const state = createNewGameState({ protagonist: "Daniel", slot: "slot1" });
  state.player.trainerLevel = 20;
  state.player.roster = Array.from({ length: 6 }, () => structuredClone(state.player.starter));
  state.world.flags.world_qualified = true;
  state.world.flags.m8_complete = true;
  state.world.flags.m8_world_registration_complete = true;
  state.world.flags.m9_matchday_one_complete = true;
  state.world.flags.legendary_m09_clue_daniel = true;
  state.world.locationId = "meridiana_city";
  state.quests.legendary_m08_lead_daniel = {
    id: "legendary_m08_lead_daniel",
    title: "Mewtwo",
    objective: "Rintracciare Mewtwo",
    status: "active",
    startedAtMinutes: state.world.elapsedMinutes
  };
  state.story.sceneId = "legendary-world-hunt";
  state.story.nodeId = "daniel_approach";
  state.pending = {
    type: "pokemon5e_combat",
    encounterId: "legendary_world_m09_daniel",
    sceneId: "legendary-world-hunt",
    sourceNodeId: "daniel_approach",
    opponentRegistered: false,
    competition: null,
    returnNodes: {
      captured: "daniel_captured",
      win: "daniel_uncaught",
      lose: "daniel_uncaught",
      fled: "daniel_uncaught"
    },
    battle: {
      outcome: "captured",
      trainer: { inventory: ["great-ball"] },
      opponent: {
        speciesId: "mewtwo", name: "Mewtwo", level: 20,
        hp: { current: 1, max: 120 },
        statuses: { nonVolatile: null },
        abilityId: "pressure", moveIds: ["psychic"], pp: { psychic: 8 }
      }
    }
  };

  const engine = new BookgameEngine();
  const afterCombat = engine.resolveCombatHandoff(state, "captured");
  assert.equal(afterCombat.pending, null);
  assert.equal(afterCombat.story.sceneId, "legendary-world-hunt");
  assert.equal(afterCombat.story.nodeId, "daniel_captured");
  assert.equal(afterCombat.player.roster.length, 7);
  assert.equal(afterCombat.player.roster[6].speciesId, "mewtwo");
  assert.equal(afterCombat.player.roster[6].level, 20);

  const afterRecord = await engine.choose(afterCombat, "record_daniel_capture");
  assert.equal(afterRecord.world.flags.legendary_world_captured_daniel, true);
  assert.equal(afterRecord.quests.legendary_m08_lead_daniel.status, "completed");
  assert.equal(afterRecord.story.sceneId, "m09-interday-one");
  assert.equal(afterRecord.story.nodeId, "resource_guard");
  assert.equal(afterRecord.world.locationId, "world_village");
  const party = swapPlayerRosterSlots(afterRecord, { reserveIndex: 6, officialIndex: 5 });
  assert.equal(party.player.roster[5].speciesId, "mewtwo");
  assert.equal(party.player.roster.length, 7);
  assert.equal(JSON.parse(JSON.stringify(party)).player.roster[5].speciesId, "mewtwo");
});
