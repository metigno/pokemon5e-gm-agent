import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { processWorldEvents } from "../src/engine/world-events.mjs";
import { offerQuest, startQuest, completeQuest } from "../src/engine/quest-state.mjs";
import { evaluateCondition, validateCondition } from "../src/engine/conditions.mjs";

const load = async (path) => JSON.parse(await readFile(fileURLToPath(new URL(path, import.meta.url)), "utf8"));
const events = (await load("../content/events/legendary-m10-archive-dossiers.json")).events;
const scene = await load("../content/scenes/m10-r16-prep.json");
const people = [
  ["Luke", "luke"], ["Mattew", "mattew"], ["Daniel", "daniel"],
  ["Edward", "edward"], ["Fab", "fab"]
];

function makeState(name, {
  qualified = true,
  priorClue = true,
  silasThread = true,
  knockoutOpened = true,
  reviewed = true,
  sourceStatus = "active"
} = {}) {
  const id = name.toLowerCase();
  return {
    player: { name },
    world: { day: 1, flags: {
      world_qualified: qualified,
      ["legendary_m09_clue_" + id]: priorClue,
      m10_silas_thread_complete: silasThread,
      legendary_m10_optional_archive_review: reviewed
    }},
    competition: { world: { knockout: { opened: knockoutOpened } } },
    quests: sourceStatus === null ? {} : {
      ["legendary_m08_lead_" + id]: {
        id: "legendary_m08_lead_" + id,
        status: sourceStatus,
        title: "Previously investigated lead",
        objective: "Cross-check evidence"
      }
    },
    events: {}
  };
}

function applyEffects(state, effects) {
  for (const effect of effects) {
    if (effect.type === "quest_complete") completeQuest(state, effect);
    else if (effect.type === "quest_offer") offerQuest(state, effect);
    else if (effect.type === "set_flag") state.world.flags[effect.key] = effect.value;
    else throw new Error("Unexpected effect " + effect.type);
  }
}

test("M10 archive review reuses a reachable R16 choice and preserves 12/27 budget", () => {
  const choice = scene.nodes.callbacks.choices.find(x => x.id === "callbacks_readiness");
  assert.ok(choice);
  assert.equal(choice.goto, "readiness");
  assert.deepEqual(choice.effects, [{ type: "set_flag", key: "legendary_m10_optional_archive_review", value: true }]);
  assert.equal(Object.keys(scene.nodes).length, 12);
  assert.equal(Object.values(scene.nodes).reduce((n, node) => n + (node.choices?.length ?? 0), 0), 27);
  const visited = new Set([scene.entryNodeId]), queue = [scene.entryNodeId];
  while (queue.length) {
    const node = scene.nodes[queue.shift()];
    for (const option of node.choices ?? []) {
      if (scene.nodes[option.goto] && !visited.has(option.goto)) {
        visited.add(option.goto);
        queue.push(option.goto);
      }
    }
  }
  assert.equal(visited.has("callbacks"), true);
});

test("M10 dossier is an optional, qualified-only handoff for each of the five trainers", () => {
  assert.equal(events.length, 5);
  for (const [name, id] of people) {
    const event = events.find(x => x.id === "legendary_m10_archive_" + id);
    assert.ok(event, "missing " + name);
    assert.deepEqual(validateCondition(event.trigger), []);
    for (const overrides of [
      { qualified: false }, { priorClue: false }, { silasThread: false },
      { knockoutOpened: false }, { reviewed: false },
      { sourceStatus: "available" }, { sourceStatus: "completed" },
      { sourceStatus: "failed" }, { sourceStatus: "expired" }, { sourceStatus: null }
    ]) {
      const candidate = makeState(name, overrides);
      assert.equal(evaluateCondition(candidate, event.trigger), false, name + ": " + JSON.stringify(overrides));
      assert.equal(processWorldEvents(candidate, events, applyEffects).length, 0);
    }

    const state = makeState(name);
    const fired = processWorldEvents(state, events, applyEffects);
    assert.deepEqual(fired.map(x => x.eventId), [event.id]);
    assert.equal(state.quests["legendary_m08_lead_" + id].status, "completed");
    assert.equal(state.quests["legendary_m08_lead_" + id].resolution, "archive_crosschecked");
    assert.equal(state.quests["legendary_m10_dossier_" + id].status, "available");
    assert.equal(state.world.flags["legendary_m10_dossier_" + id], true);
    assert.equal(Object.keys(state.quests).length, 2);
    assert.equal(processWorldEvents(state, events, applyEffects).length, 0, "must be one-shot");
    const restored = JSON.parse(JSON.stringify(state));
    assert.equal(processWorldEvents(restored, events, applyEffects).length, 0, "must persist after save/load");
    for (const [otherName, otherId] of people) {
      if (name === otherName) continue;
      assert.equal(restored.quests["legendary_m10_dossier_" + otherId], undefined);
      assert.equal(restored.world.flags["legendary_m10_dossier_" + otherId], undefined);
    }
  }
});
