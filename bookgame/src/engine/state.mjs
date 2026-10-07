import { getStartingBuild } from "../../../src/bridge/motor-to-poke5e.mjs";
import { DEFAULT_START_MINUTE, daypartForMinute } from "./time.mjs";
import { createPersistentNpc } from "./npc-state.mjs";
import { createCompetitionState } from "./competition-state.mjs";

export function proficiencyBonus(level) {
  if (!Number.isInteger(level) || level < 1) throw new RangeError("Trainer level must be >= 1");
  return 2 + Math.floor((level - 1) / 4);
}

const FIVE_FRIEND_IDS = ["Luke", "Mattew", "Daniel", "Edward", "Fab"];

function createRookieFriendNpc(name) {
  const build = getStartingBuild(name);
  return createPersistentNpc({
    id: name,
    name,
    state: {
      trainerLevel: 1,
      rankState: "F",
      teamStage: "rookie",
      starterSpecies: build.starter.species,
      starterForm: build.starter.form,
      starterLevel: build.starter.level,
      recentResult: "none"
    }
  });
}

export function createNewGameState({
  protagonist = "Luke",
  slot = "slot1",
  startAtIntro = false,
  now = () => new Date().toISOString()
} = {}) {
  const build = getStartingBuild(protagonist);
  const timestamp = now();
  const friendNpcs = Object.fromEntries(
    FIVE_FRIEND_IDS
      .filter((name) => name !== protagonist)
      .map((name) => [name, createRookieFriendNpc(name)])
  );

  return {
    schemaVersion: 1,
    slot,
    revision: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    player: {
      name: protagonist,
      trainerLevel: 1,
      abilities: build.abilities,
      skills: build.skills,
      starter: build.starter,
      roster: [structuredClone(build.starter)],
      money: 0,
      inventory: []
    },
    world: {
      day: 1,
      elapsedMinutes: DEFAULT_START_MINUTE,
      minuteOfDay: DEFAULT_START_MINUTE,
      time: daypartForMinute(DEFAULT_START_MINUTE),
      locationId: "asteria_campus_exit",
      flags: {
        intro_complete: !startAtIntro,
        free_roam: !startAtIntro
      }
    },
    quests: {},
    events: {},
    competition: createCompetitionState(),
    ecology: { history: [], lastEncounter: null },
    shops: {},
    npcs: {
      ...friendNpcs,
      Blue: createPersistentNpc({
        id: "Blue",
        name: "Blue",
        state: {
          met: false,
          rankState: "F",
          teamStage: "rookie",
          resultContext: "none"
        }
      })
    },
    story: {
      sceneId: startAtIntro ? "intro-five" : "m01-release",
      nodeId: startAtIntro ? "before_doors" : "free_roam",
      history: []
    },
    pending: null,
    lastRoll: null
  };
}

export function touchState(state, now = () => new Date().toISOString()) {
  state.revision += 1;
  state.updatedAt = now();
  return state;
}
