import test from "node:test";
import assert from "node:assert/strict";
import { applyTrainerCombatEffect } from "../src/combat/trainer-effects.mjs";
function battle(){return {round:3,player:{effects:{}},opponent:{effects:{}},log:[]};}
test("Directed Strike becomes one-shot damage advantage",()=>{
 const b=battle();applyTrainerCombatEffect(b,{side:"player",featureResult:{used:true,featureId:"directed-strike",effect:"damage-roll-advantage"}});
 assert.equal(b.player.effects.damageAdvantageSources[0].usesRemaining,1);
});
test("Raise Your Defenses enters existing AC/save modifier pipeline",()=>{
 const b=battle();applyTrainerCombatEffect(b,{side:"player",featureResult:{used:true,featureId:"raise-your-defenses",effect:"ac-or-save-bonus",amount:4},mode:"save"});
 assert.equal(b.player.effects.saveModifierSources[0].value,4);
});
test("Battle Die feeds existing attack modifier pipeline",()=>{
 const b=battle();applyTrainerCombatEffect(b,{side:"player",featureResult:{used:true,featureId:"battle-master",effect:"attack-or-damage-bonus"},mode:"attack",roll:6});
 assert.equal(b.player.effects.attackModifierSources[0].value,6);
 assert.equal(b.player.effects.attackModifierSources[0].usesRemaining,1);
});
test("Disciplined Strikes is represented as a consumable combat trigger",()=>{
 const b=battle();applyTrainerCombatEffect(b,{side:"player",targetSide:"opponent",featureResult:{used:true,featureId:"disciplined-strikes",effect:"leave-pokemon-at-1-hp"}});
 assert.equal(b.trainerEffects.disciplinedStrikes.targetSide,"opponent");
});
