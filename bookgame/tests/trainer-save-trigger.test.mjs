import test from "node:test";
import assert from "node:assert/strict";

import { executeTrainerFeature } from "../src/engine/trainer-actions.mjs";
import { trainerGameplayView } from "../src/engine/trainer-ui-runtime.mjs";
import { applyTrainerCombatEffect } from "../src/combat/trainer-effects.mjs";
import { resolveSaveMove } from "../src/combat/poke5e-rules.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

test("Not This Time is unavailable outside a real player save-move trigger", () => {
  const state = createNewGameState({ protagonist: "Luke" });
  state.player.classFeatures.push("not-this-time");
  state.player.classResources["tactical-points"] = { id: "tactical-points", current: 3, max: 4 };
  const battle = {
    order: ["player", "opponent"], turnIndex: 0, round: 1,
    player: { turn: { actionAvailable: true, bonusActionAvailable: true } },
    trainer: { reactionAvailable: true }
  };
  const feature = trainerGameplayView(state, battle).features.find((entry) => entry.id === "not-this-time");
  assert.equal(feature.legal, false);
  assert.equal(feature.reason, "save_trigger_required");
});

test("Not This Time raises the canonical save DC and spends Tactical Points", () => {
  const state = createNewGameState({ protagonist: "Luke" });
  state.player.classFeatures.push("not-this-time");
  state.player.classResources["tactical-points"] = { id: "tactical-points", current: 3, max: 4 };

  const battle = {
    round: 1, log: [],
    player: {
      effects: {},
      level: 5,
      proficiencyBonus: 3,
      abilities: { STR:10,DEX:10,CON:10,INT:10,WIS:10,CHA:16 },
      types: ["normal"]
    }
  };
  const used = executeTrainerFeature(state, { featureId: "not-this-time", cost: 2 });
  applyTrainerCombatEffect(battle, { side: "player", targetSide: "player", featureResult: used });

  const defender = {
    level: 5,
    abilities: { STR:10,DEX:10,CON:10,INT:10,WIS:10,CHA:10 },
    savingThrows: [],
    effects: {},
    statuses: {},
    types: ["normal"]
  };
  const move = {
    id: "test-save", name: "Test Save", type: "normal",
    save: "DEX", dice: { type: "damage", amount: 1, value: 6 },
    time: { unit: "action" }
  };
  const result = resolveSaveMove({
    attacker: battle.player,
    defender,
    move,
    dice: new SequenceDice([10]),
    round: 1
  });

  assert.equal(result.saveDcBonus, 2);
  assert.equal(result.saveDc, result.baseSaveDc + 2);
  assert.equal(state.player.classResources["tactical-points"].current, 1);
});
