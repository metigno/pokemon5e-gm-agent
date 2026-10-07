import test from "node:test";
import assert from "node:assert/strict";
import { chooseNpcMove,npcDifficultyProfile } from "../src/combat/npc-tactics.mjs";

const damage={id:"tackle",time:{unit:"action"},attack:{},dice:{type:"damage"},description:"Deals damage."};
const status={id:"thunder-wave",time:{unit:"action"},description:"Target may become paralyzed."};
const setup={id:"barrier",time:{unit:"action"},description:"Raises Armor Class."};

test("hard is the default NPC difficulty and never changes stats or dice",()=>{
 const p=npcDifficultyProfile();
 assert.equal(p.id,"hard");
 assert.deepEqual(Object.keys(p).sort(),["id","lookahead","preferDamage","preserveResources","useStatus"].sort());
});

test("tactical NPC values control instead of blindly taking first legal move",()=>{
 assert.equal(chooseNpcMove([status,damage],{difficulty:"hard"}).id,"tackle");
 assert.equal(chooseNpcMove([damage,setup],{difficulty:"hard",selfHpRatio:0.3}).id,"tackle");
});

test("easy profile preserves deterministic first-legal behavior",()=>{
 assert.equal(chooseNpcMove([status,damage],{difficulty:"easy"}).id,"thunder-wave");
});
