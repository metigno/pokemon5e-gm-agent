import { getStartingBuild } from "../../../src/bridge/motor-to-poke5e.mjs";
import { specializationByType, trainerProgression2024 } from "../rules/trainer-2024.mjs";
import { friendNpcCanon } from "../rules/friend-npc-canon.mjs";
import { initializeFriendCareerRoster } from "./npc-roster-progression.mjs";
import { DEFAULT_START_MINUTE, daypartForMinute } from "./time.mjs";
import { createPersistentNpc } from "./npc-state.mjs";
import { createCompetitionState } from "./competition-state.mjs";

export const GAME_STATE_SCHEMA_VERSION = 4;

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
  const p5eProgression = trainerProgression2024(level);
  return {
    trainerClass: "pokemon-trainer",
    trainerPath: null,
    trainerLevel: level,
    trainerXp: experienceNeededAtLevel(level),
    characterCreation: {
      ruleset: "2024",
      complete: false,
      required: ["specialization"],
      completed: []
    },
    trainerProgression: {
      mode: "milestone",
      history: [],
      pendingChoices: [],
      resolvedChoices: [],
      targetLevel: level,
      targetMilestoneId: null
    },
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
    specializationDetails: [],
    pokeslots: p5eProgression.pokeslots,
    maxSr: p5eProgression.maxSr,
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
  player.trainerProgression = ensureObject(player.trainerProgression, {
    mode: "milestone",
    history: [],
    pendingChoices: [],
    resolvedChoices: [],
    targetLevel: level,
    targetMilestoneId: null
  });
  player.trainerProgression.mode ??= "milestone";
  player.trainerProgression.history = ensureArray(player.trainerProgression.history);
  player.trainerProgression.pendingChoices = ensureArray(player.trainerProgression.pendingChoices);
  player.trainerProgression.resolvedChoices = ensureArray(player.trainerProgression.resolvedChoices);
  player.trainerProgression.targetLevel = Number.isInteger(player.trainerProgression.targetLevel)
    ? player.trainerProgression.targetLevel
    : level;
  player.trainerProgression.targetMilestoneId ??= null;
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
  player.specializations = Array.isArray(player.specializations)
    ? []
    : {
        ...defaultSpecializations(),
        ...ensureObject(player.specializations)
      };
  player.specializationDetails = ensureArray(player.specializationDetails);
  const migratedProgression = trainerProgression2024(level);
  player.pokeslots = Number.isInteger(player.pokeslots) ? player.pokeslots : migratedProgression.pokeslots;
  player.maxSr = Number.isInteger(player.maxSr) ? player.maxSr : migratedProgression.maxSr;
  const legacyIntroComplete = input.world?.flags?.intro_complete === true;
  player.characterCreation = ensureObject(player.characterCreation, {
    ruleset: "2024",
    complete: legacyIntroComplete,
    required: ["specialization"],
    completed: legacyIntroComplete ? ["legacy-grandfathered"] : []
  });
  player.characterCreation.ruleset ??= "2024";
  player.characterCreation.required = ensureArray(player.characterCreation.required, ["specialization"]);
  player.characterCreation.completed = ensureArray(player.characterCreation.completed);
  player.characterCreation.complete = Boolean(player.characterCreation.complete);
  state.world ??= {};
  state.world.flags ??= {};
  if (typeof state.world.flags.character_creation_complete !== "boolean") {
    state.world.flags.character_creation_complete = player.characterCreation.complete;
  }
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

const STARTER_SPECIALIZATION_BY_FRIEND = Object.freeze({
  Luke: "fire",
  Mattew: "electric",
  Daniel: "ghost",
  Edward: "water",
  Fab: "poison"
});

function starterSpecializationForFriend(name, build) {
  const specialization = STARTER_SPECIALIZATION_BY_FRIEND[name];
  if (!specialization) throw new Error("Missing starter specialization for canonical friend: " + name);
  if (!build?.starter?.species) throw new Error("Missing canonical starter for friend: " + name);
  return specialization;
}

function createRookieFriendNpc(name, playerName) {
  const build = getStartingBuild(name);
  const canon = friendNpcCanon(name, playerName);
  const npc = createPersistentNpc({
    id: name,
    name,
    state: {
      trainerLevel: 1,
      abilities: build.abilities,
      rankState: "F",
      teamStage: "rookie",
      starterSpecies: build.starter.species,
      starterForm: build.starter.form,
      starterLevel: build.starter.level,
      recentResult: "none",
      specializations: [starterSpecializationForFriend(name, build)],
      trainerPath: null,
      canonicalCareer: canon
    }
  });
  npc.canonicalCareer = structuredClone(canon);
  npc.rosterCareer = initializeFriendCareerRoster(npc);
  return npc;
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
      .map((name) => [name, createRookieFriendNpc(name, protagonist)])
  );
  const trainer = createTrainerRuntime(build, {
    inventory: startAtIntro
      ? ["Pokeball", "Pokeball", "Pokeball", "Pokeball", "Pokeball", "Potion", "Trainer License", "Pokedex"]
      : []
  });
  if (!startAtIntro) {
    trainer.characterCreation.complete = true;
    trainer.characterCreation.completed = ["legacy-bootstrap"];
    // Legacy/bootstrap entry has no player-selected specialization yet. Keep it explicitly unassigned;
    // canonical scripted specializations belong only to the Four non-player friends.
    trainer.specializations = [];
  }

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
      locationId: startAtIntro ? "asteria_campus" : "asteria_campus_exit",
      flags: {
        character_creation_complete: !startAtIntro,
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
      sceneId: startAtIntro ? "intro-m01" : "m01-release",
      nodeId: startAtIntro ? "trainer_specialization" : "free_roam",
      history: []
    },
    pending: null,
    lastRoll: null
  };
}

function displaySkillName(value) {
  return String(value)
    .split(/\s+/)
    .map((word, index) => index > 0 && ["of", "the"].includes(word.toLowerCase())
      ? word.toLowerCase()
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function completeTrainerCreation(state, { specialization } = {}) {
  if (!specialization || typeof specialization !== "string") {
    throw new Error("Pokemon 5e level-1 Trainer creation requires a specialization");
  }
  const spec = specializationByType(specialization);
  if (!spec) throw new Error("Unknown Pokemon 5e 2024 specialization: " + specialization);

  const next = structuredClone(state);
  if (!next.player.specializations || Array.isArray(next.player.specializations)) {
    next.player.specializations = defaultSpecializations();
  }
  for (const key of SPECIALIZATION_TYPES) next.player.specializations[key] ??= 0;
  next.player.specializations[spec.type] = Math.max(1, Number(next.player.specializations[spec.type] ?? 0));
  next.player.specializationDetails ??= [];
  if (!next.player.specializationDetails.some((entry) => entry.type === spec.type)) {
    next.player.specializationDetails.push({
      id: spec.id,
      name: spec.name,
      type: spec.type,
      effect: structuredClone(spec.effect)
    });
  }

  if (spec.effect.type === "proficiency") {
    const display = displaySkillName(spec.effect.value);
    next.player.skills ??= [];
    if (!next.player.skills.some((skill) => String(skill).toLowerCase() === display.toLowerCase())) {
      next.player.skills.push(display);
    }
    next.player.proficiencies ??= { skills: [], expertise: [] };
    next.player.proficiencies.skills ??= [];
    if (!next.player.proficiencies.skills.some((skill) => String(skill).toLowerCase() === display.toLowerCase())) {
      next.player.proficiencies.skills.push(display);
    }
  } else if (spec.effect.type === "asi") {
    const key = spec.effect.value.toUpperCase();
    if (!Number.isInteger(next.player.abilities?.[key])) {
      throw new Error("Missing Trainer ability for specialization ASI: " + key);
    }
    const beforeMod = abilityModifier(next.player.abilities[key]);
    next.player.abilities[key] = Math.min(20, next.player.abilities[key] + 1);
    const afterMod = abilityModifier(next.player.abilities[key]);
    if (key === "CON" && afterMod > beforeMod && next.player.hp) {
      const bonus = (afterMod - beforeMod) * Number(next.player.trainerLevel ?? 1);
      next.player.hp.max += bonus;
      next.player.hp.current = Math.min(next.player.hp.max, next.player.hp.current + bonus);
    }
  }

  const progression = trainerProgression2024(Number(next.player.trainerLevel ?? 1));
  next.player.pokeslots = progression.pokeslots;
  next.player.maxSr = progression.maxSr;
  next.player.characterCreation ??= { ruleset: "2024", required: ["specialization"], completed: [] };
  next.player.characterCreation.complete = true;
  next.player.characterCreation.completed = ["specialization"];
  next.world.flags.character_creation_complete = true;
  return next;
}

export function assertTrainerCreationComplete(state) {
  if (!state.player?.characterCreation?.complete || !state.world?.flags?.character_creation_complete) {
    throw new Error("Trainer character creation is incomplete: choose the level-1 Pokemon 5e specialization before starting M1");
  }
  return true;
}

export function touchState(state, now = () => new Date().toISOString()) {
  state.revision += 1;
  state.updatedAt = now();
  return state;
}
