import test from "node:test";
import assert from "node:assert/strict";

import { createNewGameState } from "../src/engine/state.mjs";
import { trainerGameplayView, usePlayerTrainerCombatFeature } from "../src/engine/trainer-ui-runtime.mjs";

function fixture() {
  const state = createNewGameState({ protagonist: "Luke" });
  state.player.classFeatures.push("tactical-healing");
  state.player.classResources["tactical-points"] = { id:"tactical-points", current:3, max:4 };
  const battle = {
    round:1, order:["player","opponent"], turnIndex:0, log:[],
    player:{ turn:{ actionAvailable:true, bonusActionAvailable:true }, effects:{} },
    opponent:{ effects:{} },
    trainer:{ reactionAvailable:true },
    trainerEffects:{}
  };
  return {state,battle};
}

test("Tactical Healing is not offered outside a real Pokémon healing trigger", () => {
  const {state,battle}=fixture();
  const feature=trainerGameplayView(state,battle).features.find(x=>x.id==="tactical-healing");
  assert.equal(feature.legal,false);
  assert.equal(feature.reason,"healing_trigger_required");
});

test("Tactical Healing spends one Tactical Point per d4 queued for the canonical heal", () => {
  const {state,battle}=fixture();
  const context={trigger:"pokemon_healing",featureId:"tactical-healing"};
  const feature=trainerGameplayView(state,battle,context).features.find(x=>x.id==="tactical-healing");
  assert.equal(feature.legal,true);
  const out=usePlayerTrainerCombatFeature(state,battle,{featureId:"tactical-healing",cost:2,targetSide:"player",reactionContext:context});
  assert.equal(out.used,true);
  assert.equal(state.player.classResources["tactical-points"].current,1);
  assert.equal(battle.trainerEffects.tacticalHealing.diceCount,2);
  assert.equal(battle.trainerEffects.tacticalHealing.die,"d4");
  assert.equal(battle.trainerEffects.tacticalHealing.usesRemaining,1);
});
