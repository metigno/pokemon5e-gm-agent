import { Poke5eDataRepository } from "../combat/poke5e-data.mjs";
import { abilityModifier, hitDieAverage, scaledHp } from "../combat/poke5e-rules.mjs";
import { EXPERIENCE_NEEDED_PER_LEVEL, experienceNeededAtLevel } from "./state.mjs";

const CONDITION_TYPES = new Set([
  "level", "item", "loyalty", "move", "move-type", "gender", "time", "special"
]);

const POKEMON_ASI_LEVELS = new Set([4, 8, 12, 16, 20]);
const AMPED_NATURES = new Set([
  "hardy", "brave", "adamant", "naughty", "docile", "impish", "lax",
  "hasty", "jolly", "naive", "rash", "sassy", "quirky"
]);

const CANONICAL_SPECIAL_CONDITIONS = new Set([
  "after using Rage Fist 10 times",
  "while in a region with significant anthropogenic pollution",
  "under a full moon",
  "if its STR is higher than its DEX",
  "if its DEX is higher than its STR",
  "if its STR is equal to its DEX",
  "when its trainer has an empty pokeball when Nincada evolves into Ninjask",
  "in a tall grass/forest",
  "in a tall cave/desert/mountain",
  "in a city or building",
  "in a region of typically cool climate",
  "when Remoraid is also in the party",
  "after fainting from recoil damage",
  "after fainting to damage taken from a melee attack",
  "while in the presence of a Shelmet",
  "while in the presence of a Karrablast",
  "after defeating an evolution of Pawniard that's holding a Leader's Crest one-on-one, while itself holding a Leader's Crest",
  "its trainer has another dark-type Pokemon in their party",
  "while raining",
  "after enduring a single battle where it lands three critical hits",
  "inhabiting a green or gold apple",
  "inhabiting a red apple",
  "inhabiting a syrup-covered apple",
  "its nature is Hardy, Brave, Adamant, Naughty, Docile, Impish, Lax, Hasty, Jolly, Naive, Rash, Sassy, or Quirky",
  "its nature is NOT Hardy, Brave, Adamant, Naughty, Docile, Impish, Lax, Hasty, Jolly, Naive, Rash, Sassy, or Quirky",
  "OR earlier than level 10 if given ₽9,999 to consume"
]);

function clone(value) {
  return structuredClone(value);
}

function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function pokemonSpeciesDescriptor(pokemon) {
  if (pokemon?.speciesId) return pokemon.speciesId;
  if (pokemon?.pokemonId) return pokemon.pokemonId;
  if (pokemon?.species) return { species: pokemon.species, form: pokemon.form };
  if (pokemon?.name) return pokemon.name;
  throw new Error("Pokémon state has no species identifier");
}

function itemId(entry) {
  return slug(entry?.itemId ?? entry?.id ?? entry?.name);
}

function inventoryQuantity(entry) {
  return Number.isFinite(entry?.quantity) ? entry.quantity : 1;
}

function hasInventoryItem(inventory, wanted) {
  const target = slug(wanted);
  return (inventory ?? []).some((entry) => itemId(entry) === target && inventoryQuantity(entry) > 0);
}

function consumeInventoryItem(inventory, wanted) {
  const target = slug(wanted);
  const next = clone(inventory ?? []);
  const index = next.findIndex((entry) => itemId(entry) === target && inventoryQuantity(entry) > 0);
  if (index < 0) throw new Error(`Missing required evolution item: ${wanted}`);
  const quantity = inventoryQuantity(next[index]);
  if (quantity <= 1) next.splice(index, 1);
  else next[index] = { ...next[index], quantity: quantity - 1 };
  return next;
}

function daypartMatches(required, actual) {
  const value = String(actual ?? "").toLowerCase();
  if (required === "day") return ["morning", "afternoon", "day"].includes(value);
  if (required === "night") return ["night"].includes(value);
  return value === required;
}

function typesForSpecies(species) {
  return Array.isArray(species?.type) ? species.type.map((value) => String(value).toLowerCase()) : [];
}

async function partyHasSpecies(context, data, wantedId) {
  for (const pokemon of context.party ?? []) {
    try {
      const species = await data.getSpecies(pokemonSpeciesDescriptor(pokemon));
      if (species.id === wantedId) return true;
    } catch {
      // An invalid party descriptor is not silently accepted as satisfying a prerequisite.
    }
  }
  return false;
}

async function partyHasType(context, data, wantedType, excluding = null) {
  for (const pokemon of context.party ?? []) {
    if (pokemon === excluding) continue;
    try {
      const species = await data.getSpecies(pokemonSpeciesDescriptor(pokemon));
      if (typesForSpecies(species).includes(wantedType)) return true;
    } catch {
      // See partyHasSpecies: malformed entries simply cannot satisfy the rule.
    }
  }
  return false;
}

function environmentHas(context, tag) {
  return new Set((context.environmentTags ?? []).map(slug)).has(slug(tag));
}

function hasEmptyPokeball(context) {
  if (context.hasEmptyPokeball === true) return true;
  return (context.inventory ?? []).some((entry) => {
    const id = itemId(entry);
    return id.endsWith("-ball") && inventoryQuantity(entry) > 0;
  });
}

function knownMoveIds(pokemon) {
  return Array.isArray(pokemon.moveIds)
    ? pokemon.moveIds
    : Array.isArray(pokemon.moves)
      ? pokemon.moves.map((move) => typeof move === "string" ? move : (move.moveId ?? move.id)).filter(Boolean)
      : [];
}

async function knowsMoveType(pokemon, requiredType, data) {
  for (const id of knownMoveIds(pokemon)) {
    const move = await data.getMove(id);
    if (String(move.type).toLowerCase() === String(requiredType).toLowerCase()) return true;
  }
  return false;
}

function score(pokemon, species, key) {
  const attrs = pokemon.attributes ?? species.attributes ?? {};
  return Number(attrs[key.toLowerCase()] ?? attrs[key.toUpperCase()] ?? 10);
}

async function specialConditionSatisfied(evolution, pokemon, fromSpecies, context, data, text) {
  if (!CANONICAL_SPECIAL_CONDITIONS.has(text)) {
    throw new Error(`Unclassified canonical evolution special condition: ${evolution.id}: ${text}`);
  }

  switch (text) {
    case "after using Rage Fist 10 times":
      return Number(context.moveUseCounts?.["rage-fist"] ?? pokemon.moveUseCounts?.["rage-fist"] ?? 0) >= 10;
    case "while in a region with significant anthropogenic pollution":
      return environmentHas(context, "anthropogenic-pollution");
    case "under a full moon":
      return String(context.moonPhase ?? "").toLowerCase() === "full";
    case "if its STR is higher than its DEX":
      return score(pokemon, fromSpecies, "str") > score(pokemon, fromSpecies, "dex");
    case "if its DEX is higher than its STR":
      return score(pokemon, fromSpecies, "dex") > score(pokemon, fromSpecies, "str");
    case "if its STR is equal to its DEX":
      return score(pokemon, fromSpecies, "str") === score(pokemon, fromSpecies, "dex");
    case "when its trainer has an empty pokeball when Nincada evolves into Ninjask":
      return hasEmptyPokeball(context) && String(context.primaryEvolutionTo ?? "") === "ninjask";
    case "in a tall grass/forest":
      return environmentHas(context, "tall-grass") || environmentHas(context, "forest");
    case "in a tall cave/desert/mountain":
      return environmentHas(context, "cave") || environmentHas(context, "desert") || environmentHas(context, "mountain");
    case "in a city or building":
      return environmentHas(context, "city") || environmentHas(context, "building");
    case "in a region of typically cool climate":
      return environmentHas(context, "cool-climate");
    case "when Remoraid is also in the party":
      return partyHasSpecies(context, data, "remoraid");
    case "after fainting from recoil damage":
      return String(context.lastFaintReason ?? pokemon.lastFaintReason ?? "") === "recoil";
    case "after fainting to damage taken from a melee attack":
      return String(context.lastFaintReason ?? pokemon.lastFaintReason ?? "") === "melee-attack";
    case "while in the presence of a Shelmet":
      return partyHasSpecies(context, data, "shelmet");
    case "while in the presence of a Karrablast":
      return partyHasSpecies(context, data, "karrablast");
    case "after defeating an evolution of Pawniard that's holding a Leader's Crest one-on-one, while itself holding a Leader's Crest":
      return Boolean(context.defeatedLeaderCrestPawniardEvolutionOneOnOne) &&
        slug(pokemon.heldItemId ?? pokemon.heldItem?.id) === "leaders-crest";
    case "its trainer has another dark-type Pokemon in their party":
      return partyHasType(context, data, "dark", pokemon);
    case "while raining":
      return ["rain", "raining", "rainy"].includes(String(context.weather ?? "").toLowerCase());
    case "after enduring a single battle where it lands three critical hits":
      return Number(context.criticalHitsThisBattle ?? pokemon.criticalHitsThisBattle ?? 0) >= 3;
    case "inhabiting a green or gold apple":
      return ["green", "gold"].includes(String(context.appleColor ?? "").toLowerCase());
    case "inhabiting a red apple":
      return String(context.appleColor ?? "").toLowerCase() === "red";
    case "inhabiting a syrup-covered apple":
      return Boolean(context.syrupCoveredApple);
    case "its nature is Hardy, Brave, Adamant, Naughty, Docile, Impish, Lax, Hasty, Jolly, Naive, Rash, Sassy, or Quirky":
      return AMPED_NATURES.has(String(pokemon.nature ?? "").toLowerCase());
    case "its nature is NOT Hardy, Brave, Adamant, Naughty, Docile, Impish, Lax, Hasty, Jolly, Naive, Rash, Sassy, or Quirky":
      return !AMPED_NATURES.has(String(pokemon.nature ?? "").toLowerCase());
    case "OR earlier than level 10 if given ₽9,999 to consume":
      return pokemon.level >= 10 || Number(context.money ?? 0) >= 9999;
    default:
      return false;
  }
}

export function classifyEvolution(evolution) {
  if (evolution.nonCanon) {
    return {
      id: evolution.id,
      classification: "non-canon-excluded",
      conditionTypes: (evolution.conditions ?? []).map((condition) => condition.type)
    };
  }

  for (const condition of evolution.conditions ?? []) {
    if (!CONDITION_TYPES.has(condition.type)) {
      throw new Error(`Unknown evolution condition type: ${condition.type}`);
    }
    if (condition.type === "special" && !CANONICAL_SPECIAL_CONDITIONS.has(condition.value)) {
      throw new Error(`Unclassified canonical evolution special condition: ${evolution.id}: ${condition.value}`);
    }
  }

  return {
    id: evolution.id,
    classification: "runtime",
    conditionTypes: (evolution.conditions ?? []).map((condition) => condition.type)
  };
}

export function auditEvolutionCoverage(evolutions) {
  const classifications = evolutions.map(classifyEvolution);
  return {
    total: classifications.length,
    runtime: classifications.filter((entry) => entry.classification === "runtime").length,
    nonCanonExcluded: classifications.filter((entry) => entry.classification === "non-canon-excluded").length,
    unclassified: 0,
    classifications
  };
}

export async function evolutionIsEligible(
  evolution,
  pokemon,
  context = {},
  data = new Poke5eDataRepository()
) {
  const classification = classifyEvolution(evolution);
  if (classification.classification !== "runtime") return false;

  const fromSpecies = await data.getSpecies(pokemonSpeciesDescriptor(pokemon));
  if (fromSpecies.id !== evolution.from) return false;

  const earlyGimmighoul =
    (evolution.conditions ?? []).some(
      (condition) =>
        condition.type === "special" &&
        condition.value === "OR earlier than level 10 if given ₽9,999 to consume"
    ) &&
    Number(context.money ?? 0) >= 9999;

  for (const condition of evolution.conditions ?? []) {
    switch (condition.type) {
      case "level":
        if (!earlyGimmighoul && Number(pokemon.level ?? 0) < Number(condition.value)) return false;
        break;
      case "item": {
        const directItems = new Set((context.evolutionItems ?? []).map(slug));
        if (!directItems.has(slug(condition.value)) && !hasInventoryItem(context.inventory, condition.value)) {
          return false;
        }
        break;
      }
      case "loyalty":
        if (Number(pokemon.bond?.level ?? pokemon.loyalty ?? 0) < Number(condition.value)) return false;
        break;
      case "move":
        if (!knownMoveIds(pokemon).includes(condition.value)) return false;
        break;
      case "move-type":
        if (!(await knowsMoveType(pokemon, condition.value, data))) return false;
        break;
      case "gender":
        if (String(pokemon.gender ?? "").toLowerCase() !== String(condition.value).toLowerCase()) return false;
        break;
      case "time":
        if (!daypartMatches(condition.value, context.timeOfDay ?? context.daypart ?? context.world?.time)) return false;
        break;
      case "special":
        if (!(await specialConditionSatisfied(evolution, pokemon, fromSpecies, context, data, condition.value))) {
          return false;
        }
        break;
      default:
        throw new Error(`Unknown evolution condition type: ${condition.type}`);
    }
  }

  return true;
}

export async function availableEvolutions(
  pokemon,
  context = {},
  data = new Poke5eDataRepository()
) {
  const species = await data.getSpecies(pokemonSpeciesDescriptor(pokemon));
  const evolutions = await data.listEvolutions();
  const candidates = evolutions.filter((evolution) => !evolution.nonCanon && evolution.from === species.id);
  const result = [];
  for (const evolution of candidates) {
    if (await evolutionIsEligible(evolution, pokemon, context, data)) result.push(clone(evolution));
  }
  return result;
}

function normalizeAsiDistribution(distribution = {}) {
  const result = {};
  for (const [key, value] of Object.entries(distribution)) {
    const id = String(key).toLowerCase();
    if (!["str", "dex", "con", "int", "wis", "cha"].includes(id)) {
      throw new Error(`Unknown ability score in ASI: ${key}`);
    }
    const amount = Number(value);
    if (!Number.isInteger(amount) || amount < 0) throw new Error(`Invalid ASI amount for ${key}`);
    result[id] = (result[id] ?? 0) + amount;
  }
  return result;
}

function applyAsi(
  attributes,
  distribution,
  points,
  { maxPerStat = Infinity, maxScore = 20, label = "ASI" } = {}
) {
  const delta = normalizeAsiDistribution(distribution);
  const spent = Object.values(delta).reduce((sum, value) => sum + value, 0);
  if (spent !== points) throw new Error(`${label} requires exactly ${points} points; received ${spent}`);
  const next = clone(attributes);
  for (const [key, amount] of Object.entries(delta)) {
    if (amount > maxPerStat) {
      throw new Error(`${label} cannot allocate more than ${maxPerStat} points to one ability score`);
    }
    const existingKey = Object.hasOwn(next, key) ? key : key.toUpperCase();
    const current = Number(next[existingKey] ?? 10);
    if (current + amount > maxScore) {
      throw new Error(`${label} cannot increase ${key.toUpperCase()} above ${maxScore}`);
    }
    next[existingKey] = current + amount;
  }
  return next;
}

function maximumEvolutionStages(speciesId, evolutions) {
  const canonical = (evolutions ?? []).filter((evolution) => !evolution.nonCanon);
  const forward = new Map();
  const backward = new Map();
  for (const evolution of canonical) {
    if (!forward.has(evolution.from)) forward.set(evolution.from, new Set());
    if (!backward.has(evolution.to)) backward.set(evolution.to, new Set());
    forward.get(evolution.from).add(evolution.to);
    backward.get(evolution.to).add(evolution.from);
  }
  if (!forward.has(speciesId) && !backward.has(speciesId)) return 1;

  const depth = (graph, id, seen = new Set()) => {
    if (seen.has(id)) throw new Error(`Evolution graph contains a cycle at ${id}`);
    const next = [...(graph.get(id) ?? [])];
    if (next.length === 0) return 0;
    const visited = new Set(seen);
    visited.add(id);
    return 1 + Math.max(...next.map((candidate) => depth(graph, candidate, visited)));
  };

  return 1 + depth(backward, speciesId) + depth(forward, speciesId);
}

export function pokemonLevelAsiPoints(speciesId, evolutions) {
  const stages = maximumEvolutionStages(speciesId, evolutions);
  if (stages === 1) return 4;
  if (stages === 2) return 3;
  if (stages === 3) return 2;
  throw new Error(`Unsupported canonical evolution stage count for ${speciesId}: ${stages}`);
}

function mappedEvolutionAbility(pokemon, fromSpecies, toSpecies) {
  const current = pokemon.abilityId ?? pokemon.ability?.id ?? null;
  if (!current) return toSpecies.abilities.find((entry) => !entry.hidden)?.id ?? toSpecies.abilities[0]?.id ?? null;

  const fromNormal = fromSpecies.abilities.filter((entry) => !entry.hidden);
  const fromHidden = fromSpecies.abilities.filter((entry) => entry.hidden);
  const toNormal = toSpecies.abilities.filter((entry) => !entry.hidden);
  const toHidden = toSpecies.abilities.filter((entry) => entry.hidden);
  const normalIndex = fromNormal.findIndex((entry) => entry.id === current);
  const hiddenIndex = fromHidden.findIndex((entry) => entry.id === current);

  if (normalIndex >= 0 && toNormal.length > 0) {
    return toNormal[Math.min(toNormal.length - 1, normalIndex)].id;
  }
  if (hiddenIndex >= 0) {
    if (toHidden.length > 0) return toHidden[Math.min(toHidden.length - 1, hiddenIndex)].id;
    if (toNormal.length > 0) return toNormal.at(-1).id;
  }
  if (toSpecies.abilities.some((entry) => entry.id === current)) return current;
  return toNormal[0]?.id ?? toSpecies.abilities[0]?.id ?? null;
}

function updateTypeOnEvolution(pokemon, fromSpecies, toSpecies) {
  const current = pokemon.types ?? pokemon.type;
  if (!Array.isArray(current)) return clone(toSpecies.type);
  const base = fromSpecies.type ?? [];
  const customized = JSON.stringify(current) !== JSON.stringify(base);
  return customized ? clone(current) : clone(toSpecies.type);
}

export async function evolvePokemon(
  pokemon,
  evolution,
  {
    context = {},
    asiDistribution = null,
    data = new Poke5eDataRepository()
  } = {}
) {
  if (!(await evolutionIsEligible(evolution, pokemon, context, data))) {
    throw new Error(`Evolution prerequisites are not satisfied: ${evolution.id}`);
  }

  const fromSpecies = await data.getSpecies(pokemonSpeciesDescriptor(pokemon));
  const toSpecies = await data.getSpecies(evolution.to);
  const asiPoints = Number((evolution.effects ?? []).find((effect) => effect.type === "asi")?.value ?? 0);

  if (asiPoints > 0 && !asiDistribution) {
    return {
      status: "choice_required",
      choice: {
        type: "evolution_asi",
        points: asiPoints,
        evolutionId: evolution.id,
        from: evolution.from,
        to: evolution.to
      },
      pokemon: clone(pokemon)
    };
  }

  if (evolution.id === "nincada-to-shedinja") {
    const base = await initializePokemonRuntime({
      speciesId: toSpecies.id,
      level: pokemon.level,
      gender: pokemon.gender,
      nature: pokemon.nature,
      bond: clone(pokemon.bond ?? { level: 0, points: { current: 0, max: 0 } })
    }, data);
    return {
      status: "evolved",
      mode: "additional",
      pokemon: clone(pokemon),
      additionalPokemon: base,
      consumedInventory: hasEmptyPokeball(context)
        ? consumeInventoryItem(context.inventory, (context.inventory ?? []).find((entry) => itemId(entry).endsWith("-ball"))?.itemId ?? "poke-ball")
        : clone(context.inventory ?? [])
    };
  }

  const next = clone(pokemon);
  const oldAttributes = clone(next.attributes ?? fromSpecies.attributes);
  next.attributes = asiPoints > 0
    ? applyAsi(oldAttributes, asiDistribution, asiPoints, {
        maxPerStat: 4,
        maxScore: 20,
        label: "Evolution ASI"
      })
    : oldAttributes;

  const oldConMod = abilityModifier(oldAttributes.con ?? oldAttributes.CON ?? 10);
  const newConMod = abilityModifier(next.attributes.con ?? next.attributes.CON ?? 10);
  const hpBefore = clone(next.hp ?? { current: scaledHp(fromSpecies, next.level), max: scaledHp(fromSpecies, next.level) });
  const evolutionHp = Number(next.level) * 2;
  const conHp = Math.max(0, newConMod - oldConMod) * Number(next.level);
  next.hp = {
    current: hpBefore.max + evolutionHp + conHp,
    max: hpBefore.max + evolutionHp + conHp
  };

  if (Number.isFinite(next.ac)) next.ac += Number(toSpecies.ac ?? 0) - Number(fromSpecies.ac ?? 0);
  else next.ac = toSpecies.ac;

  next.speciesId = toSpecies.id;
  if (Object.hasOwn(next, "pokemonId")) next.pokemonId = toSpecies.id;
  if (next.species && String(next.species).toLowerCase() === String(fromSpecies.name).toLowerCase()) {
    next.species = toSpecies.name;
    next.form = "Standard";
  }
  if (next.name === fromSpecies.name) next.name = toSpecies.name;
  if (next.nickname === fromSpecies.name) next.nickname = toSpecies.name;

  const evolvedTypes = updateTypeOnEvolution(pokemon, fromSpecies, toSpecies);
  if (Object.hasOwn(next, "types")) next.types = evolvedTypes;
  if (Object.hasOwn(next, "type")) next.type = evolvedTypes;

  next.abilityId = mappedEvolutionAbility(pokemon, fromSpecies, toSpecies);
  next.savingThrows = [...new Set([...(next.savingThrows ?? fromSpecies.savingThrows ?? []), ...(toSpecies.savingThrows ?? [])])];

  if (Array.isArray(next.proficiencies) && Array.isArray(toSpecies.skills)) {
    next.proficiencies = [...new Set([...next.proficiencies, ...toSpecies.skills])];
  }

  next.evolutionHistory = [
    ...(next.evolutionHistory ?? []),
    {
      evolutionId: evolution.id,
      from: fromSpecies.id,
      to: toSpecies.id,
      level: next.level
    }
  ];

  let inventory = clone(context.inventory ?? []);
  for (const condition of evolution.conditions ?? []) {
    if (condition.type === "item") inventory = consumeInventoryItem(inventory, condition.value);
  }

  let money = Number(context.money ?? 0);
  const earlyCoinEvolution =
    next.level < 10 &&
    (evolution.conditions ?? []).some(
      (condition) => condition.type === "special" &&
        condition.value === "OR earlier than level 10 if given ₽9,999 to consume"
    );
  if (earlyCoinEvolution) {
    if (money < 9999) throw new Error("Gimmighoul early evolution requires ₽9,999");
    money -= 9999;
  }

  return {
    status: "evolved",
    mode: "replace",
    pokemon: next,
    inventory,
    money
  };
}

export async function initializePokemonRuntime(
  pokemon,
  data = new Poke5eDataRepository()
) {
  const species = await data.getSpecies(pokemonSpeciesDescriptor(pokemon));
  const level = Number(pokemon.level ?? species.minLevel);
  const next = clone(pokemon);
  next.speciesId = species.id;
  next.level = level;
  next.xp = Number.isFinite(next.xp) ? next.xp : experienceNeededAtLevel(level);
  next.attributes = clone(next.attributes ?? species.attributes);
  next.ac = Number.isFinite(next.ac) ? next.ac : species.ac;
  next.savingThrows = clone(next.savingThrows ?? species.savingThrows ?? []);
  next.hp ??= { current: scaledHp(species, level), max: scaledHp(species, level) };
  next.hp.max = Math.max(1, Number(next.hp.max));
  next.hp.current = Math.max(0, Math.min(Number(next.hp.current), next.hp.max));
  next.abilityId ??= species.abilities.find((ability) => !ability.hidden)?.id ?? species.abilities[0]?.id ?? null;
  next.bond ??= { level: 0, points: { current: 0, max: 0 } };
  next.pendingMoveLearning = Array.isArray(next.pendingMoveLearning) ? next.pendingMoveLearning : [];
  next.pendingMoveChoices = Array.isArray(next.pendingMoveChoices) ? next.pendingMoveChoices : [];
  next.pendingAsiChoices = Array.isArray(next.pendingAsiChoices) ? next.pendingAsiChoices : [];

  if (Array.isArray(next.moveIds) && next.moveIds.length > 4) {
    throw new Error(`${species.name} has more than four learned moves`);
  }
  return next;
}

export async function awardPokemonXp(
  pokemon,
  amount,
  {
    data = new Poke5eDataRepository(),
    hpRolls = {}
  } = {}
) {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError("Pokémon XP award must be non-negative");
  let next = await initializePokemonRuntime(pokemon, data);
  const species = await data.getSpecies(next.speciesId);
  const evolutions = await data.listEvolutions();
  const asiPoints = pokemonLevelAsiPoints(species.id, evolutions);
  next.xp += amount;
  const levelUps = [];

  while (next.level < 20 && next.xp >= EXPERIENCE_NEEDED_PER_LEVEL[next.level]) {
    const previousLevel = next.level;
    const previousMoves = new Set(await data.getLevelMoveIds(species, previousLevel));
    const newLevel = previousLevel + 1;
    const conMod = abilityModifier(next.attributes.con ?? next.attributes.CON ?? species.attributes.con);
    const defaultHitDie = hitDieAverage(species.hitDice);
    const rawHitDie = Number.isFinite(hpRolls[newLevel]) ? Number(hpRolls[newLevel]) : defaultHitDie;
    const hpIncrease = Math.max(1, rawHitDie + conMod);

    next.level = newLevel;
    next.hp.max += hpIncrease;
    next.hp.current += hpIncrease;

    const availableMoves = await data.getLevelMoveIds(species, newLevel);
    const newlyAvailable = availableMoves.filter((id) => !previousMoves.has(id));
    for (const moveId of newlyAvailable) {
      if (!next.pendingMoveLearning.some((entry) => entry.moveId === moveId)) {
        next.pendingMoveLearning.push({ moveId, level: newLevel });
      }
    }
    next.pendingMoveChoices.push({
      level: newLevel,
      availableMoveIds: clone(availableMoves),
      maxReplacements: 1
    });

    if (POKEMON_ASI_LEVELS.has(newLevel)) {
      next.pendingAsiChoices.push({
        level: newLevel,
        points: asiPoints,
        maxScore: newLevel === 20 ? (Number(species.sr ?? 0) >= 15 ? 30 : 22) : 20,
        kind: newLevel === 20 ? "peak-power" : "asi-or-feat"
      });
    }

    levelUps.push({
      from: previousLevel,
      to: newLevel,
      hpIncrease,
      newlyAvailableMoves: newlyAvailable,
      moveReplacementChoice: true,
      asiPoints: POKEMON_ASI_LEVELS.has(newLevel) ? asiPoints : 0,
      asiChoice: POKEMON_ASI_LEVELS.has(newLevel)
    });
  }

  return { pokemon: next, levelUps };
}

export function learnPokemonMove(pokemon, moveId, { forgetMoveId = null } = {}) {
  const next = clone(pokemon);
  next.moveIds ??= [];
  if (next.moveIds.includes(moveId)) {
    next.pendingMoveLearning = (next.pendingMoveLearning ?? []).filter((entry) => entry.moveId !== moveId);
    return next;
  }

  if (next.moveIds.length < 4) {
    next.moveIds.push(moveId);
  } else {
    if (!forgetMoveId || !next.moveIds.includes(forgetMoveId)) {
      throw new Error(`Learning ${moveId} requires choosing one of the four known moves to forget`);
    }
    next.moveIds[next.moveIds.indexOf(forgetMoveId)] = moveId;
    if (next.pp && Object.hasOwn(next.pp, forgetMoveId)) delete next.pp[forgetMoveId];
  }

  next.pendingMoveLearning = (next.pendingMoveLearning ?? []).filter((entry) => entry.moveId !== moveId);
  return next;
}

export function resolvePokemonMoveReplacement(pokemon, level, moveId, { forgetMoveId = null } = {}) {
  const pending = (pokemon.pendingMoveChoices ?? []).find((choice) => choice.level === level);
  if (!pending) throw new Error(`No pending move-replacement choice for level ${level}`);
  if (!pending.availableMoveIds.includes(moveId)) {
    throw new Error(`${moveId} is not learnable by this Pokémon at level ${level}`);
  }
  const next = learnPokemonMove(pokemon, moveId, { forgetMoveId });
  next.pendingMoveChoices = (next.pendingMoveChoices ?? []).filter((choice) => choice.level !== level);
  return next;
}

export function applyPokemonAsiChoice(pokemon, level, distribution) {
  const next = clone(pokemon);
  const pendingIndex = (next.pendingAsiChoices ?? []).findIndex((choice) => choice.level === level);
  if (pendingIndex < 0) throw new Error(`No pending Pokémon ASI choice for level ${level}`);
  const choice = next.pendingAsiChoices[pendingIndex];
  const before = clone(next.attributes);
  const beforeCon = abilityModifier(before.con ?? before.CON ?? 10);
  next.attributes = applyAsi(before, distribution, choice.points, {
    maxScore: choice.maxScore ?? 20,
    label: choice.kind === "peak-power" ? "Peak Power ASI" : "Level ASI"
  });
  const afterCon = abilityModifier(next.attributes.con ?? next.attributes.CON ?? 10);
  if (afterCon > beforeCon) {
    const increase = (afterCon - beforeCon) * Number(next.level);
    next.hp.max += increase;
    next.hp.current += increase;
  }
  next.pendingAsiChoices.splice(pendingIndex, 1);
  return next;
}
