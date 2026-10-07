import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { battleFogView } from "../src/combat/fog-of-war.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";

test("RC lock: NPC trainer, forced replacement and fog state survive save/reload together", async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),"p5e-final-lock-"));
  try {
    const store=new SaveStore(dir);
    const combat=new Pokemon5eCombatEngine({dice:new SequenceDice([10,10,10,10,10,10])});
    let battle=await combat.createBattle({
      encounterId:"FINAL_LOCK",
      playerPokemon:{species:"Growlithe",form:"Hisuian",level:5},
      opponent:{species:"Houndour",level:5},
      opponentBench:[
        {species:"Pidgey",level:5},
        {species:"Machop",level:8}
      ],
      opponentTrainer:{
        id:"npc-final-lock",
        name:"NPC",
        trainerPath:{id:"tactician"},
        classResources:{"tactical-points":{current:4,max:4}},
        classFeatures:["directed-strike"],
        abilities:{CHA:10}
      },
      playerKnowledge:{default:0,active:2,bench:0}
    });

    battle.opponent.hp.current=0;
    const beforeSpecies=battle.opponent.speciesId;
    // Trigger the same forced-replacement path through the combat lifecycle.
    battle=await combat.endOpponentTurn(battle);
    assert.notEqual(battle.opponent.speciesId,beforeSpecies);

    const state={slot:"final-lock",pending:{type:"pokemon5e_combat",status:"in_progress",battle}};
    await store.save(state);
    const loaded=await store.load("final-lock");
    assert.deepEqual(loaded,state);
    assert.equal(loaded.pending.battle.opponentTrainer.classResources["tactical-points"].current,4);
    assert.deepEqual(loaded.pending.battle.playerKnowledge,{default:0,active:2,bench:0});

    const visible=battleFogView(loaded.pending.battle,loaded.pending.battle.playerKnowledge);
    assert.equal("moveIds" in visible.opponent,true);
    assert.equal("moveIds" in visible.opponentBench[0],false);
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});
