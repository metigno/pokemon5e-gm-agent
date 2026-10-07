import test from "node:test";
import assert from "node:assert/strict";
import {createNpcKnowledge,updateNpcKnowledge,npcPublicBattleView} from "../src/combat/npc-knowledge.mjs";
import {assessPublicThreat} from "../src/combat/npc-tactics.mjs";

function mon(id,hp=20){return {speciesId:id,hp:{current:hp,max:20},statuses:{},moveIds:["secret-move"]};}
test("NPC knowledge never exposes unrevealed player moves or hidden bench",()=>{
 const battle={round:1,player:mon("growlithe"),opponent:mon("houndour"),playerBench:[mon("gastly")],opponentBench:[mon("koffing")],log:[]};
 const knowledge=createNpcKnowledge(battle);
 const view=npcPublicBattleView(battle,knowledge);
 assert.deepEqual(view.revealedPlayerMoves,[]);
 assert.deepEqual(view.knownPlayerBench,[]);
 assert.equal("moveIds" in view.player,false);
 assert.equal(view.opponentBench.length,1);
});
test("player move becomes known only after it is observed in battle log",()=>{
 const battle={round:1,player:mon("growlithe"),opponent:mon("houndour"),opponentBench:[],log:[]};
 let k=createNpcKnowledge(battle);
 battle.log.push({type:"attack",actor:"player",moveId:"ember"});
 k=updateNpcKnowledge(battle,k);
 const view=npcPublicBattleView(battle,k);
 assert.deepEqual(view.revealedPlayerMoves,["ember"]);
});
test("threat assessment is derived from public view only",()=>{
 const view={player:{speciesId:"growlithe",hp:{current:20,max:20},statuses:{}},revealedPlayerMoves:["ember"],knownPlayerBench:[]};
 const threat=assessPublicThreat(view);
 assert.equal(threat.score,64);
 assert.deepEqual(threat.reasons,["target_healthy","revealed_moves"]);
});
