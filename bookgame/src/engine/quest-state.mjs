import { ensureWorldClock } from "./time.mjs";

export const QUEST_STATUSES = new Set(["available", "active", "completed", "failed", "expired"]);
const TERMINAL_STATUSES = new Set(["completed", "failed", "expired"]);
const DEADLINE_STATUSES = new Set(["completed", "failed", "expired"]);
const ID_RE = /^[A-Za-z0-9_-]+$/;

function clone(value) {
  return structuredClone(value);
}

function requireQuestId(questId) {
  if (typeof questId !== "string" || !ID_RE.test(questId)) {
    throw new Error("Invalid questId: " + String(questId));
  }
}

function nowMinutes(state) {
  ensureWorldClock(state.world);
  return state.world.elapsedMinutes;
}

function ensureQuestTable(state) {
  state.quests ??= {};
  return state.quests;
}

function terminalize(quest, status, atMinutes, resolution, resolvedBy) {
  quest.status = status;
  quest.resolvedAtMinutes = atMinutes;
  quest.resolution = resolution ?? status;
  quest.resolvedBy = resolvedBy;
  return quest;
}

export function offerQuest(state, {
  questId,
  title = null,
  objective = null,
  expiresInMinutes = null,
  onExpire = null
}) {
  requireQuestId(questId);
  const quests = ensureQuestTable(state);
  const current = quests[questId];
  if (current && !TERMINAL_STATUSES.has(current.status)) return current;
  if (current && TERMINAL_STATUSES.has(current.status)) {
    throw new Error("Cannot re-offer terminal quest without repeatable quest support: " + questId);
  }

  const offeredAtMinutes = nowMinutes(state);
  quests[questId] = {
    id: questId,
    title,
    objective,
    status: "available",
    offeredAtMinutes,
    startedAtMinutes: null,
    deadlineAtMinutes: expiresInMinutes === null ? null : offeredAtMinutes + expiresInMinutes,
    resolvedAtMinutes: null,
    resolution: null,
    resolvedBy: null,
    onDeadline: onExpire ? clone(onExpire) : { status: "expired", resolution: "offer_expired" }
  };
  return quests[questId];
}

export function startQuest(state, {
  questId,
  title = null,
  objective = null,
  deadlineMinutes = null,
  onDeadline = null
}) {
  requireQuestId(questId);
  const quests = ensureQuestTable(state);
  const current = quests[questId];

  if (current?.status === "active") return current;
  if (current && TERMINAL_STATUSES.has(current.status)) {
    throw new Error("Cannot start terminal quest without repeatable quest support: " + questId);
  }

  const startedAtMinutes = nowMinutes(state);
  const quest = current ?? {
    id: questId,
    title: null,
    objective: null,
    offeredAtMinutes: null
  };

  quest.title = title ?? quest.title;
  quest.objective = objective ?? quest.objective;
  quest.status = "active";
  quest.startedAtMinutes = startedAtMinutes;
  quest.deadlineAtMinutes = deadlineMinutes === null ? null : startedAtMinutes + deadlineMinutes;
  quest.resolvedAtMinutes = null;
  quest.resolution = null;
  quest.resolvedBy = null;
  quest.onDeadline = onDeadline ? clone(onDeadline) : { status: "failed", resolution: "deadline_expired" };
  quests[questId] = quest;
  return quest;
}

function requireActiveQuest(state, questId) {
  requireQuestId(questId);
  const quest = ensureQuestTable(state)[questId];
  if (!quest || quest.status !== "active") {
    throw new Error("Quest is not active: " + questId);
  }
  return quest;
}

export function completeQuest(state, { questId, resolution = "player_completed" }) {
  const quest = requireActiveQuest(state, questId);
  return terminalize(quest, "completed", nowMinutes(state), resolution, "player");
}

export function failQuest(state, { questId, resolution = "player_failed" }) {
  const quest = requireActiveQuest(state, questId);
  return terminalize(quest, "failed", nowMinutes(state), resolution, "player");
}

export function processQuestDeadlines(state) {
  const quests = ensureQuestTable(state);
  const atMinutes = nowMinutes(state);
  const events = [];

  for (const quest of Object.values(quests)) {
    if (!quest || !["available", "active"].includes(quest.status)) continue;
    if (!Number.isInteger(quest.deadlineAtMinutes) || quest.deadlineAtMinutes > atMinutes) continue;

    const fallback = quest.status === "available"
      ? { status: "expired", resolution: "offer_expired" }
      : { status: "failed", resolution: "deadline_expired" };
    const outcome = quest.onDeadline ?? fallback;
    const status = outcome.status;
    if (!DEADLINE_STATUSES.has(status)) {
      throw new Error("Invalid quest deadline status for " + quest.id + ": " + status);
    }

    terminalize(
      quest,
      status,
      atMinutes,
      outcome.resolution ?? fallback.resolution,
      outcome.resolvedBy ?? "world"
    );
    events.push({
      questId: quest.id,
      status: quest.status,
      resolution: quest.resolution,
      resolvedAtMinutes: atMinutes
    });
  }

  return events;
}

export function applyQuestEffect(state, effect) {
  switch (effect.type) {
    case "quest_offer": return offerQuest(state, effect);
    case "quest_start": return startQuest(state, effect);
    case "quest_complete": return completeQuest(state, effect);
    case "quest_fail": return failQuest(state, effect);
    default: throw new Error("Unsupported quest effect type: " + effect.type);
  }
}

export function getQuestJournal(state) {
  const quests = Object.values(state.quests ?? {}).map(clone);
  return {
    active: quests.filter((quest) => quest.status === "active"),
    completed: quests.filter((quest) => quest.status === "completed"),
    failed: quests.filter((quest) => quest.status === "failed"),
    expired: quests.filter((quest) => quest.status === "expired")
  };
}

export function validateQuestEffect(effect, at = "effect") {
  const errors = [];
  const push = (code, message, path = at) => errors.push({ code, message, at: path });

  if (!effect || typeof effect !== "object" || Array.isArray(effect)) {
    push("INVALID_QUEST_EFFECT", "Quest effect must be an object");
    return errors;
  }
  if (!["quest_offer", "quest_start", "quest_complete", "quest_fail"].includes(effect.type)) {
    push("INVALID_QUEST_EFFECT", "Unsupported quest effect type");
    return errors;
  }
  if (typeof effect.questId !== "string" || !ID_RE.test(effect.questId)) {
    push("INVALID_QUEST_ID", "questId must be a stable identifier", at + ".questId");
  }
  if (effect.title !== undefined && effect.title !== null && typeof effect.title !== "string") {
    push("INVALID_QUEST_TITLE", "title must be a string or null", at + ".title");
  }
  if (effect.objective !== undefined && effect.objective !== null && typeof effect.objective !== "string") {
    push("INVALID_QUEST_OBJECTIVE", "objective must be a string or null", at + ".objective");
  }
  for (const field of ["expiresInMinutes", "deadlineMinutes"]) {
    if (effect[field] !== undefined && effect[field] !== null &&
        (!Number.isInteger(effect[field]) || effect[field] < 1)) {
      push("INVALID_QUEST_DEADLINE", field + " must be a positive integer or null", at + "." + field);
    }
  }
  for (const field of ["onExpire", "onDeadline"]) {
    const outcome = effect[field];
    if (outcome === undefined || outcome === null) continue;
    if (typeof outcome !== "object" || Array.isArray(outcome) || !DEADLINE_STATUSES.has(outcome.status)) {
      push("INVALID_QUEST_DEADLINE_OUTCOME", field + " requires status completed, failed, or expired", at + "." + field);
      continue;
    }
    if (outcome.resolution !== undefined && typeof outcome.resolution !== "string") {
      push("INVALID_QUEST_RESOLUTION", "resolution must be a string", at + "." + field + ".resolution");
    }
    if (outcome.resolvedBy !== undefined && typeof outcome.resolvedBy !== "string") {
      push("INVALID_QUEST_RESOLVER", "resolvedBy must be a string", at + "." + field + ".resolvedBy");
    }
  }
  if (effect.resolution !== undefined && typeof effect.resolution !== "string") {
    push("INVALID_QUEST_RESOLUTION", "resolution must be a string", at + ".resolution");
  }
  return errors;
}
