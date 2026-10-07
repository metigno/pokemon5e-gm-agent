import test from "node:test";
import assert from "node:assert/strict";
import {executeNpcTrainerFeatureInCombat} from "../src/combat/npc-trainer-runtime.mjs";

function battle(){
 return {round:1,opponentTrainerId:"Luke",opponentTrainer:{classFeatures:["directed-strike"],classResources:{"tactical-points":{current:3,max:5}},featureUsage:{},actionAvailable:true,bonusActionAvailable:true,reactionAvailable:true},opponent:{effects:{}},player:{effects:{}},log:[]};
}
test("live NPC Trainer feature consumes persistent combat resource and applies effect",()=>{
 const b=battle();
 const out=executeNpcTrainerFeatureInCombat(b,{featureId:"directed-strike"});
 assert.equal(out.result.used,true);
 assert.equal(b.opponentTrainer.classResources["tactical-points"].current,1);
 assert.equal(b.opponentTrainer.featureUsage["directed-strike"].uses,1);
 assert.equal(b.opponent.effects.damageAdvantageSources.length,1);
 assert.ok(b.log.some(e=>e.type==="npc_trainer_feature"&&e.featureId==="directed-strike"));
});
test("NPC Trainer cannot execute feature after resource is exhausted",()=>{
 const b=battle(); b.opponentTrainer.classResources["tactical-points"].current=1;
 const out=executeNpcTrainerFeatureInCombat(b,{featureId:"directed-strike"});
 assert.equal(out.result.used,false);
 assert.equal(b.opponentTrainer.classResources["tactical-points"].current,1);
 assert.equal(b.opponent.effects?.damageAdvantageSources,undefined);
});
