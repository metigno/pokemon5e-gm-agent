import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { evaluateCondition, validateCondition } from "../src/engine/conditions.mjs";

const path = fileURLToPath(new URL("../content/scenes/m08-world-village.json", import.meta.url));
const scene = JSON.parse(await readFile(path, "utf8"));
const choice = scene.nodes.callback_wall.choices.find(c => c.id === "callback_legendary");
const trainers = ["Luke", "Mattew", "Daniel", "Edward", "Fab"];

test("M08 legendary reflection is a real, valid conditional choice without extra nodes or choices", () => {
  assert.ok(choice);
  assert.deepEqual(validateCondition(choice.conditions), []);
  assert.equal(choice.goto, "social_crossroads");
  assert.ok(scene.nodes[choice.goto]);
  assert.equal(Object.keys(scene.nodes).length, 21);
  assert.equal(Object.values(scene.nodes).reduce((sum, node) => sum + (node.choices?.length ?? 0), 0), 47);
  assert.deepEqual(choice.effects, [{ type: "set_flag", key: "legendary_m08_village_reflection", value: true }]);
});

test("Only the matching protagonist with an M08 qualified legendary flag sees the reflection", () => {
  for (const name of trainers) {
    const own = "legendary_m08_qualified_" + name.toLowerCase();
    const state = { player: { name }, world: { flags: { [own]: true } } };
    assert.equal(evaluateCondition(state, choice.conditions), true, name);
    state.world.flags[own] = false;
    assert.equal(evaluateCondition(state, choice.conditions), false, name + " without qualification");
    for (const other of trainers.filter(other => other !== name)) {
      state.world.flags["legendary_m08_qualified_" + other.toLowerCase()] = true;
      assert.equal(evaluateCondition(state, choice.conditions), false, name + " cannot read " + other + " clue");
      delete state.world.flags["legendary_m08_qualified_" + other.toLowerCase()];
    }
  }
});

test("The legendary reflection choice is reachable from the World Village entry", () => {
  const visited = new Set([scene.entryNodeId]);
  const queue = [scene.entryNodeId];
  while (queue.length) {
    const id = queue.shift();
    for (const choice of scene.nodes[id]?.choices ?? []) {
      const target = choice.goto;
      if (scene.nodes[target] && !visited.has(target)) {
        visited.add(target);
        queue.push(target);
      }
    }
  }
  assert.ok(visited.has("callback_wall"));
});
