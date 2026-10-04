const ID_RE = /^[A-Za-z0-9_-]+$/;

const FIXED_PATHS = new Set([
  "player.name",
  "player.trainerLevel",
  "player.roster.length",
  "world.day",
  "world.elapsedMinutes",
  "world.minuteOfDay",
  "world.time",
  "world.locationId",
  "story.sceneId",
  "story.nodeId"
]);

const COMPARATORS = new Set(["eq", "ne", "gt", "gte", "lt", "lte", "in", "exists"]);
const GROUPS = new Set(["all", "any", "not"]);
const FORBIDDEN_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPrimitive(value) {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

export function isAllowedConditionPath(path) {
  if (typeof path !== "string" || path.length === 0) return false;
  const segments = path.split(".");
  if (segments.some((segment) => FORBIDDEN_SEGMENTS.has(segment))) return false;
  if (FIXED_PATHS.has(path)) return true;
  if (segments.length === 3 &&
      segments[0] === "world" &&
      segments[1] === "flags" &&
      ID_RE.test(segments[2])) return true;
  if (segments.length === 3 &&
      segments[0] === "quests" &&
      ID_RE.test(segments[1]) &&
      ["status", "resolution", "startedAtMinutes", "deadlineAtMinutes", "resolvedAtMinutes"].includes(segments[2])) return true;
  if (segments.length === 3 &&
      segments[0] === "events" &&
      ID_RE.test(segments[1]) &&
      ["status", "outcomeId", "firedAtMinutes"].includes(segments[2])) return true;
  if (segments.length === 4 &&
      segments[0] === "npcs" &&
      ID_RE.test(segments[1]) &&
      segments[2] === "relationship" &&
      ["score", "qualitative"].includes(segments[3])) return true;
  if (segments.length === 4 &&
      segments[0] === "npcs" &&
      ID_RE.test(segments[1]) &&
      segments[2] === "schedule" &&
      ["id", "locationId", "availability", "activity", "startsAtMinutes", "endsAtMinutes", "present"].includes(segments[3])) return true;
  return segments.length === 4 &&
    segments[0] === "npcs" &&
    ID_RE.test(segments[1]) &&
    segments[2] === "state" &&
    ID_RE.test(segments[3]);
}

export function readConditionPath(state, path) {
  if (!isAllowedConditionPath(path)) {
    throw new Error(`Condition path is not allowed: ${path}`);
  }

  if (path === "player.roster.length") {
    return Array.isArray(state.player?.roster) ? state.player.roster.length : 0;
  }

  const segments = path.split(".");
  let current = state;
  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = current[segment];
  }
  return current;
}

function compare(actual, operator, expected) {
  switch (operator) {
    case "eq": return actual === expected;
    case "ne": return actual !== expected;
    case "gt": return typeof actual === "number" && actual > expected;
    case "gte": return typeof actual === "number" && actual >= expected;
    case "lt": return typeof actual === "number" && actual < expected;
    case "lte": return typeof actual === "number" && actual <= expected;
    case "in": return expected.includes(actual);
    case "exists": return expected ? actual !== undefined : actual === undefined;
    default: throw new Error(`Unsupported condition comparator: ${operator}`);
  }
}

export function evaluateCondition(state, condition) {
  if (condition === undefined || condition === null) return true;
  if (!isObject(condition)) throw new Error("Condition must be an object");

  const groupKeys = [...GROUPS].filter((key) => Object.hasOwn(condition, key));
  if (groupKeys.length > 0) {
    if (groupKeys.length !== 1 || Object.keys(condition).length !== 1) {
      throw new Error("Condition group must contain exactly one of all, any, or not");
    }
    if (condition.all) return condition.all.every((entry) => evaluateCondition(state, entry));
    if (condition.any) return condition.any.some((entry) => evaluateCondition(state, entry));
    return !evaluateCondition(state, condition.not);
  }

  const comparatorKeys = [...COMPARATORS].filter((key) => Object.hasOwn(condition, key));
  if (typeof condition.path !== "string" || comparatorKeys.length !== 1 || Object.keys(condition).length !== 2) {
    throw new Error("Leaf condition requires path and exactly one comparator");
  }

  const operator = comparatorKeys[0];
  return compare(readConditionPath(state, condition.path), operator, condition[operator]);
}

export function validateCondition(condition, at = "conditions") {
  const errors = [];

  function push(code, message, path) {
    errors.push({ code, message, at: path });
  }

  function visit(value, path) {
    if (!isObject(value)) {
      push("INVALID_CONDITION", "Condition must be an object", path);
      return;
    }

    const keys = Object.keys(value);
    const groupKeys = [...GROUPS].filter((key) => Object.hasOwn(value, key));

    if (groupKeys.length > 0) {
      if (groupKeys.length !== 1 || keys.length !== 1) {
        push("INVALID_CONDITION_GROUP", "Condition group must contain exactly one of all, any, or not", path);
        return;
      }

      const group = groupKeys[0];
      if (group === "not") {
        if (!isObject(value.not)) {
          push("INVALID_CONDITION_NOT", "not requires one nested condition object", path + ".not");
          return;
        }
        visit(value.not, path + ".not");
        return;
      }

      if (!Array.isArray(value[group]) || value[group].length === 0) {
        push("INVALID_CONDITION_GROUP", group + " requires a non-empty condition array", path + "." + group);
        return;
      }
      value[group].forEach((entry, index) => visit(entry, path + "." + group + "[" + index + "]"));
      return;
    }

    if (typeof value.path !== "string" || !isAllowedConditionPath(value.path)) {
      push("INVALID_CONDITION_PATH", "Condition path is not allowed: " + String(value.path), path + ".path");
    }

    const comparatorKeys = [...COMPARATORS].filter((key) => Object.hasOwn(value, key));
    if (comparatorKeys.length !== 1 || keys.length !== 2) {
      push("INVALID_CONDITION_COMPARATOR", "Leaf condition requires path and exactly one comparator", path);
      return;
    }

    const operator = comparatorKeys[0];
    const expected = value[operator];

    if (["gt", "gte", "lt", "lte"].includes(operator) && typeof expected !== "number") {
      push("INVALID_CONDITION_VALUE", operator + " requires a numeric value", path + "." + operator);
    }
    if (["eq", "ne"].includes(operator) && !isPrimitive(expected)) {
      push("INVALID_CONDITION_VALUE", operator + " requires a primitive JSON value", path + "." + operator);
    }
    if (operator === "exists" && typeof expected !== "boolean") {
      push("INVALID_CONDITION_VALUE", "exists requires true or false", path + ".exists");
    }
    if (operator === "in") {
      if (!Array.isArray(expected) || expected.length === 0 || expected.some((entry) => !isPrimitive(entry))) {
        push("INVALID_CONDITION_VALUE", "in requires a non-empty array of primitive JSON values", path + ".in");
      }
    }
  }

  if (condition !== undefined) visit(condition, at);
  return errors;
}
