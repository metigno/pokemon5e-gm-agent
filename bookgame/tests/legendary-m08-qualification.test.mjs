import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { processWorldEvents } from "../src/engine/world-events.mjs";

const catalogPath = fileURLToPath(new URL("../content/events/legendary-m08-qualified-gate.json", import.meta.url));
const trainers = [
  ["Luke", "kyurem_black"],
  ["Mattew", "zacian"],
  ["Daniel", "mewtwo"],
  ["Edward", "lugia"],
  ["Fab", "rayquaza"]
];
const events = JSON.parse(await readFile(catalogPath, "utf8")).events;

function stateFor(name, key, { qualified = true, clue = true, registered = true, quest = "available" } = {}) {
  const id = name.toLowerCase();
  return {
    player: { name },
    world: { day: 1, flags: {
      ["legendary_m07_clue_" + id]: clue,
      world_qualified: qualified,
      m8_world_registration_complete: registered
    } },
    quests: { ["legendary_" + id + "_" + key]: { status: quest } },
    events: {}
  };
}

function applyEffects(state, effects) {
  for (const effect of effects) {
    assert.equal(effect.type, "set_flag");
    state.world.flags[effect.key] = effect.value;
  }
}

test("M08 legendary gate requires qualification, clue, registration and matching active/available quest for all five trainers", () => {
  assert.equal(events.length, 5);
  for (const [name, key] of trainers) {
    const id = name.toLowerCase();
    for (const options of [
      { qualified: false }, { clue: false }, { registered: false },
      { quest: "completed" }, { quest: "failed" }, { quest: "expired" }
    ]) {
      const state = stateFor(name, key, options);
      assert.equal(processWorldEvents(state, events, applyEffects).length, 0, name + " " + JSON.stringify(options));
      assert.equal(state.world.flags["legendary_m08_qualified_" + id], undefined);
    }
    for (const quest of ["available", "active"]) {
      const state = stateFor(name, key, { quest });
      const fired = processWorldEvents(state, events, applyEffects);
      assert.deepEqual(fired.map(event => event.eventId), ["legendary_m08_qualified_" + id]);
      assert.equal(state.world.flags["legendary_m08_qualified_" + id], true);
      assert.equal(processWorldEvents(state, events, applyEffects).length, 0, "event must fire only once");
      assert.equal(state.quests["legendary_" + id + "_" + key].status, quest, "gate must not auto-start or complete quest");
    }
  }
});

test("M08 legendary gate never activates another protagonist's quest", () => {
  for (const [name, key] of trainers) {
    const state = stateFor(name, key);
    const fired = processWorldEvents(state, events, applyEffects);
    assert.equal(fired.length, 1);
    for (const [other] of trainers) {
      if (other !== name) assert.equal(state.world.flags["legendary_m08_qualified_" + other.toLowerCase()], undefined);
    }
  }
});
