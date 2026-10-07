import test from "node:test";
import assert from "node:assert/strict";
import { createNewGameState } from "../src/engine/state.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { resolveTrainerCheck, resolveTrainerSavingThrow } from "../src/engine/trainer-rolls.mjs";

test("player skill check applies ability and proficiency",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 const r=resolveTrainerCheck(s,{ability:"WIS",skill:"Survival",dc:10,dice:new SequenceDice([10])});
 assert.equal(r.modifier,1); // WIS -1 + proficiency +2
 assert.equal(r.total,11); assert.equal(r.passed,true);
});

test("expertise doubles only proficiency contribution",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 s.player.proficiencies.expertise.push("Survival");
 const r=resolveTrainerCheck(s,{ability:"WIS",skill:"Survival",dice:new SequenceDice([10])});
 assert.equal(r.modifier,3); // WIS -1 + expertise +4
});

test("advantage and disadvantage use the same resolver for NPC Trainers",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 const adv=resolveTrainerCheck(s,{actor:{kind:"npc",id:"Mattew"},ability:"CHA",advantage:true,dice:new SequenceDice([4,17])});
 assert.equal(adv.natural,17); assert.equal(adv.mode,"advantage");
 const dis=resolveTrainerCheck(s,{actor:{kind:"npc",id:"Mattew"},ability:"CHA",disadvantage:true,dice:new SequenceDice([4,17])});
 assert.equal(dis.natural,4); assert.equal(dis.mode,"disadvantage");
});

test("advantage and disadvantage cancel",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 const r=resolveTrainerCheck(s,{ability:"STR",advantage:true,disadvantage:true,dice:new SequenceDice([9])});
 assert.equal(r.mode,"normal"); assert.deepEqual(r.rolls,[9]);
});

test("Trainer saving throws apply save proficiency for player and NPC",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 const player=resolveTrainerSavingThrow(s,{ability:"CHA",dc:10,dice:new SequenceDice([10])});
 const npc=resolveTrainerSavingThrow(s,{actor:{kind:"npc",id:"Daniel"},ability:"CHA",dc:10,dice:new SequenceDice([10])});
 assert.equal(player.proficient,true); assert.equal(npc.proficient,true);
 assert.equal(player.modifier,2); // Luke CHA 10 + PB2
 assert.equal(npc.modifier,4); // Daniel CHA 14 + PB2
 assert.equal(player.passed,true); assert.equal(npc.passed,true);
});
