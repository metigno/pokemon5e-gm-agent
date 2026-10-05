import { ensureWorldClock } from "./time.mjs";

export const RANKS = ["F", "E", "D", "C", "B", "A", "S"];
export const COMPETITION_TYPES = new Set(["official_match", "promotion_trial"]);
export const DIFFICULTY_BANDS = new Set(["ROUTINE", "STANDARD", "HARD", "ELITE", "STORY_THREAT"]);
const ID_RE = /^[A-Za-z0-9_-]+$/;

function requireId(value, label) {
  if (typeof value !== "string" || !ID_RE.test(value)) {
    throw new Error("Invalid " + label + ": " + String(value));
  }
}

function rankOrder(rank) {
  const index = RANKS.indexOf(rank);
  if (index < 0) throw new Error("Invalid Circuit Rank: " + String(rank));
  return index;
}

export function createCompetitionState() {
  return {
    rank: "F",
    rankOrder: 0,
    circuitPoints: 0,
    firstOfficialResolved: false,
    activeMatch: null,
    history: [],
    trials: {}
  };
}

export function ensureCompetition(state) {
  state.competition ??= createCompetitionState();
  if (!RANKS.includes(state.competition.rank)) state.competition.rank = "F";
  state.competition.rankOrder = rankOrder(state.competition.rank);
  state.competition.circuitPoints ??= 0;
  state.competition.firstOfficialResolved ??= false;
  state.competition.activeMatch ??= null;
  state.competition.history ??= [];
  state.competition.trials ??= {};
  return state.competition;
}

export function setTrialAvailable(state, {
  checkpointId,
  fromRank,
  toRank,
  requiredRosterSize,
  retryable = true
}) {
  requireId(checkpointId, "checkpointId");
  rankOrder(fromRank);
  rankOrder(toRank);
  if (!Number.isInteger(requiredRosterSize) || requiredRosterSize < 1 || requiredRosterSize > 6) {
    throw new RangeError("requiredRosterSize must be an integer from 1 to 6");
  }

  const competition = ensureCompetition(state);
  const existing = competition.trials[checkpointId];
  if (existing?.completed) return existing;

  const trial = existing ?? {
    checkpointId,
    attempts: 0,
    bestResult: null,
    lastResult: null,
    completed: false,
    registered: false,
    registeredAtMinutes: null
  };

  trial.fromRank = fromRank;
  trial.toRank = toRank;
  trial.requiredRosterSize = requiredRosterSize;
  trial.retryable = Boolean(retryable);
  trial.available = competition.rank === fromRank;
  competition.trials[checkpointId] = trial;
  return trial;
}

export function registerTrial(state, { checkpointId }) {
  requireId(checkpointId, "checkpointId");
  const competition = ensureCompetition(state);
  const trial = competition.trials[checkpointId];
  if (!trial || !trial.available || trial.completed) {
    throw new Error("Promotion Trial is not available: " + checkpointId);
  }
  if (competition.rank !== trial.fromRank) {
    throw new Error("Current rank is not eligible for Trial " + checkpointId);
  }
  const rosterSize = Array.isArray(state.player?.roster) ? state.player.roster.length : 0;
  if (rosterSize < trial.requiredRosterSize) {
    throw new Error(
      "Promotion Trial " + checkpointId + " requires roster size " +
      trial.requiredRosterSize + ", current " + rosterSize
    );
  }

  ensureWorldClock(state.world);
  trial.registered = true;
  trial.registeredAtMinutes = state.world.elapsedMinutes;
  return trial;
}

function validateMetaRuntime(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    throw new Error("Competition metadata must be an object");
  }
  if (!COMPETITION_TYPES.has(meta.type)) throw new Error("Invalid competition type: " + String(meta.type));
  requireId(meta.matchId, "matchId");
  if (meta.format !== "Singles") throw new Error("E5 currently supports official Singles only");
  if (!Number.isInteger(meta.officialRosterSize) || meta.officialRosterSize < 1 || meta.officialRosterSize > 6) {
    throw new RangeError("officialRosterSize must be an integer from 1 to 6");
  }
  if (!DIFFICULTY_BANDS.has(meta.difficulty)) {
    throw new Error("Invalid competition difficulty: " + String(meta.difficulty));
  }
  if (meta.firstOfficial !== undefined && typeof meta.firstOfficial !== "boolean") {
    throw new Error("firstOfficial must be boolean");
  }
  if (meta.opponentTrainerId !== undefined) {
    requireId(meta.opponentTrainerId, "opponentTrainerId");
  }
  if (meta.type === "promotion_trial") {
    requireId(meta.checkpointId, "checkpointId");
    rankOrder(meta.fromRank);
    rankOrder(meta.toRank);
    if (typeof meta.retryable !== "boolean") throw new Error("promotion_trial requires retryable boolean");
  }
  return meta;
}

export function beginCompetitionMatch(state, meta) {
  validateMetaRuntime(meta);
  const competition = ensureCompetition(state);
  if (competition.activeMatch) throw new Error("A competition match is already active");

  const rosterSize = Array.isArray(state.player?.roster) ? state.player.roster.length : 0;
  if (rosterSize < meta.officialRosterSize) {
    throw new Error(
      "Official match " + meta.matchId + " requires roster size " +
      meta.officialRosterSize + ", current " + rosterSize
    );
  }

  if (meta.type === "promotion_trial") {
    const trial = competition.trials[meta.checkpointId];
    if (!trial || !trial.available || !trial.registered || trial.completed) {
      throw new Error("Promotion Trial is not registered: " + meta.checkpointId);
    }
    if (competition.rank !== meta.fromRank || trial.fromRank !== meta.fromRank || trial.toRank !== meta.toRank) {
      throw new Error("Promotion Trial rank metadata mismatch: " + meta.checkpointId);
    }
    if (trial.requiredRosterSize !== meta.officialRosterSize) {
      throw new Error("Promotion Trial roster metadata mismatch: " + meta.checkpointId);
    }
    trial.attempts += 1;
  }

  ensureWorldClock(state.world);
  competition.activeMatch = {
    matchId: meta.matchId,
    type: meta.type,
    checkpointId: meta.checkpointId ?? null,
    startedAtMinutes: state.world.elapsedMinutes,
    officialRosterSize: meta.officialRosterSize,
    format: meta.format,
    difficulty: meta.difficulty,
    opponentTrainerId: meta.opponentTrainerId ?? null
  };
  return competition.activeMatch;
}

export function resolveCompetitionMatch(state, meta, outcome) {
  validateMetaRuntime(meta);
  if (!["win", "lose"].includes(outcome)) {
    throw new Error("Official competition outcome must be win or lose");
  }

  const competition = ensureCompetition(state);
  if (!competition.activeMatch || competition.activeMatch.matchId !== meta.matchId) {
    throw new Error("No matching active competition match: " + meta.matchId);
  }

  ensureWorldClock(state.world);
  const record = {
    matchId: meta.matchId,
    type: meta.type,
    checkpointId: meta.checkpointId ?? null,
    outcome,
    format: meta.format,
    officialRosterSize: meta.officialRosterSize,
    difficulty: meta.difficulty,
    opponentTrainerId: meta.opponentTrainerId ?? null,
    resolvedAtMinutes: state.world.elapsedMinutes
  };
  competition.history.push(record);

  if (meta.type === "official_match" && meta.firstOfficial === true) {
    competition.firstOfficialResolved = true;
  }

  if (meta.type === "promotion_trial") {
    const trial = competition.trials[meta.checkpointId];
    if (!trial) throw new Error("Missing Trial state: " + meta.checkpointId);

    trial.lastResult = outcome;
    trial.registered = false;
    trial.registeredAtMinutes = null;

    if (outcome === "win") {
      trial.bestResult = "win";
      trial.completed = true;
      trial.available = false;
      competition.rank = meta.toRank;
      competition.rankOrder = rankOrder(meta.toRank);
    } else {
      trial.bestResult ??= "lose";
      trial.available = Boolean(meta.retryable);
    }
  }

  competition.activeMatch = null;
  return record;
}

export function applyCompetitionEffect(state, effect) {
  switch (effect.type) {
    case "competition_trial_available": return setTrialAvailable(state, effect);
    case "competition_trial_register": return registerTrial(state, effect);
    default: throw new Error("Unsupported competition effect type: " + effect.type);
  }
}

export function validateCompetitionEffect(effect, at = "effect") {
  const errors = [];
  const push = (code, message, path = at) => errors.push({ code, message, at: path });

  if (!effect || typeof effect !== "object" || Array.isArray(effect)) {
    push("INVALID_COMPETITION_EFFECT", "Competition effect must be an object");
    return errors;
  }

  if (effect.type === "competition_trial_available") {
    if (typeof effect.checkpointId !== "string" || !ID_RE.test(effect.checkpointId)) {
      push("INVALID_CHECKPOINT_ID", "checkpointId must be a stable identifier", at + ".checkpointId");
    }
    if (!RANKS.includes(effect.fromRank) || !RANKS.includes(effect.toRank)) {
      push("INVALID_COMPETITION_RANK", "fromRank and toRank must be valid Circuit Ranks", at);
    }
    if (!Number.isInteger(effect.requiredRosterSize) || effect.requiredRosterSize < 1 || effect.requiredRosterSize > 6) {
      push("INVALID_OFFICIAL_ROSTER_SIZE", "requiredRosterSize must be 1..6", at + ".requiredRosterSize");
    }
    if (effect.retryable !== undefined && typeof effect.retryable !== "boolean") {
      push("INVALID_TRIAL_RETRYABLE", "retryable must be boolean", at + ".retryable");
    }
    return errors;
  }

  if (effect.type === "competition_trial_register") {
    if (typeof effect.checkpointId !== "string" || !ID_RE.test(effect.checkpointId)) {
      push("INVALID_CHECKPOINT_ID", "competition_trial_register requires checkpointId", at + ".checkpointId");
    }
    return errors;
  }

  push("INVALID_COMPETITION_EFFECT", "Unsupported competition effect type");
  return errors;
}

export function validateCompetitionCombat(meta, at = "combat.competition") {
  const errors = [];
  const push = (code, message, path = at) => errors.push({ code, message, at: path });
  if (meta === undefined) return errors;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    push("INVALID_COMPETITION_COMBAT", "competition metadata must be an object");
    return errors;
  }
  if (!COMPETITION_TYPES.has(meta.type)) {
    push("INVALID_COMPETITION_TYPE", "type must be official_match or promotion_trial", at + ".type");
  }
  if (typeof meta.matchId !== "string" || !ID_RE.test(meta.matchId)) {
    push("INVALID_COMPETITION_MATCH_ID", "matchId must be a stable identifier", at + ".matchId");
  }
  if (meta.format !== "Singles") {
    push("INVALID_COMPETITION_FORMAT", "E5 currently supports official Singles only", at + ".format");
  }
  if (!Number.isInteger(meta.officialRosterSize) || meta.officialRosterSize < 1 || meta.officialRosterSize > 6) {
    push("INVALID_OFFICIAL_ROSTER_SIZE", "officialRosterSize must be 1..6", at + ".officialRosterSize");
  }
  if (!DIFFICULTY_BANDS.has(meta.difficulty)) {
    push("INVALID_COMPETITION_DIFFICULTY", "Unknown competition difficulty band", at + ".difficulty");
  }
  if (meta.firstOfficial !== undefined && typeof meta.firstOfficial !== "boolean") {
    push("INVALID_FIRST_OFFICIAL", "firstOfficial must be boolean", at + ".firstOfficial");
  }
  if (meta.opponentTrainerId !== undefined && (typeof meta.opponentTrainerId !== "string" || !ID_RE.test(meta.opponentTrainerId))) {
    push("INVALID_OPPONENT_TRAINER_ID", "opponentTrainerId must be a stable identifier", at + ".opponentTrainerId");
  }
  if (meta.type === "promotion_trial") {
    if (typeof meta.checkpointId !== "string" || !ID_RE.test(meta.checkpointId)) {
      push("INVALID_CHECKPOINT_ID", "promotion_trial requires checkpointId", at + ".checkpointId");
    }
    if (!RANKS.includes(meta.fromRank) || !RANKS.includes(meta.toRank)) {
      push("INVALID_COMPETITION_RANK", "promotion_trial requires valid fromRank/toRank", at);
    }
    if (typeof meta.retryable !== "boolean") {
      push("INVALID_TRIAL_RETRYABLE", "promotion_trial requires retryable boolean", at + ".retryable");
    }
  }
  return errors;
}
