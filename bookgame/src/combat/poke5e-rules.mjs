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
  if (!move.dice) throw new Error(`Move ${move.id} has no damage dice`);
  const tier = (level >= 5 ? 1 : 0) + (level >= 10 ? 1 : 0) + (level >= 17 ? 1 : 0);
  if (move.dice.class === "custom") return move.dice.tiers[tier];
  const tiers = DICE_CLASSES[move.dice.class];
  if (!tiers) throw new Error(`Unknown damage class: ${move.dice.class}`);
  return tiers[tier];
}

export function calculateMoveStats(combatant, move) {
  const attribute = bestMoveAttribute(move, combatant.attributes);
  const moveMod = attribute ? abilityModifier(combatant.attributes[attribute]) : 0;
  const pb = proficiencyBonus(combatant.level);
  const stab = combatant.types.includes(move.type) ? pb : 0;

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
    damageDice: damageDiceForLevel(move, combatant.level),
    damageModifier,
    stab
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

export function resolveAttack({ attacker, defender, move, dice }) {
  const stats = calculateMoveStats(attacker, move);
  if (stats.toHit == null) throw new Error(`Move ${move.id} is not an attack-roll move`);

  const natural = dice.roll(20);
  const attackTotal = natural + stats.toHit;
  const critical = natural === 20;
  const hit = critical || (natural !== 1 && attackTotal >= defender.ac);

  if (!hit) {
    return {
      moveId: move.id,
      moveName: move.name,
      natural,
      attackModifier: stats.toHit,
      attackTotal,
      defenderAc: defender.ac,
      hit: false,
      critical: false,
      damage: 0,
      typeMultiplier: 1,
      stab: stats.stab
    };
  }

  const rolled = rollExpression(stats.damageDice, dice, { critical });
  const rawDamage = Math.max(0, rolled.total + stats.damageModifier);
  const multiplier = typeMultiplier(move.type, defender.types);
  const damage = multiplier === 0.5
    ? Math.floor(rawDamage / 2)
    : rawDamage * multiplier;

  return {
    moveId: move.id,
    moveName: move.name,
    natural,
    attackModifier: stats.toHit,
    attackTotal,
    defenderAc: defender.ac,
    hit: true,
    critical,
    damageRoll: rolled,
    damageModifier: stats.damageModifier,
    rawDamage,
    damage,
    damageType: move.type,
    typeMultiplier: multiplier,
    stab: stats.stab
  };
}
