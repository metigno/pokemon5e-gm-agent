import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ID_RE = /^[A-Za-z0-9_-]+$/;
const ABILITIES = new Set(["STR", "DEX", "CON", "INT", "WIS", "CHA"]);
const EFFECT_TYPES = new Set(["set_flag", "set_location"]);

function diag(code, message, at) {
  return { code, message, at };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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
  }
}

function addEdge(adjacency, from, to) {
  if (typeof to !== "string" || to.length === 0) return;
  adjacency.get(from).add(to);
}

function validateTarget(target, knownNodes, at, errors) {
  if (typeof target !== "string" || target.length === 0) {
    errors.push(diag("INVALID_TARGET", "Transition target must be a non-empty node ID", at));
    return;
  }
  if (!knownNodes.has(target)) {
    errors.push(diag("MISSING_TARGET", "Transition points to missing node: " + target, at));
  }
}

export function validateScene(scene, { sourceFile = "<memory>" } = {}) {
  const errors = [];
  const warnings = [];

  if (!isObject(scene)) {
    return {
      valid: false,
      errors: [diag("INVALID_SCENE", "Scene must be a JSON object", sourceFile)],
      warnings,
      metrics: { nodes: 0, choices: 0 }
    };
  }

  if (scene.schemaVersion !== 1) {
    errors.push(diag("SCHEMA_VERSION", "schemaVersion must be 1", sourceFile));
  }
  if (typeof scene.id !== "string" || !ID_RE.test(scene.id)) {
    errors.push(diag("INVALID_SCENE_ID", "Scene id must match " + ID_RE, sourceFile));
  }
  if (typeof scene.title !== "string" || scene.title.trim().length === 0) {
    errors.push(diag("INVALID_TITLE", "Scene title must be non-empty", sourceFile));
  }
  if (typeof scene.locationId !== "string" || scene.locationId.trim().length === 0) {
    errors.push(diag("INVALID_LOCATION", "Scene locationId must be non-empty", sourceFile));
  }
  if (!isObject(scene.nodes) || Object.keys(scene.nodes).length === 0) {
    errors.push(diag("INVALID_NODES", "Scene must contain at least one node", sourceFile));
    return {
      valid: false,
      errors,
      warnings,
      metrics: { nodes: 0, choices: 0 }
    };
  }

  const nodeIds = Object.keys(scene.nodes);
  const knownNodes = new Set(nodeIds);
  const adjacency = new Map(nodeIds.map((id) => [id, new Set()]));
  let choiceCount = 0;

  const entryNodeId = scene.entryNodeId ?? nodeIds[0];
  if (!knownNodes.has(entryNodeId)) {
    errors.push(diag("INVALID_ENTRY_NODE", "entryNodeId does not exist: " + entryNodeId, sourceFile));
  }

  for (const nodeId of nodeIds) {
    const node = scene.nodes[nodeId];
    const nodeAt = sourceFile + "#" + nodeId;

    if (!ID_RE.test(nodeId)) {
      errors.push(diag("INVALID_NODE_ID", "Invalid node ID: " + nodeId, nodeAt));
    }
    if (!isObject(node)) {
      errors.push(diag("INVALID_NODE", "Node must be an object", nodeAt));
      continue;
    }
    if (typeof node.text !== "string" || node.text.trim().length === 0) {
      errors.push(diag("INVALID_NODE_TEXT", "Node text must be non-empty", nodeAt));
    }

    const choices = node.choices ?? [];
    if (!Array.isArray(choices)) {
      errors.push(diag("INVALID_CHOICES", "choices must be an array", nodeAt));
      continue;
    }
    if (choices.length === 0) {
      warnings.push(diag("TERMINAL_NODE", "Node has no choices", nodeAt));
    }

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

      validateEffects(choice.effects, choiceAt, errors);

      const hasCheck = isObject(choice.check);
      const hasCombat = isObject(choice.combat);
      const hasGoto = typeof choice.goto === "string";
      const modeCount = Number(hasCheck) + Number(hasCombat) + Number(hasGoto);

      if (modeCount !== 1) {
        errors.push(diag(
          "TRANSITION_MODE",
          "Choice must use exactly one transition mode: goto, check, or combat",
          choiceAt
        ));
        continue;
      }

      if (hasGoto) {
        addEdge(adjacency, nodeId, choice.goto);
        validateTarget(choice.goto, knownNodes, choiceAt + ".goto", errors);
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
          addEdge(adjacency, nodeId, outcome.goto);
          validateTarget(outcome.goto, knownNodes, outcomeAt + ".goto", errors);
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

      addEdge(adjacency, nodeId, combat.goto);
      validateTarget(combat.goto, knownNodes, choiceAt + ".combat.goto", errors);

      if (!isObject(combat.returnNodes) || Object.keys(combat.returnNodes).length === 0) {
        errors.push(diag("INVALID_RETURN_NODES", "combat.returnNodes must contain at least one outcome", choiceAt + ".combat"));
      } else {
        for (const [outcome, target] of Object.entries(combat.returnNodes)) {
          addEdge(adjacency, nodeId, target);
          validateTarget(target, knownNodes, choiceAt + ".combat.returnNodes." + outcome, errors);
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
        warnings.push(diag("UNREACHABLE_NODE", "Node is unreachable from entry: " + nodeId, sourceFile + "#" + nodeId));
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metrics: { nodes: nodeIds.length, choices: choiceCount }
  };
}

async function listJsonFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listJsonFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(full);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

export class StoryCompileError extends Error {
  constructor(diagnostics) {
    super("Story compilation failed with " + diagnostics.length + " error(s)");
    this.name = "StoryCompileError";
    this.diagnostics = diagnostics;
  }
}

export async function compileStory({ scenesDir }) {
  const files = await listJsonFiles(scenesDir);
  const scenes = {};
  const errors = [];
  const warnings = [];
  let nodeCount = 0;
  let choiceCount = 0;

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
      errors.push(diag(
        "SCENE_FILE_MISMATCH",
        "Filename expects scene id " + expectedId + " but file declares " + scene.id,
        file
      ));
    }

    const report = validateScene(scene, { sourceFile: file });
    errors.push(...report.errors);
    warnings.push(...report.warnings);
    nodeCount += report.metrics.nodes;
    choiceCount += report.metrics.choices;

    if (typeof scene.id === "string") {
      if (Object.hasOwn(scenes, scene.id)) {
        errors.push(diag("DUPLICATE_SCENE_ID", "Duplicate scene id: " + scene.id, file));
      } else {
        scenes[scene.id] = scene;
      }
    }
  }

  if (files.length === 0) {
    errors.push(diag("NO_SCENES", "No scene JSON files found", scenesDir));
  }

  if (errors.length > 0) {
    throw new StoryCompileError(errors);
  }

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
      choiceCount
    },
    diagnostics: {
      warnings
    },
    scenes: orderedScenes
  };
}

export async function writeStoryBundle(bundle, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(bundle, null, 2) + "\n", "utf8");
}
