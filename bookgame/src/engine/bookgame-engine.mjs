import { abilityModifier } from "../../../src/bridge/motor-to-poke5e.mjs";
import { CryptoDice, rollD20 } from "./dice.mjs";
import { SceneRepository } from "./scene-repository.mjs";
import { proficiencyBonus, touchState } from "./state.mjs";

function clone(value) {
  return structuredClone(value);
}

function applyEffects(state, effects = []) {
  for (const effect of effects) {
    if (effect.type === "set_flag") {
      state.world.flags[effect.key] = effect.value;
      continue;
    }
    if (effect.type === "set_location") {
      state.world.locationId = effect.locationId;
      continue;
    }
    throw new Error(`Unsupported effect type: ${effect.type}`);
  }
}

function getCheckModifier(state, check) {
  const score = state.player.abilities[check.ability];
  if (!Number.isInteger(score)) throw new Error(`Unknown ability: ${check.ability}`);
  let modifier = abilityModifier(score);

  if (check.skill && state.player.skills.includes(check.skill)) {
    modifier += proficiencyBonus(state.player.trainerLevel);
  }

  return modifier;
}

export class BookgameEngine {
  constructor({
    scenes = new SceneRepository(),
    dice = new CryptoDice(),
    now = () => new Date().toISOString()
  } = {}) {
    this.scenes = scenes;
    this.dice = dice;
    this.now = now;
  }

  async present(state) {
    const scene = await this.scenes.load(state.story.sceneId);
    const node = scene.nodes[state.story.nodeId];
    if (!node) throw new Error(`Unknown node ${state.story.nodeId} in scene ${scene.id}`);

    return {
      sceneId: scene.id,
      sceneTitle: scene.title,
      nodeId: state.story.nodeId,
      text: node.text,
      choices: clone(node.choices ?? []),
      pending: clone(state.pending),
      lastRoll: clone(state.lastRoll)
    };
  }

  async choose(state, choiceId) {
    if (state.pending) throw new Error("Cannot choose while a subsystem handoff is pending");

    const next = clone(state);
    const scene = await this.scenes.load(next.story.sceneId);
    const node = scene.nodes[next.story.nodeId];
    if (!node) throw new Error(`Unknown node: ${next.story.nodeId}`);

    const choice = (node.choices ?? []).find((entry) => entry.id === choiceId);
    if (!choice) throw new Error(`Unknown choice ${choiceId} at node ${next.story.nodeId}`);

    const historyEntry = {
      sceneId: scene.id,
      nodeId: next.story.nodeId,
      choiceId
    };

    if (choice.check) {
      const modifier = getCheckModifier(next, choice.check);
      const roll = rollD20(this.dice, modifier);
      const passed = roll.total >= choice.check.dc;
      const outcomeKey = passed ? "success" : "failure";
      const outcome = choice.outcomes?.[outcomeKey];
      if (!outcome) throw new Error(`Choice ${choiceId} has no ${outcomeKey} outcome`);

      next.lastRoll = {
        ...roll,
        ability: choice.check.ability,
        skill: choice.check.skill ?? null,
        dc: choice.check.dc,
        passed
      };
      historyEntry.roll = clone(next.lastRoll);
      applyEffects(next, outcome.effects);
      next.story.nodeId = outcome.goto;
      historyEntry.toNodeId = outcome.goto;
    } else if (choice.combat) {
      next.pending = {
        type: "pokemon5e_combat",
        authority: "pokemon5e_rules",
        status: "awaiting_resolution",
        encounterId: choice.combat.encounterId,
        sceneId: scene.id,
        sourceNodeId: next.story.nodeId,
        opponent: clone(choice.combat.opponent),
        playerPokemon: clone(next.player.starter),
        returnNodes: clone(choice.combat.returnNodes)
      };
      next.story.nodeId = choice.combat.goto;
      historyEntry.toNodeId = choice.combat.goto;
      historyEntry.handoff = "pokemon5e_combat";
    } else {
      applyEffects(next, choice.effects);
      next.story.nodeId = choice.goto;
      historyEntry.toNodeId = choice.goto;
    }

    next.story.history.push(historyEntry);
    touchState(next, this.now);
    return next;
  }

  resolveCombatHandoff(state, outcome) {
    if (!state.pending || state.pending.type !== "pokemon5e_combat") {
      throw new Error("No Pokémon 5e combat handoff is pending");
    }

    const target = state.pending.returnNodes[outcome];
    if (!target) throw new Error(`Unsupported combat outcome: ${outcome}`);

    const next = clone(state);
    const encounterId = next.pending.encounterId;
    next.pending = null;
    next.story.nodeId = target;
    next.story.history.push({
      sceneId: next.story.sceneId,
      subsystem: "pokemon5e_combat",
      encounterId,
      outcome,
      toNodeId: target
    });
    touchState(next, this.now);
    return next;
  }
}
