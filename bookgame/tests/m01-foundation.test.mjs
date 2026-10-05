import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { CompiledSceneRepository } from "../src/engine/compiled-scene-repository.mjs";
import { compileStory, validateScene, validateWorldEventCatalog } from "../src/compiler/story-compiler.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { createNewGameState } from "../src/engine/state.mjs";
import { evaluateCondition, validateCondition } from "../src/engine/conditions.mjs";
import { advanceWorldTime, daypartForMinute, getWorldTimeView } from "../src/engine/time.mjs";
import { getQuestJournal, processQuestDeadlines, startQuest } from "../src/engine/quest-state.mjs";
import { adjustNpcRelationship, selectFriendBeatCandidate, setNpcSchedule } from "../src/engine/npc-state.mjs";
import { processWorldEvents } from "../src/engine/world-events.mjs";
import { registerTrial, setTrialAvailable } from "../src/engine/competition-state.mjs";
import { compileEcologyCatalog } from "../src/compiler/ecology-compiler.mjs";
import { ordinaryEncounterCandidates, selectOrdinaryEncounter } from "../src/engine/ecology.mjs";
import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../content/modules/", import.meta.url));
const ecologyProfilesDir = fileURLToPath(new URL("../content/ecology/", import.meta.url));
const zonePoolsFile = fileURLToPath(new URL("../../campaign/world/ecology/ZONE_POOLS.json", import.meta.url));
const distributionFile = fileURLToPath(new URL("../../campaign/world/ecology/SPECIES_DISTRIBUTION.json", import.meta.url));
const faunaIndexFile = fileURLToPath(new URL("../../campaign/world/fauna/ASTERIA_FAUNA_INDEX.json", import.meta.url));

const ecologyOptions = { profilesDir: ecologyProfilesDir, zonePoolsFile, distributionFile, faunaIndexFile };

test("M01 manifest locks the 5047 stitch / 3116 choice production budget", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir });
  const m1 = bundle.index.modules.M01;

  assert.equal(m1.targetStitches, 5047);
  assert.equal(m1.targetChoices, 3116);
  assert.ok(m1.implementedStitches > 0);
  assert.ok(m1.implementedChoices > 0);
});

test("compiler counts multiple stitches inside one logical node", () => {
  const report = validateScene({
    schemaVersion: 1,
    id: "stitch-test",
    title: "Stitch test",
    locationId: "test",
    nodes: {
      start: {
        stitches: [
          { id: "one", text: "One." },
          { id: "two", text: "Two." }
        ],
        choices: []
      }
    }
  });

  assert.equal(report.valid, true);
  assert.equal(report.metrics.nodes, 1);
  assert.equal(report.metrics.stitches, 2);
});

test("first-road can cross into the M01 multi-scene graph offline", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir });
  const repository = {
    async load(sceneId) {
      const scene = bundle.scenes[sceneId];
      if (!scene) throw new Error("missing scene " + sceneId);
      return structuredClone(scene);
    }
  };
  const engine = new BookgameEngine({ scenes: repository, dice: new SequenceDice([20]) });
  let state = createNewGameState({ protagonist: "Luke" });

  state.story.nodeId = "road_continue";
  state = await engine.choose(state, "reach_first_fork");

  assert.equal(state.story.sceneId, "m01-ginestre-crossroads");
  assert.equal(state.story.nodeId, "crossroads");

  const view = await engine.present(state);
  assert.equal(view.moduleId, "M01");
  assert.ok(view.stitches.length >= 2);
  assert.match(view.text, /Valedarsena/i);
});

test("cross-scene check outcome preserves target scene and node", async () => {
  const repository = {
    async load(sceneId) {
      if (sceneId === "source") {
        return {
          id: "source",
          title: "Source",
          nodes: {
            start: {
              text: "Test",
              choices: [
                {
                  id: "check",
                  text: "Check",
                  check: { ability: "WIS", dc: 10 },
                  outcomes: {
                    success: { goto: "target#done" },
                    failure: { goto: "target#fail" }
                  }
                }
              ]
            }
          }
        };
      }
      return {
        id: "target",
        title: "Target",
        nodes: {
          done: { text: "Done", choices: [] },
          fail: { text: "Fail", choices: [] }
        }
      };
    }
  };

  const engine = new BookgameEngine({ scenes: repository, dice: new SequenceDice([20]) });
  const state = createNewGameState({ protagonist: "Luke" });
  state.story.sceneId = "source";
  state.story.nodeId = "start";

  const next = await engine.choose(state, "check");
  assert.equal(next.story.sceneId, "target");
  assert.equal(next.story.nodeId, "done");
});


test("M01 production block budgets sum exactly to the module budget", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir });
  const blocks = bundle.index.modules.M01.blockTargets;

  assert.equal(blocks.length, 16);
  assert.equal(blocks.reduce((sum, block) => sum + block.targetStitches, 0), 5047);
  assert.equal(blocks.reduce((sum, block) => sum + block.targetChoices, 0), 3116);
  assert.equal(new Set(blocks.map((block) => block.id)).size, blocks.length);
});


test("E1 conditions evaluate fixed state paths and world flags without eval", () => {
  const state = createNewGameState({ protagonist: "Luke" });
  state.player.trainerLevel = 3;
  state.player.roster.push({ speciesId: "houndour" });
  state.world.day = 4;
  state.world.flags.current_rank = "F";
  state.world.flags.rank_trial_F_E_available = true;

  assert.equal(evaluateCondition(state, {
    all: [
      { path: "world.flags.current_rank", eq: "F" },
      { path: "player.trainerLevel", gte: 2 },
      { path: "player.roster.length", gte: 2 },
      { path: "world.day", gt: 3 },
      { path: "world.flags.rank_trial_F_E_available", eq: true }
    ]
  }), true);

  assert.equal(evaluateCondition(state, {
    any: [
      { path: "world.flags.blue_met", eq: true },
      { not: { path: "world.flags.blue_met", exists: true } }
    ]
  }), true);
});

test("E1 present hides unavailable choices and choose cannot bypass visibility", async () => {
  const repository = {
    async load() {
      return {
        id: "conditional-scene",
        title: "Conditional",
        nodes: {
          start: {
            text: "Choose.",
            choices: [
              { id: "always", text: "Always", goto: "done" },
              {
                id: "trial",
                text: "Register",
                conditions: {
                  all: [
                    { path: "world.flags.current_rank", eq: "F" },
                    { path: "player.roster.length", gte: 2 }
                  ]
                },
                goto: "done"
              }
            ]
          },
          done: { text: "Done.", choices: [] }
        }
      };
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  const state = createNewGameState({ protagonist: "Luke" });
  state.story.sceneId = "conditional-scene";
  state.story.nodeId = "start";
  state.world.flags.current_rank = "F";

  let view = await engine.present(state);
  assert.deepEqual(view.choices.map((choice) => choice.id), ["always"]);
  await assert.rejects(() => engine.choose(state, "trial"), /not currently available/);

  state.player.roster.push({ speciesId: "houndour" });
  view = await engine.present(state);
  assert.deepEqual(view.choices.map((choice) => choice.id), ["always", "trial"]);
});

test("E1 scene conditions guard illegal scene presentation", async () => {
  const repository = {
    async load() {
      return {
        id: "rank-e-only",
        title: "Rank E",
        conditions: { path: "world.flags.current_rank", eq: "E" },
        nodes: { start: { text: "Unlocked.", choices: [] } }
      };
    }
  };
  const engine = new BookgameEngine({ scenes: repository });
  const state = createNewGameState({ protagonist: "Luke" });
  state.story.sceneId = "rank-e-only";
  state.story.nodeId = "start";
  state.world.flags.current_rank = "F";

  await assert.rejects(() => engine.present(state), /Scene conditions are not satisfied/);
  state.world.flags.current_rank = "E";
  assert.equal((await engine.present(state)).text, "Unlocked.");
});

test("E1 compiler rejects unsafe paths and malformed logical groups", () => {
  const unsafe = validateCondition({
    all: [
      { path: "__proto__.polluted", eq: true },
      { path: "world.day", gte: "three" }
    ]
  });
  assert.ok(unsafe.some((error) => error.code === "INVALID_CONDITION_PATH"));
  assert.ok(unsafe.some((error) => error.code === "INVALID_CONDITION_VALUE"));

  const report = validateScene({
    schemaVersion: 1,
    id: "condition-invalid",
    title: "Invalid",
    locationId: "test",
    nodes: {
      start: {
        text: "Test",
        choices: [
          {
            id: "bad",
            text: "Bad",
            conditions: { all: [] },
            goto: "end"
          }
        ]
      },
      end: { text: "End", choices: [] }
    }
  });
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.code === "INVALID_CONDITION_GROUP"));
});


test("E2 new careers start on a deterministic local in-game clock", () => {
  const state = createNewGameState({ protagonist: "Luke" });
  assert.equal(state.world.day, 1);
  assert.equal(state.world.elapsedMinutes, 480);
  assert.equal(state.world.minuteOfDay, 480);
  assert.equal(state.world.time, "morning");
  assert.equal(getWorldTimeView(state.world).clock, "08:00");
});

test("E2 advancing time updates day, clock and time-of-day across midnight", () => {
  const world = {
    day: 1,
    elapsedMinutes: 23 * 60 + 50,
    minuteOfDay: 23 * 60 + 50,
    time: "evening",
    locationId: "test",
    flags: {}
  };

  advanceWorldTime(world, 20);
  assert.equal(world.day, 2);
  assert.equal(world.minuteOfDay, 10);
  assert.equal(world.time, "night");
  assert.equal(getWorldTimeView(world).clock, "00:10");

  assert.equal(daypartForMinute(5 * 60 + 59), "night");
  assert.equal(daypartForMinute(6 * 60), "morning");
  assert.equal(daypartForMinute(12 * 60), "afternoon");
  assert.equal(daypartForMinute(18 * 60), "evening");
});

test("E2 choice timeCostMinutes is consumed exactly once and recorded in history", async () => {
  const repository = {
    async load() {
      return {
        id: "time-scene",
        title: "Travel",
        nodes: {
          start: {
            text: "Road.",
            choices: [
              { id: "travel", text: "Travel.", timeCostMinutes: 70, goto: "done" }
            ]
          },
          done: { text: "Arrived.", choices: [] }
        }
      };
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  const state = createNewGameState({ protagonist: "Luke" });
  state.story.sceneId = "time-scene";
  state.story.nodeId = "start";

  const next = await engine.choose(state, "travel");
  assert.equal(next.world.elapsedMinutes, 550);
  assert.equal(next.world.minuteOfDay, 550);
  assert.equal(next.world.day, 1);
  assert.equal(next.story.history.at(-1).time.minutes, 70);
  assert.equal(next.story.history.at(-1).time.from.clock, "08:00");
  assert.equal(next.story.history.at(-1).time.to.clock, "09:10");
});

test("E2 compiler rejects invalid time costs", () => {
  const report = validateScene({
    schemaVersion: 1,
    id: "bad-time",
    title: "Bad time",
    locationId: "test",
    nodes: {
      start: {
        text: "Test",
        choices: [
          { id: "bad", text: "Bad", timeCostMinutes: -1, goto: "end" }
        ]
      },
      end: { text: "End", choices: [] }
    }
  });

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.code === "INVALID_TIME_COST"));
});

test("E2 conditions can use absolute and minute-of-day time safely", () => {
  const state = createNewGameState({ protagonist: "Luke" });
  state.world.elapsedMinutes = 14 * 60 + 30;
  state.world.minuteOfDay = 14 * 60 + 30;
  state.world.time = "afternoon";

  assert.equal(evaluateCondition(state, {
    all: [
      { path: "world.minuteOfDay", gte: 14 * 60 },
      { path: "world.minuteOfDay", lt: 15 * 60 },
      { path: "world.elapsedMinutes", gte: 800 }
    ]
  }), true);
});

test("M01 canonical Ginestre travel choices carry real topology time", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir });
  const crossroadsScene = bundle.scenes["m01-ginestre-crossroads"];
  const fork = crossroadsScene.nodes.crossroads;

  assert.equal(fork.choices.find((choice) => choice.id === "to_valedarsena").timeCostMinutes, 70);
  assert.equal(fork.choices.find((choice) => choice.id === "to_farm").timeCostMinutes, 70);

  const cityScene = bundle.scenes["m01-valedarsena-first-arrival"];
  assert.equal(cityScene.nodes.city_hub.choices.find((choice) => choice.id === "farm").timeCostMinutes, 140);
});


test("E3 quest_start creates durable active quest state and journal entry", async () => {
  const repository = {
    async load() {
      return {
        id: "quest-scene",
        title: "Quest",
        nodes: {
          start: {
            text: "Board.",
            choices: [{
              id: "accept",
              text: "Accept.",
              effects: [{
                type: "quest_start",
                questId: "QUEST_TEST",
                title: "Test Quest",
                objective: "Do the thing."
              }],
              goto: "done"
            }]
          },
          done: { text: "Done.", choices: [] }
        }
      };
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  const state = createNewGameState({ protagonist: "Luke" });
  state.story.sceneId = "quest-scene";
  state.story.nodeId = "start";

  const next = await engine.choose(state, "accept");
  assert.equal(next.quests.QUEST_TEST.status, "active");
  assert.equal(next.quests.QUEST_TEST.startedAtMinutes, 480);
  assert.equal(next.quests.QUEST_TEST.objective, "Do the thing.");
  assert.equal(getQuestJournal(next).active.length, 1);
});

test("E3 travel processes active quest deadlines and records off-screen outcome", async () => {
  const repository = {
    async load() {
      return {
        id: "deadline-scene",
        title: "Deadline",
        nodes: {
          start: {
            text: "Road.",
            choices: [{ id: "travel", text: "Travel.", timeCostMinutes: 70, goto: "done" }]
          },
          done: { text: "Arrived.", choices: [] }
        }
      };
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  const state = createNewGameState({ protagonist: "Luke" });
  state.story.sceneId = "deadline-scene";
  state.story.nodeId = "start";
  startQuest(state, {
    questId: "TIMED_TEST",
    deadlineMinutes: 60,
    onDeadline: {
      status: "completed",
      resolution: "completed_by_npc",
      resolvedBy: "world"
    }
  });

  const next = await engine.choose(state, "travel");
  assert.equal(next.quests.TIMED_TEST.status, "completed");
  assert.equal(next.quests.TIMED_TEST.resolution, "completed_by_npc");
  assert.equal(next.quests.TIMED_TEST.resolvedBy, "world");
  assert.equal(next.story.history.at(-1).questDeadlineEvents[0].questId, "TIMED_TEST");
});

test("E3 default active deadline failure does not freeze the world", () => {
  const state = createNewGameState({ protagonist: "Luke" });
  startQuest(state, { questId: "FAIL_TEST", deadlineMinutes: 30 });
  advanceWorldTime(state.world, 31);

  const events = processQuestDeadlines(state);
  assert.equal(events.length, 1);
  assert.equal(state.quests.FAIL_TEST.status, "failed");
  assert.equal(state.quests.FAIL_TEST.resolution, "deadline_expired");
});

test("E3 quest conditions expose only validated quest fields", () => {
  const state = createNewGameState({ protagonist: "Luke" });
  startQuest(state, { questId: "COND_TEST" });

  assert.equal(evaluateCondition(state, {
    path: "quests.COND_TEST.status",
    eq: "active"
  }), true);

  const invalid = validateCondition({
    path: "quests.COND_TEST.__proto__",
    exists: true
  });
  assert.ok(invalid.some((error) => error.code === "INVALID_CONDITION_PATH"));
});

test("E3 compiler rejects malformed quest effect deadline", () => {
  const report = validateScene({
    schemaVersion: 1,
    id: "bad-quest",
    title: "Bad quest",
    locationId: "test",
    nodes: {
      start: {
        text: "Test",
        choices: [{
          id: "bad",
          text: "Bad",
          effects: [{
            type: "quest_start",
            questId: "QUEST_BAD",
            deadlineMinutes: 0
          }],
          goto: "end"
        }]
      },
      end: { text: "End", choices: [] }
    }
  });

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.code === "INVALID_QUEST_DEADLINE"));
});

test("M01 farm and logistics jobs use structured E3 quest state", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir });
  const cityScene = bundle.scenes["m01-valedarsena-first-arrival"];
  const farmScene = bundle.scenes["m01-farm-first-arrival"];

  const farmBoard = cityScene.nodes.job_board.choices.find((choice) => choice.id === "farm_job");
  assert.equal(farmBoard.effects[0].type, "quest_start");
  assert.equal(farmBoard.effects[0].questId, "SQ_FARM_HERD_HANDS");

  const farmStart = farmScene.nodes.approach.choices.find((choice) => choice.id === "job");
  assert.ok(farmStart.effects.some((effect) => effect.type === "quest_start"));
  assert.equal(JSON.stringify(farmScene).includes("sq_farm_herd_hands_state"), false);
  assert.equal(JSON.stringify(cityScene).includes("m1_logistics_job_state"), false);
});


test("E4 new careers contain persistent Four friends and Blue without future achievements", () => {
  const state = createNewGameState({ protagonist: "Luke" });
  assert.deepEqual(Object.keys(state.npcs).sort(), ["Blue", "Daniel", "Edward", "Fab", "Mattew"]);
  assert.equal(state.npcs.Mattew.relationship.qualitative, "Neutral");
  assert.equal(state.npcs.Blue.state.met, false);
  assert.equal(state.npcs.Blue.state.rankState, "F");
  assert.equal(state.npcs.Blue.state.teamStage, "rookie");
  assert.equal(state.npcs.Blue.schedule, null);
});

test("E4 relationship score stays hidden internally but derives qualitative state", () => {
  const state = createNewGameState({ protagonist: "Luke" });

  adjustNpcRelationship(state, { npcId: "Blue", delta: 25 });
  assert.equal(state.npcs.Blue.relationship.score, 25);
  assert.equal(state.npcs.Blue.relationship.qualitative, "Friendly");

  adjustNpcRelationship(state, { npcId: "Blue", delta: -100 });
  assert.equal(state.npcs.Blue.relationship.score, -75);
  assert.equal(state.npcs.Blue.relationship.qualitative, "Hostile");
});

test("E4 schedule presence follows E2 absolute time window", () => {
  const state = createNewGameState({ protagonist: "Luke" });
  state.world.elapsedMinutes = 600;
  state.world.minuteOfDay = 600;
  state.world.time = "morning";

  setNpcSchedule(state, {
    npcId: "Blue",
    scheduleId: "blue_test",
    locationId: "valedarsena_arena",
    availability: "available",
    startsAtMinutes: 540,
    endsAtMinutes: 720
  });
  assert.equal(state.npcs.Blue.schedule.present, true);

  advanceWorldTime(state.world, 121);
  // Selector refreshes schedules before evaluating candidates.
  selectFriendBeatCandidate(state, { candidateIds: ["Blue"], locationId: "valedarsena_arena" });
  assert.equal(state.npcs.Blue.schedule.present, false);
});

test("E4 FRIEND_BEAT selector uses actual schedule, location and relationship", () => {
  const state = createNewGameState({ protagonist: "Luke" });
  state.world.locationId = "asteria_farm";

  setNpcSchedule(state, {
    npcId: "Mattew",
    scheduleId: "mattew_farm",
    locationId: "asteria_farm",
    availability: "available"
  });
  setNpcSchedule(state, {
    npcId: "Daniel",
    scheduleId: "daniel_city",
    locationId: "valedarsena_city",
    availability: "available"
  });
  setNpcSchedule(state, {
    npcId: "Edward",
    scheduleId: "edward_farm",
    locationId: "asteria_farm",
    availability: "available"
  });
  adjustNpcRelationship(state, { npcId: "Edward", delta: 20 });

  assert.equal(selectFriendBeatCandidate(state), "Edward");

  state.npcs.Edward.schedule.availability = "busy";
  assert.equal(selectFriendBeatCandidate(state), "Mattew");
});

test("E4 conditions can read safe NPC schedule, relationship and state fields", () => {
  const state = createNewGameState({ protagonist: "Luke" });
  setNpcSchedule(state, {
    npcId: "Blue",
    scheduleId: "blue_arena",
    locationId: "valedarsena_arena",
    availability: "available"
  });
  state.npcs.Blue.state.met = true;

  assert.equal(evaluateCondition(state, {
    all: [
      { path: "npcs.Blue.schedule.present", eq: true },
      { path: "npcs.Blue.schedule.locationId", eq: "valedarsena_arena" },
      { path: "npcs.Blue.relationship.qualitative", eq: "Neutral" },
      { path: "npcs.Blue.state.met", eq: true }
    ]
  }), true);
});

test("E4 compiler rejects malformed NPC schedule effects", () => {
  const report = validateScene({
    schemaVersion: 1,
    id: "bad-npc",
    title: "Bad NPC",
    locationId: "test",
    nodes: {
      start: {
        text: "Test",
        choices: [{
          id: "bad",
          text: "Bad",
          effects: [{
            type: "npc_schedule_set",
            npcId: "Blue",
            scheduleId: "bad",
            locationId: "arena",
            startsAtMinutes: 100,
            endsAtMinutes: 90
          }],
          goto: "end"
        }]
      },
      end: { text: "End", choices: [] }
    }
  });

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.code === "INVALID_NPC_SCHEDULE_WINDOW"));
});


test("E6 compiler includes canonical A1_WORLD_MOVES in offline bundle", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir });
  assert.equal(bundle.index.worldEventCount >= 1, true);
  const event = bundle.worldEvents.find((entry) => entry.id === "A1_WORLD_MOVES");
  assert.ok(event);
  assert.equal(event.once, true);
  assert.equal(event.moduleId, "M01");
});

test("E6 A1_WORLD_MOVES fires when first settlement is reached and only once", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir });
  const repository = {
    async load(sceneId) {
      return structuredClone(bundle.scenes[sceneId]);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents);
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  let state = createNewGameState({ protagonist: "Luke" });
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "approach";

  state = await engine.choose(state, "enter_center");
  assert.equal(state.events.A1_WORLD_MOVES.status, "resolved");
  assert.equal(state.events.A1_WORLD_MOVES.outcomeId, "pressure_unnoticed");
  assert.equal(state.world.flags.m1_world_pressure_state, "pressure_unnoticed");
  assert.equal(state.story.history.at(-1).worldEvents.length, 1);

  state.story.nodeId = "center";
  state = await engine.choose(state, "back_city");
  assert.equal(state.story.history.at(-1).worldEvents, undefined);
});

test("E6 A1_WORLD_MOVES selects noticed outcome when evidence was already found", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir });
  const repository = {
    async load() {
      return {
        id: "event-test",
        title: "Event test",
        nodes: {
          start: {
            text: "Continue.",
            choices: [{ id: "continue", text: "Continue.", goto: "done" }]
          },
          done: { text: "Done.", choices: [] }
        }
      };
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents);
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  let state = createNewGameState({ protagonist: "Luke" });
  state.story.sceneId = "event-test";
  state.story.nodeId = "start";
  state.world.flags.m1_world_pressure_known = true;
  state.world.elapsedMinutes = (2 * 24 * 60) + 480;
  state.world.day = 3;
  state.world.minuteOfDay = 480;
  state.world.time = "morning";

  state = await engine.choose(state, "continue");
  assert.equal(state.events.A1_WORLD_MOVES.outcomeId, "pressure_already_noticed");
  assert.equal(state.world.flags.m1_world_pressure_state, "pressure_noticed");
});

test("E6 authored off-screen event may update persistent NPC schedule after time passes", async () => {
  const worldEvents = [{
    id: "TEST_NPC_MOVES",
    once: true,
    trigger: { path: "world.elapsedMinutes", "gte": 540 },
    outcomes: [{
      id: "blue_moves",
      effects: [{
        type: "npc_schedule_set",
        npcId: "Blue",
        scheduleId: "blue_test_move",
        locationId: "valedarsena_arena",
        availability: "available",
        activity: "registration"
      }]
    }]
  }];

  const repository = {
    async load() {
      return {
        id: "travel-test",
        title: "Travel",
        nodes: {
          start: {
            text: "Travel.",
            choices: [{ id: "go", text: "Go.", timeCostMinutes: 60, goto: "done" }]
          },
          done: { text: "Done.", choices: [] }
        }
      };
    }
  };

  const engine = new BookgameEngine({ scenes: repository, worldEvents });
  let state = createNewGameState({ protagonist: "Luke" });
  state.story.sceneId = "travel-test";
  state.story.nodeId = "start";

  state = await engine.choose(state, "go");
  assert.equal(state.events.TEST_NPC_MOVES.status, "resolved");
  assert.equal(state.npcs.Blue.schedule.id, "blue_test_move");
  assert.equal(state.npcs.Blue.schedule.locationId, "valedarsena_arena");
});

test("E6 event processor can resolve authored quest consequences off-screen", () => {
  const state = createNewGameState({ protagonist: "Luke" });
  startQuest(state, { questId: "OFFSCREEN_QUEST" });
  state.world.flags.resolve_offscreen = true;

  const events = [{
    id: "OFFSCREEN_RESOLUTION",
    once: true,
    trigger: { path: "world.flags.resolve_offscreen", eq: true },
    outcomes: [{
      id: "npc_completed",
      effects: [{
        type: "quest_complete",
        questId: "OFFSCREEN_QUEST",
        resolution: "completed_by_npc"
      }]
    }]
  }];

  const fired = processWorldEvents(state, events, (eventState, effects) => {
    for (const effect of effects) {
      if (effect.type === "quest_complete") {
        eventState.quests[effect.questId].status = "completed";
        eventState.quests[effect.questId].resolution = effect.resolution;
        eventState.quests[effect.questId].resolvedBy = "world";
      }
    }
  });

  assert.equal(fired.length, 1);
  assert.equal(state.quests.OFFSCREEN_QUEST.status, "completed");
  assert.equal(state.events.OFFSCREEN_RESOLUTION.outcomeId, "npc_completed");
});

test("E6 compiler rejects malformed event fallback ordering and unsafe trigger paths", () => {
  const report = validateWorldEventCatalog({
    schemaVersion: 1,
    events: [{
      id: "BAD_EVENT",
      trigger: { path: "unsafe.private.value", eq: true },
      outcomes: [
        { id: "fallback", effects: [] },
        { id: "later", when: { path: "world.day", gte: 2 }, effects: [] }
      ]
    }]
  });

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.code === "INVALID_CONDITION_PATH"));
  assert.ok(report.errors.some((error) => error.code === "WORLD_EVENT_FALLBACK_ORDER"));
});


test("E5 new careers start at Circuit Rank F with no invented Trial completion", () => {
  const state = createNewGameState({ protagonist: "Luke" });
  assert.equal(state.competition.rank, "F");
  assert.equal(state.competition.rankOrder, 0);
  assert.equal(state.competition.firstOfficialResolved, false);
  assert.deepEqual(state.competition.trials, {});
  assert.deepEqual(state.competition.history, []);
});

test("E5 Trial registration enforces the real two-Pokemon roster requirement", () => {
  const state = createNewGameState({ protagonist: "Luke" });
  setTrialAvailable(state, {
    checkpointId: "RANK_F_TO_E",
    fromRank: "F",
    toRank: "E",
    requiredRosterSize: 2,
    retryable: true
  });

  assert.equal(state.competition.trials.RANK_F_TO_E.available, true);
  assert.throws(
    () => registerTrial(state, { checkpointId: "RANK_F_TO_E" }),
    /requires roster size 2/
  );

  state.player.roster.push({ speciesId: "houndour", level: 3 });
  registerTrial(state, { checkpointId: "RANK_F_TO_E" });
  assert.equal(state.competition.trials.RANK_F_TO_E.registered, true);
});

test("E5 first official match records real resolver result without acting as a rank gate", async () => {
  const repository = {
    async load() {
      return {
        id: "official-test",
        title: "Official",
        nodes: {
          start: {
            text: "Match.",
            choices: [{
              id: "fight",
              text: "Fight.",
              combat: {
                encounterId: "OFFICIAL_TEST_001",
                opponent: { species: "Eevee", level: 1 },
                opponentRegistered: true,
                goto: "handoff",
                returnNodes: { win: "win", lose: "lose" },
                competition: {
                  type: "official_match",
                  matchId: "A1_FIRST_OFFICIAL",
                  format: "Singles",
                  officialRosterSize: 1,
                  difficulty: "STANDARD",
                  firstOfficial: true
                }
              }
            }]
          },
          handoff: { text: "Resolver.", choices: [] },
          win: { text: "Win.", choices: [] },
          lose: { text: "Lose.", choices: [] }
        }
      };
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  let state = createNewGameState({ protagonist: "Luke" });
  state.story.sceneId = "official-test";
  state.story.nodeId = "start";

  state = await engine.choose(state, "fight");
  assert.equal(state.pending.opponentRegistered, true);
  assert.equal(state.competition.activeMatch.matchId, "A1_FIRST_OFFICIAL");

  state = engine.resolveCombatHandoff(state, "lose");
  assert.equal(state.competition.firstOfficialResolved, true);
  assert.equal(state.competition.rank, "F");
  assert.equal(state.competition.history.at(-1).outcome, "lose");
});

test("E5 Promotion Trial loss stays F and retry win promotes to E", async () => {
  const repository = {
    async load() {
      return {
        id: "trial-test",
        title: "Trial",
        nodes: {
          start: {
            text: "Trial.",
            choices: [{
              id: "fight",
              text: "Fight.",
              combat: {
                encounterId: "TRIAL_TEST_001",
                opponent: { species: "Houndour", level: 3 },
                opponentRegistered: true,
                goto: "handoff",
                returnNodes: { win: "win", lose: "lose" },
                competition: {
                  type: "promotion_trial",
                  matchId: "RANK_F_TO_E_TEST",
                  checkpointId: "RANK_F_TO_E",
                  fromRank: "F",
                  toRank: "E",
                  format: "Singles",
                  officialRosterSize: 2,
                  difficulty: "HARD",
                  retryable: true
                }
              }
            }]
          },
          handoff: { text: "Resolver.", choices: [] },
          win: { text: "Win.", choices: [] },
          lose: { text: "Lose.", choices: [] }
        }
      };
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  let state = createNewGameState({ protagonist: "Luke" });
  state.story.sceneId = "trial-test";
  state.story.nodeId = "start";
  state.player.roster.push({ speciesId: "houndour", level: 3 });

  setTrialAvailable(state, {
    checkpointId: "RANK_F_TO_E",
    fromRank: "F",
    toRank: "E",
    requiredRosterSize: 2,
    retryable: true
  });
  registerTrial(state, { checkpointId: "RANK_F_TO_E" });

  state = await engine.choose(state, "fight");
  assert.equal(state.competition.trials.RANK_F_TO_E.attempts, 1);
  state = engine.resolveCombatHandoff(state, "lose");
  assert.equal(state.competition.rank, "F");
  assert.equal(state.competition.trials.RANK_F_TO_E.lastResult, "lose");
  assert.equal(state.competition.trials.RANK_F_TO_E.available, true);
  assert.equal(state.competition.trials.RANK_F_TO_E.registered, false);

  state.story.sceneId = "trial-test";
  state.story.nodeId = "start";
  registerTrial(state, { checkpointId: "RANK_F_TO_E" });
  state = await engine.choose(state, "fight");
  state = engine.resolveCombatHandoff(state, "win");

  assert.equal(state.competition.trials.RANK_F_TO_E.attempts, 2);
  assert.equal(state.competition.trials.RANK_F_TO_E.bestResult, "win");
  assert.equal(state.competition.trials.RANK_F_TO_E.completed, true);
  assert.equal(state.competition.rank, "E");
  assert.equal(state.competition.rankOrder, 1);
});

test("E5 compiler rejects competitive capture branches and malformed metadata", () => {
  const report = validateScene({
    schemaVersion: 1,
    id: "bad-competition",
    title: "Bad competition",
    locationId: "test",
    nodes: {
      start: {
        text: "Test",
        choices: [{
          id: "fight",
          text: "Fight",
          combat: {
            encounterId: "BAD_OFFICIAL",
            opponent: { species: "Eevee", level: 1 },
            opponentRegistered: false,
            goto: "handoff",
            returnNodes: { win: "win", lose: "lose", captured: "captured" },
            competition: {
              type: "official_match",
              matchId: "BAD_MATCH",
              format: "Doubles",
              officialRosterSize: 0,
              difficulty: "STANDARD"
            }
          }
        }]
      },
      handoff: { text: "Handoff", choices: [] },
      win: { text: "Win", choices: [] },
      lose: { text: "Lose", choices: [] },
      captured: { text: "Captured", choices: [] }
    }
  });

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.code === "INVALID_COMPETITION_FORMAT"));
  assert.ok(report.errors.some((error) => error.code === "INVALID_OFFICIAL_ROSTER_SIZE"));
  assert.ok(report.errors.some((error) => error.code === "COMPETITION_OPPONENT_MUST_BE_REGISTERED"));
  assert.ok(report.errors.some((error) => error.code === "INVALID_COMPETITION_CAPTURE_OUTCOME"));
});

test("M01 Arena uses structured E5 Trial state instead of rank flags", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir });
  const scene = bundle.scenes["m01-valedarsena-first-arrival"];
  const arena = scene.nodes.arena_front;
  const note = arena.choices.find((choice) => choice.id === "note_trial");
  const register = arena.choices.find((choice) => choice.id === "register_trial");

  assert.ok(note.effects.some((effect) => effect.type === "competition_trial_available"));
  assert.ok(register.effects.some((effect) => effect.type === "competition_trial_register"));
  assert.equal(JSON.stringify(arena).includes("rank_trial_F_E_available"), false);
  assert.equal(JSON.stringify(arena).includes('"current_rank"'), false);
});


test("E7 compiles M01 ecology from authoritative Agent runtime data", async () => {
  const report = await compileEcologyCatalog(ecologyOptions);
  assert.equal(report.valid, true);
  assert.deepEqual(report.errors, []);

  const ecology = report.catalog;
  assert.equal(ecology.weights.common, 100);
  assert.equal(ecology.weights.uncommon, 45);
  assert.equal(ecology.weights.rare, 15);
  assert.equal(ecology.weights.very_rare, 5);
  assert.equal(ecology.weights.exceptional, 1);
  assert.equal(ecology.weights.protected_rare, 2);
  assert.equal(ecology.weights.protected_very_rare, 1);

  assert.deepEqual(Object.keys(ecology.zones).sort(), [
    "AST-FARM",
    "AST-GINESTRE",
    "VAL-CITY",
    "VAL-WAREHOUSES"
  ]);
});

test("E7 ordinary selector filters by canonical zone, habitat and in-game activity", async () => {
  const { catalog } = await compileEcologyCatalog(ecologyOptions);
  const state = createNewGameState({ protagonist: "Luke" });

  const candidates = ordinaryEncounterCandidates(state, catalog, {
    zoneId: "AST-GINESTRE",
    habitat: "field",
    method: "wild_observation",
    allowedSpecies: ["wooloo", "shinx"]
  });

  assert.deepEqual(candidates.map((entry) => entry.id).sort(), ["shinx", "wooloo"]);
  assert.ok(candidates.every((entry) => entry.weight === 100));
});

test("E7 preserves relative rarity after authored habitat filtering", async () => {
  const { catalog } = await compileEcologyCatalog(ecologyOptions);
  const state = createNewGameState({ protagonist: "Luke" });

  const candidates = ordinaryEncounterCandidates(state, catalog, {
    zoneId: "AST-FARM",
    habitat: "grassland",
    method: "wild_observation",
    allowedSpecies: ["wooloo", "shinx", "growlithe-hisui"]
  });
  const weights = Object.fromEntries(candidates.map((entry) => [entry.id, entry.weight]));

  assert.equal(weights.wooloo, 100);
  assert.equal(weights.shinx, 100);
  assert.equal(weights["growlithe-hisui"], 15);

  const rareFirst = selectOrdinaryEncounter(state, catalog, {
    requestId: "TEST_FARM",
    zoneId: "AST-FARM",
    habitat: "grassland",
    method: "wild_observation",
    allowedSpecies: ["wooloo", "shinx", "growlithe-hisui"]
  }, new SequenceDice([1]));

  assert.equal(rareFirst.speciesId, "growlithe-hisui");
  assert.equal(rareFirst.capturable, true);
  assert.equal(rareFirst.alphaBetaRole, null);
});

test("E7 compiled ordinary zones never contain special encounter classes", async () => {
  const { catalog } = await compileEcologyCatalog(ecologyOptions);
  const forbidden = new Set([
    "legendary",
    "legendary_paradox_future",
    "legendary_paradox_past",
    "mythical",
    "paleo_restricted",
    "paradox_future",
    "paradox_past",
    "ultra_beast",
    "unique_special"
  ]);

  for (const zone of Object.values(catalog.zones)) {
    assert.equal(zone.species.some((entry) => forbidden.has(entry.distributionClass)), false);
  }
});

test("E7 story bundle embeds ecology and routes a wildlife choice offline", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir, ecologyOptions });
  assert.equal(bundle.index.ecologyZoneCount, 4);
  assert.ok(bundle.index.ecologySpeciesCount > 0);

  const repository = {
    async load(sceneId) {
      return structuredClone(bundle.scenes[sceneId]);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents);
    },
    async loadEcology() {
      return structuredClone(bundle.ecology);
    }
  };

  const engine = new BookgameEngine({ scenes: repository, dice: new SequenceDice([1]) });
  let state = createNewGameState({ protagonist: "Luke" });
  state.story.sceneId = "m01-ginestre-crossroads";
  state.story.nodeId = "crossroads";

  state = await engine.choose(state, "observe_wildlife");
  assert.equal(state.ecology.history.length, 1);
  assert.equal(state.ecology.lastEncounter.zoneId, "AST-GINESTRE");
  assert.equal(["wooloo", "shinx"].includes(state.ecology.lastEncounter.speciesId), true);
  assert.equal(state.ecology.lastEncounter.capturable, true);
  assert.equal(state.ecology.lastEncounter.alphaBetaRole, null);
  assert.equal(state.story.sceneId, "m01-ecology-opportunities");
});

test("E7 M01 executable fauna can enter the real offline Pokémon 5e combat core", async () => {
  const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([10, 10, 10, 10, 10, 10]) });

  const wooloo = await combat.createCombatant({ species: "Wooloo", level: 1, abilityId: "run-away" });
  assert.equal(wooloo.speciesId, "wooloo");
  assert.ok(wooloo.moveIds.includes("tackle"));

  const shinx = await combat.createCombatant({ species: "Shinx", level: 1, abilityId: "intimidate" });
  assert.equal(shinx.speciesId, "shinx");
  assert.ok(shinx.moveIds.includes("tackle"));

  const growlithe = await combat.createCombatant({ species: "Growlithe", form: "Hisuian", level: 1, abilityId: "intimidate" });
  assert.equal(growlithe.speciesId, "growlithe-hisui");
});

test("E7 M01 ecology choices map only species valid in the compiled canonical zone", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir, ecologyOptions });
  const gin = bundle.scenes["m01-ginestre-crossroads"].nodes.crossroads.choices.find((choice) => choice.id === "observe_wildlife");
  const farm = bundle.scenes["m01-farm-first-arrival"].nodes.approach.choices.find((choice) => choice.id === "field_wildlife");

  assert.deepEqual(gin.ecology.allowedSpecies, ["wooloo", "shinx"]);
  assert.deepEqual(farm.ecology.allowedSpecies, ["wooloo", "shinx", "growlithe-hisui"]);

  const ginValid = new Set(bundle.ecology.zones["AST-GINESTRE"].species.map((entry) => entry.id));
  const farmValid = new Set(bundle.ecology.zones["AST-FARM"].species.map((entry) => entry.id));
  assert.ok(gin.ecology.allowedSpecies.every((id) => ginValid.has(id)));
  assert.ok(farm.ecology.allowedSpecies.every((id) => farmValid.has(id)));
});


test("M1_10 First Official is a real sanctioned match and a loss does not block Rank F", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir, ecologyOptions });
  const scene = bundle.scenes["m01-valedarsena-first-arrival"];
  const arenaChoice = scene.nodes.arena_front.choices.find((choice) => choice.id === "first_official");

  assert.ok(arenaChoice);
  assert.equal(arenaChoice.conditions.all.some((condition) => condition.path === "player.trainerLevel" && condition.gte === 2), true);

  const offer = scene.nodes.first_official_offer;
  const fight = offer.choices.find((choice) => choice.id === "accept_first_official");
  assert.equal(fight.combat.opponentRegistered, true);
  assert.deepEqual(fight.combat.returnNodes, {
    win: "first_official_win",
    lose: "first_official_loss"
  });
  assert.deepEqual(fight.combat.competition, {
    type: "official_match",
    matchId: "A1_FIRST_OFFICIAL",
    format: "Singles",
    officialRosterSize: 1,
    difficulty: "STANDARD",
    firstOfficial: true
  });

  const repository = {
    async load(sceneId) {
      return structuredClone(bundle.scenes[sceneId]);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents);
    },
    async loadEcology() {
      return structuredClone(bundle.ecology);
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  let state = createNewGameState({ protagonist: "Luke" });
  state.player.trainerLevel = 2;
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "arena_front";

  state = await engine.choose(state, "first_official");
  assert.equal(state.story.nodeId, "first_official_offer");

  state = await engine.choose(state, "accept_first_official");
  assert.equal(state.competition.activeMatch.matchId, "A1_FIRST_OFFICIAL");
  assert.equal(state.pending.opponentRegistered, true);

  state = engine.resolveCombatHandoff(state, "lose");
  assert.equal(state.competition.firstOfficialResolved, true);
  assert.equal(state.competition.rank, "F");
  assert.equal(state.competition.history.at(-1).outcome, "lose");
  assert.equal(state.story.nodeId, "first_official_loss");
});


test("M1_11 roster preparation exposes multiple legal capture routes without gifts or loans", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir, ecologyOptions });
  const city = bundle.scenes["m01-valedarsena-first-arrival"];
  const prepChoice = city.nodes.arena_front.choices.find((choice) => choice.id === "roster_preparation");
  assert.ok(prepChoice);
  assert.deepEqual(prepChoice.conditions, { path: "player.roster.length", eq: 1 });

  const prep = city.nodes.roster_preparation;
  assert.ok(prep.choices.some((choice) => choice.id === "seek_ginestre"));
  assert.ok(prep.choices.some((choice) => choice.id === "seek_farm"));
  assert.ok(prep.choices.some((choice) => choice.id === "stay_one"));

  const text = JSON.stringify(prep).toLowerCase();
  assert.equal(text.includes("prestito"), true);
  assert.equal(text.includes("regalo"), true);

  const gin = bundle.scenes["m01-ginestre-crossroads"].nodes.crossroads
    .choices.find((choice) => choice.id === "observe_wildlife");
  const farm = bundle.scenes["m01-farm-first-arrival"].nodes.approach
    .choices.find((choice) => choice.id === "field_wildlife");

  assert.deepEqual(gin.ecology.allowedSpecies, ["wooloo", "shinx"]);
  assert.deepEqual(farm.ecology.allowedSpecies, ["wooloo", "shinx", "growlithe-hisui"]);

  const houndour = bundle.scenes["first-road"].nodes;
  const houndourCaptureRoutes = Object.values(houndour)
    .flatMap((node) => node.choices ?? [])
    .filter((choice) => choice.combat?.encounterId === "HOUNDOUR_GINESTRE_001");
  assert.ok(houndourCaptureRoutes.length > 0);
  assert.ok(houndourCaptureRoutes.every((choice) => choice.combat.returnNodes.captured));
});

test("M1_11 first successful wild capture persists roster size two and second Pokemon identity", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir, ecologyOptions });
  const repository = {
    async load(sceneId) {
      return structuredClone(bundle.scenes[sceneId]);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents);
    },
    async loadEcology() {
      return structuredClone(bundle.ecology);
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  let state = createNewGameState({ protagonist: "Luke" });
  state.story.sceneId = "m01-ecology-opportunities";
  state.story.nodeId = "farm_hisuian_growlithe";

  state = await engine.choose(state, "engage");
  assert.equal(state.pending.encounterId, "M1_FARM_HISUI_GROWLITHE_001");

  state = engine.setCombatState(state, {
    encounterId: "M1_FARM_HISUI_GROWLITHE_001",
    outcome: "captured",
    opponent: {
      speciesId: "growlithe-hisui",
      name: "Growlithe",
      level: 1,
      hp: { current: 4, max: 9 },
      statuses: { nonVolatile: null, volatile: [] },
      abilityId: "intimidate",
      moveIds: ["tackle"],
      pp: { tackle: 20 }
    }
  });

  state = engine.resolveCombatHandoff(state, "captured");

  assert.equal(state.player.roster.length, 2);
  assert.equal(state.player.roster[1].speciesId, "growlithe-hisui");
  assert.deepEqual(state.player.secondPokemonAcquisition, {
    speciesId: "growlithe-hisui",
    name: "Growlithe",
    level: 1,
    day: state.world.day,
    locationId: state.world.locationId,
    encounterId: "M1_FARM_HISUI_GROWLITHE_001"
  });

  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "arena_front";
  const view = await engine.present(state);
  assert.equal(view.choices.some((choice) => choice.id === "roster_preparation"), false);
});

test("M1_11 player may remain with one Pokemon and Trial registration stays unavailable", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir, ecologyOptions });
  const repository = {
    async load(sceneId) {
      return structuredClone(bundle.scenes[sceneId]);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents);
    },
    async loadEcology() {
      return structuredClone(bundle.ecology);
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  let state = createNewGameState({ protagonist: "Luke" });
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "arena_front";
  state.competition.trials.RANK_F_TO_E = {
    available: true,
    registered: false,
    attempts: 0,
    bestResult: null,
    completed: false,
    fromRank: "F",
    toRank: "E",
    requiredRosterSize: 2,
    retryable: true
  };

  const view = await engine.present(state);
  assert.equal(state.player.roster.length, 1);
  assert.equal(view.choices.some((choice) => choice.id === "register_trial"), false);
  assert.equal(view.choices.some((choice) => choice.id === "trial_roster_missing"), true);
  assert.equal(view.choices.some((choice) => choice.id === "roster_preparation"), true);
});


test("M1_13 registration desk exposes the full authored choice set and mechanical gate", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir, ecologyOptions });
  const repository = {
    async load(sceneId) {
      return structuredClone(bundle.scenes[sceneId]);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents);
    },
    async loadEcology() {
      return structuredClone(bundle.ecology);
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  let state = createNewGameState({ protagonist: "Luke" });
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "arena_front";

  state = await engine.choose(state, "note_trial");
  assert.equal(state.story.nodeId, "trial_registration_desk");
  assert.equal(state.competition.trials.RANK_F_TO_E.available, true);
  assert.equal(state.competition.trials.RANK_F_TO_E.requiredRosterSize, 2);

  let view = await engine.present(state);
  assert.equal(view.choices.some((choice) => choice.id === "register"), false);
  assert.equal(view.choices.some((choice) => choice.id === "missing_roster"), true);
  assert.equal(view.choices.some((choice) => choice.id === "heal_prepare"), true);
  assert.equal(view.choices.some((choice) => choice.id === "postpone"), true);
  assert.equal(view.choices.some((choice) => choice.id === "free_roam"), true);

  await assert.rejects(
    () => engine.choose(state, "register"),
    /not currently available/
  );
});

test("M1_13 eligible roster registers persistently and preparation does not cancel entry", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir, ecologyOptions });
  const repository = {
    async load(sceneId) {
      return structuredClone(bundle.scenes[sceneId]);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents);
    },
    async loadEcology() {
      return structuredClone(bundle.ecology);
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  let state = createNewGameState({ protagonist: "Luke" });
  state.player.roster.push({
    speciesId: "houndour",
    name: "Houndour",
    level: 1
  });
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "arena_front";

  state = await engine.choose(state, "note_trial");
  let view = await engine.present(state);
  assert.equal(view.choices.some((choice) => choice.id === "register"), true);
  assert.equal(view.choices.some((choice) => choice.id === "missing_roster"), false);

  const registeredAt = state.world.elapsedMinutes;
  state = await engine.choose(state, "register");

  assert.equal(state.story.nodeId, "trial_registered");
  assert.equal(state.competition.rank, "F");
  assert.equal(state.competition.trials.RANK_F_TO_E.registered, true);
  assert.equal(state.competition.trials.RANK_F_TO_E.registeredAtMinutes, registeredAt);
  assert.equal(state.competition.trials.RANK_F_TO_E.attempts, 0);

  state = await engine.choose(state, "heal_prepare");
  assert.equal(state.story.nodeId, "center");
  assert.equal(state.competition.trials.RANK_F_TO_E.registered, true);
  assert.equal(state.competition.trials.RANK_F_TO_E.attempts, 0);

  state.story.nodeId = "arena_front";
  view = await engine.present(state);
  assert.equal(view.choices.some((choice) => choice.id === "register_trial"), false);
  assert.equal(view.choices.some((choice) => choice.id === "trial_registration_status"), true);
});

test("M1_13 registration never promotes Rank or starts a Trial attempt by itself", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir, ecologyOptions });
  const repository = {
    async load(sceneId) {
      return structuredClone(bundle.scenes[sceneId]);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents);
    },
    async loadEcology() {
      return structuredClone(bundle.ecology);
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  let state = createNewGameState({ protagonist: "Luke" });
  state.player.roster.push({ speciesId: "shinx", name: "Shinx", level: 1 });
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "arena_front";

  state = await engine.choose(state, "note_trial");
  state = await engine.choose(state, "register");

  assert.equal(state.competition.rank, "F");
  assert.equal(state.competition.rankOrder, 0);
  assert.equal(state.competition.activeMatch, null);
  assert.equal(state.competition.history.length, 0);
  assert.equal(state.competition.trials.RANK_F_TO_E.attempts, 0);
  assert.equal(state.competition.trials.RANK_F_TO_E.completed, false);
});


test("M1_14 authored gate uses the real two-Pokemon official rosters", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir, ecologyOptions });
  const repository = {
    async load(sceneId) {
      return structuredClone(bundle.scenes[sceneId]);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents);
    },
    async loadEcology() {
      return structuredClone(bundle.ecology);
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  let state = createNewGameState({ protagonist: "Luke" });
  state.player.trainerLevel = 2;
  state.player.roster.push({
    speciesId: "shinx",
    name: "Shinx",
    level: 2
  });
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "arena_front";

  state = await engine.choose(state, "note_trial");
  state = await engine.choose(state, "register");
  state = await engine.choose(state, "enter_trial");
  assert.equal(state.story.nodeId, "trial_gate_call");

  state = await engine.choose(state, "begin_trial");
  assert.equal(state.pending.encounterId, "A1_FIRST_GATE");
  assert.equal(state.pending.playerPokemon.species, "Growlithe");
  assert.equal(state.pending.playerBench.length, 1);
  assert.equal(state.pending.playerBench[0].speciesId, "shinx");
  assert.equal(state.pending.opponent.species, "Eevee");
  assert.equal(state.pending.opponent.level, 4);
  assert.equal(state.pending.opponentBench.length, 1);
  assert.equal(state.pending.opponentBench[0].species, "Shinx");
  assert.equal(state.pending.opponentBench[0].level, 4);
  assert.equal(state.pending.opponentBench[0].abilityId, "intimidate");
  assert.equal(state.pending.competition.type, "promotion_trial");
  assert.equal(state.pending.competition.officialRosterSize, 2);
  assert.equal(state.pending.competition.difficulty, "HARD");
  assert.equal(state.pending.competition.opponentTrainerId, "VAL_GATE_F_E_NARA_VOSS");
  assert.equal(state.competition.trials.RANK_F_TO_E.attempts, 1);
});

test("M1_14 opponent first KO forces the fixed bench Pokemon in instead of ending the Trial", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 15, 4, 4, 4, 4, 4, 4, 4])
  });

  let battle = await combat.createBattle({
    encounterId: "A1_FIRST_GATE_TEST",
    playerPokemon: { species: "Growlithe", form: "Hisuian", level: 5, abilityId: "intimidate" },
    playerBench: [{ speciesId: "shinx", level: 2, abilityId: "intimidate" }],
    opponent: { species: "Eevee", level: 4, abilityId: "run-away" },
    opponentBench: [{ species: "Shinx", level: 4, abilityId: "intimidate" }],
    opponentRegistered: true,
    trainer: {
      name: "Luke",
      level: 2,
      abilities: { STR: 8, DEX: 14, CON: 10, INT: 12, WIS: 15, CHA: 13 },
      skills: ["Animal Handling", "Insight", "Survival"],
      inventory: []
    }
  });

  assert.equal(battle.playerBench.length, 1);
  assert.equal(battle.opponentBench.length, 1);
  assert.equal(battle.opponent.speciesId, "eevee");

  battle.opponent.hp.current = 1;
  battle = await combat.usePlayerMove(battle, "tackle");

  assert.equal(battle.outcome, null);
  assert.equal(battle.opponent.speciesId, "shinx");
  assert.equal(battle.opponentBench.some((pokemon) => pokemon.speciesId === "eevee"), true);
  assert.equal(
    battle.log.some((entry) =>
      entry.type === "switch" &&
      entry.actor === "opponent" &&
      entry.forced === true &&
      entry.in === "shinx"
    ),
    true
  );
});

test("M1_14 loss records the persistent gate staff and leaves the same Trial retryable", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir, ecologyOptions });
  const repository = {
    async load(sceneId) {
      return structuredClone(bundle.scenes[sceneId]);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents);
    },
    async loadEcology() {
      return structuredClone(bundle.ecology);
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  let state = createNewGameState({ protagonist: "Luke" });
  state.player.trainerLevel = 2;
  state.player.roster.push({ speciesId: "shinx", name: "Shinx", level: 2 });
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "arena_front";

  state = await engine.choose(state, "note_trial");
  state = await engine.choose(state, "register");
  state = await engine.choose(state, "enter_trial");
  state = await engine.choose(state, "begin_trial");
  state = engine.resolveCombatHandoff(state, "lose");

  assert.equal(state.story.nodeId, "trial_result_loss");
  assert.equal(state.competition.rank, "F");
  assert.equal(state.competition.trials.RANK_F_TO_E.attempts, 1);
  assert.equal(state.competition.trials.RANK_F_TO_E.lastResult, "lose");
  assert.equal(state.competition.trials.RANK_F_TO_E.available, true);
  assert.equal(state.competition.trials.RANK_F_TO_E.registered, false);
  assert.equal(state.competition.history.at(-1).opponentTrainerId, "VAL_GATE_F_E_NARA_VOSS");
});


test("M1_15 loss preserves real battle condition and opens retry without reset", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir, ecologyOptions });
  const repository = {
    async load(sceneId) {
      return structuredClone(bundle.scenes[sceneId]);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents);
    },
    async loadEcology() {
      return structuredClone(bundle.ecology);
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  let state = createNewGameState({ protagonist: "Luke" });
  state.player.trainerLevel = 2;
  state.player.roster.push({
    speciesId: "shinx",
    name: "Shinx",
    level: 2,
    abilityId: "intimidate"
  });
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "arena_front";

  state = await engine.choose(state, "note_trial");
  state = await engine.choose(state, "register");
  state = await engine.choose(state, "enter_trial");
  state = await engine.choose(state, "begin_trial");

  state = engine.setCombatState(state, {
    encounterId: "A1_FIRST_GATE",
    outcome: "lose",
    trainer: { inventory: [] },
    player: {
      rosterIndex: 0,
      speciesId: "growlithe-hisui",
      name: "Growlithe",
      level: 5,
      hp: { current: 0, max: 31 },
      statuses: { nonVolatile: "Burned", remainingRounds: null, flinchedTurns: 0 },
      abilityId: "intimidate",
      moveIds: ["tackle", "leer", "bite", "ember", "howl"],
      pp: { tackle: 7, leer: 20, bite: 8, ember: 5, howl: 10 }
    },
    playerBench: [{
      rosterIndex: 1,
      speciesId: "shinx",
      name: "Shinx",
      level: 2,
      hp: { current: 3, max: 13 },
      statuses: { nonVolatile: "Paralysis", remainingRounds: null, flinchedTurns: 0 },
      abilityId: "intimidate",
      moveIds: ["tackle", "leer", "charge", "baby-doll-eyes"],
      pp: { tackle: 11, leer: 20, charge: 9, "baby-doll-eyes": 10 }
    }],
    opponent: {
      speciesId: "shinx",
      name: "Shinx",
      level: 4,
      hp: { current: 5, max: 19 },
      statuses: { nonVolatile: null, remainingRounds: null, flinchedTurns: 0 },
      abilityId: "intimidate",
      moveIds: ["tackle"],
      pp: { tackle: 10 }
    },
    opponentBench: []
  });

  state = engine.resolveCombatHandoff(state, "lose");

  assert.equal(state.story.nodeId, "trial_result_loss");
  assert.equal(state.competition.rank, "F");
  assert.equal(state.competition.trials.RANK_F_TO_E.available, true);
  assert.equal(state.competition.trials.RANK_F_TO_E.registered, false);
  assert.equal(state.competition.trials.RANK_F_TO_E.attempts, 1);

  assert.deepEqual(state.player.roster[0].hp, { current: 0, max: 31 });
  assert.equal(state.player.roster[0].statuses.nonVolatile, "Burned");
  assert.equal(state.player.roster[0].pp.tackle, 7);
  assert.deepEqual(state.player.roster[1].hp, { current: 3, max: 13 });
  assert.equal(state.player.roster[1].statuses.nonVolatile, "Paralysis");
  assert.equal(state.player.roster[1].pp.tackle, 11);
  assert.deepEqual(state.player.starter.hp, { current: 0, max: 31 });

  const view = await engine.present(state);
  assert.equal(view.choices.some((choice) => choice.id === "retry_desk"), true);
  assert.equal(view.choices.some((choice) => choice.id === "heal"), true);
  assert.equal(view.choices.some((choice) => choice.id === "free_roam"), true);
});

test("M1_15 persisted HP PP and status are loaded into the next real combat", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([10, 10])
  });

  const battle = await combat.createBattle({
    encounterId: "PERSISTENCE_TEST",
    playerPokemon: {
      species: "Growlithe",
      form: "Hisuian",
      level: 5,
      rosterIndex: 0,
      abilityId: "intimidate",
      hp: { current: 9, max: 31 },
      statuses: { nonVolatile: "Burned", remainingRounds: null, flinchedTurns: 0 },
      pp: { tackle: 6, ember: 4 }
    },
    opponent: { species: "Eevee", level: 4, abilityId: "run-away" },
    opponentRegistered: true,
    trainer: {
      name: "Luke",
      level: 2,
      abilities: { STR: 8, DEX: 14, CON: 10, INT: 12, WIS: 15, CHA: 13 },
      skills: ["Animal Handling", "Insight", "Survival"],
      inventory: []
    }
  });

  assert.equal(battle.player.rosterIndex, 0);
  assert.equal(battle.player.hp.current, 9);
  assert.equal(battle.player.statuses.nonVolatile, "Burned");
  assert.equal(battle.player.pp.tackle, 6);
  assert.equal(battle.player.pp.ember, 4);
});

test("M1_15 win opens Rank E and M02 without erasing prior M1 callbacks", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir, ecologyOptions });
  const repository = {
    async load(sceneId) {
      return structuredClone(bundle.scenes[sceneId]);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents);
    },
    async loadEcology() {
      return structuredClone(bundle.ecology);
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  let state = createNewGameState({ protagonist: "Luke" });
  state.player.trainerLevel = 3;
  state.player.roster.push({
    speciesId: "houndour",
    name: "Houndour",
    level: 3,
    abilityId: "early-bird"
  });
  state.player.secondPokemonAcquisition = {
    speciesId: "houndour",
    name: "Houndour",
    level: 3,
    day: 1,
    locationId: "asteria_ginestre",
    encounterId: "HOUNDOUR_GINESTRE_001"
  };

  state.world.flags.houndour_ginestre_disposition = "calmed_then_captured";
  state.world.flags.valedarsena_reputation = "helpful_rookie";
  state.world.flags.m1_world_pressure_known = true;
  state.world.flags.m1_world_pressure_state = "investigated";
  state.world.flags.friend_beat_01_complete = true;
  state.world.flags.friend_beat_01_friend_id = "Mattew";
  state.world.flags.friend_beat_01_type = "training";
  state.world.flags.friends_split = true;

  state.quests.SQ_FARM_HERD_HANDS = {
    id: "SQ_FARM_HERD_HANDS",
    title: "Recinti aperti",
    objective: "Test",
    status: "failed",
    resolution: "abandoned"
  };

  adjustNpcRelationship(state, { npcId: "Blue", delta: 25 });
  state.npcs.Blue.state.resultContext = "player_win";
  state.npcs.Mattew.schedule = {
    id: "M1_SPLIT_REMOTE",
    locationId: "remote_route",
    availability: "traveling",
    activity: "remote_work",
    startsAtMinutes: null,
    endsAtMinutes: null
  };
  state.competition.firstOfficialResolved = true;

  const preserved = {
    houndour: state.world.flags.houndour_ginestre_disposition,
    reputation: state.world.flags.valedarsena_reputation,
    pressureKnown: state.world.flags.m1_world_pressure_known,
    pressureState: state.world.flags.m1_world_pressure_state,
    friendBeat: state.world.flags.friend_beat_01_friend_id,
    friendsSplit: state.world.flags.friends_split,
    quest: structuredClone(state.quests.SQ_FARM_HERD_HANDS),
    blue: structuredClone(state.npcs.Blue),
    mattewSchedule: structuredClone(state.npcs.Mattew.schedule),
    second: structuredClone(state.player.secondPokemonAcquisition),
    firstOfficial: state.competition.firstOfficialResolved
  };

  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "arena_front";
  state = await engine.choose(state, "note_trial");
  state = await engine.choose(state, "register");
  state = await engine.choose(state, "enter_trial");
  state = await engine.choose(state, "begin_trial");
  state = engine.resolveCombatHandoff(state, "win");

  assert.equal(state.story.nodeId, "trial_result_win");
  assert.equal(state.competition.rank, "E");
  assert.equal(state.competition.rankOrder, 1);
  assert.equal(state.competition.trials.RANK_F_TO_E.completed, true);
  assert.equal(state.competition.trials.RANK_F_TO_E.bestResult, "win");

  assert.equal(state.world.flags.houndour_ginestre_disposition, preserved.houndour);
  assert.equal(state.world.flags.valedarsena_reputation, preserved.reputation);
  assert.equal(state.world.flags.m1_world_pressure_known, preserved.pressureKnown);
  assert.equal(state.world.flags.m1_world_pressure_state, preserved.pressureState);
  assert.equal(state.world.flags.friend_beat_01_friend_id, preserved.friendBeat);
  assert.equal(state.world.flags.friends_split, preserved.friendsSplit);
  assert.deepEqual(state.quests.SQ_FARM_HERD_HANDS, preserved.quest);
  assert.deepEqual(state.npcs.Blue, preserved.blue);
  assert.equal(state.npcs.Mattew.schedule.id, preserved.mattewSchedule.id);
  assert.equal(state.npcs.Mattew.schedule.locationId, preserved.mattewSchedule.locationId);
  assert.equal(state.npcs.Mattew.schedule.availability, preserved.mattewSchedule.availability);
  assert.equal(state.npcs.Mattew.schedule.activity, preserved.mattewSchedule.activity);
  assert.equal(state.npcs.Mattew.schedule.present, false);
  assert.deepEqual(state.player.secondPokemonAcquisition, preserved.second);
  assert.equal(state.competition.firstOfficialResolved, preserved.firstOfficial);

  state = await engine.choose(state, "rank_e_access");
  assert.equal(state.story.nodeId, "rank_e_access");
  state = await engine.choose(state, "unlock_m02");
  assert.equal(state.story.nodeId, "m02_handoff");
  assert.equal(state.world.flags.m1_complete, true);
  assert.equal(state.world.flags.m02_unlocked, true);
  assert.equal(state.competition.rank, "E");
});

test("M1_15 Rank E access remains reachable from Valedarsena free-roam after promotion", async () => {
  const bundle = await compileStory({ scenesDir, modulesDir, ecologyOptions });
  const repository = {
    async load(sceneId) {
      return structuredClone(bundle.scenes[sceneId]);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents);
    },
    async loadEcology() {
      return structuredClone(bundle.ecology);
    }
  };

  const engine = new BookgameEngine({ scenes: repository });
  const state = createNewGameState({ protagonist: "Luke" });
  state.competition.rank = "E";
  state.competition.rankOrder = 1;
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "city_hub";

  const view = await engine.present(state);
  assert.equal(view.choices.some((choice) => choice.id === "rank_e_access"), true);
});
