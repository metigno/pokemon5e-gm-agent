import test from "node:test";
import assert from "node:assert/strict";
import {
  FRIEND_STARTING_BUILDS,
  NPC_ASI_SCRIPTS,
  abilityModifier,
  applyAsi,
  getLegacyIntentResolution,
  isBalancedStandardArray,
  npcAsiScript
} from "../src/bridge/motor-to-poke5e.mjs";

test("all five friends use the same balanced standard array budget",()=>{
  for(const [name,build] of Object.entries(FRIEND_STARTING_BUILDS)){
    assert.equal(isBalancedStandardArray(build.abilities),true,name);
    assert.equal(Object.values(build.abilities).reduce((a,b)=>a+b,0),72,name);
  }
});

test("all starters are level 5 and Luke has Hisuian Growlithe",()=>{
  for(const build of Object.values(FRIEND_STARTING_BUILDS)) assert.equal(build.starter.level,5);
  assert.deepEqual(FRIEND_STARTING_BUILDS.Luke.starter,{species:"Growlithe",form:"Hisuian",level:5});
});

test("legacy Mind Games purpose resolves through INT, not a custom stat",()=>{
  const r=getLegacyIntentResolution("mindGames");
  assert.equal(r.ability,"INT");
  assert.ok(r.skills.includes("Investigation"));
});

test("NPC ASIs use normal Pokemon 5e ASI levels only",()=>{
  for(const script of Object.values(NPC_ASI_SCRIPTS)){
    assert.deepEqual(Object.keys(script).map(Number),[4,8,12,16]);
  }
});

test("the selected player never receives scripted NPC ASIs",()=>{
  assert.equal(npcAsiScript("Luke","Luke"),null);
  assert.ok(npcAsiScript("Mattew","Luke"));
});

test("scripted NPC growth never exceeds 20",()=>{
  for(const [name,build] of Object.entries(FRIEND_STARTING_BUILDS)){
    let a={...build.abilities};
    for(const lvl of [4,8,12,16]) a=applyAsi(a,NPC_ASI_SCRIPTS[name][lvl]);
    for(const v of Object.values(a)) assert.ok(v<=20,name);
  }
});

test("classic d20 modifier curve is retained",()=>{
  assert.equal(abilityModifier(8),-1);
  assert.equal(abilityModifier(10),0);
  assert.equal(abilityModifier(15),2);
  assert.equal(abilityModifier(20),5);
});
