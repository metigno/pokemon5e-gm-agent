import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { applyItemToPokemon, compileItemRule } from "../src/combat/item-rules.mjs";
import { Poke5eDataRepository } from "../src/combat/poke5e-data.mjs";
import {
  applyStatus,
  createStatusState,
  endTurnStatus,
  startTurnStatus
} from "../src/combat/status.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";

const WORLD_DISTRIBUTION = new URL(
  "../../campaign/world/ecology/SPECIES_DISTRIBUTION.json",
  import.meta.url
);
const WORLD_POOLS = new URL(
  "../../campaign/world/ecology/ZONE_POOLS.json",
  import.meta.url
);

function collectPoolSpecies(value, into = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && /^[a-z0-9][a-z0-9-]*$/.test(item)) into.add(item);
      else collectPoolSpecies(item, into);
    }
    return into;
  }
  if (value && typeof value === "object") {
    if (typeof value.species_id === "string") into.add(value.species_id);
    if (typeof value.speciesId === "string") into.add(value.speciesId);
    for (const nested of Object.values(value)) collectPoolSpecies(nested, into);
  }
  return into;
}

function dummyPokemon({ types = ["normal"], level = 5 } = {}) {
  return {
    types,
    level,
    abilityId: null,
    attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    hp: { current: 30, max: 30 },
    statuses: createStatusState()
  };
}

test("complete offline Pokémon 5e pack is pinned and count-locked", async () => {
  const data = new Poke5eDataRepository();
  const meta = await data.metadata();

  assert.equal(meta.repository, "Auroratide/poke5e");
  assert.equal(meta.ref, "b411a993eba07f36218f8ea70dd2c402e2e7c91a");
  assert.equal(meta.version, "v1.12.15");
  assert.equal(meta.policy, "complete_offline_bookgame_runtime_pack");
  assert.deepEqual(meta.counts, {
    species: 1151,
    moves: 830,
    abilities: 340,
    items: 305,
    evolutions: 538,
    conditions: 8
  });
});

test("every species in canonical world distribution exists in the offline runtime", async () => {
  const data = new Poke5eDataRepository();
  const world = JSON.parse(await readFile(WORLD_DISTRIBUTION, "utf8"));
  const available = new Set((await data.listSpecies()).map((species) => species.id));

  assert.equal(world.species.length, 1139);
  const missing = world.species.map((entry) => entry.id).filter((id) => !available.has(id));
  assert.deepEqual(missing, []);
});

test("every species exposed by canonical zone pools exists in the offline runtime", async () => {
  const data = new Poke5eDataRepository();
  const pools = JSON.parse(await readFile(WORLD_POOLS, "utf8"));
  const poolSpecies = collectPoolSpecies(pools);
  const available = new Set((await data.listSpecies()).map((species) => species.id));
  const missing = [...poolSpecies].filter((id) => !available.has(id));

  assert.ok(poolSpecies.size > 900);
  assert.deepEqual(missing, []);
});

test("regional-form lookup resolves real upstream species ids", async () => {
  const data = new Poke5eDataRepository();

  assert.equal((await data.getSpecies({ species: "Growlithe", form: "Hisuian" })).id, "growlithe-hisui");
  assert.equal((await data.getSpecies({ species: "Rattata", form: "Alolan" })).id, "alolan-rattata");
  assert.equal((await data.getSpecies({ species: "Slowpoke", form: "Galarian" })).id, "galarian-slowpoke");
  assert.equal((await data.getSpecies({ species: "Wooper", form: "Paldean" })).id, "wooper-paldea");
});

test("all upstream species can instantiate at their real minimum level without an ability whitelist", async () => {
  const data = new Poke5eDataRepository();
  const combat = new Pokemon5eCombatEngine({ data, dice: new SequenceDice([10]) });
  const species = await data.listSpecies();

  for (const entry of species) {
    const fighter = await combat.createCombatant({ speciesId: entry.id, level: entry.minLevel });
    assert.equal(fighter.speciesId, entry.id);
    assert.ok(fighter.hp.max > 0, entry.id);
    if (fighter.abilityId) assert.ok(fighter.ability?.description, entry.id);
  }
});

test("Struggle guarantees an executable combat action even for a start pool containing only utility moves", async () => {
  const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([10, 9]) });
  const battle = await combat.createBattle({
    encounterId: "FULL_RUNTIME_MAGIKARP",
    playerPokemon: { speciesId: "magikarp", level: 1 },
    opponent: { speciesId: "caterpie", level: 1 },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });

  const moves = await combat.legalMoves(battle, "player");
  assert.ok(moves.some((move) => move.id === "struggle"));
});

test("2024 status core supports Frozen, Badly Poisoned and Confused", () => {
  const frozen = dummyPokemon({ types: ["water"] });
  assert.equal(applyStatus(frozen, "Frozen", { sourceProficiencyBonus: 3 }).applied, true);
  const frozenTurn = startTurnStatus(frozen, new SequenceDice([10]));
  assert.equal(frozenTurn.skipTurn, true);
  assert.equal(frozenTurn.reason, "Frozen");

  const badlyPoisoned = dummyPokemon();
  applyStatus(badlyPoisoned, "BadlyPoisoned");
  const poisonEvents = endTurnStatus(badlyPoisoned, new SequenceDice([10]), 3);
  assert.equal(poisonEvents.find((event) => event.type === "status_damage").damage, 6);

  const confused = dummyPokemon();
  applyStatus(confused, "Confused");
  const confusedTurn = startTurnStatus(confused, new SequenceDice([1]));
  assert.equal(confusedTurn.forcedAction, "STRUGGLE_SELF");
});

test("2024 type immunities block the matching non-volatile statuses", () => {
  assert.equal(applyStatus(dummyPokemon({ types: ["fire"] }), "Burned").applied, false);
  assert.equal(applyStatus(dummyPokemon({ types: ["ice"] }), "Frozen").applied, false);
  assert.equal(applyStatus(dummyPokemon({ types: ["electric"] }), "Paralysis").applied, false);
  assert.equal(applyStatus(dummyPokemon({ types: ["steel"] }), "BadlyPoisoned").applied, false);
});

test("offline item runtime executes potion, antidote, Full Heal and Ether rules", async () => {
  const data = new Poke5eDataRepository();
  const target = dummyPokemon();
  target.hp.current = 10;
  target.moveIds = ["tackle"];
  target.pp = { tackle: 1 };
  target.maxPp = { tackle: 10 };

  const potion = await data.getItem("potion");
  const potionResult = applyItemToPokemon({
    item: potion,
    target,
    dice: new SequenceDice([4, 4])
  });
  assert.equal(potionResult.applied, true);
  assert.equal(target.hp.current, 20);

  applyStatus(target, "Poisoned");
  const antidote = await data.getItem("antidote");
  assert.equal(applyItemToPokemon({ item: antidote, target, dice: new SequenceDice([1]) }).applied, true);
  assert.equal(target.statuses.nonVolatile, null);

  applyStatus(target, "Confused");
  applyStatus(target, "Burned");
  const fullHeal = await data.getItem("full-heal");
  applyItemToPokemon({ item: fullHeal, target, dice: new SequenceDice([1]) });
  assert.equal(target.statuses.nonVolatile, null);
  assert.equal(target.statuses.confusedRounds, 0);

  const ether = await data.getItem("ether");
  applyItemToPokemon({ item: ether, target, dice: new SequenceDice([1]), moveId: "tackle" });
  assert.equal(target.pp.tackle, 6);

  assert.equal(compileItemRule(await data.getItem("max-potion")).delayed, true);
});

test("representative long-tail data resolves locally without network access", async () => {
  const data = new Poke5eDataRepository();

  assert.equal((await data.getMove("flamethrower")).save.attribute, "dex");
  assert.equal((await data.getMove("thunder-wave")).save.attribute, "con");
  assert.equal((await data.getAbility("static")).name, "Static");
  assert.equal((await data.getAbility("neutralizing-gas")).name, "Neutralizing Gas");
  assert.equal((await data.getItem("poke-ball")).type, "pokeball");
  assert.equal((await data.getCondition("Badly Poisoned")).id, "BadlyPoisoned");
  assert.ok((await data.listEvolutions()).length >= 500);
});
