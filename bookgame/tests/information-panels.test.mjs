import test from "node:test";
import assert from "node:assert/strict";
import { createNewGameState } from "../src/engine/state.mjs";
import { informationPanelsView, recordPokemonCaught, recordPokemonSeen } from "../src/engine/information-panels.mjs";
import { informationRenderers } from "../ui/public/information-renderers.mjs";

const create = () => createNewGameState({
  protagonist: "Luke", slot: "slot1", startAtIntro: true,
  now: () => "2026-10-08T12:00:00.000Z"
});

test("Pokédex starts with owned starter, not undocumented fauna or NPC Pokémon", () => {
  const state = create();
  const info = informationPanelsView(state);
  assert.equal(info.pokedex.caught, 1);
  assert.equal(info.pokedex.seen, 1);
  assert.equal(info.pokedex.entries[0].speciesId, "growlithe-hisui");
  assert.equal(info.pokedex.entries[0].status, "caught");
  assert.equal(state.pokedex, undefined, "read-only projection must not mutate save");
  assert.ok(!info.people.some((person) => person.name === "Blue"));
  assert.deepEqual(info.hallOfFame, []);
});

test("encounter -> catch persists after release and is idempotent", () => {
  const state = create();
  recordPokemonSeen(state, { speciesId: "shinx" });
  recordPokemonSeen(state, { speciesId: "shinx" });
  let dex = informationPanelsView(state).pokedex;
  assert.equal(dex.seen, 2);
  assert.equal(dex.caught, 1);
  recordPokemonCaught(state, { speciesId: "shinx" });
  recordPokemonCaught(state, { speciesId: "shinx" });
  dex = informationPanelsView(state).pokedex;
  assert.equal(dex.caught, 2);
  assert.equal(dex.entries.filter((entry) => entry.speciesId === "shinx").length, 1);
  assert.ok(!state.player.roster.some((pokemon) => pokemon.speciesId === "shinx"));
  assert.equal(informationPanelsView(structuredClone(state)).pokedex.caught, 2);
});

test("ecology history is retro-compatible and rumours do not mark Seen", () => {
  const state = create();
  state.ecology.history = [{ speciesId: "wooloo", zoneId: "AST-GINESTRE" }];
  state.world.flags.rumour_kyurem = true;
  const entries = informationPanelsView(state).pokedex.entries;
  assert.ok(entries.some((entry) => entry.speciesId === "wooloo" && entry.status === "seen"));
  assert.ok(!entries.some((entry) => entry.speciesId === "kyurem"));
});

test("known people show only qualitative relationships, never hidden score or NPC roster", () => {
  const state = create();
  const before = informationPanelsView(state);
  assert.equal(before.people.length, 4);
  assert.equal(before.people.find((person) => person.name === "Mattew").relationship, "Neutral");
  state.npcs.Blue.relationship.score = 92;
  state.npcs.Blue.relationship.qualitative = "Loyal";
  assert.ok(!informationPanelsView(state).people.some((person) => person.name === "Blue"));
  state.npcs.Blue.state.met = true;
  const met = informationPanelsView(state).people.find((person) => person.name === "Blue");
  assert.equal(met.relationship, "Loyal");
  assert.ok(!Object.hasOwn(met, "score"));
  assert.ok(!Object.hasOwn(met, "roster"));
  // Anchors in M08-M11 use the authored introduced flag, not a generic met field.
  state.npcs.Blue.state.met = false;
  state.npcs.Blue.state.introduced = true;
  assert.ok(informationPanelsView(state).people.some((person) => person.name === "Blue"));
  assert.match(informationPanelsView(state).people.find((person) => person.name === "Blue").description, /Allenatore/);
});

test("reputation hides unimplemented numeric values; progression reads separate module caps", () => {
  const state = create();
  state.reputation = { factions: { CityA: { score: 86 }, CityB: { qualitative: "Respected", score: 71 } } };
  const info = informationPanelsView(state);
  assert.deepEqual(info.reputation.entries, [{ name: "CityB", label: "Respected" }]);
  assert.equal(info.progression.moduleId, "M01");
  assert.equal(info.progression.pokemonCap, 5);
  assert.equal(info.progression.trainerCap, 3);
  assert.equal(info.progression.trainerLevel, 1);
  assert.ok(Number.isFinite(info.progression.trainerNextLevelXp));
});

test("Hall of Fame includes only resolved editions, deduplicates current, survives saves", () => {
  const state = create();
  const world = state.competition.world;
  world.currentWorldChampion = { name: "Cynthia", id: "cynthia" };
  assert.deepEqual(informationPanelsView(state).hallOfFame, [], "unresolved finals are spoilers");
  world.finalResolved = true;
  let hall = informationPanelsView(state).hallOfFame;
  assert.equal(hall.length, 1);
  assert.equal(hall[0].champion, "Cynthia");
  world.hallOfFame = [{ edition: 1, champion: { name: "Cynthia" } }];
  assert.equal(informationPanelsView(state).hallOfFame.length, 1);
  world.edition = 2;
  world.currentWorldChampion = { name: "Luke" };
  world.currentWorldRunnerUp = { name: "Edward" };
  hall = informationPanelsView(structuredClone(state)).hallOfFame;
  assert.deepEqual(hall.map((entry) => entry.champion), ["Cynthia", "Luke"]);
  assert.equal(hall[1].playerChampion, true);
  assert.equal(hall[1].runnerUp, "Edward");
});

test("all eight read-only information surfaces render offline and are navigable from existing menus", () => {
  const state = create();
  state.world.flags.rumour_kyurem = true;
  const snapshot = {
    information: informationPanelsView(state),
    player: {
      ...state.player,
      roster: [{ ...state.player.roster[0], name: "Growlithe di Hisui", speciesId: "growlithe-hisui" }]
    }
  };
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const pages = informationRenderers(snapshot, {
    escapeHtml,
    spriteUrl: (species, role) => `/asset/${species}/${role}`,
    playerFacingLabel: (id) => String(id).replaceAll("-", " ")
  });
  for (const name of ["pokedex", "people", "relations", "reputation", "progress", "hall", "codex"]) {
    assert.match(pages[name](), /data-card/);
  }
  assert.match(pages.pokedex(), /growlithe hisui/i);
  assert.doesNotMatch(pages.pokedex(), /kyurem/i);
  assert.doesNotMatch(pages.people(), /Blue/);
  assert.doesNotMatch(pages.relations(), /score|100/i);
  assert.match(pages.codex(), /senza connessione/i);
  assert.match(pages.hall(), /non ha ancora un vincitore/i);
  const links = Object.values(pages.shortcuts()).join(" ");
  for (const name of ["pokedex", "people", "relations", "reputation", "progress", "hall", "codex"]) {
    assert.match(links, new RegExp('data-info-panel="' + name + '"'));
  }
});
