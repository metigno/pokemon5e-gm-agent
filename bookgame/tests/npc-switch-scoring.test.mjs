import test from "node:test";
import assert from "node:assert/strict";
import {scoreNpcStay,scoreNpcSwitchCandidate,chooseNpcTurnPlan} from "../src/combat/npc-tactics.mjs";
const mon=(types,hp=20,max=20,setup={})=>({types,hp:{current:hp,max},statuses:{},setup});
test("revealed matchup can make a resistant switch better than staying",()=>{
 const knowledge={player:{types:["fire"],hp:{current:20,max:20},statuses:{}},revealedPlayerMoves:[{id:"ember",type:"fire"}]};
 const active=mon(["grass"],5,20);
 const reserve=mon(["water"],20,20);
 assert.ok(scoreNpcSwitchCandidate(reserve,{knowledge,active})>scoreNpcStay(active,{knowledge}));
 const plan=chooseNpcTurnPlan({legalMoves:[{id:"tackle",time:{unit:"action"},attack:{},dice:{type:"damage"}}],bench:[reserve],active,target:knowledge.player,knowledge,difficulty:"hard"});
 assert.equal(plan.kind,"switch");
});
test("valuable setup discourages throwing away the active Pokemon",()=>{
 const knowledge={player:{types:["normal"],hp:{current:20,max:20},statuses:{}},revealedPlayerMoves:[]};
 const active=mon(["steel"],15,20,{attack:3,ac:2,damage:2});
 const reserve=mon(["water"],20,20);
 assert.ok(scoreNpcStay(active,{knowledge})>scoreNpcSwitchCandidate(reserve,{knowledge,active}));
});
test("unknown player move types cannot influence switch matchup score",()=>{
 const knowledge={player:{types:["fire"],hp:{current:20,max:20},statuses:{}},revealedPlayerMoves:[]};
 const water=mon(["water"],20,20);
 const grass=mon(["grass"],20,20);
 assert.equal(scoreNpcSwitchCandidate(water,{knowledge}),scoreNpcSwitchCandidate(grass,{knowledge}));
});
