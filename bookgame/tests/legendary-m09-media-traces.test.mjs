import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { processWorldEvents } from "../src/engine/world-events.mjs";
import { startQuest } from "../src/engine/quest-state.mjs";

const load = async path => JSON.parse(await readFile(fileURLToPath(new URL(path, import.meta.url)), "utf8"));
const events = (await load("../content/events/legendary-m09-media-traces.json")).events;
const scene = await load("../content/scenes/m09-interday-one.json");
const names = ["Luke", "Mattew", "Daniel", "Edward", "Fab"];

function state(name, { qualified = true, clue = true, match = true, notes = true, status = "available" } = {}) {
  const id = name.toLowerCase();
  return {
    player: { name },
    world: { day: 1, flags: {
      world_qualified: qualified,
      ["legendary_m08_qualified_" + id]: clue,
      m9_matchday_one_complete: match,
      m9_personal_press_notes_reviewed: notes
    } },
    quests: status === null ? {} : { ["legendary_m08_lead_" + id]: { id: "legendary_m08_lead_" + id, status, title: name + " personal lead", objective: "Investigate" } },
    events: {}
  };
}
function applyEffects(state, effects) {
  for (const effect of effects) {
    if (effect.type === "quest_start") startQuest(state, effect);
    else if (effect.type === "set_flag") state.world.flags[effect.key] = effect.value;
    else throw new Error("Unexpected effect " + effect.type);
  }
}

test("M09 media clue has a reachable existing choice, preserving authored count", () => {
  const choice = scene.nodes.media_window.choices.find(c => c.id === "media_resources");
  assert.ok(choice);
  assert.equal(choice.goto, "legendary-world-hunt#hunt_entry");
  assert.deepEqual(choice.effects, [{ type: "set_flag", key: "m9_personal_press_notes_reviewed", value: true }]);
  assert.equal(Object.keys(scene.nodes).length, 13);
  assert.equal(Object.values(scene.nodes).reduce((count,node) => count + (node.choices?.length ?? 0), 0), 30);
});

test("M09 personal lead activates only for qualified trainer after real first matchday and optional review", () => {
  assert.equal(events.length, names.length);
  for (const name of names) {
    const id = name.toLowerCase();
    for (const options of [
      { qualified: false }, { clue: false }, { match: false }, { notes: false },
      { status: null }, { status: "completed" }, { status: "failed" }, { status: "expired" }
    ]) {
      const stateBefore = state(name, options);
      assert.equal(processWorldEvents(stateBefore, events, applyEffects).length, 0, name + " " + JSON.stringify(options));
      assert.equal(stateBefore.world.flags["legendary_m09_clue_" + id], undefined);
    }
    for (const status of ["available", "active"]) {
      const eligible = state(name, { status });
      const fired = processWorldEvents(eligible, events, applyEffects);
      assert.equal(fired.length, 1, name + " " + status);
      assert.equal(eligible.quests["legendary_m08_lead_" + id].status, "active");
      assert.equal(eligible.world.flags["legendary_m09_clue_" + id], true);
      assert.equal(Object.keys(eligible.quests).length, 1, "do not duplicate active quests");
      assert.equal(processWorldEvents(eligible, events, applyEffects).length, 0, "one shot");
      for (const other of names.filter(other => other !== name)) {
        assert.equal(eligible.world.flags["legendary_m09_clue_" + other.toLowerCase()], undefined);
      }
    }
  }
});
