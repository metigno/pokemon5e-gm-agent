import test from "node:test";
import assert from "node:assert/strict";
import { opponentKnowledgeView, battleFogView } from "../src/combat/fog-of-war.mjs";

const enemy={speciesId:"gengar",name:"Gengar",level:12,types:["ghost","poison"],abilityId:"levitate",moveIds:["shadow-ball","hypnosis"],hp:{current:30,max:40},stats:{ac:15},pp:{"shadow-ball":10},effects:{secret:true}};

test("public fog exposes battle-observable identity and HP but hides build data",()=>{
  const view=opponentKnowledgeView(enemy,0);
  assert.equal(view.name,"Gengar");
  assert.deepEqual(view.hp,{current:30,max:40});
  assert.equal("level" in view,false);
  assert.equal("moveIds" in view,false);
  assert.equal("abilityId" in view,false);
  assert.equal("stats" in view,false);
});

test("knowledge tiers progressively reveal basic, advanced and pro data",()=>{
  assert.deepEqual(opponentKnowledgeView(enemy,1).types,["ghost","poison"]);
  assert.deepEqual(opponentKnowledgeView(enemy,2).moveIds,["shadow-ball","hypnosis"]);
  assert.equal(opponentKnowledgeView(enemy,2).abilityId,"levitate");
  assert.deepEqual(opponentKnowledgeView(enemy,3).pp,{"shadow-ball":10});
});

test("battle fog applies independent active and bench knowledge",()=>{
  const view=battleFogView({round:2,outcome:null,player:{name:"Arcanine"},opponent:enemy,opponentBench:[enemy],awaitingSwitch:null},{active:2,bench:0});
  assert.deepEqual(view.opponent.moveIds,["shadow-ball","hypnosis"]);
  assert.equal("moveIds" in view.opponentBench[0],false);
});
