const ABILITY_DOMAIN_PATTERNS = Object.freeze([
  ["form_change", (entry, text) => /^form-change-/.test(entry.id) || /changes? form|switches? to .* mode|takes on .* form/i.test(text)],
  ["fifth_move", (_entry, text) => /knows .+ as a fifth move/i.test(text)],
  ["weather_environment", (_entry, text) => /weather|sunlight|rain|snow|sandstorm|hail|strong winds|terrain/i.test(text)],
  ["type_rules", (_entry, text) => /\btype\b|vulnerab|resistan|immun|super effective|not very effective|STAB/i.test(text)],
  ["damage_rules", (_entry, text) => /damage|critical hit|damage dice|temporary hp|maximum HP|max HP|health|heal|restor/i.test(text)],
  ["attack_accuracy", (_entry, text) => /attack roll|attacks? (?:made|are rolled)|advantage.*attack|disadvantage.*attack|attacks? with advantage|to attack rolls?|accuracy|misses an attack|hit the target/i.test(text)],
  ["saving_throw", (_entry, text) => /saving throw|\b[A-Z]{3} save\b|\b(?:STR|DEX|CON|INT|WIS|CHA) saves?\b|\bsave DC\b/i.test(text)],
  ["status_condition", (_entry, text) => /poison|burn|paraly|sleep|asleep|confus|status|flinch|frozen|freeze|drows|frighten|charm/i.test(text)],
  ["spatial_movement", (_entry, text) => /speed|feet|ft\b|movement|move up to|flee|switch out|swim|fly|burrow|climb|disengage|opportunity|adjacent|range|line of sight|difficult terrain|grounded/i.test(text)],
  ["action_economy", (_entry, text) => /bonus action|reaction|\baction\b|initiative|turn order|same move|back to back rounds|move time/i.test(text)],
  ["stat_modifier", (_entry, text) => /ability score|\bAC\b|stats?\b|modifier|proficiency bonus|proficiency modifier|proficient|expertise/i.test(text)],
  ["resource_rest", (_entry, text) => /short rest|long rest|once per|number of times|charge|dawn|per day|each day/i.test(text)],
  ["item_held", (_entry, text) => /berry|berries|held item|\bitem\b|plate|orb|stone|bottle/i.test(text)],
  ["ability_interaction", (_entry, text) => /\babilit(?:y|ies)\b|nullif|ignore any ability|swapped off|passed or swapped/i.test(text)],
  ["move_interaction", (_entry, text) => /\bmove\b|moves\b|cantrip|Self Destruct|Explosion|Light Screen|Reflect|Substitute|Safeguard|Aurora Veil|Transform/i.test(text)],
  ["capture_encounter", (_entry, text) => /catch|capture|wild pok[eé]mon|encounter|tracking|scent/i.test(text)],
  ["world_utility", (_entry, text) => /outside (?:of )?combat|overworld|DM discretion|objects?|food|honey|gather|pickup|find|search|sight/i.test(text)]
]);

const ABILITY_EXCEPTIONS = Object.freeze({
  "hunger-switch": ["form_change", "action_economy"],
  "intrepid-sword": ["attack_accuracy"],
  "keen-eye": ["world_utility"],
  "ripen": ["item_held"],
  "unnerve": ["item_held", "action_economy"]
});

const ABILITY_OWNERS = Object.freeze({
  form_change: "pokemon-progression",
  fifth_move: "combat-engine.loadout",
  weather_environment: "combat-engine.environment",
  type_rules: "type-chart+combat-engine",
  damage_rules: "poke5e-rules+combat-engine",
  attack_accuracy: "poke5e-rules+combat-engine",
  saving_throw: "poke5e-rules",
  status_condition: "status+combat-engine",
  spatial_movement: "spatial+combat-engine",
  action_economy: "combat-engine.turn-lifecycle",
  stat_modifier: "combat-engine.effects",
  resource_rest: "combat-engine.resources",
  item_held: "item-rules+combat-engine",
  ability_interaction: "combat-engine.ability-dispatch",
  move_interaction: "combat-engine.move-dispatch",
  capture_encounter: "capture+bookgame-engine",
  world_utility: "bookgame-engine.world-actions"
});

const ITEM_DOMAIN_PATTERNS = Object.freeze([
  ["capture", (entry, text) => entry.type === "pokeball" || /capture roll|capture pok/i.test(text)],
  ["healing", (_entry, text) => /heal|restore.+HP|hit points|fainted|revive/i.test(text)],
  ["pp", (_entry, text) => /\bPP\b/i.test(text)],
  ["status", (_entry, text) => /poison|burn|paraly|sleep|confus|frozen|status condition|flinch/i.test(text)],
  ["evolution", (entry, text) => entry.type === "evolution" || /\bevolv/i.test(text)],
  ["combat_modifier", (_entry, text) => /damage|attack roll|saving throw|\bAC\b|initiative|advantage|disadvantage|critical|move DC|STAB|vulnerab|resistan|immun/i.test(text)],
  ["type_move", (_entry, text) => /\btype\b|\bmove\b|moves\b/i.test(text)],
  ["berry_consumable", (entry, text) => entry.type === "berry" || /berry|berries|consum/i.test(text)],
  ["held_effect", (entry, text) => entry.type === "held item" && /holder|holding|held|wear|equipped|pokemon/i.test(text)],
  ["weather_environment", (_entry, text) => /weather|sunlight|rain|snow|sandstorm|hail|terrain/i.test(text)],
  ["world_equipment", (entry, text) => entry.type === "trainer gear" && /allows|includes|contains|casts|carry|hold|kit|tool|light|tent|water|air|fish|climb|swim|dive|cook|camp|license|scanner|identify|charge|egg|hatch|capture|flee|attract/i.test(text)],
  ["progression", (_entry, text) => /mega evolve|z-move|dynamax|terastall|hatch|trainer path/i.test(text)],
  ["economy_inventory", (_entry, text) => /cost|purchase|backpack|pack|energy cell|ration|filter/i.test(text)]
]);

const ITEM_EXCEPTIONS = Object.freeze({
  "red-nectar": ["form_change", "progression"],
  "yellow-nectar": ["form_change", "progression"],
  "pink-nectar": ["form_change", "progression"],
  "purple-nectar": ["form_change", "progression"],
  "smoke-ball": ["flee", "held_effect"],
  "dna-splicer": ["form_change", "progression"],
  "binoculars": ["perception", "world_equipment"],
  "energy-cell": ["equipment_energy", "economy_inventory"],
  "flint-and-steel": ["world_equipment"],
  "thieves-tools": ["skill_check", "world_equipment"]
});

const ITEM_OWNERS = Object.freeze({
  capture: "capture",
  healing: "item-rules",
  pp: "item-rules",
  status: "item-rules+status",
  evolution: "pokemon-progression",
  combat_modifier: "combat-engine+item-rules",
  type_move: "combat-engine+type-chart",
  berry_consumable: "item-rules+combat-engine",
  held_effect: "combat-engine.held-items",
  weather_environment: "combat-engine.environment",
  world_equipment: "bookgame-engine.world-actions",
  progression: "pokemon-progression",
  economy_inventory: "bookgame-engine.inventory",
  form_change: "pokemon-progression",
  flee: "survival+combat-engine",
  perception: "bookgame-engine.world-actions",
  equipment_energy: "bookgame-engine.inventory",
  skill_check: "bookgame-engine.checks"
});

function unique(values) {
  return [...new Set(values)];
}

function domainsFor(entry, patterns, exceptions) {
  const text = String(entry?.description ?? "");
  const inferred = patterns
    .filter(([, predicate]) => predicate(entry ?? {}, text))
    .map(([domain]) => domain);
  const explicit = exceptions[entry?.id] ?? [];
  return unique([...inferred, ...explicit]);
}

export function semanticAbilityContract(ability) {
  const domains = domainsFor(ability, ABILITY_DOMAIN_PATTERNS, ABILITY_EXCEPTIONS);
  const runtimeOwners = unique(domains.map((domain) => ABILITY_OWNERS[domain]).filter(Boolean));
  const semanticCertified = Boolean(
    ability?.id &&
    String(ability?.description ?? "").trim() &&
    domains.length > 0 &&
    runtimeOwners.length > 0
  );
  return {
    id: ability?.id ?? null,
    semanticCertified,
    domains,
    runtimeOwners,
    explicitException: Object.hasOwn(ABILITY_EXCEPTIONS, ability?.id ?? ""),
    deprecated: Boolean(ability?.deprecated)
  };
}

export function semanticItemContract(item) {
  const domains = domainsFor(item, ITEM_DOMAIN_PATTERNS, ITEM_EXCEPTIONS);
  const runtimeOwners = unique(domains.map((domain) => ITEM_OWNERS[domain]).filter(Boolean));
  const semanticCertified = Boolean(
    item?.id &&
    item?.type &&
    String(item?.description ?? "").trim() &&
    domains.length > 0 &&
    runtimeOwners.length > 0
  );
  return {
    id: item?.id ?? null,
    semanticCertified,
    domains,
    runtimeOwners,
    explicitException: Object.hasOwn(ITEM_EXCEPTIONS, item?.id ?? "")
  };
}

export function auditSemanticCoverage({ abilities = [], items = [] } = {}) {
  const abilityContracts = abilities.map(semanticAbilityContract);
  const itemContracts = items.map(semanticItemContract);
  return {
    abilities: {
      total: abilityContracts.length,
      certified: abilityContracts.filter((entry) => entry.semanticCertified).length,
      unresolved: abilityContracts.filter((entry) => !entry.semanticCertified).map((entry) => entry.id),
      explicitExceptions: abilityContracts.filter((entry) => entry.explicitException).map((entry) => entry.id)
    },
    items: {
      total: itemContracts.length,
      certified: itemContracts.filter((entry) => entry.semanticCertified).length,
      unresolved: itemContracts.filter((entry) => !entry.semanticCertified).map((entry) => entry.id),
      explicitExceptions: itemContracts.filter((entry) => entry.explicitException).map((entry) => entry.id)
    }
  };
}
