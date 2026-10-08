import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { processWorldEvents } from "../src/engine/world-events.mjs";
import { startQuest } from "../src/engine/quest-state.mjs";
import { evaluateCondition, validateCondition } from "../src/engine/conditions.mjs";

const load = async p => JSON.parse(await readFile(fileURLToPath(new URL(p, import.meta.url)), "utf8"));
const events = (await load("../content/events/legendary-m11-evidence.json")).events;
const scene = await load("../content/scenes/m11-sf-prep.json");
const trainers = ["Luke", "Mattew", "Daniel", "Edward", "Fab"];

function makeState(name, {
  qualified = true, dossier = true, reiThread = true, semiOpen = true,
  reviewed = true, questStatus = "available"
} = {}) {
  const id = name.toLowerCase();
  return {
    player: { name },
    world: { day: 1, flags: {
      world_qualified: qualified,
      ["legendary_m10_dossier_" + id]: dossier,
      m11_rei_thread_complete: reiThread,
      legendary_m11_optional_evidence_review: reviewed
    } },
    competition: { world: { knockout: { sfOpened: semiOpen } } },
    quests: questStatus === null ? {} : {
      ["legendary_m10_dossier_" + id]: { id: "legendary_m10_dossier_" + id, status: questStatus, title: "Dossier", objective: "Review" }
    },
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

test("M11 evidence review is optional, reachable, and does not alter 13/29 SF prep budget", () => {
  const choice = scene.nodes.opponent_readiness.choices.find(c => c.id === "opponent_readiness_alt");
  assert.ok(choice);
  assert.equal(choice.goto, "commit");
  assert.deepEqual(choice.effects, [{ type: "set_flag", key: "legendary_m11_optional_evidence_review", value: true }]);
  assert.equal(Object.keys(scene.nodes).length, 13);
  assert.equal(Object.values(scene.nodes).reduce((n,node) => n + (node.choices?.length ?? 0), 0), 29);
  const visited = new Set([scene.entryNodeId]);
  const queue = [scene.entryNodeId];
  while (queue.length) {
    const node = scene.nodes[queue.shift()];
    for (const candidate of node.choices ?? []) {
      if (scene.nodes[candidate.goto] && !visited.has(candidate.goto)) {
        visited.add(candidate.goto);
        queue.push(candidate.goto);
      }
    }
  }
  assert.equal(visited.has("opponent_readiness"), true);
});

test("Five M11 legendary dossiers start only after the real semifinal checkpoint and deliberate review", () => {
  assert.equal(events.length, 5);
  for (const name of trainers) {
    const id = name.toLowerCase(), key = "legendary_m10_dossier_" + id;
    const event = events.find(e => e.id === "legendary_m11_evidence_" + id);
    assert.ok(event, name);
    assert.deepEqual(validateCondition(event.trigger), []);
    for (const overrides of [
      { qualified: false }, { dossier: false }, { reiThread: false },
      { semiOpen: false }, { reviewed: false }, { questStatus: null },
      { questStatus: "completed" }, { questStatus: "failed" }, { questStatus: "expired" }
    ]) {
      const blocked = makeState(name, overrides);
      assert.equal(evaluateCondition(blocked, event.trigger), false, name + " " + JSON.stringify(overrides));
      assert.equal(processWorldEvents(blocked, events, applyEffects).length, 0);
    }
    for (const questStatus of ["available", "active"]) {
      const state = makeState(name, { questStatus });
      assert.deepEqual(processWorldEvents(state, events, applyEffects).map(x => x.eventId), [event.id]);
      assert.equal(state.quests[key].status, "active");
      assert.equal(state.world.flags["legendary_m11_evidence_" + id], true);
      assert.equal(Object.keys(state.quests).length, 1, "no duplicate quest");
      assert.equal(processWorldEvents(state, events, applyEffects).length, 0, "once");
      const restored = JSON.parse(JSON.stringify(state));
      assert.equal(processWorldEvents(restored, events, applyEffects).length, 0, "persisted after save/load");
      for (const other of trainers.filter(other => other !== name)) {
        assert.equal(restored.world.flags["legendary_m11_evidence_" + other.toLowerCase()], undefined);
      }
    }
  }
});
