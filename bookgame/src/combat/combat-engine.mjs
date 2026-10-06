import { attemptCapture } from "./capture.mjs";
import { applyItemToPokemon, findInventoryItemIndex } from "./item-rules.mjs";
import { Poke5eDataRepository } from "./poke5e-data.mjs";
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
  canTargetMove,
  distance,
  leavesReach,
  moveToward,
  movementSpeed,
  point,
  reachForSize,
  withinLineOfSightDistance
} from "./spatial.mjs";
import {
  createCircleZone,
  expireZonesAtTurnStart,
  removeZone,
  zoneContains
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
  "metal-sound",
  "screech",
  "tearful-look"
]);

const AREA_MOVES = new Set([
  "smog",
  "poison-gas"
]);

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

function effectiveAc(combatant, round) {
  return combatant.ac + activeModifier(combatant.effects?.acModifierSources ?? [], round);
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

function consumeAttackAdvantageUse(combatant, round) {
  for (const source of combatant.effects?.attackAdvantageSources ?? []) {
    if (source.usesRemaining == null || source.usesRemaining <= 0) continue;
    if (source.startsRound != null && round < source.startsRound) continue;
    if (source.expiresRound != null && round >= source.expiresRound) continue;
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
    "speedModifierSources",
    "saveModifierSources",
    "saveAdvantageSources",
    "attackAdvantageSources",
    "damageResistanceSources",
    "typeImmunitySources",
    "stabMultiplierSources",
    "criticalRangeBonusSources",
    "restrainedSources",
    "switchLockSources",
    "escapeLockSources",
    "movementLockSources",
    "ongoingEffects"
  ]) {
    if (!Array.isArray(combatant.effects?.[key])) continue;
    combatant.effects[key] = combatant.effects[key].filter((entry) => entry.source !== source);
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
    "hone-claws": { attack: 1, damage: 1, stackCap: 3 },
    "iron-defense": {
      ac: 6,
      resistance: { type: null, steps: 1 }
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
    /(?:on|upon) (?:a )?(?:failed save|failure)|must (?:make|succeed on).*\bor become|fail(?:s|ed)? .*become/i.test(text) ||
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
  "hone-claws",
  "iron-defense",
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
  "charge",
  "clangorous-soul",
  "fillet-away"
]);

function isSpecialSelfMove(move) {
  return SPECIAL_SELF_MOVES.has(move.id);
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
  if (isStockpileMove(move)) return true;
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
  return {
    name: trainer.name ?? "Trainer",
    level: trainer.level ?? trainer.trainerLevel ?? 1,
    abilities: clone(trainer.abilities ?? {
      STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10
    }),
    skills: clone(trainer.skills ?? []),
    inventory: clone(trainer.inventory ?? []),
    position: defaultPosition(positionValue ?? trainer.position, { x: 0, y: 0 }),
    speed: trainer.speed ?? 30,
    movementRemaining: trainer.speed ?? 30,
    actionAvailable: true,
    bonusActionAvailable: true,
    reactionAvailable: true
  };
}

function clearTransientEffects(combatant) {
  combatant.effects = {
    attackModifierSources: [],
    incomingAttackBonusSources: [],
    damageModifierSources: [],
    acModifierSources: [],
    speedModifierSources: [],
    saveModifierSources: [],
    saveAdvantageSources: [],
    attackAdvantageSources: [],
    damageResistanceSources: [],
    typeImmunitySources: [],
    stabMultiplierSources: [],
    criticalRangeBonusSources: [],
    restrainedSources: [],
    switchLockSources: [],
    escapeLockSources: [],
    movementLockSources: [],
    ongoingEffects: [],
    stockpileCount: 0
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

function forceOpponentReplacement(battle) {
  const benchIndex = healthyBenchIndices(battle, "opponent")[0];
  if (benchIndex === undefined) return false;

  const outgoing = battle.opponent;
  const incoming = battle.opponentBench[benchIndex];
  const releasePosition = clone(outgoing.position ?? { x: 5, y: 0 });

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

  battle.log.push({
    type: "switch",
    round: battle.round,
    actor: "opponent",
    forced: true,
    out: outgoing.speciesId,
    in: incoming.speciesId,
    releasePosition,
    provokesOpportunity: false
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
  for (const source of new Set(effectSources)) {
    removeEffectSource(combatant, source, battle.round);
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
  battle.log.push({
    type: "fainted",
    round: battle.round,
    actor: downedSide,
    reason
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
    next.log.push({ ...event, round: next.round, actor: side });
    if (event.type === "status_damage" && event.damage > 0) {
      checkConcentrationAfterDamage(next, side, event.damage, dice);
    }
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

  combatant.turn.started = false;
  combatant.turn.actionAvailable = true;
  combatant.turn.bonusActionAvailable = true;
  combatant.turn.disengaged = false;
  combatant.turn.movementRemaining = movementSpeed(combatant, next.round).value;
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

function applyMoveStatus(attacker, defender, status) {
  if (!status) return null;
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
    return { effect: "status", statusResult: applyStatus(target, "Asleep") };
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

function rangeCheckForMove(attacker, defender, move) {
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

  const result = canTargetMove(attacker, defender, move);
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
  const rolled = rollExpression(zone.damageDice, dice);
  const raw = Math.max(0, rolled.total + zone.damageModifier);
  const multiplier = damageProfile({ type: zone.damageType }, target, round).multiplier;
  let damage = multiplier === 0.5 ? Math.floor(raw / 2) : raw * multiplier;
  if (saveSucceeded && zone.effect === "smog") damage = Math.floor(damage / 2);
  return { rolled, raw, multiplier, damage };
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

    const maxHp = scaledHp(species, level);
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
      speciesId: species.id,
      name: species.name,
      level,
      rosterIndex: Number.isInteger(descriptor.rosterIndex) ? descriptor.rosterIndex : null,
      sr: species.sr,
      size: species.size,
      types: species.type,
      speed: clone(species.speed ?? []),
      reach: reachForSize(species.size),
      position: defaultPosition(positionValue ?? descriptor.position, { x: 0, y: 0 }),
      ac: species.ac,
      hp: { current: persistedHp, max: maxHp },
      attributes: species.attributes,
      savingThrows: species.savingThrows,
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
      effects: {
        attackModifierSources: [],
        incomingAttackBonusSources: [],
        damageModifierSources: [],
        acModifierSources: [],
        speedModifierSources: [],
        saveModifierSources: [],
        saveAdvantageSources: [],
        attackAdvantageSources: [],
        damageResistanceSources: [],
        typeImmunitySources: [],
        stabMultiplierSources: [],
        criticalRangeBonusSources: [],
        restrainedSources: [],
        switchLockSources: [],
        escapeLockSources: [],
        movementLockSources: [],
        ongoingEffects: [],
        stockpileCount: 0
      },
      turn: {
        started: false,
        actionAvailable: true,
        bonusActionAvailable: true,
        disengaged: false,
        movementRemaining: 0
      },
      moveIds,
      maxPp,
      pp
    };

    combatant.turn.movementRemaining = movementSpeed(combatant).value;
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
    const playerBench = [];
    for (const descriptor of handoff.playerBench ?? []) {
      const reserve = await this.createCombatant(descriptor, { x: 0, y: 0 });
      reserve.position = null;
      reserve.turn.movementRemaining = 0;
      playerBench.push(reserve);
    }

    const opponentBench = [];
    for (const descriptor of handoff.opponentBench ?? []) {
      const reserve = await this.createCombatant(descriptor, { x: 5, y: 0 });
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
      player,
      playerBench,
      opponent,
      opponentBench,
      opponentRegistered: Boolean(handoff.opponentRegistered),
      awaitingSwitch: null,
      zones: [],
      pendingEffects: [],
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

    combatant.turn.started = true;
    combatant.turn.actionAvailable = true;
    combatant.turn.bonusActionAvailable = true;
    combatant.turn.disengaged = false;
    combatant.turn.movementRemaining = movementSpeed(combatant, next.round).value;
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

      const save = resolveSavingThrow({
        defender: combatant,
        attribute: zone.saveAttribute,
        dc: zone.saveDc,
        dice: this.dice,
        round: next.round
      });
      const damageInfo = zoneDamage(
        zone,
        combatant,
        this.dice,
        save.success,
        next.round
      );
      combatant.hp.current = Math.max(0, combatant.hp.current - damageInfo.damage);

      let statusResult = null;
      if (zone.effect === "poison-gas" && !save.success) {
        statusResult = applyMoveStatus(next[zone.sourceSide], combatant, "Poisoned");
      } else if (zone.effect === "smog" && !save.success && save.total <= zone.saveDc - 5) {
        statusResult = applyMoveStatus(next[zone.sourceSide], combatant, "Poisoned");
      }

      next.log.push({
        type: "zone_tick",
        round: next.round,
        actor: side,
        zoneId: zone.id,
        moveId: zone.moveId,
        save,
        damageRoll: damageInfo.rolled,
        rawDamage: damageInfo.raw,
        typeMultiplier: damageInfo.multiplier,
        damage: damageInfo.damage,
        hpAfter: combatant.hp.current,
        statusResult
      });

      checkConcentrationAfterDamage(next, side, damageInfo.damage, this.dice);

      if (combatant.hp.current <= 0) {
        markDowned(next, side, "zone_damage");
        return next;
      }
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
      const specialSelfTargetSide = isSpecialSelfMove(move) ? side : null;
      const rangeTarget = healTargetSide
        ? battle[healTargetSide]
        : delayedHealTargetSide
          ? battle[delayedHealTargetSide]
          : ongoingHealTargetSide
            ? battle[ongoingHealTargetSide]
            : modifierTargetSide
              ? battle[modifierTargetSide]
              : specialSelfTargetSide
                ? battle[specialSelfTargetSide]
                : defender;
      if (!rangeCheckForMove(combatant, rangeTarget, move).legal) continue;
      result.push(move);
    }

    if (combatant.turn.actionAvailable) {
      const struggle = await this.data.getMove("struggle");
      if (rangeCheckForMove(combatant, defender, struggle).legal) result.push(struggle);
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

    const attackBonus =
      activeModifier(attacker.effects.attackModifierSources, next.round) +
      activeModifier(defender.effects.incomingAttackBonusSources, next.round);
    const damageBonus = activeModifier(attacker.effects.damageModifierSources, next.round);
    const defenderForResolution = {
      ...defender,
      ac: effectiveAc(defender, next.round)
    };

    const flashFireWasCharged =
      attacker.abilityId === "flash-fire" &&
      attacker.abilityState.flashFireCharged &&
      move.type === "fire";

    const stockpileMultiplier =
      move.id === "spit-up"
        ? Math.max(1, attacker.effects?.stockpileCount ?? 0)
        : 1;
    const result = resolveAttack({
      attacker,
      defender: defenderForResolution,
      move,
      dice: this.dice,
      extraAttackModifier: attackBonus,
      extraDamageModifier: damageBonus,
      damageDiceMultiplier: stockpileMultiplier,
      forceDisadvantage,
      round: next.round
    });
    const attackAdvantageConsumed = consumeAttackAdvantageUse(attacker, next.round);

    defender.hp.current = Math.max(0, defender.hp.current - result.damage);
    checkConcentrationAfterDamage(next, targetSide, result.damage, this.dice);

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
    const thawed = result.hit ? endFrozenOnFireDamage(defender, move, result.damage) : false;
    const secondary = result.hit && result.typeMultiplier > 0
      ? secondaryStatusFor(move, result.natural)
      : null;
    if (secondary) statusResult = applyMoveStatus(attacker, defender, secondary);

    next.log.push({
      type: reaction ? "opportunity_attack" : "attack",
      round: next.round,
      actor: side,
      target: targetSide,
      ...result,
      attackAdvantageConsumed,
      secondaryStatus: secondary,
      statusResult,
      thawed,
      targetHpAfter: defender.hp.current
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
            hasActiveSource(attacker.effects?.attackAdvantageSources ?? [], next.round) ||
            hasActiveSource(defender.effects?.restrainedSources ?? [], next.round),
          disadvantage:
            attackHasDisadvantage(attacker) ||
            hasActiveSource(attacker.effects?.restrainedSources ?? [], next.round)
        });
    const attackTotal = automaticHit ? null : roll.natural + pb + moveModifier;
    const attackAdvantageConsumed = automaticHit
      ? null
      : consumeAttackAdvantageUse(attacker, next.round);
    const defenderAc = effectiveAc(defender, next.round);
    const hit = automaticHit || roll.natural === 20 ||
      (roll.natural !== 1 && attackTotal >= defenderAc);
    const damage = hit ? Math.max(0, 2 + moveModifier) : 0;

    defender.hp.current = Math.max(0, defender.hp.current - damage);
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
    const roll = rollD20(this.dice, {
      advantage:
        hasActiveSource(attacker.effects?.attackAdvantageSources ?? [], next.round) ||
        hasActiveSource(defender.effects?.restrainedSources ?? [], next.round),
      disadvantage:
        forceDisadvantage ||
        attackHasDisadvantage(attacker) ||
        hasActiveSource(attacker.effects?.restrainedSources ?? [], next.round)
    });
    const attackModifier = stats.toHit + attackBonus;
    const attackTotal = roll.natural + attackModifier;
    const attackAdvantageConsumed = consumeAttackAdvantageUse(attacker, next.round);
    const defenderAc = effectiveAc(defender, next.round);
    const hit = roll.natural === 20 ||
      (roll.natural !== 1 && attackTotal >= defenderAc);
    const status = hit ? attackHitStatus(move, roll.natural) : null;
    const statusResult = applyMoveStatus(attacker, defender, status);

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
        defender.hp.current = Math.max(0, defender.hp.current - hpLoss);
      } else if (move.id === "natures-madness") {
        hpLoss = Math.max(1, Math.floor(defender.hp.current / 2));
        defender.hp.current = Math.max(0, defender.hp.current - hpLoss);
      } else if (move.id === "pain-split") {
        const sharedHp = Math.floor((attacker.hp.current + defender.hp.current) / 2);
        attacker.hp.current = Math.min(attacker.hp.max, sharedHp);
        defender.hp.current = Math.min(defender.hp.max, sharedHp);
      } else if (move.id === "ruination") {
        hpLoss = Math.max(1, Math.floor(defender.hp.current / 2));
        defender.hp.current = Math.max(0, defender.hp.current - hpLoss);
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

    if (move.id === "fillet-away") {
      const selfDamage = 10;
      combatant.hp.current = Math.max(0, combatant.hp.current - selfDamage);
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
      const damage = damageRoll.total;
      combatant.hp.current = Math.max(0, combatant.hp.current - damage);
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
        combatant.effects[key].push({ source: move.id, value, expiresRound });
        applied[name] = value;
      }
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
      const damage = multiplier === 0.5 ? Math.floor(rawDamage / 2) : rawDamage * multiplier;
      totalDamage += damage;
      hits.push({ index: index + 1, damageRoll, rawDamage, damage });
    }

    defender.hp.current = Math.max(0, defender.hp.current - totalDamage);
    checkConcentrationAfterDamage(next, targetSide, totalDamage, this.dice);
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

    defender.hp.current = Math.max(0, defender.hp.current - damage);
    checkConcentrationAfterDamage(next, targetSide, damage, this.dice);

    const thawed = endFrozenOnFireDamage(defender, move, damage);
    const status = failedSaveStatus(move, save);
    const statusResult = status && multiplier > 0
      ? applyMoveStatus(attacker, defender, status)
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
      damage,
      status,
      statusResult,
      thawed,
      targetHpAfter: defender.hp.current
    });

    if (defender.hp.current <= 0) markDowned(next, targetSide, "move_damage");
    return next;
  }

  async useMove(
    battle,
    side,
    moveId,
    {
      useDefenderIntimidate = false,
      targetPoint = null,
      targetSide: requestedTargetSide = null
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

    const areaTarget = AREA_MOVES.has(move.id) && targetPoint
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
            : specialSelfTargetSide
              ? next[specialSelfTargetSide]
              : cureTargetSide
        ? next[cureTargetSide]
        : defender;
    const range = areaTarget
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
      const pressureApplies =
        defender.abilityId === "pressure" &&
        !AREA_MOVES.has(move.id) &&
        move.range?.type !== "self" &&
        rangeTarget === defender;
      const ppCost = pressureApplies ? 2 : 1;
      attacker.pp[move.id] = Math.max(0, attacker.pp[move.id] - ppCost);
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
    } else if (isStockpileMove(move)) {
      next = await this.resolveStockpileMove(next, side, move);
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
        const statusResult = applyMoveStatus(attacker, defender, status);
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
    } else {
      throw new Error(`Move ${move.id} is known but its special rules are not executable by the combat resolver`);
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

  async moveCombatant(battle, side, destination, { opportunityMoveId = null } = {}) {
    if (battle.outcome || battle.awaitingSwitch) return clone(battle);
    if (this.actor(battle) !== side) throw new Error(`It is not ${side}'s turn`);

    let next = await this.prepareCurrentTurn(battle);
    if (this.actor(next) !== side) return next;

    const mover = next[side];
    const reactorSide = otherSide(side);
    const reactor = next[reactorSide];
    const target = point(destination.x, destination.y);
    const travel = distance(mover.position, target);

    if (travel > mover.turn.movementRemaining + 1e-9) {
      throw new Error(`Movement exceeds remaining speed: ${travel.toFixed(1)}ft > ${mover.turn.movementRemaining}ft`);
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
    next[side].turn.movementRemaining -= travel;
    next.log.push({
      type: "movement",
      round: next.round,
      actor: side,
      from,
      to: clone(target),
      feet: travel,
      provokedOpportunity: provokes,
      opportunityTaken: Boolean(provokes && opportunityMoveId)
    });
    return next;
  }

  async moveTrainer(battle, destination) {
    if (battle.outcome || battle.awaitingSwitch) return clone(battle);
    if (this.actor(battle) !== "player") throw new Error("Trainer movement is available on the player's turn");

    const next = await this.prepareCurrentTurn(battle);
    if (this.actor(next) !== "player") return next;

    const target = point(destination.x, destination.y);
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
    clearTransientEffects(outgoing);
    outgoing.position = null;
    outgoing.turn.started = false;
    outgoing.turn.movementRemaining = 0;

    next.playerBench[benchIndex] = outgoing;
    incoming.position = release;
    incoming.switchedInRound = next.round;
    incoming.reactionAvailable = false;
    incoming.turn.started = true;
    incoming.turn.actionAvailable = false;
    incoming.turn.bonusActionAvailable = false;
    incoming.turn.disengaged = false;
    incoming.turn.movementRemaining = 0;
    next.player = incoming;
    next.awaitingSwitch = null;

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
          hasActiveSource(next.opponent.effects?.restrainedSources ?? [], next.round)
      },
      dice: this.dice
    });

    if (!result.legal) return { battle: next, result };

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

    return this.useMove(next, "opponent", usable[0].id, {
      useDefenderIntimidate: usePlayerIntimidate
    });
  }

  async advanceToPlayerOrEnd(battle, { usePlayerIntimidate = false } = {}) {
    let next = clone(battle);
    let intimidateRequested = usePlayerIntimidate;

    while (!next.outcome) {
      if (next.awaitingSwitch) return next;

      next = await this.prepareCurrentTurn(next);
      if (next.outcome || next.awaitingSwitch) break;

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
