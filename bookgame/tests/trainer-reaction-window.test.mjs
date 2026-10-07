import test from "node:test";
import assert from "node:assert/strict";
import {tryTrainerAcReaction} from "../src/combat/trainer-reaction-window.mjs";
function trainer(points){return {reactionAvailable:true,classFeatures:["raise-your-defenses"],classResources:{"tactical-points":{current:points,max:5}},featureUsage:{}};}
function battle(side="opponent",points=5){
 return {round:1,trainer:side==="player"?trainer(points):{reactionAvailable:true,classFeatures:[],classResources:{}},opponentTrainer:side==="opponent"?trainer(points):{reactionAvailable:true,classFeatures:[],classResources:{}},player:{effects:{}},opponent:{effects:{}},log:[]};
}
for(const side of ["player","opponent"]) test("AC reaction window is side-agnostic: "+side,()=>{
 const b=battle(side,5);
 const out=tryTrainerAcReaction(b,{defenderSide:side,attackTotal:17,defenderAc:15,natural:12});
 assert.equal(out.reacted,true); assert.equal(out.defenderAc,18); assert.equal(out.cost,3);
 const t=side==="player"?b.trainer:b.opponentTrainer;
 assert.equal(t.classResources["tactical-points"].current,2); assert.equal(t.reactionAvailable,false);
});
test("reaction is not spent on critical forced hit existing miss or unaffordable margin",()=>{
 for(const args of [
  {attackTotal:20,defenderAc:15,natural:20,critical:true},
  {attackTotal:20,defenderAc:15,natural:10,forcedHit:true},
  {attackTotal:14,defenderAc:15,natural:10},
  {attackTotal:20,defenderAc:15,natural:10}
 ]){
  const b=battle("opponent",2);
  assert.equal(tryTrainerAcReaction(b,{defenderSide:"opponent",...args}).reacted,false);
  assert.equal(b.opponentTrainer.classResources["tactical-points"].current,2);
 }
});
