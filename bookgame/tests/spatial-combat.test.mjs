import test from "node:test";
import assert from "node:assert/strict";

import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";

function handoff({
  player = { species: "Growlithe", form: "Hisuian", level: 5 },
  opponent = { species: "Eevee", level: 5 },
  playerPosition = { x: 0, y: 0 },
  opponentPosition = { x: 5, y: 0 },
  playerBench = [],
  trainer = null
} = {}) {
  return {
    encounterId: "SPATIAL_TEST",
    playerPokemon: player,
    opponent,
    playerPosition,
    opponentPosition,
    playerBench,
    trainer
  };
}

test("melee move is illegal out of reach until the Pokémon moves into range", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([15, 5, 15, 6])
  });
  let battle = await combat.createBattle(handoff({
    opponentPosition: { x: 20, y: 0 }
  }));

  const before = await combat.availablePlayerMoves(battle);
  assert.equal(before.some((move) => move.id === "tackle"), false);

  await assert.rejects(
    combat.usePlayerMove(battle, "tackle"),
    /out of range/i
  );

  battle = await combat.moveCombatant(battle, "player", { x: 15, y: 0 });
  assert.equal(battle.player.turn.movementRemaining, 15);

  const after = await combat.availablePlayerMoves(battle);
  assert.equal(after.some((move) => move.id === "tackle"), true);

  battle = await combat.usePlayerMove(battle, "tackle");
  const attack = battle.log.find((entry) => entry.type === "attack");
  assert.equal(attack.hit, true);
});

test("Quick Attack can step up to 10ft into melee without provoking", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([15, 5, 15, 4])
  });
  let battle = await combat.createBattle(handoff({
    player: { species: "Eevee", level: 5 },
    opponent: { species: "Houndour", level: 3 },
    opponentPosition: { x: 12, y: 0 }
  }));

  const moves = await combat.availablePlayerMoves(battle);
  assert.equal(moves.some((move) => move.id === "quick-attack"), true);

  battle = await combat.usePlayerMove(battle, "quick-attack");
  const step = battle.log.find((entry) => entry.type === "move_step");
  assert.equal(step.feet, 7);
  assert.equal(step.provokesOpportunity, false);
  assert.equal(battle.player.position.x, 7);
  assert.equal(battle.player.turn.movementRemaining, 30);
});

test("leaving enemy reach can trigger a PP-consuming attack of opportunity", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([15, 5, 15, 6])
  });
  let battle = await combat.createBattle(handoff({
    opponent: { species: "Eevee", level: 5 },
    playerPosition: { x: 5, y: 0 },
    opponentPosition: { x: 0, y: 0 }
  }));

  const hpBefore = battle.player.hp.current;
  const ppBefore = battle.opponent.pp.tackle;

  battle = await combat.moveCombatant(
    battle,
    "player",
    { x: 10, y: 0 },
    { opportunityMoveId: "tackle" }
  );

  const reaction = battle.log.find((entry) => entry.type === "opportunity_attack");
  assert.equal(reaction.actor, "opponent");
  assert.equal(battle.opponent.reactionAvailable, false);
  assert.equal(battle.opponent.pp.tackle, ppBefore - 1);
  assert.ok(battle.player.hp.current < hpBefore);
  assert.equal(battle.player.position.x, 10);
});

test("Disengage prevents the opportunity attack while still allowing movement", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([15, 5])
  });
  let battle = await combat.createBattle(handoff({
    opponent: { species: "Eevee", level: 5 },
    playerPosition: { x: 5, y: 0 },
    opponentPosition: { x: 0, y: 0 }
  }));

  const ppBefore = battle.opponent.pp.tackle;
  battle = await combat.useDisengage(battle, "player");
  battle = await combat.moveCombatant(
    battle,
    "player",
    { x: 10, y: 0 },
    { opportunityMoveId: "tackle" }
  );

  assert.equal(battle.opponent.pp.tackle, ppBefore);
  assert.equal(battle.opponent.reactionAvailable, true);
  assert.equal(battle.log.some((entry) => entry.type === "opportunity_attack"), false);
  assert.equal(battle.player.position.x, 10);
});

test("voluntary switch uses the trainer action, never provokes, and preserves the outgoing Pokémon", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([15, 5])
  });
  let battle = await combat.createBattle(handoff({
    opponent: { species: "Eevee", level: 5 },
    playerPosition: { x: 5, y: 0 },
    opponentPosition: { x: 5, y: 0 },
    playerBench: [{ species: "Gastly", level: 5 }],
    trainer: {
      name: "Luke",
      level: 5,
      abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 14, CHA: 10 },
      skills: ["Animal Handling"],
      inventory: []
    }
  }));

  battle.player.hp.current -= 4;
  const outgoingHp = battle.player.hp.current;

  battle = await combat.switchPlayer(battle, 0, {
    releasePosition: { x: 0, y: 0 }
  });

  assert.equal(battle.player.speciesId, "gastly");
  assert.equal(battle.player.position.x, 0);
  assert.equal(battle.playerBench[0].speciesId, "growlithe-hisui");
  assert.equal(battle.playerBench[0].hp.current, outgoingHp);
  assert.equal(battle.log.at(-1).type, "switch");
  assert.equal(battle.log.at(-1).provokesOpportunity, false);
  assert.equal(combat.actor(battle), "opponent");
});

test("fainted active Pokémon can be replaced immediately as a trainer reaction", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([1, 20, 15, 6])
  });
  let battle = await combat.createBattle(handoff({
    opponent: { species: "Eevee", level: 5 },
    playerBench: [{ species: "Gastly", level: 5 }]
  }));

  battle.player.hp.current = 1;
  battle = await combat.advanceToPlayerOrEnd(battle);

  assert.equal(battle.awaitingSwitch, "player");
  assert.equal(battle.outcome, null);

  battle = await combat.switchPlayer(battle, 0, {
    releasePosition: { x: 0, y: 0 }
  });

  assert.equal(battle.awaitingSwitch, null);
  assert.equal(battle.player.speciesId, "gastly");
  assert.equal(battle.trainer.reactionAvailable, false);
  assert.equal(battle.log.at(-1).forced, true);
});

test("capture action consumes an owned ball and can end wild combat as captured", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([15, 5, 15])
  });

  let battle = await combat.createBattle(handoff({
    opponent: { species: "Houndour", level: 3 },
    opponentPosition: { x: 30, y: 0 },
    trainer: {
      name: "Luke",
      level: 5,
      abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 14, CHA: 10 },
      skills: ["Animal Handling"],
      inventory: ["Great Ball"]
    }
  }));

  const { battle: next, result } = await combat.attemptPlayerCapture(battle, "great-ball");
  battle = next;

  assert.equal(result.legal, true);
  assert.equal(result.captured, true);
  assert.equal(result.dc, 8);
  assert.equal(battle.trainer.inventory.length, 0);
  assert.equal(battle.outcome, "captured");
  assert.equal(battle.log.at(-1).reason, "capture");
});

test("illegal capture above trainer level does not consume the Pokéball or action", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([15, 5])
  });

  const battle = await combat.createBattle(handoff({
    opponent: { species: "Houndour", level: 3 },
    trainer: {
      name: "Luke",
      level: 1,
      abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 14, CHA: 10 },
      skills: ["Animal Handling"],
      inventory: ["Pokeball"]
    }
  }));

  const { battle: next, result } = await combat.attemptPlayerCapture(battle, "pokeball");
  assert.equal(result.legal, false);
  assert.equal(result.reason, "target_level_above_trainer");
  assert.equal(next.trainer.inventory.length, 1);
  assert.equal(next.trainer.actionAvailable, true);
  assert.equal(next.player.turn.actionAvailable, true);
});
