import test from "node:test";
import assert from "node:assert/strict";

import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import {
  advancePokeballStabilization,
  createChaseState,
  createPokemonDeathState,
  faintPokemon,
  recallFaintedPokemon,
  resolveChaseRound,
  resolveGroupFleeCheck,
  resolvePokemonDeathSave
} from "../src/combat/survival.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";

function faintedPokemon() {
  return {
    hp: { current: 0, max: 30 },
    death: createPokemonDeathState()
  };
}

test("wild Pokemon use canonical 5e death saves including natural 1 and natural 20", () => {
  const failure = faintedPokemon();
  faintPokemon(failure, { sanctioned: false });
  const one = resolvePokemonDeathSave(failure, new SequenceDice([1]));
  assert.equal(one.failures, 2);
  assert.equal(one.state, "dying");

  const death = resolvePokemonDeathSave(failure, new SequenceDice([9]));
  assert.equal(death.failures, 3);
  assert.equal(death.state, "dead");
  assert.equal(death.dead, true);

  const recovery = faintedPokemon();
  faintPokemon(recovery, { sanctioned: false });
  const twenty = resolvePokemonDeathSave(recovery, new SequenceDice([20]));
  assert.equal(twenty.regainedHp, 1);
  assert.equal(recovery.hp.current, 1);
  assert.equal(twenty.state, "alive");
});

test("three successful death saves stabilize a Pokemon at 0 HP", () => {
  const pokemon = faintedPokemon();
  faintPokemon(pokemon, { sanctioned: false });
  resolvePokemonDeathSave(pokemon, new SequenceDice([10]));
  resolvePokemonDeathSave(pokemon, new SequenceDice([14]));
  const third = resolvePokemonDeathSave(pokemon, new SequenceDice([19]));
  assert.equal(third.successes, 3);
  assert.equal(third.stable, true);
  assert.equal(third.state, "stable");
  assert.equal(pokemon.hp.current, 0);
});

test("sanctioned combat fainting is stable and never rolls death saves", () => {
  const pokemon = faintedPokemon();
  faintPokemon(pokemon, { sanctioned: true });
  const result = resolvePokemonDeathSave(pokemon, new SequenceDice([1]));
  assert.equal(result.rolled, false);
  assert.equal(result.reason, "pokemon_stable");
  assert.equal(pokemon.death.state, "fainted_stable");
});

test("a fainted Pokemon in a Pokeball pauses death saves and stabilizes after 10 uninterrupted minutes", () => {
  const pokemon = faintedPokemon();
  faintPokemon(pokemon, { sanctioned: false });
  assert.equal(recallFaintedPokemon(pokemon).deathSavesPaused, true);
  assert.equal(resolvePokemonDeathSave(pokemon, new SequenceDice([1])).reason, "death_saves_paused_in_pokeball");

  assert.equal(advancePokeballStabilization(pokemon, 9).stabilized, false);
  const stable = advancePokeballStabilization(pokemon, 1);
  assert.equal(stable.stabilized, true);
  assert.equal(stable.minutes, 10);
  assert.equal(pokemon.death.state, "stable");
  assert.equal(pokemon.hp.current, 0);
});

test("canonical flee group check succeeds when at least half the group passes", () => {
  const result = resolveGroupFleeCheck({
    participants: [
      { id: "a", modifier: 5 },
      { id: "b", modifier: 0 },
      { id: "c", modifier: 3 },
      { id: "d", modifier: -1 }
    ],
    dc: 15,
    dice: new SequenceDice([10, 5, 12, 4])
  });
  assert.equal(result.successes, 2);
  assert.equal(result.requiredSuccesses, 2);
  assert.equal(result.escaped, true);
});

test("chase runtime advances a deterministic lead to escape or capture", () => {
  let chase = createChaseState({ escapeLead: 2, captureLead: -2 });
  chase = resolveChaseRound(chase, {
    quarryCheck: { modifier: 2 },
    pursuerCheck: { modifier: 0 },
    dice: new SequenceDice([18, 4])
  });
  assert.equal(chase.lead, 1);
  assert.equal(chase.outcome, null);

  chase = resolveChaseRound(chase, {
    quarryCheck: { modifier: 2 },
    pursuerCheck: { modifier: 0 },
    dice: new SequenceDice([17, 3])
  });
  assert.equal(chase.lead, 2);
  assert.equal(chase.outcome, "escaped");
});

test("combat engine permits only one flee attempt per round and blocks Arena Trap", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 15, 15, 15, 15])
  });
  let battle = await combat.createBattle({
    encounterId: "FLEE_ARENA_TRAP",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["tackle"] },
    opponent: { speciesId: "diglett", level: 5, abilityId: "arena-trap", moveIds: ["scratch"] },
    sanctioned: false,
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  if (combat.actor(battle) !== "player") {
    battle.order = ["player", "opponent"];
    battle.turnIndex = 0;
  }

  const blocked = await combat.attemptPlayerFlee(battle, {
    participants: [{ modifier: 20 }],
    dc: 15
  });
  assert.equal(blocked.result.legal, false);
  assert.equal(blocked.result.blockedBy, "arena-trap");

  const twice = await combat.attemptPlayerFlee(blocked.battle, {
    participants: [{ modifier: 20 }],
    dc: 15
  });
  assert.equal(twice.result.reason, "flee_already_attempted_this_round");
});

test("Escape Rope automatically escapes a wild battle even through a flee-lock ability", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 10, 10])
  });
  let battle = await combat.createBattle({
    encounterId: "FLEE_ESCAPE_ROPE",
    trainer: { inventory: [{ id: "escape-rope", quantity: 1 }] },
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["tackle"] },
    opponent: { speciesId: "diglett", level: 5, abilityId: "arena-trap", moveIds: ["scratch"] },
    sanctioned: false,
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  if (combat.actor(battle) !== "player") {
    battle.order = ["player", "opponent"];
    battle.turnIndex = 0;
  }

  const escaped = await combat.attemptPlayerFlee(battle, { useEscapeRope: true });
  assert.equal(escaped.result.escaped, true);
  assert.equal(escaped.result.source, "escape-rope");
  assert.equal(escaped.battle.outcome, "fled");
  assert.equal(escaped.battle.trainer.inventory.length, 0);
});

test("forced replacement recalls a fainted Pokemon and pauses its death saves", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 10, 10, 10, 10, 10, 10])
  });
  let battle = await combat.createBattle({
    encounterId: "DEATH_SWITCH_RECALL",
    sanctioned: false,
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["tackle"] },
    playerBench: [{ speciesId: "pikachu", level: 5, moveIds: ["thunder-shock"] }],
    opponent: { speciesId: "machamp", level: 20, moveIds: ["tackle"] }
  });

  battle.player.hp.current = 0;
  battle.player.death = createPokemonDeathState();
  faintPokemon(battle.player, { sanctioned: false });
  battle.awaitingSwitch = "player";
  battle.trainer.reactionAvailable = true;

  const switched = await combat.switchPlayer(battle, 0);
  const recalled = switched.playerBench[0];
  assert.equal(recalled.death.inPokeball, true);
  assert.equal(recalled.death.state, "dying");

  const recovery = combat.advancePokeballRecovery(switched, 10);
  assert.equal(recovery.battle.playerBench[0].death.stable, true);
});


test("wild Pokemon can target the Trainer and Trainer death ends the career", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([1, 20, 20, 6, 6, 1, 9])
  });
  const battle = await combat.createBattle({
    encounterId: "TRAINER_TARGET",
    sanctioned: false,
    trainer: {
      hp: { current: 1, max: 8 },
      ac: 10,
      abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      savingThrows: ["CHA"]
    },
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["tackle"] },
    opponent: { speciesId: "machamp", level: 10, moveIds: ["tackle"] },
    opponentPosition: { x: 5, y: 0 },
    trainerPosition: { x: 0, y: 0 }
  });
  assert.equal(combat.actor(battle), "opponent");

  const hit = await combat.useOpponentMoveAgainstTrainer(battle, "tackle");
  assert.equal(hit.trainer.hp.current, 0);
  assert.equal(hit.trainer.death.state, "dying");
  assert.notEqual(hit.outcome, "career_ended");

  const first = combat.resolveTrainerDeathSave(hit);
  assert.equal(first.result.natural, 1);
  assert.equal(first.result.failures, 2);
  const second = combat.resolveTrainerDeathSave(first.battle);
  assert.equal(second.result.failures, 3);
  assert.equal(second.result.dead, true);
  assert.equal(second.battle.outcome, "career_ended");
});
