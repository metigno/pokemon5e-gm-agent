import test from "node:test";
import assert from "node:assert/strict";
import { createNewGameState } from "../src/engine/state.mjs";
import { equipTrainerGear, unequipTrainerGear, spendTrainerResource, useTrainerFeature } from "../src/engine/trainer-actions.mjs";

test("player Trainer Gear can be equipped and unequipped",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 s.player.trainerGear.push({id:"field-kit",kind:"gear"});
 assert.deepEqual(equipTrainerGear(s,{gearId:"field-kit"}),{equipped:true,gearId:"field-kit"});
 assert.equal(s.player.equipment[0].id,"field-kit");
 assert.deepEqual(unequipTrainerGear(s,{gearId:"field-kit"}),{equipped:false,gearId:"field-kit"});
 assert.equal(s.player.equipment.length,0);
});

test("NPC Trainer Gear uses the same action runtime",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 s.npcs.Mattew.trainer.trainerGear.push({id:"mentor-kit"});
 equipTrainerGear(s,{actor:{kind:"npc",id:"Mattew"},gearId:"mentor-kit"});
 assert.equal(s.npcs.Mattew.trainer.equipment[0].id,"mentor-kit");
});

test("player and NPC class resources validate and spend identically",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 s.player.classResources.resolve={current:2,max:2};
 s.npcs.Daniel.trainer.classResources.collectorFocus={current:1,max:1};
 assert.equal(spendTrainerResource(s,{resourceId:"resolve"}).current,1);
 assert.equal(spendTrainerResource(s,{actor:{kind:"npc",id:"Daniel"},resourceId:"collectorFocus"}).current,0);
 assert.equal(spendTrainerResource(s,{actor:{kind:"npc",id:"Daniel"},resourceId:"collectorFocus"}).spent,false);
});

test("class feature usage is shared, validated and consumes its declared resource",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 s.player.classFeatures.push("test-feature");
 s.player.classResources.test={current:1,max:1};
 const used=useTrainerFeature(s,{featureId:"test-feature",resourceId:"test"});
 assert.equal(used.used,true);
 assert.equal(s.player.classResources.test.current,0);
 assert.equal(s.player.featureUsage["test-feature"].uses,1);
 const blocked=useTrainerFeature(s,{featureId:"test-feature",resourceId:"test"});
 assert.equal(blocked.used,false);
 assert.equal(s.player.featureUsage["test-feature"].uses,1);
});
