import { acquireCareerPokemon, evolveCareerPokemon } from "./npc-roster-progression.mjs";
import { progressCanonicalFriendNpc } from "./npc-progression.mjs";
import { POKEMON_LEVEL_CAPS_BY_MODULE, pokemonModuleForState } from "./pokemon-xp-balance.mjs";

export const FRIEND_CAREER_MODULE_MILESTONES = Object.freeze({
  M01: { trainerLevel: 2, acquireSlots: {} },
  M02: { trainerLevel: 3, acquireSlots: { Luke: 2, Mattew: 2, Daniel: 2, Edward: 2, Fab: 3 } },
  M03: { trainerLevel: 4, acquireSlots: {} },
  M04: { trainerLevel: 5, acquireSlots: { Luke: 6, Mattew: 3, Daniel: 4, Edward: 3, Fab: 4 } },
  M05: { trainerLevel: 7, acquireSlots: { Luke: 5, Mattew: 4, Daniel: 5, Edward: 4, Fab: 5 } },
  M06: { trainerLevel: 9, acquireSlots: {} },
  M07: { trainerLevel: 11, acquireSlots: { Luke: 4, Mattew: 5, Daniel: 6, Edward: 6, Fab: 6 } },
  M08: { trainerLevel: 13, acquireSlots: {} },
  // Personal legendary Pokémon enter NPC rosters only at the World stage.
  // Player legendary encounters remain independent and never grant ownership automatically.
  M09: { trainerLevel: 14, acquireSlots: { Luke: 3, Mattew: 6, Daniel: 3, Edward: 5, Fab: 2 } },
  M10: { trainerLevel: 15, acquireSlots: {} },
  M11: { trainerLevel: 17, acquireSlots: {} },
  M12: { trainerLevel: 18, acquireSlots: {} }
});

// Pokémon levels are keyed by *acquisition order*, rather than final roster
// slot. Each friend obtains their ordinary species first and their personal
// legendary last; species/slots remain those of the canonical final roster.
export const FRIEND_POKEMON_LEVELS_BY_MODULE = Object.freeze({
  M01: [5],
  M02: [6, 5],
  M03: [8, 7],
  M04: [10, 9, 7],
  M05: [12, 11, 9, 7],
  M06: [14, 13, 11, 9],
  M07: [16, 15, 13, 11, 8],
  M08: [18, 17, 15, 13, 11],
  M09: [20, 20, 18, 17, 16, 18],
  M10: [20, 20, 20, 19, 18, 19],
  M11: [20, 20, 20, 20, 20, 20],
  M12: [20, 20, 20, 20, 20, 20]
});

// Milestones for species evolution, following the canonical 2024 Pokémon 5e
// evolution lines and their required levels. Items/bonds for NPC evolutions
// are part of these authored, persistent off-screen career milestones.
export const FRIEND_EVOLUTIONS_BY_MODULE = Object.freeze({
  M03: {
    Luke: [[1, "Arcanine-Hisui"], [2, "Ivysaur"]],
    Mattew: [[1, "Jolteon"], [2, "Monferno"]],
    Daniel: [[1, "Haunter"]],
    Edward: [[1, "Croconaw"]]
  },
  M04: {
    Daniel: [[2, "Machoke"]],
    Fab: [[1, "Weezing"], [3, "Electabuzz"]]
  },
  M05: {
    Luke: [[6, "Wartortle"]],
    Mattew: [[3, "Kirlia"]],
    Daniel: [[4, "Charmeleon"]],
    Edward: [[3, "Jolteon"]]
  },
  M06: {
    Luke: [[5, "Kilowattrel"]],
    Mattew: [[4, "Marshtomp"]],
    Daniel: [[5, "Lairon"]],
    Edward: [[4, "Houndoom"]],
    Fab: [[5, "Grovyle"]]
  },
  M07: {
    Luke: [[2, "Venusaur"]],
    Mattew: [[2, "Infernape"], [3, "Gardevoir"]],
    Daniel: [[1, "Gengar"]],
    Edward: [[1, "Feraligatr"]]
  },
  M08: {
    Luke: [[6, "Blastoise"]],
    Mattew: [[5, "Corvisquire"]],
    Daniel: [[2, "Machamp"], [4, "Charizard"], [6, "Poliwhirl"]],
    Edward: [[6, "Pupitar"]],
    Fab: [[3, "Electivire"], [6, "Kadabra"]]
  },
  M09: {
    Mattew: [[4, "Swampert"], [5, "Corviknight"]],
    Daniel: [[5, "Aggron"], [6, "Poliwrath"]],
    Edward: [[6, "Tyranitar"]],
    Fab: [[5, "Sceptile"], [6, "Alakazam"]]
  }
});

const MODULES = Object.keys(FRIEND_CAREER_MODULE_MILESTONES);
const ACQUISITION_ORDER = Object.fromEntries(
  ["Luke", "Mattew", "Daniel", "Edward", "Fab"].map(name => [
    name, [1, ...MODULES.flatMap(moduleId => {
      const slot = FRIEND_CAREER_MODULE_MILESTONES[moduleId].acquireSlots[name];
      return slot ? [slot] : [];
    })]
  ])
);

function applyScriptedEvolution(npc, slot, toSpecies, moduleId, eventPrefix) {
  const pokemon = npc.rosterCareer?.find(entry => entry.slot === slot);
  if (!pokemon?.acquired) return;
  if (pokemon.species === toSpecies) return;
  const targetIndex = pokemon.evolutionLine.indexOf(toSpecies);
  if (targetIndex <= pokemon.evolutionIndex) return;
  if (targetIndex !== pokemon.evolutionIndex + 1) {
    throw new Error(`NPC evolution skips a canonical stage: ${npc.id} ${toSpecies}`);
  }
  evolveCareerPokemon(npc, slot, {
    toSpecies, pokemonLevel: pokemon.pokemonLevel,
    requirementsSatisfied: true,
    storyEventId: `${eventPrefix}:${moduleId}:${npc.id}:S${slot}:EVOLVE:${toSpecies}`
  });
}

export function applyFriendCareerModuleMilestone(state, moduleId, { pokemonLevels = {}, eventPrefix = "NPC_CAREER" } = {}) {
  const milestone = FRIEND_CAREER_MODULE_MILESTONES[moduleId];
  if (!milestone) throw new Error("Unknown career module milestone: " + moduleId);
  state.events ??= {};
  state.events.npcCareerMilestones ??= {};

  // Reconcile existing saves even when an older scheduler already marked this
  // module as applied but skipped an acquisition due to missing pokemonLevels.
  for (const [name, npc] of Object.entries(state.npcs ?? {})) {
    if (!npc?.canonicalCareer) continue;
    const progressed = npc.trainer.trainerLevel < milestone.trainerLevel
      ? progressCanonicalFriendNpc(npc, milestone.trainerLevel) : npc;
    state.npcs[name] = progressed;
    const order = ACQUISITION_ORDER[name];
    if (!order) continue;
    const acquiredSlot = milestone.acquireSlots[name];
    if (acquiredSlot) {
      const chronologicalIndex = order.indexOf(acquiredSlot);
      const defaultLevel = FRIEND_POKEMON_LEVELS_BY_MODULE[moduleId][chronologicalIndex];
      const supplied = pokemonLevels[name]?.[acquiredSlot];
      const cap = POKEMON_LEVEL_CAPS_BY_MODULE[moduleId];
      const level = Number.isInteger(supplied) && supplied >= defaultLevel && supplied <= cap
        ? supplied : defaultLevel;
      acquireCareerPokemon(progressed, acquiredSlot, {
        pokemonLevel: level,
        storyEventId: `${eventPrefix}:${moduleId}:${name}:S${acquiredSlot}`
      });
    }

    // Existing Pokémon train even when this friend is never visited.
    for (let index = 0; index < order.length; index += 1) {
      const pokemon = progressed.rosterCareer?.find(entry => entry.slot === order[index]);
      if (!pokemon?.acquired) continue;
      const targetLevel = FRIEND_POKEMON_LEVELS_BY_MODULE[moduleId][index];
      if (Number.isInteger(targetLevel)) {
        pokemon.pokemonLevel = Math.max(pokemon.pokemonLevel ?? 1, targetLevel);
      }
    }
    for (const [slot, species] of FRIEND_EVOLUTIONS_BY_MODULE[moduleId]?.[name] ?? []) {
      applyScriptedEvolution(progressed, slot, species, moduleId, eventPrefix);
    }
  }
  state.events.npcCareerMilestones[moduleId] = { applied: true, moduleId };
  return state;
}

export function syncFriendCareerSchedule(state) {
  if (!state?.npcs || !state?.events) return state;
  const reachedModule = pokemonModuleForState(state);
  const end = MODULES.indexOf(reachedModule);
  for (let index = 0; index <= end; index += 1) {
    applyFriendCareerModuleMilestone(state, MODULES[index]);
  }
  return state;
}
