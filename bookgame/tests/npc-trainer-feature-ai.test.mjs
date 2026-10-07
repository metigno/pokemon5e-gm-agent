import test from "node:test";
import assert from "node:assert/strict";
import { createPersistentNpc } from "../src/engine/npc-state.mjs";
import { runNpcTrainerTurnFeatures } from "../src/combat/npc-trainer-ai.mjs";

function battle() {
  return {
    round: 3,
    outcome: null,
    awaitingSwitch: null,
    opponent: { effects: {}, turn: { bonusActionAvailable: true } },
    player: { effects: {} },
    log: []
  };
}
const dice={roll:()=>4};

test("NPC Tactician autonomously spends points and primes Directed Strike",()=>{
  const npc=createPersistentNpc({id:"Luke",name:"Luke",state:{trainerLevel:10,trainerPath:"Tactician",abilities:{CON:15}}});
  const b=battle();
  const out=runNpcTrainerTurnFeatures({battle:b,trainer:npc.trainer,dice});
  assert.deepEqual(out.used,["directed-strike"]);
  assert.equal(npc.trainer.classResources["tactical-points"].current,8);
  assert.equal(b.opponent.effects.damageAdvantageSources[0].usesRemaining,1);
  assert.equal(b.log.at(-1).type,"npc_trainer_ai_feature");
});

test("NPC Ace Trainer rolls and spends one Battle Die",()=>{
  const npc=createPersistentNpc({id:"Edward",name:"Edward",state:{trainerLevel:10,trainerPath:"Ace Trainer",abilities:{DEX:15}}});
  const b=battle();
  const before=npc.trainer.classResources["battle-dice"].current;
  const out=runNpcTrainerTurnFeatures({battle:b,trainer:npc.trainer,dice});
  assert.deepEqual(out.used,["battle-master"]);
  assert.equal(npc.trainer.classResources["battle-dice"].current,before-1);
  assert.equal(b.opponent.effects.attackModifierSources[0].value,4);
});

test("NPC Poke Mentor uses Cheerleader as bonus action without replacing its move",()=>{
  const npc=createPersistentNpc({id:"Mattew",name:"Mattew",state:{trainerLevel:10,trainerPath:"Poké Mentor",abilities:{CHA:15}}});
  const b=battle();
  const out=runNpcTrainerTurnFeatures({battle:b,trainer:npc.trainer,dice});
  assert.deepEqual(out.used,["cheerleader"]);
  assert.equal(npc.trainer.classResources.cheerleader.current,0);
  assert.equal(b.opponent.turn.bonusActionAvailable,false);
  const chaMod=Math.floor((Number(npc.trainer.abilities?.CHA??10)-10)/2);
  assert.equal(b.opponent.effects.attackModifierSources[0].value,Math.max(1,chaMod));
});

test("NPC AI never uses a feature the Trainer build does not possess",()=>{
  const npc=createPersistentNpc({id:"Fab",name:"Fab",state:{trainerLevel:10,trainerPath:"Commander",abilities:{CHA:12}}});
  const b=battle();
  const out=runNpcTrainerTurnFeatures({battle:b,trainer:npc.trainer,dice});
  assert.deepEqual(out.used,[]);
  assert.equal(b.log.length,0);
});
