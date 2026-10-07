import test from "node:test";
import assert from "node:assert/strict";
import {legalNpcTrainerReactions,chooseNpcTrainerReaction,executeNpcTrainerReaction} from "../src/combat/npc-trainer-reactions.mjs";
function battle(points=3){
 return {round:1,opponentTrainer:{reactionAvailable:true,classFeatures:["raise-your-defenses"],classResources:{"tactical-points":{current:points,max:5}},featureUsage:{}},opponent:{effects:{}},player:{effects:{}},log:[]};
}
test("reaction feature is invisible without its actual trigger",()=>{
 assert.deepEqual(legalNpcTrainerReactions(battle(),{trigger:"turn_start"}),[]);
});
test("Raise Your Defenses spends only the bonus needed within legal cost",()=>{
 const b=battle(3);
 assert.deepEqual(chooseNpcTrainerReaction(b,{trigger:"incoming_attack",neededBonus:2}),{featureId:"raise-your-defenses",cost:2,mode:"ac"});
 executeNpcTrainerReaction(b,{trigger:"incoming_attack",neededBonus:2});
 assert.equal(b.opponentTrainer.classResources["tactical-points"].current,1);
 assert.equal(b.opponentTrainer.reactionAvailable,false);
 assert.equal(b.opponent.effects.acModifierSources[0].value,2);
});
test("spent Trainer reaction cannot fire twice in the same round",()=>{
 const b=battle(5);
 executeNpcTrainerReaction(b,{trigger:"incoming_attack",neededBonus:1});
 assert.deepEqual(legalNpcTrainerReactions(b,{trigger:"incoming_attack"}),[]);
});
