import { Poke5eDataRepository } from "./poke5e-data.mjs";
import {
  abilityModifier,
  proficiencyBonus,
  resolveAttack,
  resolveSaveMove,
  scaledHp
} from "./poke5e-rules.mjs";
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
  return Boolean(move.attack && move.dice?.type === "damage") || SAVE_EFFECT_MOVES.has(move.id);
}

function setOutcomeForDowned(battle, downedSide, reason) {
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
  }

  if (combatant.hp.current <= 0) {
    setOutcomeForDowned(next, side, "status_damage");
    return next;
  }

  combatant.turn.started = false;
  combatant.turn.actionAvailable = true;
  combatant.turn.bonusActionAvailable = true;
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

export class Pokemon5eCombatEngine {
  constructor({ data = new Poke5eDataRepository(), dice } = {}) {
    if (!dice) throw new Error("Pokemon5eCombatEngine requires a dice source");
    this.data = data;
    this.dice = dice;
  }

  async createCombatant(descriptor) {
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
    return {
      speciesId: species.id,
      name: species.name,
      level,
      types: species.type,
      ac: species.ac,
      hp: { current: maxHp, max: maxHp },
      attributes: species.attributes,
      savingThrows: species.savingThrows,
      abilityId,
      abilityState: {
        intimidateAvailable: abilityId === "intimidate",
        flashFireCharged: false
      },
      statuses: createStatusState(),
      effects: {
        attackModifierSources: [],
        incomingAttackBonusSources: []
      },
      turn: {
        started: false,
        actionAvailable: true,
        bonusActionAvailable: true
      },
      moveIds: moves.map((move) => move.id),
      pp: Object.fromEntries(moves.map((move) => [move.id, move.pp]))
    };
  }

  async createBattle(handoff) {
    const player = await this.createCombatant(handoff.playerPokemon);
    const opponent = await this.createCombatant(handoff.opponent);
    const playerInitiative = initiative(player, this.dice);
    const opponentInitiative = initiative(opponent, this.dice);
    const order = chooseOrder(player, opponent, playerInitiative, opponentInitiative);

    return {
      schemaVersion: 2,
      ruleset: "2024",
      encounterId: handoff.encounterId,
      round: 1,
      order,
      turnIndex: 0,
      initiative: {
        player: playerInitiative,
        opponent: opponentInitiative
      },
      player,
      opponent,
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
    return battle.outcome ? null : currentActor(battle);
  }

  canUseIntimidate(battle, side) {
    const combatant = battle[side];
    return (
      !battle.outcome &&
      combatant.abilityId === "intimidate" &&
      combatant.abilityState.intimidateAvailable
    );
  }

  async prepareCurrentTurn(battle) {
    if (battle.outcome) return clone(battle);

    const next = clone(battle);
    const side = currentActor(next);
    const combatant = next[side];

    if (combatant.turn.started) return next;

    combatant.turn.started = true;
    combatant.turn.actionAvailable = true;
    combatant.turn.bonusActionAvailable = true;
    next.log.push({ type: "turn_start", round: next.round, actor: side });

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
    const result = [];

    for (const id of combatant.moveIds) {
      if ((combatant.pp[id] ?? 0) <= 0) continue;
      const move = await this.data.getMove(id);
      const slot = moveSlot(move);
      if (!slot || !combatant.turn[slot]) continue;
      if (!isMoveResolvable(move)) continue;
      result.push(move);
    }

    return result;
  }

  async availablePlayerMoves(battle) {
    if (this.actor(battle) !== "player") return [];
    return this.legalMoves(battle, "player");
  }

  async useMove(battle, side, moveId, { useDefenderIntimidate = false } = {}) {
    if (battle.outcome) return clone(battle);
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

    attacker.pp[move.id] -= 1;
    attacker.turn[slot] = false;

    let intimidateUsed = false;
    if (
      move.attack &&
      useDefenderIntimidate &&
      defender.abilityId === "intimidate" &&
      defender.abilityState.intimidateAvailable
    ) {
      defender.abilityState.intimidateAvailable = false;
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
        forceDisadvantage: intimidateUsed
      });

      defender.hp.current = Math.max(0, defender.hp.current - result.damage);

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
        type: "attack",
        round: next.round,
        actor: side,
        target: targetSide,
        ...result,
        secondaryStatus: secondary,
        statusResult,
        targetHpAfter: defender.hp.current
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

    if (defender.hp.current <= 0) {
      setOutcomeForDowned(next, targetSide, "move_damage");
      return next;
    }

    const remaining = await this.legalMoves(next, side);
    if (remaining.length === 0) {
      return endTurnInternal(next, side, this.dice);
    }

    return next;
  }

  async usePlayerMove(battle, moveId, options = {}) {
    return this.useMove(battle, "player", moveId, options);
  }

  async endPlayerTurn(battle) {
    if (battle.outcome) return clone(battle);
    if (this.actor(battle) !== "player") throw new Error("It is not the player's turn");
    const prepared = await this.prepareCurrentTurn(battle);
    if (this.actor(prepared) !== "player") return prepared;
    return endTurnInternal(prepared, "player", this.dice);
  }

  async useOpponentTurn(battle, { usePlayerIntimidate = false } = {}) {
    if (battle.outcome) return clone(battle);
    if (this.actor(battle) !== "opponent") return clone(battle);

    let next = await this.prepareCurrentTurn(battle);
    if (this.actor(next) !== "opponent") return next;

    const usable = await this.legalMoves(next, "opponent");
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
      next = await this.prepareCurrentTurn(next);
      if (next.outcome) break;

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
