import test from "node:test";
import assert from "node:assert/strict";

import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";

test("NPC Trainer uses Raise Your Defenses through the shared runtime before a player attack", async () => {
  const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([10, 10, 10, 10, 10, 10]) });
  let battle = await combat.createBattle({
    encounterId: "NPC_TRAINER_REACTION",
    playerPokemon: { species: "Growlithe", form: "Hisuian", level: 5 },
    opponent: { species: "Houndour", level: 5 },
    opponentTrainer: {
      name: "Tactician",
      classFeatures: ["command-pokemon", "raise-your-defenses"],
      classResources: {
        "tactical-points": { id: "tactical-points", current: 2, max: 4, recharge: "long-rest" }
      }
    }
  });
  battle.order = ["player", "opponent"];
  battle.turnIndex = 0;
  battle = await combat.prepareCurrentTurn(battle);

  const move = (await combat.availablePlayerMoves(battle)).find((entry) => entry.attack && entry.dice?.type === "damage");
  assert.ok(move, "fixture must expose an attack move");

  battle = await combat.usePlayerMove(battle, move.id);

  assert.equal(battle.opponentTrainer.classResources["tactical-points"].current, 1);
  assert.equal(battle.opponentTrainer.reactionAvailable, false);
  assert.ok(battle.log.some((entry) =>
    entry.type === "npc_trainer_ai_reaction" &&
    entry.featureId === "raise-your-defenses" &&
    entry.trigger === "targeted_by_attack"
  ));
});

test("NPC Trainer without Raise Your Defenses does not spend reaction or Tactical Points", async () => {
  const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([10, 10, 10, 10, 10, 10]) });
  let battle = await combat.createBattle({
    encounterId: "NPC_TRAINER_NO_REACTION",
    playerPokemon: { species: "Growlithe", form: "Hisuian", level: 5 },
    opponent: { species: "Houndour", level: 5 },
    opponentTrainer: {
      name: "Trainer",
      classFeatures: ["command-pokemon"],
      classResources: {
        "tactical-points": { id: "tactical-points", current: 2, max: 4, recharge: "long-rest" }
      }
    }
  });
  battle.order = ["player", "opponent"];
  battle.turnIndex = 0;
  battle = await combat.prepareCurrentTurn(battle);

  const move = (await combat.availablePlayerMoves(battle)).find((entry) => entry.attack && entry.dice?.type === "damage");
  assert.ok(move);
  battle = await combat.usePlayerMove(battle, move.id);

  assert.equal(battle.opponentTrainer.classResources["tactical-points"].current, 2);
  assert.equal(battle.opponentTrainer.reactionAvailable, true);
  assert.equal(battle.log.some((entry) => entry.type === "npc_trainer_ai_reaction"), false);
});
