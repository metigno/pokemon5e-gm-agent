import test from "node:test";
import assert from "node:assert/strict";

import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { createNewGameState } from "../src/engine/state.mjs";
import { trainerGameplayView, usePlayerTrainerCombatFeature } from "../src/engine/trainer-ui-runtime.mjs";

test("Raise Your Defenses is offered only inside a real targeted-by-attack window", async () => {
  const dice = new SequenceDice([10, 10, 10, 10, 10, 10]);
  const combat = new Pokemon5eCombatEngine({ dice });
  const state = createNewGameState({ protagonist: "Luke" });
  state.player.classFeatures.push("raise-your-defenses");
  state.player.classResources["tactical-points"] = {
    id: "tactical-points", current: 2, max: 4, recharge: "long-rest"
  };

  let battle = await combat.createBattle({
    encounterId: "TRAINER_REACTION_TRIGGER",
    playerPokemon: { species: "Growlithe", form: "Hisuian", level: 5 },
    opponent: { species: "Houndour", level: 5 }
  });
  battle.trainer.classFeatures.push("raise-your-defenses");
  battle.trainer.classResources["tactical-points"] = { id: "tactical-points", current: 2, max: 4 };
  battle.order = ["opponent", "player"];
  battle.turnIndex = 0;
  battle = await combat.prepareCurrentTurn(battle);

  const before = trainerGameplayView(state, battle);
  const blocked = before.features.find((entry) => entry.id === "raise-your-defenses");
  assert.equal(blocked.legal, false);
  assert.equal(blocked.reason, "not_player_turn");

  battle = await combat.useOpponentTurn(battle);
  assert.equal(battle.pendingTrainerReaction?.trigger, "targeted_by_attack");
  assert.equal(battle.pendingTrainerReaction?.featureId, "raise-your-defenses");

  const during = trainerGameplayView(state, battle, battle.pendingTrainerReaction);
  const offered = during.features.find((entry) => entry.id === "raise-your-defenses");
  assert.equal(offered.legal, true);

  const outcome = usePlayerTrainerCombatFeature(state, battle, {
    featureId: "raise-your-defenses",
    cost: 1,
    mode: "ac",
    targetSide: "player",
    reactionContext: battle.pendingTrainerReaction
  });
  assert.equal(outcome.used, true);
  assert.equal(state.player.classResources["tactical-points"].current, 1);
  assert.equal(battle.trainer.reactionAvailable, false);
  assert.equal(battle.player.effects.acModifierSources.at(-1).value, 1);

  battle = await combat.resolvePendingTrainerReaction(battle, { useReaction: true });
  assert.equal(battle.pendingTrainerReaction, null);
  assert.ok(battle.log.some((entry) => entry.type === "attack"));
});

test("declining the Trainer reaction spends neither reaction nor Tactical Points", async () => {
  const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([10, 10, 10, 10, 10]) });
  const state = createNewGameState({ protagonist: "Luke" });
  state.player.classFeatures.push("raise-your-defenses");
  state.player.classResources["tactical-points"] = { id: "tactical-points", current: 2, max: 4 };

  let battle = await combat.createBattle({
    encounterId: "TRAINER_REACTION_DECLINE",
    playerPokemon: { species: "Growlithe", form: "Hisuian", level: 5 },
    opponent: { species: "Houndour", level: 5 }
  });
  battle.trainer.classFeatures.push("raise-your-defenses");
  battle.trainer.classResources["tactical-points"] = { id: "tactical-points", current: 2, max: 4 };
  battle.order = ["opponent", "player"];
  battle.turnIndex = 0;
  battle = await combat.prepareCurrentTurn(battle);
  battle = await combat.useOpponentTurn(battle);
  assert.ok(battle.pendingTrainerReaction);

  battle = await combat.resolvePendingTrainerReaction(battle, { useReaction: false });
  assert.equal(state.player.classResources["tactical-points"].current, 2);
  assert.equal(battle.trainer.reactionAvailable, true);
  assert.equal(battle.pendingTrainerReaction, null);
});
