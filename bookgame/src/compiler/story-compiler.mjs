import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateCondition } from "../engine/conditions.mjs";
import { validateQuestEffect } from "../engine/quest-state.mjs";
import { validateNpcEffect } from "../engine/npc-state.mjs";
import { validateCompetitionEffect, validateCompetitionCombat } from "../engine/competition-state.mjs";
import { compileEcologyCatalog } from "./ecology-compiler.mjs";

const ID_RE = /^[A-Za-z0-9_-]+$/;
const TARGET_RE = /^[A-Za-z0-9_-]+(?:#[A-Za-z0-9_-]+)?$/;
const ABILITIES = new Set(["STR", "DEX", "CON", "INT", "WIS", "CHA"]);
const EFFECT_TYPES = new Set([
  "set_flag",
  "set_location",
  "purchase_item",
  "quest_offer",
  "quest_start",
  "quest_complete",
  "quest_fail",
  "npc_register",
  "npc_relationship_adjust",
  "npc_state_set",
  "npc_schedule_set",
  "friend_beat_select",
  "competition_trial_available",
  "competition_trial_register",
  "competition_world_draw"
]);

function diag(code, message, at) {
  return { code, message, at };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateSceneShops(shops, at, errors) {
  if (shops === undefined) return;
  if (!isObject(shops)) {
    errors.push(diag("INVALID_SHOPS", "shops must be an object keyed by shop id", at));
    return;
  }

  for (const [shopId, definition] of Object.entries(shops)) {
    const shopAt = at + "." + shopId;
    if (!ID_RE.test(shopId)) {
      errors.push(diag("INVALID_SHOP_ID", "Shop id must be stable", shopAt));
      continue;
    }
    if (!isObject(definition)) {
      errors.push(diag("INVALID_SHOP", "Shop definition must be an object", shopAt));
      continue;
    }
    if (!Number.isInteger(definition.refreshEveryDays) || definition.refreshEveryDays < 1) {
      errors.push(diag("INVALID_SHOP_REFRESH", "refreshEveryDays must be a positive integer", shopAt + ".refreshEveryDays"));
    }
    if (!isObject(definition.stock) || Object.keys(definition.stock).length === 0) {
      errors.push(diag("INVALID_SHOP_STOCK", "stock must contain at least one item", shopAt + ".stock"));
      continue;
    }
    for (const [itemId, quantity] of Object.entries(definition.stock)) {
      if (!ID_RE.test(itemId)) {
        errors.push(diag("INVALID_SHOP_ITEM_ID", "Shop stock item id must be stable", shopAt + ".stock." + itemId));
      }
      if (!Number.isInteger(quantity) || quantity < 0) {
        errors.push(diag("INVALID_SHOP_STOCK_QUANTITY", "Shop stock quantity must be a non-negative integer", shopAt + ".stock." + itemId));
      }
    }
  }
}

function parseTarget(target, currentSceneId) {
  if (typeof target !== "string" || !TARGET_RE.test(target)) return null;
  if (!target.includes("#")) return { sceneId: currentSceneId, nodeId: target };
  const [sceneId, nodeId] = target.split("#");
  return { sceneId, nodeId };
}

function validateEffects(effects, at, errors) {
  if (effects === undefined) return;
  if (!Array.isArray(effects)) {
    errors.push(diag("INVALID_EFFECTS", "effects must be an array", at));
    return;
  }

  for (let index = 0; index < effects.length; index += 1) {
    const effect = effects[index];
    const effectAt = at + ".effects[" + index + "]";
    if (!isObject(effect) || !EFFECT_TYPES.has(effect.type)) {
      errors.push(diag("UNSUPPORTED_EFFECT", "Unsupported or malformed effect type", effectAt));
      continue;
    }
    if (effect.type === "set_flag" && (typeof effect.key !== "string" || effect.key.length === 0)) {
      errors.push(diag("INVALID_SET_FLAG", "set_flag requires a non-empty key", effectAt));
    }
    if (effect.type === "set_location" && (typeof effect.locationId !== "string" || effect.locationId.length === 0)) {
      errors.push(diag("INVALID_SET_LOCATION", "set_location requires locationId", effectAt));
    }
    if (effect.type === "purchase_item") {
      if (typeof effect.itemId !== "string" || !ID_RE.test(effect.itemId)) {
        errors.push(diag("INVALID_PURCHASE_ITEM_ID", "purchase_item requires a stable itemId", effectAt + ".itemId"));
      }
      if (!Number.isInteger(effect.cost) || effect.cost < 0) {
        errors.push(diag("INVALID_PURCHASE_COST", "purchase_item cost must be a non-negative integer", effectAt + ".cost"));
      }
      if (effect.quantity !== undefined && (!Number.isInteger(effect.quantity) || effect.quantity < 1)) {
        errors.push(diag("INVALID_PURCHASE_QUANTITY", "purchase_item quantity must be a positive integer", effectAt + ".quantity"));
      }
      if (effect.shopId !== undefined && (typeof effect.shopId !== "string" || !ID_RE.test(effect.shopId))) {
        errors.push(diag("INVALID_PURCHASE_SHOP_ID", "purchase_item shopId must be a stable shop id", effectAt + ".shopId"));
      }
    }
    if (["quest_offer", "quest_start", "quest_complete", "quest_fail"].includes(effect.type)) {
      errors.push(...validateQuestEffect(effect, effectAt));
    }
    if (["npc_register", "npc_relationship_adjust", "npc_state_set", "npc_schedule_set", "friend_beat_select"].includes(effect.type)) {
      errors.push(...validateNpcEffect(effect, effectAt));
    }
    if (["competition_trial_available", "competition_trial_register", "competition_world_draw"].includes(effect.type)) {
      errors.push(...validateCompetitionEffect(effect, effectAt));
    }
  }
}

function validateTargetShape(target, at, errors) {
  if (typeof target !== "string" || !TARGET_RE.test(target)) {
    errors.push(diag("INVALID_TARGET", "Transition target must be nodeId or sceneId#nodeId", at));
    return false;
  }
  return true;
}

function nodeStitchCount(node) {
  if (Array.isArray(node.stitches)) return node.stitches.length;
  return typeof node.text === "string" && node.text.trim().length > 0 ? 1 : 0;
}

function validateNodeNarration(node, nodeAt, errors) {
  const hasText = typeof node.text === "string" && node.text.trim().length > 0;
  const hasStitches = Array.isArray(node.stitches);

  if (hasText && hasStitches) {
    errors.push(diag("AMBIGUOUS_NARRATION", "Node must use text or stitches, not both", nodeAt));
    return;
  }
  if (!hasText && !hasStitches) {
    errors.push(diag("INVALID_NODE_TEXT", "Node requires non-empty text or stitches", nodeAt));
    return;
  }
  if (hasStitches) {
    if (node.stitches.length === 0) {
      errors.push(diag("EMPTY_STITCHES", "stitches must contain at least one stitch", nodeAt));
      return;
    }
    const stitchIds = new Set();
    for (let index = 0; index < node.stitches.length; index += 1) {
      const stitch = node.stitches[index];
      const stitchAt = nodeAt + ".stitches[" + index + "]";
      if (!isObject(stitch) || typeof stitch.id !== "string" || !ID_RE.test(stitch.id)) {
        errors.push(diag("INVALID_STITCH_ID", "Stitch requires a valid id", stitchAt));
        continue;
      }
      if (stitchIds.has(stitch.id)) {
        errors.push(diag("DUPLICATE_STITCH_ID", "Duplicate stitch id: " + stitch.id, stitchAt));
      }
      stitchIds.add(stitch.id);
      if (typeof stitch.text !== "string" || stitch.text.trim().length === 0) {
        errors.push(diag("INVALID_STITCH_TEXT", "Stitch text must be non-empty", stitchAt));
      }
    }
  }
}

function collectTarget(targets, target, at, currentSceneId) {
  const parsed = parseTarget(target, currentSceneId);
  if (parsed) targets.push({ ...parsed, at, raw: target });
}

export function validateScene(scene, { sourceFile = "<memory>" } = {}) {
  const errors = [];
  const warnings = [];
  const targets = [];

  if (!isObject(scene)) {
    return {
      valid: false,
      errors: [diag("INVALID_SCENE", "Scene must be a JSON object", sourceFile)],
      warnings,
      targets,
      metrics: { nodes: 0, stitches: 0, choices: 0 }
    };
  }

  if (scene.schemaVersion !== 1) {
    errors.push(diag("SCHEMA_VERSION", "schemaVersion must be 1", sourceFile));
  }
  if (typeof scene.id !== "string" || !ID_RE.test(scene.id)) {
    errors.push(diag("INVALID_SCENE_ID", "Scene id must match " + ID_RE, sourceFile));
  }
  if (scene.moduleId !== undefined && (typeof scene.moduleId !== "string" || !ID_RE.test(scene.moduleId))) {
    errors.push(diag("INVALID_MODULE_ID", "moduleId must be a valid identifier", sourceFile));
  }
  errors.push(...validateCondition(scene.conditions, sourceFile + ".conditions"));
  if (typeof scene.title !== "string" || scene.title.trim().length === 0) {
    errors.push(diag("INVALID_TITLE", "Scene title must be non-empty", sourceFile));
  }
  if (typeof scene.locationId !== "string" || scene.locationId.trim().length === 0) {
    errors.push(diag("INVALID_LOCATION", "Scene locationId must be non-empty", sourceFile));
  }
  validateSceneShops(scene.shops, sourceFile + ".shops", errors);
  if (!isObject(scene.nodes) || Object.keys(scene.nodes).length === 0) {
    errors.push(diag("INVALID_NODES", "Scene must contain at least one node", sourceFile));
    return {
      valid: false,
      errors,
      warnings,
      targets,
      metrics: { nodes: 0, stitches: 0, choices: 0 }
    };
  }

  const nodeIds = Object.keys(scene.nodes);
  const knownNodes = new Set(nodeIds);
  const adjacency = new Map(nodeIds.map((id) => [id, new Set()]));
  let choiceCount = 0;
  let stitchCount = 0;

  const entryNodeId = scene.entryNodeId ?? nodeIds[0];
  if (!knownNodes.has(entryNodeId)) {
    errors.push(diag("INVALID_ENTRY_NODE", "entryNodeId does not exist: " + entryNodeId, sourceFile));
  }

  for (const nodeId of nodeIds) {
    const node = scene.nodes[nodeId];
    const nodeAt = sourceFile + "#" + nodeId;

    if (!ID_RE.test(nodeId)) errors.push(diag("INVALID_NODE_ID", "Invalid node ID: " + nodeId, nodeAt));
    if (!isObject(node)) {
      errors.push(diag("INVALID_NODE", "Node must be an object", nodeAt));
      continue;
    }

    validateNodeNarration(node, nodeAt, errors);
    stitchCount += nodeStitchCount(node);

    const choices = node.choices ?? [];
    if (!Array.isArray(choices)) {
      errors.push(diag("INVALID_CHOICES", "choices must be an array", nodeAt));
      continue;
    }
    if (choices.length === 0) warnings.push(diag("TERMINAL_NODE", "Node has no choices", nodeAt));

    const choiceIds = new Set();
    for (let index = 0; index < choices.length; index += 1) {
      choiceCount += 1;
      const choice = choices[index];
      const choiceAt = nodeAt + ".choices[" + index + "]";

      if (!isObject(choice)) {
        errors.push(diag("INVALID_CHOICE", "Choice must be an object", choiceAt));
        continue;
      }
      if (typeof choice.id !== "string" || !ID_RE.test(choice.id)) {
        errors.push(diag("INVALID_CHOICE_ID", "Choice id is missing or invalid", choiceAt));
      } else if (choiceIds.has(choice.id)) {
        errors.push(diag("DUPLICATE_CHOICE_ID", "Duplicate choice id: " + choice.id, choiceAt));
      } else {
        choiceIds.add(choice.id);
      }
      if (typeof choice.text !== "string" || choice.text.trim().length === 0) {
        errors.push(diag("INVALID_CHOICE_TEXT", "Choice text must be non-empty", choiceAt));
      }

      errors.push(...validateCondition(choice.conditions, choiceAt + ".conditions"));
      if (choice.timeCostMinutes !== undefined &&
          (!Number.isInteger(choice.timeCostMinutes) || choice.timeCostMinutes < 0)) {
        errors.push(diag(
          "INVALID_TIME_COST",
          "timeCostMinutes must be a non-negative integer",
          choiceAt + ".timeCostMinutes"
        ));
      }
      validateEffects(choice.effects, choiceAt, errors);

      const hasCheck = isObject(choice.check);
      const hasCombat = isObject(choice.combat);
      const hasEcology = isObject(choice.ecology);
      const hasGoto = typeof choice.goto === "string";
      const modeCount = Number(hasCheck) + Number(hasCombat) + Number(hasEcology) + Number(hasGoto);

      if (modeCount !== 1) {
        errors.push(diag("TRANSITION_MODE", "Choice must use exactly one transition mode: goto, check, combat, or ecology", choiceAt));
        continue;
      }

      if (hasGoto) {
        if (validateTargetShape(choice.goto, choiceAt + ".goto", errors)) {
          const parsed = parseTarget(choice.goto, scene.id);
          if (parsed.sceneId === scene.id) {
            adjacency.get(nodeId).add(parsed.nodeId);
            if (!knownNodes.has(parsed.nodeId)) {
              errors.push(diag("MISSING_TARGET", "Transition points to missing node: " + choice.goto, choiceAt + ".goto"));
            }
          }
          collectTarget(targets, choice.goto, choiceAt + ".goto", scene.id);
        }
        continue;
      }

      if (hasEcology) {
        const ecology = choice.ecology;
        if (typeof ecology.requestId !== "string" || !ID_RE.test(ecology.requestId)) {
          errors.push(diag("INVALID_ECOLOGY_REQUEST_ID", "ecology.requestId must be a stable identifier", choiceAt + ".ecology.requestId"));
        }
        if (typeof ecology.zoneId !== "string" || !ID_RE.test(ecology.zoneId)) {
          errors.push(diag("INVALID_ECOLOGY_ZONE", "ecology.zoneId must be a stable identifier", choiceAt + ".ecology.zoneId"));
        }
        if (ecology.habitat !== undefined && (typeof ecology.habitat !== "string" || ecology.habitat.length === 0)) {
          errors.push(diag("INVALID_ECOLOGY_HABITAT", "ecology.habitat must be a non-empty string", choiceAt + ".ecology.habitat"));
        }
        if (ecology.method !== undefined && (typeof ecology.method !== "string" || ecology.method.length === 0)) {
          errors.push(diag("INVALID_ECOLOGY_METHOD", "ecology.method must be a non-empty string", choiceAt + ".ecology.method"));
        }
        if (!Array.isArray(ecology.allowedSpecies) || ecology.allowedSpecies.length === 0 ||
            ecology.allowedSpecies.some((id) => typeof id !== "string" || !ID_RE.test(id))) {
          errors.push(diag("INVALID_ECOLOGY_ALLOWED_SPECIES", "ecology.allowedSpecies must be a non-empty list of species IDs", choiceAt + ".ecology.allowedSpecies"));
        }
        if (!isObject(ecology.returnNodes) || typeof ecology.returnNodes.noEncounter !== "string") {
          errors.push(diag("INVALID_ECOLOGY_RETURN_NODES", "ecology.returnNodes requires noEncounter and per-species targets", choiceAt + ".ecology.returnNodes"));
        } else {
          const targetKeys = new Set(["noEncounter", ...(ecology.allowedSpecies ?? [])]);
          for (const key of targetKeys) {
            const target = ecology.returnNodes[key];
            const at = choiceAt + ".ecology.returnNodes." + key;
            if (typeof target !== "string") {
              errors.push(diag("MISSING_ECOLOGY_TARGET", "Missing ecology return target for " + key, at));
              continue;
            }
            if (validateTargetShape(target, at, errors)) {
              const parsed = parseTarget(target, scene.id);
              if (parsed.sceneId === scene.id) {
                adjacency.get(nodeId).add(parsed.nodeId);
                if (!knownNodes.has(parsed.nodeId)) {
                  errors.push(diag("MISSING_TARGET", "Transition points to missing node: " + target, at));
                }
              }
              collectTarget(targets, target, at, scene.id);
            }
          }
        }
        continue;
      }

      if (hasCheck) {
        const check = choice.check;
        if (!ABILITIES.has(check.ability)) {
          errors.push(diag("INVALID_ABILITY", "Unknown ability code: " + check.ability, choiceAt + ".check"));
        }
        if (check.skill !== undefined && (typeof check.skill !== "string" || check.skill.trim().length === 0)) {
          errors.push(diag("INVALID_SKILL", "check.skill must be a non-empty string when present", choiceAt + ".check"));
        }
        if (!Number.isInteger(check.dc) || check.dc < 1) {
          errors.push(diag("INVALID_DC", "check.dc must be a positive integer", choiceAt + ".check"));
        }
        if (!isObject(choice.outcomes)) {
          errors.push(diag("INVALID_OUTCOMES", "Check choice requires outcomes", choiceAt));
          continue;
        }

        for (const outcomeKey of ["success", "failure"]) {
          const outcome = choice.outcomes[outcomeKey];
          const outcomeAt = choiceAt + ".outcomes." + outcomeKey;
          if (!isObject(outcome)) {
            errors.push(diag("MISSING_OUTCOME", "Check requires " + outcomeKey + " outcome", outcomeAt));
            continue;
          }
          validateEffects(outcome.effects, outcomeAt, errors);
          if (validateTargetShape(outcome.goto, outcomeAt + ".goto", errors)) {
            const parsed = parseTarget(outcome.goto, scene.id);
            if (parsed.sceneId === scene.id) {
              adjacency.get(nodeId).add(parsed.nodeId);
              if (!knownNodes.has(parsed.nodeId)) {
                errors.push(diag("MISSING_TARGET", "Transition points to missing node: " + outcome.goto, outcomeAt + ".goto"));
              }
            }
            collectTarget(targets, outcome.goto, outcomeAt + ".goto", scene.id);
          }
        }
        continue;
      }

      const combat = choice.combat;
      if (typeof combat.encounterId !== "string" || combat.encounterId.length === 0) {
        errors.push(diag("INVALID_ENCOUNTER_ID", "combat.encounterId is required", choiceAt + ".combat"));
      }
      if (!isObject(combat.opponent) || typeof combat.opponent.species !== "string" || combat.opponent.species.length === 0) {
        errors.push(diag("INVALID_COMBAT_OPPONENT", "combat.opponent.species is required", choiceAt + ".combat"));
      }
      if (combat.opponent && (!Number.isInteger(combat.opponent.level) || combat.opponent.level < 1)) {
        errors.push(diag("INVALID_COMBAT_LEVEL", "combat.opponent.level must be a positive integer", choiceAt + ".combat"));
      }

      if (combat.opponentBench !== undefined && !Array.isArray(combat.opponentBench)) {
        errors.push(diag(
          "INVALID_OPPONENT_BENCH",
          "combat.opponentBench must be an array when present",
          choiceAt + ".combat.opponentBench"
        ));
      } else {
        for (const [index, descriptor] of (combat.opponentBench ?? []).entries()) {
          const at = choiceAt + ".combat.opponentBench[" + index + "]";
          if (!isObject(descriptor) || typeof descriptor.species !== "string" || descriptor.species.length === 0) {
            errors.push(diag("INVALID_COMBAT_OPPONENT", "Opponent bench entries require species", at));
          }
          if (!Number.isInteger(descriptor?.level) || descriptor.level < 1) {
            errors.push(diag("INVALID_COMBAT_LEVEL", "Opponent bench level must be a positive integer", at + ".level"));
          }
        }
      }

      errors.push(...validateCompetitionCombat(combat.competition, choiceAt + ".combat.competition"));

      if (combat.competition) {
        const opponentRosterSize = 1 + (Array.isArray(combat.opponentBench) ? combat.opponentBench.length : 0);
        if (opponentRosterSize !== combat.competition.officialRosterSize) {
          errors.push(diag(
            "COMPETITION_OPPONENT_ROSTER_SIZE_MISMATCH",
            "Official competition opponent roster must match officialRosterSize",
            choiceAt + ".combat.opponentBench"
          ));
        }
      }

      if (combat.competition && combat.opponentRegistered === false) {
        errors.push(diag(
          "COMPETITION_OPPONENT_MUST_BE_REGISTERED",
          "Official competition opponents must be registered to a Trainer",
          choiceAt + ".combat.opponentRegistered"
        ));
      }

      if (validateTargetShape(combat.goto, choiceAt + ".combat.goto", errors)) {
        const parsed = parseTarget(combat.goto, scene.id);
        if (parsed.sceneId === scene.id) {
          adjacency.get(nodeId).add(parsed.nodeId);
          if (!knownNodes.has(parsed.nodeId)) {
            errors.push(diag("MISSING_TARGET", "Transition points to missing node: " + combat.goto, choiceAt + ".combat.goto"));
          }
        }
        collectTarget(targets, combat.goto, choiceAt + ".combat.goto", scene.id);
      }

      if (!isObject(combat.returnNodes) || Object.keys(combat.returnNodes).length === 0) {
        errors.push(diag("INVALID_RETURN_NODES", "combat.returnNodes must contain at least one outcome", choiceAt + ".combat"));
      } else {
        if (combat.competition) {
          for (const requiredOutcome of ["win", "lose"]) {
            if (typeof combat.returnNodes[requiredOutcome] !== "string") {
              errors.push(diag(
                "MISSING_COMPETITION_OUTCOME",
                "Official competition combat requires returnNodes." + requiredOutcome,
                choiceAt + ".combat.returnNodes"
              ));
            }
          }
          if (Object.hasOwn(combat.returnNodes, "captured")) {
            errors.push(diag(
              "INVALID_COMPETITION_CAPTURE_OUTCOME",
              "Official competition cannot use a captured return outcome",
              choiceAt + ".combat.returnNodes.captured"
            ));
          }
        }
        for (const [outcome, target] of Object.entries(combat.returnNodes)) {
          const at = choiceAt + ".combat.returnNodes." + outcome;
          if (validateTargetShape(target, at, errors)) {
            const parsed = parseTarget(target, scene.id);
            if (parsed.sceneId === scene.id) {
              adjacency.get(nodeId).add(parsed.nodeId);
              if (!knownNodes.has(parsed.nodeId)) {
                errors.push(diag("MISSING_TARGET", "Transition points to missing node: " + target, at));
              }
            }
            collectTarget(targets, target, at, scene.id);
          }
        }
      }
    }
  }

  if (knownNodes.has(entryNodeId)) {
    const visited = new Set([entryNodeId]);
    const queue = [entryNodeId];
    while (queue.length > 0) {
      const current = queue.shift();
      for (const target of adjacency.get(current) ?? []) {
        if (knownNodes.has(target) && !visited.has(target)) {
          visited.add(target);
          queue.push(target);
        }
      }
    }
    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId)) {
        warnings.push(diag("UNREACHABLE_NODE_LOCAL", "Node is not locally reachable from scene entry", sourceFile + "#" + nodeId));
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    targets,
    metrics: { nodes: nodeIds.length, stitches: stitchCount, choices: choiceCount }
  };
}

export function validateWorldEventCatalog(catalog, { sourceFile = "<memory>" } = {}) {
  const errors = [];
  if (!isObject(catalog) || catalog.schemaVersion !== 1 || !Array.isArray(catalog.events)) {
    return {
      valid: false,
      errors: [diag("INVALID_WORLD_EVENT_CATALOG", "World event catalog requires schemaVersion=1 and events[]", sourceFile)],
      events: []
    };
  }

  const ids = new Set();
  const validEvents = [];

  for (let index = 0; index < catalog.events.length; index += 1) {
    const event = catalog.events[index];
    const eventAt = sourceFile + ".events[" + index + "]";
    if (!isObject(event) || typeof event.id !== "string" || !ID_RE.test(event.id)) {
      errors.push(diag("INVALID_WORLD_EVENT_ID", "World event requires a valid id", eventAt));
      continue;
    }
    if (ids.has(event.id)) {
      errors.push(diag("DUPLICATE_WORLD_EVENT_ID", "Duplicate world event id: " + event.id, eventAt));
      continue;
    }
    ids.add(event.id);

    if (event.once !== undefined && typeof event.once !== "boolean") {
      errors.push(diag("INVALID_WORLD_EVENT_ONCE", "once must be boolean when present", eventAt + ".once"));
    }
    errors.push(...validateCondition(event.trigger, eventAt + ".trigger"));

    if (!Array.isArray(event.outcomes) || event.outcomes.length === 0) {
      errors.push(diag("INVALID_WORLD_EVENT_OUTCOMES", "World event requires at least one outcome", eventAt + ".outcomes"));
      continue;
    }

    const outcomeIds = new Set();
    let unconditionalCount = 0;
    for (let outcomeIndex = 0; outcomeIndex < event.outcomes.length; outcomeIndex += 1) {
      const outcome = event.outcomes[outcomeIndex];
      const outcomeAt = eventAt + ".outcomes[" + outcomeIndex + "]";
      if (!isObject(outcome) || typeof outcome.id !== "string" || !ID_RE.test(outcome.id)) {
        errors.push(diag("INVALID_WORLD_EVENT_OUTCOME_ID", "Outcome requires a valid id", outcomeAt));
        continue;
      }
      if (outcomeIds.has(outcome.id)) {
        errors.push(diag("DUPLICATE_WORLD_EVENT_OUTCOME_ID", "Duplicate outcome id: " + outcome.id, outcomeAt));
      }
      outcomeIds.add(outcome.id);

      if (outcome.when === undefined) {
        unconditionalCount += 1;
        if (outcomeIndex !== event.outcomes.length - 1) {
          errors.push(diag("WORLD_EVENT_FALLBACK_ORDER", "Unconditional outcome must be last", outcomeAt));
        }
      } else {
        errors.push(...validateCondition(outcome.when, outcomeAt + ".when"));
      }
      validateEffects(outcome.effects, outcomeAt, errors);
    }
    if (unconditionalCount > 1) {
      errors.push(diag("WORLD_EVENT_MULTIPLE_FALLBACKS", "World event may have at most one unconditional outcome", eventAt));
    }

    validEvents.push(event);
  }

  return { valid: errors.length === 0, errors, events: validEvents };
}

async function loadWorldEventCatalogs(eventsDir, errors) {
  const byId = {};
  let files = [];
  try {
    files = await listJsonFiles(eventsDir);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  for (const file of files) {
    let catalog;
    try {
      catalog = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      errors.push(diag("INVALID_WORLD_EVENT_JSON", error.message, file));
      continue;
    }

    const report = validateWorldEventCatalog(catalog, { sourceFile: file });
    errors.push(...report.errors);

    for (const event of report.events) {
      if (Object.hasOwn(byId, event.id)) {
        errors.push(diag("DUPLICATE_WORLD_EVENT_ID", "Duplicate world event id across catalogs: " + event.id, file));
      } else {
        byId[event.id] = {
          ...event,
          moduleId: event.moduleId ?? catalog.moduleId ?? null
        };
      }
    }
  }

  return Object.values(byId).sort((a, b) => a.id.localeCompare(b.id));
}

async function listJsonFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await listJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(full);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

async function loadModuleManifests(modulesDir, errors) {
  const manifests = {};
  let files = [];
  try {
    files = await listJsonFiles(modulesDir);
  } catch (error) {
    if (error.code === "ENOENT") return manifests;
    throw error;
  }

  for (const file of files) {
    let manifest;
    try {
      manifest = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      errors.push(diag("INVALID_MODULE_JSON", error.message, file));
      continue;
    }
    if (!isObject(manifest) || manifest.schemaVersion !== 1 || typeof manifest.id !== "string" || !ID_RE.test(manifest.id)) {
      errors.push(diag("INVALID_MODULE_MANIFEST", "Module manifest requires schemaVersion=1 and valid id", file));
      continue;
    }
    if (!isObject(manifest.targets) || !Number.isInteger(manifest.targets.stitches) || !Number.isInteger(manifest.targets.choices)) {
      errors.push(diag("INVALID_MODULE_TARGETS", "Module manifest requires integer stitch/choice targets", file));
      continue;
    }
    if (Array.isArray(manifest.blocks)) {
      const blockIds = new Set();
      let blockStitches = 0;
      let blockChoices = 0;

      for (let index = 0; index < manifest.blocks.length; index += 1) {
        const block = manifest.blocks[index];
        const blockAt = file + ".blocks[" + index + "]";
        if (!isObject(block) || typeof block.id !== "string" || !ID_RE.test(block.id)) {
          errors.push(diag("INVALID_MODULE_BLOCK", "Module block requires a valid id", blockAt));
          continue;
        }
        if (blockIds.has(block.id)) {
          errors.push(diag("DUPLICATE_MODULE_BLOCK", "Duplicate module block id: " + block.id, blockAt));
          continue;
        }
        blockIds.add(block.id);
        if (!isObject(block.targets) ||
            !Number.isInteger(block.targets.stitches) || block.targets.stitches < 0 ||
            !Number.isInteger(block.targets.choices) || block.targets.choices < 0) {
          errors.push(diag("INVALID_MODULE_BLOCK_TARGETS", "Module block requires non-negative integer stitch/choice targets", blockAt));
          continue;
        }
        blockStitches += block.targets.stitches;
        blockChoices += block.targets.choices;
      }

      if (blockStitches !== manifest.targets.stitches || blockChoices !== manifest.targets.choices) {
        errors.push(diag(
          "MODULE_BLOCK_BUDGET_MISMATCH",
          "Block budgets must sum exactly to module targets: got " +
            blockStitches + "/" + blockChoices + ", expected " +
            manifest.targets.stitches + "/" + manifest.targets.choices,
          file
        ));
      }
    }

    if (Object.hasOwn(manifests, manifest.id)) {
      errors.push(diag("DUPLICATE_MODULE_ID", "Duplicate module manifest: " + manifest.id, file));
      continue;
    }
    manifests[manifest.id] = manifest;
  }
  return manifests;
}

export class StoryCompileError extends Error {
  constructor(diagnostics) {
    super("Story compilation failed with " + diagnostics.length + " error(s)");
    this.name = "StoryCompileError";
    this.diagnostics = diagnostics;
  }
}

export async function compileStory({
  scenesDir,
  modulesDir = path.join(path.dirname(scenesDir), "modules"),
  eventsDir = path.join(path.dirname(scenesDir), "events"),
  ecologyOptions = null
}) {
  const files = await listJsonFiles(scenesDir);
  const scenes = {};
  const sceneReports = {};
  const errors = [];
  const warnings = [];
  let nodeCount = 0;
  let stitchCount = 0;
  let choiceCount = 0;

  const modules = await loadModuleManifests(modulesDir, errors);
  const worldEvents = await loadWorldEventCatalogs(eventsDir, errors);
  let ecology = null;
  if (ecologyOptions) {
    const ecologyReport = await compileEcologyCatalog(ecologyOptions);
    errors.push(...ecologyReport.errors);
    ecology = ecologyReport.catalog;
  }

  for (const file of files) {
    let scene;
    try {
      scene = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      errors.push(diag("INVALID_JSON", error.message, file));
      continue;
    }

    const expectedId = path.basename(file, ".json");
    if (scene.id !== expectedId) {
      errors.push(diag("SCENE_FILE_MISMATCH", "Filename expects scene id " + expectedId + " but file declares " + scene.id, file));
    }

    const report = validateScene(scene, { sourceFile: file });
    errors.push(...report.errors);
    warnings.push(...report.warnings);
    sceneReports[scene.id] = report;
    nodeCount += report.metrics.nodes;
    stitchCount += report.metrics.stitches;
    choiceCount += report.metrics.choices;

    if (typeof scene.id === "string") {
      if (Object.hasOwn(scenes, scene.id)) errors.push(diag("DUPLICATE_SCENE_ID", "Duplicate scene id: " + scene.id, file));
      else scenes[scene.id] = scene;
    }
  }

  if (files.length === 0) errors.push(diag("NO_SCENES", "No scene JSON files found", scenesDir));

  if (ecology) {
    for (const [sceneId, scene] of Object.entries(scenes)) {
      for (const [nodeId, node] of Object.entries(scene.nodes ?? {})) {
        for (const choice of node.choices ?? []) {
          if (!isObject(choice.ecology)) continue;
          const at = sceneId + "#" + nodeId + "." + String(choice.id);
          const zone = ecology.zones[choice.ecology.zoneId];
          if (!zone) {
            errors.push(diag("UNKNOWN_COMPILED_ECOLOGY_ZONE", "Unknown compiled ecology zone: " + choice.ecology.zoneId, at));
            continue;
          }
          if (choice.ecology.habitat && !zone.habitats.includes(choice.ecology.habitat)) {
            errors.push(diag("ECOLOGY_HABITAT_NOT_IN_ZONE", "Habitat is not enabled for ecology zone: " + choice.ecology.habitat, at));
          }
          if (choice.ecology.method && !zone.methods.includes(choice.ecology.method)) {
            errors.push(diag("ECOLOGY_METHOD_NOT_IN_ZONE", "Encounter method is not enabled for ecology zone: " + choice.ecology.method, at));
          }
          const validSpecies = new Set(zone.species.map((entry) => entry.id));
          for (const speciesId of choice.ecology.allowedSpecies ?? []) {
            if (!validSpecies.has(speciesId)) {
              errors.push(diag("ECOLOGY_SPECIES_NOT_IN_ZONE", speciesId + " is not valid for compiled ecology zone " + zone.id, at));
            }
          }
        }
      }
    }
  }

  for (const [sceneId, report] of Object.entries(sceneReports)) {
    for (const target of report.targets) {
      const targetScene = scenes[target.sceneId];
      if (!targetScene) {
        errors.push(diag("MISSING_SCENE_TARGET", "Transition points to missing scene: " + target.sceneId, target.at));
        continue;
      }
      if (!Object.hasOwn(targetScene.nodes, target.nodeId)) {
        errors.push(diag("MISSING_TARGET", "Transition points to missing node: " + target.raw, target.at));
      }
    }
  }

  const moduleMetrics = {};
  for (const [moduleId, manifest] of Object.entries(modules)) {
    moduleMetrics[moduleId] = {
      title: manifest.title ?? moduleId,
      targetStitches: manifest.targets.stitches,
      targetChoices: manifest.targets.choices,
      blockTargets: (manifest.blocks ?? []).map((block) => ({
        id: block.id,
        title: block.title ?? block.id,
        targetStitches: block.targets.stitches,
        targetChoices: block.targets.choices
      })),
      implementedScenes: 0,
      implementedNodes: 0,
      implementedStitches: 0,
      implementedChoices: 0
    };
  }

  for (const [sceneId, scene] of Object.entries(scenes)) {
    if (!scene.moduleId) continue;
    if (!Object.hasOwn(modules, scene.moduleId)) {
      errors.push(diag("UNKNOWN_MODULE", "Scene references missing module manifest: " + scene.moduleId, sceneId));
      continue;
    }
    const report = sceneReports[sceneId];
    const metric = moduleMetrics[scene.moduleId];
    metric.implementedScenes += 1;
    metric.implementedNodes += report.metrics.nodes;
    metric.implementedStitches += report.metrics.stitches;
    metric.implementedChoices += report.metrics.choices;
  }

  for (const metric of Object.values(moduleMetrics)) {
    metric.stitchProgress = Number((metric.implementedStitches / metric.targetStitches).toFixed(6));
    metric.choiceProgress = Number((metric.implementedChoices / metric.targetChoices).toFixed(6));
    if (metric.implementedStitches > metric.targetStitches) {
      warnings.push(diag("MODULE_STITCH_BUDGET_EXCEEDED", "Implemented stitches exceed module target", metric.title));
    }
    if (metric.implementedChoices > metric.targetChoices) {
      warnings.push(diag("MODULE_CHOICE_BUDGET_EXCEEDED", "Implemented choices exceed module target", metric.title));
    }
  }

  if (errors.length > 0) throw new StoryCompileError(errors);

  const sceneIds = Object.keys(scenes).sort((a, b) => a.localeCompare(b));
  const orderedScenes = {};
  for (const sceneId of sceneIds) orderedScenes[sceneId] = scenes[sceneId];

  return {
    format: "p5e-librogame-story-bundle",
    schemaVersion: 1,
    sourceSchemaVersion: 1,
    offline: true,
    index: {
      sceneIds,
      sceneCount: sceneIds.length,
      nodeCount,
      stitchCount,
      choiceCount,
      worldEventCount: worldEvents.length,
      ecologyZoneCount: ecology ? Object.keys(ecology.zones).length : 0,
      ecologySpeciesCount: ecology ? new Set(Object.values(ecology.zones).flatMap((zone) => zone.species.map((entry) => entry.id))).size : 0,
      modules: moduleMetrics
    },
    diagnostics: { warnings },
    worldEvents,
    ecology,
    scenes: orderedScenes
  };
}

export async function writeStoryBundle(bundle, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(bundle, null, 2) + "\n", "utf8");
}
