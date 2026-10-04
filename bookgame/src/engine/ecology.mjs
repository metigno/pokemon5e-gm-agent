const ORDINARY_CLASSES = new Set([
  "established_wild",
  "protected_starter_population",
  "regional_micro_population",
  "scarce_breeding_population"
]);

const SPECIAL_CLASSES = new Set([
  "legendary",
  "legendary_paradox_future",
  "legendary_paradox_past",
  "mythical",
  "paleo_restricted",
  "paradox_future",
  "paradox_past",
  "ultra_beast",
  "unique_special"
]);

export function ecologyActivityPhases(minuteOfDay) {
  if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay >= 1440) {
    throw new RangeError("minuteOfDay must be an integer from 0 to 1439");
  }
  if (minuteOfDay >= 300 && minuteOfDay < 480) return ["dawn", "day"];
  if (minuteOfDay >= 480 && minuteOfDay < 1020) return ["day"];
  if (minuteOfDay >= 1020 && minuteOfDay < 1140) return ["dusk", "evening"];
  if (minuteOfDay >= 1140 && minuteOfDay < 1320) return ["evening", "night"];
  return ["night"];
}

function intersects(a = [], b = []) {
  const set = new Set(b);
  return a.some((value) => set.has(value));
}

function normalizeSpeciesFilter(values, label) {
  if (values === undefined) return null;
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || value.length === 0)) {
    throw new TypeError(label + " must be an array of species IDs");
  }
  return new Set(values);
}

export function ordinaryEncounterCandidates(state, catalog, {
  zoneId,
  habitat = null,
  method = null,
  allowedSpecies,
  excludedSpecies
} = {}) {
  if (!catalog || catalog.format !== "p5e-librogame-ecology") {
    throw new Error("Invalid compiled ecology catalog");
  }
  const zone = catalog.zones?.[zoneId];
  if (!zone) throw new Error("Unknown ecology zone: " + String(zoneId));

  const phases = ecologyActivityPhases(state.world.minuteOfDay);
  const allow = normalizeSpeciesFilter(allowedSpecies, "allowedSpecies");
  const exclude = normalizeSpeciesFilter(excludedSpecies, "excludedSpecies");

  return zone.species.filter((species) => {
    if (!ORDINARY_CLASSES.has(species.distributionClass)) return false;
    if (SPECIAL_CLASSES.has(species.distributionClass)) return false;
    if (!intersects(species.activity, phases)) return false;
    if (habitat !== null && !species.habitats.includes(habitat)) return false;
    if (method !== null && !species.encounterMethods.includes(method)) return false;
    if (allow && !allow.has(species.id)) return false;
    if (exclude && exclude.has(species.id)) return false;
    return true;
  });
}

export function selectOrdinaryEncounter(state, catalog, request, dice) {
  if (!dice || typeof dice.roll !== "function") throw new TypeError("dice.roll is required");
  const candidates = ordinaryEncounterCandidates(state, catalog, request);
  if (candidates.length === 0) return null;

  const totalWeight = candidates.reduce((sum, species) => sum + species.weight, 0);
  if (!Number.isInteger(totalWeight) || totalWeight < 1) {
    throw new Error("Ecology candidate weights are invalid");
  }

  let ticket = dice.roll(totalWeight);
  for (const species of candidates) {
    ticket -= species.weight;
    if (ticket <= 0) {
      return {
        requestId: request.requestId ?? null,
        zoneId: request.zoneId,
        sourceZoneId: catalog.zones[request.zoneId].sourceZoneId,
        habitat: request.habitat ?? null,
        method: request.method ?? null,
        speciesId: species.id,
        rarity: species.rarity,
        distributionClass: species.distributionClass,
        activity: structuredClone(species.activity),
        habitats: structuredClone(species.habitats),
        protectedPopulation: species.distributionClass === "protected_starter_population",
        capturable: true,
        alphaBetaRole: null
      };
    }
  }
  throw new Error("Weighted ecology selection failed");
}

export function recordWildEncounter(state, encounter) {
  state.ecology ??= { history: [], lastEncounter: null };
  state.ecology.lastEncounter = structuredClone(encounter);
  state.ecology.history.push({
    ...structuredClone(encounter),
    day: state.world.day,
    elapsedMinutes: state.world.elapsedMinutes
  });
  return state.ecology.lastEncounter;
}

export const ECOLOGY_ORDINARY_CLASSES = ORDINARY_CLASSES;
export const ECOLOGY_SPECIAL_CLASSES = SPECIAL_CLASSES;
