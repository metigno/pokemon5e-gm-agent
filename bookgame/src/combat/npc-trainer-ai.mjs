import { executeTrainerFeature, trainerFeatureRuntimeDefinition } from "../engine/trainer-actions.mjs";
import { applyTrainerCombatEffect } from "./trainer-effects.mjs";

function resourceAvailable(trainer, id, cost = 1) {
  return Number(trainer?.classResources?.[id]?.current ?? 0) >= cost;
}

function knows(trainer, featureId) {
  return (trainer?.classFeatures ?? []).includes(featureId);
}

function featureState(trainer) {
  return { player: {}, npcs: { opponent: { trainer } } };
}

function rollDie(dice, die = "d6") {
  const sides = Number(String(die).replace(/^d/i, ""));
  if (!Number.isInteger(sides) || sides < 2) throw new Error("Invalid Trainer feature die: " + die);
  return dice.roll(sides);
}

export function chooseNpcTrainerFeature({ battle, trainer }) {
  if (!trainer || battle.outcome || battle.awaitingSwitch) return null;

  if (
    knows(trainer, "cheerleader") &&
    resourceAvailable(trainer, "cheerleader") &&
    battle.opponent?.turn?.bonusActionAvailable
  ) {
    return { featureId: "cheerleader", mode: "attack", targetSide: "opponent" };
  }

  if (
    knows(trainer, "directed-strike") &&
    resourceAvailable(trainer, "tactical-points", 2)
  ) {
    return { featureId: "directed-strike", targetSide: "opponent" };
  }

  if (
    knows(trainer, "battle-master") &&
    resourceAvailable(trainer, "battle-dice")
  ) {
    return { featureId: "battle-master", mode: "attack", targetSide: "opponent" };
  }

  return null;
}

export function useNpcTrainerFeature({ battle, trainer, decision, dice }) {
  if (!decision) return { battle, trainer, used: false };
  const state = featureState(trainer);
  const result = executeTrainerFeature(state, {
    actor: { kind: "npc", id: "opponent" },
    featureId: decision.featureId,
    cost: decision.cost ?? null,
    mode: decision.mode ?? null
  });
  if (!result.used) return { battle, trainer, used: false, result };

  const def = trainerFeatureRuntimeDefinition(decision.featureId);
  let roll = null;
  if (decision.featureId === "battle-master") {
    roll = rollDie(dice, trainer.classResources?.["battle-dice"]?.die ?? "d6");
  }
  applyTrainerCombatEffect(battle, {
    side: "opponent",
    targetSide: decision.targetSide ?? "opponent",
    featureResult: result,
    mode: decision.mode ?? null,
    roll
  });

  if (def?.action === "bonus-action") {
    battle.opponent.turn.bonusActionAvailable = false;
  }
  battle.log.push({
    type: "npc_trainer_ai_feature",
    round: battle.round,
    actor: "opponent_trainer",
    featureId: decision.featureId,
    mode: decision.mode ?? null,
    roll
  });
  return { battle, trainer, used: true, result, roll };
}

export function runNpcTrainerTurnFeatures({ battle, trainer, dice }) {
  let guard = 0;
  const used = [];
  while (guard++ < 4) {
    const decision = chooseNpcTrainerFeature({ battle, trainer });
    if (!decision) break;
    const outcome = useNpcTrainerFeature({ battle, trainer, decision, dice });
    if (!outcome.used) break;
    used.push(decision.featureId);
    // Only one trigger-style offensive setup per turn; bonus-action setup may
    // be followed by one trigger feature.
    if (decision.featureId !== "cheerleader") break;
  }
  return { battle, trainer, used };
}


export function useNpcRaiseYourDefensesReaction({ battle, trainer, targetSide = "opponent", cost = 1 }) {
  if (!trainer || battle.outcome || battle.awaitingSwitch) return { battle, trainer, used: false, reason: "combat_unavailable" };
  if (!knows(trainer, "raise-your-defenses")) return { battle, trainer, used: false, reason: "feature_not_known" };
  if (!resourceAvailable(trainer, "tactical-points", cost)) return { battle, trainer, used: false, reason: "insufficient_resource" };
  if (!trainer.reactionAvailable) return { battle, trainer, used: false, reason: "reaction_spent" };

  const state = featureState(trainer);
  const result = executeTrainerFeature(state, {
    actor: { kind: "npc", id: "opponent" },
    featureId: "raise-your-defenses",
    cost,
    mode: "ac"
  });
  if (!result.used) return { battle, trainer, used: false, result };

  applyTrainerCombatEffect(battle, {
    side: "opponent",
    targetSide,
    featureResult: result,
    mode: "ac"
  });
  trainer.reactionAvailable = false;
  battle.log.push({
    type: "npc_trainer_ai_reaction",
    round: battle.round,
    actor: "opponent_trainer",
    featureId: "raise-your-defenses",
    trigger: "targeted_by_attack",
    targetSide,
    cost
  });
  return { battle, trainer, used: true, result };
}
