import { attemptCapture } from "./capture.mjs";
import { chooseForcedOpponentReplacement } from "./forced-switch-ai.mjs";
import { runNpcTrainerTurnFeatures } from "./npc-trainer-ai.mjs";
import { applyItemToPokemon, findInventoryItemIndex } from "./item-rules.mjs";
import {
  canonicalReactionTrigger,
  compileCanonicalMoveRule,
  isCanonicalSpecialMove
} from "./canonical-runtime.mjs";
import { Poke5eDataRepository } from "./poke5e-data.mjs";
import {
  advancePokeballStabilization,
  createChaseState,
  createPokemonDeathState,
  damageTrainerAtZero,
  faintPokemon,
  recallFaintedPokemon,
  releasePokemonFromBall,
  resolveChaseRound,
  resolveGroupFleeCheck,
  resolvePokemonDeathSave,
  resolveTrainerDeathSave
} from "./survival.mjs";
import {
  abilityModifier,
  calculateMoveStats,
  damageProfile,
  damageRollHasAdvantage,
  proficiencyBonus,
  resolveAttack,
  resolveSaveMove,
  resolveSavingThrow,
  rollD20,
  rollExpression,
  scaledHp
} from "./poke5e-rules.mjs";
import {
  baseMovementSpeed,
  canTargetMove,
  distance,
  leavesReach,
  moveToward,
  movementSpeed,
  movementSpeedForType,
  point,
  reachForSize,
  validateMovement,
  withinLineOfSightDistance
} from "./spatial.mjs";
import {
  createCircleZone,
  expireZonesAtTurnStart,
  removeZone,
  zoneContains,
  zoneTransition
} from "./zones.mjs";
import {
  applyStatus,
  attackHasDisadvantage,
  clearStatus,
  createStatusState,
  damageHasDisadvantage,
  endFrozenOnFireDamage,
  endTurnStatus,
  reactionsDisabled,
  startTurnStatus,
  STATUS_IDS
} from "./status.mjs";

const SAVE_EFFECT_MOVES = new Set([
  "growl",
  "leer",
  "tail-whip",
  "sand-attack",
  "hypnosis",
  "charm",
  "cotton-spore",
  "fake-tears",
  "forests-curse",
  "magic-powder",
  "metal-sound",
  "feather-dance",
  "mean-look",
  "screech",
  "soak",
  "sweet-scent",
  "tearful-look",
  "trick-or-treat"
]);

const AREA_MOVES = new Set([
  "smog",
  "poison-gas"
]);

const WEATHER_ZONE_MOVES = new Set([
  "hail",
  "sandstorm"
]);

function isWeatherZoneMove(move) {
  return WEATHER_ZONE_MOVES.has(move.id);
}

function isPointAreaMove(move) {
  return AREA_MOVES.has(move.id) || isWeatherZoneMove(move);
}

const ENVIRONMENT_MOVES = new Set([
  "rain-dance",
  "sunny-day"
]);

function isEnvironmentMove(move) {
  return ENVIRONMENT_MOVES.has(move.id);
}

const FIELD_UTILITY_MOVES = new Set([
  "defog",
  "fairy-lock",
  "haze"
]);

function isFieldUtilityMove(move) {
  return FIELD_UTILITY_MOVES.has(move.id);
}

const PROTECTION_MOVES = new Set([
  "mist",
  "safeguard"
]);

function isProtectionMove(move) {
  return PROTECTION_MOVES.has(move.id);
}

const MOVE_CONTROL_MOVES = new Set([
  "disable",
  "imprison",
  "taunt"
]);

function isMoveControlMove(move) {
  return MOVE_CONTROL_MOVES.has(move.id);
}

function isMoveLocked(combatant, move, round) {
  for (const source of combatant.effects?.moveLockSources ?? []) {
    if (source.startsRound != null && round < source.startsRound) continue;
    if (source.expiresRound != null && round >= source.expiresRound) continue;
    if (Array.isArray(source.moveIds) && source.moveIds.includes(move.id)) return source.source;
    if (
      source.nonDamagingAttacks &&
      !(move.attack && move.dice?.type === "damage")
    ) return source.source;
  }
  return null;
}

const REACTION_ATTACK_MOVES = new Set([
  "comeuppance",
  "counter",
  "pursuit",
  "spikes",
  "stealth-rock",
  "struggle-bug",
  "sucker-punch",
  "thunderclap",
  "upper-hand"
]);

const REACTION_STATUS_MOVES = new Set([
  "spore",
  "stun-spore",
  "toxic-spikes"
]);

const REACTION_TRIGGER_BY_MOVE = {
  "comeuppance": "hit_by_melee_attack",
  "counter": "hit_by_melee_attack",
  "pursuit": "target_switch_or_flee",
  "spikes": "target_switched_in",
  "stealth-rock": "target_switched_in",
  "struggle-bug": "hit_by_melee_attack",
  "sucker-punch": "targeted_by_melee_attack",
  "thunderclap": "targeted_by_ranged_attack",
  "upper-hand": "targeted_by_melee_attack",
  "spore": "targeted_by_melee_attack",
  "stun-spore": "targeted_by_melee_attack",
  "toxic-spikes": "target_switched_in"
};

function isSupportedReactionMove(move) {
  return (
    move.time?.unit === "reaction" &&
    (
      REACTION_ATTACK_MOVES.has(move.id) ||
      REACTION_STATUS_MOVES.has(move.id) ||
      isCanonicalSpecialMove(move)
    )
  );
}

function reactionTriggerForMove(move) {
  return REACTION_TRIGGER_BY_MOVE[move.id] ?? canonicalReactionTrigger(move);
}

function clone(value) {
  return structuredClone(value);
}

function initiative(combatant, dice) {
  const natural = dice.roll(20);
  const modifier = abilityModifier(combatant.attributes.dex);
  return { natural, modifier, total: natural + modifier };
}

function chooseOrder(player, opponent, playerInit, opponentInit) {
  if (playerInit.total !== opponentInit.total) {
    return playerInit.total > opponentInit.total ? ["player", "opponent"] : ["opponent", "player"];
  }
  if (player.attributes.dex !== opponent.attributes.dex) {
    return player.attributes.dex > opponent.attributes.dex ? ["player", "opponent"] : ["opponent", "player"];
  }
  return ["player", "opponent"];
}

function currentActor(battle) {
  return battle.order[battle.turnIndex];
}

function otherSide(side) {
  return side === "player" ? "opponent" : "player";
}

function activeModifier(sources, round) {
  return sources
    .filter((source) =>
      (source.startsRound == null || round >= source.startsRound) &&
      (source.expiresRound == null || round < source.expiresRound)
    )
    .reduce((sum, source) => sum + source.value, 0);
}

function addCappedModifier(sources, { source, value, expiresRound }, round, min, max) {
  const current = activeModifier(sources, round);
  const desired = Math.max(min, Math.min(max, current + value));
  const actual = desired - current;
  if (actual === 0) return 0;
  sources.push({ source, value: actual, expiresRound });
  return actual;
}

function addSourceCappedModifier(sources, { source, value, expiresRound }, round, min, max) {
  const ownSources = sources.filter((entry) => entry.source === source);
  const current = activeModifier(ownSources, round);
  const desired = Math.max(min, Math.min(max, current + value));
  const actual = desired - current;
  if (actual === 0) return 0;
  sources.push({ source, value: actual, expiresRound });
  return actual;
}

function tieredCombatBonus(level) {
  if (level >= 17) return 4;
  if (level >= 10) return 3;
  if (level >= 5) return 2;
  return 1;
}

function effectExpiryRound(move, round) {
  if (move.duration?.unit === "round") return round + Number(move.duration.value ?? 0);
  if (move.duration?.unit === "minute") return round + (Number(move.duration.value ?? 0) * 10);
  return null;
}

function weatherKind(environment, round = null) {
  const raw = environment?.weather;
  if (!raw) return null;
  if (
    raw &&
    typeof raw === "object" &&
    raw.expiresRound != null &&
    round != null &&
    round >= raw.expiresRound
  ) return null;
  const value = typeof raw === "string" ? raw : raw.kind;
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/^-|-$/g, "");
}

function weatherBallProfile(environment, round = null, zones = [], position = null) {
  const zoneWeather =
    position == null
      ? null
      : [...zones].reverse().find(
          (zone) =>
            ["hail", "sandstorm"].includes(zone.effect) &&
            zoneContains(zone, position)
        )?.effect ?? null;
  const kind = zoneWeather ?? weatherKind(environment, round);
  const profiles = {
    "harsh-sunlight": { type: "fire", multiplier: 2 },
    "sun": { type: "fire", multiplier: 2 },
    "sunny": { type: "fire", multiplier: 2 },
    "rain": { type: "water", multiplier: 2 },
    "rainfall": { type: "water", multiplier: 2 },
    "sandstorm": { type: "rock", multiplier: 2 },
    "hail": { type: "ice", multiplier: 2 },
    "snow": { type: "ice", multiplier: 2 },
    "snowstorm": { type: "ice", multiplier: 2 },
    "foggy": { type: "normal", multiplier: 2 },
    "cloudy": { type: "normal", multiplier: 2 }
  };
  return { kind, ...(profiles[kind] ?? { type: "normal", multiplier: 1 }) };
}

function effectiveAc(combatant, round, incomingMove = null) {
  const baseModifier = activeModifier(combatant.effects?.acModifierSources ?? [], round);
  const rangedModifier =
    incomingMove?.attack?.scope === "ranged"
      ? activeModifier(combatant.effects?.rangedAcModifierSources ?? [], round)
      : 0;
  return combatant.ac + baseModifier + rangedModifier;
}

function clearTypeOverride(combatant) {
  const override = combatant.effects?.typeOverride;
  if (!override) return null;
  const previousTypes = clone(combatant.types);
  combatant.types = clone(combatant.baseTypes ?? combatant.types);
  combatant.effects.typeOverride = null;
  return {
    source: override.source,
    previousTypes,
    restoredTypes: clone(combatant.types)
  };
}

function applyTypeOverride(
  combatant,
  { source, types, remainingTurns = null, expiresRound = null }
) {
  clearTypeOverride(combatant);
  combatant.types = clone(types);
  combatant.effects.typeOverride = {
    source,
    types: clone(types),
    remainingTurns,
    expiresRound
  };
  return clone(combatant.effects.typeOverride);
}

function hasActiveSource(sources = [], round) {
  return sources.some(
    (source) =>
      (source.usesRemaining == null || source.usesRemaining > 0) &&
      (source.startsRound == null || round >= source.startsRound) &&
      (source.expiresRound == null || round < source.expiresRound)
  );
}

function activeTypeImmunitySource(combatant, type, round) {
  return (combatant.effects?.typeImmunitySources ?? []).find(
    (source) =>
      source.type === type &&
      (source.startsRound == null || round >= source.startsRound) &&
      (source.expiresRound == null || round < source.expiresRound)
  )?.source ?? null;
}

function hasMoveTypeImmunity(combatant, type, round) {
  if (type === "ground" && combatant.abilityId === "levitate") return true;
  return activeTypeImmunitySource(combatant, type, round) != null;
}

function hasAttackAdvantageAgainst(combatant, target, round) {
  return (combatant.effects?.attackAdvantageSources ?? []).some((source) => {
    if (source.usesRemaining != null && source.usesRemaining <= 0) return false;
    if (source.startsRound != null && round < source.startsRound) return false;
    if (source.expiresRound != null && round >= source.expiresRound) return false;
    return source.targetCombatantId == null || source.targetCombatantId === target.combatantId;
  });
}

function consumeAttackAdvantageUse(combatant, target, round) {
  for (const source of combatant.effects?.attackAdvantageSources ?? []) {
    if (source.usesRemaining == null || source.usesRemaining <= 0) continue;
    if (source.startsRound != null && round < source.startsRound) continue;
    if (source.expiresRound != null && round >= source.expiresRound) continue;
    if (source.targetCombatantId != null && source.targetCombatantId !== target.combatantId) continue;
    source.usesRemaining -= 1;
    return source.source;
  }
  return null;
}

function consumeOneShotAttackSource(combatant, key, round, target = null) {
  for (const source of combatant.effects?.[key] ?? []) {
    if (source.usesRemaining == null || source.usesRemaining <= 0) continue;
    if (source.startsRound != null && round < source.startsRound) continue;
    if (source.expiresRound != null && round >= source.expiresRound) continue;
    if (
      source.targetCombatantId != null &&
      target?.combatantId !== source.targetCombatantId
    ) continue;
    source.usesRemaining -= 1;
    return source.source;
  }
  return null;
}

function removeEffectSource(combatant, source, round = null) {
  const speedSources = combatant.effects?.speedModifierSources ?? [];
  const speedBefore = round == null ? 0 : activeModifier(speedSources, round);
  for (const key of [
    "attackModifierSources",
    "incomingAttackBonusSources",
    "damageModifierSources",
    "acModifierSources",
    "rangedAcModifierSources",
    "speedModifierSources",
    "saveModifierSources",
    "saveAdvantageSources",
    "attackAdvantageSources",
    "damageResistanceSources",
    "damageReductionSources",
    "typeImmunitySources",
    "stabMultiplierSources",
    "criticalRangeBonusSources",
    "forcedHitSources",
    "forcedCriticalSources",
    "restrainedSources",
    "switchLockSources",
    "escapeLockSources",
    "movementLockSources",
    "moveLockSources",
    "statusImmunitySources",
    "statDropImmunitySources",
    "ongoingEffects"
  ]) {
    if (!Array.isArray(combatant.effects?.[key])) continue;
    combatant.effects[key] = combatant.effects[key].filter((entry) => entry.source !== source);
  }
  if (combatant.effects?.typeOverride?.source === source) {
    clearTypeOverride(combatant);
  }
  if (combatant.effects?.temporaryHpSource?.source === source) {
    combatant.temporaryHp = 0;
    combatant.effects.temporaryHpSource = null;
  }
  if (round != null && combatant.turn?.started) {
    const speedAfter = activeModifier(combatant.effects?.speedModifierSources ?? [], round);
    combatant.turn.movementRemaining = Math.max(
      0,
      combatant.turn.movementRemaining + speedAfter - speedBefore
    );
  }
}

function modifierRuleFor(move, level) {
  const tier = tieredCombatBonus(level);
  const rules = {
    "agility": { speed: 20 },
    "autotomize": { speed: 10, stackCaps: { speed: 30 } },
    "barrier": { ac: 2 },
    "bulk-up": { ac: tier, damage: tier },
    "calm-mind": { stabMultiplier: 2 },
    "coil": { attack: 1, damage: 1, ac: 1 },
    "cosmic-power": { saveAdvantage: true },
    "cotton-guard": { ac: 2 },
    "defend-order": { ac: tier },
    "defense-curl": {
      ac: 4,
      durationRounds: 1,
      resistance: { type: "normal", steps: 1 }
    },
    "dragon-dance": { attack: proficiencyBonus(level) },
    "focus-energy": { criticalRangeBonus: 2 },
    "geomancy": { speed: 10, attackAdvantage: true, saveAdvantage: true },
    "harden": { damageReduction: true, durationRounds: 1 },
    "hone-claws": { attack: 1, damage: 1, stackCap: 3 },
    "iron-defense": {
      ac: 6,
      resistance: { type: null, steps: 1 }
    },
    "kinesis": {
      speed: 20,
      speedTypes: ["walking", "flying", "swimming"],
      rangedAc: 2
    },
    "magnet-rise": { typeImmunity: "ground" },
    "meditate": { attack: tier, save: tier },
    "minimize": { ac: 2 },
    "no-retreat": {
      attackAdvantage: true,
      saveAdvantage: true,
      switchLock: true,
      escapeLock: true
    },
    "quiver-dance": { attack: 1, damage: 1, ac: level >= 10 ? 2 : 1 },
    "rock-polish": { ac: 2, speed: 20 },
    "shell-smash": { ac: -1, damage: proficiencyBonus(level) },
    "shift-gear": { attack: 1, damage: 1, speed: 10 },
    "tail-glow": { stabMultiplier: 2 },
    "victory-dance": {
      ac: level >= 10 ? 2 : 1,
      attack: level >= 10 ? 2 : 1,
      save: level >= 10 ? 2 : 1
    }
  };
  return rules[move.id] ?? null;
}

function moveSlot(move) {
  if (move.time?.unit === "action") return "actionAvailable";
  if (move.time?.unit === "bonus action") return "bonusActionAvailable";
  return null;
}

function statusFromText(text = "") {
  if (/badly poison/i.test(text)) return "BadlyPoisoned";
  if (/\bpoison(?:ed)?\b/i.test(text)) return "Poisoned";
  if (/\bburn(?:ed|t)?\b/i.test(text)) return "Burned";
  if (/\bparaly(?:ze|zed|sis)\b/i.test(text)) return "Paralysis";
  if (/\bfro(?:zen|ze)\b/i.test(text)) return "Frozen";
  if (/\b(?:fall|falls|put|puts)?\s*asleep\b|\bsleep condition\b/i.test(text)) return "Asleep";
  if (/\bconfus(?:e|ed|ion)\b/i.test(text)) return "Confused";
  if (/\bflinch(?:ed|es)?\b/i.test(text)) return "Flinched";
  return null;
}

function naturalStatusThreshold(move) {
  const text = move.description ?? "";
  const match = text.match(/natural(?: attack)? roll(?:s)?(?:\s+(?:of|is))?\s+(\d+)(?:\s+or\s+(?:higher|\d+))?/i);
  return match ? Number(match[1]) : null;
}

function failedSaveStatus(move, save) {
  if (save.success) return null;
  const status = statusFromText(move.description);
  if (!status) return null;

  const text = move.description ?? "";
  if (/fail(?:s|ed)? (?:the )?save by 5 or more/i.test(text) && save.total > save.dc - 5) {
    return null;
  }

  if (
    /(?:on|upon) (?:a )?(?:fail|failed save|failure)|must (?:make|succeed on).*\bor become|fail(?:s|ed)? .*become/i.test(text) ||
    /becom(?:e|es|ing)[^.]{0,160}\bon (?:a )?fail/i.test(text) ||
    /fail(?:s|ed)? (?:the )?save by 5 or more/i.test(text)
  ) {
    return status;
  }
  return null;
}

function attackHitStatus(move, natural) {
  const status = statusFromText(move.description);
  if (!status) return null;

  const threshold = naturalStatusThreshold(move);
  if (threshold != null) return natural >= threshold ? status : null;

  const text = move.description ?? "";
  if (/on (?:a )?(?:successful )?(?:attack|hit)[^.]{0,180}(?:become|becomes|becoming|caus(?:e|ing)|inflict)/i.test(text)) {
    return status;
  }
  return null;
}

const IMMEDIATE_HEALING_MOVES = new Set([
  "floral-healing",
  "heal-order",
  "heal-pulse",
  "jungle-healing",
  "life-dew",
  "milk-drink",
  "moonlight",
  "morning-sun",
  "recover",
  "shore-up",
  "soft-boiled",
  "synthesis"
]);

function isImmediateHealingMove(move) {
  return move.dice?.type === "healing" && IMMEDIATE_HEALING_MOVES.has(move.id);
}

const DELAYED_HEALING_MOVES = new Set([
  "rest",
  "wish"
]);

function isDelayedHealingMove(move) {
  return move.dice?.type === "healing" && DELAYED_HEALING_MOVES.has(move.id);
}

const ONGOING_HEALING_MOVES = new Set([
  "aqua-ring",
  "ingrain",
  "lunar-blessing"
]);

function isOngoingHealingMove(move) {
  return ONGOING_HEALING_MOVES.has(move.id);
}

function delayedHealingTargetSide(move, userSide, requestedTargetSide = null) {
  if (move.id === "rest") return userSide;
  return healingTargetSide(move, userSide, requestedTargetSide);
}

const OHKO_MOVES = new Set([
  "fissure",
  "guillotine",
  "horn-drill",
  "sheer-cold"
]);

function isOhkoMove(move) {
  return OHKO_MOVES.has(move.id);
}

const SAVE_HP_EFFECT_MOVES = new Set([
  "endeavor",
  "natures-madness",
  "pain-split",
  "ruination"
]);

function isSaveHpEffectMove(move) {
  return SAVE_HP_EFFECT_MOVES.has(move.id);
}

const STATUS_CURE_MOVES = new Set([
  "aromatherapy",
  "heal-bell",
  "purify",
  "refresh"
]);

function isStatusCureMove(move) {
  return STATUS_CURE_MOVES.has(move.id);
}

const SIMPLE_MODIFIER_MOVES = new Set([
  "agility",
  "autotomize",
  "barrier",
  "bulk-up",
  "calm-mind",
  "coil",
  "cosmic-power",
  "cotton-guard",
  "defend-order",
  "defense-curl",
  "dragon-dance",
  "focus-energy",
  "geomancy",
  "harden",
  "hone-claws",
  "iron-defense",
  "kinesis",
  "magnet-rise",
  "meditate",
  "minimize",
  "no-retreat",
  "quiver-dance",
  "rock-polish",
  "shell-smash",
  "shift-gear",
  "tail-glow",
  "victory-dance"
]);

function isSimpleModifierMove(move) {
  return SIMPLE_MODIFIER_MOVES.has(move.id);
}

const SPECIAL_SELF_MOVES = new Set([
  "acupressure",
  "charge",
  "clangorous-soul",
  "fillet-away",
  "healing-wish",
  "laser-focus",
  "lunar-dance",
  "mind-reader"
]);

function isSpecialSelfMove(move) {
  return SPECIAL_SELF_MOVES.has(move.id);
}

const SPECIAL_TARGET_MOVES = new Set([
  "lock-on"
]);

function isSpecialTargetMove(move) {
  return SPECIAL_TARGET_MOVES.has(move.id);
}

const TYPE_COPY_MOVES = new Set([
  "reflect-type"
]);

function isTypeCopyMove(move) {
  return TYPE_COPY_MOVES.has(move.id);
}

const STOCKPILE_MOVES = new Set([
  "stockpile",
  "swallow"
]);

function isStockpileMove(move) {
  return STOCKPILE_MOVES.has(move.id);
}

function healingTargetSide(move, userSide, requestedTargetSide = null) {
  if (move.range?.type === "self") return userSide;

  if (
    requestedTargetSide != null &&
    requestedTargetSide !== "player" &&
    requestedTargetSide !== "opponent"
  ) {
    throw new Error(`Invalid healing target side: ${requestedTargetSide}`);
  }

  const targetSide = requestedTargetSide ?? (move.id === "heal-pulse" ? otherSide(userSide) : userSide);
  if (move.id === "heal-pulse" && targetSide === userSide) {
    throw new Error("Heal Pulse cannot target its user");
  }
  return targetSide;
}

const STATEFUL_AUTO_DAMAGE_MOVES = new Set([
  "diamond-storm",
  "focus-punch",
  "outrage",
  "powder",
  "vital-throw"
]);

function isAutomaticDamageMove(move) {
  if (move.dice?.type !== "damage" || move.attack || move.save) return false;
  if (STATEFUL_AUTO_DAMAGE_MOVES.has(move.id)) return false;
  return /guaranteed to hit|automatically hits?|automatically deals?|instantly inflict|each hit for/i.test(
    move.description ?? ""
  );
}

function automaticDamageHitCount(move) {
  if (move.id === "hyperspace-fury") return 3;
  if (["swift", "tachyon-cutter"].includes(move.id)) return 2;
  return 1;
}

function requiresSleepingTarget(move) {
  return ["dream-eater", "nightmare"].includes(move.id);
}

function isSleepingTarget(combatant) {
  return (
    combatant.statuses?.nonVolatile === "Asleep" ||
    combatant.abilityId === "comatose"
  );
}

export function isMoveResolvable(move) {
  if (move.time?.unit === "reaction") return isSupportedReactionMove(move);
  if (isCanonicalSpecialMove(move)) return true;
  const damage = move.dice?.type === "damage";
  if (move.attack && damage) return true;
  if (move.save && damage) return true;
  if (isAutomaticDamageMove(move)) return true;
  if (isImmediateHealingMove(move)) return true;
  if (isDelayedHealingMove(move)) return true;
  if (isOngoingHealingMove(move)) return true;
  if (isOhkoMove(move)) return true;
  if (isSaveHpEffectMove(move)) return true;
  if (isStatusCureMove(move)) return true;
  if (isSimpleModifierMove(move)) return true;
  if (isSpecialSelfMove(move)) return true;
  if (isSpecialTargetMove(move)) return true;
  if (isTypeCopyMove(move)) return true;
  if (isStockpileMove(move)) return true;
  if (isEnvironmentMove(move)) return true;
  if (isFieldUtilityMove(move)) return true;
  if (isProtectionMove(move)) return true;
  if (isMoveControlMove(move)) return true;
  if (isWeatherZoneMove(move)) return true;
  if (SAVE_EFFECT_MOVES.has(move.id) || AREA_MOVES.has(move.id)) return true;
  if ((move.attack || move.save) && statusFromText(move.description)) return true;
  if (move.id === "struggle") return true;
  return false;
}

function defaultPosition(value, fallback) {
  if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) return point(value.x, value.y);
  return point(fallback.x, fallback.y);
}

function normalizeTrainer(trainer = {}, positionValue) {
  trainer ??= {};
  const level = trainer.level ?? trainer.trainerLevel ?? 1;
  const movement = {
    walking: 30,
    climbing: 0,
    swimming: 0,
    flying: 0,
    burrowing: 0,
    ...clone(trainer.movement ?? {})
  };
  const speed = Number(trainer.speed ?? movement.walking ?? 30);
  return {
    name: trainer.name ?? "Trainer",
    trainerClass: trainer.trainerClass ?? "pokemon-trainer",
    trainerPath: trainer.trainerPath ?? null,
    level,
    trainerLevel: level,
    trainerXp: Number(trainer.trainerXp ?? 0),
    abilities: clone(trainer.abilities ?? {
      STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10
    }),
    skills: clone(trainer.skills ?? []),
    proficiencies: clone(trainer.proficiencies ?? { skills: trainer.skills ?? [], expertise: [] }),
    savingThrows: clone(trainer.savingThrows ?? ["CHA"]),
    hp: clone(trainer.hp ?? { current: 8, max: 8 }),
    ac: Number(trainer.ac ?? 10),
    hitDice: clone(trainer.hitDice ?? { die: "d6", current: level, max: level }),
    classResources: clone(trainer.classResources ?? {}),
    classFeatures: clone(trainer.classFeatures ?? ["command-pokemon"]),
    feats: clone(trainer.feats ?? []),
    specializations: clone(trainer.specializations ?? {}),
    equipment: clone(trainer.equipment ?? []),
    trainerGear: clone(trainer.trainerGear ?? []),
    conditions: clone(trainer.conditions ?? []),
    featureUsage: clone(trainer.featureUsage ?? {}),
    persistentEffects: clone(trainer.persistentEffects ?? []),
    death: clone(trainer.death ?? {
      state: "alive",
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      stable: false
    }),
    inventory: clone(trainer.inventory ?? []),
    money: Number(trainer.money ?? 0),
    movement,
    position: defaultPosition(positionValue ?? trainer.position, { x: 0, y: 0 }),
    speed,
    movementRemaining: speed,
    actionAvailable: true,
    bonusActionAvailable: true,
    reactionAvailable: true
  };
}

function clearTransientEffects(combatant) {
  combatant.types = clone(combatant.baseTypes ?? combatant.types);
  combatant.temporaryHp = 0;
  combatant.effects = {
    attackModifierSources: [],
    attackDisadvantageSources: [],
    attackRollDiceSources: [],
    incomingAttackBonusSources: [],
    incomingAttackAdvantageSources: [],
    damageModifierSources: [],
    acModifierSources: [],
    rangedAcModifierSources: [],
    speedModifierSources: [],
    saveModifierSources: [],
    saveDisadvantageSources: [],
    saveRollDiceSources: [],
    targetSaveDisadvantageSources: [],
    saveAdvantageSources: [],
    attackAdvantageSources: [],
    damageResistanceSources: [],
    damageReductionSources: [],
    typeImmunitySources: [],
    stabMultiplierSources: [],
    criticalRangeBonusSources: [],
    forcedHitSources: [],
    forcedCriticalSources: [],
    restrainedSources: [],
    typeOverride: null,
    switchLockSources: [],
    escapeLockSources: [],
    movementLockSources: [],
    moveLockSources: [],
    statusImmunitySources: [],
    statDropImmunitySources: [],
    ongoingEffects: [],
    stockpileCount: 0,
    temporaryHpSource: null
  };
  combatant.concentration = null;
}

function benchForSide(battle, side) {
  return side === "player" ? (battle.playerBench ?? []) : (battle.opponentBench ?? []);
}

function healthyBenchIndices(battle, side = "player") {
  return benchForSide(battle, side)
    .map((combatant, index) => ({ combatant, index }))
    .filter(({ combatant }) => combatant.hp.current > 0)
    .map(({ index }) => index);
}

function applyPendingSwitchEffect(battle, side, incoming) {
  const effect = battle.pendingSwitchEffects?.[side];
  if (!effect) return null;

  const hpBefore = incoming.hp.current;
  const curedStatuses = [];
  for (const status of STATUS_IDS) {
    if (clearStatus(incoming, status)) curedStatuses.push(status);
  }

  if (effect.kind === "lunar-dance") {
    incoming.hp.current = incoming.hp.max;
  } else if (effect.kind === "healing-wish") {
    incoming.hp.current = Math.min(
      incoming.hp.max,
      incoming.hp.current + Number(effect.healing ?? 0)
    );
  }

  battle.pendingSwitchEffects[side] = null;
  const event = {
    type: "switch_healing_effect",
    round: battle.round,
    actor: side,
    moveId: effect.moveId,
    effect: effect.kind,
    targetSpeciesId: incoming.speciesId,
    curedStatuses,
    healing: incoming.hp.current - hpBefore,
    hpBefore,
    hpAfter: incoming.hp.current
  };
  battle.log.push(event);
  return event;
}

function forceOpponentReplacement(battle) {
  const benchIndex = chooseForcedOpponentReplacement(battle);
  if (benchIndex == null) return false;

  const outgoing = battle.opponent;
  const incoming = battle.opponentBench[benchIndex];
  const releasePosition = clone(outgoing.position ?? { x: 5, y: 0 });

  if (outgoing.hp.current <= 0) recallFaintedPokemon(outgoing);
  clearTransientEffects(outgoing);
  outgoing.position = null;
  outgoing.turn.started = false;
  outgoing.turn.movementRemaining = 0;

  battle.opponentBench[benchIndex] = outgoing;
  incoming.position = releasePosition;
  incoming.switchedInRound = battle.round;
  incoming.reactionAvailable = false;
  incoming.turn.started = true;
  incoming.turn.actionAvailable = false;
  incoming.turn.bonusActionAvailable = false;
  incoming.turn.disengaged = false;
  incoming.turn.movementRemaining = 0;
  battle.opponent = incoming;
  applyPendingSwitchEffect(battle, "opponent", incoming);

  battle.log.push({
    type: "switch",
    round: battle.round,
    actor: "opponent",
    forced: true,
    out: outgoing.speciesId,
    in: incoming.speciesId,
    releasePosition,
    provokesOpportunity: false,
    aiSelected: true,
    benchIndex
  });
  return true;
}

function endConcentrationState(battle, side, reason) {
  const combatant = battle[side];
  const concentration = combatant?.concentration;
  if (!concentration) return false;

  if (concentration.zoneId) {
    battle.zones = removeZone(battle.zones, concentration.zoneId);
  }
  const effectSources = [
    ...(Array.isArray(concentration.effectSources) ? concentration.effectSources : []),
    ...(concentration.effectSource ? [concentration.effectSource] : [])
  ];
  const effectTarget =
    concentration.effectTargetSide && battle[concentration.effectTargetSide]
      ? battle[concentration.effectTargetSide]
      : combatant;
  for (const source of new Set(effectSources)) {
    removeEffectSource(effectTarget, source, battle.round);
  }
  combatant.concentration = null;
  battle.log.push({
    type: "concentration_end",
    round: battle.round,
    actor: side,
    reason,
    zoneId: concentration.zoneId ?? null,
    moveId: concentration.moveId
  });
  return true;
}

function hpDamageAfterTemporaryHp(combatant, damage) {
  const incoming = Math.max(0, Number(damage) || 0);
  const available = Math.max(0, Number(combatant.temporaryHp ?? 0));
  const absorbed = Math.min(available, incoming);
  combatant.temporaryHp = available - absorbed;
  if (combatant.temporaryHp <= 0 && combatant.effects?.temporaryHpSource) {
    combatant.effects.temporaryHpSource = null;
  }
  return incoming - absorbed;
}

function applyDamageReduction(combatant, damage, dice, round) {
  const originalDamage = Math.max(0, Number(damage) || 0);
  let remaining = originalDamage;
  const reductions = [];

  for (const source of combatant.effects?.damageReductionSources ?? []) {
    if (remaining <= 0) break;
    if (source.startsRound != null && round < source.startsRound) continue;
    if (source.expiresRound != null && round >= source.expiresRound) continue;

    const roll = rollExpression(source.dice, dice);
    const rolledReduction = Math.max(0, roll.total + Number(source.modifier ?? 0));
    const appliedReduction = Math.min(remaining, rolledReduction);
    remaining -= appliedReduction;
    reductions.push({
      source: source.source,
      roll,
      modifier: Number(source.modifier ?? 0),
      rolledReduction,
      appliedReduction
    });
  }

  return {
    damageBeforeReduction: originalDamage,
    damage: remaining,
    damageReduction: originalDamage - remaining,
    reductions
  };
}

function activeCanonicalSource(source, round) {
  return (
    (source?.usesRemaining == null || source.usesRemaining > 0) &&
    (source?.startsRound == null || round >= source.startsRound) &&
    (source?.expiresRound == null || round < source.expiresRound)
  );
}

function tryAbsorbWithDuplicate(battle, defenderSide, move, dice) {
  const defender = battle[defenderSide];
  const attacker = battle[otherSide(defenderSide)];
  const sources = defender.effects?.duplicateSources ?? [];
  const source = sources.find((entry) => activeCanonicalSource(entry, battle.round) && entry.duplicates > 0);
  if (!source) return null;
  const width = Number(move.shape?.value ?? 0);
  if (move.shape && width > Number(source.maxWidth ?? 5)) return null;
  const attackerBlind = (attacker.effects?.blindedSources ?? []).some(
    (entry) => activeCanonicalSource(entry, battle.round)
  );
  const ignoresIllusions =
    attackerBlind ||
    Boolean(attacker.senses?.blindsight) ||
    Boolean(attacker.senses?.truesight);
  if (ignoresIllusions) return null;

  const rolls = Array.from({ length: source.duplicates }, () => dice.roll(Number(source.die ?? 6)));
  const avoided = rolls.some((roll) => roll >= Number(source.avoidOn ?? 4));
  if (avoided) {
    source.duplicates = Math.max(0, source.duplicates - 1);
    if (source.duplicates <= 0 && defender.concentration?.moveId === source.source) {
      endConcentrationState(battle, defenderSide, "duplicates_destroyed");
    }
  }
  return { avoided, rolls, remainingDuplicates: source.duplicates };
}

function applyCanonicalDamageShare(battle, damagedSide, damage) {
  if (!(damage > 0)) return [];
  const damaged = battle[damagedSide];
  const events = [];
  for (const source of damaged.effects?.damageShareSources ?? []) {
    if (!activeCanonicalSource(source, battle.round)) continue;
    const targetSide = source.targetSide;
    const target = battle[targetSide];
    if (!target) continue;
    if (source.targetCombatantId && target.combatantId !== source.targetCombatantId) continue;
    const sharedDamage = Math.max(0, Math.floor(damage * Number(source.fraction ?? 0.5)));
    if (sharedDamage <= 0) continue;
    target.hp.current = Math.max(0, target.hp.current - sharedDamage);
    const event = {
      type: "damage_share",
      round: battle.round,
      actor: damagedSide,
      target: targetSide,
      source: source.source,
      originalDamage: damage,
      sharedDamage,
      targetHpAfter: target.hp.current
    };
    battle.log.push(event);
    events.push(event);
    if (target.hp.current <= 0) markDowned(battle, targetSide, source.source ?? "damage_share");
  }
  return events;
}

function checkConcentrationAfterDamage(battle, side, damage, dice) {
  if (damage <= 0 || !battle[side]?.concentration) return null;

  const dc = Math.max(10, Math.floor(damage / 2));
  const save = resolveSavingThrow({
    defender: battle[side],
    attribute: "con",
    dc,
    dice,
    round: battle.round
  });

  battle.log.push({
    type: "concentration_check",
    round: battle.round,
    actor: side,
    damage,
    ...save
  });

  if (!save.success) endConcentrationState(battle, side, "failed_damage_save");
  return save;
}

function markDowned(battle, downedSide, reason) {
  endConcentrationState(battle, downedSide, "fainted");
  const death = faintPokemon(battle[downedSide], {
    sanctioned: Boolean(battle.sanctioned)
  });
  battle.log.push({
    type: "fainted",
    round: battle.round,
    actor: downedSide,
    reason,
    sanctioned: Boolean(battle.sanctioned),
    deathState: death.state
  });

  if (downedSide === "player" && healthyBenchIndices(battle, "player").length > 0) {
    battle.awaitingSwitch = "player";
    battle.log.push({
      type: "switch_required",
      round: battle.round,
      actor: "player",
      reason: "active_fainted"
    });
    return;
  }

  if (downedSide === "opponent" && forceOpponentReplacement(battle)) {
    return;
  }

  battle.outcome = downedSide === "player" ? "lose" : "win";
  battle.log.push({
    type: "combat_end",
    round: battle.round,
    outcome: battle.outcome,
    reason
  });
}

function advanceTurnIndex(battle) {
  battle.turnIndex += 1;
  if (battle.turnIndex >= battle.order.length) {
    battle.turnIndex = 0;
    battle.round += 1;
  }
}

function endTurnInternal(battle, side, dice) {
  const next = clone(battle);
  const combatant = next[side];
  const events = endTurnStatus(
    combatant,
    dice,
    proficiencyBonus(combatant.level),
    next.round
  );

  for (const event of events) {
    if (event.type === "status_damage" && event.damage > 0) {
      const reduced = applyDamageReduction(combatant, event.damage, dice, next.round);
      const restored = event.damage - reduced.damage;
      combatant.hp.current = Math.min(combatant.hp.max, combatant.hp.current + restored);
      event.damageBeforeReduction = reduced.damageBeforeReduction;
      event.damageReduction = reduced.damageReduction;
      event.reductions = reduced.reductions;
      event.damage = reduced.damage;
      event.hpAfter = combatant.hp.current;
      if (event.damage > 0) checkConcentrationAfterDamage(next, side, event.damage, dice);
    }
    next.log.push({ ...event, round: next.round, actor: side });
  }

  if (combatant.hp.current <= 0) {
    markDowned(next, side, "status_damage");
    return next;
  }

  const pending = next.pendingEffects ?? [];
  const remainingPending = [];
  for (const effect of pending) {
    const due =
      effect.phase === "end_turn" &&
      effect.sourceSide === side &&
      next.round >= effect.triggerRound;
    if (!due) {
      remainingPending.push(effect);
      continue;
    }

    if (effect.kind === "rest") {
      const sleepResult = applyStatus(combatant, "Asleep", {
        sourceProficiencyBonus: proficiencyBonus(combatant.level)
      });
      let healing = 0;
      let healingRoll = null;
      if (sleepResult.applied || isSleepingTarget(combatant)) {
        healingRoll = rollExpression(effect.healingDice, dice);
        const rawHealing = Math.max(0, healingRoll.total + effect.healingModifier);
        const before = combatant.hp.current;
        combatant.hp.current = Math.min(combatant.hp.max, before + rawHealing);
        healing = combatant.hp.current - before;
      }
      next.log.push({
        type: "delayed_healing",
        round: next.round,
        actor: side,
        moveId: effect.moveId,
        effect: "rest",
        sleepResult,
        healingRoll,
        healing,
        hpAfter: combatant.hp.current
      });
      continue;
    }

    if (effect.kind === "wish") {
      const source = next[effect.sourceSide];
      const target = next[effect.targetSide];
      const inRange =
        source?.position &&
        target?.position &&
        distance(source.position, target.position) <= effect.maxRange + 1e-9;
      let healing = 0;
      let healingRoll = null;
      if (inRange) {
        healingRoll = rollExpression(effect.healingDice, dice);
        const rawHealing = Math.max(0, healingRoll.total + effect.healingModifier);
        const before = target.hp.current;
        target.hp.current = Math.min(target.hp.max, before + rawHealing);
        healing = target.hp.current - before;
      }
      next.log.push({
        type: "delayed_healing",
        round: next.round,
        actor: side,
        target: effect.targetSide,
        moveId: effect.moveId,
        effect: "wish",
        inRange: Boolean(inRange),
        healingRoll,
        healing,
        hpAfter: target?.hp?.current ?? null
      });
      continue;
    }

    remainingPending.push(effect);
  }
  next.pendingEffects = remainingPending;

  const ongoingEffects = combatant.effects?.ongoingEffects ?? [];
  const remainingOngoing = [];
  for (const effect of ongoingEffects) {
    if (effect.kind === "aqua-ring") {
      if (effect.expiresRound != null && next.round >= effect.expiresRound) continue;
      const before = combatant.hp.current;
      combatant.hp.current = Math.min(
        combatant.hp.max,
        before + proficiencyBonus(combatant.level)
      );
      next.log.push({
        type: "ongoing_healing",
        round: next.round,
        actor: side,
        moveId: effect.moveId,
        effect: "aqua-ring",
        healing: combatant.hp.current - before,
        hpAfter: combatant.hp.current
      });
      remainingOngoing.push(effect);
      continue;
    }

    if (effect.kind !== "ingrain") {
      remainingOngoing.push(effect);
      continue;
    }

    const healingRoll = rollExpression(effect.healingDice, dice);
    const rawHealing = Math.max(0, healingRoll.total + effect.healingModifier);
    const before = combatant.hp.current;
    combatant.hp.current = Math.min(combatant.hp.max, before + rawHealing);
    const remainingEndTurns = effect.remainingEndTurns - 1;
    next.log.push({
      type: "ongoing_healing",
      round: next.round,
      actor: side,
      moveId: effect.moveId,
      effect: "ingrain",
      healingRoll,
      healing: combatant.hp.current - before,
      remainingEndTurns,
      hpAfter: combatant.hp.current
    });

    if (remainingEndTurns > 0) {
      remainingOngoing.push({ ...effect, remainingEndTurns });
    } else {
      combatant.effects.movementLockSources =
        (combatant.effects.movementLockSources ?? [])
          .filter((entry) => entry.source !== effect.source);
      combatant.effects.switchLockSources =
        (combatant.effects.switchLockSources ?? [])
          .filter((entry) => entry.source !== effect.source);
      combatant.effects.escapeLockSources =
        (combatant.effects.escapeLockSources ?? [])
          .filter((entry) => entry.source !== effect.source);
    }
  }
  combatant.effects.ongoingEffects = remainingOngoing;

  const typeOverride = combatant.effects?.typeOverride;
  if (typeOverride?.remainingTurns != null) {
    typeOverride.remainingTurns = Math.max(0, typeOverride.remainingTurns - 1);
    next.log.push({
      type: "type_override_tick",
      round: next.round,
      actor: side,
      source: typeOverride.source,
      remainingTurns: typeOverride.remainingTurns,
      types: clone(combatant.types)
    });
    if (typeOverride.remainingTurns === 0) {
      const ended = clearTypeOverride(combatant);
      next.log.push({
        type: "type_override_end",
        round: next.round,
        actor: side,
        reason: "duration",
        ...ended
      });
    }
  }

  combatant.turn.started = false;
  combatant.turn.actionAvailable = true;
  combatant.turn.bonusActionAvailable = true;
  combatant.turn.disengaged = false;
  combatant.turn.movementSpent = 0;
  combatant.movementMode ??= baseMovementSpeed(combatant).type;
  combatant.turn.movementRemaining = movementSpeedForType(combatant, combatant.movementMode, next.round).value;
  advanceTurnIndex(next);
  return next;
}

function secondaryStatusFor(move, natural) {
  return attackHitStatus(move, natural);
}

function damageMultiplierFor(move, defender, round = null) {
  return damageProfile(move, defender, round).multiplier;
}

function saveAllowsHalfDamage(move) {
  return /half (?:as much|damage)|half the damage/i.test(move.description ?? "");
}

function applyMoveStatus(attacker, defender, status, round = null) {
  if (!status) return null;
  if (hasActiveSource(defender.effects?.statusImmunitySources ?? [], round)) {
    const source = (defender.effects?.statusImmunitySources ?? []).find(
      (entry) =>
        (entry.startsRound == null || round == null || round >= entry.startsRound) &&
        (entry.expiresRound == null || round == null || round < entry.expiresRound)
    )?.source ?? null;
    return { applied: false, status, reason: "status_immunity", source };
  }
  const corrosion =
    attacker.abilityId === "corrosion" &&
    ["Poisoned", "BadlyPoisoned"].includes(status);
  return applyStatus(defender, status, {
    sourceProficiencyBonus: proficiencyBonus(attacker.level),
    ignoreTypeImmunity: corrosion
  });
}

function rollSaveMoveDamage(attacker, move, expression, dice) {
  let advantage = damageRollHasAdvantage(attacker, move);
  let disadvantage = damageHasDisadvantage(attacker);
  if (advantage && disadvantage) {
    advantage = false;
    disadvantage = false;
  }

  const first = rollExpression(expression, dice);
  if (!advantage && !disadvantage) {
    return { selected: first, attempts: [first], mode: "normal" };
  }

  const second = rollExpression(expression, dice);
  return {
    selected: advantage
      ? (first.total >= second.total ? first : second)
      : (first.total <= second.total ? first : second),
    attempts: [first, second],
    mode: advantage ? "advantage" : "disadvantage"
  };
}

function applySaveEffect(battle, side, move, saveResult) {
  const targetSide = otherSide(side);
  const target = battle[targetSide];
  if (saveResult.save.success) return null;

  const negativeStatMoves = new Set([
    "charm",
    "cotton-spore",
    "fake-tears",
    "feather-dance",
    "growl",
    "leer",
    "metal-sound",
    "sand-attack",
    "screech",
    "tail-whip",
    "tearful-look"
  ]);
  if (
    negativeStatMoves.has(move.id) &&
    hasActiveSource(target.effects?.statDropImmunitySources ?? [], battle.round)
  ) {
    const source = target.effects.statDropImmunitySources.find(
      (entry) =>
        (entry.startsRound == null || battle.round >= entry.startsRound) &&
        (entry.expiresRound == null || battle.round < entry.expiresRound)
    )?.source ?? null;
    return { effect: "blocked_stat_drop", source };
  }

  if (move.id === "growl") {
    const value = addCappedModifier(
      target.effects.attackModifierSources,
      { source: "growl", value: -1, expiresRound: battle.round + 10 },
      battle.round,
      -5,
      0
    );
    return { effect: "attack_modifier", value };
  }

  if (move.id === "leer" || move.id === "tail-whip") {
    const value = addCappedModifier(
      target.effects.incomingAttackBonusSources,
      { source: move.id, value: 1, expiresRound: battle.round + 10 },
      battle.round,
      0,
      5
    );
    return { effect: "incoming_attack_bonus", value };
  }

  if (move.id === "sand-attack") {
    const value = addCappedModifier(
      target.effects.attackModifierSources,
      { source: "sand-attack", value: -1, expiresRound: null },
      battle.round,
      -5,
      0
    );
    return { effect: "attack_modifier", value };
  }

  if (move.id === "hypnosis") {
    return {
      effect: "status",
      statusResult: applyMoveStatus(battle[side], target, "Asleep", battle.round)
    };
  }

  if (move.id === "cotton-spore") {
    const expiresRound = battle.round + 10;
    const beforeSpeed = movementSpeed(target, battle.round).value;
    target.effects.speedModifierSources.push({
      source: "cotton-spore",
      value: -10,
      expiresRound
    });
    const afterSpeed = movementSpeed(target, battle.round).value;
    const restrained = beforeSpeed > 0 && afterSpeed === 0;
    if (restrained) {
      target.effects.restrainedSources.push({
        source: "cotton-spore",
        expiresRound
      });
    }
    return {
      effect: "speed_modifier",
      value: -10,
      beforeSpeed,
      afterSpeed,
      restrained,
      expiresRound
    };
  }

  if (move.id === "charm") {
    const penalty = -(tieredCombatBonus(battle[side].level) + 1);
    const value = addSourceCappedModifier(
      target.effects.attackModifierSources,
      { source: "charm", value: penalty, expiresRound: battle.round + 10 },
      battle.round,
      -5,
      0
    );
    return { effect: "attack_modifier", value };
  }

  if (move.id === "fake-tears" || move.id === "metal-sound") {
    target.effects.incomingAttackBonusSources = target.effects.incomingAttackBonusSources
      .filter((entry) => entry.source !== move.id);
    target.effects.incomingAttackBonusSources.push({
      source: move.id,
      value: 5,
      expiresRound: battle.round + 2
    });
    return { effect: "incoming_attack_bonus", value: 5 };
  }

  if (move.id === "feather-dance") {
    const expiresRound = effectExpiryRound(move, battle.round);
    const penalty = -proficiencyBonus(target.level);
    removeEffectSource(target, move.id, battle.round);
    target.effects.attackModifierSources.push({
      source: move.id,
      value: penalty,
      expiresRound
    });
    endConcentrationState(battle, side, "new_concentration");
    battle[side].concentration = {
      zoneId: null,
      moveId: move.id,
      effectSource: move.id,
      effectTargetSide: targetSide,
      expiresRound
    };
    return {
      effect: "attack_modifier",
      value: penalty,
      expiresRound,
      concentration: true
    };
  }

  if (move.id === "mean-look") {
    const expiresRound = effectExpiryRound(move, battle.round);
    removeEffectSource(target, move.id, battle.round);
    target.effects.switchLockSources.push({
      source: move.id,
      expiresRound
    });
    target.effects.escapeLockSources.push({
      source: move.id,
      expiresRound
    });
    return {
      effect: "switch_escape_lock",
      expiresRound
    };
  }

  if (move.id === "screech") {
    const value = addSourceCappedModifier(
      target.effects.incomingAttackBonusSources,
      { source: "screech", value: 1, expiresRound: battle.round + 10 },
      battle.round,
      0,
      3
    );
    return { effect: "incoming_attack_bonus", value };
  }

  if (["forests-curse", "magic-powder", "soak", "trick-or-treat"].includes(move.id)) {
    const typeByMove = {
      "forests-curse": "grass",
      "magic-powder": "psychic",
      "soak": "water",
      "trick-or-treat": "ghost"
    };
    const turnsByMove = {
      "forests-curse": 3,
      "magic-powder": 10,
      "soak": 3,
      "trick-or-treat": 3
    };
    const override = applyTypeOverride(target, {
      source: move.id,
      types: [typeByMove[move.id]],
      remainingTurns: turnsByMove[move.id]
    });
    return {
      effect: "type_override",
      ...override
    };
  }

  if (move.id === "sweet-scent") {
    const attacker = battle[side];
    attacker.effects.attackAdvantageSources =
      (attacker.effects.attackAdvantageSources ?? []).filter(
        (entry) =>
          entry.source !== "sweet-scent" ||
          entry.targetCombatantId !== target.combatantId
      );
    attacker.effects.attackAdvantageSources.push({
      source: "sweet-scent",
      targetCombatantId: target.combatantId,
      usesRemaining: 2,
      expiresRound: null
    });
    return {
      effect: "attack_advantage",
      targetCombatantId: target.combatantId,
      usesRemaining: 2
    };
  }

  if (move.id === "tearful-look") {
    const value = addSourceCappedModifier(
      target.effects.attackModifierSources,
      { source: "tearful-look", value: -1, expiresRound: battle.round + 10 },
      battle.round,
      -5,
      0
    );
    return { effect: "attack_modifier", value };
  }

  throw new Error(`No save effect handler for ${move.id}`);
}

function normaliseBallName(value) {
  return String(value).toLowerCase().replace(/é/g, "e").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function findBallIndex(inventory, requested) {
  const wanted = normaliseBallName(requested);
  return inventory.findIndex((item) => {
    const value = typeof item === "string" ? item : item?.id ?? item?.name;
    const normalized = normaliseBallName(value);
    return normalized === wanted || (wanted === "pokeball" && normalized === "poke-ball");
  });
}

function rangeCheckForMove(attacker, defender, move, battlefield = null) {
  if (move.range?.type === "self" && move.shape?.value) {
    const actual = distance(attacker.position, defender.position);
    const max = move.shape.value;
    return {
      legal: actual <= max + 1e-9,
      distance: actual,
      maxRange: max,
      shape: move.shape.type
    };
  }

  if (move.id === "struggle") {
    const actual = distance(attacker.position, defender.position);
    return { legal: actual <= 60 + 1e-9, distance: actual, maxRange: 60 };
  }

  const result = canTargetMove(attacker, defender, move, battlefield);
  if (result.legal) return result;

  if (move.id === "quick-attack" && move.range?.type === "melee") {
    const actual = distance(attacker.position, defender.position);
    if (actual <= attacker.reach + 10 + 1e-9) {
      return { legal: true, distance: actual, maxRange: attacker.reach + 10, quickAttackStep: true };
    }
  }

  return result;
}

function zoneDamage(zone, target, dice, saveSucceeded = false, round = null) {
  const immuneByType =
    Array.isArray(zone.immuneTypes) &&
    zone.immuneTypes.some((type) => target.types?.includes(type));
  const rolled =
    zone.flatDamage == null && zone.damageDice
      ? rollExpression(zone.damageDice, dice)
      : null;
  const raw = immuneByType
    ? 0
    : Math.max(
        0,
        zone.flatDamage != null
          ? Number(zone.flatDamage)
          : Number(rolled?.total ?? 0) + Number(zone.damageModifier ?? 0)
      );
  const multiplier = raw > 0
    ? damageProfile({ type: zone.damageType }, target, round).multiplier
    : 1;
  let damage = multiplier === 0.5 ? Math.floor(raw / 2) : raw * multiplier;
  if (saveSucceeded && zone.effect === "smog") damage = Math.floor(damage / 2);
  return { rolled, raw, multiplier, damage, immuneByType };
}

function applyZoneExposure(battle, side, zone, dice, trigger = "turn_start") {
  const combatant = battle[side];
  combatant.turn.zoneExposureIds ??= [];
  if (combatant.turn.zoneExposureIds.includes(zone.id)) {
    return { applied: false, reason: "already_exposed_this_turn" };
  }
  combatant.turn.zoneExposureIds.push(zone.id);

  const save =
    !zone.noSave && zone.saveAttribute && Number.isFinite(zone.saveDc)
      ? resolveSavingThrow({
          defender: combatant,
          attribute: zone.saveAttribute,
          dc: zone.saveDc,
          dice,
          round: battle.round
        })
      : null;

  const damageInfo = zoneDamage(
    zone,
    combatant,
    dice,
    save?.success ?? false,
    battle.round
  );
  const reducedZoneDamage = applyDamageReduction(
    combatant,
    damageInfo.damage,
    dice,
    battle.round
  );
  damageInfo.damageBeforeReduction = reducedZoneDamage.damageBeforeReduction;
  damageInfo.damageReduction = reducedZoneDamage.damageReduction;
  damageInfo.reductions = reducedZoneDamage.reductions;
  damageInfo.damage = reducedZoneDamage.damage;
  combatant.hp.current = Math.max(
    0,
    combatant.hp.current - hpDamageAfterTemporaryHp(combatant, damageInfo.damage)
  );

  let statusResult = null;
  if (zone.effect === "poison-gas" && save && !save.success) {
    statusResult = applyMoveStatus(
      battle[zone.sourceSide],
      combatant,
      "Poisoned",
      battle.round
    );
  } else if (
    zone.effect === "smog" &&
    save &&
    !save.success &&
    save.total <= zone.saveDc - 5
  ) {
    statusResult = applyMoveStatus(
      battle[zone.sourceSide],
      combatant,
      "Poisoned",
      battle.round
    );
  }

  battle.log.push({
    type: "zone_tick",
    trigger,
    round: battle.round,
    actor: side,
    zoneId: zone.id,
    moveId: zone.moveId,
    save,
    damageRoll: damageInfo.rolled,
    rawDamage: damageInfo.raw,
    typeMultiplier: damageInfo.multiplier,
    damage: damageInfo.damage,
    immuneByType: damageInfo.immuneByType,
    hpAfter: combatant.hp.current,
    statusResult
  });

  checkConcentrationAfterDamage(battle, side, damageInfo.damage, dice);

  if (combatant.hp.current <= 0) {
    markDowned(battle, side, "zone_damage");
    return { applied: true, downed: true, damage: damageInfo.damage };
  }
  return { applied: true, downed: false, damage: damageInfo.damage };
}

function explicitMoveIds(descriptor) {
  const raw = descriptor.moveIds ?? descriptor.moves ?? descriptor.knownMoves ?? null;
  if (!Array.isArray(raw)) return null;
  const ids = raw.map((entry) => typeof entry === "string" ? entry : entry?.id).filter(Boolean);
  const unique = [...new Set(ids)];
  if (unique.length > 4) {
    throw new Error(`Pokémon 5e allows at most 4 known moves; received ${unique.length}`);
  }
  return unique;
}

async function selectKnownMoves(data, species, level, descriptor) {
  const explicit = explicitMoveIds(descriptor);
  if (explicit) {
    const result = [];
    for (const id of explicit) result.push(await data.getMove(id));
    return result;
  }

  // Upstream 2024: a Pokémon can know at most four moves. Wild/default
  // combatants use a deterministic selection from the level-legal pool so
  // save/reload never rerolls a moveset. Persisted/player-owned Pokémon should
  // carry explicit moveIds once their moveset has been chosen.
  const available = await data.getSupportedMoves(species, level);
  const executable = available.filter((move) => isMoveResolvable(move));

  // A complete upstream learnset can contain more than four legal moves at the
  // same level. Keep the legacy/default battle feel by taking the earliest
  // executable action moves, while reserving one slot for the most recently
  // learned bonus-action/reaction move when one exists. Persisted/player-owned
  // Pokémon still carry explicit moveIds, so their chosen moveset never shifts.
  if (executable.length > 0) {
    const actions = executable.filter((move) => move.time?.unit === "action");
    const supplemental = executable.filter((move) => move.time?.unit !== "action");
    const selected = actions.slice(0, supplemental.length > 0 ? 3 : 4);

    if (supplemental.length > 0) selected.push(supplemental.at(-1));
    for (const move of executable) {
      if (selected.length >= 4) break;
      if (!selected.some((entry) => entry.id === move.id)) selected.push(move);
    }
    return selected.slice(0, 4);
  }
  return available.slice(0, 4);
}

export class Pokemon5eCombatEngine {
  constructor({ data = new Poke5eDataRepository(), dice } = {}) {
    if (!dice) throw new Error("Pokemon5eCombatEngine requires a dice source");
    this.data = data;
    this.dice = dice;
  }

  async createCombatant(descriptor, positionValue = null) {
    const species = await this.data.getSpecies(descriptor);
    const level = descriptor.level ?? species.minLevel;
    const moves = await selectKnownMoves(this.data, species, level, descriptor);

    const normalAbilities = species.abilities.filter((ability) => !ability.hidden);
    const abilityId = descriptor.abilityId ?? normalAbilities[0]?.id ?? species.abilities[0]?.id ?? null;
    if (abilityId && !species.abilities.some((ability) => ability.id === abilityId)) {
      throw new Error(`${species.name} cannot use ability ${abilityId}`);
    }
    const ability = abilityId ? await this.data.getAbility(abilityId) : null;

    const canonicalMaxHp = scaledHp(species, level);
    const maxHp = descriptor.hp && Number.isFinite(descriptor.hp.max)
      ? Math.max(1, Math.floor(descriptor.hp.max))
      : canonicalMaxHp;
    const persistedHp = descriptor.hp && Number.isFinite(descriptor.hp.current)
      ? Math.max(0, Math.min(maxHp, Math.floor(descriptor.hp.current)))
      : maxHp;
    const statuses = createStatusState();
    if (descriptor.statuses && typeof descriptor.statuses === "object") {
      statuses.nonVolatile = descriptor.statuses.nonVolatile ?? null;
      statuses.remainingRounds = descriptor.statuses.remainingRounds ?? null;
      statuses.sourceProficiencyBonus = descriptor.statuses.sourceProficiencyBonus ?? null;
      statuses.confusedRounds = descriptor.statuses.confusedRounds ?? 0;
      statuses.flinchedTurns = descriptor.statuses.flinchedTurns ?? 0;
    }
    const moveIds = moves.map((move) => move.id);
    const maxPp = Object.fromEntries(moves.map((move) => [move.id, move.pp]));
    const pp = Object.fromEntries(moves.map((move) => {
      const persisted = descriptor.pp?.[move.id];
      return [
        move.id,
        Number.isFinite(persisted)
          ? Math.max(0, Math.min(move.pp, Math.floor(persisted)))
          : move.pp
      ];
    }));

    const combatant = {
      combatantId: descriptor.combatantId ?? null,
      speciesId: species.id,
      name: species.name,
      level,
      rosterIndex: Number.isInteger(descriptor.rosterIndex) ? descriptor.rosterIndex : null,
      sr: species.sr,
      size: species.size,
      baseTypes: clone(species.type),
      types: clone(Array.isArray(descriptor.types) ? descriptor.types : (Array.isArray(descriptor.type) ? descriptor.type : species.type)),
      speed: clone(descriptor.speed ?? species.speed ?? []),
      reach: reachForSize(species.size),
      position: defaultPosition(positionValue ?? descriptor.position, { x: 0, y: 0 }),
      ac: Number.isFinite(descriptor.ac) ? Number(descriptor.ac) : species.ac,
      hp: { current: persistedHp, max: maxHp },
      temporaryHp: Number.isFinite(descriptor.temporaryHp)
        ? Math.max(0, Math.floor(descriptor.temporaryHp))
        : 0,
      xp: Number.isFinite(descriptor.xp) ? Number(descriptor.xp) : null,
      attributes: clone(descriptor.attributes ?? species.attributes),
      savingThrows: clone(descriptor.savingThrows ?? species.savingThrows),
      proficiencies: clone(descriptor.proficiencies ?? species.skills ?? []),
      hitDice: clone(descriptor.hitDice ?? { die: species.hitDice, current: level, max: level }),
      bond: clone(descriptor.bond ?? null),
      gender: descriptor.gender ?? null,
      nature: descriptor.nature ?? null,
      evolutionHistory: clone(descriptor.evolutionHistory ?? []),
      pendingMoveLearning: clone(descriptor.pendingMoveLearning ?? []),
      pendingMoveChoices: clone(descriptor.pendingMoveChoices ?? []),
      pendingAsiChoices: clone(descriptor.pendingAsiChoices ?? []),
      pendingLevelUp: clone(descriptor.pendingLevelUp ?? null),
      declinedEvolutionAtLevel: descriptor.declinedEvolutionAtLevel ?? null,
      movementMode: descriptor.movementMode ?? null,
      abilityId,
      ability,
      heldItemId: descriptor.heldItemId ?? descriptor.heldItem?.id ?? null,
      abilityState: {
        intimidateAvailable: abilityId === "intimidate",
        flashFireCharged: false
      },
      reactionAvailable: true,
      switchedInRound: null,
      concentration: null,
      statuses,
      death: clone(descriptor.death ?? createPokemonDeathState()),
      effects: {
        attackModifierSources: [],
    attackDisadvantageSources: [],
    attackRollDiceSources: [],
        incomingAttackBonusSources: [],
    incomingAttackAdvantageSources: [],
        damageModifierSources: [],
        acModifierSources: [],
        rangedAcModifierSources: [],
        speedModifierSources: [],
        saveModifierSources: [],
    saveDisadvantageSources: [],
    saveRollDiceSources: [],
    targetSaveDisadvantageSources: [],
        saveAdvantageSources: [],
        attackAdvantageSources: [],
        damageResistanceSources: [],
        damageReductionSources: [],
        typeImmunitySources: [],
        stabMultiplierSources: [],
        criticalRangeBonusSources: [],
        forcedHitSources: [],
        forcedCriticalSources: [],
        restrainedSources: [],
        typeOverride: null,
        switchLockSources: [],
        escapeLockSources: [],
        movementLockSources: [],
        moveLockSources: [],
        statusImmunitySources: [],
        statDropImmunitySources: [],
        ongoingEffects: [],
        stockpileCount: 0,
    temporaryHpSource: null
      },
      turn: {
        started: false,
        actionAvailable: true,
        bonusActionAvailable: true,
        disengaged: false,
        movementRemaining: 0,
        movementSpent: 0
      },
      moveIds,
      maxPp,
      pp
    };

    combatant.movementMode ??= baseMovementSpeed(combatant).type;
    combatant.turn.movementRemaining = movementSpeedForType(combatant, combatant.movementMode).value;
    combatant.turn.movementSpent = 0;
    return combatant;
  }

  async createBattle(handoff) {
    const player = await this.createCombatant(
      handoff.playerPokemon,
      handoff.playerPosition ?? { x: 0, y: 0 }
    );
    const opponent = await this.createCombatant(
      handoff.opponent,
      handoff.opponentPosition ?? { x: 5, y: 0 }
    );
    player.combatantId ??= `${handoff.encounterId}:player:0`;
    opponent.combatantId ??= `${handoff.encounterId}:opponent:0`;

    const playerBench = [];
    for (const [index, descriptor] of (handoff.playerBench ?? []).entries()) {
      const reserve = await this.createCombatant(descriptor, { x: 0, y: 0 });
      reserve.combatantId ??= `${handoff.encounterId}:player:${index + 1}`;
      reserve.position = null;
      reserve.turn.movementRemaining = 0;
      playerBench.push(reserve);
    }

    const opponentBench = [];
    for (const [index, descriptor] of (handoff.opponentBench ?? []).entries()) {
      const reserve = await this.createCombatant(descriptor, { x: 5, y: 0 });
      reserve.combatantId ??= `${handoff.encounterId}:opponent:${index + 1}`;
      reserve.position = null;
      reserve.turn.movementRemaining = 0;
      opponentBench.push(reserve);
    }

    const playerInitiative = initiative(player, this.dice);
    const opponentInitiative = initiative(opponent, this.dice);
    const order = chooseOrder(player, opponent, playerInitiative, opponentInitiative);

    return {
      schemaVersion: 4,
      ruleset: "2024",
      encounterId: handoff.encounterId,
      round: 1,
      order,
      turnIndex: 0,
      initiative: {
        player: playerInitiative,
        opponent: opponentInitiative
      },
      trainer: normalizeTrainer(handoff.trainer, handoff.trainerPosition),
      opponentTrainer: handoff.opponentTrainer ? clone(handoff.opponentTrainer) : null,
      player,
      playerBench,
      opponent,
      opponentBench,
      opponentRegistered: Boolean(handoff.opponentRegistered),
      playerKnowledge: clone(handoff.playerKnowledge ?? { default: 0, active: 0, bench: 0 }),
      sanctioned: Boolean(handoff.sanctioned),
      flee: {
        lastAttemptRound: null,
        chase: null
      },
      awaitingSwitch: null,
      pendingSwitchEffects: {
        player: null,
        opponent: null
      },
      zones: [],
      pendingEffects: [],
      battlefield: clone(handoff.battlefield ?? {
        obstacles: [],
        terrain: [],
        waterRegions: [],
        underwater: false,
        burrowable: true
      }),
      environment: clone(handoff.environment ?? {}),
      outcome: null,
      log: [{
        type: "initiative",
        player: playerInitiative,
        opponent: opponentInitiative,
        order
      }]
    };
  }

  actor(battle) {
    if (battle.outcome || battle.awaitingSwitch) return null;
    return currentActor(battle);
  }

  canUseIntimidate(battle, side) {
    const combatant = battle[side];
    return (
      !battle.outcome &&
      !battle.awaitingSwitch &&
      combatant.abilityId === "intimidate" &&
      combatant.abilityState.intimidateAvailable &&
      combatant.reactionAvailable
    );
  }

  async prepareCurrentTurn(battle) {
    if (battle.outcome || battle.awaitingSwitch) return clone(battle);

    const next = clone(battle);
    const side = currentActor(next);
    const combatant = next[side];

    if (combatant.turn.started) return next;

    if (
      combatant.concentration?.expiresRound != null &&
      next.round >= combatant.concentration.expiresRound
    ) {
      endConcentrationState(next, side, "duration");
    }
    if (
      next.environment?.weather &&
      typeof next.environment.weather === "object" &&
      next.environment.weather.expiresRound != null &&
      next.round >= next.environment.weather.expiresRound
    ) {
      const expiredWeather = clone(next.environment.weather);
      next.environment.weather = null;
      next.log.push({
        type: "weather_end",
        round: next.round,
        weather: expiredWeather.kind,
        source: expiredWeather.source
      });
    }
    if (
      combatant.effects?.temporaryHpSource?.expiresRound != null &&
      next.round >= combatant.effects.temporaryHpSource.expiresRound
    ) {
      combatant.temporaryHp = 0;
      combatant.effects.temporaryHpSource = null;
    }

    combatant.turn.started = true;
    combatant.turn.actionAvailable = true;
    combatant.turn.bonusActionAvailable = true;
    combatant.turn.disengaged = false;
    combatant.turn.zoneExposureIds = [];
    combatant.movementMode ??= baseMovementSpeed(combatant).type;
    combatant.turn.movementSpent = 0;
    combatant.turn.movementRemaining = movementSpeedForType(combatant, combatant.movementMode, next.round).value;
    combatant.reactionAvailable = !reactionsDisabled(combatant);

    if (side === "player") {
      next.trainer.actionAvailable = true;
      next.trainer.bonusActionAvailable = true;
      next.trainer.reactionAvailable = true;
      next.trainer.movementRemaining = next.trainer.speed;
    }

    next.log.push({ type: "turn_start", round: next.round, actor: side });

    for (const effect of combatant.effects?.ongoingEffects ?? []) {
      if (effect.kind !== "lunar-blessing") continue;
      if (effect.expiresRound != null && next.round >= effect.expiresRound) continue;

      const healingRoll = rollExpression(effect.healingDice, this.dice);
      const rawHealing = Math.max(0, healingRoll.total + effect.healingModifier);
      const before = combatant.hp.current;
      combatant.hp.current = Math.min(combatant.hp.max, before + rawHealing);
      const curedStatuses = [];
      for (const status of STATUS_IDS) {
        if (clearStatus(combatant, status)) curedStatuses.push(status);
      }
      next.log.push({
        type: "ongoing_healing",
        round: next.round,
        actor: side,
        moveId: effect.moveId,
        effect: "lunar-blessing",
        healingRoll,
        healing: combatant.hp.current - before,
        curedStatuses,
        hpAfter: combatant.hp.current
      });
    }

    const expiry = expireZonesAtTurnStart(next.zones, side, next.round);
    next.zones = expiry.active;
    for (const zone of expiry.expired) {
      if (next[zone.sourceSide]?.concentration?.zoneId === zone.id) {
        next[zone.sourceSide].concentration = null;
      }
      next.log.push({
        type: "zone_end",
        round: next.round,
        zoneId: zone.id,
        moveId: zone.moveId,
        reason: "duration"
      });
    }

    for (const zone of next.zones) {
      if (!zoneContains(zone, combatant.position)) continue;
      const exposure = applyZoneExposure(next, side, zone, this.dice, "turn_start");
      if (exposure.downed) return next;
    }

    if (combatant.switchedInRound === next.round) {
      next.log.push({
        type: "turn_skipped",
        round: next.round,
        actor: side,
        reason: "switch_stabilization"
      });
      return endTurnInternal(next, side, this.dice);
    }

    const status = startTurnStatus(combatant, this.dice);
    if (status.rolls.length > 0 || status.statusEnded) {
      next.log.push({
        type: "status_start_check",
        round: next.round,
        actor: side,
        status: status.reason ?? status.statusEnded ?? combatant.statuses.nonVolatile ?? "Confused",
        rolls: status.rolls,
        skipTurn: status.skipTurn,
        forcedAction: status.forcedAction ?? null,
        statusEnded: status.statusEnded ?? null
      });
    }

    if (status.skipTurn) {
      next.log.push({
        type: "turn_skipped",
        round: next.round,
        actor: side,
        reason: status.reason
      });
      return endTurnInternal(next, side, this.dice);
    }

    if (status.forcedAction === "STRUGGLE_SELF") {
      next = await this.resolveStruggle(next, side, side, { automaticHit: true, reason: "confusion" });
      if (next.outcome || next.awaitingSwitch) return next;
      return endTurnInternal(next, side, this.dice);
    }
    if (status.forcedAction === "STRUGGLE_NEAREST") {
      next = await this.resolveStruggle(next, side, otherSide(side), { automaticHit: false, reason: "confusion" });
      if (next.outcome || next.awaitingSwitch) return next;
      return endTurnInternal(next, side, this.dice);
    }

    return next;
  }

  async legalMoves(battle, side) {
    const combatant = battle[side];
    const defender = battle[otherSide(side)];
    const result = [];

    for (const id of combatant.moveIds) {
      if ((combatant.pp[id] ?? 0) <= 0) continue;
      const move = await this.data.getMove(id);
      if (isMoveLocked(combatant, move, battle.round)) continue;
      const slot = moveSlot(move);
      if (!slot || !combatant.turn[slot]) continue;
      if (!isMoveResolvable(move)) continue;
      if (move.id === "endeavor" && battle.round === 1) continue;
      if (
        ["swallow", "spit-up"].includes(move.id) &&
        (combatant.effects?.stockpileCount ?? 0) <= 0
      ) continue;
      if (requiresSleepingTarget(move) && !isSleepingTarget(defender)) continue;
      const healTargetSide = isImmediateHealingMove(move)
        ? healingTargetSide(move, side)
        : null;
      const delayedHealTargetSide = isDelayedHealingMove(move)
        ? delayedHealingTargetSide(move, side)
        : null;
      const ongoingHealTargetSide = isOngoingHealingMove(move) ? side : null;
      const modifierTargetSide = isSimpleModifierMove(move) ? side : null;
      const fieldUtilityTargetSide = isFieldUtilityMove(move) ? side : null;
      const protectionTargetSide = isProtectionMove(move) ? side : null;
      const specialSelfTargetSide = isSpecialSelfMove(move) ? side : null;
      const specialTargetSide = isSpecialTargetMove(move) ? otherSide(side) : null;
      const rangeTarget = healTargetSide
        ? battle[healTargetSide]
        : delayedHealTargetSide
          ? battle[delayedHealTargetSide]
          : ongoingHealTargetSide
            ? battle[ongoingHealTargetSide]
            : modifierTargetSide
              ? battle[modifierTargetSide]
              : fieldUtilityTargetSide
                ? battle[fieldUtilityTargetSide]
                : protectionTargetSide
                  ? battle[protectionTargetSide]
                  : specialSelfTargetSide
                    ? battle[specialSelfTargetSide]
                    : specialTargetSide
                      ? battle[specialTargetSide]
                      : defender;
      if (!rangeCheckForMove(combatant, rangeTarget, move, battle.battlefield).legal) continue;
      result.push(move);
    }

    if (combatant.turn.actionAvailable) {
      const struggle = await this.data.getMove("struggle");
      if (rangeCheckForMove(combatant, defender, struggle, battle.battlefield).legal) result.push(struggle);
    }

    return result;
  }

  async availablePlayerMoves(battle) {
    if (this.actor(battle) !== "player") return [];
    return this.legalMoves(battle, "player");
  }

  async resolveAttackMove(next, side, move, { forceDisadvantage = false, reaction = false } = {}) {
    const attacker = next[side];
    const targetSide = otherSide(side);
    const defender = next[targetSide];
    const weatherProfile =
      move.id === "weather-ball"
        ? weatherBallProfile(
            next.environment,
            next.round,
            next.zones,
            attacker.position
          )
        : { type: move.type, multiplier: 1 };
    const effectiveMove =
      move.id === "weather-ball"
        ? { ...move, type: weatherProfile.type }
        : move;

    const attackBonus =
      activeModifier(attacker.effects.attackModifierSources, next.round) +
      activeModifier(defender.effects.incomingAttackBonusSources, next.round);
    const damageBonus = activeModifier(attacker.effects.damageModifierSources, next.round);
    const rangeProfile = rangeCheckForMove(attacker, defender, effectiveMove, next.battlefield);
    const coverAcBonus = Number.isFinite(rangeProfile.coverAcBonus) ? rangeProfile.coverAcBonus : 0;
    const defenderForResolution = {
      ...defender,
      ac: effectiveAc(defender, next.round, effectiveMove) + coverAcBonus
    };
    const movementMode = attacker.movementMode ?? baseMovementSpeed(attacker).type;
    const midFlight =
      movementMode === "flying" ||
      (movementMode === "hover" && Number(attacker.position?.z ?? 0) > 10);
    const flightRangeDisadvantage =
      midFlight &&
      effectiveMove.attack?.scope === "ranged" &&
      Number.isFinite(rangeProfile.maxRange) &&
      rangeProfile.distance > rangeProfile.maxRange / 2 + 1e-9;

    const flashFireWasCharged =
      attacker.abilityId === "flash-fire" &&
      attacker.abilityState.flashFireCharged &&
      effectiveMove.type === "fire";

    const stockpileMultiplier =
      (move.id === "spit-up"
        ? Math.max(1, attacker.effects?.stockpileCount ?? 0)
        : 1) * weatherProfile.multiplier;
    const forcedHitConsumed = consumeOneShotAttackSource(
      attacker,
      "forcedHitSources",
      next.round,
      defender
    );
    const forcedCriticalConsumed = consumeOneShotAttackSource(
      attacker,
      "forcedCriticalSources",
      next.round,
      defender
    );
    const result = resolveAttack({
      attacker,
      defender: defenderForResolution,
      move: effectiveMove,
      dice: this.dice,
      extraAttackModifier: attackBonus,
      extraDamageModifier: damageBonus,
      damageDiceMultiplier: stockpileMultiplier,
      forceDisadvantage: forceDisadvantage || flightRangeDisadvantage,
      forceHit: Boolean(forcedHitConsumed),
      forceCritical: Boolean(forcedCriticalConsumed),
      round: next.round
    });
    const attackAdvantageConsumed = consumeAttackAdvantageUse(
      attacker,
      defender,
      next.round
    );
    const trainerAttackModifierConsumed = consumeOneShotAttackSource(attacker, "attackModifierSources", next.round, defender);
    const trainerDamageModifierConsumed = result.hit ? consumeOneShotAttackSource(attacker, "damageModifierSources", next.round, defender) : null;
    const trainerDamageAdvantageConsumed = result.hit ? consumeOneShotAttackSource(attacker, "damageAdvantageSources", next.round, defender) : null;

    if (
      forcedCriticalConsumed === "laser-focus" &&
      attacker.concentration?.moveId === "laser-focus"
    ) {
      endConcentrationState(next, side, "consumed");
    }

    const duplicateInterception = result.hit
      ? tryAbsorbWithDuplicate(next, targetSide, effectiveMove, this.dice)
      : null;
    if (duplicateInterception?.avoided) result.damage = 0;

    const reducedAttackDamage = applyDamageReduction(
      defender,
      result.damage,
      this.dice,
      next.round
    );
    result.damageBeforeReduction = reducedAttackDamage.damageBeforeReduction;
    result.damageReduction = reducedAttackDamage.damageReduction;
    result.reductions = reducedAttackDamage.reductions;
    result.damage = reducedAttackDamage.damage;

    defender.hp.current = Math.max(0, defender.hp.current - hpDamageAfterTemporaryHp(defender, result.damage));
    const disciplined = next.trainerEffects?.disciplinedStrikes;
    let disciplinedStrikesConsumed = false;
    if (defender.hp.current <= 0 && disciplined?.usesRemaining > 0 && disciplined.targetSide === targetSide) {
      defender.hp.current = 1;
      disciplined.usesRemaining -= 1;
      disciplinedStrikesConsumed = true;
    }
    if (!duplicateInterception?.avoided) {
      checkConcentrationAfterDamage(next, targetSide, result.damage, this.dice);
      applyCanonicalDamageShare(next, targetSide, result.damage);
    }

    if (flashFireWasCharged) {
      attacker.abilityState.flashFireCharged = false;
    }

    if (result.hit && result.immunityAbility === "flash-fire") {
      defender.abilityState.flashFireCharged = true;
      next.log.push({
        type: "ability_trigger",
        round: next.round,
        actor: targetSide,
        abilityId: "flash-fire",
        trigger: move.id
      });
    }

    let statusResult = null;
    const thawed = result.hit && !duplicateInterception?.avoided
      ? endFrozenOnFireDamage(defender, effectiveMove, result.damage)
      : false;
    const secondary = result.hit && !duplicateInterception?.avoided && result.typeMultiplier > 0
      ? secondaryStatusFor(effectiveMove, result.natural)
      : null;
    if (secondary) statusResult = applyMoveStatus(attacker, defender, secondary, next.round);

    next.log.push({
      type: reaction ? "opportunity_attack" : "attack",
      round: next.round,
      actor: side,
      target: targetSide,
      ...result,
      attackAdvantageConsumed,
      trainerAttackModifierConsumed,
      trainerDamageModifierConsumed,
      trainerDamageAdvantageConsumed,
      forcedHitConsumed,
      forcedCriticalConsumed,
      weather: move.id === "weather-ball" ? weatherProfile.kind : null,
      cover: rangeProfile.cover ?? "none",
      coverAcBonus,
      flightRangeDisadvantage,
      duplicateInterception,
      secondaryStatus: secondary,
      statusResult,
      thawed,
      targetHpAfter: defender.hp.current,
      disciplinedStrikesConsumed
    });

    if (move.id === "spit-up") {
      const consumed = attacker.effects?.stockpileCount ?? 0;
      attacker.effects.stockpileCount = 0;
      removeEffectSource(attacker, "stockpile", next.round);
      next.log.push({
        type: "stockpile_consumed",
        round: next.round,
        actor: side,
        moveId: move.id,
        charges: consumed
      });
    }

    if (defender.hp.current <= 0) {
      markDowned(next, targetSide, reaction ? "opportunity_attack" : "move_damage");
    }

    return next;
  }

  async resolveStruggle(next, side, targetSide, { automaticHit = false, reason = null } = {}) {
    const attacker = next[side];
    const defender = next[targetSide];
    const move = await this.data.getMove("struggle");
    const attribute = ["str", "dex"].sort(
      (a, b) => attacker.attributes[b] - attacker.attributes[a]
    )[0];
    const moveModifier = abilityModifier(attacker.attributes[attribute]);
    const pb = proficiencyBonus(attacker.level);
    const roll = automaticHit
      ? { rolls: [], natural: null, mode: "automatic" }
      : rollD20(this.dice, {
          advantage:
            hasAttackAdvantageAgainst(attacker, defender, next.round) ||
            hasActiveSource(defender.effects?.restrainedSources ?? [], next.round),
          disadvantage:
            attackHasDisadvantage(attacker) ||
            hasActiveSource(attacker.effects?.restrainedSources ?? [], next.round)
        });
    const attackTotal = automaticHit ? null : roll.natural + pb + moveModifier;
    const attackAdvantageConsumed = automaticHit
      ? null
      : consumeAttackAdvantageUse(attacker, defender, next.round);
    const defenderAc = effectiveAc(defender, next.round, move);
    const hit = automaticHit || roll.natural === 20 ||
      (roll.natural !== 1 && attackTotal >= defenderAc);
    const baseDamage = hit ? Math.max(0, 2 + moveModifier) : 0;
    const reducedStruggleDamage = applyDamageReduction(
      defender,
      baseDamage,
      this.dice,
      next.round
    );
    const damage = reducedStruggleDamage.damage;

    defender.hp.current = Math.max(0, defender.hp.current - hpDamageAfterTemporaryHp(defender, damage));
    applyCanonicalDamageShare(next, targetSide, damage);
    if (targetSide !== side) checkConcentrationAfterDamage(next, targetSide, damage, this.dice);
    else checkConcentrationAfterDamage(next, side, damage, this.dice);

    next.log.push({
      type: "struggle",
      round: next.round,
      actor: side,
      target: targetSide,
      reason,
      attribute,
      proficiencyBonus: pb,
      moveModifier,
      attackRoll: roll,
      attackTotal,
      attackAdvantageConsumed,
      defenderAc,
      hit,
      damageBeforeReduction: reducedStruggleDamage.damageBeforeReduction,
      damageReduction: reducedStruggleDamage.damageReduction,
      reductions: reducedStruggleDamage.reductions,
      damage,
      targetHpAfter: defender.hp.current
    });

    if (defender.hp.current <= 0) {
      markDowned(next, targetSide, reason === "confusion" ? "confusion_struggle" : "struggle");
    }
    return next;
  }

  async resolveStatusAttackMove(next, side, move, { forceDisadvantage = false } = {}) {
    const attacker = next[side];
    const targetSide = otherSide(side);
    const defender = next[targetSide];
    const stats = calculateMoveStats(attacker, move);
    const attackBonus =
      activeModifier(attacker.effects.attackModifierSources, next.round) +
      activeModifier(defender.effects.incomingAttackBonusSources, next.round);
    const forcedHitConsumed = consumeOneShotAttackSource(
      attacker,
      "forcedHitSources",
      next.round,
      defender
    );
    const forcedCriticalConsumed = consumeOneShotAttackSource(
      attacker,
      "forcedCriticalSources",
      next.round,
      defender
    );
    const roll = rollD20(this.dice, {
      advantage:
        hasAttackAdvantageAgainst(attacker, defender, next.round) ||
        hasActiveSource(defender.effects?.restrainedSources ?? [], next.round),
      disadvantage:
        forceDisadvantage ||
        attackHasDisadvantage(attacker) ||
        hasActiveSource(attacker.effects?.restrainedSources ?? [], next.round)
    });
    const attackModifier = stats.toHit + attackBonus;
    const attackTotal = roll.natural + attackModifier;
    const attackAdvantageConsumed = consumeAttackAdvantageUse(
      attacker,
      defender,
      next.round
    );
    const defenderAc = effectiveAc(defender, next.round, move);
    const critical = Boolean(forcedCriticalConsumed) || roll.natural === 20;
    const hit = Boolean(forcedHitConsumed) || critical ||
      (roll.natural !== 1 && attackTotal >= defenderAc);
    if (
      forcedCriticalConsumed === "laser-focus" &&
      attacker.concentration?.moveId === "laser-focus"
    ) {
      endConcentrationState(next, side, "consumed");
    }
    const status = hit ? attackHitStatus(move, roll.natural) : null;
    const statusResult = applyMoveStatus(attacker, defender, status, next.round);

    next.log.push({
      type: "status_attack",
      round: next.round,
      actor: side,
      target: targetSide,
      moveId: move.id,
      moveName: move.name,
      attackRoll: roll,
      attackModifier,
      attackTotal,
      attackAdvantageConsumed,
      defenderAc,
      hit,
      critical,
      forcedHitConsumed,
      forcedCriticalConsumed,
      status,
      statusResult
    });
    return next;
  }

  async resolveStatusCureMove(next, side, move) {
    const user = next[side];
    const targetSide = move.id === "purify" ? otherSide(side) : side;
    const target = next[targetSide];
    const curedStatuses = [];

    if (move.id === "refresh") {
      for (const status of ["Poisoned", "BadlyPoisoned", "Paralysis", "Burned"]) {
        if (clearStatus(target, status)) curedStatuses.push(status);
      }
    } else if (move.id === "purify" || ["aromatherapy", "heal-bell"].includes(move.id)) {
      for (const status of STATUS_IDS) {
        if (clearStatus(target, status)) curedStatuses.push(status);
      }
    }

    const hpBefore = user.hp.current;
    if (move.id === "purify" && curedStatuses.length > 0) {
      user.hp.current = Math.min(user.hp.max, user.hp.current + (user.level * 2));
    }

    next.log.push({
      type: "status_cure_move",
      round: next.round,
      actor: side,
      target: targetSide,
      moveId: move.id,
      moveName: move.name,
      curedStatuses,
      healing: user.hp.current - hpBefore,
      actorHpBefore: hpBefore,
      actorHpAfter: user.hp.current
    });
    return next;
  }

  async resolveSaveHpEffectMove(next, side, move) {
    const attacker = next[side];
    const targetSide = otherSide(side);
    const defender = next[targetSide];
    const stats = calculateMoveStats(attacker, move);
    const save = resolveSavingThrow({
      defender,
      attribute: stats.saveAttribute,
      dc: stats.saveDc,
      dice: this.dice,
      round: next.round
    });

    const before = {
      actorHp: attacker.hp.current,
      targetHp: defender.hp.current,
      targetMaxHp: defender.hp.max
    };
    let hpLoss = 0;
    let targetHpAfter = defender.hp.current;
    let actorHpAfter = attacker.hp.current;
    let targetMaxHpAfter = defender.hp.max;

    if (!save.success) {
      if (move.id === "endeavor") {
        const desiredReduction = Math.max(0, defender.hp.current - attacker.hp.current);
        hpLoss = Math.min(desiredReduction, defender.level * 5);
        defender.hp.current = Math.max(0, defender.hp.current - hpDamageAfterTemporaryHp(defender, hpLoss));
      } else if (move.id === "natures-madness") {
        hpLoss = Math.max(1, Math.floor(defender.hp.current / 2));
        defender.hp.current = Math.max(0, defender.hp.current - hpDamageAfterTemporaryHp(defender, hpLoss));
      } else if (move.id === "pain-split") {
        const sharedHp = Math.floor((attacker.hp.current + defender.hp.current) / 2);
        attacker.hp.current = Math.min(attacker.hp.max, sharedHp);
        defender.hp.current = Math.min(defender.hp.max, sharedHp);
      } else if (move.id === "ruination") {
        hpLoss = Math.max(1, Math.floor(defender.hp.current / 2));
        defender.hp.current = Math.max(0, defender.hp.current - hpDamageAfterTemporaryHp(defender, hpLoss));
        defender.hp.max = Math.max(1, defender.hp.max - hpLoss);
        defender.hp.current = Math.min(defender.hp.current, defender.hp.max);
      }
    }

    targetHpAfter = defender.hp.current;
    actorHpAfter = attacker.hp.current;
    targetMaxHpAfter = defender.hp.max;

    next.log.push({
      type: "save_hp_effect",
      round: next.round,
      actor: side,
      target: targetSide,
      moveId: move.id,
      moveName: move.name,
      save,
      hpLoss,
      actorHpBefore: before.actorHp,
      actorHpAfter,
      targetHpBefore: before.targetHp,
      targetHpAfter,
      targetMaxHpBefore: before.targetMaxHp,
      targetMaxHpAfter
    });

    if (defender.hp.current <= 0) markDowned(next, targetSide, "move_hp_effect");
    return next;
  }

  async resolveOhkoMove(next, side, move) {
    const attacker = next[side];
    const targetSide = otherSide(side);
    const defender = next[targetSide];
    const natural = this.dice.roll(20);
    const levelBlocked = defender.level >= attacker.level + 10;
    const fissureBlocked =
      move.id === "fissure" &&
      (defender.types.includes("flying") || defender.abilityId === "levitate");
    const success = natural === 20 && !levelBlocked && !fissureBlocked;

    if (success) defender.hp.current = 0;

    next.log.push({
      type: "ohko_move",
      round: next.round,
      actor: side,
      target: targetSide,
      moveId: move.id,
      moveName: move.name,
      natural,
      levelBlocked,
      fissureBlocked,
      success,
      targetHpAfter: defender.hp.current
    });

    if (success) markDowned(next, targetSide, "ohko_move");
    return next;
  }

  async resolveHealingMove(next, side, targetSide, move) {
    const user = next[side];
    const target = next[targetSide];
    const stats = calculateMoveStats(user, move);
    const healingRoll = rollExpression(stats.damageDice, this.dice);
    const rawHealing = Math.max(0, healingRoll.total + stats.damageModifier);
    const timeOfDay = String(next.environment?.timeOfDay ?? "").toLowerCase();
    const environmentalMultiplier =
      (move.id === "moonlight" && timeOfDay === "day") ||
      (move.id === "morning-sun" && timeOfDay === "night")
        ? 0.5
        : 1;
    const adjustedHealing = Math.floor(rawHealing * environmentalMultiplier);
    const before = target.hp.current;
    target.hp.current = Math.min(target.hp.max, target.hp.current + adjustedHealing);

    const curedStatuses = [];
    if (move.id === "jungle-healing") {
      for (const status of STATUS_IDS) {
        if (clearStatus(target, status)) curedStatuses.push(status);
      }
    }

    next.log.push({
      type: "healing_move",
      round: next.round,
      actor: side,
      target: targetSide,
      moveId: move.id,
      moveName: move.name,
      healingRoll,
      healingModifier: stats.damageModifier,
      environmentalMultiplier,
      healing: target.hp.current - before,
      hpBefore: before,
      hpAfter: target.hp.current,
      curedStatuses
    });
    return next;
  }

  async resolveMoveControlMove(next, side, move) {
    const targetSide = otherSide(side);
    const user = next[side];
    const target = next[targetSide];
    const result = resolveSaveMove({
      attacker: user,
      defender: target,
      move,
      dice: this.dice,
      round: next.round
    });

    let applied = null;
    if (!result.save.success) {
      const expiresRound = effectExpiryRound(move, next.round);
      removeEffectSource(target, move.id, next.round);

      if (move.id === "disable") {
        const disabledMoveId = target.lastMoveId ?? null;
        if (disabledMoveId) {
          target.effects.moveLockSources.push({
            source: move.id,
            moveIds: [disabledMoveId],
            expiresRound
          });
          applied = { kind: "move_lock", moveIds: [disabledMoveId], expiresRound };
        } else {
          applied = { kind: "no_last_move", moveIds: [], expiresRound };
        }
      } else if (move.id === "imprison") {
        const shared = target.moveIds.filter((id) => user.moveIds.includes(id));
        if (shared.length > 0) {
          target.effects.moveLockSources.push({
            source: move.id,
            moveIds: shared,
            expiresRound
          });
        }
        applied = { kind: "shared_move_lock", moveIds: shared, expiresRound };
      } else if (move.id === "taunt") {
        target.effects.moveLockSources.push({
          source: move.id,
          nonDamagingAttacks: true,
          targetCombatantId: user.combatantId,
          expiresRound
        });
        applied = {
          kind: "damaging_attacks_only",
          targetCombatantId: user.combatantId,
          expiresRound
        };
      }

      if (move.duration?.concentration && applied?.kind !== "no_last_move") {
        endConcentrationState(next, side, "new_concentration");
        user.concentration = {
          zoneId: null,
          moveId: move.id,
          effectSource: move.id,
          effectTargetSide: targetSide,
          expiresRound
        };
      }
    }

    next.log.push({
      type: "move_control",
      round: next.round,
      actor: side,
      target: targetSide,
      moveId: move.id,
      save: result.save,
      applied,
      concentration: Boolean(user.concentration?.moveId === move.id)
    });
    return next;
  }

  async resolveWeatherZoneMove(next, side, move, center) {
    const attacker = next[side];
    const zoneId = `${next.encounterId}:${move.id}:${next.round}:${next.log.length}`;
    const damageType = move.id === "hail" ? "ice" : "rock";
    const immuneTypes =
      move.id === "hail"
        ? ["ice"]
        : ["rock", "steel", "ground"];

    endConcentrationState(next, side, "new_concentration");
    const zone = createCircleZone({
      id: zoneId,
      moveId: move.id,
      sourceSide: side,
      center,
      radius: 50,
      createdRound: next.round,
      expiresRound: effectExpiryRound(move, next.round),
      concentration: true,
      saveDc: null,
      saveAttribute: null,
      damageDice: null,
      damageModifier: 0,
      damageType,
      effect: move.id,
      flatDamage: Math.ceil(attacker.level / 2),
      immuneTypes,
      noSave: true
    });
    next.zones.push(zone);
    attacker.concentration = {
      zoneId,
      moveId: move.id,
      expiresRound: zone.expiresRound
    };
    next.log.push({
      type: "zone_created",
      round: next.round,
      actor: side,
      zone: clone(zone)
    });
    return next;
  }

  async resolveProtectionMove(next, side, targetSide, move) {
    const target = next[targetSide];
    const expiresRound = effectExpiryRound(move, next.round);
    removeEffectSource(target, move.id, next.round);

    if (move.id === "safeguard") {
      target.effects.statusImmunitySources.push({ source: move.id, expiresRound });
      next.log.push({
        type: "protection_move",
        round: next.round,
        actor: side,
        target: targetSide,
        moveId: move.id,
        protection: "status_immunity",
        expiresRound
      });
      return next;
    }

    if (move.id === "mist") {
      target.effects.statDropImmunitySources.push({ source: move.id, expiresRound });
      next.log.push({
        type: "protection_move",
        round: next.round,
        actor: side,
        target: targetSide,
        moveId: move.id,
        protection: "negative_stat_immunity",
        expiresRound
      });
      return next;
    }

    throw new Error(`No protection handler for ${move.id}`);
  }

  async resolveFieldUtilityMove(next, side, move) {
    const user = next[side];
    const radius = Number(move.shape?.value ?? 0);

    if (move.id === "defog") {
      const removed = next.zones.filter(
        (zone) => distance(user.position, zone.center) <= radius + Number(zone.radius ?? 0) + 1e-9
      );
      const removedIds = new Set(removed.map((zone) => zone.id));
      for (const zone of removed) {
        if (next[zone.sourceSide]?.concentration?.zoneId === zone.id) {
          endConcentrationState(next, zone.sourceSide, "defog");
        }
      }
      next.zones = next.zones.filter((zone) => !removedIds.has(zone.id));

      const currentWeather = weatherKind(next.environment, next.round);
      const weatherCleared = ["foggy", "cloudy", "fog"].includes(currentWeather);
      if (weatherCleared) next.environment.weather = null;

      next.log.push({
        type: "field_utility",
        round: next.round,
        actor: side,
        moveId: move.id,
        removedZoneIds: [...removedIds],
        weatherCleared
      });
      return next;
    }

    if (move.id === "haze") {
      const affected = [];
      for (const targetSide of ["player", "opponent"]) {
        const target = next[targetSide];
        if (!target?.position) continue;
        if (distance(user.position, target.position) > radius + 1e-9) continue;

        const speedBefore = movementSpeed(target, next.round).value;
        endConcentrationState(next, targetSide, "haze");
        const clearedStatuses = [];
        for (const status of STATUS_IDS) {
          if (clearStatus(target, status)) clearedStatuses.push(status);
        }
        clearTransientEffects(target);
        const speedAfter = movementSpeed(target, next.round).value;
        if (target.turn?.started) {
          target.turn.movementRemaining = Math.max(
            0,
            target.turn.movementRemaining + speedAfter - speedBefore
          );
        }
        affected.push({
          side: targetSide,
          clearedStatuses,
          speedBefore,
          speedAfter
        });
      }
      next.log.push({
        type: "field_utility",
        round: next.round,
        actor: side,
        moveId: move.id,
        affected
      });
      return next;
    }

    if (move.id === "fairy-lock") {
      const expiresRound = effectExpiryRound(move, next.round);
      const affected = [];
      for (const targetSide of ["player", "opponent"]) {
        const target = next[targetSide];
        if (!target?.position) continue;
        if (distance(user.position, target.position) > radius + 1e-9) continue;
        removeEffectSource(target, move.id, next.round);
        target.effects.switchLockSources.push({ source: move.id, expiresRound });
        target.effects.escapeLockSources.push({ source: move.id, expiresRound });
        affected.push(targetSide);
      }
      next.log.push({
        type: "field_utility",
        round: next.round,
        actor: side,
        moveId: move.id,
        affected,
        expiresRound
      });
      return next;
    }

    throw new Error(`No field utility handler for ${move.id}`);
  }

  async resolveEnvironmentMove(next, side, move) {
    const kindByMove = {
      "rain-dance": "rain",
      "sunny-day": "harsh-sunlight"
    };
    const kind = kindByMove[move.id];
    if (!kind) throw new Error(`No environment handler for ${move.id}`);
    const previous = clone(next.environment?.weather ?? null);
    next.environment ??= {};
    next.environment.weather = {
      kind,
      source: move.id,
      sourceSide: side,
      startedRound: next.round,
      expiresRound: effectExpiryRound(move, next.round)
    };
    next.log.push({
      type: "weather_change",
      round: next.round,
      actor: side,
      moveId: move.id,
      previous,
      weather: clone(next.environment.weather)
    });
    return next;
  }

  async resolveSpecialTargetMove(next, side, move) {
    const attacker = next[side];
    const targetSide = otherSide(side);
    const defender = next[targetSide];

    if (move.id === "lock-on") {
      removeEffectSource(attacker, move.id, next.round);
      attacker.effects.forcedHitSources.push({
        source: move.id,
        targetCombatantId: defender.combatantId,
        usesRemaining: 1,
        startsRound: next.round + 1,
        expiresRound: next.round + 2
      });
      next.log.push({
        type: "special_target_move",
        round: next.round,
        actor: side,
        target: targetSide,
        moveId: move.id,
        targetCombatantId: defender.combatantId,
        applied: {
          forcedHitUses: 1,
          startsRound: next.round + 1,
          expiresRound: next.round + 2
        }
      });
      return next;
    }

    throw new Error(`No special target handler for ${move.id}`);
  }

  async resolveTypeCopyMove(next, side, move) {
    const combatant = next[side];
    const targetSide = otherSide(side);
    const target = next[targetSide];

    if (move.id === "reflect-type") {
      endConcentrationState(next, side, "new_concentration");
      const expiresRound = effectExpiryRound(move, next.round);
      const override = applyTypeOverride(combatant, {
        source: move.id,
        types: target.types,
        expiresRound
      });
      combatant.concentration = {
        zoneId: null,
        moveId: move.id,
        effectSource: move.id,
        expiresRound
      };
      next.log.push({
        type: "type_copy_move",
        round: next.round,
        actor: side,
        target: targetSide,
        moveId: move.id,
        copiedTypes: clone(target.types),
        override,
        concentration: true
      });
      return next;
    }

    throw new Error(`No type copy handler for ${move.id}`);
  }

  async resolveStockpileMove(next, side, move) {
    const combatant = next[side];
    combatant.effects.stockpileCount ??= 0;

    if (move.id === "stockpile") {
      if (combatant.effects.stockpileCount >= 3) {
        throw new Error("Stockpile is already at its maximum of 3 charges");
      }
      combatant.effects.stockpileCount += 1;
      addSourceCappedModifier(
        combatant.effects.acModifierSources,
        { source: "stockpile", value: 1, expiresRound: null },
        next.round,
        0,
        3
      );
      next.log.push({
        type: "stockpile",
        round: next.round,
        actor: side,
        charges: combatant.effects.stockpileCount
      });
      return next;
    }

    if (move.id === "swallow") {
      const charges = combatant.effects.stockpileCount;
      if (charges <= 0) throw new Error("Swallow requires at least one Stockpile charge");
      const stats = calculateMoveStats(combatant, move);
      const baseExpression = stats.damageDice;
      const match = /^(\d+)d(\d+)$/.exec(baseExpression);
      if (!match) throw new Error(`Unsupported Swallow dice expression: ${baseExpression}`);
      const multipliedExpression = `${Number(match[1]) * charges}d${match[2]}`;
      const healingRoll = rollExpression(multipliedExpression, this.dice);
      const rawHealing = Math.max(0, healingRoll.total + stats.damageModifier);
      const before = combatant.hp.current;
      combatant.hp.current = Math.min(combatant.hp.max, before + rawHealing);
      combatant.effects.stockpileCount = 0;
      removeEffectSource(combatant, "stockpile", next.round);
      next.log.push({
        type: "stockpile_consumed",
        round: next.round,
        actor: side,
        moveId: move.id,
        charges,
        healingRoll,
        healing: combatant.hp.current - before,
        hpAfter: combatant.hp.current
      });
      return next;
    }

    throw new Error(`No Stockpile handler for ${move.id}`);
  }

  async resolveSpecialSelfMove(next, side, move) {
    const combatant = next[side];

    if (move.id === "acupressure") {
      removeEffectSource(combatant, "acupressure", next.round);
      const roll = this.dice.roll(6);
      const expiresRound = effectExpiryRound(move, next.round);
      const applied = { roll, expiresRound };

      if (roll === 1) {
        combatant.effects.attackModifierSources.push({
          source: move.id,
          value: 1,
          expiresRound
        });
        applied.attack = 1;
      } else if (roll === 2) {
        combatant.effects.damageModifierSources.push({
          source: move.id,
          value: 2,
          expiresRound
        });
        applied.damage = 2;
      } else if (roll === 3) {
        combatant.temporaryHp = Math.max(combatant.temporaryHp ?? 0, 10);
        combatant.effects.temporaryHpSource = {
          source: move.id,
          expiresRound
        };
        applied.temporaryHp = combatant.temporaryHp;
      } else if (roll === 4) {
        combatant.effects.saveModifierSources.push({
          source: move.id,
          value: 1,
          expiresRound
        });
        applied.save = 1;
      } else if (roll === 5) {
        combatant.effects.criticalRangeBonusSources.push({
          source: move.id,
          value: 1,
          expiresRound
        });
        applied.criticalRangeBonus = 1;
      } else {
        combatant.effects.acModifierSources.push({
          source: move.id,
          value: 1,
          expiresRound
        });
        applied.ac = 1;
      }

      next.log.push({
        type: "special_self_move",
        round: next.round,
        actor: side,
        moveId: move.id,
        applied,
        concentration: false
      });
      return next;
    }

    if (move.id === "laser-focus") {
      endConcentrationState(next, side, "new_concentration");
      removeEffectSource(combatant, "laser-focus", next.round);
      combatant.effects.forcedCriticalSources.push({
        source: "laser-focus",
        usesRemaining: 1,
        startsRound: next.round + 1,
        expiresRound: next.round + 2
      });
      combatant.concentration = {
        zoneId: null,
        moveId: move.id,
        effectSource: "laser-focus",
        expiresRound: next.round + 2
      };
      next.log.push({
        type: "special_self_move",
        round: next.round,
        actor: side,
        moveId: move.id,
        applied: {
          forcedCriticalUses: 1,
          startsRound: next.round + 1,
          expiresRound: next.round + 2
        },
        concentration: true
      });
      return next;
    }

    if (move.id === "mind-reader") {
      removeEffectSource(combatant, "mind-reader", next.round);
      combatant.effects.forcedHitSources.push({
        source: "mind-reader",
        usesRemaining: 1,
        startsRound: next.round + 1,
        expiresRound: next.round + 2
      });
      next.log.push({
        type: "special_self_move",
        round: next.round,
        actor: side,
        moveId: move.id,
        applied: {
          forcedHitUses: 1,
          startsRound: next.round + 1,
          expiresRound: next.round + 2
        },
        concentration: false
      });
      return next;
    }

    if (move.id === "charge") {
      endConcentrationState(next, side, "new_concentration");
      removeEffectSource(combatant, "charge-ac", next.round);
      removeEffectSource(combatant, "charge-stab", next.round);

      combatant.effects.acModifierSources.push({
        source: "charge-ac",
        value: 2,
        expiresRound: next.round + 1
      });
      combatant.effects.stabMultiplierSources.push({
        source: "charge-stab",
        multiplier: 2,
        startsRound: next.round + 1,
        expiresRound: next.round + 2
      });
      combatant.concentration = {
        zoneId: null,
        moveId: move.id,
        effectSources: ["charge-ac", "charge-stab"],
        expiresRound: next.round + 2
      };

      next.log.push({
        type: "special_self_move",
        round: next.round,
        actor: side,
        moveId: move.id,
        applied: {
          ac: 2,
          acExpiresRound: next.round + 1,
          stabMultiplier: 2,
          stabStartsRound: next.round + 1,
          stabExpiresRound: next.round + 2
        },
        concentration: true
      });
      return next;
    }

    if (["healing-wish", "lunar-dance"].includes(move.id)) {
      const healing = combatant.hp.current;
      next.pendingSwitchEffects ??= { player: null, opponent: null };
      next.pendingSwitchEffects[side] = {
        kind: move.id,
        moveId: move.id,
        healing: move.id === "healing-wish" ? healing : null
      };
      combatant.hp.current = 0;
      next.log.push({
        type: "special_self_move",
        round: next.round,
        actor: side,
        moveId: move.id,
        selfFainted: true,
        pendingSwitchEffect: clone(next.pendingSwitchEffects[side]),
        hpBefore: healing,
        hpAfter: 0
      });
      markDowned(next, side, move.id);
      return next;
    }

    if (move.id === "fillet-away") {
      const reducedSelfDamage = applyDamageReduction(combatant, 10, this.dice, next.round);
      const selfDamage = reducedSelfDamage.damage;
      combatant.hp.current = Math.max(0, combatant.hp.current - hpDamageAfterTemporaryHp(combatant, selfDamage));
      const concentrationCheck = checkConcentrationAfterDamage(
        next,
        side,
        selfDamage,
        this.dice
      );

      if (combatant.hp.current <= 0) {
        next.log.push({
          type: "special_self_move",
          round: next.round,
          actor: side,
          moveId: move.id,
          selfDamageBeforeReduction: reducedSelfDamage.damageBeforeReduction,
          damageReduction: reducedSelfDamage.damageReduction,
          reductions: reducedSelfDamage.reductions,
          selfDamage,
          concentrationCheck,
          applied: null,
          hpAfter: combatant.hp.current
        });
        markDowned(next, side, "self_move_damage");
        return next;
      }

      removeEffectSource(combatant, "fillet-away", next.round);
      combatant.effects.attackAdvantageSources.push({
        source: "fillet-away",
        usesRemaining: 1,
        expiresRound: next.round + 1
      });
      combatant.effects.speedModifierSources.push({
        source: "fillet-away",
        value: 15,
        expiresRound: next.round + 1
      });
      if (combatant.turn.started) {
        combatant.turn.movementRemaining += 15;
      }

      next.log.push({
        type: "special_self_move",
        round: next.round,
        actor: side,
        moveId: move.id,
        selfDamageBeforeReduction: reducedSelfDamage.damageBeforeReduction,
        damageReduction: reducedSelfDamage.damageReduction,
        reductions: reducedSelfDamage.reductions,
        selfDamage,
        concentrationCheck,
        applied: {
          attackAdvantageUses: 1,
          speed: 15,
          expiresRound: next.round + 1
        },
        hpAfter: combatant.hp.current
      });
      return next;
    }

    if (move.id === "clangorous-soul") {
      const damageRoll = rollExpression("3d6", this.dice);
      const reducedSelfDamage = applyDamageReduction(
        combatant,
        damageRoll.total,
        this.dice,
        next.round
      );
      const damage = reducedSelfDamage.damage;
      combatant.hp.current = Math.max(0, combatant.hp.current - hpDamageAfterTemporaryHp(combatant, damage));
      const concentrationCheck = checkConcentrationAfterDamage(
        next,
        side,
        damage,
        this.dice
      );

      if (combatant.hp.current <= 0) {
        next.log.push({
          type: "special_self_move",
          round: next.round,
          actor: side,
          moveId: move.id,
          damageRoll,
          selfDamageBeforeReduction: reducedSelfDamage.damageBeforeReduction,
          damageReduction: reducedSelfDamage.damageReduction,
          reductions: reducedSelfDamage.reductions,
          selfDamage: damage,
          concentrationCheck,
          applied: null,
          hpAfter: combatant.hp.current
        });
        markDowned(next, side, "self_move_damage");
        return next;
      }

      const applied = {
        attack: addSourceCappedModifier(
          combatant.effects.attackModifierSources,
          { source: move.id, value: 1, expiresRound: null },
          next.round,
          0,
          5
        ),
        ac: addSourceCappedModifier(
          combatant.effects.acModifierSources,
          { source: move.id, value: 1, expiresRound: null },
          next.round,
          0,
          5
        ),
        damage: addSourceCappedModifier(
          combatant.effects.damageModifierSources,
          { source: move.id, value: 1, expiresRound: null },
          next.round,
          0,
          5
        )
      };

      next.log.push({
        type: "special_self_move",
        round: next.round,
        actor: side,
        moveId: move.id,
        damageRoll,
        selfDamageBeforeReduction: reducedSelfDamage.damageBeforeReduction,
        damageReduction: reducedSelfDamage.damageReduction,
        reductions: reducedSelfDamage.reductions,
        selfDamage: damage,
        concentrationCheck,
        applied,
        hpAfter: combatant.hp.current
      });
      return next;
    }

    throw new Error(`No special self handler for ${move.id}`);
  }

  async resolveSimpleModifierMove(next, side, move) {
    const combatant = next[side];
    const rule = modifierRuleFor(move, combatant.level);
    if (!rule) throw new Error(`No modifier rule for ${move.id}`);

    if (move.duration?.concentration) {
      endConcentrationState(next, side, "new_concentration");
    }

    const expiresRound = rule.durationRounds != null
      ? next.round + Number(rule.durationRounds)
      : effectExpiryRound(move, next.round);
    const speedBefore = activeModifier(combatant.effects.speedModifierSources, next.round);
    const stackable = Boolean(rule.stackCap || rule.stackCaps);
    if (!stackable) removeEffectSource(combatant, move.id, next.round);

    const applied = {};
    const specs = [
      ["attack", "attackModifierSources"],
      ["damage", "damageModifierSources"],
      ["ac", "acModifierSources"],
      ["speed", "speedModifierSources"],
      ["save", "saveModifierSources"]
    ];
    for (const [name, key] of specs) {
      const value = Number(rule[name] ?? 0);
      if (!value) continue;
      const stackCap =
        rule.stackCaps?.[name] ??
        (rule.stackCap && (name === "attack" || name === "damage") ? rule.stackCap : null);
      if (stackCap != null) {
        applied[name] = addSourceCappedModifier(
          combatant.effects[key],
          { source: move.id, value, expiresRound },
          next.round,
          -Infinity,
          stackCap
        );
      } else {
        const source = { source: move.id, value, expiresRound };
        if (name === "speed" && Array.isArray(rule.speedTypes)) {
          source.types = clone(rule.speedTypes);
        }
        combatant.effects[key].push(source);
        applied[name] = value;
      }
    }

    if (rule.rangedAc) {
      combatant.effects.rangedAcModifierSources.push({
        source: move.id,
        value: Number(rule.rangedAc),
        expiresRound
      });
      applied.rangedAc = Number(rule.rangedAc);
    }

    if (rule.saveAdvantage) {
      combatant.effects.saveAdvantageSources.push({
        source: move.id,
        expiresRound
      });
      applied.saveAdvantage = true;
    }
    if (rule.attackAdvantage) {
      combatant.effects.attackAdvantageSources.push({
        source: move.id,
        expiresRound
      });
      applied.attackAdvantage = true;
    }
    if (rule.switchLock) {
      combatant.effects.switchLockSources.push({
        source: move.id,
        expiresRound
      });
      applied.switchLock = true;
    }
    if (rule.escapeLock) {
      combatant.effects.escapeLockSources.push({
        source: move.id,
        expiresRound
      });
      applied.escapeLock = true;
    }
    if (rule.resistance) {
      combatant.effects.damageResistanceSources.push({
        source: move.id,
        type: rule.resistance.type ?? null,
        steps: Number(rule.resistance.steps ?? 1),
        expiresRound
      });
      applied.resistance = clone(rule.resistance);
    }
    if (rule.typeImmunity) {
      combatant.effects.typeImmunitySources.push({
        source: move.id,
        type: rule.typeImmunity,
        expiresRound
      });
      applied.typeImmunity = rule.typeImmunity;
    }
    if (rule.stabMultiplier) {
      combatant.effects.stabMultiplierSources.push({
        source: move.id,
        multiplier: Number(rule.stabMultiplier),
        expiresRound
      });
      applied.stabMultiplier = Number(rule.stabMultiplier);
    }
    if (rule.criticalRangeBonus) {
      combatant.effects.criticalRangeBonusSources.push({
        source: move.id,
        value: Number(rule.criticalRangeBonus),
        expiresRound
      });
      applied.criticalRangeBonus = Number(rule.criticalRangeBonus);
    }
    if (rule.damageReduction) {
      const stats = calculateMoveStats(combatant, move, next.round);
      combatant.effects.damageReductionSources.push({
        source: move.id,
        dice: stats.damageDice,
        modifier: stats.damageModifier,
        expiresRound
      });
      applied.damageReduction = {
        dice: stats.damageDice,
        modifier: stats.damageModifier
      };
    }

    const speedAfter = activeModifier(combatant.effects.speedModifierSources, next.round);
    if (combatant.turn.started && speedAfter !== speedBefore) {
      combatant.turn.movementRemaining = Math.max(
        0,
        combatant.turn.movementRemaining + speedAfter - speedBefore
      );
    }

    if (move.duration?.concentration) {
      combatant.concentration = {
        zoneId: null,
        moveId: move.id,
        effectSource: move.id,
        expiresRound
      };
    }

    next.log.push({
      type: "modifier_move",
      round: next.round,
      actor: side,
      moveId: move.id,
      moveName: move.name,
      applied,
      expiresRound,
      concentration: Boolean(move.duration?.concentration)
    });
    return next;
  }

  async resolveDelayedHealingMove(next, side, targetSide, move) {
    const user = next[side];
    const stats = calculateMoveStats(user, move);

    if (move.id === "rest") {
      next.pendingEffects ??= [];
      next.pendingEffects.push({
        kind: "rest",
        phase: "end_turn",
        sourceSide: side,
        triggerRound: next.round,
        moveId: move.id,
        healingDice: stats.damageDice,
        healingModifier: stats.damageModifier
      });
      next.log.push({
        type: "delayed_healing_scheduled",
        round: next.round,
        actor: side,
        moveId: move.id,
        triggerRound: next.round
      });
      return next;
    }

    if (move.id === "wish") {
      next.pendingEffects ??= [];
      next.pendingEffects.push({
        kind: "wish",
        phase: "end_turn",
        sourceSide: side,
        targetSide,
        triggerRound: next.round + 1,
        moveId: move.id,
        healingDice: stats.damageDice,
        healingModifier: stats.damageModifier,
        maxRange: move.range?.value ?? 0
      });
      next.log.push({
        type: "delayed_healing_scheduled",
        round: next.round,
        actor: side,
        target: targetSide,
        moveId: move.id,
        triggerRound: next.round + 1
      });
      return next;
    }

    throw new Error(`No delayed healing handler for ${move.id}`);
  }

  async resolveOngoingHealingMove(next, side, move) {
    const combatant = next[side];
    const stats = calculateMoveStats(combatant, move);
    combatant.effects.ongoingEffects ??= [];
    combatant.effects.movementLockSources ??= [];

    if (move.id === "aqua-ring") {
      endConcentrationState(next, side, "new_concentration");
      const expiresRound = effectExpiryRound(move, next.round);
      removeEffectSource(combatant, "aqua-ring", next.round);
      combatant.effects.ongoingEffects.push({
        kind: "aqua-ring",
        source: "aqua-ring",
        moveId: move.id,
        expiresRound
      });
      combatant.concentration = {
        zoneId: null,
        moveId: move.id,
        effectSource: "aqua-ring",
        expiresRound
      };
      next.log.push({
        type: "ongoing_healing_started",
        round: next.round,
        actor: side,
        moveId: move.id,
        effect: "aqua-ring",
        expiresRound,
        concentration: true
      });
      return next;
    }

    if (move.id === "ingrain") {
      removeEffectSource(combatant, "ingrain", next.round);
      combatant.effects.ongoingEffects.push({
        kind: "ingrain",
        source: "ingrain",
        moveId: move.id,
        healingDice: stats.damageDice,
        healingModifier: stats.damageModifier,
        remainingEndTurns: 3
      });
      combatant.effects.movementLockSources.push({
        source: "ingrain",
        expiresRound: null
      });
      combatant.effects.switchLockSources.push({
        source: "ingrain",
        expiresRound: null
      });
      combatant.effects.escapeLockSources.push({
        source: "ingrain",
        expiresRound: null
      });
      combatant.turn.movementRemaining = 0;
      next.log.push({
        type: "ongoing_healing_started",
        round: next.round,
        actor: side,
        moveId: move.id,
        effect: "ingrain",
        remainingEndTurns: 3
      });
      return next;
    }

    if (move.id === "lunar-blessing") {
      endConcentrationState(next, side, "new_concentration");
      const expiresRound = effectExpiryRound(move, next.round);
      removeEffectSource(combatant, "lunar-blessing", next.round);
      combatant.effects.ongoingEffects.push({
        kind: "lunar-blessing",
        source: "lunar-blessing",
        moveId: move.id,
        healingDice: stats.damageDice,
        healingModifier: stats.damageModifier,
        expiresRound
      });
      combatant.concentration = {
        zoneId: null,
        moveId: move.id,
        effectSource: "lunar-blessing",
        expiresRound
      };
      next.log.push({
        type: "ongoing_healing_started",
        round: next.round,
        actor: side,
        moveId: move.id,
        effect: "lunar-blessing",
        expiresRound,
        concentration: true
      });
      return next;
    }

    throw new Error(`No ongoing healing handler for ${move.id}`);
  }

  async resolveAutomaticDamageMove(next, side, move) {
    const attacker = next[side];
    const targetSide = otherSide(side);
    const defender = next[targetSide];

    if (requiresSleepingTarget(move) && !isSleepingTarget(defender)) {
      throw new Error(`${move.name} requires a sleeping target`);
    }

    const stats = calculateMoveStats(attacker, move, next.round);
    const damageBonus = activeModifier(attacker.effects.damageModifierSources, next.round);
    const multiplier = damageMultiplierFor(move, defender, next.round);
    const hits = [];
    let totalDamage = 0;

    for (let index = 0; index < automaticDamageHitCount(move); index += 1) {
      const damageRoll = rollSaveMoveDamage(attacker, move, stats.damageDice, this.dice);
      const rawDamage = Math.max(
        0,
        damageRoll.selected.total + stats.damageModifier + damageBonus
      );
      const beforeReduction =
        multiplier === 0.5 ? Math.floor(rawDamage / 2) : rawDamage * multiplier;
      const reduced = applyDamageReduction(defender, beforeReduction, this.dice, next.round);
      totalDamage += reduced.damage;
      hits.push({
        index: index + 1,
        damageRoll,
        rawDamage,
        damageBeforeReduction: reduced.damageBeforeReduction,
        damageReduction: reduced.damageReduction,
        reductions: reduced.reductions,
        damage: reduced.damage
      });
    }

    const duplicateInterception = totalDamage > 0
      ? tryAbsorbWithDuplicate(next, targetSide, move, this.dice)
      : null;
    if (duplicateInterception?.avoided) totalDamage = 0;
    defender.hp.current = Math.max(0, defender.hp.current - hpDamageAfterTemporaryHp(defender, totalDamage));
    if (!duplicateInterception?.avoided) {
      checkConcentrationAfterDamage(next, targetSide, totalDamage, this.dice);
      applyCanonicalDamageShare(next, targetSide, totalDamage);
    }
    const thawed = endFrozenOnFireDamage(defender, move, totalDamage);

    let healing = 0;
    if (move.id === "dream-eater" && totalDamage > 0) {
      healing = Math.floor(totalDamage / 2);
      attacker.hp.current = Math.min(attacker.hp.max, attacker.hp.current + healing);
    }

    next.log.push({
      type: "automatic_damage",
      round: next.round,
      actor: side,
      target: targetSide,
      moveId: move.id,
      moveName: move.name,
      hits,
      typeMultiplier: multiplier,
      damage: totalDamage,
      healing,
      duplicateInterception,
      thawed,
      targetHpAfter: defender.hp.current,
      actorHpAfter: attacker.hp.current
    });

    if (defender.hp.current <= 0) markDowned(next, targetSide, "move_damage");
    return next;
  }

  async resolveSaveDamageMove(next, side, move) {
    const attacker = next[side];
    const targetSide = otherSide(side);
    const defender = next[targetSide];
    const stats = calculateMoveStats(attacker, move, next.round);
    const save = resolveSavingThrow({
      defender,
      attribute: stats.saveAttribute,
      dc: stats.saveDc,
      dice: this.dice,
      advantage:
        attacker.statuses?.flinchedTurns > 0 &&
        move.time?.unit === "action",
      round: next.round
    });

    const damageRoll = rollSaveMoveDamage(attacker, move, stats.damageDice, this.dice);
    const damageBonus = activeModifier(attacker.effects.damageModifierSources, next.round);
    const rawDamage = Math.max(
      0,
      damageRoll.selected.total + stats.damageModifier + damageBonus
    );
    const multiplier = damageMultiplierFor(move, defender, next.round);
    let damage = multiplier === 0.5 ? Math.floor(rawDamage / 2) : rawDamage * multiplier;
    if (save.success) damage = saveAllowsHalfDamage(move) ? Math.floor(damage / 2) : 0;
    const reducedSaveDamage = applyDamageReduction(defender, damage, this.dice, next.round);
    const damageBeforeReduction = reducedSaveDamage.damageBeforeReduction;
    const damageReduction = reducedSaveDamage.damageReduction;
    const reductions = reducedSaveDamage.reductions;
    damage = reducedSaveDamage.damage;

    const duplicateInterception = (damage > 0 || !save.success)
      ? tryAbsorbWithDuplicate(next, targetSide, move, this.dice)
      : null;
    if (duplicateInterception?.avoided) damage = 0;

    defender.hp.current = Math.max(0, defender.hp.current - hpDamageAfterTemporaryHp(defender, damage));
    if (!duplicateInterception?.avoided) {
      checkConcentrationAfterDamage(next, targetSide, damage, this.dice);
      applyCanonicalDamageShare(next, targetSide, damage);
    }

    const thawed = !duplicateInterception?.avoided
      ? endFrozenOnFireDamage(defender, move, damage)
      : false;
    const status = duplicateInterception?.avoided ? null : failedSaveStatus(move, save);
    const statusResult = status && multiplier > 0
      ? applyMoveStatus(attacker, defender, status, next.round)
      : null;

    next.log.push({
      type: "save_damage",
      round: next.round,
      actor: side,
      target: targetSide,
      moveId: move.id,
      moveName: move.name,
      save,
      damageRoll,
      damageModifier: stats.damageModifier + damageBonus,
      rawDamage,
      typeMultiplier: multiplier,
      damageBeforeReduction,
      damageReduction,
      reductions,
      damage,
      duplicateInterception,
      status,
      statusResult,
      thawed,
      targetHpAfter: defender.hp.current
    });

    if (defender.hp.current <= 0) markDowned(next, targetSide, "move_damage");
    return next;
  }


  async resolveCanonicalSpecialMove(
    next,
    side,
    move,
    { targetSide: requestedTargetSide = null, targetPoint = null, choice = null } = {}
  ) {
    const user = next[side];
    const targetSide = requestedTargetSide ?? otherSide(side);
    const target = next[targetSide] ?? next[otherSide(side)];
    const rule = compileCanonicalMoveRule(move);
    const expiresRound = effectExpiryRound(move, next.round);
    next.canonicalRuntime ??= { effects: [], flags: {}, pendingChoices: [] };

    let save = null;
    if (move.save && target && move.range?.type !== "self") {
      save = resolveSaveMove({
        attacker: user,
        defender: target,
        move,
        dice: this.dice,
        round: next.round
      }).save;
    }
    const failedSave = save ? !save.success : true;
    const applied = [];

    const pushEffect = (effectTarget, key, value) => {
      effectTarget.effects[key] ??= [];
      effectTarget.effects[key].push(value);
      applied.push({ key, ...clone(value) });
    };
    const record = (kind, details = {}) => {
      const event = {
        type: "canonical_special_move",
        round: next.round,
        actor: side,
        target: targetSide,
        moveId: move.id,
        family: rule.family,
        save,
        kind,
        applied: clone(applied),
        ...details
      };
      next.log.push(event);
      next.canonicalRuntime.effects.push({
        moveId: move.id,
        sourceSide: side,
        targetSide,
        family: rule.family,
        startedRound: next.round,
        expiresRound,
        kind,
        ...clone(details)
      });
      return next;
    };

    if (move.id === "after-you") {
      if (target && next.order.includes(targetSide) && next.order[next.turnIndex] !== targetSide) {
        next.order = [targetSide, ...next.order.filter((entry) => entry !== targetSide)];
        next.turnIndex = 0;
        target.turn.started = false;
      }
      return record("initiative_immediate");
    }
    if (move.id === "quash") {
      if (failedSave && next.order.includes(targetSide)) {
        next.order = [...next.order.filter((entry) => entry !== targetSide), targetSide];
      }
      return record("initiative_last");
    }
    if (move.id === "trick-room") {
      next.reverseInitiativeFromRound = next.round + 1;
      return record("initiative_reverse", { startsRound: next.round + 1 });
    }
    if (move.id === "ally-switch") {
      const a = clone(user.position);
      user.position = clone(target.position);
      target.position = a;
      return record("swap_positions");
    }
    if (move.id === "teleport") {
      if (targetPoint) {
        const destination = point(
          targetPoint.x,
          targetPoint.y,
          Number.isFinite(targetPoint.z) ? targetPoint.z : user.position?.z
        );
        if (distance(user.position, destination) > 30 + 1e-9) {
          throw new Error("Teleport destination exceeds 30 feet");
        }
        user.position = destination;
      }
      return record("teleport", { position: clone(user.position) });
    }
    if (move.id === "splash") {
      user.position = point(user.position.x, user.position.y, Number(user.position.z ?? 0) + 50);
      user.movementMode = "flying";
      return record("vertical_leap", { feet: 50 });
    }

    if (move.id === "amnesia") {
      pushEffect(user, "saveModifierSources", { source: move.id, value: 2, expiresRound });
      const forgotten = user.moveIds.find((id) => id !== move.id) ?? null;
      if (forgotten) pushEffect(user, "moveLockSources", { source: move.id, moveIds: [forgotten], expiresRound });
      return record("self_focus", { forgottenMoveId: forgotten });
    }
    if (move.id === "aurora-veil") {
      const weather = typeof next.environment?.weather === "string"
        ? next.environment.weather
        : next.environment?.weather?.kind;
      if (!["hail", "snow", "snowstorm"].includes(String(weather ?? "").toLowerCase())) {
        throw new Error("Aurora Veil requires hail or snow");
      }
      pushEffect(user, "damageResistanceSources", { source: move.id, type: null, steps: 1, expiresRound });
      return record("all_damage_resistance");
    }
    if (move.id === "coaching" && target) {
      pushEffect(target, "attackModifierSources", { source: move.id, value: 1, expiresRound });
      pushEffect(target, "acModifierSources", { source: move.id, value: 1, expiresRound });
      return record("coaching");
    }
    if (move.id === "decorate" && target) {
      pushEffect(target, "attackAdvantageSources", { source: move.id, expiresRound });
      return record("attack_advantage");
    }
    if (move.id === "dragon-cheer" && target) {
      pushEffect(target, "criticalRangeBonusSources", {
        source: move.id,
        value: target.types?.includes("dragon") ? 2 : 1,
        usesRemaining: 1,
        expiresRound
      });
      return record("critical_range");
    }
    if (move.id === "flower-shield") {
      for (const effectTargetSide of ["player", "opponent"]) {
        const candidate = next[effectTargetSide];
        if (!candidate?.types?.includes("grass")) continue;
        if (distance(user.position, candidate.position) > 15 + 1e-9) continue;
        pushEffect(candidate, "acModifierSources", { source: move.id, value: 2, expiresRound });
      }
      return record("grass_ac_aura");
    }
    if (move.id === "growth") {
      const effectTarget = requestedTargetSide ? next[requestedTargetSide] : user;
      effectTarget.effects.canonicalBonusDice ??= [];
      effectTarget.effects.canonicalBonusDice.push({ source: move.id, die: "d4", appliesTo: ["attack","save"], expiresRound });
      return record("d4_attack_save");
    }
    if (move.id === "guard-swap" && target && failedSave) {
      const own = user.ac;
      user.ac = target.ac;
      target.ac = own;
      return record("swap_ac", { userAc: user.ac, targetAc: target.ac });
    }
    if (move.id === "guard-split" && target && failedSave) {
      const average = Math.floor((user.ac + target.ac) / 2);
      user.ac = average;
      return record("average_ac", { ac: average });
    }
    if (move.id === "speed-swap" && target && failedSave) {
      const own = user.speed;
      user.speed = target.speed;
      target.speed = own;
      return record("swap_speed", { userSpeed: user.speed, targetSpeed: target.speed });
    }
    if (move.id === "spotlight" && target && failedSave) {
      pushEffect(target, "incomingAttackBonusSources", { source: move.id, value: 5, expiresRound });
      return record("incoming_attack_advantage");
    }
    if (move.id === "string-shot" && target) {
      pushEffect(target, "speedModifierSources", { source: move.id, value: -10, expiresRound });
      if (movementSpeed(target, next.round).value <= 0) {
        pushEffect(target, "restrainedSources", { source: move.id, expiresRound });
      }
      return record("speed_reduction");
    }
    if (move.id === "mud-sport" || move.id === "water-sport") {
      const damageType = move.id === "mud-sport" ? "electric" : "fire";
      for (const effectTargetSide of ["player", "opponent"]) {
        const candidate = next[effectTargetSide];
        if (!candidate?.position || distance(user.position, candidate.position) > 5 + 1e-9) continue;
        pushEffect(candidate, "damageResistanceSources", { source: move.id, type: damageType, steps: 1, expiresRound });
      }
      return record("typed_resistance", { damageType });
    }
    if (move.id === "work-up") {
      pushEffect(user, "attackModifierSources", { source: move.id, value: 2, expiresRound });
      return record("attack_modifier");
    }
    if (move.id === "rage") {
      pushEffect(user, "damageModifierSources", { source: move.id, value: 1, expiresRound });
      pushEffect(user, "damageResistanceSources", { source: move.id, type: "normal", steps: 1, expiresRound });
      return record("rage");
    }
    if (move.id === "shelter") {
      pushEffect(user, "acModifierSources", { source: move.id, value: 5, expiresRound: next.round + 1 });
      return record("ac_reaction_buff");
    }

    if (move.id === "belly-drum") {
      const cost = Math.floor(user.hp.max / 2);
      user.hp.current = Math.max(0, user.hp.current - cost);
      user.attributes.str = Math.min(30, Number(user.attributes.str ?? 10) + 10);
      return record("hp_for_strength", { hpCost: cost, strength: user.attributes.str });
    }
    if (move.id === "substitute") {
      const cost = Math.max(1, Math.floor(user.hp.current / 4));
      user.hp.current = Math.max(1, user.hp.current - cost);
      user.temporaryHp = Math.max(Number(user.temporaryHp ?? 0), cost);
      user.effects.temporaryHpSource = { source: move.id };
      pushEffect(user, "statusImmunitySources", { source: move.id, expiresRound });
      return record("substitute", { hpCost: cost, temporaryHp: user.temporaryHp });
    }
    if (move.id === "revival-blessing") {
      if (target?.hp?.current <= 0) {
        target.hp.current = Math.max(1, Math.floor(target.hp.max / 2));
      }
      return record("revival", { hpAfter: target?.hp?.current ?? null });
    }
    if (move.id === "roost") {
      const stats = calculateMoveStats(user, move, next.round);
      const healingRoll = rollExpression(stats.damageDice, this.dice);
      const before = user.hp.current;
      user.hp.current = Math.min(user.hp.max, before + healingRoll.total + stats.damageModifier);
      user.movementMode = "walking";
      if (user.types?.includes("flying")) {
        applyTypeOverride(user, {
          source: move.id,
          types: user.types.filter((type) => type !== "flying").length
            ? user.types.filter((type) => type !== "flying")
            : ["normal"],
          remainingTurns: 1
        });
      }
      return record("roost", { healing: user.hp.current - before });
    }
    if (move.id === "explosion") {
      const natural = this.dice.roll(20);
      const levelBlocked = target && target.level >= user.level + 10;
      const success = natural === 20 && !levelBlocked;
      if (success && target) {
        target.hp.current = 0;
        markDowned(next, targetSide, "explosion");
      }
      return record("explosion", { natural, levelBlocked, success });
    }
    if (move.id === "final-gambit" && target) {
      const amount = user.hp.current;
      const result = save ?? resolveSaveMove({ attacker: user, defender: target, move, dice: this.dice, round: next.round }).save;
      const damage = result.success ? Math.floor(amount / 2) : amount;
      user.hp.current = 0;
      target.hp.current = Math.max(0, target.hp.current - damage);
      if (target.hp.current <= 0) markDowned(next, targetSide, "final-gambit");
      if (!next.outcome) markDowned(next, side, "final-gambit");
      return record("final_gambit", { damage, sourceHp: amount });
    }
    if (move.id === "memento" && target) {
      user.hp.current = 0;
      pushEffect(target, "movementLockSources", { source: move.id, expiresRound: next.round + 2 });
      pushEffect(target, "switchLockSources", { source: move.id, expiresRound: next.round + 2 });
      pushEffect(target, "escapeLockSources", { source: move.id, expiresRound: next.round + 2 });
      pushEffect(target, "moveLockSources", { source: move.id, nonDamagingAttacks: true, damagingAttacks: true, expiresRound: next.round + 2 });
      markDowned(next, side, "memento");
      return record("memento");
    }

    if (["camouflage","conversion","conversion-2"].includes(move.id)) {
      const availableTypes = move.id === "conversion"
        ? [...new Set((await Promise.all(user.moveIds.map((id) => this.data.getMove(id)))).map((entry) => entry.type))]
        : [];
      const environmentType = String(next.environment?.terrain?.kind ?? next.environment?.terrain ?? "normal").toLowerCase();
      const chosenType = availableTypes[0] ?? (
        environmentType.includes("water") ? "water" :
        environmentType.includes("grass") || environmentType.includes("forest") ? "grass" :
        environmentType.includes("snow") || environmentType.includes("ice") ? "ice" :
        environmentType.includes("sand") || environmentType.includes("rock") ? "ground" :
        "normal"
      );
      applyTypeOverride(user, { source: move.id, types: [chosenType], expiresRound });
      return record("type_override", { type: chosenType });
    }
    if (move.id === "ion-deluge") {
      next.environment ??= {};
      next.environment.moveTypeOverride = { from: "normal", to: "electric", expiresRound: next.round + 1, source: move.id };
      return record("move_type_field", { from: "normal", to: "electric" });
    }

    if (["electric-terrain","grassy-terrain","misty-terrain","psychic-terrain"].includes(move.id)) {
      next.environment ??= {};
      next.environment.terrain = {
        kind: move.id.replace("-terrain", ""),
        source: move.id,
        sourceSide: side,
        radius: Number(move.shape?.value ?? 40),
        center: clone(user.position),
        expiresRound
      };
      return record("terrain", { terrain: clone(next.environment.terrain) });
    }
    if (move.id === "snowscape") {
      next.environment ??= {};
      next.environment.weather = {
        kind: "snow",
        source: move.id,
        sourceSide: side,
        startedRound: next.round,
        expiresRound
      };
      return record("weather", { weather: "snow" });
    }
    if (move.id === "gravity") {
      next.environment ??= {};
      next.environment.gravity = { source: move.id, radius: Number(move.shape?.value ?? 20), expiresRound };
      return record("gravity");
    }
    if (move.id === "wonder-room") {
      next.environment ??= {};
      next.environment.saveSwap = { wis: "con", con: "wis", source: move.id, expiresRound };
      return record("save_swap");
    }
    if (move.id === "tailwind") {
      user.effects.ongoingEffects.push({ kind: "tailwind", moveId: move.id, source: move.id, expiresRound });
      return record("tailwind");
    }
    if (move.id === "smokescreen") {
      next.environment ??= {};
      next.environment.smokescreen = { source: move.id, expiresRound, shape: clone(move.shape), center: clone(targetPoint ?? user.position) };
      return record("smokescreen");
    }

    if (["doodle","entrainment","role-play","simple-beam","skill-swap","worry-seed","gastro-acid"].includes(move.id) && target) {
      if (save && save.success) return record("ability_effect_resisted");
      if (move.id === "gastro-acid") {
        target.effects.abilitySuppressedUntilRound = expiresRound;
      } else if (move.id === "simple-beam") {
        target.effects.originalAbilityId ??= target.abilityId;
        target.abilityId = "simple";
      } else if (move.id === "worry-seed") {
        target.effects.originalAbilityId ??= target.abilityId;
        target.abilityId = "insomnia";
      } else if (move.id === "role-play") {
        user.effects.originalAbilityId ??= user.abilityId;
        user.abilityId = target.abilityId;
      } else if (move.id === "skill-swap") {
        const a = user.abilityId;
        user.abilityId = target.abilityId;
        target.abilityId = a;
      } else {
        target.effects.originalAbilityId ??= target.abilityId;
        target.abilityId = user.abilityId;
      }
      return record("ability_change", { userAbilityId: user.abilityId, targetAbilityId: target.abilityId });
    }

    if (["bestow","switcheroo","trick"].includes(move.id) && target) {
      if (save && save.success) return record("item_swap_resisted");
      if (move.id === "bestow") {
        if (target.heldItemId) throw new Error("Bestow target is already holding an item");
        target.heldItemId = user.heldItemId;
        user.heldItemId = null;
      } else {
        const item = user.heldItemId;
        user.heldItemId = target.heldItemId;
        target.heldItemId = item;
      }
      return record("held_item_transfer", { userHeldItemId: user.heldItemId, targetHeldItemId: target.heldItemId });
    }
    if (move.id === "embargo" && target && failedSave) {
      target.effects.itemLockUntilRound = expiresRound;
      return record("item_lock");
    }
    if (move.id === "magic-room") {
      next.environment ??= {};
      next.environment.heldItemsSuppressed = { source: move.id, expiresRound, radius: Number(move.shape?.value ?? 50), center: clone(user.position) };
      return record("held_item_suppression");
    }

    if (move.id === "telekinesis" && target && failedSave) {
      pushEffect(target, "restrainedSources", { source: move.id, expiresRound });
      pushEffect(target, "movementLockSources", { source: move.id, expiresRound });
      target.position = point(target.position.x, target.position.y, Math.max(5, Number(target.position.z ?? 0)));
      return record("raised_restrained");
    }
    if (move.id === "spider-web" && target) {
      pushEffect(target, "restrainedSources", { source: move.id, expiresRound });
      pushEffect(target, "switchLockSources", { source: move.id, expiresRound });
      pushEffect(target, "escapeLockSources", { source: move.id, expiresRound });
      return record("web_restrain");
    }
    if (["glare","scary-face"].includes(move.id) && target && failedSave) {
      target.effects.frightenedUntilRound = expiresRound;
      return record("frightened");
    }
    if (move.id === "roar" && target && failedSave) {
      target.effects.frightenedUntilRound = expiresRound ?? next.round + 1;
      const away = moveToward(target.position, user.position, -Math.min(movementSpeed(target, next.round).value, 30));
      target.position = away;
      return record("frightened_forced_move");
    }

    if (["baton-pass","chilly-reception","parting-shot"].includes(move.id)) {
      if (move.id === "chilly-reception") {
        next.environment ??= {};
        next.environment.weather = { kind: "snow", source: move.id, sourceSide: side, startedRound: next.round, expiresRound: next.round + 5 };
      }
      if (move.id === "parting-shot" && target && failedSave) {
        pushEffect(target, "damageModifierSources", { source: move.id, value: -999, scale: 0.5, usesRemaining: 1, expiresRound: next.round + 2 });
      }
      if (healthyBenchIndices(next, side).length > 0) next.awaitingSwitch = side;
      return record("switch_after_move");
    }

    if (["bide","focus-punch","vital-throw","perish-song","slack-off","yawn","outrage"].includes(move.id)) {
      next.pendingEffects ??= [];
      next.pendingEffects.push({
        kind: move.id,
        moveId: move.id,
        sourceSide: side,
        targetSide,
        phase: move.id === "yawn" ? "end_turn" : "canonical",
        triggerRound: next.round + (move.id === "perish-song" ? 3 : 1),
        expiresRound,
        sourceHp: user.hp.current
      });
      return record("delayed_effect");
    }

    if (["copycat","mirror-move","instruct","assist","metronome","mimic","nature-power","sleep-talk"].includes(move.id)) {
      let repeatedMoveId = null;
      if (["copycat","mirror-move","instruct"].includes(move.id)) repeatedMoveId = target?.lastMoveId ?? null;
      if (move.id === "sleep-talk") {
        if (!isSleepingTarget(user)) throw new Error("Sleep Talk can only be used while asleep");
        repeatedMoveId = user.moveIds.find((id) => id !== "sleep-talk") ?? null;
      }
      if (move.id === "metronome") {
        const tms = await this.data.listTms();
        const index = Math.max(0, Math.min(tms.length - 1, this.dice.roll(100) - 1));
        repeatedMoveId = tms[index]?.move ?? null;
      }
      next.canonicalRuntime.pendingChoices.push({
        kind: "execute_copied_move",
        sourceMoveId: move.id,
        repeatedMoveId,
        actor: side,
        target: targetSide
      });
      return record("move_copy_or_repeat", { repeatedMoveId });
    }

    if (move.id === "happy-hour") {
      next.rewardMultiplier = Math.max(2, Number(next.rewardMultiplier ?? 1));
      return record("reward_multiplier", { multiplier: next.rewardMultiplier });
    }

    if (move.id === "sing") {
      const pool = rollExpression("5d8", this.dice).total;
      if (target && target.hp.current <= pool) applyMoveStatus(user, target, "Asleep", next.round);
      return record("hp_pool_sleep", { hpPool: pool });
    }

    if (move.id === "aromatic-mist") {
      pushEffect(user, "saveRollDiceSources", {
        source: move.id,
        die: "d4",
        consumeOnUse: false,
        expiresRound
      });
      return record("save_d4_aura");
    }

    if (move.id === "destiny-bond" && target && failedSave) {
      endConcentrationState(next, side, "new_concentration");
      user.effects.damageShareSources ??= [];
      user.effects.damageShareSources.push({
        source: move.id,
        targetCombatantId: target.combatantId,
        targetSide,
        fraction: 0.5,
        expiresRound
      });
      user.concentration = {
        zoneId: null,
        moveId: move.id,
        effectSource: move.id,
        expiresRound
      };
      return record("damage_share", { fraction: 0.5 });
    }

    if (move.id === "diamond-storm") {
      endConcentrationState(next, side, "new_concentration");
      const stats = calculateMoveStats(user, move, next.round);
      const center = targetPoint
        ? point(targetPoint.x, targetPoint.y, targetPoint.z)
        : clone(target?.position ?? user.position);
      const zoneId = `${next.encounterId}:${move.id}:${next.round}:${next.log.length}`;
      const zone = createCircleZone({
        id: zoneId,
        moveId: move.id,
        sourceSide: side,
        center,
        radius: 30,
        createdRound: next.round,
        expiresRound: next.round + 3,
        concentration: true,
        damageDice: stats.damageDice,
        damageModifier: stats.damageModifier,
        damageType: move.type,
        effect: move.id
      });
      next.zones.push(zone);
      user.concentration = { zoneId, moveId: move.id, expiresRound: next.round + 3 };
      const acRoll = this.dice.roll(4);
      if (acRoll >= 3) {
        pushEffect(user, "acModifierSources", { source: move.id, value: 2, expiresRound: next.round + 3 });
      }
      return record("damage_zone", { zoneId, acRoll, acBonus: acRoll >= 3 ? 2 : 0 });
    }

    if (move.id === "double-team") {
      endConcentrationState(next, side, "new_concentration");
      user.effects.duplicateSources ??= [];
      user.effects.duplicateSources.push({
        source: move.id,
        duplicates: 1,
        avoidOn: 4,
        die: 6,
        maxWidth: 5,
        expiresRound
      });
      user.concentration = {
        zoneId: null,
        moveId: move.id,
        effectSource: move.id,
        expiresRound
      };
      return record("illusory_duplicate", { duplicates: 1 });
    }

    if (move.id === "eerie-spell" && target && failedSave) {
      pushEffect(target, "extraPpCostSources", {
        source: move.id,
        value: 1,
        expiresRound
      });
      return record("extra_pp_cost", { value: 1 });
    }

    if (move.id === "flash") {
      const affected = [];
      for (const candidateSide of ["player", "opponent"]) {
        if (candidateSide === side) continue;
        const candidate = next[candidateSide];
        if (!candidate?.position || distance(user.position, candidate.position) > 20 + 1e-9) continue;
        const result = resolveSaveMove({
          attacker: user,
          defender: candidate,
          move,
          dice: this.dice,
          round: next.round
        });
        if (!result.save.success) {
          candidate.effects.blindedSources ??= [];
          candidate.effects.blindedSources.push({
            source: move.id,
            expiresRound: next.round + 1
          });
        }
        affected.push({ side: candidateSide, save: result.save });
      }
      next.environment ??= {};
      next.environment.lightSource = {
        source: move.id,
        center: clone(user.position),
        radius: 20,
        expiresRound: next.round + 10
      };
      return record("flash", { affected });
    }

    if (move.id === "fling" && target) {
      if (!user.heldItemId) throw new Error("Fling requires a held item");
      const heldItem = await this.data.getItem(user.heldItemId);
      const priceValue = Number(
        heldItem?.price?.value ??
        heldItem?.price ??
        String(heldItem?.cost ?? "").replace(/[^0-9.]/g, "") ??
        0
      ) || 0;
      const attack = resolveAttack({
        attacker: user,
        defender: target,
        move: {
          ...move,
          dice: { class: "custom", tiers: ["0","0","0","0"], modifier: 0, type: "damage" },
          type: "dark"
        },
        dice: this.dice,
        extraDamageModifier: Math.floor(priceValue / 100) + proficiencyBonus(user.level),
        round: next.round
      });
      user.heldItemHistory ??= [];
      user.heldItemHistory.push({ itemId: user.heldItemId, round: next.round, reason: "fling" });
      user.heldItemId = null;
      if (attack.hit) {
        target.hp.current = Math.max(0, target.hp.current - attack.damage);
        if (target.hp.current <= 0) markDowned(next, targetSide, "fling");
      }
      next.log.push({ type: "fling_attack", round: next.round, actor: side, target: targetSide, ...attack });
      return record("fling", { hit: attack.hit, damage: attack.damage, priceValue });
    }

    if (move.id === "foresight") {
      user.effects.typeImmunityIgnoreSources ??= [];
      user.effects.typeImmunityIgnoreSources.push({
        source: move.id,
        moveTypes: ["ghost","normal","fighting"],
        usesRemaining: 1,
        expiresRound: next.round + 2
      });
      return record("ignore_type_immunity");
    }

    if (move.id === "gear-up") {
      if (["plus","minus"].includes(user.abilityId)) {
        pushEffect(user, "attackAdvantageSources", {
          source: move.id,
          expiresRound
        });
      }
      return record("plus_minus_attack_advantage");
    }

    if (move.id === "heart-swap" && target && failedSave) {
      const keys = [
        "attackModifierSources","incomingAttackBonusSources","damageModifierSources",
        "acModifierSources","rangedAcModifierSources","speedModifierSources",
        "saveModifierSources","attackAdvantageSources","attackDisadvantageSources",
        "saveAdvantageSources","saveDisadvantageSources"
      ];
      for (const key of keys) {
        const own = clone(user.effects[key] ?? []);
        user.effects[key] = clone(target.effects[key] ?? []);
        target.effects[key] = own;
      }
      return record("swap_active_modifiers");
    }

    if (move.id === "helping-hand") {
      const recipient = requestedTargetSide ? next[requestedTargetSide] : user;
      recipient.effects.helpingHandSources ??= [];
      recipient.effects.helpingHandSources = [{
        source: move.id,
        die: "d6",
        usesRemaining: 1,
        expiresRound: next.round + 100,
        canApplyTo: ["failed_d20_test","damage_roll"]
      }];
      return record("helping_hand", { target: requestedTargetSide ?? side });
    }

    if (move.id === "howl") {
      pushEffect(user, "attackAdvantageSources", {
        source: move.id,
        moveScopes: ["melee"],
        sourcePosition: clone(user.position),
        maxTargetDistance: 5,
        expiresRound: next.round + 2
      });
      return record("melee_advantage_aura");
    }

    if (move.id === "magnetic-flux") {
      if (["plus","minus"].includes(user.abilityId)) {
        pushEffect(user, "acModifierSources", {
          source: move.id,
          value: proficiencyBonus(user.level),
          expiresRound: next.round + 1
        });
        pushEffect(user, "saveAdvantageSources", {
          source: move.id,
          expiresRound: next.round + 1
        });
      }
      return record("magnetic_flux");
    }

    if (move.id === "mat-block") {
      pushEffect(user, "damageResistanceSources", {
        source: move.id,
        type: null,
        steps: 2,
        expiresRound: next.round + 2
      });
      return record("move_damage_immunity");
    }

    if (move.id === "miracle-eye" && target && failedSave) {
      target.effects.acModifierSources = [];
      target.effects.rangedAcModifierSources = [];
      user.effects.typeImmunityIgnoreSources ??= [];
      user.effects.typeImmunityIgnoreSources.push({
        source: move.id,
        moveTypes: ["ghost","normal","fighting"],
        targetCombatantId: target.combatantId,
        expiresRound
      });
      return record("reset_ac_ignore_type_immunity");
    }

    if (move.id === "nasty-plot") {
      pushEffect(user, "attackAdvantageSources", {
        source: move.id,
        attributes: ["wis","int","cha"],
        expiresRound
      });
      pushEffect(user, "targetSaveDisadvantageSources", {
        source: move.id,
        attributes: ["wis","int","cha"],
        expiresRound
      });
      return record("mental_move_advantage");
    }

    if (move.id === "nightmare") {
      const affected = [];
      for (const candidateSide of ["player","opponent"]) {
        if (candidateSide === side) continue;
        const candidate = next[candidateSide];
        if (!candidate?.position || distance(user.position, candidate.position) > 60 + 1e-9) continue;
        if (!isSleepingTarget(candidate)) continue;
        const stats = calculateMoveStats(user, move, next.round);
        const damageRoll = rollExpression(stats.damageDice, this.dice);
        const damage = Math.max(0, damageRoll.total + stats.damageModifier);
        candidate.hp.current = Math.max(0, candidate.hp.current - damage);
        affected.push({ side: candidateSide, damage, damageRoll });
        if (candidate.hp.current <= 0) markDowned(next, candidateSide, "nightmare");
      }
      return record("sleeping_area_damage", { affected });
    }

    if (move.id === "octolock" && target) {
      const userAttribute = user.attributes.str >= user.attributes.dex ? "str" : "dex";
      const targetAttribute = target.attributes.str >= target.attributes.dex ? "str" : "dex";
      const userRoll = rollD20(this.dice);
      const targetRoll = rollD20(this.dice);
      const userTotal = userRoll.natural + abilityModifier(user.attributes[userAttribute]) + proficiencyBonus(user.level);
      const targetTotal = targetRoll.natural + abilityModifier(target.attributes[targetAttribute]) + proficiencyBonus(target.level);
      const grappled = userTotal >= targetTotal;
      if (grappled) {
        target.effects.grappledSources ??= [];
        target.effects.grappledSources.push({
          source: move.id,
          byCombatantId: user.combatantId,
          expiresRound: null
        });
        pushEffect(target, "acModifierSources", { source: move.id, value: -1, expiresRound: null });
        user.effects.ongoingEffects.push({
          kind: "octolock",
          moveId: move.id,
          targetSide,
          targetCombatantId: target.combatantId,
          stacks: 1
        });
      }
      return record("grapple_ac_decay", { grappled, userRoll, targetRoll, userTotal, targetTotal });
    }

    if (move.id === "odor-sleuth" && target) {
      target.effects.acIncreaseLockSources ??= [];
      target.effects.acIncreaseLockSources.push({ source: move.id, expiresRound });
      user.effects.typeImmunityIgnoreSources ??= [];
      user.effects.typeImmunityIgnoreSources.push({
        source: move.id,
        moveTypes: ["ghost","normal","fighting"],
        expiresRound
      });
      return record("ac_boost_lock_and_immunity_ignore");
    }

    if (move.id === "play-nice" && target && failedSave) {
      pushEffect(target, "attackDisadvantageSources", {
        source: move.id,
        expiresRound: next.round + 2
      });
      pushEffect(user, "saveAdvantageSources", {
        source: move.id,
        expiresRound: next.round + 2
      });
      return record("play_nice");
    }

    if (move.id === "power-shift") {
      const attribute = String(choice?.attribute ?? "str").toLowerCase();
      if (!["str","dex","con","int","wis","cha"].includes(attribute)) {
        throw new Error("Power Shift requires a valid ability score");
      }
      user.effects.movePowerOverride = {
        source: move.id,
        attribute,
        usesRemaining: 1,
        expiresRound: next.round + 1
      };
      return record("next_move_power_override", { attribute });
    }

    if (move.id === "power-split" && target && failedSave) {
      const attribute = String(choice?.attribute ?? "str").toLowerCase();
      if (!["str","dex","wis"].includes(attribute)) throw new Error("Power Split requires STR, DEX, or WIS");
      const average = Math.floor((Number(user.attributes[attribute]) + Number(target.attributes[attribute])) / 2);
      user.effects.attributeRestoreSources ??= [];
      user.effects.attributeRestoreSources.push({
        source: move.id,
        attribute,
        value: user.attributes[attribute],
        expiresRound
      });
      user.attributes[attribute] = average;
      return record("power_split", { attribute, average });
    }

    if (move.id === "power-swap" && target && failedSave) {
      const attribute = String(choice?.attribute ?? "str").toLowerCase();
      if (!["str","dex","con","int","wis","cha"].includes(attribute)) throw new Error("Power Swap requires a valid ability score");
      const own = user.attributes[attribute];
      const theirs = target.attributes[attribute];
      user.effects.attributeRestoreSources ??= [];
      target.effects.attributeRestoreSources ??= [];
      user.effects.attributeRestoreSources.push({ source: move.id, attribute, value: own, expiresRound: next.round + 2 });
      target.effects.attributeRestoreSources.push({ source: move.id, attribute, value: theirs, expiresRound: next.round + 2 });
      user.attributes[attribute] = theirs;
      target.attributes[attribute] = own;
      return record("power_swap", { attribute });
    }

    if (move.id === "power-trick") {
      const attribute = String(choice?.attribute ?? "str").toLowerCase();
      if (!["str","dex","int","wis","cha"].includes(attribute)) throw new Error("Power Trick cannot use Constitution");
      user.effects.powerTrickRestore = {
        source: move.id,
        attribute,
        ac: user.ac,
        score: user.attributes[attribute],
        expiresRound: next.round + 2
      };
      const oldAc = user.ac;
      user.ac = user.attributes[attribute];
      user.attributes[attribute] = oldAc;
      return record("power_trick", { attribute, ac: user.ac, score: user.attributes[attribute] });
    }

    if (move.id === "psych-up" && target) {
      const keys = [
        "attackModifierSources","incomingAttackBonusSources","damageModifierSources",
        "acModifierSources","rangedAcModifierSources","speedModifierSources",
        "saveModifierSources","attackAdvantageSources","attackDisadvantageSources",
        "saveAdvantageSources","saveDisadvantageSources"
      ];
      for (const key of keys) user.effects[key] = clone(target.effects[key] ?? []);
      return record("copy_active_modifiers");
    }

    if (move.id === "psycho-shift" && target && failedSave) {
      const sourceSide = choice?.sourceSide && next[choice.sourceSide] ? choice.sourceSide : side;
      const sourcePokemon = next[sourceSide];
      const status = sourcePokemon.statuses?.nonVolatile;
      if (status) {
        clearStatus(sourcePokemon, status);
        applyMoveStatus(user, target, status, next.round);
      }
      return record("transfer_status", { status: status ?? null, sourceSide });
    }

    if (move.id === "rage-powder" && target && failedSave) {
      target.effects.forcedTargetSources ??= [];
      target.effects.forcedTargetSources.push({
        source: move.id,
        targetCombatantId: user.combatantId,
        damagingOnly: true,
        expiresRound
      });
      return record("forced_target", { targetCombatantId: user.combatantId });
    }

    if (move.id === "recycle") {
      const history = (user.heldItemHistory ?? []).filter(
        (entry) => next.round - Number(entry.round ?? -999) <= 5 && next.round !== entry.round
      );
      const recycled = history.at(-1) ?? null;
      if (!recycled) throw new Error("Recycle requires a consumable held item used within the last 5 turns");
      user.effects.recycledItemEffect = clone(recycled);
      return record("recycle", { itemId: recycled.itemId });
    }

    if (move.id === "rototiller") {
      if (user.types?.includes("grass")) {
        user.effects.stabMultiplierSources.push({
          source: move.id,
          type: "grass",
          multiplier: 2,
          expiresRound: next.round + 3
        });
      }
      next.environment ??= {};
      next.environment.rototiller = {
        source: move.id,
        center: clone(user.position),
        radius: 50,
        expiresRound: next.round + 3
      };
      return record("grass_stab_zone");
    }

    if (move.id === "sharpen") {
      pushEffect(user, "attackRollDiceSources", {
        source: move.id,
        die: "d4",
        consumeOnUse: false,
        expiresRound
      });
      return record("attack_d4");
    }

    if (move.id === "spicy-extract") {
      for (const candidateSide of ["player","opponent"]) {
        const candidate = next[candidateSide];
        if (!candidate?.position || distance(user.position, candidate.position) > 20 + 1e-9) continue;
        let candidateSave = null;
        if (candidateSide !== side) {
          candidateSave = resolveSaveMove({
            attacker: user,
            defender: candidate,
            move,
            dice: this.dice,
            round: next.round
          }).save;
        }
        if (candidateSave?.success) continue;
        pushEffect(candidate, "attackAdvantageSources", { source: move.id, expiresRound });
        pushEffect(candidate, "incomingAttackAdvantageSources", { source: move.id, expiresRound });
      }
      return record("mutual_attack_advantage");
    }

    if (move.id === "stuff-cheeks") {
      if (!user.heldItemId) throw new Error("Stuff Cheeks requires a held food item");
      const item = await this.data.getItem(user.heldItemId);
      if (item?.type !== "berry") throw new Error("Stuff Cheeks requires a held food item");
      user.heldItemHistory ??= [];
      user.heldItemHistory.push({ itemId: user.heldItemId, round: next.round, reason: "stuff-cheeks" });
      const consumedItemId = user.heldItemId;
      user.heldItemId = null;
      addSourceCappedModifier(
        user.effects.acModifierSources,
        { source: move.id, value: 2, expiresRound },
        next.round,
        0,
        4
      );
      return record("consume_food_ac", { itemId: consumedItemId, acBonus: 2 });
    }

    if (move.id === "swords-dance") {
      endConcentrationState(next, side, "new_concentration");
      user.effects.swordMirages = {
        source: move.id,
        remaining: 2,
        moveModifier: Math.max(
          abilityModifier(user.attributes.str),
          abilityModifier(user.attributes.dex),
          abilityModifier(user.attributes.int),
          abilityModifier(user.attributes.wis),
          abilityModifier(user.attributes.cha)
        ),
        expiresRound
      };
      pushEffect(user, "attackModifierSources", { source: move.id, value: 2, expiresRound });
      user.concentration = { zoneId: null, moveId: move.id, effectSource: move.id, expiresRound };
      return record("sword_mirages", { mirages: 2, attackBonus: 2 });
    }

    if (move.id === "teatime") {
      const consumeBerry = async (pokemon) => {
        if (!pokemon?.heldItemId) return null;
        const item = await this.data.getItem(pokemon.heldItemId);
        if (item?.type !== "berry") return null;
        pokemon.heldItemHistory ??= [];
        pokemon.heldItemHistory.push({ itemId: pokemon.heldItemId, round: next.round, reason: "teatime" });
        const id = pokemon.heldItemId;
        pokemon.heldItemId = null;
        return id;
      };
      const selfBerry = await consumeBerry(user);
      let targetBerryRequired = false;
      if (target && failedSave && target.heldItemId) {
        const item = await this.data.getItem(target.heldItemId);
        if (item?.type === "berry") {
          target.effects.forcedActionSources ??= [];
          target.effects.forcedActionSources.push({
            source: move.id,
            action: "consume-held-berry",
            expiresRound: next.round + 2
          });
          targetBerryRequired = true;
        }
      }
      return record("teatime", { selfBerry, targetBerryRequired });
    }

    if (move.id === "tidy-up") {
      pushEffect(user, "attackAdvantageSources", {
        source: move.id,
        usesRemaining: 1,
        expiresRound: next.round + 2
      });
      user.effects.tidyUpReaction = {
        source: move.id,
        expiresRound: next.round + 10,
        blockedMoves: ["spikes","stealth-rock","sticky-web","toxic-spikes","substitute"]
      };
      if (target?.effects?.temporaryHpSource?.source === "substitute" && failedSave) {
        target.temporaryHp = 0;
        target.effects.temporaryHpSource = null;
      }
      return record("tidy_up");
    }

    if (move.id === "topsy-turvy" && target && failedSave) {
      const keys = [
        "attackModifierSources","incomingAttackBonusSources","damageModifierSources",
        "acModifierSources","rangedAcModifierSources","speedModifierSources","saveModifierSources"
      ];
      for (const key of keys) {
        target.effects[key] = (target.effects[key] ?? []).map(
          (entry) => ({ ...entry, value: -Number(entry.value ?? 0) })
        );
      }
      return record("invert_modifiers");
    }

    if (move.id === "transform" && target) {
      endConcentrationState(next, side, "new_concentration");
      user.effects.transformOriginal = {
        types: clone(user.types),
        attributes: clone(user.attributes),
        ac: user.ac,
        speed: clone(user.speed),
        abilityId: user.abilityId,
        ability: clone(user.ability),
        moveIds: clone(user.moveIds),
        maxPp: clone(user.maxPp),
        pp: clone(user.pp)
      };
      user.types = clone(target.types);
      user.attributes = clone(target.attributes);
      user.ac = target.ac;
      user.speed = clone(target.speed);
      user.abilityId = target.abilityId;
      user.ability = clone(target.ability);
      user.moveIds = clone(target.moveIds);
      user.maxPp = clone(target.maxPp);
      user.pp = clone(target.pp);
      user.concentration = { zoneId: null, moveId: move.id, effectSource: move.id, expiresRound };
      return record("transform", { targetSpeciesId: target.speciesId });
    }

    if (move.id === "whirlwind") {
      pushEffect(user, "acModifierSources", {
        source: move.id,
        value: 2,
        expiresRound: next.round + 1
      });
      if (target && distance(user.position, target.position) <= 5 + 1e-9 && failedSave) {
        target.effects.proneSources ??= [];
        target.effects.proneSources.push({ source: move.id, expiresRound: next.round + 1 });
      }
      next.flee ??= { lastAttemptRound: null, chase: null };
      next.flee.bonusSuccesses = Number(next.flee.bonusSuccesses ?? 0) + 1;
      return record("whirlwind", { fleeBonusSuccesses: 1 });
    }

    throw new Error(
      `Canonical special move ${move.id} reached the incomplete-handler guard`
    );
  }

  async useMove(
    battle,
    side,
    moveId,
    {
      useDefenderIntimidate = false,
      targetPoint = null,
      targetSide: requestedTargetSide = null,
      canonicalChoice = null
    } = {}
  ) {
    if (battle.outcome) return clone(battle);
    if (battle.awaitingSwitch) throw new Error("A required switch must be resolved first");
    if (this.actor(battle) !== side) throw new Error(`It is not ${side}'s turn`);

    let next = await this.prepareCurrentTurn(battle);
    if (this.actor(next) !== side) return next;

    const attacker = next[side];
    const targetSide = otherSide(side);
    const defender = next[targetSide];

    const isStruggle = moveId === "struggle";
    if (!isStruggle && !attacker.moveIds.includes(moveId)) {
      throw new Error(`${attacker.name} does not know move ${moveId}`);
    }
    if (!isStruggle && (attacker.pp[moveId] ?? 0) <= 0) {
      throw new Error(`${moveId} has no PP remaining`);
    }

    const move = await this.data.getMove(moveId);
    if (!isMoveResolvable(move)) {
      throw new Error(`Move ${move.id} is known but its special rules are not executable by the combat resolver`);
    }
    const moveLockSource = isMoveLocked(attacker, move, next.round);
    if (moveLockSource) {
      throw new Error(`${move.name} is locked by ${moveLockSource}`);
    }
    if (move.id === "endeavor" && next.round === 1) {
      throw new Error("Endeavor cannot be used in the first round of combat");
    }
    if (
      ["swallow", "spit-up"].includes(move.id) &&
      (attacker.effects?.stockpileCount ?? 0) <= 0
    ) {
      throw new Error(`${move.name} requires at least one Stockpile charge`);
    }
    const slot = moveSlot(move);
    if (!slot || !attacker.turn[slot]) throw new Error(`No ${move.time?.unit ?? "turn"} slot available for ${moveId}`);

    const areaTarget = isPointAreaMove(move) && targetPoint
      ? point(targetPoint.x, targetPoint.y)
      : null;
    const healTargetSide = isImmediateHealingMove(move)
      ? healingTargetSide(move, side, requestedTargetSide)
      : null;
    const delayedHealTargetSide = isDelayedHealingMove(move)
      ? delayedHealingTargetSide(move, side, requestedTargetSide)
      : null;
    const ongoingHealTargetSide = isOngoingHealingMove(move) ? side : null;
    const modifierTargetSide = isSimpleModifierMove(move) ? side : null;
    const specialSelfTargetSide = isSpecialSelfMove(move) ? side : null;
    const fieldUtilityTargetSide = isFieldUtilityMove(move) ? side : null;
    const protectionTargetSide = isProtectionMove(move)
      ? (move.id === "safeguard" ? side : (requestedTargetSide ?? side))
      : null;
    const specialTargetSide = isSpecialTargetMove(move) ? targetSide : null;
    const cureTargetSide = isStatusCureMove(move)
      ? (move.id === "purify" ? otherSide(side) : side)
      : null;
    const rangeTarget = healTargetSide
      ? next[healTargetSide]
      : delayedHealTargetSide
        ? next[delayedHealTargetSide]
        : ongoingHealTargetSide
          ? next[ongoingHealTargetSide]
          : modifierTargetSide
            ? next[modifierTargetSide]
            : fieldUtilityTargetSide
              ? next[fieldUtilityTargetSide]
              : protectionTargetSide
                ? next[protectionTargetSide]
                : specialSelfTargetSide
              ? next[specialSelfTargetSide]
              : specialTargetSide
                ? next[specialTargetSide]
                : cureTargetSide
                  ? next[cureTargetSide]
                  : defender;
    const range = move.range?.type === "varies"
      ? { legal: true, distance: 0, maxRange: Infinity }
      : areaTarget
      ? {
          legal: distance(attacker.position, areaTarget) <= move.range.value + 1e-9,
          distance: distance(attacker.position, areaTarget),
          maxRange: move.range.value
        }
      : rangeCheckForMove(attacker, rangeTarget, move);
    if (!range.legal) {
      throw new Error(`${move.name} is out of range: ${range.distance.toFixed(1)}ft > ${range.maxRange}ft`);
    }

    if (range.quickAttackStep) {
      const needed = Math.max(0, distance(attacker.position, defender.position) - attacker.reach);
      const step = Math.min(10, needed);
      const from = clone(attacker.position);
      attacker.position = moveToward(attacker.position, defender.position, step);
      next.log.push({
        type: "move_step",
        round: next.round,
        actor: side,
        moveId: "quick-attack",
        from,
        to: clone(attacker.position),
        feet: step,
        provokesOpportunity: false
      });
    }

    if (!isStruggle) {
      attacker.lastMoveId = move.id;
      const pressureApplies =
        defender.abilityId === "pressure" &&
        !isPointAreaMove(move) &&
        move.range?.type !== "self" &&
        rangeTarget === defender;
      const extraPpCost = Math.max(
        0,
        activeModifier(attacker.effects?.extraPpCostSources ?? [], next.round)
      );
      const ppCost = 1 + (pressureApplies ? 1 : 0) + extraPpCost;
      attacker.pp[move.id] = Math.max(0, attacker.pp[move.id] - ppCost);
      if (extraPpCost > 0) {
        next.log.push({
          type: "pp_cost_modifier",
          round: next.round,
          actor: side,
          moveId: move.id,
          source: "canonical_effect",
          extraPpCost,
          ppCost
        });
      }
      if (pressureApplies) {
        next.log.push({
          type: "ability_trigger",
          round: next.round,
          actor: targetSide,
          abilityId: "pressure",
          trigger: move.id,
          ppCost
        });
      }
    }
    attacker.turn[slot] = false;

    let intimidateUsed = false;
    if (
      move.attack &&
      useDefenderIntimidate &&
      defender.abilityId === "intimidate" &&
      defender.abilityState.intimidateAvailable &&
      defender.reactionAvailable
    ) {
      defender.abilityState.intimidateAvailable = false;
      defender.reactionAvailable = false;
      intimidateUsed = true;
      next.log.push({
        type: "ability_use",
        round: next.round,
        actor: targetSide,
        abilityId: "intimidate",
        target: side
      });
    }

    if (move.id === "struggle") {
      next = await this.resolveStruggle(next, side, targetSide, { reason: "voluntary" });
    } else if (move.attack && move.dice?.type === "damage") {
      next = await this.resolveAttackMove(next, side, move, {
        forceDisadvantage: intimidateUsed
      });
    } else if (isAutomaticDamageMove(move)) {
      next = await this.resolveAutomaticDamageMove(next, side, move);
    } else if (isImmediateHealingMove(move)) {
      next = await this.resolveHealingMove(next, side, healTargetSide, move);
    } else if (isDelayedHealingMove(move)) {
      next = await this.resolveDelayedHealingMove(next, side, delayedHealTargetSide, move);
    } else if (isOngoingHealingMove(move)) {
      next = await this.resolveOngoingHealingMove(next, side, move);
    } else if (isOhkoMove(move)) {
      next = await this.resolveOhkoMove(next, side, move);
    } else if (isSaveHpEffectMove(move)) {
      next = await this.resolveSaveHpEffectMove(next, side, move);
    } else if (isStatusCureMove(move)) {
      next = await this.resolveStatusCureMove(next, side, move);
    } else if (isSimpleModifierMove(move)) {
      next = await this.resolveSimpleModifierMove(next, side, move);
    } else if (isSpecialSelfMove(move)) {
      next = await this.resolveSpecialSelfMove(next, side, move);
    } else if (isSpecialTargetMove(move)) {
      next = await this.resolveSpecialTargetMove(next, side, move);
    } else if (isTypeCopyMove(move)) {
      next = await this.resolveTypeCopyMove(next, side, move);
    } else if (isStockpileMove(move)) {
      next = await this.resolveStockpileMove(next, side, move);
    } else if (isEnvironmentMove(move)) {
      next = await this.resolveEnvironmentMove(next, side, move);
    } else if (isFieldUtilityMove(move)) {
      next = await this.resolveFieldUtilityMove(next, side, move);
    } else if (isProtectionMove(move)) {
      next = await this.resolveProtectionMove(next, side, protectionTargetSide, move);
    } else if (isMoveControlMove(move)) {
      next = await this.resolveMoveControlMove(next, side, move);
    } else if (isWeatherZoneMove(move)) {
      const center = areaTarget ?? clone(defender.position);
      next = await this.resolveWeatherZoneMove(next, side, move, center);
    } else if (AREA_MOVES.has(move.id)) {
      const stats = calculateMoveStats(attacker, move, next.round);
      const center = areaTarget ?? clone(defender.position);
      const radius = move.id === "smog" ? 10 : 15;
      const zoneId = `${next.encounterId}:${move.id}:${next.round}:${next.log.length}`;

      if (move.duration?.concentration) {
        endConcentrationState(next, side, "new_concentration");
      }

      const zone = createCircleZone({
        id: zoneId,
        moveId: move.id,
        sourceSide: side,
        center,
        radius,
        createdRound: next.round,
        expiresRound: move.duration?.unit === "minute" ? next.round + (move.duration.value * 10) : null,
        expiresAtSourceTurn: move.id === "poison-gas",
        concentration: Boolean(move.duration?.concentration),
        saveDc: stats.saveDc,
        saveAttribute: stats.saveAttribute,
        damageDice: stats.damageDice,
        damageModifier: stats.damageModifier,
        damageType: move.type,
        effect: move.id
      });

      next.zones.push(zone);
      if (zone.concentration) {
        attacker.concentration = { zoneId, moveId: move.id };
      }

      next.log.push({
        type: "zone_created",
        round: next.round,
        actor: side,
        zone: clone(zone)
      });
    } else if (move.save && move.dice?.type === "damage") {
      next = await this.resolveSaveDamageMove(next, side, move);
    } else if (SAVE_EFFECT_MOVES.has(move.id)) {
      if (hasMoveTypeImmunity(defender, move.type, next.round)) {
        next.log.push({
          type: "save_move",
          round: next.round,
          actor: side,
          target: targetSide,
          moveId: move.id,
          moveName: move.name,
          immune: true,
          immunityAbility: defender.abilityId === "levitate" ? "levitate" : null,
          immunityEffect: activeTypeImmunitySource(defender, move.type, next.round)
        });
      } else {
        const result = resolveSaveMove({
          attacker,
          defender,
          move,
          dice: this.dice,
          round: next.round
        });
        const applied = applySaveEffect(next, side, move, result);
        next.log.push({
          type: "save_move",
          round: next.round,
          actor: side,
          target: targetSide,
          ...result,
          immune: false,
          applied
        });
      }
    } else if (move.attack && statusFromText(move.description)) {
      next = await this.resolveStatusAttackMove(next, side, move, {
        forceDisadvantage: intimidateUsed
      });
    } else if (move.save && statusFromText(move.description)) {
      if (hasMoveTypeImmunity(defender, move.type, next.round)) {
        next.log.push({
          type: "save_move",
          round: next.round,
          actor: side,
          target: targetSide,
          moveId: move.id,
          moveName: move.name,
          immune: true,
          immunityAbility: defender.abilityId === "levitate" ? "levitate" : null,
          immunityEffect: activeTypeImmunitySource(defender, move.type, next.round)
        });
      } else {
        const result = resolveSaveMove({
          attacker,
          defender,
          move,
          dice: this.dice,
          round: next.round
        });
        const status = failedSaveStatus(move, result.save);
        const statusResult = applyMoveStatus(attacker, defender, status, next.round);
        next.log.push({
          type: "save_status",
          round: next.round,
          actor: side,
          target: targetSide,
          ...result,
          status,
          statusResult
        });
      }
    } else if (isCanonicalSpecialMove(move)) {
      next = await this.resolveCanonicalSpecialMove(next, side, move, {
        targetSide: requestedTargetSide,
        targetPoint,
        choice: canonicalChoice
      });
    } else {
      throw new Error(`Move ${move.id} is known but its special rules are not executable by the combat resolver`);
    }

    const powerOverride = next[side]?.effects?.movePowerOverride;
    if (
      move.id !== "power-shift" &&
      powerOverride &&
      activeCanonicalSource(powerOverride, next.round)
    ) {
      if (powerOverride.usesRemaining != null) {
        powerOverride.usesRemaining = Math.max(0, powerOverride.usesRemaining - 1);
      }
      if (powerOverride.usesRemaining === 0) next[side].effects.movePowerOverride = null;
    }

    if (next.outcome || next.awaitingSwitch) return next;

    const remaining = await this.legalMoves(next, side);
    if (remaining.length === 0 && next[side].turn.movementRemaining <= 0) {
      return endTurnInternal(next, side, this.dice);
    }

    return next;
  }

  async usePlayerMove(battle, moveId, options = {}) {
    return this.useMove(battle, "player", moveId, options);
  }

  async useDisengage(battle, side) {
    if (battle.outcome || battle.awaitingSwitch) return clone(battle);
    if (this.actor(battle) !== side) throw new Error(`It is not ${side}'s turn`);

    const next = await this.prepareCurrentTurn(battle);
    if (this.actor(next) !== side) return next;
    const combatant = next[side];
    if (!combatant.turn.actionAvailable) throw new Error("No action available for Disengage");

    combatant.turn.actionAvailable = false;
    combatant.turn.disengaged = true;
    next.log.push({ type: "disengage", round: next.round, actor: side });
    return next;
  }

  async availableReactionMoves(battle, reactorSide, trigger) {
    if (battle.outcome || battle.awaitingSwitch) return [];
    const reactor = battle[reactorSide];
    if (!reactor?.reactionAvailable) return [];

    const result = [];
    for (const moveId of reactor.moveIds ?? []) {
      if ((reactor.pp?.[moveId] ?? 0) <= 0) continue;
      const move = await this.data.getMove(moveId);
      if (!isSupportedReactionMove(move)) continue;
      if (reactionTriggerForMove(move) !== trigger) continue;

      const target = battle[otherSide(reactorSide)];
      if (!target?.position || !reactor.position) continue;
      if (!rangeCheckForMove(reactor, target, move, battle.battlefield).legal) continue;
      result.push(move);
    }
    return result;
  }


  async resolveCanonicalReactionMove(
    next,
    reactorSide,
    move,
    {
      trigger,
      targetSide: requestedTargetSide = null,
      incomingDamage = null,
      incomingMoveId = null,
      incomingNatural = null,
      incomingDamageType = null
    } = {}
  ) {
    const reactor = next[reactorSide];
    const targetSide = requestedTargetSide ?? otherSide(reactorSide);
    const target = next[targetSide];
    const expiresRound = effectExpiryRound(move, next.round) ?? next.round + 1;
    next.canonicalRuntime ??= { effects: [], flags: {}, pendingChoices: [] };

    let save = null;
    if (move.save && target) {
      save = resolveSaveMove({
        attacker: reactor,
        defender: target,
        move,
        dice: this.dice,
        round: next.round
      }).save;
    }
    const failedSave = save ? !save.success : true;
    const result = {
      type: "canonical_reaction",
      round: next.round,
      actor: reactorSide,
      target: targetSide,
      moveId: move.id,
      trigger,
      save,
      incomingDamage,
      incomingMoveId,
      incomingNatural,
      incomingDamageType,
      prevented: false,
      damageMultiplier: 1,
      attackDisadvantage: false,
      acBonus: 0
    };

    const escalatingGuard = new Set([
      "baneful-bunker","detect","kings-shield","obstruct","protect","spiky-shield"
    ]);
    if (move.id === "silk-trap") {
      result.prevented = incomingNatural !== 20;
      if (result.prevented && target && failedSave) {
        target.effects.restrainedSources ??= [];
        target.effects.restrainedSources.push({
          source: move.id,
          expiresRound: next.round + 2
        });
        result.restrainedAttacker = true;
      }
    } else if (escalatingGuard.has(move.id)) {
      reactor.abilityState.canonicalReactionUses ??= {};
      const uses = Number(reactor.abilityState.canonicalReactionUses[move.id] ?? 0);
      const succeeds = uses === 0 || this.dice.roll(20) > 15;
      reactor.abilityState.canonicalReactionUses[move.id] = uses + 1;
      result.prevented = succeeds && incomingNatural !== 20;
      result.guardRollRequired = uses > 0;
      if (move.id === "baneful-bunker" && result.prevented && trigger === "targeted_by_attack") {
        result.poisonAttacker = true;
      }
      if (move.id === "obstruct" && result.prevented && failedSave) {
        applyMoveStatus(reactor, target, "Flinched", next.round);
      }
      if (move.id === "spiky-shield" && result.prevented && target) {
        const damage = proficiencyBonus(reactor.level);
        target.hp.current = Math.max(0, target.hp.current - damage);
        result.reflectedDamage = damage;
        if (target.hp.current <= 0) markDowned(next, targetSide, "spiky-shield");
      }
    } else if (move.id === "endure") {
      reactor.abilityState.canonicalReactionUses ??= {};
      const uses = Number(reactor.abilityState.canonicalReactionUses[move.id] ?? 0);
      const succeeds = uses === 0 || this.dice.roll(20) > 15;
      reactor.abilityState.canonicalReactionUses[move.id] = uses + 1;
      result.prevented = succeeds;
      result.leaveAtOneHp = succeeds;
    } else if (move.id === "baby-doll-eyes" || move.id === "noble-roar") {
      result.attackDisadvantage = true;
    } else if (move.id === "captivate") {
      result.prevented = failedSave;
    } else if (move.id === "attract") {
      result.rerollDamageUseLower = failedSave;
    } else if (move.id === "crafty-shield") {
      result.preventStatus = true;
    } else if (move.id === "block") {
      if (target) {
        target.effects.switchLockSources.push({ source: move.id, expiresRound });
        target.effects.escapeLockSources.push({ source: move.id, expiresRound });
      }
      result.prevented = true;
    } else if (move.id === "encore" && target && failedSave) {
      const allowed = target.lastMoveId;
      const locked = target.moveIds.filter((id) => id !== allowed);
      target.effects.moveLockSources.push({ source: move.id, moveIds: locked, expiresRound: next.round + 2 });
      result.allowedMoveId = allowed;
    } else if (move.id === "light-screen") {
      result.damageMultiplier = 0.5;
      reactor.effects.damageResistanceSources.push({ source: move.id, type: null, scope: "ranged", steps: 1, expiresRound: next.round + 1 });
    } else if (move.id === "reflect") {
      result.damageMultiplier = 0.5;
      reactor.effects.damageResistanceSources.push({ source: move.id, type: null, scope: "melee", steps: 1, expiresRound: next.round + 1 });
    } else if (move.id === "wide-guard") {
      reactor.abilityState.canonicalReactionUses ??= {};
      const uses = Number(reactor.abilityState.canonicalReactionUses[move.id] ?? 0);
      const succeeds = uses === 0 || this.dice.roll(20) > 15;
      reactor.abilityState.canonicalReactionUses[move.id] = uses + 1;
      result.damageMultiplier = succeeds ? 0.5 : 1;
    } else if (move.id === "withdraw") {
      result.acBonus = 2;
      reactor.effects.acModifierSources.push({ source: move.id, value: 2, expiresRound: next.round + 1 });
    } else if (move.id === "shelter") {
      result.acBonus = 5;
      reactor.effects.acModifierSources.push({ source: move.id, value: 5, expiresRound: next.round + 1 });
    } else if (move.id === "lucky-chant") {
      result.negateCritical = true;
    } else if (move.id === "magic-coat") {
      result.reflectStatus = true;
    } else if (move.id === "heal-block") {
      result.preventHealing = true;
    } else if (move.id === "spite" && target && failedSave && incomingMoveId) {
      const drain = this.dice.roll(4);
      target.pp[incomingMoveId] = Math.max(0, Number(target.pp[incomingMoveId] ?? 0) - drain);
      result.ppDrained = drain;
    } else if (move.id === "grudge" && target && failedSave && incomingMoveId) {
      target.pp[incomingMoveId] = 0;
      result.ppDepleted = incomingMoveId;
    } else if (move.id === "torment" && target && failedSave && incomingMoveId) {
      target.effects.moveLockSources.push({
        source: move.id,
        moveIds: [incomingMoveId],
        startsRound: next.round + 1,
        expiresRound: next.round + 2
      });
      result.lockedMoveId = incomingMoveId;
    } else if (move.id === "sticky-web" && target) {
      target.effects.restrainedSources.push({ source: move.id, expiresRound: null });
      result.restrained = true;
    } else if (move.id === "take-heart") {
      const cured = [];
      for (const status of STATUS_IDS) if (clearStatus(reactor, status)) cured.push(status);
      reactor.effects.statusImmunitySources.push({ source: move.id, expiresRound: next.round + 2 });
      reactor.effects.attackAdvantageSources.push({ source: move.id, expiresRound: next.round + 2 });
      reactor.effects.saveAdvantageSources.push({ source: move.id, expiresRound: next.round + 2 });
      result.cured = cured;
    } else if (move.id === "sketch" && incomingMoveId) {
      const index = reactor.moveIds.indexOf("sketch");
      if (index >= 0) {
        reactor.moveIds[index] = incomingMoveId;
        reactor.pp[incomingMoveId] = reactor.pp.sketch ?? 1;
        reactor.maxPp[incomingMoveId] = reactor.maxPp.sketch ?? reactor.pp[incomingMoveId];
        delete reactor.pp.sketch;
        delete reactor.maxPp.sketch;
      }
      result.learnedMoveId = incomingMoveId;
    } else if (move.id === "strength-sap") {
      const stats = calculateMoveStats(reactor, move, next.round);
      const roll = rollExpression(stats.damageDice, this.dice);
      const before = reactor.hp.current;
      reactor.hp.current = Math.min(reactor.hp.max, before + roll.total + stats.damageModifier);
      result.healing = reactor.hp.current - before;
      result.prevented = true;
    } else if (move.id === "powder" && target) {
      const stats = calculateMoveStats(reactor, move, next.round);
      const roll = rollExpression(stats.damageDice, this.dice);
      const damage = Math.max(0, roll.total + stats.damageModifier);
      target.hp.current = Math.max(0, target.hp.current - damage);
      result.damage = damage;
      if (target.hp.current <= 0) markDowned(next, targetSide, "powder");
    } else if (move.id === "shed-tail") {
      const recoil = rollExpression("2d6", this.dice).total;
      reactor.hp.current = Math.max(0, reactor.hp.current - recoil);
      result.prevented = true;
      result.recoil = recoil;
      if (healthyBenchIndices(next, reactorSide).length > 0) next.awaitingSwitch = reactorSide;
      if (reactor.hp.current <= 0) markDowned(next, reactorSide, "shed-tail");
    } else if (move.id === "quick-guard") {
      result.prevented = next.round === 1 && next.turnIndex === 0;
    } else if (move.id === "court-change" || move.id === "follow-me" || move.id === "snatch" || move.id === "me-first") {
      result.redirect = failedSave;
    } else if (move.id === "hold-hands") {
      result.attackBonus = 1;
      result.acBonus = 1;
    } else if (move.id === "electrify") {
      result.overrideIncomingType = failedSave ? "electric" : null;
    } else if (move.id === "retaliate" || move.id === "revenge" || move.id === "metal-burst" || move.id === "mirror-coat") {
      result.counterattack = true;
      result.counterDamage = incomingDamage == null
        ? null
        : Math.min(Number(incomingDamage), reactor.level * 5);
    }

    next.log.push(result);
    next.canonicalRuntime.effects.push({
      moveId: move.id,
      sourceSide: reactorSide,
      targetSide,
      family: "reaction",
      startedRound: next.round,
      expiresRound,
      result: clone(result)
    });
    return next;
  }

  async useReactionMove(
    battle,
    reactorSide,
    moveId,
    {
      trigger,
      targetSide: requestedTargetSide = null,
      incomingDamage = null,
      incomingMoveId = null,
      incomingNatural = null,
      incomingDamageType = null
    } = {}
  ) {
    if (battle.outcome || battle.awaitingSwitch) return clone(battle);

    const next = clone(battle);
    const reactor = next[reactorSide];
    if (!reactor) throw new Error(`Unknown reactor side: ${reactorSide}`);
    if (!reactor.reactionAvailable) {
      throw new Error(`${reactor.name} has no reaction available`);
    }
    if (!reactor.moveIds.includes(moveId)) {
      throw new Error(`${reactor.name} does not know ${moveId}`);
    }
    if ((reactor.pp[moveId] ?? 0) <= 0) {
      throw new Error(`${moveId} has no PP remaining`);
    }

    const move = await this.data.getMove(moveId);
    if (move.time?.unit !== "reaction") {
      throw new Error(`${moveId} is not a Reaction move`);
    }
    if (!isSupportedReactionMove(move)) {
      throw new Error(`Reaction move ${move.id} does not yet have an executable reaction rule`);
    }

    const requiredTrigger = reactionTriggerForMove(move);
    if (trigger !== requiredTrigger) {
      throw new Error(
        `${move.name} requires reaction trigger ${requiredTrigger}; received ${trigger ?? "none"}`
      );
    }

    const targetSide = requestedTargetSide ?? otherSide(reactorSide);
    if (targetSide !== otherSide(reactorSide)) {
      throw new Error(`${move.name} currently requires the opposing active creature as target`);
    }
    const target = next[targetSide];
    const range = rangeCheckForMove(reactor, target, move, next.battlefield);
    if (!range.legal) {
      throw new Error(
        `${move.name} reaction is out of range: ${range.distance.toFixed(1)}ft > ${range.maxRange}ft`
      );
    }

    const pressureApplies =
      target.abilityId === "pressure" &&
      move.range?.type !== "self";
    const ppCost = pressureApplies ? 2 : 1;
    if ((reactor.pp[moveId] ?? 0) < ppCost) {
      throw new Error(`${moveId} needs ${ppCost} PP because of Pressure`);
    }

    reactor.pp[moveId] = Math.max(0, reactor.pp[moveId] - ppCost);
    reactor.reactionAvailable = false;
    next.log.push({
      type: "reaction_use",
      round: next.round,
      actor: reactorSide,
      target: targetSide,
      trigger,
      moveId,
      ppCost
    });

    if (REACTION_ATTACK_MOVES.has(move.id)) {
      return this.resolveAttackMove(next, reactorSide, move, { reaction: true });
    }

    if (REACTION_STATUS_MOVES.has(move.id)) {
      const result = resolveSaveMove({
        attacker: reactor,
        defender: target,
        move,
        dice: this.dice,
        round: next.round
      });
      const status = failedSaveStatus(move, result.save);
      const statusResult = applyMoveStatus(
        reactor,
        target,
        status,
        next.round
      );
      next.log.push({
        type: "reaction_status",
        round: next.round,
        actor: reactorSide,
        target: targetSide,
        trigger,
        ...result,
        status,
        statusResult
      });
      return next;
    }

    if (isCanonicalSpecialMove(move)) {
      return this.resolveCanonicalReactionMove(next, reactorSide, move, {
        trigger,
        targetSide,
        incomingDamage,
        incomingMoveId,
        incomingNatural,
        incomingDamageType
      });
    }

    throw new Error(`No reaction handler for ${move.id}`);
  }

  async opportunityAttack(battle, reactorSide, moverSide, moveId) {
    const next = clone(battle);
    const reactor = next[reactorSide];
    const mover = next[moverSide];

    if (!reactor.reactionAvailable) throw new Error(`${reactor.name} has no reaction available`);
    if (mover.abilityId === "run-away") throw new Error(`${mover.name} cannot be targeted by attacks of opportunity`);
    if (!reactor.moveIds.includes(moveId)) throw new Error(`${reactor.name} does not know ${moveId}`);
    if ((reactor.pp[moveId] ?? 0) <= 0) throw new Error(`${moveId} has no PP remaining`);

    const move = await this.data.getMove(moveId);
    if (move.time?.unit !== "action" || move.range?.type !== "melee" || !move.attack) {
      throw new Error("Attack of opportunity requires a melee move with Move Time 1 Action");
    }

    if (distance(reactor.position, mover.position) > reactor.reach + 1e-9) {
      throw new Error("Target is not within melee reach for the opportunity attack");
    }

    reactor.reactionAvailable = false;
    reactor.pp[move.id] -= 1;
    next.log.push({
      type: "reaction_use",
      round: next.round,
      actor: reactorSide,
      reaction: "attack_of_opportunity",
      moveId
    });

    return this.resolveAttackMove(next, reactorSide, move, { reaction: true });
  }

  async moveCombatant(
    battle,
    side,
    destination,
    { opportunityMoveId = null, movementType = null, forced = false } = {}
  ) {
    if (battle.outcome || battle.awaitingSwitch) return clone(battle);
    if (this.actor(battle) !== side) throw new Error(`It is not ${side}'s turn`);

    let next = await this.prepareCurrentTurn(battle);
    if (this.actor(next) !== side) return next;

    const mover = next[side];
    const reactorSide = otherSide(side);
    const reactor = next[reactorSide];
    const target = point(
      destination.x,
      destination.y,
      Number.isFinite(destination.z) ? destination.z : (Number.isFinite(mover.position?.z) ? mover.position.z : undefined)
    );
    const mode = movementType ?? mover.movementMode ?? baseMovementSpeed(mover).type;
    const movement = validateMovement(mover, mover.position, target, {
      movementType: mode,
      battlefield: next.battlefield,
      round: next.round,
      forced
    });
    if (!movement.legal) {
      const detail = movement.obstacleId ? ` (${movement.obstacleId})` : "";
      throw new Error(`Illegal ${mode} movement: ${movement.reason}${detail}`);
    }
    const spentBefore = Number(mover.turn.movementSpent ?? 0);
    const available = Math.max(0, movementSpeedForType(mover, mode, next.round).value - spentBefore);
    const travel = movement.cost;

    if (!forced && travel > available + 1e-9) {
      throw new Error(`Movement exceeds remaining speed: ${travel.toFixed(1)}ft > ${available.toFixed(1)}ft`);
    }

    const provokes =
      !mover.turn.disengaged &&
      mover.abilityId !== "run-away" &&
      reactor.hp.current > 0 &&
      leavesReach({
        moverStart: mover.position,
        moverEnd: target,
        reactor
      });

    if (provokes && opportunityMoveId && reactor.reactionAvailable) {
      next = await this.opportunityAttack(next, reactorSide, side, opportunityMoveId);
      if (next.outcome || next.awaitingSwitch || next[side].hp.current <= 0) return next;
    }

    const from = clone(next[side].position);
    next[side].position = target;
    next[side].movementMode = mode;
    next[side].turn.movementSpent = spentBefore + travel;
    next[side].turn.movementRemaining = Math.max(
      0,
      movementSpeedForType(next[side], mode, next.round).value - next[side].turn.movementSpent
    );
    next.log.push({
      type: "movement",
      round: next.round,
      actor: side,
      from,
      to: clone(target),
      feet: movement.distance,
      movementCost: travel,
      difficultFeet: movement.difficultFeet,
      movementType: mode,
      forced,
      provokedOpportunity: provokes,
      opportunityTaken: Boolean(provokes && opportunityMoveId)
    });

    for (const zone of next.zones) {
      const transition = zoneTransition(zone, from, target);
      if (transition.entered && zone.triggerOnEnter !== false) {
        const exposure = applyZoneExposure(next, side, zone, this.dice, "enter");
        if (exposure.downed || next.outcome || next.awaitingSwitch) return next;
      }
      if (transition.left && zone.triggerOnLeave) {
        const exposure = applyZoneExposure(next, side, zone, this.dice, "leave");
        if (exposure.downed || next.outcome || next.awaitingSwitch) return next;
      }
    }

    return next;
  }

  async moveTrainer(battle, destination) {
    if (battle.outcome || battle.awaitingSwitch) return clone(battle);
    if (this.actor(battle) !== "player") throw new Error("Trainer movement is available on the player's turn");

    const next = await this.prepareCurrentTurn(battle);
    if (this.actor(next) !== "player") return next;

    const target = point(
      destination.x,
      destination.y,
      Number.isFinite(destination.z) ? destination.z : (Number.isFinite(next.trainer.position?.z) ? next.trainer.position.z : undefined)
    );
    const travel = distance(next.trainer.position, target);
    if (travel > next.trainer.movementRemaining + 1e-9) {
      throw new Error(`Trainer movement exceeds remaining speed: ${travel.toFixed(1)}ft > ${next.trainer.movementRemaining}ft`);
    }

    const from = clone(next.trainer.position);
    next.trainer.position = target;
    next.trainer.movementRemaining -= travel;
    next.log.push({
      type: "trainer_movement",
      round: next.round,
      from,
      to: clone(target),
      feet: travel
    });
    return next;
  }

  async switchPlayer(battle, benchIndex, { releasePosition = null } = {}) {
    if (battle.outcome) return clone(battle);
    const next = clone(battle);
    const forced = next.awaitingSwitch === "player";

    if (!forced && this.actor(next) !== "player") {
      throw new Error("A voluntary switch can only be made on the player's turn");
    }

    if (!Number.isInteger(benchIndex) || benchIndex < 0 || benchIndex >= next.playerBench.length) {
      throw new Error("Invalid bench index");
    }

    const incoming = next.playerBench[benchIndex];
    if (incoming.hp.current <= 0) throw new Error("Cannot switch to a fainted Pokémon");

    const outgoing = next.player;
    const switchLock = (outgoing.effects?.switchLockSources ?? []).find(
      (entry) => entry.expiresRound == null || next.round < entry.expiresRound
    );
    if (!forced && switchLock) {
      const label = switchLock.source === "ingrain" ? "Ingrain" : switchLock.source;
      throw new Error(`${label} prevents voluntary switching`);
    }
    if (!withinLineOfSightDistance(next.trainer.position, outgoing.position, 60)) {
      throw new Error("Active Pokémon is more than 60ft from the trainer");
    }

    const release = defaultPosition(releasePosition, next.trainer.position);
    if (!withinLineOfSightDistance(next.trainer.position, release, 15)) {
      throw new Error("Switched-in Pokémon must be released within 15ft of the trainer");
    }

    if (forced) {
      if (!next.trainer.reactionAvailable) throw new Error("Trainer has no reaction available to replace the fainted Pokémon");
      next.trainer.reactionAvailable = false;
    } else {
      const prepared = await this.prepareCurrentTurn(next);
      if (this.actor(prepared) !== "player") return prepared;
      if (!prepared.player.turn.actionAvailable || !prepared.trainer.actionAvailable) {
        throw new Error("Switching requires the trainer's action");
      }
      prepared.player.turn.actionAvailable = false;
      prepared.trainer.actionAvailable = false;
      Object.assign(next, prepared);
    }

    endConcentrationState(next, "player", "switch");
    if (forced && outgoing.hp.current <= 0) recallFaintedPokemon(outgoing);
    clearTransientEffects(outgoing);
    outgoing.position = null;
    outgoing.turn.started = false;
    outgoing.turn.movementRemaining = 0;

    next.playerBench[benchIndex] = outgoing;
    incoming.position = release;
    releasePokemonFromBall(incoming);
    incoming.switchedInRound = next.round;
    incoming.reactionAvailable = false;
    incoming.turn.started = true;
    incoming.turn.actionAvailable = false;
    incoming.turn.bonusActionAvailable = false;
    incoming.turn.disengaged = false;
    incoming.turn.movementRemaining = 0;
    next.player = incoming;
    next.awaitingSwitch = null;
    applyPendingSwitchEffect(next, "player", incoming);

    next.log.push({
      type: "switch",
      round: next.round,
      actor: "player",
      forced,
      out: outgoing.speciesId,
      in: incoming.speciesId,
      releasePosition: clone(release),
      provokesOpportunity: false
    });

    if (!forced) return endTurnInternal(next, "player", this.dice);
    return next;
  }

  fleeBlockedReason(battle) {
    const player = battle.player;
    const opponent = battle.opponent;
    const activeEscapeLock = (player.effects?.escapeLockSources ?? []).find(
      (entry) => entry.expiresRound == null || battle.round < entry.expiresRound
    );
    if (activeEscapeLock) return activeEscapeLock.source ?? "escape_lock";

    const range = player.position && opponent.position
      ? distance(player.position, opponent.position)
      : Infinity;
    const hasFlight = (player.speed ?? []).some(
      (entry) => ["flying", "hover"].includes(entry.type) && Number(entry.value ?? 0) > 0
    );
    const grounded = player.abilityId !== "levitate" && !hasFlight;

    if (opponent.abilityId === "shadow-tag" && range <= 50 + 1e-9) return "shadow-tag";
    if (opponent.abilityId === "arena-trap" && grounded && range <= 50 + 1e-9) return "arena-trap";
    if (opponent.abilityId === "magnet-pull" && player.types?.includes("steel")) return "magnet-pull";
    return null;
  }

  async attemptPlayerFlee(
    battle,
    {
      participants = [{ id: "trainer", modifier: 0 }],
      dc = 15,
      advantage = false,
      disadvantage = false,
      useEscapeRope = false
    } = {}
  ) {
    if (battle.outcome || battle.awaitingSwitch) {
      return { battle: clone(battle), result: { legal: false, reason: "combat_not_active" } };
    }
    if (battle.sanctioned) {
      return { battle: clone(battle), result: { legal: false, reason: "flee_only_wild_combat" } };
    }
    if (this.actor(battle) !== "player") {
      throw new Error("Fleeing may be attempted on the player's turn");
    }

    let next = await this.prepareCurrentTurn(battle);
    if (this.actor(next) !== "player") {
      return { battle: next, result: { legal: false, reason: "turn_skipped" } };
    }
    next.flee ??= { lastAttemptRound: null, chase: null };
    if (next.flee.lastAttemptRound === next.round) {
      return { battle: next, result: { legal: false, reason: "flee_already_attempted_this_round" } };
    }

    const ropeIndex = useEscapeRope
      ? findInventoryItemIndex(next.trainer.inventory, "escape-rope")
      : -1;
    if (useEscapeRope && ropeIndex < 0) {
      return { battle: next, result: { legal: false, reason: "no_escape_rope" } };
    }

    const blockedBy = this.fleeBlockedReason(next);
    const moveGrantedSuccesses = Number(next.flee.bonusSuccesses ?? 0);
    if (blockedBy && !useEscapeRope && moveGrantedSuccesses <= 0) {
      next.flee.lastAttemptRound = next.round;
      next.log.push({
        type: "flee_attempt",
        round: next.round,
        actor: "player",
        legal: false,
        blockedBy
      });
      return { battle: next, result: { legal: false, reason: "flee_blocked", blockedBy } };
    }

    next.flee.lastAttemptRound = next.round;
    let result;
    if (useEscapeRope) {
      next.trainer.inventory.splice(ropeIndex, 1);
      result = {
        legal: true,
        escaped: true,
        automatic: true,
        source: "escape-rope",
        checks: []
      };
    } else {
      const group = resolveGroupFleeCheck({
        participants,
        dc,
        dice: this.dice,
        advantage,
        disadvantage
      });
      group.successes += moveGrantedSuccesses;
      group.requiredSuccesses = Math.ceil(group.checks.length / 2);
      group.escaped = group.successes >= group.requiredSuccesses;
      result = {
        legal: true,
        automatic: false,
        source: moveGrantedSuccesses > 0 ? "group-check+move" : "group-check",
        moveGrantedSuccesses,
        ...group
      };
      next.flee.bonusSuccesses = 0;
    }

    next.log.push({
      type: "flee_attempt",
      round: next.round,
      actor: "player",
      ...clone(result)
    });

    if (result.escaped) {
      const pursuits = await this.availableReactionMoves(next, "opponent", "target_flees");
      const pursuit = pursuits.find((entry) => entry.id === "pursuit");
      if (pursuit) {
        next = await this.useReactionMove(next, "opponent", pursuit.id, {
          trigger: "target_flees",
          targetSide: "player"
        });
        if (next.player.hp.current <= 0 || next.awaitingSwitch || next.outcome) {
          return {
            battle: next,
            result: { ...result, escaped: false, interruptedBy: "pursuit" }
          };
        }
      }

      next.outcome = "fled";
      next.log.push({
        type: "combat_end",
        round: next.round,
        outcome: "fled",
        reason: result.source
      });
      return { battle: next, result };
    }

    next.trainer.actionAvailable = false;
    next.player.turn.actionAvailable = false;
    return { battle: endTurnInternal(next, "player", this.dice), result };
  }

  startPlayerChase(battle, options = {}) {
    const next = clone(battle);
    if (next.sanctioned) {
      return { battle: next, result: { legal: false, reason: "flee_only_wild_combat" } };
    }
    next.flee ??= { lastAttemptRound: null, chase: null };
    if (next.flee.lastAttemptRound === next.round) {
      return { battle: next, result: { legal: false, reason: "flee_already_attempted_this_round" } };
    }
    const blockedBy = this.fleeBlockedReason(next);
    if (blockedBy) {
      next.flee.lastAttemptRound = next.round;
      return { battle: next, result: { legal: false, reason: "flee_blocked", blockedBy } };
    }
    next.flee.lastAttemptRound = next.round;
    next.flee.chase = createChaseState(options);
    next.log.push({
      type: "chase_start",
      round: next.round,
      actor: "player",
      chase: clone(next.flee.chase)
    });
    return { battle: next, result: { legal: true, chase: clone(next.flee.chase) } };
  }

  advancePlayerChase(
    battle,
    {
      quarryCheck = { modifier: 0 },
      pursuerCheck = { modifier: 0 },
      quarryAdvantage = false,
      pursuerAdvantage = false
    } = {}
  ) {
    const next = clone(battle);
    if (!next.flee?.chase) {
      return { battle: next, result: { legal: false, reason: "no_active_chase" } };
    }
    next.flee.chase = resolveChaseRound(next.flee.chase, {
      quarryCheck,
      pursuerCheck,
      dice: this.dice,
      quarryAdvantage,
      pursuerAdvantage
    });
    next.log.push({
      type: "chase_round",
      round: next.round,
      chase: clone(next.flee.chase)
    });
    if (next.flee.chase.outcome === "escaped") {
      next.outcome = "fled";
      next.log.push({ type: "combat_end", round: next.round, outcome: "fled", reason: "chase" });
    }
    return {
      battle: next,
      result: { legal: true, chase: clone(next.flee.chase), outcome: next.flee.chase.outcome }
    };
  }

  resolvePokemonDeathSave(battle, side = "player", { benchIndex = null } = {}) {
    const next = clone(battle);
    const pokemon = benchIndex == null
      ? next[side]
      : benchForSide(next, side)[benchIndex];
    if (!pokemon) return { battle: next, result: { rolled: false, reason: "pokemon_not_found" } };
    const result = resolvePokemonDeathSave(pokemon, this.dice);
    next.log.push({
      type: "death_save",
      round: next.round,
      actor: side,
      benchIndex,
      speciesId: pokemon.speciesId,
      ...clone(result)
    });
    return { battle: next, result };
  }

  advancePokeballRecovery(battle, minutes) {
    const next = clone(battle);
    const results = [];
    for (const side of ["player", "opponent"]) {
      const entries = [next[side], ...benchForSide(next, side)];
      entries.forEach((pokemon, index) => {
        if (!pokemon?.death?.inPokeball) return;
        const result = advancePokeballStabilization(pokemon, minutes);
        results.push({
          side,
          benchIndex: index === 0 ? null : index - 1,
          speciesId: pokemon.speciesId,
          ...result
        });
      });
    }
    next.log.push({
      type: "pokeball_recovery",
      round: next.round,
      minutes,
      results: clone(results)
    });
    return { battle: next, results };
  }

  trainerAsDefender(trainer) {
    const ability = (key) => Number(trainer.abilities?.[key] ?? trainer.abilities?.[key.toLowerCase()] ?? 10);
    return {
      combatantId: "trainer",
      name: trainer.name,
      level: trainer.level ?? trainer.trainerLevel ?? 1,
      ac: trainer.ac,
      types: [],
      abilityId: null,
      attributes: {
        str: ability("STR"),
        dex: ability("DEX"),
        con: ability("CON"),
        int: ability("INT"),
        wis: ability("WIS"),
        cha: ability("CHA")
      },
      savingThrows: (trainer.savingThrows ?? []).map((entry) => String(entry).toLowerCase()),
      effects: {
        saveAdvantageSources: [],
        saveModifierSources: [],
    saveDisadvantageSources: [],
    saveRollDiceSources: [],
    targetSaveDisadvantageSources: [],
        restrainedSources: [],
        typeImmunitySources: [],
        damageResistanceSources: [],
        damageReductionSources: []
      },
      statuses: createStatusState(),
      hp: trainer.hp
    };
  }

  async useOpponentMoveAgainstTrainer(battle, moveId) {
    if (battle.outcome || battle.awaitingSwitch) return clone(battle);
    if (this.actor(battle) !== "opponent") {
      throw new Error("The opponent can target the Trainer only on its turn");
    }

    let next = await this.prepareCurrentTurn(battle);
    if (this.actor(next) !== "opponent") return next;
    const attacker = next.opponent;
    const trainer = next.trainer;

    if (!attacker.moveIds.includes(moveId)) throw new Error(`${attacker.name} does not know ${moveId}`);
    if ((attacker.pp[moveId] ?? 0) <= 0) throw new Error(`${moveId} has no PP remaining`);

    const move = await this.data.getMove(moveId);
    if (!isMoveResolvable(move)) throw new Error(`Move ${move.id} is not runtime-resolvable`);
    const slot = moveSlot(move);
    if (!slot || !attacker.turn[slot]) throw new Error(`No ${move.time?.unit ?? "turn"} slot available for ${moveId}`);

    const targetProxy = this.trainerAsDefender(trainer);
    targetProxy.position = trainer.position;
    const range = rangeCheckForMove(attacker, targetProxy, move, next.battlefield);
    if (!range.legal) {
      throw new Error(`${move.name} is out of range of the Trainer`);
    }

    attacker.pp[moveId] = Math.max(0, attacker.pp[moveId] - 1);
    attacker.turn[slot] = false;
    attacker.lastMoveId = move.id;

    let resolution = null;
    const wasDown = trainer.hp.current <= 0;

    if (move.attack && move.dice?.type === "damage") {
      resolution = resolveAttack({
        attacker,
        defender: targetProxy,
        move,
        dice: this.dice,
        round: next.round
      });
      if (resolution.hit) {
        trainer.hp.current = Math.max(0, trainer.hp.current - resolution.damage);
      }
    } else if (move.save && move.dice?.type === "damage") {
      const stats = calculateMoveStats(attacker, move, next.round);
      const save = resolveSavingThrow({
        defender: targetProxy,
        attribute: stats.saveAttribute,
        dc: stats.saveDc,
        dice: this.dice,
        round: next.round
      });
      const damageRoll = rollExpression(stats.damageDice, this.dice);
      const rawDamage = Math.max(0, damageRoll.total + stats.damageModifier);
      const damage = save.success && saveAllowsHalfDamage(move)
        ? Math.floor(rawDamage / 2)
        : save.success
          ? 0
          : rawDamage;
      trainer.hp.current = Math.max(0, trainer.hp.current - damage);
      resolution = { save, damageRoll, rawDamage, damage };
    } else if (move.dice?.type === "damage") {
      const stats = calculateMoveStats(attacker, move, next.round);
      const damageRoll = rollExpression(stats.damageDice, this.dice);
      const damage = Math.max(0, damageRoll.total + stats.damageModifier);
      trainer.hp.current = Math.max(0, trainer.hp.current - damage);
      resolution = { automatic: true, damageRoll, damage };
    } else if (move.save) {
      const stats = calculateMoveStats(attacker, move, next.round);
      const save = resolveSavingThrow({
        defender: targetProxy,
        attribute: stats.saveAttribute,
        dc: stats.saveDc,
        dice: this.dice,
        round: next.round
      });
      const condition = failedSaveStatus(move, save);
      if (condition && !save.success && !trainer.conditions.includes(condition)) {
        trainer.conditions.push(condition);
      }
      resolution = { save, condition: save.success ? null : condition };
    } else {
      next.canonicalRuntime ??= { effects: [], flags: {}, pendingChoices: [] };
      next.canonicalRuntime.pendingChoices.push({
        kind: "trainer_target_move",
        moveId: move.id,
        actor: "opponent",
        target: "trainer",
        description: move.description
      });
      resolution = { pendingCanonicalEffect: true };
    }

    if (trainer.hp.current <= 0) {
      trainer.death ??= {
        state: "alive",
        deathSaveSuccesses: 0,
        deathSaveFailures: 0,
        stable: false,
        dead: false
      };
      if (wasDown) {
        const damageAtZero = damageTrainerAtZero(trainer, {
          critical: Boolean(resolution?.critical)
        });
        resolution.damageAtZero = damageAtZero;
      } else {
        trainer.death.state = "dying";
        trainer.death.stable = false;
        trainer.death.dead = false;
        trainer.death.deathSaveSuccesses = 0;
        trainer.death.deathSaveFailures = 0;
      }
      if (trainer.death.dead) {
        next.outcome = "career_ended";
      }
    }

    next.log.push({
      type: "trainer_targeted",
      round: next.round,
      actor: "opponent",
      target: "trainer",
      moveId: move.id,
      resolution: clone(resolution),
      trainerHpAfter: trainer.hp.current,
      deathState: trainer.death?.state ?? "alive"
    });

    if (next.outcome === "career_ended") {
      next.log.push({
        type: "combat_end",
        round: next.round,
        outcome: "career_ended",
        reason: "trainer_death"
      });
      return next;
    }

    return endTurnInternal(next, "opponent", this.dice);
  }

  resolveTrainerDeathSave(battle) {
    const next = clone(battle);
    const result = resolveTrainerDeathSave(next.trainer, this.dice);
    if (result.dead) {
      next.outcome = "career_ended";
      next.log.push({
        type: "combat_end",
        round: next.round,
        outcome: "career_ended",
        reason: "trainer_death"
      });
    }
    next.log.push({
      type: "trainer_death_save",
      round: next.round,
      ...clone(result)
    });
    return { battle: next, result };
  }

  async attemptPlayerCapture(battle, ball = "pokeball", context = {}) {
    if (battle.outcome || battle.awaitingSwitch) return { battle: clone(battle), result: { legal: false, reason: "combat_not_active" } };
    if (this.actor(battle) !== "player") throw new Error("Throw Pokéball is only available on the player's turn");

    const next = await this.prepareCurrentTurn(battle);
    if (this.actor(next) !== "player") return { battle: next, result: { legal: false, reason: "turn_skipped" } };
    if (!next.trainer.actionAvailable || !next.player.turn.actionAvailable) {
      return { battle: next, result: { legal: false, reason: "no_action" } };
    }

    const inventoryIndex = findBallIndex(next.trainer.inventory, ball);
    if (inventoryIndex < 0) {
      return { battle: next, result: { legal: false, reason: "no_ball", consumed: false, captured: false } };
    }

    const result = attemptCapture({
      trainer: next.trainer,
      target: next.opponent,
      activePokemon: next.player,
      ball,
      distanceFeet: distance(next.trainer.position, next.opponent.position),
      round: next.round,
      registered: next.opponentRegistered,
      context: {
        ...context,
        restrained:
          Boolean(context.restrained) ||
          hasActiveSource(next.opponent.effects?.restrainedSources ?? [], next.round),
        trainerFeatureAdvantage: (next.trainerEffects?.captureAdvantage?.usesRemaining ?? 0) > 0
      },
      dice: this.dice
    });

    if (!result.legal) return { battle: next, result };

    if ((next.trainerEffects?.captureAdvantage?.usesRemaining ?? 0) > 0) next.trainerEffects.captureAdvantage.usesRemaining -= 1;

    next.trainer.inventory.splice(inventoryIndex, 1);
    next.trainer.actionAvailable = false;
    next.player.turn.actionAvailable = false;
    next.log.push({
      type: "capture_attempt",
      round: next.round,
      actor: "trainer",
      target: "opponent",
      ...result
    });

    if (result.captured) {
      next.outcome = "captured";
      next.log.push({
        type: "combat_end",
        round: next.round,
        outcome: "captured",
        reason: "capture"
      });
    }

    return { battle: next, result };
  }

  async useTrainerItem(battle, itemId, { targetSide = "player", moveId = null } = {}) {
    if (battle.outcome || battle.awaitingSwitch) {
      return { battle: clone(battle), result: { applied: false, reason: "combat_not_active" } };
    }
    if (this.actor(battle) !== "player") throw new Error("Trainer items are only available on the player's turn");

    const next = await this.prepareCurrentTurn(battle);
    if (this.actor(next) !== "player") {
      return { battle: next, result: { applied: false, reason: "turn_skipped" } };
    }
    if (!next.trainer.actionAvailable) {
      return { battle: next, result: { applied: false, reason: "no_trainer_action" } };
    }

    const index = findInventoryItemIndex(next.trainer.inventory, itemId);
    if (index < 0) {
      return { battle: next, result: { applied: false, reason: "item_not_owned" } };
    }

    const target = next[targetSide];
    if (!target) throw new Error(`Unknown Pokémon target side: ${targetSide}`);
    const item = await this.data.getItem(itemId);
    const compiled = applyItemToPokemon({ item, target, dice: this.dice, moveId });

    if (!compiled.applied) return { battle: next, result: compiled };

    if (compiled.compiled.requiresAdjacent &&
        distance(next.trainer.position, target.position) > 5 + 1e-9) {
      return { battle: clone(battle), result: { applied: false, reason: "target_not_adjacent" } };
    }

    if (compiled.consumed) next.trainer.inventory.splice(index, 1);
    next.trainer.actionAvailable = false;
    next.log.push({
      type: "trainer_item",
      round: next.round,
      actor: "trainer",
      target: targetSide,
      itemId: item.id,
      effects: clone(compiled.effects),
      consumed: compiled.consumed
    });
    return { battle: next, result: compiled };
  }

  async usePlayerMove(battle, moveId, options = {}) {
    return this.useMove(battle, "player", moveId, options);
  }

  async endPlayerTurn(battle) {
    if (battle.outcome) return clone(battle);
    if (battle.awaitingSwitch) throw new Error("A required switch must be resolved first");
    if (this.actor(battle) !== "player") throw new Error("It is not the player's turn");
    const prepared = await this.prepareCurrentTurn(battle);
    if (this.actor(prepared) !== "player") return prepared;
    return endTurnInternal(prepared, "player", this.dice);
  }

  async useOpponentTurn(battle, { usePlayerIntimidate = false } = {}) {
    if (battle.outcome || battle.awaitingSwitch) return clone(battle);
    if (this.actor(battle) !== "opponent") return clone(battle);

    let next = await this.prepareCurrentTurn(battle);
    if (this.actor(next) !== "opponent") return next;

    if (next.opponentTrainer) {
      runNpcTrainerTurnFeatures({ battle: next, trainer: next.opponentTrainer, dice: this.dice });
    }

    let usable = await this.legalMoves(next, "opponent");
    if (usable.length === 0 && next.opponent.turn.movementRemaining > 0) {
      const before = clone(next.opponent.position);
      const targetDistance = distance(next.opponent.position, next.player.position);
      const desiredTravel = Math.min(
        next.opponent.turn.movementRemaining,
        Math.max(0, targetDistance - next.opponent.reach)
      );
      if (desiredTravel > 0) {
        next.opponent.position = moveToward(next.opponent.position, next.player.position, desiredTravel);
        next.opponent.turn.movementRemaining -= desiredTravel;
        next.log.push({
          type: "movement",
          round: next.round,
          actor: "opponent",
          from: before,
          to: clone(next.opponent.position),
          feet: desiredTravel,
          provokedOpportunity: false,
          opportunityTaken: false
        });
      }
      usable = await this.legalMoves(next, "opponent");
    }

    if (usable.length === 0) return endTurnInternal(next, "opponent", this.dice);

    usable.sort((a, b) => {
      const rank = (move) => {
        const timeRank = move.time?.unit === "action" ? 0 : 10;
        const directRank = move.attack && move.dice?.type === "damage" ? 0 : 1;
        return timeRank + directRank;
      };
      return rank(a) - rank(b);
    });

    const selected = usable[0];
    if (
      selected.attack &&
      next.trainer?.classFeatures?.includes("raise-your-defenses") &&
      Number(next.trainer?.classResources?.["tactical-points"]?.current ?? 0) >= 1 &&
      next.trainer?.reactionAvailable &&
      !next.pendingTrainerReaction
    ) {
      next.pendingTrainerReaction = {
        trigger: "targeted_by_attack",
        featureId: "raise-your-defenses",
        mode: "ac",
        attackerSide: "opponent",
        targetSide: "player",
        moveId: selected.id
      };
      next.log.push({
        type: "trainer_reaction_window",
        round: next.round,
        featureId: "raise-your-defenses",
        trigger: "targeted_by_attack",
        moveId: selected.id
      });
      return next;
    }

    return this.useMove(next, "opponent", selected.id, {
      useDefenderIntimidate: usePlayerIntimidate
    });
  }

  async resolvePendingTrainerReaction(battle, { useReaction = false, usePlayerIntimidate = false } = {}) {
    if (!battle.pendingTrainerReaction) throw new Error("No Trainer reaction is pending");
    const next = clone(battle);
    const pending = clone(next.pendingTrainerReaction);
    next.pendingTrainerReaction = null;
    if (this.actor(next) !== pending.attackerSide) throw new Error("Trainer reaction trigger is no longer current");
    next.log.push({
      type: "trainer_reaction_window_resolved",
      round: next.round,
      featureId: pending.featureId,
      trigger: pending.trigger,
      used: Boolean(useReaction)
    });
    return this.useMove(next, pending.attackerSide, pending.moveId, {
      useDefenderIntimidate: usePlayerIntimidate
    });
  }

  async advanceToPlayerOrEnd(battle, { usePlayerIntimidate = false } = {}) {
    let next = clone(battle);
    let intimidateRequested = usePlayerIntimidate;

    while (!next.outcome) {
      if (next.awaitingSwitch || next.pendingTrainerReaction) return next;

      next = await this.prepareCurrentTurn(next);
      if (next.outcome || next.awaitingSwitch || next.pendingTrainerReaction) break;

      if (this.actor(next) === "player") return next;

      const before = next.player.abilityState.intimidateAvailable;
      next = await this.useOpponentTurn(next, {
        usePlayerIntimidate: intimidateRequested
      });
      if (before && !next.player.abilityState.intimidateAvailable) {
        intimidateRequested = false;
      }
    }

    return next;
  }
}
