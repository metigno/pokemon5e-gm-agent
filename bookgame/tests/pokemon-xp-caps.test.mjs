import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { createNewGameState, experienceNeededAtLevel } from "../src/engine/state.mjs";
import { awardPokemonXp, resolvePendingPokemonLevelUp } from "../src/engine/pokemon-progression.mjs";
import { POKEMON_LEVEL_CAPS_BY_MODULE, battlePokemonXpPool, pokemonLevelCapForState } from "../src/engine/pokemon-xp-balance.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";

const now = () => "2026-10-08T10:00:00.000Z";
const book = new BookgameEngine({ now });
const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([15, 8, 10, 10, 10]) });

function firstRoadState({ afterM01 = false, withBench = false } = {}) {
  const state = createNewGameState({ protagonist: "Luke", now });
  state.story.sceneId = "first-road";
  state.story.nodeId = "arrival";
  state.world.locationId = "asteria_ginestre";
  if (afterM01) state.world.flags.m1_complete = true;
  const starter = {
    speciesId: "bulbasaur", level: 5, xp: experienceNeededAtLevel(5),
    hp: { current: 32, max: 32 }, moveIds: ["tackle"]
  };
  state.player.starter = starter;
  state.player.roster = withBench
    ? [structuredClone(starter), { speciesId: "squirtle", level: 5, xp: experienceNeededAtLevel(5), moveIds: ["tackle"] }]
    : [structuredClone(starter)];
  return state;
}

async function resolvedBattle({ afterM01 = true, withBench = false, outcome = "win", switchPokemon = false } = {}) {
  let state = await book.choose(firstRoadState({ afterM01, withBench }), "send_starter");
  let battle = await combat.createBattle(state.pending);
  state = book.setCombatState(state, battle);
  if (switchPokemon) {
    const outgoing = battle.player;
    battle.player = battle.playerBench[0];
    battle.playerBench[0] = outgoing;
    state = book.setCombatState(state, battle);
  }
  if (outcome === "win") battle.opponent.hp.current = 0;
  if (outcome === "lose") battle.player.hp.current = 0;
  battle.outcome = outcome;
  state = book.setCombatState(state, battle);
  return { state, battle };
}

test("12 Pokémon caps rise with milestones, without dropping on older routes", () => {
  assert.deepEqual(Object.entries(POKEMON_LEVEL_CAPS_BY_MODULE).map(([moduleId, cap]) => [moduleId, cap]), [
    ["M01", 5], ["M02", 6], ["M03", 8], ["M04", 10], ["M05", 12], ["M06", 14],
    ["M07", 16], ["M08", 18], ["M09", 20], ["M10", 20], ["M11", 20], ["M12", 20]
  ]);
  const state = firstRoadState();
  assert.equal(pokemonLevelCapForState(state), 5);
  state.world.flags.m1_complete = true;
  assert.equal(pokemonLevelCapForState(state), 6);
  state.world.flags.m8_complete = true;
  assert.equal(pokemonLevelCapForState(state), 20);
  state.story.sceneId = "first-road";
  assert.equal(pokemonLevelCapForState(state), 20);
  delete state.world.flags.m8_complete;
  state.pending = { moduleId: "M06" };
  assert.equal(pokemonLevelCapForState(state), 14);
});

test("checkpoint XP overflow is discarded, not banked for future modules", async () => {
  const pokemon = { speciesId: "bulbasaur", level: 5, xp: experienceNeededAtLevel(5), moveIds: ["tackle"] };
  const capped = await awardPokemonXp(pokemon, 100000, { maxLevel: 5 });
  assert.equal(capped.pokemon.level, 5);
  assert.equal(capped.pokemon.xp, experienceNeededAtLevel(5));
  const raised = await awardPokemonXp(capped.pokemon, 100000, { maxLevel: 6 });
  assert.equal(raised.pokemon.level, 6);
  assert.equal(raised.pokemon.xp, experienceNeededAtLevel(6));
  assert.equal(raised.levelUps.length, 1);
  const noBank = await awardPokemonXp(raised.pokemon, 0, { maxLevel: 8 });
  assert.equal(noBank.pokemon.level, 6);
  assert.equal(noBank.pokemon.xp, experienceNeededAtLevel(6));
  await assert.rejects(() => awardPokemonXp(pokemon, 200, { maxLevel: 21 }), /cap/);
});

test("XP level-up preserves fainted HP and creates canonical move decisions", async () => {
  const pokemon = {
    speciesId: "bulbasaur", level: 5, xp: experienceNeededAtLevel(5),
    hp: { current: 0, max: 30 }, moveIds: ["tackle", "growl"]
  };
  const gained = await awardPokemonXp(pokemon, 100000, { maxLevel: 6, hpRolls: { 6: 4 } });
  assert.equal(gained.pokemon.level, 6);
  assert.equal(gained.pokemon.hp.current, 0, "XP must not revive a fainted Pokémon");
  assert.ok(gained.pokemon.hp.max > 30);
  assert.ok(gained.pokemon.pendingMoveChoices.some((choice) => choice.level === 6));
});

test("pending evolution cannot spend stored XP above the current cap", async () => {
  const eevee = {
    speciesId: "eevee", level: 7, xp: experienceNeededAtLevel(7),
    moveIds: ["tackle"], bond: { level: 2 }, hp: { current: 28, max: 28 }
  };
  const pending = await awardPokemonXp(eevee, 250000, {
    maxLevel: 8, context: { timeOfDay: "night" }
  });
  assert.equal(pending.pokemon.level, 8);
  assert.equal(pending.pokemon.xp, experienceNeededAtLevel(8));
  assert.equal(pending.pendingLevelUp.stage, "evolution_decision");
  const declined = await resolvePendingPokemonLevelUp(pending.pokemon, {
    declineEvolution: true, context: { timeOfDay: "night" }, maxLevel: 8
  });
  assert.equal(declined.pokemon.level, 8);
  assert.equal(declined.pokemon.xp, experienceNeededAtLevel(8));
  assert.equal(declined.pokemon.pendingLevelUp, null);
  assert.ok(declined.pokemon.pendingMoveChoices.some((choice) => choice.level === 8));
});

test("real battle handoff grants XP only to the deployed member, and persists after reload", async () => {
  const { state, battle } = await resolvedBattle({ withBench: true });
  const expectedPool = battlePokemonXpPool(battle);
  assert.ok(expectedPool > 0);
  const resolved = await book.resolveCombatHandoffWithXp(state, "win");
  assert.equal(resolved.player.roster[0].xp, experienceNeededAtLevel(5) + expectedPool);
  assert.equal(resolved.player.roster[1].xp, experienceNeededAtLevel(5));
  assert.equal(resolved.player.starter.xp, resolved.player.roster[0].xp);
  assert.equal(resolved.story.history.at(-1).pokemonXp.maxLevel, 6);
  const directory = await mkdtemp(path.join(os.tmpdir(), "p5e-xp-"));
  try {
    const saves = new SaveStore(directory);
    await saves.save(resolved);
    const reloaded = await saves.load(resolved.slot);
    assert.deepEqual(reloaded.player.roster, resolved.player.roster);
    assert.deepEqual(reloaded.player.starter, resolved.player.starter);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  await assert.rejects(() => book.resolveCombatHandoffWithXp(resolved, "win"), /handoff is pending/);
});

test("switching shares XP between both deployed Pokémon; bench-only Pokémon get none", async () => {
  const { state, battle } = await resolvedBattle({ withBench: true, switchPokemon: true });
  const pool = battlePokemonXpPool(battle);
  assert.deepEqual(state.pending.participatingRosterIndices, [0, 1]);
  const resolved = await book.resolveCombatHandoffWithXp(state, "win");
  assert.equal(resolved.player.roster[0].xp, experienceNeededAtLevel(5) + Math.floor(pool / 2));
  assert.equal(resolved.player.roster[1].xp, experienceNeededAtLevel(5) + Math.floor(pool / 2));
});

test("no win reward for a defeat, fleeing or capture; M01 rewards stop at cap 5", async () => {
  for (const outcome of ["lose", "fled", "captured"]) {
    const { state } = await resolvedBattle({ outcome });
    const resolved = await book.resolveCombatHandoffWithXp(state, outcome);
    assert.equal(resolved.player.roster[0].xp, experienceNeededAtLevel(5));
  }
  const { state } = await resolvedBattle({ afterM01: false });
  const capped = await book.resolveCombatHandoffWithXp(state, "win");
  assert.equal(capped.player.roster[0].level, 5);
  assert.equal(capped.player.roster[0].xp, experienceNeededAtLevel(5));
});
