import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { CompiledSceneRepository } from "../src/engine/compiled-scene-repository.mjs";
import { compileStory, validateScene } from "../src/compiler/story-compiler.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

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
