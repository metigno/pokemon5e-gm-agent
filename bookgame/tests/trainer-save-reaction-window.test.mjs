import test from "node:test";
import assert from "node:assert/strict";
import {tryTrainerSaveReaction} from "../src/combat/trainer-reaction-window.mjs";
function t(points){return {reactionAvailable:true,classFeatures:["raise-your-defenses"],classResources:{"tactical-points":{current:points,max:5}},featureUsage:{}};}
function b(side,points){return {round:1,trainer:side==="player"?t(points):{reactionAvailable:true,classFeatures:[],classResources:{}},opponentTrainer:side==="opponent"?t(points):{reactionAvailable:true,classFeatures:[],classResources:{}},player:{effects:{}},opponent:{effects:{}},log:[]};}
for(const side of ["player","opponent"]) test("save reaction is universal for "+side,()=>{
 const x=b(side,4); const out=tryTrainerSaveReaction(x,{defenderSide:side,saveTotal:13,saveDc:16,natural:10});
 assert.equal(out.reacted,true); assert.equal(out.saveTotal,16); assert.equal(out.cost,3);
 const tr=side==="player"?x.trainer:x.opponentTrainer;
 assert.equal(tr.classResources["tactical-points"].current,1); assert.equal(tr.reactionAvailable,false);
});
test("save reaction is not wasted on success or impossible margin",()=>{
 let x=b("opponent",4); assert.equal(tryTrainerSaveReaction(x,{defenderSide:"opponent",saveTotal:16,saveDc:16,natural:10}).reacted,false);
 assert.equal(x.opponentTrainer.classResources["tactical-points"].current,4);
 x=b("opponent",2); assert.equal(tryTrainerSaveReaction(x,{defenderSide:"opponent",saveTotal:10,saveDc:16,natural:8}).reacted,false);
 assert.equal(x.opponentTrainer.classResources["tactical-points"].current,2);
});
