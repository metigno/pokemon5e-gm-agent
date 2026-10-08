import { POKEMON_LEVEL_CAPS_BY_MODULE } from "./pokemon-xp-balance.mjs";

// These are authored local-wildlife ranges, NOT player-level scaling.
// A generated encounter uses the zone's module/profile even if the player
// revisits it with a stronger party.
export const ECOLOGY_LEVEL_BANDS_BY_MODULE = Object.freeze({
  M01: Object.freeze({ min: 1, max: 4 }),
  M02: Object.freeze({ min: 2, max: 5 }),
  M03: Object.freeze({ min: 4, max: 7 }),
  M04: Object.freeze({ min: 7, max: 9 }),
  M05: Object.freeze({ min: 9, max: 11 })
});

export function ecologicalLevelBand(moduleId) {
  return ECOLOGY_LEVEL_BANDS_BY_MODULE[moduleId] ?? null;
}

export function authoredOpponentLevelLimit(moduleId, combat) {
  const cap = POKEMON_LEVEL_CAPS_BY_MODULE[moduleId];
  if (!cap) return null;
  // M09–M11 World rosters are resolved from persistent, regulated state.
  // They are not static opponents to balance or replace here.
  const comp = combat?.competition;
  if (Number.isInteger(comp?.worldOpponentIndex) ||
      ["R16", "QF", "SF", "FINAL"].includes(comp?.worldKnockoutRound)) return null;
  // Elite opposition may have a one-level edge; ordinary encounters,
  // standard matches and hard Trials may not exceed the player checkpoint.
  return Math.min(20, cap + (comp?.difficulty === "ELITE" ? 1 : 0));
}

export function validateAuthoredOpponentLevels(moduleId, combat) {
  const limit = authoredOpponentLevelLimit(moduleId, combat);
  if (limit == null) return [];
  const descriptors = [combat?.opponent, ...(combat?.opponentBench ?? [])].filter(Boolean);
  return descriptors.flatMap((entry, index) => {
    if (!Number.isInteger(entry.level) || entry.level < 1 || entry.level > 20) {
      return [{ index, species: entry.species, level: entry.level, limit, reason: "invalid_level" }];
    }
    if (entry.level > limit) {
      return [{ index, species: entry.species, level: entry.level, limit, reason: "exceeds_module_band" }];
    }
    if (String(entry.species ?? "").toLowerCase() === "trainer") {
      return [{ index, species: entry.species, level: entry.level, limit, reason: "trainer_is_not_a_pokemon" }];
    }
    return [];
  });
}
