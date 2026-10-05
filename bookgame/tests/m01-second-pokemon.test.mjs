import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { compileStory } from "../src/compiler/story-compiler.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";
import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../content/modules/", import.meta.url));
const ecologyProfilesDir = fileURLToPath(new URL("../content/ecology/", import.meta.url));
const zonePoolsFile = fileURLToPath(new URL("../../campaign/world/ecology/ZONE_POOLS.json", import.meta.url));
const distributionFile = fileURLToPath(new URL("../../campaign/world/ecology/SPECIES_DISTRIBUTION.json", import.meta.url));
const faunaIndexFile = fileURLToPath(new URL("../../campaign/world/fauna/ASTERIA_FAUNA_INDEX.json", import.meta.url));
const ecologyOptions = { profilesDir: ecologyProfilesDir, zonePoolsFile, distributionFile, faunaIndexFile };
const fixedNow = () => "2026-10-05T09:15:00.000Z";

async function makeEngine({ dice = new SequenceDice([1]) } = {}) {
  const bundle = await compileStory({ scenesDir, modulesDir, ecologyOptions });
  const scenes = {
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
  };
  return { engine: new BookgameEngine({ scenes, ecology: bundle.ecology, dice, now: fixedNow }), bundle };
}

function resolvedOpponent({
  speciesId,
  name,
  level = 1,
  abilityId = "run-away",
  hp = { current: 2, max: 8 },
  moveIds = ["tackle"],
  pp = { tackle: 20 }
}) {
  return {
    speciesId,
    name,
    level,
    hp,
    statuses: { nonVolatile: null, volatile: [] },
    abilityId,
    moveIds,
    pp
  };
}

test("M1_11 roster preparation exposes Houndour, Ginestre, Farm and Valedarsena legal routes", async () => {
  const { bundle } = await makeEngine();
  const city = bundle.scenes["m01-valedarsena-first-arrival"];
  const prep = city.nodes.roster_preparation;

  assert.ok(prep.choices.some((choice) => choice.id === "seek_ginestre"));
  assert.ok(prep.choices.some((choice) => choice.id === "seek_farm"));
  assert.ok(prep.choices.some((choice) => choice.id === "seek_city"));
  assert.ok(prep.choices.some((choice) => choice.id === "stay_one"));

  const cityWild = city.nodes.city_hub.choices.find((choice) => choice.id === "observe_city_wildlife");
  assert.ok(cityWild);
  assert.equal(cityWild.ecology.zoneId, "VAL-CITY");
  assert.equal(cityWild.ecology.habitat, "city");
  assert.equal(cityWild.ecology.method, "wild_observation");
  assert.deepEqual(cityWild.ecology.allowedSpecies, ["pidgey", "burmy", "tandemaus", "purrloin"]);

  const houndourNodes = bundle.scenes["first-road"].nodes;
  const houndourCaptureRoutes = Object.values(houndourNodes)
    .flatMap((node) => node.choices ?? [])
    .filter((choice) => choice.combat?.encounterId === "HOUNDOUR_GINESTRE_001");
  assert.ok(houndourCaptureRoutes.length > 0);
  assert.ok(houndourCaptureRoutes.every((choice) => choice.combat.returnNodes.captured));
});

test("M1_11 Valedarsena urban species are all in the compiled canonical VAL-CITY pool", async () => {
  const { bundle } = await makeEngine();
  const request = bundle.scenes["m01-valedarsena-first-arrival"].nodes.city_hub.choices
    .find((choice) => choice.id === "observe_city_wildlife").ecology;
  const valid = new Set(bundle.ecology.zones["VAL-CITY"].species.map((entry) => entry.id));

  assert.ok(request.allowedSpecies.every((speciesId) => valid.has(speciesId)));

  const species = Object.fromEntries(
    bundle.ecology.zones["VAL-CITY"].species
      .filter((entry) => request.allowedSpecies.includes(entry.id))
      .map((entry) => [entry.id, entry])
  );
  for (const id of request.allowedSpecies) {
    assert.equal(species[id].distributionClass, "established_wild");
    assert.equal(species[id].habitats.includes("city"), true);
    assert.equal(species[id].encounterMethods.includes("wild_observation"), true);
  }
});

test("M1_11 city ecology remains time-aware instead of spawning every authored species at once", async () => {
  const { engine } = await makeEngine({ dice: new SequenceDice([1]) });
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.world.locationId = "valedarsena_city";
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "city_hub";
  state.world.minuteOfDay = 8 * 60;
  state.world.time = "morning";

  state = await engine.choose(state, "observe_city_wildlife");

  assert.equal(state.ecology.lastEncounter.zoneId, "VAL-CITY");
  assert.equal(["pidgey", "burmy", "tandemaus"].includes(state.ecology.lastEncounter.speciesId), true);
  assert.notEqual(state.ecology.lastEncounter.speciesId, "purrloin");
});

test("M1_11 only mechanically executable urban species can offer battle/capture", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m01-ecology-opportunities"];

  for (const nodeId of ["val_pidgey", "val_burmy", "val_purrloin"]) {
    assert.equal(scene.nodes[nodeId].choices.some((choice) => choice.id === "engage"), false);
  }
  assert.equal(scene.nodes.val_tandemaus.choices.some((choice) => choice.id === "engage"), true);
});

test("M1_11 Tandemaus is executable in the offline Pokémon 5e combat pack", async () => {
  const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([10, 10, 10, 10]) });
  const tandemaus = await combat.createCombatant({ species: "Tandemaus", level: 1 });

  assert.equal(tandemaus.speciesId, "tandemaus");
  assert.equal(tandemaus.abilityId, "run-away");
  assert.ok(tandemaus.moveIds.includes("pound"));
});

test("M1_11 merely entering a wild battle never mutates the roster or grants a Pokémon", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.world.locationId = "valedarsena_city";
  state.story.sceneId = "m01-ecology-opportunities";
  state.story.nodeId = "val_tandemaus";
  const before = structuredClone(state.player.roster);

  state = await engine.choose(state, "engage");

  assert.equal(state.pending.type, "pokemon5e_combat");
  assert.equal(state.pending.encounterId, "M1_VAL_TANDEMAUS_001");
  assert.equal(state.pending.opponentRegistered, false);
  assert.deepEqual(state.player.roster, before);
  assert.equal(state.player.secondPokemonAcquisition, undefined);
});

test("M1_11 captured outcome without real resolver opponent state is rejected", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.story.sceneId = "m01-ecology-opportunities";
  state.story.nodeId = "val_tandemaus";

  state = await engine.choose(state, "engage");

  assert.throws(
    () => engine.resolveCombatHandoff(state, "captured"),
    /requires resolved Pokémon 5e opponent state/
  );
  assert.equal(state.player.roster.length, 1);
});

test("M1_11 defeating a wild Pokémon does not auto-capture it", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.story.sceneId = "m01-ecology-opportunities";
  state.story.nodeId = "val_tandemaus";

  state = await engine.choose(state, "engage");
  state = engine.setCombatState(state, {
    encounterId: "M1_VAL_TANDEMAUS_001",
    outcome: "win",
    opponent: resolvedOpponent({
      speciesId: "tandemaus",
      name: "Tandemaus",
      abilityId: "run-away",
      moveIds: ["pound"],
      pp: { pound: 20 }
    })
  });
  state = engine.resolveCombatHandoff(state, "win");

  assert.equal(state.story.nodeId, "val_wild_win");
  assert.equal(state.player.roster.length, 1);
  assert.equal(state.player.secondPokemonAcquisition, undefined);
});

test("M1_11 real urban capture persists species, state and second-Pokémon provenance", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.world.locationId = "valedarsena_city";
  state.story.sceneId = "m01-ecology-opportunities";
  state.story.nodeId = "val_tandemaus";

  state = await engine.choose(state, "engage");
  state = engine.setCombatState(state, {
    encounterId: "M1_VAL_TANDEMAUS_001",
    outcome: "captured",
    opponent: resolvedOpponent({
      speciesId: "tandemaus",
      name: "Tandemaus",
      abilityId: "run-away",
      hp: { current: 3, max: 17 },
      moveIds: ["pound"],
      pp: { pound: 18 }
    })
  });
  state = engine.resolveCombatHandoff(state, "captured");

  assert.equal(state.story.nodeId, "val_wild_captured");
  assert.equal(state.player.roster.length, 2);
  assert.equal(state.player.roster[1].speciesId, "tandemaus");
  assert.deepEqual(state.player.roster[1].hp, { current: 3, max: 17 });
  assert.equal(state.player.roster[1].abilityId, "run-away");
  assert.deepEqual(state.player.roster[1].moveIds, ["pound"]);
  assert.equal(state.player.secondPokemonAcquisition.speciesId, "tandemaus");
  assert.equal(state.player.secondPokemonAcquisition.locationId, "valedarsena_city");
  assert.equal(state.player.secondPokemonAcquisition.encounterId, "M1_VAL_TANDEMAUS_001");
});

test("M1_11 later captures never overwrite the identity of the true second Pokémon", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.world.locationId = "valedarsena_city";
  state.story.sceneId = "m01-ecology-opportunities";
  state.story.nodeId = "val_tandemaus";

  state = await engine.choose(state, "engage");
  state = engine.setCombatState(state, {
    encounterId: "M1_VAL_TANDEMAUS_001",
    outcome: "captured",
    opponent: resolvedOpponent({
      speciesId: "tandemaus",
      name: "Tandemaus",
      abilityId: "run-away",
      moveIds: ["pound"],
      pp: { pound: 20 }
    })
  });
  state = engine.resolveCombatHandoff(state, "captured");
  const second = structuredClone(state.player.secondPokemonAcquisition);

  state.world.locationId = "asteria_farm";
  state.story.sceneId = "m01-ecology-opportunities";
  state.story.nodeId = "farm_shinx";
  state = await engine.choose(state, "engage");
  state = engine.setCombatState(state, {
    encounterId: "M1_FARM_SHINX_001",
    outcome: "captured",
    opponent: resolvedOpponent({
      speciesId: "shinx",
      name: "Shinx",
      abilityId: "intimidate"
    })
  });
  state = engine.resolveCombatHandoff(state, "captured");

  assert.equal(state.player.roster.length, 3);
  assert.deepEqual(state.player.secondPokemonAcquisition, second);
  assert.equal(state.player.secondPokemonAcquisition.speciesId, "tandemaus");
});

test("M1_11 roster size two mechanically unlocks Trial registration but does not auto-register", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.player.roster.push({ speciesId: "tandemaus", name: "Tandemaus", level: 1 });
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "arena_front";
  state.world.locationId = "valedarsena_arena";

  state = await engine.choose(state, "note_trial");
  assert.equal(state.competition.trials.RANK_F_TO_E.available, true);
  assert.equal(state.competition.trials.RANK_F_TO_E.registered, false);

  const view = await engine.present(state);
  assert.equal(view.choices.some((choice) => choice.id === "register"), true);
  assert.equal(view.choices.some((choice) => choice.id === "missing_roster"), false);
});

test("M1_11 one-Pokémon choice remains legal and never promotes or registers the player", async () => {
  const { engine } = await makeEngine();
  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "roster_preparation";
  state.world.locationId = "valedarsena_arena";

  state = await engine.choose(state, "stay_one");

  assert.equal(state.player.roster.length, 1);
  assert.equal(state.competition.rank, "F");
  assert.deepEqual(state.competition.trials, {});
  assert.equal(state.story.nodeId, "city_hub");
});

test("M1_11 second-Pokémon provenance survives save/reload exactly", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m1-second-pokemon-"));
  try {
    const { engine } = await makeEngine();
    const store = new SaveStore(dir);
    let state = createNewGameState({ protagonist: "Luke", slot: "m1-second", now: fixedNow });
    state.world.locationId = "valedarsena_city";
    state.story.sceneId = "m01-ecology-opportunities";
    state.story.nodeId = "val_tandemaus";

    state = await engine.choose(state, "engage");
    state = engine.setCombatState(state, {
      encounterId: "M1_VAL_TANDEMAUS_001",
      outcome: "captured",
      opponent: resolvedOpponent({
        speciesId: "tandemaus",
        name: "Tandemaus",
        abilityId: "run-away"
      })
    });
    state = engine.resolveCombatHandoff(state, "captured");

    await store.save(state);
    const loaded = await store.load("m1-second");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.player.roster.length, 2);
    assert.equal(loaded.player.secondPokemonAcquisition.speciesId, "tandemaus");
    assert.equal(loaded.player.secondPokemonAcquisition.encounterId, "M1_VAL_TANDEMAUS_001");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
