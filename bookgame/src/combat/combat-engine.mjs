import { attemptCapture } from "./capture.mjs";
import { Poke5eDataRepository } from "./poke5e-data.mjs";
import {
  abilityModifier,
  calculateMoveStats,
  proficiencyBonus,
  resolveAttack,
  resolveSaveMove,
  resolveSavingThrow,
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
import { typeMultiplier } from "./type-chart.mjs";
import {
  createCircleZone,
  expireZonesAtTurnStart,
  removeZone,
  zoneContains
} from "./zones.mjs";
import {
  applyStatus,
  createStatusState,
  endTurnStatus,
  startTurnStatus
} from "./status.mjs";

const SUPPORTED_ABILITIES = new Set([
  "intimidate",
  "flash-fire",
  "levitate",
  "torrent",
  "early-bird",
  "run-away",
  "rock-head"
]);

const SAVE_EFFECT_MOVES = new Set([
  "growl",
  "leer",
  "tail-whip",
  "sand-attack",
  "hypnosis"
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
    .filter((source) => source.expiresRound == null || round < source.expiresRound)
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

function moveSlot(move) {
  if (move.time?.unit === "action") return "actionAvailable";
  if (move.time?.unit === "bonus action") return "bonusActionAvailable";
  return null;
}

function isMoveResolvable(move) {
  return Boolean(move.attack && move.dice?.type === "damage")
    || SAVE_EFFECT_MOVES.has(move.id)
    || AREA_MOVES.has(move.id);
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
    incomingAttackBonusSources: []
  };
  combatant.concentration = null;
}

function healthyBenchIndices(battle) {
  return battle.playerBench
    .map((combatant, index) => ({ combatant, index }))
    .filter(({ combatant }) => combatant.hp.current > 0)
    .map(({ index }) => index);
}

function endConcentrationState(battle, side, reason) {
  const combatant = battle[side];
  const concentration = combatant?.concentration;
  if (!concentration) return false;

  battle.zones = removeZone(battle.zones, concentration.zoneId);
  combatant.concentration = null;
  battle.log.push({
    type: "concentration_end",
    round: battle.round,
    actor: side,
    reason,
    zoneId: concentration.zoneId,
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
    dice
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

  if (downedSide === "player" && healthyBenchIndices(battle).length > 0) {
    battle.awaitingSwitch = "player";
    battle.log.push({
      type: "switch_required",
      round: battle.round,
      actor: "player",
      reason: "active_fainted"
    });
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
  const events = endTurnStatus(combatant, dice, proficiencyBonus(combatant.level));

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

  combatant.turn.started = false;
  combatant.turn.actionAvailable = true;
  combatant.turn.bonusActionAvailable = true;
  combatant.turn.disengaged = false;
  combatant.turn.movementRemaining = movementSpeed(combatant).value;
  advanceTurnIndex(next);
  return next;
}

function secondaryStatusFor(moveId, natural) {
  if (moveId === "ember" && natural >= 19) return "Burned";
  if (moveId === "bite" && natural >= 19) return "Flinched";
  if (moveId === "lick" && natural >= 18) return "Paralysis";
  return null;
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

function zoneDamage(zone, target, dice, saveSucceeded = false) {
  const rolled = rollExpression(zone.damageDice, dice);
  const raw = Math.max(0, rolled.total + zone.damageModifier);
  const multiplier = typeMultiplier(zone.damageType, target.types);
  let damage = multiplier === 0.5 ? Math.floor(raw / 2) : raw * multiplier;
  if (saveSucceeded && zone.effect === "smog") damage = Math.floor(damage / 2);
  return { rolled, raw, multiplier, damage };
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
    const moves = (await this.data.getSupportedMoves(species, level)).filter(isMoveResolvable);
    if (moves.length === 0) {
      throw new Error(`${species.name} has no supported moves in the local combat pack`);
    }

    const normalAbilities = species.abilities.filter((ability) => !ability.hidden);
    const abilityId = descriptor.abilityId ?? normalAbilities[0]?.id ?? null;
    if (abilityId && !species.abilities.some((ability) => ability.id === abilityId)) {
      throw new Error(`${species.name} cannot use ability ${abilityId}`);
    }
    if (abilityId && !SUPPORTED_ABILITIES.has(abilityId)) {
      throw new Error(`Ability ${abilityId} is not implemented by the offline combat core yet`);
    }

    const maxHp = scaledHp(species, level);
    const combatant = {
      speciesId: species.id,
      name: species.name,
      level,
      sr: species.sr,
      size: species.size,
      types: species.type,
      speed: clone(species.speed ?? []),
      reach: reachForSize(species.size),
      position: defaultPosition(positionValue ?? descriptor.position, { x: 0, y: 0 }),
      ac: species.ac,
      hp: { current: maxHp, max: maxHp },
      attributes: species.attributes,
      savingThrows: species.savingThrows,
      abilityId,
      abilityState: {
        intimidateAvailable: abilityId === "intimidate",
        flashFireCharged: false
      },
      reactionAvailable: true,
      switchedInRound: null,
      concentration: null,
      statuses: createStatusState(),
      effects: {
        attackModifierSources: [],
        incomingAttackBonusSources: []
      },
      turn: {
        started: false,
        actionAvailable: true,
        bonusActionAvailable: true,
        disengaged: false,
        movementRemaining: 0
      },
      moveIds: moves.map((move) => move.id),
      pp: Object.fromEntries(moves.map((move) => [move.id, move.pp]))
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

    const playerInitiative = initiative(player, this.dice);
    const opponentInitiative = initiative(opponent, this.dice);
    const order = chooseOrder(player, opponent, playerInitiative, opponentInitiative);

    return {
      schemaVersion: 3,
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
      opponentRegistered: Boolean(handoff.opponentRegistered),
      awaitingSwitch: null,
      zones: [],
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

    combatant.turn.started = true;
    combatant.turn.actionAvailable = true;
    combatant.turn.bonusActionAvailable = true;
    combatant.turn.disengaged = false;
    combatant.turn.movementRemaining = movementSpeed(combatant).value;
    combatant.reactionAvailable = true;

    if (side === "player") {
      next.trainer.actionAvailable = true;
      next.trainer.bonusActionAvailable = true;
      next.trainer.reactionAvailable = true;
      next.trainer.movementRemaining = next.trainer.speed;
    }

    next.log.push({ type: "turn_start", round: next.round, actor: side });

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
        dice: this.dice
      });
      const damageInfo = zoneDamage(zone, combatant, this.dice, save.success);
      combatant.hp.current = Math.max(0, combatant.hp.current - damageInfo.damage);

      let statusResult = null;
      if (zone.effect === "poison-gas" && !save.success) {
        statusResult = applyStatus(combatant, "Poisoned");
      } else if (zone.effect === "smog" && !save.success && save.total <= zone.saveDc - 5) {
        statusResult = applyStatus(combatant, "Poisoned");
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
    if (status.rolls.length > 0) {
      next.log.push({
        type: "status_start_check",
        round: next.round,
        actor: side,
        status: combatant.statuses.nonVolatile,
        rolls: status.rolls,
        skipTurn: status.skipTurn
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
      if (!rangeCheckForMove(combatant, defender, move).legal) continue;
      result.push(move);
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

    const flashFireWasCharged =
      attacker.abilityId === "flash-fire" &&
      attacker.abilityState.flashFireCharged &&
      move.type === "fire";

    const result = resolveAttack({
      attacker,
      defender,
      move,
      dice: this.dice,
      extraAttackModifier: attackBonus,
      forceDisadvantage
    });

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
    const secondary = result.hit && result.typeMultiplier > 0
      ? secondaryStatusFor(move.id, result.natural)
      : null;
    if (secondary) statusResult = applyStatus(defender, secondary);

    next.log.push({
      type: reaction ? "opportunity_attack" : "attack",
      round: next.round,
      actor: side,
      target: targetSide,
      ...result,
      secondaryStatus: secondary,
      statusResult,
      targetHpAfter: defender.hp.current
    });

    if (defender.hp.current <= 0) {
      markDowned(next, targetSide, reaction ? "opportunity_attack" : "move_damage");
    }

    return next;
  }

  async useMove(battle, side, moveId, { useDefenderIntimidate = false } = {}) {
    if (battle.outcome) return clone(battle);
    if (battle.awaitingSwitch) throw new Error("A required switch must be resolved first");
    if (this.actor(battle) !== side) throw new Error(`It is not ${side}'s turn`);

    let next = await this.prepareCurrentTurn(battle);
    if (this.actor(next) !== side) return next;

    const attacker = next[side];
    const targetSide = otherSide(side);
    const defender = next[targetSide];

    if (!attacker.moveIds.includes(moveId)) throw new Error(`${attacker.name} does not know supported move ${moveId}`);
    if ((attacker.pp[moveId] ?? 0) <= 0) throw new Error(`${moveId} has no PP remaining`);

    const move = await this.data.getMove(moveId);
    const slot = moveSlot(move);
    if (!slot || !attacker.turn[slot]) throw new Error(`No ${move.time?.unit ?? "turn"} slot available for ${moveId}`);

    const areaTarget = AREA_MOVES.has(move.id) && arguments[3]?.targetPoint
      ? point(arguments[3].targetPoint.x, arguments[3].targetPoint.y)
      : null;
    const range = areaTarget
      ? {
          legal: distance(attacker.position, areaTarget) <= move.range.value + 1e-9,
          distance: distance(attacker.position, areaTarget),
          maxRange: move.range.value
        }
      : rangeCheckForMove(attacker, defender, move);
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

    attacker.pp[move.id] -= 1;
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

    if (move.attack && move.dice?.type === "damage") {
      next = await this.resolveAttackMove(next, side, move, {
        forceDisadvantage: intimidateUsed
      });
    } else if (AREA_MOVES.has(move.id)) {
      const stats = calculateMoveStats(attacker, move);
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
    } else if (SAVE_EFFECT_MOVES.has(move.id)) {
      if (defender.abilityId === "levitate" && move.type === "ground") {
        next.log.push({
          type: "save_move",
          round: next.round,
          actor: side,
          target: targetSide,
          moveId: move.id,
          moveName: move.name,
          immune: true,
          immunityAbility: "levitate"
        });
      } else {
        const result = resolveSaveMove({
          attacker,
          defender,
          move,
          dice: this.dice
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
    } else {
      throw new Error(`Move ${move.id} is in the pack but not implemented by the resolver`);
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
      context,
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
      const rank = (move) => move.time?.unit === "action" ? 0 : 1;
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
