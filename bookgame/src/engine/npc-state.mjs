import { isTrainerPath2024, trainerProgression2024 } from "../rules/trainer-2024.mjs";
import { trainerCoreFeaturesAtLevel, trainerStartingInventory } from "../rules/trainer-class-2024-canon.mjs";

function abilityModifier(score) { return Math.floor((Number(score ?? 10) - 10) / 2); }
function npcMaxHp(level, abilities) { const con = abilityModifier(abilities?.CON); return Math.max(1, 6 + con + Math.max(0, level - 1) * Math.max(1, 4 + con)); }
function npcRuntimeFields(level, abilities = {}, state = {}) {
  const maxHp = npcMaxHp(level, abilities);
  return {
    hp: structuredClone(state.hp ?? { current: maxHp, max: maxHp }),
    ac: Number(state.ac ?? 10),
    hitDice: structuredClone(state.hitDice ?? { die: "d6", current: level, max: level }),
    skills: structuredClone(state.skills ?? []),
    proficiencies: structuredClone(state.proficiencies ?? { skills: state.skills ?? [], expertise: [] }),
    savingThrows: structuredClone(state.savingThrows ?? ["CHA"]),
    equipment: structuredClone(state.equipment ?? []),
    trainerGear: structuredClone(state.trainerGear ?? []),
    inventory: structuredClone(state.inventory ?? trainerStartingInventory()),
    classResources: structuredClone(state.classResources ?? {}),
    classFeatures: structuredClone(state.classFeatures ?? trainerCoreFeaturesAtLevel(level)),
    featureUsage: structuredClone(state.featureUsage ?? {}),
    conditions: structuredClone(state.conditions ?? []),
    persistentEffects: structuredClone(state.persistentEffects ?? []),
    death: structuredClone(state.death ?? { state: "alive", deathSaveSuccesses: 0, deathSaveFailures: 0, stable: false }),
    movement: structuredClone(state.movement ?? { walking: 30, climbing: 0, swimming: 0, flying: 0, burrowing: 0 })
  };
}
import { ensureWorldClock } from "./time.mjs";

export const RELATIONSHIP_STATES = ["Hostile", "Distrustful", "Neutral", "Friendly", "Loyal"];
export const NPC_AVAILABILITY = new Set(["available", "busy", "away", "traveling"]);
export const FIVE_FRIEND_IDS = ["Luke", "Mattew", "Daniel", "Edward", "Fab"];
const ID_RE = /^[A-Za-z0-9_-]+$/;

export function createTrainerRulesState({
  trainerLevel = 1,
  specializations = [],
  trainerPath = null
} = {}) {
  if (!Number.isInteger(trainerLevel) || trainerLevel < 1 || trainerLevel > 20) {
    throw new RangeError("NPC Trainer level must be 1..20");
  }
  if (!Array.isArray(specializations)) {
    throw new TypeError("NPC Trainer specializations must be an array");
  }
  const progression = trainerProgression2024(trainerLevel);
  if (!progression.pathAvailable && trainerPath !== null) {
    throw new Error("Pokemon 5e Trainer Path cannot be assigned before level 2");
  }
  if (trainerPath !== null && !isTrainerPath2024(trainerPath)) {
    throw new Error("Unknown Pokemon 5e 2024 Trainer Path: " + trainerPath);
  }
  if (specializations.length > progression.specializationCount) {
    throw new Error("Too many specializations for Trainer level " + trainerLevel);
  }
  return {
    ruleset: "2024",
    trainerClass: "Trainer",
    trainerLevel,
    trainerPath,
    specializations: structuredClone(specializations),
    ...progression
  };
}

function requireId(value, label) {
  if (typeof value !== "string" || !ID_RE.test(value)) {
    throw new Error("Invalid " + label + ": " + String(value));
  }
}

function relationshipStateForScore(score) {
  if (score <= -60) return "Hostile";
  if (score <= -20) return "Distrustful";
  if (score < 20) return "Neutral";
  if (score < 60) return "Friendly";
  return "Loyal";
}

function ensureNpcTable(state) {
  state.npcs ??= {};
  return state.npcs;
}

export function createPersistentNpc({
  id,
  name,
  relationshipScore = 0,
  state = {}
}) {
  requireId(id, "npc id");
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("NPC name is required");
  }
  if (!Number.isInteger(relationshipScore) || relationshipScore < -100 || relationshipScore > 100) {
    throw new RangeError("relationshipScore must be an integer from -100 to 100");
  }
  const trainerLevel = Number.isInteger(state.trainerLevel) ? state.trainerLevel : 1;
  const trainer = {
    ...createTrainerRulesState({
      trainerLevel,
      specializations: state.specializations ?? [],
      trainerPath: state.trainerPath ?? null
    }),
    ...npcRuntimeFields(trainerLevel, state.abilities ?? {}, state)
  };

  return {
    id,
    name,
    trainer,
    abilities: structuredClone(state.abilities ?? {}),
    relationship: {
      score: relationshipScore,
      qualitative: relationshipStateForScore(relationshipScore)
    },
    schedule: null,
    state: structuredClone(state)
  };
}

export function registerNpc(state, args) {
  const npcs = ensureNpcTable(state);
  requireId(args.npcId, "npcId");
  if (npcs[args.npcId]) return npcs[args.npcId];
  npcs[args.npcId] = createPersistentNpc({
    id: args.npcId,
    name: args.name,
    relationshipScore: args.relationshipScore ?? 0,
    state: args.state ?? {}
  });
  return npcs[args.npcId];
}

function requireNpc(state, npcId) {
  requireId(npcId, "npcId");
  const npc = ensureNpcTable(state)[npcId];
  if (!npc) throw new Error("Unknown persistent NPC: " + npcId);
  return npc;
}

export function adjustNpcRelationship(state, { npcId, delta }) {
  const npc = requireNpc(state, npcId);
  if (!Number.isInteger(delta) || delta < -100 || delta > 100) {
    throw new RangeError("relationship delta must be an integer from -100 to 100");
  }
  const score = Math.max(-100, Math.min(100, npc.relationship.score + delta));
  npc.relationship.score = score;
  npc.relationship.qualitative = relationshipStateForScore(score);
  return npc.relationship;
}

export function setNpcState(state, { npcId, key, value }) {
  const npc = requireNpc(state, npcId);
  requireId(key, "NPC state key");
  if (value !== null && !["string", "number", "boolean"].includes(typeof value)) {
    throw new TypeError("NPC state values must be primitive JSON values");
  }
  npc.state[key] = value;
  return npc.state;
}

export function setNpcSchedule(state, {
  npcId,
  scheduleId,
  locationId,
  availability = "available",
  activity = null,
  startsAtMinutes = null,
  endsAtMinutes = null
}) {
  const npc = requireNpc(state, npcId);
  requireId(scheduleId, "scheduleId");
  if (typeof locationId !== "string" || locationId.length === 0) throw new Error("locationId is required");
  if (!NPC_AVAILABILITY.has(availability)) throw new Error("Invalid NPC availability: " + availability);
  for (const [label, value] of [["startsAtMinutes", startsAtMinutes], ["endsAtMinutes", endsAtMinutes]]) {
    if (value !== null && (!Number.isInteger(value) || value < 0)) {
      throw new RangeError(label + " must be null or a non-negative integer");
    }
  }
  if (startsAtMinutes !== null && endsAtMinutes !== null && endsAtMinutes <= startsAtMinutes) {
    throw new RangeError("endsAtMinutes must be greater than startsAtMinutes");
  }

  npc.schedule = {
    id: scheduleId,
    locationId,
    availability,
    activity,
    startsAtMinutes,
    endsAtMinutes,
    present: false
  };
  refreshNpcSchedule(state, npcId);
  return npc.schedule;
}

export function refreshNpcSchedule(state, npcId) {
  const npc = requireNpc(state, npcId);
  if (!npc.schedule) return null;

  const hasTimeWindow =
    npc.schedule.startsAtMinutes !== null ||
    npc.schedule.endsAtMinutes !== null;
  if (hasTimeWindow) ensureWorldClock(state.world);

  const now = state.world.elapsedMinutes;
  const started = npc.schedule.startsAtMinutes === null || now >= npc.schedule.startsAtMinutes;
  const notEnded = npc.schedule.endsAtMinutes === null || now < npc.schedule.endsAtMinutes;
  npc.schedule.present =
    started &&
    notEnded &&
    npc.schedule.availability === "available";
  return npc.schedule;
}

export function refreshNpcSchedules(state) {
  for (const npcId of Object.keys(ensureNpcTable(state))) {
    refreshNpcSchedule(state, npcId);
  }
  return state.npcs;
}

function worldParticipantForFriend(state, friendId) {
  return (state.competition?.world?.field ?? []).find((participant) => participant.name === friendId) ?? null;
}

function worldQualificationForFriend(state, friendId) {
  const participant = worldParticipantForFriend(state, friendId);
  if (!participant) return false;
  return state.competition?.world?.qualifications?.[participant.id]?.qualified === true;
}

function friendWorldContext(state, friendId, stage = "groups") {
  const world = state.competition?.world ?? {};
  if (stage === "final_four") {
    const knockout = world.knockout ?? {};
    if (knockout.playerFinalOpponent?.name === friendId) {
      return { priority: 0, context: "final_opponent", opponentIndex: null };
    }
    if ((knockout.finalists ?? []).some((participant) => participant.name === friendId)) {
      return { priority: 1, context: "world_finalist", opponentIndex: null };
    }
    if ((knockout.top4 ?? []).some((participant) => participant.name === friendId)) {
      return { priority: 2, context: "sf_eliminated", opponentIndex: null };
    }
    if ((world.top8 ?? []).some((participant) => participant.name === friendId)) {
      return { priority: 3, context: "qf_eliminated", opponentIndex: null };
    }
    if ((world.top16 ?? []).some((participant) => participant.name === friendId)) {
      return { priority: 4, context: "r16_eliminated", opponentIndex: null };
    }
    if (worldQualificationForFriend(state, friendId)) {
      return { priority: 5, context: "world_eliminated", opponentIndex: null };
    }
    return { priority: 6, context: "external_contact", opponentIndex: null };
  }

  if (stage === "knockout") {
    const knockout = world.knockout ?? {};
    const qfMatch = (knockout.qfBracket ?? []).find((match) =>
      (match.home?.name === state.player?.name && match.away?.name === friendId) ||
      (match.away?.name === state.player?.name && match.home?.name === friendId)
    );
    if (qfMatch) return { priority: 0, context: "qf_opponent", opponentIndex: null };
    if ((world.top8 ?? []).some((participant) => participant.name === friendId)) {
      return { priority: 1, context: "top8_other_match", opponentIndex: null };
    }
    if ((world.top16 ?? []).some((participant) => participant.name === friendId)) {
      return { priority: 2, context: "r16_eliminated", opponentIndex: null };
    }
    if (worldQualificationForFriend(state, friendId)) {
      return { priority: 3, context: "world_eliminated", opponentIndex: null };
    }
    return { priority: 4, context: "external_contact", opponentIndex: null };
  }

  const opponents = world.playerOpponents ?? [];
  const index = opponents.findIndex((participant) => participant.name === friendId);
  if (index === 2) return { priority: 0, context: "same_group_next_match", opponentIndex: 2 };
  if (index >= 0 && index <= 1) return { priority: 1, context: "same_group_match_resolved", opponentIndex: index };
  if (worldQualificationForFriend(state, friendId)) return { priority: 2, context: "qualified_other_group", opponentIndex: null };
  return { priority: 3, context: "external_contact", opponentIndex: null };
}

export function selectWorldFriendBeatCandidate(state, {
  previousFriendFlag = "friend_beat_08_friend_id",
  stage = "groups"
} = {}) {
  refreshNpcSchedules(state);
  const previous = state.world?.flags?.[previousFriendFlag] ?? null;
  const order = new Map(FIVE_FRIEND_IDS.map((id, index) => [id, index]));
  const candidates = FIVE_FRIEND_IDS
    .filter((id) => id !== state.player?.name && state.npcs?.[id])
    .map((id) => {
      const context = friendWorldContext(state, id, stage);
      const npc = state.npcs[id];
      const physical = Boolean(
        npc.schedule?.present &&
        npc.schedule?.locationId === state.world.locationId
      );
      return {
        id,
        ...context,
        physical,
        previous: id === previous,
        relationship: npc.relationship?.score ?? 0,
        order: order.get(id) ?? 99
      };
    })
    .sort((a, b) =>
      a.priority - b.priority ||
      Number(a.previous) - Number(b.previous) ||
      Number(b.physical) - Number(a.physical) ||
      b.relationship - a.relationship ||
      a.order - b.order
    );
  return candidates[0] ?? null;
}

export function applyWorldFriendBeatSelection(state, effect = {}) {
  const selected = selectWorldFriendBeatCandidate(state, effect);
  if (!selected) throw new Error("No eligible World FRIEND_BEAT candidate");

  const outputPrefix = effect.outputPrefix ?? "friend_beat_09";
  requireId(outputPrefix, "World FRIEND_BEAT outputPrefix");
  const prefixParts = outputPrefix.split("_");
  const stateSuffix = prefixParts[0] + prefixParts
    .slice(1)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  state.world.flags ??= {};
  state.world.flags[outputPrefix + "_available"] = true;
  state.world.flags[outputPrefix + "_friend_id"] = selected.id;
  state.world.flags[outputPrefix + "_contact_mode"] = selected.physical ? "physical" : "remote";
  state.world.flags[outputPrefix + "_context"] = selected.context;
  if (selected.opponentIndex !== null) {
    state.world.flags[outputPrefix + "_opponent_index"] = selected.opponentIndex;
  }

  const npc = state.npcs[selected.id];
  npc.state[stateSuffix + "Selected"] = true;
  npc.state[stateSuffix + "Context"] = selected.context;
  return selected;
}

export function applyNpcEffect(state, effect) {
  switch (effect.type) {
    case "npc_register": return registerNpc(state, effect);
    case "npc_relationship_adjust": return adjustNpcRelationship(state, effect);
    case "npc_state_set": return setNpcState(state, effect);
    case "npc_schedule_set": return setNpcSchedule(state, effect);
    case "friend_beat_select": return applyFriendBeatSelection(state, effect);
    case "friend_beat_world_select": return applyWorldFriendBeatSelection(state, effect);
    default: throw new Error("Unsupported NPC effect type: " + effect.type);
  }
}

export function getNpcPublicView(state, npcId) {
  const npc = requireNpc(state, npcId);
  refreshNpcSchedule(state, npcId);
  return {
    id: npc.id,
    name: npc.name,
    relationship: npc.relationship.qualitative,
    locationId: npc.schedule?.present ? npc.schedule.locationId : null,
    available: Boolean(npc.schedule?.present)
  };
}

export function selectFriendBeatCandidate(state, {
  candidateIds = FIVE_FRIEND_IDS,
  locationId = state.world.locationId,
  compatibleActivities = [],
  preferredRecentResults = []
} = {}) {
  refreshNpcSchedules(state);
  const canonicalOrder = new Map(FIVE_FRIEND_IDS.map((id, index) => [id, index]));
  const requested = new Set(candidateIds);
  const activitySet = new Set(compatibleActivities);
  const resultSet = new Set(preferredRecentResults);

  const candidates = FIVE_FRIEND_IDS
    .filter((npcId) => requested.has(npcId) && npcId !== state.player?.name)
    .map((npcId) => {
      const npc = state.npcs?.[npcId];
      return {
        npc,
        index: canonicalOrder.get(npcId),
        activityMatch: Boolean(npc && activitySet.size > 0 && activitySet.has(npc.schedule?.activity)),
        recentResultMatch: Boolean(npc && resultSet.size > 0 && resultSet.has(npc.state?.recentResult))
      };
    })
    .filter(({ npc }) =>
      npc &&
      npc.schedule?.present &&
      npc.schedule.locationId === locationId
    )
    .sort((a, b) =>
      Number(b.activityMatch) - Number(a.activityMatch) ||
      Number(b.recentResultMatch) - Number(a.recentResultMatch) ||
      b.npc.relationship.score - a.npc.relationship.score ||
      a.index - b.index
    );

  return candidates[0]?.npc.id ?? null;
}

export function applyFriendBeatSelection(state, {
  candidateIds = FIVE_FRIEND_IDS,
  locationId = state.world.locationId,
  contentType,
  compatibleActivities = [],
  preferredRecentResults = []
}) {
  requireId(contentType, "friend beat contentType");
  const selectedId = selectFriendBeatCandidate(state, {
    candidateIds,
    locationId,
    compatibleActivities,
    preferredRecentResults
  });
  if (!selectedId) {
    throw new Error("No eligible FRIEND_BEAT candidate at location: " + locationId);
  }

  state.world.flags.friend_beat_01_selected = true;
  state.world.flags.friend_beat_01_friend_id = selectedId;
  state.world.flags.friend_beat_01_type = contentType;
  state.npcs[selectedId].state.friendBeat01Selected = true;
  state.npcs[selectedId].state.friendBeat01Type = contentType;
  return selectedId;
}

export function validateNpcEffect(effect, at = "effect") {
  const errors = [];
  const push = (code, message, path = at) => errors.push({ code, message, at: path });
  if (!effect || typeof effect !== "object" || Array.isArray(effect)) {
    push("INVALID_NPC_EFFECT", "NPC effect must be an object");
    return errors;
  }
  if (!["npc_register", "npc_relationship_adjust", "npc_state_set", "npc_schedule_set", "friend_beat_select", "friend_beat_world_select"].includes(effect.type)) {
    push("INVALID_NPC_EFFECT", "Unsupported NPC effect type");
    return errors;
  }
  if (!["friend_beat_select", "friend_beat_world_select"].includes(effect.type) &&
      (typeof effect.npcId !== "string" || !ID_RE.test(effect.npcId))) {
    push("INVALID_NPC_ID", "npcId must be a stable identifier", at + ".npcId");
  }
  if (effect.type === "npc_register") {
    if (typeof effect.name !== "string" || effect.name.trim().length === 0) {
      push("INVALID_NPC_NAME", "npc_register requires name", at + ".name");
    }
    if (effect.relationshipScore !== undefined &&
        (!Number.isInteger(effect.relationshipScore) || effect.relationshipScore < -100 || effect.relationshipScore > 100)) {
      push("INVALID_RELATIONSHIP_SCORE", "relationshipScore must be an integer from -100 to 100", at + ".relationshipScore");
    }
  }
  if (effect.type === "npc_relationship_adjust" &&
      (!Number.isInteger(effect.delta) || effect.delta < -100 || effect.delta > 100)) {
    push("INVALID_RELATIONSHIP_DELTA", "delta must be an integer from -100 to 100", at + ".delta");
  }
  if (effect.type === "npc_state_set") {
    if (typeof effect.key !== "string" || !ID_RE.test(effect.key)) {
      push("INVALID_NPC_STATE_KEY", "NPC state key must be an identifier", at + ".key");
    }
    if (effect.value !== null && !["string", "number", "boolean"].includes(typeof effect.value)) {
      push("INVALID_NPC_STATE_VALUE", "NPC state value must be a primitive JSON value", at + ".value");
    }
  }
  if (effect.type === "npc_schedule_set") {
    if (typeof effect.scheduleId !== "string" || !ID_RE.test(effect.scheduleId)) {
      push("INVALID_NPC_SCHEDULE_ID", "scheduleId must be an identifier", at + ".scheduleId");
    }
    if (typeof effect.locationId !== "string" || effect.locationId.length === 0) {
      push("INVALID_NPC_LOCATION", "npc_schedule_set requires locationId", at + ".locationId");
    }
    if (effect.availability !== undefined && !NPC_AVAILABILITY.has(effect.availability)) {
      push("INVALID_NPC_AVAILABILITY", "Invalid NPC availability", at + ".availability");
    }
    for (const field of ["startsAtMinutes", "endsAtMinutes"]) {
      if (effect[field] !== undefined && effect[field] !== null &&
          (!Number.isInteger(effect[field]) || effect[field] < 0)) {
        push("INVALID_NPC_SCHEDULE_TIME", field + " must be null or a non-negative integer", at + "." + field);
      }
    }
    if (Number.isInteger(effect.startsAtMinutes) && Number.isInteger(effect.endsAtMinutes) &&
        effect.endsAtMinutes <= effect.startsAtMinutes) {
      push("INVALID_NPC_SCHEDULE_WINDOW", "endsAtMinutes must be greater than startsAtMinutes", at);
    }
  }
  if (effect.type === "friend_beat_world_select") {
    if (effect.previousFriendFlag !== undefined &&
        (typeof effect.previousFriendFlag !== "string" || !ID_RE.test(effect.previousFriendFlag))) {
      push("INVALID_FRIEND_BEAT_PREVIOUS_FLAG", "previousFriendFlag must be a stable identifier", at + ".previousFriendFlag");
    }
    if (effect.outputPrefix !== undefined &&
        (typeof effect.outputPrefix !== "string" || !ID_RE.test(effect.outputPrefix))) {
      push("INVALID_FRIEND_BEAT_OUTPUT_PREFIX", "outputPrefix must be a stable identifier", at + ".outputPrefix");
    }
    if (effect.stage !== undefined && !["groups", "knockout", "final_four"].includes(effect.stage)) {
      push("INVALID_FRIEND_BEAT_STAGE", "stage must be groups, knockout or final_four", at + ".stage");
    }
    return errors;
  }
  if (effect.type === "friend_beat_select") {
    if (typeof effect.contentType !== "string" || !ID_RE.test(effect.contentType)) {
      push("INVALID_FRIEND_BEAT_TYPE", "friend_beat_select requires a stable contentType", at + ".contentType");
    }
    if (effect.locationId !== undefined && (typeof effect.locationId !== "string" || effect.locationId.length === 0)) {
      push("INVALID_FRIEND_BEAT_LOCATION", "friend_beat_select locationId must be a non-empty string", at + ".locationId");
    }
    for (const field of ["candidateIds", "compatibleActivities", "preferredRecentResults"]) {
      if (effect[field] !== undefined &&
          (!Array.isArray(effect[field]) || effect[field].length === 0 ||
           effect[field].some((value) => typeof value !== "string" || !ID_RE.test(value)))) {
        push("INVALID_FRIEND_BEAT_SELECTOR", field + " must be a non-empty list of stable identifiers", at + "." + field);
      }
    }
  }
  return errors;
}
