import test from "node:test";
import assert from "node:assert/strict";

import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { Poke5eDataRepository } from "../src/combat/poke5e-data.mjs";
import { calculateMoveStats } from "../src/combat/poke5e-rules.mjs";
import { applyStatus, endTurnStatus } from "../src/combat/status.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";

function handoff(playerPokemon, opponent) {
  return {
    encounterId: "ADVANCED_TEST",
    playerPokemon,
    opponent
  };
}

test("Move DC uses 8 + proficiency + best MOVE modifier", async () => {
  const data = new Poke5eDataRepository();
  const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([10, 10]) });
  const eevee = await combat.createCombatant({ species: "Eevee", level: 5 });
  const growl = await data.getMove("growl");
  const stats = calculateMoveStats(eevee, growl);

  assert.equal(stats.proficiencyBonus, 3);
  assert.equal(stats.moveModifier, 1);
  assert.equal(stats.saveDc, 12);
  assert.equal(stats.saveAttribute, "wis");
});

test("Growl resolves a WIS save and applies the attack penalty", async () => {
  const dice = new SequenceDice([15, 5, 4, 10, 6]);
  const combat = new Pokemon5eCombatEngine({ dice });
  let battle = await combat.createBattle(handoff(
    { species: "Eevee", level: 5 },
    { species: "Houndour", level: 3 }
  ));

  battle = await combat.usePlayerMove(battle, "growl");
  const save = battle.log.find((entry) => entry.type === "save_move");
  assert.equal(save.save.dc, 12);
  assert.equal(save.save.success, false);
  assert.equal(battle.opponent.effects.attackModifierSources.length, 1);

  battle = await combat.endPlayerTurn(battle);
  battle = await combat.advanceToPlayerOrEnd(battle);
  const attack = battle.log.find((entry) => entry.type === "attack" && entry.actor === "opponent");
  assert.equal(attack.attackModifier, 3);
  assert.equal(attack.attackTotal, 13);
});

test("Eevee can spend an action and a bonus action in the same turn", async () => {
  const dice = new SequenceDice([15, 5, 15, 6, 15, 4]);
  const combat = new Pokemon5eCombatEngine({ dice });
  let battle = await combat.createBattle(handoff(
    { species: "Eevee", level: 5 },
    { species: "Houndour", level: 3 }
  ));

  battle = await combat.usePlayerMove(battle, "tackle");
  assert.equal(combat.actor(battle), "player");
  assert.equal(battle.player.turn.actionAvailable, false);
  assert.equal(battle.player.turn.bonusActionAvailable, true);

  const remaining = await combat.availablePlayerMoves(battle);
  assert.deepEqual(remaining.map((move) => move.id), ["quick-attack"]);

  battle = await combat.usePlayerMove(battle, "quick-attack");
  assert.equal(combat.actor(battle), "opponent");
  assert.equal(battle.player.pp["tackle"], 19);
  assert.equal(battle.player.pp["quick-attack"], 14);
});

test("Ember can burn a non-Fire target and Burned uses the lower damage roll plus end-turn damage", async () => {
  const dice = new SequenceDice([15, 5, 19, 1, 15, 12, 1]);
  const combat = new Pokemon5eCombatEngine({ dice });
  let battle = await combat.createBattle(handoff(
    { species: "Growlithe", form: "Hisuian", level: 5 },
    { species: "Koffing", level: 5 }
  ));

  battle = await combat.usePlayerMove(battle, "ember");
  assert.equal(battle.opponent.statuses.nonVolatile, "Burned");

  battle = await combat.advanceToPlayerOrEnd(battle);
  const tackle = battle.log.find((entry) => entry.type === "attack" && entry.actor === "opponent");
  assert.equal(tackle.moveId, "tackle");
  assert.equal(tackle.damageRoll.mode, "disadvantage");
  assert.equal(tackle.damageRoll.attempts[0].total, 12);
  assert.equal(tackle.damageRoll.attempts[1].total, 1);
  assert.equal(tackle.damageRoll.selected.total, 1);

  const burn = battle.log.find((entry) => entry.type === "status_damage" && entry.actor === "opponent");
  assert.equal(burn.status, "Burned");
  assert.equal(burn.damage, 3);
});

test("Bite on natural 19 flinches and the next attack is made with disadvantage", async () => {
  const dice = new SequenceDice([15, 5, 19, 5, 5, 18, 2]);
  const combat = new Pokemon5eCombatEngine({ dice });
  let battle = await combat.createBattle(handoff(
    { species: "Growlithe", form: "Hisuian", level: 5 },
    { species: "Koffing", level: 5 }
  ));

  battle = await combat.usePlayerMove(battle, "bite");
  assert.equal(battle.opponent.statuses.flinchedTurns, 1);

  battle = await combat.advanceToPlayerOrEnd(battle);
  const attack = battle.log.find((entry) => entry.type === "attack" && entry.actor === "opponent");
  assert.equal(attack.attackRoll.mode, "disadvantage");
  assert.deepEqual(attack.attackRoll.rolls, [18, 2]);
  assert.equal(battle.opponent.statuses.flinchedTurns, 0);
});

test("Lick on natural 18 paralyzes and a 1 on d4 skips the target turn", async () => {
  const dice = new SequenceDice([15, 5, 18, 4, 1]);
  const combat = new Pokemon5eCombatEngine({ dice });
  let battle = await combat.createBattle(handoff(
    { species: "Gastly", level: 5 },
    { species: "Totodile", level: 5 }
  ));

  battle = await combat.usePlayerMove(battle, "lick");
  assert.equal(battle.opponent.statuses.nonVolatile, "Paralysis");

  battle = await combat.advanceToPlayerOrEnd(battle);
  const skipped = battle.log.find((entry) => entry.type === "turn_skipped" && entry.actor === "opponent");
  assert.equal(skipped.reason, "Paralysis");
  assert.equal(combat.actor(battle), "player");
});

test("Intimidate is a once-per-rest reaction hook that imposes disadvantage", async () => {
  const dice = new SequenceDice([1, 20, 18, 2]);
  const combat = new Pokemon5eCombatEngine({ dice });
  let battle = await combat.createBattle(handoff(
    { species: "Growlithe", form: "Hisuian", level: 5 },
    { species: "Houndour", level: 3 }
  ));

  assert.equal(combat.actor(battle), "opponent");
  assert.equal(combat.canUseIntimidate(battle, "player"), true);

  battle = await combat.advanceToPlayerOrEnd(battle, { usePlayerIntimidate: true });
  const attack = battle.log.find((entry) => entry.type === "attack");
  assert.equal(attack.attackRoll.mode, "disadvantage");
  assert.deepEqual(attack.attackRoll.rolls, [18, 2]);
  assert.equal(battle.player.abilityState.intimidateAvailable, false);
  assert.equal(combat.canUseIntimidate(battle, "player"), false);
});

test("Flash Fire grants Fire immunity then doubles STAB on the next Fire move", async () => {
  const dice = new SequenceDice([1, 20, 15, 6, 15, 6]);
  const combat = new Pokemon5eCombatEngine({ dice });
  let battle = await combat.createBattle(handoff(
    { species: "Growlithe", form: "Hisuian", level: 5, abilityId: "flash-fire" },
    { species: "Houndour", level: 3 }
  ));

  battle = await combat.advanceToPlayerOrEnd(battle);
  const incoming = battle.log.find((entry) => entry.type === "attack" && entry.actor === "opponent");
  assert.equal(incoming.damage, 0);
  assert.equal(incoming.immunityAbility, "flash-fire");
  assert.equal(battle.player.abilityState.flashFireCharged, true);

  battle = await combat.usePlayerMove(battle, "ember");
  const outgoing = battle.log.filter((entry) => entry.type === "attack").at(-1);
  assert.equal(outgoing.stab, 6);
  assert.equal(battle.player.abilityState.flashFireCharged, false);
});

test("Torrent doubles STAB at 25 percent HP or lower", async () => {
  const data = new Poke5eDataRepository();
  const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([10, 10]) });
  const totodile = await combat.createCombatant({ species: "Totodile", level: 5 });
  const waterGun = await data.getMove("water-gun");

  totodile.hp.current = Math.floor(totodile.hp.max * 0.25);
  const stats = calculateMoveStats(totodile, waterGun);

  assert.equal(totodile.abilityId, "torrent");
  assert.equal(stats.stab, 6);
  assert.equal(stats.damageModifier, 6);
});

test("Early Bird gives advantage on the end-turn wake check", async () => {
  const dice = new SequenceDice([15, 5, 2, 3, 12]);
  const combat = new Pokemon5eCombatEngine({ dice });
  let battle = await combat.createBattle(handoff(
    { species: "Gastly", level: 5 },
    { species: "Houndour", level: 3 }
  ));

  battle = await combat.usePlayerMove(battle, "hypnosis");
  assert.equal(battle.opponent.statuses.nonVolatile, "Asleep");

  battle = await combat.advanceToPlayerOrEnd(battle);
  const wake = battle.log.find((entry) => entry.type === "wake_check" && entry.actor === "opponent");
  assert.equal(wake.advantage, true);
  assert.deepEqual(wake.rolls, [3, 12]);
  assert.equal(wake.wake, true);
  assert.equal(battle.opponent.statuses.nonVolatile, null);
});

test("Poisoned end-turn damage equals proficiency and Poison-type creatures are immune", async () => {
  const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([10, 10]) });
  const eevee = await combat.createCombatant({ species: "Eevee", level: 5 });
  const koffing = await combat.createCombatant({ species: "Koffing", level: 5 });

  assert.equal(applyStatus(eevee, "Poisoned").applied, true);
  const before = eevee.hp.current;
  const events = endTurnStatus(eevee, new SequenceDice([]), 3);
  assert.equal(eevee.hp.current, before - 3);
  assert.equal(events[0].damage, 3);

  const immune = applyStatus(koffing, "Poisoned");
  assert.equal(immune.applied, false);
  assert.equal(immune.reason, "poison_or_steel_type");
});
