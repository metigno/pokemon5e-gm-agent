import test from "node:test";
import assert from "node:assert/strict";

import {
  evolutionPresentationFromResult,
  evolutionPresentationPhases
} from "../src/engine/evolution-presentation.mjs";

test("evolution presentation preserves Emerald-inspired phase order without changing mechanics", () => {
  const phases = evolutionPresentationPhases();
  assert.deepEqual(
    phases.map((entry) => entry.id),
    ["spiral", "arc", "morph", "circle", "flash", "reveal"]
  );

  const mechanical = {
    status: "evolved",
    mode: "replace",
    evolution: { id: "bulbasaur-to-ivysaur", from: "bulbasaur", to: "ivysaur" },
    pokemon: { speciesId: "ivysaur", level: 5, hp: { current: 30, max: 30 } }
  };
  const before = structuredClone(mechanical);
  const view = evolutionPresentationFromResult(mechanical);

  assert.deepEqual(mechanical, before);
  assert.equal(view.presentation.from, "bulbasaur");
  assert.equal(view.presentation.to, "ivysaur");
  assert.equal(view.presentation.background, "/assets/evolution/bg.png");
  assert.equal(view.presentation.sparkle, "/assets/evolution/evo_sparkle.png");
  assert.equal(view.presentation.cancellable, false);
});

test("pending evolution ASI stays a mechanical choice and starts no animation", () => {
  const result = {
    status: "choice_required",
    choice: {
      type: "evolution_asi",
      points: 2,
      evolutionId: "example",
      from: "a",
      to: "b"
    },
    pokemon: { speciesId: "a" }
  };

  const view = evolutionPresentationFromResult(result);
  assert.equal(view.status, "choice_required");
  assert.equal(view.presentation, null);
  assert.deepEqual(view.choice, result.choice);
});

test("reduced motion collapses evolution to an instant reveal", () => {
  const view = evolutionPresentationFromResult({
    status: "evolved",
    evolution: { from: "charmander", to: "charmeleon" },
    pokemon: { speciesId: "charmeleon" }
  }, { reducedMotion: true });

  assert.deepEqual(view.presentation.phases, [
    { id: "reveal", durationMs: 0, effect: "instant_reveal" }
  ]);
});

test("additional evolutions are presented without pretending the original species was replaced", () => {
  const view = evolutionPresentationFromResult({
    status: "evolved",
    mode: "additional",
    pokemon: { speciesId: "nincada" },
    additionalPokemon: { speciesId: "shedinja", level: 10 }
  });

  assert.equal(view.presentation.kind, "additional_pokemon");
  assert.equal(view.presentation.pokemon.speciesId, "shedinja");
});
