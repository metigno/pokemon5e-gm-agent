import test from "node:test";
import assert from "node:assert/strict";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const fixedNow = () => "2026-10-07T08:20:00.000Z";

test("real New Game enters INTRO_FIVE before M1", async () => {
  const state = createNewGameState({
    protagonist: "Luke",
    slot: "intro-test",
    startAtIntro: true,
    now: fixedNow
  });

  assert.equal(state.world.flags.intro_complete, false);
  assert.equal(state.world.flags.free_roam, false);
  assert.equal(state.story.sceneId, "intro-five");
  assert.equal(state.story.nodeId, "before_doors");

  const engine = new BookgameEngine({ now: fixedNow });
  const view = await engine.present(state);
  assert.equal(view.sceneId, "intro-five");
  assert.equal(view.nodeId, "before_doors");
  assert.ok(view.choices.length >= 1);
});

test("battle selection offers exactly the other four friends", async () => {
  const state = createNewGameState({
    protagonist: "Luke",
    slot: "intro-opponents",
    startAtIntro: true,
    now: fixedNow
  });
  state.story.nodeId = "battle_selection";

  const engine = new BookgameEngine({ now: fixedNow });
  const view = await engine.present(state);
  const ids = view.choices.map((choice) => choice.id);

  assert.equal(ids.length, 4);
  assert.equal(ids.includes("battle_luke"), false);
  assert.equal(ids.includes("battle_mattew"), true);
  assert.equal(ids.includes("battle_daniel"), true);
  assert.equal(ids.includes("battle_edward"), true);
  assert.equal(ids.includes("battle_fab"), true);
});
