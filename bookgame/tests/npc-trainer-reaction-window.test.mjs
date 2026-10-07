import test from "node:test";
import assert from "node:assert/strict";
import {chooseNpcTrainerReaction} from "../src/combat/npc-trainer-reactions.mjs";
function battle(points=5){return {opponentTrainer:{reactionAvailable:true,classFeatures:["raise-your-defenses"],classResources:{"tactical-points":{current:points,max:5}}}};}
test("NPC spends no reaction when attack already misses",()=>{
 const b=battle();
 const attackTotal=14,ac=15;
 const args=attackTotal<ac?null:chooseNpcTrainerReaction(b,{trigger:"incoming_attack",neededBonus:attackTotal-ac+1});
 assert.equal(args,null);
});
test("NPC spends exact affordable amount to turn a normal hit into miss",()=>{
 const b=battle(5),attackTotal=17,ac=15;
 assert.deepEqual(chooseNpcTrainerReaction(b,{trigger:"incoming_attack",neededBonus:attackTotal-ac+1}),{featureId:"raise-your-defenses",cost:3,mode:"ac"});
});
test("NPC does not react when required AC bonus exceeds available points",()=>{
 const b=battle(2),attackTotal=19,ac=15;
 const need=attackTotal-ac+1;
 const args=chooseNpcTrainerReaction(b,{trigger:"incoming_attack",neededBonus:need});
 assert.equal(args,null);
});
