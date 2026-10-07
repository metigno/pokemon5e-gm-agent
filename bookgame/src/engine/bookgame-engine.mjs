import { abilityModifier } from "../../../src/bridge/motor-to-poke5e.mjs";
import { CryptoDice, rollD20 } from "./dice.mjs";
import { evaluateCondition } from "./conditions.mjs";
import { SceneRepository } from "./scene-repository.mjs";
import { proficiencyBonus, touchState } from "./state.mjs";
import {
  applyTrainerProgressionEffect,
  getTrainerProgressionView,
  hasPendingTrainerProgression,
  resolveTrainerProgressionChoice,
  syncCampaignTrainerProgression
} from "./trainer-progression.mjs";
import { advanceWorldTime, getWorldTimeView } from "./time.mjs";
import { applyQuestEffect, getQuestJournal, processQuestDeadlines } from "./quest-state.mjs";
import { applyNpcEffect, refreshNpcSchedules } from "./npc-state.mjs";
import { processWorldEvents } from "./world-events.mjs";
import { applyCompetitionEffect, beginCompetitionMatch, prepareWorldGroupMatch, prepareWorldKnockoutMatch, resolveCompetitionMatch } from "./competition-state.mjs";
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
    if (effect.type === "trainer_milestone_level") {
      applyTrainerProgressionEffect(state, effect);
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
    if (["npc_register", "npc_relationship_adjust", "npc_state_set", "npc_schedule_set", "friend_beat_select", "friend_beat_world_select"].includes(effect.type)) {
      applyNpcEffect(state, effect);
      continue;
    }
    if (["competition_trial_available", "competition_trial_register", "competition_world_draw", "competition_world_groups_open", "competition_world_groups_resolve", "competition_world_r16_open", "competition_world_r16_resolve", "competition_world_qf_resolve", "competition_world_sf_open", "competition_world_sf_resolve", "competition_world_final_resolve"].includes(effect.type)) {
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

function readStoryTemplatePath(state, path) {
  const segments = path.split(".");
  if (segments.some((segment) => ["__proto__", "prototype", "constructor"].includes(segment))) return undefined;
  if (segments[0] !== "competition") return undefined;
  let current = state;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)];
      continue;
    }
    if (typeof current !== "object") return undefined;
    current = current[segment];
  }
  return current;
}

function interpolateStoryText(text, state) {
  if (typeof text !== "string") return text;
  return text.replace(/\{\{([A-Za-z0-9_.]+)\}\}/g, (_match, path) => {
    const value = readStoryTemplatePath(state, path);
    return value === undefined || value === null ? "?" : String(value);
  });
}

function renderedStitches(node, state) {
  if (!Array.isArray(node.stitches)) return null;
  return node.stitches.map((stitch) => ({
    ...clone(stitch),
    text: interpolateStoryText(stitch.text, state)
  }));
}

function nodeText(node, state) {
  if (Array.isArray(node.stitches)) {
    return renderedStitches(node, state).map((stitch) => stitch.text).join("\n\n");
  }
  return interpolateStoryText(node.text, state);
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
    const trainerProgression = getTrainerProgressionView(state);
    if (trainerProgression) {
      return {
        sceneId: "trainer-level-up",
        sceneTitle: "Trainer Level Up",
        moduleId: null,
        nodeId: `level_${trainerProgression.level}_${trainerProgression.type}`,
        text: trainerProgression.text,
        stitches: null,
        choices: clone(trainerProgression.choices),
        trainerProgression: clone(trainerProgression),
        worldTime: getWorldTimeView(state.world),
        questJournal: getQuestJournal(state),
        pending: null,
        lastRoll: clone(state.lastRoll)
      };
    }
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
      text: nodeText(node, state),
      stitches: renderedStitches(node, state),
      choices: clone(visibleChoices),
      worldTime: getWorldTimeView(state.world),
      questJournal: getQuestJournal(state),
      pending: clone(state.pending),
      lastRoll: clone(state.lastRoll)
    };
  }

  async choose(state, choiceId) {
    if (hasPendingTrainerProgression(state)) {
      const next = clone(state);
      const resolution = resolveTrainerProgressionChoice(next, choiceId);
      const progression = syncCampaignTrainerProgression(next);
      const worldEvents = await this.loadWorldEvents();
      const firedWorldEvents = processWorldEvents(next, worldEvents, (eventState, effects) => {
        applyEffects(eventState, effects);
      });
      const postEventProgression = syncCampaignTrainerProgression(next);
      next.story.history.push({
        sceneId: next.story.sceneId,
        nodeId: next.story.nodeId,
        subsystem: "trainer_progression",
        choiceId,
        resolution: clone(resolution),
        progression: clone([...progression, ...postEventProgression]),
        worldEvents: clone(firedWorldEvents)
      });
      touchState(next, this.now);
      return next;
    }

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
      let competitionMeta = choice.combat.competition ? clone(choice.combat.competition) : null;
      let dynamicWorldOpponent = null;
      if (competitionMeta?.worldOpponentIndex !== undefined) {
        const prepared = prepareWorldGroupMatch(next, competitionMeta);
        competitionMeta = prepared.meta;
        dynamicWorldOpponent = prepared.roster;
      } else if (competitionMeta?.worldKnockoutRound !== undefined) {
        const prepared = prepareWorldKnockoutMatch(next, competitionMeta);
        competitionMeta = prepared.meta;
        dynamicWorldOpponent = prepared.roster;
      }
      if (competitionMeta) {
        beginCompetitionMatch(next, competitionMeta);
      }

      const officialRosterSize = competitionMeta?.officialRosterSize ?? null;
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
        opponent: clone(dynamicWorldOpponent?.[0] ?? choice.combat.opponent),
        opponentBench: clone(dynamicWorldOpponent ? dynamicWorldOpponent.slice(1) : (choice.combat.opponentBench ?? [])),
        playerPokemon: clone(playerRoster?.[0] ?? stateRoster[0] ?? next.player.starter),
        playerBench: clone(playerRoster ? playerRoster.slice(1) : (choice.combat.playerBench ?? [])),
        trainer: {
          name: next.player.name,
          trainerClass: next.player.trainerClass,
          trainerPath: clone(next.player.trainerPath),
          level: next.player.trainerLevel,
          trainerLevel: next.player.trainerLevel,
          trainerXp: next.player.trainerXp,
          abilities: clone(next.player.abilities),
          skills: clone(next.player.skills),
          proficiencies: clone(next.player.proficiencies),
          savingThrows: clone(next.player.savingThrows),
          hp: clone(next.player.hp),
          ac: next.player.ac,
          hitDice: clone(next.player.hitDice),
          classResources: clone(next.player.classResources),
          classFeatures: clone(next.player.classFeatures),
          feats: clone(next.player.feats),
          specializations: clone(next.player.specializations),
          equipment: clone(next.player.equipment),
          trainerGear: clone(next.player.trainerGear),
          conditions: clone(next.player.conditions),
          movement: clone(next.player.movement),
          inventory: clone(next.player.inventory),
          money: next.player.money,
          featureUsage: clone(next.player.featureUsage),
          persistentEffects: clone(next.player.persistentEffects),
          death: clone(next.player.death)
        },
        trainerPosition: clone(choice.combat.trainerPosition ?? { x: 0, y: 0 }),
        playerPosition: clone(choice.combat.playerPosition ?? { x: 0, y: 0 }),
        opponentPosition: clone(choice.combat.opponentPosition ?? { x: 5, y: 0 }),
        opponentRegistered: Boolean(choice.combat.opponentRegistered || choice.combat.competition),
        returnNodes: clone(choice.combat.returnNodes),
        competition: clone(competitionMeta),
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

    const preEventProgression = syncCampaignTrainerProgression(next);
    const worldEvents = await this.loadWorldEvents();
    const firedWorldEvents = processWorldEvents(next, worldEvents, (eventState, effects) => {
      applyEffects(eventState, effects);
    });
    const postEventProgression = syncCampaignTrainerProgression(next);
    if (firedWorldEvents.length > 0) {
      historyEntry.worldEvents = clone(firedWorldEvents);
    }
    if (preEventProgression.length > 0 || postEventProgression.length > 0) {
      historyEntry.trainerProgression = clone([...preEventProgression, ...postEventProgression]);
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

    if (resolvedBattle?.trainer) {
      const trainer = resolvedBattle.trainer;
      for (const field of [
        "trainerClass", "trainerPath", "trainerXp", "abilities", "skills", "proficiencies",
        "savingThrows", "hp", "ac", "hitDice", "classResources", "classFeatures",
        "feats", "specializations", "equipment", "trainerGear", "conditions", "movement",
        "inventory", "money", "featureUsage", "persistentEffects", "death"
      ]) {
        if (trainer[field] !== undefined) next.player[field] = clone(trainer[field]);
      }
      if (Number.isInteger(trainer.trainerLevel ?? trainer.level)) {
        next.player.trainerLevel = trainer.trainerLevel ?? trainer.level;
      }
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
        for (const field of [
          "xp", "ac", "attributes", "savingThrows", "proficiencies", "hitDice", "bond",
          "gender", "nature", "evolutionHistory", "pendingMoveLearning",
          "pendingMoveChoices", "pendingAsiChoices", "pendingLevelUp", "declinedEvolutionAtLevel"
        ]) {
          if (combatant[field] !== undefined) persisted[field] = clone(combatant[field]);
        }
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
      for (const field of [
        "xp", "ac", "attributes", "savingThrows", "proficiencies", "hitDice", "bond",
        "gender", "nature", "evolutionHistory", "pendingMoveLearning",
        "pendingMoveChoices", "pendingAsiChoices", "pendingLevelUp", "declinedEvolutionAtLevel"
      ]) {
        if (resolvedBattle.opponent[field] !== undefined) {
          capturedPokemon[field] = clone(resolvedBattle.opponent[field]);
        }
      }
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
      resolveCompetitionMatch(next, competitionMeta, outcome, resolvedBattle);
    }

    next.pending = null;
    const target = applyTarget(next, targetRef, sourceSceneId);
    const trainerProgression = syncCampaignTrainerProgression(next);
    next.story.history.push({
      sceneId: sourceSceneId,
      subsystem: "pokemon5e_combat",
      encounterId,
      outcome,
      competition: competitionMeta,
      toSceneId: target.sceneId,
      toNodeId: target.nodeId,
      trainerProgression: clone(trainerProgression)
    });
    touchState(next, this.now);
    return next;
  }
}
