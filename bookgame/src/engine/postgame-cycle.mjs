import {
  createWorldCompetitionState, ensureCompetition, resolveUnattendedWorldChampionship,
  resolveEliminatedWorldChampionship
} from "./competition-state.mjs";
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

// Postgame can enter only a canonical, previously visited location. 120
// minutes reuses the authored M12 return-to-Asteria travel cost.
const VALEDARSENA_GATE = Object.freeze({
  from: "meridiana_city", to: "valedarsena_city", minutes: 120,
  sceneId: "m01-valedarsena-first-arrival", nodeId: "city_hub"
});

// Authored repeatable activities do not invent rewards or resurrect completed
// quests. Each execution has a stable save-backed event record.
const REPEATABLE_TEMPLATES = Object.freeze({
  postgame_patrol: Object.freeze({
    id: "PGR_PATROL", text: "Ronda completata: hai verificato strade e avvistamenti già accessibili. Nessun incontro o cattura viene assegnato automaticamente."
  }),
  postgame_research: Object.freeze({
    id: "PGR_ARCHIVE", text: "Hai consultato le piste già scoperte: il diario conserva i vecchi indizi senza sbloccare luoghi o Leggendari mai incontrati."
  }),
  postgame_training: Object.freeze({
    id: "PGR_PREPARATION", text: "Giornata di preparazione completata: le risorse restano quelle reali del Trainer e dei Pokémon. Non vengono attribuiti livelli gratuiti."
  })
});

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
  const world = ensureCompetition(state).world;
  const edition = world.edition;
  if (season.championships.some((entry) => entry.edition === edition)) return;
  if (edition !== season.championships.length + 1) {
    throw new Error("Postgame history must contain consecutive championship editions");
  }
  if (!world.currentWorldChampion) {
    const playerResult = qualifiedResult(state);
    if (playerResult === "missed") resolveUnattendedWorldChampionship(state);
    if (playerResult === "eliminated") resolveEliminatedWorldChampionship(state);
  }
  const outcome = summary(state, edition);
  if (outcome.result === "undetermined") {
    throw new Error("Cannot finish a World edition before the actual outcome is resolved");
  }
  if (outcome.result !== "missed" && (!outcome.champion || !state.competition.world.finalResolved)) {
    throw new Error("Cannot invent a World Champion: resolve the official final first");
  }
  // The Step-8 Hall of Fame is the canonical global winners archive.
  // The postgame journal additionally stores the player's route and date.
  world.hallOfFame ??= [];
  if (outcome.champion && !world.hallOfFame.some((entry) => entry.edition === edition)) {
    world.hallOfFame.push({
      edition, champion: structuredClone(outcome.champion),
      runnerUp: structuredClone(outcome.runnerUp)
    });
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

export function isPostgameExploring(state) {
  return state?.world?.flags?.main_story_complete === true &&
    state?.postgame?.phase === "between" &&
    state?.postgame?.exploring === true &&
    state?.pending == null &&
    !isPostgameHome(state);
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
      postgame.resume &&
      postgame.resume.locationId === state.world.locationId
      ? [{ id: "postgame_resume_exploration", text: "Riprendo l'esplorazione dal punto in cui l'ho lasciata" }]
      : []),
    ...(postgame.phase === "between" &&
      state.world.locationId === VALEDARSENA_GATE.from &&
      (state.world.visitedLocationIds ?? []).includes(VALEDARSENA_GATE.to)
      ? [{ id: "postgame_visit_valedarsena", text: "Torno a Valedarsena attraverso il tragitto di M12 (120 minuti)" }]
      : []),
    ...(postgame.phase === "between" &&
      state.world.locationId === VALEDARSENA_GATE.to
      ? [{ id: "postgame_return_meridiana", text: "Ritorno a Meridiana con il trasporto interregionale (120 minuti)" }]
      : []),
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
  const recent = postgame.activities.at(-1);
  const activityReport = recent?.description
    ? `\n\nUltimo evento: ${recent.description} (${recent.year})`
    : "";
  return `La carriera continua. Sei a ${state.world.locationId}. Il mondo, i Pokémon, gli NPC e le conseguenze delle scelte rimangono gli stessi.\n\nProssimo Mondiale: edizione ${nextEdition}, fra ${days} giorni di gioco. Puoi riprendere le scene esplorative dei luoghi già visitati senza aprire nuove mappe.${activityReport}`;
}

// Competition-only reset: NEVER clear unrelated world/quest/Legendary flags.
// One-shot NPC schedule events do not fire twice; preserve their registrations.
const CURRENT_EDITION_FLAGS =
  /^(?:m0?[7-9]_|m1[01]_|worlds_missed$|world_(?:qualified$|champion$|eliminated$|exit_available$|draw|group|top|r16|qf|sf|final|knockout|current_))/;
const PRESERVED_FLAGS = new Set([
  "m07_unlocked", "m7_active", "m7_complete", "m7_before_lights_complete",
  "m7_qualifier_registered", "m8_astrid_available", "m9_kaia_available",
  "m10_silas_available", "m11_rei_available"
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
  if (choiceId === "postgame_resume_exploration") {
    if (postgame.phase !== "between" || !postgame.resume ||
        postgame.resume.locationId !== state.world.locationId) {
      throw new Error("No safe postgame exploration checkpoint at this location");
    }
    state.story.sceneId = postgame.resume.sceneId;
    state.story.nodeId = postgame.resume.nodeId;
    postgame.exploring = true;
    return { action: "resume", sceneId: state.story.sceneId, nodeId: state.story.nodeId };
  }
  if (choiceId === "postgame_visit_valedarsena") {
    if (postgame.phase !== "between" ||
        state.world.locationId !== VALEDARSENA_GATE.from ||
        !(state.world.visitedLocationIds ?? []).includes(VALEDARSENA_GATE.to)) {
      throw new Error("Valedarsena must have been visited before the postgame trip");
    }
    advanceWorldTime(state.world, VALEDARSENA_GATE.minutes);
    state.world.locationId = VALEDARSENA_GATE.to;
    state.story.sceneId = VALEDARSENA_GATE.sceneId;
    state.story.nodeId = VALEDARSENA_GATE.nodeId;
    postgame.exploring = true;
    return { action: "travel", minutes: VALEDARSENA_GATE.minutes, locationId: VALEDARSENA_GATE.to };
  }
  if (choiceId === "postgame_return_meridiana") {
    if (postgame.phase !== "between" || state.world.locationId !== VALEDARSENA_GATE.to) {
      throw new Error("Postgame return trip requires Valedarsena");
    }
    advanceWorldTime(state.world, VALEDARSENA_GATE.minutes);
    state.world.locationId = VALEDARSENA_GATE.from;
    postgame.resume = null;
    return { action: "travel", minutes: VALEDARSENA_GATE.minutes, locationId: VALEDARSENA_GATE.from };
  }
  const activity = ACTIVITIES[choiceId];
  if (activity || choiceId === "postgame_week" || choiceId === "postgame_year") {
    if (postgame.phase !== "between") throw new Error("World Championship in progress");
    const minutes = activity?.minutes ??
      (choiceId === "postgame_week" ? 7 * DAY_MINUTES : POSTGAME_YEAR_MINUTES);
    advanceWorldTime(state.world, minutes);
    const template = REPEATABLE_TEMPLATES[choiceId] ?? null;
    postgame.activities.push({
      id: `postgame_event_${postgame.activities.length + 1}`,
      kind: activity?.kind ?? (choiceId === "postgame_week" ? "week" : "year"),
      templateId: template?.id ?? null,
      description: template?.text ?? null,
      year: 2060 + Math.floor((state.world.elapsedMinutes - postgame.startedAtMinutes) / POSTGAME_YEAR_MINUTES),
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
  nextWorld.hallOfFame = structuredClone(previous.hallOfFame ?? []);
  competition.world = nextWorld;
  resetForQualifier(state);
  postgame.phase = "qualifying";
  postgame.panel = "main";
  state.story.sceneId = "m07-world-qualifier";
  state.story.nodeId = "qualifier_entry";
  state.world.locationId = "meridiana_grand_arena";
  return { action: "qualifier", edition: nextWorld.edition };
}

export function leavePostgameExploration(state) {
  if (!isPostgameExploring(state)) throw new Error("Not in a safe postgame exploration scene");
  const postgame = ensurePostgame(state);
  postgame.resume = {
    sceneId: state.story.sceneId, nodeId: state.story.nodeId,
    locationId: state.world.locationId
  };
  postgame.exploring = false;
  state.story.sceneId = HOME_SCENE;
  state.story.nodeId = HOME_NODE;
  // Do NOT move the player: this returns to the journal at the present location.
  return { action: "journal", locationId: state.world.locationId };
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
