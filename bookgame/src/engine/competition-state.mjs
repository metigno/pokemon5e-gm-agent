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

export function createWorldGroupStageState() {
  return {
    opened: false,
    playerGroup: null,
    participants: [],
    playerMatches: [],
    offscreenMatches: [],
    opponentRosters: {},
    standings: [],
    playerPosition: null,
    playerPoints: 0,
    kaiaInPlayerGroup: false,
    allGroupMatches: {},
    allGroupStandings: {},
    finalPosition: null,
    advanced: null,
    resolved: false
  };
}

export function createWorldKnockoutState() {
  return {
    opened: false,
    r16Bracket: [],
    playerR16MatchId: null,
    playerR16Opponent: null,
    silasInTop16: false,
    silasIsPlayerOpponent: false,
    r16Results: [],
    r16Resolved: false,
    top8Locked: false,
    top8: [],
    qfBracket: [],
    playerAdvancedToQf: null,
    playerQfMatchId: null,
    playerQfOpponent: null,
    silasAdvancedToQf: null,
    qfResults: [],
    qfResolved: false,
    top4Locked: false,
    top4: [],
    sfBracket: [],
    playerAdvancedToSf: null,
    playerSfMatchId: null,
    playerSfOpponent: null,
    sfOpened: false,
    reiInTop4: false,
    reiIsPlayerOpponent: false,
    sfResults: [],
    sfResolved: false,
    finalistsLocked: false,
    finalists: [],
    finalMatch: null,
    playerAdvancedToFinal: null,
    playerFinalMatchId: null,
    playerFinalOpponent: null,
    finalResolved: false,
    playerWonFinal: null,
    worldChampion: null,
    worldRunnerUp: null,
    opponentRosters: {}
  };
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
    drawSeed: null,
    top16Locked: false,
    top16: [],
    top8Locked: false,
    top8: [],
    top4Locked: false,
    top4: [],
    finalResolved: false,
    currentWorldChampion: null,
    currentWorldRunnerUp: null,
    groupStage: createWorldGroupStageState(),
    knockout: createWorldKnockoutState()
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
  state.competition.world.top16Locked ??= false;
  state.competition.world.top16 ??= [];
  state.competition.world.top8Locked ??= false;
  state.competition.world.top8 ??= [];
  state.competition.world.top4Locked ??= false;
  state.competition.world.top4 ??= [];
  state.competition.world.finalResolved ??= false;
  state.competition.world.currentWorldChampion ??= null;
  state.competition.world.currentWorldRunnerUp ??= null;
  state.competition.world.groupStage ??= createWorldGroupStageState();
  state.competition.world.groupStage.opened ??= false;
  state.competition.world.groupStage.playerGroup ??= null;
  state.competition.world.groupStage.participants ??= [];
  state.competition.world.groupStage.playerMatches ??= [];
  state.competition.world.groupStage.offscreenMatches ??= [];
  state.competition.world.groupStage.opponentRosters ??= {};
  state.competition.world.groupStage.standings ??= [];
  state.competition.world.groupStage.playerPosition ??= null;
  state.competition.world.groupStage.playerPoints ??= 0;
  state.competition.world.groupStage.kaiaInPlayerGroup ??= false;
  state.competition.world.groupStage.allGroupMatches ??= {};
  state.competition.world.groupStage.allGroupStandings ??= {};
  state.competition.world.groupStage.finalPosition ??= null;
  state.competition.world.groupStage.advanced ??= null;
  state.competition.world.groupStage.resolved ??= false;
  state.competition.world.knockout ??= createWorldKnockoutState();
  const knockout = state.competition.world.knockout;
  knockout.opened ??= false;
  knockout.r16Bracket ??= [];
  knockout.playerR16MatchId ??= null;
  knockout.playerR16Opponent ??= null;
  knockout.silasInTop16 ??= false;
  knockout.silasIsPlayerOpponent ??= false;
  knockout.r16Results ??= [];
  knockout.r16Resolved ??= false;
  knockout.top8Locked ??= false;
  knockout.top8 ??= [];
  knockout.qfBracket ??= [];
  knockout.playerAdvancedToQf ??= null;
  knockout.playerQfMatchId ??= null;
  knockout.playerQfOpponent ??= null;
  knockout.silasAdvancedToQf ??= null;
  knockout.qfResults ??= [];
  knockout.qfResolved ??= false;
  knockout.top4Locked ??= false;
  knockout.top4 ??= [];
  knockout.sfBracket ??= [];
  knockout.playerAdvancedToSf ??= null;
  knockout.playerSfMatchId ??= null;
  knockout.playerSfOpponent ??= null;
  knockout.sfOpened ??= false;
  knockout.reiInTop4 ??= false;
  knockout.reiIsPlayerOpponent ??= false;
  knockout.sfResults ??= [];
  knockout.sfResolved ??= false;
  knockout.finalistsLocked ??= false;
  knockout.finalists ??= [];
  knockout.finalMatch ??= null;
  knockout.playerAdvancedToFinal ??= null;
  knockout.playerFinalMatchId ??= null;
  knockout.playerFinalOpponent ??= null;
  knockout.finalResolved ??= false;
  knockout.playerWonFinal ??= null;
  knockout.worldChampion ??= null;
  knockout.worldRunnerUp ??= null;
  knockout.opponentRosters ??= {};
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
  if (meta.worldOpponentIndex !== undefined &&
      (!Number.isInteger(meta.worldOpponentIndex) || meta.worldOpponentIndex < 0 || meta.worldOpponentIndex > 2)) {
    throw new RangeError("worldOpponentIndex must be an integer from 0 to 2");
  }
  if (meta.worldMatchday !== undefined &&
      (!Number.isInteger(meta.worldMatchday) || meta.worldMatchday < 1 || meta.worldMatchday > 3)) {
    throw new RangeError("worldMatchday must be an integer from 1 to 3");
  }
  if (meta.worldKnockoutRound !== undefined && !["R16", "QF", "SF", "FINAL"].includes(meta.worldKnockoutRound)) {
    throw new Error("worldKnockoutRound must be R16, QF, SF or FINAL");
  }
  if (meta.worldKnockoutRound !== undefined && meta.type !== "official_match") {
    throw new Error("World knockout matches must be official_match");
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

export function resolveCompetitionMatch(state, meta, outcome, battle = null) {
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

  if (Number.isInteger(meta.worldOpponentIndex)) {
    recordWorldGroupStageOutcome(state, meta, outcome, record.resolvedAtMinutes, battle);
  }
  if (meta.worldKnockoutRound !== undefined) {
    recordWorldKnockoutOutcome(state, meta, outcome, record.resolvedAtMinutes, battle);
  }

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


const WORLD_GROUP_RUNTIME_POOL = [
  { id: "growlithe_hisui", species: "Growlithe", form: "Hisuian" },
  { id: "eevee", species: "Eevee" },
  { id: "gastly", species: "Gastly" },
  { id: "totodile", species: "Totodile" },
  { id: "koffing", species: "Koffing" },
  { id: "houndour", species: "Houndour" },
  { id: "wooloo", species: "Wooloo" },
  { id: "shinx", species: "Shinx" },
  { id: "tandemaus", species: "Tandemaus" }
];

const WORLD_GROUP_SIGNATURE_PROXY = {
  Luke: { id: "growlithe_hisui", species: "Growlithe", form: "Hisuian" },
  Mattew: { id: "shinx", species: "Shinx" },
  Daniel: { id: "gastly", species: "Gastly" },
  Edward: { id: "totodile", species: "Totodile" },
  Fab: { id: "koffing", species: "Koffing" },
  "Kaia Solari": { id: "houndour", species: "Houndour" },
  "Astrid Vahl": { id: "tandemaus", species: "Tandemaus" },
  Red: { id: "growlithe_hisui", species: "Growlithe", form: "Hisuian" },
  Cynthia: { id: "shinx", species: "Shinx" },
  "Steven Stone": { id: "koffing", species: "Koffing" },
  N: { id: "eevee", species: "Eevee" },
  Lance: { id: "totodile", species: "Totodile" }
};

function worldGroupStageOrThrow(state) {
  const competition = ensureCompetition(state);
  const world = competition.world;
  if (!world.drawComplete || !world.fieldLocked || world.playerOpponents.length !== 3) {
    throw new Error("WORLD_GROUPS requires the locked M8 World draw");
  }
  return { competition, world, groupStage: world.groupStage };
}

function participantSeedIndex(world, participantId) {
  const index = world.seedOrder.findIndex((participant) => participant.id === participantId);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function regulatedWorldRoster(state, participant, regulation = "WORLD_GROUPS_L20") {
  const { world, groupStage } = worldGroupStageOrThrow(state);
  const knockoutCache = regulation === "WORLD_KNOCKOUT_L20";
  const cache = knockoutCache ? world.knockout.opponentRosters : groupStage.opponentRosters;
  if (cache[participant.id]) {
    return structuredClone(cache[participant.id]);
  }

  const signature = WORLD_GROUP_SIGNATURE_PROXY[participant.name] ?? null;
  const seedPrefix = knockoutCache ? "world-knockout" : "world-groups";
  const seed = seedPrefix + "|" + String(participant.id) + "|" + String(state.competition.world.edition);
  let ordered = stableOrder(WORLD_GROUP_RUNTIME_POOL, seed);
  if (signature) {
    ordered = [
      signature,
      ...ordered.filter((entry) =>
        entry.species !== signature.species ||
        String(entry.form ?? "") !== String(signature.form ?? "")
      )
    ];
  }

  const roster = ordered.slice(0, 6).map((entry, index) => ({
    ...entry,
    level: 20,
    trainerId: participant.id,
    rosterIndex: index,
    regulation,
    source: "persistent_regulated_world_roster"
  }));
  cache[participant.id] = structuredClone(roster);
  return roster;
}

function recalculateWorldGroupStandings(state) {
  const { world, groupStage } = worldGroupStageOrThrow(state);
  const base = Object.fromEntries(groupStage.participants.map((participant) => [
    participant.id,
    {
      participantId: participant.id,
      name: participant.name,
      played: 0,
      wins: 0,
      losses: 0,
      points: 0,
      seedIndex: participantSeedIndex(world, participant.id)
    }
  ]));

  const records = [
    ...groupStage.playerMatches.filter((match) => match.outcome),
    ...groupStage.offscreenMatches.filter((match) => match.outcome)
  ];
  for (const match of records) {
    const winnerId = match.outcome === "win"
      ? match.homeId
      : match.awayId;
    const loserId = match.outcome === "win"
      ? match.awayId
      : match.homeId;
    if (!base[winnerId] || !base[loserId]) continue;
    base[winnerId].played += 1;
    base[winnerId].wins += 1;
    base[winnerId].points += 3;
    base[loserId].played += 1;
    base[loserId].losses += 1;
  }

  groupStage.standings = Object.values(base).sort((a, b) =>
    b.points - a.points ||
    b.wins - a.wins ||
    a.seedIndex - b.seedIndex ||
    a.name.localeCompare(b.name)
  );
  const playerEntry = groupStage.standings.find((entry) => entry.name === state.player?.name);
  groupStage.playerPosition = playerEntry
    ? groupStage.standings.findIndex((entry) => entry.participantId === playerEntry.participantId) + 1
    : null;
  groupStage.playerPoints = playerEntry?.points ?? 0;

  state.world.flags ??= {};
  state.world.flags.world_group_player_points = groupStage.playerPoints;
  state.world.flags.world_group_player_position = groupStage.playerPosition;
  return groupStage.standings;
}

export function openWorldGroupStage(state, { eventId = "WORLD_GROUPS" } = {}) {
  requireId(eventId, "world groups eventId");
  const { world, groupStage } = worldGroupStageOrThrow(state);
  if (groupStage.opened) return groupStage;

  const group = world.groups[world.playerGroup];
  if (!Array.isArray(group) || group.length !== 4) {
    throw new Error("WORLD_GROUPS requires a four-participant player group");
  }
  const playerParticipant = group.find((participant) => participant.name === state.player?.name);
  if (!playerParticipant) throw new Error("WORLD_GROUPS player is missing from the locked group");

  const opponentIds = new Set(world.playerOpponents.map((participant) => participant.id));
  if (opponentIds.size !== 3) throw new Error("WORLD_GROUPS requires three distinct player opponents");

  groupStage.opened = true;
  groupStage.playerGroup = world.playerGroup;
  groupStage.participants = structuredClone(group);
  groupStage.playerMatches = world.playerOpponents.map((opponent, index) => ({
    matchday: index + 1,
    matchId: "WORLD_GROUP_MD" + String(index + 1),
    homeId: playerParticipant.id,
    homeName: playerParticipant.name,
    awayId: opponent.id,
    awayName: opponent.name,
    opponentId: opponent.id,
    opponentName: opponent.name,
    outcome: null,
    resolvedAtMinutes: null
  }));
  groupStage.offscreenMatches = [];
  groupStage.kaiaInPlayerGroup = group.some((participant) => participant.name === "Kaia Solari");
  recalculateWorldGroupStandings(state);

  state.world.flags ??= {};
  state.world.flags.world_group_stage_open = true;
  state.world.flags.world_group_stage_event_id = eventId;
  state.world.flags.world_group_kaia_in_group = groupStage.kaiaInPlayerGroup;
  return groupStage;
}

export function prepareWorldGroupMatch(state, meta) {
  validateMetaRuntime(meta);
  if (!Number.isInteger(meta.worldOpponentIndex) || meta.worldOpponentIndex < 0 || meta.worldOpponentIndex > 2) {
    throw new Error("World group match requires worldOpponentIndex 0..2");
  }
  const { world, groupStage } = worldGroupStageOrThrow(state);
  if (!groupStage.opened) throw new Error("WORLD_GROUPS has not been opened");

  const index = meta.worldOpponentIndex;
  const match = groupStage.playerMatches[index];
  const participant = world.playerOpponents[index];
  if (!match || !participant || match.opponentId !== participant.id) {
    throw new Error("WORLD_GROUPS opponent schedule does not match the locked draw");
  }
  if (match.outcome) {
    throw new Error("WORLD_GROUPS matchday " + String(index + 1) + " is already resolved");
  }
  if (meta.worldMatchday !== undefined && meta.worldMatchday !== index + 1) {
    throw new Error("WORLD_GROUPS worldMatchday does not match worldOpponentIndex");
  }

  const roster = regulatedWorldRoster(state, participant);
  const resolvedMeta = {
    ...meta,
    matchId: match.matchId,
    opponentTrainerId: participant.id,
    worldMatchday: index + 1
  };
  return {
    participant: structuredClone(participant),
    roster: structuredClone(roster),
    meta: resolvedMeta
  };
}

function persistWorldGroupOpponentRoster(groupStage, opponentId, battle) {
  if (!battle || !opponentId) return;
  const combatants = [battle.opponent, ...(battle.opponentBench ?? [])].filter(Boolean);
  if (combatants.length === 0) return;
  groupStage.opponentRosters[opponentId] = combatants.map((combatant, index) => ({
    speciesId: combatant.speciesId,
    name: combatant.name,
    level: combatant.level,
    hp: structuredClone(combatant.hp),
    statuses: structuredClone(combatant.statuses),
    abilityId: combatant.abilityId,
    moveIds: structuredClone(combatant.moveIds),
    pp: structuredClone(combatant.pp),
    trainerId: opponentId,
    rosterIndex: index,
    regulation: "WORLD_GROUPS_L20",
    source: "persistent_regulated_world_roster"
  }));
}

function resolveOffscreenGroupMatch(state, matchday) {
  const { world, groupStage } = worldGroupStageOrThrow(state);
  const existing = groupStage.offscreenMatches.find((match) => match.matchday === matchday);
  if (existing) return existing;

  const playerMatch = groupStage.playerMatches[matchday - 1];
  const others = world.playerOpponents.filter((participant) => participant.id !== playerMatch.opponentId);
  if (others.length !== 2) throw new Error("WORLD_GROUPS off-screen pairing requires two remaining opponents");

  const seed = [
    world.drawSeed ?? "world-draw",
    "groups",
    String(matchday),
    others[0].id,
    others[1].id
  ].join("|");
  const firstWins = (hashString(seed) & 1) === 0;
  const record = {
    matchday,
    matchId: "WORLD_GROUP_OFFSCREEN_MD" + String(matchday),
    homeId: others[0].id,
    homeName: others[0].name,
    awayId: others[1].id,
    awayName: others[1].name,
    outcome: firstWins ? "win" : "lose",
    source: "deterministic_offscreen_world_resolution"
  };
  groupStage.offscreenMatches.push(record);
  return record;
}

function recordWorldGroupStageOutcome(state, meta, outcome, resolvedAtMinutes, battle = null) {
  const { groupStage } = worldGroupStageOrThrow(state);
  if (!groupStage.opened) throw new Error("WORLD_GROUPS has not been opened");
  const index = meta.worldOpponentIndex;
  const match = groupStage.playerMatches[index];
  if (!match) throw new Error("Missing WORLD_GROUPS player match for index " + String(index));
  if (match.outcome) throw new Error("WORLD_GROUPS matchday already has a result");

  match.outcome = outcome;
  match.resolvedAtMinutes = resolvedAtMinutes;
  persistWorldGroupOpponentRoster(groupStage, match.opponentId, battle);
  resolveOffscreenGroupMatch(state, index + 1);
  recalculateWorldGroupStandings(state);

  state.world.flags ??= {};
  state.world.flags["world_group_md" + String(index + 1) + "_resolved"] = true;
  state.world.flags["world_group_md" + String(index + 1) + "_result"] = outcome;
  return match;
}


function winnerIdForMatch(match) {
  return match.outcome === "win" ? match.homeId : match.awayId;
}

function buildGroupStandings(world, participants, matches) {
  const table = Object.fromEntries(participants.map((participant) => [
    participant.id,
    {
      participantId: participant.id,
      name: participant.name,
      played: 0,
      wins: 0,
      losses: 0,
      points: 0,
      headToHeadPoints: 0,
      seedIndex: participantSeedIndex(world, participant.id)
    }
  ]));

  for (const match of matches) {
    if (!["win", "lose"].includes(match.outcome)) continue;
    const winnerId = winnerIdForMatch(match);
    const loserId = winnerId === match.homeId ? match.awayId : match.homeId;
    if (!table[winnerId] || !table[loserId]) continue;
    table[winnerId].played += 1;
    table[winnerId].wins += 1;
    table[winnerId].points += 3;
    table[loserId].played += 1;
    table[loserId].losses += 1;
  }

  const byPoints = new Map();
  for (const row of Object.values(table)) {
    const bucket = byPoints.get(row.points) ?? [];
    bucket.push(row.participantId);
    byPoints.set(row.points, bucket);
  }
  for (const tiedIds of byPoints.values()) {
    if (tiedIds.length < 2) continue;
    const tied = new Set(tiedIds);
    for (const match of matches) {
      if (!["win", "lose"].includes(match.outcome)) continue;
      if (!tied.has(match.homeId) || !tied.has(match.awayId)) continue;
      const winnerId = winnerIdForMatch(match);
      table[winnerId].headToHeadPoints += 3;
    }
  }

  return Object.values(table).sort((a, b) =>
    b.points - a.points ||
    b.headToHeadPoints - a.headToHeadPoints ||
    a.seedIndex - b.seedIndex ||
    a.name.localeCompare(b.name)
  );
}

function simulateCompleteGroup(state, groupLabel, participants) {
  const { world } = worldGroupStageOrThrow(state);
  const matches = [];
  for (let i = 0; i < participants.length; i += 1) {
    for (let j = i + 1; j < participants.length; j += 1) {
      const home = participants[i];
      const away = participants[j];
      const seed = [
        world.drawSeed ?? "world-draw",
        "group-resolution",
        groupLabel,
        home.id,
        away.id
      ].join("|");
      const homeWins = (hashString(seed) & 1) === 0;
      matches.push({
        group: groupLabel,
        matchId: "WORLD_GROUP_" + groupLabel + "_" + String(i + 1) + "_" + String(j + 1),
        homeId: home.id,
        homeName: home.name,
        awayId: away.id,
        awayName: away.name,
        outcome: homeWins ? "win" : "lose",
        source: "deterministic_offscreen_world_resolution"
      });
    }
  }
  return matches;
}

export function resolveWorldGroupStage(state, { eventId = "WORLD_GROUPS_RESOLVE" } = {}) {
  requireId(eventId, "world groups resolution eventId");
  const { world, groupStage } = worldGroupStageOrThrow(state);
  if (groupStage.resolved) return groupStage;

  if (groupStage.playerMatches.length !== 3 ||
      groupStage.playerMatches.some((match) => !["win", "lose"].includes(match.outcome))) {
    throw new Error("WORLD_GROUPS resolution requires all three player matches");
  }
  if (groupStage.offscreenMatches.length !== 3 ||
      groupStage.offscreenMatches.some((match) => !["win", "lose"].includes(match.outcome))) {
    throw new Error("WORLD_GROUPS resolution requires all three player-group off-screen matches");
  }

  const allMatches = {};
  const allStandings = {};
  const top16 = [];
  for (const [groupLabel, participants] of Object.entries(world.groups)) {
    if (!Array.isArray(participants) || participants.length !== 4) {
      throw new Error("WORLD_GROUPS resolution requires four participants in group " + groupLabel);
    }
    let matches;
    if (groupLabel === world.playerGroup) {
      matches = [
        ...structuredClone(groupStage.playerMatches),
        ...structuredClone(groupStage.offscreenMatches)
      ];
    } else {
      matches = simulateCompleteGroup(state, groupLabel, participants);
    }
    if (matches.length !== 6) {
      throw new Error("WORLD_GROUPS group " + groupLabel + " must resolve exactly six matches");
    }
    const standings = buildGroupStandings(world, participants, matches);
    allMatches[groupLabel] = matches;
    allStandings[groupLabel] = standings;
    for (let index = 0; index < 2; index += 1) {
      const row = standings[index];
      top16.push({
        participantId: row.participantId,
        name: row.name,
        group: groupLabel,
        groupPosition: index + 1,
        points: row.points
      });
    }
  }

  if (top16.length !== 16) throw new Error("WORLD_GROUPS must lock exactly 16 advancing participants");

  groupStage.allGroupMatches = allMatches;
  groupStage.allGroupStandings = allStandings;
  groupStage.standings = structuredClone(allStandings[world.playerGroup]);
  const playerIndex = groupStage.standings.findIndex((row) => row.name === state.player?.name);
  if (playerIndex < 0) throw new Error("WORLD_GROUPS final standings lost the player");
  groupStage.finalPosition = playerIndex + 1;
  groupStage.playerPosition = groupStage.finalPosition;
  groupStage.playerPoints = groupStage.standings[playerIndex].points;
  groupStage.advanced = groupStage.finalPosition <= 2;
  groupStage.resolved = true;

  world.top16Locked = true;
  world.top16 = top16;

  state.world.flags ??= {};
  state.world.flags.world_group_final_position = groupStage.finalPosition;
  state.world.flags.world_group_advanced = groupStage.advanced;
  state.world.flags.world_eliminated = !groupStage.advanced;
  state.world.flags.world_top16_locked = true;
  state.world.flags.world_group_stage_resolved = true;
  return groupStage;
}


function participantFromTop16Row(row) {
  return {
    id: row.participantId,
    name: row.name,
    group: row.group,
    groupPosition: row.groupPosition
  };
}

function worldKnockoutOrThrow(state) {
  const competition = ensureCompetition(state);
  const world = competition.world;
  const knockout = world.knockout;
  if (!world.top16Locked || !Array.isArray(world.top16) || world.top16.length !== 16) {
    throw new Error("WORLD_R16 requires the locked Top16 from WORLD_GROUPS");
  }
  if (!world.groupStage?.resolved) {
    throw new Error("WORLD_R16 requires resolved World groups");
  }
  return { competition, world, knockout };
}

function top16Row(world, group, position) {
  return world.top16.find((row) => row.group === group && row.groupPosition === position) ?? null;
}

function buildR16Bracket(world) {
  const labels = Object.keys(world.groups ?? {}).sort();
  if (labels.length !== 8) throw new Error("WORLD_R16 requires exactly eight World groups");
  const bracket = [];
  let matchNumber = 1;
  for (let index = 0; index < labels.length; index += 2) {
    const left = labels[index];
    const right = labels[index + 1];
    const leftWinner = top16Row(world, left, 1);
    const leftRunner = top16Row(world, left, 2);
    const rightWinner = top16Row(world, right, 1);
    const rightRunner = top16Row(world, right, 2);
    if (!leftWinner || !leftRunner || !rightWinner || !rightRunner) {
      throw new Error("WORLD_R16 Top16 is missing a required group position");
    }
    const pairs = [[leftWinner, rightRunner], [rightWinner, leftRunner]];
    for (const [homeRow, awayRow] of pairs) {
      bracket.push({
        round: "R16",
        matchId: "WORLD_R16_" + String(matchNumber++),
        home: participantFromTop16Row(homeRow),
        away: participantFromTop16Row(awayRow),
        outcome: null,
        playerOutcome: null,
        winnerId: null,
        loserId: null,
        resolvedAtMinutes: null,
        source: null
      });
    }
  }
  return bracket;
}

export function openWorldR16Bracket(state, { eventId = "WORLD_R16" } = {}) {
  requireId(eventId, "world r16 eventId");
  const { world, knockout } = worldKnockoutOrThrow(state);
  if (knockout.opened) return knockout;
  if (world.groupStage.advanced !== true) throw new Error("WORLD_R16 requires player advancement from groups");

  const bracket = buildR16Bracket(world);
  const playerMatch = bracket.find((match) =>
    match.home.name === state.player?.name || match.away.name === state.player?.name
  );
  if (!playerMatch) throw new Error("WORLD_R16 bracket does not contain the player");
  const playerIsHome = playerMatch.home.name === state.player?.name;
  const opponent = playerIsHome ? playerMatch.away : playerMatch.home;

  knockout.opened = true;
  knockout.r16Bracket = bracket;
  knockout.playerR16MatchId = playerMatch.matchId;
  knockout.playerR16Opponent = structuredClone(opponent);
  knockout.silasInTop16 = world.top16.some((row) => row.name === "Silas Crowe");
  knockout.silasIsPlayerOpponent = opponent.name === "Silas Crowe";

  state.world.flags ??= {};
  state.world.flags.world_r16_bracket_locked = true;
  state.world.flags.world_r16_event_id = eventId;
  state.world.flags.world_r16_opponent_id = opponent.id;
  state.world.flags.world_r16_opponent = opponent.name;
  state.world.flags.world_r16_silas_in_top16 = knockout.silasInTop16;
  state.world.flags.world_r16_silas_is_player_opponent = knockout.silasIsPlayerOpponent;
  return knockout;
}

function participantForKnockoutMatch(match, playerName) {
  if (match.home.name === playerName) return match.away;
  if (match.away.name === playerName) return match.home;
  return null;
}

export function prepareWorldKnockoutMatch(state, meta) {
  validateMetaRuntime(meta);
  const { knockout } = worldKnockoutOrThrow(state);
  if (!knockout.opened) throw new Error("World knockout bracket has not been opened");

  let bracket;
  let playerMatchId;
  if (meta.worldKnockoutRound === "R16") {
    bracket = knockout.r16Bracket;
    playerMatchId = knockout.playerR16MatchId;
  } else if (meta.worldKnockoutRound === "QF") {
    if (!knockout.r16Resolved || !knockout.top8Locked || knockout.playerAdvancedToQf !== true) {
      throw new Error("WORLD_QF requires a resolved R16 and player Top8 advancement");
    }
    bracket = knockout.qfBracket;
    playerMatchId = knockout.playerQfMatchId;
  } else if (meta.worldKnockoutRound === "SF") {
    if (!knockout.qfResolved || !knockout.top4Locked || knockout.playerAdvancedToSf !== true || knockout.sfOpened !== true) {
      throw new Error("WORLD_SF requires a resolved QF, locked Top4 and active player semifinal");
    }
    bracket = knockout.sfBracket;
    playerMatchId = knockout.playerSfMatchId;
  } else if (meta.worldKnockoutRound === "FINAL") {
    if (!knockout.sfResolved || !knockout.finalistsLocked || knockout.playerAdvancedToFinal !== true || !knockout.finalMatch) {
      throw new Error("WORLD_FINAL requires resolved semifinals and player finalist state");
    }
    bracket = [knockout.finalMatch];
    playerMatchId = knockout.playerFinalMatchId;
  } else {
    throw new Error("Unsupported World knockout handoff round: " + String(meta.worldKnockoutRound));
  }

  const match = bracket.find((entry) => entry.matchId === playerMatchId);
  if (!match) throw new Error("World knockout player match is missing for " + meta.worldKnockoutRound);
  if (match.outcome) throw new Error("World knockout player match is already resolved");
  const opponent = participantForKnockoutMatch(match, state.player?.name);
  if (!opponent) throw new Error("World knockout player opponent cannot be resolved");
  const roster = regulatedWorldRoster(state, opponent, "WORLD_KNOCKOUT_L20");
  return {
    participant: structuredClone(opponent),
    roster: structuredClone(roster),
    meta: {
      ...meta,
      matchId: match.matchId,
      opponentTrainerId: opponent.id
    }
  };
}

function persistWorldKnockoutOpponentRoster(knockout, opponentId, battle) {
  if (!battle || !opponentId) return;
  const combatants = [battle.opponent, ...(battle.opponentBench ?? [])].filter(Boolean);
  if (combatants.length === 0) return;
  knockout.opponentRosters[opponentId] = combatants.map((combatant, index) => ({
    speciesId: combatant.speciesId,
    name: combatant.name,
    level: combatant.level,
    hp: structuredClone(combatant.hp),
    statuses: structuredClone(combatant.statuses),
    abilityId: combatant.abilityId,
    moveIds: structuredClone(combatant.moveIds),
    pp: structuredClone(combatant.pp),
    trainerId: opponentId,
    rosterIndex: index,
    regulation: "WORLD_KNOCKOUT_L20",
    source: "persistent_regulated_world_roster"
  }));
}

function recordWorldKnockoutOutcome(state, meta, outcome, resolvedAtMinutes, battle = null) {
  const { knockout } = worldKnockoutOrThrow(state);
  let bracket;
  let playerMatchId;

  if (meta.worldKnockoutRound === "R16") {
    bracket = knockout.r16Bracket;
    playerMatchId = knockout.playerR16MatchId;
  } else if (meta.worldKnockoutRound === "QF") {
    bracket = knockout.qfBracket;
    playerMatchId = knockout.playerQfMatchId;
  } else if (meta.worldKnockoutRound === "SF") {
    bracket = knockout.sfBracket;
    playerMatchId = knockout.playerSfMatchId;
  } else if (meta.worldKnockoutRound === "FINAL") {
    bracket = knockout.finalMatch ? [knockout.finalMatch] : [];
    playerMatchId = knockout.playerFinalMatchId;
  } else {
    throw new Error("Unsupported World knockout round: " + String(meta.worldKnockoutRound));
  }

  const match = bracket.find((entry) => entry.matchId === playerMatchId);
  if (!match) throw new Error(meta.worldKnockoutRound + " player match is missing");
  if (match.outcome) throw new Error(meta.worldKnockoutRound + " player match already has a result");

  const playerIsHome = match.home.name === state.player?.name;
  const homeWon = playerIsHome ? outcome === "win" : outcome === "lose";
  match.outcome = homeWon ? "win" : "lose";
  match.playerOutcome = outcome;
  match.winnerId = homeWon ? match.home.id : match.away.id;
  match.loserId = homeWon ? match.away.id : match.home.id;
  match.resolvedAtMinutes = resolvedAtMinutes;
  match.source = "player_pokemon5e_combat";
  const opponent = playerIsHome ? match.away : match.home;
  persistWorldKnockoutOpponentRoster(knockout, opponent.id, battle);

  state.world.flags ??= {};
  state.world.flags.world_eliminated = outcome === "lose";

  if (meta.worldKnockoutRound === "R16") {
    knockout.playerAdvancedToQf = outcome === "win";
    state.world.flags.world_r16_resolved = true;
    state.world.flags.world_r16_result = outcome;
    state.world.flags.world_r16_won = outcome === "win";
  } else if (meta.worldKnockoutRound === "QF") {
    knockout.playerAdvancedToSf = outcome === "win";
    state.world.flags.world_qf_resolved = true;
    state.world.flags.world_qf_result = outcome;
    state.world.flags.world_qf_won = outcome === "win";
  } else if (meta.worldKnockoutRound === "SF") {
    knockout.playerAdvancedToFinal = outcome === "win";
    state.world.flags.world_sf_resolved = true;
    state.world.flags.world_sf_result = outcome;
    state.world.flags.world_sf_won = outcome === "win";
  } else {
    const world = ensureCompetition(state).world;
    const winner = participantByIdFromMatch(match, match.winnerId);
    const runnerUp = participantByIdFromMatch(match, match.loserId);
    knockout.finalResolved = true;
    knockout.playerWonFinal = outcome === "win";
    knockout.worldChampion = structuredClone(winner);
    knockout.worldRunnerUp = structuredClone(runnerUp);
    world.finalResolved = true;
    world.currentWorldChampion = structuredClone(winner);
    world.currentWorldRunnerUp = structuredClone(runnerUp);
    state.world.flags.world_final_resolved = true;
    state.world.flags.world_final_result = outcome;
    state.world.flags.world_champion = outcome === "win";
    state.world.flags.current_world_champion = winner.name;
    state.world.flags.current_world_champion_id = winner.id;
    state.world.flags.current_world_runner_up = runnerUp.name;
    state.world.flags.current_world_runner_up_id = runnerUp.id;
  }
  return match;
}

function simulateWorldKnockoutMatch(state, match) {
  if (match.outcome) return match;
  const world = ensureCompetition(state).world;
  const seed = [
    world.drawSeed ?? "world-draw",
    match.round ?? "KNOCKOUT",
    match.matchId,
    match.home.id,
    match.away.id
  ].join("|");
  const homeWins = (hashString(seed) & 1) === 0;
  match.outcome = homeWins ? "win" : "lose";
  match.playerOutcome = null;
  match.winnerId = homeWins ? match.home.id : match.away.id;
  match.loserId = homeWins ? match.away.id : match.home.id;
  match.resolvedAtMinutes = null;
  match.source = "deterministic_offscreen_world_resolution";
  return match;
}

function participantByIdFromMatch(match, participantId) {
  if (match.home.id === participantId) return match.home;
  if (match.away.id === participantId) return match.away;
  return null;
}

export function resolveWorldR16Round(state, { eventId = "WORLD_R16_RESOLVE" } = {}) {
  requireId(eventId, "world r16 resolution eventId");
  const { world, knockout } = worldKnockoutOrThrow(state);
  if (!knockout.opened) throw new Error("WORLD_R16 bracket has not been opened");
  if (knockout.r16Resolved) return knockout;
  const playerMatch = knockout.r16Bracket.find((entry) => entry.matchId === knockout.playerR16MatchId);
  if (!playerMatch || !playerMatch.playerOutcome) {
    throw new Error("WORLD_R16 resolution requires the player's official R16 result");
  }

  for (const match of knockout.r16Bracket) simulateWorldKnockoutMatch(state, match);
  if (knockout.r16Bracket.some((match) => !match.winnerId)) {
    throw new Error("WORLD_R16 failed to resolve every knockout match");
  }

  knockout.r16Results = structuredClone(knockout.r16Bracket);
  const top8 = knockout.r16Bracket.map((match) => {
    const participant = participantByIdFromMatch(match, match.winnerId);
    return {
      id: participant.id,
      name: participant.name,
      fromMatchId: match.matchId
    };
  });
  if (top8.length !== 8 || new Set(top8.map((entry) => entry.id)).size !== 8) {
    throw new Error("WORLD_R16 must lock exactly eight unique quarterfinalists");
  }

  knockout.top8Locked = true;
  knockout.top8 = structuredClone(top8);
  world.top8Locked = true;
  world.top8 = structuredClone(top8);
  knockout.qfBracket = [];
  for (let index = 0; index < top8.length; index += 2) {
    knockout.qfBracket.push({
      round: "QF",
      matchId: "WORLD_QF_" + String(index / 2 + 1),
      home: structuredClone(top8[index]),
      away: structuredClone(top8[index + 1]),
      outcome: null,
      playerOutcome: null,
      winnerId: null,
      loserId: null,
      resolvedAtMinutes: null,
      source: null
    });
  }

  const playerQf = knockout.qfBracket.find((match) =>
    match.home.name === state.player?.name || match.away.name === state.player?.name
  ) ?? null;
  knockout.playerQfMatchId = playerQf?.matchId ?? null;
  knockout.playerQfOpponent = playerQf
    ? structuredClone(playerQf.home.name === state.player?.name ? playerQf.away : playerQf.home)
    : null;
  knockout.silasAdvancedToQf = top8.some((entry) => entry.name === "Silas Crowe");
  knockout.r16Resolved = true;

  state.world.flags ??= {};
  state.world.flags.world_r16_round_resolved = true;
  state.world.flags.world_top8_locked = true;
  state.world.flags.world_r16_event_resolution_id = eventId;
  state.world.flags.world_qf_opponent = knockout.playerQfOpponent?.name ?? null;
  state.world.flags.world_qf_opponent_id = knockout.playerQfOpponent?.id ?? null;
  state.world.flags.world_r16_silas_advanced = knockout.silasAdvancedToQf;
  return knockout;
}


export function resolveWorldQfRound(state, { eventId = "WORLD_QF_RESOLVE" } = {}) {
  requireId(eventId, "world qf resolution eventId");
  const { world, knockout } = worldKnockoutOrThrow(state);
  if (!knockout.r16Resolved || !knockout.top8Locked || knockout.qfBracket.length !== 4) {
    throw new Error("WORLD_QF resolution requires the locked Top8/QF bracket");
  }
  if (knockout.qfResolved) return knockout;
  if (knockout.playerAdvancedToQf !== true) {
    throw new Error("WORLD_QF resolution requires player advancement to the quarterfinal");
  }

  const playerMatch = knockout.qfBracket.find((entry) => entry.matchId === knockout.playerQfMatchId);
  if (!playerMatch || !playerMatch.playerOutcome) {
    throw new Error("WORLD_QF resolution requires the player's official QF result");
  }

  for (const match of knockout.qfBracket) simulateWorldKnockoutMatch(state, match);
  if (knockout.qfBracket.some((match) => !match.winnerId)) {
    throw new Error("WORLD_QF failed to resolve every quarterfinal");
  }

  knockout.qfResults = structuredClone(knockout.qfBracket);
  const top4 = knockout.qfBracket.map((match) => {
    const participant = participantByIdFromMatch(match, match.winnerId);
    return {
      id: participant.id,
      name: participant.name,
      fromMatchId: match.matchId
    };
  });
  if (top4.length !== 4 || new Set(top4.map((entry) => entry.id)).size !== 4) {
    throw new Error("WORLD_QF must lock exactly four unique semifinalists");
  }

  knockout.top4Locked = true;
  knockout.top4 = structuredClone(top4);
  world.top4Locked = true;
  world.top4 = structuredClone(top4);
  knockout.sfBracket = [];
  for (let index = 0; index < top4.length; index += 2) {
    knockout.sfBracket.push({
      round: "SF",
      matchId: "WORLD_SF_" + String(index / 2 + 1),
      home: structuredClone(top4[index]),
      away: structuredClone(top4[index + 1]),
      outcome: null,
      playerOutcome: null,
      winnerId: null,
      loserId: null,
      resolvedAtMinutes: null,
      source: null
    });
  }

  const playerSf = knockout.sfBracket.find((match) =>
    match.home.name === state.player?.name || match.away.name === state.player?.name
  ) ?? null;
  knockout.playerSfMatchId = playerSf?.matchId ?? null;
  knockout.playerSfOpponent = playerSf
    ? structuredClone(playerSf.home.name === state.player?.name ? playerSf.away : playerSf.home)
    : null;
  knockout.qfResolved = true;

  state.world.flags ??= {};
  state.world.flags.world_qf_round_resolved = true;
  state.world.flags.world_top4_locked = true;
  state.world.flags.world_qf_event_resolution_id = eventId;
  state.world.flags.world_sf_opponent = knockout.playerSfOpponent?.name ?? null;
  state.world.flags.world_sf_opponent_id = knockout.playerSfOpponent?.id ?? null;
  return knockout;
}

export function openWorldSfRound(state, { eventId = "WORLD_SF" } = {}) {
  requireId(eventId, "world sf eventId");
  const { world, knockout } = worldKnockoutOrThrow(state);
  if (!knockout.qfResolved || !knockout.top4Locked || !world.top4Locked || knockout.sfBracket.length !== 2) {
    throw new Error("WORLD_SF requires the locked Top4/SF bracket from WORLD_QF");
  }
  if (knockout.playerAdvancedToSf !== true) {
    throw new Error("WORLD_SF requires player advancement from the quarterfinal");
  }
  if (knockout.sfOpened) return knockout;

  const playerSf = knockout.sfBracket.find((match) =>
    match.home.name === state.player?.name || match.away.name === state.player?.name
  ) ?? null;
  if (!playerSf) throw new Error("WORLD_SF bracket does not contain the player");
  const opponent = playerSf.home.name === state.player?.name ? playerSf.away : playerSf.home;

  knockout.playerSfMatchId = playerSf.matchId;
  knockout.playerSfOpponent = structuredClone(opponent);
  knockout.reiInTop4 = knockout.top4.some((entry) => entry.name === "Rei");
  knockout.reiIsPlayerOpponent = opponent.name === "Rei";
  knockout.sfOpened = true;

  state.world.flags ??= {};
  state.world.flags.world_sf_opened = true;
  state.world.flags.world_sf_event_id = eventId;
  state.world.flags.world_sf_opponent = opponent.name;
  state.world.flags.world_sf_opponent_id = opponent.id;
  state.world.flags.world_sf_rei_in_top4 = knockout.reiInTop4;
  state.world.flags.world_sf_rei_is_player_opponent = knockout.reiIsPlayerOpponent;
  return knockout;
}

export function resolveWorldSfRound(state, { eventId = "WORLD_SF_RESOLVE" } = {}) {
  requireId(eventId, "world sf resolution eventId");
  const { knockout } = worldKnockoutOrThrow(state);
  if (!knockout.sfOpened || !knockout.top4Locked || knockout.sfBracket.length !== 2) {
    throw new Error("WORLD_SF resolution requires the opened Top4/SF bracket");
  }
  if (knockout.sfResolved) return knockout;

  const playerMatch = knockout.sfBracket.find((entry) => entry.matchId === knockout.playerSfMatchId);
  if (!playerMatch || !playerMatch.playerOutcome) {
    throw new Error("WORLD_SF resolution requires the player's official semifinal result");
  }

  for (const match of knockout.sfBracket) simulateWorldKnockoutMatch(state, match);
  if (knockout.sfBracket.some((match) => !match.winnerId)) {
    throw new Error("WORLD_SF failed to resolve both semifinals");
  }

  knockout.sfResults = structuredClone(knockout.sfBracket);
  const finalists = knockout.sfBracket.map((match) => {
    const participant = participantByIdFromMatch(match, match.winnerId);
    return {
      id: participant.id,
      name: participant.name,
      fromMatchId: match.matchId
    };
  });
  if (finalists.length !== 2 || new Set(finalists.map((entry) => entry.id)).size !== 2) {
    throw new Error("WORLD_SF must lock exactly two unique finalists");
  }

  knockout.finalistsLocked = true;
  knockout.finalists = structuredClone(finalists);
  knockout.finalMatch = {
    round: "FINAL",
    matchId: "WORLD_FINAL_1",
    home: structuredClone(finalists[0]),
    away: structuredClone(finalists[1]),
    outcome: null,
    playerOutcome: null,
    winnerId: null,
    loserId: null,
    resolvedAtMinutes: null,
    source: null
  };

  const playerFinalist = finalists.some((entry) => entry.name === state.player?.name);
  knockout.playerFinalMatchId = playerFinalist ? knockout.finalMatch.matchId : null;
  knockout.playerFinalOpponent = playerFinalist
    ? structuredClone(knockout.finalMatch.home.name === state.player?.name ? knockout.finalMatch.away : knockout.finalMatch.home)
    : null;
  knockout.sfResolved = true;

  state.world.flags ??= {};
  state.world.flags.world_sf_round_resolved = true;
  state.world.flags.world_finalists_locked = true;
  state.world.flags.world_sf_event_resolution_id = eventId;
  state.world.flags.world_finalist = playerFinalist;
  state.world.flags.world_final_opponent = knockout.playerFinalOpponent?.name ?? null;
  state.world.flags.world_final_opponent_id = knockout.playerFinalOpponent?.id ?? null;
  return knockout;
}

export function applyCompetitionEffect(state, effect) {
  switch (effect.type) {
    case "competition_trial_available": return setTrialAvailable(state, effect);
    case "competition_trial_register": return registerTrial(state, effect);
    case "competition_world_draw": return resolveWorldDraw(state, effect);
    case "competition_world_groups_open": return openWorldGroupStage(state, effect);
    case "competition_world_groups_resolve": return resolveWorldGroupStage(state, effect);
    case "competition_world_r16_open": return openWorldR16Bracket(state, effect);
    case "competition_world_r16_resolve": return resolveWorldR16Round(state, effect);
    case "competition_world_qf_resolve": return resolveWorldQfRound(state, effect);
    case "competition_world_sf_open": return openWorldSfRound(state, effect);
    case "competition_world_sf_resolve": return resolveWorldSfRound(state, effect);
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

  if (["competition_world_groups_open", "competition_world_groups_resolve"].includes(effect.type)) {
    if (effect.eventId !== undefined && (typeof effect.eventId !== "string" || !ID_RE.test(effect.eventId))) {
      push("INVALID_WORLD_GROUPS_EVENT_ID", "eventId must be a stable identifier", at + ".eventId");
    }
    return errors;
  }

  if (["competition_world_r16_open", "competition_world_r16_resolve", "competition_world_qf_resolve", "competition_world_sf_open", "competition_world_sf_resolve"].includes(effect.type)) {
    if (effect.eventId !== undefined && (typeof effect.eventId !== "string" || !ID_RE.test(effect.eventId))) {
      push("INVALID_WORLD_KNOCKOUT_EVENT_ID", "eventId must be a stable identifier", at + ".eventId");
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
  if (meta.worldOpponentIndex !== undefined &&
      (!Number.isInteger(meta.worldOpponentIndex) || meta.worldOpponentIndex < 0 || meta.worldOpponentIndex > 2)) {
    push("INVALID_WORLD_OPPONENT_INDEX", "worldOpponentIndex must be 0..2", at + ".worldOpponentIndex");
  }
  if (meta.worldMatchday !== undefined &&
      (!Number.isInteger(meta.worldMatchday) || meta.worldMatchday < 1 || meta.worldMatchday > 3)) {
    push("INVALID_WORLD_MATCHDAY", "worldMatchday must be 1..3", at + ".worldMatchday");
  }
  if (meta.worldOpponentIndex !== undefined && meta.type !== "official_match") {
    push("INVALID_WORLD_GROUP_MATCH_TYPE", "World group matches must be official_match", at + ".type");
  }
  if (meta.worldKnockoutRound !== undefined && !["R16", "QF", "SF", "FINAL"].includes(meta.worldKnockoutRound)) {
    push("INVALID_WORLD_KNOCKOUT_ROUND", "worldKnockoutRound must be R16, QF, SF or FINAL", at + ".worldKnockoutRound");
  }
  if (meta.worldKnockoutRound !== undefined && meta.type !== "official_match") {
    push("INVALID_WORLD_KNOCKOUT_MATCH_TYPE", "World knockout matches must be official_match", at + ".type");
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
