import test from "node:test";
import assert from "node:assert/strict";
import {resolveAttackCheck,resolveAttack} from "../src/combat/poke5e-rules.mjs";
import {SequenceDice} from "../src/engine/dice.mjs";
function mon(ac=15){return {level:5,ac,attributes:{str:14,dex:14,con:12,int:10,wis:10,cha:10},effects:{attackAdvantageSources:[],attackDisadvantageSources:[],incomingAttackAdvantageSources:[],attackRollDiceSources:[],criticalRangeBonusSources:[],restrainedSources:[],damageAdvantageSources:[]},statuses:{},types:["normal"],abilityId:null};}
const move={id:"test-hit",name:"Test Hit",type:"normal",attack:{scope:"melee",attribute:"str"},dice:{type:"damage",count:1,value:6},damage:{attribute:"str"}};
test("pre-rolled attack check is reused without consuming a second d20",()=>{
 const dice=new SequenceDice([12,4]);
 const attacker=mon(),defender=mon(15);
 const check=resolveAttackCheck({attacker,defender,move,dice});
 const result=resolveAttack({attacker,defender,move,dice,attackCheck:check});
 assert.equal(result.attackRoll.natural,12);
 assert.equal(result.damageRoll.selected.total,4);
 assert.equal(dice.results.length,0);
});
test("raising AC between check and resolution prevents damage dice consumption",()=>{
 const dice=new SequenceDice([12]);
 const attacker=mon(),defender=mon(99);
 const check=resolveAttackCheck({attacker,defender:{...defender,ac:15},move,dice});
 const result=resolveAttack({attacker,defender,move,dice,attackCheck:check});
 assert.equal(result.hit,false);
 assert.equal(dice.results.length,0);
});
