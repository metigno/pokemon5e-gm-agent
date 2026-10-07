import test from "node:test";
import assert from "node:assert/strict";
import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";

test("opponent Trainer has independent action economy",async()=>{
 const combat=new Pokemon5eCombatEngine({dice:new SequenceDice([1,20])});
 let battle=await combat.createBattle({
  encounterId:"NPC_TRAINER_ACTION_ECONOMY",
  playerPokemon:{species:"Growlithe",form:"Hisuian",level:5},
  opponent:{species:"Houndour",level:5},
  opponentTrainer:{speed:30}
 });
 assert.ok(battle.opponentTrainer);
 const playerAction=battle.trainer.actionAvailable;
 battle=await combat.prepareCurrentTurn(battle);
 assert.equal(combat.actor(battle),"opponent");
 assert.equal(battle.opponentTrainer.actionAvailable,true);
 assert.equal(battle.opponentTrainer.bonusActionAvailable,true);
 assert.equal(battle.opponentTrainer.reactionAvailable,true);
 assert.equal(battle.trainer.actionAvailable,playerAction);
});

test("voluntary NPC switch consumes opponent action economy and ends its turn",async()=>{
 const combat=new Pokemon5eCombatEngine({dice:new SequenceDice([1,20])});
 let battle=await combat.createBattle({
  encounterId:"NPC_VOLUNTARY_SWITCH",
  playerPokemon:{species:"Growlithe",form:"Hisuian",level:5},
  opponent:{species:"Houndour",level:5},
  opponentBench:[{species:"Koffing",level:5}],
  opponentTrainer:{speed:30}
 });
 assert.equal(combat.actor(battle),"opponent");
 const outgoing=battle.opponent.speciesId;
 battle=await combat.switchOpponent(battle,0);
 assert.notEqual(battle.opponent.speciesId,outgoing);
 const event=battle.log.findLast(e=>e.type==="switch"&&e.actor==="opponent");
 assert.equal(event.forced,false);
 assert.equal(battle.opponentTrainer.actionAvailable,false);
 assert.equal(combat.actor(battle),"player");
});

test("voluntary NPC switch obeys switch locks",async()=>{
 const combat=new Pokemon5eCombatEngine({dice:new SequenceDice([1,20])});
 let battle=await combat.createBattle({
  encounterId:"NPC_SWITCH_LOCK",
  playerPokemon:{species:"Growlithe",form:"Hisuian",level:5},
  opponent:{species:"Houndour",level:5},
  opponentBench:[{species:"Koffing",level:5}],
  opponentTrainer:{speed:30}
 });
 battle.opponent.effects.switchLockSources.push({source:"mean-look",expiresRound:99});
 await assert.rejects(()=>combat.switchOpponent(battle,0),/prevents voluntary switching/);
});
