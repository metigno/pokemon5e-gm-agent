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

export function createWorldCompetitionState() {
  return {
    edition: 1,
    drawComplete: false,
    fieldLocked: false,
    field: [],
    seedOrder: [],
    groups: {},
    playerGroup: null,
    playerOpponents: [],
    qualifications: {},
    drawSeed: null
  };
}

export function createCompetitionState() {
  return {
    rank: "F",
    rankOrder: 0,
    circuitPoints: 0,
    firstOfficialResolved: false,
    firstOfficialResult: null,
    activeMatch: null,
    history: [],
    trials: {},
    world: createWorldCompetitionState()
  };
}

export function ensureCompetition(state) {
  state.competition ??= createCompetitionState();
  if (!RANKS.includes(state.competition.rank)) state.competition.rank = "F";
  state.competition.rankOrder = rankOrder(state.competition.rank);
  state.competition.circuitPoints ??= 0;
  state.competition.firstOfficialResolved ??= false;
  state.competition.firstOfficialResult ??= null;
  state.competition.activeMatch ??= null;
  state.competition.history ??= [];
  state.competition.trials ??= {};
  state.competition.world ??= createWorldCompetitionState();
  state.competition.world.edition ??= 1;
  state.competition.world.drawComplete ??= false;
  state.competition.world.fieldLocked ??= false;
  state.competition.world.field ??= [];
  state.competition.world.seedOrder ??= [];
  state.competition.world.groups ??= {};
  state.competition.world.playerGroup ??= null;
  state.competition.world.playerOpponents ??= [];
  state.competition.world.qualifications ??= {};
  state.competition.world.drawSeed ??= null;
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
    competition.firstOfficialResult = outcome;
    state.world.flags ??= {};
    state.world.flags.first_official_resolved = true;
    state.world.flags.first_official_result = outcome;
    state.world.flags.first_official_match_id = meta.matchId;
    state.world.flags.official_match_opportunity = false;
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


function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableOrder(items, seed) {
  return [...items]
    .map((item) => ({ item, score: hashString(seed + "|" + item.id) }))
    .sort((a, b) => a.score - b.score || a.item.id.localeCompare(b.item.id))
    .map(({ item }) => item);
}

function findNpcForWorldParticipant(state, participant) {
  return Object.values(state.npcs ?? {}).find((npc) =>
    npc &&
    (npc.id === participant.npcId ||
     npc.id === participant.id ||
     npc.name === participant.name)
  ) ?? null;
}

function worldQualificationState(state, participant) {
  const npc = findNpcForWorldParticipant(state, participant);
  if (typeof npc?.state?.worldQualified === "boolean") {
    return {
      qualified: npc.state.worldQualified,
      source: "npc_actual"
    };
  }
  if (participant.guaranteedQualified === true) {
    return {
      qualified: true,
      source: "macro_anchor_guarantee"
    };
  }
  return {
    qualified: null,
    source: "unresolved"
  };
}

function validateWorldParticipants(participants) {
  if (!Array.isArray(participants) || participants.length < 32) {
    throw new Error("WORLD_DRAW requires at least 32 canonical participants");
  }
  const ids = new Set();
  const names = new Set();
  for (const participant of participants) {
    if (!participant || typeof participant !== "object" || Array.isArray(participant)) {
      throw new Error("WORLD_DRAW participant must be an object");
    }
    requireId(participant.id, "world participant id");
    if (typeof participant.name !== "string" || participant.name.trim().length === 0) {
      throw new Error("WORLD_DRAW participant name is required");
    }
    if (ids.has(participant.id)) throw new Error("Duplicate WORLD_DRAW participant id: " + participant.id);
    if (names.has(participant.name)) throw new Error("Duplicate WORLD_DRAW participant name: " + participant.name);
    ids.add(participant.id);
    names.add(participant.name);
    if (participant.guaranteedQualified !== undefined &&
        typeof participant.guaranteedQualified !== "boolean") {
      throw new Error("guaranteedQualified must be boolean");
    }
  }
}

export function resolveWorldDraw(state, {
  eventId = "WORLD_DRAW",
  participants,
  groupCount = 8,
  groupSize = 4
}) {
  requireId(eventId, "world draw eventId");
  validateWorldParticipants(participants);
  if (!Number.isInteger(groupCount) || !Number.isInteger(groupSize) ||
      groupCount < 1 || groupSize < 2 || groupCount * groupSize !== 32) {
    throw new Error("WORLD_DRAW requires exactly 32 slots across groups");
  }

  const competition = ensureCompetition(state);
  const world = competition.world;
  if (world.drawComplete) return world;

  if (state.world?.flags?.world_qualified !== true) {
    throw new Error("WORLD_DRAW requires player world_qualified=true");
  }

  const player = participants.find((participant) => participant.name === state.player?.name);
  if (!player) {
    throw new Error("WORLD_DRAW canonical participant pool does not contain the player");
  }

  const qualificationSeed = [
    state.slot ?? "slot",
    state.createdAt ?? "career",
    "world-edition-" + world.edition,
    "qualification"
  ].join("|");
  const drawSeed = [
    state.slot ?? "slot",
    state.createdAt ?? "career",
    "world-edition-" + world.edition,
    eventId,
    "draw"
  ].join("|");

  const qualifications = {};
  qualifications[player.id] = {
    participantId: player.id,
    name: player.name,
    qualified: true,
    source: "player_actual"
  };

  const lockedIn = [];
  const unresolved = [];
  for (const participant of participants) {
    if (participant.id === player.id) continue;
    const status = worldQualificationState(state, participant);
    if (status.qualified === true) {
      lockedIn.push(participant);
      qualifications[participant.id] = {
        participantId: participant.id,
        name: participant.name,
        qualified: true,
        source: status.source
      };
    } else if (status.qualified === false) {
      qualifications[participant.id] = {
        participantId: participant.id,
        name: participant.name,
        qualified: false,
        source: status.source
      };
    } else {
      unresolved.push(participant);
    }
  }

  if (lockedIn.length > 31) {
    throw new Error("WORLD_DRAW has more than 31 qualified non-player participants");
  }

  const needed = 31 - lockedIn.length;
  const orderedUnknown = stableOrder(unresolved, qualificationSeed);
  if (orderedUnknown.length < needed) {
    throw new Error("WORLD_DRAW cannot fill a 32-player field from eligible state");
  }

  const simulatedIn = orderedUnknown.slice(0, needed);
  const simulatedOut = orderedUnknown.slice(needed);
  for (const participant of simulatedIn) {
    qualifications[participant.id] = {
      participantId: participant.id,
      name: participant.name,
      qualified: true,
      source: "offscreen_qualification_simulation"
    };
  }
  for (const participant of simulatedOut) {
    qualifications[participant.id] = {
      participantId: participant.id,
      name: participant.name,
      qualified: false,
      source: "offscreen_qualification_simulation"
    };
  }

  const field = [player, ...lockedIn, ...simulatedIn].map((participant) => ({
    id: participant.id,
    name: participant.name
  }));
  if (field.length !== 32) throw new Error("WORLD_DRAW field must contain exactly 32 participants");

  const seedOrder = stableOrder(field, drawSeed);
  const groupLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".slice(0, groupCount).split("");
  const groups = {};
  for (let index = 0; index < groupCount; index += 1) {
    groups[groupLabels[index]] = seedOrder.slice(index * groupSize, (index + 1) * groupSize);
  }

  const playerGroup = groupLabels.find((label) =>
    groups[label].some((participant) => participant.name === state.player.name)
  );
  if (!playerGroup) throw new Error("WORLD_DRAW failed to place the player");

  const playerOpponents = groups[playerGroup].filter((participant) => participant.name !== state.player.name);
  if (playerOpponents.length !== 3) throw new Error("WORLD_DRAW player group must contain three opponents");

  world.drawComplete = true;
  world.fieldLocked = true;
  world.field = structuredClone(field);
  world.seedOrder = structuredClone(seedOrder);
  world.groups = structuredClone(groups);
  world.playerGroup = playerGroup;
  world.playerOpponents = structuredClone(playerOpponents);
  world.qualifications = qualifications;
  world.drawSeed = drawSeed;

  state.world.flags ??= {};
  state.world.flags.world_draw_complete = true;
  state.world.flags.world_field_32_locked = true;
  state.world.flags.player_group = playerGroup;
  state.world.flags.world_group_opponent_1 = playerOpponents[0].name;
  state.world.flags.world_group_opponent_2 = playerOpponents[1].name;
  state.world.flags.world_group_opponent_3 = playerOpponents[2].name;

  return world;
}

export function applyCompetitionEffect(state, effect) {
  switch (effect.type) {
    case "competition_trial_available": return setTrialAvailable(state, effect);
    case "competition_trial_register": return registerTrial(state, effect);
    case "competition_world_draw": return resolveWorldDraw(state, effect);
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

  if (effect.type === "competition_world_draw") {
    if (effect.eventId !== undefined && (typeof effect.eventId !== "string" || !ID_RE.test(effect.eventId))) {
      push("INVALID_WORLD_DRAW_EVENT_ID", "eventId must be a stable identifier", at + ".eventId");
    }
    if (!Array.isArray(effect.participants) || effect.participants.length < 32) {
      push("INVALID_WORLD_DRAW_PARTICIPANTS", "competition_world_draw requires at least 32 participants", at + ".participants");
      return errors;
    }
    const ids = new Set();
    const names = new Set();
    effect.participants.forEach((participant, index) => {
      const path = at + ".participants[" + index + "]";
      if (!participant || typeof participant !== "object" || Array.isArray(participant)) {
        push("INVALID_WORLD_DRAW_PARTICIPANT", "participant must be an object", path);
        return;
      }
      if (typeof participant.id !== "string" || !ID_RE.test(participant.id)) {
        push("INVALID_WORLD_DRAW_PARTICIPANT_ID", "participant id must be a stable identifier", path + ".id");
      } else if (ids.has(participant.id)) {
        push("DUPLICATE_WORLD_DRAW_PARTICIPANT_ID", "participant ids must be unique", path + ".id");
      } else {
        ids.add(participant.id);
      }
      if (typeof participant.name !== "string" || participant.name.trim().length === 0) {
        push("INVALID_WORLD_DRAW_PARTICIPANT_NAME", "participant name is required", path + ".name");
      } else if (names.has(participant.name)) {
        push("DUPLICATE_WORLD_DRAW_PARTICIPANT_NAME", "participant names must be unique", path + ".name");
      } else {
        names.add(participant.name);
      }
      if (participant.guaranteedQualified !== undefined && typeof participant.guaranteedQualified !== "boolean") {
        push("INVALID_WORLD_DRAW_GUARANTEE", "guaranteedQualified must be boolean", path + ".guaranteedQualified");
      }
    });
    const groupCount = effect.groupCount ?? 8;
    const groupSize = effect.groupSize ?? 4;
    if (!Number.isInteger(groupCount) || !Number.isInteger(groupSize) || groupCount * groupSize !== 32) {
      push("INVALID_WORLD_DRAW_GROUP_SHAPE", "groupCount * groupSize must equal 32", at);
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
