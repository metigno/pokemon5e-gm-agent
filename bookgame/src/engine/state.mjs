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
      trainerClass: "Trainer",
      trainerPath: null,
      specializations: [],
      characterCreation: {
        ruleset: "2024",
        complete: false,
        required: ["specialization"],
        completed: []
      },
      proficiencies: {
        savingThrows: ["CHA"],
        tools: ["Pokeballs"]
      },
      pokeslots: 3,
      maxSr: 2,
      abilities: build.abilities,
      skills: build.skills,
      starter: build.starter,
      roster: [structuredClone(build.starter)],
      money: 0,
      inventory: ["Pokeball", "Pokeball", "Pokeball", "Pokeball", "Pokeball", "Potion", "Trainer License", "Pokedex"]
    },
    world: {
      day: 1,
      elapsedMinutes: DEFAULT_START_MINUTE,
      minuteOfDay: DEFAULT_START_MINUTE,
      time: daypartForMinute(DEFAULT_START_MINUTE),
      locationId: "asteria_campus_exit",
      flags: {
        character_creation_complete: false,
        intro_complete: false,
        free_roam: false
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
      sceneId: "m01-release",
      nodeId: "free_roam",
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

export function completeTrainerCreation(state, { specialization } = {}) {
  if (!specialization || typeof specialization !== "string") {
    throw new Error("Pokemon 5e level-1 Trainer creation requires a specialization");
  }
  const next = structuredClone(state);
  next.player.trainerClass = "Trainer";
  next.player.trainerPath = null;
  next.player.specializations = [specialization];
  next.player.characterCreation.complete = true;
  next.player.characterCreation.completed = ["specialization"];
  next.world.flags.character_creation_complete = true;
  next.world.flags.intro_complete = true;
  next.world.flags.free_roam = true;
  return next;
}

export function assertTrainerCreationComplete(state) {
  if (!state.player?.characterCreation?.complete || !state.world?.flags?.character_creation_complete) {
    throw new Error("Trainer character creation is incomplete: choose the level-1 Pokemon 5e specialization before starting M1");
  }
  return true;
}
