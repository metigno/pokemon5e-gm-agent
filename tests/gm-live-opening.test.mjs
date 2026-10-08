import test from 'node:test';
import assert from 'node:assert/strict';
import { openingState } from '../src/gm-live/canonical-opening.mjs';
import { FRIEND_STARTING_BUILDS } from '../src/bridge/motor-to-poke5e.mjs';

test('all five canonical starts preserve trainer and starter levels',()=>{
 for(const name of Object.keys(FRIEND_STARTING_BUILDS)){
  const state=openingState(name);
  assert.equal(state.character.trainerLevel,1);
  assert.equal(state.team[0].level,5);
  assert.equal(state.team[0].species,FRIEND_STARTING_BUILDS[name].starter.species);
  assert.equal(Object.keys(state.npcStates).length,4);
  assert.equal(state.world.flags.introFive,'pending');
 }
});
test('Luke starter is Hisuian Growlithe',()=>{
 const state=openingState('Luke');
 assert.equal(state.team[0].species,'Growlithe');
 assert.equal(state.team[0].form,'Hisuian');
});
