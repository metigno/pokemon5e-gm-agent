import { experienceNeededAtLevel } from "./state.mjs";
import { pokemonLevelCapForState, pokemonModuleForState } from "./pokemon-xp-balance.mjs";
import { trainerLevelCapForState } from "./trainer-xp-balance.mjs";
import { FIVE_FRIEND_IDS } from "./npc-state.mjs";
import { normalizeSpriteId } from "../assets/sprite-runtime.mjs";

function speciesIdOf(pokemon) {
  const raw = pokemon?.speciesId ?? pokemon?.species ?? null;
  if (typeof raw !== "string" || !raw.trim()) return null;
  // Saved starters may store species + form separately (e.g. Growlithe / Hisuian);
  // combat already uses the resolved canonical speciesId. Reuse sprite mapping
  // normalization for both so regional forms are not silently merged.
  const form = pokemon?.speciesId ? null : pokemon?.form ?? null;
  const normalForm = /^(standard|normal|default)$/i.test(String(form ?? ""));
  return normalizeSpriteId(raw, normalForm ? null : form);
}

// These records are written only when a Pokémon is actually encountered or captured.
// Rumours, dialogue and unrevealed NPC rosters must never populate the Pokédex.
export function recordPokemonSeen(state, pokemon) {
  const id = speciesIdOf(pokemon);
  if (!id) return false;
  state.pokedex ??= { seen: [], caught: [] };
  state.pokedex.seen ??= [];
  if (!state.pokedex.seen.includes(id)) state.pokedex.seen.push(id);
  return true;
}

export function recordPokemonCaught(state, pokemon) {
  if (!recordPokemonSeen(state, pokemon)) return false;
  const id = speciesIdOf(pokemon);
  state.pokedex.caught ??= [];
  if (!state.pokedex.caught.includes(id)) state.pokedex.caught.push(id);
  return true;
}

function pokedexView(state) {
  const seen = new Set();
  const caught = new Set();
  const add = (collection, pokemon) => {
    const id = speciesIdOf(pokemon);
    if (id) collection.add(id);
  };
  for (const id of state.pokedex?.seen ?? []) add(seen, { speciesId: id });
  for (const id of state.pokedex?.caught ?? []) add(caught, { speciesId: id });
  for (const encounter of state.ecology?.history ?? []) add(seen, encounter);
  // Owned Pokémon are always Seen + Caught, including evolved starters and old saves.
  for (const pokemon of state.player?.roster ?? []) add(caught, pokemon);
  if (state.player?.starter) add(caught, state.player.starter);
  if (state.pending?.type === "pokemon_capture_replacement") add(caught, state.pending.pokemon);
  for (const id of caught) seen.add(id);
  const entries = [...seen].sort().map((speciesId) => ({
    speciesId, status: caught.has(speciesId) ? "caught" : "seen"
  }));
  return { seen: seen.size, caught: caught.size, entries };
}

const BRIEF_IDENTITIES = Object.freeze({
  Blue: "Allenatore competitivo, conosciuto per il suo carattere diretto.",
  N: "Allenatore che presta particolare attenzione alla voce dei Pokémon.",
  Steven: "Allenatore e ricercatore, legato allo studio dei minerali.",
  Archie: "Figura influente dei territori marittimi.",
  Lance: "Allenatore esperto, noto per i Pokémon di tipo Drago.",
  Red: "Allenatore di campo, tra i più celebri al mondo.",
  Cynthia: "Campionessa e studiosa della storia dei Pokémon."
});

function knownPeopleView(state) {
  const knownFriends = new Set(FIVE_FRIEND_IDS.filter((name) => name !== state.player?.name));
  const result = [];
  for (const [id, npc] of Object.entries(state.npcs ?? {})) {
    if (!npc || (!knownFriends.has(id) && npc.state?.met !== true && npc.state?.introduced !== true &&
      state.world?.flags?.[`${id.toLowerCase()}_met`] !== true)) continue;
    result.push({
      name: String(npc.name ?? id),
      description: knownFriends.has(id) ? "Amico e rivale di lunga data." :
        (BRIEF_IDENTITIES[id] ?? "Persona incontrata durante il viaggio."),
      relationship: typeof npc.relationship?.qualitative === "string"
        ? npc.relationship.qualitative : "Neutral"
    });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

function reputationView(state) {
  const factions = state.reputation?.factions ?? state.reputations ?? {};
  const entries = Object.entries(factions).flatMap(([name, value]) => {
    const label = typeof value === "string" ? value : value?.qualitative ?? value?.label;
    // Reputation may have hidden numeric scores, but no UI-generated thresholds.
    return typeof label === "string" && label.trim()
      ? [{ name, label }] : [];
  });
  return {
    alignment: state.player?.alignment?.label ?? state.alignment?.label ?? null,
    entries: entries.sort((a, b) => a.name.localeCompare(b.name))
  };
}

function hallOfFameView(state) {
  const world = state.competition?.world ?? {};
  const entries = [...(world.hallOfFame ?? [])];
  if (world.finalResolved && world.currentWorldChampion && !entries.some((entry) => entry.edition === world.edition)) {
    entries.push({
      edition: world.edition ?? 1,
      champion: world.currentWorldChampion,
      runnerUp: world.currentWorldRunnerUp ?? null
    });
  }
  return entries.filter((entry) => entry?.champion?.name).sort((a, b) => a.edition - b.edition)
    .map(({ edition, champion, runnerUp }) => ({
      edition, champion: champion.name, runnerUp: runnerUp?.name ?? null,
      playerChampion: champion.name === state.player?.name
    }));
}

export function informationPanelsView(state) {
  const trainerLevel = Number(state.player?.trainerLevel ?? 1);
  const moduleId = pokemonModuleForState(state);
  return {
    pokedex: pokedexView(state),
    people: knownPeopleView(state),
    reputation: reputationView(state),
    hallOfFame: hallOfFameView(state),
    progression: {
      moduleId,
      trainerLevel,
      trainerXp: Number.isFinite(state.player?.trainerXp) ? state.player.trainerXp : null,
      trainerNextLevelXp: trainerLevel >= 20 ? null : experienceNeededAtLevel(trainerLevel + 1),
      trainerCap: trainerLevelCapForState(state),
      pokemonCap: pokemonLevelCapForState(state),
      pendingChoices: state.player?.trainerProgression?.pendingChoices?.length ?? 0,
      rank: state.competition?.rank ?? "F",
      circuitPoints: state.competition?.circuitPoints ?? 0
    }
  };
}
