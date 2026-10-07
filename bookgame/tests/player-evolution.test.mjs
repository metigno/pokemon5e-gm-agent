import test from "node:test";
import assert from "node:assert/strict";
import { createNewGameState } from "../src/engine/state.mjs";
import { playerEvolutionOptions, applyPlayerEvolution } from "../src/engine/player-evolution.mjs";

test("player evolution bridge discovers options through canonical runtime", async () => {
  const state = createNewGameState({ protagonist: "Daniel" });
  state.player.roster[0].level = 8;
  const options = await playerEvolutionOptions(state, { rosterIndex: 0 });
  assert.ok(options.some((entry) => entry.evolution.from === "gastly" && entry.evolution.to === "haunter"));
});

test("player evolution bridge applies runtime result to roster and returns presentation", async () => {
  const state = createNewGameState({ protagonist: "Daniel" });
  state.player.roster[0].level = 8;
  const options = await playerEvolutionOptions(state, { rosterIndex: 0 });
  const target = options.find((entry) => entry.evolution.to === "haunter");
  assert.ok(target);

  const outcome = await applyPlayerEvolution(state, {
    rosterIndex: 0,
    evolutionId: target.evolution.id
  });

  if (outcome.result.status === "choice_required") {
    const points = outcome.result.choice.points;
    const resolved = await applyPlayerEvolution(state, {
      rosterIndex: 0,
      evolutionId: target.evolution.id,
      asiDistribution: points <= 4 ? { con: points } : { con: 4, str: points - 4 }
    });
    assert.equal(resolved.state.player.roster[0].speciesId, "haunter");
    assert.equal(resolved.presentation.to, "haunter");
    assert.equal(state.player.roster[0].species, "Gastly");
  } else {
    assert.equal(outcome.state.player.roster[0].speciesId, "haunter");
    assert.equal(outcome.presentation.to, "haunter");
    assert.equal(state.player.roster[0].species, "Gastly");
  }
});
