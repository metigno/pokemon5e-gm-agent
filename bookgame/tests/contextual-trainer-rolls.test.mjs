import test from "node:test";
import assert from "node:assert/strict";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const scene = {
  id: "contextual-roll-test",
  title: "Contextual roll test",
  moduleId: "TEST",
  nodes: {
    entry: {
      text: "The authored event forces a Trainer save.",
      choices: [{
        id: "resist",
        text: "Resisto.",
        save: { ability: "CHA", dc: 12 },
        outcomes: {
          success: { goto: "safe" },
          failure: { goto: "failed" }
        }
      }]
    },
    safe: { text: "Success.", choices: [] },
    failed: { text: "Failure.", choices: [] }
  }
};

function repository() {
  return {
    async load(id) {
      if (id !== scene.id) throw new Error("missing scene");
      return structuredClone(scene);
    },
    async loadWorldEvents() { return []; }
  };
}

test("authored Trainer save uses canonical saving-throw proficiency and persists lastRoll", async () => {
  const state = createNewGameState({ protagonist: "Luke" });
  state.story.sceneId = scene.id;
  state.story.nodeId = "entry";

  const engine = new BookgameEngine({
    scenes: repository(),
    dice: new SequenceDice([10])
  });
  const next = await engine.choose(state, "resist");

  assert.equal(next.lastRoll.kind, "save");
  assert.equal(next.lastRoll.ability, "CHA");
  assert.equal(next.lastRoll.proficient, true);
  assert.equal(next.lastRoll.modifier, 2);
  assert.equal(next.lastRoll.total, 12);
  assert.equal(next.lastRoll.passed, true);
  assert.equal(next.story.nodeId, "safe");

  const presented = await engine.present(next);
  assert.deepEqual(presented.lastRoll, next.lastRoll);
});

test("contextual check remains canonical and is explicitly typed for UI", async () => {
  const checkScene = structuredClone(scene);
  checkScene.nodes.entry.choices[0] = {
    id: "inspect",
    text: "Osservo.",
    check: { ability: "WIS", skill: "Survival", dc: 10 },
    outcomes: { success: { goto: "safe" }, failure: { goto: "failed" } }
  };
  const scenes = {
    async load() { return structuredClone(checkScene); },
    async loadWorldEvents() { return []; }
  };
  const state = createNewGameState({ protagonist: "Luke" });
  state.story.sceneId = scene.id;
  state.story.nodeId = "entry";
  const engine = new BookgameEngine({ scenes, dice: new SequenceDice([10]) });
  const next = await engine.choose(state, "inspect");
  assert.equal(next.lastRoll.kind, "check");
  assert.equal(next.lastRoll.skill, "Survival");
  assert.equal(next.lastRoll.total, 11);
  assert.equal(next.lastRoll.passed, true);
});
