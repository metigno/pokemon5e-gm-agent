import {
  equipTrainerGear,
  executeTrainerFeature,
  trainerFeatureRuntimeDefinition,
  trainerRuntimeView,
  unequipTrainerGear
} from "./trainer-actions.mjs";
import { applyTrainerCombatEffect, trainerCombatEffectSupported } from "../combat/trainer-effects.mjs";

function resourceStatus(trainer, def) {
  if (!def?.resourceId) return { available: true, current: null, max: null, cost: 0 };
  const resource = trainer.classResources?.[def.resourceId];
  const cost = Number(def.cost ?? def.minCost ?? 1);
  const current = Number(resource?.current ?? 0);
  return { available: current >= cost, current, max: Number(resource?.max ?? 0), cost };
}

function battleLegality(battle, def, reactionContext = null) {
  if (!battle) return { legal: false, reason: "combat_required" };
  if (battle.outcome) return { legal: false, reason: "combat_ended" };
  if (battle.awaitingSwitch) return { legal: false, reason: "switch_required" };
  if (
    battle.order?.[battle.turnIndex] !== "player" &&
    !(def.action === "reaction" && reactionContext)
  ) return { legal: false, reason: "not_player_turn" };
  if (def.action === "bonus-action" && !battle.player?.turn?.bonusActionAvailable) {
    return { legal: false, reason: "bonus_action_spent" };
  }
  if (def.action === "action" && !battle.player?.turn?.actionAvailable) {
    return { legal: false, reason: "action_spent" };
  }
  if (def.effect === "healing-bonus" && reactionContext?.trigger !== "pokemon_healing") {
    return { legal: false, reason: "healing_trigger_required" };
  }
  if (def.effect === "save-dc-bonus" && reactionContext?.trigger !== "player_save_move") {
    return { legal: false, reason: "save_trigger_required" };
  }
  if (def.action === "reaction") {
    if (!reactionContext) return { legal: false, reason: "reaction_trigger_required" };
    if (!battle.trainer?.reactionAvailable) return { legal: false, reason: "reaction_spent" };
    if (reactionContext.featureId && reactionContext.featureId !== "raise-your-defenses") {
      return { legal: false, reason: "reaction_trigger_mismatch" };
    }
  }
  return { legal: true, reason: null };
}

export function trainerGameplayView(state, battle = null, reactionContext = null) {
  const trainer = trainerRuntimeView(state);
  const features = (trainer.classFeatures ?? []).map((featureId) => {
    const def = trainerFeatureRuntimeDefinition(featureId);
    if (!def) return { id: featureId, executable: false, legal: false, reason: "runtime_context_not_executable" };
    if (!trainerCombatEffectSupported(def.effect)) {
      return { id: featureId, executable: false, legal: false, reason: "runtime_effect_not_bridged", action: def.action };
    }
    const resource = resourceStatus(trainer, def);
    const combat = battleLegality(battle, def, reactionContext);
    return {
      id: featureId,
      executable: true,
      action: def.action,
      effect: def.effect,
      resourceId: def.resourceId ?? null,
      resource,
      legal: resource.available && combat.legal,
      reason: !resource.available ? "insufficient_resource" : combat.reason
    };
  });
  return {
    hp: trainer.hp,
    ac: trainer.ac,
    conditions: trainer.conditions ?? [],
    death: trainer.death,
    classResources: trainer.classResources ?? {},
    featureUsage: trainer.featureUsage ?? {},
    equipment: trainer.equipment ?? [],
    trainerGear: trainer.trainerGear ?? [],
    inventory: trainer.inventory ?? [],
    features
  };
}

export function setTrainerGearEquipped(state, { gearId, equipped }) {
  return equipped
    ? equipTrainerGear(state, { gearId })
    : unequipTrainerGear(state, { gearId });
}

export function usePlayerTrainerCombatFeature(state, battle, {
  featureId,
  cost = null,
  mode = null,
  targetSide = "player",
  roll = null,
  reactionContext = null
}) {
  const view = trainerGameplayView(state, battle, reactionContext);
  const action = view.features.find((entry) => entry.id === featureId);
  if (!action) throw new Error("Trainer feature not known: " + featureId);
  if (!action.executable) throw new Error("Trainer feature is not executable in this runtime context: " + action.reason);
  if (!action.legal) return { used: false, reason: action.reason, state, battle };

  const result = executeTrainerFeature(state, { featureId, cost, mode });
  if (!result.used) return { used: false, reason: result.reason, result, state, battle };

  applyTrainerCombatEffect(battle, {
    side: "player",
    targetSide,
    featureResult: result,
    mode,
    roll
  });

  if (result.action === "bonus-action") battle.player.turn.bonusActionAvailable = false;
  if (result.action === "reaction") battle.trainer.reactionAvailable = false;
  if (result.action === "action") battle.player.turn.actionAvailable = false;
  battle.log ??= [];
  battle.log.push({
    type: "player_trainer_feature",
    round: battle.round,
    actor: "player_trainer",
    featureId,
    mode
  });
  return { used: true, result, state, battle };
}
