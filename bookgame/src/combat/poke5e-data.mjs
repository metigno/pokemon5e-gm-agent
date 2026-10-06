import { readFile } from "node:fs/promises";

const DATA_ROOT = new URL("../../data/poke5e/2024/", import.meta.url);
const FILES = {
  species: new URL("species.json", DATA_ROOT),
  moves: new URL("moves.json", DATA_ROOT),
  abilities: new URL("abilities.json", DATA_ROOT),
  items: new URL("items.json", DATA_ROOT),
  evolutions: new URL("evolutions.json", DATA_ROOT),
  conditions: new URL("conditions.json", DATA_ROOT),
  manifest: new URL("manifest.json", DATA_ROOT)
};

const LEVEL_MOVE_KEYS = ["start", "level2", "level6", "level10", "level14", "level18"];
let cached;

function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function loadJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

function recordById(values, label) {
  const result = Object.create(null);
  for (const value of values ?? []) {
    if (!value?.id) throw new Error(`Pokémon 5e ${label} entry is missing an id`);
    if (result[value.id]) throw new Error(`Duplicate Pokémon 5e ${label} id: ${value.id}`);
    result[value.id] = value;
  }
  return result;
}

function buildSpeciesAliases(species) {
  const aliases = Object.create(null);
  for (const entry of Object.values(species)) {
    aliases[slug(entry.id)] = entry.id;
    aliases[slug(entry.name)] = entry.id;
  }
  return aliases;
}

function conditionRecord(document) {
  return recordById(
    [...(document.nonVolatile ?? []), ...(document.volatile ?? [])],
    "condition"
  );
}

function evolutionValues(document) {
  if (Array.isArray(document?.values)) return document.values;
  if (Array.isArray(document?.items)) return document.items;
  if (Array.isArray(document)) return document;
  return Object.values(document ?? {}).filter((value) => value && typeof value === "object");
}

function validatePack(pack) {
  const missingMoves = new Set();
  const missingAbilities = new Set();

  for (const species of Object.values(pack.species)) {
    for (const ability of species.abilities ?? []) {
      if (!pack.abilities[ability.id]) missingAbilities.add(ability.id);
    }

    for (const [poolName, pool] of Object.entries(species.moves ?? {})) {
      if (!Array.isArray(pool)) continue;
      for (const moveId of pool) {
        // TM pools are numeric references to the TM catalog, not move ids.
        if (typeof moveId !== "string") continue;
        if (!pack.moves[moveId]) missingMoves.add(`${species.id}:${poolName}:${moveId}`);
      }
    }
  }

  if (missingMoves.size > 0) {
    throw new Error(
      `Incomplete Pokémon 5e offline move dataset: ${[...missingMoves].slice(0, 20).join(", ")}`
    );
  }
  if (missingAbilities.size > 0) {
    throw new Error(
      `Incomplete Pokémon 5e offline ability dataset: ${[...missingAbilities].slice(0, 20).join(", ")}`
    );
  }

  const expected = pack.manifest.counts ?? {};
  const actual = {
    species: Object.keys(pack.species).length,
    moves: Object.keys(pack.moves).length,
    abilities: Object.keys(pack.abilities).length,
    items: Object.keys(pack.items).length,
    evolutions: pack.evolutions.length,
    conditions: Object.keys(pack.conditions).length
  };

  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      throw new Error(
        `Pokémon 5e offline manifest mismatch for ${key}: expected ${value}, got ${actual[key]}`
      );
    }
  }

  return actual;
}

async function loadPack() {
  if (cached) return cached;

  const [
    speciesDocument,
    movesDocument,
    abilitiesDocument,
    itemsDocument,
    evolutionsDocument,
    conditionsDocument,
    manifest
  ] = await Promise.all([
    loadJson(FILES.species),
    loadJson(FILES.moves),
    loadJson(FILES.abilities),
    loadJson(FILES.items),
    loadJson(FILES.evolutions),
    loadJson(FILES.conditions),
    loadJson(FILES.manifest)
  ]);

  const species = recordById(speciesDocument.items, "species");
  const moves = recordById(movesDocument.values, "move");
  const abilities = recordById(abilitiesDocument.values, "ability");
  const items = recordById(itemsDocument.values, "item");
  const conditions = conditionRecord(conditionsDocument);
  const evolutions = evolutionValues(evolutionsDocument);

  const pack = {
    species,
    speciesAliases: buildSpeciesAliases(species),
    moves,
    abilities,
    items,
    conditions,
    evolutions,
    manifest,
    source: manifest.source
  };

  pack.counts = validatePack(pack);
  cached = pack;
  return cached;
}

function formCandidates(base, form) {
  const baseId = slug(base);
  const formId = slug(form);
  if (!formId || formId === "standard" || formId === "normal" || formId === "default") {
    return [baseId];
  }

  const aliases = new Set([
    `${formId}-${baseId}`,
    `${baseId}-${formId}`
  ]);

  const pairs = {
    hisuian: "hisui",
    hisui: "hisuian",
    alolan: "alola",
    alola: "alolan",
    galarian: "galar",
    galar: "galarian",
    paldean: "paldea",
    paldea: "paldean"
  };
  const alternate = pairs[formId];
  if (alternate) {
    aliases.add(`${alternate}-${baseId}`);
    aliases.add(`${baseId}-${alternate}`);
  }

  aliases.add(baseId);
  return [...aliases];
}

function speciesCandidates(descriptor) {
  if (typeof descriptor === "string") return [slug(descriptor)];
  if (!descriptor || typeof descriptor !== "object") return [];

  const candidates = [];
  if (descriptor.speciesId) candidates.push(slug(descriptor.speciesId));
  if (descriptor.id) candidates.push(slug(descriptor.id));
  if (descriptor.species) candidates.push(...formCandidates(descriptor.species, descriptor.form));
  if (descriptor.name) candidates.push(slug(descriptor.name));
  return [...new Set(candidates.filter(Boolean))];
}

function movePoolsForLevel(species, level) {
  const ids = [];
  for (const key of LEVEL_MOVE_KEYS) {
    const threshold = key === "start" ? species.minLevel : Number(key.replace("level", ""));
    if (key === "start" || level >= threshold) ids.push(...(species.moves?.[key] ?? []));
  }
  return [...new Set(ids)];
}

export class Poke5eDataRepository {
  async getSpecies(descriptor) {
    const pack = await loadPack();
    for (const candidate of speciesCandidates(descriptor)) {
      const id = pack.species[candidate] ? candidate : pack.speciesAliases[candidate];
      if (id && pack.species[id]) return structuredClone(pack.species[id]);
    }
    throw new Error(
      `Species not in complete offline Pokémon 5e pack: ${speciesCandidates(descriptor).join(" | ") || "<unknown>"}`
    );
  }

  async getMove(id) {
    const pack = await loadPack();
    const move = pack.moves[slug(id)];
    if (!move) throw new Error(`Move not in complete offline Pokémon 5e pack: ${id}`);
    return structuredClone(move);
  }

  async getAbility(id) {
    const pack = await loadPack();
    const ability = pack.abilities[slug(id)];
    if (!ability) throw new Error(`Ability not in complete offline Pokémon 5e pack: ${id}`);
    return structuredClone(ability);
  }

  async getItem(id) {
    const pack = await loadPack();
    const item = pack.items[slug(id)];
    if (!item) throw new Error(`Item not in complete offline Pokémon 5e pack: ${id}`);
    return structuredClone(item);
  }

  async getCondition(id) {
    const pack = await loadPack();
    const direct = pack.conditions[id] ?? pack.conditions[slug(id)];
    if (direct) return structuredClone(direct);

    const wanted = slug(id);
    const match = Object.values(pack.conditions).find(
      (entry) => slug(entry.id) === wanted || slug(entry.name) === wanted
    );
    if (!match) throw new Error(`Condition not in complete offline Pokémon 5e pack: ${id}`);
    return structuredClone(match);
  }

  async getSupportedMoves(species, level) {
    const pack = await loadPack();
    const ids = movePoolsForLevel(species, level);
    return ids.map((id) => {
      const move = pack.moves[id];
      if (!move) {
        throw new Error(`Species ${species.id} references missing offline move: ${id}`);
      }
      return structuredClone(move);
    });
  }

  async getLevelMoveIds(species, level) {
    return movePoolsForLevel(species, level);
  }

  async listSpecies() {
    const pack = await loadPack();
    return Object.values(pack.species).map((entry) => structuredClone(entry));
  }

  async listMoves() {
    const pack = await loadPack();
    return Object.values(pack.moves).map((entry) => structuredClone(entry));
  }

  async listAbilities() {
    const pack = await loadPack();
    return Object.values(pack.abilities).map((entry) => structuredClone(entry));
  }

  async listItems() {
    const pack = await loadPack();
    return Object.values(pack.items).map((entry) => structuredClone(entry));
  }

  async listConditions() {
    const pack = await loadPack();
    return Object.values(pack.conditions).map((entry) => structuredClone(entry));
  }

  async listEvolutions() {
    const pack = await loadPack();
    return structuredClone(pack.evolutions);
  }

  async metadata() {
    const pack = await loadPack();
    return structuredClone({
      ...pack.manifest,
      counts: pack.counts
    });
  }
}
