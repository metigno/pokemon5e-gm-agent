import test from "node:test";
import assert from "node:assert/strict";
import {legalTrainerFeatureActions} from "../src/engine/trainer-actions.mjs";
import {npcTrainerFeatureCandidates,chooseNpcTrainerFeature} from "../src/combat/npc-trainer-tactics.mjs";

function state(){
 return {npcs:{Luke:{trainer:{classFeatures:["directed-strike","raise-your-defenses","unknown-feature"],classResources:{"tactical-points":{current:2,max:5}},featureUsage:{}}}}};
}
test("NPC candidate generator exposes only executable unlocked funded features",()=>{
 const s=state();
 const c=npcTrainerFeatureCandidates(s,{npcId:"Luke",actionEconomy:{action:true,bonusAction:true,reaction:false}});
 assert.deepEqual(c.map(x=>x.featureId),["directed-strike"]);
});
test("insufficient Trainer resource removes feature before AI scoring",()=>{
 const s=state(); s.npcs.Luke.trainer.classResources["tactical-points"].current=1;
 assert.deepEqual(legalTrainerFeatureActions(s,{actor:{kind:"npc",id:"Luke"}}).map(x=>x.featureId),["raise-your-defenses"]);
});
test("defensive feature is preferred when active Pokemon is endangered",()=>{
 const candidates=[
  {featureId:"directed-strike",effect:"damage-roll-advantage"},
  {featureId:"raise-your-defenses",effect:"ac-or-save-bonus"}
 ];
 assert.equal(chooseNpcTrainerFeature(candidates,{activeHpRatio:0.2,targetHpRatio:0.8}).featureId,"raise-your-defenses");
});
