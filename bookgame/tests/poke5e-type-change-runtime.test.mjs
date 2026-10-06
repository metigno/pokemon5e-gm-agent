import test from "node:test";
import assert from "node:assert/strict";

import { Pokemon5eCombatEngine, isMoveResolvable } from "../src/combat/combat-engine.mjs";
import { Poke5eDataRepository } from "../src/combat/poke5e-data.mjs";
import { damageProfile } from "../src/combat/poke5e-rules.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";

const TYPE_CHANGE_MOVES = [
  "forests-curse",
  "magic-powder",
  "reflect-type",
  "soak",
  "trick-or-treat"
];

test("temporary type-changing family tightens full-runtime coverage", async () => {
  const data = new Poke5eDataRepository();
  const moves = await data.listMoves();
  const unresolved = moves.filter((move) => !isMoveResolvable(move)).map((move) => move.id);

  assert.ok(unresolved.length <= 173, `unresolved move rules regressed to ${unresolved.length}`);
  for (const id of TYPE_CHANGE_MOVES) {
    assert.ok(!unresolved.includes(id), `${id} should be executable`);
  }
});

test("save-based type changes use real target types and authored durations", async () => {
  const cases = [
    ["forests-curse", "grass", 3],
    ["magic-powder", "psychic", 10],
    ["soak", "water", 3],
    ["trick-or-treat", "ghost", 3]
  ];

  for (const [moveId, expectedType, remainingTurns] of cases) {
    const combat = new Pokemon5eCombatEngine({
      dice: new SequenceDice([20, 1, 1])
    });
    let battle = await combat.createBattle({
      encounterId: `FULL_RUNTIME_TYPE_${moveId}`,
      playerPokemon: { speciesId: "eevee", level: 5, moveIds: [moveId] },
      opponent: { speciesId: "caterpie", level: 1, moveIds: ["growl"] },
      playerPosition: { x: 0, y: 0 },
      opponentPosition: { x: 20, y: 0 }
    });

    const canonical = [...battle.opponent.baseTypes];
    battle = await combat.usePlayerMove(battle, moveId);

    assert.deepEqual(battle.opponent.types, [expectedType]);
    assert.deepEqual(battle.opponent.baseTypes, canonical);
    assert.equal(battle.opponent.effects.typeOverride.source, moveId);
    assert.equal(battle.opponent.effects.typeOverride.remainingTurns, remainingTurns);
  }
});

test("Soak lasts three target turns then restores the canonical type", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 1, 1, 1, 1])
  });
  let battle = await combat.createBattle({
    encounterId: "FULL_RUNTIME_SOAK_DURATION",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["soak"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["growl"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 20, y: 0 }
  });
  const canonical = [...battle.opponent.baseTypes];

  battle = await combat.usePlayerMove(battle, "soak");
  assert.deepEqual(battle.opponent.types, ["water"]);
  assert.equal(
    damageProfile({ type: "electric" }, battle.opponent, battle.round).multiplier,
    2
  );

  for (let completedTurns = 1; completedTurns <= 3; completedTurns += 1) {
    battle = await combat.endPlayerTurn(battle);
    battle = await combat.advanceToPlayerOrEnd(battle);

    if (completedTurns < 3) {
      assert.deepEqual(battle.opponent.types, ["water"]);
      assert.equal(
        battle.opponent.effects.typeOverride.remainingTurns,
        3 - completedTurns
      );
    }
  }

  assert.equal(battle.opponent.effects.typeOverride, null);
  assert.deepEqual(battle.opponent.types, canonical);
});

test("Reflect Type copies the active target and binds restoration to concentration", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let battle = await combat.createBattle({
    encounterId: "FULL_RUNTIME_REFLECT_TYPE",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["reflect-type"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["growl"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 20, y: 0 }
  });

  battle = await combat.usePlayerMove(battle, "reflect-type");

  assert.deepEqual(battle.player.baseTypes, ["normal"]);
  assert.deepEqual(battle.player.types, battle.opponent.types);
  assert.equal(battle.player.effects.typeOverride.source, "reflect-type");
  assert.equal(battle.player.concentration?.moveId, "reflect-type");
  assert.equal(battle.player.concentration?.effectSource, "reflect-type");
});
