import test from 'node:test';
import assert from 'node:assert/strict';
import { openingState } from '../src/gm-live/canonical-opening.mjs';
import { createTrainerCheckAdapter } from '../src/gm-live/trainer-check-adapter.mjs';

test('all five canonical sheets provide level-one proficiency',()=>{
 for(const name of ['Luke','Edward','Fab','Daniel','Mattew']){
  const {character}=openingState(name);
  assert.equal(character.proficiencyBonus,2);
  assert.equal(character.trainerLevel,1);
  assert.equal(Object.keys(character.abilities).length,6);
 }
});
test('trained skill gains canonical bonus; untrained skill does not',async()=>{
 const engine=createTrainerCheckAdapter();
 const campaign={...openingState('Luke')};
 const base={text:'Inspect tracks',kind:'trainer-check',ability:'WIS',dc:10};
 const trained={...base,skill:'Survival'};
 const untrained={...base,skill:'Stealth'};
 assert.equal((await engine.validateAction({campaign,intent:trained})).allowed,true);
 assert.equal((await engine.validateAction({campaign,intent:untrained})).allowed,true);
 const trainedResult=await engine.resolveAction({campaign,intent:trained});
 const untrainedResult=await engine.resolveAction({campaign,intent:untrained});
 const trainedRoll=trainedResult.statePatch.world.flags.lastTrainerCheck;
 const untrainedRoll=untrainedResult.statePatch.world.flags.lastTrainerCheck;
 assert.equal(trainedRoll.total-trainedRoll.rolls[0],1);
 assert.equal(untrainedRoll.total-untrainedRoll.rolls[0],-1);
});
test('client cannot declare a fake proficiency bonus or advantage',async()=>{
 const engine=createTrainerCheckAdapter(),campaign=openingState('Fab');
 for(const extra of [{proficient:true},{proficiencyBonus:9},{advantage:'advantage'}]){
  const verdict=await engine.validateAction({campaign,intent:{text:'Test',kind:'trainer-check',ability:'CHA',dc:12,...extra}});
  assert.equal(verdict.allowed,false);
 }
});
