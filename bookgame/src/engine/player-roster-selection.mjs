/**
 * The current World battle bridge reads the first six structured roster slots.
 * Exchanging a reserve with slots 1–5 keeps the original starter at slot 0
 * and does not create, delete, heal or level any Pokémon.
 */
export function swapPlayerRosterSlots(state, { reserveIndex, officialIndex }) {
  if (!state || typeof state !== "object") throw new TypeError("Career state required");
  if (state.pending) throw new Error("Cannot change the Official Six during a pending subsystem");
  const roster = state.player?.roster;
  if (!Array.isArray(roster) || roster.length <= 6) {
    throw new Error("No reserve Pokémon available for substitution");
  }
  if (!Number.isInteger(reserveIndex) || reserveIndex < 6 || reserveIndex >= roster.length) {
    throw new RangeError("Reserve index must identify a Pokémon outside the first six slots");
  }
  if (!Number.isInteger(officialIndex) || officialIndex < 1 || officialIndex > 5) {
    throw new RangeError("Official slot must be 1..5; the starter slot remains preserved");
  }
  const next = structuredClone(state);
  [next.player.roster[officialIndex], next.player.roster[reserveIndex]] =
    [next.player.roster[reserveIndex], next.player.roster[officialIndex]];
  return next;
}
