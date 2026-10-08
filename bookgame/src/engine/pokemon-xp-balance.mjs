import { EXPERIENCE_NEEDED_PER_LEVEL, experienceNeededAtLevel } from "./state.mjs";

// Balance decision: locked checkpoint caps; never raise the cap merely by
// grinding an older encounter. Max Pokémon 5e level remains 20.
export const POKEMON_LEVEL_CAPS_BY_MODULE = Object.freeze({
  M01: 5, M02: 6, M03: 8, M04: 10, M05: 12, M06: 14,
  M07: 16, M08: 18, M09: 20, M10: 20, M11: 20, M12: 20
});

export function pokemonModuleForState(state) {
  const flags = state?.world?.flags ?? {};
  let reached = 1;
  for (let previous = 1; previous < 12; previous += 1) {
    if (flags[`m${previous}_complete`] === true ||
        flags[`m${String(previous).padStart(2, "0")}_complete`] === true) {
      reached = Math.max(reached, previous + 1);
    }
  }
  // A scripted transition may enter a module before its previous completion
  // flag is persisted. Module advancement never lowers an unlocked cap.
  const source = String(state?.pending?.moduleId ?? state?.story?.sceneId ?? "");
  const match = source.match(/^m0?([1-9]|1[0-2])(?:\b|-|$)/i);
  if (match) reached = Math.max(reached, Number(match[1]));
  return `M${String(Math.min(12, reached)).padStart(2, "0")}`;
}

export function pokemonLevelCapForState(state) {
  return POKEMON_LEVEL_CAPS_BY_MODULE[pokemonModuleForState(state)];
}

// 2024 experience thresholds are authoritative; the opponent's next-level
// threshold delta supplies a deterministic reward budget, split among all
// deployed Pokémon. This award rate is a campaign balancing setting, NOT
// the independent Trainer XP schedule.
export function battlePokemonXpPool(battle) {
  if (battle?.outcome !== "win") return 0;
  const opponents = [battle.opponent, ...(battle.opponentBench ?? [])];
  return opponents.reduce((total, opponent) => {
    if (!opponent || !Number.isFinite(opponent.hp?.current) || opponent.hp.current > 0) return total;
    const level = Number(opponent.level);
    if (!Number.isInteger(level) || level < 1 || level > 20) return total;
    const delta = level === 20
      ? EXPERIENCE_NEEDED_PER_LEVEL[19] - EXPERIENCE_NEEDED_PER_LEVEL[18]
      : experienceNeededAtLevel(level + 1) - experienceNeededAtLevel(level);
    return total + Math.max(1, Math.floor(delta / 3));
  }, 0);
}
