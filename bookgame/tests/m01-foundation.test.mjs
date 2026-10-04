import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { CompiledSceneRepository } from "../src/engine/compiled-scene-repository.mjs";
import { compileStory, validateScene } from "../src/compiler/story-compiler.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { createNewGameState } from "../src/engine/state.mjs";
import { evaluateCondition, validateCondition } from "../src/engine/conditions.mjs";

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
