import { createWorldCompetitionState, ensureCompetition } from "./competition-state.mjs";
import { advanceWorldTime, ensureWorldClock } from "./time.mjs";

// Authored, reusable activities: no AI-generated quest, reward, location or encounter.
const ACTIVITIES = Object.freeze({
  postgame_patrol: { label: "Pattuglio i luoghi già conosciuti (6 ore)", minutes: 360, kind: "patrol" },
  postgame_research: { label: "Rileggo gli indizi e aggiorno il diario (4 ore)", minutes: 240, kind: "research" },
  postgame_training: { label: "Dedico una giornata alla preparazione (1 giorno)", minutes: 1440, kind: "training" }
});
const DAY_MINUTES = 1440;
export const POSTGAME_YEAR_MINUTES = DAY_MINUTES * 365;
export const POSTGAME_WORLD_INTERVAL_MINUTES = POSTGAME_YEAR_MINUTES * 4;
const HOME_SCENE = "m12-main-story-complete";
const HOME_NODE = "free_roam";

function worldFlags(state) {
  state.world ??= {};
  state.world.flags ??= {};
  return state.world.flags;
}

function qualifiedResult(state) {
  const flags = worldFlags(state);
  if (flags.world_champion === true) return "champion";
  if (flags.worlds_missed === true) return "missed";
  if (flags.world_eliminated === true) return "eliminated";
  if (state.competition?.world?.finalResolved === true) return "eliminated";
  return "undetermined";
}

function summary(state, edition) {
  const competition = ensureCompetition(state);
  const world = competition.world;
  const result = qualifiedResult(state);
  return {
    edition,
    year: 2060 + 4 * (edition - 1),
    result,
    champion: world.currentWorldChampion
      ? structuredClone(world.currentWorldChampion) : null,
    runnerUp: world.currentWorldRunnerUp
      ? structuredClone(world.currentWorldRunnerUp) : null,
    finishedAtMinutes: state.world.elapsedMinutes,
    playerName: state.player.name
  };
}

function recordEdition(state) {
  const season = state.postgame;
  const edition = ensureCompetition(state).world.edition;
  if (season.championships.some((entry) => entry.edition === edition)) return;
  if (edition !== season.championships.length + 1) {
    throw new Error("Postgame history must contain consecutive championship editions");
  }
  const outcome = summary(state, edition);
  if (outcome.result === "undetermined") {
    throw new Error("Cannot finish a World edition before the actual outcome is resolved");
  }
  if (outcome.result !== "missed" && (!outcome.champion || !state.competition.world.finalResolved)) {
    throw new Error("Cannot invent a World Champion: resolve the official final first");
  }
  season.championships.push(outcome);
}

export function ensurePostgame(state) {
  if (worldFlags(state).main_story_complete !== true) {
    throw new Error("Postgame is locked until MAIN_STORY_COMPLETE");
  }
  ensureWorldClock(state.world);
  const edition = ensureCompetition(state).world.edition;
  if (!state.postgame) {
    state.postgame = {
      version: 1,
      phase: "between",
      panel: "main",
      championships: [],
      activities: [],
      nextWorldAtMinutes: state.world.elapsedMinutes + POSTGAME_WORLD_INTERVAL_MINUTES,
      startedAtMinutes: state.world.elapsedMinutes
    };
  }
  const postgame = state.postgame;
  postgame.championships ??= [];
  postgame.activities ??= [];
  postgame.panel ??= "main";
  postgame.phase ??= "between";
  if (!Number.isInteger(postgame.nextWorldAtMinutes)) {
    postgame.nextWorldAtMinutes = state.world.elapsedMinutes + POSTGAME_WORLD_INTERVAL_MINUTES;
  }
  if (edition === 1 && postgame.championships.length === 0) recordEdition(state);
  return postgame;
}

export function isPostgameHome(state) {
  return state?.world?.flags?.main_story_complete === true &&
    state.story?.sceneId === HOME_SCENE && state.story?.nodeId === HOME_NODE &&
    state.pending == null;
}

export function isPostgameWorldExit(state) {
  return state?.world?.flags?.main_story_complete === true &&
    state.competition?.world?.edition > 1 &&
    state.story?.sceneId === "m12-world-exit-branch" &&
    state.story?.nodeId === "world_exit_entry" &&
    state.pending == null;
}

export function getPostgameChoices(state) {
  const postgame = ensurePostgame(state);
  if (postgame.panel === "history") return [
    { id: "postgame_back", text: "Torno al viaggio" }
  ];
  return [
    ...Object.entries(ACTIVITIES).map(([id, action]) => ({ id, text: action.label })),
    { id: "postgame_week", text: "Faccio trascorrere una settimana (7 giorni)" },
    { id: "postgame_year", text: "Faccio trascorrere un anno di carriera (365 giorni)" },
    { id: "postgame_history", text: "Consulto la cronologia dei Mondiali" },
    ...(postgame.phase === "between" &&
      state.world.elapsedMinutes >= postgame.nextWorldAtMinutes &&
      state.competition?.rank === "S"
      ? [{ id: "postgame_qualifier", text: "Mi iscrivo alle qualificazioni del prossimo Mondiale" }]
      : [])
  ];
}

export function getPostgameText(state) {
  const postgame = ensurePostgame(state);
  if (postgame.panel === "history") {
    return "Albo d'oro della carriera:\n\n" + postgame.championships.map((entry) =>
      `${entry.year} — Mondiale ${entry.edition}: ${entry.champion?.name ?? "Campione non registrato"}; percorso personale: ${entry.result}`
    ).join("\n");
  }
  const minutes = Math.max(0, postgame.nextWorldAtMinutes - state.world.elapsedMinutes);
  const days = Math.ceil(minutes / DAY_MINUTES);
  const nextEdition = ensureCompetition(state).world.edition + (postgame.phase === "between" ? 1 : 0);
  return `La carriera continua. Sei a ${state.world.locationId}. Il mondo, i Pokémon, gli NPC e le conseguenze delle scelte rimangono gli stessi.\n\nProssimo Mondiale: edizione ${nextEdition}, fra ${days} giorni di gioco. Le attività scandiscono il tempo senza distribuire ricompense immotivate.`;
}

const CURRENT_EDITION_FLAGS = /^(?:m0?[7-9]_|m1[01]_|world_|worlds_)/;
const PRESERVED_FLAGS = new Set([
  "m07_unlocked", "m7_active", "m7_complete", "m7_before_lights_complete",
  "m7_qualifier_registered", "world_venue_discovered", "world_village_discovered",
  "world_record_discovered"
]);
function resetForQualifier(state) {
  const flags = worldFlags(state);
  for (const key of Object.keys(flags)) {
    if (CURRENT_EDITION_FLAGS.test(key) && !PRESERVED_FLAGS.has(key)) delete flags[key];
  }
  flags.m07_unlocked = true;
  flags.m7_active = true;
  flags.m7_qualifier_registered = true;
  flags.world_qualified = false;
  flags.worlds_missed = false;
  flags.world_eliminated = false;
  flags.world_champion = false;
  // All M12 and pre-M07 facts are deliberately untouched.
}

export function applyPostgameChoice(state, choiceId) {
  const postgame = ensurePostgame(state);
  if (choiceId === "postgame_back") {
    postgame.panel = "main";
    return { action: "panel" };
  }
  if (choiceId === "postgame_history") {
    postgame.panel = "history";
    return { action: "panel" };
  }
  if (postgame.panel !== "main") throw new Error("Finish reading the Hall of Fame first");
  const activity = ACTIVITIES[choiceId];
  if (activity || choiceId === "postgame_week" || choiceId === "postgame_year") {
    if (postgame.phase !== "between") throw new Error("World Championship in progress");
    const minutes = activity?.minutes ??
      (choiceId === "postgame_week" ? 7 * DAY_MINUTES : POSTGAME_YEAR_MINUTES);
    advanceWorldTime(state.world, minutes);
    postgame.activities.push({
      kind: activity?.kind ?? (choiceId === "postgame_week" ? "week" : "year"),
      atMinutes: state.world.elapsedMinutes,
      locationId: state.world.locationId
    });
    return { action: "time", minutes };
  }
  if (choiceId !== "postgame_qualifier") throw new Error("Unknown postgame choice: " + choiceId);
  if (postgame.phase !== "between" ||
      state.world.elapsedMinutes < postgame.nextWorldAtMinutes ||
      state.competition?.rank !== "S") {
    throw new Error("New World Qualifier is not available yet");
  }
  const competition = ensureCompetition(state);
  const previous = competition.world;
  if (postgame.championships.length !== previous.edition) {
    throw new Error("Previous World edition has not been recorded");
  }
  const nextWorld = createWorldCompetitionState();
  nextWorld.edition = previous.edition + 1;
  // Only the competitive draw/bracket resets. NPC careers, captured Pokémon,
  // economy, reputation, quests and earlier winner history stay persistent.
  nextWorld.canonicalRosters = structuredClone(previous.canonicalRosters ?? {});
  competition.world = nextWorld;
  resetForQualifier(state);
  postgame.phase = "qualifying";
  postgame.panel = "main";
  state.story.sceneId = "m07-world-qualifier";
  state.story.nodeId = "qualifier_entry";
  state.world.locationId = "meridiana_grand_arena";
  return { action: "qualifier", edition: nextWorld.edition };
}

export function finishPostgameEdition(state) {
  const postgame = ensurePostgame(state);
  if (postgame.phase !== "qualifying") throw new Error("No repeat World edition in progress");
  recordEdition(state);
  postgame.phase = "between";
  postgame.panel = "main";
  postgame.nextWorldAtMinutes = state.world.elapsedMinutes + POSTGAME_WORLD_INTERVAL_MINUTES;
  state.story.sceneId = HOME_SCENE;
  state.story.nodeId = HOME_NODE;
  state.world.locationId = "meridiana_city";
  return postgame.championships.at(-1);
}
