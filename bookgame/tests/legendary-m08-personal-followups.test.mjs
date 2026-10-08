import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { processWorldEvents } from "../src/engine/world-events.mjs";
import { offerQuest } from "../src/engine/quest-state.mjs";

const path = fileURLToPath(new URL("../content/events/legendary-m08-personal-followups.json", import.meta.url));
const events = JSON.parse(await readFile(path, "utf8")).events;
const names = ["Luke", "Mattew", "Daniel", "Edward", "Fab"];
function state(name, { qualified = true, reflected = true } = {}) {
  return { player: { name }, world: { day: 1, flags: {
    ["legendary_m08_qualified_" + name.toLowerCase()]: qualified,
    legendary_m08_village_reflection: reflected
  } }, quests: {}, events: {} };
}
function applyEffects(s, effects) {
  for (const effect of effects) {
    assert.equal(effect.type, "quest_offer");
    offerQuest(s, effect);
  }
}
test("Five distinct M08 legendary leads are offered only after qualified player reflection", () => {
  assert.equal(events.length, 5);
  for (const name of names) {
    const id = name.toLowerCase();
    for (const options of [{ qualified: false }, { reflected: false }]) {
      const s = state(name, options);
      assert.equal(processWorldEvents(s, events, applyEffects).length, 0);
      assert.deepEqual(s.quests, {});
    }
    const s = state(name);
    assert.equal(processWorldEvents(s, events, applyEffects).length, 1);
    assert.equal(s.quests["legendary_m08_lead_" + id].status, "available");
    assert.ok(s.quests["legendary_m08_lead_" + id].objective.length > 20);
    assert.equal(Object.keys(s.quests).length, 1);
    assert.equal(processWorldEvents(s, events, applyEffects).length, 0);
  }
});
