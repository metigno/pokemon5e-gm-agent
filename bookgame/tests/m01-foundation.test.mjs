import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { CompiledSceneRepository } from "../src/engine/compiled-scene-repository.mjs";
import { compileStory, validateScene } from "../src/compiler/story-compiler.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { createNewGameState } from "../src/engine/state.mjs";
import { evaluateCondition, validateCondition } from "../src/engine/conditions.mjs";
import { advanceWorldTime, daypartForMinute, getWorldTimeView } from "../src/engine/time.mjs";
import { getQuestJournal, processQuestDeadlines, startQuest } from "../src/engine/quest-state.mjs";
import { adjustNpcRelationship, selectFriendBeatCandidate, setNpcSchedule } from "../src/engine/npc-state.mjs";

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../content/modules/", import.meta.url));

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
