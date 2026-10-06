import test from "node:test";
import assert from "node:assert/strict";

import { Poke5eDataRepository } from "../src/combat/poke5e-data.mjs";
import {
  auditEvolutionCoverage,
  availableEvolutions,
  awardPokemonXp,
  evolvePokemon,
  evolutionIsEligible,
  learnPokemonMove
} from "../src/engine/pokemon-progression.mjs";

const data = new Poke5eDataRepository();

test("all 538 pinned evolutions are explicitly classified with no unknown condition family", async () => {
  const evolutions = await data.listEvolutions();
  const audit = auditEvolutionCoverage(evolutions);
  assert.equal(audit.total, 538);
  assert.equal(audit.unclassified, 0);
  assert.equal(audit.runtime + audit.nonCanonExcluded, 538);
});

test("evolution resolver enforces level, item, loyalty, time and move-type prerequisites", async () => {
  const evolutions = await data.listEvolutions();

  const raichu = evolutions.find((entry) => entry.id === "pikachu-to-raichu");
  assert.equal(await evolutionIsEligible(
    { ...raichu },
    { speciesId: "pikachu", level: 8, moveIds: ["thunder-shock"], bond: { level: 0 } },
    { inventory: [{ itemId: "thunder-stone", quantity: 1 }], timeOfDay: "afternoon" },
    data
  ), true);
  assert.equal(await evolutionIsEligible(
    { ...raichu },
    { speciesId: "pikachu", level: 8, moveIds: ["thunder-shock"], bond: { level: 0 } },
    { inventory: [] },
    data
  ), false);

  const sylveon = evolutions.find((entry) => entry.id === "eevee-to-sylveon");
  assert.equal(await evolutionIsEligible(
    sylveon,
    { speciesId: "eevee", level: 8, moveIds: ["baby-doll-eyes"], bond: { level: 2 } },
    {},
    data
  ), true);

  const umbreon = evolutions.find((entry) => entry.id === "eevee-to-umbreon");
  assert.equal(await evolutionIsEligible(
    umbreon,
    { speciesId: "eevee", level: 8, moveIds: ["tackle"], bond: { level: 2 } },
    { timeOfDay: "night" },
    data
  ), true);
  assert.equal(await evolutionIsEligible(
    umbreon,
    { speciesId: "eevee", level: 8, moveIds: ["tackle"], bond: { level: 2 } },
    { timeOfDay: "morning" },
    data
  ), false);
});

test("special canonical evolutions use explicit runtime evidence instead of free-text fallback", async () => {
  const evolutions = await data.listEvolutions();
  const annihilape = evolutions.find((entry) => entry.id === "primeape-to-annihilape");
  assert.equal(await evolutionIsEligible(
    annihilape,
    { speciesId: "primeape", level: 10, moveIds: ["rage-fist"] },
    { moveUseCounts: { "rage-fist": 9 } },
    data
  ), false);
  assert.equal(await evolutionIsEligible(
    annihilape,
    { speciesId: "primeape", level: 10, moveIds: ["rage-fist"] },
    { moveUseCounts: { "rage-fist": 10 } },
    data
  ), true);

  const candidates = await availableEvolutions(
    { speciesId: "sliggoo", level: 16, moveIds: [], bond: { level: 0 } },
    { weather: "rain" },
    data
  );
  assert.ok(candidates.some((entry) => entry.id === "sliggoo-to-goodra"));
});

test("evolution requires the canonical ASI choice, consumes its item and updates species mechanics", async () => {
  const evolutions = await data.listEvolutions();
  const raichu = evolutions.find((entry) => entry.id === "pikachu-to-raichu");
  const pokemon = {
    speciesId: "pikachu",
    name: "Pikachu",
    level: 8,
    moveIds: ["thunder-shock"],
    abilityId: "static",
    bond: { level: 0 },
    hp: { current: 20, max: 30 }
  };
  const context = { inventory: [{ itemId: "thunder-stone", quantity: 1 }] };

  const pending = await evolvePokemon(pokemon, raichu, { context, data });
  assert.equal(pending.status, "choice_required");
  assert.equal(pending.choice.points, 9);

  const evolved = await evolvePokemon(pokemon, raichu, {
    context,
    data,
    asiDistribution: { dex: 9 }
  });
  assert.equal(evolved.status, "evolved");
  assert.equal(evolved.pokemon.speciesId, "raichu");
  assert.equal(evolved.inventory.length, 0);
  assert.equal(evolved.pokemon.hp.current, evolved.pokemon.hp.max);
  assert.ok(evolved.pokemon.evolutionHistory.some((entry) => entry.id !== null));
});

test("XP level-up preserves HP state, exposes move learning and enforces the four-move choice", async () => {
  const pokemon = {
    speciesId: "bulbasaur",
    level: 1,
    xp: 0,
    moveIds: ["tackle", "growl", "vine-whip", "poison-powder"]
  };
  const result = await awardPokemonXp(pokemon, 200, { data, hpRolls: { 2: 4 } });
  assert.equal(result.pokemon.level, 2);
  assert.equal(result.levelUps.length, 1);
  assert.ok(result.pokemon.hp.max >= result.pokemon.hp.current);
  assert.ok(Array.isArray(result.pokemon.pendingMoveLearning));

  assert.throws(
    () => learnPokemonMove(result.pokemon, "razor-leaf"),
    /requires choosing one of the four known moves to forget/
  );
  const learned = learnPokemonMove(result.pokemon, "razor-leaf", { forgetMoveId: "growl" });
  assert.equal(learned.moveIds.length, 4);
  assert.ok(learned.moveIds.includes("razor-leaf"));
  assert.ok(!learned.moveIds.includes("growl"));
});
