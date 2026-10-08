import { experienceNeededAtLevel } from "./state.mjs";
import { pokemonModuleForState } from "./pokemon-xp-balance.mjs";

// Trainer caps are independent of the Pokémon caps and follow the module
// bands in P5E_LIBROGAME_12_MODULES_MASTER.md (Trainer max 20).
export const TRAINER_LEVEL_CAPS_BY_MODULE = Object.freeze({
  M01: 3, M02: 5, M03: 9, M04: 12, M05: 15, M06: 18,
  M07: 20, M08: 20, M09: 20, M10: 20, M11: 20, M12: 20
});

export function trainerLevelCapForState(state) {
  return TRAINER_LEVEL_CAPS_BY_MODULE[pokemonModuleForState(state)];
}

// Relative to the current Trainer level's canonical 2024 XP threshold delta.
// This is a separate Trainer budget, never deducted from Pokémon XP.
export const TRAINER_ACTIVITY_REWARD_RATES = Object.freeze({
  battle: 0.25,
  quest: 0.25,
  exploration: 0.10,
  check: 0.08,
  dialogue: 0.06
});

export function trainerActivityXp(state, activity) {
  const rate = TRAINER_ACTIVITY_REWARD_RATES[activity];
  if (rate === undefined) throw new Error("Unknown Trainer XP activity: " + activity);
  const level = Math.max(1, Math.min(20, Number(state.player?.trainerLevel) || 1));
  if (level === 20) return 0;
  const delta = experienceNeededAtLevel(level + 1) - experienceNeededAtLevel(level);
  return Math.max(1, Math.floor(delta * rate));
}

export function trainerStoryRewardKind(choice, passed) {
  if (choice.combat || choice.ecology) return null;
  if (choice.check || choice.save) return passed === true ? "check" : null;
  const effects = choice.effects ?? [];
  if (effects.some(effect => effect.type === "trainer_milestone_level")) return null;
  if (effects.some(effect => effect.type === "quest_complete")) return "quest";
  if (effects.some(effect => effect.type === "set_flag" &&
    /(?:complete|resolved|discovered|explored|evidence|clue|found)$/i.test(effect.key ?? ""))) {
    return "exploration";
  }
  if (effects.some(effect => effect.type === "npc_relationship_adjust")) return "dialogue";
  return null;
}
