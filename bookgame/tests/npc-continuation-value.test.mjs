import test from "node:test";
import assert from "node:assert/strict";
import {continuationValue,reservePreservationCost,criticalDecisionLookahead,npcDifficultyProfile} from "../src/combat/npc-tactics.mjs";
const mon=(level,hp,max=20,types=["normal"])=>({level,types,hp:{current:hp,max},statuses:{},setup:{}});
test("healthy high-level reserve has greater continuation value",()=>{
 const k={revealedPlayerMoves:[]};
 assert.ok(continuationValue(mon(15,20),{knowledge:k})>continuationValue(mon(5,8),{knowledge:k}));
});
test("best surviving reserve gets a preservation cost when alternatives exist",()=>{
 const best=mon(15,20),other=mon(8,12);
 assert.equal(reservePreservationCost(best,[best,other],{knowledge:{revealedPlayerMoves:[]}}),12);
 assert.equal(reservePreservationCost(other,[best,other],{knowledge:{revealedPlayerMoves:[]}}),0);
});
test("very-hard uses deeper bounded continuation weighting than hard",()=>{
 const active=mon(10,10),candidate=mon(15,20),knowledge={revealedPlayerMoves:[]};
 const hard=criticalDecisionLookahead({profile:npcDifficultyProfile("hard"),stayScore:60,switchScore:60,active,candidate,knowledge});
 const very=criticalDecisionLookahead({profile:npcDifficultyProfile("very-hard"),stayScore:60,switchScore:60,active,candidate,knowledge});
 assert.ok((very.switch-very.stay)>(hard.switch-hard.stay));
});
