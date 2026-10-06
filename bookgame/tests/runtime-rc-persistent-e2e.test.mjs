import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { compileStory } from "../src/compiler/story-compiler.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../content/modules/", import.meta.url));
const eventsDir = fileURLToPath(new URL("../content/events/", import.meta.url));
const ecologyProfilesDir = fileURLToPath(new URL("../content/ecology/", import.meta.url));
const zonePoolsFile = fileURLToPath(
  new URL("../../campaign/world/ecology/ZONE_POOLS.json", import.meta.url)
);
const distributionFile = fileURLToPath(
  new URL("../../campaign/world/ecology/SPECIES_DISTRIBUTION.json", import.meta.url)
);
const faunaIndexFile = fileURLToPath(
  new URL("../../campaign/world/fauna/ASTERIA_FAUNA_INDEX.json", import.meta.url)
);
const ecologyOptions = {
  profilesDir: ecologyProfilesDir,
  zonePoolsFile,
  distributionFile,
  faunaIndexFile
};
const fixedNow = () => "2026-10-07T00:00:00.000Z";
const highDice = { roll: (sides) => sides };

async function makeEngine() {
  const bundle = await compileStory({
    scenesDir,
    modulesDir,
    eventsDir,
    ecologyOptions
  });
  const scenes = {
    async load(id) {
      const scene = bundle.scenes[id];
      if (!scene) throw new Error(`Unknown compiled scene: ${id}`);
      return structuredClone(scene);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents ?? []);
    },
    async loadEcology() {
      return structuredClone(bundle.ecology);
    }
  };
  return new BookgameEngine({ scenes, dice: highDice, now: fixedNow });
}

class MaxHeap {
  constructor() {
    this.values = [];
  }
  get size() {
    return this.values.length;
  }
  push(entry) {
    const a = this.values;
    a.push(entry);
    let i = a.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (a[p].priority >= entry.priority) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = entry;
  }
  pop() {
    const a = this.values;
    if (a.length === 0) return null;
    const top = a[0];
    const tail = a.pop();
    if (a.length > 0) {
      let i = 0;
      while (true) {
        let best = i;
        const left = i * 2 + 1;
        const right = left + 1;
        if (left < a.length && a[left].priority > (best === i ? tail.priority : a[best].priority)) {
          best = left;
        }
        if (right < a.length) {
          const currentBest = best === i ? tail.priority : a[best].priority;
          if (a[right].priority > currentBest) best = right;
        }
        if (best === i) break;
        a[i] = a[best];
        i = best;
      }
      a[i] = tail;
    }
    return top;
  }
}

function signature(state) {
  const copy = structuredClone(state);
  delete copy.createdAt;
  delete copy.updatedAt;
  delete copy.revision;
  delete copy.lastRoll;
  if (copy.story) copy.story.history = [];
  if (copy.world) {
    if (Number.isFinite(copy.world.elapsedMinutes)) {
      copy.world.elapsedMinutes = Math.min(copy.world.elapsedMinutes, 30 * 1440);
    }
    if (Number.isFinite(copy.world.day)) {
      copy.world.day = Math.min(copy.world.day, 30);
    }
  }
  return JSON.stringify(copy);
}

function completedModuleCount(state) {
  const f = state.world?.flags ?? {};
  let count = 0;
  for (let i = 1; i <= 12; i += 1) {
    if (f[`m${i}_complete`] || f[`m0${i}_complete`]) count += 1;
  }
  return count;
}

function progressionScore(state, route, depth) {
  const f = state.world?.flags ?? {};
  let score = completedModuleCount(state) * 100000;
  score += Object.values(f).filter((value) => value === true).length * 20;
  score += Number(state.competition?.rankOrder ?? 0) * 500;
  score += Number(state.player?.trainerLevel ?? 1) * 25;

  for (const [key, value] of [
    ["world_qualified", 4000],
    ["world_group_advanced", 5000],
    ["world_qf_won", 6000],
    ["world_sf_won", 7000],
    ["world_champion", 12000],
    ["world_eliminated", route === "eliminated" ? 12000 : -12000],
    ["worlds_missed", route === "missed" ? 12000 : -12000],
    ["main_story_complete", 20000]
  ]) {
    if (f[key]) score += value;
  }

  if (route === "champion" && (f.world_eliminated || f.worlds_missed)) score -= 1000000;
  if (route === "missed" && f.world_qualified && !f.worlds_missed) score -= 2000;
  if (route === "eliminated" && f.worlds_missed) score -= 1000000;
  return score - depth;
}

function preferredChoices(choices) {
  const positive = /commit|complete|confirm|activate|continue|depart|travel|register|resolve|record|ready|open|advance|accept|enter|start|fight|win|audit|sync|lock|arrive|proceed|return/i;
  const negative = /review|back|stay|repeat|defer|wait|existing|free_roam|inspect|listen|talk_again/i;
  return [...choices].sort((a, b) => {
    const score = (choice) =>
      (positive.test(choice.id) ? 10 : 0) -
      (negative.test(choice.id) ? 10 : 0);
    return score(b) - score(a) || a.id.localeCompare(b.id);
  });
}

function combatOutcomes(state, policy) {
  const keys = Object.keys(state.pending?.returnNodes ?? {});
  const legal = keys.filter((key) => key !== "captured");
  if (policy === "win" && legal.includes("win")) return ["win"];
  const ordered = ["win", "lose", "fled", "escape", ...legal];
  return [...new Set(ordered.filter((key) => legal.includes(key)))];
}

async function searchTo({
  engine,
  start,
  goal,
  label,
  route = "champion",
  combatPolicy = "win",
  maxExpansions = 30000
}) {
  if (goal(start)) return start;

  const heap = new MaxHeap();
  heap.push({
    state: structuredClone(start),
    depth: 0,
    priority: progressionScore(start, route, 0),
    trace: []
  });
  const seen = new Set();
  let expansions = 0;
  let last = null;

  while (heap.size > 0 && expansions < maxExpansions) {
    const current = heap.pop();
    const key = signature(current.state);
    if (seen.has(key)) continue;
    seen.add(key);
    expansions += 1;
    last = current;

    if (goal(current.state)) return current.state;

    if (current.state.pending?.type === "pokemon5e_combat") {
      for (const outcome of combatOutcomes(current.state, combatPolicy)) {
        try {
          const next = engine.resolveCombatHandoff(current.state, outcome);
          const trace = current.trace.slice(-20);
          trace.push(`combat:${current.state.pending.encounterId}:${outcome}`);
          if (goal(next)) return next;
          heap.push({
            state: next,
            depth: current.depth + 1,
            priority: progressionScore(next, route, current.depth + 1),
            trace
          });
        } catch {
          // Illegal outcome for this subsystem state is simply not an edge.
        }
      }
      continue;
    }

    let view;
    try {
      view = await engine.present(current.state);
    } catch {
      continue;
    }

    for (const choice of preferredChoices(view.choices)) {
      try {
        const next = await engine.choose(current.state, choice.id);
        const trace = current.trace.slice(-20);
        trace.push(`${view.sceneId}#${view.nodeId}:${choice.id}`);
        if (goal(next)) return next;
        const bias =
          (/commit|complete|confirm|activate|continue|advance|register|resolve|record|audit|lock/i.test(choice.id) ? 200 : 0) -
          (/review|back|stay|repeat|defer|wait|existing|free_roam/i.test(choice.id) ? 100 : 0);
        heap.push({
          state: next,
          depth: current.depth + 1,
          priority: progressionScore(next, route, current.depth + 1) + bias,
          trace
        });
      } catch {
        // Choices can still fail on subsystem-specific legality (money, roster, etc.).
      }
    }
  }

  const where = last
    ? `${last.state.story?.sceneId}#${last.state.story?.nodeId} trace=${last.trace.join(" -> ")}`
    : "no state expanded";
  throw new Error(
    `Persistent E2E search failed at ${label} after ${expansions} expansions; last=${where}`
  );
}

async function persistReload(store, state, slot, label) {
  const saved = structuredClone(state);
  saved.slot = slot;
  await store.save(saved);
  const loaded = await store.load(slot);
  assert.deepEqual(loaded, saved, `${label} must survive save/reload exactly`);
  return loaded;
}

function flag(name) {
  return (state) => state.world?.flags?.[name] === true;
}

test("RC persistent E2E traverses real authored M1→M12 and all three World outcome routes", async () => {
  let dir;
  try {
    dir = await mkdtemp(path.join(os.tmpdir(), "p5e-rc-persistent-e2e-"));
    const store = new SaveStore(dir);
    const engine = await makeEngine();

    let common = createNewGameState({
      protagonist: "Luke",
      slot: "rc-lineage",
      now: fixedNow
    });

    assert.equal(common.story.sceneId, "m01-release");
    assert.equal(common.story.nodeId, "free_roam");

    for (let module = 1; module <= 6; module += 1) {
      common = await searchTo({
        engine,
        start: common,
        goal: flag(`m${module}_complete`),
        label: `M${module} completion`,
        route: "champion",
        combatPolicy: "win"
      });
      common = await persistReload(store, common, "rc-lineage", `M${module}`);
    }

    const postM6 = structuredClone(common);

    let champion = structuredClone(postM6);
    champion.slot = "rc-champion";
    champion = await searchTo({
      engine,
      start: champion,
      goal: (s) => s.world.flags.m7_complete === true && s.world.flags.m08_unlocked === true,
      label: "M7 qualified route",
      route: "champion",
      combatPolicy: "win"
    });
    champion = await persistReload(store, champion, champion.slot, "M7 qualified");

    let postM8Champion;
    for (const module of [8, 9, 10]) {
      const nextUnlock = module === 8 ? "m09_unlocked" : module === 9 ? "m10_unlocked" : "m11_unlocked";
      champion = await searchTo({
        engine,
        start: champion,
        goal: (s) =>
          s.world.flags[`m${module}_complete`] === true &&
          s.world.flags[nextUnlock] === true,
        label: `M${module} advancing route`,
        route: "champion",
        combatPolicy: "win"
      });
      champion = await persistReload(store, champion, champion.slot, `M${module}`);
      if (module === 8) postM8Champion = structuredClone(champion);
    }

    champion = await searchTo({
      engine,
      start: champion,
      goal: (s) => s.world.flags.m11_complete === true && s.world.flags.world_champion === true,
      label: "M11 World Champion route",
      route: "champion",
      combatPolicy: "win"
    });
    champion = await persistReload(store, champion, champion.slot, "M11 champion");
    champion = await searchTo({
      engine,
      start: champion,
      goal: flag("main_story_complete"),
      label: "M12 champion epilogue",
      route: "champion",
      combatPolicy: "win"
    });
    champion = await persistReload(store, champion, champion.slot, "M12 champion");
    assert.equal(champion.world.flags.m12_complete, true);
    assert.equal(champion.world.flags.postgame_free_roam, true);
    assert.equal(champion.world.flags.world_champion, true);

    let missed = structuredClone(postM6);
    missed.slot = "rc-worlds-missed";
    missed = await searchTo({
      engine,
      start: missed,
      goal: (s) =>
        s.world.flags.m7_complete === true &&
        s.world.flags.m12_unlocked === true &&
        s.world.flags.worlds_missed === true,
      label: "M7 Worlds Missed route",
      route: "missed",
      combatPolicy: "branch",
      maxExpansions: 50000
    });
    missed = await persistReload(store, missed, missed.slot, "M7 Worlds Missed");
    missed = await searchTo({
      engine,
      start: missed,
      goal: flag("main_story_complete"),
      label: "M12 Worlds Missed epilogue",
      route: "missed",
      combatPolicy: "branch",
      maxExpansions: 50000
    });
    missed = await persistReload(store, missed, missed.slot, "M12 Worlds Missed");
    assert.equal(missed.world.flags.worlds_missed, true);
    assert.equal(missed.world.flags.world_qualified, false);
    assert.equal(missed.world.flags.m12_complete, true);

    let eliminated = structuredClone(postM8Champion);
    eliminated.slot = "rc-world-eliminated";
    eliminated = await searchTo({
      engine,
      start: eliminated,
      goal: (s) =>
        s.world.flags.world_eliminated === true &&
        s.world.flags.m12_unlocked === true,
      label: "World Eliminated route",
      route: "eliminated",
      combatPolicy: "branch",
      maxExpansions: 60000
    });
    eliminated = await persistReload(store, eliminated, eliminated.slot, "World Eliminated");
    eliminated = await searchTo({
      engine,
      start: eliminated,
      goal: flag("main_story_complete"),
      label: "M12 World Eliminated epilogue",
      route: "eliminated",
      combatPolicy: "branch",
      maxExpansions: 50000
    });
    eliminated = await persistReload(store, eliminated, eliminated.slot, "M12 eliminated");
    assert.equal(eliminated.world.flags.world_eliminated, true);
    assert.equal(eliminated.world.flags.world_champion, false);
    assert.equal(eliminated.world.flags.m12_complete, true);

    for (const finalState of [champion, missed, eliminated]) {
      assert.equal(finalState.world.flags.main_story_complete, true);
      assert.equal(finalState.world.flags.postgame_free_roam, true);
      assert.equal(finalState.pending, null);
      assert.ok(finalState.story.history.length > 0);
    }
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});
