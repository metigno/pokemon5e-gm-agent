import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateScene } from "../src/compiler/story-compiler.mjs";
import { evaluateCondition } from "../src/engine/conditions.mjs";
import { Poke5eDataRepository } from "../src/combat/poke5e-data.mjs";
import { POKEMON_LEVEL_CAPS_BY_MODULE, pokemonLevelCapForState } from "../src/engine/pokemon-xp-balance.mjs";
import { captureBallsInInventory, attemptCapture } from "../src/combat/capture.mjs";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
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

test("Actual captured Mewtwo replaces a chosen Pokémon permanently and completes its quest", async () => {
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
  assert.equal(afterCombat.pending.type, "pokemon_capture_replacement");
  assert.equal(afterCombat.story.sceneId, "legendary-world-hunt");
  assert.equal(afterCombat.story.nodeId, "daniel_captured");
  assert.equal(afterCombat.player.roster.length, 6, "Mewtwo must not create a reserve");
  assert.equal(afterCombat.pending.pokemon.speciesId, "mewtwo");
  assert.equal(afterCombat.pending.pokemon.level, 20);
  const replacementPrompt = await engine.present(afterCombat);
  assert.equal(replacementPrompt.choices.length, 7);
  await assert.rejects(engine.choose(afterCombat, "record_daniel_capture"), /Scegli un Pokémon/);
  const afterReplacement = await engine.choose(afterCombat, "replace_5");
  assert.equal(afterReplacement.pending, null);
  assert.equal(afterReplacement.player.roster.length, 6);
  assert.equal(afterReplacement.player.roster[5].speciesId, "mewtwo");
  assert.equal(afterReplacement.player.roster[5].level, 20);
  assert.equal(afterReplacement.story.history.at(-1).replacedRosterIndex, 5);

  const afterRecord = await engine.choose(afterReplacement, "record_daniel_capture");
  assert.equal(afterRecord.world.flags.legendary_world_captured_daniel, true);
  assert.equal(afterRecord.quests.legendary_m08_lead_daniel.status, "completed");
  assert.equal(afterRecord.story.sceneId, "m09-interday-one");
  assert.equal(afterRecord.story.nodeId, "resource_guard");
  assert.equal(afterRecord.world.locationId, "world_village");
  assert.equal(afterRecord.player.roster[5].speciesId, "mewtwo");
  assert.equal(afterRecord.player.roster.length, 6);
  assert.equal(JSON.parse(JSON.stringify(afterRecord)).player.roster[5].speciesId, "mewtwo");
});


test("Step 14: all Five M09 legendary hunts use real scene -> battle capture -> quest -> reload", async () => {
  // Qualified, level-20 and possessing a Master Ball are deliberate test
  // preconditions, not items/levels awarded by the quest. The capture is
  // performed by the actual 2024 battle API; this test does not force its outcome.
  const dir = await mkdtemp(path.join(os.tmpdir(), "p5e-step14-legendaries-"));
  const store = new SaveStore(dir);
  const book = new BookgameEngine({ worldEvents: [], now: () => "2026-10-08T12:00:00.000Z" });
  const combat = new Pokemon5eCombatEngine({ dice: { roll: (sides) => sides } });
  try {
    for (const [name, id, speciesId, level] of trainerSpecies) {
      let state = createNewGameState({ protagonist: name, slot: "legend-" + id });
      state.player.trainerLevel = 20;
      state.player.inventory.push("master-ball");
      Object.assign(state.world.flags, {
        m8_complete: true, m8_world_registration_complete: true,
        m9_matchday_one_complete: true, world_qualified: true,
        ["legendary_m09_clue_" + id]: true
      });
      state.quests["legendary_m08_lead_" + id] = {
        id: "legendary_m08_lead_" + id,
        title: speciesId,
        status: "active",
        startedAtMinutes: state.world.elapsedMinutes
      };
      state.story.sceneId = "legendary-world-hunt";
      state.story.nodeId = "hunt_leads";
      const choices = (await book.present(state)).choices.map((choice) => choice.id);
      assert.ok(choices.includes("follow_" + id), name + " must find their own lead");
      for (const other of trainerSpecies) {
        if (other[1] !== id) assert.ok(!choices.includes("follow_" + other[1]),
          name + " must not access another friend's legend");
      }
      state = await book.choose(state, "follow_" + id);
      state = await book.choose(state, "challenge_" + id);
      assert.equal(state.pending.type, "pokemon5e_combat");
      assert.equal(state.pending.opponent.species, speciesId);
      assert.equal(state.pending.opponent.level, level);
      assert.equal(state.pending.opponentRegistered, false);
      let battle = await combat.createBattle(state.pending);
      // A living opponent at 1 HP is a legal battle checkpoint; it is not a
      // pre-selected capture result. Select the player's next valid turn.
      battle.opponent.hp.current = 1;
      battle.turnIndex = battle.order.indexOf("player");
      state = book.setCombatState(state, battle);
      await store.save(state);
      const resumedBattle = await store.load(state.slot);
      assert.deepEqual(resumedBattle.pending.battle, battle, name + " combat save must resume");
      const attempt = await combat.attemptPlayerCapture(resumedBattle.pending.battle, "master-ball");
      assert.equal(attempt.result.legal, true, name + " legal Pokémon 5e capture");
      assert.equal(attempt.result.captured, true, name + " Master Ball success");
      assert.equal(attempt.battle.outcome, "captured");
      state = book.setCombatState(resumedBattle, attempt.battle);
      state = await book.resolveCombatHandoffWithXp(state, "captured");
      assert.equal(state.pending, null, name + " successful capture cannot strand a handoff");
      assert.equal(state.story.nodeId, id + "_captured");
      assert.ok(state.player.roster.some((pokemon) => pokemon.speciesId === speciesId),
        name + " captured Pokémon joins actual team");
      assert.equal(state.player.inventory.includes("master-ball"), false,
        name + " Master Ball must be consumed");
      state = await book.choose(state, "record_" + id + "_capture");
      assert.equal(state.quests["legendary_m08_lead_" + id].status, "completed");
      assert.equal(state.world.flags["legendary_world_captured_" + id], true);
      assert.equal(state.story.sceneId, "m09-interday-one");
      assert.equal(state.world.locationId, "world_village");
      assert.equal(state.player.roster.filter((pokemon) => pokemon.speciesId === speciesId).length, 1,
        name + " cannot duplicate the legendary");
      await store.save(state);
      const reloaded = await store.load(state.slot);
      assert.deepEqual(reloaded, state, name + " capture and quest must survive reload");
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
