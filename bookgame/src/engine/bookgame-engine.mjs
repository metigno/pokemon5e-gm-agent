import { abilityModifier } from "../../../src/bridge/motor-to-poke5e.mjs";
import { CryptoDice, rollD20 } from "./dice.mjs";
import { evaluateCondition } from "./conditions.mjs";
import { SceneRepository } from "./scene-repository.mjs";
import { proficiencyBonus, touchState } from "./state.mjs";
import { advanceWorldTime, getWorldTimeView } from "./time.mjs";
import { applyQuestEffect, getQuestJournal, processQuestDeadlines } from "./quest-state.mjs";
import { applyNpcEffect, refreshNpcSchedules } from "./npc-state.mjs";
import { processWorldEvents } from "./world-events.mjs";
import { applyCompetitionEffect, beginCompetitionMatch, resolveCompetitionMatch } from "./competition-state.mjs";
import { recordWildEncounter, selectOrdinaryEncounter } from "./ecology.mjs";
import { applyPurchaseItem, ensureSceneShops } from "./shop-state.mjs";

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
    if (effect.type === "purchase_item") {
      applyPurchaseItem(state, effect);
      continue;
    }
    if (["quest_offer", "quest_start", "quest_complete", "quest_fail"].includes(effect.type)) {
      applyQuestEffect(state, effect);
      continue;
    }
    if (["npc_register", "npc_relationship_adjust", "npc_state_set", "npc_schedule_set", "friend_beat_select"].includes(effect.type)) {
      applyNpcEffect(state, effect);
      continue;
    }
    if (["competition_trial_available", "competition_trial_register"].includes(effect.type)) {
      applyCompetitionEffect(state, effect);
      continue;
    }
    throw new Error(`Unsupported effect type: ${effect.type}`);
  }
}

function parseTarget(target, currentSceneId) {
  if (typeof target !== "string" || target.length === 0) {
    throw new Error("Invalid story target");
  }

  if (!target.includes("#")) {
    return { sceneId: currentSceneId, nodeId: target };
  }

  const parts = target.split("#");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid cross-scene target: ${target}`);
  }

  return { sceneId: parts[0], nodeId: parts[1] };
}

function applyTarget(state, target, currentSceneId) {
  const parsed = parseTarget(target, currentSceneId);
  state.story.sceneId = parsed.sceneId;
  state.story.nodeId = parsed.nodeId;
  return parsed;
}

function nodeText(node) {
  if (Array.isArray(node.stitches)) {
    return node.stitches.map((stitch) => stitch.text).join("\n\n");
  }
  return node.text;
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
    now = () => new Date().toISOString(),
    worldEvents = null,
    ecology = null
  } = {}) {
    this.scenes = scenes;
    this.dice = dice;
    this.now = now;
    this.worldEvents = worldEvents;
    this.ecology = ecology;
  }

  async loadWorldEvents() {
    if (Array.isArray(this.worldEvents)) return this.worldEvents;
    if (typeof this.scenes.loadWorldEvents === "function") {
      return this.scenes.loadWorldEvents();
    }
    return [];
  }

  async loadEcology() {
    if (this.ecology) return this.ecology;
    if (typeof this.scenes.loadEcology === "function") {
      return this.scenes.loadEcology();
    }
    return null;
  }

  async present(state) {
    refreshNpcSchedules(state);
    const scene = await this.scenes.load(state.story.sceneId);
    ensureSceneShops(state, scene.shops);
    const node = scene.nodes[state.story.nodeId];
    if (!node) throw new Error(`Unknown node ${state.story.nodeId} in scene ${scene.id}`);
    if (!evaluateCondition(state, scene.conditions)) {
      throw new Error(`Scene conditions are not satisfied: ${scene.id}`);
    }

    const visibleChoices = (node.choices ?? []).filter((choice) => evaluateCondition(state, choice.conditions));

    return {
      sceneId: scene.id,
      sceneTitle: scene.title,
      moduleId: scene.moduleId ?? null,
      nodeId: state.story.nodeId,
      text: nodeText(node),
      stitches: clone(node.stitches ?? null),
      choices: clone(visibleChoices),
      worldTime: getWorldTimeView(state.world),
      questJournal: getQuestJournal(state),
      pending: clone(state.pending),
      lastRoll: clone(state.lastRoll)
    };
  }

  async choose(state, choiceId) {
    if (state.pending) throw new Error("Cannot choose while a subsystem handoff is pending");

    const next = clone(state);
    refreshNpcSchedules(next);
    const scene = await this.scenes.load(next.story.sceneId);
    ensureSceneShops(next, scene.shops);
    const node = scene.nodes[next.story.nodeId];
    if (!node) throw new Error(`Unknown node: ${next.story.nodeId}`);

    if (!evaluateCondition(next, scene.conditions)) {
      throw new Error(`Scene conditions are not satisfied: ${scene.id}`);
    }

    const choice = (node.choices ?? []).find((entry) => entry.id === choiceId);
    if (!choice) throw new Error(`Unknown choice ${choiceId} at node ${next.story.nodeId}`);
    if (!evaluateCondition(next, choice.conditions)) {
      throw new Error(`Choice is not currently available: ${choiceId}`);
    }

    const historyEntry = {
      sceneId: scene.id,
      nodeId: next.story.nodeId,
      choiceId
    };

    if (choice.timeCostMinutes !== undefined) {
      const fromTime = getWorldTimeView(next.world);
      advanceWorldTime(next.world, choice.timeCostMinutes);
      const questDeadlineEvents = processQuestDeadlines(next);
      refreshNpcSchedules(next);
      const toTime = getWorldTimeView(next.world);
      historyEntry.time = {
        minutes: choice.timeCostMinutes,
        from: fromTime,
        to: toTime
      };
      if (questDeadlineEvents.length > 0) {
        historyEntry.questDeadlineEvents = clone(questDeadlineEvents);
      }
    }

    if (choice.ecology) {
      const catalog = await this.loadEcology();
      if (!catalog) throw new Error("Ecology catalog is not available");
      applyEffects(next, choice.effects);
      const encounter = selectOrdinaryEncounter(next, catalog, choice.ecology, this.dice);
      const targetRef = encounter
        ? choice.ecology.returnNodes[encounter.speciesId]
        : choice.ecology.returnNodes.noEncounter;
      if (!targetRef) throw new Error("Ecology request has no authored return target");
      if (encounter) {
        recordWildEncounter(next, encounter);
        historyEntry.ecology = clone(encounter);
      } else {
        historyEntry.ecology = { requestId: choice.ecology.requestId, result: "no_encounter" };
      }
      const target = applyTarget(next, targetRef, scene.id);
      historyEntry.toSceneId = target.sceneId;
      historyEntry.toNodeId = target.nodeId;
    } else if (choice.check) {
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
      const target = applyTarget(next, outcome.goto, scene.id);
      historyEntry.toSceneId = target.sceneId;
      historyEntry.toNodeId = target.nodeId;
    } else if (choice.combat) {
      if (choice.combat.competition) {
        beginCompetitionMatch(next, choice.combat.competition);
      }

      const officialRosterSize = choice.combat.competition?.officialRosterSize ?? null;
      const stateRoster = (next.player.roster ?? [next.player.starter]).map((pokemon, rosterIndex) => ({
        ...clone(pokemon),
        rosterIndex
      }));
      const playerRoster = officialRosterSize
        ? stateRoster.slice(0, officialRosterSize)
        : null;

      next.pending = {
        type: "pokemon5e_combat",
        authority: "pokemon5e_rules",
        status: "awaiting_resolution",
        encounterId: choice.combat.encounterId,
        sceneId: scene.id,
        sourceNodeId: next.story.nodeId,
        opponent: clone(choice.combat.opponent),
        opponentBench: clone(choice.combat.opponentBench ?? []),
        playerPokemon: clone(playerRoster?.[0] ?? stateRoster[0] ?? next.player.starter),
        playerBench: clone(playerRoster ? playerRoster.slice(1) : (choice.combat.playerBench ?? [])),
        trainer: {
          name: next.player.name,
          level: next.player.trainerLevel,
          abilities: clone(next.player.abilities),
          skills: clone(next.player.skills),
          inventory: clone(next.player.inventory)
        },
        trainerPosition: clone(choice.combat.trainerPosition ?? { x: 0, y: 0 }),
        playerPosition: clone(choice.combat.playerPosition ?? { x: 0, y: 0 }),
        opponentPosition: clone(choice.combat.opponentPosition ?? { x: 5, y: 0 }),
        opponentRegistered: Boolean(choice.combat.opponentRegistered || choice.combat.competition),
        returnNodes: clone(choice.combat.returnNodes),
        competition: clone(choice.combat.competition ?? null),
        battle: null
      };
      const target = applyTarget(next, choice.combat.goto, scene.id);
      historyEntry.toSceneId = target.sceneId;
      historyEntry.toNodeId = target.nodeId;
      historyEntry.handoff = "pokemon5e_combat";
    } else {
      applyEffects(next, choice.effects);
      const target = applyTarget(next, choice.goto, scene.id);
      historyEntry.toSceneId = target.sceneId;
      historyEntry.toNodeId = target.nodeId;
    }

    const worldEvents = await this.loadWorldEvents();
    const firedWorldEvents = processWorldEvents(next, worldEvents, (eventState, effects) => {
      applyEffects(eventState, effects);
    });
    if (firedWorldEvents.length > 0) {
      historyEntry.worldEvents = clone(firedWorldEvents);
    }

    next.story.history.push(historyEntry);
    touchState(next, this.now);
    return next;
  }

  setCombatState(state, battle) {
    if (!state.pending || state.pending.type !== "pokemon5e_combat") {
      throw new Error("No Pokémon 5e combat handoff is pending");
    }
    if (battle.encounterId !== state.pending.encounterId) {
      throw new Error("Combat state belongs to a different encounter");
    }

    const next = clone(state);
    next.pending.battle = clone(battle);
    next.pending.status = battle.outcome ? "resolved" : "in_progress";
    touchState(next, this.now);
    return next;
  }

  resolveCombatHandoff(state, outcome) {
    if (!state.pending || state.pending.type !== "pokemon5e_combat") {
      throw new Error("No Pokémon 5e combat handoff is pending");
    }

    if (state.pending.battle?.outcome && state.pending.battle.outcome !== outcome) {
      throw new Error(`Combat outcome mismatch: battle=${state.pending.battle.outcome}, requested=${outcome}`);
    }

    const targetRef = state.pending.returnNodes[outcome];
    if (!targetRef) throw new Error(`Unsupported combat outcome: ${outcome}`);

    const next = clone(state);
    const encounterId = next.pending.encounterId;
    const resolvedBattle = next.pending.battle;
    const sourceSceneId = next.pending.sceneId;
    const competitionMeta = clone(next.pending.competition);

    if (outcome === "captured") {
      if (next.pending.opponentRegistered) {
        throw new Error("Registered Trainer Pokémon cannot be captured");
      }
      if (!resolvedBattle?.opponent) {
        throw new Error("Captured outcome requires resolved Pokémon 5e opponent state");
      }
    }

    if (resolvedBattle?.trainer?.inventory) {
      next.player.inventory = clone(resolvedBattle.trainer.inventory);
    }

    if (resolvedBattle?.player) {
      const combatants = [resolvedBattle.player, ...(resolvedBattle.playerBench ?? [])];
      next.player.roster ??= [clone(next.player.starter)];

      for (const combatant of combatants) {
        if (!Number.isInteger(combatant.rosterIndex)) continue;
        const existing = next.player.roster[combatant.rosterIndex];
        if (!existing) continue;

        const persisted = {
          ...existing,
          speciesId: combatant.speciesId,
          name: combatant.name,
          level: combatant.level,
          hp: clone(combatant.hp),
          statuses: clone(combatant.statuses),
          abilityId: combatant.abilityId,
          moveIds: clone(combatant.moveIds),
          pp: clone(combatant.pp)
        };
        next.player.roster[combatant.rosterIndex] = persisted;

        if (combatant.rosterIndex === 0) {
          next.player.starter = {
            ...next.player.starter,
            ...clone(persisted)
          };
        }
      }
    }

    if (outcome === "captured" && resolvedBattle?.opponent) {
      next.player.roster ??= [clone(next.player.starter)];
      const rosterSizeBeforeCapture = next.player.roster.length;
      const capturedPokemon = {
        speciesId: resolvedBattle.opponent.speciesId,
        name: resolvedBattle.opponent.name,
        level: resolvedBattle.opponent.level,
        hp: clone(resolvedBattle.opponent.hp),
        statuses: clone(resolvedBattle.opponent.statuses),
        abilityId: resolvedBattle.opponent.abilityId,
        moveIds: clone(resolvedBattle.opponent.moveIds),
        pp: clone(resolvedBattle.opponent.pp),
        capturedAt: {
          day: next.world.day,
          locationId: next.world.locationId,
          encounterId
        }
      };
      next.player.roster.push(capturedPokemon);

      if (rosterSizeBeforeCapture === 1 && !next.player.secondPokemonAcquisition) {
        next.player.secondPokemonAcquisition = {
          speciesId: capturedPokemon.speciesId,
          name: capturedPokemon.name,
          level: capturedPokemon.level,
          day: next.world.day,
          locationId: next.world.locationId,
          encounterId
        };
      }
    }

    if (competitionMeta) {
      resolveCompetitionMatch(next, competitionMeta, outcome);
    }

    next.pending = null;
    const target = applyTarget(next, targetRef, sourceSceneId);
    next.story.history.push({
      sceneId: sourceSceneId,
      subsystem: "pokemon5e_combat",
      encounterId,
      outcome,
      competition: competitionMeta,
      toSceneId: target.sceneId,
      toNodeId: target.nodeId
    });
    touchState(next, this.now);
    return next;
  }
}
