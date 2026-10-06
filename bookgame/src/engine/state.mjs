import { getStartingBuild } from "../../../src/bridge/motor-to-poke5e.mjs";
import { DEFAULT_START_MINUTE, daypartForMinute } from "./time.mjs";
import { createPersistentNpc } from "./npc-state.mjs";
import { createCompetitionState } from "./competition-state.mjs";

export const GAME_STATE_SCHEMA_VERSION = 2;

export const EXPERIENCE_NEEDED_PER_LEVEL = Object.freeze([
  0, 200, 800, 2000, 6000, 12000, 20000, 30000, 44000, 62000,
  82000, 104000, 128000, 158000, 194000, 234000, 278000, 326000,
  382000, 450000
]);

const SPECIALIZATION_TYPES = Object.freeze([
  "ghost", "fairy", "normal", "fighting", "flying", "poison", "fire",
  "grass", "water", "electric", "psychic", "dark", "bug", "ice",
  "dragon", "steel", "rock", "ground"
]);

export function proficiencyBonus(level) {
  if (!Number.isInteger(level) || level < 1) throw new RangeError("Trainer level must be >= 1");
  return 2 + Math.floor((level - 1) / 4);
}

export function experienceNeededAtLevel(level) {
  if (!Number.isInteger(level) || level < 1) throw new RangeError("Level must be >= 1");
  return EXPERIENCE_NEEDED_PER_LEVEL[level - 1] ?? EXPERIENCE_NEEDED_PER_LEVEL.at(-1);
}

function abilityModifier(score) {
  return Math.floor((Number(score ?? 10) - 10) / 2);
}

function defaultSpecializations() {
  return Object.fromEntries(SPECIALIZATION_TYPES.map((type) => [type, 0]));
}

function defaultTrainerHp(level, abilities) {
  // The pinned 2024 source creates trainers at 8 HP with a d6 hit die.
  // Legacy RC0 saves had no Trainer HP at all, so only level 1 can be
  // reconstructed losslessly. Higher-level legacy states retain the same
  // safe floor and are marked by migration metadata instead of inventing rolls.
  const base = Math.max(1, 8 + Math.max(0, abilityModifier(abilities?.CON)) * Math.max(0, level - 1));
  return { current: base, max: base };
}

export function createTrainerRuntime(build, {
  level = 1,
  money = 0,
  inventory = []
} = {}) {
  const hp = defaultTrainerHp(level, build.abilities);
  return {
    trainerClass: "pokemon-trainer",
    trainerPath: null,
    trainerLevel: level,
    trainerXp: experienceNeededAtLevel(level),
    abilities: structuredClone(build.abilities),
    skills: structuredClone(build.skills),
    proficiencies: {
      skills: structuredClone(build.skills),
      expertise: []
    },
    savingThrows: ["CHA"],
    hp,
    ac: 10,
    hitDice: {
      die: "d6",
      current: level,
      max: level
    },
    classResources: {},
    classFeatures: ["command-pokemon"],
    feats: [],
    specializations: defaultSpecializations(),
    equipment: [],
    trainerGear: [],
    conditions: [],
    movement: {
      walking: 30,
      climbing: 0,
      swimming: 0,
      flying: 0,
      burrowing: 0
    },
    featureUsage: {},
    persistentEffects: [],
    death: {
      state: "alive",
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      stable: false
    },
    money,
    inventory: structuredClone(inventory)
  };
}

function ensureObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : structuredClone(fallback);
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : structuredClone(fallback);
}

export function migrateGameState(input) {
  if (!input || typeof input !== "object") throw new TypeError("Game state is required");
  const state = structuredClone(input);
  state.player ??= {};

  const player = state.player;
  const level = Number.isInteger(player.trainerLevel) && player.trainerLevel > 0
    ? player.trainerLevel
    : 1;
  const abilities = ensureObject(player.abilities, {
    STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10
  });
  const skills = ensureArray(player.skills);

  player.trainerClass ??= "pokemon-trainer";
  player.trainerPath ??= null;
  player.trainerLevel = level;
  player.trainerXp = Number.isFinite(player.trainerXp)
    ? Math.max(0, player.trainerXp)
    : experienceNeededAtLevel(level);
  player.abilities = abilities;
  player.skills = skills;
  player.proficiencies = ensureObject(player.proficiencies, {
    skills: structuredClone(skills),
    expertise: []
  });
  player.proficiencies.skills = ensureArray(player.proficiencies.skills, skills);
  player.proficiencies.expertise = ensureArray(player.proficiencies.expertise);
  player.savingThrows = ensureArray(player.savingThrows, ["CHA"]);
  player.hp = ensureObject(player.hp, defaultTrainerHp(level, abilities));
  player.hp.max = Math.max(1, Number(player.hp.max ?? 1));
  player.hp.current = Math.max(0, Math.min(Number(player.hp.current ?? player.hp.max), player.hp.max));
  player.ac = Number.isFinite(player.ac) ? player.ac : 10;
  player.hitDice = ensureObject(player.hitDice, { die: "d6", current: level, max: level });
  player.hitDice.die ??= "d6";
  player.hitDice.max = Math.max(1, Number(player.hitDice.max ?? level));
  player.hitDice.current = Math.max(0, Math.min(Number(player.hitDice.current ?? player.hitDice.max), player.hitDice.max));
  player.classResources = ensureObject(player.classResources);
  player.classFeatures = ensureArray(player.classFeatures, ["command-pokemon"]);
  player.feats = ensureArray(player.feats);
  player.specializations = {
    ...defaultSpecializations(),
    ...ensureObject(player.specializations)
  };
  player.equipment = ensureArray(player.equipment);
  player.trainerGear = ensureArray(player.trainerGear);
  player.conditions = ensureArray(player.conditions);
  player.movement = {
    walking: 30,
    climbing: 0,
    swimming: 0,
    flying: 0,
    burrowing: 0,
    ...ensureObject(player.movement)
  };
  player.featureUsage = ensureObject(player.featureUsage);
  player.persistentEffects = ensureArray(player.persistentEffects);
  player.death = {
    state: "alive",
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,
    stable: false,
    ...ensureObject(player.death)
  };
  player.money = Number.isFinite(player.money) ? player.money : 0;
  player.inventory = ensureArray(player.inventory);
  player.roster = ensureArray(player.roster, player.starter ? [structuredClone(player.starter)] : []);

  if ((input.schemaVersion ?? 1) < GAME_STATE_SCHEMA_VERSION && level > 1 && !input.player?.hp) {
    state.migrations ??= {};
    state.migrations.trainerHp = {
      source: "rc0_missing_trainer_hp",
      reconstructed: false
    };
  }

  state.schemaVersion = GAME_STATE_SCHEMA_VERSION;
  return state;
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
  const trainer = createTrainerRuntime(build);

  return {
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    slot,
    revision: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    player: {
      name: protagonist,
      ...trainer,
      starter: build.starter,
      roster: [structuredClone(build.starter)]
    },
    world: {
      day: 1,
      elapsedMinutes: DEFAULT_START_MINUTE,
      minuteOfDay: DEFAULT_START_MINUTE,
      time: daypartForMinute(DEFAULT_START_MINUTE),
      locationId: "asteria_campus_exit",
      flags: {
        intro_complete: true,
        free_roam: true
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
