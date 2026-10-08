import { abilityModifier, proficiencyBonus, rollD20 } from "./poke5e-rules.mjs";

const BALLS = new Set([
  "pokeball","great-ball","ultra-ball","master-ball","safari-ball","fast-ball",
  "level-ball","lure-ball","heavy-ball","love-ball","friend-ball","moon-ball",
  "sport-ball","net-ball","dive-ball","nest-ball","repeat-ball","timer-ball",
  "luxury-ball","premier-ball","dusk-ball","heal-ball","quick-ball","dream-ball"
]);

function normalizeBall(ball) {
  const id = String(ball).toLowerCase().replace(/é/g, "e").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (id === "poke-ball") return "pokeball";
  return id;
}

/**
 * The UI reads the same valid ball list used by attemptCapture.
 * Each inventory entry represents one consumable in the current battle engine.
 */
export function captureBallsInInventory(inventory = []) {
  const counts = new Map();
  for (const item of inventory) {
    const itemId = typeof item === "string" ? item : item?.id ?? item?.name;
    const ballId = normalizeBall(itemId);
    if (!BALLS.has(ballId)) continue;
    const existing = counts.get(ballId);
    if (existing) existing.count += 1;
    else counts.set(ballId, { id: ballId, count: 1 });
  }
  return [...counts.values()];
}

function hasSkill(trainer, skill) {
  return (trainer.skills ?? []).some((value) => value.toLowerCase() === skill.toLowerCase());
}

export function trainerSkillModifier(trainer, skill, ability) {
  const score = trainer.abilities?.[ability.toUpperCase()] ?? trainer.abilities?.[ability.toLowerCase()];
  if (!Number.isInteger(score)) throw new Error(`Trainer missing ${ability} score`);
  return abilityModifier(score) + (hasSkill(trainer, skill) ? proficiencyBonus(trainer.level) : 0);
}

function ballReduction(ballId, { trainer, target, activePokemon, round, context }) {
  if (ballId === "great-ball") return 5;
  if (ballId === "ultra-ball") return 10;
  if (ballId === "safari-ball") return Math.max(0, trainerSkillModifier(trainer, "Nature", "WIS"));
  if (ballId === "level-ball") return trainer.level > target.level ? 5 : 0;
  if (ballId === "lure-ball") return context.fishing ? 10 : 0;
  if (ballId === "heavy-ball") return ["medium","large","huge","gargantuan"].includes(target.size) ? 10 : 0;
  if (ballId === "love-ball") return Math.max(0, 2 * abilityModifier(activePokemon.attributes.cha));
  if (ballId === "friend-ball") return Math.max(0, trainerSkillModifier(trainer, "Persuasion", "CHA"));
  if (ballId === "moon-ball") return context.moonStoneEvolution ? 10 : 0;
  if (ballId === "sport-ball") return Math.max(0, trainerSkillModifier(trainer, "Athletics", "STR"));
  if (ballId === "net-ball") return target.types.some((type) => ["water","bug"].includes(type)) ? 10 : 0;
  if (ballId === "dive-ball") return context.underwater ? 10 : 0;
  if (ballId === "nest-ball") return target.level <= 5 ? 5 : 0;
  if (ballId === "repeat-ball") return context.alreadyCaughtSpecies ? 10 : 0;
  if (ballId === "timer-ball") return context.timerActivatedPreviousTurn ? 15 : 0;
  if (ballId === "dusk-ball") return context.darkness || context.night ? 10 : 0;
  if (ballId === "quick-ball") return round === 1 ? 15 : 0;
  if (ballId === "dream-ball") return target.statuses?.nonVolatile === "Asleep" ? 5 : 0;
  return 0;
}

export function captureAdvantage(target, context = {}) {
  return ["Poisoned","BadlyPoisoned","Asleep","Burned","Paralysis","Frozen"].includes(target.statuses?.nonVolatile)
    || (target.statuses?.confusedRounds ?? 0) > 0
    || Boolean(context.restrained)
    || Boolean(context.confused)
    || Boolean(context.trainerFeatureAdvantage);
}

export function calculateCaptureDc({ trainer, target, ball = "pokeball", activePokemon, round = 1, context = {} }) {
  const ballId = normalizeBall(ball);
  if (!BALLS.has(ballId)) throw new Error(`Unknown Pokéball variant: ${ball}`);

  let dc = 10 + Math.floor(target.sr) + target.level;
  if (target.hp.current < target.hp.max / 2) dc -= 5;
  if (target.hp.current < target.hp.max * 0.1) dc -= 5;
  dc -= ballReduction(ballId, { trainer, target, activePokemon, round, context });
  return Math.max(0, dc);
}

export function validateCapture({ trainer, target, distanceFeet, registered = false }) {
  if (registered) return { legal: false, reason: "registered_to_trainer" };
  if (target.hp.current <= 0) return { legal: false, reason: "fainted" };
  if (target.level > trainer.level) return { legal: false, reason: "target_level_above_trainer" };
  if (distanceFeet > 60 + 1e-9) return { legal: false, reason: "out_of_range" };
  return { legal: true, reason: null };
}

export function attemptCapture({
  trainer,
  target,
  activePokemon,
  ball = "pokeball",
  distanceFeet,
  round = 1,
  registered = false,
  context = {},
  dice
}) {
  const legality = validateCapture({ trainer, target, distanceFeet, registered });
  if (!legality.legal) return { ...legality, consumed: false, captured: false };

  const ballId = normalizeBall(ball);
  const dc = calculateCaptureDc({ trainer, target, ball: ballId, activePokemon, round, context });
  if (ballId === "master-ball") {
    return { legal: true, ballId, dc, consumed: true, captured: true, automatic: true };
  }

  const modifier = trainerSkillModifier(trainer, "Animal Handling", "WIS");
  const roll = rollD20(dice, { advantage: captureAdvantage(target, context) });
  const total = roll.natural + modifier;

  return {
    legal: true,
    ballId,
    dc,
    modifier,
    total,
    roll,
    consumed: true,
    captured: total >= dc,
    automatic: false
  };
}
