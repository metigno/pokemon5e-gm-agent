import { Poke5eDataRepository } from "./poke5e-data.mjs";
import { abilityModifier, resolveAttack, scaledHp } from "./poke5e-rules.mjs";

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

function advanceTurn(battle) {
  const next = clone(battle);
  if (next.outcome) return next;
  next.turnIndex += 1;
  if (next.turnIndex >= next.order.length) {
    next.turnIndex = 0;
    next.round += 1;
  }
  return next;
}

function applyAttack(battle, side, move, result) {
  const next = clone(battle);
  const targetKey = side === "player" ? "opponent" : "player";
  const target = next[targetKey];
  target.hp.current = Math.max(0, target.hp.current - result.damage);
  next[side].pp[move.id] -= 1;
  next.log.push({
    type: "attack",
    round: next.round,
    actor: side,
    target: targetKey,
    ...result,
    targetHpAfter: target.hp.current
  });

  if (target.hp.current <= 0) {
    next.outcome = side === "player" ? "win" : "lose";
    next.log.push({
      type: "combat_end",
      round: next.round,
      outcome: next.outcome,
      reason: "fainted"
    });
    return next;
  }

  return advanceTurn(next);
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
    const moves = await this.data.getSupportedMoves(species, level);
    if (moves.length === 0) throw new Error(`${species.name} has no supported attack moves in the local combat pack`);

    const maxHp = scaledHp(species, level);
    return {
      speciesId: species.id,
      name: species.name,
      level,
      types: species.type,
      ac: species.ac,
      hp: { current: maxHp, max: maxHp },
      attributes: species.attributes,
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
      schemaVersion: 1,
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

  async availablePlayerMoves(battle) {
    const result = [];
    for (const id of battle.player.moveIds) {
      if ((battle.player.pp[id] ?? 0) <= 0) continue;
      result.push(await this.data.getMove(id));
    }
    return result;
  }

  async usePlayerMove(battle, moveId) {
    if (battle.outcome) return clone(battle);
    if (this.actor(battle) !== "player") throw new Error("It is not the player's turn");
    if (!battle.player.moveIds.includes(moveId)) throw new Error(`Player does not know supported move ${moveId}`);
    if ((battle.player.pp[moveId] ?? 0) <= 0) throw new Error(`${moveId} has no PP remaining`);

    const move = await this.data.getMove(moveId);
    const result = resolveAttack({
      attacker: battle.player,
      defender: battle.opponent,
      move,
      dice: this.dice
    });
    return applyAttack(battle, "player", move, result);
  }

  async useOpponentTurn(battle) {
    if (battle.outcome) return clone(battle);
    if (this.actor(battle) !== "opponent") return clone(battle);

    const usable = battle.opponent.moveIds.filter((id) => (battle.opponent.pp[id] ?? 0) > 0);
    if (usable.length === 0) throw new Error("Opponent has no supported move with PP remaining");

    // Deterministic first supported move. Tactical AI comes later; legality and math are already authoritative here.
    const move = await this.data.getMove(usable[0]);
    const result = resolveAttack({
      attacker: battle.opponent,
      defender: battle.player,
      move,
      dice: this.dice
    });
    return applyAttack(battle, "opponent", move, result);
  }

  async advanceToPlayerOrEnd(battle) {
    let next = clone(battle);
    while (!next.outcome && this.actor(next) === "opponent") {
      next = await this.useOpponentTurn(next);
    }
    return next;
  }
}
