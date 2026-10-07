import test from "node:test";
import assert from "node:assert/strict";
import { chooseForcedOpponentReplacement } from "../src/combat/forced-switch-ai.mjs";

function mon(id,{hp=10,max=10,level=5,types=["normal"]}={}) {
  return {speciesId:id,hp:{current:hp,max},level,types};
}

test("forced-switch AI ignores fainted reserves and prefers healthier legal Pokemon",()=>{
  const battle={player:mon("enemy"),opponentBench:[
    mon("fainted",{hp:0,max:20,level:20}),
    mon("hurt",{hp:5,max:20,level:20}),
    mon("healthy",{hp:18,max:20,level:10})
  ]};
  assert.equal(chooseForcedOpponentReplacement(battle),2);
});

test("forced-switch AI uses deterministic matchup and level tie-breakers",()=>{
  const battle={player:mon("enemy",{types:["fire"]}),opponentBench:[
    mon("same",{level:10,types:["fire"]}),
    mon("different",{level:8,types:["water"]}),
    mon("different-strong",{level:12,types:["water"]})
  ]};
  assert.equal(chooseForcedOpponentReplacement(battle),2);
});

test("forced-switch AI returns null when no legal reserve survives",()=>{
  const battle={player:mon("enemy"),opponentBench:[mon("a",{hp:0}),mon("b",{hp:0})]};
  assert.equal(chooseForcedOpponentReplacement(battle),null);
});
