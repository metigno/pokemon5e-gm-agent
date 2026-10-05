import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { compileStory } from "../src/compiler/story-compiler.mjs";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../content/modules/", import.meta.url));
const ecologyProfilesDir = fileURLToPath(new URL("../content/ecology/", import.meta.url));
const zonePoolsFile = fileURLToPath(new URL("../../campaign/world/ecology/ZONE_POOLS.json", import.meta.url));
const distributionFile = fileURLToPath(new URL("../../campaign/world/ecology/SPECIES_DISTRIBUTION.json", import.meta.url));
const faunaIndexFile = fileURLToPath(new URL("../../campaign/world/fauna/ASTERIA_FAUNA_INDEX.json", import.meta.url));
const ecologyOptions = { profilesDir: ecologyProfilesDir, zonePoolsFile, distributionFile, faunaIndexFile };

const fixedNow = () => "2026-10-05T06:20:00.000Z";

async function repositoryWithEcology() {
  const bundle = await compileStory({ scenesDir, modulesDir, ecologyOptions });
  return {
    bundle,
    repository: {
      async load(sceneId) {
        const scene = bundle.scenes[sceneId];
        if (!scene) throw new Error("missing scene " + sceneId);
        return structuredClone(scene);
      },
      async loadWorldEvents() {
        return structuredClone(bundle.worldEvents ?? []);
      },
      async loadEcology() {
        return structuredClone(bundle.ecology);
      }
    }
  };
}

test("M1_01 Ginestre entry consumes real travel time and fires A1_FIRST_ROAD", async () => {
  const { repository } = await repositoryWithEcology();
  const engine = new BookgameEngine({ scenes: repository, now: fixedNow });
  const start = createNewGameState({ protagonist: "Luke", now: fixedNow });

  const next = await engine.choose(start, "to_ginestre");

  assert.equal(next.story.sceneId, "m01-first-road");
  assert.equal(next.story.nodeId, "road_entry");
  assert.equal(next.world.locationId, "asteria_ginestre");
  assert.equal(next.world.elapsedMinutes, start.world.elapsedMinutes + 20);
  assert.equal(next.events.A1_FIRST_ROAD.status, "resolved");
  assert.equal(next.events.A1_FIRST_ROAD.outcomeId, "road_open");
  assert.equal(next.world.flags.m1_first_road_seen, true);
  assert.deepEqual(next.quests, {});
});

test("M1_01 never blocks progress behind optional content", async () => {
  const { repository } = await repositoryWithEcology();
  const engine = new BookgameEngine({ scenes: repository, now: fixedNow });
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });

  state = await engine.choose(state, "to_ginestre");
  state = await engine.choose(state, "continue_to_houndour");

  assert.equal(state.story.sceneId, "first-road");
  assert.equal(state.story.nodeId, "arrival");
  assert.deepEqual(state.quests, {});
});

test("M1_01 rookie sparring is offered but remains optional until explicitly accepted", async () => {
  const { repository } = await repositoryWithEcology();
  const engine = new BookgameEngine({ scenes: repository, now: fixedNow });
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });

  state = await engine.choose(state, "to_ginestre");
  state = await engine.choose(state, "talk_rookie");
  assert.deepEqual(state.quests, {});

  state = await engine.choose(state, "ask_sparring");
  assert.equal(state.quests.SQ_GINESTRE_FIRST_SPARRING.status, "available");

  state = await engine.choose(state, "decline_sparring");
  assert.equal(state.quests.SQ_GINESTRE_FIRST_SPARRING.status, "available");
  assert.equal(state.story.nodeId, "road_entry");

  state = await engine.choose(state, "talk_rookie");
  state = await engine.choose(state, "ask_sparring");
  state = await engine.choose(state, "accept_sparring");
  assert.equal(state.quests.SQ_GINESTRE_FIRST_SPARRING.status, "active");

  state = await engine.choose(state, "begin_sparring");
  assert.equal(state.pending.type, "pokemon5e_combat");
  assert.equal(state.pending.encounterId, "SQ_GINESTRE_FIRST_SPARRING_001");
  assert.equal(state.pending.opponent.species, "Wooloo");
  assert.equal(state.pending.opponent.level, 4);
  assert.equal(state.pending.opponentRegistered, true);
});

test("M1_01 environmental clue writes only observation/world-pressure state and can still exit immediately", async () => {
  const { repository } = await repositoryWithEcology();
  const engine = new BookgameEngine({
    scenes: repository,
    dice: new SequenceDice([20]),
    now: fixedNow
  });
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });

  state = await engine.choose(state, "to_ginestre");
  state = await engine.choose(state, "inspect_road");

  assert.equal(state.story.nodeId, "clue_success");
  assert.equal(state.world.flags.m1_first_road_clue, "displaced_markers");
  assert.equal(state.world.flags.m1_world_pressure_known, true);

  state = await engine.choose(state, "fork_after_clue");
  assert.equal(state.story.sceneId, "m01-ginestre-crossroads");
  assert.equal(state.story.nodeId, "crossroads");
});

test("M1_01 wildlife observation uses ecology without auto-starting combat", async () => {
  const { repository } = await repositoryWithEcology();
  const engine = new BookgameEngine({
    scenes: repository,
    dice: new SequenceDice([1]),
    now: fixedNow
  });
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });

  state = await engine.choose(state, "to_ginestre");
  const before = state.world.elapsedMinutes;
  state = await engine.choose(state, "watch_wildlife");

  assert.equal(state.world.elapsedMinutes, before + 15);
  assert.equal(state.world.flags.m1_first_road_wildlife_checked, true);
  assert.equal(state.pending, null);
  assert.ok(["wooloo", "shinx"].includes(state.ecology.lastEncounter?.speciesId));
  assert.equal(state.story.sceneId, "m01-ecology-opportunities");
  assert.ok(["gin_wooloo", "gin_shinx"].includes(state.story.nodeId));
});

test("M1_01 can bypass Houndour and reach the first fork while time keeps advancing", async () => {
  const { repository } = await repositoryWithEcology();
  const engine = new BookgameEngine({ scenes: repository, now: fixedNow });
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });

  state = await engine.choose(state, "to_ginestre");
  const before = state.world.elapsedMinutes;
  state = await engine.choose(state, "bypass_to_fork");

  assert.equal(state.world.elapsedMinutes, before + 15);
  assert.equal(state.story.sceneId, "m01-ginestre-crossroads");
  assert.equal(state.story.nodeId, "crossroads");
  assert.equal(state.world.flags.houndour_ginestre_disposition, undefined);
});
