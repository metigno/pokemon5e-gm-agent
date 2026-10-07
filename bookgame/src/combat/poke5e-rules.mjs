import { attackHasDisadvantage, damageHasDisadvantage, saveHasDisadvantage } from "./status.mjs";
import { typeMultiplier } from "./type-chart.mjs";

export const DICE_CLASSES = {
  "0": ["1d4", "1d6", "1d8", "1d10"],
  "10": ["1d4", "1d6", "1d8", "2d6"],
  "20": ["1d4", "2d4", "1d12", "4d4"],
  "30": ["1d6", "1d10", "2d8", "5d4"],
  "40": ["1d6", "1d12", "2d8", "4d6"],
  "50": ["1d8", "2d6", "4d4", "3d10"],
  "60": ["1d10", "2d8", "5d4", "4d8"],
  "70": ["1d12", "2d8", "2d12", "6d6"],
  "80": ["2d6", "2d8", "4d6", "6d6"],
  "90": ["2d8", "2d10", "3d10", "4d12"],
  "100": ["4d4", "2d12", "4d8", "8d6"],
  "110": ["3d6", "3d8", "6d6", "7d8"],
  "120": ["2d10", "3d8", "4d10", "7d8"],
  "130": ["5d4", "3d10", "5d8", "8d8"],
  "140": ["2d12", "3d10", "7d6", "8d8"],
  "150": ["3d8", "5d6", "4d12", "8d8"],
  "160": ["4d6", "5d6", "6d8", "6d12"],
  "180": ["3d10", "6d6", "8d6", "7d12"],
  "200": ["5d6", "4d10", "6d10", "8d12"]
};

export function abilityModifier(score) {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level) {
  return 2 + Math.floor((level - 1) / 4);
}

export function hitDieAverage(hitDice) {
  const sides = Number(String(hitDice).replace(/^d/, ""));
  if (!Number.isInteger(sides) || sides < 2) throw new Error(`Invalid hit die: ${hitDice}`);
  return Math.ceil(0.5 + sides / 2);
}

export function scaledHp(species, level) {
  if (level < species.minLevel) throw new Error(`${species.name} cannot be below level ${species.minLevel}`);
  const delta = level - species.minLevel;
  const con = abilityModifier(species.attributes.con);
  return Math.max(8, species.hp + delta * (hitDieAverage(species.hitDice) + con));
}

export function bestMoveAttribute(move, attributes) {
  if (!Array.isArray(move.power) || move.power.length === 0) return null;
  let best = null;
  for (const attribute of move.power) {
    const score = attributes[attribute];
    if (score == null) continue;
    if (best == null || score > attributes[best]) best = attribute;
  }
  return best;
}

export function damageDiceForLevel(move, level) {
  if (!move.dice) return null;
  const tier = (level >= 5 ? 1 : 0) + (level >= 10 ? 1 : 0) + (level >= 17 ? 1 : 0);
  if (move.dice.class === "custom") return move.dice.tiers[tier];
  const tiers = DICE_CLASSES[move.dice.class];
  if (!tiers) throw new Error(`Unknown damage class: ${move.dice.class}`);
  return tiers[tier];
}

function stabFor(combatant, move, pb, round = null) {
  if (!combatant.types.includes(move.type)) return 0;
  let stab = pb;

  const lowHpStabTypes = {
    blaze: "fire",
    overgrow: "grass",
    swarm: "bug",
    torrent: "water"
  };
  const boostedType = lowHpStabTypes[combatant.abilityId];
  if (
    boostedType === move.type &&
    combatant.hp.current <= Math.floor(combatant.hp.max * 0.25)
  ) {
    stab *= 2;
  }

  if (
    combatant.abilityId === "flash-fire" &&
    combatant.abilityState?.flashFireCharged &&
    move.type === "fire"
  ) {
    stab *= 2;
  }

  for (const source of combatant.effects?.stabMultiplierSources ?? []) {
    if (round != null && source.expiresRound != null && round >= source.expiresRound) continue;
    if (round != null && source.startsRound != null && round < source.startsRound) continue;
    stab *= Number(source.multiplier ?? 1);
  }

  return stab;
}

export function calculateMoveStats(combatant, move, round = null) {
  const override = combatant.effects?.movePowerOverride;
  const overrideActive =
    override &&
    (override.usesRemaining == null || override.usesRemaining > 0) &&
    (round == null || override.expiresRound == null || round < override.expiresRound);
  const attribute = overrideActive
    ? override.attribute
    : bestMoveAttribute(move, combatant.attributes);
  const moveMod = attribute ? abilityModifier(combatant.attributes[attribute]) : 0;
  const pb = proficiencyBonus(combatant.level);
  const stab = move.dice?.type === "damage" ? stabFor(combatant, move, pb, round) : 0;

  let damageModifier = stab;
  const code = move.dice?.modifier;
  if (typeof code === "number") {
    damageModifier += code;
  } else if (code === "LEVEL") {
    damageModifier += combatant.level;
  } else if (code === "MOVE + STAB") {
    damageModifier += moveMod + stab;
  } else if (typeof code === "string") {
    const match = code.match(/^MOVE(?:\s*\+\s*(\d+))?$/i);
    if (match) damageModifier += moveMod + Number(match[1] ?? 0);
  }

  return {
    attribute,
    moveModifier: moveMod,
    proficiencyBonus: pb,
    toHit: move.attack ? pb + moveMod : null,
    saveDc: move.save ? 8 + pb + moveMod : null,
    saveAttribute: move.save?.attribute ?? null,
    damageDice: damageDiceForLevel(move, combatant.level),
    damageModifier,
    stab
  };
}

export function rollD20(dice, { advantage = false, disadvantage = false } = {}) {
  if (advantage && disadvantage) {
    advantage = false;
    disadvantage = false;
  }

  const count = advantage || disadvantage ? 2 : 1;
  const rolls = Array.from({ length: count }, () => dice.roll(20));
  const natural = advantage
    ? Math.max(...rolls)
    : disadvantage
      ? Math.min(...rolls)
      : rolls[0];

  return {
    rolls,
    natural,
    mode: advantage ? "advantage" : disadvantage ? "disadvantage" : "normal"
  };
}

export function rollExpression(expression, dice, { critical = false } = {}) {
  const match = /^(\d+)d(\d+)$/.exec(expression);
  if (!match) throw new Error(`Unsupported dice expression: ${expression}`);
  const baseCount = Number(match[1]);
  const sides = Number(match[2]);
  const count = critical ? baseCount * 2 : baseCount;
  const rolls = Array.from({ length: count }, () => dice.roll(sides));
  return { expression: `${count}d${sides}`, rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

export function damageRollHasAdvantage(combatant, move) {
  if (move.dice?.type !== "damage") return false;
  if (
    combatant.abilityId === "adaptability" &&
    combatant.types.includes(move.type)
  ) {
    return true;
  }
  return combatant.abilityId === "technician" && move.pp >= 15;
}

function rollDamage(
  expression,
  dice,
  { critical = false, advantage = false, disadvantage = false } = {}
) {
  if (advantage && disadvantage) {
    advantage = false;
    disadvantage = false;
  }

  const first = rollExpression(expression, dice, { critical });
  if (!advantage && !disadvantage) {
    return { selected: first, attempts: [first], mode: "normal" };
  }

  const second = rollExpression(expression, dice, { critical });
  return {
    selected: advantage
      ? (first.total >= second.total ? first : second)
      : (first.total <= second.total ? first : second),
    attempts: [first, second],
    mode: advantage ? "advantage" : "disadvantage"
  };
}

function addResistance(multiplier) {
  if (multiplier >= 2) return 1;
  return 0.5;
}

function addVulnerability(multiplier) {
  if (multiplier <= 0.5) return 1;
  return 2;
}

function addResistanceStep(multiplier) {
  if (multiplier === 0) return 0;
  if (multiplier <= 0.5) return 0;
  if (multiplier >= 2) return 1;
  return 0.5;
}

export function damageProfile(move, defender, round = null, attacker = null) {
  const moveType = move.type;
  const immunityEffect = (defender.effects?.typeImmunitySources ?? []).find(
    (source) =>
      source.type === moveType &&
      (round == null || source.startsRound == null || round >= source.startsRound) &&
      (round == null || source.expiresRound == null || round < source.expiresRound)
  );
  if (immunityEffect) {
    return {
      multiplier: 0,
      immunityAbility: null,
      immunityEffect: immunityEffect.source,
      modifierAbility: null
    };
  }
  if (defender.abilityId === "levitate" && moveType === "ground") {
    return { multiplier: 0, immunityAbility: "levitate", immunityEffect: null, modifierAbility: null };
  }
  if (defender.abilityId === "flash-fire" && moveType === "fire") {
    return { multiplier: 0, immunityAbility: "flash-fire", immunityEffect: null, modifierAbility: null };
  }

  let multiplier = typeMultiplier(moveType, defender.types);
  const immunityIgnore = (attacker?.effects?.typeImmunityIgnoreSources ?? []).find(
    (source) =>
      (source.usesRemaining == null || source.usesRemaining > 0) &&
      (source.startsRound == null || round == null || round >= source.startsRound) &&
      (source.expiresRound == null || round == null || round < source.expiresRound) &&
      (!Array.isArray(source.moveTypes) || source.moveTypes.includes(moveType)) &&
      (source.targetCombatantId == null || source.targetCombatantId === defender.combatantId)
  );
  if (multiplier === 0 && immunityIgnore) {
    const nonImmune = (defender.types ?? [])
      .map((type) => typeMultiplier(moveType, [type]))
      .filter((value) => value !== 0);
    multiplier = nonImmune.length > 0
      ? nonImmune.reduce((product, value) => product * value, 1)
      : 1;
    if (immunityIgnore.usesRemaining != null) {
      immunityIgnore.usesRemaining = Math.max(0, immunityIgnore.usesRemaining - 1);
    }
  }
  let modifierAbility = null;
  const melee = move.attack?.scope === "melee" || move.range?.type === "melee";

  if (
    defender.abilityId === "thick-fat" &&
    ["fire", "ice"].includes(moveType)
  ) {
    multiplier = addResistance(multiplier);
    modifierAbility = "thick-fat";
  } else if (defender.abilityId === "heatproof" && moveType === "fire") {
    multiplier = addResistance(multiplier);
    modifierAbility = "heatproof";
  } else if (defender.abilityId === "purifying-salt" && moveType === "ghost") {
    multiplier = addResistance(multiplier);
    modifierAbility = "purifying-salt";
  } else if (defender.abilityId === "aura-guard" && melee) {
    multiplier = addResistance(multiplier);
    modifierAbility = "aura-guard";
  } else if (defender.abilityId === "fluffy") {
    if (moveType === "fire") {
      multiplier = addVulnerability(multiplier);
      modifierAbility = "fluffy";
    } else if (melee) {
      multiplier = addResistance(multiplier);
      modifierAbility = "fluffy";
    }
  }

  const resistanceSources = (defender.effects?.damageResistanceSources ?? [])
    .filter((source) =>
      (round == null || source.expiresRound == null || round < source.expiresRound) &&
      (round == null || source.startsRound == null || round >= source.startsRound) &&
      (source.type == null || source.type === moveType)
    );
  for (const source of resistanceSources) {
    for (let step = 0; step < Number(source.steps ?? 1); step += 1) {
      multiplier = addResistanceStep(multiplier);
    }
  }

  return { multiplier, immunityAbility: null, immunityEffect: null, modifierAbility };
}

function activeEffectModifier(sources = [], round = null) {
  return sources
    .filter((source) =>
      round == null ||
      ((source.startsRound == null || round >= source.startsRound) &&
       (source.expiresRound == null || round < source.expiresRound))
    )
    .reduce((sum, source) => sum + Number(source.value ?? 0), 0);
}

function hasActiveEffect(sources = [], round = null) {
  return sources.some(
    (source) =>
      (source.usesRemaining == null || source.usesRemaining > 0) &&
      (round == null ||
       ((source.startsRound == null || round >= source.startsRound) &&
        (source.expiresRound == null || round < source.expiresRound)))
  );
}

function effectSourceApplies(source, round, {
  attribute = null,
  move = null,
  target = null,
  sourcePosition = null
} = {}) {
  if (source.usesRemaining != null && source.usesRemaining <= 0) return false;
  if (round != null && source.startsRound != null && round < source.startsRound) return false;
  if (round != null && source.expiresRound != null && round >= source.expiresRound) return false;
  if (attribute && Array.isArray(source.attributes) && !source.attributes.includes(attribute)) return false;
  if (move && Array.isArray(source.moveTypes) && !source.moveTypes.includes(move.type)) return false;
  if (move && Array.isArray(source.moveScopes)) {
    const scope = move.attack?.scope ?? move.range?.type ?? null;
    if (!source.moveScopes.includes(scope)) return false;
  }
  if (target && source.targetCombatantId && source.targetCombatantId !== target.combatantId) return false;
  if (
    target &&
    source.sourcePosition &&
    Number.isFinite(source.maxTargetDistance)
  ) {
    const a = source.sourcePosition;
    const b = target.position;
    if (!a || !b) return false;
    const dx = Number(a.x ?? 0) - Number(b.x ?? 0);
    const dy = Number(a.y ?? 0) - Number(b.y ?? 0);
    const dz = Number(a.z ?? 0) - Number(b.z ?? 0);
    if (Math.hypot(dx, dy, dz) > source.maxTargetDistance + 1e-9) return false;
  }
  return true;
}

function activeConditionalEffect(sources = [], round = null, context = {}) {
  return sources.some((source) => effectSourceApplies(source, round, context));
}

function rollEffectDiceBonus(sources = [], dice, round = null, context = {}) {
  const rolls = [];
  let total = 0;
  for (const source of sources) {
    if (!effectSourceApplies(source, round, context)) continue;
    const expression = source.dice ?? source.die;
    if (!expression) continue;
    const normalized = /^d\d+$/.test(expression) ? `1${expression}` : expression;
    const roll = rollExpression(normalized, dice);
    total += roll.total;
    rolls.push({ source: source.source ?? null, ...roll });
    if (source.usesRemaining != null && source.consumeOnUse !== false) {
      source.usesRemaining = Math.max(0, source.usesRemaining - 1);
    }
  }
  return { total, rolls };
}

export function resolveSavingThrow({
  defender,
  attribute,
  dc,
  dice,
  advantage = false,
  disadvantage = false,
  round = null
}) {
  const statusDisadvantage = saveHasDisadvantage(defender, attribute);
  const effectAdvantage = activeConditionalEffect(
    defender.effects?.saveAdvantageSources ?? [],
    round,
    { attribute }
  );
  const effectDisadvantage = activeConditionalEffect(
    defender.effects?.saveDisadvantageSources ?? [],
    round,
    { attribute }
  );
  const restrainedDex =
    attribute === "dex" &&
    hasActiveEffect(defender.effects?.restrainedSources ?? [], round);
  const roll = rollD20(dice, {
    advantage: advantage || effectAdvantage,
    disadvantage: disadvantage || effectDisadvantage || statusDisadvantage || restrainedDex
  });
  const effectDiceBonus = rollEffectDiceBonus(
    defender.effects?.saveRollDiceSources ?? [],
    dice,
    round,
    { attribute }
  );
  const effectModifier = activeEffectModifier(
    defender.effects?.saveModifierSources ?? [],
    round
  );
  const modifier =
    abilityModifier(defender.attributes[attribute]) +
    (defender.savingThrows.includes(attribute) ? proficiencyBonus(defender.level) : 0) +
    effectModifier;
  const total = roll.natural + modifier + effectDiceBonus.total;

  return {
    attribute,
    dc,
    modifier,
    effectModifier,
    effectDiceBonus,
    effectAdvantage,
    effectDisadvantage,
    restrainedDex,
    total,
    success: total >= dc,
    ...roll
  };
}

function gutsMeleeBonus(combatant, move) {
  const afflicted = ["Burned", "Poisoned", "BadlyPoisoned", "Paralysis", "Frozen", "Asleep"]
    .includes(combatant.statuses?.nonVolatile);
  const melee = move.attack?.scope === "melee" || move.range?.type === "melee";
  return combatant.abilityId === "guts" && afflicted && melee ? 2 : 0;
}

function multiplyDiceExpression(expression, multiplier) {
  if (multiplier === 1) return expression;
  const match = /^(\d+)d(\d+)$/.exec(expression);
  if (!match) throw new Error(`Unsupported multiplied dice expression: ${expression}`);
  return `${Number(match[1]) * multiplier}d${match[2]}`;
}

export function resolveAttack({
  attacker,
  defender,
  move,
  dice,
  extraAttackModifier = 0,
  extraDamageModifier = 0,
  damageDiceMultiplier = 1,
  forceDisadvantage = false,
  forceHit = false,
  forceCritical = false,
  round = null
}) {
  const stats = calculateMoveStats(attacker, move, round);
  if (stats.toHit == null || stats.damageDice == null) {
    throw new Error(`Move ${move.id} is not a supported damaging attack-roll move`);
  }

  const effectAdvantage = activeConditionalEffect(
    attacker.effects?.attackAdvantageSources ?? [],
    round,
    { attribute: stats.attribute, move, target: defender }
  );
  const effectDisadvantage = activeConditionalEffect(
    attacker.effects?.attackDisadvantageSources ?? [],
    round,
    { attribute: stats.attribute, move, target: defender }
  );
  const incomingAttackAdvantage = activeConditionalEffect(
    defender.effects?.incomingAttackAdvantageSources ?? [],
    round,
    { attribute: stats.attribute, move, target: defender }
  );
  const attackerRestrained = hasActiveEffect(
    attacker.effects?.restrainedSources ?? [],
    round
  );
  const defenderRestrained = hasActiveEffect(
    defender.effects?.restrainedSources ?? [],
    round
  );
  const attackRoll = rollD20(dice, {
    advantage: effectAdvantage || incomingAttackAdvantage || defenderRestrained,
    disadvantage:
      forceDisadvantage ||
      effectDisadvantage ||
      attackHasDisadvantage(attacker) ||
      attackerRestrained
  });
  const effectDiceBonus = rollEffectDiceBonus(
    attacker.effects?.attackRollDiceSources ?? [],
    dice,
    round,
    { attribute: stats.attribute, move, target: defender }
  );
  const gutsBonus = gutsMeleeBonus(attacker, move);
  const effectAttackModifier = activeEffectModifier(attacker.effects?.attackModifierSources ?? [], round);\n  const attackModifier = stats.toHit + extraAttackModifier + gutsBonus + effectAttackModifier;
  const attackTotal = attackRoll.natural + attackModifier + effectDiceBonus.total;
  const criticalRangeBonus = activeEffectModifier(
    attacker.effects?.criticalRangeBonusSources ?? [],
    round
  );
  const criticalThreshold = Math.max(2, 20 - criticalRangeBonus);
  const critical = forceCritical || attackRoll.natural >= criticalThreshold;
  const criticalDamage =
    critical &&
    !["battle-armor", "shell-armor"].includes(defender.abilityId);
  const hit = forceHit || critical ||
    (attackRoll.natural !== 1 && attackTotal >= defender.ac);

  if (!hit) {
    return {
      moveId: move.id,
      moveName: move.name,
      attackRoll,
      natural: attackRoll.natural,
      attackModifier,
      effectAttackModifier,
      attackTotal,
      defenderAc: defender.ac,
      hit: false,
      critical: false,
      criticalDamage: false,
      forcedHit: forceHit,
      forcedCritical: forceCritical,
      criticalRangeBonus,
      criticalThreshold,
      effectAdvantage,
      effectDisadvantage,
      incomingAttackAdvantage,
      effectDiceBonus,
      attackerRestrained,
      defenderRestrained,
      gutsBonus,
      damage: 0,
      typeMultiplier: 1,
      immunityAbility: null,
      modifierAbility: null,
      stab: stats.stab
    };
  }

  const damageDice = multiplyDiceExpression(stats.damageDice, damageDiceMultiplier);
  const damageRoll = rollDamage(damageDice, dice, {
    critical: criticalDamage,
    advantage: damageRollHasAdvantage(attacker, move) || activeConditionalEffect(attacker.effects?.damageAdvantageSources ?? [], round, { move, target: defender }),
    disadvantage: damageHasDisadvantage(attacker)
  });
  const effectDamageModifier = activeEffectModifier(attacker.effects?.damageModifierSources ?? [], round);
  const effectiveDamageModifier = stats.damageModifier + gutsBonus + extraDamageModifier + effectDamageModifier;
  const rawDamage = Math.max(0, damageRoll.selected.total + effectiveDamageModifier);
  const {
    multiplier,
    immunityAbility,
    modifierAbility
  } = damageProfile(move, defender, round, attacker);
  const damage = multiplier === 0.5
    ? Math.floor(rawDamage / 2)
    : rawDamage * multiplier;

  return {
    moveId: move.id,
    moveName: move.name,
    attackRoll,
    natural: attackRoll.natural,
    attackModifier,
    effectAttackModifier,
    attackTotal,
    defenderAc: defender.ac,
    hit: true,
    critical,
    criticalDamage,
    forcedHit: forceHit,
    forcedCritical: forceCritical,
    criticalRangeBonus,
    criticalThreshold,
    effectAdvantage,
    effectDisadvantage,
    incomingAttackAdvantage,
    effectDiceBonus,
    attackerRestrained,
    defenderRestrained,
    damageRoll,
    damageDiceMultiplier,
    damageModifier: effectiveDamageModifier,
    effectDamageModifier,
    gutsBonus,
    rawDamage,
    damage,
    damageType: move.type,
    typeMultiplier: multiplier,
    immunityAbility,
    modifierAbility,
    stab: stats.stab
  };
}

export function resolveSaveMove({
  attacker,
  defender,
  move,
  dice,
  round = null,
  forceTargetAdvantage = false
}) {
  const stats = calculateMoveStats(attacker, move, round);
  if (stats.saveDc == null || stats.saveAttribute == null) {
    throw new Error(`Move ${move.id} is not a save move`);
  }

  const targetAdvantage =
    forceTargetAdvantage ||
    (attacker.statuses?.flinchedTurns > 0 &&
     move.time?.unit === "action");
  const targetDisadvantage = activeConditionalEffect(
    attacker.effects?.targetSaveDisadvantageSources ?? [],
    round,
    { attribute: stats.saveAttribute, move, target: defender }
  );

  const save = resolveSavingThrow({
    defender,
    attribute: stats.saveAttribute,
    dc: stats.saveDc,
    dice,
    advantage: targetAdvantage,
    disadvantage: targetDisadvantage,
    round
  });

  return {
    moveId: move.id,
    moveName: move.name,
    save,
    saveDc: stats.saveDc,
    saveAttribute: stats.saveAttribute
  };
}
